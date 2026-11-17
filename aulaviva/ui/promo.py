"""Vitrine animada (estilo propaganda) com amostras reais do próprio programa.

Mostra um notebook exibindo telas do app em sequência, páginas de PDF flutuando e selos com
os principais recursos. Leve: imagens pré-escaladas em cache e animação só enquanto visível.
"""

from __future__ import annotations

import math

from PySide6.QtCore import QPointF, QRectF, Qt, QTimer
from PySide6.QtGui import QColor, QFont, QLinearGradient, QPainter, QPainterPath, QPen, QPixmap
from PySide6.QtWidgets import QWidget

from aulaviva.core.config import resource_path
from aulaviva.ui import theme
from aulaviva.ui.art import illustration, line_icon

_CACHE: dict[str, QPixmap] = {}


def promo_pixmap(name: str) -> QPixmap:
    if name not in _CACHE:
        _CACHE[name] = QPixmap(str(resource_path(f"aulaviva/assets/promo/{name}")))
    return _CACHE[name]


SCENES = {
    "full": ["tela-editor.jpg", "tela-ia.jpg", "tela-modelos.jpg"],
    "editor": ["tela-editor.jpg"],
    "ia": ["tela-ia.jpg"],
    "modelos": ["tela-modelos.jpg"],
}
BADGES = {
    "full": [("qr", "QR codes clicáveis"), ("check", "Gabarito automático"), ("sparkle", "Criado com IA")],
    "editor": [("bolt", "Lista rápida de questões"), ("eye", "Prévia ao vivo")],
    "ia": [("sparkle", "Apostila em segundos"), ("file", "A partir do seu Word/PDF")],
    "modelos": [("templates", "30 modelos prontos"), ("download", "PDF aluno e professor")],
}


class PromoScene(QWidget):
    def __init__(self, mode: str = "full", parent=None):
        super().__init__(parent)
        self.mode = mode
        self.shots = [promo_pixmap(n) for n in SCENES.get(mode, SCENES["full"])]
        self.pages = [promo_pixmap(n) for n in ("pdf-capa.jpg", "pdf-lista.jpg", "pdf-roteiro.jpg")]
        self.t = 0.0
        self.idx = 0
        self.fade = 1.0
        self.setMinimumSize(360, 260)
        self._timer = QTimer(self, interval=40, timeout=self._tick)
        self._scaled: dict[tuple, QPixmap] = {}

    # animação ---------------------------------------------------------------
    def showEvent(self, e):
        from aulaviva.ui.widgets import Motion

        if Motion.enabled:
            self._timer.start()
        super().showEvent(e)

    def hideEvent(self, e):
        self._timer.stop()
        super().hideEvent(e)

    def _tick(self):
        self.t += 0.04
        if len(self.shots) > 1:
            cycle = 4.5
            phase = self.t % cycle
            new_idx = int(self.t // cycle) % len(self.shots)
            if new_idx != self.idx:
                self.idx = new_idx
            self.fade = min(1.0, phase / 0.6)
        self.update()

    def _px(self, pm: QPixmap, w: int, h: int) -> QPixmap:
        key = (pm.cacheKey(), w, h)
        if key not in self._scaled:
            if len(self._scaled) > 24:
                self._scaled.clear()
            self._scaled[key] = pm.scaled(w, h, Qt.AspectRatioMode.KeepAspectRatioByExpanding, Qt.TransformationMode.SmoothTransformation)
        return self._scaled[key]

    # desenho ----------------------------------------------------------------
    def _shadow(self, p: QPainter, r: QRectF, radius: float, strength: int = 26):
        p.setPen(Qt.PenStyle.NoPen)
        for i in range(6, 0, -1):
            p.setBrush(QColor(*theme.SHADOW, max(1, strength // 6) * (3 if theme.is_dark() else 1)))
            p.drawRoundedRect(r.adjusted(-i, -i + 6, i, i + 8), radius + i, radius + i)

    def _page(self, p: QPainter, pm: QPixmap, cx: float, cy: float, w: float, angle: float, bob: float):
        if pm.isNull():
            return
        h = w * 1.414
        p.save()
        p.translate(cx, cy + bob)
        p.rotate(angle)
        r = QRectF(-w / 2, -h / 2, w, h)
        self._shadow(p, r, 4, 30)
        p.drawPixmap(r.toRect(), self._px(pm, int(w), int(h)))
        p.setPen(QPen(QColor(0, 0, 0, 30), 1))
        p.setBrush(Qt.BrushStyle.NoBrush)
        p.drawRect(r)
        p.restore()

    def _badge(self, p: QPainter, x: float, y: float, icon: str, text: str):
        f = QFont(self.font())
        f.setPixelSize(13)
        f.setBold(True)
        p.setFont(f)
        tw = p.fontMetrics().horizontalAdvance(text)
        r = QRectF(x, y, tw + 50, 38)
        self._shadow(p, r, 19, 18)
        p.setPen(QPen(QColor(theme.BORDER), 1))
        p.setBrush(QColor(theme.SURFACE))
        p.drawRoundedRect(r, 19, 19)
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(QColor(theme.PRIMARY_SOFT))
        p.drawEllipse(QRectF(x + 6, y + 6, 26, 26))
        line_icon(p, QRectF(x + 11, y + 11, 16, 16), icon, QColor(theme.PRIMARY))
        p.setPen(QColor(theme.TEXT))
        p.drawText(QRectF(x + 40, y, tw + 8, 38), Qt.AlignmentFlag.AlignVCenter, text)

    def paintEvent(self, e):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        p.setRenderHint(QPainter.RenderHint.SmoothPixmapTransform)
        W, H = self.width(), self.height()
        t = self.t
        if self.mode == "seguranca":
            self._security(p, W, H)
            return
        # notebook
        lw = min(W * 0.84, (H * 0.80) * 1.55)
        lh = lw / 1.6
        lx, ly = (W - lw) / 2 - W * 0.02, (H - lh) / 2 - H * 0.04 + math.sin(t * 0.9) * 3
        screen = QRectF(lx, ly, lw, lh)
        self._shadow(p, screen, 14, 36)
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(QColor("#1F2937"))
        p.drawRoundedRect(screen, 14, 14)
        inner = screen.adjusted(lw * 0.022, lw * 0.022, -lw * 0.022, -lw * 0.03)
        p.save()
        clip = QPainterPath()
        clip.addRoundedRect(inner, 4, 4)
        p.setClipPath(clip)
        cur = self.shots[self.idx % len(self.shots)]
        prev = self.shots[(self.idx - 1) % len(self.shots)]
        if not prev.isNull() and self.fade < 1.0:
            p.drawPixmap(inner.toRect(), self._px(prev, int(inner.width()), int(inner.height())))
        if not cur.isNull():
            p.setOpacity(self.fade)
            p.drawPixmap(inner.toRect(), self._px(cur, int(inner.width()), int(inner.height())))
            p.setOpacity(1.0)
        p.restore()
        base = QPainterPath(QPointF(lx - lw * 0.06, ly + lh))
        base.lineTo(QPointF(lx + lw * 1.06, ly + lh))
        base.lineTo(QPointF(lx + lw * 1.0, ly + lh + lh * 0.06))
        base.lineTo(QPointF(lx, ly + lh + lh * 0.06))
        base.closeSubpath()
        g = QLinearGradient(0, ly + lh, 0, ly + lh * 1.06)
        g.setColorAt(0, QColor("#CBD5E1"))
        g.setColorAt(1, QColor("#94A3B8"))
        p.setBrush(g)
        p.drawPath(base)
        # páginas de PDF flutuando
        if self.mode in ("full", "modelos"):
            pw = lw * 0.25
            self._page(p, self.pages[2], lx + lw * 0.98, ly + lh * 0.18, pw * 0.85, 9, math.sin(t * 1.1 + 2) * 5)
            self._page(p, self.pages[0], lx + lw * 0.93, ly + lh * 0.72, pw, 6, math.sin(t * 1.3) * 6)
            self._page(p, self.pages[1], lx + lw * 0.02, ly + lh * 0.86, pw * 0.92, -8, math.sin(t * 1.2 + 1) * 6)
        # selos
        badges = BADGES.get(self.mode, [])
        spots = [(lx - lw * 0.08, ly + lh * 0.08), (lx + lw * 0.46, ly + lh * 0.98), (lx + lw * 0.70, ly - lh * 0.12)]
        for i, (icon, text) in enumerate(badges[:3]):
            bx, by = spots[i]
            self._badge(p, max(4, bx), max(4, min(H - 44, by + math.sin(t * 1.6 + i * 1.7) * 4)), icon, text)

    def _security(self, p: QPainter, W: int, H: int):
        t = self.t
        s = min(W, H) * 0.42
        cx, cy = W / 2, H / 2 - 10 + math.sin(t) * 4
        for i, a in enumerate((0.16, 0.10, 0.06)):
            col = QColor(theme.SUCCESS)
            col.setAlphaF(a)
            p.setPen(Qt.PenStyle.NoPen)
            p.setBrush(col)
            rr = min(s * (0.62 + 0.16 * (i + 1)), min(W, H) / 2 - 6) + math.sin(t * 1.5 + i) * 3
            p.drawEllipse(QPointF(cx, cy), rr, rr)
        illustration(p, QRectF(cx - s / 2, cy - s / 2, s, s), "seguranca")
        items = [("check", "Senhas com Argon2id"), ("eye", "Dados criptografados"), ("gear", "Bloqueio automático")]
        for i, (icon, text) in enumerate(items):
            ang = -math.pi / 2 + i * 2 * math.pi / 3 + 0.6
            bx = cx + math.cos(ang) * s * 0.95 - 80
            by = cy + math.sin(ang) * s * 0.85 - 19 + math.sin(t * 1.6 + i) * 4
            self._badge(p, max(4, min(W - 210, bx)), max(4, min(H - 44, by)), icon, text)
