# Plan de Cierre Critico - 2026-03-07

## Objetivo
Cerrar los pendientes minimos para pasar de GO condicionado a GO definitivo sin afectar continuidad operativa de caja.

## Prioridad P0 (bloquea salida comercial masiva)

### P0-1 - QA funcional multi-dispositivo
- Alcance: Windows, Mac, iPad, Android.
- Criterio de cierre: matriz QA completa sin bug critico/alto abierto.
- Evidencia: `docs/producto/ejecucion_matriz_qa_2026-03-07_preliminar.md` actualizada a final.

### P0-2 - Piloto operativo 7 dias
- Alcance: operacion real con apertura/cierre, ventas, corte y reportes.
- Criterio de cierre: bitacora diaria completa + acta de cierre firmada.
- Evidencia: `docs/producto/bitacora_piloto_7_dias.md` + `docs/producto/acta_cierre_piloto.md`.

### P0-3 - Cierre de flujo sesion/turno
- Alcance: asegurar continuidad de turno sin perdida por token expirado.
- Criterio de cierre: revalidacion durante turnos largos (>= 14h) sin desajuste de caja.
- Evidencia: registro de pruebas con corte correcto en cierre.

## Prioridad P1 (mejora operativa/comercial)

### P1-1 - Scanner camara en moviles
- Alcance: flujo estable en Chrome Android y Safari iOS.
- Criterio de cierre: solicitud de permiso y lectura funcional en ambos.

### P1-2 - Compras y recepcion
- Alcance: crear orden, enviar correo, recibir pedido, cerrar recepcion.
- Criterio de cierre: ciclo completo ejecutado con al menos 2 ordenes reales.

### P1-3 - Exportes gerenciales
- Alcance: reportes descargables legibles para uso administrativo.
- Criterio de cierre: validacion en Excel cliente con formato correcto.

## Prioridad P2 (post salida)
- Monitoreo de errores por correo.
- Afinamiento de UI por resolucion.
- Ajustes menores de textos y accesibilidad.

## Secuencia recomendada (ejecutable)
1. Cerrar QA multi-dispositivo (P0-1).
2. Ejecutar piloto 7 dias (P0-2).
3. Validar turno largo y cierre exacto (P0-3).
4. Emitir GO/NO-GO final.
5. Pasar P1 como mejora continua controlada.

## Regla de salida
No pasar a venta masiva si existe al menos un pendiente P0 abierto.
