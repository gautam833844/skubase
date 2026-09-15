import { Role } from "@prisma/client";
import { AppError } from "@/lib/errors";

// =============================================================================
// Skubase — Scoped Permissions & Role-Based Authorization
// =============================================================================

export type PermissionScope = "ALL" | "OWN" | "NONE";

export type PermissionKey =
  | "inventory:view"
  | "inventory:adjust"
  | "sales:create"
  | "sales:view_history"
  | "sales:void"
  | "purchases:create"
  | "purchases:receive"
  | "customers:manage"
  | "suppliers:manage"
  | "prices:edit"
  | "payments:record"
  | "payments:view"
  | "warranties:create"
  | "warranties:view"
  | "warranties:manage"
  | "reports:view"
  | "users:manage"
  | "settings:view"
  | "settings:manage"
  | "returns:create"
  | "returns:view"
  | "audit_logs:view"
  | "alignment:create"
  | "alignment:view_history"
  | "alignment:void";

export type RolePermissionMatrix = Record<Role, Record<PermissionKey, PermissionScope>>;

/**
 * Default permission mappings for each role.
 */
export const DEFAULT_ROLE_PERMISSIONS: RolePermissionMatrix = {
  ADMIN_OWNER: {
    "inventory:view": "ALL",
    "inventory:adjust": "ALL",
    "sales:create": "ALL",
    "sales:view_history": "ALL",
    "sales:void": "ALL",
    "purchases:create": "ALL",
    "purchases:receive": "ALL",
    "customers:manage": "ALL",
    "suppliers:manage": "ALL",
    "prices:edit": "ALL",
    "payments:record": "ALL",
    "payments:view": "ALL",
    "warranties:create": "ALL",
    "warranties:view": "ALL",
    "warranties:manage": "ALL",
    "reports:view": "ALL",
    "users:manage": "ALL",
    "settings:view": "ALL",
    "settings:manage": "ALL",
    "returns:create": "ALL",
    "returns:view": "ALL",
    "audit_logs:view": "ALL",
    "alignment:create": "ALL",
    "alignment:view_history": "ALL",
    "alignment:void": "ALL",
  },
  MANAGER: {
    "inventory:view": "ALL",
    "inventory:adjust": "NONE",
    "sales:create": "ALL",
    "sales:view_history": "ALL",
    "sales:void": "NONE",
    "purchases:create": "ALL",
    "purchases:receive": "ALL",
    "customers:manage": "ALL",
    "suppliers:manage": "ALL",
    "prices:edit": "NONE",
    "payments:record": "ALL",
    "payments:view": "ALL",
    "warranties:create": "ALL",
    "warranties:view": "ALL",
    "warranties:manage": "ALL",
    "reports:view": "ALL",
    "users:manage": "NONE",
    "settings:view": "ALL",
    "settings:manage": "ALL",
    "returns:create": "ALL",
    "returns:view": "ALL",
    "audit_logs:view": "NONE",
    "alignment:create": "ALL",
    "alignment:view_history": "ALL",
    "alignment:void": "NONE",
  },
  STAFF: {
    "inventory:view": "ALL",
    "inventory:adjust": "NONE",
    "sales:create": "ALL",
    "sales:view_history": "OWN", // Staff can view only their own bills
    "sales:void": "NONE",
    "purchases:create": "NONE",
    "purchases:receive": "ALL",
    "customers:manage": "ALL",
    "suppliers:manage": "NONE",
    "prices:edit": "NONE",
    "payments:record": "ALL",
    "payments:view": "OWN",
    "warranties:create": "ALL",
    "warranties:view": "OWN",
    "warranties:manage": "NONE",
    "reports:view": "NONE",
    "users:manage": "NONE",
    "settings:view": "ALL",
    "settings:manage": "NONE",
    "returns:create": "ALL",
    "returns:view": "OWN",
    "audit_logs:view": "NONE",
    "alignment:create": "ALL",
    "alignment:view_history": "OWN",
    "alignment:void": "NONE",
  },
};

export interface AuthActor {
  id: string;
  role: Role;
  isActive?: boolean;
}

/**
 * Retrieves the permission scope for a given actor and action.
 */
export function getPermissionScope(actor: AuthActor, permission: PermissionKey): PermissionScope {
  if (!actor || !actor.role) {
    return "NONE";
  }

  const roleMap = DEFAULT_ROLE_PERMISSIONS[actor.role];
  if (!roleMap) {
    return "NONE";
  }

  return roleMap[permission] ?? "NONE";
}

/**
 * Checks whether an actor has sufficient permission scope for an action.
 * If requiredScope is "OWN", both "ALL" and "OWN" pass.
 * If requiredScope is "ALL", only "ALL" passes.
 */
export function hasPermission(
  actor: AuthActor,
  permission: PermissionKey,
  requiredScope: "ALL" | "OWN" = "ALL"
): boolean {
  const scope = getPermissionScope(actor, permission);
  if (scope === "NONE") return false;
  if (requiredScope === "OWN") return scope === "ALL" || scope === "OWN";
  return scope === "ALL";
}

/**
 * Asserts that the actor has the required permission, throwing an AppError 403 if unauthorized.
 */
export function requirePermission(
  actor: AuthActor,
  permission: PermissionKey,
  requiredScope: "ALL" | "OWN" = "ALL"
): void {
  if (!hasPermission(actor, permission, requiredScope)) {
    throw new AppError(
      "AUTHORIZATION",
      `Forbidden: Missing permission ${permission} with scope ${requiredScope}`,
      "You do not have permission to perform this action."
    );
  }
}

/**
 * Asserts that an actor has permission, and returns the active scope ("ALL" or "OWN") for query filtering.
 */
export function requireScope(actor: AuthActor, permission: PermissionKey): "ALL" | "OWN" {
  const scope = getPermissionScope(actor, permission);
  if (scope === "NONE") {
    throw new AppError(
      "AUTHORIZATION",
      `Forbidden: Missing permission ${permission}`,
      "You do not have permission to perform this action."
    );
  }
  return scope;
}
