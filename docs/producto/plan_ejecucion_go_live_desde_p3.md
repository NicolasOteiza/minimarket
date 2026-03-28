# Plan de Ejecucion Go-Live (Desde Punto 3)

## Alcance acordado
- Punto 1 (instalador): pendiente, fuera de este bloque.
- Punto 2 (facturacion electronica): queda para configuracion del administrador al vender.
- Se avanza desde punto 3 al 7.

## Punto 3 - Sesion/turno blindado
Objetivo: que no haya perdida de control de caja por vencimiento o transicion de dia.

Tareas:
1. Validar escenarios:
   - turno abierto + cambio de fecha
   - reconexion de red
   - token vencido con refresh valido
   - cierre de turno despues de reconexion
2. Matriz de pruebas de corte:
   - efectivo esperado vs declarado
   - tarjeta esperada vs declarada
   - ventas 0 en turno
3. Criterio de salida:
   - 0 bloqueos en inicio/cierre turno en pruebas repetidas.

## Punto 4 - Seguridad y operacion
Objetivo: operar con respaldo, auditoria y recuperacion controlada.

Tareas:
1. Definir politica de backup por cliente.
2. Ejecutar prueba de restauracion.
3. Activar canal formal de incidentes y bitacora.
4. Criterio de salida:
   - restauracion probada con evidencia.

## Punto 5 - Documentacion cliente (completado en formato Word)
Ruta: `docs/entrega_cliente/word`

Entregables:
- Propuesta comercial
- Planes y tarifas
- Contrato base licencia/servicios
- Anexo SLA
- Ficha de levantamiento
- Plan implementacion
- Manual cajero
- Manual administrador
- Acta entrega/aceptacion
- Politica respaldo/continuidad
- Terminos de garantia/exclusiones
- Checklist cierre de trato

## Punto 6 - Modelo comercial operativo
Objetivo: vender con proceso repetible.

Tareas:
1. Definir version oficial de precios por segmento.
2. Definir flujo comercial:
   - demo
   - propuesta
   - firma
   - implementacion
   - acta
3. Criterio de salida:
   - proceso documentado y aplicado en 1 cliente real.

## Punto 7 - QA final de salida
Objetivo: reducir riesgo operativo antes de cada nueva venta.

Tareas:
1. Checklist tecnico pre-entrega.
2. Checklist operativo por rol.
3. Evidencia minima por cliente:
   - venta
   - cierre turno
   - reporte
   - respaldo
4. Criterio de salida:
   - checklist 100% marcado y firmado.

