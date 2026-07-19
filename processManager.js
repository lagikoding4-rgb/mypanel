const { spawn } = require('child_process');
const path = require('path');

// Simpan proses yang lagi jalan di memori: instanceId -> { proc, logs: [] }
const running = new Map();
const MAX_LOG_LINES = 500;

let ioRef = null;
function setIo(io) {
  ioRef = io;
}

function pushLog(instanceId, line) {
  const entry = running.get(instanceId);
  if (!entry) return;
  entry.logs.push(line);
  if (entry.logs.length > MAX_LOG_LINES) entry.logs.shift();
  if (ioRef) {
    ioRef.to('instance-' + instanceId).emit('log', line);
  }
}

function isRunning(instanceId) {
  return running.has(instanceId);
}

function getLogs(instanceId) {
  const entry = running.get(instanceId);
  return entry ? entry.logs : [];
}

function start(instance) {
  if (running.has(instance.id)) {
    return { ok: false, message: 'Instance sudah jalan.' };
  }

  const cwd = path.join(__dirname, 'instances', String(instance.id));
  const proc = spawn('node', [instance.entryFile], { cwd });

  running.set(instance.id, { proc, logs: [] });
  pushLog(instance.id, `[SYSTEM] Starting ${instance.entryFile}...`);

  proc.stdout.on('data', (data) => {
    pushLog(instance.id, data.toString());
  });

  proc.stderr.on('data', (data) => {
    pushLog(instance.id, '[ERROR] ' + data.toString());
  });

  proc.on('exit', (code) => {
    pushLog(instance.id, `[SYSTEM] Proses berhenti (exit code ${code})`);
    running.delete(instance.id);
    if (ioRef) ioRef.to('instance-' + instance.id).emit('status', 'stopped');
  });

  proc.on('error', (err) => {
    pushLog(instance.id, `[SYSTEM] Gagal start: ${err.message}`);
    running.delete(instance.id);
  });

  if (ioRef) ioRef.to('instance-' + instance.id).emit('status', 'running');
  return { ok: true, message: 'Instance dijalankan.' };
}

function stop(instanceId) {
  const entry = running.get(instanceId);
  if (!entry) return { ok: false, message: 'Instance tidak sedang jalan.' };
  entry.proc.kill();
  running.delete(instanceId);
  if (ioRef) ioRef.to('instance-' + instanceId).emit('status', 'stopped');
  return { ok: true, message: 'Instance dihentikan.' };
}

function restart(instance) {
  stop(instance.id);
  setTimeout(() => start(instance), 500);
  return { ok: true, message: 'Instance di-restart.' };
}

module.exports = { setIo, start, stop, restart, isRunning, getLogs, pushLog };
