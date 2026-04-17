const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

const vouchersDir = path.join(__dirname, 'vouchers');
if (!fs.existsSync(vouchersDir)) fs.mkdirSync(vouchersDir);

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
app.use(express.static(__dirname));
app.use('/vouchers', express.static(vouchersDir));

// Tokens en memoria
const sessions = {};

function authMiddleware(req, res, next) {
  const token = req.headers['authorization'];
  if (!token || !sessions[token]) return res.status(401).json({ error: 'No autorizado' });
  req.usuario_id = sessions[token].usuario_id;
  req.usuario = sessions[token].usuario;
  next();
}

// LOGIN

const usuariosDefault = [
  { usuario: 'julie', password: 'ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f' },
  { usuario: 'jorge', password: 'ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f' }
];
usuariosDefault.forEach(u => {
  try { db.prepare('INSERT OR IGNORE INTO usuarios (usuario, password) VALUES (?, ?)').run(u.usuario, u.password); } catch(e) {}
});

app.post('/api/login', (req, res) => {
  const { usuario, password } = req.body;
  if (!usuario || !password) return res.status(400).json({ error: 'Faltan datos' });
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  const user = db.prepare('SELECT * FROM usuarios WHERE usuario=? AND password=?').get(usuario, hash);
  if (!user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  const token = crypto.randomBytes(32).toString('hex');
  sessions[token] = { usuario_id: user.id, usuario: user.usuario };
  res.json({ token, usuario: user.usuario });
});

// LOGOUT
app.post('/api/logout', authMiddleware, (req, res) => {
  const token = req.headers['authorization'];
  delete sessions[token];
  res.json({ message: 'Sesión cerrada' });
});

app.get('/api/status', authMiddleware, (req, res) => res.json({ ok: true, usuario: req.usuario }));

// GET pagos del usuario autenticado
app.get('/api/pagos', authMiddleware, (req, res) => {
  const { mes, tipo, anio } = req.query;
  let sql = 'SELECT * FROM pagos WHERE usuario_id=?';
  const params = [req.usuario_id];
  if (mes)  { sql += ' AND mes=?';  params.push(mes); }
  if (tipo) { sql += ' AND tipo=?'; params.push(tipo); }
  if (anio) { sql += ' AND anio=?'; params.push(parseInt(anio)); }
  sql += ' ORDER BY fecha_pago DESC';
  res.json(db.prepare(sql).all(...params));
});

// POST nuevo pago
app.post('/api/pagos', authMiddleware, upload.single('voucher'), (req, res) => {
  const { tipo, mes, anio, monto, fecha_pago, observacion } = req.body;
  if (!tipo || !mes || !monto || !fecha_pago) return res.status(400).json({ error: 'Faltan campos obligatorios' });
  const voucher_path = req.file ? `/vouchers/${req.file.filename}` : null;
  const result = db.prepare(`
    INSERT INTO pagos (usuario_id, tipo, mes, anio, monto, fecha_pago, observacion, voucher_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.usuario_id, tipo, mes, parseInt(anio), parseFloat(monto), fecha_pago, observacion || '', voucher_path);
  res.json({ id: result.lastInsertRowid, message: 'Pago guardado' });
});

// DELETE pago
app.delete('/api/pagos/:id', authMiddleware, (req, res) => {
  const pago = db.prepare('SELECT * FROM pagos WHERE id=? AND usuario_id=?').get(req.params.id, req.usuario_id);
  if (!pago) return res.status(404).json({ error: 'Pago no encontrado' });
  if (pago.voucher_path) {
    const filePath = path.join(__dirname, pago.voucher_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  db.prepare('DELETE FROM pagos WHERE id=? AND usuario_id=?').run(req.params.id, req.usuario_id);
  res.json({ message: 'Pago eliminado' });
});

// GET resumen
app.get('/api/resumen', authMiddleware, (req, res) => {
  const { mes, anio } = req.query;
  const rows = db.prepare('SELECT tipo, SUM(monto) as total FROM pagos WHERE mes=? AND anio=? AND usuario_id=? GROUP BY tipo').all(mes, parseInt(anio), req.usuario_id);
  const count = db.prepare('SELECT COUNT(*) as n FROM pagos WHERE usuario_id=?').get(req.usuario_id);
  res.json({ desglose: rows, total_registros: count.n });
});

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`   Abre tu navegador en http://localhost:${PORT}/index.html`);
});
