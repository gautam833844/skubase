import { describe, it, expect } from "vitest";
import {
  generateRawSessionToken,
  hashSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
  DEFAULT_SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/session";

describe("Session Token & Cookie Security", () => {
  it("generates 256-bit (64 hex char) random raw session tokens", () => {
    const token1 = generateRawSessionToken();
    const token2 = generateRawSessionToken();

    expect(token1).toHaveLength(64);
    expect(token2).toHaveLength(64);
    expect(token1).not.toBe(token2);
    expect(/^[0-9a-f]{64}$/.test(token1)).toBe(true);
  });

  it("hashes raw tokens with deterministic SHA-256", () => {
    const rawToken = "test_raw_token_string_value_1234567890abcdef";
    const hash1 = hashSessionToken(rawToken);
    const hash2 = hashSessionToken(rawToken);

    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(rawToken);
  });

  it("generates secure cookie options matching security specifications", () => {
    const rawToken = generateRawSessionToken();
    const options = getSessionCookieOptions(rawToken);

    expect(options.name).toBe(SESSION_COOKIE_NAME);
    expect(options.value).toBe(rawToken);
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
    expect(options.maxAge).toBe(DEFAULT_SESSION_MAX_AGE_SECONDS);
  });

  it("generates clearing cookie options with maxAge 0 and empty value", () => {
    const clearOptions = getSessionCookieOptions("");

    expect(clearOptions.value).toBe("");
    expect(clearOptions.maxAge).toBe(0);
    expect(clearOptions.httpOnly).toBe(true);
  });
});
