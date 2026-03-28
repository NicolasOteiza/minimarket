@echo off
setlocal

set "BASE_DIR=%~dp0"
if "%BASE_DIR:~-1%"=="\" set "BASE_DIR=%BASE_DIR:~0,-1%"
set "AUTO_START_SCRIPT=%BASE_DIR%\iniciar_cliente_local_auto.bat"
set "WATCHDOG_SCRIPT=%BASE_DIR%\verificar_cliente_local.bat"
set "TASK_START=MinimarketCliente_AutoInicio"
set "TASK_WATCHDOG=MinimarketCliente_Watchdog"

if not exist "%AUTO_START_SCRIPT%" (
  echo No se encontro: %AUTO_START_SCRIPT%
  pause
  exit /b 1
)

if not exist "%WATCHDOG_SCRIPT%" (
  echo No se encontro: %WATCHDOG_SCRIPT%
  pause
  exit /b 1
)

echo Creando tarea de auto inicio...
schtasks /Create /TN "%TASK_START%" /SC ONLOGON /TR "\"%AUTO_START_SCRIPT%\"" /F >nul
if errorlevel 1 (
  echo No se pudo crear la tarea de auto inicio.
  pause
  exit /b 1
)

echo Creando tarea watchdog (cada 1 minuto)...
schtasks /Create /TN "%TASK_WATCHDOG%" /SC MINUTE /MO 1 /TR "\"%WATCHDOG_SCRIPT%\"" /F >nul
if errorlevel 1 (
  echo No se pudo crear la tarea watchdog.
  pause
  exit /b 1
)

echo.
echo Auto inicio configurado correctamente.
echo - %TASK_START%
echo - %TASK_WATCHDOG%
echo.
pause
exit /b 0
