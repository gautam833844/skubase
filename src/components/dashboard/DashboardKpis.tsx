"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { DashboardKpiData } from "@/services/dashboard.service";

function formatCurrency(amount: number): string {
  return `Rs. ${Number(amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function DashboardKpis() {
  const [kpis, setKpis] = useState<DashboardKpiData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  const fetchKpis = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setIsUnauthorized(false);

    try {
      const res = await fetch("/api/dashboard/kpis");

      if (res.status === 403 || res.status === 401) {
        setIsUnauthorized(true);
        return;
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load dashboard metrics");
      }

      setKpis(json.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load business metrics");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      setIsUnauthorized(false);

      try {
        const res = await fetch("/api/dashboard/kpis");

        if (ignore) return;

        if (res.status === 403 || res.status === 401) {
          setIsUnauthorized(true);
          return;
        }

        const json = await res.json();
        if (ignore) return;

        if (!res.ok || !json.success) {
          throw new Error(json.error || "Failed to load dashboard metrics");
        }

        setKpis(json.data);
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load business metrics");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      ignore = true;
    };
  }, []);

  // If user lacks permission (e.g. STAFF), gracefully hide financial metrics
  if (isUnauthorized) {
    return null;
  }

  // Error state with retry
  if (error) {
    return (
      <Card className="p-4 bg-danger-50/70 border border-danger-200">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-danger-700">
            Unable to load dashboard KPIs: {error}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={fetchKpis}
            className="text-xs py-1"
          >
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  // Loading skeleton
  if (isLoading || !kpis) {
    return (
      <div className="space-y-2">
        <div className="h-4 w-36 bg-surface-200 rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Card key={idx} className="p-3.5 space-y-2">
              <div className="h-3 w-20 bg-surface-200 rounded animate-pulse" />
              <div className="h-6 w-24 bg-surface-200 rounded animate-pulse" />
              <div className="h-2.5 w-16 bg-surface-200 rounded animate-pulse" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-surface-600 uppercase tracking-wider">
          Business Performance
        </h2>
        <span className="text-[11px] text-surface-400 font-medium">
          Asia/Kolkata (IST)
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Today's Sales */}
        <Card className="p-3.5 border-l-4 border-l-primary-500">
          <div className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">
            Today&apos;s Sales
          </div>
          <div className="text-lg font-extrabold text-primary-700 mt-1">
            {formatCurrency(kpis.todaySales)}
          </div>
          <div className="text-[10px] text-surface-400 mt-0.5 font-medium">
            Today&apos;s Revenue
          </div>
        </Card>

        {/* 2. Today's Gross Profit */}
        <Card className="p-3.5 border-l-4 border-l-success-500">
          <div className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">
            Today&apos;s Gross Profit
          </div>
          <div className="text-lg font-extrabold text-success-700 mt-1">
            {formatCurrency(kpis.todayGrossProfit)}
          </div>
          <div className="text-[10px] text-surface-400 mt-0.5 font-medium">
            Historical COGS applied
          </div>
        </Card>

        {/* 3. This Month's Sales */}
        <Card className="p-3.5 border-l-4 border-l-primary-600">
          <div className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">
            This Month&apos;s Sales
          </div>
          <div className="text-lg font-extrabold text-surface-900 mt-1">
            {formatCurrency(kpis.monthSales)}
          </div>
          <div className="text-[10px] text-surface-400 mt-0.5 font-medium">
            Current IST Month
          </div>
        </Card>

        {/* 4. This Month's Gross Profit */}
        <Card className="p-3.5 border-l-4 border-l-success-600">
          <div className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">
            This Month&apos;s Gross Profit
          </div>
          <div className="text-lg font-extrabold text-success-700 mt-1">
            {formatCurrency(kpis.monthGrossProfit)}
          </div>
          <div className="text-[10px] text-surface-400 mt-0.5 font-medium">
            Net Revenue - COGS
          </div>
        </Card>

        {/* 5. Completed Sales Count */}
        <Card className="p-3.5 border-l-4 border-l-surface-400">
          <div className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">
            Completed Sales
          </div>
          <div className="text-lg font-extrabold text-surface-900 mt-1">
            {kpis.completedSalesCount}
          </div>
          <div className="text-[10px] text-surface-400 mt-0.5 font-medium">
            All-time completed
          </div>
        </Card>

        {/* 6. Outstanding Payments */}
        <Card className="p-3.5 border-l-4 border-l-warning-500">
          <div className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">
            Outstanding
          </div>
          <div className="text-lg font-extrabold text-warning-700 mt-1">
            {formatCurrency(kpis.outstandingPayments)}
          </div>
          <div className="text-[10px] text-surface-400 mt-0.5 font-medium">
            Pending customer dues
          </div>
        </Card>
      </div>
    </div>
  );
}
