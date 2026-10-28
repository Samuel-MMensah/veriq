import { describe, expect, it } from "vitest";
import { phoneSourceText, telHref } from "./phone";

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

describe("phoneSourceText (rule 4 beside a Call button)", () => {
  it("names a Veriq call with its day, or the NHIA list; nothing for a demo number or no number", () => {
    expect(phoneSourceText({ phone: "0302541234", phone_source: "veriq_call", phone_checked_at: "2026-10-28T10:05:00Z" })).toBe("Veriq call, 28 Oct 2026");
    expect(phoneSourceText({ phone: "0302541234", phone_source: "nhia", phone_checked_at: null })).toBe("NHIA list");
    expect(phoneSourceText({ phone: "+233 000 000 001", phone_source: null, phone_checked_at: null })).toBeNull();
    expect(phoneSourceText({ phone: null, phone_source: "veriq_call", phone_checked_at: "2026-10-28T10:05:00Z" })).toBeNull();
  });
});
