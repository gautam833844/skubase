import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, validateSessionToken, type AuthenticatedUserContext } from "./session";
import { AppError } from "@/lib/errors";
import type { Role } from "@prisma/client";

// =============================================================================
// Skubase — Server-Side Authenticated User Context
// =============================================================================

/**
 * Retrieves the currently authenticated user from the request session cookie.
 * Returns null if unauthenticated.
 */
export async function getCurrentUser(): Promise<AuthenticatedUserContext | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

    if (!sessionCookie || !sessionCookie.value) {
      return null;
    }

    return await validateSessionToken(sessionCookie.value);
  } catch {
    return null;
  }
}

/**
 * Asserts that the request is authenticated, throwing an AppError 401 if unauthenticated.
 */
export async function requireAuth(): Promise<AuthenticatedUserContext> {
  const auth = await getCurrentUser();
  if (!auth) {
    throw new AppError(
      "AUTHENTICATION",
      "Unauthorized: Valid session required",
      "Please log in to continue."
    );
  }
  return auth;
}

/**
 * Asserts that the authenticated user possesses one of the allowed roles.
 */
export async function requireRole(allowedRoles: Role[]): Promise<AuthenticatedUserContext> {
  const auth = await requireAuth();
  if (!allowedRoles.includes(auth.user.role)) {
    throw new AppError(
      "AUTHORIZATION",
      `Forbidden: Required role in [${allowedRoles.join(", ")}], but user has ${auth.user.role}`,
      "You do not have permission to access this resource."
    );
  }
  return auth;
}
