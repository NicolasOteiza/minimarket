const mysql = require('mysql2/promise');

const REMOTE = {
  host: process.env.REMOTE_DB_HOST || '192.168.1.91',
  port: Number.parseInt(process.env.REMOTE_DB_PORT || '3306', 10),
  user: process.env.REMOTE_DB_USER || 'minimarket_app',
  password: process.env.REMOTE_DB_PASSWORD || 'MiniM4rket#2026',
  database: process.env.REMOTE_DB_NAME || 'minimarket',
};

const LOCAL = {
  host: process.env.LOCAL_DB_HOST || '127.0.0.1',
  port: Number.parseInt(process.env.LOCAL_DB_PORT || '3306', 10),
  user: process.env.LOCAL_DB_USER || 'root',
  password: process.env.LOCAL_DB_PASSWORD || '',
  database: process.env.LOCAL_DB_NAME || 'minimarket',
};

const TABLES = ['usuarios', 'cajero_permisos'];
const CHUNK_SIZE = 200;

function chunkArray(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function getTableColumns(conn, table) {
  const [rows] = await conn.query(`SHOW COLUMNS FROM \`${table}\``);
  return rows.map((row) => String(row.Field));
}

async function getPrimaryKeyColumns(conn, table, dbName) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'
     ORDER BY ORDINAL_POSITION ASC`,
    [dbName, table]
  );
  return rows.map((row) => String(row.COLUMN_NAME));
}

async function readAllRows(conn, table, columns) {
  const colsSql = columns.map((col) => `\`${col}\``).join(', ');
  const [rows] = await conn.query(`SELECT ${colsSql} FROM \`${table}\``);
  return rows;
}

async function upsertRows(conn, table, columns, pkColumns, rows) {
  if (!rows.length) return 0;

  const colsSql = columns.map((col) => `\`${col}\``).join(', ');
  const nonPkColumns = columns.filter((col) => !pkColumns.includes(col));
  const updateSql = nonPkColumns.length
    ? nonPkColumns.map((col) => `\`${col}\`=VALUES(\`${col}\`)`).join(', ')
    : `${columns[0] ? `\`${columns[0]}\`` : 'id'} = VALUES(${columns[0] ? `\`${columns[0]}\`` : 'id'})`;

  let affected = 0;
  for (const block of chunkArray(rows, CHUNK_SIZE)) {
    const placeholders = block.map(() => `(${columns.map(() => '?').join(',')})`).join(', ');
    const values = [];
    block.forEach((row) => {
      columns.forEach((col) => values.push(row[col]));
    });
    const sql = `INSERT INTO \`${table}\` (${colsSql}) VALUES ${placeholders} ON DUPLICATE KEY UPDATE ${updateSql}`;
    const [result] = await conn.query(sql, values);
    affected += Number(result.affectedRows || 0);
  }
  return affected;
}

async function syncTable(remoteConn, localConn, dbName, table) {
  const [remoteExists] = await remoteConn.query(
    `SELECT COUNT(*) AS total
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [dbName, table]
  );
  const [localExists] = await localConn.query(
    `SELECT COUNT(*) AS total
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [dbName, table]
  );

  if (!Number(remoteExists[0]?.total || 0) || !Number(localExists[0]?.total || 0)) {
    throw new Error(`Tabla requerida no existe en origen o destino: ${table}`);
  }

  const remoteColumns = await getTableColumns(remoteConn, table);
  const localColumns = await getTableColumns(localConn, table);
  const sharedColumns = remoteColumns.filter((col) => localColumns.includes(col));
  if (!sharedColumns.length) {
    throw new Error(`No hay columnas compatibles para tabla ${table}`);
  }

  const localPk = await getPrimaryKeyColumns(localConn, table, dbName);
  const rows = await readAllRows(remoteConn, table, sharedColumns);
  const affected = await upsertRows(localConn, table, sharedColumns, localPk, rows);
  return { rows: rows.length, affected };
}

async function main() {
  console.log('[SYNC] Iniciando sincronizacion de usuarios desde remoto...');
  console.log(`[SYNC] Remoto: ${REMOTE.host}:${REMOTE.port} / ${REMOTE.database}`);
  console.log(`[SYNC] Local : ${LOCAL.host}:${LOCAL.port} / ${LOCAL.database}`);

  const remoteConn = await mysql.createConnection(REMOTE);
  const localConn = await mysql.createConnection(LOCAL);

  try {
    await localConn.beginTransaction();
    for (const table of TABLES) {
      const result = await syncTable(remoteConn, localConn, LOCAL.database, table);
      console.log(`[SYNC] ${table}: ${result.rows} filas leidas, ${result.affected} upsert`);
    }
    await localConn.commit();
    console.log('[SYNC] Sincronizacion completada.');
  } catch (error) {
    await localConn.rollback();
    console.error('[SYNC] Error:', error.message || error);
    process.exitCode = 1;
  } finally {
    await remoteConn.end().catch(() => {});
    await localConn.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error('[SYNC] Fallo fatal:', error.message || error);
  process.exit(1);
});
