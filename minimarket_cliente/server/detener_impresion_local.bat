@echo off
setlocal

set "FOUND=0"

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":7357 .*LISTENING"') do (
  set "FOUND=1"
  taskkill /PID %%P /F >nul 2>&1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*\\local_print_bridge.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1

if "%FOUND%"=="0" (
  echo No hay servicio de impresion local ejecutandose en el puerto 7357.
) else (
  echo Servicio de impresion local detenido.
)

exit /b 0
