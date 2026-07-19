const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../db');
const { requireLogin } = require('../middleware/auth');
const pm = require('../processManager');

const router = express.Router();
router.use(requireLogin);

const INSTANCES_DIR = path.join(__dirname, '..', 'instances');

function ownedInstance(req, id) {
  const inst = db.get('instances').find({ id }).value();
  if (!inst) return null;
  if (req.user.role !== 'admin' && inst.ownerId !== req.user.id) return null;
  return inst;
}

// List instance milik user (admin lihat semua)
router.get('/', (req, res) => {
  let list = db.get('instances').value();
  if (req.user.role !== 'admin') {
    list = list.filter((i) => i.ownerId === req.user.id);
  }
  const withStatus = list.map((i) => ({ ...i, running: pm.isRunning(i.id) }));
  res.json(withStatus);
});

// Buat instance baru
router.post('/', (req, res) => {
  const { name, entryFile } = req.body;
  if (!name || !entryFile) {
    return res.status(400).json({ error: 'Nama dan entry file (mis. index.js) wajib diisi.' });
  }

  const instances = db.get('instances');
  const newId = (instances.map('id').max().value() || 0) + 1;
  const folder = path.join(INSTANCES_DIR, String(newId));
  fs.mkdirSync(folder, { recursive: true });

  instances
    .push({ id: newId, ownerId: req.user.id, name, entryFile, folder: String(newId) })
    .write();

  res.json({ ok: true, id: newId });
});

// Detail 1 instance
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const inst = ownedInstance(req, id);
  if (!inst) return res.status(404).json({ error: 'Instance tidak ditemukan.' });
  res.json({ ...inst, running: pm.isRunning(id) });
});

// Update nama / entry file
router.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const inst = ownedInstance(req, id);
  if (!inst) return res.status(404).json({ error: 'Instance tidak ditemukan.' });

  const { name, entryFile } = req.body;
  const updates = {};
  if (name) updates.name = name;
  if (entryFile) updates.entryFile = entryFile;

  db.get('instances').find({ id }).assign(updates).write();
  res.json({ ok: true });
});

// Hapus instance
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const inst = ownedInstance(req, id);
  if (!inst) return res.status(404).json({ error: 'Instance tidak ditemukan.' });

  pm.stop(id);
  fs.rmSync(path.join(INSTANCES_DIR, inst.folder), { recursive: true, force: true });
  db.get('instances').remove({ id }).write();
  res.json({ ok: true });
});

// Upload file ke folder instance
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const id = parseInt(req.params.id, 10);
    const inst = ownedInstance(req, id);
    if (!inst) return cb(new Error('Instance tidak ditemukan.'));
    cb(null, path.join(INSTANCES_DIR, inst.folder));
  },
  filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage });

router.post('/:id/upload', upload.single('file'), (req, res) => {
  res.json({ ok: true, filename: req.file.originalname });
});

// List file dalam instance
router.get('/:id/files', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const inst = ownedInstance(req, id);
  if (!inst) return res.status(404).json({ error: 'Instance tidak ditemukan.' });

  const folder = path.join(INSTANCES_DIR, inst.folder);
  const files = fs.existsSync(folder) ? fs.readdirSync(folder) : [];
  res.json(files);
});

// Start
router.post('/:id/start', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const inst = ownedInstance(req, id);
  if (!inst) return res.status(404).json({ error: 'Instance tidak ditemukan.' });

  const entryPath = path.join(INSTANCES_DIR, inst.folder, inst.entryFile);
  if (!fs.existsSync(entryPath)) {
    return res.status(400).json({ error: `File ${inst.entryFile} belum diupload.` });
  }

  const result = pm.start({ id: inst.id, entryFile: inst.entryFile, folder: inst.folder });
  res.json(result);
});

// Stop
router.post('/:id/stop', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const inst = ownedInstance(req, id);
  if (!inst) return res.status(404).json({ error: 'Instance tidak ditemukan.' });
  res.json(pm.stop(id));
});

// Restart
router.post('/:id/restart', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const inst = ownedInstance(req, id);
  if (!inst) return res.status(404).json({ error: 'Instance tidak ditemukan.' });
  res.json(pm.restart({ id: inst.id, entryFile: inst.entryFile, folder: inst.folder }));
});

// Ambil log yang sudah ada (dipanggil saat pertama buka console)
router.get('/:id/logs', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const inst = ownedInstance(req, id);
  if (!inst) return res.status(404).json({ error: 'Instance tidak ditemukan.' });
  res.json(pm.getLogs(id));
});

module.exports = router;
