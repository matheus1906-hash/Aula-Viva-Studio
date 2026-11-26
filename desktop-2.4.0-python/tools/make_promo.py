"""Gera as imagens promocionais (telas reais do app + páginas de PDF) usadas nas boas-vindas e no login.

Uso:  QT_QPA_PLATFORM=offscreen python tools/make_promo.py
"""
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "aulaviva" / "assets" / "promo"


def main():
    os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
    os.environ["AULAVIVA_DATA_DIR"] = tempfile.mkdtemp()
    os.environ["AULAVIVA_NO_KEYRING"] = "1"
    sys.path.insert(0, str(ROOT))
    from PySide6.QtCore import QBuffer, QByteArray, QEventLoop, QIODevice, QSize, Qt, QTimer
    from PySide6.QtGui import QColor, QFont, QImage, QPainter
    from PySide6.QtPdf import QPdfDocument
    from PySide6.QtWidgets import QApplication

    app = QApplication([])
    from aulaviva.ui import theme

    theme.load_fonts()
    theme.set_mode("light")
    fam = theme.pick_font_family()
    app.setFont(QFont(fam, 10))
    theme.apply_palette(app)
    app.setStyleSheet(theme.stylesheet(fam))
    from aulaviva.core.auth import Profile
    from aulaviva.core.config import Preferences
    from aulaviva.core.database import Database
    from aulaviva.core.pdf_builder import build_pdf
    from aulaviva.core.samples import sample_document
    from aulaviva.ui.main_window import MainWindow
    from aulaviva.ui.widgets import Modal, Motion

    Motion.enabled = False
    OUT.mkdir(parents=True, exist_ok=True)

    def wait(ms):
        loop = QEventLoop()
        QTimer.singleShot(ms, loop.quit)
        loop.exec()

    def save(img: QImage, name: str, width: int, quality: int = 84):
        img = img.scaledToWidth(width, Qt.TransformationMode.SmoothTransformation)
        img.save(str(OUT / name), "JPG" if name.endswith(".jpg") else "PNG", quality)
        print(name, (OUT / name).stat().st_size // 1024, "KB")

    Preferences.save = lambda self: None
    prefs = Preferences()
    prefs.first_run_done = True
    w = MainWindow(Database(), prefs)
    w.resize(1440, 860)
    w.show()
    user, _ = w.auth.register("ana@escola.com", "Giz&Lousa-2026x", Profile(
        full_name="Ana Souza", cpf="52998224725", birth_date="1985-04-10", phone="11987654321", institution="E.E. Machado de Assis",
        school_network="Pública estadual", role="Professor(a)", education_levels=["Ensino Médio"], subjects="Ciências",
        city="Campinas", state="SP"), True)
    w.on_login(user)
    w.shell.new_from_sample("sistema-solar")
    wait(3500)
    w.editor.select_block(2)
    wait(1500)
    save(w.grab().toImage(), "tela-editor.jpg", 1100)
    w.close_editor()
    wait(500)
    w.shell.new_material("prova", ai_mode=True)
    wait(800)
    save(w.grab().toImage(), "tela-ia.jpg", 1100)
    for m in w.findChildren(Modal):
        m.close_modal()
    wait(300)
    w.shell.navigate("templates")
    wait(9000)
    save(w.grab().toImage(), "tela-modelos.jpg", 1100)

    def page(key: str, index: int, name: str):
        buf = QBuffer()
        buf.setData(QByteArray(build_pdf(sample_document(key), preview=True)))
        buf.open(QIODevice.OpenModeFlag.ReadOnly)
        doc = QPdfDocument()
        doc.load(buf)
        raw = doc.render(index, QSize(620, 877))
        img = QImage(raw.size(), QImage.Format.Format_RGB32)
        img.fill(QColor("white"))
        p = QPainter(img)
        p.drawImage(0, 0, raw)
        p.end()
        save(img, name, 360)

    page("sistema-solar", 0, "pdf-capa.jpg")
    page("fracoes", 0, "pdf-lista.jpg")
    page("ciclo-agua", 2, "pdf-roteiro.jpg")


if __name__ == "__main__":
    main()
