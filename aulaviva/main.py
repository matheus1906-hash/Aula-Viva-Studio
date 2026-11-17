"""Ponto de entrada do AulaViva Studio."""

from __future__ import annotations

import logging
import logging.handlers
import os
import sys
import traceback


def _setup_logging() -> None:
    from aulaviva.core.config import log_dir

    handler = logging.handlers.RotatingFileHandler(log_dir() / "aulaviva.log", maxBytes=1_000_000, backupCount=3, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.addHandler(handler)
    # Bibliotecas HTTP podem registrar URLs/cabeçalhos: mantidas em WARNING
    for noisy in ("httpx", "httpx2", "anthropic", "urllib3"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def _selftest() -> int:
    """Verificação rápida do pacote: fonte embutida, PDF interativo e criptografia."""
    import io
    import secrets

    from pypdf import PdfReader

    from aulaviva.core.pdf_builder import build_pdf, fonts
    from aulaviva.core.projects import template_documents
    from aulaviva.core.security import Crypto

    f = fonts()
    pdf = build_pdf(template_documents()["Apostila de conteúdo"], skip_incomplete=True)
    fields = len(PdfReader(io.BytesIO(pdf)).get_fields() or {})
    c = Crypto(secrets.token_bytes(32))
    ok = f[0] == "AV" and fields > 0 and c.decrypt(c.encrypt("ok", "t"), "t") == "ok"
    print(f"fonte={f[0]} campos={fields} pdf={len(pdf)} bytes -> {'OK' if ok else 'FALHOU'}")
    return 0 if ok else 1


def main() -> int:
    if "--selftest" in sys.argv:
        return _selftest()
    if sys.platform.startswith("linux") and not os.environ.get("QT_QPA_PLATFORM") and not os.environ.get("DISPLAY") and not os.environ.get("WAYLAND_DISPLAY"):
        print("Nenhuma interface gráfica detectada.", file=sys.stderr)
        return 1
    if sys.platform == "win32":
        # Ícone próprio na barra de tarefas (em vez do ícone do Python)
        try:
            import ctypes

            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("AulaViva.Studio.1")
        except Exception:
            pass
    _setup_logging()
    log = logging.getLogger("aulaviva")

    from PySide6.QtCore import QLockFile, Qt
    from PySide6.QtGui import QFont, QGuiApplication
    from PySide6.QtWidgets import QApplication, QMessageBox

    from aulaviva import APP_NAME, ORG_NAME, __version__
    from aulaviva.core.config import Preferences, data_dir
    from aulaviva.core.database import Database
    from aulaviva.ui import theme
    from aulaviva.ui.main_window import MainWindow
    from aulaviva.ui.widgets import Motion

    QGuiApplication.setHighDpiScaleFactorRoundingPolicy(Qt.HighDpiScaleFactorRoundingPolicy.PassThrough)
    app = QApplication(sys.argv)
    app.setApplicationName(APP_NAME)
    app.setOrganizationName(ORG_NAME)
    app.setApplicationVersion(__version__)
    app.setStyle("Fusion")

    def excepthook(exc_type, exc, tb):
        log.error("Erro não tratado: %s", "".join(traceback.format_exception(exc_type, exc, tb)))
        QMessageBox.critical(None, APP_NAME, "Ocorreu um erro inesperado. Seus projetos salvos estão seguros.\n"
                                             "Detalhes técnicos foram registrados no log do aplicativo.")

    sys.excepthook = excepthook

    lock = QLockFile(str(data_dir() / "instance.lock"))
    lock.setStaleLockTime(0)
    if not lock.tryLock(100):
        QMessageBox.information(None, APP_NAME, f"O {APP_NAME} já está aberto.")
        return 0

    prefs = Preferences.load()
    theme.load_fonts()
    theme.set_mode(prefs.theme_mode)
    family = theme.pick_font_family()
    font = QFont(family, 10)
    font.setStyleStrategy(QFont.StyleStrategy.PreferAntialias)
    app.setFont(font)
    theme.apply_palette(app)
    app.setStyleSheet(theme.stylesheet(family))

    Motion.enabled = not prefs.reduce_motion
    db = Database()
    win = MainWindow(db, prefs)
    win.show()
    log.info("%s %s iniciado", APP_NAME, __version__)
    code = app.exec()
    db.close()
    lock.unlock()
    return code


if __name__ == "__main__":
    sys.exit(main())
