# Minimarket Cliente (Local + DB Servidor)

Este proyecto es una copia operativa para **cliente local**, separada del proyecto principal, pensada para:

- Ejecutar UI y backend en el equipo cliente.
- Conectarse a la **base de datos central del servidor**.
- Imprimir directo en la impresora local del cliente mediante `local_print_bridge`.

## 1) Ubicacion sugerida

Colocar la carpeta en XAMPP, por ejemplo:

- `C:\xampp\htdocs\minimarket_cliente\`

Si la dejas dentro de otra carpeta (por ejemplo `minimarket/minimarket_cliente`), la URL cambia segun esa ruta.

## 2) Estructura incluida

La carpeta ya incluye:

- Frontend PHP/JS/CSS (`index.php`, `content/`, `popup/`, `js/`, etc.).
- Backend Node (`server/server.js`).
- Bridge de impresion local (`server/local_print_bridge.js`).
- Scripts de inicio/parada del cliente.

## 3) Configurar conexion a BD servidor

Editar:

- `server/.env`

Campos clave:

- `DB_HOST`: IP o hostname del servidor MySQL.
- `DB_PORT`: normalmente `3306`.
- `DB_NAME`: base de datos (ej. `minimarket`).
- `DB_USER` y `DB_PASSWORD`: credenciales del usuario de aplicacion.
- `JWT_SECRET`: cambiar por una clave segura.

## 4) Instalar dependencias (si hace falta)

Ejecutar:

- `instalar_dependencias_cliente.bat`

## 5) Iniciar y detener

Iniciar servicios cliente (backend + bridge impresion):

- `iniciar_cliente_local.bat`

Detener servicios:

- `detener_cliente_local.bat`

## 6) URL de acceso

Segun carpeta en htdocs:

- `http://localhost/minimarket_cliente/`
- o `http://localhost/minimarket/minimarket_cliente/`

## 7) Impresion directa local

La impresion local usa puerto `7357` (bridge) y backend en `3001`.

- Si no imprime, revisa que ambos servicios esten arriba.
- Revisa logs en `server/logs/`.

## 8) Notas de red/seguridad

- Abrir MySQL solo para red interna/VPN.
- Usar usuario MySQL de minimo privilegio para la app.
- No publicar MySQL directamente a internet.
