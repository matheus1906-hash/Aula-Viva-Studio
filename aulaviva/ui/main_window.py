"""Janela principal: controla o fluxo boas-vindas -> login -> app, e o bloqueio por inatividade."""

from __future__ import annotations

import time

from PySide6.QtCore import QEvent, QObject, QTimer
from PySide6.QtWidgets import QApplication, QMainWindow, QStackedLayout, QWidget

from aulaviva import APP_NAME
from aulaviva.core.auth import AuthService, User
from aulaviva.core.config import Preferences
from aulaviva.core.database import Database
from aulaviva.core.projects import ProjectStore
from aulaviva.ui.auth_views import LoginView, RecoveryView, RegisterView, show_recovery_codes
from aulaviva.ui.dashboard import Shell
from aulaviva.ui.editor import EditorView
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
        self.shell: Shell | None = None
        self.editor: EditorView | None = None
        self.setWindowTitle(APP_NAME)
        self.setWindowIcon(app_icon())
        self.setMinimumSize(1080, 700)
        self.resize(1360, 860)

        central = QWidget()
        layout = QStackedLayout(central)
        layout.setStackingMode(QStackedLayout.StackingMode.StackAll)
        self.bg = SchoolBackground()
        self.stack = AnimatedStack()
        self.stack.setStyleSheet("background: transparent;")
        layout.addWidget(self.stack)
        layout.addWidget(self.bg)
        self.stack.raise_()
        self.setCentralWidget(central)

        self.login = LoginView(self.auth, prefs)
        self.login.logged_in.connect(self.on_login)
        self.login.wants_register.connect(self.show_register)
        self.login.wants_recovery.connect(self.show_recovery)
        self.recovery = RecoveryView(self.auth)
        self.recovery.done.connect(lambda: self.stack.slide_to(self.login, -1))
        self.stack.addWidget(self.login)
        self.stack.addWidget(self.recovery)

        self.idle = IdleWatcher()
        QApplication.instance().installEventFilter(self.idle)
        self._idle_timer = QTimer(self, interval=15_000, timeout=self._check_idle)
        self._idle_timer.start()

        if prefs.first_run_done:
            self.stack.setCurrentWidget(self.login)
        else:
            self.show_intro(first=True)

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

    def on_login(self, user: User):
        self.user = user
        if not user.profile_complete:
            view = RegisterView(self.auth, complete_user=user)
            view.cancelled.connect(lambda: (self.do_logout(""), view.deleteLater()))
            view.completed.connect(lambda u: (self.on_login(u), view.deleteLater()))
            self.stack.slide_to(view)
            return
        self.shell = Shell(self.auth, self.store, self.prefs, user)
        self.shell.logout.connect(self.do_logout)
        self.shell.open_editor.connect(self.open_editor)
        self.shell.intro_requested.connect(self.show_intro)
        self.stack.addWidget(self.shell)
        self.stack.slide_to(self.shell)
        self.idle.last = time.monotonic()
        Toast.show_message(self, f"Bem-vindo(a), {user.first_name}!", "success", 2200)

    def open_editor(self, pid: int):
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
        if self.user and time.monotonic() - self.idle.last > self.prefs.idle_lock_minutes * 60:
            self.do_logout("Sessão bloqueada por inatividade. Entre novamente para continuar.")

    def closeEvent(self, e):
        if self.editor:
            self.editor.save_silent()
        super().closeEvent(e)
