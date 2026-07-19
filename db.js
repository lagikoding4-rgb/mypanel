const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const bcrypt = require('bcryptjs');

const adapter = new FileSync(path.join(__dirname, 'data', 'db.json'));
const db = low(adapter);

// Struktur data awal
db.defaults({ users: [], instances: [] }).write();

// Kalau belum ada admin sama sekali, buat admin default
if (db.get('users').size().value() === 0) {
  db.get('users')
    .push({
      id: 1,
      username: 'admin',
      passwordHash: bcrypt.hashSync('admin123', 8),
      role: 'admin',
    })
    .write();
  console.log('[SETUP] Akun admin default dibuat -> username: admin | password: admin123');
  console.log('[SETUP] SEGERA GANTI PASSWORD INI setelah login pertama!');
}

module.exports = db;
