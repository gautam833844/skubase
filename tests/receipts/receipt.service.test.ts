import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSaleReceipt, generateReceiptPdf } from "@/services/receipt.service";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { Prisma, type Sale } from "@prisma/client";
import type { AuthActor } from "@/lib/auth/permissions";

vi.mock("@/lib/db", () => {
  return {
    db: {
      sale: {
        findUnique: vi.fn(),
      },
      product: {
        update: vi.fn(),
      },
      inventoryMovement: {
        create: vi.fn(),
      },
      payment: {
        create: vi.fn(),
      },
      shopSetting: {
        findFirst: vi.fn(),
      },
    },
  };
});

describe("Sale Receipt & Bill Generation Service Unit Tests", () => {
  const adminActor: AuthActor = { id: "admin-1", role: "ADMIN_OWNER" };
  const staffActor: AuthActor = { id: "staff-1", role: "STAFF" };

  const mockCompletedSale = {
    id: "sale-1",
    invoiceNumber: "SALE-1001",
    saleDate: new Date("2026-09-01T10:00:00Z"),
    status: "COMPLETED",
    paymentStatus: "PAID",
    subtotal: new Prisma.Decimal(20000),
    discountAmount: new Prisma.Decimal(1000),
    taxAmount: new Prisma.Decimal(0),
    totalAmount: new Prisma.Decimal(19000),
    notes: "Delivery to garage",
    createdById: "staff-1",
    customer: {
      id: "cust-1",
      name: "Vikram Malhotra",
      phoneNumber: "9876543210",
      vehicleNumber: "MH01AB9999",
      vehicleModel: "Honda City",
      address: "Mumbai",
    },
    createdBy: {
      id: "staff-1",
      fullName: "Staff Member",
      username: "staff1",
    },
    items: [
      {
        id: "item-1",
        quantity: 2,
        unitPrice: new Prisma.Decimal(6500),
        costPrice: new Prisma.Decimal(5200), // INTERNAL COST PRICE
        discountAmount: new Prisma.Decimal(500),
        totalPrice: new Prisma.Decimal(12500),
        product: {
          id: "prod-1",
          brand: "Apollo",
          size: "205/55 R16",
          pattern: "Alnac 4G",
        },
      },
      {
        id: "item-2",
        quantity: 1,
        unitPrice: new Prisma.Decimal(7000),
        costPrice: new Prisma.Decimal(5500), // INTERNAL COST PRICE
        discountAmount: new Prisma.Decimal(500),
        totalPrice: new Prisma.Decimal(6500),
        product: {
          id: "prod-2",
          brand: "Bridgestone",
          size: "205/55 R16",
          pattern: "Turanza",
        },
      },
    ],
    payments: [
      {
        id: "pay-1",
        amount: new Prisma.Decimal(10000),
        paymentMethod: "CASH",
        referenceNumber: null,
        paymentDate: new Date("2026-09-01T10:05:00Z"),
      },
      {
        id: "pay-2",
        amount: new Prisma.Decimal(9000),
        paymentMethod: "UPI",
        referenceNumber: "UPI-998877",
        paymentDate: new Date("2026-09-01T10:10:00Z"),
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Receipt Data Retrieval & Historical Preservation", () => {
    it("retrieves full receipt with historical prices and shop information", async () => {
      vi.mocked(db.sale.findUnique).mockResolvedValue(mockCompletedSale as unknown as Sale);

      const receipt = await getSaleReceipt("sale-1", staffActor);

      expect(receipt.invoiceNumber).toBe("SALE-1001");
      expect(receipt.isDraft).toBe(false);
      expect(receipt.documentTitle).toBe("SALE RECEIPT");
      expect(receipt.shop.name).toBeDefined();
      expect(receipt.customer?.name).toBe("Vikram Malhotra");
      expect(receipt.customer?.vehicleNumber).toBe("MH01AB9999");
      expect(receipt.items).toHaveLength(2);
      expect(receipt.items[0].brand).toBe("Apollo");
      expect(receipt.items[0].unitPrice).toBe("6500");
      expect(receipt.totalAmount).toBe("19000");
      expect(receipt.totalPaid).toBe("19000");
      expect(receipt.remainingBalance).toBe("0");
      expect(receipt.paymentStatus).toBe("PAID");
      expect(receipt.payments).toHaveLength(2);
    });

    it("STRICTLY PROTECTS INTERNAL DATA: never exposes costPrice or profit margin in customer receipt", async () => {
      vi.mocked(db.sale.findUnique).mockResolvedValue(mockCompletedSale as unknown as Sale);

      const receipt = await getSaleReceipt("sale-1", staffActor);

      // Verify that none of the receipt items have costPrice
      for (const item of receipt.items) {
        const raw = item as unknown as Record<string, unknown>;
        expect(raw.costPrice).toBeUndefined();
        expect(raw.averageCostPrice).toBeUndefined();
        expect(raw.margin).toBeUndefined();
        expect(raw.profit).toBeUndefined();
      }
    });

    it("handles Walk-in customer when customer is null", async () => {
      const walkInSale = {
        ...mockCompletedSale,
        customer: null,
      };
      vi.mocked(db.sale.findUnique).mockResolvedValue(walkInSale as unknown as Sale);

      const receipt = await getSaleReceipt("sale-1", staffActor);

      expect(receipt.customer).toBeNull();
    });
  });

  describe("2. Draft vs Completed Sales", () => {
    it("flags draft sale with isDraft=true and DRAFT ESTIMATE title", async () => {
      const draftSale = {
        ...mockCompletedSale,
        status: "DRAFT",
        paymentStatus: "UNPAID",
        payments: [],
      };
      vi.mocked(db.sale.findUnique).mockResolvedValue(draftSale as unknown as Sale);

      const receipt = await getSaleReceipt("sale-1", staffActor);

      expect(receipt.isDraft).toBe(true);
      expect(receipt.documentTitle).toContain("DRAFT ESTIMATE");
    });
  });

  describe("3. Scoped Authorization & IDOR Protection", () => {
    it("blocks STAFF from viewing receipt of another user's sale", async () => {
      const otherUserSale = {
        ...mockCompletedSale,
        createdById: "admin-1", // created by admin
      };
      vi.mocked(db.sale.findUnique).mockResolvedValue(otherUserSale as unknown as Sale);

      try {
        await getSaleReceipt("sale-1", staffActor); // staff attempting IDOR
        expect.unreachable("Should have rejected unauthorized receipt access");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.statusCode).toBe(403);
        expect(appErr.userMessage).toBe("You do not have permission to view this receipt.");
      }
    });

    it("allows ADMIN_OWNER to view receipt of any sale", async () => {
      vi.mocked(db.sale.findUnique).mockResolvedValue(mockCompletedSale as unknown as Sale);

      const receipt = await getSaleReceipt("sale-1", adminActor);
      expect(receipt.invoiceNumber).toBe("SALE-1001");
    });
  });

  describe("4. Zero Business Side Effects Verification", () => {
    it("guarantees zero database writes, stock alterations, or payment creations during receipt retrieval", async () => {
      vi.mocked(db.sale.findUnique).mockResolvedValue(mockCompletedSale as unknown as Sale);

      await getSaleReceipt("sale-1", staffActor);

      expect(db.product.update).not.toHaveBeenCalled();
      expect(db.inventoryMovement.create).not.toHaveBeenCalled();
      expect(db.payment.create).not.toHaveBeenCalled();
    });
  });

  describe("5. PDF Generation", () => {
    it("generates a valid binary PDF buffer from receipt data", async () => {
      vi.mocked(db.sale.findUnique).mockResolvedValue(mockCompletedSale as unknown as Sale);

      const receipt = await getSaleReceipt("sale-1", staffActor);
      const pdfBytes = await generateReceiptPdf(receipt);

      expect(pdfBytes).toBeInstanceOf(Uint8Array);
      expect(pdfBytes.length).toBeGreaterThan(100);

      // Verify PDF header magic bytes "%PDF-"
      const header = String.fromCharCode(...pdfBytes.slice(0, 5));
      expect(header).toBe("%PDF-");
    });

    it("handles long sale with multiple line items spanning multiple pages cleanly", async () => {
      const longItemList = Array.from({ length: 30 }, (_, i) => ({
        id: `item-${i + 1}`,
        quantity: 4,
        unitPrice: new Prisma.Decimal(5000),
        costPrice: new Prisma.Decimal(4000),
        discountAmount: new Prisma.Decimal(0),
        totalPrice: new Prisma.Decimal(20000),
        product: {
          id: `prod-${i + 1}`,
          brand: `Brand-${i + 1}`,
          size: "205/55 R16",
          pattern: "Sport",
        },
      }));

      const longSale = {
        ...mockCompletedSale,
        items: longItemList,
        totalAmount: new Prisma.Decimal(600000),
      };

      vi.mocked(db.sale.findUnique).mockResolvedValue(longSale as unknown as Sale);

      const receipt = await getSaleReceipt("sale-1", staffActor);
      const pdfBytes = await generateReceiptPdf(receipt);

      expect(pdfBytes.length).toBeGreaterThan(1000);
      const header = String.fromCharCode(...pdfBytes.slice(0, 5));
      expect(header).toBe("%PDF-");
    });
  });
});
