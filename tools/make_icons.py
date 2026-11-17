"""Gera os ícones do aplicativo (PNG, ICO) a partir do logotipo vetorial."""
import os
import sys
from pathlib import Path

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from PIL import Image  # noqa: E402
from PySide6.QtWidgets import QApplication  # noqa: E402

from aulaviva.ui.effects import logo_pixmap  # noqa: E402

app = QApplication([])
out = ROOT / "aulaviva" / "assets"
out.mkdir(exist_ok=True)
logo_pixmap(512).save(str(out / "icon.png"))
img = Image.open(out / "icon.png")
img.save(out / "icon.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("Ícones gerados em", out)
