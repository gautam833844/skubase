import { describe, it, expect } from "vitest";
import { validateRequestOrigin, isSafeRedirectUrl } from "@/lib/auth/csrf";

describe("CSRF & Open Redirect Protection", () => {
  describe("validateRequestOrigin", () => {
    it("accepts requests matching host header", () => {
      const request = new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: {
          host: "localhost:3000",
          origin: "http://localhost:3000",
        },
      });

      expect(validateRequestOrigin(request)).toBe(true);
    });

    it("rejects cross-origin requests from untrusted origins", () => {
      const request = new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: {
          host: "localhost:3000",
          origin: "https://malicious-site.com",
        },
      });

      expect(validateRequestOrigin(request)).toBe(false);
    });

    it("accepts requests matching referer host", () => {
      const request = new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: {
          host: "localhost:3000",
          referer: "http://localhost:3000/login",
        },
      });

      expect(validateRequestOrigin(request)).toBe(true);
    });
  });

  describe("isSafeRedirectUrl", () => {
    it("accepts safe relative paths", () => {
      expect(isSafeRedirectUrl("/")).toBe(true);
      expect(isSafeRedirectUrl("/dashboard")).toBe(true);
      expect(isSafeRedirectUrl("/inventory")).toBe(true);
      expect(isSafeRedirectUrl("/sales?orderId=123")).toBe(true);
    });

    it("rejects external absolute URLs", () => {
      expect(isSafeRedirectUrl("https://evil.com")).toBe(false);
      expect(isSafeRedirectUrl("http://attacker.com/login")).toBe(false);
    });

    it("rejects protocol-relative URLs", () => {
      expect(isSafeRedirectUrl("//evil.com")).toBe(false);
      expect(isSafeRedirectUrl("/\\evil.com")).toBe(false);
    });

    it("rejects javascript: and data: URIs", () => {
      expect(isSafeRedirectUrl("javascript:alert(1)")).toBe(false);
      expect(isSafeRedirectUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    });

    it("rejects empty or null values", () => {
      expect(isSafeRedirectUrl(null)).toBe(false);
      expect(isSafeRedirectUrl("")).toBe(false);
      expect(isSafeRedirectUrl(undefined)).toBe(false);
    });
  });
});
