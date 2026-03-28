# Multi-Sucursal - Fase 1 (Base Tecnica)

## Objetivo
Agregar soporte de hasta 3 sucursales activas sin romper el flujo actual de una sola sucursal.

## Cambios implementados (fase inicial)
- Tabla `sucursales` con sucursal principal por defecto.
- Tabla `system_business_limits` con limite base `max_sucursales = 3` y contacto `SIA`.
- Migracion de `cajas` para incluir `sucursal_id` (default = 1).
- Migracion de `ventas` para incluir `sucursal_id` (backfill desde caja).
- Migracion de `corte_caja` para incluir `sucursal_id` (backfill desde caja).
- Migracion de `device_caja_bindings` para incluir `sucursal_id`.
- Migracion de `user_auth_sessions` para incluir `sucursal_id`.

## API nueva
- `GET /api/sucursales/limits`
- `GET /api/sucursales`
- `POST /api/sucursales`
- `PUT /api/sucursales/:id`

## Reglas comerciales activas
- Maximo 3 sucursales activas.
- Si se intenta superar el limite:
  - respuesta `409`
  - mensaje indicando contacto con `SIA`.

## Compatibilidad
- Si no se envia `sucursal_id` en altas de caja, se asigna automaticamente `1`.
- El flujo actual sigue funcionando con sucursal principal.

## Pendiente (fase 2+)
- UI de administracion de sucursales.
- Filtros por sucursal en reportes y compras.
- Permisos por sucursal para usuarios/cajeros.
- Consolidado multi-sucursal para administradores.

