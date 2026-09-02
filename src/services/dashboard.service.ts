import { db } from "@/lib/db";
import { requirePermission, type AuthActor } from "@/lib/auth/permissions";

// =============================================================================
// Skubase — Dashboard Business KPIs Service (V1.1)
// =============================================================================

export interface DashboardKpiData {
  todaySales: number;
  todayGrossProfit: number;
  monthSales: number;
  monthGrossProfit: number;
  completedSalesCount: number;
  outstandingPayments: number;
}

export interface IstDateBoundaries {
  todayStart: Date;
  todayEnd: Date;
  monthStart: Date;
}

/**
 * 5.5 hours in milliseconds representing Indian Standard Time (UTC+05:30).
 * IST does not observe Daylight Saving Time.
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Calculates start/end boundaries for Today and This Month strictly in Asia/Kolkata (IST),
 * returning UTC Date objects suitable for PostgreSQL queries.
 */
export function getIstDateBoundaries(referenceDate: Date = new Date()): IstDateBoundaries {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(referenceDate);
  const year = parseInt(parts.find((p) => p.type === "year")!.value, 10);
  const month = parseInt(parts.find((p) => p.type === "month")!.value, 10) - 1; // 0-indexed
  const day = parseInt(parts.find((p) => p.type === "day")!.value, 10);

  // Midnight start of today in IST converted to UTC
  const todayStart = new Date(Date.UTC(year, month, day, 0, 0, 0, 0) - IST_OFFSET_MS);
  // End of today in IST converted to UTC
  const todayEnd = new Date(Date.UTC(year, month, day, 23, 59, 59, 999) - IST_OFFSET_MS);
  // Midnight start of 1st day of the current month in IST converted to UTC
  const monthStart = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0) - IST_OFFSET_MS);

  return { todayStart, todayEnd, monthStart };
}

/**
 * Safely rounds monetary amounts to 2 decimal places.
 */
function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Retrieves the 6 business KPI metrics for the Dashboard:
 * 1. Today's Sales (Completed sales revenue for today's IST business day)
 * 2. Today's Gross Profit (Today's Sales minus COGS using historical SaleItem.costPrice)
 * 3. This Month's Sales (Completed sales revenue since beginning of IST month)
 * 4. This Month's Gross Profit (This Month's Sales minus COGS using historical SaleItem.costPrice)
 * 5. Completed Sales Count (All-time count of COMPLETED sales)
 * 6. Outstanding Payments (Unpaid balance across completed sales)
 */
export async function getDashboardKpis(
  actor: AuthActor,
  referenceDate: Date = new Date()
): Promise<DashboardKpiData> {
  // Enforce role permission (ADMIN_OWNER & MANAGER allowed, STAFF denied)
  requirePermission(actor, "reports:view", "ALL");

  const { todayStart, todayEnd, monthStart } = getIstDateBoundaries(referenceDate);

  // 1. Fetch completed sales for the month (covers both Month and Today in one query)
  // DRAFT and VOIDED sales are strictly excluded
  const [monthlyCompletedSales, completedSalesCount, pendingBalanceSales] = await Promise.all([
    db.sale.findMany({
      where: {
        status: "COMPLETED",
        saleDate: {
          gte: monthStart,
          lte: todayEnd,
        },
      },
      include: {
        items: {
          select: {
            quantity: true,
            costPrice: true,
          },
        },
      },
      orderBy: { saleDate: "desc" },
    }),

    // 2. All-time completed sales count
    db.sale.count({
      where: {
        status: "COMPLETED",
      },
    }),

    // 3. Completed sales with outstanding / pending balances
    db.sale.findMany({
      where: {
        status: "COMPLETED",
        paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] },
      },
      select: {
        totalAmount: true,
        payments: {
          select: {
            amount: true,
          },
        },
      },
    }),
  ]);

  let todaySales = 0;
  let todayCogs = 0;
  let monthSales = 0;
  let monthCogs = 0;

  const todayStartMs = todayStart.getTime();
  const todayEndMs = todayEnd.getTime();

  for (const sale of monthlyCompletedSales) {
    const saleTotal = Number(sale.totalAmount || 0);
    const saleDateMs = sale.saleDate.getTime();
    const isToday = saleDateMs >= todayStartMs && saleDateMs <= todayEndMs;

    monthSales += saleTotal;

    let saleCogs = 0;
    for (const item of sale.items) {
      const itemCost = Number(item.costPrice || 0);
      saleCogs += item.quantity * itemCost;
    }

    monthCogs += saleCogs;

    if (isToday) {
      todaySales += saleTotal;
      todayCogs += saleCogs;
    }
  }

  // Calculate outstanding payments across all completed sales with pending balance
  let outstandingPayments = 0;
  for (const sale of pendingBalanceSales) {
    const saleTotal = Number(sale.totalAmount || 0);
    const totalPaid = sale.payments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
    const balance = Math.max(0, saleTotal - totalPaid);
    outstandingPayments += balance;
  }

  todaySales = round2(todaySales);
  monthSales = round2(monthSales);
  const todayGrossProfit = round2(todaySales - todayCogs);
  const monthGrossProfit = round2(monthSales - monthCogs);
  outstandingPayments = round2(outstandingPayments);

  return {
    todaySales,
    todayGrossProfit,
    monthSales,
    monthGrossProfit,
    completedSalesCount,
    outstandingPayments,
  };
}
