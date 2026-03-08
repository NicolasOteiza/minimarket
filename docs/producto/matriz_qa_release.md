# Matriz QA para Release Comercial

## Entornos de prueba
- Windows 10/11 + Chrome.
- macOS + Chrome/Safari.
- iPad (horizontal) + Safari.
- Android + Chrome.

## Casos minimos por modulo

### Ventas
- Escanear por codigo.
- Buscar por nombre y seleccionar sugerencia.
- Editar cantidad en carrito (+/-).
- Cobrar con ticket y sin ticket.
- Reimprimir ultima venta.

### Productos
- Crear producto (con y sin proveedor, con y sin inventario).
- Modificar producto.
- Eliminar producto (bloqueo si inventario > 0).
- Departamento y proveedores.

### Inventario
- Cargar producto con inventario activo.
- Bloquear producto sin inventario activo.
- Reposicion (suma correcta a cantidad actual).

### Compras
- Crear orden.
- Enviar por correo y cerrar orden.
- Recibir pedido y cerrar recepcion.
- Ver solicitudes cerradas y pendientes.

### Corte
- Resumen sesion.
- Cierre con declaracion efectivo/tarjeta.
- Validacion sin ventas.

### Reportes
- Carga de graficos.
- Descarga detalle XLSX sin corrupcion.
- Validacion de filtros.

## Criterio de aprobacion
- 0 bloqueantes.
- 0 perdidas de datos.
- 0 errores de sesion durante flujo operativo.
