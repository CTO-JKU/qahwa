/**
 * include/http_client.h
 * ──────────────────────────────────────────────
 *  Sends a POST request to the backend on every scan.
 *
 *  Request:
 *    POST <SERVER_BASE_URL>/api/coffee
 *    x-api-key: <API_KEY>
 *    Content-Type: application/json
 *    { "rfid_uid": "A3:FF:02:11", "device_id": "machine_floor1" }
 *
 *  Expected responses:
 *    201 / 200  → logged OK
 *    404        → UID not registered
 *    401        → bad API key
 *    5xx        → server error
 */

#pragma once
#include <Arduino.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "config.h"

inline int http_postCoffee(const String& uid) {
  HTTPClient http;

  String url = String(SERVER_BASE_URL) + String(API_ENDPOINT);
  Serial.printf("[HTTP] POST %s  uid=%s\n", url.c_str(), uid.c_str());

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key",    API_KEY);
  http.setTimeout(8000);

  // Build JSON body
  JsonDocument doc;
  doc["rfid_uid"]  = uid;
  doc["device_id"] = DEVICE_ID;

  String body;
  serializeJson(doc, body);

  int code = http.POST(body);

  if (code < 0) {
    Serial.printf("[HTTP] Failed: %s\n",
                  HTTPClient::errorToString(code).c_str());
  } else {
    Serial.printf("[HTTP] %d — %s\n", code, http.getString().c_str());
  }

  http.end();
  return code;
}
