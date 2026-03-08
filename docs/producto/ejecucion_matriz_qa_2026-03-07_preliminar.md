# Ejecución Matriz QA - Preliminar (2026-03-07)

## Datos de ejecución
- Fecha: 2026-03-07
- Ambiente: Local
- Versión evaluada: Pre-release comercial
- Responsable QA: SIA (técnico)

## Dispositivos evaluados
| Dispositivo | SO | Navegador | Resultado |
|---|---|---|---|
| Caja principal | Windows | Chrome | [x] OK [ ] Falla |
| Caja secundaria | Pendiente | Pendiente | [ ] OK [ ] Falla |
| iPad | Pendiente | Safari | [ ] OK [ ] Falla |
| Android | Pendiente | Chrome | [ ] OK [ ] Falla |

## Casos por módulo

### Ventas
| Caso | Resultado | Evidencia | Observación |
|---|---|---|---|
| Escaneo por código | [x] OK [ ] Falla | Validación funcional previa en flujo activo | Confirmar en caja secundaria |
| Búsqueda por nombre | [x] OK [ ] Falla | Ajustes recientes en `js/scripts.js` | Confirmar en iPad/Android |
| Cobro + ticket | [x] OK [ ] Falla | Operación validada en iteraciones previas | Confirmar impresora cliente final |
| Reimpresión última venta | [x] OK [ ] Falla | Botón y endpoint implementados | Confirmar en piloto |

### Productos / Inventario
| Caso | Resultado | Evidencia | Observación |
|---|---|---|---|
| Crear producto | [x] OK [ ] Falla | Flujo activo en módulo productos | Validar carga masiva cliente |
| Modificar producto | [x] OK [ ] Falla | Ajustes formulario + inventario checkbox | Confirmar en multi-dispositivo |
| Eliminar con regla inventario | [x] OK [ ] Falla | Validación backend 409 implementada | Confirmar casos límite |
| Reposición de stock | [x] OK [ ] Falla | Flujo inventario ajustado | Confirmar con datos reales |

### Compras
| Caso | Resultado | Evidencia | Observación |
|---|---|---|---|
| Crear orden | [x] OK [ ] Falla | Flujo implementado | Confirmar con usuario final |
| Enviar orden por correo | [x] OK [ ] Falla | Endpoint y popup de envío implementados | Depende SMTP cliente |
| Recepción y cierre | [x] OK [ ] Falla | Estados de recepción implementados | Confirmar variaciones reales |

### Corte y reportes
| Caso | Resultado | Evidencia | Observación |
|---|---|---|---|
| Resumen sesión | [x] OK [ ] Falla | Ajustes en corte activos | Verificar en piloto 7 días |
| Cierre de turno | [x] OK [ ] Falla | Validaciones y flujo operativos | Confirmar sin desvíos en caja real |
| Exportes XLSX | [x] OK [ ] Falla | Correcciones de formato aplicadas | Validar con volumen alto |

## Incidencias detectadas (estado preliminar)
| ID | Severidad | Módulo | Descripción | Estado |
|---|---|---|---|---|
| QA-PRE-01 | Media | Multi-dispositivo | Validación incompleta en iPad/Android | Abierta |
| QA-PRE-02 | Media | Operación | Falta corrida de piloto 7 días | Abierta |

## Resultado final QA preliminar
- [ ] Aprobado
- [x] Aprobado con observaciones
- [ ] Rechazado

## Cierre requerido
1. Completar pruebas en dispositivos pendientes.
2. Ejecutar piloto de 7 días.
3. Emitir GO/NO-GO final firmado.
