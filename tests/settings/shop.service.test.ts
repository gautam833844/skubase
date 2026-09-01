import { describe, it, expect, vi, beforeEach } from "vitest";
import { getShopSettings, updateShopSettings } from "@/services/shop.service";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { defaultShopConfig } from "@/config/shop.config";
import type { AuthActor } from "@/lib/auth/permissions";

vi.mock("@/lib/db", () => {
  return {
    db: {
      shopSetting: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      product: {
        update: vi.fn(),
      },
      sale: {
        update: vi.fn(),
      },
      payment: {
        create: vi.fn(),
      },
      inventoryMovement: {
        create: vi.fn(),
      },
    },
  };
});

describe("Shop / Business Settings Service Unit Tests", () => {
  const adminActor: AuthActor = { id: "admin-1", role: "ADMIN_OWNER" };
  const managerActor: AuthActor = { id: "manager-1", role: "MANAGER" };
  const staffActor: AuthActor = { id: "staff-1", role: "STAFF" };

  const mockDbSetting = {
    id: "shop-1",
    name: "Premier Tyre Hub",
    tagline: "Wheel Balancing & Tyres",
    address: "123 Industrial Area, Pune",
    phoneNumber: "+91 98220 12345",
    email: "contact@premiertyres.in",
    website: "https://premiertyres.in",
    gstin: "27ABCDE1234F1Z5",
    billFooter: "Thank you for choosing Premier Tyres!",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Get Shop Settings", () => {
    it("falls back to defaultShopConfig if no record exists in database", async () => {
      vi.mocked(db.shopSetting.findFirst).mockResolvedValue(null);

      const settings = await getShopSettings(adminActor);

      expect(settings.id).toBe("default-shop-settings");
      expect(settings.name).toBe(defaultShopConfig.name);
      expect(settings.phoneNumber).toBe(defaultShopConfig.phoneNumber);
      expect(settings.billFooter).toBe(defaultShopConfig.footerNotice);
    });

    it("returns database-persisted settings when present", async () => {
      vi.mocked(db.shopSetting.findFirst).mockResolvedValue(mockDbSetting);

      const settings = await getShopSettings(staffActor);

      expect(settings.id).toBe("shop-1");
      expect(settings.name).toBe("Premier Tyre Hub");
      expect(settings.gstin).toBe("27ABCDE1234F1Z5");
    });
  });

  describe("2. Update Shop Settings Validation", () => {
    it("requires a valid business name (minimum 2 characters)", async () => {
      await expect(
        updateShopSettings(
          {
            name: " ",
          },
          adminActor
        )
      ).rejects.toThrow("Business name must be between 2 and 120 characters");
    });

    it("rejects invalid email formats", async () => {
      await expect(
        updateShopSettings(
          {
            name: "Premier Tyres",
            email: "invalid-email-address",
          },
          adminActor
        )
      ).rejects.toThrow("Invalid email address format");
    });

    it("rejects oversized phone number and footer strings", async () => {
      await expect(
        updateShopSettings(
          {
            name: "Premier Tyres",
            phoneNumber: "123456789012345678901234567890", // > 25 chars
          },
          adminActor
        )
      ).rejects.toThrow("Phone number cannot exceed 25 characters");

      await expect(
        updateShopSettings(
          {
            name: "Premier Tyres",
            billFooter: "A".repeat(255), // > 250 chars
          },
          adminActor
        )
      ).rejects.toThrow("Bill footer cannot exceed 250 characters");
    });
  });

  describe("3. Role-Based Access Control (RBAC)", () => {
    it("allows ADMIN_OWNER to update settings", async () => {
      vi.mocked(db.shopSetting.findFirst).mockResolvedValue(mockDbSetting);
      vi.mocked(db.shopSetting.update).mockResolvedValue({
        ...mockDbSetting,
        name: "Premier Tyres & Wheels",
      });

      const updated = await updateShopSettings(
        {
          name: "Premier Tyres & Wheels",
        },
        adminActor
      );

      expect(updated.name).toBe("Premier Tyres & Wheels");
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "SHOP_SETTINGS_UPDATED",
            actorId: "admin-1",
          }),
        })
      );
    });

    it("allows MANAGER to update settings", async () => {
      vi.mocked(db.shopSetting.findFirst).mockResolvedValue(mockDbSetting);
      vi.mocked(db.shopSetting.update).mockResolvedValue({
        ...mockDbSetting,
        name: "Premier Tyres by Manager",
      });

      const updated = await updateShopSettings(
        {
          name: "Premier Tyres by Manager",
        },
        managerActor
      );

      expect(updated.name).toBe("Premier Tyres by Manager");
    });

    it("blocks STAFF from updating settings with 403 Forbidden", async () => {
      try {
        await updateShopSettings(
          {
            name: "Hacked Tyres",
          },
          staffActor
        );
        expect.unreachable("Should have rejected staff update");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.statusCode).toBe(403);
      }
    });
  });

  describe("4. Zero Business Side Effects", () => {
    it("guarantees updating shop settings does NOT modify sales, inventory, or payments", async () => {
      vi.mocked(db.shopSetting.findFirst).mockResolvedValue(mockDbSetting);
      vi.mocked(db.shopSetting.update).mockResolvedValue(mockDbSetting);

      await updateShopSettings(
        {
          name: "Premier Tyres",
          address: "New Address",
        },
        adminActor
      );

      expect(db.product.update).not.toHaveBeenCalled();
      expect(db.sale.update).not.toHaveBeenCalled();
      expect(db.payment.create).not.toHaveBeenCalled();
      expect(db.inventoryMovement.create).not.toHaveBeenCalled();
    });
  });
});
