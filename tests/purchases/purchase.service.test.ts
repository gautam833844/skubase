import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  receivePurchaseOrder,
  listPurchaseOrders,
  getPurchaseOrderById,
  listPurchaseReceipts,
} from "@/services/purchase.service";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { Prisma, type PurchaseOrder, type PurchaseReceipt, type Product, type Supplier } from "@prisma/client";
import type { AuthActor } from "@/lib/auth/permissions";

vi.mock("@/lib/db", () => {
  return {
    db: {
      purchaseOrder: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
      },
      purchaseOrderItem: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      purchaseReceipt: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        count: vi.fn(),
      },
      purchaseReceiptItem: {
        create: vi.fn(),
      },
      product: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        update: vi.fn(),
      },
      supplier: {
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

describe("Purchase Order & Receiving Service Unit Tests", () => {
  const adminActor: AuthActor = { id: "admin-1", role: "ADMIN_OWNER" };
  const staffActor: AuthActor = { id: "staff-1", role: "STAFF" };

  const activeSupplier: Partial<Supplier> = {
    id: "sup-1",
    name: "Metro Tyre Distributors",
    isActive: true,
  };

  const activeProduct: Partial<Product> = {
    id: "prod-1",
    brand: "MRF",
    size: "195/65 R15",
    pattern: "ZVTV",
    quantityOnHand: 0,
    averageCostPrice: new Prisma.Decimal(0),
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Purchase Order Creation", () => {
    it("creates a purchase order with human-readable PO number", async () => {
      vi.mocked(db.supplier.findUnique).mockResolvedValue(activeSupplier as Supplier);
      vi.mocked(db.product.findMany).mockResolvedValue([activeProduct as Product]);
      vi.mocked(db.purchaseOrder.count).mockResolvedValue(0);
      vi.mocked(db.purchaseOrder.findUnique).mockResolvedValue(null);

      const mockCreatedPO = {
        id: "po-1",
        poNumber: "PO-1001",
        supplierId: "sup-1",
        status: "ORDERED",
        items: [
          {
            id: "poi-1",
            purchaseOrderId: "po-1",
            productId: "prod-1",
            quantityOrdered: 4,
            quantityReceived: 0,
            unitCost: new Prisma.Decimal(4000),
          },
        ],
      };

      vi.mocked(db.purchaseOrder.create).mockResolvedValue(mockCreatedPO as unknown as PurchaseOrder);

      const result = await createPurchaseOrder(
        {
          supplierId: "sup-1",
          items: [{ productId: "prod-1", quantityOrdered: 4, unitCost: 4000 }],
        },
        adminActor
      );

      expect(result.poNumber).toBe("PO-1001");
      expect(db.purchaseOrder.create).toHaveBeenCalled();
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "PURCHASE_ORDER_CREATED" }),
        })
      );
    });

    it("rejects purchase order if supplier is deactivated", async () => {
      vi.mocked(db.supplier.findUnique).mockResolvedValue({
        id: "sup-inactive",
        name: "Old Supplier",
        isActive: false,
      } as Supplier);

      await expect(
        createPurchaseOrder(
          {
            supplierId: "sup-inactive",
            items: [{ productId: "prod-1", quantityOrdered: 4 }],
          },
          adminActor
        )
      ).rejects.toThrow("Supplier Old Supplier is deactivated");
    });

    it("rejects purchase order if product is deactivated", async () => {
      vi.mocked(db.supplier.findUnique).mockResolvedValue(activeSupplier as Supplier);
      vi.mocked(db.product.findMany).mockResolvedValue([
        { ...activeProduct, isActive: false } as Product,
      ]);

      await expect(
        createPurchaseOrder(
          {
            supplierId: "sup-1",
            items: [{ productId: "prod-1", quantityOrdered: 4 }],
          },
          adminActor
        )
      ).rejects.toThrow("Product MRF 195/65 R15 is deactivated");
    });

    it("blocks STAFF from creating purchase orders (purchases:create required)", async () => {
      try {
        await createPurchaseOrder(
          {
            supplierId: "sup-1",
            items: [{ productId: "prod-1", quantityOrdered: 4 }],
          },
          staffActor
        );
        expect.unreachable("Should have thrown 403");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.statusCode).toBe(403);
      }
    });
  });

  describe("Purchase Order Status & Cancellation", () => {
    it("allows cancelling purchase order when 0 items received", async () => {
      vi.mocked(db.purchaseOrder.findUnique).mockResolvedValue({
        id: "po-1",
        poNumber: "PO-1001",
        status: "ORDERED",
        items: [{ id: "poi-1", quantityOrdered: 4, quantityReceived: 0 }],
      } as unknown as PurchaseOrder);

      vi.mocked(db.purchaseOrder.update).mockResolvedValue({
        id: "po-1",
        poNumber: "PO-1001",
        status: "CANCELLED",
      } as unknown as PurchaseOrder);

      const result = await updatePurchaseOrderStatus("po-1", "CANCELLED", adminActor);
      expect(result.status).toBe("CANCELLED");
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "PURCHASE_ORDER_CANCELLED" }),
        })
      );
    });

    it("strictly blocks cancelling purchase order when items have already been received", async () => {
      vi.mocked(db.purchaseOrder.findUnique).mockResolvedValue({
        id: "po-1",
        poNumber: "PO-1001",
        status: "PARTIALLY_RECEIVED",
        items: [{ id: "poi-1", quantityOrdered: 4, quantityReceived: 2 }],
      } as unknown as PurchaseOrder);

      await expect(
        updatePurchaseOrderStatus("po-1", "CANCELLED", adminActor)
      ).rejects.toThrow("Cannot cancel purchase order PO-1001 with 2 received items");
    });
  });

  describe("Purchase Receiving & Moving Weighted-Average Costing", () => {
    const fullPO = {
      id: "po-1",
      poNumber: "PO-1001",
      supplierId: "sup-1",
      status: "ORDERED" as const,
      supplier: { id: "sup-1", name: "Metro Tyre Distributors" },
      items: [
        {
          id: "poi-1",
          productId: "prod-1",
          quantityOrdered: 4,
          quantityReceived: 0,
          unitCost: new Prisma.Decimal(4000),
          product: {
            id: "prod-1",
            brand: "MRF",
            size: "195/65 R15",
            pattern: "ZVTV",
            quantityOnHand: 0,
            averageCostPrice: new Prisma.Decimal(0),
          },
        },
      ],
    };

    it("performs full receiving, updates stock, creates InventoryMovement, and sets PO status COMPLETED", async () => {
      vi.mocked(db.purchaseOrder.findUnique).mockResolvedValue(fullPO as unknown as PurchaseOrder);
      vi.mocked(db.purchaseReceipt.count).mockResolvedValue(0);
      vi.mocked(db.purchaseReceipt.findUnique).mockResolvedValue(null);
      vi.mocked(db.purchaseReceipt.create).mockResolvedValue({
        id: "pr-1",
        receiptNumber: "PR-1001",
      } as PurchaseReceipt);
      vi.mocked(db.product.findUniqueOrThrow).mockResolvedValue({
        id: "prod-1",
        quantityOnHand: 0,
        averageCostPrice: new Prisma.Decimal(0),
      } as Product);
      vi.mocked(db.purchaseOrderItem.findMany).mockResolvedValue([
        { id: "poi-1", quantityOrdered: 4, quantityReceived: 4 } as unknown as { id: string; quantityOrdered: number; quantityReceived: number },
      ] as unknown as Awaited<ReturnType<typeof db.purchaseOrderItem.findMany>>);

      const result = await receivePurchaseOrder(
        {
          purchaseOrderId: "po-1",
          supplierInvoiceNo: "INV-100",
          items: [{ purchaseOrderItemId: "poi-1", productId: "prod-1", quantityReceived: 4, unitCost: 4000 }],
        },
        staffActor
      );

      expect(result.receiptNumber).toBe("PR-1001");
      expect(result.poStatus).toBe("COMPLETED");

      // Product stock and cost update
      expect(db.product.update).toHaveBeenCalledWith({
        where: { id: "prod-1" },
        data: {
          quantityOnHand: 4,
          averageCostPrice: new Prisma.Decimal(4000),
        },
      });

      // Immutable Inventory Movement
      expect(db.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: "prod-1",
            movementType: "PURCHASE_RECEIPT",
            quantityDelta: 4,
            balanceAfter: 4,
            referenceType: "PURCHASE_RECEIPT",
          }),
        })
      );
    });

    it("performs partial receiving (2 out of 4) and sets PO status PARTIALLY_RECEIVED", async () => {
      vi.mocked(db.purchaseOrder.findUnique).mockResolvedValue(fullPO as unknown as PurchaseOrder);
      vi.mocked(db.purchaseReceipt.count).mockResolvedValue(0);
      vi.mocked(db.purchaseReceipt.findUnique).mockResolvedValue(null);
      vi.mocked(db.purchaseReceipt.create).mockResolvedValue({
        id: "pr-1",
        receiptNumber: "PR-1001",
      } as PurchaseReceipt);
      vi.mocked(db.product.findUniqueOrThrow).mockResolvedValue({
        id: "prod-1",
        quantityOnHand: 0,
        averageCostPrice: new Prisma.Decimal(0),
      } as Product);
      vi.mocked(db.purchaseOrderItem.findMany).mockResolvedValue([
        { id: "poi-1", quantityOrdered: 4, quantityReceived: 2 } as unknown as { id: string; quantityOrdered: number; quantityReceived: number },
      ] as unknown as Awaited<ReturnType<typeof db.purchaseOrderItem.findMany>>);

      const result = await receivePurchaseOrder(
        {
          purchaseOrderId: "po-1",
          items: [{ purchaseOrderItemId: "poi-1", productId: "prod-1", quantityReceived: 2, unitCost: 4000 }],
        },
        staffActor
      );

      expect(result.poStatus).toBe("PARTIALLY_RECEIVED");
      expect(db.product.update).toHaveBeenCalledWith({
        where: { id: "prod-1" },
        data: {
          quantityOnHand: 2,
          averageCostPrice: new Prisma.Decimal(4000),
        },
      });
    });

    it("strictly rejects over-receiving (cannot receive 5 when ordered is 4)", async () => {
      vi.mocked(db.purchaseOrder.findUnique).mockResolvedValue(fullPO as unknown as PurchaseOrder);

      try {
        await receivePurchaseOrder(
          {
            purchaseOrderId: "po-1",
            items: [{ purchaseOrderItemId: "poi-1", productId: "prod-1", quantityReceived: 5 }],
          },
          staffActor
        );
        expect.unreachable("Should have rejected over-receiving");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.type).toBe("VALIDATION");
        expect(appErr.userMessage).toContain("Cannot receive 5 tyres for MRF 195/65 R15. Only 4 tyre(s) remaining");
      }
    });

    it("calculates accurate moving weighted-average cost when existing stock > 0", async () => {
      vi.mocked(db.purchaseOrder.findUnique).mockResolvedValue(fullPO as unknown as PurchaseOrder);
      vi.mocked(db.purchaseReceipt.count).mockResolvedValue(1);
      vi.mocked(db.purchaseReceipt.findUnique).mockResolvedValue(null);
      vi.mocked(db.purchaseReceipt.create).mockResolvedValue({
        id: "pr-2",
        receiptNumber: "PR-1002",
      } as PurchaseReceipt);
      vi.mocked(db.product.findUniqueOrThrow).mockResolvedValue({
        id: "prod-1",
        quantityOnHand: 4,
        averageCostPrice: new Prisma.Decimal(4000),
      } as Product);
      vi.mocked(db.purchaseOrderItem.findMany).mockResolvedValue([
        { id: "poi-1", quantityOrdered: 4, quantityReceived: 4 } as unknown as { id: string; quantityOrdered: number; quantityReceived: number },
      ] as unknown as Awaited<ReturnType<typeof db.purchaseOrderItem.findMany>>);

      await receivePurchaseOrder(
        {
          purchaseOrderId: "po-1",
          items: [{ purchaseOrderItemId: "poi-1", productId: "prod-1", quantityReceived: 4, unitCost: 4300 }],
        },
        staffActor
      );

      expect(db.product.update).toHaveBeenCalledWith({
        where: { id: "prod-1" },
        data: {
          quantityOnHand: 8,
          averageCostPrice: new Prisma.Decimal(4150),
        },
      });
    });
  });

  describe("Purchase Orders & Receipts Listing", () => {
    it("lists purchase orders with summary counts", async () => {
      vi.mocked(db.purchaseOrder.findMany).mockResolvedValue([
        {
          id: "po-1",
          poNumber: "PO-1001",
          status: "ORDERED",
          supplier: { id: "sup-1", name: "Metro" },
          createdBy: { id: "u-1", fullName: "Admin" },
          items: [{ quantityOrdered: 4, quantityReceived: 2 }],
          _count: { receipts: 1 },
        } as unknown as PurchaseOrder,
      ] as unknown as Awaited<ReturnType<typeof db.purchaseOrder.findMany>>);
      vi.mocked(db.purchaseOrder.count).mockResolvedValue(1);
      vi.mocked(db.purchaseOrder.groupBy).mockResolvedValue([
        { status: "ORDERED", _count: { id: 1 } },
      ] as unknown as Awaited<ReturnType<typeof db.purchaseOrder.groupBy>>);

      const result = await listPurchaseOrders({ search: "PO-1001" }, adminActor);
      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].summary.totalOrdered).toBe(4);
      expect(result.orders[0].summary.totalReceived).toBe(2);
      expect(result.orders[0].summary.remaining).toBe(2);
    });

    it("retrieves purchase order by ID with receipts history", async () => {
      vi.mocked(db.purchaseOrder.findUnique).mockResolvedValue({
        id: "po-1",
        poNumber: "PO-1001",
        supplier: { id: "sup-1", name: "Metro" },
        items: [{ id: "poi-1", quantityOrdered: 4, quantityReceived: 2, product: {} }],
        receipts: [],
      } as unknown as PurchaseOrder);

      const result = await getPurchaseOrderById("po-1", adminActor);
      expect(result.poNumber).toBe("PO-1001");
      expect(result.summary.remaining).toBe(2);
    });

    it("lists purchase receipts ledger", async () => {
      vi.mocked(db.purchaseReceipt.findMany).mockResolvedValue([
        {
          id: "pr-1",
          receiptNumber: "PR-1001",
          supplier: { id: "sup-1", name: "Metro" },
          items: [],
        } as unknown as PurchaseReceipt,
      ] as unknown as Awaited<ReturnType<typeof db.purchaseReceipt.findMany>>);
      vi.mocked(db.purchaseReceipt.count).mockResolvedValue(1);

      const result = await listPurchaseReceipts({}, adminActor);
      expect(result.receipts).toHaveLength(1);
    });
  });
});
