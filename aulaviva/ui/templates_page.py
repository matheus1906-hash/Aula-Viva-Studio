"""Página Modelos: amostras reais com miniatura da página e visualização completa antes de usar."""

from __future__ import annotations

import hashlib
import json

from PySide6.QtCore import QBuffer, QByteArray, QEasingCurve, QIODevice, QRectF, QSize, Qt, QVariantAnimation, Signal
from PySide6.QtGui import QColor, QCursor, QImage, QPainter, QPen, QPixmap
from PySide6.QtPdf import QPdfDocument
from PySide6.QtPdfWidgets import QPdfView
from PySide6.QtWidgets import QHBoxLayout, QPushButton, QVBoxLayout, QWidget

from aulaviva import __version__
from aulaviva.core.config import data_dir
from aulaviva.core.pdf_builder import build_pdf
from aulaviva.core.samples import SAMPLES, sample_document, sample_pdf
from aulaviva.ui import theme
from aulaviva.ui.widgets import Button, GlassCard, Modal, Motion, SmoothScrollArea, Spinner, label
from aulaviva.ui.workers import run_in_process

THUMB = QSize(220, 311)
_mem: dict[str, QPixmap] = {}


def _render_first_page(pdf: bytes, size: QSize) -> QImage:
    buf = QBuffer()
    buf.setData(QByteArray(pdf))
    buf.open(QIODevice.OpenModeFlag.ReadOnly)
    doc = QPdfDocument()
    doc.load(buf)
    raw = doc.render(0, size)
    doc.close()
    buf.close()
    # a página é renderizada com fundo transparente: compõe sobre papel branco (fica certo no modo escuro)
    img = QImage(raw.size(), QImage.Format.Format_RGB32)
    img.fill(QColor("white"))
    p = QPainter(img)
    p.drawImage(0, 0, raw)
    p.end()
    return img


def request_thumbnail(key: str, callback) -> None:
    """Miniatura da 1ª página (cache em memória e em disco; gerada em segundo plano)."""
    if key in _mem:
        callback(_mem[key])
        return
    tag = hashlib.sha1(f"{key}-{__version__}-papel".encode()).hexdigest()[:12]
    folder = data_dir() / "thumbs"
    folder.mkdir(exist_ok=True)
    path = folder / f"{key}-{tag}.png"
    if path.exists():
        pm = QPixmap(str(path))
        if not pm.isNull():
            _mem[key] = pm
            callback(pm)
            return

    def done(pdf: bytes):
        img = _render_first_page(pdf, THUMB * 2)
        if img.isNull():
            return
        img.save(str(path), "PNG")
        pm = QPixmap.fromImage(img)
        _mem[key] = pm
        callback(pm)

    run_in_process(sample_pdf, key, on_done=done, on_error=lambda e: None)


class TemplateCard(QWidget):
    clicked = Signal(str)

    def __init__(self, key: str):
        super().__init__()
        self.key = key
        title, kind, subject, level, desc, _ = SAMPLES[key]
        self.title, self.tags, self.desc = title, f"{kind} · {subject} · {level}", desc
        self.pix: QPixmap | None = None
        self._lift = 0.0
        self.setFixedSize(250, 420)
        self.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        self.setToolTip(desc)
        self._a = QVariantAnimation(self, duration=Motion.ms(180), easingCurve=QEasingCurve.Type.OutCubic)
        self._a.valueChanged.connect(lambda v: (setattr(self, "_lift", float(v)), self.update()))
        request_thumbnail(key, self._got)

    def _got(self, pm: QPixmap):
        try:
            self.pix = pm
            self.update()
        except RuntimeError:
            pass  # o cartão já foi removido (troca de filtro)

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
        if self.rect().contains(e.position().toPoint()):
            self.clicked.emit(self.key)

    def paintEvent(self, e):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        p.setRenderHint(QPainter.RenderHint.SmoothPixmapTransform)
        lift = self._lift * 4
        r = QRectF(5, 6 - lift, self.width() - 10, self.height() - 12)
        for i in range(5):
            p.setPen(Qt.PenStyle.NoPen)
            p.setBrush(QColor(*theme.SHADOW, (int(8 + 6 * self._lift) - i) * (3 if theme.is_dark() else 1)))
            p.drawRoundedRect(r.adjusted(-i + 1, -i + 3 + lift, i - 1, i + 3 + lift), 14 + i, 14 + i)
        p.setBrush(QColor(theme.SURFACE))
        p.setPen(QPen(QColor(theme.PRIMARY) if self._lift > 0.5 else QColor(theme.BORDER), 1))
        p.drawRoundedRect(r, 14, 14)
        page = QRectF(r.left() + (r.width() - THUMB.width()) / 2, r.top() + 12, THUMB.width(), THUMB.height())
        p.setPen(QPen(QColor(theme.BORDER), 1))
        p.setBrush(QColor(theme.SURFACE_ALT))
        p.drawRect(page)
        if self.pix:
            p.drawPixmap(page.toRect(), self.pix)
        else:
            p.setPen(QColor(theme.TEXT_MUTED))
            p.drawText(page, Qt.AlignmentFlag.AlignCenter, "Gerando prévia...")
        f = self.font()
        f.setPixelSize(14)
        f.setBold(True)
        p.setFont(f)
        p.setPen(QColor(theme.TEXT))
        fm = p.fontMetrics()
        p.drawText(QRectF(r.left() + 14, page.bottom() + 12, r.width() - 28, 20), Qt.AlignmentFlag.AlignLeft,
                   fm.elidedText(self.title, Qt.TextElideMode.ElideRight, int(r.width() - 28)))
        f.setPixelSize(11)
        f.setBold(False)
        p.setFont(f)
        p.setPen(QColor(theme.PRIMARY))
        p.drawText(QRectF(r.left() + 14, page.bottom() + 36, r.width() - 28, 18), Qt.AlignmentFlag.AlignLeft,
                   p.fontMetrics().elidedText(self.tags, Qt.TextElideMode.ElideRight, int(r.width() - 28)))
        p.setPen(QColor(theme.TEXT_MUTED))
        p.drawText(QRectF(r.left() + 14, page.bottom() + 56, r.width() - 28, 18), Qt.AlignmentFlag.AlignLeft, "Clique para visualizar")


def open_preview(host: QWidget, key: str, on_use) -> Modal:
    title, kind, subject, level, desc, _ = SAMPLES[key]
    m = Modal(host, 1040)
    row = QHBoxLayout()
    view = QPdfView()
    view.setPageMode(QPdfView.PageMode.MultiPage)
    view.setZoomMode(QPdfView.ZoomMode.FitToWidth)
    view.setPageSpacing(12)
    view.setMinimumHeight(max(380, host.window().height() - 200))
    doc = QPdfDocument(m)  # pertence ao modal: destruído depois da visualização
    view.setDocument(doc)
    m.closed.connect(lambda: (view.setDocument(None), doc.close()))
    holder = {"buf": None}
    spinner = Spinner(30)
    left = QVBoxLayout()
    left.addWidget(view, 1)
    left.addWidget(spinner, 0, Qt.AlignmentFlag.AlignHCenter)
    row.addLayout(left, 3)
    info = QVBoxLayout()
    info.addWidget(label(kind.upper(), "badge"), 0, Qt.AlignmentFlag.AlignLeft)
    info.addWidget(label(title, "h2", wrap=True))
    info.addWidget(label(f"{subject} · {level}", "dim"))
    info.addWidget(label(desc, "dim", wrap=True))
    pages = label("", "muted")
    info.addWidget(pages)
    info.addSpacing(8)
    info.addWidget(label("Ao usar, o modelo vira um material seu: troque textos, questões e imagens à vontade.", "muted", wrap=True))
    info.addStretch()
    use = Button("Usar este modelo", "primary", icon_text="✓", height=46)
    use.clicked.connect(lambda: (m.close_modal(), on_use(key)))
    close = Button("Voltar aos modelos", "ghost")
    close.clicked.connect(m.close_modal)
    info.addWidget(use)
    info.addWidget(close)
    row.addLayout(info, 2)
    m.body.addLayout(row)

    alive = {"ok": True}
    m.closed.connect(lambda: alive.update(ok=False))
    m.destroyed.connect(lambda: alive.update(ok=False))

    def loaded(pdf: bytes):
        if not alive["ok"]:
            return  # a janela foi fechada antes de a prévia terminar
        buf = QBuffer(doc)  # o buffer pertence ao documento: é destruído depois dele
        buf.setData(QByteArray(pdf))
        buf.open(QIODevice.OpenModeFlag.ReadOnly)
        holder["buf"] = buf
        doc.load(buf)
        spinner.hide()
        pages.setText(f"{doc.pageCount()} página(s) · inclui gabarito para o professor")

    run_in_process(sample_pdf, key, on_done=loaded, on_error=lambda e: alive["ok"] and spinner.hide())
    m.open()
    return m


class TemplatesPage(QWidget):
    def __init__(self, shell):
        super().__init__()
        from aulaviva.ui.dashboard import FlowGrid

        self.shell = shell
        lay = QVBoxLayout(self)
        lay.setContentsMargins(6, 6, 16, 0)
        head = QHBoxLayout()
        col = QVBoxLayout()
        col.addWidget(label("Modelos prontos", "h1"))
        col.addWidget(label("Materiais reais de exemplo. Visualize, escolha e adapte para a sua turma.", "dim"))
        head.addLayout(col, 1)
        blank = Button("Começar do zero", "secondary", icon_text="＋")
        blank.clicked.connect(lambda: shell.new_material("branco"))
        head.addWidget(blank)
        lay.addLayout(head)
        chips = QHBoxLayout()
        self.filter = "Todos"
        self.chip_btns = []
        for name in ("Todos", "Apostila", "Lista de exercícios", "Avaliação / Prova", "Roteiro com QR codes"):
            b = QPushButton(name)
            b.setCheckable(True)
            b.setChecked(name == "Todos")
            b.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
            b.setStyleSheet(f"QPushButton {{ background: {theme.SURFACE}; border: 1px solid {theme.BORDER_STRONG}; border-radius: 15px; padding: 6px 14px; color: {theme.TEXT_DIM}; }}"
                            f"QPushButton:hover {{ border-color: {theme.PRIMARY}; }}"
                            f"QPushButton:checked {{ background: {theme.PRIMARY}; border-color: {theme.PRIMARY}; color: white; font-weight: 600; }}")
            b.clicked.connect(lambda _=False, n=name: self.set_filter(n))
            chips.addWidget(b)
            self.chip_btns.append(b)
        chips.addStretch()
        from PySide6.QtWidgets import QComboBox

        from aulaviva.ui.widgets import line_edit

        self.search = line_edit("Buscar: frações, Newton, fábula...", 80)
        self.search.setFixedWidth(240)
        self.subject = QComboBox()
        self.subject.setMinimumHeight(38)
        self.subject.addItem("Todas as disciplinas", "")
        for subj in sorted({v[2] for v in SAMPLES.values()}):
            self.subject.addItem(subj, subj)
        self.search.textChanged.connect(lambda _: self.refresh())
        self.subject.currentIndexChanged.connect(lambda _: self.refresh())
        chips.addWidget(self.search)
        chips.addWidget(self.subject)
        lay.addLayout(chips)
        self.count = label("", "muted")
        lay.addWidget(self.count)
        scroll = SmoothScrollArea()
        box = QWidget()
        bl = QVBoxLayout(box)
        bl.setContentsMargins(0, 8, 0, 16)
        self.grid = FlowGrid(card_w=262)
        bl.addWidget(self.grid)
        bl.addStretch()
        scroll.setWidget(box)
        lay.addWidget(scroll, 1)
        self.refresh()

    def set_filter(self, name: str):
        self.filter = name
        for b in self.chip_btns:
            b.setChecked(b.text() == name)
        self.refresh()

    def refresh(self):
        cards = []
        q = self.search.text().strip().lower() if hasattr(self, "search") else ""
        subj = self.subject.currentData() if hasattr(self, "subject") else ""
        for key, (title, kind, subject, level, desc, _f) in SAMPLES.items():
            if self.filter != "Todos" and kind != self.filter:
                continue
            if subj and subject != subj:
                continue
            if q and q not in f"{title} {subject} {level} {desc}".lower():
                continue
            c = TemplateCard(key)
            c.clicked.connect(lambda k: open_preview(self, k, self.shell.new_from_sample))
            cards.append(c)
        self.grid.set_cards(cards)
        if hasattr(self, "count"):
            self.count.setText(f"{len(cards)} modelo(s)" if cards else "Nenhum modelo encontrado. Tente outra busca.")
