import { hash, verify } from "@node-rs/argon2";

// =============================================================================
// Skubase — Password Hashing & Policy
// =============================================================================

/** Argon2id hashing configuration options */
const ARGON2_OPTIONS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2, // 2 iterations
  outputLen: 32, // 32 bytes hash output
  parallelism: 1, // 1 thread
};

/** Pre-computed dummy Argon2id hash for constant-time comparison on unknown accounts */
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$ZHVtbXlzYWx0MTIzNDU2$k1qI0vG2W+W2G2+2G2+2G2+2G2+2G2+2G2+2G2+2G28";

/** Top trivial / common passwords to reject */
const COMMON_PASSWORDS = new Set([
  "123456789012",
  "password1234",
  "password12345",
  "skubaseskubase",
  "adminadmin123",
  "qwertyuiop12",
  "mrfmrfmrfmrf",
  "apollotyres1",
]);

export interface PasswordValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates password length and against common weak passwords.
 * Minimum: 12 characters, Maximum: 128 characters.
 * No arbitrary composition rules.
 */
export function validatePasswordPolicy(password: string): PasswordValidationResult {
  if (!password || typeof password !== "string") {
    return { isValid: false, error: "Password is required." };
  }

  if (password.length < 12) {
    return { isValid: false, error: "Password must be at least 12 characters long." };
  }

  if (password.length > 128) {
    return { isValid: false, error: "Password cannot exceed 128 characters." };
  }

  const normalized = password.toLowerCase().trim();
  if (COMMON_PASSWORDS.has(normalized)) {
    return { isValid: false, error: "This password is too common. Please choose a stronger passphrase." };
  }

  // Check for trivial repeated characters (e.g. "aaaaaaaaaaaa")
  if (/^(.)\1+$/.test(password)) {
    return { isValid: false, error: "Password cannot be a single repeating character." };
  }

  return { isValid: true };
}

/**
 * Hashes a plaintext password using Argon2id.
 */
export async function hashPassword(password: string): Promise<string> {
  const validation = validatePasswordPolicy(password);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  return hash(password, ARGON2_OPTIONS);
}

/**
 * Verifies a plaintext password against an Argon2id hash in constant time.
 */
export async function verifyPassword(hashString: string, passwordAttempt: string): Promise<boolean> {
  if (!hashString || !passwordAttempt) {
    return false;
  }

  try {
    return await verify(hashString, passwordAttempt);
  } catch {
    return false;
  }
}

/**
 * Executes a constant-time dummy verification when an account is not found,
 * eliminating timing differences that enable user enumeration.
 */
export async function verifyDummyPassword(): Promise<boolean> {
  try {
    await verify(DUMMY_HASH, "dummy_attempt_string_12345");
  } catch {
    // Ignore error
  }
  return false;
}
