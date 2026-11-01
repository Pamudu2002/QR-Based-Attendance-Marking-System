import { describe, expect, it } from "vitest";
import { addDays, formatTime, utcToZoned, weekday, zonedToUtc } from "./time";

describe("Asia/Colombo times", () => {
  it("converts local class times to UTC and back", () => {
    const d = zonedToUtc("2026-11-10", "10:15");
    expect(d.toISOString()).toBe("2026-11-10T04:45:00.000Z");
    expect(utcToZoned(d)).toEqual({ date: "2026-11-10", time: "10:15" });
    expect(formatTime(d)).toBe("10:15");
  });

  it("handles times near midnight", () => {
    expect(zonedToUtc("2026-11-10", "02:00").toISOString()).toBe("2026-11-09T20:30:00.000Z");
  });

  it("does date arithmetic on calendar days", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(weekday("2026-11-01")).toBe(0);
  });
});
