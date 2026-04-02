# Diagrama De Base De Datos (Modelo Actual)

Fuente del modelo:
- Esquema real leAdo desde `information_schema` de la BD activa (`minimarket`).
- Tablas detectadas: `44`.
- Llaves forAneas fAsicas declaradas en MySQL: `4`.

Relaciones fAsicas (FK) declaradas:
1. `detalle_venta.producto_id -> productos.id_producto`
2. `detalle_venta.venta_id -> ventas.id_venta`
3. `productos.id_departamento -> departamento.id_departamento`
4. `productos.id_formato -> formato_venta.id_formato`

Nota:
- El sistema usa varias relaciones lAgicas por convenciAn de IDs (por ejemplo `ventas.usuario_id`, `ventas.caja_id`, `ventas.turno_id`) aunque no siempre estAn declaradas como FK en motor.

## CAmo Leer El Diagrama
- `||--o{` = uno a muchos.
- `||--||` = uno a uno.
- Campos marcados como `FK*` = relaciAn lAgica (usada por la app), no necesariamente FK fAsica.

## 1) NAcleo Operativo (Ventas, Turnos, Caja, Inventario)

```mermaid
erDiagram
    usuarios {
      int id PK
      string user
      string nombre
      tinyint es_administrador
    }

    cajero_permisos {
      int usuario_id PK,FK
      timestamp updated_at
    }

    sucursales {
      int id_sucursal PK
      string codigo
      string nombre
    }

    cajas {
      int id_caja PK
      int n_caja UK
      int sucursal_id FK*
      tinyint estado
    }

    corte_caja {
      int id_corte PK
      date fecha
      int caja_id FK*
      int sucursal_id FK*
      int usuario_id FK*
      datetime hora_apertura
      datetime hora_cierre
      decimal total_ventas
      int transacciones
      enum estado
    }

    ventas {
      int id_venta PK
      datetime fecha
      int numero_ticket
      string folio_ticket
      int usuario_id FK*
      int caja_id FK*
      int sucursal_id FK*
      int turno_id FK*
      string metodo_pago
      decimal total
    }

    venta_pagos {
      bigint id_pago PK
      int venta_id FK*
      enum metodo_pago
      decimal monto
    }

    detalle_venta {
      int id_detalle PK
      int venta_id FK
      int producto_id FK
      decimal cantidad
      decimal subtotal
    }

    productos {
      int id_producto PK
      string codigo_barras
      string descripcion
      int id_formato FK
      int id_departamento FK
      decimal precio_venta
      decimal cantidad_actual
    }

    departamento {
      int id_departamento PK
      string nombre
    }

    formato_venta {
      int id_formato PK
      string descripcion
    }

    cash_movements {
      int id_movimiento PK
      datetime fecha
      int caja_id FK*
      int usuario_id FK*
      int turno_id FK*
      enum tipo
      decimal monto
    }

    ticket_counter_state {
      int turno_id PK,FK*
      int caja_id FK*
      int usuario_id FK*
      int numero_actual
    }

    inventory_movements {
      int id_movimiento PK
      datetime fecha
      int producto_id FK*
      int caja_id FK*
      int usuario_id FK*
      decimal cantidad_nueva
    }

    product_promotions {
      int id PK
      string nombre
      string promo_type
      tinyint is_active
    }

    product_promotion_items {
      int id PK
      int promotion_id FK*
      int product_id FK*
    }

    conectados {
      int id_conectado PK
      int caja_conectada FK*
      int user_id FK*
    }

    user_auth_sessions {
      bigint id PK
      int user_id FK*
      int caja_id FK*
      int sucursal_id FK*
      int turno_id FK*
      datetime expires_at
    }

    usuarios ||--|| cajero_permisos : "configura"
    sucursales ||--o{ cajas : "tiene"
    sucursales ||--o{ corte_caja : "contexto"
    sucursales ||--o{ ventas : "contexto"

    usuarios ||--o{ corte_caja : "abre/cierra"
    cajas ||--o{ corte_caja : "n_caja -> caja_id"
    corte_caja ||--o{ ventas : "id_corte -> turno_id"

    usuarios ||--o{ ventas : "vende"
    cajas ||--o{ ventas : "n_caja -> caja_id"
    ventas ||--o{ venta_pagos : "desglosa pagos"
    ventas ||--o{ detalle_venta : "contiene"

    productos ||--o{ detalle_venta : "se vende en"
    departamento ||--o{ productos : "clasifica"
    formato_venta ||--o{ productos : "define formato"

    usuarios ||--o{ cash_movements : "registra"
    cajas ||--o{ cash_movements : "movimientos"
    corte_caja ||--o{ cash_movements : "turno_id"

    corte_caja ||--|| ticket_counter_state : "contador turno"
    usuarios ||--o{ ticket_counter_state : "cajero"
    cajas ||--o{ ticket_counter_state : "caja"

    productos ||--o{ inventory_movements : "historial stock"
    usuarios ||--o{ inventory_movements : "operador"
    cajas ||--o{ inventory_movements : "caja origen"

    product_promotions ||--o{ product_promotion_items : "incluye"
    productos ||--o{ product_promotion_items : "en promocion"

    usuarios ||--o{ conectados : "sesion activa"
    cajas ||--o{ conectados : "ocupacion"

    usuarios ||--o{ user_auth_sessions : "token"
    cajas ||--o{ user_auth_sessions : "sesion caja"
    sucursales ||--o{ user_auth_sessions : "sesion sucursal"
    corte_caja ||--o{ user_auth_sessions : "sesion turno"
```

### ExplicaciAn rApida del nAcleo
1. Una `venta` pertenece a un cajero (`usuarios`), una caja (`cajas`) y opcionalmente a un turno (`corte_caja`).
2. Cada venta puede tener mAltiples formas de pago en `venta_pagos` (esto soporta mixto real).
3. El detalle de productos vendidos estA en `detalle_venta` y descuenta inventario vAa `inventory_movements`.
4. El corte/turno (`corte_caja`) consolida ventas y movimientos de caja (`cash_movements`).

## 2) Compras / Abastecimiento

```mermaid
erDiagram
    service_suppliers {
      int id PK
      string name
      tinyint is_active
    }

    service_buyers {
      int id PK
      string name
      tinyint is_active
    }

    service_product_links {
      int id PK
      string barcode
      int supplier_id FK*
      int buyer_id FK*
      decimal min_stock
      decimal target_stock
    }

    purchase_settings {
      int id PK
      int default_buyer_id FK*
      string group_mode
    }

    purchase_orders {
      int id PK
      string status
      int assigned_buyer_id FK*
      int assigned_by_user_id FK*
      datetime assignment_sent_at
      datetime reception_closed_at
    }

    purchase_order_items {
      int id PK
      int order_id FK*
      int product_id FK*
      string barcode
      decimal requested_qty
      decimal received_qty
      int last_requested_by_user_id FK*
    }

    productos {
      int id_producto PK
      string codigo_barras
      string descripcion
    }

    usuarios {
      int id PK
      string user
    }

    service_suppliers ||--o{ service_product_links : "abastece"
    service_buyers ||--o{ service_product_links : "compra"
    productos ||--o{ service_product_links : "barcode/logica"

    service_buyers ||--o{ purchase_orders : "asignado"
    purchase_orders ||--o{ purchase_order_items : "incluye items"
    productos ||--o{ purchase_order_items : "item producto"
    usuarios ||--o{ purchase_orders : "asigna/cierra"
    usuarios ||--o{ purchase_order_items : "solicita"

    service_buyers ||--o| purchase_settings : "buyer por defecto"
```

### ExplicaciAn rApida de compras
1. `service_product_links` define quA proveedor/comprador gestiona cada producto y sus umbrales.
2. `purchase_orders` es la cabecera de la solicitud.
3. `purchase_order_items` guarda cantidades pedidas/recibidas por producto.
4. `purchase_settings` permite definir comprador por defecto del flujo.

## 3) DTE (Factura/Boleta ElectrAnica)

```mermaid
erDiagram
    ventas {
      int id_venta PK
      datetime fecha
      decimal total
    }

    usuarios {
      int id PK
      string user
    }

    dte_documentos {
      int id_dte PK
      int venta_id FK*
      int tipo_dte
      string estado
      string folio_referencia
      decimal total
      int created_by FK*
    }

    dte_eventos {
      int id_evento PK
      int dte_id FK*
      string tipo_evento
      datetime created_at
    }

    dte_config {
      int id PK
      string ambiente
      string emisor_rut
      string certificado_alias FK*
      tinyint activo
    }

    dte_certificados {
      int id PK
      string alias
      string subject_dn
      datetime valid_to
    }

    dte_receptor_cache {
      int id PK
      string rut
      string razon_social
      string email
    }

    ventas ||--o| dte_documentos : "documenta venta"
    usuarios ||--o{ dte_documentos : "emite"
    dte_documentos ||--o{ dte_eventos : "historial estado"
    dte_certificados ||--o{ dte_config : "por alias (logica)"
```

### ExplicaciAn rApida DTE
1. `dte_documentos` es la entidad principal de emisiAn por venta.
2. `dte_eventos` guarda trazabilidad de envAo/estado/errores.
3. `dte_config` define ambiente y emisor.
4. `dte_certificados` guarda certificados disponibles para firma.

## Tablas De ConfiguraciAn Global (Sin Muchas Dependencias)
- `payment_settings`
- `currency_settings`
- `unit_settings`
- `tax_settings`
- `ticket_settings`
- `ticket_settings_by_caja` (relaciAn lAgica con `cajas`)
- `personalization_settings`
- `cut_settings`
- `device_settings`
- `device_caja_bindings` (relaciAn lAgica con `cajas`/`sucursales`)
- `system_business_limits`
- `folio_settings`
- `info`

## RecomendaciAn TAcnica (Modelado)
Si quieres que el modelo quede mAs robusto para reportes y auditorAa:
1. Declarar FK fAsicas para las relaciones lAgicas crAticas (`ventas`, `corte_caja`, `cash_movements`, `user_auth_sessions`, compras).
2. Unificar el significado de `caja_id` (hoy muchas tablas usan el nAmero de caja `n_caja`, no `id_caja`).
3. Mantener `venta_pagos` como fuente oficial de mAtodo de pago y usar `ventas.metodo_pago` solo como campo legacy/resumen.


