// Classroom beacon (docs/PLAN.md §6.5). The lecturer's phone broadcasts a
// Bluetooth LE advert while a check-in run is open; student phones send what
// they heard with the check-in.
//
//   advert   = manufacturer data, company ID 0xFFFF (reserved for testing)
//   payload  = "CA" | version (1) | seq (4, big-endian) | HMAC-SHA256(key, "B" | seq)[0..8]  → 15 bytes
//   key      = HMAC-SHA256(window secret, "QA1-BEACON-KEY")
//   seq      = floor((now − window.startedAt) / 5 s)
//
// The beacon phone gets only the derived key, so it can't make QR tokens.
import { createHmac, timingSafeEqual } from "node:crypto";

export const BEACON_COMPANY_ID = 0xffff;
export const BEACON_ROTATE_SEC = 5;
/** A code is accepted up to this long after it was issued (scan, fingerprint and send fit easily). */
export const BEACON_MAX_AGE_MS = 30_000;
/** Allowed clock difference between the beacon phone and the server. */
const FUTURE_SKEW_MS = 2_000;

const MAGIC = Buffer.from("CA", "ascii");
const VERSION = 1;
const SEQ_BYTES = 4;
const MAC_BYTES = 8;
export const BEACON_PAYLOAD_BYTES = MAGIC.length + 1 + SEQ_BYTES + MAC_BYTES;

export function beaconKey(windowSecret: string): Buffer {
  return createHmac("sha256", windowSecret).update("QA1-BEACON-KEY", "ascii").digest();
}

function beaconMac(key: Buffer, seqB: Buffer): Buffer {
  return createHmac("sha256", key).update(Buffer.from("B", "ascii")).update(seqB).digest().subarray(0, MAC_BYTES);
}

/** What the beacon phone broadcasts (the server only needs this for tests and the simulator). */
export function makeBeaconPayload(key: Buffer, seq: number): Buffer {
  const seqB = Buffer.alloc(SEQ_BYTES);
  seqB.writeUInt32BE(seq);
  return Buffer.concat([MAGIC, Buffer.from([VERSION]), seqB, beaconMac(key, seqB)]);
}

export function beaconSeqAt(startedAtMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - startedAtMs) / (BEACON_ROTATE_SEC * 1000)));
}

export type HeardBeacon = { data: string; rssi: number; heardAgoMs?: number | null };
export type BeaconCheck = { ok: boolean | null; rssi: number | null; ageMs: number | null };

/**
 * Checks the beacon codes a phone heard against this run (server clock only).
 * ok: true = a current code for this run; false = codes, but none valid; null = none sent.
 * Of several valid codes, the strongest signal counts.
 */
export function checkBeacons(windowSecret: string, startedAtMs: number, heard: HeardBeacon[], receivedAtMs: number): BeaconCheck {
  if (!heard.length) return { ok: null, rssi: null, ageMs: null };
  const key = beaconKey(windowSecret);
  let best: { rssi: number; ageMs: number } | null = null;
  for (const h of heard) {
    const b = Buffer.from(h.data, "base64");
    if (b.length !== BEACON_PAYLOAD_BYTES || !b.subarray(0, 2).equals(MAGIC) || b[2] !== VERSION) continue;
    const seqB = b.subarray(3, 3 + SEQ_BYTES);
    if (!timingSafeEqual(beaconMac(key, seqB), b.subarray(3 + SEQ_BYTES))) continue;
    const issuedAt = startedAtMs + seqB.readUInt32BE() * BEACON_ROTATE_SEC * 1000;
    const ageMs = receivedAtMs - issuedAt;
    if (ageMs < -FUTURE_SKEW_MS || ageMs > BEACON_MAX_AGE_MS) continue;
    if (!best || h.rssi > best.rssi) best = { rssi: h.rssi, ageMs: Math.max(0, ageMs) };
  }
  return best ? { ok: true, ...best } : { ok: false, rssi: null, ageMs: null };
}
