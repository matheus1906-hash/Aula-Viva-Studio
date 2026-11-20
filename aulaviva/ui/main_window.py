"""Janela principal: controla o fluxo boas-vindas -> login -> app, e o bloqueio por inatividade."""

from __future__ import annotations

import time

from PySide6.QtCore import QEvent, QObject, Qt, QTimer
from PySide6.QtWidgets import QApplication, QMainWindow, QStackedLayout, QWidget

from aulaviva import APP_NAME
from aulaviva.core import session_store
from aulaviva.core.auth import AuthError, AuthService, User
from aulaviva.core.config import Preferences
from aulaviva.core.database import Database
from aulaviva.core.projects import ProjectStore
from aulaviva.ui.auth_views import LoginView, RecoveryView, RegisterView, show_recovery_codes
from aulaviva.ui.dashboard import Shell
from aulaviva.ui.effects import SchoolBackground, app_icon
from aulaviva.ui.onboarding import OnboardingView
from aulaviva.ui.widgets import AnimatedStack, Motion, Toast


class IdleWatcher(QObject):
    """Registra a última interação do usuário (teclado/mouse)."""

    EVENTS = {QEvent.Type.KeyPress, QEvent.Type.MouseButtonPress, QEvent.Type.Wheel, QEvent.Type.MouseMove}

    def __init__(self):
        super().__init__()
        self.last = time.monotonic()

    def eventFilter(self, obj, ev):
        if ev.type() in self.EVENTS:
            self.last = time.monotonic()
        return False


class MainWindow(QMainWindow):
    def __init__(self, db: Database, prefs: Preferences):
        super().__init__()
        self.db, self.prefs = db, prefs
        self.auth = AuthService(db)
        self.store = ProjectStore(db)
        self.user: User | None = None
        self._session_token: str | None = None
        self.shell: Shell | None = None
        self.editor = None  # EditorView (importado sob demanda: abre o app mais rápido)
        self.setWindowTitle(APP_NAME)
        self.setWindowIcon(app_icon())
        self.setMinimumSize(900, 560)  # cabe em notebook 1366x768 com zoom de 125% (1093x614)
        self._fit_to_screen()

        central = QWidget()
        layout = QStackedLayout(central)
        layout.setStackingMode(QStackedLayout.StackingMode.StackAll)
        self.bg = SchoolBackground()
        self.stack = AnimatedStack()
        self.stack.setAutoFillBackground(False)  # transparente sem regra de estilo em cascata
        layout.addWidget(self.stack)
        layout.addWidget(self.bg)
        self.stack.raise_()
        self.setCentralWidget(central)

        self._build_auth_views()

        self.idle = IdleWatcher()
        QApplication.instance().installEventFilter(self.idle)
        self._idle_timer = QTimer(self, interval=15_000, timeout=self._check_idle)
        self._idle_timer.start()
        QTimer.singleShot(1500, self._warm_imports)  # carrega o editor/PDF em segundo plano, quando o app está ocioso

        if prefs.first_run_done:
            if not self._resume_session():
                self.stack.setCurrentWidget(self.login)
        else:
            self.show_intro(first=True)

    def _fit_to_screen(self):
        """Abre num tamanho que cabe na tela (antes 1360x860 fixo: em notebook a janela passava da tela)."""
        scr = QApplication.primaryScreen()
        if scr is None:
            self.resize(1360, 860)
            return
        avail = scr.availableGeometry()
        w, h = min(1360, int(avail.width() * 0.94)), min(860, int(avail.height() * 0.92))
        self.resize(max(900, w), max(560, h))
        if avail.width() < 1300 or avail.height() < 760:
            self.setWindowState(self.windowState() | Qt.WindowState.WindowMaximized)

    @staticmethod
    def _warm_imports():
        try:
            import aulaviva.ui.editor  # noqa: F401
        except Exception:
            pass

    # -- manter conectado ------------------------------------------------------
    def _resume_session(self) -> bool:
        """Entra direto com o token salvo (\"Manter conectado\"). Retorna True se entrou."""
        if not self.prefs.keep_signed_in:
            session_store.clear()
            return False
        token = session_store.load(self.db.crypto)
        if not token:
            return False
        try:
            user, new_token = self.auth.resume_session(token)
        except AuthError:
            session_store.clear()
            return False
        session_store.save(new_token, self.db.crypto)
        self._session_token = new_token
        self.on_login(user, animate=False)
        return self.user is not None and self.shell is not None

    def _remember_session(self, user: User):
        if not self.prefs.keep_signed_in or getattr(self, "_session_token", None):
            return
        try:
            token = self.auth.create_session(user.id)
            session_store.save(token, self.db.crypto)
            self._session_token = token
        except Exception:  # sem cofre/disco: apenas não lembra
            self._session_token = None

    def _forget_session(self):
        self.auth.end_session(getattr(self, "_session_token", None) or session_store.load(self.db.crypto))
        session_store.clear()
        self._session_token = None

    # -- fluxo ---------------------------------------------------------------
    def show_intro(self, first: bool = False):
        view = OnboardingView()

        def done():
            self.prefs.first_run_done = True
            self.prefs.save()
            self.stack.slide_to(self.shell if (self.user and self.shell) else self.login)
            view.deleteLater()

        view.finished.connect(done)
        if first:
            self.stack.addWidget(view)
            self.stack.setCurrentWidget(view)
        else:
            self.stack.slide_to(view)
        view.setFocus()

    def show_register(self):
        view = RegisterView(self.auth)
        view.cancelled.connect(lambda: (self.stack.slide_to(self.login, -1), view.deleteLater()))
        view.registered.connect(lambda user, codes: show_recovery_codes(self, codes, lambda: (self.on_login(user), view.deleteLater())))
        self.stack.slide_to(view)

    def show_recovery(self):
        self.stack.slide_to(self.recovery)

    def _build_auth_views(self):
        self.login = LoginView(self.auth, self.prefs)
        self.login.logged_in.connect(self.on_login)
        self.login.wants_register.connect(self.show_register)
        self.login.wants_recovery.connect(self.show_recovery)
        self.recovery = RecoveryView(self.auth)
        self.recovery.done.connect(lambda: self.stack.slide_to(self.login, -1))
        self.stack.addWidget(self.login)
        self.stack.addWidget(self.recovery)

    def apply_theme(self, mode: str):
        """Troca claro/escuro na hora: recria as telas mantendo o usuário logado e o material aberto."""
        from aulaviva.ui import theme
        from aulaviva.ui.widgets import Modal

        from PySide6.QtCore import QEvent

        self.prefs.theme_mode = mode
        self.prefs.save()
        self.setUpdatesEnabled(False)
        pid = self.editor.pid if self.editor else None
        if self.editor:
            self.editor.save_silent()
        # 1) destrói as telas antigas ANTES de trocar o estilo: o Qt não precisa re-estilizar centenas de widgets
        old = [w for w in (self.login, self.recovery, self.shell, self.editor) if w is not None]
        old += list(self.findChildren(Modal))
        for w in old:
            self.stack.removeWidget(w)
            w.hide()
            w.setParent(None)
            w.deleteLater()
        self.editor = self.shell = self.login = self.recovery = None
        QApplication.sendPostedEvents(None, QEvent.Type.DeferredDelete)
        # 2) troca paleta e estilo com a janela praticamente vazia
        theme.set_mode(mode)
        app = QApplication.instance()
        theme.apply_palette(app)
        app.setStyleSheet(theme.stylesheet(theme.pick_font_family()))
        self.bg._pix = None
        self.bg._regen()
        had_session = self.user is not None
        # 3) recria só o necessário (páginas do painel são montadas sob demanda)
        self._build_auth_views()
        if had_session:
            self._make_shell(self.user)
            if pid is not None:
                self.open_editor(pid)
                self.stack.setCurrentWidget(self.editor)
            else:
                self.shell.navigate("settings", tab=3)
                self.stack.setCurrentWidget(self.shell)
        else:
            self.stack.setCurrentWidget(self.login)
        self.setUpdatesEnabled(True)

    def _make_shell(self, user: User):
        self.shell = Shell(self.auth, self.store, self.prefs, user)
        self.shell.logout.connect(self.do_logout)
        self.shell.open_editor.connect(self.open_editor)
        self.shell.intro_requested.connect(self.show_intro)
        self.shell.theme_requested.connect(self.apply_theme)
        self.stack.addWidget(self.shell)

    def on_login(self, user: User, animate: bool = True):
        self.user = user
        if not user.profile_complete:
            view = RegisterView(self.auth, complete_user=user)
            view.cancelled.connect(lambda: (self.do_logout(""), view.deleteLater()))
            view.completed.connect(lambda u: (self.on_login(u), view.deleteLater()))
            self.stack.slide_to(view)
            return
        self._remember_session(user)
        self._make_shell(user)
        if animate:
            self.stack.slide_to(self.shell)
        else:
            self.stack.setCurrentWidget(self.shell)
        self.idle.last = time.monotonic()
        Toast.show_message(self, f"Bem-vindo(a), {user.first_name}!", "success", 2200)

    def open_editor(self, pid: int):
        from aulaviva.ui.editor import EditorView

        if self.editor:
            self.editor.deleteLater()
        self.editor = EditorView(self.store, self.user.id, self.shell.get_assistant)
        self.editor.back_requested.connect(self.close_editor)
        self.editor.open_project(pid)
        self.stack.addWidget(self.editor)
        self.stack.slide_to(self.editor)

    def close_editor(self):
        if self.shell:
            self.shell.refresh_current()
            self.stack.slide_to(self.shell, -1)
        ed, self.editor = self.editor, None
        if ed:
            QTimer.singleShot(500, ed.deleteLater)

    def do_logout(self, message: str = ""):
        if self.editor:
            self.editor.save_silent()
        if self.user and message != "Sua conta foi excluída.":
            self.db.audit("logout" if not message.startswith("Sessão") else "session_locked", self.user.id)
        self._forget_session()  # "Sair" (ou bloqueio) sempre exige a senha na próxima vez
        self.user = None
        # Fecha modais abertos e descarta telas com dados pessoais
        for w in self.findChildren(QWidget):
            if w.__class__.__name__ == "Modal":
                w.hide()
                w.deleteLater()
        self.stack.slide_to(self.login, -1)
        for attr in ("editor", "shell"):
            w = getattr(self, attr)
            setattr(self, attr, None)
            if w:
                QTimer.singleShot(500, w.deleteLater)
        self.login.show_notice(message)

    def _check_idle(self):
        if getattr(self, "_session_token", None):
            return  # "Manter conectado" ativo: o professor escolheu não ser desconectado neste computador
        if self.user and time.monotonic() - self.idle.last > self.prefs.idle_lock_minutes * 60:
            self.do_logout("Sessão bloqueada por inatividade. Entre novamente para continuar.")

    def closeEvent(self, e):
        if self.editor:
            self.editor.save_silent()
        super().closeEvent(e)
