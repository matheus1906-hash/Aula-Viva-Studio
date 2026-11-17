# -*- mode: python ; coding: utf-8 -*-
# PyInstaller: pyinstaller packaging/aulaviva.spec --noconfirm
import sys
from pathlib import Path

from PyInstaller.utils.hooks import collect_submodules

ROOT = Path(SPECPATH).parent
is_win = sys.platform.startswith("win")

a = Analysis(
    [str(ROOT / "run.py")],
    pathex=[str(ROOT)],
    datas=[(str(ROOT / "aulaviva" / "assets"), "aulaviva/assets")],
    hiddenimports=["keyring.backends.Windows", "keyring.backends.SecretService", "_argon2_cffi_bindings"]
    + collect_submodules("reportlab.graphics.barcode"),
    excludes=[
        # módulos Qt não usados: instalador menor e menos superfície de ataque
        "PySide6.QtWebEngineCore", "PySide6.QtWebEngineWidgets", "PySide6.QtWebEngineQuick", "PySide6.Qt3DCore",
        "PySide6.QtQuick", "PySide6.QtQml", "PySide6.QtMultimedia", "PySide6.QtBluetooth", "PySide6.QtNetworkAuth",
        "PySide6.QtCharts", "PySide6.QtDataVisualization", "PySide6.QtSql", "PySide6.QtTest", "tkinter",
        "numpy", "scipy", "matplotlib", "pandas", "IPython", "pytest",
    ],
    noarchive=False,
)
# Remove bibliotecas Qt pesadas que não usamos (WebEngine, QML, 3D, multimídia)
_DROP = ("WebEngine", "Qt6Quick", "Qt6Qml", "Qt63D", "Qt6Multimedia", "Qt6Designer", "Qt6Charts", "Qt6DataVis",
         "Qt6Pdf" + "Quick", "Qt6ShaderTools", "Qt6Location", "Qt6VirtualKeyboard", "qtwebengine", "QtQuick", "Qt3D")
a.binaries = [b for b in a.binaries if not any(k.lower() in b[0].lower() for k in _DROP)]
a.datas = [d for d in a.datas if not any(k.lower() in d[0].lower() for k in ("webengine", "qml/", "translations/qtwebengine"))]
pyz = PYZ(a.pure)
exe = EXE(
    pyz, a.scripts, [],
    exclude_binaries=True,
    name="AulaVivaStudio",
    console=False,
    icon=str(ROOT / "aulaviva" / "assets" / ("icon.ico" if is_win else "icon.png")),
    version=str(ROOT / "packaging" / "version_info.txt") if is_win else None,
    upx=False,
)
coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=False, name="AulaVivaStudio")
