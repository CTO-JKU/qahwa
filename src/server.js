/**
 * src/server.js
 * Express server entry point.
 *
 * Usage:
 *   npm start           → production
 *   npm run dev         → development (auto-reload with nodemon)
 *
 * Environment variables (create a .env or export before running):
 *   PORT        default 3000
 *   SESSION_SECRET  default 'change-this-secret'
 *   API_KEY     default 'change-me-to-a-long-random-string'
 */

/**
 * src/server.js
 * Express entry point — Windows compatible.
 *
 * Usage:
 *   npm start        → production
 *   npm run dev      → development (nodemon auto-reload)
 *
 * Environment (.env or set in Windows environment variables):
 *   PORT            default 3000
 *   SESSION_SECRET  random string for session signing
 *   API_KEY         must match ESP32 config.h
 */

require('dotenv').config();

const express     = require('express');
const session     = require('express-session');
const MemoryStore = require('memorystore')(session);
const path        = require('path');
const fs          = require('fs');
const { initDB }  = require('./db/database');

fs.mkdirSync(path.join(__dirname, '../data'), { recursive: true });

const app = express();

// ── Middleware ───────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// memorystore: in-memory sessions with automatic stale-entry pruning.
// No SQLite native build required. Sessions are lost on server restart
// (users just have to log in again — perfectly fine for this use case).
app.use(session({
  store: new MemoryStore({
    checkPeriod: 86400000   // prune expired entries every 24h
  }),
  secret:            process.env.SESSION_SECRET || 'change-this-secret',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:  false,               // set true when running behind HTTPS
    maxAge:  8 * 60 * 60 * 1000  // 8 hours
  }
}));

// ── Routes ───────────────────────────────────────────────────
app.use('/api',  require('./routes/api'));
app.use('/',     require('./routes/auth'));
app.use('/',     require('./routes/dashboard'));

// ── 404 ──────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).send(`
    <body style="background:#0c0f0a;color:#7ec850;font-family:monospace;display:grid;place-items:center;height:100vh">
      <div style="text-align:center">
        <div style="font-size:3rem;margin-bottom:16px">☕</div>
        <h1 style="font-size:1.2rem;margin-bottom:8px">404 — Page not found</h1>
        <a href="/" style="color:#566b4a">← Back to dashboard</a>
      </div>
    </body>`);
});

// ── Boot: init DB first, then start listening ────────────────
const PORT = process.env.PORT || 3000;

initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n☕  Coffee Tracker running on http://0.0.0.0:${PORT}`);
    console.log(`   Dashboard → http://localhost:${PORT}`);
    console.log(`   API       → http://localhost:${PORT}/api/coffee\n`);
  });
}).catch(err => {
  console.error('[BOOT] Database init failed:', err);
  process.exit(1);
});
