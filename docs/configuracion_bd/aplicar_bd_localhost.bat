@echo off
setlocal

set "ROOT=C:\xampp\htdocs\minimarket"
set "ENV_SERVER=%ROOT%\server\.env"
set "ENV_CLIENTE=%ROOT%\minimarket_cliente\server\.env"

echo === Aplicando configuracion BD localhost ===

for %%F in ("%ENV_SERVER%" "%ENV_CLIENTE%") do (
  if exist "%%~F" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-Content '%%~F') -replace '^DB_HOST=.*','DB_HOST=127.0.0.1' -replace '^DB_PORT=.*','DB_PORT=3306' -replace '^DB_NAME=.*','DB_NAME=minimarket' -replace '^DB_USER=.*','DB_USER=root' -replace '^DB_PASSWORD=.*','DB_PASSWORD=' | Set-Content '%%~F'"
    echo Actualizado: %%~F
  ) else (
    echo No existe: %%~F
  )
)

echo.
echo Listo. Reinicia backend local para tomar cambios.
pause
