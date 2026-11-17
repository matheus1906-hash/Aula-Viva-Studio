"""Ilustrações e ícones vetoriais desenhados com QPainter (substituem emojis genéricos).

- illustration(): "capas" coloridas para tipos de material e ações (apostila, lista, prova, IA...)
- line_icon(): ícones de traço para menu lateral, botões e blocos do editor
- ArtIcon: widget com leve animação (pulo/escala) ao passar o mouse
"""

from __future__ import annotations

import math

from PySide6.QtCore import QEasingCurve, QPointF, QRectF, QSize, Qt, QVariantAnimation
from PySide6.QtGui import QBrush, QColor, QIcon, QLinearGradient, QPainter, QPainterPath, QPen, QPixmap
from PySide6.QtWidgets import QWidget

from aulaviva.ui import theme

# paleta por ilustração: (cor 1, cor 2)
_GRAD = {
    "apostila": ("#3B82F6", "#6366F1"), "lista": ("#F59E0B", "#F97316"), "prova": ("#F43F5E", "#BE123C"),
    "roteiro": ("#10B981", "#0D9488"), "branco": ("#94A3B8", "#64748B"), "ia": ("#8B5CF6", "#EC4899"),
    "arquivo": ("#0EA5E9", "#2563EB"), "qr": ("#475569", "#334155"), "link": ("#06B6D4", "#3B82F6"),
    "modelos": ("#F43F5E", "#F97316"), "seguranca": ("#22C55E", "#059669"), "pdf": ("#EF4444", "#DC2626"),
}


def _pen(color, width: float) -> QPen:
    pen = QPen(color, width)
    pen.setCapStyle(Qt.PenCapStyle.RoundCap)
    pen.setJoinStyle(Qt.PenJoinStyle.RoundJoin)
    return pen


def _round_rect(p: QPainter, r: QRectF, radius: float, brush, pen=Qt.PenStyle.NoPen):
    p.setPen(pen)
    p.setBrush(brush)
    p.drawRoundedRect(r, radius, radius)


def illustration(p: QPainter, rect: QRectF, name: str) -> None:
    """Desenha uma 'capa' ilustrada (quadrado arredondado com gradiente + desenho branco)."""
    p.save()
    p.setRenderHint(QPainter.RenderHint.Antialiasing)
    s = min(rect.width(), rect.height())
    r = QRectF(rect.center().x() - s / 2, rect.center().y() - s / 2, s, s)
    c1, c2 = _GRAD.get(name, _GRAD["apostila"])
    g = QLinearGradient(r.topLeft(), r.bottomRight())
    g.setColorAt(0, QColor(c1))
    g.setColorAt(1, QColor(c2))
    _round_rect(p, r, s * 0.24, QBrush(g))
    # brilho suave no topo
    gl = QLinearGradient(r.topLeft(), r.bottomLeft())
    gl.setColorAt(0, QColor(255, 255, 255, 60))
    gl.setColorAt(0.5, QColor(255, 255, 255, 0))
    _round_rect(p, r, s * 0.24, QBrush(gl))
    u = s / 100.0
    x0, y0 = r.left(), r.top()

    def R(x, y, w, h):
        return QRectF(x0 + x * u, y0 + y * u, w * u, h * u)

    def Pt(x, y):
        return QPointF(x0 + x * u, y0 + y * u)

    white = QColor("white")
    soft = QColor(255, 255, 255, 150)
    pen = QPen(white, 4.2 * u)
    pen.setCapStyle(Qt.PenCapStyle.RoundCap)
    pen.setJoinStyle(Qt.PenJoinStyle.RoundJoin)

    if name == "apostila":  # livro com marcador
        _round_rect(p, R(26, 20, 48, 62), 6 * u, white)
        _round_rect(p, R(26, 20, 10, 62), 4 * u, QColor(255, 255, 255, 170))
        p.setPen(_pen(QColor(c2), 3.2 * u))
        for y in (36, 46, 56):
            p.drawLine(Pt(43, y), Pt(66, y))
        _round_rect(p, R(58, 14, 9, 22), 2 * u, QColor("#FBBF24"))
    elif name == "lista":  # prancheta com checks
        _round_rect(p, R(25, 22, 50, 62), 7 * u, white)
        _round_rect(p, R(38, 15, 24, 12), 4 * u, QColor(255, 255, 255, 200))
        for i, y in enumerate((40, 54, 68)):
            p.setPen(_pen(QColor(c2), 3.6 * u))
            if i < 2:
                path = QPainterPath(Pt(32, y))
                path.lineTo(Pt(36, y + 4))
                path.lineTo(Pt(43, y - 4))
                p.drawPath(path)
            else:
                p.drawEllipse(R(32, y - 4, 9, 9))
            p.setPen(_pen(QColor(203, 213, 225), 3.4 * u))
            p.drawLine(Pt(49, y), Pt(67, y))
    elif name == "prova":  # folha com nota A+
        _round_rect(p, R(24, 16, 46, 64), 6 * u, white)
        p.setPen(_pen(QColor(203, 213, 225), 3.2 * u))
        for y in (32, 42, 52, 62):
            p.drawLine(Pt(32, y), Pt(60, y))
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(QColor("#FBBF24"))
        p.drawEllipse(R(54, 54, 30, 30))
        f = p.font()
        f.setPixelSize(int(13 * u))
        f.setBold(True)
        p.setFont(f)
        p.setPen(QColor("#7C2D12"))
        p.drawText(R(54, 54, 30, 30), Qt.AlignmentFlag.AlignCenter, "A+")
    elif name == "roteiro":  # mapa com rota e pino
        path = QPainterPath(Pt(22, 34))
        path.lineTo(Pt(40, 26))
        path.lineTo(Pt(60, 34))
        path.lineTo(Pt(78, 26))
        path.lineTo(Pt(78, 72))
        path.lineTo(Pt(60, 80))
        path.lineTo(Pt(40, 72))
        path.lineTo(Pt(22, 80))
        path.closeSubpath()
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(white)
        p.drawPath(path)
        dash = QPen(QColor(c2), 3 * u, Qt.PenStyle.DashLine, Qt.PenCapStyle.RoundCap)
        p.setPen(dash)
        p.setBrush(Qt.BrushStyle.NoBrush)
        route = QPainterPath(Pt(30, 70))
        route.cubicTo(Pt(42, 52), Pt(50, 66), Pt(62, 46))
        p.drawPath(route)
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(QColor("#EF4444"))
        pin = QPainterPath(Pt(64, 50))
        pin.cubicTo(Pt(54, 38), Pt(56, 24), Pt(64, 24))
        pin.cubicTo(Pt(72, 24), Pt(74, 38), Pt(64, 50))
        p.drawPath(pin)
        p.setBrush(white)
        p.drawEllipse(R(61, 29, 6, 6))
    elif name == "branco":  # folha em branco com +
        _round_rect(p, R(27, 18, 46, 64), 6 * u, white)
        p.setPen(_pen(QColor(c2), 5 * u))
        p.drawLine(Pt(50, 38), Pt(50, 62))
        p.drawLine(Pt(38, 50), Pt(62, 50))
    elif name == "ia":  # brilhos
        def star(cx, cy, k, col):
            sp = QPainterPath(Pt(cx, cy - k))
            sp.quadTo(Pt(cx, cy), Pt(cx + k, cy))
            sp.quadTo(Pt(cx, cy), Pt(cx, cy + k))
            sp.quadTo(Pt(cx, cy), Pt(cx - k, cy))
            sp.quadTo(Pt(cx, cy), Pt(cx, cy - k))
            p.setPen(Qt.PenStyle.NoPen)
            p.setBrush(col)
            p.drawPath(sp)
        star(44, 54, 26, white)
        star(70, 30, 12, QColor("#FDE68A"))
        star(72, 70, 8, soft)
    elif name == "arquivo":  # documento com seta de importação
        doc = QPainterPath(Pt(30, 16))
        doc.lineTo(Pt(58, 16))
        doc.lineTo(Pt(72, 30))
        doc.lineTo(Pt(72, 84))
        doc.lineTo(Pt(30, 84))
        doc.closeSubpath()
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(white)
        p.drawPath(doc)
        p.setBrush(QColor(255, 255, 255, 160))
        fold = QPainterPath(Pt(58, 16))
        fold.lineTo(Pt(58, 30))
        fold.lineTo(Pt(72, 30))
        fold.closeSubpath()
        p.drawPath(fold)
        p.setPen(_pen(QColor(c2), 4 * u))
        p.drawLine(Pt(51, 40), Pt(51, 66))
        ar = QPainterPath(Pt(41, 57))
        ar.lineTo(Pt(51, 67))
        ar.lineTo(Pt(61, 57))
        p.setBrush(Qt.BrushStyle.NoBrush)
        p.drawPath(ar)
    elif name == "qr":
        _round_rect(p, R(22, 22, 56, 56), 8 * u, white)
        p.setPen(Qt.PenStyle.NoPen)
        dark = QColor(c2)
        for (x, y) in ((28, 28), (56, 28), (28, 56)):
            _round_rect(p, R(x, y, 16, 16), 3 * u, dark)
            _round_rect(p, R(x + 4, y + 4, 8, 8), 2 * u, white)
            _round_rect(p, R(x + 6, y + 6, 4, 4), 1 * u, dark)
        for (x, y) in ((58, 58), (66, 58), (58, 66), (66, 70), (50, 50), (48, 62), (62, 50)):
            _round_rect(p, R(x, y, 6, 6), 1.5 * u, dark)
    elif name == "link":
        p.setPen(_pen(white, 7 * u))
        p.setBrush(Qt.BrushStyle.NoBrush)
        p.save()
        p.translate(Pt(50, 50))
        p.rotate(-45)
        p.drawRoundedRect(QRectF(-30 * u, -9 * u, 34 * u, 18 * u), 9 * u, 9 * u)
        p.drawRoundedRect(QRectF(-4 * u, -9 * u, 34 * u, 18 * u), 9 * u, 9 * u)
        p.restore()
    elif name == "modelos":  # páginas empilhadas
        for i, alpha in enumerate((110, 170, 255)):
            _round_rect(p, R(24 + i * 8, 30 - i * 7, 38, 50), 5 * u, QColor(255, 255, 255, alpha))
        p.setPen(_pen(QColor(c1), 3 * u))
        for y in (32, 41, 50):
            p.drawLine(Pt(46, y), Pt(70, y))
    elif name == "seguranca":  # escudo com check
        sh = QPainterPath(Pt(50, 16))
        sh.lineTo(Pt(76, 26))
        sh.cubicTo(Pt(76, 56), Pt(66, 74), Pt(50, 84))
        sh.cubicTo(Pt(34, 74), Pt(24, 56), Pt(24, 26))
        sh.closeSubpath()
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(white)
        p.drawPath(sh)
        p.setPen(_pen(QColor(c2), 5 * u))
        ck = QPainterPath(Pt(38, 50))
        ck.lineTo(Pt(47, 59))
        ck.lineTo(Pt(63, 41))
        p.setBrush(Qt.BrushStyle.NoBrush)
        p.drawPath(ck)
    elif name == "pdf":
        _round_rect(p, R(28, 18, 44, 64), 6 * u, white)
        _round_rect(p, R(20, 48, 40, 20), 4 * u, QColor("#7F1D1D"))
        f = p.font()
        f.setPixelSize(int(12 * u))
        f.setBold(True)
        p.setFont(f)
        p.setPen(white)
        p.drawText(R(20, 48, 40, 20), Qt.AlignmentFlag.AlignCenter, "PDF")
    p.restore()


# --------------------------------------------------------------------------- ícones de traço
def line_icon(p: QPainter, rect: QRectF, name: str, color: QColor, width: float = 1.8) -> None:
    """Ícones de linha 24x24 (escalados ao retângulo)."""
    p.save()
    p.setRenderHint(QPainter.RenderHint.Antialiasing)
    s = min(rect.width(), rect.height())
    p.translate(rect.center().x() - s / 2, rect.center().y() - s / 2)
    p.scale(s / 24.0, s / 24.0)
    pen = QPen(color, width * 24.0 / max(s, 1) * (s / 20.0))
    pen.setCapStyle(Qt.PenCapStyle.RoundCap)
    pen.setJoinStyle(Qt.PenJoinStyle.RoundJoin)
    p.setPen(pen)
    p.setBrush(Qt.BrushStyle.NoBrush)

    def path(*pts, close=False):
        pp = QPainterPath(QPointF(*pts[0]))
        for pt in pts[1:]:
            pp.lineTo(QPointF(*pt))
        if close:
            pp.closeSubpath()
        p.drawPath(pp)

    n = name
    if n == "home":
        path((3, 11), (12, 3.5), (21, 11))
        path((5.5, 9.5), (5.5, 20), (18.5, 20), (18.5, 9.5))
        path((10, 20), (10, 14), (14, 14), (14, 20))
    elif n == "folder":
        path((3, 6.5), (9, 6.5), (11, 8.5), (21, 8.5), (21, 19), (3, 19), close=True)
    elif n == "templates":
        p.drawRoundedRect(QRectF(3.5, 3.5, 7.5, 7.5), 1.5, 1.5)
        p.drawRoundedRect(QRectF(13, 3.5, 7.5, 7.5), 1.5, 1.5)
        p.drawRoundedRect(QRectF(3.5, 13, 7.5, 7.5), 1.5, 1.5)
        p.drawRoundedRect(QRectF(13, 13, 7.5, 7.5), 1.5, 1.5)
    elif n == "qr":
        for x, y in ((3.5, 3.5), (14, 3.5), (3.5, 14)):
            p.drawRoundedRect(QRectF(x, y, 6.5, 6.5), 1.2, 1.2)
        path((14, 14), (14, 17))
        path((17.5, 14), (20.5, 14))
        path((17.5, 17.5), (17.5, 20.5), (20.5, 20.5))
    elif n == "sparkle":
        sp = QPainterPath(QPointF(10, 3))
        sp.quadTo(QPointF(10.6, 9.4), QPointF(17, 10))
        sp.quadTo(QPointF(10.6, 10.6), QPointF(10, 17))
        sp.quadTo(QPointF(9.4, 10.6), QPointF(3, 10))
        sp.quadTo(QPointF(9.4, 9.4), QPointF(10, 3))
        p.drawPath(sp)
        path((18, 15), (18, 21))
        path((15, 18), (21, 18))
    elif n == "gear":
        p.drawEllipse(QPointF(12, 12), 3, 3)
        for k in range(8):
            a = k * math.pi / 4
            path((12 + 6.2 * math.cos(a), 12 + 6.2 * math.sin(a)), (12 + 8.6 * math.cos(a), 12 + 8.6 * math.sin(a)))
        p.drawEllipse(QPointF(12, 12), 6.2, 6.2)
    elif n == "logout":
        path((10, 4), (4, 4), (4, 20), (10, 20))
        path((9, 12), (20, 12))
        path((16, 8), (20, 12), (16, 16))
    elif n == "link":
        p.save()
        p.translate(12, 12)
        p.rotate(-45)
        p.drawRoundedRect(QRectF(-9, -3.5, 10.5, 7), 3.5, 3.5)
        p.drawRoundedRect(QRectF(-1.5, -3.5, 10.5, 7), 3.5, 3.5)
        p.restore()
    elif n == "file":
        path((6, 3), (14, 3), (19, 8), (19, 21), (6, 21), close=True)
        path((14, 3), (14, 8), (19, 8))
        path((12.5, 11), (12.5, 17))
        path((10, 14.5), (12.5, 17), (15, 14.5))
    elif n == "download":
        path((12, 4), (12, 15))
        path((7.5, 10.5), (12, 15), (16.5, 10.5))
        path((4, 19.5), (20, 19.5))
    elif n == "eye":
        pp = QPainterPath(QPointF(2.5, 12))
        pp.quadTo(QPointF(12, 3), QPointF(21.5, 12))
        pp.quadTo(QPointF(12, 21), QPointF(2.5, 12))
        p.drawPath(pp)
        p.drawEllipse(QPointF(12, 12), 3, 3)
    elif n == "plus":
        path((12, 5), (12, 19))
        path((5, 12), (19, 12))
    elif n == "bolt":
        path((13, 3), (5, 13.5), (11.5, 13.5), (10.5, 21), (19, 10), (12.5, 10), close=True)
    elif n == "back":
        path((15, 5), (8, 12), (15, 19))
    elif n == "book":
        path((12, 6), (12, 20))
        pp = QPainterPath(QPointF(12, 6))
        pp.cubicTo(QPointF(9, 4.5), QPointF(6, 4.5), QPointF(3, 5.5))
        pp.lineTo(QPointF(3, 19))
        pp.cubicTo(QPointF(6, 18), QPointF(9, 18), QPointF(12, 20))
        pp.cubicTo(QPointF(15, 18), QPointF(18, 18), QPointF(21, 19))
        pp.lineTo(QPointF(21, 5.5))
        pp.cubicTo(QPointF(18, 4.5), QPointF(15, 4.5), QPointF(12, 6))
        p.drawPath(pp)
    # ---- blocos do editor
    elif n == "heading":
        path((5, 5), (19, 5))
        path((12, 5), (12, 19))
    elif n == "paragraph":
        for y, x2 in ((6, 20), (10, 20), (14, 20), (18, 14)):
            path((4, y), (x2, y))
    elif n == "bullets":
        for y in (6.5, 12, 17.5):
            p.drawEllipse(QPointF(5, y), 1, 1)
            path((9, y), (20, y))
    elif n == "callout":
        p.drawRoundedRect(QRectF(3.5, 4.5, 17, 15), 3, 3)
        path((12, 8.5), (12, 12.5))
        path((12, 15.5), (12, 15.6))
    elif n == "image":
        p.drawRoundedRect(QRectF(3, 5, 18, 14), 2.5, 2.5)
        path((5.5, 17), (10, 11.5), (13.5, 15), (16, 12.5), (19, 16))
        p.drawEllipse(QPointF(16.5, 8.8), 1.3, 1.3)
    elif n == "table":
        p.drawRoundedRect(QRectF(3.5, 4.5, 17, 15), 2, 2)
        path((3.5, 9.5), (20.5, 9.5))
        path((3.5, 14.5), (20.5, 14.5))
        path((10, 9.5), (10, 19.5))
    elif n == "qrcode":
        line_icon_inner = "qr"
        p.restore()
        line_icon(p, rect, line_icon_inner, color, width)
        return
    elif n == "video":
        p.drawRoundedRect(QRectF(3, 5, 18, 14), 3, 3)
        path((10, 9), (15, 12), (10, 15), close=True)
    elif n == "word":
        path((6, 3), (14, 3), (19, 8), (19, 21), (6, 21), close=True)
        path((8.5, 11), (10, 17), (12.5, 12.5), (15, 17), (16.5, 11))
    elif n == "choice_question":
        p.drawEllipse(QPointF(6, 7), 2.3, 2.3)
        p.drawEllipse(QPointF(6, 17), 2.3, 2.3)
        p.setBrush(color)
        p.drawEllipse(QPointF(6, 7), 1, 1)
        p.setBrush(Qt.BrushStyle.NoBrush)
        path((11, 7), (20, 7))
        path((11, 17), (20, 17))
    elif n == "true_false":
        path((3.5, 12), (6.5, 15), (11, 9))
        path((14, 9), (20, 15))
        path((20, 9), (14, 15))
    elif n == "open_question":
        path((4, 19), (20, 19))
        path((14.5, 4.5), (18.5, 8.5), (9.5, 17.5), (5.5, 17.5), (5.5, 13.5), close=True)
    elif n == "divider":
        path((3, 12), (21, 12))
        path((7, 7), (17, 7))
        path((7, 17), (17, 17))
    elif n == "page_break":
        path((6, 3), (18, 3), (18, 9))
        path((6, 3), (6, 9))
        path((6, 15), (6, 21), (18, 21), (18, 15))
        pen2 = QPen(color, pen.widthF(), Qt.PenStyle.DashLine)
        p.setPen(pen2)
        path((3, 12), (21, 12))
    elif n == "copy":
        p.drawRoundedRect(QRectF(8, 8, 12, 12), 2.5, 2.5)
        path((16, 4.5), (6.5, 4.5), (4.5, 6.5), (4.5, 16))
    elif n == "check":
        path((4.5, 12.5), (9.5, 17.5), (19.5, 6.5))
    elif n == "external":
        path((13, 4), (20, 4), (20, 11))
        path((20, 4), (11, 13))
        path((17, 14), (17, 20), (4, 20), (4, 7), (10, 7))
    elif n == "upload":
        path((12, 16), (12, 5))
        path((7.5, 9.5), (12, 5), (16.5, 9.5))
        path((4, 19.5), (20, 19.5))
    elif n == "school":
        path((3, 9), (12, 4), (21, 9), (12, 14), close=True)
        path((7, 11), (7, 16.5), (12, 19), (17, 16.5), (17, 11))
    elif n == "moon":
        pp = QPainterPath(QPointF(19, 14.5))
        pp.cubicTo(QPointF(13, 17), QPointF(7, 11), QPointF(10, 4.5))
        pp.cubicTo(QPointF(4.5, 6), QPointF(3, 13), QPointF(7, 17.5))
        pp.cubicTo(QPointF(11, 21.5), QPointF(17.5, 20), QPointF(19, 14.5))
        p.drawPath(pp)
    elif n == "sun":
        p.drawEllipse(QPointF(12, 12), 4, 4)
        for k in range(8):
            a = k * math.pi / 4
            path((12 + 6.5 * math.cos(a), 12 + 6.5 * math.sin(a)), (12 + 8.8 * math.cos(a), 12 + 8.8 * math.sin(a)))
    elif n == "trash":
        path((4, 6.5), (20, 6.5))
        path((9, 6.5), (9, 4), (15, 4), (15, 6.5))
        path((6, 6.5), (7, 20), (17, 20), (18, 6.5))
    elif n == "up":
        path((6, 14), (12, 8), (18, 14))
    elif n == "down":
        path((6, 10), (12, 16), (18, 10))
    elif n == "undo":
        path((8, 5), (4, 9), (8, 13))
        pp = QPainterPath(QPointF(4, 9))
        pp.cubicTo(QPointF(14, 9), QPointF(20, 10), QPointF(20, 15))
        pp.cubicTo(QPointF(20, 18), QPointF(17, 19.5), QPointF(13, 19.5))
        p.drawPath(pp)
    elif n == "redo":
        path((16, 5), (20, 9), (16, 13))
        pp = QPainterPath(QPointF(20, 9))
        pp.cubicTo(QPointF(10, 9), QPointF(4, 10), QPointF(4, 15))
        pp.cubicTo(QPointF(4, 18), QPointF(7, 19.5), QPointF(11, 19.5))
        p.drawPath(pp)
    else:  # ponto genérico
        p.drawEllipse(QPointF(12, 12), 3, 3)
    p.restore()


# símbolos antigos -> ícones desenhados (usado pelos botões)
ICON_FOR_SYMBOL = {
    "✦": "sparkle", "⚙": "gear", "👁": "eye", "⤓": "download", "＋": "plus", "+": "plus", "⚡": "bolt", "📄": "file",
    "▦": "qr", "🔗": "link", "❏": "templates", "⧉": "copy", "✓": "check", "↗": "external", "⎋": "logout", "⤒": "upload",
    "📁": "folder", "🏫": "school", "✍": "open_question", "←": "back", "↶": "undo", "↷": "redo", "↑": "up", "↓": "down", "🗑": "trash", "✕": "trash",
}
ART_FOR_SYMBOL = {"✦": "ia", "📘": "apostila", "📝": "lista", "🧾": "prova", "▦": "qr", "🔗": "link", "📄": "arquivo",
                  "❏": "modelos", "✓": "lista", "↺": "ia", "＋": "branco", "🔒": "seguranca", "✎": "lista", "W": "arquivo",
                  "⏱": "seguranca", "⚖": "seguranca", "1": "branco", "2": "modelos", "3": "pdf"}


def icon(name: str, color: str | None = None, size: int = 20) -> QIcon:
    pm = QPixmap(size * 2, size * 2)
    pm.setDevicePixelRatio(2)
    pm.fill(Qt.GlobalColor.transparent)
    p = QPainter(pm)
    line_icon(p, QRectF(0, 0, size, size), name, QColor(color or theme.TEXT_DIM))
    p.end()
    return QIcon(pm)


class ArtIcon(QWidget):
    """Ilustração com animação de 'pulo' ao passar o mouse (set_hover é chamado pelo cartão pai)."""

    def __init__(self, name: str, size: int = 48, kind: str = "illustration", parent=None):
        super().__init__(parent)
        self.name, self.kind = name, kind
        self.setFixedSize(QSize(size + 6, size + 6))
        self._h = 0.0
        from aulaviva.ui.widgets import Motion

        self._a = QVariantAnimation(self, duration=Motion.ms(260), easingCurve=QEasingCurve.Type.OutBack)
        self._a.valueChanged.connect(lambda v: (setattr(self, "_h", float(v)), self.update()))

    def set_hover(self, on: bool):
        self._a.stop()
        self._a.setStartValue(self._h)
        self._a.setEndValue(1.0 if on else 0.0)
        self._a.start()

    def paintEvent(self, e):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        s = self.width() - 6
        scale = 1.0 + 0.08 * self._h
        p.translate(self.width() / 2, self.height() / 2 - 2 * self._h)
        p.rotate(-4 * self._h)
        p.scale(scale, scale)
        r = QRectF(-s / 2, -s / 2, s, s)
        if self.kind == "illustration":
            illustration(p, r, self.name)
        else:  # ícone de traço sobre fundo suave
            p.setPen(Qt.PenStyle.NoPen)
            p.setBrush(QColor(theme.PRIMARY_SOFT))
            p.drawRoundedRect(r, s * 0.28, s * 0.28)
            line_icon(p, r.adjusted(s * 0.22, s * 0.22, -s * 0.22, -s * 0.22), self.name, QColor(theme.PRIMARY))
