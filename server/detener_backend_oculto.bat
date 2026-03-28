@echo off
setlocal

set "FOUND=0"

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":3001 .*LISTENING"') do (
  set "FOUND=1"
  taskkill /PID %%P /F >nul 2>&1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*\\server.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1

if "%FOUND%"=="0" (
  echo No hay proceso escuchando en el puerto 3001.
) else (
  echo Procesos del backend detenidos.
)

exit /b 0
