#!/usr/bin/env bash
# Instala para o usuário atual (sem sudo): ./install_linux.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/.local/opt/AulaVivaStudio"
mkdir -p "$DEST" "$HOME/.local/bin" "$HOME/.local/share/applications" "$HOME/.local/share/icons/hicolor/512x512/apps"
cp -r "$HERE"/. "$DEST"/
ln -sf "$DEST/AulaVivaStudio" "$HOME/.local/bin/AulaVivaStudio"
cp "$HERE/icon.png" "$HOME/.local/share/icons/hicolor/512x512/apps/aulaviva-studio.png"
sed "s|^Exec=.*|Exec=$DEST/AulaVivaStudio|" "$HERE/aulaviva.desktop" > "$HOME/.local/share/applications/aulaviva-studio.desktop"
echo "AulaViva Studio instalado. Procure por 'AulaViva' no menu de aplicativos."
