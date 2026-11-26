"""Fundo escolar desfocado, desfoque de imagens e logotipo.

Otimização: tudo que é pesado (desenho do fundo e desfoque) é calculado em
meia resolução, uma única vez por tamanho de janela, e mantido em cache.
"""

from __future__ import annotations

import math
import random

from PySide6.QtCore import QPointF, QRectF, QSize, Qt, QTimer
from PySide6.QtGui import (
    QBrush, QColor, QFont, QIcon, QImage, QLinearGradient, QPainter, QPainterPath, QPen, QPixmap,
    QRadialGradient,
)
from PySide6.QtWidgets import QGraphicsBlurEffect, QGraphicsPixmapItem, QGraphicsScene, QWidget

from aulaviva.ui import theme


def blur_image(img: QImage, radius: float) -> QImage:
    """Desfoque gaussiano via QGraphicsBlurEffect renderizado fora da tela."""
    scene = QGraphicsScene()
    item = QGraphicsPixmapItem(QPixmap.fromImage(img))
    effect = QGraphicsBlurEffect()
    effect.setBlurRadius(radius)
    effect.setBlurHints(QGraphicsBlurEffect.BlurHint.PerformanceHint)
    item.setGraphicsEffect(effect)
    scene.addItem(item)
    out = QImage(img.size(), QImage.Format.Format_ARGB32_Premultiplied)
    out.fill(Qt.GlobalColor.transparent)
    p = QPainter(out)
    scene.render(p, QRectF(out.rect()), QRectF(0, 0, img.width(), img.height()))
    p.end()
    return out


def blurred_snapshot(widget: QWidget, radius: float = 18, darken: float = 0.38) -> QPixmap:
    """Captura o widget, desfoca em baixa resolução e escurece (para modais)."""
    pm = widget.grab()
    small = pm.toImage().scaled(max(1, pm.width() // 4), max(1, pm.height() // 4),
                                Qt.AspectRatioMode.IgnoreAspectRatio, Qt.TransformationMode.SmoothTransformation)
    blurred = blur_image(small, radius / 4)
    result = QPixmap.fromImage(blurred.scaled(pm.size(), Qt.AspectRatioMode.IgnoreAspectRatio, Qt.TransformationMode.SmoothTransformation))
    p = QPainter(result)
    p.fillRect(result.rect(), QColor(22, 32, 54, int(255 * darken)))
    p.end()
    return result


def _draw_school_doodles(p: QPainter, w: int, h: int, seed: int = 7, dark: bool = False) -> None:
    """Rabiscos escolares (fórmulas, livros, lápis, átomos...): pastel no claro, giz no escuro."""
    rnd = random.Random(seed)
    if dark:
        inks = [QColor(255, 255, 255, 58), QColor(245, 184, 61, 70), QColor(120, 180, 255, 66), QColor(170, 140, 255, 60), QColor(110, 231, 183, 50)]
    else:
        inks = [QColor(47, 111, 237, 46), QColor(242, 165, 22, 60), QColor(22, 163, 74, 40), QColor(124, 92, 230, 42), QColor(220, 53, 69, 34)]
    font = QFont("DejaVu Sans")
    formulas = ["a² + b² = c²", "E = mc²", "π ≈ 3,14", "H₂O", "x = (-b ± √Δ) / 2a", "ABC", "1 + 1 = 2", "F = m·a",
                "∑", "√2", "Δ = b² - 4ac", "θ", "7 × 8 = 56", "Olá, turma!", "½ + ¼", "CO₂"]
    cell = max(170, int(min(w, h) / 3.6))
    cols, rows = max(1, w // cell + 1), max(1, h // cell + 1)
    for r in range(rows):
        for c in range(cols):
            if rnd.random() < 0.28:
                continue
            cx = c * cell + rnd.uniform(0.15, 0.85) * cell
            cy = r * cell + rnd.uniform(0.15, 0.85) * cell
            col = rnd.choice(inks)
            pen = QPen(col, rnd.uniform(1.4, 2.4))
            pen.setCapStyle(Qt.PenCapStyle.RoundCap)
            p.setPen(pen)
            p.setBrush(Qt.BrushStyle.NoBrush)
            kind = rnd.randint(0, 8)
            s = cell * rnd.uniform(0.22, 0.36)
            p.save()
            p.translate(cx, cy)
            p.rotate(rnd.uniform(-14, 14))
            if kind <= 2:
                font.setPointSizeF(s * 0.2)
                font.setItalic(rnd.random() < 0.5)
                p.setFont(font)
                p.drawText(QPointF(-s, 0), rnd.choice(formulas))
            elif kind == 3:  # livro aberto
                path = QPainterPath()
                path.moveTo(0, -s * 0.3)
                path.cubicTo(-s * 0.3, -s * 0.45, -s * 0.7, -s * 0.4, -s * 0.8, -s * 0.3)
                path.lineTo(-s * 0.8, s * 0.35)
                path.cubicTo(-s * 0.6, s * 0.25, -s * 0.3, s * 0.3, 0, s * 0.4)
                path.cubicTo(s * 0.3, s * 0.3, s * 0.6, s * 0.25, s * 0.8, s * 0.35)
                path.lineTo(s * 0.8, -s * 0.3)
                path.cubicTo(s * 0.7, -s * 0.4, s * 0.3, -s * 0.45, 0, -s * 0.3)
                path.lineTo(0, s * 0.4)
                p.drawPath(path)
            elif kind == 4:  # lápis
                p.drawRect(QRectF(-s * 0.6, -s * 0.09, s, s * 0.18))
                tip = QPainterPath()
                tip.moveTo(s * 0.4, -s * 0.09)
                tip.lineTo(s * 0.62, 0)
                tip.lineTo(s * 0.4, s * 0.09)
                p.drawPath(tip)
                p.drawLine(QPointF(-s * 0.45, -s * 0.09), QPointF(-s * 0.45, s * 0.09))
            elif kind == 5:  # átomo
                for ang in (0, 60, 120):
                    p.save()
                    p.rotate(ang)
                    p.drawEllipse(QRectF(-s * 0.5, -s * 0.18, s, s * 0.36))
                    p.restore()
                p.setBrush(col)
                p.drawEllipse(QPointF(0, 0), s * 0.06, s * 0.06)
            elif kind == 6:  # globo
                p.drawEllipse(QPointF(0, 0), s * 0.4, s * 0.4)
                p.drawEllipse(QRectF(-s * 0.18, -s * 0.4, s * 0.36, s * 0.8))
                p.drawLine(QPointF(-s * 0.4, 0), QPointF(s * 0.4, 0))
            elif kind == 7:  # régua
                p.drawRect(QRectF(-s * 0.7, -s * 0.1, s * 1.4, s * 0.2))
                for i in range(15):
                    x = -s * 0.65 + i * s * 0.093
                    p.drawLine(QPointF(x, -s * 0.1), QPointF(x, -s * 0.1 + (s * 0.1 if i % 5 == 0 else s * 0.05)))
            else:  # estrela de "muito bem!"
                star = QPainterPath()
                for i in range(10):
                    ang = math.pi / 2 + i * math.pi / 5
                    rad = s * (0.4 if i % 2 == 0 else 0.17)
                    pt = QPointF(math.cos(ang) * rad, -math.sin(ang) * rad)
                    star.moveTo(pt) if i == 0 else star.lineTo(pt)
                star.closeSubpath()
                p.drawPath(star)
            p.restore()


def render_school_background(size: QSize, seed: int = 7) -> QPixmap:
    """Claro: folha de caderno com pautas. Escuro: lousa com rabiscos de giz."""
    w, h = max(2, size.width() // 2), max(2, size.height() // 2)
    img = QImage(w, h, QImage.Format.Format_ARGB32_Premultiplied)
    p = QPainter(img)
    p.setRenderHint(QPainter.RenderHint.Antialiasing)
    if theme.is_dark():
        grad = QLinearGradient(0, 0, w, h)
        grad.setColorAt(0, QColor("#111C30"))
        grad.setColorAt(0.6, QColor("#0F1F26"))
        grad.setColorAt(1, QColor("#161532"))
        p.fillRect(img.rect(), grad)
        for cx, cy, rad, col in ((0.12, 0.15, 0.55, QColor(91, 140, 245, 55)), (0.9, 0.85, 0.6, QColor(124, 108, 242, 45))):
            rg = QRadialGradient(QPointF(w * cx, h * cy), max(w, h) * rad)
            rg.setColorAt(0, col)
            rg.setColorAt(1, QColor(0, 0, 0, 0))
            p.fillRect(img.rect(), rg)
        _draw_school_doodles(p, w, h, seed, dark=True)
        p.end()
        img = blur_image(img, 3)
        p = QPainter(img)
        p.fillRect(img.rect(), QColor(8, 12, 22, 70))
        p.end()
        return QPixmap.fromImage(img.scaled(size, Qt.AspectRatioMode.IgnoreAspectRatio, Qt.TransformationMode.SmoothTransformation))
    grad = QLinearGradient(0, 0, w, h)
    grad.setColorAt(0, QColor("#F8FAFE"))
    grad.setColorAt(1, QColor("#EEF2FA"))
    p.fillRect(img.rect(), grad)
    for cx, cy, rad, col in ((0.1, 0.1, 0.5, QColor(47, 111, 237, 22)), (0.92, 0.88, 0.55, QColor(242, 165, 22, 20))):
        rg = QRadialGradient(QPointF(w * cx, h * cy), max(w, h) * rad)
        rg.setColorAt(0, col)
        rg.setColorAt(1, QColor(0, 0, 0, 0))
        p.fillRect(img.rect(), rg)
    # pautas de caderno
    p.setPen(QPen(QColor(47, 111, 237, 18), 1))
    step = 15
    y = step * 3
    while y < h:
        p.drawLine(0, y, w, y)
        y += step
    p.setPen(QPen(QColor(220, 53, 69, 26), 1))
    p.drawLine(int(w * 0.06), 0, int(w * 0.06), h)
    _draw_school_doodles(p, w, h, seed)
    p.end()
    img = blur_image(img, 1.6)
    return QPixmap.fromImage(img.scaled(size, Qt.AspectRatioMode.IgnoreAspectRatio, Qt.TransformationMode.SmoothTransformation))


class SchoolBackground(QWidget):
    """Widget de fundo com cache e regeneração adiada ao redimensionar."""

    _cache: dict[tuple[int, int], QPixmap] = {}

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setAttribute(Qt.WidgetAttribute.WA_OpaquePaintEvent)
        self._pix: QPixmap | None = None
        self._timer = QTimer(self, singleShot=True, interval=160, timeout=self._regen)

    def _key(self):
        # Arredonda o tamanho para reaproveitar o cache durante o redimensionamento
        return (math.ceil(self.width() / 200) * 200, math.ceil(self.height() / 200) * 200, theme.MODE)

    def _regen(self):
        key = self._key()
        if key not in self._cache:
            if len(self._cache) > 4:
                self._cache.clear()
            self._cache[key] = render_school_background(QSize(key[0], key[1]))
        self._pix = self._cache[key]
        self.update()

    def resizeEvent(self, e):
        if self._pix is None:
            self._regen()
        else:
            self._timer.start()
        super().resizeEvent(e)

    def paintEvent(self, e):
        p = QPainter(self)
        if self._pix:
            p.drawPixmap(0, 0, self._pix)
        else:
            p.fillRect(self.rect(), QColor(theme.BG))


def draw_logo(p: QPainter, rect: QRectF) -> None:
    """Logotipo: livro aberto com faísca (ideia) sobre gradiente."""
    p.save()
    p.setRenderHint(QPainter.RenderHint.Antialiasing)
    s = min(rect.width(), rect.height())
    r = QRectF(rect.center().x() - s / 2, rect.center().y() - s / 2, s, s)
    grad = QLinearGradient(r.topLeft(), r.bottomRight())
    grad.setColorAt(0, QColor(theme.PRIMARY))
    grad.setColorAt(1, QColor(theme.PRIMARY_2))
    p.setPen(Qt.PenStyle.NoPen)
    p.setBrush(QBrush(grad))
    p.drawRoundedRect(r, s * 0.26, s * 0.26)
    pen = QPen(QColor("white"), s * 0.065)
    pen.setJoinStyle(Qt.PenJoinStyle.RoundJoin)
    pen.setCapStyle(Qt.PenCapStyle.RoundCap)
    p.setPen(pen)
    p.setBrush(Qt.BrushStyle.NoBrush)
    cx, cy = r.center().x(), r.center().y() + s * 0.08
    book = QPainterPath()
    book.moveTo(cx, cy - s * 0.17)
    book.cubicTo(cx - s * 0.1, cy - s * 0.24, cx - s * 0.24, cy - s * 0.23, cx - s * 0.3, cy - s * 0.17)
    book.lineTo(cx - s * 0.3, cy + s * 0.17)
    book.cubicTo(cx - s * 0.22, cy + s * 0.12, cx - s * 0.1, cy + s * 0.13, cx, cy + s * 0.19)
    book.cubicTo(cx + s * 0.1, cy + s * 0.13, cx + s * 0.22, cy + s * 0.12, cx + s * 0.3, cy + s * 0.17)
    book.lineTo(cx + s * 0.3, cy - s * 0.17)
    book.cubicTo(cx + s * 0.24, cy - s * 0.23, cx + s * 0.1, cy - s * 0.24, cx, cy - s * 0.17)
    book.lineTo(cx, cy + s * 0.19)
    p.drawPath(book)
    # faísca
    p.setPen(Qt.PenStyle.NoPen)
    p.setBrush(QColor(theme.ACCENT))
    sx, sy, k = cx + s * 0.2, r.top() + s * 0.2, s * 0.11
    star = QPainterPath()
    star.moveTo(sx, sy - k)
    star.quadTo(sx, sy, sx + k, sy)
    star.quadTo(sx, sy, sx, sy + k)
    star.quadTo(sx, sy, sx - k, sy)
    star.quadTo(sx, sy, sx, sy - k)
    p.drawPath(star)
    p.restore()


def logo_pixmap(size: int) -> QPixmap:
    pm = QPixmap(size, size)
    pm.fill(Qt.GlobalColor.transparent)
    p = QPainter(pm)
    draw_logo(p, QRectF(0, 0, size, size))
    p.end()
    return pm


_APP_ICON: QIcon | None = None


def app_icon() -> QIcon:
    """Ícone do app em vários tamanhos (o Windows escolhe o certo para a barra de tarefas, Alt+Tab, etc.)."""
    global _APP_ICON
    if _APP_ICON is None:
        from aulaviva.core.config import resource_path

        icon = QIcon()
        ico = resource_path("aulaviva/assets/icon.ico")
        png = resource_path("aulaviva/assets/icon.png")
        for f in (ico, png):
            if f.exists():
                icon.addFile(str(f))
        for s in (16, 20, 24, 32, 40, 48, 64, 128, 256):
            icon.addPixmap(logo_pixmap(s))
        _APP_ICON = icon
    return _APP_ICON
