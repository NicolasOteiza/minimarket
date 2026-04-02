# Flujos De Trabajo (Operacion Del Sistema)

Este documento resume los flujos mas usados en operacion diaria.

## 1) Flujo Principal De Venta (Con Pago Mixto)

```mermaid
flowchart TD
    A[Inicio venta en POS] --> B[Escanear / buscar productos]
    B --> C[Construir carrito]
    C --> D{Hay promociones aplicables?}
    D -- Si --> E[Aplicar reglas de promocion]
    D -- No --> F[Calcular total]
    E --> F
    F --> G{Metodo de pago}
    G -- Efectivo --> H[Registrar pago en venta_pagos]
    G -- Tarjeta --> H
    G -- Mixto --> I[Separar efectivo + tarjeta]
    I --> H
    H --> J[Guardar venta en ventas]
    J --> K[Guardar detalle en detalle_venta]
    K --> L[Actualizar stock y inventory_movements]
    L --> M[Actualizar contador ticket]
    M --> N[Imprimir comprobante]
```

## 2) Flujo De Cierre De Turno (Corte De Caja)

```mermaid
flowchart TD
    A[Solicitar resumen de turno] --> B[Leer ventas del turno]
    B --> C[Consolidar pagos desde venta_pagos]
    C --> D[Consolidar movimientos de caja]
    D --> E[Calcular esperados: efectivo y tarjeta]
    E --> F[Usuario declara montos contados]
    F --> G{Modo de corte}
    G -- ajuste_auto --> H[Guardar diferencias]
    G -- sin_ajuste --> I[Cerrar sin forzar ajuste]
    H --> J[Actualizar corte_caja]
    I --> J
    J --> K[Generar resumen para impresion]
```

## 3) Flujo De Compras Y Recepcion

```mermaid
flowchart TD
    A[Detectar necesidad por stock] --> B[Crear/actualizar order en purchase_orders]
    B --> C[Agregar items en purchase_order_items]
    C --> D[Asignar comprador]
    D --> E[Enviar solicitud]
    E --> F[Recepcion fisica]
    F --> G[Registrar cantidad recibida por item]
    G --> H[Actualizar inventario de productos]
    H --> I[Cerrar orden: completa o con faltantes]
```

## 4) Flujo DTE (Documento Tributario Electronico)

```mermaid
flowchart TD
    A[Venta confirmada] --> B[Crear borrador en dte_documentos]
    B --> C[Firmar XML con certificado]
    C --> D[Enviar al servicio SII]
    D --> E[Guardar track y estado]
    E --> F[Registrar eventos en dte_eventos]
    F --> G{Aceptado?}
    G -- Si --> H[Estado final emitido]
    G -- No --> I[Registrar error y reintento]
```

## Recomendacion Operativa
1. Para soporte rapido: revisar siempre `ventas` + `venta_pagos` + `cash_movements` + `corte_caja`.
2. Para desfases de mixto: tomar `venta_pagos` como fuente principal y `ventas.metodo_pago` como apoyo.
3. Para auditoria: cruzar ticket (`ventas.numero_ticket` / `folio_ticket`) con `detalle_venta` y `dte_documentos`.

