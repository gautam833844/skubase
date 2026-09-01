import { describe, it, expect } from "vitest";
import {
  validatePasswordPolicy,
  hashPassword,
  verifyPassword,
  verifyDummyPassword,
} from "@/lib/auth/password";

describe("Password Security & Policy", () => {
  it("rejects passwords shorter than 12 characters", () => {
    const result = validatePasswordPolicy("Short12345!");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("at least 12 characters");
  });

  it("rejects passwords longer than 128 characters", () => {
    const longPassword = "a".repeat(129);
    const result = validatePasswordPolicy(longPassword);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("cannot exceed 128 characters");
  });

  it("rejects common / weak passwords", () => {
    expect(validatePasswordPolicy("123456789012").isValid).toBe(false);
    expect(validatePasswordPolicy("password12345").isValid).toBe(false);
    expect(validatePasswordPolicy("skubaseskubase").isValid).toBe(false);
  });

  it("rejects single repeating characters", () => {
    const result = validatePasswordPolicy("zzzzzzzzzzzz");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("single repeating character");
  });

  it("accepts valid passphrases >= 12 characters without arbitrary composition rules", () => {
    const result1 = validatePasswordPolicy("mrf tyre shop 2026");
    const result2 = validatePasswordPolicy("yellow truck tire safe");
    const result3 = validatePasswordPolicy("businessownerpassphrase");

    expect(result1.isValid).toBe(true);
    expect(result2.isValid).toBe(true);
    expect(result3.isValid).toBe(true);
  });

  it("hashes passwords with Argon2id and verifies correctly", async () => {
    const rawPassword = "correct tyre password 1234";
    const passwordHash = await hashPassword(rawPassword);

    expect(passwordHash).toMatch(/^\$argon2id\$/);

    const isMatch = await verifyPassword(passwordHash, rawPassword);
    expect(isMatch).toBe(true);

    const isWrong = await verifyPassword(passwordHash, "wrong password attempt 1234");
    expect(isWrong).toBe(false);
  });

  it("dummy password verification returns false", async () => {
    const result = await verifyDummyPassword();
    expect(result).toBe(false);
  });
});
