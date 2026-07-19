const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireLogin, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireLogin, requireAdmin);

// Lihat semua user (tanpa password hash)
router.get('/users', (req, res) => {
  const users = db.get('users').value().map((u) => ({
    id: u.id,
    username: u.username,
    role: u.role,
  }));
  res.json(users);
});

// Tambah user baru
router.post('/users', (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi.' });
  }
  if (db.get('users').find({ username }).value()) {
    return res.status(400).json({ error: 'Username sudah dipakai.' });
  }

  const users = db.get('users');
  const newId = (users.map('id').max().value() || 0) + 1;

  users
    .push({
      id: newId,
      username,
      passwordHash: bcrypt.hashSync(password, 8),
      role: role === 'admin' ? 'admin' : 'user',
    })
    .write();

  res.json({ ok: true, id: newId });
});

// Hapus user
router.delete('/users/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (id === req.user.id) {
    return res.status(400).json({ error: 'Tidak bisa hapus akun sendiri.' });
  }
  db.get('users').remove({ id }).write();
  res.json({ ok: true });
});

module.exports = router;
