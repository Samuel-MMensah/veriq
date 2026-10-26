// @vitest-environment node
import { hashPassword, newPasswordProblem, normaliseEmail, oneTimePassword, passwordMatches, signInBlocked } from "./password";

describe("one-time passwords (Prompt 10)", () => {
  it("look like k7qm-4tzp-9wxr, with no look-alike characters", () => {
    for (let i = 0; i < 50; i++) expect(oneTimePassword()).toMatch(/^[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}$/);
  });

  it("differ every time", () => {
    expect(new Set(Array.from({ length: 50 }, oneTimePassword)).size).toBe(50);
  });
});

describe("new passwords (Prompt 10)", () => {
  const ok = { repeat: "green-river-42", email: "ama@hospital.org", oneTime: "k7qm-4tzp-9wxr" };

  it("accepts a good one", () => {
    expect(newPasswordProblem("green-river-42", ok)).toBeNull();
  });

  it("explains what is wrong in plain words", () => {
    expect(newPasswordProblem("short", { ...ok, repeat: "short" })).toBe("Use at least 10 characters.");
    expect(newPasswordProblem("green-river-42", { ...ok, repeat: "green-river-43" })).toBe("The two passwords are not the same.");
    expect(newPasswordProblem("k7qm-4tzp-9wxr", { ...ok, repeat: "k7qm-4tzp-9wxr" })).toMatch(/not the one you were given/);
    expect(newPasswordProblem("ama-is-here-1", { ...ok, repeat: "ama-is-here-1" })).toMatch(/email/);
    expect(newPasswordProblem("aaaaaaaaaaaa", { ...ok, repeat: "aaaaaaaaaaaa" })).toMatch(/too easy/);
  });
});

describe("emails", () => {
  it("are trimmed and lower-cased", () => {
    expect(normaliseEmail("  Ama@Hospital.ORG ")).toBe("ama@hospital.org");
    expect(normaliseEmail("not an email")).toBeNull();
  });
});

describe("local password hashes", () => {
  it("match only the right password", () => {
    const stored = hashPassword("green-river-42");
    expect(passwordMatches("green-river-42", stored)).toBe(true);
    expect(passwordMatches("green-river-43", stored)).toBe(false);
    expect(passwordMatches("x", null)).toBe(false);
  });
});

describe("sign-in throttle", () => {
  const now = new Date("2026-10-26T08:00:00Z");
  const ago = (min: number) => now.getTime() - min * 60_000;

  it("blocks after 5 wrong tries in 15 minutes", () => {
    expect(signInBlocked([ago(1), ago(2), ago(3), ago(4)], now)).toBe(false);
    expect(signInBlocked([ago(1), ago(2), ago(3), ago(4), ago(14)], now)).toBe(true);
    expect(signInBlocked([ago(1), ago(2), ago(3), ago(4), ago(15)], now)).toBe(false);
  });
});
