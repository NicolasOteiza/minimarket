@echo off
setlocal

set "NODE_EXE=C:\Program Files\nodejs\node.exe"
set "APP_DIR=C:\xampp\htdocs\minimarket\server"
set "APP_JS=%APP_DIR%\server.js"
set "LOG_DIR=%APP_DIR%\logs"
set "OUT_LOG=%LOG_DIR%\backend-hidden-out.log"
set "ERR_LOG=%LOG_DIR%\backend-hidden-err.log"
set "PORT_PID="

if not exist "%NODE_EXE%" (
  echo No se encontro node.exe en: "%NODE_EXE%"
  pause
  exit /b 1
)

if not exist "%APP_JS%" (
  echo No se encontro server.js en: "%APP_JS%"
  pause
  exit /b 1
)

if not exist "%LOG_DIR%" (
  mkdir "%LOG_DIR%"
)

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":3001 .*LISTENING"') do (
  set "PORT_PID=%%P"
  goto :already_running
)

:start_backend
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ^
  "Start-Process -FilePath '%NODE_EXE%' -ArgumentList '%APP_JS%' -WorkingDirectory '%APP_DIR%' -WindowStyle Hidden -RedirectStandardOutput '%OUT_LOG%' -RedirectStandardError '%ERR_LOG%'"

exit /b 0

:already_running
echo El backend ya esta ejecutandose en el puerto 3001 (PID %PORT_PID%).
exit /b 0
