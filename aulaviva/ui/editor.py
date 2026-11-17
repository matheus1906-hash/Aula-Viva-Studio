"""Editor de apostilas: paleta de blocos, lista ordenável, propriedades e prévia ao vivo."""

from __future__ import annotations

import base64
import copy
import hashlib
import json
from pathlib import Path
from typing import Callable

from PySide6.QtCore import QBuffer, QByteArray, QIODevice, QSize, Qt, QTimer, Signal
from PySide6.QtGui import QImage, QKeySequence, QPixmap, QShortcut
from PySide6.QtPdf import QPdfDocument
from PySide6.QtPdfWidgets import QPdfView
from PySide6.QtWidgets import (
    QAbstractItemView, QButtonGroup, QComboBox, QFileDialog, QFormLayout, QFrame, QGridLayout, QHBoxLayout, QLabel,
    QLineEdit, QListWidget, QListWidgetItem, QMenu, QPlainTextEdit, QPushButton, QRadioButton, QSpinBox, QSplitter,
    QVBoxLayout, QWidget,
)

from aulaviva.core.ai import AIError, Assistant
from aulaviva.core.pdf_builder import ExportError, build_pdf, export_to_file, incomplete_blocks, preview_pdf
from aulaviva.core.projects import (
    BLOCK_TYPES, CALLOUT_STYLES, THEMES, ProjectStore, block_url_problem, load_attachment_safely, load_image_safely,
    new_block, sanitize_document,
)
from aulaviva.core.security import SecurityError, safe_filename, validate_url
from aulaviva.ui import theme
from aulaviva.ui.widgets import (
    Button, Field, GlassCard, Modal, PasswordInput, SmoothScrollArea, Spinner, Toast, checkbox, hline, label, line_edit,
)
from aulaviva.ui.workers import run_async, run_in_process, warm_up_process

PALETTE_GROUPS = [
    ("Conteúdo", ["heading", "paragraph", "bullets", "callout", "image", "table"]),
    ("Interativo", ["qrcode", "link", "video", "word"]),
    ("Atividades", ["choice_question", "true_false", "open_question"]),
    ("Layout", ["divider", "page_break"]),
]


def block_summary(b: dict) -> str:
    t = b["type"]
    text = {
        "heading": b.get("text"), "paragraph": b.get("text"), "callout": b.get("title") or b.get("text"),
        "bullets": ", ".join(b.get("items", [])[:3]), "image": b.get("caption") or ("imagem carregada" if b.get("data") else "nenhuma imagem"),
        "qrcode": b.get("url"), "link": b.get("label"), "video": b.get("title"), "word": b.get("label"),
        "open_question": b.get("prompt"), "choice_question": b.get("prompt"),
        "true_false": f"{len(b.get('statements', []))} afirmações", "table": f"{len(b.get('rows', []))} linhas",
    }.get(t, "")
    text = " ".join(str(text or "").replace("**", "").replace("*", "").split())
    return text[:70] + ("…" if len(text) > 70 else "")


class ColorSwatch(QPushButton):
    def __init__(self, color: str, name: str):
        super().__init__()
        self.color = color
        self.setCheckable(True)
        self.setFixedSize(46, 34)
        self.setToolTip(name)
        self.setCursor(Qt.CursorShape.PointingHandCursor)

    def paintEvent(self, e):
        from PySide6.QtCore import QRectF
        from PySide6.QtGui import QColor, QPainter, QPen

        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        p.setBrush(QColor(self.color))
        p.setPen(QPen(QColor("white"), 2.5) if self.isChecked() else Qt.PenStyle.NoPen)
        p.drawRoundedRect(QRectF(self.rect()).adjusted(2, 2, -2, -2), 9, 9)


class BlockForm(QWidget):
    """Campos de edição de um bloco (exibidos dentro do cartão aberto)."""

    changed = Signal()
    improve_requested = Signal()

    def __init__(self, block: dict):
        super().__init__()
        self.block: dict | None = None
        self.inner = self
        self.lay = QVBoxLayout(self)
        self.lay.setContentsMargins(0, 4, 0, 0)
        self.lay.setSpacing(10)
        self.show_block(block)

    def _clear(self):
        while self.lay.count():
            item = self.lay.takeAt(0)
            if item.widget():
                item.widget().deleteLater()
            elif item.layout():
                _delete_layout(item.layout())

    def _emit(self):
        self.changed.emit()

    def focus_first(self, select_all: bool = False):
        """Coloca o cursor no primeiro campo editável (digitar logo após adicionar)."""
        from PySide6.QtWidgets import QLineEdit, QPlainTextEdit

        for w in self.inner.findChildren(QWidget):
            if isinstance(w, (QLineEdit, QPlainTextEdit)) and w.isVisible() and w.isEnabled():
                w.setFocus()
                if select_all:
                    w.selectAll()  # bloco novo: digitar substitui o texto de exemplo
                return

    # -- helpers de campo ----------------------------------------------------
    def _line(self, key: str, title: str, placeholder: str = "", max_len: int = 500) -> QLineEdit:
        le = line_edit(placeholder, max_len)
        le.setText(str(self.block.get(key, "")))
        le.textChanged.connect(lambda v: (self.block.__setitem__(key, v), self._emit()))
        self.lay.addWidget(Field(title, le))
        return le

    def _url(self, key: str = "url", title: str = "Endereço (URL)"):
        le = line_edit("https://...", 2048)
        le.setText(self.block.get(key, ""))
        f = Field(title, le, True, hint="Somente links https://, http:// ou mailto:. Links suspeitos são bloqueados.")

        def upd(v):
            self.block[key] = v.strip()
            try:
                validate_url(v)
                f.set_error(None)
            except SecurityError as exc:
                f.set_error(str(exc))
            self._emit()

        le.textChanged.connect(upd)
        upd(le.text())
        self.lay.addWidget(f)

    def _text(self, key: str, title: str, height: int = 140, max_len: int = 20000) -> QPlainTextEdit:
        te = QPlainTextEdit(self.block.get(key, ""))
        te.setMinimumHeight(height)

        def upd():
            txt = te.toPlainText()
            if len(txt) > max_len:
                te.setPlainText(txt[:max_len])
                return
            self.block[key] = txt
            self._emit()

        te.textChanged.connect(upd)
        self.lay.addWidget(Field(title, te))
        return te

    def _lines(self, key: str, title: str, hint: str) -> QPlainTextEdit:
        te = QPlainTextEdit("\n".join(self.block.get(key, [])))
        te.setMinimumHeight(120)
        te.textChanged.connect(lambda: (self.block.__setitem__(key, [x for x in te.toPlainText().split("\n") if x.strip()][:30]), self._emit()))
        self.lay.addWidget(Field(title, te, hint=hint))
        return te

    def _spin(self, key: str, title: str, lo: int, hi: int, suffix: str = ""):
        sp = QSpinBox()
        sp.setRange(lo, hi)
        sp.setValue(int(self.block.get(key, lo)))
        sp.setSuffix(suffix)
        sp.setMinimumHeight(38)
        sp.valueChanged.connect(lambda v: (self.block.__setitem__(key, v), self._emit()))
        self.lay.addWidget(Field(title, sp))

    def _combo(self, key: str, title: str, options: list[tuple[str, object]]):
        cb = QComboBox()
        cb.setMinimumHeight(38)
        for text, val in options:
            cb.addItem(text, val)
        idx = next((i for i, (_, v) in enumerate(options) if v == self.block.get(key)), 0)
        cb.setCurrentIndex(idx)
        cb.currentIndexChanged.connect(lambda i: (self.block.__setitem__(key, cb.itemData(i)), self._emit()))
        self.lay.addWidget(Field(title, cb))
        return cb

    # -- montagem ------------------------------------------------------------
    def show_block(self, block: dict | None):
        self.block = block
        self._clear()
        if block is None:
            return
        t = block["type"]
        if t == "heading":
            self._line("text", "Título", max_len=200)
            self._combo("level", "Nível", [("Seção (aparece no sumário)", 1), ("Subseção", 2)])
        elif t == "paragraph":
            self._text("text", "Texto", 220)
            self.lay.addWidget(label("Dica: **negrito**, *itálico* e [texto do link](https://site.com).", "muted", wrap=True))
            b = Button("Melhorar com IA", "secondary", icon_text="✦")
            b.clicked.connect(self.improve_requested)
            self.lay.addWidget(b)
        elif t == "bullets":
            self._lines("items", "Itens", "Um item por linha.")
        elif t == "callout":
            self._combo("style", "Estilo", [(lbl, key) for key, (lbl, _) in CALLOUT_STYLES.items()])
            self._line("title", "Título do destaque", max_len=120)
            self._text("text", "Texto", 140)
            b = Button("Melhorar com IA", "secondary", icon_text="✦")
            b.clicked.connect(self.improve_requested)
            self.lay.addWidget(b)
        elif t == "image":
            self._image_controls()
        elif t == "qrcode":
            self._url()
            self._line("caption", "Legenda", max_len=120)
            self._spin("size", "Tamanho do QR", 22, 60, " mm")
        elif t == "link":
            self._line("label", "Texto do botão", max_len=90)
            self._url()
            self._line("description", "Descrição (opcional)", max_len=120)
        elif t == "video":
            self._line("title", "Título do vídeo", max_len=60)
            self._url(title="Link do vídeo (YouTube, Vimeo, Drive...)")
        elif t == "word":
            self._word_controls()
        elif t == "open_question":
            self._text("prompt", "Enunciado", 100, 2000)
            self._spin("lines", "Linhas para resposta", 1, 20)
            self._text("answer", "Resposta esperada (gabarito)", 80, 4000)
        elif t == "choice_question":
            self._choice_controls()
        elif t == "true_false":
            self._tf_controls()
        elif t == "table":
            te = QPlainTextEdit("\n".join(" | ".join(r) for r in block.get("rows", [])))
            te.setMinimumHeight(160)
            te.textChanged.connect(lambda: (block.__setitem__("rows", [[c.strip() for c in ln.split("|")][:8] for ln in te.toPlainText().split("\n") if ln.strip()][:60]), self._emit()))
            self.lay.addWidget(Field("Linhas da tabela", te, hint="Uma linha por linha; separe as colunas com |. A primeira linha é o cabeçalho."))
        else:
            self.lay.addWidget(label("Este bloco não tem opções: ele organiza o layout do PDF.", "dim"))

    def _image_controls(self):
        b = self.block
        preview = QLabel()
        preview.setAlignment(Qt.AlignmentFlag.AlignCenter)
        preview.setMinimumHeight(140)
        preview.setStyleSheet(f"background: {theme.SURFACE_ALT}; border: 1px dashed {theme.BORDER_STRONG}; border-radius: 10px; color: {theme.TEXT_MUTED};")

        def refresh():
            if b.get("data"):
                img = QImage.fromData(base64.b64decode(b["data"]))
                preview.setPixmap(QPixmap.fromImage(img).scaled(QSize(320, 180), Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation))
            else:
                preview.setText("Nenhuma imagem")

        def choose():
            path, _ = QFileDialog.getOpenFileName(self, "Escolher imagem", "", "Imagens (*.png *.jpg *.jpeg *.gif *.bmp *.webp)")
            if not path:
                return

            def ok(data):
                b["data"] = data
                refresh()
                self._emit()

            run_async(lambda: load_image_safely(Path(path)), ok, lambda e: Toast.show_message(self, str(e), "error"))

        btn = Button("Escolher imagem...", "secondary")
        btn.clicked.connect(choose)
        self.lay.addWidget(preview)
        self.lay.addWidget(btn)
        self.lay.addWidget(label("A imagem é reprocessada e os metadados (EXIF/localização) são removidos.", "muted", wrap=True))
        self._line("caption", "Legenda", max_len=200)
        self._spin("width", "Largura na página", 20, 100, " %")
        refresh()

    def _word_controls(self):
        b = self.block
        self._line("label", "Título", max_len=90)
        grp = QButtonGroup(self)
        r1, r2 = QRadioButton("Link para documento online (OneDrive, Google Docs...)"), QRadioButton("Anexar arquivo dentro do PDF")
        grp.addButton(r1)
        grp.addButton(r2)
        (r2 if b.get("mode") == "embed" else r1).setChecked(True)
        self.lay.addWidget(r1)
        self.lay.addWidget(r2)
        holder = QWidget()
        hl = QVBoxLayout(holder)
        hl.setContentsMargins(0, 0, 0, 0)
        self.lay.addWidget(holder)

        def build():
            _delete_layout_children(hl)
            if b.get("mode") == "embed":
                info = label(f"Arquivo: {b['filename']}" if b.get("filename") else "Nenhum arquivo anexado.", "dim", wrap=True)
                hl.addWidget(info)
                btn = Button("Escolher arquivo...", "secondary")

                def choose():
                    path, _ = QFileDialog.getOpenFileName(self, "Escolher documento", "", "Documentos (*.docx *.doc *.odt *.xlsx *.pptx *.pdf *.txt)")
                    if not path:
                        return
                    try:
                        name, data = load_attachment_safely(Path(path))
                    except SecurityError as exc:
                        Toast.show_message(self, str(exc), "error")
                        return
                    b["filename"], b["data"] = name, data
                    info.setText(f"Arquivo: {name}")
                    self._emit()

                btn.clicked.connect(choose)
                hl.addWidget(btn)
                hl.addWidget(label("Arquivos com macros são bloqueados. Máx. 15 MB.", "muted"))
            else:
                le = line_edit("https://...", 2048)
                le.setText(b.get("url", ""))
                f = Field("Link do documento", le, True)

                def upd(v):
                    b["url"] = v.strip()
                    try:
                        validate_url(v)
                        f.set_error(None)
                    except SecurityError as exc:
                        f.set_error(str(exc))
                    self._emit()

                le.textChanged.connect(upd)
                hl.addWidget(f)

        def mode_changed():
            b["mode"] = "embed" if r2.isChecked() else "link"
            build()
            self._emit()

        r1.toggled.connect(lambda _: mode_changed())
        build()

    def _choice_controls(self):
        b = self.block
        self._text("prompt", "Enunciado", 100, 2000)
        te = QPlainTextEdit("\n".join(b.get("options", [])))
        te.setMinimumHeight(120)
        self.lay.addWidget(Field("Alternativas", te, hint="Uma alternativa por linha (até 8)."))
        cb = QComboBox()
        cb.setMinimumHeight(38)
        self.lay.addWidget(Field("Alternativa correta (gabarito)", cb))

        def fill():
            cur = b.get("correct", -1)
            cb.blockSignals(True)
            cb.clear()
            cb.addItem("Sem gabarito", -1)
            for i, o in enumerate(b["options"]):
                cb.addItem(f"{chr(65 + i)}) {o[:40]}", i)
            cb.setCurrentIndex(max(0, cur + 1) if cur < len(b["options"]) else 0)
            cb.blockSignals(False)

        def opts():
            b["options"] = [x for x in te.toPlainText().split("\n") if x.strip()][:8]
            fill()
            self._emit()

        te.textChanged.connect(opts)
        cb.currentIndexChanged.connect(lambda i: (b.__setitem__("correct", cb.itemData(i)), self._emit()))
        fill()

    def _tf_controls(self):
        b = self.block
        lines = [f"{'V' if a else 'F'}: {s}" for s, a in zip(b.get("statements", []), b.get("answers", []) + [False] * 30)]
        te = QPlainTextEdit("\n".join(lines))
        te.setMinimumHeight(160)

        def upd():
            st, ans = [], []
            for ln in te.toPlainText().split("\n"):
                ln = ln.strip()
                if not ln:
                    continue
                if ln[:2].upper() in ("V:", "F:"):
                    ans.append(ln[0].upper() == "V")
                    ln = ln[2:].strip()
                else:
                    ans.append(False)
                st.append(ln)
            b["statements"], b["answers"] = st[:15], ans[:15]
            self._emit()

        te.textChanged.connect(upd)
        self.lay.addWidget(Field("Afirmações", te, hint="Uma por linha. Comece com V: ou F: para definir o gabarito."))


def _delete_layout(lay):
    _delete_layout_children(lay)
    lay.deleteLater()


def _delete_layout_children(lay):
    while lay.count():
        it = lay.takeAt(0)
        if it.widget():
            it.widget().deleteLater()
        elif it.layout():
            _delete_layout(it.layout())


class PreviewPane(QWidget):
    def __init__(self):
        super().__init__()
        lay = QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        head = QHBoxLayout()
        head.addWidget(label("Pré-visualização", "h3"))
        head.addStretch()
        self.status = label("", "muted")
        head.addWidget(self.status)
        self.spinner = Spinner(22)
        self.spinner.hide()
        head.addWidget(self.spinner)
        for txt, delta in (("−", -0.15), ("+", 0.15)):
            b = Button(txt, "secondary", height=30)
            b.setFixedWidth(34)
            b.clicked.connect(lambda _=False, d=delta: self._zoom(d))
            head.addWidget(b)
        lay.addLayout(head)
        self.view = QPdfView(self)        # criada antes do documento: é destruída primeiro
        self.doc = QPdfDocument(self)
        self.view.setDocument(self.doc)
        self.view.setPageMode(QPdfView.PageMode.MultiPage)
        self.view.setZoomMode(QPdfView.ZoomMode.FitToWidth)
        self.view.setPageSpacing(14)
        lay.addWidget(self.view, 1)
        self._buffer: QBuffer | None = None
        self._factor = 1.0

    def _zoom(self, d):
        self.view.setZoomMode(QPdfView.ZoomMode.Custom)
        self._factor = max(0.3, min(3.0, self.view.zoomFactor() + d))
        self.view.setZoomFactor(self._factor)

    def set_busy(self, busy: bool):
        self.spinner.setVisible(busy)
        self.status.setText("Atualizando..." if busy else "")

    def show_pdf(self, data: bytes):
        bar = self.view.verticalScrollBar()
        pos = bar.value()
        old = self._buffer
        self._buffer = QBuffer(self.doc)  # pertence ao documento: destruído depois dele
        self._buffer.setData(QByteArray(data))
        self._buffer.open(QIODevice.OpenModeFlag.ReadOnly)
        self.doc.load(self._buffer)
        if old:
            old.close()
            old.deleteLater()
        QTimer.singleShot(0, lambda: bar.setValue(pos))
        self.status.setText(f"{self.doc.pageCount()} página(s)")


BLOCK_HELP = {
    "heading": "Divide o material em partes. Aparece no sumário.",
    "paragraph": "Explicações e textos. Aceita **negrito**, *itálico* e links.",
    "bullets": "Tópicos curtos, um por linha.",
    "callout": "Caixa colorida: dica, atenção, definição, curiosidade.",
    "image": "Figura com legenda (PNG, JPG...).",
    "table": "Tabela simples com cabeçalho.",
    "qrcode": "O aluno aponta a câmera e abre um site.",
    "link": "Botão clicável para um site ou atividade online.",
    "video": "QR code + link para um vídeo (YouTube, Drive...).",
    "word": "Link ou anexo de um arquivo Word, Excel ou PowerPoint.",
    "choice_question": "Alternativas A, B, C... marcáveis no PDF.",
    "true_false": "Afirmações para marcar V ou F.",
    "open_question": "Linhas para o aluno escrever a resposta.",
    "divider": "Linha separadora entre partes.",
    "page_break": "Começa uma nova página.",
}
ADD_GROUPS = [
    ("Texto e conteúdo", ["heading", "paragraph", "bullets", "callout", "image", "table"]),
    ("Interatividade", ["qrcode", "link", "video", "word"]),
    ("Atividades", ["choice_question", "true_false", "open_question"]),
    ("Organização", ["divider", "page_break"]),
]


class AddTile(QWidget):
    clicked = Signal(str)

    def __init__(self, kind: str):
        super().__init__()
        self.kind = kind
        name, icon, _ = BLOCK_TYPES[kind]
        self._hover = False
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self.setMinimumHeight(64)
        lay = QHBoxLayout(self)
        lay.setContentsMargins(10, 8, 10, 8)
        from aulaviva.ui.art import ArtIcon

        self.art = ArtIcon(kind, 36, "line")
        lay.addWidget(self.art)
        col = QVBoxLayout()
        col.setSpacing(1)
        col.addWidget(label(name, "h3"))
        col.addWidget(label(BLOCK_HELP.get(kind, ""), "muted", wrap=True))
        lay.addLayout(col, 1)

    def enterEvent(self, e):
        self._hover = True
        self.art.set_hover(True)
        self.update()

    def leaveEvent(self, e):
        self._hover = False
        self.art.set_hover(False)
        self.update()

    def mouseReleaseEvent(self, e):
        if self.rect().contains(e.position().toPoint()):
            self.clicked.emit(self.kind)

    def paintEvent(self, e):
        from PySide6.QtCore import QRectF
        from PySide6.QtGui import QColor, QPainter, QPen

        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        p.setBrush(QColor(theme.HOVER) if self._hover else QColor(theme.SURFACE))
        p.setPen(QPen(QColor(theme.PRIMARY) if self._hover else QColor(theme.BORDER), 1))
        p.drawRoundedRect(QRectF(self.rect()).adjusted(1, 1, -1, -1), 12, 12)


def open_add_menu(host: QWidget, on_pick: Callable[[str], None], on_quick: Callable[[], None],
                  on_file: Callable[[], None] | None = None) -> Modal:
    m = Modal(host, 760)
    m.body.addWidget(label("Adicionar ao material", "h2"))
    m.body.addWidget(label("Escolha o que quer inserir. O bloco entra logo abaixo do bloco selecionado.", "dim"))
    top = QHBoxLayout()
    ql = Button("Lista rápida de questões", "soft", icon_text="⚡", height=44)
    ql.clicked.connect(lambda: (m.close_modal(), on_quick()))
    top.addWidget(ql, 1)
    if on_file is not None:
        fb = Button("Trazer conteúdo de um arquivo", "soft", icon_text="📄", height=44)
        fb.setToolTip("Word, PowerPoint, PDF (Canva), LibreOffice, texto...")
        fb.clicked.connect(lambda: (m.close_modal(), on_file()))
        top.addWidget(fb, 1)
    m.body.addLayout(top)
    for group, kinds in ADD_GROUPS:
        g = label(group.upper(), "muted")
        g.setStyleSheet(f"letter-spacing: 1px; font-weight: 700; font-size: 12px; color: {theme.TEXT_MUTED}; margin-top: 6px;")
        m.body.addWidget(g)
        grid = QGridLayout()
        grid.setSpacing(8)
        for i, k in enumerate(kinds):
            t = AddTile(k)
            t.clicked.connect(lambda kk, mm=m: (mm.close_modal(), on_pick(kk)))
            grid.addWidget(t, i // 2, i % 2)
        m.body.addLayout(grid)
    m.open()
    return m


class BlockCard(QFrame):
    """Um bloco do documento: cabeçalho com resumo e, quando aberto, os campos de edição."""

    selected = Signal(int)
    action = Signal(int, str)
    changed = Signal(int)
    improve = Signal(int)

    def __init__(self, index: int, block: dict, expanded: bool, number: int | None = None):
        super().__init__()
        self.index, self.block, self.expanded = index, block, expanded
        self.form: BlockForm | None = None
        self.setObjectName("blockcard")
        self._style()
        lay = QVBoxLayout(self)
        lay.setContentsMargins(14, 10, 10, 12 if expanded else 10)
        lay.setSpacing(6)
        head = QHBoxLayout()
        name, icon, _ = BLOCK_TYPES[block["type"]]
        from aulaviva.ui.art import ArtIcon

        head.addWidget(ArtIcon(block["type"], 28, "line"))
        title = name + (f"  {number}" if number else "")
        tl = QVBoxLayout()
        tl.setSpacing(0)
        nm = label(title, "h3")
        tl.addWidget(nm)
        self.summary = label("", "muted")
        tl.addWidget(self.summary)
        head.addLayout(tl, 1)
        self.warn = label("", "error")
        head.addWidget(self.warn)
        for txt, tip, act in (("↑", "Mover para cima (Alt+↑)", "up"), ("↓", "Mover para baixo (Alt+↓)", "down"),
                              ("⧉", "Duplicar (Ctrl+D)", "dup"), ("🗑", "Excluir (Delete)", "del")):
            b = Button(txt, "ghost", height=30)
            b.setFixedWidth(32)
            b.setToolTip(tip)
            b.setFocusPolicy(Qt.FocusPolicy.NoFocus)
            b.clicked.connect(lambda _=False, a=act: self.action.emit(self.index, a))
            head.addWidget(b)
        lay.addLayout(head)
        self.refresh_header()
        if expanded:
            self.form = BlockForm(block)
            self.form.changed.connect(lambda: (self.refresh_header(), self.changed.emit(self.index)))
            self.form.improve_requested.connect(lambda: self.improve.emit(self.index))
            lay.addWidget(self.form)

    def _style(self):
        border = theme.PRIMARY if self.expanded else theme.BORDER
        self.setStyleSheet(f"QFrame#blockcard {{ background: {theme.SURFACE}; border: {'2px' if self.expanded else '1px'} solid {border}; border-radius: 12px; }}"
                           f"QFrame#blockcard:hover {{ border-color: {theme.PRIMARY if self.expanded else theme.BORDER_HOVER}; }}")

    def refresh_header(self):
        s = block_summary(self.block)
        self.summary.setText(s if s else "")
        self.summary.setVisible(bool(s) and not self.expanded)
        problem = block_url_problem(self.block)
        self.warn.setText("⚠ falta o link" if problem and not (self.block.get("url") or "").strip() else ("⚠ link inválido" if problem else ""))

    def mouseReleaseEvent(self, e):
        if e.position().y() < 52:
            self.selected.emit(self.index)
        super().mouseReleaseEvent(e)


class EditorView(QWidget):
    back_requested = Signal()
    saved = Signal()

    def __init__(self, store: ProjectStore, user_id: int, get_assistant: Callable[[], Assistant]):
        super().__init__()
        self.store, self.uid, self.get_assistant = store, user_id, get_assistant
        self.pid: int | None = None
        self.doc: dict = {}
        self.dirty = False
        self.sel = -1
        self._undo: list[str] = []
        self._redo: list[str] = []
        self._assets: dict[str, str] = {}      # imagens/anexos fora dos snapshots (economia de memória)
        self._last_preview_key = ""
        self._preview_gen = 0
        self.cards: list[BlockCard] = []
        root = QVBoxLayout(self)
        root.setContentsMargins(18, 14, 18, 14)
        root.setSpacing(10)

        # Barra superior
        top = GlassCard(radius=14, padding=8, opacity=0.06)
        tl = QHBoxLayout()
        back = Button("Meus materiais", "ghost", icon_text="←", height=38)
        back.clicked.connect(self._back)
        tl.addWidget(back)
        self.title = QLineEdit()
        self.title.setMaxLength(200)
        self.title.setPlaceholderText("Título do material")
        self.title.setStyleSheet("QLineEdit { background: transparent; border: 1px solid transparent; font-size: 17px; font-weight: 700; }"
                                 f"QLineEdit:hover {{ border-color: {theme.BORDER_STRONG}; }} QLineEdit:focus {{ border-color: {theme.PRIMARY}; background: {theme.SURFACE}; }}")
        self.title.textChanged.connect(self._title_changed)
        tl.addWidget(self.title, 1)
        self.save_state = label("", "muted")
        tl.addWidget(self.save_state)
        self.undo_btn = Button("↶", "ghost", height=38)
        self.undo_btn.setToolTip("Desfazer (Ctrl+Z)")
        self.undo_btn.setFixedWidth(40)
        self.redo_btn = Button("↷", "ghost", height=38)
        self.redo_btn.setToolTip("Refazer (Ctrl+Y)")
        self.redo_btn.setFixedWidth(40)
        self.undo_btn.clicked.connect(self.undo)
        self.redo_btn.clicked.connect(self.redo)
        tl.addWidget(self.undo_btn)
        tl.addWidget(self.redo_btn)
        settings = Button("Capa e opções", "secondary", icon_text="⚙", height=38)
        settings.setToolTip("Capa, autor, cores, gabarito, proteção do PDF")
        settings.clicked.connect(self.open_doc_settings)
        tl.addWidget(settings)
        ai = Button("IA", "secondary", icon_text="✦", height=38)
        ai.setToolTip("Gerar ou melhorar conteúdo com IA")
        ai.clicked.connect(lambda: self._ai_menu(ai))
        tl.addWidget(ai)
        self.preview_btn = Button("Prévia", "secondary", icon_text="👁", height=38)
        self.preview_btn.setToolTip("Mostrar/ocultar a prévia do PDF")
        self.preview_btn.clicked.connect(self.toggle_preview)
        tl.addWidget(self.preview_btn)
        export = Button("Exportar PDF", "primary", icon_text="⤓", height=38)
        export.clicked.connect(self.export_pdf)
        tl.addWidget(export)
        top.lay.addLayout(tl)
        root.addWidget(top)

        # Corpo: documento editável + prévia
        self.split = QSplitter(Qt.Orientation.Horizontal)
        self.split.setChildrenCollapsible(False)
        self.canvas = SmoothScrollArea()
        self.canvas_inner = QWidget()
        outer = QHBoxLayout(self.canvas_inner)
        outer.setContentsMargins(8, 4, 8, 24)
        self.column = QWidget()
        self.column.setMaximumWidth(820)
        self.col_lay = QVBoxLayout(self.column)
        self.col_lay.setContentsMargins(0, 0, 0, 0)
        self.col_lay.setSpacing(8)
        outer.addStretch()
        outer.addWidget(self.column, 100)
        outer.addStretch()
        self.canvas.setWidget(self.canvas_inner)
        self.split.addWidget(self.canvas)
        right = GlassCard(radius=14, padding=10, opacity=0.06)
        self.preview = PreviewPane()
        right.lay.addWidget(self.preview)
        self.preview_card = right
        self.split.addWidget(right)
        self.split.setSizes([700, 480])
        self.split.setStretchFactor(0, 3)
        self.split.setStretchFactor(1, 2)
        root.addWidget(self.split, 1)

        self._preview_timer = QTimer(self, singleShot=True, interval=700, timeout=self._refresh_preview)
        self._autosave_timer = QTimer(self, singleShot=True, interval=2500, timeout=self.save_silent)
        self._snapshot_timer = QTimer(self, singleShot=True, interval=900, timeout=self._push_undo)
        QShortcut(QKeySequence.StandardKey.Undo, self, activated=self.undo)
        QShortcut(QKeySequence.StandardKey.Redo, self, activated=self.redo)
        QShortcut(QKeySequence.StandardKey.Save, self, activated=self.save)
        QShortcut(QKeySequence("Ctrl+E"), self, activated=self.export_pdf)
        QShortcut(QKeySequence("Ctrl+D"), self, activated=self.duplicate)
        QShortcut(QKeySequence("Ctrl+L"), self, activated=self.open_quick_list)
        QShortcut(QKeySequence("Ctrl+B"), self, activated=self.open_add)
        QShortcut(QKeySequence("Alt+Up"), self, activated=lambda: self.move(-1))
        QShortcut(QKeySequence("Alt+Down"), self, activated=lambda: self.move(1))

    # -- carregamento ------------------------------------------------------
    def open_project(self, pid: int):
        warm_up_process()
        self.pid = pid
        self.doc = self.store.load(self.uid, pid)
        self._assets.clear()
        self._last_preview_key = ""
        self._undo, self._redo = [self._snap()], []
        self._reload_ui(-1)
        self.dirty = False
        self.save_state.setText("Salvo")

    def showEvent(self, e):
        super().showEvent(e)
        if self.window().width() < 1250 and self.preview_card.isVisible() and not getattr(self, "_auto_preview_done", False):
            self._auto_preview_done = True
            self.preview_card.hide()

    def toggle_preview(self):
        self.preview_card.setVisible(not self.preview_card.isVisible())
        if self.preview_card.isVisible():
            self._last_preview_key = ""
            self._preview_timer.start(10)

    def _reload_ui(self, select: int = -1):
        self.title.blockSignals(True)
        self.title.setText(self.doc["meta"]["title"])
        self.title.blockSignals(False)
        self._rebuild_cards(select)
        self._preview_timer.start(50)
        self._update_undo_buttons()

    def _rebuild_cards(self, select: int | None = None, focus: bool = False, select_all: bool = False):
        if select is not None:
            self.sel = select if 0 <= select < len(self.doc["blocks"]) else -1
        bar = self.canvas.verticalScrollBar()
        pos = bar.value()
        self.canvas_inner.setUpdatesEnabled(False)
        while self.col_lay.count():
            it = self.col_lay.takeAt(0)
            if it.widget():
                it.widget().deleteLater()
            elif it.layout():
                _delete_layout(it.layout())
        self.cards = []
        if not self.doc["blocks"]:
            empty = GlassCard(radius=14, padding=28, opacity=0.06)
            empty.lay.addWidget(label("Seu material está vazio", "h2"))
            empty.lay.addWidget(label("Comece adicionando um título, um texto ou cole uma lista de questões. "
                                      "Ou peça para a IA montar tudo.", "dim", wrap=True))
            self.col_lay.addWidget(empty)
        for i in range(len(self.doc["blocks"])):
            card = self._make_card(i)
            self.col_lay.addWidget(card)
            self.cards.append(card)
        row = QHBoxLayout()
        add = Button("Adicionar", "primary", icon_text="＋", height=44)
        add.setToolTip("Inserir título, texto, imagem, QR code, questão... (Ctrl+B)")
        add.clicked.connect(self.open_add)
        ql = Button("Lista rápida de questões", "soft", icon_text="⚡", height=44)
        ql.setToolTip("Digite ou cole várias questões de uma vez (Ctrl+L)")
        ql.clicked.connect(self.open_quick_list)
        row.addWidget(add, 1)
        row.addWidget(ql, 1)
        self.col_lay.addSpacing(6)
        self.col_lay.addLayout(row)
        self.col_lay.addStretch()
        self.canvas_inner.setUpdatesEnabled(True)
        QTimer.singleShot(0, lambda: bar.setValue(pos))
        if focus and 0 <= self.sel < len(self.cards):
            card = self.cards[self.sel]
            QTimer.singleShot(30, lambda: (self.canvas.ensureWidgetVisible(card, 0, 60), card.form and card.form.focus_first(select_all)))

    # -- edição ------------------------------------------------------------
    def select_block(self, i: int):
        """Abre/fecha um bloco trocando só os cartões afetados (rápido mesmo em materiais longos)."""
        prev = self.sel
        self.sel = -1 if i == self.sel else i
        if len(self.cards) != len(self.doc["blocks"]):
            self._rebuild_cards(None, focus=self.sel >= 0)
            return
        for idx in {prev, self.sel} - {-1}:
            if 0 <= idx < len(self.cards):
                self._replace_card(idx)
        if self.sel >= 0:
            card = self.cards[self.sel]
            QTimer.singleShot(30, lambda: (self.canvas.ensureWidgetVisible(card, 0, 60), card.form and card.form.focus_first(False)))

    def _question_number(self, idx: int) -> int | None:
        kinds = ("open_question", "choice_question", "true_false")
        if self.doc["blocks"][idx]["type"] not in kinds:
            return None
        return sum(1 for b in self.doc["blocks"][: idx + 1] if b["type"] in kinds)

    def _make_card(self, i: int) -> "BlockCard":
        card = BlockCard(i, self.doc["blocks"][i], i == self.sel, self._question_number(i))
        card.selected.connect(self.select_block)
        card.action.connect(self._card_action)
        card.changed.connect(self._block_changed)
        card.improve.connect(lambda idx: (self.select_block(idx), self.improve_selected()))
        return card

    def _replace_card(self, idx: int):
        old = self.cards[idx]
        pos = self.col_lay.indexOf(old)
        new = self._make_card(idx)
        self.col_lay.insertWidget(pos, new)
        old.hide()
        old.setParent(None)
        old.deleteLater()
        self.cards[idx] = new

    def _card_action(self, i: int, act: str):
        self.sel = i
        {"up": lambda: self.move(-1), "down": lambda: self.move(1), "dup": self.duplicate, "del": self.delete_block}[act]()

    def _mark_dirty(self, structural: bool = False):
        self.dirty = True
        self.save_state.setText("Alterações não salvas")
        self._preview_timer.start()
        self._autosave_timer.start()
        if structural:
            self._push_undo()
        else:
            self._snapshot_timer.start()

    def _block_changed(self, *_):
        self._mark_dirty()

    def _title_changed(self, text: str):
        self.doc["meta"]["title"] = text
        self._mark_dirty()

    def open_add(self):
        open_add_menu(self, self.add_block, self.open_quick_list, self.insert_from_file)

    def insert_from_file(self):
        """Traz títulos, textos, listas, tabelas, imagens e questões de um arquivo para dentro do material."""
        from aulaviva.core.importers import FILE_FILTER, ImportError_, import_file

        path, _ = QFileDialog.getOpenFileName(self, "Trazer conteúdo de um arquivo", "", FILE_FILTER)
        if not path:
            return
        busy = Modal(self, 380, dismissable=False)
        busy.body.addWidget(label("Lendo o arquivo...", "h3"))
        busy.body.addWidget(Spinner(), 0, Qt.AlignmentFlag.AlignHCenter)
        busy.open()

        def ok(res):
            busy.close_modal()
            pos = self._insert_pos()
            self.doc["blocks"][pos:pos] = res.blocks
            self._rebuild_cards(-1)
            self._mark_dirty(True)
            Toast.show_message(self, f"Inserido: {res.summary()}. Ctrl+Z desfaz.", "success", 5000)

        def fail(exc):
            busy.close_modal()
            Toast.show_message(self, str(exc) if isinstance(exc, ImportError_) else "Não foi possível ler o arquivo.", "error", 7000)

        run_in_process(import_file, path, on_done=ok, on_error=fail)

    def exercises_from_file(self):
        """IA: gera questões com gabarito a partir de um arquivo do professor."""
        from aulaviva.core.ai import AIApostila, build_material_doc
        from aulaviva.core.importers import FILE_FILTER, ImportError_, import_file

        try:
            assistant = self.get_assistant()
        except AIError as exc:
            Toast.show_message(self, str(exc), "error", 6000)
            return
        path, _ = QFileDialog.getOpenFileName(self, "Gerar questões a partir de um arquivo", "", FILE_FILTER)
        if not path:
            return
        busy = ai_busy_modal(self)
        level = self.doc["meta"]["level"]

        def parsed(res):
            if assistant.is_demo:
                busy.close_modal()
                qs = [b for b in res.blocks if b["type"].endswith("question") or b["type"] == "true_false"]
                Toast.show_message(self, "Modo demonstração: foram trazidas apenas as questões que já estavam no arquivo. "
                                   "Configure uma IA para gerar questões novas.", "warning", 7000)
                if qs:
                    self._ai_replace({"blocks": qs}, "append")
                return

            def work():
                r = assistant.generate_from_document("lista", res.as_text(400_000), "", self.doc["meta"]["subject"], level, "", 8)
                return build_material_doc("lista", r, "", level, "", "")["blocks"]

            run_async(work, busy.guard(lambda blocks: (busy.close_modal(), self._ai_replace({"blocks": blocks}, "append"))),
                      busy.guard(lambda e: (busy.close_modal(), Toast.show_message(self, str(e) if isinstance(e, AIError) else "Falha na IA.", "error", 7000))))

        run_in_process(import_file, path, on_done=busy.guard(parsed),
                       on_error=busy.guard(lambda e: (busy.close_modal(), Toast.show_message(self, str(e) if isinstance(e, ImportError_) else "Não foi possível ler o arquivo.", "error", 7000))))

    def _insert_pos(self) -> int:
        return self.sel + 1 if 0 <= self.sel < len(self.doc["blocks"]) else len(self.doc["blocks"])

    def add_block(self, kind: str):
        if len(self.doc["blocks"]) >= 600:
            Toast.show_message(self, "Limite de blocos atingido.", "warning")
            return
        pos = self._insert_pos()
        self.doc["blocks"].insert(pos, new_block(kind))
        self._rebuild_cards(pos, focus=True, select_all=True)
        self._mark_dirty(True)

    def open_quick_list(self):
        from aulaviva.ui.quick_create import open_quicklist

        def insert(blocks):
            pos = self._insert_pos()
            self.doc["blocks"][pos:pos] = blocks
            self._rebuild_cards(-1)
            self._mark_dirty(True)
            Toast.show_message(self, f"{len(blocks)} bloco(s) inserido(s). Ctrl+Z desfaz.", "success")

        open_quicklist(self, insert)

    def move(self, delta: int):
        row, new = self.sel, self.sel + delta
        if row < 0 or not 0 <= new < len(self.doc["blocks"]):
            return
        bl = self.doc["blocks"]
        bl[row], bl[new] = bl[new], bl[row]
        self._rebuild_cards(new)
        self._mark_dirty(True)

    def duplicate(self):
        row = self.sel
        if row < 0:
            return
        b = copy.deepcopy(self.doc["blocks"][row])
        b["id"] = new_block(b["type"])["id"]
        self.doc["blocks"].insert(row + 1, b)
        self._rebuild_cards(row + 1)
        self._mark_dirty(True)

    def delete_block(self):
        row = self.sel
        if row < 0:
            return
        del self.doc["blocks"][row]
        self._rebuild_cards(-1)
        self._mark_dirty(True)
        Toast.show_message(self, "Bloco excluído. Use Ctrl+Z para desfazer.", "info", 2500)

    # -- desfazer ----------------------------------------------------------
    def _snap(self) -> str:
        """Serializa o documento trocando dados binários grandes por referências."""
        def strip(b):
            data = b.get("data")
            if data and len(data) > 256:
                key = hashlib.sha1(data.encode()).hexdigest()
                self._assets.setdefault(key, data)
                return {**b, "data": "@asset:" + key}
            return b

        return json.dumps({"meta": self.doc["meta"], "blocks": [strip(b) for b in self.doc["blocks"]]}, ensure_ascii=False)

    def _unsnap(self, snap: str) -> dict:
        doc = json.loads(snap)
        for b in doc["blocks"]:
            d = b.get("data")
            if isinstance(d, str) and d.startswith("@asset:"):
                b["data"] = self._assets.get(d[7:], "")
        return doc

    def _push_undo(self):
        snap = self._snap()
        if not self._undo or self._undo[-1] != snap:
            self._undo.append(snap)
            self._undo = self._undo[-60:]
            self._redo.clear()
        self._update_undo_buttons()

    def _update_undo_buttons(self):
        self.undo_btn.setEnabled(len(self._undo) > 1)
        self.redo_btn.setEnabled(bool(self._redo))

    def undo(self):
        self._snapshot_timer.stop()
        self._push_undo()
        if len(self._undo) <= 1:
            return
        self._redo.append(self._undo.pop())
        self.doc = self._unsnap(self._undo[-1])
        self._reload_ui(self.sel)
        self._mark_dirty_no_snapshot()

    def redo(self):
        if not self._redo:
            return
        snap = self._redo.pop()
        self._undo.append(snap)
        self.doc = self._unsnap(snap)
        self._reload_ui(self.sel)
        self._mark_dirty_no_snapshot()

    def _mark_dirty_no_snapshot(self):
        self.dirty = True
        self.save_state.setText("Alterações não salvas")
        self._autosave_timer.start()
        self._update_undo_buttons()

    # -- prévia / salvar / exportar ---------------------------------------
    def _refresh_preview(self):
        key = hashlib.sha1(self._snap().encode()).hexdigest()
        if key == self._last_preview_key:
            return  # nada mudou: não refaz o PDF
        self._last_preview_key = key
        self._preview_gen += 1
        gen = self._preview_gen
        snapshot = copy.deepcopy(self.doc)
        self.preview.set_busy(True)

        def ok(data):
            if gen == self._preview_gen:
                self.preview.set_busy(False)
                self.preview.show_pdf(data)

        def fail(exc):
            if gen == self._preview_gen:
                self._last_preview_key = ""
                self.preview.set_busy(False)
                self.preview.status.setText("Prévia indisponível: " + (str(exc)[:80] if isinstance(exc, (ExportError, SecurityError)) else "erro"))

        run_in_process(preview_pdf, snapshot, on_done=ok, on_error=fail)

    def save_silent(self):
        if self.pid is None or not self.dirty:
            return
        try:
            self.store.save(self.uid, self.pid, self.doc)
            self.dirty = False
            self.save_state.setText("Salvo automaticamente")
            self.saved.emit()
        except Exception:
            self.save_state.setText("Falha ao salvar")

    def save(self):
        self.dirty = True
        self.save_silent()
        if not self.dirty:
            Toast.show_message(self, "Projeto salvo.", "success", 1800)

    def _back(self):
        self.save_silent()
        self.back_requested.emit()

    def export_pdf(self):
        """Janela de exportação: versões aluno/professor, avisos claros e abrir ao final."""
        doc = self.doc
        has_key = any(
            (b["type"] == "choice_question" and b.get("correct", -1) >= 0) or (b["type"] == "open_question" and b.get("answer"))
            or (b["type"] == "true_false" and b.get("statements")) for b in doc["blocks"])
        issues = incomplete_blocks(doc)
        m = Modal(self, 560)
        m.body.addWidget(label("Exportar PDF interativo", "h2"))
        m.body.addWidget(label("Links, QR codes e campos de resposta funcionarão no arquivo gerado.", "dim", wrap=True))
        student = checkbox("Versão do aluno (sem gabarito)", True)
        teacher = checkbox("Versão do professor (com gabarito)", has_key)
        teacher.setEnabled(has_key)
        if not has_key:
            teacher.setText("Versão do professor (adicione respostas às questões para gerar o gabarito)")
        m.body.addWidget(student)
        m.body.addWidget(teacher)
        if doc["meta"]["protect"]:
            m.body.addWidget(label("🔒 O PDF será protegido contra edição com a senha definida em Documento.", "muted", wrap=True))
        if issues:
            box = GlassCard(radius=12, padding=12, opacity=0.05)
            box.setStyleSheet("")
            box.lay.addWidget(label(f"⚠ {len(issues)} bloco(s) incompleto(s) serão ignorados:", "h3"))
            for i, name, why in issues[:5]:
                box.lay.addWidget(label(f"• Bloco {i + 1} - {name}: {why}", "dim", wrap=True))
            if len(issues) > 5:
                box.lay.addWidget(label(f"... e mais {len(issues) - 5}.", "muted"))
            fix = Button("Corrigir agora", "secondary", height=34)

            def go_fix():
                m.close_modal()
                self.sel = issues[0][0]
                self._rebuild_cards(None, focus=True)

            fix.clicked.connect(go_fix)
            box.lay.addWidget(fix, 0, Qt.AlignmentFlag.AlignLeft)
            m.body.addWidget(box)
        row = QHBoxLayout()
        row.addStretch()
        cancel = Button("Cancelar", "ghost")
        go = Button("Escolher local e exportar", "primary", icon_text="⤓")
        cancel.clicked.connect(m.close_modal)
        row.addWidget(cancel)
        row.addWidget(go)
        m.body.addLayout(row)

        def start():
            versions = []
            if student.isChecked():
                versions.append(("aluno", False))
            if teacher.isChecked() and teacher.isEnabled():
                versions.append(("professor", True))
            if not versions:
                Toast.show_message(self, "Escolha ao menos uma versão.", "warning")
                return
            m.close_modal()
            self._run_export(versions)

        go.clicked.connect(start)
        m.open()

    def _run_export(self, versions: list[tuple[str, bool]]):
        from aulaviva.core.config import Preferences

        prefs = Preferences.load()
        base_dir = prefs.extra.get("last_export_dir") or str(Path.home() / "Documents")
        if not Path(base_dir).is_dir():
            base_dir = str(Path.home())
        title = safe_filename(self.doc["meta"]["title"], "apostila")
        suggested = str(Path(base_dir) / (title + (" - aluno" if len(versions) > 1 else "") + ".pdf"))
        path, _ = QFileDialog.getSaveFileName(self, "Salvar PDF", suggested, "PDF (*.pdf)")
        if not path:
            return
        target = Path(path)
        if target.suffix.lower() != ".pdf":
            target = target.with_suffix(".pdf")
        stem = target.stem.removesuffix(" - aluno").removesuffix(" - professor")
        outputs = []
        for tag, with_key in versions:
            name = f"{stem} - {tag}.pdf" if len(versions) > 1 else target.name
            outputs.append((target.with_name(name), with_key))
        prefs.extra["last_export_dir"] = str(target.parent)
        prefs.save()
        snapshot = copy.deepcopy(self.doc)
        busy = Modal(self, 380, dismissable=False)
        busy.body.addWidget(label("Gerando seu PDF...", "h3"))
        busy.body.addWidget(Spinner(), 0, Qt.AlignmentFlag.AlignHCenter)
        busy.open()

        pending = list(outputs)
        done_files: list[Path] = []

        def next_file(_=None):
            if not pending:
                busy.close_modal()
                self.save_silent()
                self._export_done(done_files)
                return
            out, with_key = pending.pop(0)
            done_files.append(out)
            run_in_process(export_to_file, snapshot, str(out), with_key, on_done=next_file, on_error=fail)

        def fail(e):
            busy.close_modal()
            msg = str(e) if isinstance(e, (SecurityError, ExportError)) else "Não foi possível exportar o PDF."
            Toast.show_message(self, msg, "error", 7000)

        next_file()

    def _export_done(self, files: list[Path]):
        from PySide6.QtCore import QUrl
        from PySide6.QtGui import QDesktopServices

        m = Modal(self, 520)
        m.body.addWidget(label("✓ PDF pronto!", "h2"))
        for f in files:
            m.body.addWidget(label(f"• {f.name}", "dim", wrap=True))
        m.body.addWidget(label(str(files[0].parent), "muted", wrap=True))
        row = QHBoxLayout()
        folder = Button("Abrir pasta", "secondary", icon_text="📁")
        folder.clicked.connect(lambda: (QDesktopServices.openUrl(QUrl.fromLocalFile(str(files[0].parent))), m.close_modal()))
        row.addWidget(folder)
        for f in files:
            b = Button("Abrir " + ("PDF" if len(files) == 1 else f.stem.rsplit(" - ", 1)[-1]), "primary")
            b.clicked.connect(lambda _=False, ff=f: (QDesktopServices.openUrl(QUrl.fromLocalFile(str(ff))), m.close_modal()))
            row.addWidget(b)
        m.body.addLayout(row)
        m.open()

    # -- configurações do documento ---------------------------------------
    def open_doc_settings(self):
        meta = self.doc["meta"]
        m = Modal(self, 640)
        m.body.addWidget(label("Configurações do documento", "h2"))
        scroll = SmoothScrollArea()
        inner = QWidget()
        g = QGridLayout(inner)
        g.setContentsMargins(0, 0, 10, 0)
        g.setVerticalSpacing(10)
        g.setHorizontalSpacing(12)
        edits = {}
        for i, (key, title) in enumerate([("title", "Título"), ("subtitle", "Subtítulo"), ("author", "Professor(a)"),
                                          ("school", "Instituição"), ("subject", "Componente curricular"), ("level", "Ano / série"),
                                          ("footer", "Rodapé")]):
            le = line_edit("", 200)
            le.setText(meta[key])
            edits[key] = le
            g.addWidget(Field(title, le), i // 2, i % 2)
        row = 4
        g.addWidget(label("Cor do tema", "h3"), row, 0, 1, 2)
        sw = QHBoxLayout()
        theme_group = QButtonGroup(m)
        for name, hexcol in THEMES.items():
            b = ColorSwatch(hexcol, name)
            b.setChecked(meta["theme"] == name)
            b.toggled.connect(lambda c, n=name: c and meta.__setitem__("theme", n))
            theme_group.addButton(b)
            sw.addWidget(b)
        sw.addStretch()
        g.addLayout(sw, row + 1, 0, 1, 2)
        checks = {}
        opts = [("cover", "Capa ilustrada"), ("toc", "Sumário clicável"), ("page_numbers", "Numeração de páginas"),
                ("student_fields", "Campos Nome/Turma/Data"), ("answer_key", "Gabarito ao final"), ("protect", "Proteger contra edição (senha)")]
        for i, (key, text) in enumerate(opts):
            cb = checkbox(text, meta[key])
            checks[key] = cb
            g.addWidget(cb, row + 2 + i // 2, i % 2)
        pw = PasswordInput("Senha do professor (mín. 6 caracteres)")
        pw.setText(meta["owner_password"])
        pwf = Field("Senha de proteção", pw, hint="Os alunos abrem e preenchem normalmente; a senha impede alterar o material.")
        allow_print, allow_copy = checkbox("Permitir impressão", meta["allow_print"]), checkbox("Permitir copiar texto", meta["allow_copy"])
        base = row + 2 + (len(opts) + 1) // 2
        g.addWidget(pwf, base, 0, 1, 2)
        g.addWidget(allow_print, base + 1, 0)
        g.addWidget(allow_copy, base + 1, 1)

        def toggle_protect(on):
            for w in (pwf, allow_print, allow_copy):
                w.setVisible(on)

        checks["protect"].toggled.connect(toggle_protect)
        toggle_protect(meta["protect"])
        scroll.setWidget(inner)
        scroll.setMinimumHeight(min(520, self.window().height() - 220))
        m.body.addWidget(scroll)
        btns = QHBoxLayout()
        btns.addStretch()
        cancel, ok = Button("Cancelar", "ghost"), Button("Aplicar", "primary")
        btns.addWidget(cancel)
        btns.addWidget(ok)
        m.body.addLayout(btns)
        original_theme = meta["theme"]
        cancel.clicked.connect(lambda: (meta.__setitem__("theme", original_theme), m.close_modal()))

        def apply():
            if checks["protect"].isChecked() and len(pw.text()) < 6:
                pwf.set_error("Use pelo menos 6 caracteres.")
                return
            for k, le in edits.items():
                meta[k] = le.text()
            for k, cb in checks.items():
                meta[k] = cb.isChecked()
            meta["owner_password"] = pw.text() if checks["protect"].isChecked() else ""
            meta["allow_print"], meta["allow_copy"] = allow_print.isChecked(), allow_copy.isChecked()
            self.title.blockSignals(True)
            self.title.setText(meta["title"])
            self.title.blockSignals(False)
            self._mark_dirty(True)
            m.close_modal()

        ok.clicked.connect(apply)
        m.open()

    # -- IA ------------------------------------------------------------------
    def _ai_menu(self, anchor: QWidget):
        menu = QMenu(self)
        menu.addAction("✦  Gerar apostila completa com IA...", lambda: open_ai_generate(self, self.get_assistant, self._ai_replace))
        menu.addAction("✓  Gerar exercícios com gabarito...", self.ai_exercises)
        menu.addAction("📄  Gerar questões a partir de um arquivo (Word, PDF...)", self.exercises_from_file)
        menu.addAction("↺  Melhorar texto do bloco selecionado", self.improve_selected)
        menu.exec(anchor.mapToGlobal(anchor.rect().bottomLeft()))

    def _ai_replace(self, doc: dict, mode: str):
        if mode == "append":
            self.doc["blocks"].extend(doc["blocks"])
        else:
            keep = {k: self.doc["meta"][k] for k in ("author", "school", "theme", "protect", "owner_password")}
            doc["meta"].update(keep)
            self.doc = doc
        self._reload_ui(-1)
        self._mark_dirty(True)
        Toast.show_message(self, "Conteúdo gerado! Revise o material antes de distribuir.", "success", 4000)

    def ai_exercises(self):
        m = Modal(self, 520)
        m.body.addWidget(label("Gerar exercícios com IA", "h2"))
        topic = QPlainTextEdit()
        topic.setPlaceholderText("Ex.: frações equivalentes, com exemplos do cotidiano")
        topic.setFixedHeight(90)
        level = line_edit("Ex.: 6º ano", 100)
        level.setText(self.doc["meta"]["level"])
        count = QSpinBox()
        count.setRange(1, 20)
        count.setValue(5)
        count.setMinimumHeight(38)
        kinds = QComboBox()
        kinds.addItems(["Misturados", "Múltipla escolha", "Verdadeiro ou falso", "Perguntas abertas"])
        kinds.setMinimumHeight(38)
        for t, w in (("Tema", topic), ("Nível", level), ("Quantidade", count), ("Tipo", kinds)):
            m.body.addWidget(Field(t, w))
        go = Button("Gerar", "primary", icon_text="✦")
        m.body.addWidget(go)

        def run():
            if len(topic.toPlainText().strip()) < 3:
                Toast.show_message(self, "Descreva o tema.", "warning")
                return
            try:
                assistant = self.get_assistant()
            except AIError as exc:
                Toast.show_message(self, str(exc), "error", 5000)
                return
            m.close_modal()
            busy = ai_busy_modal(self)
            args = (topic.toPlainText(), level.text(), count.value(), kinds.currentText())
            run_async(lambda: assistant.generate_exercises(*args),
                      busy.guard(lambda blocks: (busy.close_modal(), self._ai_replace({"blocks": blocks}, "append"))),
                      busy.guard(lambda e: (busy.close_modal(), Toast.show_message(self, str(e) if isinstance(e, AIError) else "Falha na IA.", "error", 6000))))

        go.clicked.connect(run)
        m.open()

    def improve_selected(self):
        row = self.sel
        if row < 0 or self.doc["blocks"][row]["type"] not in ("paragraph", "callout"):
            Toast.show_message(self, "Selecione um bloco de Texto ou Destaque.", "info")
            return
        block = self.doc["blocks"][row]
        m = Modal(self, 500)
        m.body.addWidget(label("Melhorar texto com IA", "h2"))
        instr = QComboBox()
        instr.setEditable(True)
        instr.addItems(["Deixar mais claro e didático", "Adaptar para crianças de 8 a 10 anos", "Adaptar para adolescentes",
                        "Resumir em poucas linhas", "Expandir com exemplos do cotidiano", "Corrigir gramática e ortografia"])
        instr.setMinimumHeight(40)
        m.body.addWidget(Field("O que fazer?", instr))
        go = Button("Aplicar", "primary", icon_text="✦")
        m.body.addWidget(go)

        def run():
            try:
                assistant = self.get_assistant()
            except AIError as exc:
                Toast.show_message(self, str(exc), "error", 5000)
                return
            m.close_modal()
            busy = ai_busy_modal(self)
            text, ins = block["text"], instr.currentText()

            def ok(new_text):
                busy.close_modal()
                block["text"] = new_text
                self._rebuild_cards(row)
                self._mark_dirty(True)
                Toast.show_message(self, "Texto atualizado. Use Ctrl+Z para desfazer.", "success")

            run_async(lambda: assistant.improve_text(text, ins), busy.guard(ok),
                      busy.guard(lambda e: (busy.close_modal(), Toast.show_message(self, str(e) if isinstance(e, AIError) else "Falha na IA.", "error", 6000))))

        go.clicked.connect(run)
        m.open()


class AIBusy(Modal):
    """Tela de espera da IA com botão Cancelar: o resultado que chegar depois é descartado."""

    def __init__(self, host: QWidget):
        super().__init__(host, 440, dismissable=False)
        self.cancelled = False
        self._host_widget = host
        self.body.addWidget(label("A IA está trabalhando...", "h3"))
        self.body.addWidget(label("Isso pode levar até um minuto. Você poderá revisar tudo depois.", "dim", wrap=True))
        self.body.addWidget(Spinner(40), 0, Qt.AlignmentFlag.AlignHCenter)
        cancel = Button("Cancelar", "secondary", icon_text="✕")
        cancel.setToolTip("Mudou de ideia? Cancela agora: nada será alterado (tecla Esc)")
        cancel.clicked.connect(self.cancel)
        self.body.addWidget(cancel, 0, Qt.AlignmentFlag.AlignHCenter)
        self.open()

    def cancel(self):
        if self.cancelled:
            return
        self.cancelled = True
        host = self._host_widget
        self.close_modal()
        Toast.show_message(host, "Geração cancelada. Nada foi alterado.", "info", 3000)

    def keyPressEvent(self, e):
        if e.key() == Qt.Key.Key_Escape:
            self.cancel()
        else:
            super().keyPressEvent(e)

    def guard(self, fn):
        """Envolve um callback: se a geração foi cancelada, o resultado é ignorado."""
        def wrapped(*args):
            if self.cancelled:
                return None
            return fn(*args)
        return wrapped


def ai_busy_modal(host: QWidget) -> AIBusy:
    return AIBusy(host)


def open_ai_generate(host: QWidget, get_assistant: Callable[[], Assistant], on_result: Callable[[dict, str], None],
                     allow_append: bool = True, defaults: dict | None = None) -> None:
    defaults = defaults or {}
    m = Modal(host, 600)
    m.body.addWidget(label("Gerar apostila com IA", "h2"))
    m.body.addWidget(label("Descreva o que você precisa. Não inclua dados pessoais de alunos.", "dim", wrap=True))
    topic = line_edit("Ex.: Fotossíntese e cadeia alimentar", 300)
    subject = line_edit("Ex.: Ciências", 100)
    subject.setText(defaults.get("subject", ""))
    level = line_edit("Ex.: 7º ano do Ensino Fundamental", 100)
    level.setText(defaults.get("level", ""))
    sections, exercises = QSpinBox(), QSpinBox()
    sections.setRange(1, 12)
    sections.setValue(4)
    exercises.setRange(0, 20)
    exercises.setValue(6)
    for s in (sections, exercises):
        s.setMinimumHeight(38)
    notes = QPlainTextEdit()
    notes.setPlaceholderText("Observações (opcional): abordagem, BNCC, projeto interdisciplinar...")
    notes.setFixedHeight(80)
    g = QGridLayout()
    g.addWidget(Field("Tema", topic, True), 0, 0, 1, 2)
    g.addWidget(Field("Componente curricular", subject), 1, 0)
    g.addWidget(Field("Ano / nível", level, True), 1, 1)
    g.addWidget(Field("Seções de conteúdo", sections), 2, 0)
    g.addWidget(Field("Exercícios", exercises), 2, 1)
    g.addWidget(Field("Observações", notes), 3, 0, 1, 2)
    m.body.addLayout(g)
    mode = QComboBox()
    mode.addItem("Substituir o conteúdo atual", "replace")
    if allow_append:
        mode.addItem("Adicionar ao final do documento", "append")
        m.body.addWidget(Field("Ao concluir", mode))
    go = Button("Gerar apostila", "primary", icon_text="✦", height=46)
    m.body.addWidget(go)

    def run():
        if len(topic.text().strip()) < 3 or len(level.text().strip()) < 2:
            Toast.show_message(host, "Informe o tema e o ano/nível.", "warning")
            return
        try:
            assistant = get_assistant()
        except AIError as exc:
            Toast.show_message(host, str(exc), "error", 5000)
            return
        args = (topic.text(), subject.text(), level.text(), sections.value(), exercises.value(), notes.toPlainText())
        chosen = mode.currentData()
        m.close_modal()
        busy = ai_busy_modal(host)
        run_async(lambda: assistant.generate_apostila(*args),
                  busy.guard(lambda doc: (busy.close_modal(), on_result(sanitize_document(doc), chosen),
                               assistant.is_demo and Toast.show_message(host, "Modo demonstração: conteúdo de EXEMPLO. Configure uma IA "
                                                                        "gratuita (Ollama ou Gemini) em Configurações para conteúdo real.", "warning", 7000))),
                  busy.guard(lambda e: (busy.close_modal(), Toast.show_message(host, str(e) if isinstance(e, AIError) else "Falha na IA.", "error", 6000))))

    go.clicked.connect(run)
    m.open()


__all__ = ["EditorView", "open_ai_generate", "hline", "QFormLayout"]
