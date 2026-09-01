import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  loginUser,
  logoutUser,
  changeUserPassword,
  requestPasswordReset,
  resetPasswordWithToken,
  disableUser,
} from "@/services/auth.service";
import { hashPassword } from "@/lib/auth/password";
import { resetRateLimiterForTesting } from "@/lib/auth/rate-limiter";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { User, Session, PasswordResetToken } from "@prisma/client";

// Mock db calls for unit tests
vi.mock("@/lib/db", () => {
  return {
    db: {
      user: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      session: {
        create: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
      },
      passwordResetToken: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn((promises: Promise<unknown>[]) => Promise.all(promises)),
    },
  };
});

describe("Auth Service Logic", () => {
  const testPassword = "validSecurePassword1234";
  let validPasswordHash: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetRateLimiterForTesting();
    validPasswordHash = await hashPassword(testPassword);
  });

  describe("loginUser", () => {
    it("authenticates active user with correct email and creates session", async () => {
      const mockUser: Partial<User> = {
        id: "user-1",
        fullName: "Owner User",
        email: "owner@skubase.com",
        username: "owner",
        passwordHash: validPasswordHash,
        role: "ADMIN_OWNER",
        isActive: true,
      };

      vi.mocked(db.user.findFirst).mockResolvedValue(mockUser as User);
      vi.mocked(db.session.create).mockResolvedValue({
        id: "session-1",
        expiresAt: new Date(Date.now() + 604800000),
      } as Session);

      const result = await loginUser({
        identifier: "owner@skubase.com",
        password: testPassword,
        ipAddress: "127.0.0.1",
        userAgent: "Vitest Test Runner",
      });

      expect(result.user.id).toBe("user-1");
      expect(result.user.email).toBe("owner@skubase.com");
      expect(result.rawSessionToken).toHaveLength(64);
      expect(db.session.create).toHaveBeenCalled();
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "AUTH_LOGIN_SUCCESS" }),
        })
      );
    });

    it("authenticates active user with username", async () => {
      const mockUser: Partial<User> = {
        id: "user-2",
        fullName: "Staff Rahul",
        email: null,
        username: "rahul_staff",
        passwordHash: validPasswordHash,
        role: "STAFF",
        isActive: true,
      };

      vi.mocked(db.user.findFirst).mockResolvedValue(mockUser as User);
      vi.mocked(db.session.create).mockResolvedValue({
        id: "session-2",
        expiresAt: new Date(Date.now() + 604800000),
      } as Session);

      const result = await loginUser({
        identifier: "rahul_staff",
        password: testPassword,
      });

      expect(result.user.username).toBe("rahul_staff");
      expect(result.user.role).toBe("STAFF");
    });

    it("throws generic error when account does not exist without revealing enumeration info", async () => {
      vi.mocked(db.user.findFirst).mockResolvedValue(null);

      try {
        await loginUser({
          identifier: "nonexistent@user.com",
          password: testPassword,
        });
        expect.unreachable("Should have thrown AppError");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.type).toBe("AUTHENTICATION");
        expect(appErr.userMessage).toBe("Invalid identifier or password.");
      }
    });

    it("throws generic error when password is wrong", async () => {
      const mockUser: Partial<User> = {
        id: "user-1",
        fullName: "Owner User",
        email: "owner@skubase.com",
        username: "owner",
        passwordHash: validPasswordHash,
        role: "ADMIN_OWNER",
        isActive: true,
      };

      vi.mocked(db.user.findFirst).mockResolvedValue(mockUser as User);

      try {
        await loginUser({
          identifier: "owner@skubase.com",
          password: "wrongPasswordAttempt1234",
        });
        expect.unreachable("Should have thrown AppError");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.type).toBe("AUTHENTICATION");
        expect(appErr.userMessage).toBe("Invalid identifier or password.");
      }
    });

    it("rejects login for disabled user account", async () => {
      const mockDisabledUser: Partial<User> = {
        id: "user-disabled",
        fullName: "Disabled User",
        email: "disabled@skubase.com",
        username: "disabled",
        passwordHash: validPasswordHash,
        role: "STAFF",
        isActive: false,
      };

      vi.mocked(db.user.findFirst).mockResolvedValue(mockDisabledUser as User);

      try {
        await loginUser({
          identifier: "disabled@skubase.com",
          password: testPassword,
        });
        expect.unreachable("Should have thrown AppError");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.type).toBe("AUTHENTICATION");
        expect(appErr.userMessage).toBe("This account has been disabled. Please contact the administrator.");
      }
    });
  });

  describe("logoutUser", () => {
    it("deletes session by token and writes audit log", async () => {
      vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 1 });

      const result = await logoutUser("some_raw_token_value", "user-1");
      expect(result).toBe(true);
      expect(db.session.deleteMany).toHaveBeenCalled();
    });
  });

  describe("changeUserPassword", () => {
    it("requires correct current password, updates hash, and revokes active sessions", async () => {
      const mockUser: Partial<User> = {
        id: "user-1",
        passwordHash: validPasswordHash,
      };

      vi.mocked(db.user.findUnique).mockResolvedValue(mockUser as User);
      vi.mocked(db.user.update).mockResolvedValue(mockUser as User);
      vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 2 });

      const newPass = "brandNewSecurePassword9999";
      await changeUserPassword({
        userId: "user-1",
        currentPassword: testPassword,
        newPassword: newPass,
        actorId: "user-1",
      });

      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
        })
      );
      expect(db.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
      });
    });

    it("rejects password change if current password is wrong", async () => {
      const mockUser: Partial<User> = {
        id: "user-1",
        passwordHash: validPasswordHash,
      };

      vi.mocked(db.user.findUnique).mockResolvedValue(mockUser as User);

      try {
        await changeUserPassword({
          userId: "user-1",
          currentPassword: "incorrectCurrentPassword1",
          newPassword: "brandNewSecurePassword9999",
          actorId: "user-1",
        });
        expect.unreachable("Should have thrown AppError");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.type).toBe("AUTHENTICATION");
        expect(appErr.userMessage).toBe("The current password you entered is incorrect.");
      }
    });
  });

  describe("Password Reset Flow", () => {
    it("generates short-lived reset token for existing user", async () => {
      const mockUser: Partial<User> = {
        id: "user-1",
        email: "owner@skubase.com",
        username: "owner",
        isActive: true,
      };

      vi.mocked(db.user.findFirst).mockResolvedValue(mockUser as User);
      vi.mocked(db.passwordResetToken.create).mockResolvedValue({} as PasswordResetToken);

      const result = await requestPasswordReset({
        identifier: "owner@skubase.com",
      });

      expect(result).not.toBeNull();
      expect(result?.rawToken).toHaveLength(64);
      expect(db.passwordResetToken.create).toHaveBeenCalled();
    });

    it("resets password, marks token used, and invalidates sessions", async () => {
      const mockTokenRecord = {
        id: "token-record-1",
        userId: "user-1",
        tokenHash: "hashed_token_val",
        expiresAt: new Date(Date.now() + 900000), // 15 mins in future
        isUsed: false,
        user: { id: "user-1" } as User,
      };

      vi.mocked(db.passwordResetToken.findUnique).mockResolvedValue(mockTokenRecord as unknown as (PasswordResetToken & { user: User }));
      vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 1 });

      await resetPasswordWithToken({
        rawToken: "valid_reset_token_64_chars_long_1234567890abcdef1234567890abcdef1234",
        newPassword: "brandNewPasswordAfterReset12",
      });

      expect(db.$transaction).toHaveBeenCalled();
      expect(db.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
      });
    });

    it("rejects reset if token is expired or already used", async () => {
      const mockUsedToken = {
        id: "token-record-2",
        userId: "user-1",
        tokenHash: "hashed_token_val",
        expiresAt: new Date(Date.now() + 900000),
        isUsed: true, // Already used
      };

      vi.mocked(db.passwordResetToken.findUnique).mockResolvedValue(mockUsedToken as unknown as (PasswordResetToken & { user: User }));

      try {
        await resetPasswordWithToken({
          rawToken: "used_token",
          newPassword: "brandNewPasswordAfterReset12",
        });
        expect.unreachable("Should have thrown AppError");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.type).toBe("VALIDATION");
        expect(appErr.userMessage).toBe("This password reset link is invalid or has expired.");
      }
    });
  });

  describe("disableUser", () => {
    it("deactivates user and revokes all active sessions", async () => {
      vi.mocked(db.user.update).mockResolvedValue({} as User);
      vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 3 });

      await disableUser({ userId: "user-to-disable", actorId: "owner-id" });

      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: "user-to-disable" },
        data: { isActive: false },
      });
      expect(db.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-to-disable" },
      });
    });
  });
});
