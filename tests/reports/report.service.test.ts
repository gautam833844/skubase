import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getStockValuationReport,
  getLowStockAlertsReport,
  getSalesProfitSummaryReport,
  getStockMovementLedgerReport,
} from "@/services/report.service";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { Prisma, InventoryMovementType } from "@prisma/client";
import type { AuthActor } from "@/lib/auth/permissions";

// Mock db for unit tests
vi.mock("@/lib/db", () => {
  return {
    db: {
      product: {
        findMany: vi.fn(),
      },
      sale: {
        findMany: vi.fn(),
      },
      inventoryMovement: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
    },
  };
});

describe("Reports Service Unit Tests", () => {
  const adminActor: AuthActor = { id: "admin-1", role: "ADMIN_OWNER" };
  const managerActor: AuthActor = { id: "manager-1", role: "MANAGER" };
  const staffActor: AuthActor = { id: "staff-1", role: "STAFF" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. Authorization
  // ---------------------------------------------------------------------------
  describe("Role-Based Authorization", () => {
    it("allows ADMIN_OWNER to access all reports", async () => {
      vi.mocked(db.product.findMany).mockResolvedValueOnce([]);
      const report = await getStockValuationReport(adminActor);
      expect(report.metrics.totalActiveProducts).toBe(0);
    });

    it("allows MANAGER to access all reports", async () => {
      vi.mocked(db.product.findMany).mockResolvedValueOnce([]);
      const report = await getLowStockAlertsReport(managerActor);
      expect(report.metrics.lowStockCount).toBe(0);
    });

    it("denies STAFF access to reports with 403 Forbidden AppError", async () => {
      await expect(getStockValuationReport(staffActor)).rejects.toThrow(AppError);
      await expect(getLowStockAlertsReport(staffActor)).rejects.toThrow(AppError);
      await expect(getSalesProfitSummaryReport(staffActor)).rejects.toThrow(AppError);
      await expect(getStockMovementLedgerReport(staffActor)).rejects.toThrow(AppError);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Stock Valuation & Status Report
  // ---------------------------------------------------------------------------
  describe("Stock Valuation & Status Report", () => {
    it("handles empty database (0 products) safely without division by zero", async () => {
      vi.mocked(db.product.findMany).mockResolvedValueOnce([]);

      const report = await getStockValuationReport(adminActor);

      expect(report.metrics.totalActiveProducts).toBe(0);
      expect(report.metrics.totalPhysicalTyres).toBe(0);
      expect(report.metrics.totalCostValue).toBe(0);
      expect(report.metrics.totalRetailValue).toBe(0);
      expect(report.metrics.estimatedGrossMargin).toBe(0);
      expect(report.metrics.marginPercentage).toBe(0);
      expect(report.items).toHaveLength(0);
    });

    it("accurately aggregates cost value, retail value, and gross margin percentage", async () => {
      vi.mocked(db.product.findMany).mockResolvedValueOnce([
        {
          id: "p1",
          brand: "Apollo",
          size: "195/65 R15",
          pattern: "Alnac 4G",
          quantityOnHand: 10,
          minStockAlert: 4,
          averageCostPrice: new Prisma.Decimal(3000),
          unitPrice: new Prisma.Decimal(4000),
          notes: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "p2",
          brand: "CEAT",
          size: "165/80 R14",
          pattern: "Milaze",
          quantityOnHand: 5,
          minStockAlert: 2,
          averageCostPrice: new Prisma.Decimal(2000),
          unitPrice: new Prisma.Decimal(2500),
          notes: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const report = await getStockValuationReport(adminActor);

      expect(report.metrics.totalActiveProducts).toBe(2);
      expect(report.metrics.totalPhysicalTyres).toBe(15);
      // Cost: 10*3000 + 5*2000 = 30000 + 10000 = 40000
      expect(report.metrics.totalCostValue).toBe(40000);
      // Retail: 10*4000 + 5*2500 = 40000 + 12500 = 52500
      expect(report.metrics.totalRetailValue).toBe(52500);
      // Margin: 52500 - 40000 = 12500
      expect(report.metrics.estimatedGrossMargin).toBe(12500);
      // Margin %: (12500 / 52500) * 100 = 23.81%
      expect(report.metrics.marginPercentage).toBe(23.81);
      expect(report.items).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Low Stock Alerts Report
  // ---------------------------------------------------------------------------
  describe("Low Stock Alerts Report", () => {
    it("filters products where quantityOnHand <= minStockAlert and sorts out-of-stock first", async () => {
      vi.mocked(db.product.findMany).mockResolvedValueOnce([
        {
          id: "p1",
          brand: "Apollo",
          size: "195/65 R15",
          pattern: "Alnac",
          quantityOnHand: 2, // low stock (2 <= 4)
          minStockAlert: 4,
          averageCostPrice: new Prisma.Decimal(3000),
          unitPrice: new Prisma.Decimal(4000),
          notes: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "p2",
          brand: "MRF",
          size: "145/80 R12",
          pattern: "ZVTS",
          quantityOnHand: 10, // well stocked (10 > 4)
          minStockAlert: 4,
          averageCostPrice: new Prisma.Decimal(1800),
          unitPrice: new Prisma.Decimal(2400),
          notes: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "p3",
          brand: "Bridgestone",
          size: "215/60 R16",
          pattern: "Turanza",
          quantityOnHand: 0, // out of stock (0 <= 2)
          minStockAlert: 2,
          averageCostPrice: new Prisma.Decimal(5000),
          unitPrice: new Prisma.Decimal(7000),
          notes: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const report = await getLowStockAlertsReport(adminActor);

      expect(report.metrics.lowStockCount).toBe(2);
      expect(report.metrics.outOfStockCount).toBe(1);
      // p1 deficit: 4-2 = 2; p3 deficit: 2-0 = 2; total deficit = 4
      expect(report.metrics.totalDeficitUnits).toBe(4);

      // p3 is out of stock so it must be first
      expect(report.items[0].id).toBe("p3");
      expect(report.items[0].isOutOfStock).toBe(true);
      expect(report.items[1].id).toBe("p1");
      expect(report.items[1].isOutOfStock).toBe(false);
    });

    it("handles zero low-stock products cleanly", async () => {
      vi.mocked(db.product.findMany).mockResolvedValueOnce([
        {
          id: "p1",
          brand: "Apollo",
          size: "195/65 R15",
          pattern: "Alnac",
          quantityOnHand: 20,
          minStockAlert: 4,
          averageCostPrice: new Prisma.Decimal(3000),
          unitPrice: new Prisma.Decimal(4000),
          notes: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const report = await getLowStockAlertsReport(adminActor);

      expect(report.metrics.lowStockCount).toBe(0);
      expect(report.metrics.outOfStockCount).toBe(0);
      expect(report.metrics.totalDeficitUnits).toBe(0);
      expect(report.items).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Sales & Profit Summary Report
  // ---------------------------------------------------------------------------
  describe("Sales & Profit Summary Report", () => {
    it("handles zero completed sales safely without crashing", async () => {
      vi.mocked(db.sale.findMany).mockResolvedValueOnce([]);

      const report = await getSalesProfitSummaryReport(adminActor);

      expect(report.metrics.completedSalesCount).toBe(0);
      expect(report.metrics.tyresSold).toBe(0);
      expect(report.metrics.grossSales).toBe(0);
      expect(report.metrics.netRevenue).toBe(0);
      expect(report.metrics.cogs).toBe(0);
      expect(report.metrics.grossProfit).toBe(0);
      expect(report.metrics.profitMargin).toBe(0);
      expect(report.metrics.totalCollected).toBe(0);
      expect(report.metrics.outstandingBalance).toBe(0);
      expect(report.paymentBreakdown).toHaveLength(0);
      expect(report.sales).toHaveLength(0);
    });

    it("calculates revenue and profit using sale_item.costPrice and aggregates payment methods", async () => {
      vi.mocked(db.sale.findMany).mockResolvedValueOnce([
        {
          id: "sale-1",
          invoiceNumber: "INV-1001",
          customerId: "c1",
          customerOrderId: null,
          saleDate: new Date("2026-09-01T10:00:00Z"),
          subtotal: new Prisma.Decimal(10000),
          discountAmount: new Prisma.Decimal(500),
          taxAmount: new Prisma.Decimal(0),
          totalAmount: new Prisma.Decimal(9500),
          status: "COMPLETED",
          paymentStatus: "PAID",
          notes: null,
          createdById: "admin-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          customer: {
            name: "Rahul Sharma",
            vehicleNumber: "MH02AB1234",
          },
          items: [
            {
              id: "si-1",
              saleId: "sale-1",
              productId: "p1",
              customerOrderItemId: null,
              quantity: 2,
              unitPrice: new Prisma.Decimal(5000),
              costPrice: new Prisma.Decimal(3500), // COGS: 2 * 3500 = 7000
              discountAmount: new Prisma.Decimal(500),
              totalPrice: new Prisma.Decimal(9500),
            },
          ],
          payments: [
            {
              id: "pay-1",
              saleId: "sale-1",
              customerOrderId: null,
              amount: new Prisma.Decimal(9500),
              paymentMethod: "UPI",
              referenceNumber: "UPI12345",
              paymentDate: new Date("2026-09-01T10:05:00Z"),
              notes: null,
              createdById: "admin-1",
              createdAt: new Date(),
            },
          ],
        } as unknown as Prisma.SaleGetPayload<{
          include: {
            customer: { select: { name: true; vehicleNumber: true } };
            items: true;
            payments: true;
          };
        }>,
      ]);

      const report = await getSalesProfitSummaryReport(adminActor);

      expect(report.metrics.completedSalesCount).toBe(1);
      expect(report.metrics.tyresSold).toBe(2);
      expect(report.metrics.grossSales).toBe(10000);
      expect(report.metrics.discounts).toBe(500);
      expect(report.metrics.netRevenue).toBe(9500);
      // COGS: 2 tyres * 3500 cost = 7000
      expect(report.metrics.cogs).toBe(7000);
      // Gross Profit: 9500 - 7000 = 2500
      expect(report.metrics.grossProfit).toBe(2500);
      // Margin: (2500 / 9500) * 100 = 26.32%
      expect(report.metrics.profitMargin).toBe(26.32);
      expect(report.metrics.totalCollected).toBe(9500);
      expect(report.metrics.outstandingBalance).toBe(0);

      // Payment breakdown
      expect(report.paymentBreakdown).toHaveLength(1);
      expect(report.paymentBreakdown[0].method).toBe("UPI");
      expect(report.paymentBreakdown[0].amount).toBe(9500);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Stock Movement Ledger Report
  // ---------------------------------------------------------------------------
  describe("Stock Movement Ledger Report", () => {
    it("handles zero movements gracefully", async () => {
      vi.mocked(db.inventoryMovement.findMany).mockResolvedValueOnce([]);
      vi.mocked(db.inventoryMovement.count).mockResolvedValueOnce(0);
      vi.mocked(db.inventoryMovement.findMany).mockResolvedValueOnce([]);

      const report = await getStockMovementLedgerReport(adminActor);

      expect(report.metrics.totalMovements).toBe(0);
      expect(report.metrics.totalInflow).toBe(0);
      expect(report.metrics.totalOutflow).toBe(0);
      expect(report.metrics.netChange).toBe(0);
      expect(report.movements).toHaveLength(0);
    });

    it("correctly calculates totalInflow, totalOutflow, and netChange", async () => {
      const mockMovements = [
        {
          id: "m1",
          productId: "p1",
          movementType: InventoryMovementType.PURCHASE_RECEIPT,
          quantityDelta: 20,
          balanceAfter: 20,
          reason: "PO Receipt",
          referenceType: "PURCHASE_RECEIPT",
          referenceId: "rec-1",
          actorId: "admin-1",
          createdAt: new Date(),
          product: { id: "p1", brand: "Apollo", size: "195/65 R15", pattern: "Alnac" },
          actor: { id: "admin-1", fullName: "Admin Owner", username: "admin" },
        },
        {
          id: "m2",
          productId: "p1",
          movementType: InventoryMovementType.SALE,
          quantityDelta: -4,
          balanceAfter: 16,
          reason: "Completed Sale",
          referenceType: "SALE",
          referenceId: "sale-1",
          actorId: "admin-1",
          createdAt: new Date(),
          product: { id: "p1", brand: "Apollo", size: "195/65 R15", pattern: "Alnac" },
          actor: { id: "admin-1", fullName: "Admin Owner", username: "admin" },
        },
      ];

      vi.mocked(db.inventoryMovement.findMany).mockResolvedValueOnce(
        mockMovements as unknown as Prisma.InventoryMovementGetPayload<{
          include: {
            product: { select: { id: true; brand: true; size: true; pattern: true } };
            actor: { select: { id: true; fullName: true; username: true } };
          };
        }>[]
      );
      vi.mocked(db.inventoryMovement.count).mockResolvedValueOnce(2);
      vi.mocked(db.inventoryMovement.findMany).mockResolvedValueOnce([
        { quantityDelta: 20 },
        { quantityDelta: -4 },
      ] as unknown as Prisma.InventoryMovementGetPayload<{
        include: {
          product: { select: { id: true; brand: true; size: true; pattern: true } };
          actor: { select: { id: true; fullName: true; username: true } };
        };
      }>[]);

      const report = await getStockMovementLedgerReport(adminActor);

      expect(report.metrics.totalMovements).toBe(2);
      expect(report.metrics.totalInflow).toBe(20);
      expect(report.metrics.totalOutflow).toBe(4);
      expect(report.metrics.netChange).toBe(16);
      expect(report.movements).toHaveLength(2);
    });
  });
});
