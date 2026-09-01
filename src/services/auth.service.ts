import crypto from "crypto";
import { db } from "@/lib/db";
import {
  hashPassword,
  verifyPassword,
  verifyDummyPassword,
  validatePasswordPolicy,
} from "@/lib/auth/password";
import { createSession, revokeSessionByToken, revokeAllUserSessions } from "@/lib/auth/session";
import { checkLoginRateLimit, recordLoginFailure, recordLoginSuccess } from "@/lib/auth/rate-limiter";
import { AppError } from "@/lib/errors";
import type { Role } from "@prisma/client";

// =============================================================================
// Skubase — Authentication & User Management Service
// =============================================================================

export interface LoginParams {
  identifier: string;
  password: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface LoginResult {
  rawSessionToken: string;
  user: {
    id: string;
    fullName: string;
    email: string | null;
    username: string | null;
    role: Role;
  };
  session: {
    id: string;
    expiresAt: Date;
  };
}

/**
 * Authenticates a user with email or username and creates a database-backed session.
 */
export async function loginUser(params: LoginParams): Promise<LoginResult> {
  const ip = params.ipAddress ?? "unknown";
  const rawId = params.identifier ?? "";
  const normalizedId = rawId.toLowerCase().trim();

  // 1. Rate Limiting Check
  const rateLimit = checkLoginRateLimit(ip, normalizedId);
  if (!rateLimit.isAllowed) {
    throw new AppError(
      "VALIDATION",
      `Rate limit exceeded for login attempt from ${ip}`,
      `Too many failed attempts. Please try again in ${rateLimit.retryAfterSeconds ?? 300} seconds.`
    );
  }

  if (!normalizedId || !params.password) {
    recordLoginFailure(ip, normalizedId);
    throw new AppError(
      "AUTHENTICATION",
      "Missing identifier or password",
      "Invalid identifier or password."
    );
  }

  // 2. Lookup user by email OR username
  const user = await db.user.findFirst({
    where: {
      OR: [
        { email: { equals: normalizedId, mode: "insensitive" } },
        { username: { equals: normalizedId, mode: "insensitive" } },
      ],
    },
  });

  // 3. Constant-time password verification
  if (!user) {
    await verifyDummyPassword();
    recordLoginFailure(ip, normalizedId);
    // Write security audit log for failed login
    try {
      await db.auditLog.create({
        data: {
          entityName: "User",
          entityId: "unknown",
          action: "AUTH_LOGIN_FAILED",
          ipAddress: ip,
          newState: { identifierAttempted: normalizedId },
        },
      });
    } catch {}

    throw new AppError(
      "AUTHENTICATION",
      `User not found for identifier: ${normalizedId}`,
      "Invalid identifier or password."
    );
  }

  const isPasswordValid = await verifyPassword(user.passwordHash, params.password);
  if (!isPasswordValid) {
    recordLoginFailure(ip, normalizedId);
    try {
      await db.auditLog.create({
        data: {
          actorId: user.id,
          entityName: "User",
          entityId: user.id,
          action: "AUTH_LOGIN_FAILED",
          ipAddress: ip,
        },
      });
    } catch {}

    throw new AppError(
      "AUTHENTICATION",
      `Invalid password for user: ${user.id}`,
      "Invalid identifier or password."
    );
  }

  // 4. Check if user is active
  if (!user.isActive) {
    recordLoginFailure(ip, normalizedId);
    throw new AppError(
      "AUTHENTICATION",
      `Disabled user attempted login: ${user.id}`,
      "This account has been disabled. Please contact the administrator."
    );
  }

  // 5. Successful login — reset failure counter
  recordLoginSuccess(ip, normalizedId);

  // 6. Create Session
  const { rawToken, session } = await createSession({
    userId: user.id,
    ipAddress: ip,
    userAgent: params.userAgent ?? null,
  });

  // 7. Audit Log
  try {
    await db.auditLog.create({
      data: {
        actorId: user.id,
        entityName: "Session",
        entityId: session.id,
        action: "AUTH_LOGIN_SUCCESS",
        ipAddress: ip,
        newState: { userAgent: params.userAgent ?? null },
      },
    });
  } catch {}

  return {
    rawSessionToken: rawToken,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      role: user.role,
    },
    session,
  };
}

/**
 * Logs out a user by revoking the active session token.
 */
export async function logoutUser(rawToken: string, actorId?: string): Promise<boolean> {
  if (!rawToken) return false;

  const revoked = await revokeSessionByToken(rawToken);
  if (revoked && actorId) {
    try {
      await db.auditLog.create({
        data: {
          actorId,
          entityName: "Session",
          entityId: "revoked",
          action: "AUTH_LOGOUT",
        },
      });
    } catch {}
  }

  return revoked;
}

/**
 * Changes a user's password, requiring the current password and revoking all active sessions.
 */
export async function changeUserPassword(params: {
  userId: string;
  currentPassword: string;
  newPassword: string;
  actorId: string;
}): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: params.userId },
  });

  if (!user) {
    throw new AppError("NOT_FOUND", "User not found", "User not found.");
  }

  // Verify current password
  const isValid = await verifyPassword(user.passwordHash, params.currentPassword);
  if (!isValid) {
    throw new AppError(
      "AUTHENTICATION",
      "Current password verification failed",
      "The current password you entered is incorrect."
    );
  }

  // Validate new password policy
  const validation = validatePasswordPolicy(params.newPassword);
  if (!validation.isValid) {
    throw new AppError("VALIDATION", validation.error ?? "Invalid password", validation.error);
  }

  // Hash new password and update
  const newHash = await hashPassword(params.newPassword);
  await db.user.update({
    where: { id: params.userId },
    data: { passwordHash: newHash },
  });

  // Revoke all existing sessions for this user
  await revokeAllUserSessions(params.userId);

  // Write audit log
  try {
    await db.auditLog.create({
      data: {
        actorId: params.actorId,
        entityName: "User",
        entityId: params.userId,
        action: "AUTH_PASSWORD_CHANGED",
      },
    });
  } catch {}
}

/**
 * Initiates a password reset request and creates a short-lived single-use token.
 */
export async function requestPasswordReset(params: {
  identifier: string;
  ipAddress?: string | null;
}): Promise<{ rawToken: string; userId: string } | null> {
  const normalizedId = params.identifier.toLowerCase().trim();

  const user = await db.user.findFirst({
    where: {
      OR: [
        { email: { equals: normalizedId, mode: "insensitive" } },
        { username: { equals: normalizedId, mode: "insensitive" } },
      ],
      isActive: true,
    },
  });

  if (!user) {
    return null;
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15-minute expiration

  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
      isUsed: false,
    },
  });

  try {
    await db.auditLog.create({
      data: {
        actorId: user.id,
        entityName: "PasswordResetToken",
        entityId: user.id,
        action: "AUTH_PASSWORD_RESET_REQUESTED",
        ipAddress: params.ipAddress ?? null,
      },
    });
  } catch {}

  return { rawToken, userId: user.id };
}

/**
 * Completes a password reset using a raw reset token.
 */
export async function resetPasswordWithToken(params: {
  rawToken: string;
  newPassword: string;
  ipAddress?: string | null;
}): Promise<void> {
  if (!params.rawToken) {
    throw new AppError("VALIDATION", "Reset token is required", "Invalid or expired reset link.");
  }

  const tokenHash = crypto.createHash("sha256").update(params.rawToken).digest("hex");

  const resetRecord = await db.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!resetRecord || resetRecord.isUsed || resetRecord.expiresAt <= new Date()) {
    throw new AppError(
      "VALIDATION",
      "Reset token invalid, expired, or already used",
      "This password reset link is invalid or has expired."
    );
  }

  const validation = validatePasswordPolicy(params.newPassword);
  if (!validation.isValid) {
    throw new AppError("VALIDATION", validation.error ?? "Invalid password", validation.error);
  }

  const newHash = await hashPassword(params.newPassword);

  // Update user password and mark token used in transaction
  await db.$transaction([
    db.user.update({
      where: { id: resetRecord.userId },
      data: { passwordHash: newHash },
    }),
    db.passwordResetToken.update({
      where: { id: resetRecord.id },
      data: { isUsed: true },
    }),
  ]);

  // Invalidate all active sessions for this user
  await revokeAllUserSessions(resetRecord.userId);

  try {
    await db.auditLog.create({
      data: {
        actorId: resetRecord.userId,
        entityName: "User",
        entityId: resetRecord.userId,
        action: "AUTH_PASSWORD_RESET_COMPLETED",
        ipAddress: params.ipAddress ?? null,
      },
    });
  } catch {}
}

/**
 * Disables a user and revokes all active sessions.
 */
export async function disableUser(params: { userId: string; actorId: string }): Promise<void> {
  await db.user.update({
    where: { id: params.userId },
    data: { isActive: false },
  });

  await revokeAllUserSessions(params.userId);

  try {
    await db.auditLog.create({
      data: {
        actorId: params.actorId,
        entityName: "User",
        entityId: params.userId,
        action: "AUTH_USER_DISABLED",
      },
    });
  } catch {}
}
