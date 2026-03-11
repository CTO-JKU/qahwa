/**
 * include/led_feedback.h
 * ──────────────────────────────────────────────
 *  Visual feedback via two LEDs.
 *
 *  Green (PIN_LED_GREEN):
 *    led_ready()   — solid 1 s on boot
 *    led_success() — 2 quick blinks  (coffee logged ✓)
 *
 *  Red (PIN_LED_RED):
 *    led_unknown() — 3 slow blinks   (tag not registered)
 *    led_error()   — rapid flicker   (network / server error)
 */

#pragma once
#include <Arduino.h>
#include "config.h"

inline void led_init() {
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED,   OUTPUT);
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED,   LOW);
}

inline void led_ready() {
  digitalWrite(PIN_LED_GREEN, HIGH); delay(1000);
  digitalWrite(PIN_LED_GREEN, LOW);
}

inline void led_success() {
  for (int i = 0; i < 2; i++) {
    digitalWrite(PIN_LED_GREEN, HIGH); delay(150);
    digitalWrite(PIN_LED_GREEN, LOW);  delay(150);
  }
}

inline void led_unknown() {
  for (int i = 0; i < 3; i++) {
    digitalWrite(PIN_LED_RED, HIGH); delay(400);
    digitalWrite(PIN_LED_RED, LOW);  delay(200);
  }
}

inline void led_error() {
  for (int i = 0; i < 6; i++) {
    digitalWrite(PIN_LED_RED, HIGH); delay(80);
    digitalWrite(PIN_LED_RED, LOW);  delay(80);
  }
}
