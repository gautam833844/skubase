import { describe, it, expect } from "vitest";
import {
  getPermissionScope,
  hasPermission,
  requirePermission,
  requireScope,
  type AuthActor,
} from "@/lib/auth/permissions";

describe("Scoped Permissions & Authorization", () => {
  const adminActor: AuthActor = { id: "user-admin-1", role: "ADMIN_OWNER" };
  const managerActor: AuthActor = { id: "user-manager-1", role: "MANAGER" };
  const staffActor: AuthActor = { id: "user-staff-1", role: "STAFF" };

  it("grants ADMIN_OWNER ALL permissions across all resources", () => {
    expect(getPermissionScope(adminActor, "inventory:view")).toBe("ALL");
    expect(getPermissionScope(adminActor, "inventory:adjust")).toBe("ALL");
    expect(getPermissionScope(adminActor, "prices:edit")).toBe("ALL");
    expect(getPermissionScope(adminActor, "sales:void")).toBe("ALL");
    expect(getPermissionScope(adminActor, "users:manage")).toBe("ALL");
    expect(getPermissionScope(adminActor, "audit_logs:view")).toBe("ALL");

    expect(hasPermission(adminActor, "users:manage", "ALL")).toBe(true);
  });

  it("grants MANAGER operational permissions but restricts owner-only actions", () => {
    expect(getPermissionScope(managerActor, "inventory:view")).toBe("ALL");
    expect(getPermissionScope(managerActor, "sales:create")).toBe("ALL");
    expect(getPermissionScope(managerActor, "sales:view_history")).toBe("ALL");
    expect(getPermissionScope(managerActor, "purchases:create")).toBe("ALL");
    expect(getPermissionScope(managerActor, "warranties:manage")).toBe("ALL");
    expect(getPermissionScope(managerActor, "reports:view")).toBe("ALL");

    // Restricted
    expect(getPermissionScope(managerActor, "inventory:adjust")).toBe("NONE");
    expect(getPermissionScope(managerActor, "prices:edit")).toBe("NONE");
    expect(getPermissionScope(managerActor, "sales:void")).toBe("NONE");
    expect(getPermissionScope(managerActor, "users:manage")).toBe("NONE");
    expect(getPermissionScope(managerActor, "audit_logs:view")).toBe("NONE");

    expect(hasPermission(managerActor, "prices:edit")).toBe(false);
  });

  it("grants STAFF scoped access with OWN sales history", () => {
    expect(getPermissionScope(staffActor, "inventory:view")).toBe("ALL");
    expect(getPermissionScope(staffActor, "sales:create")).toBe("ALL");
    expect(getPermissionScope(staffActor, "customers:manage")).toBe("ALL");
    expect(getPermissionScope(staffActor, "purchases:receive")).toBe("ALL");

    // Scoped OWN permission
    expect(getPermissionScope(staffActor, "sales:view_history")).toBe("OWN");

    // Restricted
    expect(getPermissionScope(staffActor, "purchases:create")).toBe("NONE");
    expect(getPermissionScope(staffActor, "suppliers:manage")).toBe("NONE");
    expect(getPermissionScope(staffActor, "reports:view")).toBe("NONE");
    expect(getPermissionScope(staffActor, "users:manage")).toBe("NONE");
  });

  it("evaluates hasPermission with OWN scope correctly", () => {
    // When required scope is OWN, both ALL and OWN pass
    expect(hasPermission(staffActor, "sales:view_history", "OWN")).toBe(true);
    expect(hasPermission(adminActor, "sales:view_history", "OWN")).toBe(true);

    // When required scope is ALL, only ALL passes (staff fails)
    expect(hasPermission(staffActor, "sales:view_history", "ALL")).toBe(false);
    expect(hasPermission(adminActor, "sales:view_history", "ALL")).toBe(true);
  });

  it("requirePermission asserts without throwing for authorized actor and throws 403 for unauthorized", () => {
    expect(() => requirePermission(adminActor, "inventory:adjust")).not.toThrow();

    try {
      requirePermission(staffActor, "inventory:adjust");
      expect.unreachable("Should have thrown AppError");
    } catch (err: unknown) {
      const appErr = err as { statusCode?: number; type?: string; userMessage?: string };
      expect(appErr.statusCode).toBe(403);
      expect(appErr.type).toBe("AUTHORIZATION");
      expect(appErr.userMessage).toBe("You do not have permission to perform this action.");
    }
  });

  it("requireScope returns the active scope and throws when unauthorized", () => {
    expect(requireScope(adminActor, "sales:view_history")).toBe("ALL");
    expect(requireScope(staffActor, "sales:view_history")).toBe("OWN");

    expect(() => requireScope(staffActor, "prices:edit")).toThrow();
  });
});

