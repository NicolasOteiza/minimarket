const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const fs = require('fs/promises');
const { execFile, spawn } = require('child_process');
const { config } = require('./config');
const db = require('./db');
const dteModule = require('./dte_module');

const app = express();
app.use(express.json({ limit: '1mb' }));

const corsOrigins = config.corsOrigin === '*'
  ? '*'
  : config.corsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean);

const corsOptions = {
  origin: corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

const publicRoutes = [
  { method: 'POST', path: '/api/login' },
  { method: 'POST', path: '/api/auth/refresh' },
  { method: 'POST', path: '/api/auth/logout' },
  { method: 'GET', path: '/api/getInfo' },
  { method: 'GET', path: '/api/getCajas' },
  { method: 'POST', path: '/api/addInfo' },
  { method: 'POST', path: '/api/addCaja' },
  { method: 'POST', path: '/api/cajas/upsert' },
  { method: 'GET', path: '/api/device-caja/resolve' },
  { method: 'POST', path: '/api/device-caja/bind' },
  { method: 'GET', path: '/api/serial-ports' },
  { method: 'GET', path: '/api/turno/abierto-caja' },
  { method: 'GET', path: '/api/productos/template.csv' },
  { method: 'GET', path: '/api/productos/template.json' },
  { method: 'POST', path: '/api/error-report' },
];

function isPublicRoute(req) {
  return publicRoutes.some((route) => route.method === req.method && route.path === req.path);
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  const [type, token] = authHeader.split(' ');
  if (type === 'Bearer' && token) {
    return token;
  }
  return null;
}

function parseDurationToSeconds(value, fallbackSeconds) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return fallbackSeconds;
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.floor(numeric);
  }
  const match = raw.match(/^(\d+)\s*([smhd])$/i);
  if (!match) return fallbackSeconds;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0) return fallbackSeconds;
  if (unit === 's') return amount;
  if (unit === 'm') return amount * 60;
  if (unit === 'h') return amount * 3600;
  if (unit === 'd') return amount * 86400;
  return fallbackSeconds;
}

const ACCESS_TOKEN_TTL_SECONDS = parseDurationToSeconds(config.jwtExpiresIn, 3600);
const REFRESH_TOKEN_TTL_SECONDS = parseDurationToSeconds(config.refreshTokenExpiresIn, 57600);

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function issueAccessToken(userId, name) {
  return jwt.sign(
    { sub: userId, name: String(name || '').trim() },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

async function createRefreshSession({ userId, cajaId = null, turnoId = null, deviceHash = null }) {
  const rawToken = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashRefreshToken(rawToken);
  const expiresAt = new Date(Date.now() + (REFRESH_TOKEN_TTL_SECONDS * 1000));
  await db.query(
    `INSERT INTO user_auth_sessions (user_id, token_hash, caja_id, turno_id, device_hash, expires_at, last_used_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [userId, tokenHash, cajaId, turnoId, deviceHash || null, expiresAt]
  );
  return { refreshToken: rawToken, refreshExpiresAt: expiresAt };
}

function toInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundToDecimals(value, decimals = 2) {
  const num = toNumber(value);
  if (num === null) return null;
  const factor = 10 ** Math.max(0, Number(decimals) || 0);
  return Math.round(num * factor) / factor;
}

function toBool(value) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return null;
}

function toText(value, maxLength = 255) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

function normalizeSaleFormatName(value) {
  const raw = toText(value, 50);
  if (!raw) return null;
  const normalized = raw.toLowerCase();
  if (normalized === 'botellas') return 'unidad';
  return normalized;
}

function normalizeImportedBarcode(rawValue, maxLength = 80) {
  let value = String(rawValue ?? '').trim();
  // Permite reimportar valores exportados como ="7800000000000"
  const excelFormulaMatch = value.match(/^=\s*"(.+)"$/);
  if (excelFormulaMatch) {
    value = excelFormulaMatch[1];
  }
  // Excel a veces preserva prefijo de texto/apostrofe.
  if (value.startsWith("'")) {
    value = value.slice(1);
  }
  return toText(value, maxLength);
}

function toExcelTextCell(value) {
  const plain = String(value ?? '').trim();
  if (!plain) return '';
  const safe = plain.replace(/"/g, '""');
  return `="${safe}"`;
}

function normalizeDeviceHash(rawValue) {
  if (typeof rawValue !== 'string') return null;
  const trimmed = rawValue.trim();
  if (!trimmed) return null;
  if (/^[a-f0-9]{64}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return crypto.createHash('sha256').update(trimmed).digest('hex');
}

function isValidCajaNumber(value) {
  return Number.isInteger(value) && value >= 1 && value <= 8;
}

function normalizeFolioPrefix(value) {
  if (value === null || typeof value === 'undefined') return '';
  const prefix = String(value).trim().toUpperCase();
  if (!/^[A-Z]{0,2}$/.test(prefix)) {
    return null;
  }
  return prefix;
}

function buildFormattedTicketNumber(ticketNumber, folioSettings = {}) {
  const numericTicket = toInt(ticketNumber);
  const safeTicket = Number.isInteger(numericTicket) && numericTicket > 0 ? numericTicket : 1;
  const prefix = normalizeFolioPrefix(folioSettings.prefix);
  const digits = clampInt(folioSettings.digits, 1, 8, 1);
  if (prefix === null) {
    return String(safeTicket);
  }
  const padded = String(safeTicket).padStart(digits, '0');
  return `${prefix}${padded}`;
}

function isIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function csvEscape(value, delimiter = ',') {
  if (value === null || typeof value === 'undefined') return '';
  const str = String(value);
  const escapedDelimiter = delimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const needsQuotePattern = new RegExp(`["\\n\\r${escapedDelimiter}]`);
  if (needsQuotePattern.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers, rows, delimiter = ',') {
  const headerLine = headers.map((value) => csvEscape(value, delimiter)).join(delimiter);
  const body = rows
    .map((row) => row.map((value) => csvEscape(value, delimiter)).join(delimiter))
    .join('\n');
  return `${headerLine}\n${body}\n`;
}

function parseSimpleCsv(content) {
  const lines = String(content || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const headerLine = lines[0];
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ';' : ',';
  const headers = headerLine.split(delimiter).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cols = line.split(delimiter).map((cell) => cell.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cols[index] ?? '';
    });
    return row;
  });
}

function escapeSqlString(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\u0000/g, '\\0')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function toSqlLiteral(value) {
  if (value === null || typeof value === 'undefined') return 'NULL';
  if (Buffer.isBuffer(value)) return `X'${value.toString('hex')}'`;
  if (value instanceof Date) {
    const iso = value.toISOString().slice(0, 19).replace('T', ' ');
    return `'${escapeSqlString(iso)}'`;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${escapeSqlString(value)}'`;
}

async function getOpenShiftByCajaCajero(executor, cajaId, cajeroId) {
  const [rows] = await executor.query(
    `SELECT id_corte, hora_apertura
     FROM corte_caja
     WHERE fecha = CURDATE() AND caja_id = ? AND usuario_id = ? AND estado = 'abierto'
     ORDER BY id_corte DESC
     LIMIT 1`,
    [cajaId, cajeroId]
  );
  if (!rows.length) return null;
  return {
    turno_id: Number(rows[0].id_corte || 0) || null,
    hora_apertura: rows[0].hora_apertura || null,
  };
}

async function getShiftFallbackNextTicket(executor, { turnoId, cajaId, cajeroId, horaApertura }) {
  if (!turnoId) return 1;
  const [rows] = await executor.query(
    `SELECT MAX(numero_ticket) AS ultimo
     FROM ventas
     WHERE turno_id = ?
        OR (turno_id IS NULL
            AND DATE(fecha) = CURDATE()
            AND usuario_id = ?
            AND caja_id = ?
            AND fecha >= ?)`,
    [turnoId, cajeroId, cajaId, horaApertura || new Date(0)]
  );
  const ultimo = Number(rows[0]?.ultimo || 0);
  return Number.isFinite(ultimo) && ultimo > 0 ? (ultimo + 1) : 1;
}

async function getOrCreateTicketCounterState(executor, { turnoId, cajaId, cajeroId, horaApertura }) {
  const [stateRows] = await executor.query(
    `SELECT turno_id, caja_id, usuario_id, numero_actual, ultimo_ticket
     FROM ticket_counter_state
     WHERE turno_id = ?
     LIMIT 1`,
    [turnoId]
  );

  if (stateRows.length > 0) {
    return {
      turno_id: Number(stateRows[0].turno_id || 0) || turnoId,
      caja_id: Number(stateRows[0].caja_id || 0) || cajaId,
      usuario_id: Number(stateRows[0].usuario_id || 0) || cajeroId,
      numero_actual: Math.max(1, Number(stateRows[0].numero_actual || 1) || 1),
      ultimo_ticket: Math.max(0, Number(stateRows[0].ultimo_ticket || 0) || 0),
    };
  }

  const fallbackNext = await getShiftFallbackNextTicket(executor, { turnoId, cajaId, cajeroId, horaApertura });
  const fallbackLast = Math.max(0, fallbackNext - 1);
  await executor.query(
    `INSERT INTO ticket_counter_state (turno_id, caja_id, usuario_id, numero_actual, ultimo_ticket)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       caja_id = VALUES(caja_id),
       usuario_id = VALUES(usuario_id),
       numero_actual = GREATEST(numero_actual, VALUES(numero_actual)),
       ultimo_ticket = GREATEST(ultimo_ticket, VALUES(ultimo_ticket)),
       updated_at = CURRENT_TIMESTAMP`,
    [turnoId, cajaId, cajeroId, fallbackNext, fallbackLast]
  );

  return {
    turno_id: turnoId,
    caja_id: cajaId,
    usuario_id: cajeroId,
    numero_actual: fallbackNext,
    ultimo_ticket: fallbackLast,
  };
}

async function upsertTicketCounterState(executor, { turnoId, cajaId, cajeroId, numeroActual, ultimoTicket }) {
  const safeNext = Math.max(1, Number(numeroActual || 1) || 1);
  const safeLast = Math.max(0, Number(ultimoTicket || 0) || 0);
  await executor.query(
    `INSERT INTO ticket_counter_state (turno_id, caja_id, usuario_id, numero_actual, ultimo_ticket)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       caja_id = VALUES(caja_id),
       usuario_id = VALUES(usuario_id),
       numero_actual = GREATEST(numero_actual, VALUES(numero_actual)),
       ultimo_ticket = GREATEST(ultimo_ticket, VALUES(ultimo_ticket)),
       updated_at = CURRENT_TIMESTAMP`,
    [turnoId, cajaId, cajeroId, safeNext, safeLast]
  );

  const [rows] = await executor.query(
    `SELECT turno_id, caja_id, usuario_id, numero_actual, ultimo_ticket
     FROM ticket_counter_state
     WHERE turno_id = ?
     LIMIT 1`,
    [turnoId]
  );
  const row = rows[0] || {};
  return {
    turno_id: Number(row.turno_id || 0) || turnoId,
    caja_id: Number(row.caja_id || 0) || cajaId,
    usuario_id: Number(row.usuario_id || 0) || cajeroId,
    numero_actual: Math.max(1, Number(row.numero_actual || safeNext) || safeNext),
    ultimo_ticket: Math.max(0, Number(row.ultimo_ticket || safeLast) || safeLast),
  };
}

async function getDatabaseVerifySnapshot() {
  const [tablesRows] = await db.query(
    `SELECT TABLE_NAME
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ?
     ORDER BY TABLE_NAME ASC`,
    [config.db.database]
  );
  const tables = tablesRows.map((row) => row.TABLE_NAME);

  const expectedTables = [
    'usuarios',
    'cajas',
    'info',
    'ventas',
    'detalle_venta',
    'productos',
    'departamento',
    'corte_caja',
    'cash_movements',
    'ticket_settings',
    'payment_settings',
    'currency_settings',
    'unit_settings',
    'tax_settings',
    'personalization_settings',
    'device_settings',
    'cut_settings',
    'cajero_permisos',
    'ticket_counter_state',
  ];
  const missing = expectedTables.filter((name) => !tables.includes(name));

  const counters = {};
  const counterTargets = ['usuarios', 'productos', 'ventas', 'detalle_venta', 'clientes', 'corte_caja', 'cash_movements'];
  for (const tableName of counterTargets) {
    if (!tables.includes(tableName)) continue;
    const [countRows] = await db.query(`SELECT COUNT(*) AS total FROM \`${tableName}\``);
    counters[tableName] = Number(countRows[0]?.total || 0);
  }

  return {
    ok: missing.length === 0,
    database: config.db.database,
    server_time: new Date().toISOString(),
    total_tables: tables.length,
    missing_tables: missing,
    counters,
  };
}

async function buildMaintenanceReport({ requestedBy = null } = {}) {
  const verify = await getDatabaseVerifySnapshot();
  const [infoRows] = await db.query(
    'SELECT nombre, telefono, mail, tipo_local FROM info WHERE id_info = 1 LIMIT 1'
  );
  const business = infoRows[0] || {};

  const lines = [];
  lines.push('INFORME DE MANTENIMIENTO - SISTEMA MINIMARKET');
  lines.push(`Fecha: ${new Date().toISOString()}`);
  lines.push(`Base de datos: ${verify.database}`);
  lines.push(`Host BD: ${config.db.host}:${config.db.port}`);
  lines.push(`Estado verificacion: ${verify.ok ? 'OK' : 'ALERTA'}`);
  lines.push(`Total de tablas: ${verify.total_tables}`);
  lines.push(`Tablas faltantes: ${(verify.missing_tables || []).join(', ') || 'Ninguna'}`);
  lines.push('');
  lines.push('DATOS DEL NEGOCIO');
  lines.push(`Nombre: ${business.nombre || ''}`);
  lines.push(`Telefono: ${business.telefono || ''}`);
  lines.push(`Correo: ${business.mail || ''}`);
  lines.push(`Rubro: ${business.tipo_local || ''}`);
  lines.push('');
  lines.push('CONTADORES');
  Object.entries(verify.counters || {}).forEach(([key, value]) => {
    lines.push(`- ${key}: ${value}`);
  });
  lines.push('');
  lines.push('SISTEMA');
  lines.push(`Servidor: ${os.hostname()}`);
  lines.push(`Plataforma: ${os.platform()} ${os.release()}`);
  lines.push(`Arquitectura: ${os.arch()}`);
  lines.push(`Node: ${process.version}`);
  lines.push(`Memoria libre/total: ${Math.round(os.freemem() / 1024 / 1024)}MB / ${Math.round(os.totalmem() / 1024 / 1024)}MB`);
  if (requestedBy) {
    lines.push(`Solicitado por usuario_id: ${requestedBy}`);
  }
  lines.push('');
  return lines.join('\n');
}

function getMailTransportConfig() {
  const host = String(config.smtp.host || '').trim();
  const user = String(config.smtp.user || '').trim();
  const pass = String(config.smtp.pass || '').trim();
  const from = String(config.smtp.from || '').trim() || user;
  if (!host || !user || !pass || !from) {
    return null;
  }
  return {
    host,
    port: Number(config.smtp.port || 587),
    secure: Boolean(config.smtp.secure),
    auth: {
      user,
      pass,
    },
    from,
  };
}

function isValidEmail(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 180) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function parseEmailList(rawValue, maxItems = 10) {
  if (typeof rawValue !== 'string') return [];
  return rawValue
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter((item) => isValidEmail(item))
    .slice(0, maxItems);
}

const ERROR_REPORT_FALLBACK_TO = 'siatalca@gmail.com';
const ERROR_EMAIL_COOLDOWN_MS = 120000;
let lastErrorEmailSentAt = 0;
let errorEmailQueue = Promise.resolve();

function sanitizeErrorText(value, maxLen = 4000) {
  return String(value ?? '').trim().slice(0, maxLen);
}

async function resolveErrorMailDestination() {
  try {
    const [rows] = await db.query('SELECT mail FROM info WHERE id_info = 1 LIMIT 1');
    const businessMail = String(rows?.[0]?.mail || '').trim();
    if (isValidEmail(businessMail)) {
      return businessMail;
    }
  } catch (_) {
    // ignore
  }
  return ERROR_REPORT_FALLBACK_TO;
}

async function resolveErrorMailTransport() {
  let cc = [];
  try {
    const row = await getServiceEmailSettings();
    if (row) {
      const transport = buildTransportConfigFromServiceEmail(row);
      if (transport) {
        cc = parseEmailList(String(row.cc_emails || ''), 20);
        return { transport, cc };
      }
    }
  } catch (_) {
    // ignore
  }
  const transport = getMailTransportConfig();
  return transport ? { transport, cc } : null;
}

async function sendErrorEmailNow(subject, bodyText) {
  const mailBundle = await resolveErrorMailTransport();
  if (!mailBundle?.transport) return false;

  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (_) {
    return false;
  }

  const to = await resolveErrorMailDestination();
  const transporter = nodemailer.createTransport({
    host: mailBundle.transport.host,
    port: mailBundle.transport.port,
    secure: mailBundle.transport.secure,
    auth: mailBundle.transport.auth,
  });

  await transporter.sendMail({
    from: mailBundle.transport.from,
    to,
    cc: mailBundle.cc,
    subject: sanitizeErrorText(subject, 180),
    text: sanitizeErrorText(bodyText, 15000),
  });
  return true;
}

function queueErrorEmailReport(source, payload = {}) {
  const now = Date.now();
  if ((now - lastErrorEmailSentAt) < ERROR_EMAIL_COOLDOWN_MS) {
    return;
  }
  lastErrorEmailSentAt = now;

  const stamp = new Date().toISOString();
  const subject = `[ERROR][${source}] Minimarket ${stamp}`;
  const lines = [
    `Fecha: ${stamp}`,
    `Fuente: ${sanitizeErrorText(source, 160)}`,
    `Mensaje: ${sanitizeErrorText(payload.message || payload.error || 'Sin mensaje', 2000)}`,
    `URL: ${sanitizeErrorText(payload.url || '', 500)}`,
    `Metodo: ${sanitizeErrorText(payload.method || '', 32)}`,
    `IP: ${sanitizeErrorText(payload.ip || '', 80)}`,
    `Caja: ${sanitizeErrorText(payload.caja || '', 20)}`,
    `Usuario: ${sanitizeErrorText(payload.user || '', 40)}`,
    `User-Agent: ${sanitizeErrorText(payload.user_agent || '', 500)}`,
    '',
    'Stack / Detalle:',
    sanitizeErrorText(payload.stack || payload.detail || '', 9000),
  ];
  const text = lines.join('\n');

  errorEmailQueue = errorEmailQueue
    .catch(() => {})
    .then(() => sendErrorEmailNow(subject, text).catch(() => false));
}

function buildTransportConfigFromServiceEmail(row) {
  const host = String(row?.smtp_host || '').trim();
  const user = String(row?.smtp_user || '').trim();
  const pass = String(row?.smtp_pass || '').trim();
  const fromEmail = String(row?.from_email || '').trim() || user;
  const fromName = String(row?.from_name || '').trim();
  const from = fromName ? `"${fromName.replace(/"/g, "'")}" <${fromEmail}>` : fromEmail;
  if (!host || !user || !pass || !fromEmail) {
    return null;
  }
  return {
    host,
    port: clampInt(row?.smtp_port, 1, 65535, 587),
    secure: normalizeBool(row?.smtp_secure, false),
    auth: {
      user,
      pass,
    },
    from,
  };
}

async function getServiceEmailSettings() {
  const [rows] = await db.query('SELECT * FROM service_email_settings WHERE id = 1 LIMIT 1');
  return rows[0] || null;
}

async function buildPurchasePreviewRows(mode = 'supplier') {
  const normalizedMode = mode === 'buyer' ? 'buyer' : 'supplier';
  const groupByBuyer = normalizedMode === 'buyer';

  const [rows] = await db.query(
    `SELECT l.id, l.barcode, l.product_ref, l.supplier_id, l.buyer_id, l.min_stock, l.target_stock, l.notes,
            s.name AS supplier_name,
            b.name AS buyer_name,
            b.email AS buyer_email,
            p.descripcion AS product_name,
            p.cantidad_actual AS current_stock
     FROM service_product_links l
     LEFT JOIN service_suppliers s ON s.id = l.supplier_id
     LEFT JOIN service_buyers b ON b.id = l.buyer_id
     LEFT JOIN productos p ON TRIM(p.codigo_barras) = TRIM(l.barcode)
     ORDER BY l.id ASC`
  );

  const groupsMap = new Map();
  for (const row of rows) {
    const currentStock = Number(row.current_stock || 0);
    const minStock = Math.max(0, Number(row.min_stock || 0));
    const targetStock = Math.max(0, Number(row.target_stock || 0));
    let suggestQty = 0;
    if (targetStock > 0 && currentStock < targetStock) {
      suggestQty = targetStock - currentStock;
    } else if (minStock > 0 && currentStock < minStock) {
      suggestQty = minStock - currentStock;
    }
    if (suggestQty <= 0) continue;

    const groupId = groupByBuyer ? Number(row.buyer_id || 0) : Number(row.supplier_id || 0);
    const groupNameRaw = groupByBuyer ? row.buyer_name : row.supplier_name;
    const groupName = String(groupNameRaw || 'Sin asignar').trim() || 'Sin asignar';
    const key = `${groupId}-${groupName}`;
    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        group_id: groupId || null,
        group_name: groupName,
        contact_email: groupByBuyer ? (row.buyer_email || null) : null,
        items: [],
      });
    }
    groupsMap.get(key).items.push({
      link_id: Number(row.id),
      barcode: row.barcode,
      product_ref: row.product_ref || row.product_name || row.barcode,
      suggest_qty: Math.ceil(suggestQty),
      min_stock: minStock,
      target_stock: targetStock,
      current_stock: currentStock,
      notes: row.notes || '',
    });
  }

  return Array.from(groupsMap.values());
}

function mergeRequesterNames(existingNamesRaw, nextNameRaw) {
  const current = String(existingNamesRaw || '').split(',').map((item) => item.trim()).filter(Boolean);
  const next = String(nextNameRaw || '').trim();
  if (!next) {
    return current.join(', ');
  }
  if (!current.includes(next)) {
    current.push(next);
  }
  return current.join(', ');
}

async function getActivePurchaseOrder() {
  const [activeRows] = await db.query(
    `SELECT id, status, assigned_buyer_id
     FROM purchase_orders
     WHERE status = 'active'
     ORDER BY id DESC
     LIMIT 1`
  );
  if (!activeRows.length) return null;
  return activeRows[0];
}

async function createPurchaseOrder() {
  const activeOrder = await getActivePurchaseOrder();
  if (activeOrder) return activeOrder;
  const [result] = await db.query(
    `INSERT INTO purchase_orders (status, assigned_buyer_id, assigned_by_user_id, assigned_by_name, assignment_note, assignment_sent_at)
     VALUES ('active', NULL, NULL, NULL, NULL, NULL)`
  );
  return { id: Number(result.insertId), status: 'active', assigned_buyer_id: null };
}

async function buildDatabaseSqlDump() {
  const [tableRows] = await db.query('SHOW TABLES');
  const tableNames = tableRows
    .map((row) => Object.values(row)[0])
    .filter((name) => typeof name === 'string' && name.trim().length > 0);

  const lines = [];
  lines.push('-- Exportacion completa de base de datos');
  lines.push(`-- Fecha: ${new Date().toISOString()}`);
  lines.push(`-- Base: ${config.db.database}`);
  lines.push('SET FOREIGN_KEY_CHECKS=0;');
  lines.push('');

  for (const tableName of tableNames) {
    const [createRows] = await db.query(`SHOW CREATE TABLE \`${tableName}\``);
    const createRow = createRows[0];
    const createStatement = createRow?.['Create Table'];
    if (!createStatement) continue;

    lines.push(`-- ----------------------------`);
    lines.push(`-- Estructura para tabla \`${tableName}\``);
    lines.push(`-- ----------------------------`);
    lines.push(`DROP TABLE IF EXISTS \`${tableName}\`;`);
    lines.push(`${createStatement};`);
    lines.push('');

    const [dataRows] = await db.query(`SELECT * FROM \`${tableName}\``);
    if (!Array.isArray(dataRows) || dataRows.length === 0) {
      continue;
    }

    const columns = Object.keys(dataRows[0]);
    lines.push(`-- Datos para tabla \`${tableName}\``);
    for (const row of dataRows) {
      const values = columns.map((col) => toSqlLiteral(row[col]));
      lines.push(
        `INSERT INTO \`${tableName}\` (${columns.map((col) => `\`${col}\``).join(', ')}) VALUES (${values.join(', ')});`
      );
    }
    lines.push('');
  }

  lines.push('SET FOREIGN_KEY_CHECKS=1;');
  lines.push('');
  return lines.join('\n');
}

const CASHIER_PERMISSION_FIELDS = [
  'ventas_producto_comun',
  'ventas_aplicar_mayoreo',
  'ventas_aplicar_descuento',
  'ventas_historial',
  'ventas_entrada_efectivo',
  'ventas_salida_efectivo',
  'ventas_cobrar_ticket',
  'ventas_cobrar_credito',
  'ventas_cancelar_ticket',
  'ventas_eliminar_articulo',
  'ventas_facturar',
  'ventas_pago_servicio',
  'ventas_recarga_electronica',
  'ventas_buscar_producto',
  'clientes_admin',
  'clientes_asignar_venta',
  'clientes_credito_admin',
  'clientes_ver_cuentas',
  'productos_crear',
  'productos_modificar',
  'productos_eliminar',
  'productos_reporte_ventas',
  'productos_crear_promociones',
  'productos_modificar_varios',
  'inventario_agregar_mercancia',
  'inventario_reportes_existencia',
  'inventario_movimientos',
  'inventario_ajustar',
  'corte_turno',
  'corte_todos_turnos',
  'corte_dia',
  'corte_ver_ganancia_dia',
  'configuracion_acceso',
  'reportes_ver',
  'compras_crear_orden',
  'compras_recibir_orden',
];

const CASHIER_PERMISSION_DEFAULTS = {
  ventas_producto_comun: 1,
  ventas_aplicar_mayoreo: 0,
  ventas_aplicar_descuento: 0,
  ventas_historial: 1,
  ventas_entrada_efectivo: 1,
  ventas_salida_efectivo: 1,
  ventas_cobrar_ticket: 1,
  ventas_cobrar_credito: 0,
  ventas_cancelar_ticket: 0,
  ventas_eliminar_articulo: 0,
  ventas_facturar: 0,
  ventas_pago_servicio: 0,
  ventas_recarga_electronica: 0,
  ventas_buscar_producto: 1,
  clientes_admin: 0,
  clientes_asignar_venta: 0,
  clientes_credito_admin: 0,
  clientes_ver_cuentas: 0,
  productos_crear: 0,
  productos_modificar: 0,
  productos_eliminar: 0,
  productos_reporte_ventas: 0,
  productos_crear_promociones: 0,
  productos_modificar_varios: 0,
  inventario_agregar_mercancia: 0,
  inventario_reportes_existencia: 0,
  inventario_movimientos: 0,
  inventario_ajustar: 0,
  corte_turno: 1,
  corte_todos_turnos: 0,
  corte_dia: 0,
  corte_ver_ganancia_dia: 0,
  configuracion_acceso: 0,
  reportes_ver: 0,
  compras_crear_orden: 0,
  compras_recibir_orden: 0,
};

function buildCashierPermissions(payload = {}) {
  const permissions = {};
  CASHIER_PERMISSION_FIELDS.forEach((field) => {
    permissions[field] = normalizeBool(payload[field], Boolean(CASHIER_PERMISSION_DEFAULTS[field])) ? 1 : 0;
  });
  return permissions;
}

function runPowerShell(command) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
      { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 * 5 },
      (error, stdout, stderr) => {
        if (error) {
          const detail = (stderr || error.message || '').trim();
          reject(new Error(detail || 'Error ejecutando PowerShell'));
          return;
        }
        resolve((stdout || '').trim());
      }
    );
  });
}

function escapePsSingleQuoted(value) {
  return String(value ?? '').replace(/'/g, "''");
}

function normalizePrinterList(raw) {
  if (!raw) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const items = Array.isArray(parsed) ? parsed : [parsed];
  return items
    .map((item) => ({
      name: String(item.Name || '').trim(),
      isDefault: Boolean(item.Default),
    }))
    .filter((item) => item.name);
}

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function normalizeBool(value, fallback = false) {
  const parsed = toBool(value);
  return parsed === null ? fallback : parsed;
}

async function sendCashDrawerPulse({ connectionType = 'printer_usb', printerName = '', serialPort = '', pulseMs = 120 }) {
  const safePulse = clampInt(pulseMs, 50, 500, 120);

  if (connectionType === 'serial') {
    const port = String(serialPort || '').trim();
    if (!port) {
      throw new Error('No hay puerto serial configurado');
    }
    const serialCommand =
      `$port = New-Object System.IO.Ports.SerialPort('${escapePsSingleQuoted(port)}',9600,'None',8,'one'); ` +
      `$port.Open(); ` +
      `$bytes = [byte[]](0x1B,0x70,0x00,0x19,0xFA); ` +
      `$port.Write($bytes,0,$bytes.Length); ` +
      `Start-Sleep -Milliseconds ${safePulse}; ` +
      `$port.Close();`;
    await runPowerShell(serialCommand);
    return `Pulso de apertura enviado por ${port}`;
  }

  const printer = String(printerName || '').trim();
  if (!printer) {
    throw new Error('No hay impresora configurada');
  }
  const rawEscPosCommand =
    "$sig = @'\n" +
    "using System;\n" +
    "using System.Runtime.InteropServices;\n" +
    "public class RawPrint {\n" +
    "  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public class DOCINFOA { public string pDocName; public string pOutputFile; public string pDataType; }\n" +
    "  [DllImport(\"winspool.drv\", SetLastError=true, CharSet=CharSet.Unicode)] public static extern bool OpenPrinter(string pPrinterName, out IntPtr hPrinter, IntPtr pDefault);\n" +
    "  [DllImport(\"winspool.drv\", SetLastError=true)] public static extern bool ClosePrinter(IntPtr hPrinter);\n" +
    "  [DllImport(\"winspool.drv\", SetLastError=true)] public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] DOCINFOA di);\n" +
    "  [DllImport(\"winspool.drv\", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr hPrinter);\n" +
    "  [DllImport(\"winspool.drv\", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr hPrinter);\n" +
    "  [DllImport(\"winspool.drv\", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr hPrinter);\n" +
    "  [DllImport(\"winspool.drv\", SetLastError=true)] public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);\n" +
    "  public static void Send(string printer, byte[] bytes){ IntPtr h; if(!OpenPrinter(printer,out h,IntPtr.Zero)) throw new Exception(\"OpenPrinter fallo\"); var di=new DOCINFOA(){pDocName=\"DrawerPulse\",pDataType=\"RAW\"}; if(!StartDocPrinter(h,1,di)) throw new Exception(\"StartDocPrinter fallo\"); if(!StartPagePrinter(h)) throw new Exception(\"StartPagePrinter fallo\"); int written; if(!WritePrinter(h,bytes,bytes.Length,out written)) throw new Exception(\"WritePrinter fallo\"); EndPagePrinter(h); EndDocPrinter(h); ClosePrinter(h);} }\n" +
    "'@; " +
    "Add-Type -TypeDefinition $sig -Language CSharp; " +
    "$bytes = [byte[]](0x1B,0x70,0x00,0x19,0xFA); " +
    `[RawPrint]::Send('${escapePsSingleQuoted(printer)}', $bytes);`;
  await runPowerShell(rawEscPosCommand);
  return `Pulso de apertura enviado a ${printer}`;
}

function formatCLP(value) {
  const amount = Number(value || 0);
  return Math.round(amount).toLocaleString('es-CL');
}

function padRight(value, width) {
  const str = String(value ?? '');
  if (str.length >= width) return str.slice(0, width);
  return str + ' '.repeat(width - str.length);
}

function padLeft(value, width) {
  const str = String(value ?? '');
  if (str.length >= width) return str.slice(0, width);
  return ' '.repeat(width - str.length) + str;
}

function normalizeTicketPaperWidth(value, fallback = 58) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return parsed >= 80 ? 80 : 58;
}

function clampColumnsByPaper(columnsValue, paperWidthMm, fallback = 30) {
  const paper = normalizeTicketPaperWidth(paperWidthMm, 58);
  if (paper === 58) {
    return clampInt(columnsValue, 28, 56, fallback);
  }
  return clampInt(columnsValue, 32, 64, Math.max(42, fallback));
}

function getPrintProfile(printerName, requestedColumns, paperWidthMm = 58) {
  const printer = String(printerName || '').trim();
  const isXp58 = /xp-58/i.test(printer);
  const paper = normalizeTicketPaperWidth(paperWidthMm, 58);
  const columns = clampColumnsByPaper(requestedColumns, paper, paper === 58 ? 30 : 42);
  return {
    columns,
    fontSize: paper === 58
      ? (columns <= 30 ? 6.5 : (columns <= 36 ? 6.2 : (columns <= 42 ? 5.9 : (columns <= 48 ? 5.6 : 5.2))))
      : (columns <= 36 ? 7.5 : 8),
    isXp58,
    paper_width_mm: paper,
  };
}

function normalizePrintEngine(value) {
  const engine = String(value || '').trim().toLowerCase();
  if (engine === 'gdi' || engine === 'out_printer') return engine;
  return 'auto';
}

function normalizeFeedLines(value) {
  return clampInt(value, 0, 8, 2);
}

function buildSaleTicketText({ sale, details, settings, business }) {
  const columns = clampInt(settings.columns_width, 28, 64, 42);
  const divider = '-'.repeat(columns);
  const lines = [];
  const title = (settings.ticket_header || 'COMPROBANTE DE VENTA').trim();
  const centerLine = (value = '') => {
    const text = String(value).trim();
    if (!text) return '';
    if (text.length >= columns) return text.slice(0, columns);
    const left = Math.floor((columns - text.length) / 2);
    const right = columns - text.length - left;
    return `${' '.repeat(left)}${text}${' '.repeat(right)}`;
  };
  const wrapText = (value = '') => {
    const raw = String(value || '').trim();
    if (!raw) return [];
    const words = raw.split(/\s+/);
    const out = [];
    let current = '';
    words.forEach((word) => {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= columns) {
        current = candidate;
        return;
      }
      if (current) out.push(current);
      if (word.length > columns) {
        for (let i = 0; i < word.length; i += columns) {
          out.push(word.slice(i, i + columns));
        }
        current = '';
      } else {
        current = word;
      }
    });
    if (current) out.push(current);
    return out;
  };

  lines.push(centerLine(title));
  lines.push(divider);
  if (normalizeBool(settings.show_business_info, true) && business) {
    if (business.nombre) lines.push(centerLine(String(business.nombre)));
    if (business.tipo_local) wrapText(`Rubro: ${business.tipo_local}`).forEach((line) => lines.push(line));
    if (business.telefono) lines.push(`Tel: ${business.telefono}`);
    if (business.mail) wrapText(`Mail: ${business.mail}`).forEach((line) => lines.push(line));
    lines.push(divider);
  }

  lines.push(`Fecha: ${new Date(sale.fecha).toLocaleDateString('es-CL')}`);
  lines.push(`Hora: ${new Date(sale.fecha).toLocaleTimeString('es-CL', { hour12: false })}`);
  if (normalizeBool(settings.show_ticket_number, true)) {
    lines.push(`Ticket: ${sale.folio_ticket || sale.numero_ticket}`);
  }
  if (normalizeBool(settings.show_cashier, true)) {
    lines.push(`Cajero: ${sale.cajero_nombre || sale.usuario_id}`);
  }
  if (normalizeBool(settings.show_box, true)) {
    lines.push(`Caja: ${sale.caja_id}`);
  }
  if (normalizeBool(settings.show_payment_method, true)) {
    lines.push(`Pago: ${sale.metodo_pago}`);
  }
  lines.push(divider);

  const includeDetails = normalizeBool(settings.include_details_by_default, true);
  if (includeDetails) {
    lines.push('DETALLE');
    lines.push(divider);
    details.forEach((row) => {
      const qty = Number(row.cantidad || 0);
      const unit = Number(row.precio_unitario || 0);
      const subtotal = Number(row.subtotal || 0);
      const desc = String(row.descripcion || '').trim();
      const amountText = `$${formatCLP(subtotal)}`;
      const leftWidth = Math.max(8, columns - amountText.length - 1);
      wrapText(desc).forEach((line) => lines.push(line));
      lines.push(padRight(`${formatCLP(qty)} x $${formatCLP(unit)}`, leftWidth) + ' ' + padLeft(amountText, amountText.length));
    });
    lines.push(divider);
  }

  const totalText = `$${formatCLP(sale.total)}`;
  if (columns <= 34 || (`TOTAL ${totalText}`).length > columns) {
    // Para tiras angostas, evita recorte del total imprimiendolo en dos lineas.
    lines.push('TOTAL');
    lines.push(totalText);
  } else {
    lines.push(padRight('TOTAL', Math.max(1, columns - totalText.length - 1)) + ` ${totalText}`);
  }
  lines.push(divider);
  if (settings.ticket_footer) {
    wrapText(String(settings.ticket_footer).trim()).forEach((line) => lines.push(line));
  }
  lines.push(centerLine('ORIGINAL CLIENTE'));
  lines.push('');
  return lines.join('\r\n');
}

function buildDteTestTicket58mmText({ settings, business, dteConfig, validationCode, qrPayload, columns }) {
  const normalizedColumns = clampInt(columns, 28, 64, 39);
  const safeColumns = Math.max(28, normalizedColumns);
  const divider = '-'.repeat(safeColumns);
  const now = new Date();
  const folio = String((now.getTime() % 1000000)).padStart(6, '0');
  const pointOfSale = String(dteConfig?.punto_venta || 'POS-01').trim() || 'POS-01';
  const emitterRut = String(dteConfig?.emisor_rut || '').trim();
  const emitterName = String(dteConfig?.emisor_razon_social || business?.nombre || 'MINIMARKET').trim();
  const emitterGiro = String(dteConfig?.emisor_giro || business?.tipo_local || '').trim();
  const emitterAddress = String(dteConfig?.emisor_direccion || '').trim();
  const emitterLocation = [dteConfig?.emisor_comuna, dteConfig?.emisor_ciudad]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' - ');
  const branchName = emitterLocation || 'SUCURSAL MATRIZ';

  const centerLine = (value = '') => {
    const text = String(value).trim();
    if (!text) return '';
    if (text.length >= safeColumns) return text.slice(0, safeColumns);
    const left = Math.floor((safeColumns - text.length) / 2);
    const right = safeColumns - text.length - left;
    return `${' '.repeat(left)}${text}${' '.repeat(right)}`;
  };

  const wrapText = (value = '') => {
    const raw = String(value || '').trim();
    if (!raw) return [];
    const words = raw.split(/\s+/);
    const wrapped = [];
    let current = '';
    words.forEach((word) => {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= safeColumns) {
        current = candidate;
      } else {
        if (current) wrapped.push(current);
        if (word.length > safeColumns) {
          for (let i = 0; i < word.length; i += safeColumns) {
            wrapped.push(word.slice(i, i + safeColumns));
          }
          current = '';
        } else {
          current = word;
        }
      }
    });
    if (current) wrapped.push(current);
    return wrapped;
  };

  const lines = [];
  lines.push(centerLine('REPRESENTACION IMPRESA'));
  lines.push(centerLine('BOLETA ELECTRONICA'));
  lines.push(centerLine('DTE TIPO 39 - PRUEBA'));
  lines.push(divider);
  lines.push(centerLine(emitterName || 'EMISOR DE PRUEBA'));
  lines.push(centerLine(`RUT: ${emitterRut || '11.111.111-1'}`));
  wrapText(`GIRO: ${emitterGiro || 'VENTA AL POR MENOR'}`).forEach((line) => lines.push(line));
  wrapText(`DIR: ${emitterAddress || 'DIRECCION REFERENCIAL 123'}`).forEach((line) => lines.push(line));
  wrapText(branchName).forEach((line) => lines.push(line));
  lines.push(divider);
  lines.push(`FOLIO: ${folio}`);
  lines.push(`FECHA: ${now.toLocaleDateString('es-CL')}`);
  lines.push(`HORA: ${now.toLocaleTimeString('es-CL', { hour12: false })}`);
  lines.push(`CAJA: ${pointOfSale}`);
  lines.push('ATENDIDO POR: CAJERO DEMO');
  lines.push('CLIENTE: CONSUMIDOR FINAL');
  lines.push(divider);
  lines.push('DETALLE          CANT X PRECIO');
  lines.push(divider);

  const sampleRows = [
    { descripcion: 'PAN MOLDE BLANCO', qty: 1, unit: 1290 },
    { descripcion: 'LECHE SEMI DESCREMADA 1L', qty: 2, unit: 1150 },
    { descripcion: 'BEBIDA COLA 1.5L', qty: 1, unit: 1890 },
  ];

  sampleRows.forEach((item) => {
    const subtotal = item.qty * item.unit;
    const line1 = `${item.descripcion}`.slice(0, safeColumns);
    const unitLine = `${item.qty} x $${formatCLP(item.unit)}`;
    const amountText = `$${formatCLP(subtotal)}`;
    const leftWidth = Math.max(8, safeColumns - amountText.length - 1);
    lines.push(line1);
    lines.push(padRight(unitLine, leftWidth) + ' ' + padLeft(amountText, amountText.length));
  });

  const total = sampleRows.reduce((acc, row) => acc + (row.qty * row.unit), 0);
  const neto = Math.round(total / 1.19);
  const iva = total - neto;
  const totalText = `$${formatCLP(total)}`;
  lines.push(divider);
  lines.push(padRight('SUBTOTAL', safeColumns - 1 - totalText.length) + ` ${totalText}`);
  lines.push(padRight('NETO', safeColumns - 1 - `$${formatCLP(neto)}`.length) + ` $${formatCLP(neto)}`);
  lines.push(padRight('IVA (19%)', safeColumns - 1 - `$${formatCLP(iva)}`.length) + ` $${formatCLP(iva)}`);
  lines.push(padRight('TOTAL', safeColumns - 1 - totalText.length) + ` ${totalText}`);
  lines.push(padRight('EFECTIVO', safeColumns - 1 - totalText.length) + ` ${totalText}`);
  lines.push(padRight('VUELTO', safeColumns - 1 - '$0'.length) + ' $0');
  lines.push(divider);
  lines.push(centerLine('TIMBRE ELECTRONICO SII'));
  lines.push(centerLine('(SIMULADO - SOLO PRUEBA)'));
  lines.push(`CODIGO: ${validationCode}`);
  lines.push('CODIGO SII: PENDIENTE');
  lines.push('Se imprime al emitir DTE real');
  lines.push(divider);
  lines.push(centerLine('VERIFIQUE DOCUMENTO EN'));
  lines.push(centerLine('WWW.SII.CL (SIMULADO)'));
  if (settings?.ticket_footer) {
    wrapText(String(settings.ticket_footer).trim()).forEach((line) => lines.push(line));
  }
  lines.push(centerLine('ORIGINAL CLIENTE'));
  lines.push(centerLine('NO VALIDO TRIBUTARIAMENTE'));
  lines.push('');
  return lines.join('\r\n');
}

async function ensureOperationalTables() {
  const [usersColumns] = await db.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'usuarios'`,
    [config.db.database]
  );
  const usersCurrent = new Set(usersColumns.map((row) => row.COLUMN_NAME));
  if (!usersCurrent.has('es_administrador')) {
    await db.query('ALTER TABLE usuarios ADD COLUMN es_administrador TINYINT(1) NOT NULL DEFAULT 0 AFTER estado_usuario');
    await db.query(
      `UPDATE usuarios
       SET es_administrador = 1
       WHERE LOWER(user) = 'admin' OR LOWER(nombre) LIKE '%admin%'`
    );
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS corte_caja (
      id_corte INT AUTO_INCREMENT PRIMARY KEY,
      fecha DATE NOT NULL,
      caja_id INT NOT NULL,
      usuario_id INT NOT NULL,
      hora_apertura DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      hora_cierre DATETIME NULL,
      monto_inicial DECIMAL(10,2) NOT NULL DEFAULT 0,
      monto_declarado DECIMAL(10,2) NOT NULL DEFAULT 0,
      monto_declarado_tarjeta DECIMAL(10,2) NOT NULL DEFAULT 0,
      diferencia_efectivo DECIMAL(10,2) NOT NULL DEFAULT 0,
      diferencia_tarjeta DECIMAL(10,2) NOT NULL DEFAULT 0,
      total_efectivo DECIMAL(10,2) NOT NULL DEFAULT 0,
      total_tarjeta DECIMAL(10,2) NOT NULL DEFAULT 0,
      total_mixto DECIMAL(10,2) NOT NULL DEFAULT 0,
      total_ventas DECIMAL(10,2) NOT NULL DEFAULT 0,
      transacciones INT NOT NULL DEFAULT 0,
      estado ENUM('abierto','cerrado') NOT NULL DEFAULT 'cerrado',
      observaciones VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_corte_fecha_caja_usuario (fecha, caja_id, usuario_id),
      INDEX idx_corte_fecha (fecha),
      INDEX idx_corte_caja (caja_id),
      INDEX idx_corte_usuario (usuario_id)
    )
  `);

  const [columns] = await db.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'corte_caja'`,
    [config.db.database]
  );

  const current = new Set(columns.map((row) => row.COLUMN_NAME));
  if (!current.has('monto_declarado')) {
    await db.query('ALTER TABLE corte_caja ADD COLUMN monto_declarado DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER monto_inicial');
  }
  if (!current.has('diferencia_efectivo')) {
    await db.query('ALTER TABLE corte_caja ADD COLUMN diferencia_efectivo DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER monto_declarado');
  }
  if (!current.has('monto_declarado_tarjeta')) {
    await db.query('ALTER TABLE corte_caja ADD COLUMN monto_declarado_tarjeta DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER monto_declarado');
  }
  if (!current.has('diferencia_tarjeta')) {
    await db.query('ALTER TABLE corte_caja ADD COLUMN diferencia_tarjeta DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER diferencia_efectivo');
  }

  const [indexes] = await db.query(
    `SELECT INDEX_NAME
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'corte_caja' AND INDEX_NAME = 'uq_corte_fecha_caja_usuario'
     LIMIT 1`,
    [config.db.database]
  );
  if (indexes.length > 0) {
    await db.query('ALTER TABLE corte_caja DROP INDEX uq_corte_fecha_caja_usuario');
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS ticket_settings (
      id INT PRIMARY KEY,
      ticket_header VARCHAR(120) NOT NULL DEFAULT 'COMPROBANTE DE VENTA',
      ticket_footer VARCHAR(255) NOT NULL DEFAULT 'Gracias por su compra',
      printer_name VARCHAR(255) NULL,
      columns_width INT NOT NULL DEFAULT 30,
      paper_width_mm INT NOT NULL DEFAULT 58,
      print_engine ENUM('auto','gdi','out_printer') NOT NULL DEFAULT 'auto',
      feed_lines_after_print INT NOT NULL DEFAULT 2,
      show_business_info TINYINT(1) NOT NULL DEFAULT 1,
      show_cashier TINYINT(1) NOT NULL DEFAULT 1,
      show_box TINYINT(1) NOT NULL DEFAULT 1,
      show_payment_method TINYINT(1) NOT NULL DEFAULT 1,
      show_ticket_number TINYINT(1) NOT NULL DEFAULT 1,
      include_details_by_default TINYINT(1) NOT NULL DEFAULT 1,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const [ticketColumnsRows] = await db.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'ticket_settings'`,
    [config.db.database]
  );
  const ticketColumns = new Set(ticketColumnsRows.map((row) => row.COLUMN_NAME));
  if (!ticketColumns.has('paper_width_mm')) {
    await db.query('ALTER TABLE ticket_settings ADD COLUMN paper_width_mm INT NOT NULL DEFAULT 58 AFTER columns_width');
  }
  if (!ticketColumns.has('print_engine')) {
    await db.query("ALTER TABLE ticket_settings ADD COLUMN print_engine ENUM('auto','gdi','out_printer') NOT NULL DEFAULT 'auto' AFTER paper_width_mm");
  }
  if (!ticketColumns.has('feed_lines_after_print')) {
    await db.query('ALTER TABLE ticket_settings ADD COLUMN feed_lines_after_print INT NOT NULL DEFAULT 2 AFTER print_engine');
  }

  await db.query(
    `INSERT INTO ticket_settings (
      id, ticket_header, ticket_footer, printer_name, columns_width, paper_width_mm, print_engine, feed_lines_after_print,
      show_business_info, show_cashier, show_box, show_payment_method,
      show_ticket_number, include_details_by_default
    )
     VALUES (1, 'COMPROBANTE DE VENTA', 'Gracias por su compra', NULL, 30, 58, 'auto', 2, 1, 1, 1, 1, 1, 1)
    ON DUPLICATE KEY UPDATE id = id`
  );

  await db.query(`
    CREATE TABLE IF NOT EXISTS folio_settings (
      id INT PRIMARY KEY,
      prefix VARCHAR(2) NOT NULL DEFAULT '',
      digits INT NOT NULL DEFAULT 1,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await db.query(
    `INSERT INTO folio_settings (id, prefix, digits)
     VALUES (1, '', 1)
     ON DUPLICATE KEY UPDATE id = id`
  );

  await db.query(`
    CREATE TABLE IF NOT EXISTS payment_settings (
      id INT PRIMARY KEY,
      cash_strict_amount TINYINT(1) NOT NULL DEFAULT 0,
      usd_enabled TINYINT(1) NOT NULL DEFAULT 0,
      usd_exchange_rate DECIMAL(10,2) NOT NULL DEFAULT 950.00,
      card_enabled TINYINT(1) NOT NULL DEFAULT 1,
      card_fee_enabled TINYINT(1) NOT NULL DEFAULT 0,
      card_fee_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
      transfer_enabled TINYINT(1) NOT NULL DEFAULT 0,
      check_enabled TINYINT(1) NOT NULL DEFAULT 0,
      voucher_enabled TINYINT(1) NOT NULL DEFAULT 0,
      mixed_enabled TINYINT(1) NOT NULL DEFAULT 1,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await db.query(
    `INSERT INTO payment_settings (
      id, cash_strict_amount, usd_enabled, usd_exchange_rate, card_enabled,
      card_fee_enabled, card_fee_percent, transfer_enabled, check_enabled,
      voucher_enabled, mixed_enabled
    )
    VALUES (1, 0, 0, 950.00, 1, 0, 0.00, 0, 0, 0, 1)
    ON DUPLICATE KEY UPDATE id = id`
  );

  await db.query(`
    CREATE TABLE IF NOT EXISTS currency_settings (
      id INT PRIMARY KEY,
      currency_symbol VARCHAR(4) NOT NULL DEFAULT '$',
      thousands_separator VARCHAR(1) NOT NULL DEFAULT '.',
      decimal_separator VARCHAR(1) NOT NULL DEFAULT ',',
      currency_code VARCHAR(8) NOT NULL DEFAULT 'CLP',
      decimals INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await db.query(
    `INSERT INTO currency_settings (
      id, currency_symbol, thousands_separator, decimal_separator, currency_code, decimals
    )
    VALUES (1, '$', '.', ',', 'CLP', 0)
    ON DUPLICATE KEY UPDATE id = id`
  );

  await db.query(`
    CREATE TABLE IF NOT EXISTS unit_settings (
      id INT PRIMARY KEY,
      enable_time TINYINT(1) NOT NULL DEFAULT 0,
      enable_weight TINYINT(1) NOT NULL DEFAULT 1,
      enable_volume TINYINT(1) NOT NULL DEFAULT 1,
      enable_length TINYINT(1) NOT NULL DEFAULT 0,
      enable_not_applicable TINYINT(1) NOT NULL DEFAULT 1,
      enable_piece TINYINT(1) NOT NULL DEFAULT 1,
      default_unit VARCHAR(16) NOT NULL DEFAULT 'PZA',
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await db.query(
    `INSERT INTO unit_settings (
      id, enable_time, enable_weight, enable_volume, enable_length, enable_not_applicable, enable_piece, default_unit
    )
    VALUES (1, 0, 1, 1, 0, 1, 1, 'PZA')
    ON DUPLICATE KEY UPDATE id = id`
  );

  await db.query(`
    CREATE TABLE IF NOT EXISTS tax_settings (
      id INT PRIMARY KEY,
      tax_enabled TINYINT(1) NOT NULL DEFAULT 1,
      tax_name VARCHAR(32) NOT NULL DEFAULT 'IVA',
      tax_percent DECIMAL(5,2) NOT NULL DEFAULT 19.00,
      prices_include_tax TINYINT(1) NOT NULL DEFAULT 1,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await db.query(
    `INSERT INTO tax_settings (
      id, tax_enabled, tax_name, tax_percent, prices_include_tax
    )
    VALUES (1, 1, 'IVA', 19.00, 1)
    ON DUPLICATE KEY UPDATE id = id`
  );

  await db.query(`
    CREATE TABLE IF NOT EXISTS personalization_settings (
      id INT PRIMARY KEY,
      logo_data MEDIUMTEXT NULL,
      cash_strict_amount TINYINT(1) NOT NULL DEFAULT 0,
      usd_enabled TINYINT(1) NOT NULL DEFAULT 0,
      usd_exchange_rate DECIMAL(10,2) NOT NULL DEFAULT 950.00,
      card_enabled TINYINT(1) NOT NULL DEFAULT 1,
      card_fee_enabled TINYINT(1) NOT NULL DEFAULT 0,
      card_fee_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
      transfer_enabled TINYINT(1) NOT NULL DEFAULT 0,
      check_enabled TINYINT(1) NOT NULL DEFAULT 0,
      voucher_enabled TINYINT(1) NOT NULL DEFAULT 0,
      mixed_enabled TINYINT(1) NOT NULL DEFAULT 1,
      currency_symbol VARCHAR(4) NOT NULL DEFAULT '$',
      thousands_separator VARCHAR(1) NOT NULL DEFAULT '.',
      decimal_separator VARCHAR(1) NOT NULL DEFAULT ',',
      currency_code VARCHAR(8) NOT NULL DEFAULT 'CLP',
      decimals INT NOT NULL DEFAULT 0,
      enable_time TINYINT(1) NOT NULL DEFAULT 0,
      enable_weight TINYINT(1) NOT NULL DEFAULT 1,
      enable_volume TINYINT(1) NOT NULL DEFAULT 1,
      enable_length TINYINT(1) NOT NULL DEFAULT 0,
      enable_not_applicable TINYINT(1) NOT NULL DEFAULT 1,
      enable_piece TINYINT(1) NOT NULL DEFAULT 1,
      default_unit VARCHAR(16) NOT NULL DEFAULT 'PZA',
      tax_enabled TINYINT(1) NOT NULL DEFAULT 1,
      tax_name VARCHAR(32) NOT NULL DEFAULT 'IVA',
      tax_percent DECIMAL(5,2) NOT NULL DEFAULT 19.00,
      prices_include_tax TINYINT(1) NOT NULL DEFAULT 1,
      cut_mode ENUM('ajuste_auto','sin_ajuste') NOT NULL DEFAULT 'ajuste_auto',
      migrated_from_legacy TINYINT(1) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await db.query(
    `INSERT INTO personalization_settings (
      id, logo_data, cash_strict_amount, usd_enabled, usd_exchange_rate, card_enabled, card_fee_enabled, card_fee_percent,
      transfer_enabled, check_enabled, voucher_enabled, mixed_enabled,
      currency_symbol, thousands_separator, decimal_separator, currency_code, decimals,
      enable_time, enable_weight, enable_volume, enable_length, enable_not_applicable, enable_piece, default_unit,
      tax_enabled, tax_name, tax_percent, prices_include_tax, cut_mode, migrated_from_legacy
    )
    VALUES (1, NULL, 0, 0, 950.00, 1, 0, 0.00, 0, 0, 0, 1, '$', '.', ',', 'CLP', 0, 0, 1, 1, 0, 1, 1, 'PZA', 1, 'IVA', 19.00, 1, 'ajuste_auto', 0)
    ON DUPLICATE KEY UPDATE id = id`
  );

  const [psColsRows] = await db.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'personalization_settings'`,
    [config.db.database]
  );
  const psCols = new Set(psColsRows.map((row) => row.COLUMN_NAME));
  if (!psCols.has('migrated_from_legacy')) {
    await db.query('ALTER TABLE personalization_settings ADD COLUMN migrated_from_legacy TINYINT(1) NOT NULL DEFAULT 0 AFTER cut_mode');
  }

  const [psStateRows] = await db.query(
    'SELECT migrated_from_legacy FROM personalization_settings WHERE id = 1 LIMIT 1'
  );
  const alreadyMigrated = Number(psStateRows[0]?.migrated_from_legacy || 0) === 1;
  if (!alreadyMigrated) {
    const [paymentLegacyRows] = await db.query('SELECT * FROM payment_settings WHERE id = 1 LIMIT 1');
    const [currencyLegacyRows] = await db.query('SELECT * FROM currency_settings WHERE id = 1 LIMIT 1');
    const [unitLegacyRows] = await db.query('SELECT * FROM unit_settings WHERE id = 1 LIMIT 1');
    const [taxLegacyRows] = await db.query('SELECT * FROM tax_settings WHERE id = 1 LIMIT 1');
    const [cutLegacyRows] = await db.query('SELECT * FROM cut_settings WHERE id = 1 LIMIT 1');

    const p = paymentLegacyRows[0] || {};
    const c = currencyLegacyRows[0] || {};
    const u = unitLegacyRows[0] || {};
    const t = taxLegacyRows[0] || {};
    const cut = cutLegacyRows[0] || {};

    await db.query(
      `UPDATE personalization_settings
       SET cash_strict_amount = ?, usd_enabled = ?, usd_exchange_rate = ?,
           card_enabled = ?, card_fee_enabled = ?, card_fee_percent = ?,
           transfer_enabled = ?, check_enabled = ?, voucher_enabled = ?, mixed_enabled = ?,
           currency_symbol = ?, thousands_separator = ?, decimal_separator = ?, currency_code = ?, decimals = ?,
           enable_time = ?, enable_weight = ?, enable_volume = ?, enable_length = ?, enable_not_applicable = ?, enable_piece = ?, default_unit = ?,
           tax_enabled = ?, tax_name = ?, tax_percent = ?, prices_include_tax = ?,
           cut_mode = ?, migrated_from_legacy = 1
       WHERE id = 1`,
      [
        normalizeBool(p.cash_strict_amount, false),
        normalizeBool(p.usd_enabled, false),
        Number.isFinite(Number(p.usd_exchange_rate)) ? Number(p.usd_exchange_rate) : 950,
        normalizeBool(p.card_enabled, true),
        normalizeBool(p.card_fee_enabled, false),
        Number.isFinite(Number(p.card_fee_percent)) ? Number(p.card_fee_percent) : 0,
        normalizeBool(p.transfer_enabled, false),
        normalizeBool(p.check_enabled, false),
        normalizeBool(p.voucher_enabled, false),
        normalizeBool(p.mixed_enabled, true),
        String(c.currency_symbol || '$').slice(0, 4) || '$',
        String(c.thousands_separator || '.').slice(0, 1) || '.',
        String(c.decimal_separator || ',').slice(0, 1) || ',',
        String(c.currency_code || 'CLP').slice(0, 8) || 'CLP',
        Number.isInteger(Number(c.decimals)) ? Number(c.decimals) : 0,
        normalizeBool(u.enable_time, false),
        normalizeBool(u.enable_weight, true),
        normalizeBool(u.enable_volume, true),
        normalizeBool(u.enable_length, false),
        normalizeBool(u.enable_not_applicable, true),
        normalizeBool(u.enable_piece, true),
        String(u.default_unit || 'PZA').slice(0, 16) || 'PZA',
        normalizeBool(t.tax_enabled, true),
        String(t.tax_name || 'IVA').slice(0, 32) || 'IVA',
        Number.isFinite(Number(t.tax_percent)) ? Number(t.tax_percent) : 19,
        normalizeBool(t.prices_include_tax, true),
        cut.mode === 'sin_ajuste' ? 'sin_ajuste' : 'ajuste_auto',
      ]
    );
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS device_settings (
      id INT PRIMARY KEY,
      scanner_mode ENUM('keyboard','serial') NOT NULL DEFAULT 'keyboard',
      serial_port VARCHAR(32) NULL,
      baud_rate INT NOT NULL DEFAULT 9600,
      data_bits INT NOT NULL DEFAULT 8,
      parity ENUM('none','even','odd','mark','space') NOT NULL DEFAULT 'none',
      stop_bits ENUM('1','1.5','2') NOT NULL DEFAULT '1',
      flow_control ENUM('none','xonxoff','rtscts') NOT NULL DEFAULT 'none',
      scanner_suffix ENUM('enter','tab','none') NOT NULL DEFAULT 'enter',
      scanner_prefix_to_strip VARCHAR(16) NOT NULL DEFAULT '',
      scanner_prefix_trim TINYINT(1) NOT NULL DEFAULT 1,
      scanner_only_numeric TINYINT(1) NOT NULL DEFAULT 1,
      scanner_auto_focus TINYINT(1) NOT NULL DEFAULT 1,
      scanner_beep_on_scan TINYINT(1) NOT NULL DEFAULT 0,
      drawer_enabled TINYINT(1) NOT NULL DEFAULT 0,
      drawer_connection ENUM('printer_usb','serial','lpt') NOT NULL DEFAULT 'printer_usb',
      drawer_printer_name VARCHAR(255) NULL,
      drawer_serial_port VARCHAR(32) NULL,
      drawer_lpt_port VARCHAR(16) NOT NULL DEFAULT 'LPT1',
      drawer_pulse_ms INT NOT NULL DEFAULT 120,
      drawer_open_on_cash TINYINT(1) NOT NULL DEFAULT 1,
      drawer_open_on_mixed_cash TINYINT(1) NOT NULL DEFAULT 1,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const [deviceColumnsRows] = await db.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'device_settings'`,
    [config.db.database]
  );
  const deviceColumns = new Set(deviceColumnsRows.map((row) => row.COLUMN_NAME));
  if (!deviceColumns.has('scanner_prefix_to_strip')) {
    await db.query("ALTER TABLE device_settings ADD COLUMN scanner_prefix_to_strip VARCHAR(16) NOT NULL DEFAULT '' AFTER scanner_suffix");
  }

  await db.query(
    `INSERT INTO device_settings (
      id, scanner_mode, serial_port, baud_rate, data_bits, parity, stop_bits, flow_control,
      scanner_suffix, scanner_prefix_to_strip, scanner_prefix_trim, scanner_only_numeric, scanner_auto_focus, scanner_beep_on_scan,
      drawer_enabled, drawer_connection, drawer_printer_name, drawer_serial_port, drawer_lpt_port,
      drawer_pulse_ms, drawer_open_on_cash, drawer_open_on_mixed_cash
    )
    VALUES (1, 'keyboard', NULL, 9600, 8, 'none', '1', 'none', 'enter', '', 1, 1, 1, 0, 0, 'printer_usb', NULL, NULL, 'LPT1', 120, 1, 1)
    ON DUPLICATE KEY UPDATE id = id`
  );

  await db.query(`
    CREATE TABLE IF NOT EXISTS cut_settings (
      id INT PRIMARY KEY,
      mode ENUM('ajuste_auto','sin_ajuste') NOT NULL DEFAULT 'ajuste_auto',
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await db.query(
    `INSERT INTO cut_settings (id, mode)
     VALUES (1, 'ajuste_auto')
     ON DUPLICATE KEY UPDATE id = id`
  );

  const [salesColumns] = await db.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'ventas'`,
    [config.db.database]
  );
  const salesCurrent = new Set(salesColumns.map((row) => row.COLUMN_NAME));
  if (!salesCurrent.has('monto_efectivo')) {
    await db.query('ALTER TABLE ventas ADD COLUMN monto_efectivo DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER total');
  }
  if (!salesCurrent.has('monto_tarjeta')) {
    await db.query('ALTER TABLE ventas ADD COLUMN monto_tarjeta DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER monto_efectivo');
  }
  if (!salesCurrent.has('turno_id')) {
    await db.query('ALTER TABLE ventas ADD COLUMN turno_id INT NULL AFTER caja_id');
    await db.query('CREATE INDEX idx_ventas_turno_id ON ventas (turno_id)');
  }
  if (!salesCurrent.has('folio_ticket')) {
    await db.query('ALTER TABLE ventas ADD COLUMN folio_ticket VARCHAR(16) NULL AFTER numero_ticket');
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS ticket_counter_state (
      turno_id INT NOT NULL PRIMARY KEY,
      caja_id INT NOT NULL,
      usuario_id INT NOT NULL,
      numero_actual INT NOT NULL DEFAULT 1,
      ultimo_ticket INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_ticket_counter_caja_usuario (caja_id, usuario_id)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS cash_movements (
      id_movimiento INT AUTO_INCREMENT PRIMARY KEY,
      fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      caja_id INT NOT NULL,
      usuario_id INT NOT NULL,
      turno_id INT NULL,
      tipo ENUM('abono','entrada','salida') NOT NULL,
      metodo ENUM('efectivo','tarjeta','dolares','transferencia','cheque','vale','otro') NOT NULL DEFAULT 'efectivo',
      monto DECIMAL(10,2) NOT NULL DEFAULT 0,
      descripcion VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_cash_movements_fecha (fecha),
      INDEX idx_cash_movements_caja_usuario (caja_id, usuario_id),
      INDEX idx_cash_movements_turno (turno_id)
    )
  `);
  const [cashMovementColumns] = await db.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'cash_movements'`,
    [config.db.database]
  );
  const cashMovementCurrent = new Set(cashMovementColumns.map((row) => row.COLUMN_NAME));
  if (!cashMovementCurrent.has('turno_id')) {
    await db.query('ALTER TABLE cash_movements ADD COLUMN turno_id INT NULL AFTER usuario_id');
  }
  const [cashMovementTurnoIdx] = await db.query(
    `SELECT 1 AS ok
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'cash_movements' AND INDEX_NAME = 'idx_cash_movements_turno'
     LIMIT 1`,
    [config.db.database]
  );
  if (!cashMovementTurnoIdx.length) {
    await db.query('CREATE INDEX idx_cash_movements_turno ON cash_movements (turno_id)');
  }

  const cashierPermissionsDefinition = CASHIER_PERMISSION_FIELDS
    .map((field) => `\`${field}\` TINYINT(1) NOT NULL DEFAULT ${Number(CASHIER_PERMISSION_DEFAULTS[field] || 0)}`)
    .join(',\n      ');

  await db.query(`
    CREATE TABLE IF NOT EXISTS cajero_permisos (
      usuario_id INT NOT NULL PRIMARY KEY,
      ${cashierPermissionsDefinition},
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_cajero_permisos_usuario (usuario_id)
    )
  `);

  const [cashierPermissionColumns] = await db.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'cajero_permisos'`,
    [config.db.database]
  );
  const cashierPermissionCurrent = new Set(cashierPermissionColumns.map((row) => row.COLUMN_NAME));
  for (const field of CASHIER_PERMISSION_FIELDS) {
    if (!cashierPermissionCurrent.has(field)) {
      await db.query(
        `ALTER TABLE cajero_permisos
         ADD COLUMN \`${field}\` TINYINT(1) NOT NULL DEFAULT ${Number(CASHIER_PERMISSION_DEFAULTS[field] || 0)}`
      );
    }
  }

  const permissionColumns = CASHIER_PERMISSION_FIELDS.map((field) => `\`${field}\``).join(', ');
  const permissionDefaults = CASHIER_PERMISSION_FIELDS
    .map((field) => Number(CASHIER_PERMISSION_DEFAULTS[field] || 0))
    .join(', ');
  await db.query(
    `INSERT INTO cajero_permisos (usuario_id, ${permissionColumns})
     SELECT u.id, ${permissionDefaults}
     FROM usuarios u
     LEFT JOIN cajero_permisos cp ON cp.usuario_id = u.id
     WHERE cp.usuario_id IS NULL`
  );

  const [detailColumns] = await db.query(
    `SELECT COLUMN_NAME, IS_NULLABLE
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'detalle_venta'`,
    [config.db.database]
  );
  const detailCurrent = new Map(detailColumns.map((row) => [row.COLUMN_NAME, row.IS_NULLABLE]));
  if (!detailCurrent.has('descripcion')) {
    await db.query('ALTER TABLE detalle_venta ADD COLUMN descripcion VARCHAR(255) NULL AFTER subtotal');
  }
  if (detailCurrent.get('producto_id') === 'NO') {
    await db.query('ALTER TABLE detalle_venta MODIFY COLUMN producto_id INT NULL');
  }

  const [productColumns] = await db.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'productos'`,
    [config.db.database]
  );
  const productCurrent = new Set(productColumns.map((row) => row.COLUMN_NAME));
  if (productCurrent.has('precio_mayoreo')) {
    await db.query('ALTER TABLE productos DROP COLUMN precio_mayoreo');
    productCurrent.delete('precio_mayoreo');
  }
  if (!productCurrent.has('supplier_id')) {
    await db.query('ALTER TABLE productos ADD COLUMN supplier_id INT NULL AFTER id_departamento');
  }
  if (!productCurrent.has('exento_iva')) {
    await db.query('ALTER TABLE productos ADD COLUMN exento_iva TINYINT(1) NOT NULL DEFAULT 0 AFTER supplier_id');
  }
  const [productSupplierIdxRows] = await db.query(
    `SELECT 1 AS ok
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'productos' AND INDEX_NAME = 'idx_productos_supplier'
     LIMIT 1`,
    [config.db.database]
  );
  if (!productSupplierIdxRows.length) {
    await db.query('CREATE INDEX idx_productos_supplier ON productos (supplier_id)');
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS departamento (
      id_departamento INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(80) NOT NULL,
      UNIQUE KEY uq_departamento_nombre (nombre)
    )
  `);
  await db.query(
    `INSERT INTO departamento (nombre)
     SELECT 'General'
     FROM DUAL
     WHERE NOT EXISTS (
       SELECT 1 FROM departamento WHERE LOWER(nombre) = 'general'
     )`
  );

  // Modulo DTE (preparacion facturacion electronica) aislado del flujo de ventas actual.
  await dteModule.ensureDteTables(db);

  await db.query(`
    CREATE TABLE IF NOT EXISTS device_caja_bindings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      device_hash VARCHAR(64) NOT NULL,
      numero_caja INT NOT NULL,
      nombre_caja VARCHAR(120) NULL,
      source VARCHAR(30) NOT NULL DEFAULT 'manual',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      last_seen DATETIME NULL,
      UNIQUE KEY uq_device_caja_hash (device_hash),
      INDEX idx_device_caja_numero (numero_caja)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS purchase_settings (
      id INT PRIMARY KEY,
      group_mode ENUM('supplier','buyer') NOT NULL DEFAULT 'supplier',
      default_buyer_id INT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await db.query(
    `INSERT INTO purchase_settings (id, group_mode, default_buyer_id)
     VALUES (1, 'supplier', NULL)
     ON DUPLICATE KEY UPDATE id = id`
  );

  await db.query(`
    CREATE TABLE IF NOT EXISTS service_suppliers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      contact_name VARCHAR(120) NULL,
      phone VARCHAR(40) NULL,
      email VARCHAR(180) NULL,
      notes VARCHAR(400) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_service_suppliers_name (name),
      INDEX idx_service_suppliers_active (is_active)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS service_buyers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      contact_name VARCHAR(120) NULL,
      phone VARCHAR(40) NULL,
      email VARCHAR(180) NULL,
      notes VARCHAR(400) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_service_buyers_name (name),
      INDEX idx_service_buyers_active (is_active)
    )
  `);
  const [serviceBuyerColumnsRows] = await db.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'service_buyers'`,
    [config.db.database]
  );
  const serviceBuyerColumns = new Set(serviceBuyerColumnsRows.map((row) => row.COLUMN_NAME));
  if (!serviceBuyerColumns.has('contact_name')) {
    await db.query('ALTER TABLE service_buyers ADD COLUMN contact_name VARCHAR(120) NULL AFTER name');
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS service_product_links (
      id INT AUTO_INCREMENT PRIMARY KEY,
      barcode VARCHAR(64) NOT NULL,
      product_ref VARCHAR(160) NULL,
      supplier_id INT NULL,
      buyer_id INT NULL,
      min_stock DECIMAL(10,2) NOT NULL DEFAULT 0,
      target_stock DECIMAL(10,2) NOT NULL DEFAULT 0,
      notes VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_service_product_links_barcode (barcode),
      INDEX idx_service_product_links_supplier (supplier_id),
      INDEX idx_service_product_links_buyer (buyer_id)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS service_email_settings (
      id INT PRIMARY KEY,
      enabled TINYINT(1) NOT NULL DEFAULT 0,
      smtp_host VARCHAR(120) NULL,
      smtp_port INT NOT NULL DEFAULT 587,
      smtp_secure TINYINT(1) NOT NULL DEFAULT 0,
      smtp_user VARCHAR(180) NULL,
      smtp_pass VARCHAR(220) NULL,
      from_email VARCHAR(180) NULL,
      from_name VARCHAR(120) NULL,
      owner_email VARCHAR(180) NULL,
      cc_emails VARCHAR(500) NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await db.query(
    `INSERT INTO service_email_settings (
      id, enabled, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, from_email, from_name, owner_email, cc_emails
    )
    VALUES (1, 0, NULL, 587, 0, NULL, NULL, NULL, NULL, NULL, NULL)
    ON DUPLICATE KEY UPDATE id = id`
  );

  await db.query(`
    CREATE TABLE IF NOT EXISTS product_promotions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(120) NOT NULL,
      promo_type ENUM('single','combo') NOT NULL DEFAULT 'single',
      min_qty INT NOT NULL DEFAULT 2,
      discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
      combo_price DECIMAL(10,2) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_product_promotions_active (is_active)
    )
  `);
  const [promotionColumnsRows] = await db.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'product_promotions'`,
    [config.db.database]
  );
  const promotionColumns = new Set(promotionColumnsRows.map((row) => row.COLUMN_NAME));
  if (!promotionColumns.has('promo_type')) {
    await db.query("ALTER TABLE product_promotions ADD COLUMN promo_type ENUM('single','combo') NOT NULL DEFAULT 'single' AFTER nombre");
  }
  if (!promotionColumns.has('combo_price')) {
    await db.query('ALTER TABLE product_promotions ADD COLUMN combo_price DECIMAL(10,2) NULL AFTER discount_percent');
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS product_promotion_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      promotion_id INT NOT NULL,
      product_id INT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_product_promotion_item (promotion_id, product_id),
      INDEX idx_product_promotion_items_product (product_id)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      status ENUM('active','completed') NOT NULL DEFAULT 'active',
      assigned_buyer_id INT NULL,
      assigned_by_user_id INT NULL,
      assigned_by_name VARCHAR(120) NULL,
      assignment_note VARCHAR(255) NULL,
      assignment_sent_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_purchase_orders_status (status),
      INDEX idx_purchase_orders_buyer (assigned_buyer_id)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      product_id INT NULL,
      barcode VARCHAR(80) NOT NULL,
      description VARCHAR(255) NOT NULL,
      requested_qty DECIMAL(10,2) NOT NULL DEFAULT 0,
      received_qty DECIMAL(10,2) NOT NULL DEFAULT 0,
      requester_names VARCHAR(255) NULL,
      last_requested_by_user_id INT NULL,
      last_requested_by_name VARCHAR(120) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_purchase_order_item_barcode (order_id, barcode),
      INDEX idx_purchase_order_items_order (order_id),
      INDEX idx_purchase_order_items_product (product_id)
    )
  `);

  const [purchaseOrderColumnsRows] = await db.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'purchase_orders'`,
    [config.db.database]
  );
  const purchaseOrderColumns = new Set(purchaseOrderColumnsRows.map((row) => row.COLUMN_NAME));
  if (!purchaseOrderColumns.has('assigned_buyer_id')) {
    await db.query('ALTER TABLE purchase_orders ADD COLUMN assigned_buyer_id INT NULL AFTER status');
  }
  if (!purchaseOrderColumns.has('assigned_by_user_id')) {
    await db.query('ALTER TABLE purchase_orders ADD COLUMN assigned_by_user_id INT NULL AFTER assigned_buyer_id');
  }
  if (!purchaseOrderColumns.has('assigned_by_name')) {
    await db.query('ALTER TABLE purchase_orders ADD COLUMN assigned_by_name VARCHAR(120) NULL AFTER assigned_by_user_id');
  }
  if (!purchaseOrderColumns.has('assignment_note')) {
    await db.query('ALTER TABLE purchase_orders ADD COLUMN assignment_note VARCHAR(255) NULL AFTER assigned_by_name');
  }
  if (!purchaseOrderColumns.has('assignment_sent_at')) {
    await db.query('ALTER TABLE purchase_orders ADD COLUMN assignment_sent_at DATETIME NULL AFTER assignment_note');
  }
  if (!purchaseOrderColumns.has('reception_closed_at')) {
    await db.query('ALTER TABLE purchase_orders ADD COLUMN reception_closed_at DATETIME NULL AFTER assignment_sent_at');
  }
  if (!purchaseOrderColumns.has('reception_result')) {
    await db.query("ALTER TABLE purchase_orders ADD COLUMN reception_result ENUM('pending','complete','incomplete') NOT NULL DEFAULT 'pending' AFTER reception_closed_at");
  }
  const [purchaseOrderStatusIdxRows] = await db.query(
    `SELECT 1 AS ok
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'purchase_orders' AND INDEX_NAME = 'idx_purchase_orders_status'
     LIMIT 1`,
    [config.db.database]
  );
  if (!purchaseOrderStatusIdxRows.length) {
    await db.query('CREATE INDEX idx_purchase_orders_status ON purchase_orders (status)');
  }
  const [purchaseOrderBuyerIdxRows] = await db.query(
    `SELECT 1 AS ok
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'purchase_orders' AND INDEX_NAME = 'idx_purchase_orders_buyer'
     LIMIT 1`,
    [config.db.database]
  );
  if (!purchaseOrderBuyerIdxRows.length) {
    await db.query('CREATE INDEX idx_purchase_orders_buyer ON purchase_orders (assigned_buyer_id)');
  }

  const [purchaseItemColumnsRows] = await db.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'purchase_order_items'`,
    [config.db.database]
  );
  const purchaseItemColumns = new Set(purchaseItemColumnsRows.map((row) => row.COLUMN_NAME));
  if (!purchaseItemColumns.has('order_id')) {
    await db.query('ALTER TABLE purchase_order_items ADD COLUMN order_id INT NOT NULL AFTER id');
  }
  if (!purchaseItemColumns.has('product_id')) {
    await db.query('ALTER TABLE purchase_order_items ADD COLUMN product_id INT NULL AFTER order_id');
  }
  if (!purchaseItemColumns.has('barcode')) {
    await db.query("ALTER TABLE purchase_order_items ADD COLUMN barcode VARCHAR(80) NOT NULL DEFAULT '' AFTER product_id");
  }
  if (!purchaseItemColumns.has('description')) {
    await db.query("ALTER TABLE purchase_order_items ADD COLUMN description VARCHAR(255) NOT NULL DEFAULT '' AFTER barcode");
  }
  if (!purchaseItemColumns.has('requested_qty')) {
    await db.query('ALTER TABLE purchase_order_items ADD COLUMN requested_qty DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER description');
  }
  if (!purchaseItemColumns.has('received_qty')) {
    await db.query('ALTER TABLE purchase_order_items ADD COLUMN received_qty DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER requested_qty');
  }
  if (!purchaseItemColumns.has('requester_names')) {
    await db.query('ALTER TABLE purchase_order_items ADD COLUMN requester_names VARCHAR(255) NULL AFTER received_qty');
  }
  if (!purchaseItemColumns.has('last_requested_by_user_id')) {
    await db.query('ALTER TABLE purchase_order_items ADD COLUMN last_requested_by_user_id INT NULL AFTER requester_names');
  }
  if (!purchaseItemColumns.has('last_requested_by_name')) {
    await db.query('ALTER TABLE purchase_order_items ADD COLUMN last_requested_by_name VARCHAR(120) NULL AFTER last_requested_by_user_id');
  }
  const [purchaseItemUniqueRows] = await db.query(
    `SELECT 1 AS ok
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'purchase_order_items' AND INDEX_NAME = 'uq_purchase_order_item_barcode'
     LIMIT 1`,
    [config.db.database]
  );
  if (!purchaseItemUniqueRows.length) {
    await db.query('ALTER TABLE purchase_order_items ADD UNIQUE KEY uq_purchase_order_item_barcode (order_id, barcode)');
  }
  const [purchaseItemOrderIdxRows] = await db.query(
    `SELECT 1 AS ok
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'purchase_order_items' AND INDEX_NAME = 'idx_purchase_order_items_order'
     LIMIT 1`,
    [config.db.database]
  );
  if (!purchaseItemOrderIdxRows.length) {
    await db.query('CREATE INDEX idx_purchase_order_items_order ON purchase_order_items (order_id)');
  }
  const [purchaseItemProductIdxRows] = await db.query(
    `SELECT 1 AS ok
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'purchase_order_items' AND INDEX_NAME = 'idx_purchase_order_items_product'
     LIMIT 1`,
    [config.db.database]
  );
  if (!purchaseItemProductIdxRows.length) {
    await db.query('CREATE INDEX idx_purchase_order_items_product ON purchase_order_items (product_id)');
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_auth_sessions (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token_hash CHAR(64) NOT NULL,
      caja_id INT NULL,
      turno_id INT NULL,
      device_hash VARCHAR(64) NULL,
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME NULL,
      last_used_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_auth_token_hash (token_hash),
      INDEX idx_user_auth_user (user_id),
      INDEX idx_user_auth_expires (expires_at),
      INDEX idx_user_auth_revoked (revoked_at)
    )
  `);

  await db.query(
    `DELETE FROM user_auth_sessions
     WHERE revoked_at IS NOT NULL OR expires_at < (NOW() - INTERVAL 2 DAY)`
  );
}

app.use(async (req, res, next) => {
  if (!req.path.startsWith('/api/')) {
    return next();
  }
  if (req.method === 'OPTIONS' || isPublicRoute(req)) {
    return next();
  }

  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Token requerido' });
  }

  try {
    req.user = jwt.verify(token, config.jwtSecret);
    return next();
  } catch (err) {
    if (err?.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expirado', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ message: 'Token invalido', code: 'TOKEN_INVALID' });
  }
});

db.getConnection()
  .then(async (connection) => {
    console.log('Conexion exitosa a la base de datos.');
    connection.release();
    await ensureOperationalTables();
  })
  .catch((err) => {
    console.error('Error de conexion a la base de datos:', err);
  });

app.listen(config.apiPort, () => {
  console.log('El servidor se esta ejecutando en el puerto ', config.apiPort);
});

//---------------------------------------------------------------------------------
//----------------------Rutas del backend------------------------------------------

//----------------------------GETs-------------------------------------------------

// buscar todos los producto
app.get('/api/productos', async (req, res) => {
  try {
    const [results] = await db.query(
      `SELECT p.*,
              d.nombre AS departamento,
              s.name AS supplier_name
       FROM productos p
       LEFT JOIN departamento d ON d.id_departamento = p.id_departamento
       LEFT JOIN service_suppliers s ON s.id = p.supplier_id
       ORDER BY p.descripcion ASC`
    );
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/departamentos', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id_departamento, nombre
       FROM departamento
       ORDER BY nombre ASC`
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'No se pudieron cargar departamentos' });
  }
});

app.post('/api/departamentos', async (req, res) => {
  const name = toText(req.body?.nombre, 80);
  if (!name) {
    return res.status(400).json({ message: 'Nombre de departamento invalido' });
  }
  try {
    const [exists] = await db.query(
      'SELECT id_departamento FROM departamento WHERE LOWER(nombre) = LOWER(?) LIMIT 1',
      [name]
    );
    if (exists.length) {
      return res.status(200).json({ message: 'Departamento existente', id_departamento: exists[0].id_departamento });
    }
    const [result] = await db.query(
      'INSERT INTO departamento (nombre) VALUES (?)',
      [name]
    );
    return res.status(201).json({ message: 'Departamento creado', id_departamento: result.insertId });
  } catch (err) {
    return res.status(500).json({ message: 'No se pudo crear departamento' });
  }
});

// -----------------buscar toda la informacion del local
app.get('/api/getInfo', async (req, res) => {
  try {
    const [results] = await db.query(
      `SELECT * FROM info
       WHERE id_info = 1
       LIMIT 1`
    );
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------buscar todas las cajas del local
app.get('/api/getCajas', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM cajas ORDER BY n_caja ASC');
    if (results.length > 0) {
      res.json(results);
    } else {
      res.json(0);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/device-caja/resolve', async (req, res) => {
  const deviceHash = normalizeDeviceHash(req.query?.fingerprint);
  if (!deviceHash) {
    return res.status(400).json({ message: 'Fingerprint invalido' });
  }

  try {
    const [rows] = await db.query(
      `SELECT device_hash, numero_caja, nombre_caja
       FROM device_caja_bindings
       WHERE device_hash = ?
       LIMIT 1`,
      [deviceHash]
    );

    if (!rows.length) {
      return res.json({ found: false });
    }

    await db.query(
      'UPDATE device_caja_bindings SET last_seen = NOW() WHERE device_hash = ?',
      [deviceHash]
    );

    return res.json({
      found: true,
      numero_caja: Number(rows[0].numero_caja || 0),
      nombre_caja: rows[0].nombre_caja || '',
    });
  } catch (err) {
    console.error('Error al resolver caja por dispositivo:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.post('/api/device-caja/bind', async (req, res) => {
  const deviceHash = normalizeDeviceHash(req.body?.fingerprint);
  const cajaId = toInt(req.body?.numero_caja);
  const requestedName = typeof req.body?.nombre_caja === 'string' ? req.body.nombre_caja.trim() : '';
  const cajaName = requestedName || `Caja ${cajaId || ''}`.trim();

  if (!deviceHash || !isValidCajaNumber(cajaId)) {
    return res.status(400).json({ message: 'Datos incompletos o invalidos' });
  }

  try {
    await db.query(
      `INSERT INTO device_caja_bindings (device_hash, numero_caja, nombre_caja, source, last_seen)
       VALUES (?, ?, ?, 'api_bind', NOW())
       ON DUPLICATE KEY UPDATE
         numero_caja = VALUES(numero_caja),
         nombre_caja = VALUES(nombre_caja),
         source = 'api_bind',
         last_seen = NOW()`,
      [deviceHash, cajaId, cajaName]
    );

    return res.json({ success: true, numero_caja: cajaId, nombre_caja: cajaName });
  } catch (err) {
    console.error('Error al vincular dispositivo con caja:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.get('/api/usuarios', async (req, res) => {
  try {
    const [results] = await db.query(
      'SELECT id, nombre, user, estado_usuario, es_administrador FROM usuarios ORDER BY nombre ASC'
    );
    return res.json(results);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/cajeros', async (req, res) => {
  try {
    const selectPermissions = CASHIER_PERMISSION_FIELDS.map((field) => `p.\`${field}\``).join(', ');
    const [rows] = await db.query(
      `SELECT u.id, u.user, u.nombre, u.estado_usuario, u.es_administrador,
              ${selectPermissions}
       FROM usuarios u
       LEFT JOIN cajero_permisos p ON p.usuario_id = u.id
       ORDER BY u.es_administrador DESC, u.nombre ASC, u.id ASC`
    );
    const formatted = rows.map((row) => {
      const permissions = {};
      CASHIER_PERMISSION_FIELDS.forEach((field) => {
        permissions[field] = Number(row[field] || 0);
      });
      return {
        id: Number(row.id),
        user: row.user,
        nombre: row.nombre,
        estado_usuario: Number(row.estado_usuario || 0),
        es_administrador: Number(row.es_administrador || 0),
        permisos: permissions,
      };
    });
    return res.json(formatted);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/cajeros', async (req, res) => {
  const username = toText(req.body?.user, 80);
  const nombre = toText(req.body?.nombre, 120);
  const plainPassword = typeof req.body?.contrasena === 'string' ? req.body.contrasena : '';
  const estadoUsuario = normalizeBool(req.body?.estado_usuario, true) ? 1 : 0;
  const esAdministrador = normalizeBool(req.body?.es_administrador, false) ? 1 : 0;
  const permisos = buildCashierPermissions(req.body?.permisos || {});

  if (!username || !nombre || !plainPassword || plainPassword.length < 4) {
    return res.status(400).json({ error: 'Datos de cajero inválidos' });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [existsRows] = await connection.query('SELECT id FROM usuarios WHERE LOWER(user) = LOWER(?) LIMIT 1', [username]);
    if (existsRows.length) {
      await connection.rollback();
      return res.status(409).json({ error: 'El usuario ya existe' });
    }

    const hashed = await bcrypt.hash(plainPassword, 12);
    const [result] = await connection.query(
      'INSERT INTO usuarios (user, nombre, contrasena, estado_usuario, es_administrador) VALUES (?, ?, ?, ?, ?)',
      [username, nombre, hashed, estadoUsuario, esAdministrador]
    );
    const usuarioId = Number(result.insertId);

    const permissionColumns = CASHIER_PERMISSION_FIELDS.map((field) => `\`${field}\``).join(', ');
    const permissionPlaceholders = CASHIER_PERMISSION_FIELDS.map(() => '?').join(', ');
    const permissionValues = CASHIER_PERMISSION_FIELDS.map((field) => permisos[field]);

    await connection.query(
      `INSERT INTO cajero_permisos (
        usuario_id, ${permissionColumns}
      ) VALUES (?, ${permissionPlaceholders})`,
      [usuarioId, ...permissionValues]
    );

    await connection.commit();
    return res.status(201).json({ success: true, id: usuarioId });
  } catch (err) {
    if (connection) {
      try { await connection.rollback(); } catch (_) {}
    }
    return res.status(500).json({ error: err.message });
  } finally {
    if (connection) connection.release();
  }
});

app.put('/api/cajeros/:id', async (req, res) => {
  const userId = toInt(req.params?.id);
  const username = toText(req.body?.user, 80);
  const nombre = toText(req.body?.nombre, 120);
  const estadoUsuario = normalizeBool(req.body?.estado_usuario, true) ? 1 : 0;
  const esAdministrador = normalizeBool(req.body?.es_administrador, false) ? 1 : 0;
  const plainPassword = typeof req.body?.contrasena === 'string' ? req.body.contrasena : '';
  const permisos = buildCashierPermissions(req.body?.permisos || {});

  if (!userId || !username || !nombre) {
    return res.status(400).json({ error: 'Datos de cajero inválidos' });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [existsRows] = await connection.query('SELECT id FROM usuarios WHERE id = ? LIMIT 1', [userId]);
    if (!existsRows.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Cajero no encontrado' });
    }

    const [dupRows] = await connection.query('SELECT id FROM usuarios WHERE LOWER(user) = LOWER(?) AND id <> ? LIMIT 1', [username, userId]);
    if (dupRows.length) {
      await connection.rollback();
      return res.status(409).json({ error: 'El usuario ya existe' });
    }

    if (plainPassword && plainPassword.length < 4) {
      await connection.rollback();
      return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
    }

    if (plainPassword) {
      const hashed = await bcrypt.hash(plainPassword, 12);
      await connection.query(
        'UPDATE usuarios SET user = ?, nombre = ?, contrasena = ?, estado_usuario = ?, es_administrador = ? WHERE id = ?',
        [username, nombre, hashed, estadoUsuario, esAdministrador, userId]
      );
    } else {
      await connection.query(
        'UPDATE usuarios SET user = ?, nombre = ?, estado_usuario = ?, es_administrador = ? WHERE id = ?',
        [username, nombre, estadoUsuario, esAdministrador, userId]
      );
    }

    const permissionColumns = CASHIER_PERMISSION_FIELDS.map((field) => `\`${field}\``).join(', ');
    const permissionPlaceholders = CASHIER_PERMISSION_FIELDS.map(() => '?').join(', ');
    const permissionUpdates = CASHIER_PERMISSION_FIELDS.map((field) => `\`${field}\` = VALUES(\`${field}\`)`).join(', ');
    const permissionValues = CASHIER_PERMISSION_FIELDS.map((field) => permisos[field]);

    await connection.query(
      `INSERT INTO cajero_permisos (
        usuario_id, ${permissionColumns}
      ) VALUES (?, ${permissionPlaceholders})
      ON DUPLICATE KEY UPDATE
        ${permissionUpdates}`,
      [userId, ...permissionValues]
    );

    await connection.commit();
    return res.json({ success: true });
  } catch (err) {
    if (connection) {
      try { await connection.rollback(); } catch (_) {}
    }
    return res.status(500).json({ error: err.message });
  } finally {
    if (connection) connection.release();
  }
});

app.delete('/api/cajeros/:id', async (req, res) => {
  const userId = toInt(req.params?.id);
  if (!userId) {
    return res.status(400).json({ error: 'ID de cajero inválido' });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    await connection.query('DELETE FROM cajero_permisos WHERE usuario_id = ?', [userId]);
    const [result] = await connection.query('DELETE FROM usuarios WHERE id = ?', [userId]);
    if (!result.affectedRows) {
      await connection.rollback();
      return res.status(404).json({ error: 'Cajero no encontrado' });
    }
    await connection.commit();
    return res.json({ success: true });
  } catch (err) {
    if (connection) {
      try { await connection.rollback(); } catch (_) {}
    }
    return res.status(500).json({ error: err.message });
  } finally {
    if (connection) connection.release();
  }
});

app.get('/api/ticket-settings', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM ticket_settings WHERE id = 1 LIMIT 1');
    if (!rows.length) {
      return res.status(404).json({ message: 'Configuracion de ticket no disponible' });
    }
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ message: 'Error al obtener configuracion de ticket' });
  }
});

app.put('/api/ticket-settings', async (req, res) => {
  const payload = req.body || {};
  const ticketHeader = toText(payload.ticket_header ?? 'COMPROBANTE DE VENTA', 120) || 'COMPROBANTE DE VENTA';
  const ticketFooter = toText(payload.ticket_footer ?? 'Gracias por su compra', 255) || 'Gracias por su compra';
  const printerName = typeof payload.printer_name === 'string' ? payload.printer_name.trim() : '';
  const paperWidthMm = normalizeTicketPaperWidth(payload.paper_width_mm, 58);
  const columnsWidth = clampColumnsByPaper(payload.columns_width, paperWidthMm, paperWidthMm === 58 ? 30 : 42);
  const printEngine = normalizePrintEngine(payload.print_engine);
  const feedLines = normalizeFeedLines(payload.feed_lines_after_print);
  const showBusinessInfo = normalizeBool(payload.show_business_info, true);
  const showCashier = normalizeBool(payload.show_cashier, true);
  const showBox = normalizeBool(payload.show_box, true);
  const showPaymentMethod = normalizeBool(payload.show_payment_method, true);
  const showTicketNumber = normalizeBool(payload.show_ticket_number, true);
  const includeDetails = normalizeBool(payload.include_details_by_default, true);

  try {
    await db.query(
      `UPDATE ticket_settings
       SET ticket_header = ?, ticket_footer = ?, printer_name = ?, columns_width = ?, paper_width_mm = ?, print_engine = ?, feed_lines_after_print = ?,
           show_business_info = ?, show_cashier = ?, show_box = ?, show_payment_method = ?,
           show_ticket_number = ?, include_details_by_default = ?
       WHERE id = 1`,
      [
        ticketHeader,
        ticketFooter,
        printerName || null,
        columnsWidth,
        paperWidthMm,
        printEngine,
        feedLines,
        showBusinessInfo,
        showCashier,
        showBox,
        showPaymentMethod,
        showTicketNumber,
        includeDetails,
      ]
    );
    return res.json({ message: 'Configuracion de ticket actualizada' });
  } catch (err) {
    return res.status(500).json({ message: 'Error al guardar configuracion de ticket' });
  }
});

app.get('/api/folio-settings', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM folio_settings WHERE id = 1 LIMIT 1');
    if (!rows.length) {
      return res.status(404).json({ message: 'Configuracion de folio no disponible' });
    }
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ message: 'Error al obtener configuracion de folio' });
  }
});

app.put('/api/folio-settings', async (req, res) => {
  const payload = req.body || {};
  const prefix = normalizeFolioPrefix(payload.prefix);
  const digits = clampInt(payload.digits, 1, 8, 1);
  if (prefix === null) {
    return res.status(400).json({ message: 'Prefijo invalido. Solo se permiten hasta 2 letras.' });
  }

  try {
    await db.query(
      `UPDATE folio_settings
       SET prefix = ?, digits = ?
       WHERE id = 1`,
      [prefix, digits]
    );
    return res.json({ message: 'Configuracion de folio actualizada' });
  } catch (err) {
    return res.status(500).json({ message: 'Error al guardar configuracion de folio' });
  }
});

// -------------------- DTE (preparacion) --------------------
// Nota: endpoints desacoplados. No alteran el flujo actual de cobro/ventas.
app.get('/api/dte/config', async (_req, res) => {
  try {
    const configRow = await dteModule.getDteConfig(db);
    if (!configRow) {
      return res.status(404).json({ message: 'Configuracion DTE no disponible' });
    }
    return res.json(configRow);
  } catch (err) {
    console.error('Error obteniendo configuracion DTE:', err);
    return res.status(500).json({ message: 'Error al obtener configuracion DTE' });
  }
});

app.put('/api/dte/config', async (req, res) => {
  try {
    const updated = await dteModule.upsertDteConfig(db, req.body || {});
    return res.json({ success: true, config: updated });
  } catch (err) {
    if (err.code === 'INVALID_RUT') {
      return res.status(400).json({ message: err.message });
    }
    console.error('Error guardando configuracion DTE:', err);
    return res.status(500).json({ message: 'Error al guardar configuracion DTE' });
  }
});

app.post('/api/dte/drafts/from-sale', async (req, res) => {
  try {
    const draft = await dteModule.createDteDraftFromSale(db, req.body || {});
    return res.status(201).json({ success: true, draft });
  } catch (err) {
    if (err.code === 'INVALID_INPUT') {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ message: err.message });
    }
    console.error('Error creando borrador DTE:', err);
    return res.status(500).json({ message: 'Error al crear borrador DTE' });
  }
});

app.get('/api/dte/drafts', async (req, res) => {
  try {
    const rows = await dteModule.listDteDrafts(db, {
      estado: req.query?.estado,
      limit: req.query?.limit,
    });
    return res.json(rows);
  } catch (err) {
    console.error('Error listando borradores DTE:', err);
    return res.status(500).json({ message: 'Error al listar borradores DTE' });
  }
});

app.get('/api/dte/drafts/:id', async (req, res) => {
  const dteId = toInt(req.params?.id);
  if (!dteId) {
    return res.status(400).json({ message: 'ID DTE invalido' });
  }
  try {
    const detail = await dteModule.getDraftDetail(db, dteId);
    return res.json(detail);
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ message: err.message });
    }
    console.error('Error consultando detalle DTE:', err);
    return res.status(500).json({ message: 'Error al consultar detalle DTE' });
  }
});

app.post('/api/dte/drafts/:id/prepare', async (req, res) => {
  const dteId = toInt(req.params?.id);
  if (!dteId) {
    return res.status(400).json({ message: 'ID DTE invalido' });
  }
  try {
    const detail = await dteModule.prepareDraftXml(db, {
      dte_id: dteId,
      created_by: req.body?.created_by,
    });
    return res.json({ success: true, detail });
  } catch (err) {
    if (err.code === 'INVALID_INPUT' || err.code === 'INVALID_STATE') {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ message: err.message });
    }
    console.error('Error preparando XML DTE:', err);
    return res.status(500).json({ message: 'Error al preparar XML DTE' });
  }
});

app.post('/api/dte/drafts/:id/submit', async (req, res) => {
  const dteId = toInt(req.params?.id);
  if (!dteId) {
    return res.status(400).json({ message: 'ID DTE invalido' });
  }
  try {
    const detail = await dteModule.submitDraftToSii(db, {
      dte_id: dteId,
      simulate: req.body?.simulate,
      created_by: req.body?.created_by,
    });
    return res.json({ success: true, detail });
  } catch (err) {
    if (err.code === 'INVALID_INPUT' || err.code === 'INVALID_STATE' || err.code === 'CERT_REQUIRED') {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ message: err.message });
    }
    console.error('Error enviando DTE:', err);
    return res.status(500).json({ message: 'Error al enviar DTE' });
  }
});

app.post('/api/dte/drafts/:id/track', async (req, res) => {
  const dteId = toInt(req.params?.id);
  if (!dteId) {
    return res.status(400).json({ message: 'ID DTE invalido' });
  }
  try {
    const detail = await dteModule.refreshDraftTrack(db, {
      dte_id: dteId,
      simulate: req.body?.simulate,
      force_status: req.body?.force_status,
      created_by: req.body?.created_by,
    });
    return res.json({ success: true, detail });
  } catch (err) {
    if (err.code === 'INVALID_INPUT' || err.code === 'INVALID_STATE' || err.code === 'NOT_IMPLEMENTED') {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ message: err.message });
    }
    console.error('Error consultando track DTE:', err);
    return res.status(500).json({ message: 'Error al consultar track DTE' });
  }
});

app.post('/api/dte/drafts/:id/retry', async (req, res) => {
  const dteId = toInt(req.params?.id);
  if (!dteId) {
    return res.status(400).json({ message: 'ID DTE invalido' });
  }
  try {
    const detail = await dteModule.retryDraftSubmission(db, {
      dte_id: dteId,
      simulate: req.body?.simulate,
      created_by: req.body?.created_by,
    });
    return res.json({ success: true, detail });
  } catch (err) {
    if (err.code === 'INVALID_INPUT' || err.code === 'INVALID_STATE' || err.code === 'CERT_REQUIRED') {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ message: err.message });
    }
    console.error('Error reintentando envio DTE:', err);
    return res.status(500).json({ message: 'Error al reintentar envio DTE' });
  }
});

app.get('/api/dte/certificate', async (_req, res) => {
  try {
    const cert = await dteModule.getCertificateMetadata(db);
    if (!cert) {
      return res.status(404).json({ message: 'Certificado no disponible' });
    }
    return res.json(cert);
  } catch (err) {
    console.error('Error consultando certificado DTE:', err);
    return res.status(500).json({ message: 'Error al consultar certificado DTE' });
  }
});

app.put('/api/dte/certificate', async (req, res) => {
  try {
    const saved = await dteModule.saveCertificate(db, req.body || {}, {
      masterSecret: config.dte.certSecret,
    });
    return res.json({ success: true, certificate: saved });
  } catch (err) {
    if (err.code === 'INVALID_INPUT' || err.code === 'INVALID_CERT_FILE' || err.code === 'INVALID_CERT_PASSWORD') {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === 'CONFIG_ERROR') {
      return res.status(500).json({ message: 'Configuracion de seguridad DTE invalida' });
    }
    console.error('Error guardando certificado DTE:', err);
    return res.status(500).json({ message: 'Error al guardar certificado DTE' });
  }
});

app.delete('/api/dte/certificate', async (_req, res) => {
  try {
    const cert = await dteModule.removeCertificate(db);
    return res.json({ success: true, certificate: cert });
  } catch (err) {
    console.error('Error eliminando certificado DTE:', err);
    return res.status(500).json({ message: 'Error al eliminar certificado DTE' });
  }
});

app.post('/api/dte/certificate/verify-password', async (req, res) => {
  try {
    await dteModule.verifyStoredCertificatePassword(db, req.body || {}, {
      masterSecret: config.dte.certSecret,
    });
    return res.json({ success: true, valid: true });
  } catch (err) {
    if (err.code === 'INVALID_INPUT' || err.code === 'INVALID_CERT_PASSWORD') {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ message: err.message });
    }
    if (err.code === 'CONFIG_ERROR') {
      return res.status(500).json({ message: 'Configuracion de seguridad DTE invalida' });
    }
    console.error('Error verificando clave de certificado DTE:', err);
    return res.status(500).json({ message: 'Error al verificar clave del certificado' });
  }
});

app.post('/api/dte/print-test-58mm', async (_req, res) => {
  try {
    const [settingsRows] = await db.query('SELECT * FROM ticket_settings WHERE id = 1 LIMIT 1');
    if (!settingsRows.length) {
      return res.status(400).json({ message: 'No existe configuracion de ticket' });
    }
    const settings = settingsRows[0];
    const configuredPrinter = String(settings.printer_name || '').trim();
    if (!configuredPrinter) {
      return res.status(400).json({ message: 'No hay impresora configurada en el sistema' });
    }

    const [businessRows] = await db.query(
      `SELECT nombre, telefono, mail, tipo_local
       FROM info
       ORDER BY id_info DESC
       LIMIT 1`
    );
    const business = businessRows[0] || null;

    let dteConfig = null;
    try {
      dteConfig = await dteModule.getDteConfig(db);
    } catch (_) {
      dteConfig = null;
    }

    const now = new Date();
    const validationCode = `TST${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const qrPayload = `TEST-DTE|RUT:${String(dteConfig?.emisor_rut || '').trim() || 'SIN-RUT'}|PV:${String(dteConfig?.punto_venta || 'POS-01').trim()}|COD:${validationCode}`;
    const feedLines = normalizeFeedLines(settings.feed_lines_after_print);
    const dteProfile = getPrintProfile(configuredPrinter, settings.columns_width, settings.paper_width_mm);
    const ticketTextBase = buildDteTestTicket58mmText({
      settings,
      business,
      dteConfig,
      validationCode,
      qrPayload,
      columns: dteProfile.columns,
    });
    const ticketText = `${ticketTextBase}${'\r\n'.repeat(feedLines)}`;
    const tempFile = path.join(os.tmpdir(), `dte-test-58-${Date.now()}.txt`);
    await fs.writeFile(tempFile, ticketText, 'utf8');

    try {
      const printFontSize = dteProfile.fontSize;
      const gdiPrintCommand =
        `Add-Type -AssemblyName System.Drawing; ` +
        `$text = Get-Content -Raw -Encoding UTF8 -Path '${escapePsSingleQuoted(tempFile)}'; ` +
        `$pd = New-Object System.Drawing.Printing.PrintDocument; ` +
        `$pd.PrinterSettings.PrinterName = '${escapePsSingleQuoted(configuredPrinter)}'; ` +
        `if (-not $pd.PrinterSettings.IsValid) { throw 'Impresora no valida o no disponible'; } ` +
        `$handler = [System.Drawing.Printing.PrintPageEventHandler]{ ` +
        `param($sender,$e) ` +
        `$font = New-Object System.Drawing.Font('Consolas', ${printFontSize}); ` +
        `$brush = [System.Drawing.Brushes]::Black; ` +
        `$marginMm = 0; ` +
        `$x = [Math]::Round(($e.Graphics.DpiX / 25.4) * $marginMm); ` +
        `$y = 0; ` +
        `$e.Graphics.DrawString($text, $font, $brush, $x, $y); ` +
        `$e.HasMorePages = $false ` +
        `}; ` +
        `$pd.add_PrintPage($handler); ` +
        `$pd.Print();`;
      await runPowerShell(gdiPrintCommand);
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }

    return res.json({ success: true, message: 'Formato de prueba enviado a impresora', printer: configuredPrinter });
  } catch (err) {
    console.error('Error imprimiendo formato de prueba DTE 58mm:', err.message || err);
    return res.status(500).json({ message: 'No se pudo imprimir el formato de prueba' });
  }
});

app.get('/api/payment-settings', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT cash_strict_amount, usd_enabled, usd_exchange_rate, card_enabled,
              card_fee_enabled, card_fee_percent, transfer_enabled, check_enabled,
              voucher_enabled, mixed_enabled
       FROM personalization_settings
       WHERE id = 1
       LIMIT 1`
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Configuracion de formas de pago no disponible' });
    }
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ message: 'Error al obtener configuracion de formas de pago' });
  }
});

app.put('/api/payment-settings', async (req, res) => {
  const payload = req.body || {};
  const cashStrictAmount = normalizeBool(payload.cash_strict_amount, false);
  const usdEnabled = normalizeBool(payload.usd_enabled, false);
  const usdExchangeRateRaw = Number(payload.usd_exchange_rate);
  const usdExchangeRate = Number.isFinite(usdExchangeRateRaw) && usdExchangeRateRaw > 0 ? usdExchangeRateRaw : 950;
  const cardEnabled = normalizeBool(payload.card_enabled, true);
  const cardFeeEnabled = normalizeBool(payload.card_fee_enabled, false);
  const cardFeePercentRaw = Number(payload.card_fee_percent);
  const cardFeePercent = Number.isFinite(cardFeePercentRaw)
    ? Math.max(0, Math.min(100, cardFeePercentRaw))
    : 0;
  const transferEnabled = normalizeBool(payload.transfer_enabled, false);
  const checkEnabled = normalizeBool(payload.check_enabled, false);
  const voucherEnabled = normalizeBool(payload.voucher_enabled, false);
  const mixedEnabled = normalizeBool(payload.mixed_enabled, true);

  try {
    await db.query(
      `UPDATE personalization_settings
       SET cash_strict_amount = ?, usd_enabled = ?, usd_exchange_rate = ?,
           card_enabled = ?, card_fee_enabled = ?, card_fee_percent = ?,
           transfer_enabled = ?, check_enabled = ?, voucher_enabled = ?, mixed_enabled = ?
       WHERE id = 1`,
      [
        cashStrictAmount,
        usdEnabled,
        usdExchangeRate,
        cardEnabled,
        cardFeeEnabled,
        cardFeePercent,
        transferEnabled,
        checkEnabled,
        voucherEnabled,
        mixedEnabled,
      ]
    );
    return res.json({ message: 'Configuracion de formas de pago actualizada' });
  } catch (err) {
    return res.status(500).json({ message: 'Error al guardar configuracion de formas de pago' });
  }
});

app.get('/api/currency-settings', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT currency_symbol, thousands_separator, decimal_separator, currency_code, decimals
       FROM personalization_settings
       WHERE id = 1
       LIMIT 1`
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Configuracion de moneda no disponible' });
    }
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ message: 'Error al obtener configuracion de moneda' });
  }
});

app.put('/api/currency-settings', async (req, res) => {
  const payload = req.body || {};
  const rawSymbol = String(payload.currency_symbol || '$').trim();
  const rawThousands = String(payload.thousands_separator ?? '.').trim();
  const rawDecimal = String(payload.decimal_separator ?? ',').trim();
  const rawCode = String(payload.currency_code || 'CLP').trim().toUpperCase();
  const rawDecimals = Number.parseInt(payload.decimals, 10);

  const currencySymbol = rawSymbol.slice(0, 4) || '$';
  const thousandsSeparator = rawThousands.slice(0, 1) || '.';
  const decimalSeparator = rawDecimal.slice(0, 1) || ',';
  const currencyCode = rawCode.slice(0, 8) || 'CLP';
  const decimals = Number.isInteger(rawDecimals) ? Math.max(0, Math.min(4, rawDecimals)) : 0;

  if (thousandsSeparator === decimalSeparator) {
    return res.status(400).json({ message: 'Separador de miles y separador decimal no pueden ser iguales' });
  }

  try {
    await db.query(
      `UPDATE personalization_settings
       SET currency_symbol = ?, thousands_separator = ?, decimal_separator = ?, currency_code = ?, decimals = ?
       WHERE id = 1`,
      [currencySymbol, thousandsSeparator, decimalSeparator, currencyCode, decimals]
    );
    return res.json({ message: 'Configuracion de moneda actualizada' });
  } catch (err) {
    return res.status(500).json({ message: 'Error al guardar configuracion de moneda' });
  }
});

app.get('/api/unit-settings', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT enable_time, enable_weight, enable_volume, enable_length,
              enable_not_applicable, enable_piece, default_unit
       FROM personalization_settings
       WHERE id = 1
       LIMIT 1`
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Configuracion de unidades no disponible' });
    }
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ message: 'Error al obtener configuracion de unidades' });
  }
});

app.put('/api/unit-settings', async (req, res) => {
  const payload = req.body || {};
  const enableTime = normalizeBool(payload.enable_time, false);
  const enableWeight = normalizeBool(payload.enable_weight, true);
  const enableVolume = normalizeBool(payload.enable_volume, true);
  const enableLength = normalizeBool(payload.enable_length, false);
  const enableNotApplicable = normalizeBool(payload.enable_not_applicable, true);
  const enablePiece = normalizeBool(payload.enable_piece, true);
  const allowedDefaultUnits = new Set(['H_MIN', 'KG_G', 'L_ML', 'M_CM', 'NO_APLICA', 'PZA']);
  const requestedDefault = String(payload.default_unit || 'PZA').trim().toUpperCase();
  const defaultUnit = allowedDefaultUnits.has(requestedDefault) ? requestedDefault : 'PZA';

  try {
    await db.query(
      `UPDATE personalization_settings
       SET enable_time = ?, enable_weight = ?, enable_volume = ?, enable_length = ?,
           enable_not_applicable = ?, enable_piece = ?, default_unit = ?
       WHERE id = 1`,
      [enableTime, enableWeight, enableVolume, enableLength, enableNotApplicable, enablePiece, defaultUnit]
    );
    return res.json({ message: 'Configuracion de unidades actualizada' });
  } catch (err) {
    return res.status(500).json({ message: 'Error al guardar configuracion de unidades' });
  }
});

app.get('/api/tax-settings', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT tax_enabled, tax_name, tax_percent, prices_include_tax
       FROM personalization_settings
       WHERE id = 1
       LIMIT 1`
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Configuracion de impuestos no disponible' });
    }
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ message: 'Error al obtener configuracion de impuestos' });
  }
});

app.put('/api/tax-settings', async (req, res) => {
  const payload = req.body || {};
  const taxEnabled = normalizeBool(payload.tax_enabled, true);
  const taxName = String(payload.tax_name || 'IVA').trim().slice(0, 32) || 'IVA';
  const taxPercentRaw = Number(payload.tax_percent);
  const taxPercent = Number.isFinite(taxPercentRaw) ? Math.max(0, Math.min(100, taxPercentRaw)) : 19;
  const pricesIncludeTax = normalizeBool(payload.prices_include_tax, true);

  try {
    await db.query(
      `UPDATE personalization_settings
       SET tax_enabled = ?, tax_name = ?, tax_percent = ?, prices_include_tax = ?
       WHERE id = 1`,
      [taxEnabled, taxName, taxPercent, pricesIncludeTax]
    );
    return res.json({ message: 'Configuracion de impuestos actualizada' });
  } catch (err) {
    return res.status(500).json({ message: 'Error al guardar configuracion de impuestos' });
  }
});

app.get('/api/logo-settings', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT logo_data
       FROM personalization_settings
       WHERE id = 1
       LIMIT 1`
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Configuracion de logotipo no disponible' });
    }
    return res.json({ logo_data: rows[0].logo_data || null });
  } catch (err) {
    return res.status(500).json({ message: 'Error al obtener configuracion de logotipo' });
  }
});

app.put('/api/logo-settings', async (req, res) => {
  const logoData = typeof req.body?.logo_data === 'string' ? req.body.logo_data.trim() : '';
  if (!logoData) {
    return res.status(400).json({ message: 'Logotipo invalido' });
  }
  if (logoData.length > 800000) {
    return res.status(400).json({ message: 'El logotipo supera el tamano permitido' });
  }
  try {
    await db.query('UPDATE personalization_settings SET logo_data = ? WHERE id = 1', [logoData]);
    return res.json({ message: 'Logotipo actualizado' });
  } catch (err) {
    return res.status(500).json({ message: 'Error al guardar logotipo' });
  }
});

app.get('/api/scanner-settings', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT scanner_mode, serial_port, baud_rate, data_bits, parity, stop_bits, flow_control,
              scanner_suffix, scanner_prefix_to_strip, scanner_prefix_trim, scanner_only_numeric, scanner_auto_focus, scanner_beep_on_scan
       FROM device_settings
       WHERE id = 1
       LIMIT 1`
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Configuracion de lector no disponible' });
    }
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ message: 'Error al obtener configuracion de lector' });
  }
});

app.put('/api/scanner-settings', async (req, res) => {
  const payload = req.body || {};
  const scannerMode = String(payload.scanner_mode || 'keyboard') === 'serial' ? 'serial' : 'keyboard';
  const serialPort = String(payload.serial_port || '').trim().slice(0, 32) || null;
  const baudRate = clampInt(payload.baud_rate, 300, 115200, 9600);
  const dataBits = clampInt(payload.data_bits, 5, 9, 8);
  const parityRaw = String(payload.parity || 'none').trim().toLowerCase();
  const parity = new Set(['none', 'even', 'odd', 'mark', 'space']).has(parityRaw) ? parityRaw : 'none';
  const stopBitsRaw = String(payload.stop_bits || '1').trim();
  const stopBits = new Set(['1', '1.5', '2']).has(stopBitsRaw) ? stopBitsRaw : '1';
  const flowRaw = String(payload.flow_control || 'none').trim().toLowerCase();
  const flowControl = new Set(['none', 'xonxoff', 'rtscts']).has(flowRaw) ? flowRaw : 'none';
  const suffixRaw = String(payload.scanner_suffix || 'enter').trim().toLowerCase();
  const scannerSuffix = new Set(['enter', 'tab', 'none']).has(suffixRaw) ? suffixRaw : 'enter';
  const scannerPrefixToStrip = String(payload.scanner_prefix_to_strip || '').trim().slice(0, 16);
  const scannerPrefixTrim = normalizeBool(payload.scanner_prefix_trim, true);
  const scannerOnlyNumeric = normalizeBool(payload.scanner_only_numeric, true);
  const scannerAutoFocus = normalizeBool(payload.scanner_auto_focus, true);
  const scannerBeepOnScan = normalizeBool(payload.scanner_beep_on_scan, false);

  try {
    await db.query(
      `UPDATE device_settings
       SET scanner_mode = ?, serial_port = ?, baud_rate = ?, data_bits = ?, parity = ?, stop_bits = ?, flow_control = ?,
           scanner_suffix = ?, scanner_prefix_to_strip = ?, scanner_prefix_trim = ?, scanner_only_numeric = ?, scanner_auto_focus = ?, scanner_beep_on_scan = ?
       WHERE id = 1`,
      [
        scannerMode,
        serialPort,
        baudRate,
        dataBits,
        parity,
        stopBits,
        flowControl,
        scannerSuffix,
        scannerPrefixToStrip,
        scannerPrefixTrim,
        scannerOnlyNumeric,
        scannerAutoFocus,
        scannerBeepOnScan,
      ]
    );
    return res.json({ message: 'Configuracion de lector guardada' });
  } catch (err) {
    return res.status(500).json({ message: 'Error al guardar configuracion de lector' });
  }
});

app.get('/api/serial-ports', async (req, res) => {
  try {
    const raw = await runPowerShell('[System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object | ConvertTo-Json -Compress');
    const parsed = raw ? JSON.parse(raw) : [];
    const ports = (Array.isArray(parsed) ? parsed : [parsed])
      .map((p) => String(p || '').trim())
      .filter(Boolean);
    return res.json(ports);
  } catch (err) {
    return res.json([]);
  }
});

app.get('/api/cash-drawer-settings', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT drawer_enabled, drawer_connection, drawer_printer_name, drawer_serial_port, drawer_lpt_port,
              drawer_pulse_ms, drawer_open_on_cash, drawer_open_on_mixed_cash
       FROM device_settings
       WHERE id = 1
       LIMIT 1`
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Configuracion de cajon no disponible' });
    }
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ message: 'Error al obtener configuracion de cajon' });
  }
});

app.put('/api/cash-drawer-settings', async (req, res) => {
  const payload = req.body || {};
  const drawerEnabled = normalizeBool(payload.drawer_enabled, false);
  const connectionRaw = String(payload.drawer_connection || 'printer_usb').trim().toLowerCase();
  const drawerConnection = new Set(['printer_usb', 'serial', 'lpt']).has(connectionRaw) ? connectionRaw : 'printer_usb';
  const drawerPrinterName = String(payload.drawer_printer_name || '').trim().slice(0, 255) || null;
  const drawerSerialPort = String(payload.drawer_serial_port || '').trim().slice(0, 32) || null;
  const lptRaw = String(payload.drawer_lpt_port || 'LPT1').trim().toUpperCase();
  const drawerLptPort = /^LPT[1-9]$/.test(lptRaw) ? lptRaw : 'LPT1';
  const drawerPulseMs = clampInt(payload.drawer_pulse_ms, 50, 500, 120);
  const drawerOpenOnCash = normalizeBool(payload.drawer_open_on_cash, true);
  const drawerOpenOnMixedCash = normalizeBool(payload.drawer_open_on_mixed_cash, true);

  try {
    await db.query(
      `UPDATE device_settings
       SET drawer_enabled = ?, drawer_connection = ?, drawer_printer_name = ?, drawer_serial_port = ?, drawer_lpt_port = ?,
           drawer_pulse_ms = ?, drawer_open_on_cash = ?, drawer_open_on_mixed_cash = ?
       WHERE id = 1`,
      [
        drawerEnabled,
        drawerConnection,
        drawerPrinterName,
        drawerSerialPort,
        drawerLptPort,
        drawerPulseMs,
        drawerOpenOnCash,
        drawerOpenOnMixedCash,
      ]
    );
    return res.json({ message: 'Configuracion de cajon guardada' });
  } catch (err) {
    return res.status(500).json({ message: 'Error al guardar configuracion de cajon' });
  }
});

app.post('/api/cash-drawer/open-test', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT drawer_enabled, drawer_connection, drawer_printer_name, drawer_serial_port, drawer_lpt_port, drawer_pulse_ms
       FROM device_settings
       WHERE id = 1
       LIMIT 1`
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Configuracion de cajon no disponible' });
    }
    const settings = rows[0];
    if (!normalizeBool(settings.drawer_enabled, false)) {
      return res.status(400).json({ message: 'El cajon esta deshabilitado en configuracion' });
    }

    const pulseMs = clampInt(settings.drawer_pulse_ms, 50, 500, 120);
    const connection = String(settings.drawer_connection || 'printer_usb');

    let printerName = String(settings.drawer_printer_name || '').trim();
    if (!printerName) {
      const [ticketRows] = await db.query('SELECT printer_name FROM ticket_settings WHERE id = 1 LIMIT 1');
      printerName = String(ticketRows[0]?.printer_name || '').trim();
    }
    const message = await sendCashDrawerPulse({
      connectionType: connection,
      printerName,
      serialPort: String(settings.drawer_serial_port || '').trim(),
      pulseMs,
    });
    return res.json({ success: true, message });
  } catch (err) {
    return res.status(500).json({ message: `No se pudo abrir cajon: ${err.message}` });
  }
});

app.get('/api/cut-settings', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT cut_mode AS mode
       FROM personalization_settings
       WHERE id = 1
       LIMIT 1`
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Configuracion de corte no disponible' });
    }
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ message: 'Error al obtener configuracion de corte' });
  }
});

app.put('/api/cut-settings', async (req, res) => {
  const mode = req.body?.mode === 'sin_ajuste' ? 'sin_ajuste' : 'ajuste_auto';
  try {
    await db.query('UPDATE personalization_settings SET cut_mode = ? WHERE id = 1', [mode]);
    return res.json({ message: 'Configuracion de corte actualizada', mode });
  } catch (err) {
    return res.status(500).json({ message: 'Error al guardar configuracion de corte' });
  }
});

app.get('/api/purchase-settings', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT group_mode, default_buyer_id
       FROM purchase_settings
       WHERE id = 1
       LIMIT 1`
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Configuracion de compras no disponible' });
    }
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ message: 'Error al obtener configuracion de compras' });
  }
});

app.put('/api/purchase-settings', async (req, res) => {
  const mode = req.body?.group_mode === 'buyer' ? 'buyer' : 'supplier';
  const defaultBuyerIdRaw = toInt(req.body?.default_buyer_id);
  const defaultBuyerId = defaultBuyerIdRaw && defaultBuyerIdRaw > 0 ? defaultBuyerIdRaw : null;

  try {
    if (defaultBuyerId) {
      const [buyerRows] = await db.query('SELECT id FROM service_buyers WHERE id = ? LIMIT 1', [defaultBuyerId]);
      if (!buyerRows.length) {
        return res.status(400).json({ message: 'Encargado por defecto no valido' });
      }
    }
    await db.query('UPDATE purchase_settings SET group_mode = ?, default_buyer_id = ? WHERE id = 1', [mode, defaultBuyerId]);
    return res.json({ message: 'Configuracion de compras actualizada' });
  } catch (err) {
    return res.status(500).json({ message: 'Error al guardar configuracion de compras' });
  }
});

app.get('/api/service-suppliers', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name, contact_name, phone, email, notes, is_active
       FROM service_suppliers
       ORDER BY is_active DESC, name ASC, id ASC`
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: 'Error al listar proveedores' });
  }
});

app.post('/api/service-suppliers', async (req, res) => {
  const supplierId = toInt(req.body?.id);
  const name = toText(req.body?.name, 120);
  const contactName = typeof req.body?.contact_name === 'string' ? req.body.contact_name.trim().slice(0, 120) : null;
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim().slice(0, 40) : null;
  const emailRaw = typeof req.body?.email === 'string' ? req.body.email.trim().slice(0, 180) : '';
  const email = emailRaw || null;
  const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim().slice(0, 400) : null;

  if (!name) {
    return res.status(400).json({ message: 'Nombre de proveedor requerido' });
  }
  if (email && !isValidEmail(email)) {
    return res.status(400).json({ message: 'Correo de proveedor invalido' });
  }

  try {
    if (supplierId && supplierId > 0) {
      const [existsRows] = await db.query('SELECT id FROM service_suppliers WHERE id = ? LIMIT 1', [supplierId]);
      if (!existsRows.length) {
        return res.status(404).json({ message: 'Proveedor no encontrado' });
      }
      await db.query(
        `UPDATE service_suppliers
         SET name = ?, contact_name = ?, phone = ?, email = ?, notes = ?, is_active = 1
         WHERE id = ?`,
        [name, contactName, phone, email, notes, supplierId]
      );
      return res.json({ message: 'Proveedor actualizado', id: supplierId });
    }

    const [result] = await db.query(
      `INSERT INTO service_suppliers (name, contact_name, phone, email, notes, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [name, contactName, phone, email, notes]
    );
    return res.status(201).json({ message: 'Proveedor creado', id: Number(result.insertId) });
  } catch (err) {
    return res.status(500).json({ message: 'Error al guardar proveedor' });
  }
});

app.delete('/api/service-suppliers', async (req, res) => {
  const supplierId = toInt(req.query?.id);
  if (!supplierId) {
    return res.status(400).json({ message: 'Proveedor invalido' });
  }
  try {
    await db.query('UPDATE service_product_links SET supplier_id = NULL WHERE supplier_id = ?', [supplierId]);
    await db.query('DELETE FROM service_suppliers WHERE id = ?', [supplierId]);
    return res.json({ message: 'Proveedor eliminado' });
  } catch (err) {
    return res.status(500).json({ message: 'Error al eliminar proveedor' });
  }
});

app.get('/api/service-buyers', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name, contact_name, phone, email, notes, is_active
       FROM service_buyers
       ORDER BY is_active DESC, name ASC, id ASC`
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: 'Error al listar encargados' });
  }
});

app.post('/api/service-buyers', async (req, res) => {
  const buyerId = toInt(req.body?.id);
  const name = toText(req.body?.name, 120);
  const contactName = typeof req.body?.contact_name === 'string' ? req.body.contact_name.trim().slice(0, 120) : null;
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim().slice(0, 40) : null;
  const emailRaw = typeof req.body?.email === 'string' ? req.body.email.trim().slice(0, 180) : '';
  const email = emailRaw || null;
  const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim().slice(0, 400) : null;

  if (!name) {
    return res.status(400).json({ message: 'Nombre de encargado requerido' });
  }
  if (email && !isValidEmail(email)) {
    return res.status(400).json({ message: 'Correo de encargado invalido' });
  }

  try {
    if (buyerId && buyerId > 0) {
      const [existsRows] = await db.query('SELECT id FROM service_buyers WHERE id = ? LIMIT 1', [buyerId]);
      if (!existsRows.length) {
        return res.status(404).json({ message: 'Encargado no encontrado' });
      }
      await db.query(
        `UPDATE service_buyers
         SET name = ?, contact_name = ?, phone = ?, email = ?, notes = ?, is_active = 1
         WHERE id = ?`,
        [name, contactName, phone, email, notes, buyerId]
      );
      return res.json({ message: 'Encargado actualizado', id: buyerId });
    }

    const [result] = await db.query(
      `INSERT INTO service_buyers (name, contact_name, phone, email, notes, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [name, contactName, phone, email, notes]
    );
    return res.status(201).json({ message: 'Encargado creado', id: Number(result.insertId) });
  } catch (err) {
    return res.status(500).json({ message: 'Error al guardar encargado' });
  }
});

app.delete('/api/service-buyers', async (req, res) => {
  const buyerId = toInt(req.query?.id);
  if (!buyerId) {
    return res.status(400).json({ message: 'Encargado invalido' });
  }
  try {
    await db.query('UPDATE service_product_links SET buyer_id = NULL WHERE buyer_id = ?', [buyerId]);
    await db.query('UPDATE purchase_settings SET default_buyer_id = NULL WHERE default_buyer_id = ?', [buyerId]);
    await db.query('DELETE FROM service_buyers WHERE id = ?', [buyerId]);
    return res.json({ message: 'Encargado eliminado' });
  } catch (err) {
    return res.status(500).json({ message: 'Error al eliminar encargado' });
  }
});

app.get('/api/service-product-links', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT l.id, l.barcode, l.product_ref, l.supplier_id, l.buyer_id, l.min_stock, l.target_stock, l.notes,
              s.name AS supplier_name, b.name AS buyer_name
       FROM service_product_links l
       LEFT JOIN service_suppliers s ON s.id = l.supplier_id
       LEFT JOIN service_buyers b ON b.id = l.buyer_id
       ORDER BY l.id ASC`
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: 'Error al listar asignaciones de productos' });
  }
});

app.post('/api/service-product-links', async (req, res) => {
  const linkId = toInt(req.body?.id);
  const barcode = toText(req.body?.barcode, 64);
  const productRef = typeof req.body?.product_ref === 'string' ? req.body.product_ref.trim().slice(0, 160) : null;
  const supplierIdRaw = toInt(req.body?.supplier_id);
  const buyerIdRaw = toInt(req.body?.buyer_id);
  const supplierId = supplierIdRaw && supplierIdRaw > 0 ? supplierIdRaw : null;
  const buyerId = buyerIdRaw && buyerIdRaw > 0 ? buyerIdRaw : null;
  const minStock = Math.max(0, Number(req.body?.min_stock || 0));
  const targetStock = Math.max(0, Number(req.body?.target_stock || 0));
  const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim().slice(0, 255) : null;

  if (!barcode) {
    return res.status(400).json({ message: 'Codigo de barras requerido' });
  }
  if (supplierId) {
    const [supplierRows] = await db.query('SELECT id FROM service_suppliers WHERE id = ? LIMIT 1', [supplierId]);
    if (!supplierRows.length) {
      return res.status(400).json({ message: 'Proveedor no valido' });
    }
  }
  if (buyerId) {
    const [buyerRows] = await db.query('SELECT id FROM service_buyers WHERE id = ? LIMIT 1', [buyerId]);
    if (!buyerRows.length) {
      return res.status(400).json({ message: 'Encargado no valido' });
    }
  }

  try {
    if (linkId && linkId > 0) {
      const [existsRows] = await db.query('SELECT id FROM service_product_links WHERE id = ? LIMIT 1', [linkId]);
      if (!existsRows.length) {
        return res.status(404).json({ message: 'Asignacion no encontrada' });
      }
      await db.query(
        `UPDATE service_product_links
         SET barcode = ?, product_ref = ?, supplier_id = ?, buyer_id = ?, min_stock = ?, target_stock = ?, notes = ?
         WHERE id = ?`,
        [barcode, productRef, supplierId, buyerId, minStock, targetStock, notes, linkId]
      );
      return res.json({ message: 'Asignacion actualizada', id: linkId });
    }

    const [result] = await db.query(
      `INSERT INTO service_product_links (barcode, product_ref, supplier_id, buyer_id, min_stock, target_stock, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         product_ref = VALUES(product_ref),
         supplier_id = VALUES(supplier_id),
         buyer_id = VALUES(buyer_id),
         min_stock = VALUES(min_stock),
         target_stock = VALUES(target_stock),
         notes = VALUES(notes)`,
      [barcode, productRef, supplierId, buyerId, minStock, targetStock, notes]
    );
    return res.status(201).json({ message: 'Asignacion guardada', id: Number(result.insertId || 0) });
  } catch (err) {
    return res.status(500).json({ message: 'Error al guardar asignacion' });
  }
});

app.delete('/api/service-product-links', async (req, res) => {
  const linkId = toInt(req.query?.id);
  if (!linkId) {
    return res.status(400).json({ message: 'Asignacion invalida' });
  }
  try {
    await db.query('DELETE FROM service_product_links WHERE id = ?', [linkId]);
    return res.json({ message: 'Asignacion eliminada' });
  } catch (err) {
    return res.status(500).json({ message: 'Error al eliminar asignacion' });
  }
});

app.get('/api/purchase-list-preview', async (req, res) => {
  try {
    const requestedMode = req.query?.mode === 'buyer' ? 'buyer' : 'supplier';
    const groups = await buildPurchasePreviewRows(requestedMode);
    return res.json({ mode: requestedMode, groups });
  } catch (err) {
    return res.status(500).json({ message: 'Error al construir vista previa de compra' });
  }
});

app.get('/api/service-email-settings', async (req, res) => {
  try {
    const row = await getServiceEmailSettings();
    if (!row) {
      return res.status(404).json({ message: 'Configuracion de correo no disponible' });
    }
    return res.json({
      enabled: Number(row.enabled || 0),
      smtp_host: row.smtp_host || '',
      smtp_port: Number(row.smtp_port || 587),
      smtp_secure: Number(row.smtp_secure || 0),
      smtp_user: row.smtp_user || '',
      smtp_pass: row.smtp_pass || '',
      from_email: row.from_email || '',
      from_name: row.from_name || '',
      owner_email: row.owner_email || '',
      cc_emails: row.cc_emails || '',
    });
  } catch (err) {
    return res.status(500).json({ message: 'Error al cargar configuracion de correo' });
  }
});

app.put('/api/service-email-settings', async (req, res) => {
  const enabled = normalizeBool(req.body?.enabled, false) ? 1 : 0;
  const smtpHost = typeof req.body?.smtp_host === 'string' ? req.body.smtp_host.trim().slice(0, 120) : null;
  const smtpPort = clampInt(req.body?.smtp_port, 1, 65535, 587);
  const smtpSecure = normalizeBool(req.body?.smtp_secure, false) ? 1 : 0;
  const smtpUser = typeof req.body?.smtp_user === 'string' ? req.body.smtp_user.trim().slice(0, 180) : null;
  const smtpPass = typeof req.body?.smtp_pass === 'string' ? req.body.smtp_pass.trim().slice(0, 220) : null;
  const fromEmailRaw = typeof req.body?.from_email === 'string' ? req.body.from_email.trim().slice(0, 180) : '';
  const fromEmail = fromEmailRaw || null;
  const fromName = typeof req.body?.from_name === 'string' ? req.body.from_name.trim().slice(0, 120) : null;
  const ownerEmailRaw = typeof req.body?.owner_email === 'string' ? req.body.owner_email.trim().slice(0, 180) : '';
  const ownerEmail = ownerEmailRaw || null;
  const ccList = parseEmailList(typeof req.body?.cc_emails === 'string' ? req.body.cc_emails : '', 20);
  const ccEmails = ccList.length ? ccList.join(', ') : null;

  if (fromEmail && !isValidEmail(fromEmail)) {
    return res.status(400).json({ message: 'Correo emisor invalido' });
  }
  if (ownerEmail && !isValidEmail(ownerEmail)) {
    return res.status(400).json({ message: 'Correo del dueno invalido' });
  }

  try {
    await db.query(
      `UPDATE service_email_settings
       SET enabled = ?, smtp_host = ?, smtp_port = ?, smtp_secure = ?, smtp_user = ?, smtp_pass = ?,
           from_email = ?, from_name = ?, owner_email = ?, cc_emails = ?
       WHERE id = 1`,
      [enabled, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, fromEmail, fromName, ownerEmail, ccEmails]
    );
    if (fromEmail) {
      await db.query(
        `UPDATE info
         SET mail = ?
         WHERE id_info = 1`,
        [fromEmail]
      );
    }
    return res.json({ message: 'Configuracion de correo guardada' });
  } catch (err) {
    return res.status(500).json({ message: 'Error al guardar configuracion de correo' });
  }
});

app.post('/api/service-email-settings/test', async (req, res) => {
  try {
    const row = await getServiceEmailSettings();
    if (!row) {
      return res.status(404).json({ message: 'Configuracion de correo no disponible' });
    }
    const mailConfig = buildTransportConfigFromServiceEmail(row);
    if (!mailConfig) {
      return res.status(400).json({ message: 'Configura SMTP completo antes de probar' });
    }

    const targetRaw = typeof req.body?.to === 'string' ? req.body.to.trim() : '';
    const to = isValidEmail(targetRaw) ? targetRaw : String(row.owner_email || '').trim();
    if (!isValidEmail(to)) {
      return res.status(400).json({ message: 'Correo destino de prueba invalido' });
    }
    const subject = String(req.body?.subject || 'Prueba de correo Minimarket').trim().slice(0, 180) || 'Prueba de correo Minimarket';
    const message = String(req.body?.message || 'Este es un correo de prueba.').trim().slice(0, 1200) || 'Este es un correo de prueba.';
    const cc = parseEmailList(String(row.cc_emails || ''), 20);

    let nodemailer;
    try {
      nodemailer = require('nodemailer');
    } catch (_) {
      return res.status(500).json({ message: 'Falta dependencia nodemailer en el servidor' });
    }
    const transport = nodemailer.createTransport({
      host: mailConfig.host,
      port: mailConfig.port,
      secure: mailConfig.secure,
      auth: mailConfig.auth,
    });

    await transport.sendMail({
      from: mailConfig.from,
      to,
      cc: cc.length ? cc.join(', ') : undefined,
      subject,
      text: `${message}\n\nEnviado desde Minimarket (${new Date().toLocaleString('es-CL')}).`,
    });
    return res.json({ message: `Correo de prueba enviado a ${to}` });
  } catch (err) {
    const detail = String(err?.message || '').trim();
    const suffix = detail ? `: ${detail}` : '';
    return res.status(500).json({ message: `No se pudo enviar correo de prueba${suffix}` });
  }
});

app.post('/api/purchase-list/email-preview', async (req, res) => {
  try {
    const row = await getServiceEmailSettings();
    if (!row) {
      return res.status(404).json({ message: 'Configuracion de correo no disponible' });
    }
    const mailConfig = buildTransportConfigFromServiceEmail(row);
    if (!mailConfig) {
      return res.status(400).json({ message: 'Configura SMTP completo antes de enviar' });
    }
    const requestedMode = req.body?.mode === 'buyer' ? 'buyer' : 'supplier';
    const groups = await buildPurchasePreviewRows(requestedMode);
    if (!groups.length) {
      return res.status(400).json({ message: 'No hay faltantes para enviar en la lista de compra' });
    }

    const targetRaw = typeof req.body?.to === 'string' ? req.body.to.trim() : '';
    const to = isValidEmail(targetRaw) ? targetRaw : String(row.owner_email || '').trim();
    if (!isValidEmail(to)) {
      return res.status(400).json({ message: 'Correo destino invalido' });
    }
    const cc = parseEmailList(String(row.cc_emails || ''), 20);

    const lines = [];
    lines.push('Lista de compra (vista previa)');
    lines.push(`Modo: ${requestedMode === 'buyer' ? 'Encargado de compra' : 'Proveedor'}`);
    lines.push(`Fecha: ${new Date().toLocaleString('es-CL')}`);
    lines.push('');
    groups.forEach((group) => {
      lines.push(`=== ${group.group_name} ===`);
      group.items.forEach((item) => {
        lines.push(`- ${item.product_ref} | Codigo: ${item.barcode} | Sugerido: ${item.suggest_qty}`);
      });
      lines.push('');
    });

    let nodemailer;
    try {
      nodemailer = require('nodemailer');
    } catch (_) {
      return res.status(500).json({ message: 'Falta dependencia nodemailer en el servidor' });
    }
    const transport = nodemailer.createTransport({
      host: mailConfig.host,
      port: mailConfig.port,
      secure: mailConfig.secure,
      auth: mailConfig.auth,
    });
    await transport.sendMail({
      from: mailConfig.from,
      to,
      cc: cc.length ? cc.join(', ') : undefined,
      subject: `Lista de compra de prueba - ${new Date().toLocaleDateString('es-CL')}`,
      text: lines.join('\n'),
    });

    return res.json({ message: `Prueba de lista de compra enviada a ${to}` });
  } catch (err) {
    const detail = String(err?.message || '').trim();
    const suffix = detail ? `: ${detail}` : '';
    return res.status(500).json({ message: `No se pudo enviar prueba de lista de compra${suffix}` });
  }
});

app.get('/api/purchase-order/active', async (req, res) => {
  try {
    const order = await getActivePurchaseOrder();
    if (!order) {
      return res.json({ order: null, items: [] });
    }
    const [orderRows] = await db.query(
      `SELECT o.id, o.status, o.assigned_buyer_id, o.assigned_by_user_id, o.assigned_by_name, o.assignment_note, o.assignment_sent_at,
              b.name AS assigned_buyer_name, b.email AS assigned_buyer_email
       FROM purchase_orders o
       LEFT JOIN service_buyers b ON b.id = o.assigned_buyer_id
       WHERE o.id = ?
       LIMIT 1`,
      [order.id]
    );
    const [itemRows] = await db.query(
      `SELECT i.id, i.order_id, i.product_id, i.barcode, i.description, i.requested_qty, i.received_qty,
              i.requester_names, i.last_requested_by_user_id, i.last_requested_by_name,
              p.utiliza_inventario, p.cantidad_actual
       FROM purchase_order_items i
       LEFT JOIN productos p ON p.id_producto = i.product_id
       WHERE i.order_id = ?
       ORDER BY i.id ASC`,
      [order.id]
    );
    return res.json({
      order: orderRows[0] || order,
      items: itemRows,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Error al cargar orden de compra activa' });
  }
});

app.post('/api/purchase-order/create', async (req, res) => {
  try {
    const order = await createPurchaseOrder();
    return res.json({ message: 'Orden de compra activa lista', order });
  } catch (err) {
    return res.status(500).json({ message: 'No se pudo crear la orden de compra' });
  }
});

app.post('/api/purchase-order/close', async (req, res) => {
  const orderId = toInt(req.body?.order_id);
  const forceClose = Number(req.body?.force_close || 0) === 1;
  try {
    const targetOrderId = orderId || (await getActivePurchaseOrder())?.id;
    if (!targetOrderId) {
      return res.status(404).json({ message: 'No hay orden para cerrar' });
    }
    const [missingRows] = await db.query(
      `SELECT barcode, description, requested_qty, received_qty, (requested_qty - received_qty) AS pending_qty
       FROM purchase_order_items
       WHERE order_id = ? AND (requested_qty - received_qty) > 0
       ORDER BY id ASC`,
      [targetOrderId]
    );
    if (missingRows.length && !forceClose) {
      return res.status(409).json({
        message: 'Aún faltan productos por ingresar en este pedido.',
        missing_items: missingRows,
      });
    }
    await db.query(
      `UPDATE purchase_orders
       SET status = 'completed',
           reception_closed_at = NOW(),
           reception_result = ?
       WHERE id = ?`,
      [missingRows.length ? 'incomplete' : 'complete', targetOrderId]
    );
    return res.json({
      message: `Orden #${targetOrderId} cerrada`,
      missing_items: missingRows,
    });
  } catch (err) {
    return res.status(500).json({ message: 'No se pudo cerrar la orden de compra' });
  }
});

app.get('/api/purchase-orders/summary', async (req, res) => {
  try {
    const [pendingRows] = await db.query(
      `SELECT s.id, s.status, s.created_at, s.updated_at, s.assignment_sent_at,
              s.reception_closed_at, s.reception_result,
              s.items_count, s.requested_qty, s.received_qty
       FROM (
         SELECT o.id, o.status, o.created_at, o.updated_at, o.assignment_sent_at, o.reception_closed_at, o.reception_result,
                COUNT(i.id) AS items_count,
                COALESCE(SUM(i.requested_qty), 0) AS requested_qty,
                COALESCE(SUM(i.received_qty), 0) AS received_qty
         FROM purchase_orders o
         INNER JOIN purchase_order_items i ON i.order_id = o.id
         WHERE o.assignment_sent_at IS NOT NULL
         GROUP BY o.id, o.status, o.created_at, o.updated_at, o.assignment_sent_at, o.reception_closed_at, o.reception_result
       ) s
       WHERE s.reception_closed_at IS NULL
       ORDER BY s.id DESC
       LIMIT 100`
    );
    const [closedRows] = await db.query(
      `SELECT s.id, s.status, s.created_at, s.updated_at, s.assignment_sent_at,
              s.reception_closed_at, s.reception_result,
              s.items_count, s.requested_qty, s.received_qty
       FROM (
         SELECT o.id, o.status, o.created_at, o.updated_at, o.assignment_sent_at, o.reception_closed_at, o.reception_result,
                COUNT(i.id) AS items_count,
                COALESCE(SUM(i.requested_qty), 0) AS requested_qty,
                COALESCE(SUM(i.received_qty), 0) AS received_qty
         FROM purchase_orders o
         INNER JOIN purchase_order_items i ON i.order_id = o.id
         WHERE o.assignment_sent_at IS NOT NULL
         GROUP BY o.id, o.status, o.created_at, o.updated_at, o.assignment_sent_at, o.reception_closed_at, o.reception_result
       ) s
       WHERE s.reception_closed_at IS NOT NULL
       ORDER BY s.id DESC
       LIMIT 100`
    );
    return res.json({
      pending_orders: pendingRows,
      closed_orders: closedRows,
    });
  } catch (err) {
    return res.status(500).json({ message: 'No se pudo cargar el resumen de solicitudes de compra' });
  }
});

app.get('/api/purchase-order/:id/detail', async (req, res) => {
  const orderId = toInt(req.params?.id);
  if (!orderId) {
    return res.status(400).json({ message: 'Orden inválida' });
  }
  try {
    const [orderRows] = await db.query(
      `SELECT o.id, o.status, o.created_at, o.updated_at, o.assignment_sent_at, o.reception_closed_at, o.reception_result,
              o.assigned_buyer_id, b.name AS assigned_buyer_name, b.email AS assigned_buyer_email
       FROM purchase_orders o
       LEFT JOIN service_buyers b ON b.id = o.assigned_buyer_id
       WHERE o.id = ?
       LIMIT 1`,
      [orderId]
    );
    if (!orderRows.length) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }
    const [itemRows] = await db.query(
      `SELECT i.id, i.order_id, i.product_id, i.barcode, i.description, i.requested_qty, i.received_qty,
              i.requester_names, i.last_requested_by_name,
              p.utiliza_inventario, p.cantidad_actual
       FROM purchase_order_items i
       LEFT JOIN productos p ON p.id_producto = i.product_id
       WHERE i.order_id = ?
       ORDER BY i.id ASC`,
      [orderId]
    );
    return res.json({
      order: orderRows[0],
      items: itemRows,
    });
  } catch (err) {
    return res.status(500).json({ message: 'No se pudo cargar detalle de la orden' });
  }
});

app.post('/api/purchase-order/items', async (req, res) => {
  const barcode = toText(req.body?.barcode, 80);
  const descriptionInput = toText(req.body?.description, 255);
  const qty = Number(req.body?.qty || 0);
  const replaceQtyRaw = req.body?.replace_qty;
  const replaceQty = Number(replaceQtyRaw);
  const hasReplaceQty = Number.isFinite(replaceQtyRaw === null || typeof replaceQtyRaw === 'undefined' ? NaN : replaceQty);
  if (!barcode || ((!Number.isFinite(qty) || qty <= 0) && (!hasReplaceQty || replaceQty <= 0))) {
    return res.status(400).json({ message: 'Codigo y cantidad son obligatorios' });
  }

  try {
    const order = await getActivePurchaseOrder();
    if (!order) {
      return res.status(400).json({ message: 'No hay una orden activa. Crea una nueva orden de compra.' });
    }
    const userId = toInt(req.user?.sub) || null;
    let requesterName = '';
    if (userId) {
      const [userRows] = await db.query('SELECT nombre FROM usuarios WHERE id = ? LIMIT 1', [userId]);
      requesterName = String(userRows[0]?.nombre || '').trim();
    }
    const [productRows] = await db.query(
      `SELECT id_producto, descripcion
       FROM productos
       WHERE TRIM(codigo_barras) = TRIM(?)
       LIMIT 1`,
      [barcode]
    );
    const productId = Number(productRows[0]?.id_producto || 0) || null;
    const description = descriptionInput || String(productRows[0]?.descripcion || '').trim() || barcode;

    const [existingRows] = await db.query(
      `SELECT id, requester_names
       FROM purchase_order_items
       WHERE order_id = ? AND barcode = ?
       LIMIT 1`,
      [order.id, barcode]
    );

    if (existingRows.length) {
      const itemId = Number(existingRows[0].id);
      const mergedRequesters = mergeRequesterNames(existingRows[0].requester_names, requesterName);
      if (hasReplaceQty && replaceQty > 0) {
        await db.query(
          `UPDATE purchase_order_items
           SET requested_qty = ?, description = ?, product_id = COALESCE(?, product_id),
               requester_names = ?, last_requested_by_user_id = ?, last_requested_by_name = ?
           WHERE id = ?`,
          [replaceQty, description, productId, mergedRequesters || null, userId, requesterName || null, itemId]
        );
      } else {
        await db.query(
          `UPDATE purchase_order_items
           SET requested_qty = requested_qty + ?, description = ?, product_id = COALESCE(?, product_id),
               requester_names = ?, last_requested_by_user_id = ?, last_requested_by_name = ?
           WHERE id = ?`,
          [qty, description, productId, mergedRequesters || null, userId, requesterName || null, itemId]
        );
      }
    } else {
      const firstQty = hasReplaceQty && replaceQty > 0 ? replaceQty : qty;
      await db.query(
        `INSERT INTO purchase_order_items (
          order_id, product_id, barcode, description, requested_qty, received_qty,
          requester_names, last_requested_by_user_id, last_requested_by_name
        ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
        [order.id, productId, barcode, description, firstQty, requesterName || null, userId, requesterName || null]
      );
    }

    const [itemRows] = await db.query(
      `SELECT i.id, i.order_id, i.product_id, i.barcode, i.description, i.requested_qty, i.received_qty,
              i.requester_names, i.last_requested_by_user_id, i.last_requested_by_name,
              p.utiliza_inventario, p.cantidad_actual
       FROM purchase_order_items i
       LEFT JOIN productos p ON p.id_producto = i.product_id
       WHERE i.order_id = ?
       ORDER BY i.id ASC`,
      [order.id]
    );

    return res.json({
      message: 'Producto agregado a la orden de compra',
      order: order,
      items: itemRows,
    });
  } catch (err) {
    const detail = String(err?.message || '').trim();
    console.error('Error agregando item a orden de compra:', err);
    return res.status(500).json({ message: detail ? `Error al agregar producto a la orden de compra: ${detail}` : 'Error al agregar producto a la orden de compra' });
  }
});

app.delete('/api/purchase-order/items/:itemId', async (req, res) => {
  const itemId = toInt(req.params?.itemId);
  if (!itemId) {
    return res.status(400).json({ message: 'Item inválido para eliminar' });
  }

  try {
    const order = await getActivePurchaseOrder();
    if (!order) {
      return res.status(400).json({ message: 'No hay una orden activa para modificar.' });
    }

    const [rows] = await db.query(
      `SELECT id
       FROM purchase_order_items
       WHERE id = ? AND order_id = ?
       LIMIT 1`,
      [itemId, order.id]
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'El producto no existe en la orden activa.' });
    }

    await db.query(
      'DELETE FROM purchase_order_items WHERE id = ? AND order_id = ?',
      [itemId, order.id]
    );

    const [itemRows] = await db.query(
      `SELECT i.id, i.order_id, i.product_id, i.barcode, i.description, i.requested_qty, i.received_qty,
              i.requester_names, i.last_requested_by_user_id, i.last_requested_by_name,
              p.utiliza_inventario, p.cantidad_actual
       FROM purchase_order_items i
       LEFT JOIN productos p ON p.id_producto = i.product_id
       WHERE i.order_id = ?
       ORDER BY i.id ASC`,
      [order.id]
    );

    return res.json({
      message: 'Producto eliminado de la orden activa',
      order,
      items: itemRows,
    });
  } catch (err) {
    console.error('Error eliminando item de orden activa:', err);
    return res.status(500).json({ message: 'No se pudo eliminar el producto de la orden activa' });
  }
});

app.post('/api/purchase-order/assign-email', async (req, res) => {
  const buyerId = toInt(req.body?.buyer_id);
  const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 255) : null;
  if (!buyerId) {
    return res.status(400).json({ message: 'Selecciona un encargado de compra' });
  }

  try {
    const [buyerRows] = await db.query('SELECT id, name, email FROM service_buyers WHERE id = ? LIMIT 1', [buyerId]);
    if (!buyerRows.length) {
      return res.status(404).json({ message: 'Encargado no encontrado' });
    }
    const buyer = buyerRows[0];
    const buyerEmail = String(buyer.email || '').trim();
    if (!isValidEmail(buyerEmail)) {
      return res.status(400).json({ message: 'El encargado seleccionado no tiene un correo valido' });
    }

    const order = await getActivePurchaseOrder();
    if (!order) {
      return res.status(400).json({ message: 'No hay una orden activa para asignar y enviar.' });
    }
    const [itemsRows] = await db.query(
      `SELECT barcode, description, requested_qty, received_qty, requester_names
       FROM purchase_order_items
       WHERE order_id = ?
       ORDER BY id ASC`,
      [order.id]
    );
    const pendingItems = itemsRows.filter((row) => Number(row.requested_qty || 0) - Number(row.received_qty || 0) > 0);
    if (!pendingItems.length) {
      return res.status(400).json({ message: 'No hay productos pendientes en la orden de compra' });
    }

    const mailSettings = await getServiceEmailSettings();
    const mailConfig = buildTransportConfigFromServiceEmail(mailSettings);
    if (!mailConfig) {
      return res.status(400).json({ message: 'Configura SMTP en Notificar correo antes de enviar' });
    }

    const userId = toInt(req.user?.sub) || null;
    let requesterName = '';
    if (userId) {
      const [userRows] = await db.query('SELECT nombre FROM usuarios WHERE id = ? LIMIT 1', [userId]);
      requesterName = String(userRows[0]?.nombre || '').trim();
    }

    let nodemailer;
    try {
      nodemailer = require('nodemailer');
    } catch (_) {
      return res.status(500).json({ message: 'Falta dependencia nodemailer en el servidor' });
    }
    const transport = nodemailer.createTransport({
      host: mailConfig.host,
      port: mailConfig.port,
      secure: mailConfig.secure,
      auth: mailConfig.auth,
    });

    const lines = [];
    lines.push(`Orden de compra activa #${order.id}`);
    lines.push(`Fecha: ${new Date().toLocaleString('es-CL')}`);
    lines.push(`Solicitada por: ${requesterName || 'Usuario del sistema'}`);
    lines.push('');
    if (note) {
      lines.push(`Observacion: ${note}`);
      lines.push('');
    }
    pendingItems.forEach((item) => {
      const requested = Number(item.requested_qty || 0);
      const received = Number(item.received_qty || 0);
      const pending = requested - received;
      lines.push(`- ${item.description} | Codigo: ${item.barcode} | Pendiente: ${pending.toFixed(2)} | Solicitado por: ${item.requester_names || '-'}`);
    });

    const summaryRequested = pendingItems.reduce((acc, item) => acc + Number(item.requested_qty || 0), 0);
    const summaryReceived = pendingItems.reduce((acc, item) => acc + Number(item.received_qty || 0), 0);
    const summaryPending = Math.max(0, summaryRequested - summaryReceived);

    const htmlRows = pendingItems.map((item, index) => {
      const requested = Number(item.requested_qty || 0);
      const received = Number(item.received_qty || 0);
      const pending = Math.max(0, requested - received);
      const bg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
      return `
        <tr style="background:${bg}; border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px 8px; font-size:13px; color:#0f172a;">${index + 1}</td>
          <td style="padding:10px 8px; font-size:13px; color:#0f172a; font-weight:600;">${String(item.description || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
          <td style="padding:10px 8px; font-size:13px; color:#334155;">${String(item.barcode || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
          <td style="padding:10px 8px; font-size:13px; color:#0f172a; text-align:right;">${requested.toFixed(2)}</td>
          <td style="padding:10px 8px; font-size:13px; color:#0f172a; text-align:right;">${received.toFixed(2)}</td>
          <td style="padding:10px 8px; font-size:13px; color:#0f172a; text-align:right; font-weight:700;">${pending.toFixed(2)}</td>
          <td style="padding:10px 8px; font-size:12px; color:#334155;">${String(item.requester_names || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        </tr>`;
    }).join('');

    const html = `
      <div style="font-family:Segoe UI, Arial, sans-serif; background:#f1f5f9; padding:20px;">
        <div style="max-width:980px; margin:0 auto; background:#ffffff; border:1px solid #dbe4f0; border-radius:10px; overflow:hidden;">
          <div style="padding:16px 18px; background:linear-gradient(90deg,#0f172a,#1e3a8a); color:#ffffff;">
            <div style="font-size:18px; font-weight:700;">Orden de compra #${order.id}</div>
            <div style="font-size:12px; opacity:.95; margin-top:4px;">Fecha: ${new Date().toLocaleString('es-CL')}</div>
            <div style="font-size:12px; opacity:.95;">Solicitada por: ${String(requesterName || 'Usuario del sistema').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
          </div>
          <div style="padding:14px 18px; color:#0f172a; font-size:13px;">
            ${note ? `<div style="margin-bottom:10px;"><strong>Observación:</strong> ${String(note).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}
            <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%; border-collapse:collapse; border:1px solid #e2e8f0;">
              <thead>
                <tr style="background:#e2e8f0;">
                  <th style="padding:10px 8px; font-size:12px; text-align:left; color:#0f172a;">#</th>
                  <th style="padding:10px 8px; font-size:12px; text-align:left; color:#0f172a;">Producto</th>
                  <th style="padding:10px 8px; font-size:12px; text-align:left; color:#0f172a;">Código</th>
                  <th style="padding:10px 8px; font-size:12px; text-align:right; color:#0f172a;">Solicitado</th>
                  <th style="padding:10px 8px; font-size:12px; text-align:right; color:#0f172a;">Recibido</th>
                  <th style="padding:10px 8px; font-size:12px; text-align:right; color:#0f172a;">Pendiente</th>
                  <th style="padding:10px 8px; font-size:12px; text-align:left; color:#0f172a;">Solicitado por</th>
                </tr>
              </thead>
              <tbody>
                ${htmlRows}
              </tbody>
              <tfoot>
                <tr style="background:#eff6ff; border-top:2px solid #bfdbfe;">
                  <td colspan="3" style="padding:10px 8px; font-size:12px; color:#1e3a8a; font-weight:700;">Totales</td>
                  <td style="padding:10px 8px; font-size:12px; text-align:right; color:#0f172a; font-weight:700;">${summaryRequested.toFixed(2)}</td>
                  <td style="padding:10px 8px; font-size:12px; text-align:right; color:#0f172a; font-weight:700;">${summaryReceived.toFixed(2)}</td>
                  <td style="padding:10px 8px; font-size:12px; text-align:right; color:#0f172a; font-weight:700;">${summaryPending.toFixed(2)}</td>
                  <td style="padding:10px 8px;"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>`;

    const cc = parseEmailList(String(mailSettings?.cc_emails || ''), 20);
    await transport.sendMail({
      from: mailConfig.from,
      to: buyerEmail,
      cc: cc.length ? cc.join(', ') : undefined,
      subject: `Orden de compra #${order.id} - ${new Date().toLocaleDateString('es-CL')}`,
      text: lines.join('\n'),
      html,
    });

    const sentAt = new Date();
    await db.query(
      `UPDATE purchase_orders
       SET assigned_buyer_id = ?, assigned_by_user_id = ?, assigned_by_name = ?, assignment_note = ?, assignment_sent_at = NOW(), status = 'completed',
           reception_closed_at = NULL, reception_result = 'pending'
       WHERE id = ?`,
      [buyerId, userId, requesterName || null, note, order.id]
    );

    return res.json({
      message: `Orden enviada por correo a ${buyerEmail} y cerrada correctamente`,
      print_payload: {
        order_id: Number(order.id),
        date: sentAt.toISOString(),
        requested_by: requesterName || 'Usuario del sistema',
        buyer_name: String(buyer.name || '').trim(),
        buyer_email: buyerEmail,
        note: note || '',
        items: pendingItems.map((item) => {
          const requested = Number(item.requested_qty || 0);
          const received = Number(item.received_qty || 0);
          const pending = Math.max(0, requested - received);
          return {
            barcode: String(item.barcode || ''),
            description: String(item.description || ''),
            requested_qty: requested,
            received_qty: received,
            pending_qty: pending,
            requester_names: String(item.requester_names || ''),
          };
        }),
      },
    });
  } catch (err) {
    const detail = String(err?.message || '').trim();
    const suffix = detail ? `: ${detail}` : '';
    return res.status(500).json({ message: `No se pudo enviar orden de compra${suffix}` });
  }
});

app.post('/api/purchase-order/receive', async (req, res) => {
  const orderId = toInt(req.body?.order_id);
  const barcode = toText(req.body?.barcode, 80);
  const qtyReceived = Number(req.body?.qty_received || 0);
  if (!barcode || !Number.isFinite(qtyReceived) || qtyReceived <= 0) {
    return res.status(400).json({ message: 'Codigo y cantidad recibida son obligatorios' });
  }

  try {
    const order = orderId
      ? { id: orderId }
      : await getActivePurchaseOrder();
    if (!order) {
      return res.status(400).json({ message: 'No hay una orden activa para recibir productos.' });
    }
    const [itemRows] = await db.query(
      `SELECT id, product_id, description, requested_qty, received_qty
       FROM purchase_order_items
       WHERE order_id = ? AND barcode = ?
       LIMIT 1`,
      [order.id, barcode]
    );
    if (!itemRows.length) {
      return res.status(404).json({ message: 'El producto no existe en la orden activa' });
    }
    const item = itemRows[0];
    const requestedQty = Number(item.requested_qty || 0);
    const currentReceived = Number(item.received_qty || 0);
    const newReceived = currentReceived + qtyReceived;

    await db.query(
      `UPDATE purchase_order_items
       SET received_qty = ?
       WHERE id = ?`,
      [newReceived, item.id]
    );

    let inventoryUpdated = false;
    let inventoryMessage = 'Producto recibido registrado, sin impacto en inventario.';
    if (item.product_id) {
      const [productRows] = await db.query(
        'SELECT id_producto, utiliza_inventario FROM productos WHERE id_producto = ? LIMIT 1',
        [item.product_id]
      );
      if (productRows.length && Number(productRows[0].utiliza_inventario || 0) === 1) {
        await db.query(
          'UPDATE productos SET cantidad_actual = cantidad_actual + ? WHERE id_producto = ?',
          [qtyReceived, item.product_id]
        );
        inventoryUpdated = true;
        inventoryMessage = 'Inventario actualizado correctamente.';
      } else {
        inventoryMessage = 'Producto recibido registrado, pero el producto no usa inventario.';
      }
    }

    const [orderStateRows] = await db.query(
      `SELECT COALESCE(SUM(requested_qty), 0) AS requested_total,
              COALESCE(SUM(received_qty), 0) AS received_total
       FROM purchase_order_items
       WHERE order_id = ?`,
      [order.id]
    );
    const requestedTotal = Number(orderStateRows[0]?.requested_total || 0);
    const receivedTotal = Number(orderStateRows[0]?.received_total || 0);
    const fullyReceived = requestedTotal > 0 && receivedTotal >= requestedTotal;

    return res.json({
      message: 'Recepcion guardada',
      inventory_message: inventoryMessage,
      inventory_updated: inventoryUpdated,
      order_ready_to_close: fullyReceived,
      item: {
        barcode,
        description: item.description,
        requested_qty: requestedQty,
        received_qty: newReceived,
        pending_qty: Math.max(0, requestedQty - newReceived),
      },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Error al registrar recepcion de producto' });
  }
});

app.get('/api/printers', async (req, res) => {
  try {
    const output = await runPowerShell('Get-Printer | Select-Object Name, Default | ConvertTo-Json -Compress');
    const printers = normalizePrinterList(output);
    return res.json(printers);
  } catch (err) {
    console.error('Error listando impresoras:', err.message);
    return res.status(500).json({ message: 'No se pudieron listar impresoras del sistema' });
  }
});

// buscar producto por codigo
app.get('/api/productos/code/:code', async (req, res) => {
  const code = typeof req.params?.code === 'string' ? req.params.code.trim() : '';
  if (!code) {
    return res.status(400).json({ found: false, error: 'Codigo invalido' });
  }

  try {
    const [results] = await db.query(
      `SELECT p.*,
              fv.descripcion AS formato_venta,
              d.nombre AS departamento,
              s.name AS supplier_name
       FROM productos p
       LEFT JOIN formato_venta fv ON fv.id_formato = p.id_formato
       LEFT JOIN departamento d ON d.id_departamento = p.id_departamento
       LEFT JOIN service_suppliers s ON s.id = p.supplier_id
       WHERE TRIM(p.codigo_barras) = ?
          OR (
            ? REGEXP '^[0-9]+$'
            AND TRIM(p.codigo_barras) REGEXP '^[0-9]+$'
            AND CAST(TRIM(p.codigo_barras) AS UNSIGNED) = CAST(? AS UNSIGNED)
          )
       ORDER BY p.id_producto ASC
       LIMIT 1`,
      [code, code, code]
    );

    if (results.length === 0) {
      return res.json({ found: false, error: 'Producto no encontrado' });
    }

    return res.json({ found: true, product: results[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Base de datos error' });
  }
});

// buscar productos por descripcion para sugerencias
app.get('/api/productos/search', async (req, res) => {
  const query = typeof req.query?.q === 'string' ? req.query.q.trim() : '';
  if (!query) {
    return res.json([]);
  }

  try {
    const [results] = await db.query(
      `SELECT p.id_producto, p.codigo_barras, p.descripcion, p.precio_venta, p.cantidad_actual,
              p.costo, p.ganancia, p.utiliza_inventario, p.cantidad_minima, p.cantidad_maxima,
              p.exento_iva, p.id_formato, fv.descripcion AS formato_venta,
              p.supplier_id, d.nombre AS departamento, s.name AS supplier_name
       FROM productos p
       LEFT JOIN formato_venta fv ON fv.id_formato = p.id_formato
       LEFT JOIN departamento d ON d.id_departamento = p.id_departamento
       LEFT JOIN service_suppliers s ON s.id = p.supplier_id
       WHERE p.descripcion LIKE ? OR p.codigo_barras LIKE ?
       ORDER BY p.descripcion ASC
       LIMIT 20`,
      [`%${query}%`, `%${query}%`]
    );
    return res.json(results);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// buscar producto por nombre
app.get('/api/productos/name/:name', async (req, res) => {
  const { name } = req.params;

  try {
    const [results] = await db.query(
      'SELECT * FROM productos WHERE descripcion = ?',
      [name]
    );

    if (results.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    return res.json(results[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Base de datos error' });
  }
});

app.get('/api/productos/catalog', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.id_producto, p.codigo_barras, p.descripcion, p.precio_venta, p.cantidad_actual, p.utiliza_inventario,
              p.exento_iva,
              p.supplier_id, s.name AS supplier_name, d.nombre AS departamento
       FROM productos p
       LEFT JOIN service_suppliers s ON s.id = p.supplier_id
       LEFT JOIN departamento d ON d.id_departamento = p.id_departamento
       ORDER BY
         CASE WHEN TRIM(p.codigo_barras) REGEXP '^[0-9]+$' THEN 0 ELSE 1 END ASC,
         CAST(TRIM(p.codigo_barras) AS UNSIGNED) ASC,
         TRIM(p.codigo_barras) ASC`
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'No se pudo cargar el catalogo' });
  }
});

app.get('/api/promociones', async (req, res) => {
  try {
    const [promotions] = await db.query(
      `SELECT id, nombre, promo_type, min_qty, discount_percent, combo_price, is_active
       FROM product_promotions
       WHERE is_active = 1
       ORDER BY id DESC`
    );
    const ids = promotions.map((promo) => Number(promo.id)).filter((id) => id > 0);
    let itemRows = [];
    if (ids.length) {
      [itemRows] = await db.query(
        `SELECT ppi.promotion_id, ppi.product_id, pr.descripcion
         FROM product_promotion_items ppi
         INNER JOIN productos pr ON pr.id_producto = ppi.product_id
         WHERE ppi.promotion_id IN (?)`,
        [ids]
      );
    }
    const itemsByPromo = new Map();
    itemRows.forEach((item) => {
      const key = Number(item.promotion_id);
      if (!itemsByPromo.has(key)) itemsByPromo.set(key, []);
      itemsByPromo.get(key).push({
        product_id: Number(item.product_id || 0),
        descripcion: item.descripcion || '',
      });
    });
    return res.json(promotions.map((promo) => ({
      ...promo,
      productos: itemsByPromo.get(Number(promo.id)) || [],
    })));
  } catch (err) {
    return res.status(500).json({ error: 'No se pudieron cargar promociones' });
  }
});

app.post('/api/promociones', async (req, res) => {
  const name = toText(req.body?.nombre, 120);
  const promoTypeRaw = String(req.body?.promo_type || 'single').trim().toLowerCase();
  const promoType = promoTypeRaw === 'combo' ? 'combo' : 'single';
  const minQty = toInt(req.body?.min_qty);
  const discount = toNumber(req.body?.discount_percent);
  const comboPrice = req.body?.combo_price === null || typeof req.body?.combo_price === 'undefined'
    ? null
    : toNumber(req.body?.combo_price);
  const productIds = Array.isArray(req.body?.product_ids)
    ? [...new Set(req.body.product_ids.map((id) => toInt(id)).filter((id) => id && id > 0))]
    : [];

  if (!name || !productIds.length) {
    return res.status(400).json({ message: 'Datos de promocion invalidos' });
  }
  if (promoType === 'single' && (!minQty || minQty < 2 || discount === null || discount <= 0 || discount > 100)) {
    return res.status(400).json({ message: 'Datos de promocion por cantidad invalidos' });
  }
  if (promoType === 'combo' && (productIds.length < 2 || comboPrice === null || comboPrice <= 0)) {
    return res.status(400).json({ message: 'Datos de promocion invalidos' });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [promotionResult] = await connection.query(
      `INSERT INTO product_promotions (nombre, promo_type, min_qty, discount_percent, combo_price, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [
        name,
        promoType,
        promoType === 'combo' ? 1 : minQty,
        promoType === 'combo' ? 0 : discount,
        promoType === 'combo' ? comboPrice : null,
      ]
    );
    const promotionId = Number(promotionResult.insertId || 0);
    for (const productId of productIds) {
      await connection.query(
        'INSERT INTO product_promotion_items (promotion_id, product_id) VALUES (?, ?)',
        [promotionId, productId]
      );
    }
    await connection.commit();
    return res.status(201).json({ message: 'Promocion guardada', id: promotionId });
  } catch (err) {
    if (connection) {
      try { await connection.rollback(); } catch (_) {}
    }
    return res.status(500).json({ message: 'No se pudo guardar promocion' });
  } finally {
    if (connection) connection.release();
  }
});

app.post('/api/productos/import', async (req, res) => {
  const format = String(req.body?.format || '').toLowerCase();
  const rawData = req.body?.data;
  if (!['csv', 'json'].includes(format) || typeof rawData !== 'string' || !rawData.trim()) {
    return res.status(400).json({ message: 'Importacion invalida' });
  }

  let rows = [];
  try {
    if (format === 'json') {
      const parsed = JSON.parse(rawData);
      rows = Array.isArray(parsed) ? parsed : [];
    } else {
      rows = parseSimpleCsv(rawData);
    }
  } catch (err) {
    return res.status(400).json({ message: 'No se pudo leer archivo de importacion' });
  }

  if (!rows.length) {
    return res.status(400).json({ message: 'Archivo sin productos' });
  }

  let inserted = 0;
  for (const row of rows) {
    const barcode = normalizeImportedBarcode(row.codigo_barras || row.barcode || row.codigo || '', 80);
    const description = toText(row.descripcion || row.description || '', 255);
    const departmentName = toText(row.departamento || 'General', 80) || 'General';
    const formatName = normalizeSaleFormatName(row.formato_venta || 'unidad') || 'unidad';
    const cost = toNumber(row.costo ?? 0);
    const profit = toNumber(row.ganancia ?? 0);
    const price = toNumber(row.precio_venta ?? row.precio ?? 0);
    const qty = toNumber(row.cantidad_actual ?? row.stock ?? 0);
    const minQty = toNumber(row.cantidad_minima ?? 0);
    const maxQty = toNumber(row.cantidad_maxima ?? 0);
    const taxExempt = toBool(row.exento_iva ?? row.tax_exempt ?? row.exempt_vat ?? 0);
    if (!barcode || !description || cost === null || profit === null || price === null || taxExempt === null) {
      continue;
    }
    try {
      const [formatRows] = await db.query('SELECT id_formato FROM formato_venta WHERE LOWER(descripcion) = ? LIMIT 1', [formatName]);
      if (!formatRows.length) continue;
      let [departmentRows] = await db.query('SELECT id_departamento FROM departamento WHERE nombre = ? LIMIT 1', [departmentName]);
      if (!departmentRows.length) {
        await db.query('INSERT INTO departamento (nombre) VALUES (?)', [departmentName]);
        [departmentRows] = await db.query('SELECT id_departamento FROM departamento WHERE nombre = ? LIMIT 1', [departmentName]);
      }
      await db.query(
        `INSERT INTO productos (
          codigo_barras, descripcion, id_formato, costo, ganancia, precio_venta,
          utiliza_inventario, cantidad_actual, cantidad_minima,
          cantidad_maxima, id_departamento, supplier_id, exento_iva
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
        ON DUPLICATE KEY UPDATE
          descripcion = VALUES(descripcion),
          costo = VALUES(costo),
          ganancia = VALUES(ganancia),
          precio_venta = VALUES(precio_venta),
          cantidad_actual = VALUES(cantidad_actual),
          cantidad_minima = VALUES(cantidad_minima),
          cantidad_maxima = VALUES(cantidad_maxima),
          id_departamento = VALUES(id_departamento),
          exento_iva = VALUES(exento_iva)`,
        [
          barcode,
          description,
          formatRows[0].id_formato,
          cost,
          profit,
          price,
          toBool(row.utiliza_inventario) ?? 0,
          qty ?? 0,
          minQty ?? 0,
          maxQty ?? 0,
          departmentRows[0].id_departamento,
          taxExempt ? 1 : 0,
        ]
      );
      inserted += 1;
    } catch (_) {
      // Continuar con siguiente fila.
    }
  }

  return res.json({ inserted });
});

app.get('/api/productos/export.csv', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.codigo_barras, p.descripcion, fv.descripcion AS formato_venta,
              p.costo, p.ganancia, p.precio_venta,
              p.utiliza_inventario, p.cantidad_actual, p.cantidad_minima, p.cantidad_maxima,
              p.exento_iva, d.nombre AS departamento, s.name AS proveedor
       FROM productos p
       LEFT JOIN formato_venta fv ON fv.id_formato = p.id_formato
       LEFT JOIN departamento d ON d.id_departamento = p.id_departamento
       LEFT JOIN service_suppliers s ON s.id = p.supplier_id
       ORDER BY p.descripcion ASC`
    );
    const csv = toCsv(
      ['codigo_barras', 'descripcion', 'formato_venta', 'costo', 'ganancia', 'precio_venta', 'utiliza_inventario', 'cantidad_actual', 'cantidad_minima', 'cantidad_maxima', 'exento_iva', 'departamento', 'proveedor'],
      rows.map((row) => [
        toExcelTextCell(row.codigo_barras),
        row.descripcion,
        row.formato_venta,
        row.costo,
        row.ganancia,
        row.precio_venta,
        row.utiliza_inventario,
        row.cantidad_actual,
        row.cantidad_minima,
        row.cantidad_maxima,
        row.exento_iva,
        row.departamento,
        row.proveedor,
      ]),
      ';'
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="productos.csv"');
    return res.status(200).send(`\uFEFFsep=;\n${csv}`);
  } catch (err) {
    return res.status(500).json({ message: 'No se pudo exportar productos CSV' });
  }
});

app.get('/api/productos/template.csv', async (_req, res) => {
  try {
    const headers = ['codigo_barras', 'descripcion', 'formato_venta', 'costo', 'ganancia', 'precio_venta', 'utiliza_inventario', 'cantidad_actual', 'cantidad_minima', 'cantidad_maxima', 'exento_iva', 'departamento', 'proveedor'];
    const exampleRow = [
      toExcelTextCell('7801234567890'),
      'Producto de ejemplo',
      'unidad',
      1000,
      30.00,
      1300,
      1,
      10,
      2,
      40,
      0,
      'General',
      'Sin proveedor',
    ];
    const csv = toCsv(headers, [exampleRow], ';');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla_productos.csv"');
    return res.status(200).send(`\uFEFFsep=;\n${csv}`);
  } catch (err) {
    return res.status(500).json({ message: 'No se pudo generar la plantilla CSV' });
  }
});

app.get('/api/productos/template.json', async (_req, res) => {
  try {
    const payload = [
      {
        codigo_barras: '7801234567890',
        descripcion: 'Producto de ejemplo',
        formato_venta: 'unidad',
        costo: 1000,
        ganancia: 30.00,
        precio_venta: 1300,
        utiliza_inventario: 1,
        cantidad_actual: 10,
        cantidad_minima: 2,
        cantidad_maxima: 40,
        exento_iva: 0,
        departamento: 'General',
        proveedor: '',
      },
    ];
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla_productos.json"');
    return res.status(200).send(JSON.stringify(payload, null, 2));
  } catch (err) {
    return res.status(500).json({ message: 'No se pudo generar la plantilla JSON' });
  }
});

app.get('/api/productos/export.json', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.codigo_barras, p.descripcion, fv.descripcion AS formato_venta,
              p.costo, p.ganancia, p.precio_venta,
              p.utiliza_inventario, p.cantidad_actual, p.cantidad_minima, p.cantidad_maxima,
              p.exento_iva, d.nombre AS departamento, s.name AS proveedor
       FROM productos p
       LEFT JOIN formato_venta fv ON fv.id_formato = p.id_formato
       LEFT JOIN departamento d ON d.id_departamento = p.id_departamento
       LEFT JOIN service_suppliers s ON s.id = p.supplier_id
       ORDER BY p.descripcion ASC`
    );
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="productos.json"');
    return res.status(200).send(JSON.stringify(rows, null, 2));
  } catch (err) {
    return res.status(500).json({ message: 'No se pudo exportar productos JSON' });
  }
});

app.post('/api/print/sale-ticket', async (req, res) => {
  const ventaId = toInt(req.body?.venta_id);
  const includeDetailsOverride = req.body?.include_details;
  if (!ventaId) {
    return res.status(400).json({ message: 'venta_id invalido' });
  }

  try {
    const [settingsRows] = await db.query('SELECT * FROM ticket_settings WHERE id = 1 LIMIT 1');
    if (!settingsRows.length) {
      return res.status(400).json({ message: 'No existe configuracion de ticket' });
    }
    const settings = settingsRows[0];
    const configuredPrinter = String(settings.printer_name || '').trim();
    if (!configuredPrinter) {
      return res.status(400).json({ message: 'No hay impresora configurada en el sistema' });
    }

    const [saleRows] = await db.query(
      `SELECT v.id_venta, v.fecha, v.numero_ticket, v.folio_ticket, v.usuario_id, v.metodo_pago, v.caja_id, v.total,
              COALESCE(u.nombre, '') AS cajero_nombre
       FROM ventas v
       LEFT JOIN usuarios u ON u.id = v.usuario_id
       WHERE v.id_venta = ?
       LIMIT 1`,
      [ventaId]
    );
    if (!saleRows.length) {
      return res.status(404).json({ message: 'Venta no encontrada' });
    }
    const sale = saleRows[0];

    const [detailRows] = await db.query(
      `SELECT d.cantidad, d.precio_unitario, d.subtotal,
              COALESCE(NULLIF(d.descripcion, ''), p.descripcion, '') AS descripcion
       FROM detalle_venta d
       LEFT JOIN productos p ON p.id_producto = d.producto_id
       WHERE d.venta_id = ?
       ORDER BY d.id_detalle ASC`,
      [ventaId]
    );

    const [businessRows] = await db.query(
      `SELECT nombre, telefono, mail, tipo_local
       FROM info
       ORDER BY id_info DESC
       LIMIT 1`
    );
    const business = businessRows[0] || null;

    const includeDetails = typeof includeDetailsOverride === 'undefined'
      ? settings.include_details_by_default
      : includeDetailsOverride;
    const printProfile = getPrintProfile(configuredPrinter, settings.columns_width, settings.paper_width_mm);
    const printColumns = printProfile.columns;
    const printFontSize = printProfile.fontSize;
    const printEngine = normalizePrintEngine(settings.print_engine);
    const feedLines = normalizeFeedLines(settings.feed_lines_after_print);

    const ticketTextBase = buildSaleTicketText({
      sale,
      details: includeDetails ? detailRows : [],
      settings: { ...settings, include_details_by_default: includeDetails, columns_width: printColumns },
      business,
    });
    const ticketText = `${ticketTextBase}${'\r\n'.repeat(feedLines)}`;

    const tempFile = path.join(os.tmpdir(), `ticket-${ventaId}-${Date.now()}.txt`);
    await fs.writeFile(tempFile, ticketText, 'utf8');

    try {
      const gdiPrintCommand =
        `Add-Type -AssemblyName System.Drawing; ` +
        `$text = Get-Content -Raw -Encoding UTF8 -Path '${escapePsSingleQuoted(tempFile)}'; ` +
        `$pd = New-Object System.Drawing.Printing.PrintDocument; ` +
        `$pd.PrinterSettings.PrinterName = '${escapePsSingleQuoted(configuredPrinter)}'; ` +
        `if (-not $pd.PrinterSettings.IsValid) { throw 'Impresora no valida o no disponible'; } ` +
        `$handler = [System.Drawing.Printing.PrintPageEventHandler]{ ` +
        `param($sender,$e) ` +
        `$font = New-Object System.Drawing.Font('Consolas', ${printFontSize}); ` +
        `$brush = [System.Drawing.Brushes]::Black; ` +
        `$marginMm = 0; ` +
        `$x = [Math]::Round(($e.Graphics.DpiX / 25.4) * $marginMm); ` +
        `$y = 0; ` +
        `$e.Graphics.DrawString($text, $font, $brush, $x, $y); ` +
        `$e.HasMorePages = $false ` +
        `}; ` +
        `$pd.add_PrintPage($handler); ` +
        `$pd.Print();`;

      if (printEngine === 'gdi' || printProfile.isXp58) {
        await runPowerShell(gdiPrintCommand);
      } else if (printEngine === 'out_printer') {
        await runPowerShell(
          `$content = Get-Content -Raw -Encoding UTF8 -Path '${escapePsSingleQuoted(tempFile)}'; ` +
          `$content | Out-Printer -Name '${escapePsSingleQuoted(configuredPrinter)}'`
        );
      } else {
        try {
          await runPowerShell(
            `$content = Get-Content -Raw -Encoding UTF8 -Path '${escapePsSingleQuoted(tempFile)}'; ` +
            `$content | Out-Printer -Name '${escapePsSingleQuoted(configuredPrinter)}'`
          );
        } catch (directPrintError) {
          // Fallback for drivers where Out-Printer fails.
          await runPowerShell(gdiPrintCommand);
        }
      }
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }

    return res.json({ message: 'Ticket enviado a impresion', printer: configuredPrinter });
  } catch (err) {
    console.error('Error al imprimir ticket:', err);
    return res.status(500).json({ message: `No se pudo imprimir el ticket: ${err.message}` });
  }
});

app.post('/api/print/sale-ticket-test', async (_req, res) => {
  try {
    const [settingsRows] = await db.query('SELECT * FROM ticket_settings WHERE id = 1 LIMIT 1');
    if (!settingsRows.length) {
      return res.status(400).json({ message: 'No existe configuracion de ticket' });
    }
    const settings = settingsRows[0];
    const configuredPrinter = String(settings.printer_name || '').trim();
    if (!configuredPrinter) {
      return res.status(400).json({ message: 'No hay impresora configurada en el sistema' });
    }

    const [businessRows] = await db.query(
      `SELECT nombre, telefono, mail, tipo_local
       FROM info
       ORDER BY id_info DESC
       LIMIT 1`
    );
    const business = businessRows[0] || null;

    const sampleDetails = [
      { cantidad: 1, precio_unitario: 1290, subtotal: 1290, descripcion: 'Producto demo 1' },
      { cantidad: 2, precio_unitario: 850, subtotal: 1700, descripcion: 'Producto demo 2' },
      { cantidad: 1, precio_unitario: 3990, subtotal: 3990, descripcion: 'Producto demo 3' },
    ];
    const total = sampleDetails.reduce((acc, row) => acc + Number(row.subtotal || 0), 0);
    const sampleSale = {
      fecha: new Date(),
      numero_ticket: 1,
      folio_ticket: 'TST000001',
      usuario_id: 1,
      metodo_pago: 'efectivo',
      caja_id: 1,
      total,
      cajero_nombre: 'CAJERO DEMO',
    };

    const printProfile = getPrintProfile(configuredPrinter, settings.columns_width, settings.paper_width_mm);
    const printColumns = printProfile.columns;
    const printFontSize = printProfile.fontSize;
    const printEngine = normalizePrintEngine(settings.print_engine);
    const feedLines = normalizeFeedLines(settings.feed_lines_after_print);
    const ticketTextBase = buildSaleTicketText({
      sale: sampleSale,
      details: sampleDetails,
      settings: { ...settings, include_details_by_default: true, columns_width: printColumns },
      business,
    });
    const ticketText = `${ticketTextBase}${'\r\n'.repeat(feedLines)}`;

    const tempFile = path.join(os.tmpdir(), `ticket-test-${Date.now()}.txt`);
    await fs.writeFile(tempFile, ticketText, 'utf8');

    try {
      const gdiPrintCommand =
        `Add-Type -AssemblyName System.Drawing; ` +
        `$text = Get-Content -Raw -Encoding UTF8 -Path '${escapePsSingleQuoted(tempFile)}'; ` +
        `$pd = New-Object System.Drawing.Printing.PrintDocument; ` +
        `$pd.PrinterSettings.PrinterName = '${escapePsSingleQuoted(configuredPrinter)}'; ` +
        `if (-not $pd.PrinterSettings.IsValid) { throw 'Impresora no valida o no disponible'; } ` +
        `$handler = [System.Drawing.Printing.PrintPageEventHandler]{ ` +
        `param($sender,$e) ` +
        `$font = New-Object System.Drawing.Font('Consolas', ${printFontSize}); ` +
        `$brush = [System.Drawing.Brushes]::Black; ` +
        `$marginMm = 0; ` +
        `$x = [Math]::Round(($e.Graphics.DpiX / 25.4) * $marginMm); ` +
        `$y = 0; ` +
        `$e.Graphics.DrawString($text, $font, $brush, $x, $y); ` +
        `$e.HasMorePages = $false ` +
        `}; ` +
        `$pd.add_PrintPage($handler); ` +
        `$pd.Print();`;

      if (printEngine === 'gdi' || printProfile.isXp58) {
        await runPowerShell(gdiPrintCommand);
      } else if (printEngine === 'out_printer') {
        await runPowerShell(
          `$content = Get-Content -Raw -Encoding UTF8 -Path '${escapePsSingleQuoted(tempFile)}'; ` +
          `$content | Out-Printer -Name '${escapePsSingleQuoted(configuredPrinter)}'`
        );
      } else {
        try {
          await runPowerShell(
            `$content = Get-Content -Raw -Encoding UTF8 -Path '${escapePsSingleQuoted(tempFile)}'; ` +
            `$content | Out-Printer -Name '${escapePsSingleQuoted(configuredPrinter)}'`
          );
        } catch (_) {
          await runPowerShell(gdiPrintCommand);
        }
      }
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }

    return res.json({ message: 'Ticket de prueba enviado a impresion', printer: configuredPrinter });
  } catch (err) {
    console.error('Error al imprimir ticket de prueba:', err);
    return res.status(500).json({ message: `No se pudo imprimir ticket de prueba: ${err.message}` });
  }
});

// Devuelve la cantidad de dispositivos conectados
app.get('/api/devices', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT COUNT(user) AS connected FROM cajas'
    );
    res.json({ connected: rows[0].connected });
  } catch (error) {
    console.error('Error al contar cajas:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.get('/api/ticket-counter', async (req, res) => {
  const cajeroId = toInt(req.query?.cajero);
  const cajaId = toInt(req.query?.caja);
  if (!cajeroId || !cajaId) {
    return res.status(400).json({ message: 'Caja o cajero invalido' });
  }

  try {
    const openShift = await getOpenShiftByCajaCajero(db, cajaId, cajeroId);
    if (!openShift?.turno_id) {
      return res.status(409).json({ message: 'No hay turno abierto', estado: 'sin_turno' });
    }

    const state = await getOrCreateTicketCounterState(db, {
      turnoId: openShift.turno_id,
      cajaId,
      cajeroId,
      horaApertura: openShift.hora_apertura,
    });
    return res.json({
      turno_id: state.turno_id,
      numero_actual: state.numero_actual,
      ultimo_ticket: state.ultimo_ticket,
    });
  } catch (error) {
    console.error('Error al obtener contador de ticket:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.put('/api/ticket-counter', async (req, res) => {
  const cajeroId = toInt(req.body?.cajero);
  const cajaId = toInt(req.body?.caja);
  const numeroActual = toInt(req.body?.numero_actual);
  const turnoIdBody = toInt(req.body?.turno_id);
  if (!cajeroId || !cajaId || !numeroActual || numeroActual < 1) {
    return res.status(400).json({ message: 'Datos invalidos para contador de ticket' });
  }

  try {
    const openShift = await getOpenShiftByCajaCajero(db, cajaId, cajeroId);
    if (!openShift?.turno_id) {
      return res.status(409).json({ message: 'No hay turno abierto', estado: 'sin_turno' });
    }
    if (turnoIdBody && turnoIdBody !== openShift.turno_id) {
      return res.status(409).json({ message: 'Turno no coincide', estado: 'turno_invalido' });
    }

    const state = await upsertTicketCounterState(db, {
      turnoId: openShift.turno_id,
      cajaId,
      cajeroId,
      numeroActual,
      ultimoTicket: Math.max(0, numeroActual - 1),
    });

    return res.json({
      turno_id: state.turno_id,
      numero_actual: state.numero_actual,
      ultimo_ticket: state.ultimo_ticket,
    });
  } catch (error) {
    console.error('Error al guardar contador de ticket:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// compatibilidad: devuelve el ultimo ticket del turno abierto actual (por caja+cajero)
app.get('/api/ultimo_ticket/cajero/:cajero', async (req, res) => {
  const cajeroId = toInt(req.params.cajero);
  const cajaId = toInt(req.query?.caja);
  if (!cajeroId || !cajaId) {
    return res.status(400).json({ message: 'Cajero o caja invalido' });
  }

  try {
    const openShift = await getOpenShiftByCajaCajero(db, cajaId, cajeroId);
    if (!openShift?.turno_id) {
      return res.json({ ultimo: 0 });
    }
    const state = await getOrCreateTicketCounterState(db, {
      turnoId: openShift.turno_id,
      cajaId,
      cajeroId,
      horaApertura: openShift.hora_apertura,
    });
    return res.json({ ultimo: Math.max(0, state.numero_actual - 1) });
  } catch (error) {
    console.error('Error al obtener ultimo ticket:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

function buildReportSalesWhereFromQuery(query = {}, alias = 'v') {
  const { desde, hasta } = query || {};
  const cajaId = toInt(query?.caja);
  const cajeroId = toInt(query?.cajero);
  const startDate = typeof desde === 'string' && desde ? desde : null;
  const endDate = typeof hasta === 'string' && hasta ? hasta : null;

  if (!startDate || !endDate || !isIsoDate(startDate) || !isIsoDate(endDate)) {
    return {
      ok: false,
      message: 'Parametros desde y hasta son obligatorios en formato YYYY-MM-DD',
    };
  }

  const filters = [`DATE(${alias}.fecha) BETWEEN ? AND ?`];
  const values = [startDate, endDate];
  if (cajaId) {
    filters.push(`${alias}.caja_id = ?`);
    values.push(cajaId);
  }
  if (cajeroId) {
    filters.push(`${alias}.usuario_id = ?`);
    values.push(cajeroId);
  }

  return {
    ok: true,
    startDate,
    endDate,
    cajaId: cajaId || null,
    cajeroId: cajeroId || null,
    whereClause: filters.join(' AND '),
    values,
  };
}

function buildCashAmountSql(alias = 'v') {
  return `
    CASE
      WHEN ${alias}.metodo_pago = 'efectivo' THEN ${alias}.total
      WHEN ${alias}.metodo_pago = 'mixto' THEN
        CASE
          WHEN COALESCE(${alias}.monto_efectivo, 0) > 0 THEN ${alias}.monto_efectivo
          ELSE ${alias}.total / 2
        END
      ELSE 0
    END
  `;
}

function buildCardAmountSql(alias = 'v') {
  return `
    CASE
      WHEN ${alias}.metodo_pago = 'tarjeta' THEN ${alias}.total
      WHEN ${alias}.metodo_pago = 'mixto' THEN
        CASE
          WHEN COALESCE(${alias}.monto_tarjeta, 0) > 0 THEN ${alias}.monto_tarjeta
          ELSE ${alias}.total / 2
        END
      WHEN ${alias}.metodo_pago IN ('dolares', 'transferencia', 'cheque', 'vale') THEN ${alias}.total
      ELSE 0
    END
  `;
}

// resumen para vista de reportes por rango de fechas
app.get('/api/reportes/resumen', async (req, res) => {
  const { desde, hasta } = req.query || {};
  const cajaId = toInt(req.query?.caja);
  const cajeroId = toInt(req.query?.cajero);
  const startDate = typeof desde === 'string' && desde ? desde : null;
  const endDate = typeof hasta === 'string' && hasta ? hasta : null;

  if (!startDate || !endDate || !isIsoDate(startDate) || !isIsoDate(endDate)) {
    return res.status(400).json({ message: 'Parametros desde y hasta son obligatorios' });
  }

  const filters = ['DATE(fecha) BETWEEN ? AND ?'];
  const values = [startDate, endDate];
  if (cajaId) {
    filters.push('caja_id = ?');
    values.push(cajaId);
  }
  if (cajeroId) {
    filters.push('usuario_id = ?');
    values.push(cajeroId);
  }
  const whereClause = filters.join(' AND ');

  try {
    const [salesSummary] = await db.query(
      `SELECT metodo_pago, COUNT(*) AS transacciones, COALESCE(SUM(total), 0) AS total
       FROM ventas
       WHERE ${whereClause}
       GROUP BY metodo_pago`,
      values
    );

    const [totals] = await db.query(
      `SELECT COUNT(*) AS transacciones, COALESCE(SUM(total), 0) AS total
       FROM ventas
       WHERE ${whereClause}`,
      values
    );

    const [inventoryAlerts] = await db.query(
      `SELECT codigo_barras, descripcion, cantidad_actual, cantidad_minima
       FROM productos
       WHERE utiliza_inventario = 1 AND cantidad_actual <= cantidad_minima
       ORDER BY cantidad_actual ASC, descripcion ASC
       LIMIT 50`
    );

    return res.json({
      desde: startDate,
      hasta: endDate,
      ventas: salesSummary,
      totales: totals[0],
      inventario_bajo: inventoryAlerts,
    });
  } catch (error) {
    console.error('Error al generar reportes:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// resumen de corte del dia actual por caja/cajero opcionales
app.get('/api/corte/actual', async (req, res) => {
  const cajaId = toInt(req.query?.caja);
  const cajeroId = toInt(req.query?.cajero);
  const filters = [];
  const values = [];

  if (cajaId) {
    filters.push('caja_id = ?');
    values.push(cajaId);
  }
  if (cajeroId) {
    filters.push('usuario_id = ?');
    values.push(cajeroId);
  }

  const whereExtra = filters.length ? ` AND ${filters.join(' AND ')}` : '';

  try {
    const [paymentBreakdown] = await db.query(
      `SELECT metodo_pago, COUNT(*) AS transacciones, COALESCE(SUM(total), 0) AS total
       FROM ventas
       WHERE DATE(fecha) = CURDATE() ${whereExtra}
       GROUP BY metodo_pago`,
      values
    );

    const [global] = await db.query(
      `SELECT COUNT(*) AS transacciones, COALESCE(SUM(total), 0) AS total
       FROM ventas
       WHERE DATE(fecha) = CURDATE() ${whereExtra}`,
      values
    );

    const [closedRows] = await db.query(
      `SELECT id_corte, hora_cierre, total_ventas, transacciones, monto_inicial, monto_declarado, diferencia_efectivo, estado
       FROM corte_caja
       WHERE fecha = CURDATE() ${whereExtra}
       ORDER BY id_corte DESC
       LIMIT 1`,
      values
    );

    return res.json({
      fecha: new Date().toISOString().slice(0, 10),
      corte: global[0],
      desglose: paymentBreakdown,
      cerrado: closedRows.length > 0 && closedRows[0].estado === 'cerrado',
      cierre: closedRows[0] || null,
    });
  } catch (error) {
    console.error('Error al calcular corte:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.get('/api/corte/historial', async (req, res) => {
  const { desde, hasta } = req.query || {};
  const cajaId = toInt(req.query?.caja);
  const cajeroId = toInt(req.query?.cajero);
  const startDate = typeof desde === 'string' && desde ? desde : null;
  const endDate = typeof hasta === 'string' && hasta ? hasta : null;

  if (!startDate || !endDate || !isIsoDate(startDate) || !isIsoDate(endDate)) {
    return res.status(400).json({ message: 'Parametros desde y hasta son obligatorios en formato YYYY-MM-DD' });
  }

  const filters = ['fecha BETWEEN ? AND ?'];
  const values = [startDate, endDate];
  if (cajaId) {
    filters.push('caja_id = ?');
    values.push(cajaId);
  }
  if (cajeroId) {
    filters.push('usuario_id = ?');
    values.push(cajeroId);
  }

  try {
    const [rows] = await db.query(
      `SELECT c.id_corte, c.fecha, c.caja_id, c.usuario_id, COALESCE(u.nombre, '') AS cajero_nombre,
              c.hora_cierre, c.monto_inicial, c.monto_declarado, c.diferencia_efectivo,
              c.total_efectivo, c.total_tarjeta, c.total_mixto, c.total_ventas, c.transacciones, c.estado, c.observaciones
       FROM corte_caja c
       LEFT JOIN usuarios u ON u.id = c.usuario_id
       WHERE ${filters.join(' AND ')}
       ORDER BY c.fecha DESC, c.id_corte DESC
       LIMIT 200`,
      values
    );
    return res.json(rows);
  } catch (error) {
    console.error('Error al consultar historial de cortes:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.get('/api/turno/estado', async (req, res) => {
  const cajaId = toInt(req.query?.caja);
  const cajeroId = toInt(req.query?.cajero);

  if (!cajaId || !cajeroId) {
    return res.status(400).json({ message: 'Caja y cajero son obligatorios' });
  }

  try {
    const [openRows] = await db.query(
      `SELECT id_corte, estado, monto_inicial, hora_apertura, hora_cierre
       FROM corte_caja
       WHERE fecha = CURDATE() AND caja_id = ? AND usuario_id = ? AND estado = 'abierto'
       ORDER BY id_corte DESC
       LIMIT 1`,
      [cajaId, cajeroId]
    );

    if (openRows.length > 0) {
      return res.json({
        estado: 'abierto',
        id_corte: openRows[0].id_corte,
        monto_inicial: Number(openRows[0].monto_inicial || 0),
        hora_apertura: openRows[0].hora_apertura,
        hora_cierre: openRows[0].hora_cierre,
      });
    }

    const [lastRows] = await db.query(
      `SELECT id_corte, estado, monto_inicial, hora_apertura, hora_cierre
       FROM corte_caja
       WHERE fecha = CURDATE() AND caja_id = ? AND usuario_id = ?
       ORDER BY id_corte DESC
       LIMIT 1`,
      [cajaId, cajeroId]
    );

    if (!lastRows.length) {
      return res.json({ estado: 'sin_turno' });
    }

    return res.json({
      estado: 'sin_turno',
      ultimo_estado: lastRows[0].estado,
      ultimo_id_corte: lastRows[0].id_corte,
      ultimo_hora_cierre: lastRows[0].hora_cierre,
    });
  } catch (error) {
    console.error('Error al consultar estado de turno:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.get('/api/sales/session-history', async (req, res) => {
  const cajaId = toInt(req.query?.caja);
  const cajeroId = toInt(req.query?.cajero);
  const limit = Math.min(1000, Math.max(1, toInt(req.query?.limit) || 300));
  const authUserId = toInt(req.user?.sub);

  if (!authUserId) {
    return res.status(401).json({ message: 'Sesion invalida' });
  }
  if (!cajaId || !cajeroId) {
    return res.status(400).json({ message: 'Caja y cajero son obligatorios' });
  }

  try {
    const [userRows] = await db.query(
      'SELECT id, es_administrador, nombre FROM usuarios WHERE id = ? LIMIT 1',
      [authUserId]
    );
    if (!userRows.length) {
      return res.status(401).json({ message: 'Usuario no válido' });
    }
    const isAdmin = Number(userRows[0].es_administrador || 0) === 1;

    let salesSql = `
      SELECT v.id_venta, DATE_FORMAT(v.fecha, '%Y-%m-%d %H:%i:%s') AS fecha,
             v.numero_ticket, v.folio_ticket, v.caja_id, v.usuario_id,
             COALESCE(u.nombre, CONCAT('Usuario ', v.usuario_id)) AS cajero_nombre,
             v.metodo_pago, v.total
      FROM ventas v
      LEFT JOIN usuarios u ON u.id = v.usuario_id
      WHERE DATE(v.fecha) = CURDATE()
    `;
    const params = [];

    if (!isAdmin) {
      const [openRows] = await db.query(
        `SELECT id_corte, hora_apertura
         FROM corte_caja
         WHERE fecha = CURDATE() AND caja_id = ? AND usuario_id = ? AND estado = 'abierto'
         ORDER BY id_corte DESC
         LIMIT 1`,
        [cajaId, cajeroId]
      );
      if (openRows.length) {
        const turnoId = Number(openRows[0].id_corte || 0) || 0;
        salesSql += ' AND v.caja_id = ? AND v.usuario_id = ? AND (v.turno_id = ? OR (v.turno_id IS NULL AND v.fecha >= ?))';
        params.push(cajaId, cajeroId, turnoId, openRows[0].hora_apertura);
      } else {
        salesSql += ' AND v.caja_id = ? AND v.usuario_id = ?';
        params.push(cajaId, cajeroId);
      }
    }

    salesSql += ' ORDER BY v.fecha DESC, v.id_venta DESC LIMIT ?';
    params.push(limit);

    const [rows] = await db.query(salesSql, params);
    return res.json({
      is_admin: isAdmin ? 1 : 0,
      ventas: rows,
    });
  } catch (error) {
    console.error('Error al obtener historial de ventas de sesion:', error);
    return res.status(500).json({ message: 'No se pudo obtener historial de ventas' });
  }
});

app.get('/api/turno/abierto-caja', async (req, res) => {
  const cajaId = toInt(req.query?.caja);
  if (!cajaId) {
    return res.status(400).json({ message: 'Caja invalida' });
  }

  try {
    const [rows] = await db.query(
      `SELECT c.id_corte, c.caja_id, c.usuario_id, c.hora_apertura, u.nombre AS cajero_nombre
       FROM corte_caja c
       LEFT JOIN usuarios u ON u.id = c.usuario_id
       WHERE c.fecha = CURDATE() AND c.caja_id = ? AND c.estado = 'abierto'
       ORDER BY c.id_corte DESC
       LIMIT 1`,
      [cajaId]
    );

    if (!rows.length) {
      return res.json({ abierto: false, caja_id: cajaId });
    }

    return res.json({
      abierto: true,
      caja_id: Number(rows[0].caja_id || cajaId),
      turno_id: Number(rows[0].id_corte || 0),
      usuario_id: Number(rows[0].usuario_id || 0),
      cajero_nombre: rows[0].cajero_nombre || '',
      hora_apertura: rows[0].hora_apertura || null,
    });
  } catch (error) {
    console.error('Error al consultar turno abierto por caja:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.post('/api/turno/iniciar', async (req, res) => {
  const cajaId = toInt(req.body?.numero_caja);
  const cajeroId = toInt(req.body?.cajero);
  const authUserId = toInt(req.user?.sub);
  const montoInicial = toNumber(req.body?.monto_inicial ?? 0);

  if (!cajaId || !cajeroId || montoInicial === null || montoInicial < 0) {
    return res.status(400).json({ message: 'Datos incompletos o invalidos para iniciar turno' });
  }
  if (authUserId && authUserId !== cajeroId) {
    return res.status(403).json({ message: 'No autorizado para iniciar turno para otro cajero' });
  }

  try {
    const [openRows] = await db.query(
      `SELECT id_corte, estado, monto_inicial
       FROM corte_caja
       WHERE fecha = CURDATE() AND caja_id = ? AND usuario_id = ? AND estado = 'abierto'
       ORDER BY id_corte DESC
       LIMIT 1`,
      [cajaId, cajeroId]
    );

    if (openRows.length > 0) {
      await db.query(
        `UPDATE user_auth_sessions
         SET turno_id = ?
         WHERE user_id = ? AND caja_id = ? AND revoked_at IS NULL AND expires_at > NOW()`,
        [openRows[0].id_corte, cajeroId, cajaId]
      );
      return res.json({
        message: 'Turno ya iniciado',
        estado: 'abierto',
        id_corte: openRows[0].id_corte,
        monto_inicial: Number(openRows[0].monto_inicial || 0),
      });
    }

    const [result] = await db.query(
      `INSERT INTO corte_caja (
        fecha, caja_id, usuario_id, hora_apertura, monto_inicial, estado
      ) VALUES (
        CURDATE(), ?, ?, NOW(), ?, 'abierto'
      )`,
      [cajaId, cajeroId, montoInicial]
    );

    await db.query(
      `UPDATE user_auth_sessions
       SET turno_id = ?
       WHERE user_id = ? AND caja_id = ? AND revoked_at IS NULL AND expires_at > NOW()`,
      [result.insertId, cajeroId, cajaId]
    );

    return res.json({
      message: 'Turno iniciado',
      estado: 'abierto',
      id_corte: result.insertId,
      monto_inicial: montoInicial,
    });
  } catch (error) {
    console.error('Error al iniciar turno:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.get('/api/turno/resumen', async (req, res) => {
  const cajaId = toInt(req.query?.caja);
  const cajeroId = toInt(req.query?.cajero);
  const scope = req.query?.scope === 'day' ? 'day' : 'session';

  if (!cajaId || !cajeroId) {
    return res.status(400).json({ message: 'Caja y cajero son obligatorios' });
  }

  try {
    const [openRows] = await db.query(
      `SELECT id_corte, hora_apertura, monto_inicial
       FROM corte_caja
       WHERE fecha = CURDATE() AND caja_id = ? AND usuario_id = ? AND estado = 'abierto'
       ORDER BY id_corte DESC
       LIMIT 1`,
      [cajaId, cajeroId]
    );

    if (!openRows.length) {
      return res.status(409).json({ message: 'No hay turno abierto para esta caja/cajero' });
    }

    const openShift = openRows[0];
    const sessionStart = openShift.hora_apertura;
    const openShiftId = Number(openShift.id_corte || 0);

    let salesWhere = `v.caja_id = ? AND v.usuario_id = ? AND DATE(v.fecha) = CURDATE()`;
    const salesParams = [cajaId, cajeroId];
    if (scope === 'session') {
      salesWhere += ' AND (v.turno_id = ? OR (v.turno_id IS NULL AND v.fecha >= ?))';
      salesParams.push(openShiftId, sessionStart);
    }

    const [summaryRows] = await db.query(
      `SELECT v.metodo_pago, COUNT(*) AS transacciones, COALESCE(SUM(v.total), 0) AS total
       FROM ventas v
       WHERE ${salesWhere}
       GROUP BY v.metodo_pago
       ORDER BY v.metodo_pago ASC`,
      salesParams
    );

    const [totalsRows] = await db.query(
      `SELECT COUNT(*) AS transacciones, COALESCE(SUM(v.total), 0) AS total
       FROM ventas v
       WHERE ${salesWhere}`,
      salesParams
    );

    const [detailRows] = await db.query(
      `SELECT v.id_venta, DATE_FORMAT(v.fecha, '%Y-%m-%d %H:%i:%s') AS fecha,
              COALESCE(NULLIF(v.folio_ticket, ''), CAST(v.numero_ticket AS CHAR)) AS numero_ticket,
              v.metodo_pago, v.total
       FROM ventas v
       WHERE ${salesWhere}
       ORDER BY v.fecha ASC, v.id_venta ASC
       LIMIT 500`,
      salesParams
    );

    const [profitRows] = await db.query(
      `SELECT COALESCE(SUM((d.precio_unitario - COALESCE(p.costo, 0)) * d.cantidad), 0) AS ganancia
       FROM detalle_venta d
       INNER JOIN ventas v ON v.id_venta = d.venta_id
       LEFT JOIN productos p ON p.id_producto = d.producto_id
       WHERE ${salesWhere}`,
      salesParams
    );

    const departmentParams = scope === 'session'
      ? [cajaId, cajeroId, openShiftId, sessionStart]
      : [cajaId, cajeroId];
    const [departmentRows] = await db.query(
      `SELECT dep.id_departamento,
              dep.nombre AS departamento,
              COALESCE(SUM(
                CASE
                  WHEN v.id_venta IS NOT NULL THEN d.subtotal
                  ELSE 0
                END
              ), 0) AS total_vendido,
              COALESCE(SUM(
                CASE
                  WHEN v.id_venta IS NOT NULL THEN (d.precio_unitario - COALESCE(p.costo, 0)) * d.cantidad
                  ELSE 0
                END
              ), 0) AS ganancia
       FROM departamento dep
       LEFT JOIN productos p
              ON p.id_departamento = dep.id_departamento
       LEFT JOIN detalle_venta d
              ON d.producto_id = p.id_producto
       LEFT JOIN ventas v
              ON v.id_venta = d.venta_id
             AND v.caja_id = ?
             AND v.usuario_id = ?
             AND DATE(v.fecha) = CURDATE()
             ${scope === 'session' ? 'AND (v.turno_id = ? OR (v.turno_id IS NULL AND v.fecha >= ?))' : ''}
       GROUP BY dep.id_departamento, dep.nombre
       ORDER BY dep.nombre ASC`,
      departmentParams
    );

    const [topProductsByDepartmentRows] = await db.query(
      `SELECT COALESCE(dep.nombre, 'Sin departamento') AS departamento,
              COALESCE(NULLIF(p.descripcion, ''), NULLIF(d.descripcion, ''), 'Producto') AS producto,
              COALESCE(SUM(d.cantidad), 0) AS cantidad_vendida
       FROM detalle_venta d
       INNER JOIN ventas v ON v.id_venta = d.venta_id
       LEFT JOIN productos p ON p.id_producto = d.producto_id
       LEFT JOIN departamento dep ON dep.id_departamento = p.id_departamento
       WHERE ${salesWhere}
       GROUP BY COALESCE(dep.nombre, 'Sin departamento'),
                COALESCE(NULLIF(p.descripcion, ''), NULLIF(d.descripcion, ''), 'Producto')
       HAVING COALESCE(SUM(d.cantidad), 0) > 0
       ORDER BY departamento ASC, cantidad_vendida DESC, producto ASC`,
      salesParams
    );

    let movementWhere = `m.caja_id = ? AND m.usuario_id = ? AND DATE(m.fecha) = CURDATE()`;
    const movementParams = [cajaId, cajeroId];
    if (scope === 'session') {
      movementWhere += ' AND (m.turno_id = ? OR (m.turno_id IS NULL AND m.fecha >= ?))';
      movementParams.push(openShiftId, sessionStart);
    }

    const [movementSummaryRows] = await db.query(
      `SELECT m.tipo, COUNT(*) AS transacciones, COALESCE(SUM(m.monto), 0) AS total
       FROM cash_movements m
       WHERE ${movementWhere}
       GROUP BY m.tipo`,
      movementParams
    );

    const [movementDetailRows] = await db.query(
      `SELECT DATE_FORMAT(m.fecha, '%Y-%m-%d %H:%i:%s') AS fecha,
              m.tipo, m.metodo, m.monto, COALESCE(m.descripcion, '') AS descripcion
       FROM cash_movements m
       WHERE ${movementWhere}
       ORDER BY m.fecha ASC, m.id_movimiento ASC
       LIMIT 500`,
      movementParams
    );

    const [cashRows] = await db.query(
      `SELECT COALESCE(SUM(
          CASE
            WHEN v.metodo_pago = 'efectivo' THEN v.total
            WHEN v.metodo_pago = 'mixto' THEN
              CASE
                WHEN COALESCE(v.monto_efectivo, 0) > 0 THEN v.monto_efectivo
                ELSE v.total / 2
              END
            ELSE 0
          END
        ), 0) AS total_efectivo
       FROM ventas v
       WHERE ${salesWhere}`,
      salesParams
    );
    const efectivoVentas = Number(cashRows[0]?.total_efectivo || 0);

    const [cardRows] = await db.query(
      `SELECT COALESCE(SUM(
          CASE
            WHEN v.metodo_pago = 'tarjeta' THEN v.total
            WHEN v.metodo_pago = 'mixto' THEN
              CASE
                WHEN COALESCE(v.monto_tarjeta, 0) > 0 THEN v.monto_tarjeta
                ELSE v.total / 2
              END
            WHEN v.metodo_pago IN ('dolares', 'transferencia', 'cheque', 'vale') THEN v.total
            ELSE 0
          END
        ), 0) AS total_tarjeta
       FROM ventas v
       WHERE ${salesWhere}`,
      salesParams
    );
    const tarjetaVentas = Number(cardRows[0]?.total_tarjeta || 0);

    const abonosEfectivo = movementDetailRows
      .filter((row) => row.tipo === 'abono' && row.metodo === 'efectivo')
      .reduce((acc, row) => acc + Number(row.monto || 0), 0);
    const entradasDinero = movementSummaryRows
      .filter((row) => row.tipo === 'entrada')
      .reduce((acc, row) => acc + Number(row.total || 0), 0);
    const salidasDinero = movementSummaryRows
      .filter((row) => row.tipo === 'salida')
      .reduce((acc, row) => acc + Number(row.total || 0), 0);

    const totalVentas = Number(totalsRows[0]?.total || 0);
    const totalGanancia = Number(profitRows[0]?.ganancia || 0);
    const esperadoEfectivo = Number(openShift.monto_inicial || 0) + efectivoVentas;
    const dineroEnCaja = Number(openShift.monto_inicial || 0) + efectivoVentas + abonosEfectivo + entradasDinero - salidasDinero;

    return res.json({
      scope,
      turno_id: openShift.id_corte,
      fecha: new Date().toISOString().slice(0, 10),
      hora_apertura: openShift.hora_apertura,
      monto_inicial: Number(openShift.monto_inicial || 0),
      esperado_efectivo: esperadoEfectivo,
      esperado_tarjeta: tarjetaVentas,
      resumen: summaryRows,
      totales: totalsRows[0] || { transacciones: 0, total: 0 },
      detalle: detailRows,
      resumen_financiero: {
        fondo_caja: Number(openShift.monto_inicial || 0),
        ventas_efectivo: efectivoVentas,
        ventas_tarjeta: tarjetaVentas,
        abonos_efectivo: abonosEfectivo,
        entradas_dinero: entradasDinero,
        salidas_dinero: salidasDinero,
        ventas_totales_dinero_en_caja: dineroEnCaja,
        ganancia_ventas: totalGanancia,
        total_vendido: totalVentas,
      },
      movimientos: {
        resumen: movementSummaryRows,
        detalle_ingresos: movementDetailRows.filter((row) => row.tipo === 'abono' || row.tipo === 'entrada'),
        detalle_salidas: movementDetailRows.filter((row) => row.tipo === 'salida'),
      },
      departamentos: departmentRows,
      top_productos_departamento: topProductsByDepartmentRows,
    });
  } catch (error) {
    console.error('Error al obtener resumen de turno:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.get('/api/turno/departamentos', async (req, res) => {
  const cajaId = toInt(req.query?.caja);
  const cajeroId = toInt(req.query?.cajero);
  const scope = req.query?.scope === 'day' ? 'day' : 'session';

  if (!cajaId || !cajeroId) {
    return res.status(400).json({ message: 'Caja y cajero son obligatorios' });
  }

  try {
    const [openRows] = await db.query(
      `SELECT id_corte, hora_apertura
       FROM corte_caja
       WHERE fecha = CURDATE() AND caja_id = ? AND usuario_id = ? AND estado = 'abierto'
       ORDER BY id_corte DESC
       LIMIT 1`,
      [cajaId, cajeroId]
    );

    if (!openRows.length) {
      return res.status(409).json({ message: 'No hay turno abierto para esta caja/cajero' });
    }

    const sessionStart = openRows[0].hora_apertura;
    const openShiftId = Number(openRows[0].id_corte || 0);
    let salesWhere = `v.caja_id = ? AND v.usuario_id = ? AND DATE(v.fecha) = CURDATE()`;
    const salesParams = [cajaId, cajeroId];
    if (scope === 'session') {
      salesWhere += ' AND (v.turno_id = ? OR (v.turno_id IS NULL AND v.fecha >= ?))';
      salesParams.push(openShiftId, sessionStart);
    }

    const [departmentRows] = await db.query(
      `SELECT COALESCE(dep.nombre, 'Sin departamento') AS departamento,
              COALESCE(SUM(d.subtotal), 0) AS total_vendido,
              COALESCE(SUM((d.precio_unitario - COALESCE(p.costo, 0)) * d.cantidad), 0) AS ganancia
       FROM detalle_venta d
       INNER JOIN ventas v ON v.id_venta = d.venta_id
       LEFT JOIN productos p ON p.id_producto = d.producto_id
       LEFT JOIN departamento dep ON dep.id_departamento = p.id_departamento
       WHERE ${salesWhere}
       GROUP BY dep.id_departamento, dep.nombre
       ORDER BY total_vendido DESC, departamento ASC`,
      salesParams
    );

    return res.json({
      scope,
      departamentos: departmentRows,
    });
  } catch (error) {
    console.error('Error al obtener ventas por departamento del turno:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.post('/api/cash-movements', async (req, res) => {
  const cajaId = toInt(req.body?.numero_caja);
  const cajeroId = toInt(req.user?.sub) || toInt(req.body?.cajero);
  const tipoRaw = typeof req.body?.tipo === 'string' ? req.body.tipo.trim().toLowerCase() : '';
  const metodoRaw = typeof req.body?.metodo === 'string' ? req.body.metodo.trim().toLowerCase() : 'efectivo';
  const monto = toNumber(req.body?.monto);
  const descripcion = typeof req.body?.descripcion === 'string' ? req.body.descripcion.trim().slice(0, 255) : '';
  const allowedTypes = new Set(['entrada', 'salida', 'abono']);
  const allowedMethods = new Set(['efectivo', 'tarjeta', 'dolares', 'transferencia', 'cheque', 'vale', 'otro']);

  if (!cajaId || !cajeroId || !allowedTypes.has(tipoRaw) || monto === null || monto <= 0) {
    return res.status(400).json({ message: 'Datos inválidos para movimiento de caja' });
  }
  if (tipoRaw === 'salida' && !descripcion) {
    return res.status(400).json({ message: 'La salida requiere descripcion' });
  }
  const metodo = allowedMethods.has(metodoRaw) ? metodoRaw : 'efectivo';

  try {
    const [openRows] = await db.query(
      `SELECT id_corte
       FROM corte_caja
       WHERE caja_id = ? AND usuario_id = ? AND estado = 'abierto'
       ORDER BY id_corte DESC
       LIMIT 1`,
      [cajaId, cajeroId]
    );
    if (!openRows.length) {
      return res.status(409).json({ message: 'No hay turno abierto para registrar movimientos' });
    }

    const turnoId = Number(openRows[0].id_corte || 0) || null;
    const [result] = await db.query(
      `INSERT INTO cash_movements (fecha, caja_id, usuario_id, turno_id, tipo, metodo, monto, descripcion)
       VALUES (NOW(), ?, ?, ?, ?, ?, ?, ?)`,
      [cajaId, cajeroId, turnoId, tipoRaw, metodo, monto, descripcion || null]
    );

    return res.json({ message: 'Movimiento registrado', id_movimiento: result.insertId });
  } catch (error) {
    console.error('Error al registrar movimiento de caja:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.get('/api/reportes/ventas-detalle', async (req, res) => {
  const { desde, hasta } = req.query || {};
  const cajaId = toInt(req.query?.caja);
  const cajeroId = toInt(req.query?.cajero);
  const startDate = typeof desde === 'string' && desde ? desde : null;
  const endDate = typeof hasta === 'string' && hasta ? hasta : null;

  if (!startDate || !endDate || !isIsoDate(startDate) || !isIsoDate(endDate)) {
    return res.status(400).json({ message: 'Parametros desde y hasta son obligatorios en formato YYYY-MM-DD' });
  }

  const filters = ['DATE(v.fecha) BETWEEN ? AND ?'];
  const values = [startDate, endDate];
  if (cajaId) {
    filters.push('v.caja_id = ?');
    values.push(cajaId);
  }
  if (cajeroId) {
    filters.push('v.usuario_id = ?');
    values.push(cajeroId);
  }

  try {
    const [rows] = await db.query(
      `SELECT v.id_venta,
              DATE_FORMAT(v.fecha, '%Y-%m-%d %H:%i:%s') AS fecha,
              COALESCE(NULLIF(v.folio_ticket, ''), CAST(v.numero_ticket AS CHAR)) AS numero_ticket,
              v.usuario_id,
              COALESCE(u.nombre, '') AS cajero_nombre,
              v.caja_id,
              v.metodo_pago,
              v.total
       FROM ventas v
       LEFT JOIN usuarios u ON u.id = v.usuario_id
       WHERE ${filters.join(' AND ')}
       ORDER BY v.fecha ASC, v.numero_ticket ASC
       LIMIT 5000`,
      values
    );
    return res.json(rows);
  } catch (error) {
    console.error('Error al consultar ventas detalle:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.get('/api/reportes/charts', async (req, res) => {
  const parsed = buildReportSalesWhereFromQuery(req.query, 'v');
  if (!parsed.ok) {
    return res.status(400).json({ message: parsed.message });
  }

  const cashierPeriod = req.query?.cashier_period === 'monthly' ? 'monthly' : 'daily';
  const globalPeriod = req.query?.global_period === 'annual' ? 'annual' : 'monthly';
  const cashExpr = buildCashAmountSql('v');
  const cardExpr = buildCardAmountSql('v');

  try {
    const [dailyRows] = await db.query(
      `SELECT DATE_FORMAT(v.fecha, '%Y-%m-%d') AS etiqueta,
              COALESCE(SUM(${cashExpr}), 0) AS efectivo,
              COALESCE(SUM(${cardExpr}), 0) AS tarjeta
       FROM ventas v
       WHERE ${parsed.whereClause}
       GROUP BY DATE(v.fecha)
       ORDER BY DATE(v.fecha) ASC`,
      parsed.values
    );

    const [departmentRows] = await db.query(
      `SELECT COALESCE(dep.nombre, 'Sin departamento') AS etiqueta,
              COALESCE(SUM(d.subtotal), 0) AS total
       FROM detalle_venta d
       INNER JOIN ventas v ON v.id_venta = d.venta_id
       LEFT JOIN productos p ON p.id_producto = d.producto_id
       LEFT JOIN departamento dep ON dep.id_departamento = p.id_departamento
       WHERE ${parsed.whereClause}
       GROUP BY COALESCE(dep.nombre, 'Sin departamento')
       ORDER BY total DESC, etiqueta ASC`,
      parsed.values
    );

    const [monthlyRows] = await db.query(
      `SELECT DATE_FORMAT(v.fecha, '%Y-%m') AS etiqueta,
              COALESCE(SUM(${cashExpr}), 0) AS efectivo,
              COALESCE(SUM(${cardExpr}), 0) AS tarjeta
       FROM ventas v
       WHERE ${parsed.whereClause}
       GROUP BY YEAR(v.fecha), MONTH(v.fecha)
       ORDER BY YEAR(v.fecha) ASC, MONTH(v.fecha) ASC`,
      parsed.values
    );

    const cashierBucketSql = cashierPeriod === 'monthly'
      ? "DATE_FORMAT(v.fecha, '%Y-%m')"
      : "DATE_FORMAT(v.fecha, '%Y-%m-%d')";
    const [cashierRows] = await db.query(
      `SELECT ${cashierBucketSql} AS periodo,
              v.usuario_id,
              COALESCE(u.nombre, CONCAT('Cajero ', v.usuario_id)) AS cajero,
              COALESCE(SUM(v.total), 0) AS total
       FROM ventas v
       LEFT JOIN usuarios u ON u.id = v.usuario_id
       WHERE ${parsed.whereClause}
       GROUP BY ${cashierBucketSql}, v.usuario_id, u.nombre
       ORDER BY ${cashierBucketSql} ASC, total DESC
       LIMIT 500`,
      parsed.values
    );

    const globalBucketSql = globalPeriod === 'annual'
      ? 'YEAR(v.fecha)'
      : "DATE_FORMAT(v.fecha, '%Y-%m')";
    const [globalRows] = await db.query(
      `SELECT ${globalBucketSql} AS etiqueta,
              COALESCE(SUM(v.total), 0) AS total
       FROM ventas v
       WHERE ${parsed.whereClause}
       GROUP BY ${globalBucketSql}
       ORDER BY ${globalBucketSql} ASC`,
      parsed.values
    );

    return res.json({
      filters: {
        desde: parsed.startDate,
        hasta: parsed.endDate,
        caja: parsed.cajaId,
        cajero: parsed.cajeroId,
      },
      periods: {
        cashier_period: cashierPeriod,
        global_period: globalPeriod,
      },
      daily_payment: dailyRows.map((row) => ({
        label: row.etiqueta,
        efectivo: Number(row.efectivo || 0),
        tarjeta: Number(row.tarjeta || 0),
      })),
      department_sales: departmentRows.map((row) => ({
        label: row.etiqueta,
        total: Number(row.total || 0),
      })),
      monthly_payment: monthlyRows.map((row) => ({
        label: row.etiqueta,
        efectivo: Number(row.efectivo || 0),
        tarjeta: Number(row.tarjeta || 0),
      })),
      cashier_sales: cashierRows.map((row) => ({
        label: `${row.periodo} | ${row.cajero}`,
        periodo: row.periodo,
        usuario_id: Number(row.usuario_id || 0),
        cajero: row.cajero,
        total: Number(row.total || 0),
      })),
      all_cashiers_sales: globalRows.map((row) => ({
        label: String(row.etiqueta),
        total: Number(row.total || 0),
      })),
    });
  } catch (error) {
    console.error('Error al construir graficos de reportes:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.get('/api/reportes/chart-detail.csv', async (req, res) => {
  const chart = typeof req.query?.chart === 'string' ? req.query.chart.trim() : '';
  const parsed = buildReportSalesWhereFromQuery(req.query, 'v');
  if (!parsed.ok) {
    return res.status(400).json({ message: parsed.message });
  }

  const cashierPeriod = req.query?.cashier_period === 'monthly' ? 'monthly' : 'daily';
  const globalPeriod = req.query?.global_period === 'annual' ? 'annual' : 'monthly';
  let headers = [];
  let rows = [];
  let filePrefix = 'reporte';
  let reportTitle = 'Detalle de reporte';

  try {
    if (chart === 'daily_payment') {
      const [detailRows] = await db.query(
        `SELECT DATE_FORMAT(v.fecha, '%Y-%m-%d %H:%i:%s') AS fecha,
                COALESCE(u.nombre, CONCAT('Cajero ', v.usuario_id)) AS cajero,
                COALESCE(NULLIF(p.codigo_barras, ''), '') AS codigo_barras,
                COALESCE(NULLIF(p.descripcion, ''), NULLIF(d.descripcion, ''), 'Producto') AS producto,
                d.cantidad,
                d.precio_unitario,
                d.subtotal
         FROM detalle_venta d
         INNER JOIN ventas v ON v.id_venta = d.venta_id
         LEFT JOIN productos p ON p.id_producto = d.producto_id
         LEFT JOIN usuarios u ON u.id = v.usuario_id
         WHERE ${parsed.whereClause}
         ORDER BY v.fecha ASC, v.id_venta ASC, d.id_detalle ASC`,
        parsed.values
      );
      headers = ['fecha', 'cajero', 'codigo_barras', 'producto', 'cantidad', 'precio_venta', 'total_linea'];
      rows = detailRows.map((row) => [
        row.fecha,
        row.cajero,
        row.codigo_barras,
        row.producto,
        roundToDecimals(row.cantidad || 0, 2),
        roundToDecimals(row.precio_unitario || 0, 2),
        roundToDecimals(row.subtotal || 0, 2),
      ]);
      filePrefix = 'ventas_diarias_detalle';
      reportTitle = 'Ventas diarias - detalle por producto';
    } else if (chart === 'department_sales') {
      const [detailRows] = await db.query(
        `SELECT DATE_FORMAT(v.fecha, '%Y-%m-%d %H:%i:%s') AS fecha,
                COALESCE(dep.nombre, 'Sin departamento') AS departamento,
                COALESCE(u.nombre, CONCAT('Cajero ', v.usuario_id)) AS cajero,
                COALESCE(NULLIF(p.codigo_barras, ''), '') AS codigo_barras,
                COALESCE(NULLIF(p.descripcion, ''), NULLIF(d.descripcion, ''), 'Producto') AS producto,
                d.cantidad,
                d.precio_unitario,
                d.subtotal
         FROM detalle_venta d
         INNER JOIN ventas v ON v.id_venta = d.venta_id
         LEFT JOIN productos p ON p.id_producto = d.producto_id
         LEFT JOIN departamento dep ON dep.id_departamento = p.id_departamento
         LEFT JOIN usuarios u ON u.id = v.usuario_id
         WHERE ${parsed.whereClause}
         ORDER BY departamento ASC, v.fecha ASC, d.id_detalle ASC`,
        parsed.values
      );
      headers = ['fecha', 'departamento', 'cajero', 'codigo_barras', 'producto', 'cantidad', 'precio_venta', 'total_linea'];
      rows = detailRows.map((row) => [
        row.fecha,
        row.departamento,
        row.cajero,
        row.codigo_barras,
        row.producto,
        roundToDecimals(row.cantidad || 0, 2),
        roundToDecimals(row.precio_unitario || 0, 2),
        roundToDecimals(row.subtotal || 0, 2),
      ]);
      filePrefix = 'ventas_departamento_detalle';
      reportTitle = 'Ventas por departamento - detalle por producto';
    } else if (chart === 'monthly_payment') {
      const [detailRows] = await db.query(
        `SELECT DATE_FORMAT(v.fecha, '%Y-%m') AS periodo,
                DATE_FORMAT(v.fecha, '%Y-%m-%d %H:%i:%s') AS fecha,
                COALESCE(u.nombre, CONCAT('Cajero ', v.usuario_id)) AS cajero,
                v.metodo_pago,
                v.total
         FROM ventas v
         LEFT JOIN usuarios u ON u.id = v.usuario_id
         WHERE ${parsed.whereClause}
         ORDER BY YEAR(v.fecha) ASC, MONTH(v.fecha) ASC, v.fecha ASC, v.id_venta ASC`,
        parsed.values
      );
      headers = ['periodo', 'fecha', 'cajero', 'metodo_pago', 'total'];
      rows = detailRows.map((row) => [
        row.periodo,
        row.fecha,
        row.cajero,
        row.metodo_pago,
        roundToDecimals(row.total || 0, 2),
      ]);
      filePrefix = 'ventas_mensuales_detalle';
      reportTitle = 'Ventas mensuales - detalle';
    } else if (chart === 'cashier_sales') {
      const bucketSql = cashierPeriod === 'monthly'
        ? "DATE_FORMAT(v.fecha, '%Y-%m')"
        : "DATE_FORMAT(v.fecha, '%Y-%m-%d')";
      const [detailRows] = await db.query(
        `SELECT ${bucketSql} AS periodo,
                v.usuario_id,
                COALESCE(u.nombre, CONCAT('Cajero ', v.usuario_id)) AS cajero,
                COUNT(*) AS transacciones,
                COALESCE(SUM(v.total), 0) AS total
         FROM ventas v
         LEFT JOIN usuarios u ON u.id = v.usuario_id
         WHERE ${parsed.whereClause}
         GROUP BY ${bucketSql}, v.usuario_id, u.nombre
         ORDER BY ${bucketSql} ASC, total DESC`,
        parsed.values
      );
      headers = ['periodo', 'usuario_id', 'cajero', 'transacciones', 'total'];
      rows = detailRows.map((row) => [
        row.periodo,
        row.usuario_id,
        row.cajero,
        row.transacciones,
        roundToDecimals(row.total || 0, 2),
      ]);
      filePrefix = 'ventas_por_cajero_detalle';
      reportTitle = `Ventas por cajero (${cashierPeriod === 'monthly' ? 'mensual' : 'diario'})`;
    } else if (chart === 'all_cashiers_sales') {
      const bucketSql = globalPeriod === 'annual'
        ? 'YEAR(v.fecha)'
        : "DATE_FORMAT(v.fecha, '%Y-%m')";
      const [detailRows] = await db.query(
        `SELECT ${bucketSql} AS periodo,
                v.usuario_id,
                COALESCE(u.nombre, CONCAT('Cajero ', v.usuario_id)) AS cajero,
                COUNT(*) AS transacciones,
                COALESCE(SUM(v.total), 0) AS total
         FROM ventas v
         LEFT JOIN usuarios u ON u.id = v.usuario_id
         WHERE ${parsed.whereClause}
         GROUP BY ${bucketSql}, v.usuario_id, u.nombre
         ORDER BY ${bucketSql} ASC, total DESC`,
        parsed.values
      );
      headers = ['periodo', 'usuario_id', 'cajero', 'transacciones', 'total'];
      rows = detailRows.map((row) => [
        row.periodo,
        row.usuario_id,
        row.cajero,
        row.transacciones,
        roundToDecimals(row.total || 0, 2),
      ]);
      filePrefix = 'ventas_todos_cajeros_detalle';
      reportTitle = `Ventas de todos los cajeros (${globalPeriod === 'annual' ? 'anual' : 'mensual'})`;
    } else {
      return res.status(400).json({ message: 'Grafico no valido' });
    }

    const totalMonto = rows.reduce((acc, row) => acc + Number(row[row.length - 1] || 0), 0);
    if (rows.length) {
      const footer = new Array(headers.length).fill('');
      footer[0] = 'TOTAL GENERAL';
      footer[headers.length - 1] = totalMonto;
      rows.push(footer);
    }

    const titleFilters = [
      `Desde: ${parsed.startDate}`,
      `Hasta: ${parsed.endDate}`,
      parsed.cajaId ? `Caja: ${parsed.cajaId}` : 'Caja: Todas',
      parsed.cajeroId ? `Cajero: ${parsed.cajeroId}` : 'Cajero: Todos',
    ].join(' | ');
    const totalRowIndex = rows.length - 1;
    let ExcelJS;
    try {
      ExcelJS = require('exceljs');
    } catch (_) {
      return res.status(500).json({ message: 'Falta dependencia exceljs en el servidor' });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte');
    const columnCount = Math.max(1, headers.length);

    worksheet.addRow([reportTitle]);
    worksheet.mergeCells(1, 1, 1, columnCount);
    worksheet.getCell(1, 1).font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF0B4DA2' } };

    worksheet.addRow([titleFilters]);
    worksheet.mergeCells(2, 1, 2, columnCount);
    worksheet.getCell(2, 1).font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };

    worksheet.addRow([]);
    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        right: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      };
    });

    const dataStartRow = worksheet.rowCount + 1;
    rows.forEach((row) => worksheet.addRow(row));
    const dataEndRow = worksheet.rowCount;
    const totalExcelRowIndex = dataStartRow + totalRowIndex;

    for (let rowNumber = dataStartRow; rowNumber <= dataEndRow; rowNumber += 1) {
      const isTotalRow = rowNumber === totalExcelRowIndex;
      for (let colNumber = 1; colNumber <= columnCount; colNumber += 1) {
        const cell = worksheet.getCell(rowNumber, colNumber);
        const rawValue = cell.value;
        if (rawValue !== null && rawValue !== undefined && String(rawValue).trim() !== '') {
          cell.alignment = { vertical: 'middle', horizontal: typeof rawValue === 'number' ? 'right' : 'left' };
        }
        if (typeof rawValue === 'number') {
          cell.numFmt = '#,##0.00';
        }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          right: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        };
        if (isTotalRow) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: colNumber === columnCount ? 'FFBFDBFE' : 'FFDBEAFE' },
          };
          cell.font = {
            name: 'Calibri',
            size: colNumber === columnCount ? 15 : 10,
            bold: true,
            color: { argb: colNumber === columnCount ? 'FF0B4DA2' : 'FF0F172A' },
          };
        } else {
          const rowOffset = rowNumber - dataStartRow;
          const isOddRow = rowOffset % 2 === 0;
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: isOddRow ? 'FFEEF5FF' : 'FFFFFFFF' },
          };
          cell.font = { name: 'Calibri', size: 10, bold: false, color: { argb: 'FF0F172A' } };
        }
      }
    }

    for (let colNumber = 1; colNumber <= columnCount; colNumber += 1) {
      let maxLen = String(headers[colNumber - 1] || '').length;
      for (const row of rows) {
        const text = row?.[colNumber - 1] ?? '';
        maxLen = Math.max(maxLen, String(text).length);
      }
      worksheet.getColumn(colNumber).width = Math.min(50, Math.max(14, maxLen + 2));
    }

    const fileDate = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filePrefix}_${fileDate}.xlsx"`);
    await workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    console.error('Error al exportar detalle de grafico:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.get('/api/export/ventas.csv', async (req, res) => {
  const { desde, hasta } = req.query || {};
  const cajaId = toInt(req.query?.caja);
  const cajeroId = toInt(req.query?.cajero);
  const startDate = typeof desde === 'string' && desde ? desde : null;
  const endDate = typeof hasta === 'string' && hasta ? hasta : null;

  if (!startDate || !endDate || !isIsoDate(startDate) || !isIsoDate(endDate)) {
    return res.status(400).json({ message: 'Parametros desde y hasta son obligatorios en formato YYYY-MM-DD' });
  }

  const filters = ['DATE(v.fecha) BETWEEN ? AND ?'];
  const values = [startDate, endDate];
  if (cajaId) {
    filters.push('v.caja_id = ?');
    values.push(cajaId);
  }
  if (cajeroId) {
    filters.push('v.usuario_id = ?');
    values.push(cajeroId);
  }

  try {
    const [rows] = await db.query(
      `SELECT DATE_FORMAT(v.fecha, '%Y-%m-%d %H:%i:%s') AS fecha,
              COALESCE(NULLIF(v.folio_ticket, ''), CAST(v.numero_ticket AS CHAR)) AS numero_ticket,
              v.usuario_id,
              COALESCE(u.nombre, '') AS cajero_nombre,
              v.caja_id,
              v.metodo_pago,
              v.total
       FROM ventas v
       LEFT JOIN usuarios u ON u.id = v.usuario_id
       WHERE ${filters.join(' AND ')}
       ORDER BY v.fecha ASC, v.numero_ticket ASC`,
      values
    );

    const csv = toCsv(
      ['fecha', 'numero_ticket', 'usuario_id', 'cajero_nombre', 'caja_id', 'metodo_pago', 'total'],
      rows.map((row) => [
        row.fecha,
        row.numero_ticket,
        row.usuario_id,
        row.cajero_nombre,
        row.caja_id,
        row.metodo_pago,
        row.total,
      ])
    );

    const fileDate = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ventas_${fileDate}.csv"`);
    return res.status(200).send(`\uFEFF${csv}`);
  } catch (error) {
    console.error('Error al exportar ventas CSV:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.get('/api/export/cortes.csv', async (req, res) => {
  const { desde, hasta } = req.query || {};
  const cajaId = toInt(req.query?.caja);
  const cajeroId = toInt(req.query?.cajero);
  const startDate = typeof desde === 'string' && desde ? desde : null;
  const endDate = typeof hasta === 'string' && hasta ? hasta : null;

  if (!startDate || !endDate || !isIsoDate(startDate) || !isIsoDate(endDate)) {
    return res.status(400).json({ message: 'Parametros desde y hasta son obligatorios en formato YYYY-MM-DD' });
  }

  const filters = ['c.fecha BETWEEN ? AND ?'];
  const values = [startDate, endDate];
  if (cajaId) {
    filters.push('c.caja_id = ?');
    values.push(cajaId);
  }
  if (cajeroId) {
    filters.push('c.usuario_id = ?');
    values.push(cajeroId);
  }

  try {
    const [rows] = await db.query(
      `SELECT c.id_corte,
              DATE_FORMAT(c.fecha, '%Y-%m-%d') AS fecha,
              c.caja_id,
              c.usuario_id,
              COALESCE(u.nombre, '') AS cajero_nombre,
              c.monto_inicial,
              c.monto_declarado,
              c.diferencia_efectivo,
              c.total_efectivo,
              c.total_tarjeta,
              c.total_mixto,
              c.total_ventas,
              c.transacciones,
              c.estado
       FROM corte_caja c
       LEFT JOIN usuarios u ON u.id = c.usuario_id
       WHERE ${filters.join(' AND ')}
       ORDER BY c.fecha ASC, c.id_corte ASC`,
      values
    );

    const csv = toCsv(
      [
        'id_corte',
        'fecha',
        'caja_id',
        'usuario_id',
        'cajero_nombre',
        'monto_inicial',
        'monto_declarado',
        'diferencia_efectivo',
        'total_efectivo',
        'total_tarjeta',
        'total_mixto',
        'total_ventas',
        'transacciones',
        'estado',
      ],
      rows.map((row) => [
        row.id_corte,
        row.fecha,
        row.caja_id,
        row.usuario_id,
        row.cajero_nombre,
        row.monto_inicial,
        row.monto_declarado,
        row.diferencia_efectivo,
        row.total_efectivo,
        row.total_tarjeta,
        row.total_mixto,
        row.total_ventas,
        row.transacciones,
        row.estado,
      ])
    );

    const fileDate = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="cortes_${fileDate}.csv"`);
    return res.status(200).send(`\uFEFF${csv}`);
  } catch (error) {
    console.error('Error al exportar cortes CSV:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

app.get('/api/database/export', async (req, res) => {
  try {
    const dump = await buildDatabaseSqlDump();
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
    const filename = `minimarket_${config.db.database}_${stamp}.sql`;

    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(dump);
  } catch (error) {
    console.error('Error exportando base de datos:', error);
    return res.status(500).json({ message: 'No se pudo exportar la base de datos' });
  }
});

app.get('/api/database/verify', async (req, res) => {
  try {
    const snapshot = await getDatabaseVerifySnapshot();
    return res.json(snapshot);
  } catch (error) {
    console.error('Error verificando base de datos:', error);
    return res.status(500).json({ ok: false, message: 'No se pudo verificar la base de datos' });
  }
});

app.get('/api/database/maintenance-file', async (req, res) => {
  try {
    const report = await buildMaintenanceReport({ requestedBy: req.user?.sub || null });
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
    const filename = `mantenimiento_${config.db.database}_${stamp}.txt`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(report);
  } catch (error) {
    console.error('Error generando archivo de mantenimiento:', error);
    return res.status(500).json({ success: false, message: 'No se pudo generar el archivo de mantenimiento' });
  }
});

app.get('/api/database/maintenance-preview', async (req, res) => {
  try {
    const report = await buildMaintenanceReport({ requestedBy: req.user?.sub || null });
    return res.json({
      success: true,
      content: report,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error generando vista previa de mantenimiento:', error);
    return res.status(500).json({ success: false, message: 'No se pudo generar la vista previa de mantenimiento' });
  }
});

app.post('/api/database/send-diagnostics', async (req, res) => {
  try {
    const mailConfig = getMailTransportConfig();
    if (!mailConfig) {
      return res.status(400).json({
        success: false,
        message: 'SMTP no configurado. Define SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS y SMTP_FROM en server/.env',
      });
    }

    let nodemailer;
    try {
      nodemailer = require('nodemailer');
    } catch (_) {
      return res.status(500).json({
        success: false,
        message: 'Falta dependencia nodemailer. Ejecuta npm install en /server para habilitar envio de diagnosticos.',
      });
    }

    const report = await buildMaintenanceReport({ requestedBy: req.user?.sub || null });
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
    const transport = nodemailer.createTransport({
      host: mailConfig.host,
      port: mailConfig.port,
      secure: mailConfig.secure,
      auth: mailConfig.auth,
    });

    await transport.sendMail({
      from: mailConfig.from,
      to: 'siatalca@gmail.com',
      subject: `Diagnostico Minimarket - ${config.db.database} - ${stamp}`,
      text: report,
      attachments: [
        {
          filename: `diagnostico_${config.db.database}_${stamp}.txt`,
          content: report,
          contentType: 'text/plain; charset=utf-8',
        },
      ],
    });

    return res.json({
      success: true,
      message: 'Diagnostico enviado a siatalca@gmail.com',
    });
  } catch (error) {
    console.error('Error enviando diagnostico:', error);
    return res.status(500).json({ success: false, message: 'No se pudo enviar el diagnostico por correo' });
  }
});

app.post('/api/error-report', async (req, res) => {
  try {
    const source = sanitizeErrorText(req.body?.source || 'frontend.unknown', 120);
    const message = sanitizeErrorText(req.body?.message || 'Sin mensaje', 2000);
    const stack = sanitizeErrorText(req.body?.stack || '', 9000);
    const url = sanitizeErrorText(req.body?.url || '', 600);
    const method = sanitizeErrorText(req.body?.method || '', 24);
    const userAgent = sanitizeErrorText(req.body?.user_agent || req.headers['user-agent'] || '', 600);
    const caja = sanitizeErrorText(req.body?.caja || '', 20);
    const user = sanitizeErrorText(req.body?.user || '', 40);
    const ip = sanitizeErrorText(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '', 120);

    queueErrorEmailReport(source, {
      message,
      stack,
      url,
      method,
      user_agent: userAgent,
      caja,
      user,
      ip,
    });
    return res.json({ success: true });
  } catch (error) {
    console.error('Error report endpoint failure:', error);
    return res.status(500).json({ success: false, message: 'No se pudo procesar el reporte' });
  }
});

app.post('/api/database/reset', async (req, res) => {
  const confirmed = normalizeBool(req.body?.confirm, false);
  if (!confirmed) {
    return res.status(400).json({ success: false, message: 'Confirmacion requerida para reiniciar la base de datos' });
  }

  const keepTables = new Set([
    'usuarios',
    'cajero_permisos',
    'cajas',
    'info',
    'ticket_settings',
    'payment_settings',
    'currency_settings',
    'unit_settings',
    'tax_settings',
    'personalization_settings',
    'device_settings',
    'cut_settings',
  ]);

  try {
    const [tableRows] = await db.query('SHOW TABLES');
    const allTables = tableRows
      .map((row) => Object.values(row)[0])
      .filter((name) => typeof name === 'string' && name.trim().length > 0);
    const targetTables = allTables.filter((name) => !keepTables.has(name));

    await db.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const tableName of targetTables) {
      await db.query(`TRUNCATE TABLE \`${tableName}\``);
    }
    await db.query('SET FOREIGN_KEY_CHECKS = 1');
    await db.query('UPDATE usuarios SET estado_usuario = 0');

    return res.json({
      success: true,
      message: 'Base de datos reiniciada (se conservaron configuraciones y usuarios).',
      tables_reset: targetTables,
      tables_preserved: Array.from(keepTables),
    });
  } catch (error) {
    try {
      await db.query('SET FOREIGN_KEY_CHECKS = 1');
    } catch (_) {}
    console.error('Error reiniciando base de datos:', error);
    return res.status(500).json({ success: false, message: 'No se pudo reiniciar la base de datos' });
  }
});

app.post('/api/system/restart-backend', async (req, res) => {
  try {
    const nodePath = process.execPath;
    const scriptPath = path.join(__dirname, 'server.js');
    const command = `timeout /t 2 /nobreak >nul && "${nodePath}" "${scriptPath}"`;

    const detached = spawn('cmd.exe', ['/d', '/s', '/c', command], {
      cwd: __dirname,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: process.env,
    });
    detached.unref();

    res.json({
      success: true,
      message: 'Backend reiniciandose. Espera 3-5 segundos y vuelve a intentar.',
    });

    setTimeout(() => {
      process.exit(0);
    }, 2500);
  } catch (error) {
    console.error('Error al reiniciar backend:', error);
    return res.status(500).json({
      success: false,
      message: 'No se pudo reiniciar el backend',
    });
  }
});

app.post('/api/corte/cerrar', async (req, res) => {
  const cajaId = toInt(req.body?.numero_caja);
  const cajeroId = toInt(req.body?.cajero);
  const authUserId = toInt(req.user?.sub);
  const montoDeclaradoInput = toNumber(req.body?.monto_declarado ?? 0);
  const montoDeclaradoTarjetaInput = toNumber(req.body?.monto_declarado_tarjeta ?? 0);
  const observaciones = req.body?.observaciones ? toText(req.body?.observaciones, 255) : null;

  if (!cajaId || !cajeroId) {
    return res.status(400).json({ message: 'Datos incompletos o invalidos para cerrar turno' });
  }
  if (authUserId && authUserId !== cajeroId) {
    return res.status(403).json({ message: 'No autorizado para cerrar este turno' });
  }

  try {
    const [existing] = await db.query(
      `SELECT id_corte, estado, monto_inicial, hora_apertura FROM corte_caja
       WHERE fecha = CURDATE() AND caja_id = ? AND usuario_id = ? AND estado = 'abierto'
       ORDER BY id_corte DESC
       LIMIT 1`,
      [cajaId, cajeroId]
    );

    if (existing.length === 0) {
      return res.status(409).json({ message: 'Debe iniciar turno antes de cerrarlo' });
    }

    const shiftId = Number(existing[0].id_corte || 0);
    const shiftStart = existing[0].hora_apertura;

    const [byPayment] = await db.query(
      `SELECT metodo_pago, COUNT(*) AS transacciones, COALESCE(SUM(total), 0) AS total
       FROM ventas
       WHERE caja_id = ? AND usuario_id = ?
         AND (turno_id = ? OR (turno_id IS NULL AND fecha >= ?))
       GROUP BY metodo_pago`,
      [cajaId, cajeroId, shiftId, shiftStart]
    );

    const [totals] = await db.query(
      `SELECT COUNT(*) AS transacciones, COALESCE(SUM(total), 0) AS total
       FROM ventas
       WHERE caja_id = ? AND usuario_id = ?
         AND (turno_id = ? OR (turno_id IS NULL AND fecha >= ?))`,
      [cajaId, cajeroId, shiftId, shiftStart]
    );

    const [cashAndCardRows] = await db.query(
      `SELECT
         COALESCE(SUM(
           CASE
             WHEN metodo_pago = 'efectivo' THEN total
             WHEN metodo_pago = 'mixto' THEN
               CASE WHEN COALESCE(monto_efectivo, 0) > 0 THEN monto_efectivo ELSE total / 2 END
             ELSE 0
           END
         ), 0) AS total_efectivo,
         COALESCE(SUM(
           CASE
             WHEN metodo_pago = 'tarjeta' THEN total
             WHEN metodo_pago = 'mixto' THEN
               CASE WHEN COALESCE(monto_tarjeta, 0) > 0 THEN monto_tarjeta ELSE total / 2 END
             WHEN metodo_pago IN ('dolares', 'transferencia', 'cheque', 'vale') THEN total
             ELSE 0
           END
         ), 0) AS total_tarjeta
       FROM ventas
       WHERE caja_id = ? AND usuario_id = ?
         AND (turno_id = ? OR (turno_id IS NULL AND fecha >= ?))`,
      [cajaId, cajeroId, shiftId, shiftStart]
    );

    const [movementRows] = await db.query(
      `SELECT tipo, COALESCE(SUM(monto), 0) AS total
       FROM cash_movements
       WHERE caja_id = ?
         AND usuario_id = ?
         AND DATE(fecha) = CURDATE()
         AND (turno_id = ? OR (turno_id IS NULL AND fecha >= ?))
       GROUP BY tipo`,
      [cajaId, cajeroId, shiftId, shiftStart]
    );

    let totalEfectivo = Number(cashAndCardRows[0]?.total_efectivo || 0);
    let totalTarjeta = Number(cashAndCardRows[0]?.total_tarjeta || 0);
    let totalMixto = 0;
    const entradasDinero = movementRows
      .filter((row) => row.tipo === 'entrada')
      .reduce((acc, row) => acc + Number(row.total || 0), 0);
    const salidasDinero = movementRows
      .filter((row) => row.tipo === 'salida')
      .reduce((acc, row) => acc + Number(row.total || 0), 0);
    const abonosEfectivo = movementRows
      .filter((row) => row.tipo === 'abono')
      .reduce((acc, row) => acc + Number(row.total || 0), 0);

    for (const row of byPayment) {
      const amount = Number(row.total) || 0;
      if (row.metodo_pago === 'mixto') {
        totalMixto = amount;
        continue;
      }
    }

    const [cutSettingRows] = await db.query('SELECT cut_mode FROM personalization_settings WHERE id = 1 LIMIT 1');
    const cutMode = cutSettingRows.length > 0 && cutSettingRows[0].cut_mode === 'sin_ajuste'
      ? 'sin_ajuste'
      : 'ajuste_auto';

    const montoInicialTurno = Number(existing[0].monto_inicial || 0);
    const efectivoEsperado = montoInicialTurno + totalEfectivo + abonosEfectivo + entradasDinero - salidasDinero;
    const tarjetaEsperada = totalTarjeta;
    let montoDeclarado = efectivoEsperado;
    let diferenciaEfectivo = 0;
    let montoDeclaradoTarjeta = tarjetaEsperada;
    let diferenciaTarjeta = 0;
    if (cutMode === 'ajuste_auto') {
      if (montoDeclaradoInput === null || montoDeclaradoInput < 0) {
        return res.status(400).json({ message: 'Monto declarado invalido para cierre con ajuste automatico' });
      }
      if (montoDeclaradoTarjetaInput === null || montoDeclaradoTarjetaInput < 0) {
        return res.status(400).json({ message: 'Monto declarado de tarjeta invalido para cierre con ajuste automatico' });
      }
      montoDeclarado = montoDeclaradoInput;
      diferenciaEfectivo = montoDeclarado - efectivoEsperado;
      montoDeclaradoTarjeta = montoDeclaradoTarjetaInput;
      diferenciaTarjeta = montoDeclaradoTarjeta - tarjetaEsperada;
    }

    await db.query(
      `UPDATE corte_caja
       SET hora_cierre = NOW(),
           monto_declarado = ?,
           monto_declarado_tarjeta = ?,
           diferencia_efectivo = ?,
           diferencia_tarjeta = ?,
           total_efectivo = ?,
           total_tarjeta = ?,
           total_mixto = ?,
           total_ventas = ?,
           transacciones = ?,
           estado = 'cerrado',
           observaciones = ?
       WHERE id_corte = ?`,
      [
        montoDeclarado,
        montoDeclaradoTarjeta,
        diferenciaEfectivo,
        diferenciaTarjeta,
        totalEfectivo,
        totalTarjeta,
        totalMixto,
        Number(totals[0]?.total || 0),
        Number(totals[0]?.transacciones || 0),
        observaciones,
        existing[0].id_corte,
      ]
    );

    await db.query(
      `UPDATE user_auth_sessions
       SET revoked_at = NOW()
       WHERE user_id = ?
         AND caja_id = ?
         AND revoked_at IS NULL`,
      [cajeroId, cajaId]
    );

    return res.json({
      success: true,
      id_corte: existing[0].id_corte,
      fecha: new Date().toISOString().slice(0, 10),
      total_ventas: Number(totals[0]?.total || 0),
      transacciones: Number(totals[0]?.transacciones || 0),
      total_efectivo: totalEfectivo,
      total_tarjeta: totalTarjeta,
      total_mixto: totalMixto,
      efectivo_esperado: efectivoEsperado,
      monto_inicial: montoInicialTurno,
      monto_declarado: montoDeclarado,
      monto_declarado_tarjeta: montoDeclaradoTarjeta,
      diferencia_efectivo: diferenciaEfectivo,
      diferencia_tarjeta: diferenciaTarjeta,
      mode: cutMode,
    });
  } catch (error) {
    console.error('Error al cerrar turno:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

//---------------------------POSTs-----------------------------------------------------

app.post('/api/auth/refresh', async (req, res) => {
  const refreshToken = String(req.body?.refresh_token || '').trim();
  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token requerido' });
  }

  try {
    const tokenHash = hashRefreshToken(refreshToken);
    const [sessionRows] = await db.query(
      `SELECT id, user_id, caja_id, turno_id
       FROM user_auth_sessions
       WHERE token_hash = ?
         AND revoked_at IS NULL
         AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash]
    );

    if (!sessionRows.length) {
      return res.status(401).json({ message: 'Refresh token invalido', code: 'REFRESH_INVALID' });
    }

    const authSession = sessionRows[0];
    const userId = Number(authSession.user_id || 0);
    if (!userId) {
      return res.status(401).json({ message: 'Sesion invalida', code: 'REFRESH_INVALID' });
    }

    if (authSession.turno_id) {
      const [openShiftRows] = await db.query(
        `SELECT id_corte
         FROM corte_caja
         WHERE id_corte = ? AND usuario_id = ? AND estado = 'abierto'
         LIMIT 1`,
        [authSession.turno_id, userId]
      );
      if (!openShiftRows.length) {
        await db.query('UPDATE user_auth_sessions SET revoked_at = NOW() WHERE id = ?', [authSession.id]);
        return res.status(401).json({ message: 'Sesion finalizada. Turno cerrado.', code: 'REFRESH_TURNO_CERRADO' });
      }
    }

    const [userRows] = await db.query(
      'SELECT id, nombre FROM usuarios WHERE id = ? LIMIT 1',
      [userId]
    );
    if (!userRows.length) {
      await db.query('UPDATE user_auth_sessions SET revoked_at = NOW() WHERE id = ?', [authSession.id]);
      return res.status(401).json({ message: 'Usuario no disponible', code: 'REFRESH_INVALID' });
    }

    const newRefreshToken = crypto.randomBytes(48).toString('hex');
    const newHash = hashRefreshToken(newRefreshToken);
    const newExpiry = new Date(Date.now() + (REFRESH_TOKEN_TTL_SECONDS * 1000));

    await db.query(
      `UPDATE user_auth_sessions
       SET token_hash = ?, expires_at = ?, last_used_at = NOW()
       WHERE id = ?`,
      [newHash, newExpiry, authSession.id]
    );

    const token = issueAccessToken(userRows[0].id, userRows[0].nombre);

    return res.json({
      token,
      refresh_token: newRefreshToken,
      token_expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_expires_in: REFRESH_TOKEN_TTL_SECONDS,
    });
  } catch (error) {
    console.error('Error en refresh de sesion:', error);
    return res.status(500).json({ message: 'No se pudo renovar la sesion' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  const refreshToken = String(req.body?.refresh_token || '').trim();
  if (!refreshToken) {
    return res.json({ success: true });
  }
  try {
    await db.query(
      `UPDATE user_auth_sessions
       SET revoked_at = NOW()
       WHERE token_hash = ? AND revoked_at IS NULL`,
      [hashRefreshToken(refreshToken)]
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('Error al cerrar sesion por refresh token:', error);
    return res.status(500).json({ message: 'No se pudo cerrar sesion' });
  }
});

// -----------------Validacion de usuario
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  const cajaId = toInt(req.body?.numero_caja);
  const deviceHash = toText(req.body?.device_hash, 64);
  const usernameInput = typeof username === 'string' ? username.trim() : '';
  const passwordInput = typeof password === 'string' ? password : '';

  if (!usernameInput || !passwordInput) {
    return res.status(400).json({ message: 'Datos incompletos o invalidos' });
  }

  try {
    const loginPermissionSelect = CASHIER_PERMISSION_FIELDS.map((field) => `p.\`${field}\``).join(', ');
    const [rows] = await db.query(
      `SELECT u.id, u.user, u.nombre, u.contrasena, u.es_administrador,
              ${loginPermissionSelect}
       FROM usuarios u
       LEFT JOIN cajero_permisos p ON p.usuario_id = u.id
       WHERE LOWER(u.user) = LOWER(?) OR LOWER(u.nombre) = LOWER(?)
       ORDER BY u.id ASC
       LIMIT 1`,
      [usernameInput, usernameInput]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Credenciales invalidas' });
    }

    const user = rows[0];
    const storedPassword = user.contrasena || '';
    let passwordOk = false;
    let upgradeHash = false;

    if (storedPassword.startsWith('$2')) {
      passwordOk = await bcrypt.compare(passwordInput, storedPassword);
    } else {
      passwordOk = storedPassword === passwordInput;
      upgradeHash = passwordOk;
    }

    if (!passwordOk) {
      return res.status(401).json({ message: 'Credenciales invalidas' });
    }

    if (cajaId) {
      const [openShiftRows] = await db.query(
        `SELECT c.usuario_id, u.nombre AS cajero_nombre
         FROM corte_caja c
         LEFT JOIN usuarios u ON u.id = c.usuario_id
         WHERE c.fecha = CURDATE() AND c.caja_id = ? AND c.estado = 'abierto'
         ORDER BY c.id_corte DESC
         LIMIT 1`,
        [cajaId]
      );
      if (openShiftRows.length > 0) {
        const ownerUserId = Number(openShiftRows[0].usuario_id || 0);
        if (ownerUserId && ownerUserId !== Number(user.id)) {
          return res.status(409).json({
            message: `Hay un turno abierto en caja ${cajaId}. Solo puede ingresar ${openShiftRows[0].cajero_nombre || 'el cajero del turno abierto'} hasta realizar cierre.`,
            code: 'TURNO_ABIERTO_OTRO_CAJERO',
            caja_id: cajaId,
            usuario_id: ownerUserId,
          });
        }
      }
    }

    if (upgradeHash) {
      const hashed = await bcrypt.hash(passwordInput, 12);
      await db.query('UPDATE usuarios SET contrasena = ? WHERE id = ?', [
        hashed,
        user.id,
      ]);
    }

    let turnoId = null;
    if (cajaId) {
      const [ownOpenShiftRows] = await db.query(
        `SELECT id_corte
         FROM corte_caja
         WHERE fecha = CURDATE()
           AND caja_id = ?
           AND usuario_id = ?
           AND estado = 'abierto'
         ORDER BY id_corte DESC
         LIMIT 1`,
        [cajaId, user.id]
      );
      if (ownOpenShiftRows.length > 0) {
        turnoId = Number(ownOpenShiftRows[0].id_corte || 0) || null;
      }
    }

    const token = issueAccessToken(user.id, user.nombre);
    const refreshSession = await createRefreshSession({
      userId: Number(user.id),
      cajaId: cajaId || null,
      turnoId,
      deviceHash: deviceHash || null,
    });

    const permissions = {};
    CASHIER_PERMISSION_FIELDS.forEach((field) => {
      const fallback = Boolean(CASHIER_PERMISSION_DEFAULTS[field]);
      permissions[field] = normalizeBool(user[field], fallback) ? 1 : 0;
    });

    return res.json({
      message: 'Login exitoso',
      token,
      refresh_token: refreshSession.refreshToken,
      token_expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_expires_in: REFRESH_TOKEN_TTL_SECONDS,
      id: user.id,
      username: user.nombre,
      es_administrador: Number(user.es_administrador || 0),
      permisos: permissions,
    });
  } catch (error) {
    console.error('Error durante el login:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Ingresar producto
app.post('/api/productos', async (req, res) => {
  const {
    codigo_barras,
    descripcion,
    formato_venta,
    costo,
    ganancia,
    precio_venta,
    utiliza_inventario,
    cantidad_actual,
    cantidad_minima,
    cantidad_maxima,
    departamento,
    supplier_id,
    exento_iva,
  } = req.body;
  const barcode = toText(codigo_barras, 80);
  const description = toText(descripcion, 255);
  const formatName = normalizeSaleFormatName(formato_venta);
  const departmentName = toText(departamento, 80);
  const costoNum = toNumber(costo);
  const gananciaNum = roundToDecimals(ganancia ?? 0, 2);
  const priceNum = toNumber(precio_venta);
  const invFlag = toBool(utiliza_inventario);
  const actualQty = toNumber(cantidad_actual ?? 0);
  const minQty = toNumber(cantidad_minima ?? 0);
  const maxQty = toNumber(cantidad_maxima ?? 0);
  const supplierId = supplier_id === null || typeof supplier_id === 'undefined'
    ? null
    : toInt(supplier_id);
  const taxExempt = toBool(exento_iva);

  if (!barcode || !description || !formatName || !departmentName) {
    return res.status(400).json({ message: 'Datos de producto incompletos o invalidos' });
  }
  if (costoNum === null || gananciaNum === null || priceNum === null || invFlag === null || taxExempt === null) {
    return res.status(400).json({ message: 'Datos numericos o booleanos invalidos' });
  }
  if (actualQty === null || minQty === null || maxQty === null) {
    return res.status(400).json({ message: 'Cantidades invalidas' });
  }
  if (costoNum < 0 || gananciaNum < 0 || priceNum < 0 || actualQty < 0 || minQty < 0 || maxQty < 0) {
    return res.status(400).json({ message: 'No se permiten valores negativos' });
  }
  if (supplierId !== null && (!supplierId || supplierId < 1)) {
    return res.status(400).json({ message: 'Proveedor asignado invalido' });
  }

  try {
    const [existingProductRows] = await db.query(
      'SELECT id_producto FROM productos WHERE TRIM(codigo_barras) = TRIM(?) LIMIT 1',
      [barcode]
    );
    if (existingProductRows.length > 0) {
      return res.status(409).json({
        code: 'PRODUCT_CODE_EXISTS',
        message: 'El codigo de barras ya esta registrado',
      });
    }

    const [formatoRows] = await db.query(
      'SELECT id_formato FROM formato_venta WHERE LOWER(descripcion) = ? LIMIT 1',
      [formatName]
    );

    if (formatoRows.length === 0) {
      return res.status(400).json({ message: 'Formato de venta no valido' });
    }
    const id_formato = formatoRows[0].id_formato;

    const [departamentoRows] = await db.query(
      'SELECT id_departamento FROM departamento WHERE nombre = ?',
      [departmentName]
    );
    if (departamentoRows.length === 0) {
      return res.status(400).json({ message: 'Departamento no valido' });
    }
    const id_departamento = departamentoRows[0].id_departamento;

    if (supplierId !== null) {
      const [supplierRows] = await db.query('SELECT id FROM service_suppliers WHERE id = ? LIMIT 1', [supplierId]);
      if (!supplierRows.length) {
        return res.status(400).json({ message: 'Proveedor asignado no existe' });
      }
    }

    await db.query(
      `INSERT INTO productos (
              codigo_barras, descripcion, id_formato, costo, ganancia, precio_venta,
              utiliza_inventario, cantidad_actual, cantidad_minima,
              cantidad_maxima, id_departamento, supplier_id, exento_iva
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        barcode,
        description,
        id_formato,
        costoNum,
        gananciaNum,
        priceNum,
        invFlag,
        actualQty,
        minQty,
        maxQty,
        id_departamento,
        supplierId,
        taxExempt ? 1 : 0,
      ]
    );

    res.status(201).json({ message: 'Producto anadido exitosamente' });
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        code: 'PRODUCT_CODE_EXISTS',
        message: 'El codigo de barras ya esta registrado',
      });
    }
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// ----------------conecta un nuevo usuario al sistema
app.post('/api/connect', async (req, res) => {
  const { numero_caja, user_id } = req.body;
  const cajaId = toInt(numero_caja);
  const userId = toInt(user_id);

  if (!cajaId || !userId || cajaId < 1 || userId < 1) {
    return res.status(400).json({ message: 'Datos incompletos o invalidos' });
  }

  try {
    await db.query(
      'INSERT INTO conectados (caja_conectada,estado,user_id,fecha_conexion,hora_conexion) ' +
        'VALUES (?,?,?,current_date(),current_time())',
      [cajaId, true, userId]
    );
    res.json({ message: 'Nuevo usuario registrado' });
  } catch (error) {
    console.error('Error al insertar caja:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// ---------------desconecta un usuario del sistema
app.post('/api/disconnect', async (req, res) => {
  const { numero_caja, user_id } = req.body;
  const cajaId = toInt(numero_caja);
  const userId = toInt(user_id);

  if (!cajaId || !userId || cajaId < 1 || userId < 1) {
    return res.status(400).json({ message: 'Datos incompletos o invalidos' });
  }

  try {
    await db.query(
      'INSERT INTO conectados (caja_conectada,estado,user_id,fecha_conexion,hora_conexion) ' +
        'VALUES (?,?,?,current_date(),current_time())',
      [cajaId, false, userId]
    );
    res.json({ message: 'Usuario desconectado' });
  } catch (error) {
    console.error('Error al insertar caja:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// ---------------consulta por un usuario conectado al sistema
app.post('/api/getconnect', async (req, res) => {
  const { numero_caja, user_id } = req.body;
  const cajaId = toInt(numero_caja);
  const userId = toInt(user_id);
  let mensaje = '';

  if (!cajaId || !userId) {
    return res.status(400).json({ message: 'Datos incompletos o invalidos' });
  }

  try {
    const [conexion] = await db.query(
      'SELECT COUNT(id_conectado) AS conexion_activa FROM conectados ' +
        'WHERE caja_conectada = ? AND user_id = ? AND fecha_conexion = CURRENT_DATE() AND estado = 1',
      [cajaId, userId]
    );
    const [userEstado] = await db.query(
      'SELECT estado_usuario FROM usuarios WHERE id = ?',
      [userId]
    );

    if (!userEstado.length) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (userEstado[0].estado_usuario == 0) {
      mensaje = 'usuario desconectado,';
    }
    if (userEstado[0].estado_usuario == 1) {
      mensaje = 'usuario conectado,';
    }
    if (conexion[0].conexion_activa == 1) {
      mensaje = `${mensaje} conexion creada`;
    }
    if (conexion[0].conexion_activa == 0) {
      mensaje = `${mensaje} conexion no existe`;
    }
    res.json({ message: mensaje });
  } catch (error) {
    console.error('Error al consultar caja:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// ---------------almacena los datos de la venta y guarda un registro de cada producto por venta
app.post('/api/sales', async (req, res) => {
  const { numero_ticket, cajero, numero_caja, metodo_pago, producto } = req.body || {};

  const ticketNumber = toInt(numero_ticket);
  const cajeroId = toInt(cajero);
  const cajaId = toInt(numero_caja);

  const paymentMethod = toText(metodo_pago, 20);
  const allowedMethods = new Set(['efectivo', 'tarjeta', 'mixto', 'dolares', 'transferencia', 'cheque', 'vale']);
  const efectivoIn = toNumber(req.body?.monto_efectivo);
  const tarjetaIn = toNumber(req.body?.monto_tarjeta);

  if (!ticketNumber || !cajeroId || !cajaId || !paymentMethod) {
    return res.status(400).json({ error: 'Datos incompletos o invalidos' });
  }
  if (!allowedMethods.has(paymentMethod)) {
    return res.status(400).json({ error: 'Metodo de pago invalido' });
  }
  if (!Array.isArray(producto) || producto.length === 0) {
    return res.status(400).json({ error: 'Productos invalidos' });
  }

  const items = producto.map((item) => {
    const id = toInt(item.id_producto);
    const qty = toNumber(item.quantity);
    const unitPrice = toNumber(item.precio_venta);
    const desc = typeof item.descripcion === 'string' ? item.descripcion.trim() : '';
    const isCommon = !id;
    return { id, qty, unitPrice, desc, isCommon };
  });

  if (items.some((item) => !Number.isFinite(item.qty) || item.qty <= 0)) {
    return res.status(400).json({ error: 'Productos invalidos' });
  }
  if (items.some((item) => item.isCommon && (!Number.isFinite(item.unitPrice) || item.unitPrice <= 0 || !item.desc))) {
    return res.status(400).json({ error: 'Producto comun invalido' });
  }

  const uniqueIds = [...new Set(items.filter((item) => !item.isCommon).map((item) => item.id))];
  let connection;

  try {
    const [turnRows] = await db.query(
      `SELECT id_corte, estado, hora_apertura
       FROM corte_caja
       WHERE fecha = CURDATE() AND caja_id = ? AND usuario_id = ? AND estado = 'abierto'
       ORDER BY id_corte DESC
       LIMIT 1`,
      [cajaId, cajeroId]
    );
    if (!turnRows.length) {
      return res.status(409).json({ error: 'Debe iniciar turno ingresando el monto inicial de caja' });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    let productMap = new Map();
    let singlePromotionRulesByProduct = new Map();
    let comboPromotionMap = new Map();
    if (uniqueIds.length > 0) {
      const [rows] = await connection.query(
        'SELECT id_producto, descripcion, precio_venta, utiliza_inventario, cantidad_actual FROM productos WHERE id_producto IN (?)',
        [uniqueIds]
      );

      if (rows.length !== uniqueIds.length) {
        await connection.rollback();
        return res.status(400).json({ error: 'Producto no encontrado' });
      }
      productMap = new Map(rows.map((row) => [row.id_producto, row]));

      const [promotionRows] = await connection.query(
        `SELECT ppi.product_id, pp.id AS promotion_id, pp.nombre AS promotion_name,
                pp.promo_type, pp.min_qty, pp.discount_percent, pp.combo_price
         FROM product_promotion_items ppi
         INNER JOIN product_promotions pp ON pp.id = ppi.promotion_id
         WHERE ppi.product_id IN (?) AND pp.is_active = 1`,
        [uniqueIds]
      );
      promotionRows.forEach((row) => {
        const productId = Number(row.product_id || 0);
        const promotionId = Number(row.promotion_id || 0);
        const promoType = String(row.promo_type || 'single').toLowerCase();
        if (!productId || !promotionId) return;

        if (promoType === 'combo') {
          if (!comboPromotionMap.has(promotionId)) {
            comboPromotionMap.set(promotionId, {
              promotionId,
              promotionName: row.promotion_name || 'Combo',
              comboPrice: Number(row.combo_price || 0),
              productIds: new Set(),
            });
          }
          comboPromotionMap.get(promotionId).productIds.add(productId);
          return;
        }

        if (!singlePromotionRulesByProduct.has(productId)) {
          singlePromotionRulesByProduct.set(productId, []);
        }
        singlePromotionRulesByProduct.get(productId).push({
          promotionId,
          promotionName: row.promotion_name || 'Promocion',
          minQty: Number(row.min_qty || 0),
          discountPercent: Number(row.discount_percent || 0),
        });
      });
    }
    let total = 0;
    const resolvedItems = [];

    for (const item of items) {
      if (item.isCommon) {
        const subtotalCommon = item.unitPrice * item.qty;
        total += subtotalCommon;
        resolvedItems.push({
          ...item,
          subtotal: subtotalCommon,
          effectiveUnitPrice: item.unitPrice,
          promoLabel: null,
        });
        continue;
      }
      const record = productMap.get(item.id);
      if (!record) {
        await connection.rollback();
        return res.status(400).json({ error: 'Producto no encontrado' });
      }
      if (record.utiliza_inventario && record.cantidad_actual < item.qty) {
        await connection.rollback();
        return res.status(409).json({ error: 'Stock insuficiente' });
      }

      const basePrice = Number(record.precio_venta || 0);
      let effectiveUnitPrice = basePrice;
      let promoLabel = null;
      const promoCandidates = singlePromotionRulesByProduct.get(item.id) || [];
      if (promoCandidates.length) {
        const applicable = promoCandidates
          .filter((promo) => promo.minQty > 0 && item.qty >= promo.minQty && promo.discountPercent > 0)
          .sort((a, b) => b.discountPercent - a.discountPercent)[0];
        if (applicable) {
          const discountedUnit = Number((basePrice * (1 - (applicable.discountPercent / 100))).toFixed(2));
          if (discountedUnit >= 0) {
            effectiveUnitPrice = discountedUnit;
            promoLabel = `PROMOCION ${applicable.promotionName} (-${applicable.discountPercent}%)`;
          }
        }
      }
      const subtotal = effectiveUnitPrice * item.qty;
      total += subtotal;
      resolvedItems.push({
        ...item,
        productDescription: record.descripcion || '',
        effectiveUnitPrice,
        subtotal,
        comboDiscount: 0,
        promoLabel,
      });
    }

    // Aplicar combos de productos distintos (precio final de pack).
    if (comboPromotionMap.size > 0) {
      const nonCommonItems = resolvedItems.filter((item) => !item.isCommon);
      const itemByProductId = new Map(nonCommonItems.map((item) => [Number(item.id), item]));
      const availableUnits = new Map(nonCommonItems.map((item) => [Number(item.id), Number(item.qty || 0)]));

      const comboPromotions = Array.from(comboPromotionMap.values()).map((promo) => ({
        ...promo,
        productIds: Array.from(promo.productIds || []),
      }));

      for (const combo of comboPromotions) {
        const required = combo.productIds.filter((id) => itemByProductId.has(id));
        if (required.length < 2 || required.length !== combo.productIds.length) {
          continue;
        }
        const bundleCount = Math.min(...required.map((id) => Number(availableUnits.get(id) || 0)));
        if (!Number.isFinite(bundleCount) || bundleCount < 1) {
          continue;
        }

        const bundleBasePrice = required.reduce((acc, id) => {
          const item = itemByProductId.get(id);
          return acc + Number(item?.effectiveUnitPrice || 0);
        }, 0);
        const comboPrice = Number(combo.comboPrice || 0);
        const discountPerBundle = bundleBasePrice - comboPrice;
        if (!Number.isFinite(discountPerBundle) || discountPerBundle <= 0) {
          continue;
        }

        const totalDiscount = Number((discountPerBundle * bundleCount).toFixed(2));
        const sharePerProductPerBundle = totalDiscount / (required.length * bundleCount);

        required.forEach((id) => {
          availableUnits.set(id, Math.max(0, Number(availableUnits.get(id) || 0) - bundleCount));
          const item = itemByProductId.get(id);
          if (!item) return;
          const addDiscount = Number((sharePerProductPerBundle * bundleCount).toFixed(2));
          item.comboDiscount = Number((Number(item.comboDiscount || 0) + addDiscount).toFixed(2));
          const comboLabel = `COMBO ${combo.promotionName}`;
          if (item.promoLabel) {
            if (!item.promoLabel.includes(comboLabel)) {
              item.promoLabel = `${item.promoLabel} + ${comboLabel}`;
            }
          } else {
            item.promoLabel = comboLabel;
          }
        });

        total = Number((Math.max(0, total - totalDiscount)).toFixed(2));
      }
    }

    let montoEfectivo = 0;
    let montoTarjeta = 0;
    if (paymentMethod === 'efectivo') {
      montoEfectivo = total;
    } else if (paymentMethod === 'tarjeta') {
      montoTarjeta = total;
    } else if (paymentMethod === 'mixto') {
      if (Number.isFinite(efectivoIn) && Number.isFinite(tarjetaIn) && efectivoIn >= 0 && tarjetaIn >= 0) {
        const paid = efectivoIn + tarjetaIn;
        if (paid > 0) {
          const factor = total / paid;
          montoEfectivo = Number((efectivoIn * factor).toFixed(2));
          montoTarjeta = Number((total - montoEfectivo).toFixed(2));
        } else {
          montoEfectivo = Number((total / 2).toFixed(2));
          montoTarjeta = Number((total - montoEfectivo).toFixed(2));
        }
      } else {
        montoEfectivo = Number((total / 2).toFixed(2));
        montoTarjeta = Number((total - montoEfectivo).toFixed(2));
      }
    } else {
      montoTarjeta = total;
    }

    const openShiftId = Number(turnRows[0].id_corte);
    const openShiftStart = turnRows[0].hora_apertura;
    const ticketState = await getOrCreateTicketCounterState(connection, {
      turnoId: openShiftId,
      cajaId,
      cajeroId,
      horaApertura: openShiftStart,
    });
    const expectedTicket = Math.max(1, Number(ticketState.numero_actual || 1) || 1);
    const ticketToUse = Math.max(ticketNumber, expectedTicket);
    const [folioRows] = await connection.query('SELECT prefix, digits FROM folio_settings WHERE id = 1 LIMIT 1');
    const folioSettings = folioRows[0] || { prefix: '', digits: 1 };
    const formattedTicket = buildFormattedTicketNumber(ticketToUse, folioSettings);
    const [result] = await connection.query(
      'INSERT INTO ventas (fecha, numero_ticket, folio_ticket, usuario_id, metodo_pago, caja_id, turno_id, total, monto_efectivo, monto_tarjeta) VALUES (now(), ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [ticketToUse, formattedTicket, cajeroId, paymentMethod, cajaId, openShiftId, total, montoEfectivo, montoTarjeta]
    );

    const ventaId = result.insertId;

    for (const item of resolvedItems) {
      if (item.isCommon) {
        await connection.query(
          'INSERT INTO detalle_venta (venta_id, producto_id, cantidad, precio_unitario, subtotal, descripcion) VALUES (?, NULL, ?, ?, ?, ?)',
          [ventaId, item.qty, item.unitPrice, item.subtotal, item.desc]
        );
        continue;
      }
      const record = productMap.get(item.id);
      const adjustedSubtotal = Number(Math.max(0, Number(item.subtotal || 0) - Number(item.comboDiscount || 0)).toFixed(2));
      const adjustedUnitPrice = Number((adjustedSubtotal / Number(item.qty || 1)).toFixed(2));
      const detailDescription = item.promoLabel
        ? `${item.productDescription || ''} (${item.promoLabel})`.trim()
        : null;

      await connection.query(
        'INSERT INTO detalle_venta (venta_id, producto_id, cantidad, precio_unitario, subtotal, descripcion) VALUES (?, ?, ?, ?, ?, ?)',
        [ventaId, item.id, item.qty, adjustedUnitPrice, adjustedSubtotal, detailDescription]
      );

      if (record.utiliza_inventario) {
        const [updateResult] = await connection.query(
          'UPDATE productos SET cantidad_actual = cantidad_actual - ? WHERE id_producto = ? AND cantidad_actual >= ?',
          [item.qty, item.id, item.qty]
        );

        if (updateResult.affectedRows === 0) {
          throw new Error('Stock insuficiente');
        }
      }
    }

    const nextTicket = ticketToUse + 1;
    const syncedTicketState = await upsertTicketCounterState(connection, {
      turnoId: openShiftId,
      cajaId,
      cajeroId,
      numeroActual: nextTicket,
      ultimoTicket: ticketToUse,
    });

    await connection.commit();

    try {
      const [drawerRows] = await db.query(
        `SELECT drawer_enabled, drawer_connection, drawer_printer_name, drawer_serial_port, drawer_pulse_ms,
                drawer_open_on_cash, drawer_open_on_mixed_cash
         FROM device_settings
         WHERE id = 1
         LIMIT 1`
      );
      const drawer = drawerRows[0] || null;
      const shouldOpenDrawer = Boolean(drawer)
        && normalizeBool(drawer.drawer_enabled, false)
        && (
          (paymentMethod === 'efectivo' && normalizeBool(drawer.drawer_open_on_cash, true))
          || (paymentMethod === 'mixto' && montoEfectivo > 0 && normalizeBool(drawer.drawer_open_on_mixed_cash, true))
        );

      if (shouldOpenDrawer) {
        let drawerPrinter = String(drawer.drawer_printer_name || '').trim();
        if (!drawerPrinter) {
          const [ticketRows] = await db.query('SELECT printer_name FROM ticket_settings WHERE id = 1 LIMIT 1');
          drawerPrinter = String(ticketRows[0]?.printer_name || '').trim();
        }
        await sendCashDrawerPulse({
          connectionType: String(drawer.drawer_connection || 'printer_usb'),
          printerName: drawerPrinter,
          serialPort: String(drawer.drawer_serial_port || '').trim(),
          pulseMs: clampInt(drawer.drawer_pulse_ms, 50, 500, 120),
        });
      }
    } catch (drawerError) {
      // No romper la venta si falla el pulso del cajon.
      console.error('No se pudo abrir cajon en venta:', drawerError.message || drawerError);
    }

    return res.json({
      success: true,
      venta_id: ventaId,
      numero_ticket: ticketToUse,
      folio_ticket: formattedTicket,
      next_ticket: syncedTicketState.numero_actual,
    });
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackErr) {
        console.error('Error al revertir venta:', rollbackErr);
      }
    }
    console.error(err);
    return res.status(500).json({ error: 'Error al registrar la venta' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// ---------------almacena la informacion del local con los permisos para el sistema
app.post('/api/addInfo', async (req, res) => {
  const {
    nombre_local,
    telefono_local,
    mail_local,
    tipo_local,
    inventario,
    credito,
    producto_comun,
    margen_ganancia,
    monto_ganancia,
    redondeo,
    monto_redondeo,
    mensaje,
    data_mensaje,
    time_mensaje,
  } = req.body;
  const nombre = toText(nombre_local, 255);
  const telefono = toText(String(telefono_local ?? ''), 20);
  const mail = toText(mail_local, 255);
  const tipo = toText(tipo_local, 100);
  const inv = toBool(inventario);
  const cred = toBool(credito);
  const prodCommon = toBool(producto_comun);
  const marginEnabled = toBool(margen_ganancia);
  const marginAmount = toNumber(monto_ganancia ?? 0);
  const rounding = toBool(redondeo);
  const roundingAmount = toNumber(monto_redondeo ?? 0);
  const msgEnabled = toBool(mensaje);
  const msgData = data_mensaje ? toText(data_mensaje, 255) : '';
  const msgTime = toInt(time_mensaje ?? 0);

  if (!nombre || !telefono || !mail || !tipo) {
    return res.status(400).json({ error: 'Datos de negocio incompletos o invalidos' });
  }
  if ([inv, cred, prodCommon, marginEnabled, rounding, msgEnabled].some((v) => v === null)) {
    return res.status(400).json({ error: 'Banderas de configuracion invalidas' });
  }
  if (marginAmount === null || roundingAmount === null || msgTime === null) {
    return res.status(400).json({ error: 'Valores de configuracion invalidos' });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    await connection.query('DELETE FROM info');
    await connection.query(
      `INSERT INTO info (
        id_info, nombre, telefono, mail, tipo_local, inventario, credito,
        producto_comun, margen_ganancia, monto_ganancia, redondeo, monto_redondeo,
        mensaje, data_mensaje, time_mensaje
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        1,
        nombre,
        telefono,
        mail,
        tipo,
        inv,
        cred,
        prodCommon,
        marginEnabled,
        marginAmount,
        rounding,
        roundingAmount,
        msgEnabled,
        msgData,
        msgTime,
      ]
    );
    await connection.commit();
    res.json({ success: true });
  } catch (err) {
    if (connection) {
      try { await connection.rollback(); } catch (_) {}
    }
    console.error(err);
    res.status(500).json({ error: 'Error al registrar la informacion del local' });
  } finally {
    if (connection) connection.release();
  }
});

// ---------------almacena el munero de la caja y su estado activada/desactivada
app.post('/api/addCaja', async (req, res) => {
  const { numero_caja, nombre_caja, estado, fingerprint } = req.body;
  const cajaId = toInt(numero_caja);
  const cajaName = toText(nombre_caja, 120);
  const boxState = toBool(estado);
  const deviceHash = normalizeDeviceHash(fingerprint);

  if (!isValidCajaNumber(cajaId) || !cajaName || boxState === null) {
    return res.status(400).json({ error: 'Datos incompletos o invalidos' });
  }

  try {
    await db.query(
      'INSERT INTO cajas (n_caja, nombre_caja, estado ) VALUES (?, ?, ?)',
      [cajaId, cajaName, boxState]
    );

    if (deviceHash) {
      await db.query(
        `INSERT INTO device_caja_bindings (device_hash, numero_caja, nombre_caja, source, last_seen)
         VALUES (?, ?, ?, 'addCaja', NOW())
         ON DUPLICATE KEY UPDATE
           numero_caja = VALUES(numero_caja),
           nombre_caja = VALUES(nombre_caja),
           source = 'addCaja',
           last_seen = NOW()`,
        [deviceHash, cajaId, cajaName]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar la caja nueva del local' });
  }
});

app.post('/api/cajas/upsert', async (req, res) => {
  const cajaId = toInt(req.body?.numero_caja);
  const cajaName = toText(req.body?.nombre_caja, 120);
  const boxState = toBool(req.body?.estado);
  const deviceHash = normalizeDeviceHash(req.body?.fingerprint);

  if (!isValidCajaNumber(cajaId) || !cajaName || boxState === null) {
    return res.status(400).json({ error: 'Datos de caja incompletos o invalidos' });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [nameConflictRows] = await connection.query(
      'SELECT n_caja FROM cajas WHERE LOWER(nombre_caja) = LOWER(?) AND n_caja <> ? LIMIT 1',
      [cajaName, cajaId]
    );
    if (nameConflictRows.length > 0) {
      await connection.rollback();
      return res.status(409).json({ error: 'El nombre de caja ya esta en uso' });
    }

    const [existsRows] = await connection.query(
      'SELECT id_caja FROM cajas WHERE n_caja = ? LIMIT 1',
      [cajaId]
    );

    let mode = 'updated';
    if (existsRows.length > 0) {
      await connection.query(
        'UPDATE cajas SET nombre_caja = ?, estado = ? WHERE n_caja = ?',
        [cajaName, boxState, cajaId]
      );
    } else {
      const [countRows] = await connection.query(
        'SELECT COUNT(*) AS total FROM cajas'
      );
      const total = Number(countRows[0]?.total || 0);
      if (total >= 8) {
        await connection.rollback();
        return res.status(409).json({ error: 'Limite alcanzado: maximo 8 cajas habilitadas' });
      }

      await connection.query(
        'INSERT INTO cajas (n_caja, nombre_caja, estado) VALUES (?, ?, ?)',
        [cajaId, cajaName, boxState]
      );
      mode = 'created';
    }

    if (deviceHash) {
      await connection.query(
        `INSERT INTO device_caja_bindings (device_hash, numero_caja, nombre_caja, source, last_seen)
         VALUES (?, ?, ?, 'cajas_upsert', NOW())
         ON DUPLICATE KEY UPDATE
           numero_caja = VALUES(numero_caja),
           nombre_caja = VALUES(nombre_caja),
           source = 'cajas_upsert',
           last_seen = NOW()`,
        [deviceHash, cajaId, cajaName]
      );
    }

    await connection.commit();
    return res.json({
      success: true,
      mode,
      caja: {
        n_caja: cajaId,
        nombre_caja: cajaName,
        estado: boxState ? 1 : 0,
      },
    });
  } catch (err) {
    if (connection) {
      try { await connection.rollback(); } catch (_) {}
    }
    console.error('Error en upsert de caja:', err);
    return res.status(500).json({ error: 'No se pudo guardar la caja' });
  } finally {
    if (connection) connection.release();
  }
});

//----------------------------PUTs----------------------------------------------------

// actualiza producto por codigo de barras
app.put('/api/productos/:code', async (req, res) => {
  const { code } = req.params;
  const body = req.body || {};
  const description = toText(body.descripcion, 255);
  const formatName = normalizeSaleFormatName(body.formato_venta);
  const salePrice = toNumber(body.precio_venta);
  const cost = toNumber(body.costo);
  const profit = roundToDecimals(body.ganancia ?? 0, 2);
  const qty = toNumber(body.cantidad_actual ?? 0);
  const minQty = toNumber(body.cantidad_minima ?? 0);
  const maxQty = toNumber(body.cantidad_maxima ?? 0);
  const useInventory = toBool(body.utiliza_inventario);
  const departmentName = toText(body.departamento, 80);
  const supplierId = body.supplier_id === null || typeof body.supplier_id === 'undefined'
    ? null
    : toInt(body.supplier_id);
  const taxExempt = toBool(body.exento_iva);

  if (!description || !formatName || salePrice === null || cost === null || profit === null || qty === null || minQty === null || maxQty === null || useInventory === null || taxExempt === null || !departmentName) {
    return res.status(400).json({ error: 'Datos incompletos o invalidos' });
  }
  if ([salePrice, cost, profit, qty, minQty, maxQty].some((value) => value < 0)) {
    return res.status(400).json({ error: 'No se permiten valores negativos' });
  }
  if (supplierId !== null && (!supplierId || supplierId < 1)) {
    return res.status(400).json({ error: 'Proveedor invalido' });
  }

  try {
    const [formatRows] = await db.query(
      'SELECT id_formato FROM formato_venta WHERE LOWER(descripcion) = ? LIMIT 1',
      [formatName]
    );
    if (!formatRows.length) {
      return res.status(400).json({ error: 'Formato de venta no encontrado' });
    }

    const [departmentRows] = await db.query(
      'SELECT id_departamento FROM departamento WHERE nombre = ? LIMIT 1',
      [departmentName]
    );
    if (!departmentRows.length) {
      return res.status(400).json({ error: 'Departamento no encontrado' });
    }
    if (supplierId !== null) {
      const [supplierRows] = await db.query('SELECT id FROM service_suppliers WHERE id = ? LIMIT 1', [supplierId]);
      if (!supplierRows.length) {
        return res.status(400).json({ error: 'Proveedor no encontrado' });
      }
    }
    const [result] = await db.query(
      `UPDATE productos
           SET descripcion = ?, id_formato = ?, precio_venta = ?, costo = ?, ganancia = ?,
           cantidad_actual = ?, cantidad_minima = ?, cantidad_maxima = ?, utiliza_inventario = ?,
           id_departamento = ?, supplier_id = ?, exento_iva = ?
       WHERE codigo_barras = ?`,
      [
        description,
        formatRows[0].id_formato,
        salePrice,
        cost,
        profit,
        qty,
        minQty,
        maxQty,
        useInventory ? 1 : 0,
        departmentRows[0].id_departamento,
        supplierId,
        taxExempt ? 1 : 0,
        code,
      ]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    return res.json({ message: 'Producto actualizado correctamente' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Base de datos error' });
  }
});

// ----------------actualiza estado de usuario por ID
app.put('/api/updateUser/', async (req, res) => {
  const { id, estado_usuario } = req.body;
  const userId = toInt(id);

  if (!userId || typeof estado_usuario === 'undefined') {
    return res.status(400).json({ error: 'Datos incompletos o invalidos' });
  }

  try {
    await db.query(
      'UPDATE usuarios SET estado_usuario = ? WHERE id = ?',
      [estado_usuario, userId]
    );
    res.json({ message: 'estado del usuario actualizado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//--------------------------DELETEs--------------------------------------------------

// elimina producto por codigo
app.delete('/api/productos/:code', async (req, res) => {
  const { code } = req.params;

  try {
    const [rows] = await db.query(
      'SELECT id_producto, cantidad_actual FROM productos WHERE codigo_barras = ? LIMIT 1',
      [code]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    const qty = Number(rows[0].cantidad_actual || 0);
    if (qty > 0) {
      return res.status(409).json({ error: 'No se puede eliminar: el inventario debe estar en 0' });
    }

    const [result] = await db.query('DELETE FROM productos WHERE codigo_barras = ?', [code]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    return res.json({ message: 'Producto eliminado correctamente' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Base de datos error' });
  }
});

//------------------------------USEs-----------------------------------------------------

app.use((err, req, res, next) => {
  console.error(err.stack);
  queueErrorEmailReport('backend.express', {
    message: err?.message || 'Express middleware error',
    stack: err?.stack || '',
    url: req?.originalUrl || req?.url || '',
    method: req?.method || '',
    ip: req?.ip || req?.socket?.remoteAddress || '',
    user: req?.user?.sub || '',
    user_agent: req?.headers?.['user-agent'] || '',
  });
  res.status(500).send('Algo salio mal!');
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  queueErrorEmailReport('backend.unhandledRejection', {
    message: reason?.message || String(reason || 'Promise rejection'),
    stack: reason?.stack || '',
    detail: typeof reason === 'object' ? JSON.stringify(reason, null, 2) : String(reason || ''),
  });
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  queueErrorEmailReport('backend.uncaughtException', {
    message: error?.message || 'Uncaught exception',
    stack: error?.stack || '',
  });
});
