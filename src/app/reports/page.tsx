"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { NavIcon } from "@/components/ui/NavIcon";
import type {
  StockValuationReport,
  LowStockAlertsReport,
  SalesProfitSummaryReport,
  StockMovementLedgerReport,
} from "@/services/report.service";

type ReportTab = "stock" | "low_stock" | "sales" | "movements";

// Helper to format currency consistently in INR
function formatCurrency(amount: number): string {
  return `Rs. ${Number(amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>("stock");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Report data states
  const [stockData, setStockData] = useState<StockValuationReport | null>(null);
  const [lowStockData, setLowStockData] = useState<LowStockAlertsReport | null>(null);
  const [salesData, setSalesData] = useState<SalesProfitSummaryReport | null>(null);
  const [movementsData, setMovementsData] = useState<StockMovementLedgerReport | null>(null);

  // Date filters for Sales and Movements
  const [datePreset, setDatePreset] = useState<"today" | "7days" | "month" | "custom">("month");
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      .toISOString()
      .split("T")[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Movement type filter
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>("ALL");

  // Calculate actual query start/end dates from preset
  const getDateRange = useCallback(() => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    if (datePreset === "today") {
      return { start: todayStr, end: todayStr };
    }
    if (datePreset === "7days") {
      const past = new Date(today);
      past.setDate(past.getDate() - 7);
      return { start: past.toISOString().split("T")[0], end: todayStr };
    }
    if (datePreset === "month") {
      const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
        .toISOString()
        .split("T")[0];
      return { start: monthStart, end: todayStr };
    }
    return { start: customStartDate, end: customEndDate };
  }, [datePreset, customStartDate, customEndDate]);

  useEffect(() => {
    let ignore = false;

    async function loadReport() {
      setIsLoading(true);
      setError(null);

      try {
        if (activeTab === "stock") {
          const res = await fetch("/api/reports?type=stock");
          const json = await res.json();
          if (ignore) return;
          if (!res.ok || !json.success) throw new Error(json.error || "Failed to load stock valuation report");
          setStockData(json.data);
        } else if (activeTab === "low_stock") {
          const res = await fetch("/api/reports?type=low_stock");
          const json = await res.json();
          if (ignore) return;
          if (!res.ok || !json.success) throw new Error(json.error || "Failed to load low stock report");
          setLowStockData(json.data);
        } else if (activeTab === "sales") {
          const { start, end } = getDateRange();
          const res = await fetch(`/api/reports?type=sales&startDate=${start}&endDate=${end}`);
          const json = await res.json();
          if (ignore) return;
          if (!res.ok || !json.success) throw new Error(json.error || "Failed to load sales summary report");
          setSalesData(json.data);
        } else if (activeTab === "movements") {
          const { start, end } = getDateRange();
          let url = `/api/reports?type=movements&startDate=${start}&endDate=${end}`;
          if (movementTypeFilter !== "ALL") {
            url += `&movementType=${movementTypeFilter}`;
          }
          const res = await fetch(url);
          const json = await res.json();
          if (ignore) return;
          if (!res.ok || !json.success) throw new Error(json.error || "Failed to load stock movement report");
          setMovementsData(json.data);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load report");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadReport();

    return () => {
      ignore = true;
    };
  }, [activeTab, getDateRange, movementTypeFilter]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-surface-900 tracking-tight">
          Business Reports & Analytics
        </h1>
        <p className="text-xs text-surface-500 mt-1">
          Practical reports on inventory valuation, reorders, sales profitability, and stock ledger movements.
        </p>
      </div>

      {/* Report Navigation Tabs */}
      <div className="border-b border-surface-200">
        <nav className="flex space-x-2 sm:space-x-4 overflow-x-auto" aria-label="Reports">
          <button
            type="button"
            onClick={() => setActiveTab("stock")}
            className={`inline-flex items-center gap-1.5 py-3 px-3 text-xs font-semibold whitespace-nowrap border-b-2 cursor-pointer transition-colors ${
              activeTab === "stock"
                ? "border-primary-600 text-primary-700 bg-primary-50/50 rounded-t"
                : "border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300"
            }`}
          >
            <NavIcon name="inventory" className="w-4 h-4" />
            <span>Stock Valuation & Status</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("low_stock")}
            className={`inline-flex items-center gap-1.5 py-3 px-3 text-xs font-semibold whitespace-nowrap border-b-2 cursor-pointer transition-colors ${
              activeTab === "low_stock"
                ? "border-primary-600 text-primary-700 bg-primary-50/50 rounded-t"
                : "border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300"
            }`}
          >
            <NavIcon name="alert-triangle" className="w-4 h-4" />
            <span>Low Stock Alerts</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("sales")}
            className={`inline-flex items-center gap-1.5 py-3 px-3 text-xs font-semibold whitespace-nowrap border-b-2 cursor-pointer transition-colors ${
              activeTab === "sales"
                ? "border-primary-600 text-primary-700 bg-primary-50/50 rounded-t"
                : "border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300"
            }`}
          >
            <NavIcon name="sales" className="w-4 h-4" />
            <span>Sales & Profit Summary</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("movements")}
            className={`inline-flex items-center gap-1.5 py-3 px-3 text-xs font-semibold whitespace-nowrap border-b-2 cursor-pointer transition-colors ${
              activeTab === "movements"
                ? "border-primary-600 text-primary-700 bg-primary-50/50 rounded-t"
                : "border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300"
            }`}
          >
            <NavIcon name="clipboard" className="w-4 h-4" />
            <span>Stock Movement Ledger</span>
          </button>
        </nav>
      </div>

      {/* Date Filters Bar (for Sales & Movements) */}
      {(activeTab === "sales" || activeTab === "movements") && (
        <Card className="p-4 bg-surface-50/80">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-surface-700 mr-1">Period:</span>
              <Button
                type="button"
                size="sm"
                variant={datePreset === "today" ? "primary" : "outline"}
                onClick={() => setDatePreset("today")}
                className="text-xs py-1"
              >
                Today
              </Button>
              <Button
                type="button"
                size="sm"
                variant={datePreset === "7days" ? "primary" : "outline"}
                onClick={() => setDatePreset("7days")}
                className="text-xs py-1"
              >
                Last 7 Days
              </Button>
              <Button
                type="button"
                size="sm"
                variant={datePreset === "month" ? "primary" : "outline"}
                onClick={() => setDatePreset("month")}
                className="text-xs py-1"
              >
                This Month
              </Button>
              <Button
                type="button"
                size="sm"
                variant={datePreset === "custom" ? "primary" : "outline"}
                onClick={() => setDatePreset("custom")}
                className="text-xs py-1"
              >
                Custom Range
              </Button>
            </div>

            {datePreset === "custom" && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  aria-label="Start Date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2 py-1 text-xs border border-surface-300 rounded bg-white"
                />
                <span className="text-xs text-surface-500">to</span>
                <input
                  type="date"
                  aria-label="End Date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2 py-1 text-xs border border-surface-300 rounded bg-white"
                />
              </div>
            )}

            {activeTab === "movements" && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-surface-700">Type:</span>
                <select
                  value={movementTypeFilter}
                  onChange={(e) => setMovementTypeFilter(e.target.value)}
                  className="px-2 py-1 text-xs border border-surface-300 rounded bg-white text-surface-800"
                >
                  <option value="ALL">All Types</option>
                  <option value="SALE">Sales</option>
                  <option value="PURCHASE_RECEIPT">Purchases Received</option>
                  <option value="SALE_RETURN">Customer Returns</option>
                  <option value="ADJUSTMENT_IN">Manual Stock Add (+)</option>
                  <option value="ADJUSTMENT_OUT">Manual Stock Reduce (-)</option>
                  <option value="WARRANTY_OUT_REPLACEMENT">Warranty Replacements</option>
                  <option value="OPENING_BALANCE">Opening Balance</option>
                </select>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Notifications / Errors */}
      {error && (
        <div className="p-4 bg-danger-50 text-danger-700 text-xs font-semibold rounded-lg border border-danger-200">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="p-12 text-center text-surface-500 text-sm font-medium">
          Loading report data...
        </div>
      ) : (
        <>
          {/* ================================================================= */}
          {/* 1. STOCK VALUATION & STATUS REPORT */}
          {/* ================================================================= */}
          {activeTab === "stock" && stockData && (
            <div className="space-y-6">
              {/* KPI Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <Card className="p-4">
                  <div className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">
                    Active Products
                  </div>
                  <div className="text-xl font-extrabold text-surface-900 mt-1">
                    {stockData.metrics.totalActiveProducts}
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">
                    Total Physical Tyres
                  </div>
                  <div className="text-xl font-extrabold text-primary-700 mt-1">
                    {stockData.metrics.totalPhysicalTyres}
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">
                    Inventory Value (Cost)
                  </div>
                  <div className="text-xl font-extrabold text-surface-900 mt-1">
                    {formatCurrency(stockData.metrics.totalCostValue)}
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">
                    Inventory Value (Retail)
                  </div>
                  <div className="text-xl font-extrabold text-surface-900 mt-1">
                    {formatCurrency(stockData.metrics.totalRetailValue)}
                  </div>
                </Card>

                <Card className="p-4 col-span-2 lg:col-span-1">
                  <div className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">
                    Est. Margin
                  </div>
                  <div className="text-xl font-extrabold text-success-700 mt-1">
                    {stockData.metrics.marginPercentage}%
                  </div>
                  <div className="text-[10px] text-surface-400 mt-0.5 font-medium">
                    {formatCurrency(stockData.metrics.estimatedGrossMargin)}
                  </div>
                </Card>
              </div>

              {/* Data Table */}
              <Card className="p-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-surface-200 bg-surface-50 flex justify-between items-center">
                  <h3 className="text-xs font-bold text-surface-700 uppercase tracking-wider">
                    Tyre Stock Valuation Details
                  </h3>
                  <span className="text-[11px] text-surface-500 font-medium">
                    {stockData.items.length} product(s) in catalog
                  </span>
                </div>

                {stockData.items.length === 0 ? (
                  <div className="p-8 text-center text-xs text-surface-500">
                    No active tyre products found in inventory.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-50/70 text-surface-600 font-semibold border-b border-surface-200 text-[11px] uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-4">Brand</th>
                          <th className="py-2.5 px-4">Size</th>
                          <th className="py-2.5 px-4">Pattern / Model</th>
                          <th className="py-2.5 px-4 text-right">In Stock</th>
                          <th className="py-2.5 px-4 text-right">Avg Cost</th>
                          <th className="py-2.5 px-4 text-right">Unit Price</th>
                          <th className="py-2.5 px-4 text-right">Total Cost</th>
                          <th className="py-2.5 px-4 text-right">Total Retail</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-200 font-medium">
                        {stockData.items.map((item) => (
                          <tr key={item.id} className="hover:bg-surface-50/80">
                            <td className="py-2.5 px-4 font-bold text-surface-900">{item.brand}</td>
                            <td className="py-2.5 px-4 font-mono font-semibold text-surface-800">{item.size}</td>
                            <td className="py-2.5 px-4 text-surface-600">{item.pattern || "—"}</td>
                            <td className="py-2.5 px-4 text-right font-bold text-surface-900">
                              {item.quantityOnHand}
                            </td>
                            <td className="py-2.5 px-4 text-right text-surface-600 font-mono">
                              {formatCurrency(item.averageCostPrice)}
                            </td>
                            <td className="py-2.5 px-4 text-right text-surface-900 font-mono">
                              {formatCurrency(item.unitPrice)}
                            </td>
                            <td className="py-2.5 px-4 text-right text-surface-700 font-mono">
                              {formatCurrency(item.totalCostValue)}
                            </td>
                            <td className="py-2.5 px-4 text-right font-bold text-surface-900 font-mono">
                              {formatCurrency(item.totalRetailValue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ================================================================= */}
          {/* 2. LOW STOCK ALERTS REPORT */}
          {/* ================================================================= */}
          {activeTab === "low_stock" && lowStockData && (
            <div className="space-y-6">
              {/* KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="p-4 border-l-4 border-l-warning-500">
                  <div className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">
                    Low Stock Alerts
                  </div>
                  <div className="text-xl font-extrabold text-warning-700 mt-1">
                    {lowStockData.metrics.lowStockCount}
                  </div>
                  <div className="text-[10px] text-surface-400 mt-0.5">
                    Products at or below min threshold
                  </div>
                </Card>

                <Card className="p-4 border-l-4 border-l-danger-500">
                  <div className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">
                    Out of Stock (Zero Units)
                  </div>
                  <div className="text-xl font-extrabold text-danger-700 mt-1">
                    {lowStockData.metrics.outOfStockCount}
                  </div>
                  <div className="text-[10px] text-surface-400 mt-0.5">
                    Critical stock depletion
                  </div>
                </Card>

                <Card className="p-4 border-l-4 border-l-primary-500">
                  <div className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">
                    Total Reorder Deficit
                  </div>
                  <div className="text-xl font-extrabold text-primary-700 mt-1">
                    {lowStockData.metrics.totalDeficitUnits} tyres
                  </div>
                  <div className="text-[10px] text-surface-400 mt-0.5">
                    Units needed to reach safety thresholds
                  </div>
                </Card>
              </div>

              {/* Alerts Table */}
              <Card className="p-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-surface-200 bg-surface-50 flex justify-between items-center">
                  <h3 className="text-xs font-bold text-surface-700 uppercase tracking-wider">
                    Low Stock & Reorder Requirements
                  </h3>
                  <span className="text-[11px] text-surface-500 font-medium">
                    {lowStockData.items.length} item(s) require replenishment
                  </span>
                </div>

                {lowStockData.items.length === 0 ? (
                  <div className="p-8 text-center text-xs text-success-700 font-semibold bg-success-50/40 flex items-center justify-center gap-2">
                    <NavIcon name="check" className="w-4 h-4 text-success-600" />
                    <span>All tyre products are currently well-stocked above their minimum thresholds!</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-50/70 text-surface-600 font-semibold border-b border-surface-200 text-[11px] uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-4">Status</th>
                          <th className="py-2.5 px-4">Brand</th>
                          <th className="py-2.5 px-4">Size</th>
                          <th className="py-2.5 px-4">Pattern / Model</th>
                          <th className="py-2.5 px-4 text-right">In Stock</th>
                          <th className="py-2.5 px-4 text-right">Min Alert</th>
                          <th className="py-2.5 px-4 text-right">Reorder Needed</th>
                          <th className="py-2.5 px-4 text-right">Unit Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-200 font-medium">
                        {lowStockData.items.map((item) => (
                          <tr key={item.id} className="hover:bg-surface-50/80">
                            <td className="py-2.5 px-4">
                              {item.isOutOfStock ? (
                                <StatusBadge label="Out of Stock" variant="danger" />
                              ) : (
                                <StatusBadge label="Low Stock" variant="warning" />
                              )}
                            </td>
                            <td className="py-2.5 px-4 font-bold text-surface-900">{item.brand}</td>
                            <td className="py-2.5 px-4 font-mono font-semibold text-surface-800">{item.size}</td>
                            <td className="py-2.5 px-4 text-surface-600">{item.pattern || "—"}</td>
                            <td className="py-2.5 px-4 text-right font-extrabold text-danger-700">
                              {item.quantityOnHand}
                            </td>
                            <td className="py-2.5 px-4 text-right text-surface-500 font-mono">
                              {item.minStockAlert}
                            </td>
                            <td className="py-2.5 px-4 text-right font-bold text-primary-700">
                              +{item.deficit}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono text-surface-800">
                              {formatCurrency(item.unitPrice)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ================================================================= */}
          {/* 3. SALES & PROFIT SUMMARY REPORT */}
          {/* ================================================================= */}
          {activeTab === "sales" && salesData && (
            <div className="space-y-6">
              {/* KPI Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="p-4">
                  <div className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">
                    Completed Sales
                  </div>
                  <div className="text-xl font-extrabold text-surface-900 mt-1">
                    {salesData.metrics.completedSalesCount}
                  </div>
                  <div className="text-[10px] text-surface-400 mt-0.5">
                    {salesData.metrics.tyresSold} tyre(s) sold
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">
                    Net Sales Revenue
                  </div>
                  <div className="text-xl font-extrabold text-primary-700 mt-1">
                    {formatCurrency(salesData.metrics.netRevenue)}
                  </div>
                  <div className="text-[10px] text-surface-400 mt-0.5">
                    Gross: {formatCurrency(salesData.metrics.grossSales)} (Disc: {formatCurrency(salesData.metrics.discounts)})
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">
                    Cost of Goods (COGS)
                  </div>
                  <div className="text-xl font-extrabold text-surface-900 mt-1">
                    {formatCurrency(salesData.metrics.cogs)}
                  </div>
                  <div className="text-[10px] text-surface-400 mt-0.5">
                    Based on sale-item historic cost
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">
                    Gross Profit & Margin
                  </div>
                  <div className="text-xl font-extrabold text-success-700 mt-1">
                    {formatCurrency(salesData.metrics.grossProfit)}
                  </div>
                  <div className="text-[10px] font-semibold text-success-600 mt-0.5">
                    {salesData.metrics.profitMargin}% margin
                  </div>
                </Card>
              </div>

              {/* Payment Methods Breakdown Bar */}
              <Card className="p-4">
                <div className="text-xs font-bold text-surface-700 uppercase tracking-wider mb-2">
                  Payment Collection Breakdown ({salesData.dateRange.startDate} to {salesData.dateRange.endDate})
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className="p-3 bg-surface-50 rounded border border-surface-200">
                    <div className="text-[11px] text-surface-500 font-semibold">Total Collected</div>
                    <div className="text-base font-extrabold text-success-700 mt-0.5">
                      {formatCurrency(salesData.metrics.totalCollected)}
                    </div>
                  </div>

                  <div className="p-3 bg-surface-50 rounded border border-surface-200">
                    <div className="text-[11px] text-surface-500 font-semibold">Outstanding / Credit</div>
                    <div className="text-base font-extrabold text-warning-700 mt-0.5">
                      {formatCurrency(salesData.metrics.outstandingBalance)}
                    </div>
                  </div>

                  {salesData.paymentBreakdown.map((pm) => (
                    <div key={pm.method} className="p-3 bg-surface-50 rounded border border-surface-200">
                      <div className="text-[11px] text-surface-500 font-semibold">{pm.method} ({pm.count})</div>
                      <div className="text-base font-bold text-surface-800 mt-0.5">
                        {formatCurrency(pm.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Completed Sales Log Table */}
              <Card className="p-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-surface-200 bg-surface-50 flex justify-between items-center">
                  <h3 className="text-xs font-bold text-surface-700 uppercase tracking-wider">
                    Completed Sales ({salesData.dateRange.startDate} to {salesData.dateRange.endDate})
                  </h3>
                  <span className="text-[11px] text-surface-500 font-medium">
                    Only completed sales shown (drafts/cancelled excluded)
                  </span>
                </div>

                {salesData.sales.length === 0 ? (
                  <div className="p-8 text-center text-xs text-surface-500">
                    No completed sales found for the selected period.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-50/70 text-surface-600 font-semibold border-b border-surface-200 text-[11px] uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-4">Invoice #</th>
                          <th className="py-2.5 px-4">Date</th>
                          <th className="py-2.5 px-4">Customer</th>
                          <th className="py-2.5 px-4">Vehicle</th>
                          <th className="py-2.5 px-4 text-right">Tyres</th>
                          <th className="py-2.5 px-4 text-right">Total Amount</th>
                          <th className="py-2.5 px-4 text-center">Payment Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-200 font-medium">
                        {salesData.sales.map((sale) => (
                          <tr key={sale.id} className="hover:bg-surface-50/80">
                            <td className="py-2.5 px-4 font-mono font-bold text-primary-700">
                              {sale.invoiceNumber}
                            </td>
                            <td className="py-2.5 px-4 text-surface-600">
                              {new Date(sale.saleDate).toLocaleDateString("en-IN")}
                            </td>
                            <td className="py-2.5 px-4 text-surface-900 font-bold">
                              {sale.customerName}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-surface-600">
                              {sale.vehicleNumber || "—"}
                            </td>
                            <td className="py-2.5 px-4 text-right text-surface-700">
                              {sale.itemCount}
                            </td>
                            <td className="py-2.5 px-4 text-right font-extrabold text-surface-900 font-mono">
                              {formatCurrency(sale.totalAmount)}
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <StatusBadge
                                label={sale.paymentStatus}
                                variant={
                                  sale.paymentStatus === "PAID"
                                    ? "success"
                                    : sale.paymentStatus === "PARTIALLY_PAID"
                                    ? "warning"
                                    : "neutral"
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ================================================================= */}
          {/* 4. STOCK MOVEMENT LEDGER REPORT */}
          {/* ================================================================= */}
          {activeTab === "movements" && movementsData && (
            <div className="space-y-6">
              {/* KPI Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="p-4">
                  <div className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">
                    Total Movements
                  </div>
                  <div className="text-xl font-extrabold text-surface-900 mt-1">
                    {movementsData.metrics.totalMovements}
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">
                    Total Inflow (+)
                  </div>
                  <div className="text-xl font-extrabold text-success-700 mt-1">
                    +{movementsData.metrics.totalInflow}
                  </div>
                  <div className="text-[10px] text-surface-400 mt-0.5">Purchases, returns & adds</div>
                </Card>

                <Card className="p-4">
                  <div className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">
                    Total Outflow (-)
                  </div>
                  <div className="text-xl font-extrabold text-danger-700 mt-1">
                    -{movementsData.metrics.totalOutflow}
                  </div>
                  <div className="text-[10px] text-surface-400 mt-0.5">Sales, warranties & deductions</div>
                </Card>

                <Card className="p-4">
                  <div className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">
                    Net Stock Change
                  </div>
                  <div
                    className={`text-xl font-extrabold mt-1 ${
                      movementsData.metrics.netChange >= 0 ? "text-success-700" : "text-danger-700"
                    }`}
                  >
                    {movementsData.metrics.netChange > 0 ? "+" : ""}
                    {movementsData.metrics.netChange}
                  </div>
                  <div className="text-[10px] text-surface-400 mt-0.5">Period net delta</div>
                </Card>
              </div>

              {/* Ledger Table */}
              <Card className="p-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-surface-200 bg-surface-50 flex justify-between items-center">
                  <h3 className="text-xs font-bold text-surface-700 uppercase tracking-wider">
                    Physical Stock Movement Audit Trail
                  </h3>
                  <span className="text-[11px] text-surface-500 font-medium">
                    {movementsData.movements.length} movement(s) recorded
                  </span>
                </div>

                {movementsData.movements.length === 0 ? (
                  <div className="p-8 text-center text-xs text-surface-500">
                    No stock movements recorded for the selected filter criteria.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-50/70 text-surface-600 font-semibold border-b border-surface-200 text-[11px] uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-4">Date & Time</th>
                          <th className="py-2.5 px-4">Tyre Product</th>
                          <th className="py-2.5 px-4">Movement Type</th>
                          <th className="py-2.5 px-4 text-right">Quantity Change</th>
                          <th className="py-2.5 px-4 text-right">Balance After</th>
                          <th className="py-2.5 px-4">Reason / Notes</th>
                          <th className="py-2.5 px-4">Logged By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-200 font-medium">
                        {movementsData.movements.map((m) => (
                          <tr key={m.id} className="hover:bg-surface-50/80">
                            <td className="py-2.5 px-4 text-surface-600 whitespace-nowrap">
                              {new Date(m.createdAt).toLocaleString("en-IN", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                            </td>
                            <td className="py-2.5 px-4">
                              <span className="font-bold text-surface-900">{m.product.brand}</span>{" "}
                              <span className="font-mono text-surface-700">{m.product.size}</span>
                              {m.product.pattern && (
                                <span className="text-surface-500 text-[11px]"> ({m.product.pattern})</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4">
                              <StatusBadge
                                label={m.movementType}
                                variant={
                                  m.quantityDelta > 0
                                    ? "success"
                                    : m.movementType === "SALE"
                                    ? "info"
                                    : "neutral"
                                }
                              />
                            </td>
                            <td
                              className={`py-2.5 px-4 text-right font-extrabold ${
                                m.quantityDelta > 0 ? "text-success-700" : "text-danger-700"
                              }`}
                            >
                              {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                            </td>
                            <td className="py-2.5 px-4 text-right font-bold text-surface-900 font-mono">
                              {m.balanceAfter}
                            </td>
                            <td className="py-2.5 px-4 text-surface-500 text-[11px] max-w-xs truncate">
                              {m.reason || "—"}
                            </td>
                            <td className="py-2.5 px-4 text-surface-600 text-[11px]">
                              {m.actor?.fullName || m.actor?.username || "System"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
