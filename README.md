# My Panel — Panel Hosting Sederhana (Starter)

Panel hosting basic yang **beneran fungsional**: admin bisa nambah user, user bisa upload script Node.js (bot Discord, dll) lalu Start/Stop/Restart proses beneran + lihat log real-time.

## Cara Install

1. Pastikan sudah ada **Node.js** (v16 ke atas) di server/VPS kamu.
2. Extract folder ini, lalu masuk ke foldernya:
   ```bash
   cd panel
   ```
3. Install dependency:
   ```bash
   npm install
   ```
4. Jalankan:
   ```bash
   node server.js
   ```
5. Buka browser ke `http://IP-SERVER-KAMU:3000`

## Login Pertama Kali

Akun admin default otomatis dibuat saat pertama kali jalan:
- **Username:** `admin`
- **Password:** `admin123`

**⚠️ PENTING:** Segera bikin user baru dengan password kuat, terus hapus/ganti akun admin default ini. Jangan dipakai di production dengan password default!

## Cara Pakai

1. Login sebagai admin.
2. Ke menu **Admin** → tambah user baru (bisa role `user` atau `admin`).
3. Login sebagai user itu (atau tetap sebagai admin) → **buat instance baru**:
   - Nama bebas, misal "Bot Discord Aku"
   - Entry file: nama file utama yang mau dijalankan, misal `index.js`
4. Klik **Buka** pada instance itu → upload file `index.js` (dan file pendukung lain kalau perlu — upload satu-satu dulu, atau nanti kita bisa tambah upload folder/zip).
5. Klik **Start** → proses Node.js beneran jalan, log muncul real-time di console.
6. **Stop** / **Restart** kapan saja.

## Yang PERLU Kamu Ganti Sebelum Dipakai Serius

Buka `server.js`, cari baris ini dan ganti dengan string acak panjang punya kamu sendiri:

```js
const SESSION_SECRET = 'ganti-ini-dengan-string-acak-punya-kamu';
```

## Batasan Versi Ini (Biar Kamu Tahu)

Ini versi **starter/belajar**, belum production-grade. Yang belum ada:
- Resource limit (CPU/RAM) per instance — semua user pakai resource server yang sama tanpa batas
- Isolasi/sandbox antar user (idealnya pakai Docker per instance biar user gak bisa lihat/rusak file user lain)
- HTTPS (pasang reverse proxy nginx + Let's Encrypt kalau mau akses publik aman)
- `npm install` otomatis untuk dependency instance yang diupload
- Upload banyak file sekaligus / folder / zip extract otomatis

Kalau nanti udah nyaman sama versi dasar ini, kita bisa upgrade satu-satu ke fitur di atas.

## Cara Deploy ke Render (Gratis)

1. Bikin repo baru di GitHub, upload semua isi folder `panel` ini ke situ (folder `node_modules` gak usah diupload, sudah di-skip otomatis lewat `.gitignore`).
2. Daftar/login ke [render.com](https://render.com) pakai akun GitHub.
3. Klik **New → Web Service**, pilih repo yang baru kamu upload.
4. Render otomatis baca `render.yaml` yang sudah disiapkan (Build Command: `npm install`, Start Command: `node server.js`). Kalau gak otomatis kebaca, isi manual sama seperti itu.
5. Pilih plan **Free**, klik **Deploy**.
6. Tunggu proses build selesai (~2-5 menit), nanti Render kasih URL seperti `https://nama-app-kamu.onrender.com`.
7. Buka URL itu, login pakai `admin` / `admin123`, langsung ganti password.

**Catatan penting untuk free tier Render:**
- Server otomatis "tidur" kalau 15 menit gak ada yang akses, nanti bangun lagi otomatis pas ada request masuk (loading pertama ~30 detik, normal).
- Disk di Render free tier **tidak permanen** — kalau service di-restart/redeploy, isi folder `data/` dan `instances/` (termasuk file yang diupload user) bisa hilang. Untuk sekadar coba-coba ini gak masalah, tapi kalau mau dipakai serius nanti perlu disimpan ke database eksternal, bukan disk lokal.

## Struktur Folder

```
panel/
├── server.js          # entry point
├── db.js               # database (file JSON di data/db.json)
├── processManager.js   # bagian inti: start/stop/restart proses
├── middleware/auth.js   # cek login & role admin
├── routes/              # API endpoints
└── public/              # halaman web (HTML/CSS/JS)
```
