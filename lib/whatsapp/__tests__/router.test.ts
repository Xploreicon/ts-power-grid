import { describe, expect, it } from "vitest";
import { parseMessage } from "../router";

describe("parseMessage", () => {
  it("extracts uppercase keyword + original-case args", () => {
    expect(parseMessage("top 500")).toEqual({
      keyword: "TOP",
      args: "500",
      raw: "top 500",
    });
    expect(parseMessage("REPORT meter dead")).toEqual({
      keyword: "REPORT",
      args: "meter dead",
      raw: "REPORT meter dead",
    });
  });

  it("handles leading/trailing whitespace", () => {
    expect(parseMessage("  bal  ")).toEqual({
      keyword: "BAL",
      args: "",
      raw: "bal",
    });
  });

  it("returns null keyword for empty body", () => {
    expect(parseMessage("").keyword).toBeNull();
    expect(parseMessage("   ").keyword).toBeNull();
  });

  it("returns null keyword for message starting with digits/emoji", () => {
    expect(parseMessage("500").keyword).toBeNull();
    expect(parseMessage("🙏 hi").keyword).toBeNull();
  });

  it("preserves multi-word args verbatim", () => {
    const res = parseMessage("REPORT the meter has been off since 3pm");
    expect(res.keyword).toBe("REPORT");
    expect(res.args).toBe("the meter has been off since 3pm");
  });
});
