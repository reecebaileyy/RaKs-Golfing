import { describe, expect, it } from "vitest";
import { formatPhone, maskContact, normalizeEmail, normalizePhone, parseContact } from "../contact";

describe("normalizePhone", () => {
  it("reads 10 digit US numbers in any common format", () => {
    for (const raw of ["7145551234", "(714) 555-1234", "714.555.1234", "714 555 1234", "1-714-555-1234", "+1 714 555 1234"]) {
      expect(normalizePhone(raw)).toBe("+17145551234");
    }
  });

  it("keeps international numbers given with a plus", () => {
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
  });

  it("rejects numbers that can't be real", () => {
    for (const raw of ["", "555-1234", "123", "0145551234", "(114) 555-1234", "714 055 1234", "+0 714 555 1234", "call me", "+1234567890123456"]) {
      expect(normalizePhone(raw)).toBeNull();
    }
  });
});

describe("normalizeEmail", () => {
  it("lower-cases and trims", () => expect(normalizeEmail("  Maya@Example.COM ")).toBe("maya@example.com"));
  it("rejects non-emails", () => {
    expect(normalizeEmail("maya@")).toBeNull();
    expect(normalizeEmail("maya example.com")).toBeNull();
  });
});

describe("parseContact", () => {
  it("tells emails from phones", () => {
    expect(parseContact("sam@example.com")).toEqual({ kind: "email", value: "sam@example.com" });
    expect(parseContact("(714) 555-1234")).toEqual({ kind: "phone", value: "+17145551234" });
    expect(parseContact("sam@")).toBeNull();
    expect(parseContact("12")).toBeNull();
  });
});

describe("display", () => {
  it("masks contacts", () => {
    expect(maskContact("email", "reece@example.com")).toBe("r•••@example.com");
    expect(maskContact("phone", "+17145551234")).toBe("•••• 1234");
  });

  it("formats US phones and leaves others alone", () => {
    expect(formatPhone("+17145551234")).toBe("(714) 555-1234");
    expect(formatPhone("+442079460958")).toBe("+442079460958");
  });
});
