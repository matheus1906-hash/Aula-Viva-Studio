"""Geração de PDFs interativos (ReportLab + pypdf).

Recursos: capa, sumário clicável, marcadores, QR codes clicáveis, links,
botões, documentos Word/Office (link ou anexo embutido), campos de resposta
preenchíveis (texto, múltipla escolha, V/F), gabarito, proteção AES-256.
Nenhum JavaScript é inserido no PDF.
"""

from __future__ import annotations

import base64
import io
import re
from html import escape
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.constants import UserAccessPermissions
from reportlab import rl_config
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, CondPageBreak, Flowable, Frame, Image as RLImage, KeepTogether, NextPageTemplate,
    PageBreak, PageTemplate, Paragraph, Spacer, Table, TableStyle,
)
from reportlab.platypus.doctemplate import LayoutError
from reportlab.platypus.tableofcontents import TableOfContents

from aulaviva import APP_NAME
from aulaviva.core.projects import BLOCK_TYPES, CALLOUT_STYLES, THEMES, sanitize_document

BLOCK_NAMES = {k: v[0] for k, v in BLOCK_TYPES.items()}
from aulaviva.core.config import resource_path
from aulaviva.core.security import SecurityError, validate_url

PAGE_W, PAGE_H = A4
# Streams binários (sem ASCII85): geração muito mais rápida e arquivos menores
rl_config.useA85 = 0
MARGIN = 18 * mm

# ---------------------------------------------------------------------------
# Fontes (usa uma fonte Unicode do sistema quando disponível)
# ---------------------------------------------------------------------------
_FONT_DIR = resource_path("aulaviva/assets/fonts")
_FONT_CANDIDATES = [
    # 1º: fonte livre embutida no app (resultado idêntico em Windows e Linux, Unicode completo)
    tuple(str(_FONT_DIR / f) for f in ("DejaVuSans.ttf", "DejaVuSans-Bold.ttf", "DejaVuSans-Oblique.ttf", "DejaVuSans-BoldOblique.ttf")),
    ("C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/segoeuii.ttf", "C:/Windows/Fonts/segoeuiz.ttf"),
    ("C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/ariali.ttf", "C:/Windows/Fonts/arialbi.ttf"),
]
_FONTS: tuple[str, str, str] | None = None


def fonts() -> tuple[str, str, str]:
    global _FONTS
    if _FONTS:
        return _FONTS
    for reg, bold, ital, bi in _FONT_CANDIDATES:
        if all(Path(p).exists() for p in (reg, bold, ital, bi)):
            try:
                pdfmetrics.registerFont(TTFont("AV", reg))
                pdfmetrics.registerFont(TTFont("AV-Bold", bold))
                pdfmetrics.registerFont(TTFont("AV-Italic", ital))
                pdfmetrics.registerFont(TTFont("AV-BoldItalic", bi))
                pdfmetrics.registerFontFamily("AV", normal="AV", bold="AV-Bold", italic="AV-Italic", boldItalic="AV-BoldItalic")
                _FONTS = ("AV", "AV-Bold", "AV-Italic")
                return _FONTS
            except Exception:
                continue
    _FONTS = ("Helvetica", "Helvetica-Bold", "Helvetica-Oblique")
    return _FONTS


# ---------------------------------------------------------------------------
# Texto rico seguro: **negrito**, *itálico*, [rótulo](https://link)
# ---------------------------------------------------------------------------
_LINK_RE = re.compile(r"\[([^\]\n]{1,200})\]\(([^)\s]{1,2048})\)")


def rich(text: str, link_color: str = "#2F6FED") -> str:
    out, last = [], 0
    for m in _LINK_RE.finditer(text or ""):
        out.append(_inline(text[last:m.start()]))
        try:
            url = validate_url(m.group(2))
            out.append(f'<a href="{escape(url, quote=True)}" color="{link_color}"><u>{_inline(m.group(1))}</u></a>')
        except SecurityError:
            out.append(_inline(m.group(0)))
        last = m.end()
    out.append(_inline((text or "")[last:]))
    return "".join(out).replace("\n", "<br/>")


_BOLD_RE = re.compile(r"\*\*(.+?)\*\*")
_ITALIC_RE = re.compile(r"(?<![*\w])\*(?![\s*])(.+?)(?<![\s*])\*(?![*\w])")


def _italic(escaped: str) -> str:
    return _ITALIC_RE.sub(r"<i>\1</i>", escaped)


def _inline(s: str) -> str:
    """**negrito** e *itálico* sem nunca gerar tags cruzadas."""
    out, last = [], 0
    for m in _BOLD_RE.finditer(s):
        out.append(_italic(escape(s[last:m.start()], quote=False)))
        out.append("<b>" + _italic(escape(m.group(1), quote=False)) + "</b>")
        last = m.end()
    out.append(_italic(escape(s[last:], quote=False)))
    return "".join(out)


def safe_para(markup: str, style, **kw) -> Paragraph:
    """Cria um parágrafo; se a marcação for inválida, cai para texto simples."""
    try:
        return Paragraph(markup, style, **kw)
    except ValueError:
        return Paragraph(re.sub(r"<[^>]+>", "", markup.replace("<br/>", "\n")).replace("\n", "<br/>"), style, **kw)


class ExportError(Exception):
    """Erro de exportação com mensagem amigável para o professor."""


# ---------------------------------------------------------------------------
# Flowables personalizados
# ---------------------------------------------------------------------------
class LinkButton(Flowable):
    def __init__(self, label: str, url: str, color, description: str = "", icon: str = "↗"):
        super().__init__()
        self.label, self.url, self.color, self.description, self.icon = label, url, color, description, icon
        self.height = 16 * mm if description else 12 * mm

    def wrap(self, aw, ah):
        self.width = aw
        return aw, self.height + 2 * mm

    def draw(self):
        c, (reg, bold, _) = self.canv, fonts()
        h = self.height
        c.setFillColor(colors.Color(self.color.red, self.color.green, self.color.blue, alpha=0.08))
        c.setStrokeColor(self.color)
        c.setLineWidth(1)
        c.roundRect(0, 0, self.width, h, 3 * mm, stroke=1, fill=1)
        c.setFillColor(self.color)
        c.roundRect(3 * mm, (h - 8 * mm) / 2, 8 * mm, 8 * mm, 2 * mm, stroke=0, fill=1)
        c.setFillColor(colors.white)
        c.setFont(bold, 9 if len(self.icon) > 1 else 11)
        c.drawCentredString(7 * mm, h / 2 - 1.3 * mm, self.icon)
        c.setFillColor(colors.HexColor("#1D2433"))
        c.setFont(bold, 11)
        ty = h / 2 + (1.2 * mm if self.description else -1.4 * mm)
        c.drawString(14 * mm, ty, self.label[:90])
        if self.description:
            c.setFont(reg, 8.5)
            c.setFillColor(colors.HexColor("#5B6475"))
            c.drawString(14 * mm, ty - 5 * mm, self.description[:120])
        if self.url:
            c.setFont(reg, 8)
            c.setFillColor(self.color)
            c.drawRightString(self.width - 4 * mm, h / 2 - 1.2 * mm, "clique para abrir ›")
            c.linkURL(self.url, (0, 0, self.width, h), relative=1, thickness=0)


class VideoCard(Flowable):
    """Cartão de vídeo anexado: miniatura estilizada com botão de play e instruções para assistir."""

    def __init__(self, title: str, filename: str, info: str, color):
        super().__init__()
        self.title, self.filename, self.info, self.color = title, filename, info, color
        self.height = 34 * mm

    def wrap(self, aw, ah):
        self.width = aw
        return aw, self.height + 2 * mm

    def draw(self):
        c, (reg, bold, _) = self.canv, fonts()
        h, w = self.height, self.width
        c.setStrokeColor(self.color)
        c.setFillColor(colors.Color(self.color.red, self.color.green, self.color.blue, alpha=0.06))
        c.setLineWidth(1)
        c.roundRect(0, 0, w, h, 3 * mm, stroke=1, fill=1)
        tw, th = 52 * mm, h - 6 * mm  # "tela" do vídeo
        c.setFillColor(colors.HexColor("#1F2937"))
        c.roundRect(3 * mm, 3 * mm, tw, th, 2 * mm, stroke=0, fill=1)
        c.setFillColor(colors.Color(self.color.red, self.color.green, self.color.blue, alpha=0.55))
        c.rect(3 * mm, 3 * mm, tw * 0.38, 1.2 * mm, stroke=0, fill=1)  # barra de progresso
        cx, cy = 3 * mm + tw / 2, 3 * mm + th / 2 + 1 * mm
        c.setFillColor(colors.white)
        c.circle(cx, cy, 7 * mm, stroke=0, fill=1)
        c.setFillColor(self.color)
        p = c.beginPath()
        p.moveTo(cx - 2.3 * mm, cy - 3.6 * mm)
        p.lineTo(cx - 2.3 * mm, cy + 3.6 * mm)
        p.lineTo(cx + 3.9 * mm, cy)
        p.close()
        c.drawPath(p, stroke=0, fill=1)
        tx = tw + 9 * mm
        c.setFillColor(colors.HexColor("#1D2433"))
        c.setFont(bold, 12)
        c.drawString(tx, h - 9 * mm, self.title[:60])
        c.setFont(reg, 9)
        c.setFillColor(colors.HexColor("#5B6475"))
        c.drawString(tx, h - 14.5 * mm, f"Vídeo anexado ao PDF: {self.filename[:60]}" + (f" ({self.info})" if self.info else ""))
        c.setFillColor(self.color)
        c.setFont(bold, 9)
        c.drawString(tx, h - 21 * mm, "Como assistir:")
        c.setFont(reg, 8.5)
        c.setFillColor(colors.HexColor("#3B4252"))
        c.drawString(tx, h - 25.5 * mm, "abra o painel de anexos (ícone de clipe) no leitor de PDF")
        c.drawString(tx, h - 29.5 * mm, "e dê dois cliques no vídeo para ele abrir no seu player.")


class QRBlock(Flowable):
    def __init__(self, url: str, caption: str, size_mm: float, color, title: str = ""):
        super().__init__()
        self.url, self.caption, self.size, self.color, self.title = url, caption, size_mm * mm, color, title

    def wrap(self, aw, ah):
        self.width = aw
        return aw, self.size + 4 * mm

    def draw(self):
        c, (reg, bold, _) = self.canv, fonts()
        widget = QrCodeWidget(self.url, barLevel="M")
        x0, y0, x1, y1 = widget.getBounds()
        d = Drawing(self.size, self.size, transform=[self.size / (x1 - x0), 0, 0, self.size / (y1 - y0), 0, 0])
        d.add(widget)
        c.setStrokeColor(self.color)
        c.setFillColor(colors.white)
        c.roundRect(0, 0, self.width, self.size + 2 * mm, 3 * mm, stroke=1, fill=1)
        d.drawOn(c, 1 * mm, 1 * mm)
        c.linkURL(self.url, (1 * mm, 1 * mm, self.size + 1 * mm, self.size + 1 * mm), relative=1, thickness=0)
        tx = self.size + 6 * mm
        c.setFillColor(self.color)
        c.setFont(bold, 12)
        c.drawString(tx, self.size - 6 * mm, (self.title or "Conteúdo extra")[:60])
        c.setFillColor(colors.HexColor("#1D2433"))
        c.setFont(reg, 9.5)
        c.drawString(tx, self.size - 12 * mm, self.caption[:80])
        c.setFillColor(colors.HexColor("#5B6475"))
        c.setFont(reg, 7.5)
        shown = self.url if len(self.url) < 70 else self.url[:67] + "..."
        c.drawString(tx, self.size - 18 * mm, shown)
        c.setFillColor(self.color)
        c.setFont(bold, 8.5)
        c.drawString(tx, 5 * mm, "Escaneie com a câmera ou clique no código ›")
        c.linkURL(self.url, (tx, 3 * mm, self.width, self.size), relative=1, thickness=0)


class AnswerLines(Flowable):
    """Linhas pautadas com campo de texto preenchível por cima."""

    def __init__(self, name: str, lines: int):
        super().__init__()
        self.name, self.lines = name, max(1, min(lines, 20))

    def wrap(self, aw, ah):
        self.width = aw
        return aw, self.lines * 8 * mm

    def draw(self):
        c = self.canv
        c.setStrokeColor(colors.HexColor("#C9D2E3"))
        c.setLineWidth(0.6)
        for i in range(self.lines):
            y = i * 8 * mm + 1 * mm
            c.line(0, y, self.width, y)
        c.acroForm.textfield(
            name=self.name, tooltip="Digite sua resposta", x=0, y=0, width=self.width, height=self.lines * 8 * mm,
            borderWidth=0, fillColor=colors.Color(1, 1, 1, alpha=0), textColor=colors.HexColor("#1D2433"),
            forceBorder=False, fieldFlags="multiline", fontSize=10, relative=True,
        )


class ChoiceOption(Flowable):
    def __init__(self, group: str, value: str, text: str, style, kind: str = "radio"):
        super().__init__()
        self.group, self.value, self.text, self.style, self.kind = group, value, text, style, kind

    def wrap(self, aw, ah):
        self.width = aw
        self.para = safe_para(self.text, self.style)
        _, h = self.para.wrap(aw - 9 * mm, ah)
        self.height = max(h, 6 * mm)
        return aw, self.height + 1.5 * mm

    def draw(self):
        c = self.canv
        y = self.height - 5 * mm
        if self.kind == "radio":
            c.acroForm.radio(name=self.group, value=self.value, selected=False, x=0, y=y, size=4.6 * mm,
                             buttonStyle="circle", borderColor=colors.HexColor("#7A869A"), fillColor=colors.white,
                             borderWidth=1, forceBorder=True, relative=True, tooltip=self.value)
        else:
            c.acroForm.checkbox(name=self.group, x=0, y=y, size=4.6 * mm, buttonStyle="check",
                                borderColor=colors.HexColor("#7A869A"), fillColor=colors.white, borderWidth=1,
                                forceBorder=True, relative=True)
        self.para.drawOn(c, 7.5 * mm, self.height - self.para.height)


class TrueFalseRow(Flowable):
    def __init__(self, name: str, number: int, text: str, style):
        super().__init__()
        self.name, self.number, self.text, self.style = name, number, text, style

    def wrap(self, aw, ah):
        self.width = aw
        self.para = safe_para(f"{self.number}. {self.text}", self.style)
        _, h = self.para.wrap(aw - 28 * mm, ah)
        self.height = max(h, 7 * mm)
        return aw, self.height + 1.5 * mm

    def draw(self):
        c, (_, bold, _) = self.canv, fonts()
        y = self.height - 5.5 * mm
        for i, label in enumerate(("V", "F")):
            x = i * 11 * mm
            c.acroForm.radio(name=self.name, value=label, selected=False, x=x, y=y, size=4.6 * mm, buttonStyle="circle",
                             borderColor=colors.HexColor("#7A869A"), fillColor=colors.white, borderWidth=1,
                             forceBorder=True, relative=True)
            c.setFont(bold, 8.5)
            c.setFillColor(colors.HexColor("#5B6475"))
            c.drawString(x + 5.6 * mm, y + 1.2 * mm, label)
        self.para.drawOn(c, 25 * mm, self.height - self.para.height)


class StudentHeader(Flowable):
    def __init__(self, color):
        super().__init__()
        self.color = color

    def wrap(self, aw, ah):
        self.width = aw
        return aw, 20 * mm

    def draw(self):
        c, (reg, bold, _) = self.canv, fonts()
        c.setStrokeColor(colors.HexColor("#D5DCEA"))
        c.setFillColor(colors.HexColor("#F7F9FC"))
        c.roundRect(0, 0, self.width, 18 * mm, 3 * mm, stroke=1, fill=1)
        fields = [("Nome", 0.0, 0.62, "aluno_nome"), ("Turma", 0.64, 0.17, "aluno_turma"), ("Data", 0.83, 0.15, "aluno_data")]
        for label, fx, fw, name in fields:
            x, w = 4 * mm + fx * (self.width - 8 * mm), fw * (self.width - 8 * mm)
            c.setFont(bold, 8)
            c.setFillColor(self.color)
            c.drawString(x, 12.5 * mm, label.upper())
            c.acroForm.textfield(name=name, x=x, y=3.5 * mm, width=w, height=7.5 * mm, borderColor=colors.HexColor("#C9D2E3"),
                                 fillColor=colors.white, borderWidth=0.8, fontSize=10, relative=True, tooltip=label)


class Heading(Paragraph):
    """Parágrafo que registra entrada no sumário e marcador (bookmark)."""

    def __init__(self, text, style, level, key):
        super().__init__(text, style)
        self.toc_level, self.toc_key, self.plain = level, key, re.sub(r"<[^>]+>", "", text)


# ---------------------------------------------------------------------------
# Documento
# ---------------------------------------------------------------------------
class _Doc(BaseDocTemplate):
    def __init__(self, buf, meta, color, **kw):
        super().__init__(buf, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=MARGIN + 8 * mm,
                         bottomMargin=MARGIN, title=meta["title"], author=meta["author"], subject=meta["subject"],
                         creator=APP_NAME, **kw)
        self.meta, self.color = meta, color
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="main")
        cover_frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="cover")
        self.addPageTemplates([
            PageTemplate(id="cover", frames=[cover_frame], onPage=self._draw_cover),
            PageTemplate(id="normal", frames=[frame], onPage=self._draw_page),
        ])

    def beforeDocument(self):
        self._outline_level = -1  # reinicia a cada passada do multiBuild

    def afterFlowable(self, flowable):
        if isinstance(flowable, Heading):
            key = flowable.toc_key
            self.canv.bookmarkPage(key)
            # marcadores não podem pular níveis (ex.: subseção antes de qualquer seção)
            level = min(flowable.toc_level, getattr(self, "_outline_level", -1) + 1)
            self._outline_level = level
            self.canv.addOutlineEntry(flowable.plain[:120], key, level=level, closed=False)
            self.notify("TOCEntry", (level, flowable.plain, self.page, key))

    def _draw_page(self, c, doc):
        reg, bold, _ = fonts()
        c.saveState()
        c.setFillColor(self.color)
        c.rect(0, PAGE_H - 6 * mm, PAGE_W, 6 * mm, stroke=0, fill=1)
        c.setFont(bold, 8.5)
        c.setFillColor(colors.HexColor("#5B6475"))
        c.drawString(MARGIN, PAGE_H - 13 * mm, self.meta["title"][:80])
        right = " · ".join(x for x in (self.meta["subject"], self.meta["school"]) if x)
        c.setFont(reg, 8)
        c.drawRightString(PAGE_W - MARGIN, PAGE_H - 13 * mm, right[:80])
        c.setStrokeColor(colors.HexColor("#E3E8F2"))
        c.line(MARGIN, PAGE_H - 15.5 * mm, PAGE_W - MARGIN, PAGE_H - 15.5 * mm)
        c.setFont(reg, 8)
        if self.meta["footer"]:
            c.drawString(MARGIN, 9 * mm, self.meta["footer"][:110])
        if self.meta["page_numbers"]:
            c.setFillColor(self.color)
            c.roundRect(PAGE_W - MARGIN - 12 * mm, 7 * mm, 12 * mm, 6 * mm, 3 * mm, stroke=0, fill=1)
            c.setFillColor(colors.white)
            c.setFont(bold, 8)
            c.drawCentredString(PAGE_W - MARGIN - 6 * mm, 9 * mm, str(doc.page))
        c.restoreState()

    def _draw_cover(self, c, doc):
        reg, bold, ital = fonts()
        m, col = self.meta, self.color
        c.saveState()
        c.setFillColor(col)
        c.rect(0, PAGE_H * 0.42, PAGE_W, PAGE_H * 0.58, stroke=0, fill=1)
        # Elementos escolares decorativos (lápis, régua, fórmulas)
        c.setFillColor(colors.Color(1, 1, 1, alpha=0.10))
        c.setStrokeColor(colors.Color(1, 1, 1, alpha=0.16))
        c.setLineWidth(2)
        for i, (x, y, r) in enumerate([(0.85, 0.92, 60), (0.12, 0.62, 38), (0.7, 0.55, 22), (0.95, 0.66, 30)]):
            c.circle(PAGE_W * x, PAGE_H * y, r, stroke=i % 2, fill=1 - i % 2)
        c.setFont(ital, 15)
        c.setFillColor(colors.Color(1, 1, 1, alpha=0.22))
        for text, x, y in [("a² + b² = c²", 0.08, 0.93), ("E = mc²", 0.62, 0.86), ("H₂O", 0.18, 0.5), ("π ≈ 3,14", 0.72, 0.47), ("ABC", 0.42, 0.95)]:
            c.drawString(PAGE_W * x, PAGE_H * y, text)
        c.setStrokeColor(colors.Color(1, 1, 1, alpha=0.25))
        c.setLineWidth(1)
        for i in range(0, 21):  # régua
            x = PAGE_W * 0.08 + i * 6 * mm
            c.line(x, PAGE_H * 0.445, x, PAGE_H * 0.445 + (5 * mm if i % 5 == 0 else 2.5 * mm))
        c.setFillColor(colors.white)
        c.setFont(bold, 10)
        tag = " · ".join(x for x in (m["subject"], m["level"]) if x).upper()
        c.drawString(MARGIN, PAGE_H * 0.78, tag[:90])
        title_style = ParagraphStyle("ct", fontName=bold, fontSize=32, leading=38, textColor=colors.white)
        p = Paragraph(escape(m["title"]), title_style)
        _, h = p.wrap(PAGE_W - 2 * MARGIN, 200)
        p.drawOn(c, MARGIN, PAGE_H * 0.76 - h - 4 * mm)
        if m["subtitle"]:
            sp = Paragraph(escape(m["subtitle"]), ParagraphStyle("cs", fontName=reg, fontSize=15, leading=20, textColor=colors.Color(1, 1, 1, alpha=0.9)))
            _, sh = sp.wrap(PAGE_W - 2 * MARGIN, 100)
            sp.drawOn(c, MARGIN, PAGE_H * 0.76 - h - sh - 10 * mm)
        c.setFillColor(colors.HexColor("#1D2433"))
        y = PAGE_H * 0.34
        for label, value in (("Professor(a)", m["author"]), ("Instituição", m["school"])):
            if value:
                c.setFont(bold, 9)
                c.setFillColor(col)
                c.drawString(MARGIN, y, label.upper())
                c.setFont(reg, 13)
                c.setFillColor(colors.HexColor("#1D2433"))
                c.drawString(MARGIN, y - 6 * mm, value[:70])
                y -= 18 * mm
        c.setFont(reg, 8)
        c.setFillColor(colors.HexColor("#8A94A6"))
        c.drawString(MARGIN, 12 * mm, f"Material interativo - links, QR codes e campos de resposta funcionam neste PDF. Criado com {APP_NAME}.")
        c.restoreState()


def _styles(color):
    reg, bold, ital = fonts()
    dark = colors.HexColor("#1D2433")
    return {
        "body": ParagraphStyle("body", fontName=reg, fontSize=10.5, leading=15.5, textColor=dark, spaceAfter=6),
        "h1": ParagraphStyle("h1", fontName=bold, fontSize=18, leading=22, textColor=color, spaceBefore=10, spaceAfter=8),
        "h2": ParagraphStyle("h2", fontName=bold, fontSize=13.5, leading=17, textColor=dark, spaceBefore=8, spaceAfter=5),
        "caption": ParagraphStyle("cap", fontName=ital, fontSize=8.5, leading=11, textColor=colors.HexColor("#5B6475"), alignment=TA_CENTER, spaceAfter=8),
        "q": ParagraphStyle("q", fontName=bold, fontSize=10.5, leading=15, textColor=dark, spaceAfter=4),
        "opt": ParagraphStyle("opt", fontName=reg, fontSize=10, leading=14, textColor=dark),
        "bullet": ParagraphStyle("bul", fontName=reg, fontSize=10.5, leading=15, textColor=dark, leftIndent=12, bulletIndent=2, spaceAfter=2),
        "toc1": ParagraphStyle("toc1", fontName=bold, fontSize=11, leading=18, textColor=dark),
        "toc2": ParagraphStyle("toc2", fontName=reg, fontSize=10, leading=15, leftIndent=12, textColor=colors.HexColor("#3A4356")),
        "key": ParagraphStyle("key", fontName=reg, fontSize=10, leading=14, textColor=dark, spaceAfter=3),
    }


def _callout(block, styles, width):
    label, hexcol = CALLOUT_STYLES.get(block["style"], CALLOUT_STYLES["dica"])
    col = colors.HexColor(hexcol)
    title = block["title"] or label
    title_p = Paragraph(f'<font color="{hexcol}"><b>{escape(title)}</b></font>', styles["body"])
    body_p = safe_para(rich(block["text"], hexcol), styles["body"])
    t = Table([[title_p], [body_p]], colWidths=[width], splitInRow=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.Color(col.red, col.green, col.blue, alpha=0.08)),
        ("LINEBEFORE", (0, 0), (0, -1), 3, col),
        ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, 0), 8), ("BOTTOMPADDING", (0, -1), (-1, -1), 6),
        ("TOPPADDING", (0, 1), (-1, -1), 0),
    ]))
    return t


_PREVIEW_IMG_CACHE: dict[int, bytes] = {}


def _preview_image(data_b64: str) -> bytes:
    """Versão reduzida da imagem para a prévia ao vivo (com cache)."""
    key = hash(data_b64)
    if key not in _PREVIEW_IMG_CACHE:
        from PIL import Image

        if len(_PREVIEW_IMG_CACHE) > 40:
            _PREVIEW_IMG_CACHE.clear()
        raw = base64.b64decode(data_b64)
        try:
            with Image.open(io.BytesIO(raw)) as im:
                im.thumbnail((700, 700))
                out = io.BytesIO()
                (im.convert("RGB") if im.mode not in ("RGB", "L") else im).save(out, "JPEG", quality=70)
                raw = out.getvalue()
        except Exception:
            pass
        _PREVIEW_IMG_CACHE[key] = raw
    return _PREVIEW_IMG_CACHE[key]


def incomplete_blocks(document: dict) -> list[tuple[int, str, str]]:
    """Lista (índice, nome do bloco, motivo) dos blocos que não podem ir para o PDF."""
    from aulaviva.core.projects import BLOCK_TYPES, block_url_problem

    out = []
    for i, b in enumerate(document.get("blocks", [])):
        name = BLOCK_TYPES.get(b.get("type"), ("Bloco",))[0]
        problem = block_url_problem(b)
        if problem:
            out.append((i, name, "link vazio" if not (b.get("url") or "").strip() else problem))
        elif b.get("type") == "image" and not b.get("data"):
            out.append((i, name, "nenhuma imagem escolhida"))
        elif b.get("type") == "word" and b.get("mode") == "embed" and not b.get("data"):
            out.append((i, name, "nenhum arquivo anexado"))
        elif b.get("type") == "video" and b.get("mode") == "embed" and not b.get("media"):
            out.append((i, name, "nenhum vídeo escolhido"))
    return out


def build_pdf(document: dict, preview: bool = False, skip_incomplete: bool = False,
              answer_key: bool | None = None, media: dict[str, bytes] | None = None) -> bytes:
    """Gera o PDF e retorna os bytes.

    preview: prévia rápida (sem criptografia/anexos; mostra avisos no lugar de erros).
    skip_incomplete: ignora blocos sem link/imagem/arquivo em vez de falhar.
    answer_key: força incluir (True) ou omitir (False) o gabarito; None usa o documento.
    media: vídeos anexados {id: bytes} (só na exportação final).
    """
    try:
        return _build(document, preview, skip_incomplete, answer_key, media or {})
    except (SecurityError, ExportError):
        raise
    except LayoutError as exc:
        raise ExportError("Um bloco ficou grande demais para caber em uma página. Divida o texto em blocos menores "
                          "ou reduza o tamanho da imagem/QR code.") from exc
    except Exception as exc:
        raise ExportError(f"Não foi possível gerar o PDF ({type(exc).__name__}). Verifique os blocos e tente novamente.") from exc


def _build(document: dict, preview: bool, skip_incomplete: bool, answer_key_opt: bool | None,
           media: dict[str, bytes] | None = None) -> bytes:
    media = media or {}
    doc_data = sanitize_document(document)
    meta, blocks = doc_data["meta"], doc_data["blocks"]
    if skip_incomplete:
        skip = {i for i, _, _ in incomplete_blocks(doc_data)}
        blocks = [b for i, b in enumerate(blocks) if i not in skip]
    if answer_key_opt is not None:
        meta["answer_key"] = answer_key_opt
    hexcol = THEMES[meta["theme"]]
    color = colors.HexColor(hexcol)
    st = _styles(color)
    buf = io.BytesIO()
    doc = _Doc(buf, meta, color)
    width = doc.width
    story: list = []
    attachments: list[tuple[str, bytes]] = []
    answer_key: list[str] = []
    qnum = 0

    if meta["cover"]:
        story += [NextPageTemplate("normal"), PageBreak()]
    else:
        story.append(NextPageTemplate("normal"))
        doc.pageTemplates.insert(0, doc.pageTemplates.pop(1))

    if meta["student_fields"] and any(b["type"].endswith("question") or b["type"] == "true_false" for b in blocks):
        story += [StudentHeader(color), Spacer(1, 4 * mm)]

    if meta["toc"] and any(b["type"] == "heading" for b in blocks):
        toc = TableOfContents()
        toc.levelStyles = [st["toc1"], st["toc2"]]
        toc.dotsMinLevel = 0
        story += [Paragraph("Sumário", st["h1"]), toc, PageBreak()]

    for i, b in enumerate(blocks):
        t = b["type"]
        try:
            if t == "heading":
                lvl = 0 if b["level"] <= 1 else 1
                story.append(CondPageBreak(30 * mm))
                story.append(Heading(escape(b["text"]), st["h1" if lvl == 0 else "h2"], lvl, f"sec_{i}_{b['id']}"))
            elif t == "paragraph":
                story.append(safe_para(rich(b["text"], hexcol), st["body"]))
            elif t == "bullets":
                for item in b["items"]:
                    story.append(safe_para(rich(item, hexcol), st["bullet"], bulletText="•"))
                story.append(Spacer(1, 3 * mm))
            elif t == "callout":
                story += [_callout(b, st, width), Spacer(1, 4 * mm)]
            elif t == "image" and b["data"]:
                raw = _preview_image(b["data"]) if preview else base64.b64decode(b["data"])
                iw, ih = ImageReader(io.BytesIO(raw)).getSize()
                w = width * max(20, min(b["width"], 100)) / 100
                h = w * ih / iw
                if h > doc.height * 0.7:
                    h = doc.height * 0.7
                    w = h * iw / ih
                parts = [RLImage(io.BytesIO(raw), width=w, height=h)]
                if b["caption"]:
                    parts.append(Paragraph(escape(b["caption"]), st["caption"]))
                story.append(KeepTogether(parts))
            elif t == "qrcode":
                url = validate_url(b["url"])
                story += [QRBlock(url, b["caption"], max(22, min(b["size"], 60)), color), Spacer(1, 4 * mm)]
            elif t == "video" and b.get("mode") == "embed":
                name = b["filename"] or "video.mp4"
                if not preview and b["media"] in media:
                    attachments.append((name, media[b["media"]]))
                story += [VideoCard(b["title"] or "Vídeo", name, b.get("info", ""), color), Spacer(1, 3 * mm)]
                if (b.get("url") or "").strip():
                    url = validate_url(b["url"])
                    story += [QRBlock(url, "Também disponível online: aponte a câmera ou clique", 26, color,
                                      title=b["title"]), Spacer(1, 4 * mm)]
            elif t == "video":
                url = validate_url(b["url"])
                story += [QRBlock(url, "Assista ao vídeo pelo celular ou clicando aqui", 30, color, title=b["title"]), Spacer(1, 4 * mm)]
            elif t == "link":
                url = validate_url(b["url"])
                story += [LinkButton(b["label"], url, color, b["description"]), Spacer(1, 2 * mm)]
            elif t == "word":
                if b["mode"] == "embed" and b["data"]:
                    name = b["filename"] or "documento.docx"
                    if not preview:
                        attachments.append((name, base64.b64decode(b["data"])))
                    story += [LinkButton(b["label"], "", colors.HexColor("#2B579A"),
                                         f"Arquivo anexado: {name} - abra pelo painel de anexos (clipe) do leitor de PDF", icon="W"),
                              Spacer(1, 2 * mm)]
                else:
                    url = validate_url(b["url"])
                    story += [LinkButton(b["label"], url, colors.HexColor("#2B579A"), "Documento editável (Word/Office)", icon="W"), Spacer(1, 2 * mm)]
            elif t == "open_question":
                qnum += 1
                story.append(KeepTogether([safe_para(f"{qnum}. {rich(b['prompt'], hexcol)}", st["q"]), AnswerLines(f"q{qnum}_{b['id']}", b["lines"]), Spacer(1, 5 * mm)]))
                if b["answer"]:
                    answer_key.append(f"<b>{qnum}.</b> {rich(b['answer'], hexcol)}")
            elif t == "choice_question":
                qnum += 1
                group = f"q{qnum}_{b['id']}"
                items = [safe_para(f"{qnum}. {rich(b['prompt'], hexcol)}", st["q"])]
                for j, opt in enumerate(b["options"][:8]):
                    items.append(ChoiceOption(group, chr(65 + j), f"<b>{chr(65 + j)})</b> {rich(opt, hexcol)}", st["opt"]))
                items.append(Spacer(1, 5 * mm))
                story.append(KeepTogether(items))
                if 0 <= b["correct"] < len(b["options"]):
                    answer_key.append(f"<b>{qnum}.</b> Alternativa {chr(65 + b['correct'])}")
            elif t == "true_false":
                qnum += 1
                items = [Paragraph(f"{qnum}. Marque V (verdadeiro) ou F (falso):", st["q"])]
                for j, s in enumerate(b["statements"]):
                    items.append(TrueFalseRow(f"q{qnum}_{b['id']}_{j}", j + 1, rich(s, hexcol), st["opt"]))
                items.append(Spacer(1, 5 * mm))
                story.append(KeepTogether(items))
                ans = ", ".join(f"{j + 1}-{'V' if v else 'F'}" for j, v in enumerate(b["answers"][: len(b["statements"])]))
                if ans:
                    answer_key.append(f"<b>{qnum}.</b> {ans}")
            elif t == "table" and b["rows"]:
                ncols = max(len(r) for r in b["rows"])
                data = [[safe_para(rich(c, hexcol), st["opt"]) for c in r + [""] * (ncols - len(r))] for r in b["rows"]]
                tbl = Table(data, colWidths=[width / ncols] * ncols, repeatRows=1, splitInRow=1)
                tbl.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.Color(color.red, color.green, color.blue, alpha=0.15)),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D5DCEA")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]))
                story += [tbl, Spacer(1, 5 * mm)]
            elif t == "divider":
                story.append(Table([[""]], colWidths=[width], rowHeights=[4 * mm], style=[("LINEBELOW", (0, 0), (-1, -1), 0.8, colors.HexColor("#D5DCEA"))]))
            elif t == "page_break":
                story.append(PageBreak())
        except SecurityError as exc:
            if not preview:
                raise SecurityError(f"Bloco {i + 1} ({t}): {exc}") from exc
            msg = "falta informar o link" if not (b.get("url") or "").strip() else str(exc)
            story.append(Paragraph(f'<font color="#D64545">⚠ {escape(BLOCK_NAMES.get(t, t))}: {escape(msg)} '
                                   f'(este bloco não aparecerá no PDF final até ser corrigido)</font>', st["caption"]))

    if meta["answer_key"] and answer_key:
        story += [PageBreak(), Heading("Gabarito", st["h1"], 0, "gabarito"),
                  Paragraph("<i>Para uso do(a) professor(a). Remova esta página antes de distribuir, se desejar.</i>", st["caption"])]
        story += [safe_para(a, st["key"]) for a in answer_key]

    if not story or all(isinstance(f, (NextPageTemplate, PageBreak)) for f in story):
        story.append(Paragraph(" ", st["body"]))
    doc.multiBuild(story)
    return _postprocess(buf.getvalue(), meta, attachments, preview)


def export_to_file(document: dict, path: str, answer_key: bool | None = None, media: dict[str, bytes] | None = None) -> str:
    """Gera e grava o PDF (usado no processo auxiliar, fora da interface)."""
    from pathlib import Path

    out = Path(path)
    data = build_pdf(document, skip_incomplete=True, answer_key=answer_key, media=media)
    tmp = out.with_name(out.name + ".part")
    try:
        tmp.write_bytes(data)
        tmp.replace(out)
    except PermissionError as exc:
        tmp.unlink(missing_ok=True)
        raise ExportError(f"Não foi possível salvar \"{out.name}\". O arquivo pode estar aberto em outro "
                          "programa (feche o PDF e tente de novo) ou a pasta não permite gravação.") from exc
    except OSError as exc:
        tmp.unlink(missing_ok=True)
        raise ExportError(f"Não foi possível salvar o arquivo ({exc.strerror or 'erro de disco'}).") from exc
    return str(out)


def preview_pdf(document: dict) -> bytes:
    return build_pdf(document, preview=True)


def _postprocess(pdf: bytes, meta: dict, attachments: list[tuple[str, bytes]], preview: bool) -> bytes:
    writer = PdfWriter(clone_from=PdfReader(io.BytesIO(pdf)))
    writer.add_metadata({"/Title": meta["title"], "/Author": meta["author"], "/Subject": meta["subject"],
                         "/Creator": APP_NAME, "/Producer": APP_NAME})
    for name, data in attachments:
        writer.add_attachment(name, data)
    if not preview:
        writer.page_mode = "/UseOutlines"
    if meta["protect"] and not preview:
        if len(meta["owner_password"]) < 6:
            raise SecurityError("A senha de proteção do PDF precisa ter pelo menos 6 caracteres.")
        perms = UserAccessPermissions.FILL_FORM_FIELDS | UserAccessPermissions.EXTRACT_TEXT_AND_GRAPHICS
        if meta["allow_print"]:
            perms |= UserAccessPermissions.PRINT | UserAccessPermissions.PRINT_TO_REPRESENTATION
        if meta["allow_copy"]:
            perms |= UserAccessPermissions.EXTRACT
        # Sem senha de abertura: alunos abrem normalmente; a senha do professor
        # impede edição/alteração do material (AES-256).
        writer.encrypt(user_password="", owner_password=meta["owner_password"], permissions_flag=perms, algorithm="AES-256")
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()
