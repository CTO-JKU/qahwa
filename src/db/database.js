/**
 * src/db/database.js
 * SQLite using sql.js — pure JavaScript, no native compilation.
 * Works on Windows without Visual Studio build tools.
 *
 * sql.js runs SQLite as WASM in Node. The DB lives in memory while
 * the server runs and is written to disk after every write via persist().
 */

const initSqlJs = require('sql.js');
const bcrypt    = require('bcryptjs');
const path      = require('path');
const fs        = require('fs');

const DB_PATH = path.join(__dirname, '../../data/coffee.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let _db = null;

// ── Boot: load or create the database ────────────────────────
async function initDB() {
  if (_db) return _db;

  const SQL = await initSqlJs();

  const db = fs.existsSync(DB_PATH)
    ? new SQL.Database(fs.readFileSync(DB_PATH))
    : new SQL.Database();

  // ── Schema ─────────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS admins (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS employees (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      email      TEXT,
      rfid_uid   TEXT UNIQUE,
      balance    REAL NOT NULL DEFAULT 0,
      active     INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS coffees (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      device_id   TEXT,
      scanned_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // ── Seed defaults ──────────────────────────────────────────
  db.run(`INSERT OR IGNORE INTO settings VALUES ('price_per_coffee', '0.50')`);
  db.run(`INSERT OR IGNORE INTO settings VALUES ('currency_symbol',  '€')`);

  const hasAdmin = db.exec(`SELECT id FROM admins WHERE username = 'admin'`);
  if (!hasAdmin.length || !hasAdmin[0].values.length) {
    db.run(`INSERT INTO admins (username, password_hash) VALUES ('admin', ?)`,
           [bcrypt.hashSync('admin123', 10)]);
    console.log('[DB] Default admin created  →  admin / admin123');
  }

  _persist(db);
  _db = db;
  console.log(`[DB] Ready: ${DB_PATH}`);
  return db;
}

// ── Write in-memory DB to disk ────────────────────────────────
function _persist(db) {
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

// ── query() → array of row objects ───────────────────────────
function query(db, sql, params = []) {
  const result = db.exec(sql, params);
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map(row =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  );
}

// ── get() → single row object or null ────────────────────────
function get(db, sql, params = []) {
  return query(db, sql, params)[0] ?? null;
}

// ── run() → execute a write statement ────────────────────────
// Set persist=false when calling inside a transaction.
function run(db, sql, params = [], persist = true) {
  db.run(sql, params);
  if (persist) _persist(db);
}

// ── transaction() → atomic block ─────────────────────────────
// fn receives a rawRun(sql, params) helper that skips disk writes.
// Only one _persist() happens at the very end.
function transaction(db, fn) {
  db.run('BEGIN');
  try {
    const rawRun = (sql, params = []) => db.run(sql, params);
    fn(rawRun);
    db.run('COMMIT');
    _persist(db);
  } catch (e) {
    try { db.run('ROLLBACK'); } catch (_) { /* ignore if no active transaction */ }
    throw e;
  }
}

module.exports = { initDB, query, get, run, transaction };
