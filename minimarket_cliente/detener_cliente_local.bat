@echo off
setlocal

set "BASE_DIR=%~dp0"
if "%BASE_DIR:~-1%"=="\" set "BASE_DIR=%BASE_DIR:~0,-1%"
set "SERVER_DIR=%BASE_DIR%\server"

if not exist "%SERVER_DIR%\server.js" (
  echo No se encontro el backend del cliente en:
  echo %SERVER_DIR%
  pause
  exit /b 1
)

echo.
echo === Deteniendo backend local (puerto 3001) ===
call "%SERVER_DIR%\detener_backend_oculto.bat"

echo.
echo === Deteniendo impresion local (puerto 7357) ===
call "%SERVER_DIR%\detener_impresion_local.bat"

echo.
echo Servicios cliente detenidos.
echo.
pause
exit /b 0
