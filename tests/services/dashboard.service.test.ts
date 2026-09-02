import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getDashboardKpis,
  getIstDateBoundaries,
} from "@/services/dashboard.service";
import { AppError } from "@/lib/errors";
import { Prisma } from "@prisma/client";
import type { AuthActor } from "@/lib/auth/permissions";

const mockSaleFindMany = vi.fn();
const mockSaleCount = vi.fn();

// Mock db for unit tests using standalone vi.fn() instances
vi.mock("@/lib/db", () => ({
  db: {
    sale: {
      findMany: (...args: unknown[]) => mockSaleFindMany(...args),
      count: (...args: unknown[]) => mockSaleCount(...args),
    },
  },
}));

describe("Dashboard Service Unit Tests (V1.1)", () => {
  const adminActor: AuthActor = { id: "admin-1", role: "ADMIN_OWNER" };
  const managerActor: AuthActor = { id: "manager-1", role: "MANAGER" };
  const staffActor: AuthActor = { id: "staff-1", role: "STAFF" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. ADMIN_OWNER authorization
  it("authorizes ADMIN_OWNER to access dashboard KPIs", async () => {
    mockSaleFindMany.mockResolvedValueOnce([]);
    mockSaleCount.mockResolvedValueOnce(0);
    mockSaleFindMany.mockResolvedValueOnce([]);

    const kpis = await getDashboardKpis(adminActor);
    expect(kpis.completedSalesCount).toBe(0);
  });

  // 2. MANAGER authorization
  it("authorizes MANAGER to access dashboard KPIs", async () => {
    mockSaleFindMany.mockResolvedValueOnce([]);
    mockSaleCount.mockResolvedValueOnce(0);
    mockSaleFindMany.mockResolvedValueOnce([]);

    const kpis = await getDashboardKpis(managerActor);
    expect(kpis.completedSalesCount).toBe(0);
  });

  // 3. STAFF denial
  it("denies STAFF access with 403 Forbidden AppError", async () => {
    await expect(getDashboardKpis(staffActor)).rejects.toThrow(AppError);
  });

  // 4. Empty database
  it("handles empty database returning all zero metrics without division-by-zero or NaN", async () => {
    mockSaleFindMany.mockResolvedValueOnce([]);
    mockSaleCount.mockResolvedValueOnce(0);
    mockSaleFindMany.mockResolvedValueOnce([]);

    const kpis = await getDashboardKpis(adminActor);

    expect(kpis.todaySales).toBe(0);
    expect(kpis.todayGrossProfit).toBe(0);
    expect(kpis.monthSales).toBe(0);
    expect(kpis.monthGrossProfit).toBe(0);
    expect(kpis.completedSalesCount).toBe(0);
    expect(kpis.outstandingPayments).toBe(0);
  });

  // 5. Today's sales calculation
  it("calculates Today's sales accurately for sales occurring today in IST", async () => {
    const refDate = new Date("2026-09-15T06:30:00.000Z"); // 12:00 PM IST
    const saleToday = {
      id: "s-today",
      totalAmount: new Prisma.Decimal(12500),
      saleDate: new Date("2026-09-15T04:30:00.000Z"), // 10:00 AM IST
      items: [{ quantity: 2, costPrice: new Prisma.Decimal(4000) }],
    };

    mockSaleFindMany.mockResolvedValueOnce([saleToday]);
    mockSaleCount.mockResolvedValueOnce(1);
    mockSaleFindMany.mockResolvedValueOnce([]);

    const kpis = await getDashboardKpis(adminActor, refDate);
    expect(kpis.todaySales).toBe(12500);
  });

  // 6. This month's sales calculation
  it("calculates This Month's sales accurately summing all sales in the current IST month", async () => {
    const refDate = new Date("2026-09-15T06:30:00.000Z");
    const sale1 = {
      id: "s1",
      totalAmount: new Prisma.Decimal(10000),
      saleDate: new Date("2026-09-15T04:30:00.000Z"),
      items: [{ quantity: 1, costPrice: new Prisma.Decimal(6000) }],
    };
    const sale2 = {
      id: "s2",
      totalAmount: new Prisma.Decimal(8000),
      saleDate: new Date("2026-09-03T05:00:00.000Z"),
      items: [{ quantity: 1, costPrice: new Prisma.Decimal(5000) }],
    };

    mockSaleFindMany.mockResolvedValueOnce([sale1, sale2]);
    mockSaleCount.mockResolvedValueOnce(2);
    mockSaleFindMany.mockResolvedValueOnce([]);

    const kpis = await getDashboardKpis(adminActor, refDate);
    expect(kpis.monthSales).toBe(18000);
  });

  // 7. Today's gross profit using historical SaleItem.costPrice
  it("calculates Today's gross profit using historical SaleItem.costPrice", async () => {
    const refDate = new Date("2026-09-15T06:30:00.000Z");
    const saleToday = {
      id: "s-today",
      totalAmount: new Prisma.Decimal(15000),
      saleDate: new Date("2026-09-15T04:30:00.000Z"),
      items: [
        { quantity: 2, costPrice: new Prisma.Decimal(4500) }, // COGS = 9000
        { quantity: 1, costPrice: new Prisma.Decimal(2000) }, // COGS = 2000
      ],
    };

    mockSaleFindMany.mockResolvedValueOnce([saleToday]);
    mockSaleCount.mockResolvedValueOnce(1);
    mockSaleFindMany.mockResolvedValueOnce([]);

    const kpis = await getDashboardKpis(adminActor, refDate);
    // Revenue = 15000, COGS = 11000, Gross Profit = 4000
    expect(kpis.todayGrossProfit).toBe(4000);
  });

  // 8. Monthly gross profit
  it("calculates Monthly gross profit aggregating all sales across the current IST month", async () => {
    const refDate = new Date("2026-09-15T06:30:00.000Z");
    const saleToday = {
      id: "s-today",
      totalAmount: new Prisma.Decimal(10000),
      saleDate: new Date("2026-09-15T04:30:00.000Z"),
      items: [{ quantity: 1, costPrice: new Prisma.Decimal(6000) }], // Profit = 4000
    };
    const saleEarlier = {
      id: "s-earlier",
      totalAmount: new Prisma.Decimal(20000),
      saleDate: new Date("2026-09-02T04:30:00.000Z"),
      items: [{ quantity: 2, costPrice: new Prisma.Decimal(7000) }], // Profit = 6000
    };

    mockSaleFindMany.mockResolvedValueOnce([saleToday, saleEarlier]);
    mockSaleCount.mockResolvedValueOnce(2);
    mockSaleFindMany.mockResolvedValueOnce([]);

    const kpis = await getDashboardKpis(adminActor, refDate);
    // Month Revenue = 30000, Total COGS = 20000, Month Gross Profit = 10000
    expect(kpis.monthGrossProfit).toBe(10000);
  });

  // 9. Completed-only filtering
  it("filters to completed-only sales for revenue, profit, and count", async () => {
    mockSaleFindMany.mockResolvedValueOnce([]);
    mockSaleCount.mockResolvedValueOnce(7);
    mockSaleFindMany.mockResolvedValueOnce([]);

    const kpis = await getDashboardKpis(adminActor);

    expect(kpis.completedSalesCount).toBe(7);
    const countCall = mockSaleCount.mock.calls[0][0] as { where?: { status?: string } };
    expect(countCall?.where?.status).toBe("COMPLETED");
  });

  // 10. DRAFT/VOIDED exclusion
  it("strictly excludes DRAFT and VOIDED sales in all database queries", async () => {
    mockSaleFindMany.mockResolvedValueOnce([]);
    mockSaleCount.mockResolvedValueOnce(0);
    mockSaleFindMany.mockResolvedValueOnce([]);

    await getDashboardKpis(adminActor);

    const monthlyQuery = mockSaleFindMany.mock.calls[0][0] as { where?: { status?: string } };
    expect(monthlyQuery?.where?.status).toBe("COMPLETED");

    const unpaidQuery = mockSaleFindMany.mock.calls[1][0] as { where?: { status?: string } };
    expect(unpaidQuery?.where?.status).toBe("COMPLETED");
  });

  // 11. Outstanding payment calculation
  it("calculates outstanding payments accurately across completed sales with pending dues", async () => {
    const unpaidSales = [
      {
        id: "s1",
        totalAmount: new Prisma.Decimal(10000),
        payments: [{ amount: new Prisma.Decimal(4000) }], // Balance = 6000
      },
      {
        id: "s2",
        totalAmount: new Prisma.Decimal(7500),
        payments: [], // Balance = 7500
      },
      {
        id: "s3",
        totalAmount: new Prisma.Decimal(5000),
        payments: [{ amount: new Prisma.Decimal(5000) }], // Fully paid -> Balance = 0
      },
    ];

    mockSaleFindMany.mockResolvedValueOnce([]);
    mockSaleCount.mockResolvedValueOnce(3);
    mockSaleFindMany.mockResolvedValueOnce(unpaidSales);

    const kpis = await getDashboardKpis(adminActor);
    // 6000 + 7500 + 0 = 13500
    expect(kpis.outstandingPayments).toBe(13500);
  });

  // 12. IST timezone boundary behavior
  it("accurately computes IST timezone boundaries for Indian business days", () => {
    // 07:30 AM IST on 2026-09-03 is 02:00:00 UTC
    const dateInIndiaMorning = new Date("2026-09-03T02:00:00.000Z");
    const bounds = getIstDateBoundaries(dateInIndiaMorning);

    // Midnight IST start -> 2026-09-02 18:30:00.000 UTC
    expect(bounds.todayStart.toISOString()).toBe("2026-09-02T18:30:00.000Z");
    // End of day IST -> 2026-09-03 18:29:59.999 UTC
    expect(bounds.todayEnd.toISOString()).toBe("2026-09-03T18:29:59.999Z");
    // Month start IST -> 2026-08-31 18:30:00.000 UTC
    expect(bounds.monthStart.toISOString()).toBe("2026-08-31T18:30:00.000Z");
  });
});
