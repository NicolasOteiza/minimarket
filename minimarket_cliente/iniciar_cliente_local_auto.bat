@echo off
setlocal

set "BASE_DIR=%~dp0"
if "%BASE_DIR:~-1%"=="\" set "BASE_DIR=%BASE_DIR:~0,-1%"
set "SERVER_DIR=%BASE_DIR%\server"

if not exist "%SERVER_DIR%\server.js" (
  exit /b 1
)

call "%SERVER_DIR%\iniciar_backend_oculto.bat" >nul 2>&1
call "%SERVER_DIR%\iniciar_impresion_local.bat" >nul 2>&1

exit /b 0
