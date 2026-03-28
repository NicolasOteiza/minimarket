# Instalador Standalone Minimarket

Esta carpeta es independiente del codigo de la app.
Puedes copiarla fuera del proyecto y usarla para instalar todo en un equipo nuevo.

## Que hace
- Instala prerequisitos: Node.js LTS y XAMPP (via `winget`).
- Si `winget` falla/no existe, usa instaladores offline desde `installers/`.
- Despliega la app en `C:\xampp\htdocs\minimarket` desde un ZIP de payload.
- Crea la base de datos `minimarket`.
- Instala dependencias Node del backend.
- Configura inicio automatico de Apache/MySQL/Node backend.
- Ejecuta validaciones post-instalacion.
- Genera log de instalacion en `logs\install_YYYYMMDD_HHMMSS.log`.

## Estructura
- `run-install.ps1`: orquestador principal.
- `build-package.ps1`: genera el payload ZIP del sistema.
- `config/install.config.json`: parametros editables.
- `scripts/*.ps1`: pasos internos de instalacion.
- `payload/minimarket-app.zip`: paquete de la app (se crea con `build-package.ps1`).
- `inno/MinimarketSetup.iss`: plantilla de Inno Setup (opcional).

## Uso rapido
1. En el entorno de desarrollo, generar payload:
   - `powershell -ExecutionPolicy Bypass -File .\build-package.ps1`
2. (Opcional recomendado) actualizar instaladores offline a su version mas reciente:
   - `powershell -ExecutionPolicy Bypass -File .\build-package.ps1 -RefreshOfflineInstallers`
2. Copiar toda la carpeta `installer_bundle` a cualquier equipo.
3. Ejecutar como administrador:
   - `powershell -ExecutionPolicy Bypass -File .\run-install.ps1`

## Requisitos en equipo destino
- Windows 10/11
- Conexion a internet (si se usara `winget` para descargar Node/XAMPP)
- Permisos de administrador

## Modo offline recomendado
Si el cliente no tiene internet o falla `winget`, agrega antes de ejecutar:
- `installer_bundle\installers\node-lts.msi`
- `installer_bundle\installers\xampp-installer.exe`

Para descargarlos automaticamente (version actual):
- `powershell -ExecutionPolicy Bypass -File .\scripts\fetch-offline-installers.ps1`

## Desinstalar
- `powershell -ExecutionPolicy Bypass -File .\scripts\uninstall.ps1`
