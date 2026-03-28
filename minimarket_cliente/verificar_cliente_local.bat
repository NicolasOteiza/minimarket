@echo off
setlocal

set "BASE_DIR=%~dp0"
if "%BASE_DIR:~-1%"=="\" set "BASE_DIR=%BASE_DIR:~0,-1%"
set "SERVER_DIR=%BASE_DIR%\server"
set "PID_3001="
set "PID_7357="

if not exist "%SERVER_DIR%\server.js" (
  exit /b 1
)

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":3001 .*LISTENING"') do (
  set "PID_3001=%%P"
  goto :check_print
)

call "%SERVER_DIR%\iniciar_backend_oculto.bat" >nul 2>&1

:check_print
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":7357 .*LISTENING"') do (
  set "PID_7357=%%P"
  goto :end
)

call "%SERVER_DIR%\iniciar_impresion_local.bat" >nul 2>&1

:end
exit /b 0
