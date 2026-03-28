# Configuracion BD por entorno

Fecha de registro: 2026-03-25

## Estado actual en este PC (desarrollo local)

Los dos entornos quedaron apuntando a localhost:

1. `C:\xampp\htdocs\minimarket\server\.env`
2. `C:\xampp\htdocs\minimarket\minimarket_cliente\server\.env`

Valores actuales de BD:

- `DB_HOST=127.0.0.1`
- `DB_PORT=3306`
- `DB_NAME=minimarket`
- `DB_USER=root`
- `DB_PASSWORD=`

## Configuracion LAN (servidor remoto 192.168.1.91)

Cuando trabajes en red local del negocio (con servidor disponible), usar:

- `DB_HOST=192.168.1.91`
- `DB_PORT=3306`
- `DB_NAME=minimarket`
- `DB_USER=minimarket_app`
- `DB_PASSWORD="MiniM4rket#2026"`

Archivos de referencia:

1. `server_env_192.168.1.91.example`
2. `cliente_env_192.168.1.91.example`

## Scripts de cambio rapido

Para no editar manualmente cada vez:

1. `aplicar_bd_localhost.bat` (todo local)
2. `aplicar_bd_192_168_1_91.bat` (todo remoto)
3. `aplicar_modo_desarrollo_local_y_cliente_remoto.bat` (mixto)

Ambos actualizan:

1. `C:\xampp\htdocs\minimarket\server\.env`
2. `C:\xampp\htdocs\minimarket\minimarket_cliente\server\.env`

## Recomendacion para no editar archivos cada vez

Modo recomendado para tu caso:

1. Sistema principal (`minimarket`) en localhost
2. Cliente (`minimarket_cliente`) apuntando al servidor `192.168.1.91`

Usa:

1. `aplicar_modo_desarrollo_local_y_cliente_remoto.bat`

## Usuarios de produccion en PC local

Si en tu BD local faltan usuarios creados en produccion, no los crees a mano.
Usa el sincronizador:

1. `sincronizar_usuarios_desde_192_168_1_91.bat`

Este script sincroniza tablas:

1. `usuarios`
2. `cajero_permisos`

## Nota sobre frontend/API

No hay IP fija `192.168.1.91` hardcodeada en `js/`.
La API se calcula por host actual o por `localStorage['api_url']`.

Si hay restos de pruebas anteriores, limpiar en consola del navegador:

```js
localStorage.removeItem('api_url');
localStorage.removeItem('local_print_bridge_url');
location.reload();
```

## Nota de impresion local

La impresion local de tickets sigue en:

- `http://127.0.0.1:7357`

Esto es correcto para caja cliente en local.
