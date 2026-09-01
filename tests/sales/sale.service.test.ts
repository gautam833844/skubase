import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createSaleDraft,
  updateSaleDraft,
  listSales,
  getSaleById,
} from "@/services/sale.service";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { Prisma, type Sale, type Product, type Customer } from "@prisma/client";
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
      },
      product: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
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

describe("Sales Foundation & Draft Service Unit Tests", () => {
  const adminActor: AuthActor = { id: "admin-1", role: "ADMIN_OWNER" };
  const staffActor: AuthActor = { id: "staff-1", role: "STAFF" };

  const activeCustomer: Partial<Customer> = {
    id: "cust-1",
    name: "Sunil Sharma",
    phoneNumber: "9820123456",
    vehicleNumber: "MH02AB1234",
    isActive: true,
  };

  const activeProduct: Partial<Product> = {
    id: "prod-1",
    brand: "MRF",
    size: "195/65 R15",
    pattern: "ZVTV",
    unitPrice: new Prisma.Decimal(5000),
    averageCostPrice: new Prisma.Decimal(4000),
    quantityOnHand: 10,
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Sale Draft Creation", () => {
    it("creates a draft sale with sequential sale number (SALE-1001)", async () => {
      vi.mocked(db.sale.count).mockResolvedValue(0);
      vi.mocked(db.sale.findUnique).mockResolvedValue(null);
      vi.mocked(db.customer.findUnique).mockResolvedValue(activeCustomer as Customer);
      vi.mocked(db.product.findMany).mockResolvedValue([activeProduct as Product]);

      const mockCreatedSale = {
        id: "sale-1",
        invoiceNumber: "SALE-1001",
        customerId: "cust-1",
        status: "DRAFT",
        paymentStatus: "UNPAID",
        subtotal: new Prisma.Decimal(20000),
        discountAmount: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(20000),
        items: [],
      };

      vi.mocked(db.sale.create).mockResolvedValue(mockCreatedSale as unknown as Sale);

      const result = await createSaleDraft(
        {
          customerId: "cust-1",
          items: [{ productId: "prod-1", quantity: 4 }],
        },
        staffActor
      );

      expect(result.invoiceNumber).toBe("SALE-1001");
      expect(result.status).toBe("DRAFT");
      expect(result.paymentStatus).toBe("UNPAID");

      // CRITICAL STOCK SAFETY CHECKS:
      // Product stock must NOT be changed on draft creation
      expect(db.product.update).not.toHaveBeenCalled();
      // No InventoryMovement should be created for draft
      expect(db.inventoryMovement.create).not.toHaveBeenCalled();

      // Audit Log
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "SALE_DRAFT_CREATED" }),
        })
      );
    });

    it("creates a draft sale without a customer (Walk-in customer)", async () => {
      vi.mocked(db.sale.count).mockResolvedValue(1);
      vi.mocked(db.sale.findUnique).mockResolvedValue(null);
      vi.mocked(db.product.findMany).mockResolvedValue([activeProduct as Product]);

      const mockCreatedSale = {
        id: "sale-2",
        invoiceNumber: "SALE-1002",
        customerId: null,
        status: "DRAFT",
        totalAmount: new Prisma.Decimal(5000),
        items: [],
      };

      vi.mocked(db.sale.create).mockResolvedValue(mockCreatedSale as unknown as Sale);

      const result = await createSaleDraft(
        {
          customerId: null,
          items: [{ productId: "prod-1", quantity: 1 }],
        },
        staffActor
      );

      expect(result.customerId).toBeNull();
      expect(db.customer.findUnique).not.toHaveBeenCalled();
    });

    it("rejects draft creation if customer is deactivated", async () => {
      vi.mocked(db.customer.findUnique).mockResolvedValue({
        id: "cust-inactive",
        name: "Old Customer",
        isActive: false,
      } as Customer);

      await expect(
        createSaleDraft(
          {
            customerId: "cust-inactive",
            items: [{ productId: "prod-1", quantity: 1 }],
          },
          staffActor
        )
      ).rejects.toThrow("Customer Old Customer is deactivated");
    });

    it("rejects draft creation if product is deactivated", async () => {
      vi.mocked(db.product.findMany).mockResolvedValue([
        { ...activeProduct, isActive: false } as Product,
      ]);

      await expect(
        createSaleDraft(
          {
            items: [{ productId: "prod-1", quantity: 1 }],
          },
          staffActor
        )
      ).rejects.toThrow('Product MRF 195/65 R15 is deactivated');
    });

    it("rejects invalid quantity (zero or negative)", async () => {
      vi.mocked(db.product.findMany).mockResolvedValue([activeProduct as Product]);

      await expect(
        createSaleDraft(
          {
            items: [{ productId: "prod-1", quantity: 0 }],
          },
          staffActor
        )
      ).rejects.toThrow("Invalid sale quantity");
    });
  });

  describe("Price Flexibility & Authorization", () => {
    it("allows ADMIN_OWNER (prices:edit = ALL) to set custom selling price", async () => {
      vi.mocked(db.sale.count).mockResolvedValue(0);
      vi.mocked(db.sale.findUnique).mockResolvedValue(null);
      vi.mocked(db.product.findMany).mockResolvedValue([activeProduct as Product]);

      const mockCreatedSale = {
        id: "sale-custom-price",
        invoiceNumber: "SALE-1001",
        status: "DRAFT",
        totalAmount: new Prisma.Decimal(19200), // 4 * 4800
        items: [],
      };

      vi.mocked(db.sale.create).mockResolvedValue(mockCreatedSale as unknown as Sale);

      const result = await createSaleDraft(
        {
          items: [{ productId: "prod-1", quantity: 4, unitPrice: 4800 }], // Discounted from catalog 5000
        },
        adminActor
      );

      expect(result.totalAmount.toString()).toBe("19200");
    });

    it("strictly blocks STAFF (prices:edit = NONE) from modifying catalog selling price", async () => {
      vi.mocked(db.product.findMany).mockResolvedValue([activeProduct as Product]);

      try {
        await createSaleDraft(
          {
            items: [{ productId: "prod-1", quantity: 4, unitPrice: 4500 }], // Unauthorized discount
          },
          staffActor
        );
        expect.unreachable("Should have rejected unauthorized price edit");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.statusCode).toBe(403);
        expect(appErr.userMessage).toBe("You do not have permission to modify selling prices.");
      }
    });

    it("allows STAFF to create draft when selling price matches catalog price or is omitted", async () => {
      vi.mocked(db.sale.count).mockResolvedValue(0);
      vi.mocked(db.sale.findUnique).mockResolvedValue(null);
      vi.mocked(db.product.findMany).mockResolvedValue([activeProduct as Product]);

      const mockCreatedSale = {
        id: "sale-staff",
        invoiceNumber: "SALE-1001",
        status: "DRAFT",
        totalAmount: new Prisma.Decimal(5000),
        items: [],
      };

      vi.mocked(db.sale.create).mockResolvedValue(mockCreatedSale as unknown as Sale);

      const result = await createSaleDraft(
        {
          items: [{ productId: "prod-1", quantity: 1, unitPrice: 5000 }], // Exactly catalog price
        },
        staffActor
      );

      expect(result.id).toBe("sale-staff");
    });
  });

  describe("Sale Draft Updates", () => {
    const existingDraft = {
      id: "sale-1",
      invoiceNumber: "SALE-1001",
      status: "DRAFT",
      customerId: "cust-1",
      createdById: "staff-1",
      subtotal: new Prisma.Decimal(5000),
      discountAmount: new Prisma.Decimal(0),
      totalAmount: new Prisma.Decimal(5000),
      items: [],
    };

    it("updates draft notes and items without modifying physical stock", async () => {
      vi.mocked(db.sale.findUnique).mockResolvedValue(existingDraft as unknown as Sale);
      vi.mocked(db.product.findMany).mockResolvedValue([activeProduct as Product]);
      vi.mocked(db.sale.update).mockResolvedValue({
        ...existingDraft,
        notes: "Updated notes",
        totalAmount: new Prisma.Decimal(10000),
      } as unknown as Sale);

      const result = await updateSaleDraft(
        "sale-1",
        {
          notes: "Updated notes",
          items: [{ productId: "prod-1", quantity: 2 }],
        },
        staffActor
      );

      expect(result.notes).toBe("Updated notes");
      // CRITICAL STOCK SAFETY:
      expect(db.product.update).not.toHaveBeenCalled();
      expect(db.inventoryMovement.create).not.toHaveBeenCalled();
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "SALE_DRAFT_UPDATED" }),
        })
      );
    });

    it("rejects editing a completed sale", async () => {
      vi.mocked(db.sale.findUnique).mockResolvedValue({
        ...existingDraft,
        status: "COMPLETED",
      } as unknown as Sale);

      await expect(
        updateSaleDraft("sale-1", { notes: "Trying to edit" }, staffActor)
      ).rejects.toThrow("Cannot edit sale SALE-1001 with status COMPLETED");
    });
  });

  describe("Sales Listing & Scoped Authorization", () => {
    it("allows ADMIN_OWNER to list all sales", async () => {
      vi.mocked(db.sale.findMany).mockResolvedValue([
        {
          id: "sale-1",
          invoiceNumber: "SALE-1001",
          status: "DRAFT",
          items: [{ quantity: 4 }],
        } as unknown as Sale,
      ] as unknown as Awaited<ReturnType<typeof db.sale.findMany>>);
      vi.mocked(db.sale.count).mockResolvedValue(1);
      vi.mocked(db.sale.groupBy).mockResolvedValue([
        { status: "DRAFT", _count: { id: 1 } },
      ] as unknown as Awaited<ReturnType<typeof db.sale.groupBy>>);

      const result = await listSales({}, adminActor);
      expect(result.sales).toHaveLength(1);
      expect(result.sales[0].totalQuantity).toBe(4);
    });

    it("retrieves sale by ID with product details", async () => {
      vi.mocked(db.sale.findUnique).mockResolvedValue({
        id: "sale-1",
        invoiceNumber: "SALE-1001",
        createdById: "staff-1",
        items: [{ id: "item-1", quantity: 2, product: { brand: "MRF", size: "195/65 R15" } }],
      } as unknown as Sale);

      const result = await getSaleById("sale-1", staffActor);
      expect(result.invoiceNumber).toBe("SALE-1001");
      expect(result.totalQuantity).toBe(2);
    });
  });
});
