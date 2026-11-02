import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseDevicePublicKey, signedMessage, verifyDeviceSignature } from "./device-crypto";

// Same formats as the Android Keystore: SPKI DER public key, SHA256withECDSA DER signature.
const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const spki = publicKey.export({ format: "der", type: "spki" }).toString("base64");
const signB64 = (msg: string) => sign("sha256", Buffer.from(msg, "utf8"), { key: privateKey, dsaEncoding: "der" }).toString("base64");

describe("device signatures", () => {
  it("builds the signed messages", () => {
    expect(signedMessage.registration("TOKEN", "dev1", "220366X")).toBe("QRv1-REG|TOKEN|dev1|220366X");
    expect(signedMessage.login("dev1", "n")).toBe("QRv1-LOGIN|dev1|n");
    expect(signedMessage.checkin("TOKEN", "dev1", "a1")).toBe("QRv1-CHK|TOKEN|dev1|a1");
  });

  it("verifies a Keystore-style signature", () => {
    const msg = signedMessage.registration("TOKEN", "dev1", "220366X");
    expect(verifyDeviceSignature(spki, msg, signB64(msg))).toBe(true);
    expect(verifyDeviceSignature(spki, msg + "x", signB64(msg))).toBe(false);
    expect(verifyDeviceSignature(spki, msg, "garbage")).toBe(false);
  });

  it("only accepts P-256 keys", () => {
    expect(parseDevicePublicKey(spki)).not.toBeNull();
    const other = generateKeyPairSync("ec", { namedCurve: "secp384r1" }).publicKey.export({ format: "der", type: "spki" });
    expect(parseDevicePublicKey(other.toString("base64"))).toBeNull();
    expect(parseDevicePublicKey("bm90IGEga2V5")).toBeNull();
  });
});
