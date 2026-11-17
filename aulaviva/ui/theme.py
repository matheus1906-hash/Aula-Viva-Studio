"""Paleta, tipografia e folha de estilos (QSS) - tema claro "sala de aula"."""

from __future__ import annotations

from PySide6.QtGui import QColor, QFont, QFontDatabase, QPalette

from aulaviva.core.config import resource_path

# Paleta clara inspirada em papel, caderno e lápis
BG = "#F4F6FB"
SURFACE = "#FFFFFF"
SURFACE_ALT = "#F7F9FD"
BORDER = "#E2E7F0"
BORDER_STRONG = "#CDD5E3"
TEXT = "#1E293B"
TEXT_DIM = "#4B5567"
TEXT_MUTED = "#8590A3"
PRIMARY = "#2F6FED"       # azul caneta
PRIMARY_2 = "#4C5FE0"
PRIMARY_SOFT = "#EAF1FF"
ACCENT = "#F2A516"        # amarelo lápis
ACCENT_SOFT = "#FFF6E0"
SUCCESS = "#16A34A"
DANGER = "#DC3545"
WARNING = "#D9822B"


def qcolor(hex_or_rgba: str, alpha: float | None = None) -> QColor:
    c = QColor(hex_or_rgba)
    if alpha is not None:
        c.setAlphaF(alpha)
    return c


def pick_font_family() -> str:
    families = set(QFontDatabase.families())
    for fam in ("Segoe UI Variable Text", "Segoe UI", "Inter", "Ubuntu", "Cantarell", "Noto Sans", "DejaVu Sans"):
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
        (QPalette.ColorRole.Link, PRIMARY),
    ):
        pal.setColor(role, QColor(col))
    app.setPalette(pal)


def _asset(name: str) -> str:
    return str(resource_path(f"aulaviva/assets/ui/{name}")).replace("\\", "/")


def stylesheet(family: str) -> str:
    arrow, check = _asset("arrow-down.svg"), _asset("check.svg")
    return f"""
* {{ font-family: "{family}"; color: {TEXT}; outline: 0; }}
QWidget {{ font-size: 13px; }}
QToolTip {{ background: {SURFACE}; color: {TEXT}; border: 1px solid {BORDER_STRONG}; padding: 6px 8px; border-radius: 6px; }}

QLabel {{ background: transparent; }}
QLabel[role="h1"] {{ font-size: 27px; font-weight: 700; color: {TEXT}; }}
QLabel[role="h2"] {{ font-size: 20px; font-weight: 700; color: {TEXT}; }}
QLabel[role="h3"] {{ font-size: 14px; font-weight: 650; color: {TEXT}; }}
QLabel[role="dim"] {{ color: {TEXT_DIM}; }}
QLabel[role="muted"] {{ color: {TEXT_MUTED}; font-size: 12px; }}
QLabel[role="error"] {{ color: {DANGER}; font-size: 12px; }}
QLabel[role="badge"] {{ background: {PRIMARY_SOFT}; color: {PRIMARY}; border-radius: 9px; padding: 3px 10px; font-size: 11px; font-weight: 700; }}
QLabel[role="link"] {{ color: {PRIMARY}; }}

QLineEdit, QPlainTextEdit, QTextEdit, QComboBox, QDateEdit, QSpinBox {{
    background: {SURFACE}; border: 1px solid {BORDER_STRONG}; border-radius: 9px;
    padding: 8px 11px; selection-background-color: {PRIMARY}; selection-color: white; font-size: 13px; color: {TEXT};
}}
QLineEdit:hover, QPlainTextEdit:hover, QComboBox:hover, QDateEdit:hover, QSpinBox:hover {{ border-color: #AEB9CC; }}
QLineEdit:focus, QPlainTextEdit:focus, QTextEdit:focus, QComboBox:focus, QDateEdit:focus, QSpinBox:focus {{
    border: 1.5px solid {PRIMARY}; background: #FFFFFF;
}}
QLineEdit[invalid="true"], QComboBox[invalid="true"], QDateEdit[invalid="true"], QPlainTextEdit[invalid="true"] {{ border: 1.5px solid {DANGER}; background: #FFF7F7; }}
QLineEdit:disabled, QComboBox:disabled {{ color: {TEXT_MUTED}; background: {SURFACE_ALT}; }}
QComboBox::drop-down, QDateEdit::drop-down {{ border: 0; width: 28px; }}
QComboBox::down-arrow, QDateEdit::down-arrow {{ image: url("{arrow}"); width: 12px; height: 12px; }}
QComboBox QAbstractItemView {{ background: {SURFACE}; border: 1px solid {BORDER_STRONG}; selection-background-color: {PRIMARY_SOFT};
    selection-color: {TEXT}; padding: 4px; border-radius: 8px; outline: 0; }}
QSpinBox::up-button, QSpinBox::down-button {{ width: 0; border: 0; }}

QCheckBox {{ spacing: 8px; color: {TEXT_DIM}; background: transparent; }}
QCheckBox::indicator {{ width: 18px; height: 18px; border-radius: 5px; border: 1.5px solid #B4BFD1; background: white; }}
QCheckBox::indicator:checked {{ background: {PRIMARY}; border-color: {PRIMARY}; image: url("{check}"); }}
QCheckBox::indicator:hover {{ border-color: {PRIMARY}; }}
QRadioButton {{ color: {TEXT_DIM}; spacing: 8px; background: transparent; }}
QRadioButton::indicator {{ width: 16px; height: 16px; border-radius: 9px; border: 1.5px solid #B4BFD1; background: white; }}
QRadioButton::indicator:hover {{ border-color: {PRIMARY}; }}
QRadioButton::indicator:checked {{ border: 5px solid {PRIMARY}; background: white; }}

QScrollArea, QScrollArea > QWidget > QWidget {{ background: transparent; border: 0; }}
QScrollBar:vertical {{ background: transparent; width: 10px; margin: 4px 2px; }}
QScrollBar::handle:vertical {{ background: rgba(30,41,59,0.18); border-radius: 3px; min-height: 40px; }}
QScrollBar::handle:vertical:hover {{ background: rgba(30,41,59,0.32); }}
QScrollBar:horizontal {{ background: transparent; height: 10px; margin: 2px 4px; }}
QScrollBar::handle:horizontal {{ background: rgba(30,41,59,0.18); border-radius: 3px; min-width: 40px; }}
QScrollBar::add-line, QScrollBar::sub-line, QScrollBar::add-page, QScrollBar::sub-page {{ background: none; border: none; width: 0; height: 0; }}

QListWidget {{ background: transparent; border: 0; }}
QListWidget::item {{ background: {SURFACE}; border: 1px solid {BORDER}; border-radius: 9px; margin: 3px 2px; padding: 8px; color: {TEXT}; }}
QListWidget::item:hover {{ background: {SURFACE_ALT}; }}
QListWidget::item:selected {{ background: {PRIMARY_SOFT}; border-color: {PRIMARY}; color: {TEXT}; }}

QSplitter::handle {{ background: transparent; }}
QSplitter::handle:hover {{ background: rgba(47,111,237,0.25); }}
QTabWidget::pane {{ border: 0; }}
QTabBar::tab {{ background: transparent; color: {TEXT_MUTED}; padding: 9px 16px; border-bottom: 2px solid transparent; font-weight: 600; }}
QTabBar::tab:selected {{ color: {PRIMARY}; border-bottom: 2px solid {PRIMARY}; }}
QTabBar::tab:hover {{ color: {TEXT}; }}
QMenu {{ background: {SURFACE}; border: 1px solid {BORDER_STRONG}; border-radius: 10px; padding: 6px; }}
QMenu::item {{ padding: 8px 18px; border-radius: 6px; color: {TEXT}; }}
QMenu::item:selected {{ background: {PRIMARY_SOFT}; color: {PRIMARY}; }}
QMenu::separator {{ height: 1px; background: {BORDER}; margin: 4px 8px; }}
QProgressBar {{ background: #E5EAF2; border: 0; border-radius: 3px; height: 6px; }}
QProgressBar::chunk {{ border-radius: 3px; background: qlineargradient(x1:0,y1:0,x2:1,y2:0, stop:0 {PRIMARY}, stop:1 {PRIMARY_2}); }}
QPdfView {{ background: #E8ECF4; border: 0; border-radius: 12px; }}
QCalendarWidget QWidget {{ background: {SURFACE}; color: {TEXT}; }}
"""
