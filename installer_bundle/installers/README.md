# Instaladores offline (opcional)

Si el PC destino no tiene `winget` o no tiene internet, coloca aqui:

- `node-lts.msi`
- `xampp-installer.exe`

Rutas esperadas (config por defecto):
- `installer_bundle/installers/node-lts.msi`
- `installer_bundle/installers/xampp-installer.exe`

El instalador intenta primero `winget` y si falla usa estos archivos.

