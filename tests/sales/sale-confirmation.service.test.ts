import { describe, it, expect, vi, beforeEach } from "vitest";
import { confirmSale } from "@/services/sale.service";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { Prisma, type Sale, type Product } from "@prisma/client";
import type { AuthActor } from "@/lib/auth/permissions";

vi.mock("@/lib/db", () => {
  return {
    db: {
      sale: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
      },
      saleItem: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
        update: vi.fn(),
      },
      product: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      customer: {
        findUnique: vi.fn(),
      },
      inventoryMovement: {
        create: vi.fn(),
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

describe("Sale Confirmation & Inventory Deduction Service Unit Tests", () => {
  const adminActor: AuthActor = { id: "admin-1", role: "ADMIN_OWNER" };
  const staffActor: AuthActor = { id: "staff-1", role: "STAFF" };
  const otherStaffActor: AuthActor = { id: "staff-2", role: "STAFF" };

  const mockProduct: Partial<Product> = {
    id: "prod-1",
    brand: "Apollo",
    size: "205/55 R16",
    pattern: "Alnac 4G",
    unitPrice: new Prisma.Decimal(6500),
    averageCostPrice: new Prisma.Decimal(5200),
    quantityOnHand: 10,
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Basic Sale Confirmation", () => {
    it("confirms a draft sale and decrements physical inventory", async () => {
      const draftSale = {
        id: "sale-1",
        invoiceNumber: "SALE-1001",
        status: "DRAFT",
        paymentStatus: "UNPAID",
        createdById: "staff-1",
        subtotal: new Prisma.Decimal(26000),
        discountAmount: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(26000),
        items: [
          {
            id: "item-1",
            productId: "prod-1",
            quantity: 4,
            unitPrice: new Prisma.Decimal(6500),
            costPrice: new Prisma.Decimal(5200),
            discountAmount: new Prisma.Decimal(0),
            totalPrice: new Prisma.Decimal(26000),
            product: mockProduct,
          },
        ],
      };

      vi.mocked(db.sale.findUnique).mockResolvedValue(draftSale as unknown as Sale);
      vi.mocked(db.product.findUnique).mockResolvedValue(mockProduct as Product);
      vi.mocked(db.product.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(db.inventoryMovement.create).mockResolvedValue({ id: "mov-1" } as unknown as Awaited<ReturnType<typeof db.inventoryMovement.create>>);
      vi.mocked(db.sale.update).mockResolvedValue({
        ...draftSale,
        status: "COMPLETED",
      } as unknown as Sale);

      const result = await confirmSale("sale-1", staffActor);

      expect(result.status).toBe("COMPLETED");

      // Verify atomic conditional decrement: 10 - 4 = 6
      expect(db.product.updateMany).toHaveBeenCalledWith({
        where: {
          id: "prod-1",
          quantityOnHand: { gte: 4 },
        },
        data: {
          quantityOnHand: { decrement: 4 },
        },
      });

      // Verify immutable SALE InventoryMovement creation
      expect(db.inventoryMovement.create).toHaveBeenCalledWith({
        data: {
          productId: "prod-1",
          movementType: "SALE",
          quantityDelta: -4,
          balanceAfter: 6,
          referenceType: "Sale",
          referenceId: "sale-1",
          reason: "Sale SALE-1001",
          actorId: "staff-1",
        },
      });

      // Verify Audit Log
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "SALE_CONFIRMED",
            entityId: "sale-1",
          }),
        })
      );
    });

    it("confirms a draft sale with multiple distinct tyre products", async () => {
      const mockProduct2: Partial<Product> = {
        id: "prod-2",
        brand: "MRF",
        size: "175/65 R14",
        unitPrice: new Prisma.Decimal(4000),
        averageCostPrice: new Prisma.Decimal(3200),
        quantityOnHand: 8,
        isActive: true,
      };

      const multiItemDraft = {
        id: "sale-2",
        invoiceNumber: "SALE-1002",
        status: "DRAFT",
        paymentStatus: "UNPAID",
        createdById: "admin-1",
        subtotal: new Prisma.Decimal(21000),
        discountAmount: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(21000),
        items: [
          {
            id: "item-1",
            productId: "prod-1",
            quantity: 2,
            unitPrice: new Prisma.Decimal(6500),
            costPrice: new Prisma.Decimal(5200),
            discountAmount: new Prisma.Decimal(0),
            totalPrice: new Prisma.Decimal(13000),
            product: mockProduct,
          },
          {
            id: "item-2",
            productId: "prod-2",
            quantity: 2,
            unitPrice: new Prisma.Decimal(4000),
            costPrice: new Prisma.Decimal(3200),
            discountAmount: new Prisma.Decimal(0),
            totalPrice: new Prisma.Decimal(8000),
            product: mockProduct2,
          },
        ],
      };

      vi.mocked(db.sale.findUnique).mockResolvedValue(multiItemDraft as unknown as Sale);
      vi.mocked(db.product.findUnique)
        .mockResolvedValueOnce(mockProduct as Product)
        .mockResolvedValueOnce(mockProduct2 as Product);
      vi.mocked(db.product.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(db.sale.update).mockResolvedValue({
        ...multiItemDraft,
        status: "COMPLETED",
      } as unknown as Sale);

      const result = await confirmSale("sale-2", adminActor);

      expect(result.status).toBe("COMPLETED");
      expect(db.product.updateMany).toHaveBeenCalledTimes(2);
      expect(db.inventoryMovement.create).toHaveBeenCalledTimes(2);
    });
  });

  describe("2. Stock Protection & Insufficient Stock Invariants", () => {
    it("rejects confirmation when requested quantity exceeds available physical stock", async () => {
      const draftSale = {
        id: "sale-1",
        invoiceNumber: "SALE-1001",
        status: "DRAFT",
        createdById: "staff-1",
        items: [
          {
            id: "item-1",
            productId: "prod-1",
            quantity: 12, // Wants 12 but only 10 available
            unitPrice: new Prisma.Decimal(6500),
            costPrice: new Prisma.Decimal(5200),
            discountAmount: new Prisma.Decimal(0),
            totalPrice: new Prisma.Decimal(78000),
            product: mockProduct,
          },
        ],
      };

      vi.mocked(db.sale.findUnique).mockResolvedValue(draftSale as unknown as Sale);
      vi.mocked(db.product.findUnique).mockResolvedValue({
        ...mockProduct,
        quantityOnHand: 10,
      } as Product);

      try {
        await confirmSale("sale-1", staffActor);
        expect.unreachable("Should have rejected insufficient stock");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.statusCode).toBe(400);
        expect(appErr.userMessage).toContain('Insufficient stock for "Apollo 205/55 R16". Only 10 available');
      }

      // Stock must NOT be deducted
      expect(db.product.updateMany).not.toHaveBeenCalled();
      // No movement created
      expect(db.inventoryMovement.create).not.toHaveBeenCalled();
      // Sale status must NOT be updated
      expect(db.sale.update).not.toHaveBeenCalled();
    });

    it("rejects confirmation when product is deactivated", async () => {
      const draftSale = {
        id: "sale-1",
        invoiceNumber: "SALE-1001",
        status: "DRAFT",
        createdById: "staff-1",
        items: [
          {
            id: "item-1",
            productId: "prod-1",
            quantity: 2,
            unitPrice: new Prisma.Decimal(6500),
            costPrice: new Prisma.Decimal(5200),
            discountAmount: new Prisma.Decimal(0),
            totalPrice: new Prisma.Decimal(13000),
            product: { ...mockProduct, isActive: false },
          },
        ],
      };

      vi.mocked(db.sale.findUnique).mockResolvedValue(draftSale as unknown as Sale);
      vi.mocked(db.product.findUnique).mockResolvedValue({
        ...mockProduct,
        isActive: false,
      } as Product);

      await expect(confirmSale("sale-1", staffActor)).rejects.toThrow(
        "Product Apollo 205/55 R16 is deactivated"
      );
    });
  });

  describe("3. Concurrency Protection & Competing Sales (Crucial Scenario)", () => {
    it("safely handles competing sales: initial stock = 4, Sale A = 4, Sale B = 2 -> one succeeds, other rejected with no negative stock", async () => {
      const stock4Product: Product = {
        id: "prod-concurrent",
        brand: "Bridgestone",
        size: "195/65 R15",
        pattern: "B290",
        unitPrice: new Prisma.Decimal(5000),
        averageCostPrice: new Prisma.Decimal(4000),
        quantityOnHand: 4,
        isActive: true,
        minStockAlert: 2,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const saleDraftA = {
        id: "sale-A",
        invoiceNumber: "SALE-A",
        status: "DRAFT",
        createdById: "staff-1",
        subtotal: new Prisma.Decimal(20000),
        discountAmount: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(20000),
        items: [
          {
            id: "item-A",
            productId: "prod-concurrent",
            quantity: 4,
            unitPrice: new Prisma.Decimal(5000),
            costPrice: new Prisma.Decimal(4000),
            discountAmount: new Prisma.Decimal(0),
            totalPrice: new Prisma.Decimal(20000),
            product: stock4Product,
          },
        ],
      };

      const saleDraftB = {
        id: "sale-B",
        invoiceNumber: "SALE-B",
        status: "DRAFT",
        createdById: "staff-2",
        subtotal: new Prisma.Decimal(10000),
        discountAmount: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(10000),
        items: [
          {
            id: "item-B",
            productId: "prod-concurrent",
            quantity: 2,
            unitPrice: new Prisma.Decimal(5000),
            costPrice: new Prisma.Decimal(4000),
            discountAmount: new Prisma.Decimal(0),
            totalPrice: new Prisma.Decimal(10000),
            product: stock4Product,
          },
        ],
      };

      // Sale A executes first and succeeds
      vi.mocked(db.sale.findUnique).mockResolvedValueOnce(saleDraftA as unknown as Sale);
      vi.mocked(db.product.findUnique).mockResolvedValueOnce(stock4Product);
      vi.mocked(db.product.updateMany).mockResolvedValueOnce({ count: 1 }); // Success for A
      vi.mocked(db.sale.update).mockResolvedValueOnce({
        ...saleDraftA,
        status: "COMPLETED",
      } as unknown as Sale);

      const resultA = await confirmSale("sale-A", staffActor);
      expect(resultA.status).toBe("COMPLETED");

      // Sale B executes concurrently:
      // When Sale B tries to atomically decrement with gte: 2, count is 0 because stock has become 0
      vi.mocked(db.sale.findUnique).mockResolvedValueOnce(saleDraftB as unknown as Sale);
      vi.mocked(db.product.findUnique).mockResolvedValueOnce(stock4Product);
      vi.mocked(db.product.updateMany).mockResolvedValueOnce({ count: 0 }); // Concurrent collision!

      try {
        await confirmSale("sale-B", otherStaffActor);
        expect.unreachable("Sale B should have failed due to concurrent stock exhaustion");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.statusCode).toBe(400);
        expect(appErr.userMessage).toContain("Stock was modified by another transaction");
      }
    });
  });

  describe("4. Idempotency & Repeat Confirmations", () => {
    it("safely returns existing completed sale without double deducting inventory when confirmed twice", async () => {
      const alreadyCompletedSale = {
        id: "sale-completed",
        invoiceNumber: "SALE-1001",
        status: "COMPLETED",
        paymentStatus: "UNPAID",
        createdById: "staff-1",
        items: [
          {
            id: "item-1",
            productId: "prod-1",
            quantity: 4,
            unitPrice: new Prisma.Decimal(6500),
            costPrice: new Prisma.Decimal(5200),
            discountAmount: new Prisma.Decimal(0),
            totalPrice: new Prisma.Decimal(26000),
            product: mockProduct,
          },
        ],
      };

      vi.mocked(db.sale.findUnique).mockResolvedValue(alreadyCompletedSale as unknown as Sale);

      const result = await confirmSale("sale-completed", staffActor);

      expect(result.status).toBe("COMPLETED");
      // CRITICAL IDEMPOTENCY INVARIANTS:
      // Product stock must NOT be decremented again
      expect(db.product.updateMany).not.toHaveBeenCalled();
      // No duplicate InventoryMovement
      expect(db.inventoryMovement.create).not.toHaveBeenCalled();
      // No duplicate AuditLog
      expect(db.auditLog.create).not.toHaveBeenCalled();
    });
  });

  describe("5. Scoped Authorization & IDOR Protection", () => {
    it("blocks STAFF (sales:view_history = OWN) from confirming sales created by another user", async () => {
      const otherUserSale = {
        id: "sale-other",
        invoiceNumber: "SALE-9999",
        status: "DRAFT",
        createdById: "admin-1", // Created by Admin
        items: [{ id: "item-1", productId: "prod-1", quantity: 1, product: mockProduct }],
      };

      vi.mocked(db.sale.findUnique).mockResolvedValue(otherUserSale as unknown as Sale);

      try {
        await confirmSale("sale-other", staffActor); // Staff attempting IDOR confirmation
        expect.unreachable("Should have rejected IDOR confirmation attempt");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.statusCode).toBe(403);
        expect(appErr.userMessage).toBe("You do not have permission to confirm this sale.");
      }
    });

    it("allows ADMIN_OWNER (sales:view_history = ALL) to confirm any staff draft sale", async () => {
      const staffSale = {
        id: "sale-staff",
        invoiceNumber: "SALE-1005",
        status: "DRAFT",
        createdById: "staff-1",
        subtotal: new Prisma.Decimal(6500),
        discountAmount: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(6500),
        items: [
          {
            id: "item-1",
            productId: "prod-1",
            quantity: 1,
            unitPrice: new Prisma.Decimal(6500),
            costPrice: new Prisma.Decimal(5200),
            discountAmount: new Prisma.Decimal(0),
            totalPrice: new Prisma.Decimal(6500),
            product: mockProduct,
          },
        ],
      };

      vi.mocked(db.sale.findUnique).mockResolvedValue(staffSale as unknown as Sale);
      vi.mocked(db.product.findUnique).mockResolvedValue(mockProduct as Product);
      vi.mocked(db.product.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(db.sale.update).mockResolvedValue({
        ...staffSale,
        status: "COMPLETED",
      } as unknown as Sale);

      const result = await confirmSale("sale-staff", adminActor);
      expect(result.status).toBe("COMPLETED");
    });
  });
});
