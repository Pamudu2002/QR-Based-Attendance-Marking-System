import { beforeAll, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { signAccessToken, verifyAccessToken } from "./tokens";

const SECRET = "test-secret-for-tokens-test-0123456789abcdef";

beforeAll(() => {
  process.env.JWT_SECRET = SECRET;
});

describe("access tokens", () => {
  it("keeps admin and lecturer tokens apart", async () => {
    const admin = await verifyAccessToken(await signAccessToken({ sub: "a1", typ: "admin" }));
    const lecturer = await verifyAccessToken(await signAccessToken({ sub: "l1", typ: "lecturer" }));
    expect(admin).toEqual({ sub: "a1", typ: "admin" });
    expect(lecturer).toEqual({ sub: "l1", typ: "lecturer" });
  });

  it("carries the password-change flag only when set", async () => {
    const due = await verifyAccessToken(await signAccessToken({ sub: "l1", typ: "lecturer", pwc: true }));
    const done = await verifyAccessToken(await signAccessToken({ sub: "l1", typ: "lecturer", pwc: false }));
    expect(due).toEqual({ sub: "l1", typ: "lecturer", pwc: true });
    expect(done).toEqual({ sub: "l1", typ: "lecturer" });
  });

  it("rejects unknown token types", async () => {
    const forged = await new SignJWT({ typ: "superuser" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("x")
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifyAccessToken(forged)).toBeNull();
  });
});
