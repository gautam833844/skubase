import { describe, it, expect, beforeEach } from "vitest";
import {
  checkLoginRateLimit,
  recordLoginFailure,
  recordLoginSuccess,
  resetRateLimiterForTesting,
} from "@/lib/auth/rate-limiter";

describe("Login Abuse & Rate Limiting", () => {
  beforeEach(() => {
    resetRateLimiterForTesting();
  });

  it("permits initial login attempts", () => {
    const status = checkLoginRateLimit("192.168.1.100", "staff1");
    expect(status.isAllowed).toBe(true);
  });

  it("triggers cooldown after 5 consecutive failures on an account identifier", () => {
    const ip = "192.168.1.100";
    const id = "target_account";

    for (let i = 0; i < 4; i++) {
      recordLoginFailure(ip, id);
      expect(checkLoginRateLimit(ip, id).isAllowed).toBe(true);
    }

    // 5th failure
    recordLoginFailure(ip, id);
    const blockedStatus = checkLoginRateLimit(ip, id);

    expect(blockedStatus.isAllowed).toBe(false);
    expect(blockedStatus.reason).toBe("IDENTIFIER_COOLDOWN");
    expect(blockedStatus.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("successful login clears consecutive failure tracking", () => {
    const ip = "192.168.1.100";
    const id = "employee_user";

    // 3 failed attempts
    recordLoginFailure(ip, id);
    recordLoginFailure(ip, id);
    recordLoginFailure(ip, id);

    // Successful login
    recordLoginSuccess(ip, id);

    // 3 more failed attempts should not trigger cooldown (count was reset)
    recordLoginFailure(ip, id);
    recordLoginFailure(ip, id);
    recordLoginFailure(ip, id);

    expect(checkLoginRateLimit(ip, id).isAllowed).toBe(true);
  });

  it("triggers IP rate limit after 20 attempts from the same IP", () => {
    const ip = "10.0.0.99";

    for (let i = 0; i < 20; i++) {
      recordLoginFailure(ip, `user_${i}`);
    }

    const ipStatus = checkLoginRateLimit(ip, "another_user");
    expect(ipStatus.isAllowed).toBe(false);
    expect(ipStatus.reason).toBe("IP_LIMIT");
  });
});
