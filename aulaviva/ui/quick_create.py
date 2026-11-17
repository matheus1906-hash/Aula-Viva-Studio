"""Fluxos simplificados: assistente de novo material e lista rápida de questões."""

from __future__ import annotations

from typing import Callable

from PySide6.QtCore import QTimer, Qt, Signal
from PySide6.QtGui import QColor, QCursor, QPainter, QPen
from PySide6.QtWidgets import QGridLayout, QHBoxLayout, QLabel, QPlainTextEdit, QSpinBox, QVBoxLayout, QWidget

from aulaviva.core.projects import MATERIAL_KINDS
from aulaviva.core.quicklist import EXAMPLE, parse_questions, summarize
from aulaviva.ui import theme
from aulaviva.ui.widgets import Button, Field, GlassCard, Modal, Toast, checkbox, label, line_edit


class KindCard(QWidget):
    clicked = Signal(str)

    def __init__(self, key: str):
        super().__init__()
        self.key = key
        self.title, self.icon, self.desc = MATERIAL_KINDS[key]
        self.selected = False
        self._hover = False
        self.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        self.setMinimumSize(96, 118)
        from PySide6.QtWidgets import QSizePolicy
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Preferred)
        lay = QVBoxLayout(self)
        lay.setContentsMargins(14, 12, 14, 12)
        lay.setSpacing(4)
        ic = QLabel(self.icon)
        ic.setStyleSheet("font-size: 22px; background: transparent;")
        lay.addWidget(ic)
        lay.addWidget(label(self.title, "h3", wrap=True))
        d = label(self.desc, "muted", wrap=True)
        lay.addWidget(d)
        lay.addStretch()
        self.setToolTip(self.desc)

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
        from PySide6.QtCore import QRectF

        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        r = QRectF(self.rect()).adjusted(1, 1, -1, -1)
        if self.selected:
            p.setBrush(QColor(theme.PRIMARY_SOFT))
            p.setPen(QPen(QColor(theme.PRIMARY), 2))
        else:
            p.setBrush(QColor("#F7F9FD") if self._hover else QColor("white"))
            p.setPen(QPen(QColor(theme.PRIMARY) if self._hover else QColor(theme.BORDER_STRONG), 1))
        p.drawRoundedRect(r, 14, 14)


def open_quicklist(host: QWidget, on_insert: Callable[[list[dict]], None], initial: str = "") -> Modal:
    """Janela 'Lista rápida': cole as questões em texto e insira como blocos."""
    m = Modal(host, 720)
    m.body.addWidget(label("⚡ Lista rápida de questões", "h2"))
    m.body.addWidget(label("Digite ou cole as questões do jeito que você já escreve. O AulaViva reconhece múltipla "
                           "escolha, verdadeiro/falso e perguntas abertas automaticamente.", "dim", wrap=True))
    edit = QPlainTextEdit(initial)
    edit.setPlaceholderText(EXAMPLE)
    edit.setMinimumHeight(300)
    m.body.addWidget(edit)
    tips = label("Dicas: marque a correta com * antes da letra (*b) ou (correta) no final · use (V)/(F) para verdadeiro ou falso · "
                 "'Resposta:' vai para o gabarito · '#' cria um título · '>' cria instruções.", "muted", wrap=True)
    m.body.addWidget(tips)
    status = label("", "dim")
    row = QHBoxLayout()
    row.addWidget(status, 1)
    ex = Button("Ver exemplo", "ghost", height=36)
    ex.clicked.connect(lambda: edit.setPlainText(EXAMPLE))
    row.addWidget(ex)
    ins = Button("Inserir questões", "primary", icon_text="✓")
    row.addWidget(ins)
    m.body.addLayout(row)
    timer = QTimer(m, singleShot=True, interval=250)

    def update():
        blocks = parse_questions(edit.toPlainText())
        status.setText(summarize(blocks))
        ins.setEnabled(bool(blocks))

    timer.timeout.connect(update)
    edit.textChanged.connect(timer.start)
    update()

    def insert():
        blocks = parse_questions(edit.toPlainText())
        if not blocks:
            return
        m.close_modal()
        on_insert(blocks)

    ins.clicked.connect(insert)
    m.open()
    edit.setFocus()
    return m


def open_new_material(host: QWidget, on_create: Callable[[str, dict, list[dict], bool], None],
                      defaults: dict | None = None, preselect: str = "apostila", ai_available: bool = True,
                      ai_mode: bool = False, provider_name: str = "") -> Modal:
    """Assistente 'Criar novo material': com IA (a IA escreve, você ajusta) ou manualmente.

    on_create(kind, info, blocks, use_ai). Em modo IA, info traz também 'details' e 'amount'.
    """
    defaults = defaults or {}
    m = Modal(host, 860)
    m.body.addWidget(label("Criar novo material", "h2"))
    # alternância IA / manual
    seg = QHBoxLayout()
    seg.setSpacing(8)
    b_ai = Button("✦  Criar com IA", "soft", height=46)
    b_man = Button("✍  Criar manualmente", "secondary", height=46)
    seg.addWidget(b_ai, 1)
    seg.addWidget(b_man, 1)
    m.body.addLayout(seg)
    mode_hint = label("", "muted", wrap=True)
    m.body.addWidget(mode_hint)
    m.body.addWidget(label("1. O que você quer criar?", "h3"))
    grid = QGridLayout()
    grid.setSpacing(10)
    cards: dict[str, KindCard] = {}
    for i, key in enumerate(MATERIAL_KINDS):
        c = KindCard(key)
        cards[key] = c
        grid.addWidget(c, 0, i)
    m.body.addLayout(grid)
    step2 = label("2. Informações básicas", "h3")
    m.body.addWidget(step2)
    title = line_edit("", 300)
    subject = line_edit("Ex.: Matemática", 100)
    subject.setText(defaults.get("subject", ""))
    level = line_edit("Ex.: 6º ano B", 100)
    level.setText(defaults.get("level", ""))
    g2 = QGridLayout()
    g2.setHorizontalSpacing(12)
    tf = Field("Título", title, True)
    g2.addWidget(tf, 0, 0, 1, 2)
    g2.addWidget(Field("Componente curricular", subject), 1, 0)
    g2.addWidget(Field("Ano / turma", level), 1, 1)
    m.body.addLayout(g2)
    # extras do modo IA
    ai_box = QWidget()
    al = QGridLayout(ai_box)
    al.setContentsMargins(0, 0, 0, 0)
    al.setHorizontalSpacing(12)
    details = QPlainTextEdit()
    details.setPlaceholderText("Opcional: abordagem, habilidades da BNCC, nível de dificuldade, exemplos do cotidiano, "
                               "projeto interdisciplinar... (não inclua dados de alunos)")
    details.setFixedHeight(76)
    amount = QSpinBox()
    amount.setRange(1, 20)
    amount.setValue(8)
    amount.setMinimumHeight(40)
    amount_field = Field("Quantidade de questões", amount)
    al.addWidget(Field("Detalhes para a IA", details), 0, 0)
    al.addWidget(amount_field, 0, 1)
    al.setColumnStretch(0, 3)
    al.setColumnStretch(1, 1)
    m.body.addWidget(ai_box)
    provider_lbl = label(f"Usando: {provider_name}" if provider_name else "", "muted")
    m.body.addWidget(provider_lbl)
    # extras do modo manual
    extra = QWidget()
    el = QVBoxLayout(extra)
    el.setContentsMargins(0, 0, 0, 0)
    el.addWidget(label("3. Questões (opcional): cole aqui e elas viram questões prontas", "h3"))
    questions = QPlainTextEdit()
    questions.setPlaceholderText(EXAMPLE)
    questions.setFixedHeight(150)
    q_status = label("", "muted")
    questions.textChanged.connect(lambda: q_status.setText(summarize(parse_questions(questions.toPlainText()))
                                                           if questions.toPlainText().strip() else ""))
    el.addWidget(questions)
    el.addWidget(q_status)
    m.body.addWidget(extra)
    row = QHBoxLayout()
    row.addStretch()
    cancel = Button("Cancelar", "ghost")
    create = Button("Criar e abrir", "primary", icon_text="→", height=46)
    create.setMinimumWidth(190)
    cancel.clicked.connect(m.close_modal)
    row.addWidget(cancel)
    row.addWidget(create)
    m.body.addLayout(row)
    state = {"kind": preselect, "ai": ai_mode and ai_available}

    def refresh():
        key, ai = state["kind"], state["ai"]
        for k, c in cards.items():
            c.selected = k == key
            c.update()
            c.setVisible(not (ai and k == "branco"))
        b_ai.kind, b_man.kind = ("primary", "secondary") if ai else ("secondary", "primary")
        b_ai.update()
        b_man.update()
        mode_hint.setText("A IA escreve o material completo sobre o tema; depois você revisa e modifica tudo no editor."
                          if ai else "Você monta o material do seu jeito, bloco a bloco (ou colando questões).")
        tf.findChild(QLabel).setText("Tema" + ' <span style="color:#D9822B">*</span>' if ai else
                                     "Título" + ' <span style="color:#D9822B">*</span>')
        title.setPlaceholderText(f"Ex.: {'Frações equivalentes com exemplos do dia a dia' if ai else MATERIAL_KINDS[key][0] + ' - ' + (subject.text() or 'Ciências')}")
        ai_box.setVisible(ai)
        provider_lbl.setVisible(ai and bool(provider_name))
        amount_field.setVisible(key != "apostila")
        extra.setVisible(not ai and key in ("lista", "prova"))
        create.setText("Gerar com IA" if ai else "Criar e abrir")
        create.icon_text = "✦" if ai else "→"
        create.update()
        QTimer.singleShot(0, lambda: m._place())

    def select(key: str):
        state["kind"] = key
        refresh()

    def set_mode(ai: bool):
        if ai and not ai_available:
            Toast.show_message(host, "Configure uma IA em Configurações > Inteligência Artificial.", "warning")
            return
        state["ai"] = ai
        if ai and state["kind"] == "branco":
            state["kind"] = "apostila"
        refresh()

    for c in cards.values():
        c.clicked.connect(select)
    b_ai.clicked.connect(lambda: set_mode(True))
    b_man.clicked.connect(lambda: set_mode(False))
    refresh()

    def go():
        t = title.text().strip()
        if len(t) < 2:
            tf.set_error("Informe o tema do material." if state["ai"] else "Dê um título ao material.")
            title.setFocus()
            return
        info = {"title": t, "subject": subject.text().strip(), "level": level.text().strip(),
                "details": details.toPlainText().strip(), "amount": amount.value()}
        blocks = parse_questions(questions.toPlainText()) if extra.isVisible() else []
        m.close_modal()
        on_create(state["kind"], info, blocks, state["ai"])

    create.clicked.connect(go)
    title.returnPressed.connect(go)
    m.open()
    title.setFocus()
    return m
