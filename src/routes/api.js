/**
 * src/routes/api.js
 * ESP32-facing REST API.
 * All routes protected by x-api-key header.
 */

const express           = require('express');
const router            = express.Router();
const { initDB, get, run, transaction } = require('../db/database');
const { requireApiKey } = require('../middleware/auth');

router.use(requireApiKey);

// ── POST /api/coffee ─────────────────────────────────────────
// Called by ESP32 on every RFID scan.
// Body: { rfid_uid: "A3:FF:02:11", device_id: "machine_floor1" }
router.post('/coffee', async (req, res) => {
  const { rfid_uid, device_id } = req.body;

  if (!rfid_uid) {
    return res.status(400).json({ error: 'rfid_uid is required' });
  }

  const db = await initDB();

  // Look up employee by RFID UID (case-insensitive)
  const employee = get(db,
    `SELECT id, name FROM employees WHERE UPPER(rfid_uid) = UPPER(?) AND active = 1`,
    [rfid_uid]
  );

  if (!employee) {
    console.log(`[API] Unknown RFID: ${rfid_uid}`);
    return res.status(404).json({ error: 'RFID tag not registered' });
  }

  // Get current coffee price
  const priceSetting = get(db, `SELECT value FROM settings WHERE key = 'price_per_coffee'`);
  const price        = parseFloat(priceSetting?.value || '0.50');

  // Log scan + update balance atomically.
  // transaction() passes rawRun so we don't persist on every statement.
  transaction(db, (rawRun) => {
    rawRun(`INSERT INTO coffees (employee_id, device_id) VALUES (?, ?)`,
           [employee.id, device_id || null]);
    rawRun(`UPDATE employees SET balance = balance + ? WHERE id = ?`,
           [price, employee.id]);
  });

  console.log(`[API] Coffee logged for ${employee.name}  (${rfid_uid})`);
  res.status(201).json({ message: 'Coffee logged', employee: employee.name, price });
});

// ── GET /api/status ──────────────────────────────────────────
// Health check — verify ESP32 can reach the server.
router.get('/status', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
