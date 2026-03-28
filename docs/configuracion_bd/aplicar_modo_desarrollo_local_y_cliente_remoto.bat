@echo off
setlocal

set "ROOT=C:\xampp\htdocs\minimarket"
set "ENV_SISTEMA=%ROOT%\server\.env"
set "ENV_CLIENTE=%ROOT%\minimarket_cliente\server\.env"

echo === Modo mixto ===
echo Sistema principal: localhost
echo Cliente local:     192.168.1.91
echo.

if exist "%ENV_SISTEMA%" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "(Get-Content '%ENV_SISTEMA%') -replace '^DB_HOST=.*','DB_HOST=127.0.0.1' -replace '^DB_PORT=.*','DB_PORT=3306' -replace '^DB_NAME=.*','DB_NAME=minimarket' -replace '^DB_USER=.*','DB_USER=root' -replace '^DB_PASSWORD=.*','DB_PASSWORD=' | Set-Content '%ENV_SISTEMA%'"
  echo Actualizado sistema: %ENV_SISTEMA%
) else (
  echo No existe sistema: %ENV_SISTEMA%
)

if exist "%ENV_CLIENTE%" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "(Get-Content '%ENV_CLIENTE%') -replace '^DB_HOST=.*','DB_HOST=192.168.1.91' -replace '^DB_PORT=.*','DB_PORT=3306' -replace '^DB_NAME=.*','DB_NAME=minimarket' -replace '^DB_USER=.*','DB_USER=minimarket_app' -replace '^DB_PASSWORD=.*','DB_PASSWORD=\"MiniM4rket#2026\"' | Set-Content '%ENV_CLIENTE%'"
  echo Actualizado cliente: %ENV_CLIENTE%
) else (
  echo No existe cliente: %ENV_CLIENTE%
)

echo.
echo Listo. Reinicia backend para tomar cambios.
pause
