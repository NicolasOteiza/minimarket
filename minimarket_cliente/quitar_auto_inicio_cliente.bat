@echo off
setlocal

set "TASK_START=MinimarketCliente_AutoInicio"
set "TASK_WATCHDOG=MinimarketCliente_Watchdog"

schtasks /Delete /TN "%TASK_START%" /F >nul 2>&1
schtasks /Delete /TN "%TASK_WATCHDOG%" /F >nul 2>&1

echo Tareas eliminadas (si existian):
echo - %TASK_START%
echo - %TASK_WATCHDOG%
echo.
pause
exit /b 0
