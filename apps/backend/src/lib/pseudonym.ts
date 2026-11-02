import "server-only";
import { createHmac } from "node:crypto";

/**
 * Stable pseudonyms for the experiment export (PLAN §9.6): the same device or
 * student always gets the same code, but the code can't be turned back into
 * the id without the server's key. Names and index numbers never appear.
 */
export function pseudonym(kind: "device" | "student", id: string | null | undefined): string {
  if (!id) return "";
  const key = process.env.EXPORT_PSEUDONYM_KEY || process.env.JWT_SECRET;
  if (!key) throw new Error("Missing environment variable EXPORT_PSEUDONYM_KEY or JWT_SECRET");
  return `${kind[0]}_${createHmac("sha256", key).update(`${kind}:${id}`).digest("hex").slice(0, 12)}`;
}
