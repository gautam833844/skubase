import { db } from "@/lib/db";
import { requirePermission, type AuthActor } from "@/lib/auth/permissions";
import { InventoryMovementType } from "@prisma/client";

// =============================================================================
// Skubase — Reports & Analytics Service (V1)
// =============================================================================

export interface StockValuationItem {
  id: string;
  brand: string;
  size: string;
  pattern: string;
  quantityOnHand: number;
  minStockAlert: number;
  averageCostPrice: number;
  unitPrice: number;
  totalCostValue: number;
  totalRetailValue: number;
}

export interface StockValuationReport {
  metrics: {
    totalActiveProducts: number;
    totalPhysicalTyres: number;
    totalCostValue: number;
    totalRetailValue: number;
    estimatedGrossMargin: number;
    marginPercentage: number;
  };
  items: StockValuationItem[];
}

export interface LowStockAlertItem {
  id: string;
  brand: string;
  size: string;
  pattern: string;
  quantityOnHand: number;
  minStockAlert: number;
  deficit: number;
  isOutOfStock: boolean;
  averageCostPrice: number;
  unitPrice: number;
}

export interface LowStockAlertsReport {
  metrics: {
    lowStockCount: number;
    outOfStockCount: number;
    totalDeficitUnits: number;
  };
  items: LowStockAlertItem[];
}

export interface PaymentMethodBreakdown {
  method: string;
  amount: number;
  count: number;
}

export interface SalesProfitReportSaleItem {
  id: string;
  invoiceNumber: string;
  saleDate: string;
  customerName: string;
  vehicleNumber: string | null;
  totalAmount: number;
  paymentStatus: string;
  itemCount: number;
}

export interface SalesProfitSummaryReport {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  metrics: {
    completedSalesCount: number;
    tyresSold: number;
    grossSales: number;
    discounts: number;
    netRevenue: number;
    cogs: number;
    grossProfit: number;
    profitMargin: number;
    totalCollected: number;
    outstandingBalance: number;
  };
  paymentBreakdown: PaymentMethodBreakdown[];
  sales: SalesProfitReportSaleItem[];
}

export interface StockMovementReportItem {
  id: string;
  createdAt: string;
  movementType: InventoryMovementType;
  quantityDelta: number;
  balanceAfter: number;
  reason: string | null;
  referenceType: string | null;
  referenceId: string | null;
  product: {
    id: string;
    brand: string;
    size: string;
    pattern: string;
  };
  actor: {
    id: string;
    fullName: string | null;
    username: string | null;
  } | null;
}

export interface StockMovementLedgerReport {
  dateRange?: {
    startDate?: string;
    endDate?: string;
  };
  metrics: {
    totalMovements: number;
    totalInflow: number;
    totalOutflow: number;
    netChange: number;
  };
  movements: StockMovementReportItem[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}

/**
 * Helper to safely round monetary values to two decimal places.
 */
function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * 1. Stock Valuation & Status Report
 * Live snapshot of current active tyre inventory, valued at cost and retail.
 */
export async function getStockValuationReport(
  actor: AuthActor,
  brand?: string
): Promise<StockValuationReport> {
  requirePermission(actor, "reports:view", "ALL");

  const whereClause: { isActive: boolean; brand?: { equals: string; mode: "insensitive" } } = {
    isActive: true,
  };

  if (brand && brand.trim() && brand !== "ALL") {
    whereClause.brand = { equals: brand.trim(), mode: "insensitive" };
  }

  const products = await db.product.findMany({
    where: whereClause,
    orderBy: [{ brand: "asc" }, { size: "asc" }, { pattern: "asc" }],
  });

  let totalPhysicalTyres = 0;
  let totalCostValue = 0;
  let totalRetailValue = 0;

  const items: StockValuationItem[] = products.map((p) => {
    const qty = p.quantityOnHand;
    const avgCost = Number(p.averageCostPrice ?? 0);
    const unitPrice = Number(p.unitPrice ?? 0);

    const costValue = round2(qty * avgCost);
    const retailValue = round2(qty * unitPrice);

    totalPhysicalTyres += qty;
    totalCostValue += costValue;
    totalRetailValue += retailValue;

    return {
      id: p.id,
      brand: p.brand,
      size: p.size,
      pattern: p.pattern,
      quantityOnHand: qty,
      minStockAlert: p.minStockAlert,
      averageCostPrice: avgCost,
      unitPrice,
      totalCostValue: costValue,
      totalRetailValue: retailValue,
    };
  });

  totalCostValue = round2(totalCostValue);
  totalRetailValue = round2(totalRetailValue);
  const estimatedGrossMargin = round2(totalRetailValue - totalCostValue);
  const marginPercentage =
    totalRetailValue > 0 ? round2((estimatedGrossMargin / totalRetailValue) * 100) : 0;

  return {
    metrics: {
      totalActiveProducts: products.length,
      totalPhysicalTyres,
      totalCostValue,
      totalRetailValue,
      estimatedGrossMargin,
      marginPercentage,
    },
    items,
  };
}

/**
 * 2. Low Stock Alerts Report
 * Identifies active products that have reached or fallen below minimum alert thresholds.
 */
export async function getLowStockAlertsReport(actor: AuthActor): Promise<LowStockAlertsReport> {
  requirePermission(actor, "reports:view", "ALL");

  const products = await db.product.findMany({
    where: { isActive: true },
    orderBy: [{ brand: "asc" }, { size: "asc" }],
  });

  const lowStockProducts = products.filter((p) => p.quantityOnHand <= p.minStockAlert);

  let outOfStockCount = 0;
  let totalDeficitUnits = 0;

  const items: LowStockAlertItem[] = lowStockProducts.map((p) => {
    const isOutOfStock = p.quantityOnHand === 0;
    const deficit = Math.max(0, p.minStockAlert - p.quantityOnHand);

    if (isOutOfStock) outOfStockCount++;
    totalDeficitUnits += deficit;

    return {
      id: p.id,
      brand: p.brand,
      size: p.size,
      pattern: p.pattern,
      quantityOnHand: p.quantityOnHand,
      minStockAlert: p.minStockAlert,
      deficit,
      isOutOfStock,
      averageCostPrice: Number(p.averageCostPrice ?? 0),
      unitPrice: Number(p.unitPrice ?? 0),
    };
  });

  // Sort out of stock items first, then by largest deficit descending
  items.sort((a, b) => {
    if (a.isOutOfStock && !b.isOutOfStock) return -1;
    if (!a.isOutOfStock && b.isOutOfStock) return 1;
    return b.deficit - a.deficit;
  });

  return {
    metrics: {
      lowStockCount: items.length,
      outOfStockCount,
      totalDeficitUnits,
    },
    items,
  };
}

/**
 * 3. Sales & Profit Summary Report
 * Aggregates revenue, historical cost-of-goods-sold (using item costPrice), and payment breakdowns.
 * Only COMPLETED sales contribute to revenue and profit.
 */
export async function getSalesProfitSummaryReport(
  actor: AuthActor,
  filters: { startDate?: string; endDate?: string } = {}
): Promise<SalesProfitSummaryReport> {
  requirePermission(actor, "reports:view", "ALL");

  // Determine date bounds
  let start: Date;
  let end: Date;

  if (filters.startDate) {
    start = new Date(`${filters.startDate}T00:00:00.000Z`);
  } else {
    // Default: beginning of current month
    const now = new Date();
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  }

  if (filters.endDate) {
    end = new Date(`${filters.endDate}T23:59:59.999Z`);
  } else {
    end = new Date();
  }

  // Fetch only COMPLETED sales within date range
  const sales = await db.sale.findMany({
    where: {
      status: "COMPLETED",
      saleDate: {
        gte: start,
        lte: end,
      },
    },
    include: {
      customer: {
        select: {
          name: true,
          vehicleNumber: true,
        },
      },
      items: true,
      payments: true,
    },
    orderBy: { saleDate: "desc" },
  });

  let tyresSold = 0;
  let grossSales = 0;
  let discounts = 0;
  let netRevenue = 0;
  let cogs = 0;
  let totalCollected = 0;

  const paymentMethodMap = new Map<string, { amount: number; count: number }>();

  const saleRows: SalesProfitReportSaleItem[] = sales.map((sale) => {
    const saleSubtotal = Number(sale.subtotal);
    const saleDiscount = Number(sale.discountAmount);
    const saleTotal = Number(sale.totalAmount);

    grossSales += saleSubtotal;
    discounts += saleDiscount;
    netRevenue += saleTotal;

    let saleItemCount = 0;

    // Use the costPrice stored on each sale_item to compute actual historic COGS
    for (const item of sale.items) {
      const itemQty = item.quantity;
      const itemCost = Number(item.costPrice ?? 0);

      tyresSold += itemQty;
      saleItemCount += itemQty;
      cogs += itemQty * itemCost;
    }

    // Accumulate payments for completed sales
    for (const payment of sale.payments) {
      const pAmt = Number(payment.amount);
      totalCollected += pAmt;

      const current = paymentMethodMap.get(payment.paymentMethod) ?? { amount: 0, count: 0 };
      paymentMethodMap.set(payment.paymentMethod, {
        amount: current.amount + pAmt,
        count: current.count + 1,
      });
    }

    return {
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      saleDate: sale.saleDate.toISOString(),
      customerName: sale.customer?.name ?? "Walk-in Customer",
      vehicleNumber: sale.customer?.vehicleNumber ?? null,
      totalAmount: saleTotal,
      paymentStatus: sale.paymentStatus,
      itemCount: saleItemCount,
    };
  });

  grossSales = round2(grossSales);
  discounts = round2(discounts);
  netRevenue = round2(netRevenue);
  cogs = round2(cogs);
  totalCollected = round2(totalCollected);
  const grossProfit = round2(netRevenue - cogs);
  const profitMargin = netRevenue > 0 ? round2((grossProfit / netRevenue) * 100) : 0;
  const outstandingBalance = round2(Math.max(0, netRevenue - totalCollected));

  const paymentBreakdown: PaymentMethodBreakdown[] = Array.from(paymentMethodMap.entries()).map(
    ([method, data]) => ({
      method,
      amount: round2(data.amount),
      count: data.count,
    })
  );

  return {
    dateRange: {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    },
    metrics: {
      completedSalesCount: sales.length,
      tyresSold,
      grossSales,
      discounts,
      netRevenue,
      cogs,
      grossProfit,
      profitMargin,
      totalCollected,
      outstandingBalance,
    },
    paymentBreakdown,
    sales: saleRows,
  };
}

/**
 * 4. Stock Movement Ledger Report
 * Filterable chronological audit trail of physical tyre stock movements.
 */
export async function getStockMovementLedgerReport(
  actor: AuthActor,
  filters: {
    startDate?: string;
    endDate?: string;
    movementType?: string;
    productId?: string;
    page?: number;
    limit?: number;
  } = {}
): Promise<StockMovementLedgerReport> {
  requirePermission(actor, "reports:view", "ALL");

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  const skip = (page - 1) * limit;

  const whereClause: {
    createdAt?: { gte?: Date; lte?: Date };
    movementType?: InventoryMovementType;
    productId?: string;
  } = {};

  if (filters.startDate || filters.endDate) {
    whereClause.createdAt = {};
    if (filters.startDate) {
      whereClause.createdAt.gte = new Date(`${filters.startDate}T00:00:00.000Z`);
    }
    if (filters.endDate) {
      whereClause.createdAt.lte = new Date(`${filters.endDate}T23:59:59.999Z`);
    }
  }

  if (
    filters.movementType &&
    filters.movementType !== "ALL" &&
    Object.values(InventoryMovementType).includes(filters.movementType as InventoryMovementType)
  ) {
    whereClause.movementType = filters.movementType as InventoryMovementType;
  }

  if (filters.productId && filters.productId.trim()) {
    whereClause.productId = filters.productId.trim();
  }

  const [movements, totalCount, allDeltas] = await Promise.all([
    db.inventoryMovement.findMany({
      where: whereClause,
      include: {
        product: {
          select: {
            id: true,
            brand: true,
            size: true,
            pattern: true,
          },
        },
        actor: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.inventoryMovement.count({ where: whereClause }),
    db.inventoryMovement.findMany({
      where: whereClause,
      select: { quantityDelta: true },
    }),
  ]);

  let totalInflow = 0;
  let totalOutflow = 0;

  for (const row of allDeltas) {
    if (row.quantityDelta > 0) {
      totalInflow += row.quantityDelta;
    } else if (row.quantityDelta < 0) {
      totalOutflow += Math.abs(row.quantityDelta);
    }
  }

  const netChange = totalInflow - totalOutflow;

  const movementItems: StockMovementReportItem[] = movements.map((m) => ({
    id: m.id,
    createdAt: m.createdAt.toISOString(),
    movementType: m.movementType,
    quantityDelta: m.quantityDelta,
    balanceAfter: m.balanceAfter,
    reason: m.reason,
    referenceType: m.referenceType,
    referenceId: m.referenceId,
    product: m.product,
    actor: m.actor,
  }));

  return {
    dateRange: {
      startDate: filters.startDate,
      endDate: filters.endDate,
    },
    metrics: {
      totalMovements: totalCount,
      totalInflow,
      totalOutflow,
      netChange,
    },
    movements: movementItems,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
}
