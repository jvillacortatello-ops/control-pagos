const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'pagos.db'));

// Crear tabla si no existe
db.exec(`
  CREATE TABLE IF NOT EXISTS pagos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo        TEXT    NOT NULL,
    mes         TEXT    NOT NULL,
    anio        INTEGER NOT NULL,
    monto       REAL    NOT NULL,
    fecha_pago  TEXT    NOT NULL,
    observacion TEXT    DEFAULT '',
    voucher_path TEXT   DEFAULT NULL,
    creado_en   TEXT    DEFAULT (datetime('now','localtime'))
  )
`);

module.exports = db;
