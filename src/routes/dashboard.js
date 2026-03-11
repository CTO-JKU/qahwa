/**
 * src/routes/dashboard.js
 * All web dashboard pages (server-rendered HTML).
 */

const express      = require('express');
const router       = express.Router();
const bcrypt       = require('bcryptjs');
const { initDB, query, get, run } = require('../db/database');
const { requireLogin } = require('../middleware/auth');

router.use(requireLogin);

// ── GET / → Dashboard ────────────────────────────────────────
router.get('/', async (req, res) => {
  const db       = await initDB();
  const settings = getSettings(db);
  const price    = parseFloat(settings.price_per_coffee || 0.5);
  const currency = settings.currency_symbol || '€';

  const employees = query(db, `
    SELECT e.id, e.name, e.email, e.rfid_uid, e.balance, e.active,
           COUNT(c.id) AS total_coffees, MAX(c.scanned_at) AS last_coffee
    FROM employees e
    LEFT JOIN coffees c ON c.employee_id = e.id
    WHERE e.active = 1
    GROUP BY e.id
    ORDER BY e.name ASC
  `);

  const totalCoffees = get(db, `SELECT COUNT(*) as n FROM coffees`).n;
  const totalOwed    = employees.reduce((s, e) => s + e.balance, 0);
  const recentScans  = query(db, `
    SELECT c.scanned_at, c.device_id, e.name
    FROM coffees c JOIN employees e ON e.id = c.employee_id
    ORDER BY c.scanned_at DESC LIMIT 8
  `);

  res.send(renderDashboard({ employees, totalCoffees, totalOwed, recentScans, price, currency, username: req.session.username }));
});

// ── POST /employees/add ──────────────────────────────────────
router.post('/employees/add', async (req, res) => {
  const { name, email, rfid_uid } = req.body;
  if (!name) return res.redirect('/?error=name_required');
  const db = await initDB();
  try {
    run(db, `INSERT INTO employees (name, email, rfid_uid) VALUES (?, ?, ?)`,
        [name.trim(), email?.trim() || null, rfid_uid?.trim().toUpperCase() || null]);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.redirect('/?error=rfid_taken');
    throw e;
  }
  res.redirect('/');
});

// ── POST /employees/:id/clear ────────────────────────────────
router.post('/employees/:id/clear', async (req, res) => {
  const db = await initDB();
  run(db, `UPDATE employees SET balance = 0 WHERE id = ?`, [req.params.id]);
  res.redirect('/');
});

// ── POST /employees/:id/delete ───────────────────────────────
router.post('/employees/:id/delete', async (req, res) => {
  const db = await initDB();
  run(db, `UPDATE employees SET active = 0 WHERE id = ?`, [req.params.id]);
  res.redirect('/');
});

// ── POST /employees/:id/rfid ─────────────────────────────────
router.post('/employees/:id/rfid', async (req, res) => {
  const { rfid_uid } = req.body;
  const db = await initDB();
  try {
    run(db, `UPDATE employees SET rfid_uid = ? WHERE id = ?`,
        [rfid_uid?.trim().toUpperCase() || null, req.params.id]);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.redirect('/?error=rfid_taken');
    throw e;
  }
  res.redirect('/');
});

// ── GET /history ─────────────────────────────────────────────
router.get('/history', async (req, res) => {
  const db        = await initDB();
  const settings  = getSettings(db);
  const currency  = settings.currency_symbol || '€';
  const page      = parseInt(req.query.page) || 1;
  const limit     = 30;
  const offset    = (page - 1) * limit;
  const empFilter = req.query.emp || '';

  const where  = empFilter ? `WHERE e.id = ${parseInt(empFilter)}` : '';
  const scans  = query(db, `
    SELECT c.id, c.scanned_at, c.device_id, e.name, e.id as emp_id
    FROM coffees c JOIN employees e ON e.id = c.employee_id
    ${where} ORDER BY c.scanned_at DESC LIMIT ? OFFSET ?
  `, [limit, offset]);

  const total  = get(db, `SELECT COUNT(*) as n FROM coffees c JOIN employees e ON e.id = c.employee_id ${where}`).n;
  const emps   = query(db, `SELECT id, name FROM employees WHERE active=1 ORDER BY name`);
  const pages  = Math.ceil(total / limit);

  res.send(renderHistory({ scans, page, pages, total, emps, empFilter, currency, username: req.session.username }));
});

// ── GET /settings ────────────────────────────────────────────
router.get('/settings', async (req, res) => {
  const db       = await initDB();
  const settings = getSettings(db);
  res.send(renderSettings({ settings, saved: !!req.query.saved, username: req.session.username }));
});

// ── POST /settings ───────────────────────────────────────────
router.post('/settings', async (req, res) => {
  const { price_per_coffee, currency_symbol, new_password } = req.body;
  const db = await initDB();

  if (price_per_coffee) run(db, `UPDATE settings SET value = ? WHERE key = 'price_per_coffee'`, [price_per_coffee]);
  if (currency_symbol)  run(db, `UPDATE settings SET value = ? WHERE key = 'currency_symbol'`,  [currency_symbol]);
  if (new_password && new_password.length >= 6) {
    run(db, `UPDATE admins SET password_hash = ? WHERE id = ?`,
        [bcrypt.hashSync(new_password, 10), req.session.adminId]);
  }
  res.redirect('/settings?saved=1');
});

// ── Helpers ──────────────────────────────────────────────────
function getSettings(db) {
  const rows = query(db, `SELECT key, value FROM settings`);
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

// ════════════════════════════════════════════════════════════
// HTML TEMPLATES
// ════════════════════════════════════════════════════════════

function baseStyles() {
  return `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg:#0c0f0a; --surface:#111410; --surface2:#161a13; --border:#1e2a18;
      --text:#dde8d5; --muted:#566b4a; --accent:#7ec850; --accent2:#b8f075;
      --red:#f07e7e; --amber:#f0c97e; --blue:#7eb8f0; --radius:12px;
    }
    html { font-size: 15px; }
    body { background:var(--bg); color:var(--text); font-family:'DM Sans',sans-serif; min-height:100vh; display:flex; }
    .sidebar { width:220px; flex-shrink:0; background:var(--surface); border-right:1px solid var(--border);
               display:flex; flex-direction:column; padding:28px 0; position:fixed; top:0; left:0; bottom:0; }
    .sidebar-logo { font-family:'Syne',sans-serif; font-weight:800; font-size:1.1rem; color:var(--accent);
                    padding:0 24px 28px; letter-spacing:0.04em; border-bottom:1px solid var(--border); margin-bottom:16px; }
    .sidebar-logo span { color:var(--muted); font-weight:400; }
    nav a { display:flex; align-items:center; gap:10px; padding:10px 24px; color:var(--muted);
            text-decoration:none; font-size:0.9rem; font-weight:500; border-left:3px solid transparent;
            transition:color 0.15s,border-color 0.15s,background 0.15s; }
    nav a:hover  { color:var(--text); background:var(--surface2); }
    nav a.active { color:var(--accent); border-left-color:var(--accent); background:rgba(126,200,80,0.06); }
    nav .icon { font-size:1.1rem; width:20px; text-align:center; }
    .sidebar-bottom { margin-top:auto; padding:16px 24px 0; border-top:1px solid var(--border); }
    .sidebar-user { font-size:0.8rem; color:var(--muted); margin-bottom:8px; }
    .sidebar-user strong { color:var(--text); display:block; }
    .sidebar-bottom a { color:var(--muted); font-size:0.82rem; text-decoration:none; }
    .sidebar-bottom a:hover { color:var(--red); }
    .main { margin-left:220px; padding:36px 40px; flex:1; max-width:1100px; }
    .page-header { margin-bottom:32px; }
    .page-header h1 { font-family:'Syne',sans-serif; font-size:1.9rem; font-weight:800; color:var(--text); }
    .page-header p  { color:var(--muted); font-size:0.9rem; margin-top:4px; }
    .stats { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:32px; }
    .stat-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:22px 24px; }
    .stat-card .label { font-size:0.72rem; letter-spacing:0.1em; text-transform:uppercase; color:var(--muted); margin-bottom:10px; }
    .stat-card .value { font-family:'Syne',sans-serif; font-size:2rem; font-weight:800; color:var(--text); }
    .stat-card .value.green { color:var(--accent); } .stat-card .value.amber { color:var(--amber); }
    .stat-card .sub { font-size:0.8rem; color:var(--muted); margin-top:4px; }
    .card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; }
    .card-header { padding:18px 24px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; }
    .card-header h2 { font-family:'Syne',sans-serif; font-size:1rem; font-weight:700; }
    table { width:100%; border-collapse:collapse; }
    th { text-align:left; font-size:0.72rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--muted);
         padding:12px 16px; border-bottom:1px solid var(--border); font-weight:600; }
    td { padding:13px 16px; border-bottom:1px solid rgba(30,42,24,0.6); font-size:0.88rem; color:var(--text); vertical-align:middle; }
    tr:last-child td { border-bottom:none; }
    tr:hover td { background:var(--surface2); }
    .badge { display:inline-block; padding:2px 10px; border-radius:99px; font-size:0.75rem; font-weight:500; }
    .badge-green { background:rgba(126,200,80,0.15); color:var(--accent); }
    .badge-amber { background:rgba(240,201,126,0.15); color:var(--amber); }
    .badge-red   { background:rgba(240,126,126,0.15); color:var(--red); }
    .badge-muted { background:rgba(86,107,74,0.15); color:var(--muted); }
    .mono { font-family:monospace; font-size:0.82rem; color:var(--blue); }
    .btn { display:inline-flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px;
           font-family:'DM Sans',sans-serif; font-size:0.82rem; font-weight:500;
           cursor:pointer; border:none; text-decoration:none; transition:opacity 0.15s,transform 0.1s; }
    .btn:active { transform:scale(0.97); }
    .btn-primary { background:var(--accent); color:#0c0f0a; }
    .btn-primary:hover { background:var(--accent2); }
    .btn-ghost { background:var(--surface2); color:var(--muted); border:1px solid var(--border); }
    .btn-ghost:hover { color:var(--text); }
    .btn-danger { background:rgba(240,126,126,0.12); color:var(--red); border:1px solid rgba(240,126,126,0.2); }
    .btn-danger:hover { background:rgba(240,126,126,0.2); }
    .btn-sm { padding:5px 10px; font-size:0.78rem; }
    .form-row { display:flex; gap:12px; align-items:flex-end; flex-wrap:wrap; }
    .form-group { display:flex; flex-direction:column; gap:6px; }
    .form-group label { font-size:0.75rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--muted); font-weight:500; }
    input[type=text],input[type=email],input[type=number],input[type=password],select {
      background:var(--bg); border:1px solid var(--border); border-radius:8px; padding:9px 12px;
      color:var(--text); font-family:'DM Sans',sans-serif; font-size:0.88rem; outline:none;
      transition:border-color 0.2s; min-width:160px; }
    input:focus,select:focus { border-color:var(--accent); }
    .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:24px; }
    .mt-6 { margin-top:24px; } .mt-8 { margin-top:32px; }
    .flex { display:flex; } .gap-3 { gap:12px; } .items-center { align-items:center; }
    ::-webkit-scrollbar { width:6px; } ::-webkit-scrollbar-track { background:var(--bg); }
    ::-webkit-scrollbar-thumb { background:var(--border); border-radius:3px; }
    @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    .animate { animation:fadeIn 0.3s ease forwards; }
  </style>`;
}

function sidebar(active, username) {
  const links = [
    { href:'/',        icon:'☕', label:'Dashboard' },
    { href:'/history', icon:'📋', label:'History'   },
    { href:'/settings',icon:'⚙️', label:'Settings'  },
  ];
  return `
  <aside class="sidebar">
    <div class="sidebar-logo">☕ Coffee<br><span>Tracker</span></div>
    <nav>
      ${links.map(l => `
        <a href="${l.href}" class="${active===l.href?'active':''}">
          <span class="icon">${l.icon}</span>${l.label}
        </a>`).join('')}
    </nav>
    <div class="sidebar-bottom">
      <div class="sidebar-user"><span>Logged in as</span><strong>${username}</strong></div>
      <a href="/logout">← Logout</a>
    </div>
  </aside>`;
}

function renderDashboard({ employees, totalCoffees, totalOwed, recentScans, price, currency, username }) {
  const employeeRows = employees.map(e => {
    const owed  = e.balance.toFixed(2);
    const badge = e.balance > 0
      ? `<span class="badge badge-amber">${currency}${owed}</span>`
      : `<span class="badge badge-green">Settled</span>`;
    const rfid  = e.rfid_uid
      ? `<span class="mono">${e.rfid_uid}</span>`
      : `<span class="badge badge-muted">Not assigned</span>`;
    const last  = e.last_coffee
      ? new Date(e.last_coffee).toLocaleDateString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })
      : '—';
    return `<tr>
      <td><strong>${e.name}</strong>${e.email ? `<br><span style="color:var(--muted);font-size:0.78rem">${e.email}</span>` : ''}</td>
      <td>${rfid}</td>
      <td style="text-align:center"><strong>${e.total_coffees}</strong></td>
      <td>${badge}</td>
      <td style="color:var(--muted);font-size:0.82rem">${last}</td>
      <td>
        <div class="flex gap-3 items-center">
          ${e.balance > 0 ? `
            <form method="POST" action="/employees/${e.id}/clear" style="display:inline">
              <button class="btn btn-primary btn-sm">✓ Clear ${currency}${owed}</button>
            </form>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="openRfidModal(${e.id},'${e.name}','${e.rfid_uid||''}')">📡 RFID</button>
          <form method="POST" action="/employees/${e.id}/delete" style="display:inline"
                onsubmit="return confirm('Remove ${e.name}?')">
            <button class="btn btn-danger btn-sm">✕</button>
          </form>
        </div>
      </td>
    </tr>`;
  }).join('');

  const recentRows = recentScans.map(s => {
    const when = new Date(s.scanned_at).toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
    return `<tr><td>${s.name}</td><td style="color:var(--muted)">${s.device_id||'—'}</td><td style="color:var(--muted);font-size:0.82rem">${when}</td></tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Coffee Tracker — Dashboard</title>${baseStyles()}</head>
<body>
  ${sidebar('/', username)}
  <main class="main animate">
    <div class="page-header"><h1>Dashboard</h1><p>Overview of coffee consumption and outstanding balances</p></div>
    <div class="stats">
      <div class="stat-card"><div class="label">Total Coffees</div><div class="value green">${totalCoffees}</div><div class="sub">all time</div></div>
      <div class="stat-card"><div class="label">Total Owed</div><div class="value amber">${currency}${totalOwed.toFixed(2)}</div><div class="sub">across ${employees.length} employee${employees.length!==1?'s':''}</div></div>
      <div class="stat-card"><div class="label">Price per Coffee</div><div class="value">${currency}${parseFloat(price).toFixed(2)}</div><div class="sub"><a href="/settings" style="color:var(--accent);text-decoration:none">Change in settings →</a></div></div>
    </div>
    <div class="card mt-6">
      <div class="card-header"><h2>Add Employee</h2></div>
      <div style="padding:20px 24px">
        <form method="POST" action="/employees/add">
          <div class="form-row">
            <div class="form-group"><label>Name *</label><input type="text" name="name" placeholder="Jane Doe" required></div>
            <div class="form-group"><label>Email</label><input type="email" name="email" placeholder="jane@company.com"></div>
            <div class="form-group"><label>RFID UID</label><input type="text" name="rfid_uid" placeholder="A3:FF:02:11" style="font-family:monospace"></div>
            <button type="submit" class="btn btn-primary">+ Add Employee</button>
          </div>
        </form>
      </div>
    </div>
    <div class="card mt-6">
      <div class="card-header"><h2>Employees</h2><span style="color:var(--muted);font-size:0.82rem">${employees.length} active</span></div>
      ${employees.length===0
        ? `<div style="padding:40px;text-align:center;color:var(--muted)">No employees yet — add one above</div>`
        : `<table><thead><tr><th>Name</th><th>RFID Tag</th><th style="text-align:center">Coffees</th><th>Balance</th><th>Last Coffee</th><th>Actions</th></tr></thead><tbody>${employeeRows}</tbody></table>`}
    </div>
    <div class="grid-2 mt-6">
      <div class="card">
        <div class="card-header"><h2>Recent Scans</h2></div>
        ${recentScans.length===0
          ? `<div style="padding:32px;text-align:center;color:var(--muted)">No scans yet</div>`
          : `<table><thead><tr><th>Employee</th><th>Machine</th><th>When</th></tr></thead><tbody>${recentRows}</tbody></table>`}
      </div>
      <div class="card">
        <div class="card-header"><h2>Quick Help</h2></div>
        <div style="padding:20px 24px;color:var(--muted);font-size:0.88rem;line-height:1.8">
          <p><strong style="color:var(--text)">RFID not responding?</strong><br>Check serial monitor — red flicker = server error, slow red = unknown tag.</p><br>
          <p><strong style="color:var(--text)">Assigning a tag</strong><br>Enter the UID above, or click 📡 RFID on an existing employee row.</p><br>
          <p><strong style="color:var(--text)">Finding a UID</strong><br>Hold card to reader, watch serial monitor — it logs the raw UID.</p>
        </div>
      </div>
    </div>
  </main>
  <div id="rfid-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:100;place-items:center">
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:32px;width:360px;max-width:90vw">
      <h2 style="font-family:Syne,sans-serif;margin-bottom:16px" id="modal-title">Assign RFID</h2>
      <form method="POST" id="rfid-form">
        <div class="form-group" style="margin-bottom:16px">
          <label>RFID UID</label>
          <input type="text" name="rfid_uid" id="modal-rfid" placeholder="A3:FF:02:11" style="font-family:monospace;width:100%">
        </div>
        <div class="flex gap-3">
          <button type="submit" class="btn btn-primary">Save</button>
          <button type="button" class="btn btn-ghost" onclick="closeRfidModal()">Cancel</button>
        </div>
      </form>
    </div>
  </div>
  <script>
    function openRfidModal(id,name,uid){
      document.getElementById('modal-title').textContent='Assign RFID — '+name;
      document.getElementById('rfid-form').action='/employees/'+id+'/rfid';
      document.getElementById('modal-rfid').value=uid;
      document.getElementById('rfid-modal').style.display='grid';
    }
    function closeRfidModal(){ document.getElementById('rfid-modal').style.display='none'; }
    document.getElementById('rfid-modal').addEventListener('click',function(e){ if(e.target===this)closeRfidModal(); });
  </script>
</body></html>`;
}

function renderHistory({ scans, page, pages, total, emps, empFilter, currency, username }) {
  const rows = scans.map(s => {
    const when = new Date(s.scanned_at).toLocaleString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    return `<tr><td><strong>${s.name}</strong></td><td style="color:var(--muted)">${s.device_id||'—'}</td><td style="font-size:0.82rem;color:var(--muted)">${when}</td></tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Coffee Tracker — History</title>${baseStyles()}</head>
<body>
  ${sidebar('/history', username)}
  <main class="main animate">
    <div class="page-header"><h1>Scan History</h1><p>${total} total scans recorded</p></div>
    <div class="card">
      <div class="card-header">
        <h2>All Scans</h2>
        <form method="GET" action="/history" class="flex gap-3 items-center">
          <select name="emp" onchange="this.form.submit()">
            <option value="">All employees</option>
            ${emps.map(e=>`<option value="${e.id}" ${empFilter==e.id?'selected':''}>${e.name}</option>`).join('')}
          </select>
        </form>
      </div>
      ${scans.length===0
        ? `<div style="padding:40px;text-align:center;color:var(--muted)">No scans found</div>`
        : `<table><thead><tr><th>Employee</th><th>Machine</th><th>Time</th></tr></thead><tbody>${rows}</tbody></table>`}
      ${pages>1?`
      <div style="padding:16px 24px;display:flex;gap:8px;justify-content:flex-end;border-top:1px solid var(--border)">
        ${page>1?`<a href="/history?page=${page-1}&emp=${empFilter}" class="btn btn-ghost btn-sm">← Prev</a>`:''}
        <span style="color:var(--muted);font-size:0.82rem;padding:6px 8px">Page ${page} / ${pages}</span>
        ${page<pages?`<a href="/history?page=${page+1}&emp=${empFilter}" class="btn btn-ghost btn-sm">Next →</a>`:''}
      </div>`:''}
    </div>
  </main>
</body></html>`;
}

function renderSettings({ settings, saved, username }) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Coffee Tracker — Settings</title>${baseStyles()}</head>
<body>
  ${sidebar('/settings', username)}
  <main class="main animate">
    <div class="page-header"><h1>Settings</h1><p>Configure pricing, currency, and account security</p></div>
    ${saved?`<div style="background:rgba(126,200,80,0.1);border:1px solid rgba(126,200,80,0.3);color:var(--accent);padding:12px 16px;border-radius:10px;margin-bottom:24px">✓ Settings saved</div>`:''}
    <form method="POST" action="/settings">
      <div class="grid-2">
        <div class="card">
          <div class="card-header"><h2>Pricing</h2></div>
          <div style="padding:24px;display:flex;flex-direction:column;gap:20px">
            <div class="form-group">
              <label>Price per Coffee</label>
              <input type="number" name="price_per_coffee" step="0.01" min="0" value="${settings.price_per_coffee}" style="width:160px">
            </div>
            <div class="form-group">
              <label>Currency Symbol</label>
              <input type="text" name="currency_symbol" maxlength="3" value="${settings.currency_symbol}" style="width:80px">
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h2>Change Password</h2></div>
          <div style="padding:24px;display:flex;flex-direction:column;gap:20px">
            <div class="form-group">
              <label>New Password</label>
              <input type="password" name="new_password" placeholder="Min. 6 characters" style="width:220px">
            </div>
            <p style="color:var(--muted);font-size:0.82rem">Leave blank to keep current password</p>
          </div>
        </div>
      </div>
      <div class="mt-6"><button type="submit" class="btn btn-primary">Save Settings</button></div>
    </form>
    <div class="card mt-8">
      <div class="card-header"><h2>ESP32 Configuration</h2></div>
      <div style="padding:24px;color:var(--muted);font-size:0.88rem;line-height:2">
        <p>Ensure your firmware <code style="background:var(--surface2);padding:2px 6px;border-radius:4px;color:var(--blue)">config.h</code> matches:</p><br>
        <pre style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:16px;color:var(--text);font-size:0.82rem;overflow-x:auto">#define SERVER_BASE_URL  "http://&lt;THIS_PC_IP&gt;:3000"
#define API_ENDPOINT     "/api/coffee"
#define API_KEY          "${process.env.API_KEY||'change-me-to-a-long-random-string'}"</pre>
        <br><p>Find this PC's IP: open Command Prompt and run <code style="background:var(--surface2);padding:2px 6px;border-radius:4px;color:var(--blue)">ipconfig</code> — use the IPv4 address.</p>
      </div>
    </div>
  </main>
</body></html>`;
}

module.exports = router;
