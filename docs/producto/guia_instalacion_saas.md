# Guia de Instalacion SaaS (Mensualidad)

## 1. Requisitos de infraestructura
- Servidor Linux/Windows con Node.js LTS.
- Motor MySQL/MariaDB.
- Dominio público (ejemplo: `app.tudominio.cl`).
- Certificado SSL válido (HTTPS obligatorio).
- Reverse proxy (Nginx o similar) recomendado.

## 2. Componentes
- Frontend web (sitio).
- API Node (`/api`).
- Base de datos central.
- Servicio de correo SMTP.

## 3. Despliegue base
1. Publicar código frontend/backend.
2. Configurar variables de entorno en servidor:
   - `PORT`
   - `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
   - `JWT_SECRET`
   - `CORS_ORIGIN`
   - SMTP opcional.
3. Ejecutar `npm install` en `server`.
4. Iniciar API con PM2/servicio del sistema.

## 4. HTTPS y dominio
- Forzar redirección a `https://`.
- Verificar certificados renovables.
- Bloquear tráfico HTTP directo si corresponde.

## 5. Seguridad mínima
- `JWT_SECRET` robusto en producción.
- CORS restringido a dominios válidos.
- Respaldos automáticos de BD.
- Logs centralizados y monitoreo.

## 6. Puesta en marcha
- Crear tenant/local inicial (si aplica).
- Configurar negocio, cajas y usuarios.
- Validar flujo completo de venta y cierre.

## 7. Operación continua
- Monitoreo de uptime.
- Rotación de logs.
- Plan de actualización y rollback.
