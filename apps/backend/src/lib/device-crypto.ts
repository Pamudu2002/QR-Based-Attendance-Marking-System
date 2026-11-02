// Device keys: EC P-256 from the Android Keystore, SHA256withECDSA, DER signatures.
// Public keys arrive as X.509 SubjectPublicKeyInfo DER, base64.
import { createPublicKey, verify, type KeyObject } from "node:crypto";

/** Signed messages. Parts are joined with "|" and signed as UTF-8. */
export const signedMessage = {
  login: (deviceId: string, nonce: string) => ["QRv1-LOGIN", deviceId, nonce].join("|"),
  registration: (token: string, deviceId: string, indexNumber: string) => ["QRv1-REG", token, deviceId, indexNumber].join("|"),
  checkin: (token: string, deviceId: string, attemptId: string) => ["QRv1-CHK", token, deviceId, attemptId].join("|"),
  // Beacon phone (CSE Attendance Beacon): its key has no user auth, it runs unattended.
  beaconLink: (code: string) => ["QRv1-BEACON-LINK", code].join("|"),
  beaconLogin: (beaconId: string, nonce: string) => ["QRv1-BEACON-LOGIN", beaconId, nonce].join("|"),
};

function decodeBase64(b64: string): Buffer {
  // Accept standard and URL-safe base64, with or without padding or line breaks.
  return Buffer.from(b64.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/** Parses a base64 SPKI DER key and checks that it's EC P-256. Returns null if not. */
export function parseDevicePublicKey(spkiBase64: string): KeyObject | null {
  try {
    const key = createPublicKey({ key: decodeBase64(spkiBase64), format: "der", type: "spki" });
    if (key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1") return null;
    return key;
  } catch {
    return null;
  }
}

/** Verifies a base64 DER ECDSA signature over the UTF-8 message. */
export function verifyDeviceSignature(spkiBase64: string, message: string, signatureBase64: string): boolean {
  const key = parseDevicePublicKey(spkiBase64);
  if (!key) return false;
  try {
    return verify("sha256", Buffer.from(message, "utf8"), { key, dsaEncoding: "der" }, decodeBase64(signatureBase64));
  } catch {
    return false;
  }
}
