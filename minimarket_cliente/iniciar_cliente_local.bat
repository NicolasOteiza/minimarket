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
echo === Iniciando backend local (puerto 3001) ===
call "%SERVER_DIR%\iniciar_backend_oculto.bat"

echo.
echo === Iniciando impresion local (puerto 7357) ===
call "%SERVER_DIR%\iniciar_impresion_local.bat"

echo.
echo Servicios cliente iniciados.
echo Abre en navegador la ruta donde dejaste esta carpeta en htdocs.
echo Ejemplo:
echo http://localhost/minimarket_cliente/
echo.
pause
exit /b 0
