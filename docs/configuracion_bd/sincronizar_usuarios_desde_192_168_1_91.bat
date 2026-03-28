@echo off
setlocal

set "ROOT=C:\xampp\htdocs\minimarket"
set "SERVER_DIR=%ROOT%\server"
set "NODE_EXE=C:\Program Files\nodejs\node.exe"

if not exist "%SERVER_DIR%\sync_users_from_remote.js" (
  echo No existe script: %SERVER_DIR%\sync_users_from_remote.js
  pause
  exit /b 1
)

if not exist "%NODE_EXE%" (
  set "NODE_EXE=node"
)

echo === Sincronizando usuarios/permisos desde 192.168.1.91 ===
echo.
cd /d "%SERVER_DIR%"
"%NODE_EXE%" sync_users_from_remote.js
echo.
pause
