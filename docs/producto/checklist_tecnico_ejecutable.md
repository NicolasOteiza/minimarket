# Checklist Técnico Ejecutable (Pre-Producción)

## Preparación
1. Levantar MySQL y Apache (XAMPP).
2. Levantar API Node (`server/server.js`).
3. Abrir sistema en navegador principal.

## Verificación Backend
- [ ] API responde en `http://<host>:3001`.
- [ ] Login responde correctamente.
- [ ] Tablas operativas creadas sin errores de columnas faltantes.
- [ ] No hay errores críticos en consola Node al iniciar.

## Verificación Frontend
- [ ] Carga de login sin errores JS.
- [ ] Carga de home sin errores JS.
- [ ] Persistencia de caja por equipo funciona.
- [ ] Logo del negocio visible en equipos remotos.

## Flujo Ventas
- [ ] Escaneo por código agrega producto.
- [ ] Búsqueda por nombre muestra sugerencias y agrega producto.
- [ ] Selección visual en carrito funciona.
- [ ] Cobro con ticket imprime.
- [ ] Reimpresión de última venta funciona.

## Flujo Inventario y Productos
- [ ] Crear producto con validaciones.
- [ ] Modificar producto sin errores de formulario.
- [ ] Eliminar bloqueado cuando inventario > 0.
- [ ] Reposición suma correctamente stock.

## Flujo Compras
- [ ] Crear orden y agregar productos.
- [ ] Enviar orden por correo y cierre de orden.
- [ ] Recepción con estados (verde/naranjo/rojo) funciona.

## Corte y Reportes
- [ ] Resumen de sesión correcto.
- [ ] Cierre de turno con efectivo/tarjeta correcto.
- [ ] Exportes XLSX abren sin advertencia de formato.

## Resiliencia
- [ ] Error frontend se reporta al backend.
- [ ] Error backend genera correo de alerta.
- [ ] Sesión/turno no pierde datos en operación normal.

## Criterio de aprobación
- 0 fallas bloqueantes.
- 0 pérdida de datos.
- 0 incoherencias entre ventas, corte y reportes.
