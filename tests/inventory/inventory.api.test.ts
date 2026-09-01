import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getProducts, POST as createProductRoute } from "@/app/api/inventory/products/route";
import { GET as getProductByIdRoute, PATCH as patchProductRoute } from "@/app/api/inventory/products/[id]/route";
import { POST as adjustStockRoute } from "@/app/api/inventory/adjust/route";
import { GET as getMovementsRoute } from "@/app/api/inventory/movements/route";
import * as inventoryService from "@/services/inventory.service";
import * as authContext from "@/lib/auth/context";
import { Prisma } from "@prisma/client";

vi.mock("@/services/inventory.service");
vi.mock("@/lib/auth/context");

describe("Inventory API Route Handlers", () => {
  const mockAdminUser = {
    session: { id: "sess-1", expiresAt: new Date() },
    user: {
      id: "admin-1",
      fullName: "Admin Owner",
      email: "owner@skubase.com",
      username: "owner",
      role: "ADMIN_OWNER" as const,
      isActive: true,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authContext.requireAuth).mockResolvedValue(mockAdminUser);
  });

  describe("GET /api/inventory/products", () => {
    it("returns product list with metrics and pagination", async () => {
      vi.mocked(inventoryService.listProducts).mockResolvedValue({
        products: [
          {
            id: "p-1",
            brand: "MRF",
            size: "195/65 R15",
            pattern: "ZVTV",
            unitPrice: new Prisma.Decimal(4500),
            averageCostPrice: new Prisma.Decimal(3800),
            quantityOnHand: 10,
            minStockAlert: 4,
            notes: null,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        pagination: { page: 1, limit: 50, totalCount: 1, totalPages: 1 },
        metrics: { totalPhysicalTyres: 10, totalActiveProducts: 1 },
      });

      const request = new Request("http://localhost:3000/api/inventory/products?search=MRF");
      const response = await getProducts(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.metrics.totalPhysicalTyres).toBe(10);
    });
  });

  describe("POST /api/inventory/products", () => {
    it("creates product and returns 201 with valid origin", async () => {
      vi.mocked(inventoryService.createProduct).mockResolvedValue({
        id: "p-new",
        brand: "Apollo",
        size: "205/55 R16",
        pattern: "Alnac",
        unitPrice: new Prisma.Decimal(5000),
        averageCostPrice: new Prisma.Decimal(4200),
        quantityOnHand: 0,
        minStockAlert: 4,
        notes: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new Request("http://localhost:3000/api/inventory/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          host: "localhost:3000",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          brand: "Apollo",
          size: "205/55 R16",
          pattern: "Alnac",
          unitPrice: 5000,
        }),
      });

      const response = await createProductRoute(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe("p-new");
    });
  });

  describe("GET /api/inventory/products/[id]", () => {
    it("returns single product details", async () => {
      vi.mocked(inventoryService.getProductById).mockResolvedValue({
        id: "p-1",
        brand: "MRF",
        size: "195/65 R15",
        pattern: "ZVTV",
        unitPrice: new Prisma.Decimal(4500),
        averageCostPrice: new Prisma.Decimal(3800),
        quantityOnHand: 10,
        minStockAlert: 4,
        notes: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        inventoryMovements: [],
      });

      const request = new Request("http://localhost:3000/api/inventory/products/p-1");
      const response = await getProductByIdRoute(request, { params: Promise.resolve({ id: "p-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe("p-1");
    });
  });

  describe("PATCH /api/inventory/products/[id]", () => {
    it("updates product details with valid origin", async () => {
      vi.mocked(inventoryService.updateProduct).mockResolvedValue({
        id: "p-1",
        brand: "MRF",
        size: "195/65 R15",
        pattern: "ZVTV",
        unitPrice: 4700 as unknown as import("@prisma/client").Prisma.Decimal,
        averageCostPrice: 3800 as unknown as import("@prisma/client").Prisma.Decimal,
        quantityOnHand: 10,
        minStockAlert: 4,
        notes: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new Request("http://localhost:3000/api/inventory/products/p-1", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          host: "localhost:3000",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          unitPrice: 4700,
        }),
      });

      const response = await patchProductRoute(request, { params: Promise.resolve({ id: "p-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("handles deactivation action", async () => {
      vi.mocked(inventoryService.deactivateProduct).mockResolvedValue({
        id: "p-1",
        brand: "MRF",
        size: "195/65 R15",
        pattern: "ZVTV",
        unitPrice: 4500 as unknown as import("@prisma/client").Prisma.Decimal,
        averageCostPrice: 3800 as unknown as import("@prisma/client").Prisma.Decimal,
        quantityOnHand: 10,
        minStockAlert: 4,
        notes: null,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new Request("http://localhost:3000/api/inventory/products/p-1", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          host: "localhost:3000",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          action: "DEACTIVATE",
        }),
      });

      const response = await patchProductRoute(request, { params: Promise.resolve({ id: "p-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe("Product deactivated.");
    });
  });

  describe("POST /api/inventory/adjust", () => {
    it("adjusts stock and returns updated product and movement record", async () => {
      vi.mocked(inventoryService.adjustStock).mockResolvedValue({
        product: {
          id: "p-1",
          quantityOnHand: 12,
        } as unknown as import("@prisma/client").Product,
        movement: {
          id: "mov-1",
          quantityDelta: 2,
          balanceAfter: 12,
        } as unknown as import("@prisma/client").InventoryMovement,
        message: "Stock successfully adjusted from 10 to 12 (+2).",
      });

      const request = new Request("http://localhost:3000/api/inventory/adjust", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          host: "localhost:3000",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          productId: "p-1",
          adjustmentType: "ADD",
          quantity: 2,
          reason: "Physical count correction",
        }),
      });

      const response = await adjustStockRoute(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.quantityOnHand).toBe(12);
    });
  });

  describe("GET /api/inventory/movements", () => {
    it("returns inventory movement history", async () => {
      vi.mocked(inventoryService.listInventoryMovements).mockResolvedValue({
        movements: [
          {
            id: "mov-1",
            productId: "p-1",
            movementType: "ADJUSTMENT_IN",
            quantityDelta: 2,
            balanceAfter: 12,
            referenceType: "MANUAL_ADJUSTMENT",
            referenceId: null,
            reason: "Physical count correction",
            actorId: "admin-1",
            createdAt: new Date(),
            product: { id: "p-1", brand: "MRF", size: "195/65 R15", pattern: "ZVTV" },
            actor: { id: "admin-1", fullName: "Admin Owner", username: "owner" },
          },
        ],
        pagination: { page: 1, limit: 50, totalCount: 1, totalPages: 1 },
      });

      const request = new Request("http://localhost:3000/api/inventory/movements");
      const response = await getMovementsRoute(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
    });
  });
});
