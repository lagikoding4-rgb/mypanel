const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const AdmZip = require('adm-zip');
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

// Cegah path traversal (../../dst) - pastikan hasil akhirnya tetap di dalam folder instance
function safeJoin(baseDir, relPath) {
  const target = path.normalize(path.join(baseDir, relPath || ''));
  if (!target.startsWith(baseDir)) {
    throw new Error('Path tidak valid.');
  }
  return target;
}

function getInstanceDir(req, id) {
  const inst = ownedInstance(req, id);
  if (!inst) return null;
  return path.join(INSTANCES_DIR, inst.folder);
}

// GET /api/instances/:id/fs/list?path=sub/folder
router.get('/:id/fs/list', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const baseDir = getInstanceDir(req, id);
  if (!baseDir) return res.status(404).json({ error: 'Instance tidak ditemukan.' });

  let target;
  try {
    target = safeJoin(baseDir, req.query.path || '');
  } catch {
    return res.status(400).json({ error: 'Path tidak valid.' });
  }

  if (!fs.existsSync(target)) return res.json({ entries: [] });

  const names = fs.readdirSync(target);
  const entries = names.map((name) => {
    const full = path.join(target, name);
    const stat = fs.statSync(full);
    return {
      name,
      isDirectory: stat.isDirectory(),
      size: stat.size,
      modified: stat.mtime,
    };
  });

  // folder duluan, baru file, masing-masing urut abjad
  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  res.json({ entries });
});

// POST /api/instances/:id/fs/mkdir  { path, name }
router.post('/:id/fs/mkdir', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const baseDir = getInstanceDir(req, id);
  if (!baseDir) return res.status(404).json({ error: 'Instance tidak ditemukan.' });

  const { path: relPath, name } = req.body;
  if (!name) return res.status(400).json({ error: 'Nama folder wajib diisi.' });

  try {
    const target = safeJoin(baseDir, path.join(relPath || '', name));
    fs.mkdirSync(target, { recursive: true });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/instances/:id/fs/newfile  { path, name, content }
router.post('/:id/fs/newfile', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const baseDir = getInstanceDir(req, id);
  if (!baseDir) return res.status(404).json({ error: 'Instance tidak ditemukan.' });

  const { path: relPath, name, content } = req.body;
  if (!name) return res.status(400).json({ error: 'Nama file wajib diisi.' });

  try {
    const target = safeJoin(baseDir, path.join(relPath || '', name));
    fs.writeFileSync(target, content || '');
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/instances/:id/fs/rename  { path, oldName, newName }
router.post('/:id/fs/rename', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const baseDir = getInstanceDir(req, id);
  if (!baseDir) return res.status(404).json({ error: 'Instance tidak ditemukan.' });

  const { path: relPath, oldName, newName } = req.body;
  try {
    const oldPath = safeJoin(baseDir, path.join(relPath || '', oldName));
    const newPath = safeJoin(baseDir, path.join(relPath || '', newName));
    fs.renameSync(oldPath, newPath);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/instances/:id/fs/delete  { path, names: [...] }
router.post('/:id/fs/delete', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const baseDir = getInstanceDir(req, id);
  if (!baseDir) return res.status(404).json({ error: 'Instance tidak ditemukan.' });

  const { path: relPath, names } = req.body;
  if (!Array.isArray(names) || names.length === 0) {
    return res.status(400).json({ error: 'Gak ada file yang dipilih.' });
  }

  try {
    for (const name of names) {
      const target = safeJoin(baseDir, path.join(relPath || '', name));
      fs.rmSync(target, { recursive: true, force: true });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/instances/:id/fs/archive  { path, names: [...], archiveName }
// Compress file/folder yang dipilih jadi satu file .zip
router.post('/:id/fs/archive', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const baseDir = getInstanceDir(req, id);
  if (!baseDir) return res.status(404).json({ error: 'Instance tidak ditemukan.' });

  const { path: relPath, names, archiveName } = req.body;
  if (!Array.isArray(names) || names.length === 0) {
    return res.status(400).json({ error: 'Gak ada file yang dipilih.' });
  }

  try {
    const zip = new AdmZip();
    for (const name of names) {
      const target = safeJoin(baseDir, path.join(relPath || '', name));
      const stat = fs.statSync(target);
      if (stat.isDirectory()) {
        zip.addLocalFolder(target, name);
      } else {
        zip.addLocalFile(target);
      }
    }
    const outName = archiveName || `archive-${Date.now()}.zip`;
    const outPath = safeJoin(baseDir, path.join(relPath || '', outName));
    zip.writeZip(outPath);
    res.json({ ok: true, filename: outName });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Upload file biasa (apa adanya, gak di-extract)
const plainStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const id = parseInt(req.params.id, 10);
    const baseDir = getInstanceDir(req, id);
    if (!baseDir) return cb(new Error('Instance tidak ditemukan.'));
    try {
      const target = safeJoin(baseDir, req.query.path || '');
      fs.mkdirSync(target, { recursive: true });
      cb(null, target);
    } catch (e) {
      cb(e);
    }
  },
  filename: (req, file, cb) => cb(null, file.originalname),
});
const uploadPlain = multer({ storage: plainStorage });

// POST /api/instances/:id/fs/upload?path=sub/folder   (field: file)
router.post('/:id/fs/upload', uploadPlain.single('file'), (req, res) => {
  res.json({ ok: true, filename: req.file.originalname });
});

// Upload archive .zip lalu langsung di-extract, file .zip aslinya dihapus setelah extract
const zipStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const id = parseInt(req.params.id, 10);
    const baseDir = getInstanceDir(req, id);
    if (!baseDir) return cb(new Error('Instance tidak ditemukan.'));
    try {
      const target = safeJoin(baseDir, req.query.path || '');
      fs.mkdirSync(target, { recursive: true });
      cb(null, target);
    } catch (e) {
      cb(e);
    }
  },
  filename: (req, file, cb) => cb(null, file.originalname),
});
const uploadZip = multer({ storage: zipStorage });

// POST /api/instances/:id/fs/upload-archive?path=sub/folder   (field: file, harus .zip)
router.post('/:id/fs/upload-archive', uploadZip.single('file'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const baseDir = getInstanceDir(req, id);
  const zipPath = req.file.path;

  if (!req.file.originalname.toLowerCase().endsWith('.zip')) {
    fs.rmSync(zipPath, { force: true });
    return res.status(400).json({
      error: 'Cuma file .zip yang didukung buat auto-extract. Upload biasa (tanpa extract) pakai tombol Upload lainnya.',
    });
  }

  try {
    const target = safeJoin(baseDir, req.query.path || '');
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(target, true); // true = overwrite kalau ada file sama
    fs.rmSync(zipPath, { force: true }); // hapus file .zip-nya, sisain hasil extract-nya aja
    res.json({ ok: true, message: 'Berhasil di-extract.' });
  } catch (e) {
    res.status(400).json({ error: 'Gagal extract: ' + e.message });
  }
});

// GET /api/instances/:id/fs/download?path=sub/file.js
router.get('/:id/fs/download', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const baseDir = getInstanceDir(req, id);
  if (!baseDir) return res.status(404).json({ error: 'Instance tidak ditemukan.' });

  try {
    const target = safeJoin(baseDir, req.query.path || '');
    if (!fs.existsSync(target)) return res.status(404).json({ error: 'File tidak ditemukan.' });
    res.download(target);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/instances/:id/npm-install  -> jalanin "npm install" di root folder instance
router.post('/:id/npm-install', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const inst = ownedInstance(req, id);
  if (!inst) return res.status(404).json({ error: 'Instance tidak ditemukan.' });

  const pkgPath = path.join(INSTANCES_DIR, inst.folder, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return res.status(400).json({ error: 'Gak ada package.json di instance ini.' });
  }

  const result = pm.runCommand({ id: inst.id }, 'npm', ['install']);
  res.json(result);
});

module.exports = router;
