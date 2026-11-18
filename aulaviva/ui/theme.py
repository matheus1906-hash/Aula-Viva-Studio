"""Paleta, tipografia e folha de estilos (QSS) - tema claro "sala de aula"."""

from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtGui import QColor, QFont, QFontDatabase, QPalette

from aulaviva.core.config import resource_path

# Duas paletas: clara (papel/caderno) e escura (lousa). set_mode() troca os valores abaixo.
LIGHT = dict(
    BG="#F4F6FB", SURFACE="#FFFFFF", SURFACE_ALT="#F7F9FD", HOVER="#F1F5FC", TRACK="#E5EAF2",
    BORDER="#E1E6EF", BORDER_STRONG="#C5CEDD", BORDER_HOVER="#98A6BE",
    TEXT="#111827", TEXT_DIM="#374151", TEXT_MUTED="#5F6B7E",
    PRIMARY="#2563EB", PRIMARY_2="#4F46E5", PRIMARY_SOFT="#E8F0FE",
    ACCENT="#F2A516", ACCENT_SOFT="#FFF6E0", SUCCESS="#15803D", DANGER="#DC2626", WARNING="#C2410C",
    INVALID_BG="#FFF5F5", PDF_BG="#E6EBF3", SHADOW=(30, 41, 59),
)
DARK = dict(
    BG="#0E1626", SURFACE="#172134", SURFACE_ALT="#1B273D", HOVER="#22304B", TRACK="#2A3754",
    BORDER="#27344F", BORDER_STRONG="#3A4A6B", BORDER_HOVER="#5A6E98",
    TEXT="#EEF2F9", TEXT_DIM="#C3CCDC", TEXT_MUTED="#97A3BA",
    PRIMARY="#5B8CF5", PRIMARY_2="#7C6CF2", PRIMARY_SOFT="#1E2C4D",
    ACCENT="#F5B83D", ACCENT_SOFT="#3A2E14", SUCCESS="#3DD68C", DANGER="#F87171", WARNING="#FB923C",
    INVALID_BG="#3A1D24", PDF_BG="#0B1220", SHADOW=(0, 0, 0),
)
MODE = "light"
globals().update(LIGHT)


def set_mode(mode: str) -> str:
    """'light', 'dark' ou 'system'. Retorna o modo efetivo aplicado."""
    global MODE
    if mode == "system":
        try:
            from PySide6.QtGui import QGuiApplication

            scheme = QGuiApplication.styleHints().colorScheme()
            mode = "dark" if scheme == Qt.ColorScheme.Dark else "light"
        except Exception:
            mode = "light"
    MODE = "dark" if mode == "dark" else "light"
    globals().update(DARK if MODE == "dark" else LIGHT)
    return MODE


def is_dark() -> bool:
    return MODE == "dark"


def load_fonts() -> None:
    """Registra as fontes de interface embutidas (Nunito para títulos, Nunito Sans para textos; licença OFL)."""
    folder = resource_path("aulaviva/assets/fonts/ui")
    for f in sorted([*folder.glob("*.ttf"), *folder.glob("*.otf")]) if folder.exists() else []:
        QFontDatabase.addApplicationFont(str(f))


HEADING_FAMILY = "Nunito"


def qcolor(hex_or_rgba: str, alpha: float | None = None) -> QColor:
    c = QColor(hex_or_rgba)
    if alpha is not None:
        c.setAlphaF(alpha)
    return c


def pick_font_family() -> str:
    families = set(QFontDatabase.families())
    for fam in ("Nunito Sans", "Segoe UI", "Ubuntu", "Cantarell", "Noto Sans", "DejaVu Sans"):
        if fam in families:
            return fam
    return QFont().defaultFamily()


def apply_palette(app) -> None:
    """Paleta clara para diálogos nativos, menus e calendários do Qt."""
    pal = QPalette()
    for role, col in (
        (QPalette.ColorRole.Window, BG), (QPalette.ColorRole.WindowText, TEXT), (QPalette.ColorRole.Base, SURFACE),
        (QPalette.ColorRole.AlternateBase, SURFACE_ALT), (QPalette.ColorRole.Text, TEXT), (QPalette.ColorRole.Button, SURFACE),
        (QPalette.ColorRole.ButtonText, TEXT), (QPalette.ColorRole.Highlight, PRIMARY), (QPalette.ColorRole.HighlightedText, "#FFFFFF"),
        (QPalette.ColorRole.ToolTipBase, SURFACE), (QPalette.ColorRole.ToolTipText, TEXT), (QPalette.ColorRole.PlaceholderText, TEXT_MUTED),
        (QPalette.ColorRole.Light, SURFACE_ALT), (QPalette.ColorRole.Mid, BORDER_STRONG), (QPalette.ColorRole.Dark, BORDER_STRONG),
        (QPalette.ColorRole.Link, PRIMARY),
    ):
        pal.setColor(role, QColor(col))
    app.setPalette(pal)


def _asset(name: str) -> str:
    return str(resource_path(f"aulaviva/assets/ui/{name}")).replace("\\", "/")


def stylesheet(family: str) -> str:
    head = HEADING_FAMILY if HEADING_FAMILY in QFontDatabase.families() else family
    arrow, check = _asset("arrow-down-dark.svg" if is_dark() else "arrow-down.svg"), _asset("check.svg")
    SCROLL, SCROLL_HOVER = ("rgba(255,255,255,0.18)", "rgba(255,255,255,0.32)") if is_dark() else ("rgba(30,41,59,0.20)", "rgba(30,41,59,0.36)")
    return f"""
* {{ font-family: "{family}"; color: {TEXT}; outline: 0; }}
QWidget {{ font-size: 14px; }}
QToolTip {{ background: {SURFACE}; color: {TEXT}; border: 1px solid {BORDER_STRONG}; padding: 6px 8px; border-radius: 6px; }}

QLabel {{ background: transparent; }}
QLabel[role="h1"] {{ font-family: "{head}"; font-size: 30px; font-weight: 800; color: {TEXT}; }}
QLabel[role="h2"] {{ font-family: "{head}"; font-size: 22px; font-weight: 800; color: {TEXT}; }}
QLabel[role="h3"] {{ font-size: 15px; font-weight: 700; color: {TEXT}; }}
QLabel[role="dim"] {{ color: {TEXT_DIM}; }}
QLabel[role="muted"] {{ color: {TEXT_MUTED}; font-size: 13px; }}
QLabel[role="error"] {{ color: {DANGER}; font-size: 13px; font-weight: 500; }}
QLabel[role="badge"] {{ background: {PRIMARY_SOFT}; color: {PRIMARY}; border-radius: 9px; padding: 3px 10px; font-size: 11px; font-weight: 700; }}
QLabel[role="link"] {{ color: {PRIMARY}; }}

QLineEdit, QPlainTextEdit, QTextEdit, QComboBox, QDateEdit, QSpinBox {{
    background: {SURFACE}; border: 1px solid {BORDER_STRONG}; border-radius: 9px;
    padding: 8px 11px; selection-background-color: {PRIMARY}; selection-color: white; font-size: 14px; color: {TEXT};
}}
QLineEdit:hover, QPlainTextEdit:hover, QComboBox:hover, QDateEdit:hover, QSpinBox:hover {{ border-color: {BORDER_HOVER}; }}
QLineEdit:focus, QPlainTextEdit:focus, QTextEdit:focus, QComboBox:focus, QDateEdit:focus, QSpinBox:focus {{
    border: 1.5px solid {PRIMARY}; background: {SURFACE};
}}
QLineEdit[invalid="true"], QComboBox[invalid="true"], QDateEdit[invalid="true"], QPlainTextEdit[invalid="true"] {{ border: 1.5px solid {DANGER}; background: {INVALID_BG}; }}
QLineEdit:disabled, QComboBox:disabled {{ color: {TEXT_MUTED}; background: {SURFACE_ALT}; }}
QComboBox::drop-down, QDateEdit::drop-down {{ border: 0; width: 28px; }}
QComboBox::down-arrow, QDateEdit::down-arrow {{ image: url("{arrow}"); width: 12px; height: 12px; }}
QComboBox {{ combobox-popup: 0; }}
QComboBox QAbstractItemView {{ background: {SURFACE}; color: {TEXT}; border: 1px solid {BORDER_STRONG}; selection-background-color: {PRIMARY_SOFT};
    selection-color: {TEXT}; padding: 4px; outline: 0; }}
QComboBox QAbstractItemView::item {{ min-height: 30px; padding: 2px 8px; color: {TEXT}; }}
QComboBox QAbstractItemView::item:hover, QComboBox QAbstractItemView::item:selected {{ background: {PRIMARY_SOFT}; color: {TEXT}; }}
QSpinBox::up-button, QSpinBox::down-button {{ width: 0; border: 0; }}

QCheckBox {{ spacing: 8px; color: {TEXT_DIM}; background: transparent; }}
QCheckBox::indicator {{ width: 18px; height: 18px; border-radius: 5px; border: 1.5px solid {BORDER_HOVER}; background: {SURFACE}; }}
QCheckBox::indicator:checked {{ background: {PRIMARY}; border-color: {PRIMARY}; image: url("{check}"); }}
QCheckBox::indicator:hover {{ border-color: {PRIMARY}; }}
QRadioButton {{ color: {TEXT_DIM}; spacing: 8px; background: transparent; }}
QRadioButton::indicator {{ width: 16px; height: 16px; border-radius: 10px; border: 2px solid {BORDER_HOVER}; background: {SURFACE}; }}
QRadioButton::indicator:hover {{ border-color: {PRIMARY}; }}
QRadioButton::indicator:checked {{ width: 8px; height: 8px; border: 6px solid {PRIMARY}; border-radius: 10px; background: {SURFACE}; }}

QScrollArea {{ border: 0; }}
QScrollBar:vertical {{ background: transparent; width: 10px; margin: 4px 2px; }}
QScrollBar::handle:vertical {{ background: {SCROLL}; border-radius: 3px; min-height: 40px; }}
QScrollBar::handle:vertical:hover {{ background: {SCROLL_HOVER}; }}
QScrollBar:horizontal {{ background: transparent; height: 10px; margin: 2px 4px; }}
QScrollBar::handle:horizontal {{ background: {SCROLL}; border-radius: 3px; min-width: 40px; }}
QScrollBar::add-line, QScrollBar::sub-line, QScrollBar::add-page, QScrollBar::sub-page {{ background: none; border: none; width: 0; height: 0; }}

QListWidget {{ background: transparent; border: 0; }}
QListWidget::item {{ background: {SURFACE}; border: 1px solid {BORDER}; border-radius: 9px; margin: 3px 2px; padding: 8px; color: {TEXT}; }}
QListWidget::item:hover {{ background: {HOVER}; }}
QListWidget::item:selected {{ background: {PRIMARY_SOFT}; border-color: {PRIMARY}; color: {TEXT}; }}

QSplitter::handle {{ background: transparent; }}
QSplitter::handle:hover {{ background: rgba(47,111,237,0.25); }}
QTabWidget::pane {{ border: 0; }}
QTabBar::tab {{ background: transparent; color: {TEXT_MUTED}; padding: 10px 16px; font-size: 14px; border-bottom: 2px solid transparent; font-weight: 600; }}
QTabBar::tab:selected {{ color: {PRIMARY}; border-bottom: 2px solid {PRIMARY}; }}
QTabBar::tab:hover {{ color: {TEXT}; }}
QMenu {{ background: {SURFACE}; color: {TEXT}; border: 1px solid {BORDER_STRONG}; padding: 6px; }}
QMenu::item {{ padding: 8px 18px; border-radius: 6px; color: {TEXT}; }}
QMenu::item:selected {{ background: {PRIMARY_SOFT}; color: {PRIMARY}; }}
QMenu::separator {{ height: 1px; background: {BORDER}; margin: 4px 8px; }}
QProgressBar {{ background: {TRACK}; border: 0; border-radius: 3px; height: 6px; }}
QProgressBar::chunk {{ border-radius: 3px; background: qlineargradient(x1:0,y1:0,x2:1,y2:0, stop:0 {PRIMARY}, stop:1 {PRIMARY_2}); }}
QPdfView {{ background: {PDF_BG}; border: 0; border-radius: 12px; }}
QCalendarWidget QWidget {{ background: {SURFACE}; color: {TEXT}; }}
"""
