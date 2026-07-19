const db = require('../db');

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Belum login.' });
  }
  const user = db.get('users').find({ id: req.session.userId }).value();
  if (!user) {
    return res.status(401).json({ error: 'Sesi tidak valid.' });
  }
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Khusus admin.' });
  }
  next();
}

module.exports = { requireLogin, requireAdmin };
