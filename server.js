const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Crear carpeta de vouchers si no existe
const vouchersDir = path.join(__dirname, 'vouchers');
if (!fs.existsSync(vouchersDir)) fs.mkdirSync(vouchersDir);

// Multer: guardar fotos en /vouchers
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, vouchersDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `voucher_${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // sirve index.html
app.use('/vouchers', express.static(vouchersDir)); // sirve fotos

// GET todos los pagos
app.get('/api/pagos', (req, res) => {
  const { mes, tipo, anio } = req.query;
  let sql = 'SELECT * FROM pagos WHERE 1=1';
  const params = [];
  if (mes)  { sql += ' AND mes = ?';  params.push(mes); }
  if (tipo) { sql += ' AND tipo = ?'; params.push(tipo); }
  if (anio) { sql += ' AND anio = ?'; params.push(parseInt(anio)); }
  sql += ' ORDER BY fecha_pago DESC';
  res.json(db.prepare(sql).all(...params));
});

// POST nuevo pago (con o sin voucher)
app.post('/api/pagos', upload.single('voucher'), (req, res) => {
  const { tipo, mes, anio, monto, fecha_pago, observacion } = req.body;
  if (!tipo || !mes || !monto || !fecha_pago) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }
  const voucher_path = req.file ? `/vouchers/${req.file.filename}` : null;
  const stmt = db.prepare(`
    INSERT INTO pagos (tipo, mes, anio, monto, fecha_pago, observacion, voucher_path)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(tipo, mes, parseInt(anio), parseFloat(monto), fecha_pago, observacion || '', voucher_path);
  res.json({ id: result.lastInsertRowid, message: 'Pago guardado' });
});

// DELETE pago
app.delete('/api/pagos/:id', (req, res) => {
  const pago = db.prepare('SELECT * FROM pagos WHERE id = ?').get(req.params.id);
  if (!pago) return res.status(404).json({ error: 'Pago no encontrado' });
  // Eliminar voucher físico si existe
  if (pago.voucher_path) {
    const filePath = path.join(__dirname, pago.voucher_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  db.prepare('DELETE FROM pagos WHERE id = ?').run(req.params.id);
  res.json({ message: 'Pago eliminado' });
});

// GET resumen KPIs del mes actual
app.get('/api/resumen', (req, res) => {
  const { mes, anio } = req.query;
  const rows = db.prepare('SELECT tipo, SUM(monto) as total FROM pagos WHERE mes=? AND anio=? GROUP BY tipo').all(mes, parseInt(anio));
  const count = db.prepare('SELECT COUNT(*) as n FROM pagos').get();
  res.json({ desglose: rows, total_registros: count.n });
});

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`   Abre tu navegador en http://localhost:${PORT}/index.html`);
});
