import { describe, expect, it } from "vitest";
import { isValidIndex, moduleDisplayName, nameKey, namesMatch, normaliseIndex, normaliseIntake, normaliseSemester } from "./identity";

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

describe("intake and semester", () => {
  it("adds the In and S prefixes to the numbers the lecturer types", () => {
    expect(normaliseIntake("22")).toBe("In22");
    expect(normaliseIntake(" in22 ")).toBe("In22");
    expect(normaliseIntake("In22")).toBe("In22");
    expect(normaliseSemester("7")).toBe("S7");
    expect(normaliseSemester("s7")).toBe("S7");
    expect(normaliseSemester("S10")).toBe("S10");
  });

  it("rejects anything that isn't a number", () => {
    expect(normaliseIntake("")).toBeNull();
    expect(normaliseIntake("In")).toBeNull();
    expect(normaliseIntake("Intake 22")).toBeNull();
    expect(normaliseIntake("2022a")).toBeNull();
    expect(normaliseIntake("2")).toBeNull();
    expect(normaliseIntake("229")).toBeNull();
    expect(normaliseSemester("Sem 7")).toBeNull();
    expect(normaliseSemester("123")).toBeNull();
  });
});
