import os

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")


def test_dark_and_light_palettes_and_fonts():
    from PySide6.QtWidgets import QApplication

    app = QApplication.instance() or QApplication([])
    from aulaviva.ui import theme

    theme.load_fonts()
    assert theme.pick_font_family() == "Nunito Sans"
    from PySide6.QtGui import QFontDatabase
    assert "Nunito" in QFontDatabase.families()
    assert theme.set_mode("dark") == "dark" and theme.is_dark() and theme.SURFACE == theme.DARK["SURFACE"]
    css = theme.stylesheet("Inter")
    assert theme.DARK["TEXT"] in css and "arrow-down-dark" in css
    assert theme.set_mode("light") == "light" and theme.TEXT == theme.LIGHT["TEXT"]
    assert theme.set_mode("system") in ("light", "dark")
    theme.set_mode("light")
