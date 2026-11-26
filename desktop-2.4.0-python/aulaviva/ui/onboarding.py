"""Tela de boas-vindas e explicação da plataforma (primeira abertura)."""

from __future__ import annotations

from PySide6.QtCore import QEasingCurve, QRectF, Qt, QVariantAnimation, Signal
from PySide6.QtGui import QColor, QPainter
from PySide6.QtWidgets import QHBoxLayout, QLabel, QVBoxLayout, QWidget

from aulaviva import APP_NAME
from aulaviva.ui import theme
from aulaviva.ui.effects import logo_pixmap
from aulaviva.ui.widgets import AnimatedStack, Button, GlassCard, Motion, fade_in, label

SLIDES = [
    {
        "badge": "BEM-VINDO(A)",
        "title": f"Olá, professor(a)! Este é o {APP_NAME}",
        "text": "Um estúdio feito exclusivamente para docentes criarem apostilas, listas de exercícios e "
                "roteiros de aula em PDF interativo: com QR codes, links, vídeos, documentos Word e "
                "campos para o aluno responder no próprio arquivo.",
        "items": [("qrcode", "QR codes e links clicáveis"), ("open_question", "Campos de resposta no PDF"), ("word", "Word, PowerPoint e PDF como base")],
        "scene": "full",
    },
    {
        "badge": "COMO FUNCIONA",
        "title": "Do planejamento ao PDF em 3 passos",
        "text": "Você monta o material encaixando blocos, como peças de um quebra-cabeça, e vê o resultado ao vivo.",
        "items": [("plus", "Comece em branco, de um modelo, de um arquivo seu ou com a IA"),
                  ("bullets", "Adicione blocos: textos, imagens, QR codes, vídeos, exercícios"),
                  ("download", "Exporte o PDF interativo (aluno e professor) e compartilhe")],
        "scene": "editor",
    },
    {
        "badge": "ASSISTENTE DE IA",
        "title": "Uma IA que trabalha para você",
        "text": "Descreva o tema e a turma: a IA monta uma apostila inteira, cria exercícios com gabarito e "
                "melhora seus textos. Você sempre revisa antes de usar, porque a palavra final é sua.",
        "items": [("sparkle", "Apostilas, listas e provas a partir de um tema"), ("check", "Exercícios com gabarito automático"),
                  ("file", "Transforma seus documentos em material novo")],
        "scene": "ia",
    },
    {
        "badge": "SEGURANÇA E PRIVACIDADE",
        "title": "Seus dados protegidos de ponta a ponta",
        "text": "Senhas com Argon2id, dados pessoais criptografados (AES-256) no seu computador, bloqueio "
                "automático por inatividade e conformidade com a LGPD. Nenhum dado pessoal é enviado à IA.",
        "items": [("eye", "Criptografia local dos seus dados"), ("gear", "Bloqueio automático da sessão"),
                  ("check", "Exportação e exclusão de dados (LGPD)")],
        "scene": "seguranca",
    },
]


class Dots(QWidget):
    def __init__(self, count: int):
        super().__init__()
        self.count, self._pos = count, 0.0
        self.setFixedSize(count * 22 + 20, 14)
        self._anim = QVariantAnimation(self, duration=Motion.ms(300), easingCurve=QEasingCurve.Type.OutCubic)
        self._anim.valueChanged.connect(lambda v: (setattr(self, "_pos", float(v)), self.update()))

    def set_index(self, i: int):
        self._anim.stop()
        self._anim.setDuration(Motion.ms(300))
        self._anim.setStartValue(self._pos)
        self._anim.setEndValue(float(i))
        self._anim.start()

    def paintEvent(self, e):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        p.setPen(Qt.PenStyle.NoPen)
        for i in range(self.count):
            p.setBrush(QColor(theme.BORDER_STRONG))
            p.drawEllipse(QRectF(i * 22 + 3, 3, 8, 8))
        p.setBrush(QColor(theme.PRIMARY))
        p.drawRoundedRect(QRectF(self._pos * 22, 2, 30, 10), 5, 5)


class SlidePage(QWidget):
    def __init__(self, data: dict):
        super().__init__()
        from aulaviva.ui.art import ArtIcon
        from aulaviva.ui.promo import PromoScene

        outer = QHBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.setSpacing(24)
        left = QWidget()
        lay = QVBoxLayout(left)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(14)
        outer.addWidget(left, 5)
        self.scene = PromoScene(data.get("scene", "full"))
        outer.addWidget(self.scene, 6)
        badge = label(data["badge"], "badge")
        badge.setSizePolicy(badge.sizePolicy().horizontalPolicy(), badge.sizePolicy().verticalPolicy())
        lay.addWidget(badge, 0, Qt.AlignmentFlag.AlignLeft)
        lay.addWidget(label(data["title"], "h1", wrap=True))
        txt = label(data["text"], "dim", wrap=True)
        txt.setStyleSheet("font-size: 16px;")
        lay.addWidget(txt)
        lay.addSpacing(8)
        self.items = []
        for icon, text in data["items"]:
            row = GlassCard(radius=14, padding=14, opacity=0.06)
            h = QHBoxLayout()
            h.addWidget(ArtIcon(icon, 34, "line"))
            h.addSpacing(6)
            t = label(text, "h3", wrap=True)
            h.addWidget(t, 1)
            row.lay.addLayout(h)
            lay.addWidget(row)
            self.items.append(row)
        lay.addStretch()

    def animate_in(self):
        for i, it in enumerate(self.items):
            fade_in(it, 380, 120 + i * 90, rise=0)


class OnboardingView(QWidget):
    finished = Signal()

    def __init__(self):
        super().__init__()
        outer = QVBoxLayout(self)
        outer.setContentsMargins(40, 30, 40, 30)
        outer.addStretch()
        card = GlassCard(radius=26, padding=36, opacity=0.08)
        card.setMaximumWidth(1180)
        card.setMinimumWidth(820)
        top = QHBoxLayout()
        logo = QLabel()
        logo.setPixmap(logo_pixmap(44))
        top.addWidget(logo)
        name = label(APP_NAME, "h3")
        top.addWidget(name)
        top.addStretch()
        self.skip = Button("Pular introdução", "ghost", height=36)
        self.skip.clicked.connect(self.finished)
        top.addWidget(self.skip)
        card.lay.addLayout(top)
        card.lay.addSpacing(10)
        self.stack = AnimatedStack()
        self.pages = [SlidePage(d) for d in SLIDES]
        for pg in self.pages:
            self.stack.addWidget(pg)
        self.stack.setMinimumHeight(460)
        card.lay.addWidget(self.stack, 1)
        bottom = QHBoxLayout()
        self.dots = Dots(len(SLIDES))
        bottom.addWidget(self.dots)
        bottom.addStretch()
        self.back = Button("Voltar", "secondary")
        self.next = Button("Próximo  →", "primary")
        self.next.setMinimumWidth(150)
        self.back.clicked.connect(lambda: self.go(self.index - 1))
        self.next.clicked.connect(self._next)
        bottom.addWidget(self.back)
        bottom.addWidget(self.next)
        card.lay.addLayout(bottom)
        row = QHBoxLayout()
        row.addStretch()
        row.addWidget(card, 10)
        row.addStretch()
        outer.addLayout(row)
        outer.addStretch()
        self.index = 0
        self.go(0, animate=False)

    def _next(self):
        if self.index == len(SLIDES) - 1:
            self.finished.emit()
        else:
            self.go(self.index + 1)

    def go(self, i: int, animate: bool = True):
        i = max(0, min(i, len(SLIDES) - 1))
        direction = 1 if i >= self.index else -1
        self.index = i
        if animate:
            self.stack.slide_to(self.pages[i], direction)
        else:
            self.stack.setCurrentIndex(i)
        self.pages[i].animate_in()
        self.dots.set_index(i)
        self.back.setVisible(i > 0)
        self.next.setText("Começar agora  ✓" if i == len(SLIDES) - 1 else "Próximo  →")

    def keyPressEvent(self, e):
        if e.key() in (Qt.Key.Key_Right, Qt.Key.Key_Return, Qt.Key.Key_Enter):
            self._next()
        elif e.key() == Qt.Key.Key_Left:
            self.go(self.index - 1)
        else:
            super().keyPressEvent(e)
