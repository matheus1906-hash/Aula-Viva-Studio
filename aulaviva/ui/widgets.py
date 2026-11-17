"""Componentes visuais reutilizáveis com animações suaves."""

from __future__ import annotations

from typing import Callable

from PySide6.QtCore import (
    QEasingCurve, QEvent, QParallelAnimationGroup, QPoint, QPropertyAnimation, QRectF, QSize, Qt, QTimer,
    QVariantAnimation, Signal,
)
from PySide6.QtGui import QColor, QCursor, QLinearGradient, QPainter, QPainterPath, QPen
from PySide6.QtWidgets import (
    QAbstractButton, QCheckBox, QFrame, QGraphicsOpacityEffect, QHBoxLayout, QLabel, QLineEdit, QPushButton,
    QScrollArea, QSizePolicy, QStackedWidget, QVBoxLayout, QWidget,
)

from aulaviva.core.security import password_score
from aulaviva.ui import theme


class Motion:
    """Configuração global de animações (respeita 'reduzir animações')."""

    enabled = True

    @classmethod
    def ms(cls, value: int) -> int:
        return value if cls.enabled else 0


def label(text: str = "", role: str | None = None, wrap: bool = False) -> QLabel:
    lb = QLabel(text)
    if role:
        lb.setProperty("role", role)
    lb.setWordWrap(wrap)
    lb.setTextInteractionFlags(Qt.TextInteractionFlag.NoTextInteraction)
    return lb


def repolish(w: QWidget) -> None:
    w.style().unpolish(w)
    w.style().polish(w)


# ---------------------------------------------------------------------------
class GlassCard(QFrame):
    """Cartão branco com borda suave e sombra leve (estilo folha de papel)."""

    def __init__(self, parent=None, radius: int = 20, opacity: float = 0.07, padding: int = 24, strong: bool = False,
                 interactive: bool = False):
        super().__init__(parent)
        self.radius, self.opacity, self.strong, self.interactive = radius, opacity, strong, interactive
        self._h = 0.0
        if interactive:
            self.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
            self._ha = QVariantAnimation(self, duration=Motion.ms(200), easingCurve=QEasingCurve.Type.OutCubic)
            self._ha.valueChanged.connect(lambda v: (setattr(self, "_h", float(v)), self.update()))
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, False)
        self.lay = QVBoxLayout(self)
        self.lay.setContentsMargins(padding, padding, padding, padding)
        self.lay.setSpacing(12)

    def _hover(self, on: bool):
        if not self.interactive:
            return
        self._ha.stop()
        self._ha.setStartValue(self._h)
        self._ha.setEndValue(1.0 if on else 0.0)
        self._ha.start()
        from aulaviva.ui.art import ArtIcon

        for icon in self.findChildren(ArtIcon):
            icon.set_hover(on)

    def enterEvent(self, e):
        self._hover(True)
        super().enterEvent(e)

    def leaveEvent(self, e):
        self._hover(False)
        super().leaveEvent(e)

    def paintEvent(self, e):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        depth = 5 if self.strong else (5 if self.interactive else 3)
        r = QRectF(self.rect()).adjusted(depth, depth - 1, -depth, -depth - 1).translated(0, -2.5 * self._h)
        p.setPen(Qt.PenStyle.NoPen)
        for i in range(depth, 0, -1):  # sombra suave pintada (barata)
            p.setBrush(QColor(*theme.SHADOW, int(((9 if self.strong else 6) - i + 4 * self._h) * (3 if theme.is_dark() else 1))))
            p.drawRoundedRect(r.adjusted(-i, -i + 2, i, i + 2), self.radius + i, self.radius + i)
        p.setBrush(QColor(theme.SURFACE))
        border = QColor(theme.BORDER)
        if self._h:
            pc = QColor(theme.PRIMARY)
            border = QColor(int(border.red() + (pc.red() - border.red()) * self._h), int(border.green() + (pc.green() - border.green()) * self._h),
                            int(border.blue() + (pc.blue() - border.blue()) * self._h))
        p.setPen(QPen(border, 1 + 0.5 * self._h))
        p.drawRoundedRect(r, self.radius, self.radius)


class Button(QPushButton):
    """Botão com animação de cor no hover e leve 'pressão' ao clicar."""

    @staticmethod
    def styles() -> dict:
        """Cores calculadas na hora: acompanham o tema claro/escuro."""
        return {
            "primary": (QColor(theme.PRIMARY), QColor(theme.PRIMARY_2), QColor("white")),
            "secondary": (QColor(theme.SURFACE), QColor(theme.SURFACE), QColor(theme.TEXT)),
            "ghost": (QColor(0, 0, 0, 0), QColor(0, 0, 0, 0), QColor(theme.TEXT_DIM)),
            "soft": (QColor(theme.PRIMARY_SOFT), QColor(theme.PRIMARY_SOFT), QColor(theme.PRIMARY)),
            "danger": (QColor(theme.DANGER), QColor("#C2364F"), QColor("white")),
            "success": (QColor(theme.SUCCESS), QColor("#1F8F8A"), QColor("white")),
        }

    def __init__(self, text: str = "", kind: str = "primary", icon_text: str = "", parent=None, height: int = 42):
        super().__init__(text, parent)
        self.kind, self.icon_text = kind, icon_text
        self._hover = 0.0
        self._press = 0.0
        self.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        self.setMinimumHeight(height)
        self.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Fixed)
        self._anim = QVariantAnimation(self, duration=Motion.ms(180), easingCurve=QEasingCurve.Type.OutCubic)
        self._anim.valueChanged.connect(self._set_hover)
        self._panim = QVariantAnimation(self, duration=Motion.ms(110), easingCurve=QEasingCurve.Type.OutCubic)
        self._panim.valueChanged.connect(self._set_press)
        f = self.font()
        f.setWeight(f.Weight.DemiBold)
        self.setFont(f)

    def _set_hover(self, v):
        self._hover = float(v)
        self.update()

    def _set_press(self, v):
        self._press = float(v)
        self.update()

    def _animate(self, anim, start, end):
        anim.stop()
        anim.setDuration(Motion.ms(anim.duration() or 160))
        anim.setStartValue(start)
        anim.setEndValue(end)
        anim.start()

    def enterEvent(self, e):
        self._animate(self._anim, self._hover, 1.0)
        super().enterEvent(e)

    def leaveEvent(self, e):
        self._animate(self._anim, self._hover, 0.0)
        super().leaveEvent(e)

    def mousePressEvent(self, e):
        self._animate(self._panim, self._press, 1.0)
        super().mousePressEvent(e)

    def mouseReleaseEvent(self, e):
        self._animate(self._panim, self._press, 0.0)
        super().mouseReleaseEvent(e)

    def sizeHint(self):
        fm = self.fontMetrics()
        extra = 26 if self.icon_text else 0
        return QSize(fm.horizontalAdvance(self.text()) + 40 + extra, self.minimumHeight())

    def paintEvent(self, e):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        styles = self.styles()
        c1, c2, fg = styles.get(self.kind, styles["primary"])
        r = QRectF(self.rect()).adjusted(1, 1, -1, -1)
        shrink = self._press * 1.5
        r = r.adjusted(shrink, shrink, -shrink, -shrink)
        enabled = self.isEnabled()
        if self.kind in ("primary", "danger", "success"):
            g = QLinearGradient(r.topLeft(), r.topRight())
            g.setColorAt(0, c1.darker(100 + int(10 * self._hover)))
            g.setColorAt(1, c2.darker(100 + int(10 * self._hover)))
            p.setBrush(g)
            p.setPen(Qt.PenStyle.NoPen)
        elif self.kind == "secondary":
            p.setBrush(QColor(theme.HOVER) if self._hover > 0.5 else QColor(theme.SURFACE))
            border = QColor(theme.BORDER_STRONG)
            if self._hover:
                border = QColor(theme.PRIMARY).lighter(100 + int(60 * (1 - self._hover)))
            p.setPen(QPen(border, 1))
        elif self.kind == "soft":
            p.setBrush(QColor(theme.PRIMARY_SOFT).darker(100 + int(6 * self._hover)))
            p.setPen(Qt.PenStyle.NoPen)
        else:
            p.setBrush(QColor(47, 111, 237, int(20 * self._hover)))
            p.setPen(Qt.PenStyle.NoPen)
        if not enabled:
            p.setOpacity(0.45)
        p.drawRoundedRect(r, 11, 11)
        if self.hasFocus() and self.focusPolicy() != Qt.FocusPolicy.NoFocus:
            p.setBrush(Qt.BrushStyle.NoBrush)
            p.setPen(QPen(QColor(47, 111, 237, 120), 1.5))
            p.drawRoundedRect(r.adjusted(-1, -1, 1, 1), 12, 12)
        p.setPen(QColor(theme.PRIMARY) if self.kind == "ghost" and self._hover > 0.5 else fg)
        text = self.text()
        from aulaviva.ui.art import ICON_FOR_SYMBOL, line_icon

        drawn = ICON_FOR_SYMBOL.get(self.icon_text.strip()) if self.icon_text else None
        if not drawn and not self.icon_text and text.strip() in ICON_FOR_SYMBOL:
            drawn, text = ICON_FOR_SYMBOL[text.strip()], ""  # botões só com símbolo (↑ ↓ ⧉ 🗑 ↶ ↷)
        fm = self.fontMetrics()
        if drawn:
            isz = 17.0
            total = isz + (8 + fm.horizontalAdvance(text) if text else 0)
            x = r.center().x() - total / 2
            line_icon(p, QRectF(x, r.center().y() - isz / 2, isz, isz), drawn, p.pen().color())
            if text:
                p.drawText(QRectF(x + isz + 8, r.top(), total, r.height()), Qt.AlignmentFlag.AlignVCenter | Qt.AlignmentFlag.AlignLeft, text)
        elif self.icon_text:
            total = fm.horizontalAdvance(self.icon_text) + 8 + fm.horizontalAdvance(text) if text else fm.horizontalAdvance(self.icon_text)
            x = r.center().x() - total / 2
            p.drawText(QRectF(x, r.top(), total + 4, r.height()), Qt.AlignmentFlag.AlignVCenter | Qt.AlignmentFlag.AlignLeft,
                       f"{self.icon_text}  {text}" if text else self.icon_text)
        else:
            p.drawText(r, Qt.AlignmentFlag.AlignCenter, text)


class ProviderButton(Button):
    """Botão de login social com selo colorido do provedor."""

    COLORS = {"google": ("G", "#EA4335"), "microsoft": ("M", "#00A4EF"), "govbr": ("gov", "#1351B4")}

    def __init__(self, provider: str, text: str, parent=None):
        super().__init__(text, "secondary", parent=parent, height=44)
        self.provider = provider

    def paintEvent(self, e):
        super().paintEvent(e)
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        cy = self.height() / 2
        if self.provider == "google":  # "G" nas cores oficiais
            r, w = 9.0, 3.6
            rect = QRectF(24 - r, cy - r, 2 * r, 2 * r)
            for start, span, col in ((45, 105, "#EA4335"), (150, 62, "#FBBC05"), (212, 108, "#34A853"), (320, 40, "#4285F4")):
                pen = QPen(QColor(col), w)
                pen.setCapStyle(Qt.PenCapStyle.FlatCap)
                p.setPen(pen)
                p.drawArc(rect, start * 16, span * 16)
            p.setPen(Qt.PenStyle.NoPen)
            p.setBrush(QColor("#4285F4"))
            p.drawRect(QRectF(24, cy - w / 2, r + w / 2, w))
            return
        if self.provider == "microsoft":  # quatro quadrados
            for i, col in enumerate(("#F25022", "#7FBA00", "#00A4EF", "#FFB900")):
                p.fillRect(QRectF(15 + (i % 2) * 10, cy - 9.5 + (i // 2) * 10, 9, 9), QColor(col))
            return
        badge, col = self.COLORS[self.provider]
        r = QRectF(12, (self.height() - 24) / 2, 24 if len(badge) == 1 else 34, 24)
        p.setBrush(QColor(col))
        p.setPen(Qt.PenStyle.NoPen)
        p.drawRoundedRect(r, 7, 7)
        f = self.font()
        f.setPixelSize(12 if len(badge) == 1 else 10)
        f.setBold(True)
        p.setFont(f)
        p.setPen(QColor("white"))
        p.drawText(r, Qt.AlignmentFlag.AlignCenter, badge)


class LinkButton(QPushButton):
    def __init__(self, text: str, parent=None):
        super().__init__(text, parent)
        self.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        self.setFlat(True)
        self.setStyleSheet(f"QPushButton {{ color: {theme.PRIMARY}; background: transparent; border: 0; padding: 2px; font-weight: 600; }}"
                           f"QPushButton:hover {{ color: {theme.TEXT}; text-decoration: underline; }}")


# ---------------------------------------------------------------------------
class Field(QWidget):
    """Rótulo + entrada + mensagem de erro animada."""

    def __init__(self, title: str, widget: QWidget, required: bool = False, hint: str = ""):
        super().__init__()
        self.widget = widget
        lay = QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(5)
        lb = QLabel(f"{title}{' <span style=\"color:#D9822B\">*</span>' if required else ''}")
        lb.setTextFormat(Qt.TextFormat.RichText)
        lb.setStyleSheet(f"color: {theme.TEXT_DIM}; font-size: 13px; font-weight: 600;")
        lay.addWidget(lb)
        lay.addWidget(widget)
        self.err = label("", "error", wrap=True)
        self.err.setVisible(False)
        self.hint = label(hint, "muted", wrap=True) if hint else None
        if self.hint:
            lay.addWidget(self.hint)
        lay.addWidget(self.err)

    def set_error(self, msg: str | None) -> None:
        self.widget.setProperty("invalid", bool(msg))
        repolish(self.widget)
        self.err.setText(msg or "")
        self.err.setVisible(bool(msg))


def line_edit(placeholder: str = "", max_len: int = 200, echo_password: bool = False) -> QLineEdit:
    le = QLineEdit()
    le.setPlaceholderText(placeholder)
    le.setMaxLength(max_len)
    le.setMinimumHeight(40)
    if echo_password:
        le.setEchoMode(QLineEdit.EchoMode.Password)
        le.setInputMethodHints(Qt.InputMethodHint.ImhHiddenText | Qt.InputMethodHint.ImhNoPredictiveText | Qt.InputMethodHint.ImhSensitiveData)
    return le


class PasswordInput(QLineEdit):
    """Campo de senha com botão mostrar/ocultar; desativa copiar/arrastar."""

    def __init__(self, placeholder: str = "Senha"):
        super().__init__()
        self.setPlaceholderText(placeholder)
        self.setMaxLength(256)
        self.setMinimumHeight(40)
        self.setEchoMode(QLineEdit.EchoMode.Password)
        self.setDragEnabled(False)
        self.setContextMenuPolicy(Qt.ContextMenuPolicy.NoContextMenu)
        self.setInputMethodHints(Qt.InputMethodHint.ImhHiddenText | Qt.InputMethodHint.ImhSensitiveData | Qt.InputMethodHint.ImhNoPredictiveText)
        self._toggle = self.addAction(self._eye_icon(False), QLineEdit.ActionPosition.TrailingPosition)
        self._toggle.setToolTip("Mostrar senha")
        self._toggle.triggered.connect(self._flip)

    def _eye_icon(self, visible: bool):
        from PySide6.QtGui import QIcon, QPixmap

        pm = QPixmap(36, 36)
        pm.fill(Qt.GlobalColor.transparent)
        p = QPainter(pm)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        p.setPen(QPen(QColor(theme.TEXT_DIM), 2.4))
        path = QPainterPath()
        path.moveTo(4, 18)
        path.quadTo(18, 4, 32, 18)
        path.quadTo(18, 32, 4, 18)
        p.drawPath(path)
        p.drawEllipse(QRectF(13, 13, 10, 10))
        if visible:
            p.drawLine(6, 30, 30, 6)
        p.end()
        return QIcon(pm)

    def _flip(self):
        show = self.echoMode() == QLineEdit.EchoMode.Password
        self.setEchoMode(QLineEdit.EchoMode.Normal if show else QLineEdit.EchoMode.Password)
        self._toggle.setIcon(self._eye_icon(show))
        self._toggle.setToolTip("Ocultar senha" if show else "Mostrar senha")

    def keyPressEvent(self, e):
        from PySide6.QtGui import QKeySequence

        if e.matches(QKeySequence.StandardKey.Copy) or e.matches(QKeySequence.StandardKey.Cut):
            return  # impede copiar a senha para a área de transferência
        super().keyPressEvent(e)


class StrengthMeter(QWidget):
    LABELS = ["Muito fraca", "Fraca", "Razoável", "Boa", "Forte"]
    @property
    def COLORS(self):  # noqa: N802
        return [theme.DANGER, theme.DANGER, theme.WARNING, "#65A30D", theme.SUCCESS]

    def __init__(self):
        super().__init__()
        self.setFixedHeight(22)
        self._value = 0.0
        self._score = 0
        self._anim = QVariantAnimation(self, duration=Motion.ms(260), easingCurve=QEasingCurve.Type.OutCubic)
        self._anim.valueChanged.connect(lambda v: (setattr(self, "_value", float(v)), self.update()))

    def set_password(self, pw: str):
        self._score = password_score(pw)
        self._anim.stop()
        self._anim.setStartValue(self._value)
        self._anim.setEndValue(float(self._score) if pw else 0.0)
        self._anim.start()

    def paintEvent(self, e):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        w = self.width() - 90
        seg = (w - 12) / 4
        for i in range(4):
            r = QRectF(i * (seg + 4), 8, seg, 5)
            fill = max(0.0, min(1.0, self._value - i))
            p.setPen(Qt.PenStyle.NoPen)
            p.setBrush(QColor(theme.TRACK))
            p.drawRoundedRect(r, 2.5, 2.5)
            if fill > 0:
                p.setBrush(QColor(self.COLORS[self._score]))
                p.drawRoundedRect(QRectF(r.x(), r.y(), r.width() * fill, r.height()), 2.5, 2.5)
        p.setPen(QColor(self.COLORS[self._score]) if self._value > 0 else QColor(theme.TEXT_MUTED))
        f = self.font()
        f.setPixelSize(11)
        p.setFont(f)
        p.drawText(QRectF(w + 6, 0, 84, 22), Qt.AlignmentFlag.AlignVCenter | Qt.AlignmentFlag.AlignLeft,
                   self.LABELS[self._score] if self._value > 0 else "")


class ChipGroup(QWidget):
    """Seleção múltipla em formato de 'chips'."""

    changed = Signal()

    def __init__(self, options: list[str], columns: int = 3):
        super().__init__()
        from PySide6.QtWidgets import QGridLayout

        grid = QGridLayout(self)
        grid.setContentsMargins(0, 0, 0, 0)
        grid.setSpacing(6)
        self.boxes: list[QPushButton] = []
        for i, opt in enumerate(options):
            b = QPushButton(opt)
            b.setCheckable(True)
            b.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
            b.setStyleSheet(
                f"QPushButton {{ background: {theme.SURFACE}; border: 1px solid {theme.BORDER_STRONG}; border-radius: 15px;"
                f" padding: 6px 10px; color: {theme.TEXT_DIM}; }}"
                f"QPushButton:hover {{ border-color: {theme.PRIMARY}; }}"
                f"QPushButton:checked {{ background: {theme.PRIMARY_SOFT}; border-color: {theme.PRIMARY}; color: {theme.PRIMARY}; font-weight: 600; }}"
            )
            b.toggled.connect(self.changed)
            grid.addWidget(b, i // columns, i % columns)
            self.boxes.append(b)

    def selected(self) -> list[str]:
        return [b.text() for b in self.boxes if b.isChecked()]

    def set_selected(self, values: list[str]):
        for b in self.boxes:
            b.setChecked(b.text() in values)


# ---------------------------------------------------------------------------
class SmoothScrollArea(QScrollArea):
    """Rolagem com inércia suave (animada) na roda do mouse."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWidgetResizable(True)
        self.setFrameShape(QFrame.Shape.NoFrame)
        self.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        # Transparência só da área de rolagem (sem regra de estilo em cascata: ela "contaminava" a paleta dos
        # filhos e deixava listas suspensas e menus pretos no Windows)
        self.viewport().setAutoFillBackground(False)
        self.setAutoFillBackground(False)

    def setWidget(self, widget):
        widget.setAutoFillBackground(False)
        super().setWidget(widget)
        self._target = 0
        self._anim = QPropertyAnimation(self.verticalScrollBar(), b"value", self)
        self._anim.setEasingCurve(QEasingCurve.Type.OutCubic)
        self._anim.setDuration(320)

    def wheelEvent(self, e):
        if not Motion.enabled or e.angleDelta().y() == 0 or e.modifiers() & Qt.KeyboardModifier.ControlModifier:
            return super().wheelEvent(e)
        bar = self.verticalScrollBar()
        if self._anim.state() != QPropertyAnimation.State.Running:
            self._target = bar.value()
        self._target = max(bar.minimum(), min(bar.maximum(), self._target - int(e.angleDelta().y() * 1.1)))
        self._anim.stop()
        self._anim.setStartValue(bar.value())
        self._anim.setEndValue(self._target)
        self._anim.start()
        e.accept()


class AnimatedStack(QStackedWidget):
    """Troca de páginas: a página antiga esmaece (captura) enquanto a nova desliza.

    A página antiga vira uma imagem estática, então não há efeitos gráficos
    aninhados e o custo de renderização é mínimo.
    """

    def slide_to(self, widget: QWidget, direction: int = 1):
        if widget is self.currentWidget():
            return
        if self.indexOf(widget) < 0:
            self.addWidget(widget)
        old = self.currentWidget()
        if not Motion.enabled or old is None or not self.isVisible():
            self.setCurrentWidget(widget)
            return
        snap = QLabel(self)
        snap.setPixmap(old.grab())
        snap.setGeometry(old.geometry())
        self.setCurrentWidget(widget)
        snap.show()
        snap.raise_()
        effect = QGraphicsOpacityEffect(snap)
        snap.setGraphicsEffect(effect)
        group = QParallelAnimationGroup(self)
        fade = QPropertyAnimation(effect, b"opacity", group, duration=220, startValue=1.0, endValue=0.0)
        fade.setEasingCurve(QEasingCurve.Type.OutCubic)
        out = QPropertyAnimation(snap, b"pos", group, duration=260, startValue=snap.pos(), endValue=snap.pos() - QPoint(28 * direction, 0))
        out.setEasingCurve(QEasingCurve.Type.OutCubic)
        end = widget.pos()
        move = QPropertyAnimation(widget, b"pos", group, duration=340, startValue=end + QPoint(40 * direction, 0), endValue=end)
        move.setEasingCurve(QEasingCurve.Type.OutCubic)
        for a in (fade, out, move):
            group.addAnimation(a)
        group.finished.connect(snap.deleteLater)
        group.start(QPropertyAnimation.DeletionPolicy.DeleteWhenStopped)


def fade_in(widget: QWidget, duration: int = 300, delay: int = 0, rise: int = 14) -> None:
    """Entrada com esmaecimento e leve subida (usado em cartões e listas)."""
    if not Motion.enabled:
        return
    effect = QGraphicsOpacityEffect(widget)
    effect.setOpacity(0.0)
    widget.setGraphicsEffect(effect)

    def start():
        if widget.graphicsEffect() is not effect:
            return
        group = QParallelAnimationGroup(widget)
        a = QPropertyAnimation(effect, b"opacity", group, duration=duration, startValue=0.0, endValue=1.0)
        a.setEasingCurve(QEasingCurve.Type.OutCubic)
        group.addAnimation(a)
        if rise and widget.parentWidget() and widget.parentWidget().layout() is None:
            end = widget.pos()
            m = QPropertyAnimation(widget, b"pos", group, duration=duration, startValue=end + QPoint(0, rise), endValue=end)
            m.setEasingCurve(QEasingCurve.Type.OutCubic)
            group.addAnimation(m)
        group.finished.connect(lambda: widget.setGraphicsEffect(None))
        group.start(QPropertyAnimation.DeletionPolicy.DeleteWhenStopped)

    QTimer.singleShot(delay, widget, start)  # cancelado automaticamente se o widget for destruído


class Spinner(QWidget):
    def __init__(self, size: int = 36, parent=None):
        super().__init__(parent)
        self.setFixedSize(size, size)
        self._angle = 0
        self._timer = QTimer(self, interval=16, timeout=self._tick)

    def showEvent(self, e):
        self._timer.start()
        super().showEvent(e)

    def hideEvent(self, e):
        self._timer.stop()
        super().hideEvent(e)

    def _tick(self):
        self._angle = (self._angle + 6) % 360
        self.update()

    def paintEvent(self, e):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        r = QRectF(self.rect()).adjusted(4, 4, -4, -4)
        p.setPen(QPen(QColor(theme.TRACK), 4))
        p.drawEllipse(r)
        pen = QPen(QColor(theme.PRIMARY), 4)
        pen.setCapStyle(Qt.PenCapStyle.RoundCap)
        p.setPen(pen)
        p.drawArc(r, -self._angle * 16, 100 * 16)


# ---------------------------------------------------------------------------
class Toast(QLabel):
    """Notificação flutuante que aparece e some suavemente."""

    @classmethod
    def show_message(cls, parent: QWidget, text: str, kind: str = "info", ms: int = 3200):
        host = parent.window()
        t = cls(text, host)
        col = {"info": theme.PRIMARY, "success": theme.SUCCESS, "error": theme.DANGER, "warning": theme.WARNING}.get(kind, theme.PRIMARY)
        t.setWordWrap(True)
        t.setStyleSheet(f"QLabel {{ background: {theme.SURFACE}; border: 1px solid {theme.BORDER_STRONG}; border-left: 5px solid {col};"
                        f" border-radius: 10px; padding: 12px 16px; color: {theme.TEXT}; font-size: 14px; }}")
        t.setMaximumWidth(420)
        t.adjustSize()
        x = host.width() - t.width() - 24
        y_end = host.height() - t.height() - 24
        t.move(x, y_end + 30)
        t.show()
        t.raise_()
        eff = QGraphicsOpacityEffect(t)
        t.setGraphicsEffect(eff)
        grp = QParallelAnimationGroup(t)
        grp.addAnimation(QPropertyAnimation(eff, b"opacity", grp, duration=Motion.ms(220), startValue=0.0, endValue=1.0))
        mv = QPropertyAnimation(t, b"pos", grp, duration=Motion.ms(260), startValue=t.pos(), endValue=QPoint(x, y_end))
        mv.setEasingCurve(QEasingCurve.Type.OutCubic)
        grp.addAnimation(mv)
        grp.start()

        def fade_out():
            out = QPropertyAnimation(eff, b"opacity", t, duration=Motion.ms(300), startValue=1.0, endValue=0.0)
            out.finished.connect(t.deleteLater)
            out.start()

        QTimer.singleShot(ms, fade_out)


class Modal(QWidget):
    """Janela modal sobre o app: fundo desfocado + escurecido, cartão animado."""

    closed = Signal()

    def __init__(self, host: QWidget, width: int = 520, dismissable: bool = True):
        from aulaviva.ui.effects import blurred_snapshot

        self._host = host.window()
        super().__init__(self._host)
        self.dismissable = dismissable
        self._bg = blurred_snapshot(self._host)
        self.setGeometry(self._host.rect())
        self.card = GlassCard(self, radius=22, strong=True, padding=6)
        self.card.setFixedWidth(min(width, self._host.width() - 40))
        # Conteúdo rolável: janelas grandes continuam usáveis em telas de notebook
        self._scroll = SmoothScrollArea()
        self._inner = QWidget()
        self._inner.setAutoFillBackground(False)
        self.body = QVBoxLayout(self._inner)
        self.body.setContentsMargins(22, 22, 18, 22)
        self.body.setSpacing(12)
        self._scroll.setWidget(self._inner)
        self.card.lay.addWidget(self._scroll)
        self._host.installEventFilter(self)
        self.setFocusPolicy(Qt.FocusPolicy.StrongFocus)

    def eventFilter(self, obj, ev):
        if obj is self._host and ev.type() == QEvent.Type.Resize:
            self.setGeometry(self._host.rect())
            self._place()
        return False

    def _place(self, offset: int = 0):
        w = self.card.width() - 12
        content = (self.body.totalHeightForWidth(w) if self.body.hasHeightForWidth() else self.body.totalSizeHint().height()) + 14
        h = max(120, min(content, self.height() - 40))
        self.card.resize(self.card.width(), h)
        self.card.move((self.width() - self.card.width()) // 2, (self.height() - h) // 2 + offset)

    def open(self):
        self._place(24)
        self.show()
        self.raise_()
        self.setFocus()
        if Motion.enabled:
            eff = QGraphicsOpacityEffect(self)
            self.setGraphicsEffect(eff)
            grp = QParallelAnimationGroup(self)
            grp.addAnimation(QPropertyAnimation(eff, b"opacity", grp, duration=220, startValue=0.0, endValue=1.0))
            end = QPoint((self.width() - self.card.width()) // 2, (self.height() - self.card.height()) // 2)
            mv = QPropertyAnimation(self.card, b"pos", grp, duration=300, startValue=end + QPoint(0, 24), endValue=end)
            mv.setEasingCurve(QEasingCurve.Type.OutBack)
            grp.addAnimation(mv)
            grp.finished.connect(lambda: self.setGraphicsEffect(None))
            grp.start(QPropertyAnimation.DeletionPolicy.DeleteWhenStopped)
        else:
            self._place()

    def close_modal(self):
        def done():
            self._host.removeEventFilter(self)
            self.hide()
            self.closed.emit()
            self.deleteLater()

        if Motion.enabled:
            eff = QGraphicsOpacityEffect(self)
            self.setGraphicsEffect(eff)
            a = QPropertyAnimation(eff, b"opacity", self, duration=160, startValue=1.0, endValue=0.0)
            a.finished.connect(done)
            a.start()
        else:
            done()

    def paintEvent(self, e):
        p = QPainter(self)
        p.drawPixmap(0, 0, self._bg)

    def mousePressEvent(self, e):
        if self.dismissable and not self.card.geometry().contains(e.position().toPoint()):
            self.close_modal()

    def keyPressEvent(self, e):
        if e.key() == Qt.Key.Key_Escape and self.dismissable:
            self.close_modal()
        else:
            super().keyPressEvent(e)


def confirm(host: QWidget, title: str, text: str, ok_text: str, on_ok: Callable[[], None], danger: bool = False) -> Modal:
    m = Modal(host, 460)
    m.body.addWidget(label(title, "h2"))
    m.body.addWidget(label(text, "dim", wrap=True))
    row = QHBoxLayout()
    row.addStretch()
    cancel = Button("Cancelar", "ghost")
    ok = Button(ok_text, "danger" if danger else "primary")
    cancel.clicked.connect(m.close_modal)
    ok.clicked.connect(lambda: (m.close_modal(), on_ok()))
    row.addWidget(cancel)
    row.addWidget(ok)
    m.body.addSpacing(8)
    m.body.addLayout(row)
    m.open()
    return m


def hline() -> QFrame:
    f = QFrame()
    f.setFixedHeight(1)
    f.setStyleSheet(f"background: {theme.BORDER};")
    return f


def hbox(*widgets, spacing: int = 10, stretch_end: bool = False) -> QHBoxLayout:
    lay = QHBoxLayout()
    lay.setSpacing(spacing)
    lay.setContentsMargins(0, 0, 0, 0)
    for w in widgets:
        if w is None:
            lay.addStretch()
        elif isinstance(w, int):
            lay.addSpacing(w)
        elif isinstance(w, QHBoxLayout | QVBoxLayout):
            lay.addLayout(w)
        else:
            lay.addWidget(w)
    if stretch_end:
        lay.addStretch()
    return lay


def checkbox(text: str, checked: bool = False) -> QCheckBox:
    cb = QCheckBox(text)
    cb.setChecked(checked)
    cb.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
    return cb


__all__ = [
    "Motion", "GlassCard", "Button", "ProviderButton", "LinkButton", "Field", "line_edit", "PasswordInput",
    "StrengthMeter", "ChipGroup", "SmoothScrollArea", "AnimatedStack", "fade_in", "Spinner", "Toast", "Modal",
    "confirm", "label", "hline", "hbox", "checkbox", "QAbstractButton",
]
