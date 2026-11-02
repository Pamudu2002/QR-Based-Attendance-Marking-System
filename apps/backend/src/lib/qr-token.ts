// Rotating QR tokens (docs/PLAN.md §6.2–6.3). Server-only: uses the HMAC secrets.
//
//   token = base64url( id(16) | seq(4) | HMAC-SHA256(secret, purpose | id | seq)[0..16] )  → 48 chars
//   QR    = "QA1:R:<token>" (registration) or "QA1:C:<token>" (check-in)
//
// Tokens are computed from the time, so nothing is stored:
//   seq = floor((now − startedAt) / T),  issuedAt = startedAt + seq × T
import { createHmac, timingSafeEqual } from "node:crypto";

export type Purpose = "R" | "C";
export const QR_PREFIX: Record<Purpose, string> = { R: "QA1:R:", C: "QA1:C:" };
export const GRACE_SEC = 2;

const ID_BYTES = 16;
const SEQ_BYTES = 4;
const MAC_BYTES = 16;
const TOKEN_BYTES = ID_BYTES + SEQ_BYTES + MAC_BYTES;
const CUID_RE = /^c[0-9a-z]{24}$/;

/** A Prisma cuid ("c" + 24 base-36 chars, < 2^125) packed into 16 bytes. */
export function idToBytes(id: string): Buffer {
  if (!CUID_RE.test(id)) throw new Error(`Not a cuid: ${id}`);
  let n = 0n;
  for (const ch of id.slice(1)) n = n * 36n + BigInt(parseInt(ch, 36));
  return Buffer.from(n.toString(16).padStart(ID_BYTES * 2, "0"), "hex");
}

export function bytesToId(bytes: Buffer): string {
  const n = BigInt(`0x${bytes.toString("hex")}`);
  return `c${n.toString(36).padStart(24, "0")}`;
}

function mac(secret: string, purpose: Purpose, id: Buffer, seq: Buffer): Buffer {
  return createHmac("sha256", secret)
    .update(Buffer.from(purpose, "ascii"))
    .update(id)
    .update(seq)
    .digest()
    .subarray(0, MAC_BYTES);
}

function seqBytes(seq: number): Buffer {
  const b = Buffer.alloc(SEQ_BYTES);
  b.writeUInt32BE(seq);
  return b;
}

export function makeToken(purpose: Purpose, id: string, seq: number, secret: string): string {
  const idB = idToBytes(id);
  const seqB = seqBytes(seq);
  return Buffer.concat([idB, seqB, mac(secret, purpose, idB, seqB)]).toString("base64url");
}

/** Accepts the bare token or the full QR text with the expected prefix. */
export function stripPrefix(purpose: Purpose, text: string): string {
  const t = text.trim();
  return t.startsWith(QR_PREFIX[purpose]) ? t.slice(QR_PREFIX[purpose].length) : t;
}

/** Reads id and seq without checking the MAC (the secret depends on the id). */
export function readToken(token: string): { id: string; seq: number } | null {
  if (!/^[A-Za-z0-9_-]{48}$/.test(token)) return null;
  const b = Buffer.from(token, "base64url");
  if (b.length !== TOKEN_BYTES) return null;
  const id = bytesToId(b.subarray(0, ID_BYTES));
  if (!CUID_RE.test(id)) return null;
  return { id, seq: b.readUInt32BE(ID_BYTES) };
}

export function macValid(purpose: Purpose, token: string, secret: string): boolean {
  const b = Buffer.from(token, "base64url");
  if (b.length !== TOKEN_BYTES) return false;
  const expected = mac(secret, purpose, b.subarray(0, ID_BYTES), b.subarray(ID_BYTES, ID_BYTES + SEQ_BYTES));
  return timingSafeEqual(expected, b.subarray(ID_BYTES + SEQ_BYTES));
}

export type Clock = { startedAtMs: number; intervalSec: number };

export function seqAt(clock: Clock, nowMs: number): number {
  return Math.floor((nowMs - clock.startedAtMs) / (clock.intervalSec * 1000));
}

export function issuedAtMs(clock: Clock, seq: number): number {
  return clock.startedAtMs + seq * clock.intervalSec * 1000;
}

export type TokenCheck =
  | { ok: true; seq: number; issuedAt: Date; tokenAgeMs: number }
  | { ok: false; verdict: "BAD_TOKEN" | "EXPIRED"; seq?: number; issuedAt?: Date; tokenAgeMs?: number };

/**
 * The accept rule, on the server clock only: valid HMAC and
 * tokenAge = receivedAt − issuedAt ≤ (T + grace) × 1000.
 */
export function checkToken(
  purpose: Purpose,
  token: string,
  secret: string,
  clock: Clock,
  receivedAtMs: number,
  graceSec = GRACE_SEC,
): TokenCheck {
  const parsed = readToken(token);
  if (!parsed || !macValid(purpose, token, secret)) return { ok: false, verdict: "BAD_TOKEN" };
  const issued = issuedAtMs(clock, parsed.seq);
  const tokenAgeMs = receivedAtMs - issued;
  const issuedAt = new Date(issued);
  // A code from the future can't come from the projector.
  if (parsed.seq > seqAt(clock, receivedAtMs)) return { ok: false, verdict: "BAD_TOKEN", seq: parsed.seq };
  if (tokenAgeMs > (clock.intervalSec + graceSec) * 1000) {
    return { ok: false, verdict: "EXPIRED", seq: parsed.seq, issuedAt, tokenAgeMs };
  }
  return { ok: true, seq: parsed.seq, issuedAt, tokenAgeMs };
}

/** What the projector page shows right now. */
export function currentToken(purpose: Purpose, id: string, secret: string, clock: Clock, nowMs: number) {
  const seq = seqAt(clock, nowMs);
  const issued = issuedAtMs(clock, seq);
  const token = makeToken(purpose, id, seq, secret);
  return {
    payload: QR_PREFIX[purpose] + token,
    seq,
    issuedAt: new Date(issued).toISOString(),
    nextAt: new Date(issued + clock.intervalSec * 1000).toISOString(),
    intervalSec: clock.intervalSec,
    serverTime: new Date(nowMs).toISOString(),
  };
}
