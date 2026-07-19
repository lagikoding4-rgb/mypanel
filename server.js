const express = require('express');
const session = require('express-session');
const http = require('http');
const path = require('path');

const db = require('./db');
const pm = require('./processManager');

const app = express();
const server = http.createServer(app);

const SESSION_SECRET = 'ganti-ini-dengan-string-acak-punya-kamu';

app.use(express.json());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 hari
  })
);
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/instances', require('./routes/instances'));
app.use('/api/instances', require('./routes/files'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[PANEL] Berjalan di http://localhost:${PORT}`);
});
