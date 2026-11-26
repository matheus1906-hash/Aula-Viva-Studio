@echo off
chcp 65001 >nul
title AulaViva Studio
cd /d "%~dp0"

rem ---- Procura um Python compativel (3.10 a 3.13) ----
set "PY="
for %%V in (3.12 3.13 3.11 3.10) do (
  if not defined PY ( py -%%V -c "import sys" >nul 2>&1 && set "PY=py -%%V" )
)
if not defined PY (
  python -c "import sys; exit(0 if (3,10)<=sys.version_info[:2]<=(3,13) else 1)" >nul 2>&1 && set "PY=python"
)
if not defined PY (
  echo.
  echo  Python 3.12 nao encontrado.
  echo  1. Baixe em https://www.python.org/downloads/release/python-31210/
  echo     ^(Windows installer 64-bit^)
  echo  2. Na primeira tela, MARQUE "Add python.exe to PATH".
  echo  3. Depois rode este arquivo novamente.
  echo.
  start "" "https://www.python.org/downloads/release/python-31210/"
  pause
  exit /b 1
)

rem ---- Primeira execucao: cria ambiente e instala dependencias ----
if not exist ".venv\Scripts\pythonw.exe" (
  echo Preparando o AulaViva Studio pela primeira vez. Isso leva alguns minutos...
  %PY% -m venv .venv || goto :erro
  ".venv\Scripts\python.exe" -m pip install --upgrade pip >nul
  ".venv\Scripts\python.exe" -m pip install -r requirements.txt || goto :erro
)

start "" ".venv\Scripts\pythonw.exe" run.py
exit /b 0

:erro
echo.
echo Ocorreu um erro na instalacao. Verifique sua conexao com a internet e tente de novo.
echo Se persistir, apague a pasta .venv e rode novamente.
pause
exit /b 1
