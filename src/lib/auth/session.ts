import crypto from "crypto";
import { db } from "@/lib/db";
import { SESSION_COOKIE_NAME } from "@/lib/constants";
import type { Role } from "@prisma/client";

// =============================================================================
// Skubase — Session Management & Cookie Configuration
// =============================================================================

export { SESSION_COOKIE_NAME };

/** Session duration: 7 days default (604800 seconds) */
export const DEFAULT_SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export function getSessionMaxAgeSeconds(): number {
  const envVal = process.env.SESSION_MAX_AGE_SECONDS;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_SESSION_MAX_AGE_SECONDS;
}

export interface SessionCookieOptions {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge: number;
}

/**
 * Returns cookie options matching the security policy.
 */
export function getSessionCookieOptions(token: string = ""): SessionCookieOptions {
  const isProd = process.env.NODE_ENV === "production";
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: token ? getSessionMaxAgeSeconds() : 0,
  };
}

/**
 * Generates a 256-bit cryptographically secure raw session token.
 */
export function generateRawSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Computes SHA-256 hash of a raw token.
 */
export function hashSessionToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export interface AuthenticatedUserContext {
  session: {
    id: string;
    expiresAt: Date;
  };
  user: {
    id: string;
    fullName: string;
    email: string | null;
    username: string | null;
    role: Role;
    isActive: boolean;
  };
}

/**
 * Creates a new database session for a user.
 */
export async function createSession(params: {
  userId: string;
  userAgent?: string | null;
  ipAddress?: string | null;
}): Promise<{ rawToken: string; session: { id: string; expiresAt: Date } }> {
  const rawToken = generateRawSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + getSessionMaxAgeSeconds() * 1000);

  const session = await db.session.create({
    data: {
      userId: params.userId,
      tokenHash,
      userAgent: params.userAgent ?? null,
      ipAddress: params.ipAddress ?? null,
      expiresAt,
    },
    select: {
      id: true,
      expiresAt: true,
    },
  });

  return { rawToken, session };
}

/**
 * Validates a raw session token against the database.
 * Returns null if the session is invalid, expired, or belongs to a disabled user.
 */
export async function validateSessionToken(
  rawToken: string | undefined | null
): Promise<AuthenticatedUserContext | null> {
  if (!rawToken || typeof rawToken !== "string") {
    return null;
  }

  const tokenHash = hashSessionToken(rawToken);

  try {
    const session = await db.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            username: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!session) {
      return null;
    }

    // Verify session expiration
    if (session.expiresAt <= new Date()) {
      // Asynchronously clean up the expired session
      db.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    // Verify active user status
    if (!session.user || !session.user.isActive) {
      return null;
    }

    return {
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
      },
      user: session.user,
    };
  } catch {
    // If database connection is not configured or error occurs, safely return null
    return null;
  }
}

/**
 * Revokes / deletes a specific session by raw token.
 */
export async function revokeSessionByToken(rawToken: string): Promise<boolean> {
  if (!rawToken) return false;
  const tokenHash = hashSessionToken(rawToken);

  try {
    const deleted = await db.session.deleteMany({
      where: { tokenHash },
    });
    return deleted.count > 0;
  } catch {
    return false;
  }
}

/**
 * Revokes all active sessions for a given user (e.g. on password change or user disablement).
 */
export async function revokeAllUserSessions(userId: string): Promise<number> {
  if (!userId) return 0;

  try {
    const result = await db.session.deleteMany({
      where: { userId },
    });
    return result.count;
  } catch {
    return 0;
  }
}
