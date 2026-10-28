import { describe, expect, it } from "vitest";
import { telHref } from "./phone";

describe("telHref (insurer Call button)", () => {
  it("links a real Ghana number, spaces removed", () => {
    expect(telHref("+233 30 222 1234")).toBe("tel:+233302221234");
    expect(telHref("030 222 1234")).toBe("tel:0302221234");
  });
  it("hides demo placeholders and missing numbers", () => {
    expect(telHref("+233 000 000 001")).toBeNull();
    expect(telHref(null)).toBeNull();
    expect(telHref("")).toBeNull();
    expect(telHref("call reception")).toBeNull();
  });
});
