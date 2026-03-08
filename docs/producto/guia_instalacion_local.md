# Guia de Instalacion Local (Pago Unico)

## 1. Requisitos
- Windows 10/11 (recomendado).
- XAMPP (Apache + MySQL).
- Node.js LTS.
- Impresora térmica 58mm (opcional según operación).

## 2. Estructura sugerida
- Proyecto en: `C:\xampp\htdocs\minimarket`
- Backend Node en: `C:\xampp\htdocs\minimarket\server`

## 3. Base de datos
1. Iniciar MySQL desde XAMPP.
2. Crear BD `minimarket` (si no existe).
3. Iniciar Node para que cree/actualice tablas operativas automáticamente.

## 4. Backend Node
1. Abrir terminal en `server`.
2. Instalar dependencias: `npm install`
3. Levantar API: `node server.js`
4. Verificar: `http://localhost:3001`

## 5. Frontend
1. Iniciar Apache desde XAMPP.
2. Abrir: `http://localhost/minimarket/index.php`
3. Configurar datos del negocio (primera vez).
4. Asignar caja al dispositivo.
5. Iniciar sesión.

## 6. Verificación mínima
- Crear producto.
- Vender y cobrar.
- Imprimir ticket de prueba.
- Realizar cierre de turno.

## 7. Respaldo recomendado
- Backup diario de DB `minimarket`.
- Exportación de configuración y catálogo semanal.
