/**
 * src/main.cpp
 * ============================================================
 *  Coffee Tracker — ESP32 Firmware (PlatformIO)
 *
 *  Hardware:
 *    ESP32 Dev Board + RC522 RFID reader
 *    Green LED → GPIO 25  |  Red LED → GPIO 26
 *
 *  RC522 Wiring:
 *    SDA(SS)=5  SCK=18  MOSI=23  MISO=19  RST=4  3.3V  GND
 *
 *  Flow:
 *    Boot → WiFi → poll RFID → POST /api/coffee → LED feedback
 * ============================================================
 */

#include <Arduino.h>
#include "config.h"
#include "wifi_manager.h"
#include "rfid_reader.h"
#include "http_client.h"
#include "led_feedback.h"

static String        lastUID   = "";
static unsigned long lastScan  = 0;

// ────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial.println("\n=== Coffee Tracker Boot ===");

  led_init();
  rfid_init();
  wifi_connect();

  Serial.println("Ready — waiting for RFID tag...");
  led_ready();
}

// ────────────────────────────────────────────────────────────
void loop() {
  // ── Keep WiFi alive ─────────────────────────
  if (!wifi_isConnected()) {
    static unsigned long lastRetry = 0;
    if (millis() - lastRetry > WIFI_RETRY_MS) {
      lastRetry = millis();
      Serial.println("[WiFi] Lost connection — reconnecting...");
      wifi_connect();
    }
    delay(100);
    return;
  }

  // ── Poll RFID ───────────────────────────────
  String uid = rfid_readUID();
  if (uid.isEmpty()) return;

  // Debounce: ignore the same tag held in place
  unsigned long now = millis();
  if (uid == lastUID && (now - lastScan) < COOLDOWN_MS) return;
  lastUID  = uid;
  lastScan = now;

  Serial.printf("[RFID] Tag: %s\n", uid.c_str());

  // ── POST to server ──────────────────────────
  int code = http_postCoffee(uid);

  if (code == 200 || code == 201) {
    Serial.println("[OK]  Coffee logged ✓");
    led_success();
  } else if (code == 404) {
    Serial.println("[??]  Tag not registered");
    led_unknown();
  } else {
    Serial.printf("[ERR] Server returned %d\n", code);
    led_error();
  }
}
