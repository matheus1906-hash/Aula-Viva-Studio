"""Área logada: barra lateral, início, projetos, modelos e configurações."""

from __future__ import annotations

import json
import time
from datetime import datetime

from PySide6.QtCore import QEasingCurve, QPropertyAnimation, QRectF, QSize, Qt, Signal
from PySide6.QtGui import QColor, QCursor, QLinearGradient, QPainter, QPen
from PySide6.QtWidgets import (
    QComboBox, QFileDialog, QGridLayout, QHBoxLayout, QLabel, QLineEdit, QMenu, QSpinBox, QTabWidget, QVBoxLayout,
    QWidget,
)

from aulaviva import APP_NAME, __version__
from aulaviva.core import ai as ai_mod
from aulaviva.core.auth import AuthError, AuthService, User
from aulaviva.core.config import Preferences
from aulaviva.core.projects import ProjectStore, new_document, template_documents
from aulaviva.core.security import SecurityError
from aulaviva.ui import theme
from aulaviva.ui.auth_views import ProfileForm, show_recovery_codes
from aulaviva.ui.effects import logo_pixmap
from aulaviva.ui.widgets import (
    AnimatedStack, Button, Field, GlassCard, Modal, Motion, PasswordInput, SmoothScrollArea, StrengthMeter, Toast,
    checkbox, confirm, fade_in, label, line_edit,
)
from aulaviva.ui.workers import run_async

EVENT_NAMES = {
    "login_success": "Login realizado", "login_failed": "Tentativa de login falhou", "account_created": "Conta criada",
    "password_changed": "Senha alterada", "password_reset_recovery_code": "Senha redefinida com código",
    "recovery_codes_regenerated": "Novos códigos de recuperação", "profile_updated": "Perfil atualizado",
    "project_created": "Projeto criado", "project_deleted": "Projeto excluído", "data_exported": "Dados exportados",
    "session_locked": "Sessão bloqueada por inatividade", "oauth_linked": "Conta externa vinculada", "logout": "Saída",
}


def greeting() -> str:
    h = datetime.now().hour
    return "Bom dia" if h < 12 else "Boa tarde" if h < 18 else "Boa noite"


def when(ts: float) -> str:
    diff = time.time() - ts
    if diff < 60:
        return "agora mesmo"
    if diff < 3600:
        return f"há {int(diff // 60)} min"
    if diff < 86400:
        return f"há {int(diff // 3600)} h"
    return datetime.fromtimestamp(ts).strftime("%d/%m/%Y")


class NavButton(QWidget):
    clicked = Signal()

    def __init__(self, icon: str, text: str):
        super().__init__()
        self.icon, self.text, self.active, self._hover, self._act = icon, text, False, 0.0, 0.0
        self.setFixedHeight(44)
        self.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        from PySide6.QtCore import QVariantAnimation

        self._h = QVariantAnimation(self, duration=Motion.ms(160))
        self._h.valueChanged.connect(lambda v: (setattr(self, "_hover", float(v)), self.update()))
        self._aa = QVariantAnimation(self, duration=Motion.ms(260), easingCurve=QEasingCurve.Type.OutCubic)
        self._aa.valueChanged.connect(lambda v: (setattr(self, "_act", float(v)), self.update()))

    def set_active(self, on: bool):
        if on == self.active:
            return
        self.active = on
        self._aa.stop()
        self._aa.setStartValue(self._act)
        self._aa.setEndValue(1.0 if on else 0.0)
        self._aa.start()

    def enterEvent(self, e):
        self._h.stop()
        self._h.setStartValue(self._hover)
        self._h.setEndValue(1.0)
        self._h.start()

    def leaveEvent(self, e):
        self._h.stop()
        self._h.setStartValue(self._hover)
        self._h.setEndValue(0.0)
        self._h.start()

    def mouseReleaseEvent(self, e):
        if self.rect().contains(e.position().toPoint()):
            self.clicked.emit()

    def paintEvent(self, e):
        from aulaviva.ui.art import line_icon

        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        r = QRectF(self.rect()).adjusted(2, 2, -2, -2)
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(QColor(47, 111, 237, int(14 * self._hover * (1 - self._act))))
        p.drawRoundedRect(r, 11, 11)
        if self._act:
            soft = QColor(theme.PRIMARY_SOFT)
            soft.setAlphaF(self._act)
            p.setBrush(soft)
            p.drawRoundedRect(r, 11, 11)
            p.setBrush(QColor(theme.PRIMARY))
            h = (self.height() - 22) * self._act
            p.drawRoundedRect(QRectF(2, (self.height() - h) / 2, 4, h), 2, 2)
        col = QColor(theme.PRIMARY) if self.active else QColor(theme.TEXT_DIM)
        line_icon(p, QRectF(16 + 2 * self._hover, (self.height() - 20) / 2, 20, 20), self.icon, col)
        f = self.font()
        f.setPixelSize(14)
        f.setWeight(f.Weight.Bold if self.active else f.Weight.DemiBold)
        p.setFont(f)
        p.setPen(QColor(theme.PRIMARY) if self.active else QColor(theme.TEXT_DIM))
        p.drawText(QRectF(48 + 2 * self._hover, 0, self.width() - 52, self.height()), Qt.AlignmentFlag.AlignVCenter, self.text)


class Sidebar(GlassCard):
    navigate = Signal(str)
    logout = Signal()

    ITEMS = [("home", "home", "Início"), ("projects", "folder", "Meus materiais"), ("templates", "templates", "Modelos"),
             ("tools", "qr", "QR code e links"), ("ai", "sparkle", "Assistente IA"), ("settings", "gear", "Configurações")]

    def __init__(self, user: User):
        super().__init__(radius=20, padding=16, opacity=0.06)
        self.setFixedWidth(232)
        head = QHBoxLayout()
        lg = QLabel()
        lg.setPixmap(logo_pixmap(34))
        head.addWidget(lg)
        nm = QVBoxLayout()
        nm.setSpacing(0)
        nm.addWidget(label("AulaViva", "h3"))
        nm.addWidget(label("Studio", "muted"))
        head.addLayout(nm)
        head.addStretch()
        self.lay.addLayout(head)
        self.lay.addSpacing(14)
        self.buttons: dict[str, NavButton] = {}
        for key, icon, text in self.ITEMS:
            b = NavButton(icon, text)
            b.clicked.connect(lambda k=key: self.navigate.emit(k))
            self.lay.addWidget(b)
            self.buttons[key] = b
        self.lay.addStretch()
        prof = GlassCard(radius=14, padding=12, opacity=0.06)
        self.user_name = label("", "h3")
        self.user_inst = label("", "muted", wrap=True)
        prof.lay.setSpacing(2)
        prof.lay.addWidget(self.user_name)
        prof.lay.addWidget(self.user_inst)
        out = Button("Sair", "ghost", icon_text="⎋", height=34)  # ícone desenhado (logout)
        out.clicked.connect(self.logout)
        prof.lay.addWidget(out)
        self.lay.addWidget(prof)
        self.set_user(user)

    def set_user(self, user: User):
        self.user_name.setText(user.first_name)
        self.user_inst.setText(user.profile.institution if user.profile else user.email)

    def set_active(self, key: str):
        for k, b in self.buttons.items():
            b.set_active(k == key)


class ProviderTile(QWidget):
    """Opção de provedor de IA (selecionável) com selo de 'chave salva'."""

    clicked = Signal(str)

    def __init__(self, key: str):
        super().__init__()
        self.key = key
        self.active = self.has_key = self._hover = False
        name, desc = ai_mod.PROVIDERS[key]
        self.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        self.setMinimumHeight(62)
        lay = QVBoxLayout(self)
        lay.setContentsMargins(14, 9, 12, 9)
        lay.setSpacing(1)
        top = QHBoxLayout()
        self.name = label(name, "h3")
        top.addWidget(self.name, 1)
        self.badge = label("", "badge")
        top.addWidget(self.badge)
        lay.addLayout(top)
        lay.addWidget(label(desc, "muted", wrap=True))

    def set_state(self, active: bool, has_key: bool):
        self.active, self.has_key = active, has_key
        self.badge.setText("✓ chave salva" if has_key else ("em uso" if active else ""))
        self.badge.setVisible(bool(self.badge.text()))
        self.update()

    def enterEvent(self, e):
        self._hover = True
        self.update()

    def leaveEvent(self, e):
        self._hover = False
        self.update()

    def mouseReleaseEvent(self, e):
        if self.rect().contains(e.position().toPoint()):
            self.clicked.emit(self.key)

    def paintEvent(self, e):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        r = QRectF(self.rect()).adjusted(1, 1, -1, -1)
        p.setBrush(QColor(theme.PRIMARY_SOFT) if self.active else (QColor(theme.HOVER) if self._hover else QColor(theme.SURFACE)))
        p.setPen(QPen(QColor(theme.PRIMARY), 2) if self.active else QPen(QColor(theme.BORDER_HOVER if self._hover else theme.BORDER), 1))
        p.drawRoundedRect(r, 12, 12)


class ProjectCard(QWidget):
    open_requested = Signal(int)
    menu_requested = Signal(int, object)

    def __init__(self, pid: int, title: str, subtitle: str, color: str = theme.PRIMARY):
        super().__init__()
        self.pid, self.title, self.subtitle, self.color = pid, title, subtitle, QColor(color)
        self.setFixedSize(QSize(220, 170))
        self.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        self._lift = 0.0
        from PySide6.QtCore import QVariantAnimation

        self._a = QVariantAnimation(self, duration=Motion.ms(200), easingCurve=QEasingCurve.Type.OutCubic)
        self._a.valueChanged.connect(lambda v: (setattr(self, "_lift", float(v)), self.update()))
        self.setToolTip(title)

    def _anim(self, end):
        self._a.stop()
        self._a.setStartValue(self._lift)
        self._a.setEndValue(end)
        self._a.start()

    def enterEvent(self, e):
        self._anim(1.0)

    def leaveEvent(self, e):
        self._anim(0.0)

    def mouseReleaseEvent(self, e):
        if e.button() == Qt.MouseButton.RightButton or QRectF(self.width() - 40, 6, 34, 30).contains(e.position()):
            self.menu_requested.emit(self.pid, self.mapToGlobal(e.position().toPoint()))
        elif self.rect().contains(e.position().toPoint()):
            self.open_requested.emit(self.pid)

    def paintEvent(self, e):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        lift = self._lift * 4
        r = QRectF(4, 6 - lift, self.width() - 8, self.height() - 10)
        # sombra suave pintada (mais leve que QGraphicsDropShadowEffect)
        for i in range(5):
            p.setPen(Qt.PenStyle.NoPen)
            p.setBrush(QColor(*theme.SHADOW, (int(7 + 6 * self._lift) - i) * (3 if theme.is_dark() else 1)))
            p.drawRoundedRect(r.adjusted(-i + 1, -i + 3 + lift, i - 1, i + 3 + lift), 16 + i, 16 + i)
        p.setBrush(QColor(theme.SURFACE))
        p.setPen(QPen(QColor(theme.PRIMARY) if self._lift > 0.5 else QColor(theme.BORDER), 1))
        p.drawRoundedRect(r, 16, 16)
        # miniatura da "página"
        thumb = QRectF(r.left() + 14, r.top() + 14, r.width() - 28, 74)
        g = QLinearGradient(thumb.topLeft(), thumb.bottomRight())
        g.setColorAt(0, self.color)
        g.setColorAt(1, self.color.darker(160))
        p.setBrush(g)
        p.setPen(Qt.PenStyle.NoPen)
        p.drawRoundedRect(thumb, 10, 10)
        p.setBrush(QColor(255, 255, 255, 70))
        for i, w in enumerate((0.55, 0.8, 0.4)):
            p.drawRoundedRect(QRectF(thumb.left() + 12, thumb.top() + 14 + i * 16, (thumb.width() - 24) * w, 7), 3, 3)
        p.setBrush(QColor(255, 255, 255, 200))
        p.drawRoundedRect(QRectF(thumb.right() - 34, thumb.bottom() - 34, 24, 24), 4, 4)
        f = self.font()
        f.setPixelSize(14)
        f.setBold(True)
        p.setFont(f)
        p.setPen(QColor(theme.TEXT))
        fm = p.fontMetrics()
        p.drawText(QRectF(r.left() + 14, thumb.bottom() + 10, r.width() - 28, 20), Qt.AlignmentFlag.AlignLeft,
                   fm.elidedText(self.title, Qt.TextElideMode.ElideRight, int(r.width() - 28)))
        f.setPixelSize(11)
        f.setBold(False)
        p.setFont(f)
        p.setPen(QColor(theme.TEXT_MUTED))
        p.drawText(QRectF(r.left() + 14, thumb.bottom() + 32, r.width() - 28, 18), Qt.AlignmentFlag.AlignLeft, self.subtitle)
        if self.pid >= 0:
            p.setPen(QColor(theme.TEXT_DIM))
            f.setPixelSize(18)
            p.setFont(f)
            p.drawText(QRectF(r.right() - 34, r.top() + 1, 30, 26), Qt.AlignmentFlag.AlignCenter, "⋯")


class FlowGrid(QWidget):
    """Grade responsiva de cartões."""

    def __init__(self, card_w: int = 228):
        super().__init__()
        self.card_w = card_w
        self.grid = QGridLayout(self)
        self.grid.setContentsMargins(0, 0, 0, 0)
        self.grid.setSpacing(14)
        self.cards: list[QWidget] = []

    def set_cards(self, cards: list[QWidget]):
        for c in self.cards:
            c.setParent(None)
            c.deleteLater()
        self.cards = cards
        self._relayout()
        for i, c in enumerate(cards[:16]):
            fade_in(c, 320, i * 45, rise=0)

    def _relayout(self):
        cols = max(1, (self.width() or 900) // self.card_w)
        for i, c in enumerate(self.cards):
            self.grid.addWidget(c, i // cols, i % cols, Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignTop)
        self.grid.setColumnStretch(cols, 1)

    def resizeEvent(self, e):
        super().resizeEvent(e)
        if e.oldSize().width() // self.card_w != e.size().width() // self.card_w:
            self._relayout()


class QuickAction(GlassCard):
    """Cartão de ação com capa ilustrada e animação ao passar o mouse."""

    clicked = Signal()

    def __init__(self, icon: str, title: str, text: str):
        super().__init__(radius=18, padding=18, opacity=0.07, interactive=True)
        from aulaviva.ui.art import ART_FOR_SYMBOL, ArtIcon

        self.setMinimumHeight(150)
        self.lay.addWidget(ArtIcon(ART_FOR_SYMBOL.get(icon, icon), 50))
        self.lay.addWidget(label(title, "h3"))
        self.lay.addWidget(label(text, "dim", wrap=True))

    def mouseReleaseEvent(self, e):
        if self.rect().contains(e.position().toPoint()):
            self.clicked.emit()


class HomePage(SmoothScrollArea):
    def __init__(self, shell: "Shell"):
        super().__init__()
        self.shell = shell
        inner = QWidget()
        lay = QVBoxLayout(inner)
        lay.setContentsMargins(6, 6, 16, 16)
        lay.setSpacing(16)
        self.hello = label("", "h1")
        lay.addWidget(self.hello)
        lay.addWidget(label("O que vamos preparar para a turma hoje?", "dim"))
        qa = QGridLayout()
        qa.setSpacing(14)
        actions = [("✦", "Criar com IA", "Escolha o tipo e o tema: a IA escreve tudo e você ajusta depois.", lambda: shell.new_material("apostila", ai_mode=True)),
                   ("📘", "Nova apostila", "Conteúdo em seções com capa, sumário, destaques e atividades.", lambda: shell.new_material("apostila")),
                   ("📝", "Lista de exercícios", "Cole suas questões em texto e elas viram questões interativas.", lambda: shell.new_material("lista")),
                   ("🧾", "Avaliação / Prova", "Cabeçalho do aluno, instruções e versão com gabarito.", lambda: shell.new_material("prova"))]
        self.qa_cards = []
        for i, (ic, t, d, fn) in enumerate(actions):
            c = QuickAction(ic, t, d)
            c.clicked.connect(fn)
            qa.addWidget(c, 0, i)
            self.qa_cards.append(c)
        lay.addLayout(qa)
        tools = QHBoxLayout()
        tools.setSpacing(10)
        for txt, icon, fn in (("Gerar QR code", "▦", lambda: shell.navigate("tools", tab=0)),
                              ("Gerar link (WhatsApp, Drive, YouTube...)", "🔗", lambda: shell.navigate("tools", tab=1)),
                              ("Importar Word, PowerPoint ou PDF", "📄", shell.import_material),
                              ("Ver modelos prontos", "❏", lambda: shell.navigate("templates"))):
            b = Button(txt, "secondary", icon_text=icon, height=40)
            b.clicked.connect(fn)
            tools.addWidget(b)
        tools.addStretch()
        lay.addLayout(tools)
        row = QHBoxLayout()
        row.addWidget(label("Continuar de onde parou", "h2"))
        row.addStretch()
        see = Button("Ver todos", "ghost", height=34)
        see.clicked.connect(lambda: shell.navigate("projects"))
        row.addWidget(see)
        lay.addLayout(row)
        self.recent = FlowGrid()
        lay.addWidget(self.recent)
        self.empty = label("Você ainda não tem projetos. Que tal começar pela IA ou por um modelo?", "dim")
        lay.addWidget(self.empty)
        tips = GlassCard(radius=18, padding=18, opacity=0.06)
        tips.lay.addWidget(label("Dicas rápidas", "h3"))
        for t in ("Use QR codes para levar os alunos do papel a vídeos e simuladores.",
                  "Ative 'Gabarito ao final' e remova a página antes de distribuir a versão do aluno.",
                  "Proteja o PDF com senha para que ninguém altere seu material, sem impedir que os alunos respondam."):
            tips.lay.addWidget(label("• " + t, "dim", wrap=True))
        lay.addWidget(tips)
        lay.addStretch()
        self.setWidget(inner)

    def refresh(self):
        self.hello.setText(f"{greeting()}, {self.shell.user.first_name}!")
        projects = self.shell.store.list(self.shell.user.id)[:8]
        self.recent.set_cards([self.shell.make_card(p) for p in projects])
        self.empty.setVisible(not projects)
        for i, c in enumerate(self.qa_cards):
            fade_in(c, 360, 60 * i, rise=0)


class ProjectsPage(QWidget):
    def __init__(self, shell: "Shell"):
        super().__init__()
        self.shell = shell
        lay = QVBoxLayout(self)
        lay.setContentsMargins(6, 6, 16, 0)
        head = QHBoxLayout()
        head.addWidget(label("Meus projetos", "h1"))
        head.addStretch()
        self.search = line_edit("Buscar por título...", 100)
        self.search.setFixedWidth(260)
        self.search.textChanged.connect(self.refresh)
        head.addWidget(self.search)
        imp = Button("Importar", "secondary", icon_text="⤒")

        def import_menu():
            menu = QMenu(self)
            menu.addAction("Arquivo do professor (Word, PowerPoint, PDF, Canva...)", shell.import_material)
            menu.addAction("Projeto do AulaViva (.aulaviva)", shell.import_project)
            menu.exec(imp.mapToGlobal(imp.rect().bottomLeft()))

        imp.clicked.connect(import_menu)
        head.addWidget(imp)
        new = Button("Novo projeto", "primary", icon_text="+")
        new.clicked.connect(lambda: shell.new_material("apostila"))
        head.addWidget(new)
        lay.addLayout(head)
        self.count = label("", "muted")
        lay.addWidget(self.count)
        scroll = SmoothScrollArea()
        box = QWidget()
        bl = QVBoxLayout(box)
        bl.setContentsMargins(0, 8, 0, 16)
        self.grid = FlowGrid()
        bl.addWidget(self.grid)
        bl.addStretch()
        scroll.setWidget(box)
        lay.addWidget(scroll, 1)

    def refresh(self):
        q = self.search.text().strip().lower()
        projects = [p for p in self.shell.store.list(self.shell.user.id) if q in p.title.lower()]
        self.count.setText(f"{len(projects)} projeto(s)")
        self.grid.set_cards([self.shell.make_card(p) for p in projects])


class AIPage(SmoothScrollArea):
    def __init__(self, shell: "Shell"):
        super().__init__()
        inner = QWidget()
        lay = QVBoxLayout(inner)
        lay.setContentsMargins(6, 6, 16, 16)
        lay.setSpacing(14)
        lay.addWidget(label("Assistente IA", "h1"))
        lay.addWidget(label("A IA prepara a base do material e você revisa e personaliza. Economize horas de planejamento.", "dim", wrap=True))
        grid = QGridLayout()
        grid.setSpacing(14)
        items = [("✦", "Apostila completa", "Objetivos, conteúdo em seções, destaques, links e exercícios com gabarito.", shell.new_with_ai),
                 ("✓", "Lista de exercícios", "Crie um projeto e use 'Assistente IA > Gerar exercícios' no editor.",
                  lambda: shell.new_from_template("Lista de exercícios")),
                 ("↺", "Melhorar textos", "No editor, selecione um texto e peça para simplificar, expandir ou adaptar à faixa etária.",
                  lambda: shell.navigate("projects"))]
        for i, (ic, t, d, fn) in enumerate(items):
            c = QuickAction(ic, t, d)
            c.clicked.connect(fn)
            grid.addWidget(c, 0, i)
        lay.addLayout(grid)
        box = GlassCard(radius=18, padding=20, opacity=0.06)
        box.lay.addWidget(label("Privacidade no uso da IA", "h3"))
        for t in ("Somente o tema e os textos do material são enviados ao serviço de IA, nunca seus dados pessoais.",
                  "Não inclua nomes, notas ou informações de alunos nos pedidos.",
                  "Todo conteúdo gerado passa por validação: links inseguros são descartados automaticamente.",
                  "A IA pode errar: revise fatos, datas e fontes antes de distribuir."):
            box.lay.addWidget(label("• " + t, "dim", wrap=True))
        lay.addWidget(box)
        self.status = label("", "muted")
        lay.addWidget(self.status)
        cfg = Button("Escolher / configurar a IA", "secondary", icon_text="⚙")
        cfg.clicked.connect(lambda: shell.navigate("settings", tab=2))
        lay.addWidget(cfg, 0, Qt.AlignmentFlag.AlignLeft)
        lay.addStretch()
        self.setWidget(inner)
        self.shell = shell

    def refresh(self):
        provider = ai_mod.effective_provider(self.shell.prefs, self.shell.auth.c)
        name = ai_mod.PROVIDERS[provider][0]
        ok = provider != "demo"
        self.status.setText(f"✓ Usando: {name}." if ok else
                            "Usando o modo demonstração (conteúdo de exemplo). Para IA real e gratuita, configure o Ollama ou o "
                            "Gemini em Configurações.")


class SettingsPage(QWidget):
    def __init__(self, shell: "Shell"):
        super().__init__()
        self.shell = shell
        lay = QVBoxLayout(self)
        lay.setContentsMargins(6, 6, 16, 0)
        lay.addWidget(label("Configurações", "h1"))
        self.tabs = QTabWidget()
        self.tabs.addTab(self._profile_tab(), "Perfil")
        self.tabs.addTab(self._security_tab(), "Segurança")
        self.tabs.addTab(self._ai_tab(), "Inteligência Artificial")
        self.tabs.addTab(self._prefs_tab(), "Preferências")
        self.tabs.addTab(self._privacy_tab(), "Privacidade (LGPD)")
        lay.addWidget(self.tabs, 1)

    def _scroll(self, w: QWidget) -> SmoothScrollArea:
        w.setMaximumWidth(860)
        s = SmoothScrollArea()
        s.setWidget(w)
        return s

    def _profile_tab(self):
        box = QWidget()
        lay = QVBoxLayout(box)
        lay.setContentsMargins(0, 14, 10, 14)
        self.email_lbl = label("", "dim")
        lay.addWidget(self.email_lbl)
        self.pform = ProfileForm()
        lay.addWidget(self.pform)
        save = Button("Salvar alterações", "primary")
        save.clicked.connect(self._save_profile)
        lay.addWidget(save, 0, Qt.AlignmentFlag.AlignLeft)
        lay.addStretch()
        return self._scroll(box)

    def _save_profile(self):
        if not self.pform.validate():
            Toast.show_message(self, "Verifique os campos destacados.", "warning")
            return
        try:
            self.shell.set_user(self.shell.auth.save_profile(self.shell.user.id, self.pform.profile()))
            Toast.show_message(self, "Perfil atualizado.", "success")
        except AuthError as exc:
            Toast.show_message(self, str(exc), "error")

    def _security_tab(self):
        box = QWidget()
        lay = QVBoxLayout(box)
        lay.setContentsMargins(0, 14, 10, 14)
        lay.setSpacing(14)
        card = GlassCard(radius=16, padding=20, opacity=0.06)
        card.lay.addWidget(label("Alterar senha", "h3"))
        self.cur_pw, self.new_pw, self.new_pw2 = PasswordInput("Senha atual"), PasswordInput("Nova senha"), PasswordInput("Repita a nova senha")
        meter = StrengthMeter()
        self.new_pw.textChanged.connect(meter.set_password)
        self.cur_field = Field("Senha atual", self.cur_pw)
        for w in (self.cur_field, Field("Nova senha", self.new_pw), meter, Field("Confirmar", self.new_pw2)):
            card.lay.addWidget(w)
        b = Button("Alterar senha", "primary")
        b.clicked.connect(self._change_pw)
        card.lay.addWidget(b, 0, Qt.AlignmentFlag.AlignLeft)
        lay.addWidget(card)
        card2 = GlassCard(radius=16, padding=20, opacity=0.06)
        card2.lay.addWidget(label("Códigos de recuperação", "h3"))
        card2.lay.addWidget(label("Gere novos códigos se você perdeu os anteriores. Os antigos deixam de funcionar.", "dim", wrap=True))
        rb = Button("Gerar novos códigos", "secondary")
        rb.clicked.connect(self._regen_codes)
        card2.lay.addWidget(rb, 0, Qt.AlignmentFlag.AlignLeft)
        lay.addWidget(card2)
        card3 = GlassCard(radius=16, padding=20, opacity=0.06)
        card3.lay.addWidget(label("Atividade recente da conta", "h3"))
        self.events = label("", "dim", wrap=True)
        self.events.setTextFormat(Qt.TextFormat.RichText)
        card3.lay.addWidget(self.events)
        lay.addWidget(card3)
        lay.addStretch()
        return self._scroll(box)

    def _ask_password(self, title: str, on_ok):
        """Reautenticação antes de ações sensíveis."""
        u = self.shell.user
        if u.auth_provider != "local" and not self.shell.auth.db.query_one("SELECT password_hash FROM users WHERE id=? AND password_hash IS NOT NULL", (u.id,)):
            confirm(self, title, "Confirme para continuar.", "Confirmar", on_ok, danger=True)
            return
        m = Modal(self, 440)
        m.body.addWidget(label(title, "h2"))
        m.body.addWidget(label("Por segurança, confirme sua senha.", "dim"))
        pw = PasswordInput("Sua senha")
        f = Field("Senha", pw)
        m.body.addWidget(f)
        ok = Button("Confirmar", "danger")
        m.body.addWidget(ok)

        def check():
            if self.shell.auth.verify_current_password(u.id, pw.text()):
                m.close_modal()
                on_ok()
            else:
                pw.clear()
                f.set_error("Senha incorreta.")

        ok.clicked.connect(check)
        pw.returnPressed.connect(check)
        m.open()

    def _change_pw(self):
        if self.new_pw.text() != self.new_pw2.text():
            Toast.show_message(self, "As senhas não coincidem.", "warning")
            return
        try:
            self.shell.auth.change_password(self.shell.user.id, self.cur_pw.text(), self.new_pw.text())
            for w in (self.cur_pw, self.new_pw, self.new_pw2):
                w.clear()
            Toast.show_message(self, "Senha alterada com sucesso.", "success")
            self.refresh()
        except AuthError as exc:
            Toast.show_message(self, str(exc), "error", 5000)

    def _regen_codes(self):
        self._ask_password("Gerar novos códigos", lambda: show_recovery_codes(self, self.shell.auth.regenerate_recovery_codes(self.shell.user.id)))

    def _ai_tab(self):
        """Escolha do provedor de IA (gratuitos e pagos) e das chaves de preferência do professor."""
        box = QWidget()
        lay = QVBoxLayout(box)
        lay.setContentsMargins(0, 14, 10, 14)
        lay.setSpacing(10)
        lay.addWidget(label("Qual inteligência artificial o AulaViva deve usar?", "h3"))
        lay.addWidget(label("Use a sua preferida. As chaves ficam guardadas no cofre seguro do sistema "
                            "(Gerenciador de Credenciais do Windows) e nunca são exibidas depois de salvas.", "dim", wrap=True))
        self.ai_tiles: dict[str, ProviderTile] = {}
        for group, keys in (("GRATUITAS", ["demo", "ollama", "gemini", "groq", "openrouter", "mistral"]),
                            ("PAGAS", ["claude", "openai", "deepseek"]), ("AVANÇADO", ["custom"])):
            g = label(group, "muted")
            g.setStyleSheet(f"letter-spacing: 1px; font-weight: 700; font-size: 12px; color: {theme.TEXT_MUTED}; margin-top: 4px;")
            lay.addWidget(g)
            grid = QGridLayout()
            grid.setSpacing(8)
            for i, k in enumerate(keys):
                t = ProviderTile(k)
                t.clicked.connect(self._select_provider)
                grid.addWidget(t, i // 2, i % 2)
                self.ai_tiles[k] = t
            lay.addLayout(grid)
        self.ai_panel = GlassCard(radius=14, padding=18, opacity=0.06)
        lay.addWidget(self.ai_panel)
        test_row = QHBoxLayout()
        self.test_btn = Button("Testar conexão", "secondary", icon_text="⚡")
        self.test_btn.clicked.connect(self._test_ai)
        self.test_result = label("", "dim", wrap=True)
        test_row.addWidget(self.test_btn)
        test_row.addWidget(self.test_result, 1)
        lay.addLayout(test_row)
        lay.addStretch()
        return self._scroll(box)

    def _select_provider(self, key: str):
        self.shell.prefs.ai_provider = key
        self.shell.prefs.save()
        self.test_result.setText("")
        self._build_ai_panel(key)

    def _build_ai_panel(self, key: str):
        from PySide6.QtCore import QUrl
        from PySide6.QtGui import QDesktopServices

        c, prefs = self.shell.auth.c, self.shell.prefs
        for k, t in self.ai_tiles.items():
            t.set_state(k == key, bool(ai_mod.load_api_key(c, k)) if k in ai_mod._KEYRING_USERS else False)
        lay = self.ai_panel.lay
        while lay.count():
            it = lay.takeAt(0)
            if it.widget():
                it.widget().deleteLater()
            elif it.layout():
                from aulaviva.ui.editor import _delete_layout
                _delete_layout(it.layout())
        name, desc = ai_mod.PROVIDERS[key]
        lay.addWidget(label(name, "h3"))
        if key == "demo":
            lay.addWidget(label("Gera conteúdo de EXEMPLO (fixo) para você conhecer o fluxo sem instalar nada. Não é uma IA real: "
                                "para conteúdo de verdade, escolha uma das outras opções (há várias gratuitas).", "dim", wrap=True))
            return
        if key == "ollama":
            lay.addWidget(label("1. Baixe e instale o Ollama (Windows e Linux).\n"
                                "2. No terminal, baixe um modelo uma única vez:  ollama pull qwen2.5:7b\n"
                                "3. Deixe o Ollama aberto e clique em 'Testar conexão'.\n\n"
                                "Requisitos: 8 GB de RAM para modelos pequenos (llama3.2, gemma3:4b); 16 GB para qwen2.5:7b "
                                "(melhor em português). Nada sai do seu computador.", "dim", wrap=True))
            site = Button("Abrir ollama.com", "soft", icon_text="↗", height=36)
            site.clicked.connect(lambda: QDesktopServices.openUrl(QUrl("https://ollama.com/download")))
            lay.addWidget(site, 0, Qt.AlignmentFlag.AlignLeft)
            self.ollama_model = QComboBox()
            self.ollama_model.setEditable(True)
            self.ollama_model.addItems(ai_mod.OLLAMA_MODELS)
            self.ollama_model.setCurrentText(prefs.ollama_model)
            self.ollama_model.setMinimumHeight(40)
            self.ollama_url = line_edit("http://127.0.0.1:11434", 200)
            self.ollama_url.setText(prefs.ollama_url)
            refresh = Button("Buscar modelos instalados", "secondary", height=36)
            refresh.clicked.connect(self._ollama_list)
            lay.addWidget(Field("Modelo", self.ollama_model))
            lay.addWidget(refresh, 0, Qt.AlignmentFlag.AlignLeft)
            lay.addWidget(Field("Endereço do Ollama (avançado)", self.ollama_url))
            self.ollama_model.currentTextChanged.connect(lambda v: self._save_model("ollama", v))
            self.ollama_url.editingFinished.connect(lambda: self._save_model("ollama_url", self.ollama_url.text()))
            return
        has_key = bool(ai_mod.load_api_key(c, key))
        url = ai_mod.KEY_URLS.get(key, "")
        steps = (f"1. Clique em 'Obter chave' e crie uma conta (se ainda não tiver).\n2. Gere uma chave de API e copie-a.\n"
                 "3. Cole abaixo, clique em 'Salvar chave' e depois em 'Testar conexão'.") if url else \
                "Informe o endereço da API (no padrão OpenAI, terminando em /v1), o modelo e, se o serviço exigir, a chave."
        lay.addWidget(label(desc, "muted", wrap=True))
        lay.addWidget(label(steps, "dim", wrap=True))
        if url:
            get = Button("Obter chave", "soft", icon_text="↗", height=36)
            get.clicked.connect(lambda: QDesktopServices.openUrl(QUrl(url)))
            lay.addWidget(get, 0, Qt.AlignmentFlag.AlignLeft)
        if key in ("gemini", "groq", "openrouter", "mistral"):
            warn = label("⚠ Planos gratuitos costumam ter limite de pedidos e podem usar os textos enviados para melhorar "
                         "os serviços. Nunca inclua dados de alunos.", "muted", wrap=True)
            warn.setStyleSheet(f"color: {theme.WARNING}; font-size: 12px;")
            lay.addWidget(warn)
        if key == "custom":
            self.custom_url = line_edit("https://seu-servidor/v1  ou  http://localhost:1234/v1", 300)
            self.custom_url.setText(str(prefs.extra.get("custom_url", "")))
            self.custom_url.editingFinished.connect(lambda: self._save_model("custom_url", self.custom_url.text()))
            lay.addWidget(Field("Endereço da API", self.custom_url))
        status = label("✓ Chave salva neste computador." if has_key else "Nenhuma chave salva.", "muted")
        if has_key:
            status.setStyleSheet(f"color: {theme.SUCCESS}; font-size: 12px; font-weight: 600;")
        lay.addWidget(status)
        keyf = PasswordInput("Cole aqui a sua chave" + (" (opcional para servidores locais)" if key == "custom" else ""))
        lay.addWidget(Field("Chave de API", keyf))
        row = QHBoxLayout()
        sv, rm = Button("Salvar chave", "primary"), Button("Remover chave", "ghost")
        sv.clicked.connect(lambda: self._save_key(key, keyf))
        rm.clicked.connect(lambda: self._remove_key(key))
        row.addWidget(sv)
        row.addWidget(rm)
        row.addStretch()
        lay.addLayout(row)
        model = QComboBox()
        model.setEditable(key != "claude")
        model.setMinimumHeight(40)
        if key == "claude":
            for k, v in ai_mod.MODELS.items():
                model.addItem(v, k)
            model.setCurrentIndex(max(0, model.findData(prefs.ai_model)))
            model.currentIndexChanged.connect(lambda i: self._save_model("claude", model.itemData(i)))
        else:
            options = ai_mod.GEMINI_MODELS if key == "gemini" else ai_mod.OPENAI_COMPAT.get(key, ("", []))[1]
            model.addItems(options)
            model.setCurrentText(ai_mod.provider_model(prefs, key))
            model.currentTextChanged.connect(lambda v: self._save_model(key, v))
        lay.addWidget(Field("Modelo", model, hint="Você pode digitar outro nome de modelo disponível no serviço."
                            if key != "claude" else ""))
        if key == "claude":
            effort = QComboBox()
            effort.setMinimumHeight(40)
            for k, v in (("low", "Rápido"), ("medium", "Equilibrado (recomendado)"), ("high", "Máxima qualidade (mais lento)")):
                effort.addItem(v, k)
            effort.setCurrentIndex(max(0, effort.findData(prefs.ai_effort)))
            effort.currentIndexChanged.connect(lambda i: self._save_model("effort", effort.itemData(i)))
            lay.addWidget(Field("Nível de esforço", effort))

    def _save_model(self, key: str, value):
        p = self.shell.prefs
        value = (value or "").strip() if isinstance(value, str) else value
        if not value:
            return
        if key == "claude":
            p.ai_model = value
        elif key == "effort":
            p.ai_effort = value
        elif key == "gemini":
            p.gemini_model = value
        elif key == "ollama":
            p.ollama_model = value
        elif key == "ollama_url":
            p.ollama_url = value
        elif key == "custom_url":
            p.extra["custom_url"] = value
        else:
            models = p.extra.get("models") if isinstance(p.extra.get("models"), dict) else {}
            models[key] = value
            p.extra["models"] = models
        p.save()

    def _ollama_list(self):
        url = self.ollama_url.text().strip() or "http://127.0.0.1:11434"

        def ok(models):
            if not models:
                Toast.show_message(self, "Nenhum modelo instalado. Rode no terminal: ollama pull qwen2.5:7b", "warning", 6000)
                return
            cur = self.ollama_model.currentText()
            self.ollama_model.clear()
            self.ollama_model.addItems(models)
            self.ollama_model.setCurrentText(cur if cur in models else models[0])
            Toast.show_message(self, f"{len(models)} modelo(s) encontrado(s).", "success")

        run_async(lambda: ai_mod._OllamaBackend(url, "x").list_models(), ok,
                  lambda e: Toast.show_message(self, str(e), "error", 6000))

    def _test_ai(self):
        self.test_btn.setEnabled(False)
        self.test_result.setText("Testando...")
        self.test_result.setStyleSheet("")

        def done(msg, ok=True):
            self.test_btn.setEnabled(True)
            self.test_result.setText(("✓ " if ok else "✗ ") + msg)
            self.test_result.setStyleSheet(f"color: {theme.SUCCESS if ok else theme.DANGER}; font-weight: 600;")

        try:
            assistant = self.shell.get_assistant()
        except ai_mod.AIError as exc:
            done(str(exc), False)
            return
        run_async(assistant.test_connection, done, lambda e: done(str(e) if isinstance(e, ai_mod.AIError) else "Falha no teste.", False))

    def _save_key(self, provider: str, field):
        try:
            ai_mod.save_api_key(field.text(), self.shell.auth.c, provider)
            field.clear()
            Toast.show_message(self, "Chave salva com segurança no cofre do sistema.", "success")
        except SecurityError as exc:
            Toast.show_message(self, str(exc), "error")
        self._build_ai_panel(provider)

    def _remove_key(self, provider: str):
        ai_mod.delete_api_key(provider)
        Toast.show_message(self, "Chave removida.", "info")
        self._build_ai_panel(provider)

    def _prefs_tab(self):
        box = QWidget()
        lay = QVBoxLayout(box)
        lay.setContentsMargins(0, 14, 10, 14)
        card = GlassCard(radius=16, padding=20, opacity=0.06)
        card.lay.addWidget(label("Aparência", "h3"))
        from PySide6.QtWidgets import QButtonGroup, QRadioButton

        mode_row = QHBoxLayout()
        self.theme_group = QButtonGroup(self)
        for key, text in (("light", "Claro"), ("dark", "Escuro"), ("system", "Automático (igual ao Windows)")):
            rb = QRadioButton(text)
            rb.setChecked(self.shell.prefs.theme_mode == key)
            rb.toggled.connect(lambda on, k=key: on and k != self.shell.prefs.theme_mode and self.shell.theme_requested.emit(k))
            self.theme_group.addButton(rb)
            mode_row.addWidget(rb)
        mode_row.addStretch()
        card.lay.addLayout(mode_row)
        card.lay.addSpacing(8)
        card.lay.addWidget(label("Desempenho", "h3"))
        self.reduce = checkbox("Reduzir animações (recomendado para computadores mais antigos)", self.shell.prefs.reduce_motion)
        self.reduce.toggled.connect(self._toggle_motion)
        card.lay.addWidget(self.reduce)
        card.lay.addSpacing(8)
        card.lay.addWidget(label("Bloqueio automático", "h3"))
        self.idle = QSpinBox()
        self.idle.setRange(1, 240)
        self.idle.setSuffix(" minutos sem uso")
        self.idle.setValue(self.shell.prefs.idle_lock_minutes)
        self.idle.setMinimumHeight(40)
        self.idle.valueChanged.connect(self._save_idle)
        card.lay.addWidget(Field("Bloquear a sessão após", self.idle))
        intro = Button("Rever a apresentação do aplicativo", "secondary")
        intro.clicked.connect(self.shell.show_intro)
        card.lay.addWidget(intro, 0, Qt.AlignmentFlag.AlignLeft)
        lay.addWidget(card)
        lay.addWidget(label(f"{APP_NAME} versão {__version__}", "muted"))
        lay.addStretch()
        return self._scroll(box)

    def _toggle_motion(self, on: bool):
        self.shell.prefs.reduce_motion = on
        self.shell.prefs.save()
        Motion.enabled = not on

    def _save_idle(self, v: int):
        self.shell.prefs.idle_lock_minutes = v
        self.shell.prefs.save()

    def _privacy_tab(self):
        box = QWidget()
        lay = QVBoxLayout(box)
        lay.setContentsMargins(0, 14, 10, 14)
        lay.setSpacing(14)
        c1 = GlassCard(radius=16, padding=20, opacity=0.06)
        c1.lay.addWidget(label("Exportar meus dados", "h3"))
        c1.lay.addWidget(label("Baixe uma cópia dos seus dados pessoais e da lista de projetos (portabilidade, LGPD art. 18).", "dim", wrap=True))
        ex = Button("Exportar dados (JSON)", "secondary")
        ex.clicked.connect(lambda: self._ask_password("Exportar dados", self._export))
        c1.lay.addWidget(ex, 0, Qt.AlignmentFlag.AlignLeft)
        lay.addWidget(c1)
        c2 = GlassCard(radius=16, padding=20, opacity=0.06)
        c2.lay.addWidget(label("Excluir minha conta", "h3"))
        c2.lay.addWidget(label("Remove permanentemente sua conta, seus dados pessoais e todos os projetos deste computador. "
                               "Esta ação não pode ser desfeita.", "dim", wrap=True))
        dl = Button("Excluir conta definitivamente", "danger")
        dl.clicked.connect(lambda: self._ask_password("Excluir conta", lambda: confirm(
            self, "Tem certeza?", "Todos os seus projetos serão apagados para sempre.", "Excluir tudo", self._delete, danger=True)))
        c2.lay.addWidget(dl, 0, Qt.AlignmentFlag.AlignLeft)
        lay.addWidget(c2)
        lay.addStretch()
        return self._scroll(box)

    def _export(self):
        path, _ = QFileDialog.getSaveFileName(self, "Exportar meus dados", "meus-dados-aulaviva.json", "JSON (*.json)")
        if path:
            with open(path, "w", encoding="utf-8") as fh:
                json.dump(self.shell.auth.export_my_data(self.shell.user.id), fh, ensure_ascii=False, indent=2)
            Toast.show_message(self, "Dados exportados.", "success")

    def _delete(self):
        self.shell.auth.delete_account(self.shell.user.id)
        self.shell.logout.emit("Sua conta foi excluída.")

    def refresh(self):
        u = self.shell.user
        self.email_lbl.setText(f"E-mail da conta: {u.email}  ·  Acesso via {'e-mail e senha' if u.auth_provider == 'local' else u.auth_provider}")
        self.pform.set_profile(u.profile)
        has_pw = self.shell.auth.db.query_one("SELECT 1 FROM users WHERE id=? AND password_hash IS NOT NULL", (u.id,))
        self.cur_field.setVisible(bool(has_pw))
        evs = self.shell.auth.recent_security_events(u.id)
        self.events.setText("<br>".join(f"{EVENT_NAMES.get(e, e)} <span style='color:{theme.TEXT_MUTED}'>· {when(ts)}</span>" for e, ts in evs) or "Sem registros.")
        self._build_ai_panel(ai_mod.effective_provider(self.shell.prefs, self.shell.auth.c))


class _LazyPages(dict):
    """Dicionário de páginas que cria cada página sob demanda (abertura do painel muito mais rápida)."""

    def __init__(self, shell, factories: dict):
        super().__init__()
        self.shell, self.factories = shell, factories

    def __missing__(self, key):
        page = self.factories[key](self.shell)
        self[key] = page
        self.shell.stack.addWidget(page)
        return page


class Shell(QWidget):
    """Contêiner principal após o login."""

    logout = Signal(str)
    open_editor = Signal(int)
    intro_requested = Signal()
    theme_requested = Signal(str)

    def __init__(self, auth: AuthService, store: ProjectStore, prefs: Preferences, user: User):
        super().__init__()
        self.auth, self.store, self.prefs, self.user = auth, store, prefs, user
        root = QHBoxLayout(self)
        root.setContentsMargins(16, 16, 16, 16)
        root.setSpacing(16)
        self.sidebar = Sidebar(user)
        self.sidebar.navigate.connect(self.navigate)
        self.sidebar.logout.connect(lambda: self.logout.emit(""))
        root.addWidget(self.sidebar)
        self.stack = AnimatedStack()
        from aulaviva.ui.templates_page import TemplatesPage
        from aulaviva.ui.tools_page import ToolsPage

        factories = {"home": HomePage, "projects": ProjectsPage, "templates": TemplatesPage,
                     "tools": ToolsPage, "ai": AIPage, "settings": SettingsPage}
        self.pages = _LazyPages(self, factories)   # cada página só é montada quando aberta pela 1ª vez
        root.addWidget(self.stack, 1)
        self._order = list(factories)
        self.current = "home"
        self.navigate("home")

    def set_user(self, user: User):
        self.user = user
        self.sidebar.set_user(user)

    def show_intro(self):
        self.intro_requested.emit()

    def navigate(self, key: str, tab: int | None = None):
        direction = 1 if self._order.index(key) >= self._order.index(self.current) else -1
        self.current = key
        self.sidebar.set_active(key)
        page = self.pages[key]
        if hasattr(page, "refresh"):
            page.refresh()
        if tab is not None and hasattr(page, "tabs"):
            page.tabs.setCurrentIndex(tab)
        self.stack.slide_to(page, direction)

    def refresh_current(self):
        page = self.pages[self.current]
        if hasattr(page, "refresh"):
            page.refresh()

    # -- projetos ------------------------------------------------------------
    def _author_defaults(self, doc: dict) -> dict:
        p = self.user.profile
        if p:
            doc["meta"]["author"] = doc["meta"]["author"] or p.display_name
            doc["meta"]["school"] = doc["meta"]["school"] or p.institution
            doc["meta"]["subject"] = doc["meta"]["subject"] or p.subjects.split(",")[0].strip()
        return doc

    def new_blank(self):
        self.new_material("branco")

    def new_material(self, preselect: str = "apostila", ai_mode: bool = False):
        from aulaviva.core.projects import document_for_kind
        from aulaviva.ui.editor import ai_busy_modal
        from aulaviva.ui.quick_create import open_new_material

        p = self.user.profile
        author, school = (p.display_name, p.institution) if p else ("", "")
        defaults = {"subject": p.subjects.split(",")[0].strip() if p else ""}
        provider = ai_mod.effective_provider(self.prefs, self.auth.c)

        def create(kind: str, info: dict, blocks: list, use_ai: bool):
            if not use_ai:
                doc = document_for_kind(kind, info["title"], info["subject"], info["level"], author, school)
                if blocks and blocks[0]["type"] == "callout" and doc["blocks"] and doc["blocks"][0]["type"] == "callout":
                    doc["blocks"].pop(0)  # o professor já colou as próprias instruções
                doc["blocks"].extend(blocks)
                self._open_new(doc)
                return
            try:
                assistant = self.get_assistant()
            except ai_mod.AIError as exc:
                Toast.show_message(self, str(exc), "error", 7000)
                return
            busy = ai_busy_modal(self)

            def work():
                result = assistant.generate_material(kind, info["title"], info["subject"], info["level"],
                                                     info["details"], info["amount"])
                return ai_mod.build_material_doc(kind, result, info["subject"], info["level"], author, school)

            def ok(doc):
                busy.close_modal()
                self._open_new(doc)
                if assistant.is_demo:
                    Toast.show_message(self, "Modo demonstração: conteúdo de EXEMPLO. Configure uma IA gratuita (Ollama, "
                                       "Gemini ou Groq) em Configurações para conteúdo real.", "warning", 7000)
                else:
                    Toast.show_message(self, "Pronto! Revise e modifique o que quiser antes de distribuir.", "success", 5000)

            def fail(exc):
                busy.close_modal()
                Toast.show_message(self, str(exc) if isinstance(exc, ai_mod.AIError) else "Falha na IA. Tente novamente.", "error", 8000)

            run_async(work, ok, fail)

        open_new_material(self, create, defaults, preselect, ai_available=True, ai_mode=ai_mode,
                          provider_name=ai_mod.PROVIDERS[provider][0], on_import=self.import_material)

    def insert_block_into_project(self, block: dict):
        """Escolhe um material e adiciona o bloco (QR code/link) ao final dele."""
        projects = self.store.list(self.user.id)[:12]
        m = Modal(self, 520)
        m.body.addWidget(label("Inserir em qual material?", "h2"))
        m.body.addWidget(label("O bloco será adicionado ao final do material escolhido.", "dim"))

        def pick(pid):
            m.close_modal()
            if pid is None:
                from aulaviva.core.projects import new_document

                doc = self._author_defaults(new_document("Novo material"))
                doc["blocks"] = [block]
                self._open_new(doc)
                return
            doc = self.store.load(self.user.id, pid)
            doc["blocks"].append(block)
            self.store.save(self.user.id, pid, doc)
            Toast.show_message(self, "Adicionado! Abrindo o material...", "success", 2000)
            self.open_editor.emit(pid)

        for info in projects:
            b = Button(f"{info.title or 'Sem título'}   ·   editado {when(info.updated_at)}", "secondary", height=42)
            b.clicked.connect(lambda _=False, pid=info.id: pick(pid))
            m.body.addWidget(b)
        new = Button("Criar um material novo com este bloco", "soft", icon_text="＋", height=42)
        new.clicked.connect(lambda: pick(None))
        m.body.addWidget(new)
        m.open()

    def _open_new(self, doc: dict):
        pid = self.store.create(self.user.id, self._author_defaults(doc))
        self.open_editor.emit(pid)

    def new_from_sample(self, key: str):
        from aulaviva.core.samples import sample_document

        doc = sample_document(key)
        doc["meta"]["author"] = doc["meta"]["school"] = ""
        self._open_new(doc)
        Toast.show_message(self, "Modelo copiado para os seus materiais. Edite à vontade!", "success", 3500)

    def new_from_template(self, name: str):
        doc = template_documents()[name]
        pid = self.store.create(self.user.id, self._author_defaults(doc))
        self.open_editor.emit(pid)

    def import_material(self, preselect: str = "apostila"):
        """Cria um material a partir de um arquivo do professor (Word, PowerPoint, PDF...), com ou sem IA."""
        from aulaviva.core.projects import document_for_kind
        from aulaviva.ui.editor import ai_busy_modal
        from aulaviva.ui.quick_create import open_import_material

        p = self.user.profile
        author, school = (p.display_name, p.institution) if p else ("", "")
        provider = ai_mod.effective_provider(self.prefs, self.auth.c)

        def as_is(kind, res, info):
            doc = document_for_kind(kind, info["title"], info["subject"], info["level"], author, school)
            if kind in ("apostila", "roteiro"):
                doc["blocks"] = []
            doc["blocks"].extend(res.blocks)
            self._open_new(doc)
            Toast.show_message(self, f"Arquivo importado: {res.summary()}. Revise e ajuste no editor.", "success", 6000)

        def create(kind, res, use_ai, info):
            if not use_ai or provider == "demo":
                if use_ai:
                    Toast.show_message(self, "Modo demonstração: o arquivo foi importado como está. Configure uma IA "
                                       "(gratuita: Ollama, Gemini ou Groq) para transformar o conteúdo.", "warning", 7000)
                as_is(kind, res, info)
                return
            try:
                assistant = self.get_assistant()
            except ai_mod.AIError as exc:
                Toast.show_message(self, str(exc), "error", 7000)
                return
            busy = ai_busy_modal(self)
            text = res.as_text(400_000)

            def work():
                result = assistant.generate_from_document(kind, text, info["title"], info["subject"], info["level"],
                                                          info["details"], info["amount"])
                return ai_mod.build_material_doc(kind, result, info["subject"], info["level"], author, school)

            def ok(doc):
                busy.close_modal()
                self._open_new(doc)
                Toast.show_message(self, "Pronto! Material criado a partir do seu arquivo. Revise antes de distribuir.", "success", 5000)

            def fail(exc):
                busy.close_modal()
                Toast.show_message(self, (str(exc) if isinstance(exc, ai_mod.AIError) else "Falha na IA.")
                                   + " Você pode importar o arquivo 'como está'.", "error", 8000)

            run_async(work, ok, fail)

        open_import_material(self, create, {"subject": p.subjects.split(",")[0].strip() if p else ""},
                             ai_mod.PROVIDERS[provider][0], provider != "demo", preselect)

    def new_with_ai(self):
        self.new_material("apostila", ai_mode=True)

    def get_assistant(self):
        return ai_mod.make_assistant(self.prefs, self.auth.c)

    def make_card(self, info) -> ProjectCard:
        doc_theme = theme.PRIMARY
        c = ProjectCard(info.id, info.title or "Sem título", f"Editado {when(info.updated_at)}", doc_theme)
        c.open_requested.connect(self.open_editor)
        c.menu_requested.connect(self._card_menu)
        return c

    def _card_menu(self, pid: int, pos):
        menu = QMenu(self)
        menu.addAction("Abrir", lambda: self.open_editor.emit(pid))
        menu.addAction("Duplicar", lambda: (self.store.duplicate(self.user.id, pid), self.refresh_current()))
        menu.addAction("Exportar projeto (.aulaviva)", lambda: self.export_project(pid))
        menu.addSeparator()
        menu.addAction("Excluir", lambda: confirm(self, "Excluir projeto?", "O projeto será apagado permanentemente.", "Excluir",
                                                   lambda: (self.store.delete(self.user.id, pid), self.refresh_current()), danger=True))
        menu.exec(pos)

    def export_project(self, pid: int):
        doc = self.store.load(self.user.id, pid)
        from aulaviva.core.security import safe_filename

        path, _ = QFileDialog.getSaveFileName(self, "Exportar projeto", safe_filename(doc["meta"]["title"], "projeto") + ".aulaviva",
                                              "Projeto AulaViva (*.aulaviva)")
        if path:
            doc["meta"]["owner_password"] = ""  # nunca exporta a senha de proteção
            with open(path, "w", encoding="utf-8") as fh:
                json.dump({"format": "aulaviva-project", "version": 1, "document": doc}, fh, ensure_ascii=False)
            Toast.show_message(self, "Projeto exportado.", "success")

    def import_project(self):
        path, _ = QFileDialog.getOpenFileName(self, "Importar projeto", "", "Projeto AulaViva (*.aulaviva)")
        if not path:
            return
        try:
            from pathlib import Path

            p = Path(path)
            if p.stat().st_size > 60 * 1024 * 1024:
                raise SecurityError("Arquivo grande demais.")
            data = json.loads(p.read_text(encoding="utf-8"))
            if data.get("format") != "aulaviva-project":
                raise SecurityError("Arquivo não é um projeto AulaViva.")
            self.store.create(self.user.id, data["document"])  # sanitize_document valida tudo
            Toast.show_message(self, "Projeto importado.", "success")
            self.refresh_current()
        except (ValueError, KeyError, OSError, SecurityError) as exc:
            Toast.show_message(self, str(exc) if isinstance(exc, SecurityError) else "Arquivo inválido ou corrompido.", "error")


__all__ = ["Shell", "QLineEdit"]
