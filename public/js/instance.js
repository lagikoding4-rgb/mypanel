const params = new URLSearchParams(location.search);
const instanceId = params.get('id');
if (!instanceId) location.href = 'dashboard.html';

let me = null;
let logPollTimer = null;
let lastLogCount = 0;
let currentPath = '';
let selected = new Set();

// ---------- Tab switching ----------
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'files') loadFileList();
  });
});

// ---------- Init ----------
async function init() {
  const meRes = await fetch('/api/auth/me');
  if (!meRes.ok) return (location.href = 'index.html');
  me = await meRes.json();

  await loadInstanceInfo();
  await refreshLogs();
  logPollTimer = setInterval(() => {
    refreshLogs();
    loadInstanceInfo(true); // update status dot tiap poll juga
  }, 2000);
}

async function loadInstanceInfo(silent) {
  const res = await fetch(`/api/instances/${instanceId}`);
  if (!res.ok) {
    if (!silent) location.href = 'dashboard.html';
    return;
  }
  const inst = await res.json();
  document.getElementById('serverName').textContent = inst.name;
  document.getElementById('serverSub').textContent = `Entry file: ${inst.entryFile}`;
  document.getElementById('statusDot').className = 'status-dot ' + (inst.running ? 'status-running' : 'status-stopped');

  if (!silent) {
    document.getElementById('settingsName').value = inst.name;
    document.getElementById('settingsEntry').value = inst.entryFile;
  }
}

// ---------- CONSOLE ----------
async function refreshLogs() {
  const res = await fetch(`/api/instances/${instanceId}/logs`);
  if (!res.ok) return;
  const logs = await res.json();
  if (logs.length !== lastLogCount) {
    lastLogCount = logs.length;
    const out = document.getElementById('consoleOutput');
    out.textContent = logs.join('');
    out.scrollTop = out.scrollHeight;
  }
}

async function doAction(action) {
  const res = await fetch(`/api/instances/${instanceId}/${action}`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) alert(data.error);
  loadInstanceInfo(true);
}

// ---------- FILES ----------
async function loadFileList() {
  selected.clear();
  updateSelectedBar();
  document.getElementById('fmMsg').textContent = '';

  const res = await fetch(`/api/instances/${instanceId}/fs/list?path=${encodeURIComponent(currentPath)}`);
  const data = await res.json();
  if (!res.ok) {
    document.getElementById('fmMsg').textContent = data.error || 'Gagal memuat file.';
    return;
  }
  renderBreadcrumb();
  renderFileList(data.entries);
}

function renderBreadcrumb() {
  const el = document.getElementById('breadcrumb');
  const parts = currentPath ? currentPath.split('/').filter(Boolean) : [];
  let html = `<a onclick="goToPath('')">root</a>`;
  let acc = '';
  for (const p of parts) {
    acc += (acc ? '/' : '') + p;
    html += ` / <a onclick="goToPath('${acc}')">${p}</a>`;
  }
  el.innerHTML = html;
}

function goToPath(p) {
  currentPath = p;
  loadFileList();
}

function renderFileList(entries) {
  const el = document.getElementById('fileList');
  if (entries.length === 0) {
    el.innerHTML = '<p>Folder ini kosong.</p>';
    return;
  }
  el.innerHTML = entries
    .map((e) => {
      const icon = e.isDirectory ? '📁' : '📄';
      const sizeLabel = e.isDirectory ? '' : `<small style="color:#8b949e"> (${formatSize(e.size)})</small>`;
      const nameClickable = e.isDirectory ? `onclick="goToPath('${joinPath(currentPath, e.name)}')"` : '';
      return `
      <div class="fm-row">
        <input type="checkbox" onchange="toggleSelect('${e.name}', this.checked)">
        <span class="fm-name ${e.isDirectory ? 'folder' : ''}" ${nameClickable}>${icon} ${e.name}${sizeLabel}</span>
        <div class="fm-actions">
          ${!e.isDirectory ? `<button onclick="downloadFile('${e.name}')">⬇️</button>` : ''}
          <button onclick="renameEntry('${e.name}')">✏️</button>
        </div>
      </div>`;
    })
    .join('');
}

function joinPath(base, name) {
  return base ? `${base}/${name}` : name;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function toggleSelect(name, checked) {
  if (checked) selected.add(name);
  else selected.delete(name);
  updateSelectedBar();
}

function updateSelectedBar() {
  const bar = document.getElementById('selectedBar');
  const count = document.getElementById('selectedCount');
  if (selected.size > 0) {
    bar.classList.add('show');
    count.textContent = `${selected.size} dipilih`;
  } else {
    bar.classList.remove('show');
  }
}

function clearSelection() {
  selected.clear();
  document.querySelectorAll('.fm-row input[type=checkbox]').forEach((c) => (c.checked = false));
  updateSelectedBar();
}

async function deleteSelected() {
  if (!confirm(`Yakin mau hapus ${selected.size} item?`)) return;
  const res = await fetch(`/api/instances/${instanceId}/fs/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: currentPath, names: Array.from(selected) }),
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error);
  loadFileList();
}

async function archiveSelected() {
  const archiveName = prompt('Nama file zip:', `archive-${Date.now()}.zip`);
  if (!archiveName) return;
  const res = await fetch(`/api/instances/${instanceId}/fs/archive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: currentPath, names: Array.from(selected), archiveName }),
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error);
  alert('Berhasil dibuat: ' + data.filename);
  loadFileList();
}

async function renameEntry(oldName) {
  const newName = prompt('Nama baru:', oldName);
  if (!newName || newName === oldName) return;
  const res = await fetch(`/api/instances/${instanceId}/fs/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: currentPath, oldName, newName }),
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error);
  loadFileList();
}

function downloadFile(name) {
  const url = `/api/instances/${instanceId}/fs/download?path=${encodeURIComponent(joinPath(currentPath, name))}`;
  window.open(url, '_blank');
}

async function mkdirPrompt() {
  const name = prompt('Nama folder baru:');
  if (!name) return;
  const res = await fetch(`/api/instances/${instanceId}/fs/mkdir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: currentPath, name }),
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error);
  loadFileList();
}

async function newFilePrompt() {
  const name = prompt('Nama file baru (mis. config.json):');
  if (!name) return;
  const res = await fetch(`/api/instances/${instanceId}/fs/newfile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: currentPath, name, content: '' }),
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error);
  loadFileList();
}

async function runNpmInstall() {
  if (!confirm('Jalanin "npm install" di folder instance ini? Progressnya bisa dilihat di tab Console.')) return;
  const res = await fetch(`/api/instances/${instanceId}/npm-install`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) return alert(data.error);
  alert(data.message);
  document.querySelector('.tab-btn[data-tab="console"]').click();
}

document.getElementById('fileUpload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`/api/instances/${instanceId}/fs/upload?path=${encodeURIComponent(currentPath)}`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) alert(data.error);
  e.target.value = '';
  loadFileList();
});

document.getElementById('zipUpload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  document.getElementById('fmMsg').className = '';
  document.getElementById('fmMsg').textContent = 'Sedang upload & extract...';
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`/api/instances/${instanceId}/fs/upload-archive?path=${encodeURIComponent(currentPath)}`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) {
    document.getElementById('fmMsg').className = 'error';
    document.getElementById('fmMsg').textContent = data.error;
  } else {
    document.getElementById('fmMsg').className = 'success';
    document.getElementById('fmMsg').textContent = 'Berhasil di-extract!';
  }
  e.target.value = '';
  loadFileList();
});

// ---------- SETTINGS ----------
async function saveSettings() {
  const name = document.getElementById('settingsName').value;
  const entryFile = document.getElementById('settingsEntry').value;
  const res = await fetch(`/api/instances/${instanceId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, entryFile }),
  });
  const data = await res.json();
  const msg = document.getElementById('settingsMsg');
  if (!res.ok) {
    msg.className = 'error';
    msg.textContent = data.error;
    return;
  }
  msg.className = 'success';
  msg.textContent = 'Tersimpan!';
  loadInstanceInfo();
}

async function deleteThisInstance() {
  if (!confirm('Yakin mau hapus instance ini beserta semua filenya? Gak bisa dibatalin.')) return;
  await fetch(`/api/instances/${instanceId}`, { method: 'DELETE' });
  location.href = 'dashboard.html';
}

init();
