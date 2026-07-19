let me = null;
let currentInstanceId = null;
let logPollTimer = null;
let lastLogCount = 0;

async function init() {
  const res = await fetch('/api/auth/me');
  if (!res.ok) return (location.href = 'index.html');
  me = await res.json();
  document.getElementById('whoami').textContent = `${me.username} (${me.role})`;
  if (me.role === 'admin') document.getElementById('adminLink').style.display = 'inline';
  loadInstances();
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  location.href = 'index.html';
}

async function loadInstances() {
  const res = await fetch('/api/instances');
  const list = await res.json();
  const el = document.getElementById('instanceList');
  if (list.length === 0) {
    el.innerHTML = '<p>Belum ada instance.</p>';
    return;
  }
  el.innerHTML = list
    .map(
      (i) => `
    <div class="instance-row">
      <div>
        <span class="status-dot ${i.running ? 'status-running' : 'status-stopped'}"></span>
        <strong>${i.name}</strong> <small>(${i.entryFile})</small>
      </div>
      <div>
        <button class="btn-secondary" onclick="openConsole(${i.id}, '${i.name}')">Buka</button>
        <button class="btn-danger" onclick="deleteInstance(${i.id})">Hapus</button>
      </div>
    </div>
  `
    )
    .join('');
}

async function createInstance() {
  const name = document.getElementById('newName').value;
  const entryFile = document.getElementById('newEntry').value;
  const res = await fetch('/api/instances', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, entryFile }),
  });
  const data = await res.json();
  if (!res.ok) {
    document.getElementById('createMsg').textContent = data.error;
    return;
  }
  document.getElementById('newName').value = '';
  loadInstances();
}

async function deleteInstance(id) {
  if (!confirm('Yakin mau hapus instance ini?')) return;
  await fetch('/api/instances/' + id, { method: 'DELETE' });
  loadInstances();
}

async function openConsole(id, name) {
  currentInstanceId = id;
  lastLogCount = 0;
  document.getElementById('consoleCard').style.display = 'block';
  document.getElementById('consoleTitle').textContent = 'Console: ' + name;
  document.getElementById('consoleOutput').textContent = '';

  await refreshLogs();

  if (logPollTimer) clearInterval(logPollTimer);
  logPollTimer = setInterval(refreshLogs, 2000); // cek log baru tiap 2 detik
}

async function refreshLogs() {
  if (!currentInstanceId) return;
  const res = await fetch(`/api/instances/${currentInstanceId}/logs`);
  if (!res.ok) return;
  const logs = await res.json();

  // cuma update kalau ada baris baru, biar gak flicker & gak boros render
  if (logs.length !== lastLogCount) {
    lastLogCount = logs.length;
    const out = document.getElementById('consoleOutput');
    out.textContent = logs.join('');
    out.scrollTop = out.scrollHeight;
  }
}

async function doAction(action) {
  if (!currentInstanceId) return;
  const res = await fetch(`/api/instances/${currentInstanceId}/${action}`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) alert(data.error);
  loadInstances();
}

async function uploadFile() {
  const fileInput = document.getElementById('uploadFile');
  if (!fileInput.files[0] || !currentInstanceId) return;
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  const res = await fetch(`/api/instances/${currentInstanceId}/upload`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (res.ok) alert('File terupload: ' + data.filename);
  else alert(data.error);
}

init();
