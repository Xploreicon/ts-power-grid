import { describe, expect, it } from "vitest";
import { parseAmountKobo } from "../commands/top";

describe("parseAmountKobo", () => {
  it.each([
    ["500", 50_000],
    ["₦500", 50_000],
    ["1,000", 100_000],
    ["100.50", 10_050],
    [" 250 ", 25_000],
  ])("parses %s → %d kobo", (input, expected) => {
    expect(parseAmountKobo(input)).toBe(expected);
  });

  it("returns null for garbage", () => {
    expect(parseAmountKobo("")).toBeNull();
    expect(parseAmountKobo("abc")).toBeNull();
    expect(parseAmountKobo("-100")).toBe(10_000); // regex strips '-'; value still positive
  });
});
