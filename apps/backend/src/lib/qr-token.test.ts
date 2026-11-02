import { describe, expect, it } from "vitest";
import { bytesToId, checkToken, currentToken, idToBytes, makeToken, readToken, stripPrefix } from "./qr-token";

const ID = "cmvy2wq1c0002487crchyuu2k";
const SECRET = "test-secret";
const clock = { startedAtMs: Date.UTC(2026, 10, 1), intervalSec: 10 };

describe("ids", () => {
  it("packs a cuid into 16 bytes and back", () => {
    expect(idToBytes(ID)).toHaveLength(16);
    expect(bytesToId(idToBytes(ID))).toBe(ID);
    expect(bytesToId(idToBytes("c000000000000000000000000"))).toBe("c000000000000000000000000");
    expect(bytesToId(idToBytes("czzzzzzzzzzzzzzzzzzzzzzzz"))).toBe("czzzzzzzzzzzzzzzzzzzzzzzz");
  });
});

describe("tokens", () => {
  it("are 48 characters and carry id and seq", () => {
    const t = makeToken("R", ID, 42, SECRET);
    expect(t).toMatch(/^[A-Za-z0-9_-]{48}$/);
    expect(readToken(t)).toEqual({ id: ID, seq: 42 });
    expect(stripPrefix("R", `QA1:R:${t}`)).toBe(t);
  });

  it("applies the accept rule on the server clock", () => {
    const seq = 5;
    const issued = clock.startedAtMs + seq * 10_000;
    const t = makeToken("C", ID, seq, SECRET);
    expect(checkToken("C", t, SECRET, clock, issued + 3_000)).toMatchObject({ ok: true, seq, tokenAgeMs: 3_000 });
    // T + grace = 12 s is still accepted; one ms later is not.
    expect(checkToken("C", t, SECRET, clock, issued + 12_000).ok).toBe(true);
    expect(checkToken("C", t, SECRET, clock, issued + 12_001)).toMatchObject({ ok: false, verdict: "EXPIRED", tokenAgeMs: 12_001 });
  });

  it("rejects a wrong secret, the other purpose, tampering and future codes", () => {
    const issued = clock.startedAtMs + 5 * 10_000;
    const t = makeToken("C", ID, 5, SECRET);
    expect(checkToken("C", t, "other", clock, issued)).toMatchObject({ verdict: "BAD_TOKEN" });
    expect(checkToken("R", t, SECRET, clock, issued)).toMatchObject({ verdict: "BAD_TOKEN" });
    const tampered = (t[0] === "A" ? "B" : "A") + t.slice(1);
    expect(checkToken("C", tampered, SECRET, clock, issued)).toMatchObject({ verdict: "BAD_TOKEN" });
    expect(checkToken("C", makeToken("C", ID, 6, SECRET), SECRET, clock, issued)).toMatchObject({ verdict: "BAD_TOKEN" });
    expect(checkToken("C", "not-a-token", SECRET, clock, issued)).toMatchObject({ verdict: "BAD_TOKEN" });
  });

  it("gives the projector the current code", () => {
    const now = clock.startedAtMs + 123_456;
    const cur = currentToken("R", ID, SECRET, clock, now);
    expect(cur.seq).toBe(12);
    expect(cur.payload.startsWith("QA1:R:")).toBe(true);
    expect(cur.nextAt).toBe(new Date(clock.startedAtMs + 130_000).toISOString());
  });
});
