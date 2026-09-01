import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deactivateProduct,
  reactivateProduct,
  adjustStock,
  listInventoryMovements,
} from "@/services/inventory.service";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { Prisma, type Product, type InventoryMovement } from "@prisma/client";
import type { AuthActor } from "@/lib/auth/permissions";

// Mock db for unit tests
vi.mock("@/lib/db", () => {
  return {
    db: {
      product: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
        aggregate: vi.fn(),
      },
      inventoryMovement: {
        findMany: vi.fn(),
        create: vi.fn(),
        count: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        return cb(db);
      }),
    },
  };
});

describe("Inventory Service Unit Tests", () => {
  const adminActor: AuthActor = { id: "admin-1", role: "ADMIN_OWNER" };
  const managerActor: AuthActor = { id: "manager-1", role: "MANAGER" };
  const staffActor: AuthActor = { id: "staff-1", role: "STAFF" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Product Creation & Validation", () => {
    it("creates a valid product without initial stock", async () => {
      const mockCreated: Partial<Product> = {
        id: "prod-1",
        brand: "MRF",
        size: "195/65 R15",
        pattern: "ZVTV",
        unitPrice: new Prisma.Decimal(4500),
        averageCostPrice: new Prisma.Decimal(3800),
        quantityOnHand: 0,
        minStockAlert: 4,
        isActive: true,
      };

      vi.mocked(db.product.create).mockResolvedValue(mockCreated as Product);

      const result = await createProduct(
        {
          brand: "MRF",
          size: "195/65 R15",
          pattern: "ZVTV",
          unitPrice: 4500,
          averageCostPrice: 3800,
        },
        adminActor
      );

      expect(result.id).toBe("prod-1");
      expect(db.product.create).toHaveBeenCalled();
      expect(db.inventoryMovement.create).not.toHaveBeenCalled();
      expect(db.auditLog.create).toHaveBeenCalled();
    });

    it("creates product with initial stock and logs initial ADJUSTMENT_IN movement atomically", async () => {
      const mockCreated: Partial<Product> = {
        id: "prod-2",
        brand: "Apollo",
        size: "205/55 R16",
        pattern: "Alnac 4G",
        unitPrice: new Prisma.Decimal(5200),
        quantityOnHand: 10,
        minStockAlert: 4,
        isActive: true,
      };

      vi.mocked(db.product.create).mockResolvedValue(mockCreated as Product);
      vi.mocked(db.inventoryMovement.create).mockResolvedValue({} as InventoryMovement);

      const result = await createProduct(
        {
          brand: "Apollo",
          size: "205/55 R16",
          pattern: "Alnac 4G",
          unitPrice: 5200,
          initialQuantity: 10,
        },
        adminActor
      );

      expect(result.id).toBe("prod-2");
      expect(db.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: "prod-2",
            movementType: "ADJUSTMENT_IN",
            quantityDelta: 10,
            balanceAfter: 10,
            referenceType: "INITIAL_STOCK",
          }),
        })
      );
    });

    it("rejects product with missing brand or size", async () => {
      await expect(
        createProduct(
          {
            brand: "",
            size: "195/65 R15",
            unitPrice: 4500,
          },
          adminActor
        )
      ).rejects.toThrow("Brand is required");

      await expect(
        createProduct(
          {
            brand: "MRF",
            size: "",
            unitPrice: 4500,
          },
          adminActor
        )
      ).rejects.toThrow("Size is required");
    });

    it("rejects product with negative price", async () => {
      await expect(
        createProduct(
          {
            brand: "MRF",
            size: "195/65 R15",
            unitPrice: -100,
          },
          adminActor
        )
      ).rejects.toThrow("Invalid unit price");
    });

    it("prevents duplicate products with friendly error", async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7.10.0",
      });

      vi.mocked(db.product.create).mockRejectedValue(p2002Error);

      try {
        await createProduct(
          {
            brand: "MRF",
            size: "195/65 R15",
            pattern: "ZVTV",
            unitPrice: 4500,
          },
          adminActor
        );
        expect.unreachable("Should have thrown duplicate error");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.type).toBe("VALIDATION");
        expect(appErr.userMessage).toContain("already exists");
      }
    });
  });

  describe("Product Updates & Deactivation", () => {
    const existingProduct: Partial<Product> = {
      id: "prod-1",
      brand: "MRF",
      size: "195/65 R15",
      pattern: "ZVTV",
      unitPrice: new Prisma.Decimal(4500),
      quantityOnHand: 8,
      minStockAlert: 4,
      isActive: true,
    };

    it("allows ADMIN_OWNER to edit selling price", async () => {
      vi.mocked(db.product.findUnique).mockResolvedValue(existingProduct as Product);
      vi.mocked(db.product.update).mockResolvedValue({
        ...existingProduct,
        unitPrice: new Prisma.Decimal(4700),
      } as Product);

      const result = await updateProduct("prod-1", { unitPrice: 4700 }, adminActor);
      expect(result.unitPrice.toString()).toBe("4700");
    });

    it("blocks STAFF from editing selling price (prices:edit required)", async () => {
      vi.mocked(db.product.findUnique).mockResolvedValue(existingProduct as Product);

      try {
        await updateProduct("prod-1", { unitPrice: 4700 }, staffActor);
        expect.unreachable("Should have thrown 403 authorization error");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.statusCode).toBe(403);
        expect(appErr.type).toBe("AUTHORIZATION");
      }
    });

    it("soft-deactivates product without deleting historical records", async () => {
      vi.mocked(db.product.findUnique).mockResolvedValue(existingProduct as Product);
      vi.mocked(db.product.update).mockResolvedValue({
        ...existingProduct,
        isActive: false,
      } as Product);

      const result = await deactivateProduct("prod-1", adminActor);
      expect(result.isActive).toBe(false);
      expect(db.product.update).toHaveBeenCalledWith({
        where: { id: "prod-1" },
        data: { isActive: false },
      });
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "PRODUCT_DEACTIVATED" }),
        })
      );
    });

    it("reactivates a soft-deactivated product", async () => {
      vi.mocked(db.product.findUnique).mockResolvedValue({
        ...existingProduct,
        isActive: false,
      } as Product);
      vi.mocked(db.product.update).mockResolvedValue({
        ...existingProduct,
        isActive: true,
      } as Product);

      const result = await reactivateProduct("prod-1", adminActor);
      expect(result.isActive).toBe(true);
    });
  });

  describe("Manual Stock Adjustments & Ledger Recording", () => {
    const productWithStock: Partial<Product> = {
      id: "prod-1",
      brand: "MRF",
      size: "195/65 R15",
      pattern: "ZVTV",
      quantityOnHand: 4,
      isActive: true,
    };

    it("performs positive adjustment (ADD) and records ADJUSTMENT_IN movement", async () => {
      vi.mocked(db.product.findUnique).mockResolvedValue(productWithStock as Product);
      vi.mocked(db.product.update).mockResolvedValue({
        ...productWithStock,
        quantityOnHand: 6,
      } as Product);
      vi.mocked(db.inventoryMovement.create).mockResolvedValue({
        id: "mov-1",
        productId: "prod-1",
        movementType: "ADJUSTMENT_IN",
        quantityDelta: 2,
        balanceAfter: 6,
      } as InventoryMovement);

      const result = await adjustStock(
        {
          productId: "prod-1",
          adjustmentType: "ADD",
          quantity: 2,
          reason: "Physical count correction",
          notes: "Found 2 extra on upper rack",
        },
        adminActor
      );

      expect(result.product.quantityOnHand).toBe(6);
      expect(db.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: "prod-1",
            movementType: "ADJUSTMENT_IN",
            quantityDelta: 2,
            balanceAfter: 6,
            referenceType: "MANUAL_ADJUSTMENT",
            reason: "Physical count correction: Found 2 extra on upper rack",
            actorId: "admin-1",
          }),
        })
      );
      expect(db.auditLog.create).toHaveBeenCalled();
    });

    it("performs negative adjustment (REMOVE) and records ADJUSTMENT_OUT movement", async () => {
      vi.mocked(db.product.findUnique).mockResolvedValue(productWithStock as Product);
      vi.mocked(db.product.update).mockResolvedValue({
        ...productWithStock,
        quantityOnHand: 3,
      } as Product);
      vi.mocked(db.inventoryMovement.create).mockResolvedValue({
        id: "mov-2",
        productId: "prod-1",
        movementType: "ADJUSTMENT_OUT",
        quantityDelta: -1,
        balanceAfter: 3,
      } as InventoryMovement);

      const result = await adjustStock(
        {
          productId: "prod-1",
          adjustmentType: "REMOVE",
          quantity: 1,
          reason: "Damaged tyre",
        },
        adminActor
      );

      expect(result.product.quantityOnHand).toBe(3);
      expect(db.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: "prod-1",
            movementType: "ADJUSTMENT_OUT",
            quantityDelta: -1,
            balanceAfter: 3,
          }),
        })
      );
    });

    it("performs SET_ACTUAL adjustment calculating positive or negative delta correctly", async () => {
      vi.mocked(db.product.findUnique).mockResolvedValue(productWithStock as Product); // QOH = 4
      vi.mocked(db.product.update).mockResolvedValue({
        ...productWithStock,
        quantityOnHand: 7,
      } as Product);
      vi.mocked(db.inventoryMovement.create).mockResolvedValue({
        id: "mov-3",
        quantityDelta: 3,
        balanceAfter: 7,
      } as InventoryMovement);

      const result = await adjustStock(
        {
          productId: "prod-1",
          adjustmentType: "SET_ACTUAL",
          actualCount: 7,
          reason: "Physical count correction",
        },
        adminActor
      );

      expect(result.product.quantityOnHand).toBe(7);
      expect(db.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            quantityDelta: 3,
            balanceAfter: 7,
          }),
        })
      );
    });

    it("strictly prevents negative stock (cannot remove more than available)", async () => {
      vi.mocked(db.product.findUnique).mockResolvedValue(productWithStock as Product); // QOH = 4

      try {
        await adjustStock(
          {
            productId: "prod-1",
            adjustmentType: "REMOVE",
            quantity: 5, // 4 - 5 = -1
            reason: "Damaged tyre",
          },
          adminActor
        );
        expect.unreachable("Should have thrown negative stock error");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.type).toBe("VALIDATION");
        expect(appErr.userMessage).toContain("Cannot remove 5 tyres. Only 4 tyre(s) currently in stock.");
      }
    });

    it("requires controlled adjustment reason", async () => {
      vi.mocked(db.product.findUnique).mockResolvedValue(productWithStock as Product);

      try {
        await adjustStock(
          {
            productId: "prod-1",
            adjustmentType: "ADD",
            quantity: 1,
            reason: "",
          },
          adminActor
        );
        expect.unreachable("Should have thrown missing reason error");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.message).toContain("Adjustment reason is required");
      }
    });

    it("strictly blocks unauthorized users (Staff/Manager) from adjusting stock (inventory:adjust required)", async () => {
      try {
        await adjustStock(
          {
            productId: "prod-1",
            adjustmentType: "ADD",
            quantity: 2,
            reason: "Physical count correction",
          },
          staffActor
        );
        expect.unreachable("Should have thrown 403 for staff");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.statusCode).toBe(403);
      }

      try {
        await adjustStock(
          {
            productId: "prod-1",
            adjustmentType: "ADD",
            quantity: 2,
            reason: "Physical count correction",
          },
          managerActor
        );
        expect.unreachable("Should have thrown 403 for manager");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.statusCode).toBe(403);
      }
    });
  });

  describe("Product Listing & Movement Ledger Queries", () => {
    it("lists products with search and pagination metrics", async () => {
      const mockProducts = [
        { id: "1", brand: "MRF", size: "195/65 R15", pattern: "ZVTV", quantityOnHand: 8, minStockAlert: 4, isActive: true },
        { id: "2", brand: "Apollo", size: "205/55 R16", pattern: "Alnac", quantityOnHand: 2, minStockAlert: 4, isActive: true },
      ];

      vi.mocked(db.product.findMany).mockResolvedValue(mockProducts as Product[]);
      vi.mocked(db.product.count).mockResolvedValue(2);
      vi.mocked(db.product.aggregate).mockResolvedValue({
        _sum: { quantityOnHand: 10 },
        _count: { id: 2 },
        _avg: {},
        _min: {},
        _max: {},
      } as unknown as Record<string, unknown> as never);

      const result = await listProducts({ search: "MRF" }, staffActor);

      expect(result.products).toHaveLength(2);
      expect(result.metrics.totalPhysicalTyres).toBe(10);
      expect(result.metrics.totalActiveProducts).toBe(2);
      expect(result.pagination.totalCount).toBe(2);
    });

    it("retrieves single product by ID with recent movements", async () => {
      const mockProduct = {
        id: "prod-1",
        brand: "MRF",
        size: "195/65 R15",
        pattern: "ZVTV",
        inventoryMovements: [],
      };

      vi.mocked(db.product.findUnique).mockResolvedValue(mockProduct as unknown as Product);

      const result = await getProductById("prod-1", staffActor);
      expect(result.id).toBe("prod-1");
    });

    it("lists inventory movements with product and actor details", async () => {
      const mockMovements = [
        {
          id: "mov-1",
          productId: "prod-1",
          movementType: "ADJUSTMENT_IN",
          quantityDelta: 5,
          balanceAfter: 5,
          product: { id: "prod-1", brand: "MRF", size: "195/65 R15", pattern: "ZVTV" },
          actor: { id: "admin-1", fullName: "Admin Owner", username: "owner" },
          createdAt: new Date(),
        },
      ];

      vi.mocked(db.inventoryMovement.findMany).mockResolvedValue(mockMovements as unknown as InventoryMovement[]);
      vi.mocked(db.inventoryMovement.count).mockResolvedValue(1);

      const result = await listInventoryMovements({ productId: "prod-1" }, staffActor);

      expect(result.movements).toHaveLength(1);
      expect(result.movements[0].quantityDelta).toBe(5);
    });
  });
});
