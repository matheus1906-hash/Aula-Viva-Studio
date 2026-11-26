@echo off
chcp 65001 >nul
title Gerando AulaVivaStudio.exe
cd /d "%~dp0"
set "PY="
for %%V in (3.12 3.13 3.11 3.10) do (
  if not defined PY ( py -%%V -c "import sys" >nul 2>&1 && set "PY=py -%%V" )
)
if not defined PY ( python -c "import sys" >nul 2>&1 && set "PY=python" )
if not defined PY ( echo Instale o Python 3.12 primeiro ^(veja ABRIR_AulaViva.bat^). & pause & exit /b 1 )

if not exist ".venv\Scripts\python.exe" ( %PY% -m venv .venv || goto :erro )
".venv\Scripts\python.exe" -m pip install --upgrade pip >nul
".venv\Scripts\python.exe" -m pip install -r requirements-dev.txt || goto :erro

echo.
echo [1/3] Rodando testes...
set QT_QPA_PLATFORM=offscreen
".venv\Scripts\python.exe" -m pytest -q || goto :erro
".venv\Scripts\python.exe" tools\make_icons.py || goto :erro
set QT_QPA_PLATFORM=

echo [2/3] Gerando executavel...
".venv\Scripts\pyinstaller.exe" packaging\aulaviva.spec --noconfirm --distpath dist --workpath build || goto :erro

echo Verificando o executavel gerado...
start "" /wait "dist\AulaVivaStudio\AulaVivaStudio.exe" --selftest
if errorlevel 1 ( echo O autoteste do executavel falhou. & goto :erro )
echo Autoteste OK.

echo [3/3] Instalador...
where iscc >nul 2>&1 && ( iscc packaging\installer.iss ) || (
  if exist "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe" ( "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe" packaging\installer.iss ) else (
    echo Inno Setup nao instalado: pulando o instalador. ^(Opcional: https://jrsoftware.org/isdl.php^)
  )
)
echo.
echo PRONTO!  Executavel: dist\AulaVivaStudio\AulaVivaStudio.exe
explorer "dist\AulaVivaStudio"
pause
exit /b 0
:erro
echo.
echo Falhou. Veja a mensagem acima.
pause
exit /b 1
