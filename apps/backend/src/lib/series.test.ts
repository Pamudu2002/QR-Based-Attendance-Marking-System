import { describe, expect, it } from "vitest";
import { expandWeekly, nthTitle } from "./series";

describe("weekly repeat", () => {
  it("numbers the titles", () => {
    expect(nthTitle("Lecture 10", 0)).toBe("Lecture 10");
    expect(nthTitle("Lecture 10", 3)).toBe("Lecture 13");
    expect(nthTitle("Lab", 2)).toBe("Lab");
  });

  it("adds whole weeks", () => {
    const first = { title: "Lecture 9", startsAt: new Date("2026-11-03T04:45:00Z"), endsAt: new Date("2026-11-03T06:45:00Z") };
    const all = expandWeekly(first, 3);
    expect(all.map((s) => [s.title, s.startsAt.toISOString()])).toEqual([
      ["Lecture 9", "2026-11-03T04:45:00.000Z"],
      ["Lecture 10", "2026-11-10T04:45:00.000Z"],
      ["Lecture 11", "2026-11-17T04:45:00.000Z"],
    ]);
  });
});
