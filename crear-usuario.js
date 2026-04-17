const db = require('./database');
const crypto = require('crypto');

const [,, usuario, password] = process.argv;
if (!usuario || !password) {
  console.log('Uso: node crear-usuario.js <usuario> <password>');
  process.exit(1);
}

const hash = crypto.createHash('sha256').update(password).digest('hex');
try {
  db.prepare('INSERT INTO usuarios (usuario, password) VALUES (?, ?)').run(usuario, hash);
  console.log(`✅ Usuario "${usuario}" creado correctamente`);
} catch(e) {
  console.log(`❌ El usuario "${usuario}" ya existe`);
}
