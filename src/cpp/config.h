/**
 * include/config.h
 * ─────────────────────────────────────────────
 *  ALL user-configurable settings live here.
 *  Edit this file before flashing.
 * ─────────────────────────────────────────────
 */

#pragma once

// ── WiFi ────────────────────────────────────
#define WIFI_SSID        "YourNetworkName"
#define WIFI_PASSWORD    "YourNetworkPassword"
#define WIFI_TIMEOUT_MS  15000          // 15 s connect timeout

// ── Server ──────────────────────────────────
//  Local network example: "http://192.168.1.50:3000"
//  Domain example:        "https://coffee.yourcompany.com"
#define SERVER_BASE_URL  "http://192.168.1.50:3000"
#define API_ENDPOINT     "/api/coffee"

//  Shared secret — must match the server's expected key
#define API_KEY          "change-me-to-a-long-random-string"

// ── Machine identity ────────────────────────
//  Identifies which physical machine logged the scan.
//  Useful if you deploy multiple ESP32 units later.
#define DEVICE_ID        "machine_floor1"

// ── Timing ──────────────────────────────────
#define COOLDOWN_MS      3000   // ms before the same tag can fire again
#define WIFI_RETRY_MS   10000   // ms between WiFi reconnect attempts

// ── Hardware pins ───────────────────────────
#define PIN_LED_GREEN    25
#define PIN_LED_RED      26

// RC522 SPI pins
#define PIN_RFID_SS       5
#define PIN_RFID_RST      4
// SCK=18  MOSI=23  MISO=19  → ESP32 default VSPI, no extra defines needed
