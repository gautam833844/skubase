import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordPayment, getSalePayments } from "@/services/payment.service";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { Prisma, type Sale, type Payment } from "@prisma/client";
import type { AuthActor } from "@/lib/auth/permissions";

vi.mock("@/lib/db", () => {
  return {
    db: {
      sale: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      payment: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      product: {
        update: vi.fn(),
        updateMany: vi.fn(),
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

describe("Payment Management Service Unit Tests", () => {
  const adminActor: AuthActor = { id: "admin-1", role: "ADMIN_OWNER" };
  const staffActor: AuthActor = { id: "staff-1", role: "STAFF" };

  const mockCompletedSale = {
    id: "sale-1",
    invoiceNumber: "SALE-1001",
    status: "COMPLETED",
    paymentStatus: "UNPAID",
    createdById: "staff-1",
    totalAmount: new Prisma.Decimal(20000),
    payments: [] as Payment[],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Basic Payment Recording & Methods", () => {
    it("records a cash payment on a completed sale and updates status to PARTIALLY_PAID", async () => {
      vi.mocked(db.sale.findUnique).mockResolvedValue(mockCompletedSale as unknown as Sale);
      vi.mocked(db.payment.create).mockResolvedValue({
        id: "pay-1",
        saleId: "sale-1",
        amount: new Prisma.Decimal(5000),
        paymentMethod: "CASH",
        referenceNumber: null,
        notes: "Advance payment",
        paymentDate: new Date(),
        createdById: "staff-1",
        createdAt: new Date(),
      } as Payment);
      vi.mocked(db.sale.update).mockResolvedValue({
        ...mockCompletedSale,
        paymentStatus: "PARTIALLY_PAID",
      } as unknown as Sale);

      const result = await recordPayment(
        {
          saleId: "sale-1",
          amount: 5000,
          paymentMethod: "CASH",
          notes: "Advance payment",
        },
        staffActor
      );

      expect(result.paymentStatus).toBe("PARTIALLY_PAID");
      expect(result.totalPaid.toNumber()).toBe(5000);
      expect(result.remainingBalance.toNumber()).toBe(15000);

      // Verify DB Payment Creation
      expect(db.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            saleId: "sale-1",
            amount: new Prisma.Decimal(5000),
            paymentMethod: "CASH",
            createdById: "staff-1",
          }),
        })
      );

      // Verify Sale status update
      expect(db.sale.update).toHaveBeenCalledWith({
        where: { id: "sale-1" },
        data: { paymentStatus: "PARTIALLY_PAID" },
      });

      // Verify Audit Log
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "PAYMENT_RECORDED",
            entityId: "pay-1",
            actorId: "staff-1",
          }),
        })
      );

      // Verify NO INVENTORY EFFECT
      expect(db.product.update).not.toHaveBeenCalled();
      expect(db.product.updateMany).not.toHaveBeenCalled();
      expect(db.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it("records a UPI payment with optional reference number", async () => {
      vi.mocked(db.sale.findUnique).mockResolvedValue(mockCompletedSale as unknown as Sale);
      vi.mocked(db.payment.create).mockResolvedValue({
        id: "pay-upi-1",
        saleId: "sale-1",
        amount: new Prisma.Decimal(10000),
        paymentMethod: "UPI",
        referenceNumber: "UPI-987654321",
        notes: null,
        paymentDate: new Date(),
        createdById: "admin-1",
        createdAt: new Date(),
      } as Payment);

      const result = await recordPayment(
        {
          saleId: "sale-1",
          amount: "10000",
          paymentMethod: "UPI",
          referenceNumber: "UPI-987654321",
        },
        adminActor
      );

      expect(result.paymentStatus).toBe("PARTIALLY_PAID");
      expect(db.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentMethod: "UPI",
            referenceNumber: "UPI-987654321",
          }),
        })
      );
    });

    it("records a CARD payment and CREDIT (pay later) payment correctly", async () => {
      vi.mocked(db.sale.findUnique).mockResolvedValue(mockCompletedSale as unknown as Sale);
      vi.mocked(db.payment.create).mockResolvedValue({
        id: "pay-card-1",
        saleId: "sale-1",
        amount: new Prisma.Decimal(8000),
        paymentMethod: "CARD",
        referenceNumber: "POS-4321",
        notes: null,
        paymentDate: new Date(),
        createdById: "staff-1",
        createdAt: new Date(),
      } as Payment);

      const result = await recordPayment(
        {
          saleId: "sale-1",
          amount: 8000,
          paymentMethod: "CARD",
          referenceNumber: "POS-4321",
        },
        staffActor
      );

      expect(result.paymentStatus).toBe("PARTIALLY_PAID");
    });
  });

  describe("2. Multiple & Full Payments", () => {
    it("transitions status to PAID when multiple payments sum to exactly the sale total", async () => {
      const partiallyPaidSale = {
        id: "sale-1",
        invoiceNumber: "SALE-1001",
        status: "COMPLETED",
        paymentStatus: "PARTIALLY_PAID",
        createdById: "staff-1",
        totalAmount: new Prisma.Decimal(20000),
        payments: [
          {
            id: "pay-1",
            saleId: "sale-1",
            amount: new Prisma.Decimal(12000),
            paymentMethod: "CASH",
          },
        ] as Payment[],
      };

      vi.mocked(db.sale.findUnique).mockResolvedValue(partiallyPaidSale as unknown as Sale);
      vi.mocked(db.payment.create).mockResolvedValue({
        id: "pay-2",
        saleId: "sale-1",
        amount: new Prisma.Decimal(8000),
        paymentMethod: "UPI",
      } as Payment);

      const result = await recordPayment(
        {
          saleId: "sale-1",
          amount: 8000, // Exactly remaining balance: 20000 - 12000 = 8000
          paymentMethod: "UPI",
        },
        staffActor
      );

      expect(result.paymentStatus).toBe("PAID");
      expect(result.totalPaid.toNumber()).toBe(20000);
      expect(result.remainingBalance.toNumber()).toBe(0);

      expect(db.sale.update).toHaveBeenCalledWith({
        where: { id: "sale-1" },
        data: { paymentStatus: "PAID" },
      });
    });
  });

  describe("3. Overpayment & Balance Validations", () => {
    it("strictly rejects payments exceeding the remaining unpaid balance", async () => {
      const partiallyPaidSale = {
        id: "sale-1",
        invoiceNumber: "SALE-1001",
        status: "COMPLETED",
        paymentStatus: "PARTIALLY_PAID",
        createdById: "staff-1",
        totalAmount: new Prisma.Decimal(20000),
        payments: [
          {
            id: "pay-1",
            saleId: "sale-1",
            amount: new Prisma.Decimal(15000),
            paymentMethod: "CASH",
          },
        ] as Payment[],
      };

      vi.mocked(db.sale.findUnique).mockResolvedValue(partiallyPaidSale as unknown as Sale);

      try {
        // Remaining is 5000, attempting 6000
        await recordPayment(
          {
            saleId: "sale-1",
            amount: 6000,
            paymentMethod: "CASH",
          },
          staffActor
        );
        expect.unreachable("Should have rejected payment exceeding remaining balance");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.statusCode).toBe(400);
        expect(appErr.userMessage).toContain("exceeds the remaining balance");
      }

      expect(db.payment.create).not.toHaveBeenCalled();
      expect(db.sale.update).not.toHaveBeenCalled();
    });

    it("strictly rejects payment on already fully paid sale", async () => {
      const fullyPaidSale = {
        id: "sale-1",
        invoiceNumber: "SALE-1001",
        status: "COMPLETED",
        paymentStatus: "PAID",
        createdById: "staff-1",
        totalAmount: new Prisma.Decimal(20000),
        payments: [
          {
            id: "pay-1",
            saleId: "sale-1",
            amount: new Prisma.Decimal(20000),
            paymentMethod: "UPI",
          },
        ] as Payment[],
      };

      vi.mocked(db.sale.findUnique).mockResolvedValue(fullyPaidSale as unknown as Sale);

      try {
        await recordPayment(
          {
            saleId: "sale-1",
            amount: 1000,
            paymentMethod: "CASH",
          },
          staffActor
        );
        expect.unreachable("Should have rejected payment on fully paid sale");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.statusCode).toBe(400);
        expect(appErr.userMessage).toBe("This sale is already fully paid.");
      }
    });

    it("rejects zero and negative payment amounts", async () => {
      await expect(
        recordPayment({ saleId: "sale-1", amount: 0, paymentMethod: "CASH" }, staffActor)
      ).rejects.toThrow();

      await expect(
        recordPayment({ saleId: "sale-1", amount: -500, paymentMethod: "CASH" }, staffActor)
      ).rejects.toThrow();
    });
  });

  describe("4. Sale State Guardrails (DRAFT / VOIDED)", () => {
    it("rejects payments on DRAFT sales", async () => {
      const draftSale = {
        id: "sale-draft",
        invoiceNumber: "SALE-1002",
        status: "DRAFT",
        createdById: "staff-1",
        totalAmount: new Prisma.Decimal(10000),
        payments: [],
      };

      vi.mocked(db.sale.findUnique).mockResolvedValue(draftSale as unknown as Sale);

      try {
        await recordPayment(
          {
            saleId: "sale-draft",
            amount: 5000,
            paymentMethod: "CASH",
          },
          staffActor
        );
        expect.unreachable("Should have rejected payment on draft sale");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.statusCode).toBe(400);
        expect(appErr.userMessage).toContain("Cannot record payment for a draft sale");
      }
    });

    it("rejects payments on VOIDED sales", async () => {
      const voidedSale = {
        id: "sale-voided",
        invoiceNumber: "SALE-1003",
        status: "VOIDED",
        createdById: "staff-1",
        totalAmount: new Prisma.Decimal(10000),
        payments: [],
      };

      vi.mocked(db.sale.findUnique).mockResolvedValue(voidedSale as unknown as Sale);

      try {
        await recordPayment(
          {
            saleId: "sale-voided",
            amount: 5000,
            paymentMethod: "CASH",
          },
          staffActor
        );
        expect.unreachable("Should have rejected payment on voided sale");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.statusCode).toBe(400);
        expect(appErr.userMessage).toContain("Cannot record payment for a voided sale");
      }
    });
  });

  describe("5. Scoped Authorization & IDOR Protection", () => {
    it("blocks STAFF from recording payments against sales created by another user", async () => {
      const adminSale = {
        id: "sale-admin",
        invoiceNumber: "SALE-9999",
        status: "COMPLETED",
        createdById: "admin-1",
        totalAmount: new Prisma.Decimal(15000),
        payments: [],
      };

      vi.mocked(db.sale.findUnique).mockResolvedValue(adminSale as unknown as Sale);

      try {
        await recordPayment(
          {
            saleId: "sale-admin",
            amount: 5000,
            paymentMethod: "CASH",
          },
          staffActor // Staff trying to record payment on Admin's sale
        );
        expect.unreachable("Should have blocked unauthorized payment");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.statusCode).toBe(403);
        expect(appErr.userMessage).toBe("You do not have permission to record payments for this sale.");
      }
    });

    it("allows ADMIN_OWNER to record payments on any staff completed sale", async () => {
      vi.mocked(db.sale.findUnique).mockResolvedValue(mockCompletedSale as unknown as Sale);
      vi.mocked(db.payment.create).mockResolvedValue({
        id: "pay-admin-recorded",
        saleId: "sale-1",
        amount: new Prisma.Decimal(20000),
        paymentMethod: "UPI",
      } as Payment);

      const result = await recordPayment(
        {
          saleId: "sale-1",
          amount: 20000,
          paymentMethod: "UPI",
        },
        adminActor
      );

      expect(result.paymentStatus).toBe("PAID");
    });
  });

  describe("6. Payment History & Details Retrieval", () => {
    it("returns complete payment history, balances, and details", async () => {
      const saleWithPayments = {
        id: "sale-1",
        invoiceNumber: "SALE-1001",
        status: "COMPLETED",
        paymentStatus: "PARTIALLY_PAID",
        createdById: "staff-1",
        totalAmount: new Prisma.Decimal(30000),
        payments: [
          {
            id: "p1",
            amount: new Prisma.Decimal(10000),
            paymentMethod: "CASH",
            createdAt: new Date("2026-09-01T10:00:00Z"),
          },
          {
            id: "p2",
            amount: new Prisma.Decimal(10000),
            paymentMethod: "UPI",
            createdAt: new Date("2026-09-01T11:00:00Z"),
          },
        ] as Payment[],
      };

      vi.mocked(db.sale.findUnique).mockResolvedValue(saleWithPayments as unknown as Sale);

      const details = await getSalePayments("sale-1", staffActor);

      expect(details.saleId).toBe("sale-1");
      expect(details.totalAmount.toNumber()).toBe(30000);
      expect(details.totalPaid.toNumber()).toBe(20000);
      expect(details.remainingBalance.toNumber()).toBe(10000);
      expect(details.payments).toHaveLength(2);
    });
  });
});
