# Build no Windows (PowerShell):  powershell -ExecutionPolicy Bypass -File packaging\build_windows.ps1
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
py -3.12 -m venv .venv
.\.venv\Scripts\python -m pip install --upgrade pip
.\.venv\Scripts\pip install -r requirements-dev.txt
.\.venv\Scripts\python -m pytest -q
.\.venv\Scripts\python tools\make_icons.py
.\.venv\Scripts\pyinstaller packaging\aulaviva.spec --noconfirm --distpath dist --workpath build
if (Get-Command iscc -ErrorAction SilentlyContinue) { iscc packaging\installer.iss }
else { Write-Host "Inno Setup não encontrado: o app está em dist\AulaVivaStudio\AulaVivaStudio.exe" }
