/**
 * src/routes/auth.js
 * Login / logout for the web dashboard.
 */

const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const { initDB, get } = require('../db/database');

// ── GET /login ───────────────────────────────────────────────
router.get('/login', (req, res) => {
  if (req.session?.adminId) return res.redirect('/');
  res.send(renderLogin(req.query.error));
});

// ── POST /login ──────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const db    = await initDB();
  const admin = get(db, `SELECT * FROM admins WHERE username = ?`, [username]);

  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.redirect('/login?error=1');
  }

  req.session.adminId  = admin.id;
  req.session.username = admin.username;
  res.redirect('/');
});

// ── GET /logout ──────────────────────────────────────────────
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// ── Login page HTML ──────────────────────────────────────────
function renderLogin(error) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Coffee Tracker — Login</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg:      #0c0f0a; --surface: #131710; --border: #1f2b1a;
      --text:    #e8f0e2; --muted:   #5a6e52;
      --accent:  #7ec850; --accent2: #c8f07e; --error: #f07e7e;
    }
    body {
      background: var(--bg); color: var(--text);
      font-family: 'DM Sans', sans-serif;
      min-height: 100vh; display: grid; place-items: center;
      position: relative; overflow: hidden;
    }
    body::before {
      content: ''; position: fixed; inset: 0;
      background-image: linear-gradient(var(--border) 1px, transparent 1px),
                        linear-gradient(90deg, var(--border) 1px, transparent 1px);
      background-size: 48px 48px; opacity: 0.4; pointer-events: none;
    }
    .card {
      position: relative; background: var(--surface);
      border: 1px solid var(--border); border-radius: 20px;
      padding: 48px 44px; width: 100%; max-width: 400px;
      animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .logo { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 1.1rem;
            letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent);
            margin-bottom: 8px; }
    .logo span { color: var(--muted); font-weight: 400; }
    h1 { font-family: 'Syne', sans-serif; font-size: 2rem; font-weight: 800;
         color: var(--text); margin-bottom: 32px; line-height: 1.1; }
    .error-msg { background: rgba(240,126,126,0.1); border: 1px solid rgba(240,126,126,0.3);
                 color: var(--error); padding: 10px 14px; border-radius: 8px;
                 font-size: 0.85rem; margin-bottom: 20px; }
    label { display: block; font-size: 0.75rem; font-weight: 500; letter-spacing: 0.1em;
            text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
    input { width: 100%; background: var(--bg); border: 1px solid var(--border);
            border-radius: 10px; padding: 12px 16px; color: var(--text);
            font-family: 'DM Sans', sans-serif; font-size: 1rem; margin-bottom: 20px;
            transition: border-color 0.2s; outline: none; }
    input:focus { border-color: var(--accent); }
    button { width: 100%; background: var(--accent); color: #0c0f0a; border: none;
             border-radius: 10px; padding: 14px; font-family: 'Syne', sans-serif;
             font-weight: 700; font-size: 0.95rem; letter-spacing: 0.05em;
             cursor: pointer; transition: background 0.2s, transform 0.1s; margin-top: 4px; }
    button:hover  { background: var(--accent2); }
    button:active { transform: scale(0.98); }
    .hint { margin-top: 20px; font-size: 0.78rem; color: var(--muted); text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">☕ Coffee <span>Tracker</span></div>
    <h1>Admin<br>Login</h1>
    ${error ? '<div class="error-msg">Invalid username or password.</div>' : ''}
    <form method="POST" action="/login">
      <label>Username</label>
      <input type="text" name="username" autocomplete="username" autofocus required>
      <label>Password</label>
      <input type="password" name="password" autocomplete="current-password" required>
      <button type="submit">Sign In →</button>
    </form>
    <p class="hint">Default: admin / admin123 — change after first login</p>
  </div>
</body>
</html>`;
}

module.exports = router;
