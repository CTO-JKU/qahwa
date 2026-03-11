# Coffee Tracker — Backend & Dashboard

Node.js + Express server with SQLite database and server-rendered web dashboard.

## Project Structure
```
coffee-tracker/
├── src/
│   ├── server.js              ← Entry point
│   ├── db/
│   │   └── database.js        ← SQLite schema + seed
│   ├── middleware/
│   │   └── auth.js            ← Session guard + API key guard
│   └── routes/
│       ├── api.js             ← ESP32 REST API  (/api/*)
│       ├── auth.js            ← Login / logout
│       └── dashboard.js       ← All web UI pages
├── data/                      ← Auto-created, holds coffee.db
├── .env.example               ← Copy to .env
└── package.json
```

---

## Quickstart (Windows)

```bat
cd coffee-tracker
npm install

:: Copy and edit the env file
copy .env.example .env

npm start
:: or for auto-reload during development:
npm run dev
```

Open http://localhost:3000 — **default login: admin / admin123**.
Change the password in Settings immediately after first login.

### Prerequisites
- **Node.js 18+** from https://nodejs.org (LTS)
- No build tools needed — `sql.js` is pure JavaScript, no Visual Studio / node-gyp required

---

## API Reference

### POST /api/coffee
Called by the ESP32 on every RFID scan.

**Headers**
```
Content-Type: application/json
x-api-key: <your API key>
```

**Body**
```json
{
  "rfid_uid":  "A3:FF:02:11",
  "device_id": "machine_floor1"
}
```

**Responses**
| Code | Body | Meaning |
|------|------|---------|
| 201 | `{ message, employee, price }` | Logged ✓ |
| 404 | `{ error: "RFID tag not registered" }` | Unknown tag |
| 401 | `{ error: "Unauthorized" }` | Wrong API key |
| 400 | `{ error: "rfid_uid is required" }` | Bad request |

### GET /api/status
Health check — returns `{ status: "ok", timestamp }`. Useful to test ESP32 connectivity.

---

## Dashboard Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard — stats, employee table, add employee, recent scans |
| `/history` | Full paginated scan history, filterable by employee |
| `/settings` | Pricing, currency, password, ESP32 config reminder |
| `/login` | Admin login |
| `/logout` | Destroys session |

---

## Database

SQLite file at `data/coffee.db`. Tables:

| Table | Purpose |
|-------|---------|
| `admins` | Web dashboard login credentials |
| `employees` | Employee records + RFID UIDs + running balance |
| `coffees` | One row per scan event |
| `settings` | Key/value: price_per_coffee, currency_symbol |

---

## Running on a Raspberry Pi (recommended)

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Clone / copy project, then:
npm install --production
npm start

# Auto-start on boot with PM2
sudo npm install -g pm2
pm2 start src/server.js --name coffee-tracker
pm2 save
pm2 startup
```

The Pi's local IP is your `SERVER_BASE_URL` in the ESP32 `config.h`.

---

## Security Notes

- Change the default admin password immediately
- Set `API_KEY` to a long random string in `.env` — use the same value in ESP32 `config.h`
- Set `SESSION_SECRET` to a random 32+ character string
- If exposing to the internet, put behind HTTPS (nginx + certbot)
