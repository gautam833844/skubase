// =============================================================================
// Skubase — Rate Limiter & Abuse Protection
// =============================================================================

interface RateLimitRecord {
  count: number;
  firstAttemptAt: number;
  cooldownUntil: number;
}

/** In-memory rate limiting store (Development & Single-Node V1) */
const ipStore = new Map<string, RateLimitRecord>();
const identifierStore = new Map<string, RateLimitRecord>();

const IP_MAX_ATTEMPTS = 20;
const IP_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const IDENTIFIER_MAX_CONSECUTIVE_FAILURES = 5;
const IDENTIFIER_COOLDOWN_MS = 5 * 60 * 1000; // 5-minute cooldown

export interface RateLimitCheckResult {
  isAllowed: boolean;
  retryAfterSeconds?: number;
  reason?: "IP_LIMIT" | "IDENTIFIER_COOLDOWN";
}

/**
 * Checks if a login attempt is allowed from the given IP and identifier.
 */
export function checkLoginRateLimit(ip: string, identifier: string): RateLimitCheckResult {
  const now = Date.now();
  const normalizedId = identifier.toLowerCase().trim();

  // 1. Check Identifier Cooldown
  const idRecord = identifierStore.get(normalizedId);
  if (idRecord && idRecord.cooldownUntil > now) {
    const retryAfterSeconds = Math.ceil((idRecord.cooldownUntil - now) / 1000);
    return {
      isAllowed: false,
      retryAfterSeconds,
      reason: "IDENTIFIER_COOLDOWN",
    };
  }

  // 2. Check IP Rate Limit
  const ipRecord = ipStore.get(ip);
  if (ipRecord) {
    // If window expired, reset
    if (now - ipRecord.firstAttemptAt > IP_WINDOW_MS) {
      ipStore.delete(ip);
    } else if (ipRecord.count >= IP_MAX_ATTEMPTS) {
      const retryAfterSeconds = Math.ceil(
        (ipRecord.firstAttemptAt + IP_WINDOW_MS - now) / 1000
      );
      return {
        isAllowed: false,
        retryAfterSeconds,
        reason: "IP_LIMIT",
      };
    }
  }

  return { isAllowed: true };
}

/**
 * Records a failed login attempt for the given IP and identifier.
 */
export function recordLoginFailure(ip: string, identifier: string): void {
  const now = Date.now();
  const normalizedId = identifier.toLowerCase().trim();

  // Update IP counter
  const ipRecord = ipStore.get(ip) ?? { count: 0, firstAttemptAt: now, cooldownUntil: 0 };
  if (now - ipRecord.firstAttemptAt > IP_WINDOW_MS) {
    ipRecord.count = 1;
    ipRecord.firstAttemptAt = now;
  } else {
    ipRecord.count += 1;
  }
  ipStore.set(ip, ipRecord);

  // Update Identifier counter
  const idRecord = identifierStore.get(normalizedId) ?? {
    count: 0,
    firstAttemptAt: now,
    cooldownUntil: 0,
  };
  idRecord.count += 1;

  if (idRecord.count >= IDENTIFIER_MAX_CONSECUTIVE_FAILURES) {
    idRecord.cooldownUntil = now + IDENTIFIER_COOLDOWN_MS;
    idRecord.count = 0; // Reset after setting cooldown
  }
  identifierStore.set(normalizedId, idRecord);
}

/**
 * Records a successful login, resetting failure tracking for the identifier.
 */
export function recordLoginSuccess(_ip: string, identifier: string): void {
  const normalizedId = identifier.toLowerCase().trim();
  identifierStore.delete(normalizedId);
}

/**
 * Utility for tests: clears rate limiting stores.
 */
export function resetRateLimiterForTesting(): void {
  ipStore.clear();
  identifierStore.clear();
}
