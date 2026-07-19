const params = new URLSearchParams(location.search);
const instanceId = params.get('id');
const instanceName = params.get('name') || '';
let currentPath = '';
let selected = new Set();

if (!instanceId) location.href = 'dashboard.html';

document.getElementById('pageTitle').textContent = `File Manager: ${instanceName}`;

async function loadList() {
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
  renderList(data.entries);
}

function renderBreadcrumb() {
  const el = document.getElementById('breadcrumb');
  const parts = currentPath ? currentPath.split('/').filter(Boolean) : [];
  let html = `<a onclick="goTo('')">root</a>`;
  let acc = '';
  for (const p of parts) {
    acc += (acc ? '/' : '') + p;
    html += ` / <a onclick="goTo('${acc}')">${p}</a>`;
  }
  el.innerHTML = html;
}

function goTo(p) {
  currentPath = p;
  loadList();
}

function renderList(entries) {
  const el = document.getElementById('fileList');
  if (entries.length === 0) {
    el.innerHTML = '<p>Folder ini kosong.</p>';
    return;
  }

  el.innerHTML = entries
    .map((e) => {
      const icon = e.isDirectory ? '📁' : '📄';
      const sizeLabel = e.isDirectory ? '' : `<small style="color:#8b949e"> (${formatSize(e.size)})</small>`;
      const nameClickable = e.isDirectory
        ? `onclick="goTo('${joinPath(currentPath, e.name)}')"`
        : '';
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
  loadList();
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
  loadList();
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
  loadList();
}

function downloadFile(name) {
  const url = `/api/instances/${instanceId}/fs/download?path=${encodeURIComponent(joinPath(currentPath, name))}`;
  window.open(url, '_blank');
}

// Upload file biasa
document.getElementById('fileUpload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(
    `/api/instances/${instanceId}/fs/upload?path=${encodeURIComponent(currentPath)}`,
    { method: 'POST', body: formData }
  );
  const data = await res.json();
  if (!res.ok) alert(data.error);
  e.target.value = '';
  loadList();
});

// Upload zip lalu auto-extract
document.getElementById('zipUpload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  document.getElementById('fmMsg').textContent = 'Sedang upload & extract...';
  document.getElementById('fmMsg').className = '';
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(
    `/api/instances/${instanceId}/fs/upload-archive?path=${encodeURIComponent(currentPath)}`,
    { method: 'POST', body: formData }
  );
  const data = await res.json();
  if (!res.ok) {
    document.getElementById('fmMsg').className = 'error';
    document.getElementById('fmMsg').textContent = data.error;
  } else {
    document.getElementById('fmMsg').className = 'success';
    document.getElementById('fmMsg').textContent = 'Berhasil di-extract!';
  }
  e.target.value = '';
  loadList();
});

document.getElementById('btnMkdir').parentElement.addEventListener('click', async () => {
  const name = prompt('Nama folder baru:');
  if (!name) return;
  const res = await fetch(`/api/instances/${instanceId}/fs/mkdir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: currentPath, name }),
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error);
  loadList();
});

document.getElementById('btnNewFile').parentElement.addEventListener('click', async () => {
  const name = prompt('Nama file baru (mis. config.json):');
  if (!name) return;
  const res = await fetch(`/api/instances/${instanceId}/fs/newfile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: currentPath, name, content: '' }),
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error);
  loadList();
});

document.getElementById('btnNpmInstall').addEventListener('click', async () => {
  if (!confirm('Jalanin "npm install" di folder instance ini? Progressnya bisa dilihat di halaman Console.')) return;
  const res = await fetch(`/api/instances/${instanceId}/npm-install`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) return alert(data.error);
  alert(data.message + '\n\nBuka halaman Console (dashboard) buat lihat progress install-nya.');
});

loadList();
