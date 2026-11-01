import { describe, expect, it } from "vitest";
import { isValidIndex, moduleDisplayName, nameKey, namesMatch, normaliseIndex } from "./identity";

describe("names", () => {
  it("ignores case, spaces and punctuation", () => {
    expect(nameKey("Lokuhewa P. C.")).toBe("LOKUHEWAPC");
    expect(namesMatch("Lokuhewa P. C.", "LOKUHEWA P.C.")).toBe(true);
    expect(namesMatch("Lokuhewa P. C.", "lokuhewa pc")).toBe(true);
    expect(namesMatch("Lokuhewa P. C.", "Lokuhewa P.")).toBe(false);
  });
});

describe("index numbers", () => {
  it("upper-cases and validates", () => {
    expect(normaliseIndex(" 220366x ")).toBe("220366X");
    expect(isValidIndex("220366x")).toBe(true);
    expect(isValidIndex("22O366X")).toBe(false);
    expect(isValidIndex("2203660")).toBe(false);
  });
});

describe("module display name", () => {
  it("matches the Moodle style", () => {
    expect(moduleDisplayName({ intake: "In22", semester: "S7", code: "CS4473", name: "Mobile Computing" })).toBe(
      "In22-S7-CS4473 - Mobile Computing",
    );
  });
});
