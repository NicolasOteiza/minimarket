@echo off
setlocal EnableExtensions EnableDelayedExpansion

echo ==========================================
echo  Detener backend oculto (puerto 3001)
echo ==========================================
echo.

set "FOUND=0"
set "REMAINING=0"
set "EXIT_CODE=0"
set "SEEN_PIDS=;"

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":3001 .*LISTENING"') do (
  if "!SEEN_PIDS:;%%P;=!"=="!SEEN_PIDS!" (
    set "SEEN_PIDS=!SEEN_PIDS!%%P;"
    set "FOUND=1"
    echo Intentando detener PID %%P...
    taskkill /PID %%P /F >nul 2>&1
    if errorlevel 1 (
      echo [ERROR] No se pudo detener PID %%P.
      set "EXIT_CODE=1"
    ) else (
      echo [OK] PID %%P detenido.
    )
  )
)

set "SEEN_PIDS=;"
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":3001 .*LISTENING"') do (
  if "!SEEN_PIDS:;%%P;=!"=="!SEEN_PIDS!" (
    set "SEEN_PIDS=!SEEN_PIDS!%%P;"
    set "REMAINING=1"
    echo [INFO] El puerto 3001 sigue activo con PID %%P.
  )
)

echo.
if "%FOUND%"=="0" (
  echo [INFO] No habia backend ejecutandose.
) else if "%REMAINING%"=="0" (
  echo [OK] Backend detenido correctamente.
) else (
  echo [ERROR] No se pudo detener completamente el backend.
  set "EXIT_CODE=1"
)

echo.
echo Presiona una tecla para cerrar...
pause >nul
exit /b %EXIT_CODE%
