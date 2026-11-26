#!/usr/bin/env bash
# Build no Linux: bash packaging/build_linux.sh  -> dist/AulaVivaStudio-linux-x86_64.tar.gz
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements-dev.txt
QT_QPA_PLATFORM=offscreen .venv/bin/python -m pytest -q
QT_QPA_PLATFORM=offscreen .venv/bin/python tools/make_icons.py
.venv/bin/pyinstaller packaging/aulaviva.spec --noconfirm --distpath dist --workpath build
cp packaging/aulaviva.desktop aulaviva/assets/icon.png packaging/install_linux.sh dist/AulaVivaStudio/
tar -C dist -czf dist/AulaVivaStudio-linux-x86_64.tar.gz AulaVivaStudio
echo "Pronto: dist/AulaVivaStudio-linux-x86_64.tar.gz"
