/**
 * include/wifi_manager.h
 * ──────────────────────────────────────────────
 *  Handles WiFi connection & reconnection.
 */

#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include "config.h"

inline void wifi_connect() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.printf("[WiFi] Connecting to %s ", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - start > WIFI_TIMEOUT_MS) {
      Serial.println("\n[WiFi] ✗ Timeout — will retry later");
      return;
    }
    delay(300);
    Serial.print(".");
  }

  Serial.printf("\n[WiFi] ✓ Connected — IP: %s\n",
                WiFi.localIP().toString().c_str());
}

inline bool wifi_isConnected() {
  return WiFi.status() == WL_CONNECTED;
}
