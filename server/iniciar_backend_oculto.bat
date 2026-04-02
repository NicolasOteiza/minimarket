@echo off
setlocal EnableExtensions EnableDelayedExpansion

echo ==========================================
echo  Iniciar backend oculto (puerto 3001)
echo ==========================================
echo.

set "NODE_EXE=C:\Program Files\nodejs\node.exe"
set "APP_DIR=C:\xampp\htdocs\minimarket\server"
set "APP_JS=%APP_DIR%\server.js"
set "LOG_DIR=%APP_DIR%\logs"
set "OUT_LOG=%LOG_DIR%\backend-hidden-out.log"
set "ERR_LOG=%LOG_DIR%\backend-hidden-err.log"
set "PORT_PID="
set "STARTED_PID="
set "EXIT_CODE=0"

if not exist "%NODE_EXE%" (
  echo [ERROR] No se encontro node.exe en: "%NODE_EXE%"
  set "EXIT_CODE=1"
  goto :finish
)

if not exist "%APP_JS%" (
  echo [ERROR] No se encontro server.js en: "%APP_JS%"
  set "EXIT_CODE=1"
  goto :finish
)

if not exist "%LOG_DIR%" (
  mkdir "%LOG_DIR%"
)

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":3001 .*LISTENING"') do (
  set "PORT_PID=%%P"
  goto :already_running
)

echo Iniciando backend en segundo plano...
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ^
  "Start-Process -FilePath '%NODE_EXE%' -ArgumentList '%APP_JS%' -WorkingDirectory '%APP_DIR%' -WindowStyle Hidden -RedirectStandardOutput '%OUT_LOG%' -RedirectStandardError '%ERR_LOG%'"

if errorlevel 1 (
  echo [ERROR] No se pudo iniciar el backend oculto.
  set "EXIT_CODE=1"
  goto :finish
)

timeout /t 2 /nobreak >nul

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":3001 .*LISTENING"') do (
  set "STARTED_PID=%%P"
  goto :started_ok
)

echo [ERROR] El backend no quedo escuchando en el puerto 3001.
echo         Revisa logs:
echo         - %OUT_LOG%
echo         - %ERR_LOG%
set "EXIT_CODE=1"
goto :finish

:already_running
echo [INFO] El backend ya estaba ejecutandose en el puerto 3001 (PID %PORT_PID%).
goto :finish

:started_ok
echo [OK] Backend iniciado correctamente en modo oculto (PID !STARTED_PID!).
echo [INFO] Logs:
echo        - %OUT_LOG%
echo        - %ERR_LOG%

:finish
echo.
echo Presiona una tecla para cerrar...
pause >nul
exit /b %EXIT_CODE%
