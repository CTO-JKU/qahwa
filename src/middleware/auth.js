/**
 * src/middleware/auth.js
 * Session-based auth guards for web dashboard routes.
 * API key guard for ESP32 device routes.
 */

const API_KEY = process.env.API_KEY || 'change-me-to-a-long-random-string';

// ── Web dashboard: redirect to login if not authenticated ────
function requireLogin(req, res, next) {
  if (req.session && req.session.adminId) return next();
  res.redirect('/login');
}

// ── ESP32 API: validate x-api-key header ────────────────────
function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (key && key === API_KEY) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

module.exports = { requireLogin, requireApiKey };
