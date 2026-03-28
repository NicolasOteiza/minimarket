@echo off
setlocal

set "NODE_EXE=C:\Program Files\nodejs\node.exe"
set "APP_DIR=C:\xampp\htdocs\minimarket\server"
set "APP_JS=%APP_DIR%\local_print_bridge.js"
set "LOG_DIR=%APP_DIR%\logs"
set "OUT_LOG=%LOG_DIR%\print-bridge-out.log"
set "ERR_LOG=%LOG_DIR%\print-bridge-err.log"
set "PORT_PID="

if not exist "%NODE_EXE%" (
  echo No se encontro node.exe en: "%NODE_EXE%"
  pause
  exit /b 1
)

if not exist "%APP_JS%" (
  echo No se encontro local_print_bridge.js en: "%APP_JS%"
  pause
  exit /b 1
)

if not exist "%LOG_DIR%" (
  mkdir "%LOG_DIR%"
)

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":7357 .*LISTENING"') do (
  set "PORT_PID=%%P"
  goto :already_running
)

powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ^
  "Start-Process -FilePath '%NODE_EXE%' -ArgumentList '%APP_JS%' -WorkingDirectory '%APP_DIR%' -WindowStyle Hidden -RedirectStandardOutput '%OUT_LOG%' -RedirectStandardError '%ERR_LOG%'"

echo Impresion local iniciada en segundo plano (puerto 7357).
exit /b 0

:already_running
echo La impresion local ya esta ejecutandose en el puerto 7357 (PID %PORT_PID%).
exit /b 0
