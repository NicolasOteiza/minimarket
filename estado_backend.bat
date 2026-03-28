@echo off
setlocal

echo === Puerto 3001 ===
netstat -ano | findstr :3001
echo.
echo === Proceso asociado (si existe) ===
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":3001 .*LISTENING"') do (
  tasklist /FI "PID eq %%P"
)
echo.
pause

exit /b 0
