/**
 * include/rfid_reader.h
 * ──────────────────────────────────────────────
 *  Thin wrapper around the MFRC522 library.
 *  Returns the tag UID as a colon-separated hex string.
 *  e.g.  "A3:FF:02:11"
 */

#pragma once
#include <Arduino.h>
#include <SPI.h>
#include <MFRC522.h>
#include "config.h"

static MFRC522 mfrc522(PIN_RFID_SS, PIN_RFID_RST);

inline void rfid_init() {
  SPI.begin();
  mfrc522.PCD_Init();
  Serial.println("[RFID] RC522 initialised");
  mfrc522.PCD_DumpVersionToSerial();  // prints firmware version to serial
}

// Returns UID string or "" if no tag present
inline String rfid_readUID() {
  if (!mfrc522.PICC_IsNewCardPresent()) return "";
  if (!mfrc522.PICC_ReadCardSerial())   return "";

  String uid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (i > 0) uid += ":";
    if (mfrc522.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(mfrc522.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();

  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();

  return uid;
}
