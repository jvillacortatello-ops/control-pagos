const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'pagos.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario  TEXT    NOT NULL UNIQUE,
    password TEXT    NOT NULL,
    creado_en TEXT   DEFAULT (datetime('now','localtime'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS pagos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id  INTEGER NOT NULL DEFAULT 1,
    tipo        TEXT    NOT NULL,
    mes         TEXT    NOT NULL,
    anio        INTEGER NOT NULL,
    monto       REAL    NOT NULL,
    fecha_pago  TEXT    NOT NULL,
    observacion TEXT    DEFAULT '',
    voucher_path TEXT   DEFAULT NULL,
    creado_en   TEXT    DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
  )
`);

module.exports = db;
