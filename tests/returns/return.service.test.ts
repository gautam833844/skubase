import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createSaleReturn,
  getSaleReturnableItems,
  getSaleReturns,
} from "@/services/return.service";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { AuthActor } from "@/lib/auth/permissions";

const { mockTx } = vi.hoisted(() => {
  const tx = {
    sale: {
      findUnique: vi.fn(),
    },
    saleReturn: {
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    saleReturnItem: {
      create: vi.fn(),
    },
    product: {
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    inventoryMovement: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
  return { mockTx: tx };
});

vi.mock("@/lib/db", () => {
  return {
    db: {
      sale: {
        findUnique: vi.fn(),
      },
      saleReturn: {
        count: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => {
        return cb(mockTx);
      }),
    },
  };
});

describe("Return Service (src/services/return.service.ts)", () => {
  const mockAdmin: AuthActor = {
    id: "admin-1",
    role: "ADMIN_OWNER",
  };

  const mockStaff: AuthActor = {
    id: "staff-1",
    role: "STAFF",
  };

  const mockProduct = {
    id: "prod-1",
    brand: "MRF",
    size: "195/65 R15",
    pattern: "ZLX",
    quantityOnHand: 6,
  };

  const mockSaleItem = {
    id: "item-1",
    saleId: "sale-1",
    productId: "prod-1",
    quantity: 4,
    unitPrice: new Prisma.Decimal(5000),
    totalPrice: new Prisma.Decimal(20000),
    product: mockProduct,
    returnItems: [],
  };

  const mockSale = {
    id: "sale-1",
    invoiceNumber: "SALE-1001",
    customerId: "cust-1",
    status: "COMPLETED",
    subtotal: new Prisma.Decimal(20000),
    totalAmount: new Prisma.Decimal(20000),
    createdById: "admin-1",
    customer: { id: "cust-1", name: "Ramesh Sharma" },
    items: [mockSaleItem],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSaleReturnableItems", () => {
    it("calculates returnable quantities correctly for a completed sale", async () => {
      vi.mocked(db.sale.findUnique).mockResolvedValue(mockSale as unknown as Awaited<ReturnType<typeof db.sale.findUnique>>);

      const items = await getSaleReturnableItems("sale-1", mockAdmin);

      expect(items).toHaveLength(1);
      expect(items[0].saleItemId).toBe("item-1");
      expect(items[0].soldQuantity).toBe(4);
      expect(items[0].alreadyReturnedQuantity).toBe(0);
      expect(items[0].returnableQuantity).toBe(4);
      expect(items[0].unitPrice).toBe("5000");
    });

    it("subtracts previously completed returns from returnable quantity", async () => {
      const saleWithPriorReturn = {
        ...mockSale,
        items: [
          {
            ...mockSaleItem,
            returnItems: [
              {
                quantity: 1,
                return: { status: "COMPLETED" },
              },
            ],
          },
        ],
      };

      vi.mocked(db.sale.findUnique).mockResolvedValue(saleWithPriorReturn as unknown as Awaited<ReturnType<typeof db.sale.findUnique>>);

      const items = await getSaleReturnableItems("sale-1", mockAdmin);

      expect(items[0].soldQuantity).toBe(4);
      expect(items[0].alreadyReturnedQuantity).toBe(1);
      expect(items[0].returnableQuantity).toBe(3);
    });

    it("enforces IDOR protection when staff tries to view another user's sale", async () => {
      vi.mocked(db.sale.findUnique).mockResolvedValue({
        ...mockSale,
        createdById: "other-user",
      } as unknown as Awaited<ReturnType<typeof db.sale.findUnique>>);

      await expect(getSaleReturnableItems("sale-1", mockStaff)).rejects.toThrow(
        "cannot view returns for sale"
      );
    });
  });

  describe("createSaleReturn", () => {
    it("creates a valid partial return and restores sellable inventory", async () => {
      mockTx.sale.findUnique.mockResolvedValue(mockSale);
      mockTx.saleReturn.count.mockResolvedValue(0);
      mockTx.saleReturn.findUnique.mockResolvedValue(null);
      mockTx.saleReturn.create.mockResolvedValue({
        id: "return-1",
        returnNumber: "RET-1001",
        saleId: "sale-1",
        customerId: "cust-1",
        totalAmount: new Prisma.Decimal(5000),
        refundAmount: new Prisma.Decimal(0),
        status: "COMPLETED",
        refundStatus: "PENDING",
        reason: "Customer changed mind",
        notes: null,
        returnDate: new Date("2026-09-01T10:00:00Z"),
        createdAt: new Date("2026-09-01T10:00:00Z"),
      });
      mockTx.saleReturnItem.create.mockResolvedValue({
        id: "ret-item-1",
        returnId: "return-1",
        saleItemId: "item-1",
        productId: "prod-1",
        quantity: 1,
        unitPrice: new Prisma.Decimal(5000),
        totalPrice: new Prisma.Decimal(5000),
        condition: "SELLABLE",
        reason: null,
      });
      mockTx.product.findUniqueOrThrow.mockResolvedValue({
        ...mockProduct,
        quantityOnHand: 7, // 6 + 1
      });

      const result = await createSaleReturn(
        {
          saleId: "sale-1",
          items: [{ saleItemId: "item-1", quantity: 1, condition: "SELLABLE" }],
          reason: "Customer changed mind",
          refundStatus: "PENDING",
        },
        mockAdmin
      );

      expect(result.returnNumber).toBe("RET-1001");
      expect(result.totalAmount).toBe("5000");
      expect(result.items[0].quantity).toBe(1);
      expect(result.items[0].condition).toBe("SELLABLE");

      // Verify inventory restoration
      expect(mockTx.product.update).toHaveBeenCalledWith({
        where: { id: "prod-1" },
        data: { quantityOnHand: { increment: 1 } },
      });

      // Verify SALE_RETURN inventory ledger movement
      expect(mockTx.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId: "prod-1",
          movementType: "SALE_RETURN",
          quantityDelta: 1,
          balanceAfter: 7,
          referenceType: "SaleReturn",
          referenceId: "return-1",
          actorId: "admin-1",
        }),
      });

      // Verify audit log
      expect(mockTx.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "RETURN_CREATED",
          entityName: "SaleReturn",
          entityId: "return-1",
          actorId: "admin-1",
        }),
      });
    });

    it("does NOT restore stock for DAMAGED returned items", async () => {
      mockTx.sale.findUnique.mockResolvedValue(mockSale);
      mockTx.saleReturn.count.mockResolvedValue(0);
      mockTx.saleReturn.findUnique.mockResolvedValue(null);
      mockTx.saleReturn.create.mockResolvedValue({
        id: "return-2",
        returnNumber: "RET-1001",
        saleId: "sale-1",
        customerId: "cust-1",
        totalAmount: new Prisma.Decimal(5000),
        refundAmount: new Prisma.Decimal(0),
        status: "COMPLETED",
        refundStatus: "PENDING",
        reason: "Tyre sidewall burst on road",
        notes: null,
        returnDate: new Date("2026-09-01T10:00:00Z"),
        createdAt: new Date("2026-09-01T10:00:00Z"),
      });
      mockTx.saleReturnItem.create.mockResolvedValue({
        id: "ret-item-2",
        returnId: "return-2",
        saleItemId: "item-1",
        productId: "prod-1",
        quantity: 1,
        unitPrice: new Prisma.Decimal(5000),
        totalPrice: new Prisma.Decimal(5000),
        condition: "DAMAGED",
        reason: "Tyre sidewall burst on road",
      });

      const result = await createSaleReturn(
        {
          saleId: "sale-1",
          items: [{ saleItemId: "item-1", quantity: 1, condition: "DAMAGED" }],
          reason: "Tyre sidewall burst on road",
        },
        mockAdmin
      );

      expect(result.items[0].condition).toBe("DAMAGED");
      // Product stock should NOT be incremented for damaged returns
      expect(mockTx.product.update).not.toHaveBeenCalled();
      expect(mockTx.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it("rejects returns on DRAFT sales", async () => {
      mockTx.sale.findUnique.mockResolvedValue({
        ...mockSale,
        status: "DRAFT",
      });

      await expect(
        createSaleReturn(
          {
            saleId: "sale-1",
            items: [{ saleItemId: "item-1", quantity: 1 }],
          },
          mockAdmin
        )
      ).rejects.toThrow("Only COMPLETED sales support returns");
    });

    it("rejects return if quantity exceeds available returnable quantity", async () => {
      mockTx.sale.findUnique.mockResolvedValue({
        ...mockSale,
        items: [
          {
            ...mockSaleItem,
            returnItems: [
              {
                quantity: 3,
                return: { status: "COMPLETED" },
              },
            ],
          },
        ],
      });

      // sold 4, already returned 3, trying to return 2
      await expect(
        createSaleReturn(
          {
            saleId: "sale-1",
            items: [{ saleItemId: "item-1", quantity: 2 }],
          },
          mockAdmin
        )
      ).rejects.toThrow("Maximum returnable is");
    });

    it("rejects zero or negative return quantities", async () => {
      mockTx.sale.findUnique.mockResolvedValue(mockSale);

      await expect(
        createSaleReturn(
          {
            saleId: "sale-1",
            items: [{ saleItemId: "item-1", quantity: 0 }],
          },
          mockAdmin
        )
      ).rejects.toThrow("Return quantity must be a positive integer");

      await expect(
        createSaleReturn(
          {
            saleId: "sale-1",
            items: [{ saleItemId: "item-1", quantity: -2 }],
          },
          mockAdmin
        )
      ).rejects.toThrow("Return quantity must be a positive integer");
    });

    it("rejects refund amounts exceeding the return value", async () => {
      mockTx.sale.findUnique.mockResolvedValue(mockSale);

      // Return 1 tyre @ 5000, refund requested 6000
      await expect(
        createSaleReturn(
          {
            saleId: "sale-1",
            items: [{ saleItemId: "item-1", quantity: 1 }],
            refundAmount: 6000,
            refundStatus: "REFUNDED",
          },
          mockAdmin
        )
      ).rejects.toThrow("cannot exceed total return value");
    });
  });

  describe("getSaleReturns", () => {
    it("returns list of returns for a sale", async () => {
      vi.mocked(db.sale.findUnique).mockResolvedValue({
        id: "sale-1",
        createdById: "admin-1",
      } as unknown as Awaited<ReturnType<typeof db.sale.findUnique>>);

      vi.mocked(db.saleReturn.findMany).mockResolvedValue([
        {
          id: "ret-1",
          returnNumber: "RET-1001",
          saleId: "sale-1",
          customerId: "cust-1",
          returnDate: new Date("2026-09-01T10:00:00Z"),
          totalAmount: new Prisma.Decimal(5000),
          refundAmount: new Prisma.Decimal(5000),
          status: "COMPLETED",
          refundStatus: "REFUNDED",
          reason: "Customer refund",
          notes: null,
          sale: { invoiceNumber: "SALE-1001" },
          customer: { name: "Ramesh Sharma" },
          createdBy: { fullName: "Admin Owner", username: "admin" },
          items: [
            {
              id: "item-1",
              saleItemId: "si-1",
              productId: "prod-1",
              quantity: 1,
              unitPrice: new Prisma.Decimal(5000),
              totalPrice: new Prisma.Decimal(5000),
              condition: "SELLABLE",
              reason: null,
              product: { brand: "MRF", size: "195/65 R15", pattern: "ZLX" },
            },
          ],
          createdAt: new Date("2026-09-01T10:00:00Z"),
        },
      ] as unknown as Awaited<ReturnType<typeof db.saleReturn.findMany>>);

      const returns = await getSaleReturns("sale-1", mockAdmin);

      expect(returns).toHaveLength(1);
      expect(returns[0].returnNumber).toBe("RET-1001");
      expect(returns[0].refundStatus).toBe("REFUNDED");
      expect(returns[0].items[0].brand).toBe("MRF");
    });
  });
});
