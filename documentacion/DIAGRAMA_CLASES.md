# Diagrama De Clases (Dominio Funcional)

Nota:
- Este diagrama modela el dominio funcional del sistema (no clases JS literales).
- Sirve para arquitectura, documentacion y onboarding tecnico.

```mermaid
classDiagram
    class Usuario {
      +int id
      +string user
      +string nombre
      +bool es_administrador
    }

    class CajeroPermisos {
      +int usuario_id
      +bool ventas_cobrar_ticket
      +bool inventario_ajustar
      +bool corte_turno
    }

    class Sucursal {
      +int id_sucursal
      +string codigo
      +string nombre
    }

    class Caja {
      +int id_caja
      +int n_caja
      +int sucursal_id
      +bool estado
    }

    class TurnoCorte {
      +int id_corte
      +date fecha
      +int caja_id
      +int usuario_id
      +decimal total_ventas
      +int transacciones
      +string estado
    }

    class Venta {
      +int id_venta
      +datetime fecha
      +int numero_ticket
      +int usuario_id
      +int caja_id
      +int turno_id
      +decimal total
    }

    class VentaPago {
      +int id_pago
      +int venta_id
      +string metodo_pago
      +decimal monto
    }

    class DetalleVenta {
      +int id_detalle
      +int venta_id
      +int producto_id
      +decimal cantidad
      +decimal subtotal
    }

    class Producto {
      +int id_producto
      +string codigo_barras
      +string descripcion
      +int id_formato
      +int id_departamento
      +decimal precio_venta
      +decimal cantidad_actual
    }

    class Departamento {
      +int id_departamento
      +string nombre
    }

    class FormatoVenta {
      +int id_formato
      +string descripcion
    }

    class MovimientoCaja {
      +int id_movimiento
      +int caja_id
      +int usuario_id
      +int turno_id
      +string tipo
      +decimal monto
    }

    class MovimientoInventario {
      +int id_movimiento
      +int producto_id
      +int usuario_id
      +int caja_id
      +decimal cantidad_nueva
    }

    class Promocion {
      +int id
      +string nombre
      +string promo_type
      +bool is_active
    }

    class PromocionItem {
      +int id
      +int promotion_id
      +int product_id
    }

    class OrdenCompra {
      +int id
      +string status
      +int assigned_buyer_id
      +int assigned_by_user_id
    }

    class OrdenCompraItem {
      +int id
      +int order_id
      +int product_id
      +decimal requested_qty
      +decimal received_qty
    }

    class DteDocumento {
      +int id_dte
      +int venta_id
      +string estado
      +string folio_referencia
      +decimal total
    }

    class DteEvento {
      +int id_evento
      +int dte_id
      +string tipo_evento
    }

    Usuario "1" --> "1" CajeroPermisos : permisos
    Sucursal "1" --> "N" Caja : contiene
    Usuario "1" --> "N" TurnoCorte : abre_cierra
    Caja "1" --> "N" TurnoCorte : turnos
    TurnoCorte "1" --> "N" Venta : ventas
    Usuario "1" --> "N" Venta : realiza
    Caja "1" --> "N" Venta : origen
    Venta "1" --> "N" VentaPago : pagos
    Venta "1" --> "N" DetalleVenta : items
    Producto "1" --> "N" DetalleVenta : vendido_en
    Departamento "1" --> "N" Producto : clasifica
    FormatoVenta "1" --> "N" Producto : formato
    Usuario "1" --> "N" MovimientoCaja : registra
    Caja "1" --> "N" MovimientoCaja : afecta
    TurnoCorte "1" --> "N" MovimientoCaja : contexto
    Producto "1" --> "N" MovimientoInventario : historial
    Promocion "1" --> "N" PromocionItem : incluye
    Producto "1" --> "N" PromocionItem : participa
    OrdenCompra "1" --> "N" OrdenCompraItem : contiene
    Producto "1" --> "N" OrdenCompraItem : solicitado
    Venta "1" --> "0..1" DteDocumento : documento
    DteDocumento "1" --> "N" DteEvento : eventos
```

## Explicacion Rapida
1. `Venta` es el centro operativo: une cajero, caja, turno, pagos y detalle de productos.
2. `VentaPago` permite representar pagos mixtos de forma nativa.
3. `TurnoCorte` consolida ventas y movimientos de caja.
4. `Producto` se conecta a inventario, promociones y compras.
5. `DteDocumento` y `DteEvento` agregan trazabilidad tributaria sobre la venta.

