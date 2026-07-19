const { spawn } = require('child_process');
const path = require('path');

// proses yang lagi aktif (instance atau job one-off kayak npm install): instanceId -> { proc }
const running = new Map();
// log tetap tersimpan terpisah dari status running, biar log gak ilang begitu proses selesai
const logs = new Map(); // instanceId -> string[]
const MAX_LOG_LINES = 500;

function pushLog(instanceId, line) {
  if (!logs.has(instanceId)) logs.set(instanceId, []);
  const arr = logs.get(instanceId);
  arr.push(line);
  if (arr.length > MAX_LOG_LINES) arr.shift();
}

function isRunning(instanceId) {
  return running.has(instanceId);
}

function getLogs(instanceId) {
  return logs.get(instanceId) || [];
}

function clearLogs(instanceId) {
  logs.set(instanceId, []);
}

function start(instance) {
  if (running.has(instance.id)) {
    return { ok: false, message: 'Instance sudah jalan.' };
  }

  const cwd = path.join(__dirname, 'instances', String(instance.id));
  const proc = spawn('node', [instance.entryFile], { cwd });

  running.set(instance.id, { proc });
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
  });

  proc.on('error', (err) => {
    pushLog(instance.id, `[SYSTEM] Gagal start: ${err.message}`);
    running.delete(instance.id);
  });

  return { ok: true, message: 'Instance dijalankan.' };
}

function stop(instanceId) {
  const entry = running.get(instanceId);
  if (!entry) return { ok: false, message: 'Instance tidak sedang jalan.' };
  entry.proc.kill();
  running.delete(instanceId);
  return { ok: true, message: 'Instance dihentikan.' };
}

function restart(instance) {
  stop(instance.id);
  setTimeout(() => start(instance), 500);
  return { ok: true, message: 'Instance di-restart.' };
}

// Jalanin perintah one-off (misal npm install) di folder instance, hasilnya nimbrung ke log yang sama
function runCommand(instance, command, args) {
  const cwd = path.join(__dirname, 'instances', String(instance.id));
  const proc = spawn(command, args, { cwd });

  pushLog(instance.id, `[SYSTEM] Menjalankan: ${command} ${args.join(' ')}\n`);

  proc.stdout.on('data', (data) => pushLog(instance.id, data.toString()));
  proc.stderr.on('data', (data) => pushLog(instance.id, data.toString()));
  proc.on('exit', (code) => {
    pushLog(instance.id, `[SYSTEM] Selesai (exit code ${code})\n`);
  });
  proc.on('error', (err) => {
    pushLog(instance.id, `[SYSTEM] Gagal jalanin perintah: ${err.message}\n`);
  });

  return { ok: true, message: 'Perintah dijalankan, cek console buat lihat progress.' };
}

module.exports = { start, stop, restart, isRunning, getLogs, clearLogs, pushLog, runCommand };
