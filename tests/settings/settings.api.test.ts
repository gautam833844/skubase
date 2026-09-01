import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getSettingsRoute, PUT as putSettingsRoute } from "@/app/api/settings/route";
import * as shopService from "@/services/shop.service";
import * as authContext from "@/lib/auth/context";
import * as csrf from "@/lib/auth/csrf";

vi.mock("@/services/shop.service");
vi.mock("@/lib/auth/context");
vi.mock("@/lib/auth/csrf");

describe("Shop Settings API Routes (/api/settings)", () => {
  const mockAdmin = {
    id: "admin-1",
    username: "owner",
    fullName: "Shop Owner",
    email: "owner@skubase.local",
    role: "ADMIN_OWNER" as const,
    isActive: true,
  };

  const mockSettingsData: shopService.ShopSettingView = {
    id: "shop-1",
    name: "Premier Tyre Hub",
    tagline: "Quality Service",
    address: "Plot 42, Mumbai",
    phoneNumber: "+91 98765 43210",
    email: "sales@premiertyres.in",
    website: "https://premiertyres.in",
    gstin: "27ABCDE1234F1Z5",
    billFooter: "Thank you for your business!",
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authContext.requireAuth).mockResolvedValue({
      user: mockAdmin,
      session: { id: "session-1", expiresAt: new Date() },
    });
    vi.mocked(csrf.validateRequestOrigin).mockReturnValue(true);
  });

  describe("GET /api/settings", () => {
    it("returns shop settings for authenticated user", async () => {
      vi.mocked(shopService.getShopSettings).mockResolvedValue(mockSettingsData);

      const response = await getSettingsRoute();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.name).toBe("Premier Tyre Hub");
    });
  });

  describe("PUT /api/settings", () => {
    it("updates shop settings successfully", async () => {
      vi.mocked(shopService.updateShopSettings).mockResolvedValue({
        ...mockSettingsData,
        name: "Updated Tyre Hub",
      });

      const request = new Request("http://localhost:3000/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Updated Tyre Hub",
          phoneNumber: "+91 98765 43210",
        }),
      });

      const response = await putSettingsRoute(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.name).toBe("Updated Tyre Hub");
      expect(csrf.validateRequestOrigin).toHaveBeenCalled();
    });
  });
});
