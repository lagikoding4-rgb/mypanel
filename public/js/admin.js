async function init() {
  const meRes = await fetch('/api/auth/me');
  if (!meRes.ok) return (location.href = 'index.html');
  const me = await meRes.json();
  if (me.role !== 'admin') return (location.href = 'dashboard.html');
  loadUsers();
}

async function loadUsers() {
  const res = await fetch('/api/admin/users');
  const users = await res.json();
  document.getElementById('userList').innerHTML = users
    .map(
      (u) => `
    <div class="instance-row">
      <div><strong>${u.username}</strong> <small>(${u.role})</small></div>
      <button class="btn-danger" onclick="deleteUser(${u.id})">Hapus</button>
    </div>
  `
    )
    .join('');
}

async function createUser() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const role = document.getElementById('role').value;
  const res = await fetch('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, role }),
  });
  const data = await res.json();
  if (!res.ok) {
    document.getElementById('msg').textContent = data.error;
    return;
  }
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  document.getElementById('msg').textContent = '';
  loadUsers();
}

async function deleteUser(id) {
  if (!confirm('Yakin hapus user ini?')) return;
  await fetch('/api/admin/users/' + id, { method: 'DELETE' });
  loadUsers();
}

init();
