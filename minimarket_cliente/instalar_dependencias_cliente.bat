@echo off
setlocal

set "BASE_DIR=%~dp0"
if "%BASE_DIR:~-1%"=="\" set "BASE_DIR=%BASE_DIR:~0,-1%"
set "SERVER_DIR=%BASE_DIR%\server"

if not exist "%SERVER_DIR%\package.json" (
  echo No se encontro package.json en:
  echo %SERVER_DIR%
  pause
  exit /b 1
)

pushd "%SERVER_DIR%" >nul
call npm install
set "EXIT_CODE=%ERRORLEVEL%"
popd >nul

if not "%EXIT_CODE%"=="0" (
  echo Error al instalar dependencias.
  pause
  exit /b %EXIT_CODE%
)

echo Dependencias instaladas correctamente.
pause
exit /b 0
