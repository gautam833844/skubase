"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge, type BadgeVariant } from "@/components/ui/StatusBadge";
import type { SaleStatus } from "@prisma/client";

interface SaleListItem {
  id: string;
  invoiceNumber: string;
  saleDate: string;
  status: SaleStatus;
  subtotal: string | number;
  discountAmount: string | number;
  totalAmount: string | number;
  customer: {
    id: string;
    name: string;
    phoneNumber: string | null;
    vehicleNumber: string | null;
  } | null;
  createdBy: {
    id: string;
    fullName: string;
    username: string | null;
  } | null;
  itemCount: number;
  totalQuantity: number;
}

export default function SalesPage() {
  const [sales, setSales] = useState<SaleListItem[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshSales = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadSales() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (searchTerm) params.set("search", searchTerm);
        if (statusFilter !== "ALL") params.set("status", statusFilter);

        const res = await fetch(`/api/sales?${params.toString()}`);
        const json = await res.json();

        if (ignore) return;

        if (!res.ok || !json.success) {
          setError(json.error ?? "Failed to load sales.");
        } else {
          setSales(json.data ?? []);
          if (json.statusCounts) {
            setStatusCounts(json.statusCounts);
          }
        }
      } catch {
        if (!ignore) {
          setError("Network error while loading sales.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadSales();

    return () => {
      ignore = true;
    };
  }, [searchTerm, statusFilter, refreshKey]);

  const salesStats = useMemo(() => {
    return {
      total: sales.length,
      drafts: statusCounts["DRAFT"] ?? 0,
      completed: statusCounts["COMPLETED"] ?? 0,
      voided: statusCounts["VOIDED"] ?? 0,
    };
  }, [sales.length, statusCounts]);

  const getStatusBadgeProps = (status: SaleStatus): { variant: BadgeVariant; label: string } => {
    switch (status) {
      case "DRAFT":
        return { variant: "warning", label: "Draft" };
      case "COMPLETED":
        return { variant: "success", label: "Completed" };
      case "VOIDED":
        return { variant: "danger", label: "Voided" };
      default:
        return { variant: "neutral", label: status };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Sales & Billing</h1>
          <p className="text-sm text-surface-500 mt-1">
            Create sales drafts, manage tyre billing, and track customer transactions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refreshSales} disabled={isLoading}>
            Refresh
          </Button>
          <Link href="/sales/new">
            <Button variant="primary" size="sm" className="cursor-pointer">
              + New Sale Draft (POS)
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border-l-4 border-l-primary-500">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
            Total Sales Records
          </div>
          <div className="mt-1 text-2xl font-extrabold text-surface-900">{salesStats.total}</div>
          <div className="mt-0.5 text-xs text-surface-500">All registered sales</div>
        </Card>

        <Card className="p-4 border-l-4 border-l-warning-500">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
            Active Drafts
          </div>
          <div className="mt-1 text-2xl font-extrabold text-warning-600">{salesStats.drafts}</div>
          <div className="mt-0.5 text-xs text-surface-500">Unfinalized drafts (no stock deducted)</div>
        </Card>

        <Card className="p-4 border-l-4 border-l-success-500">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
            Completed Sales
          </div>
          <div className="mt-1 text-2xl font-extrabold text-success-600">{salesStats.completed}</div>
          <div className="mt-0.5 text-xs text-surface-500">Fulfilled sales</div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label htmlFor="search-sales" className="block text-xs font-medium text-surface-600 mb-1">
              Search Sales
            </label>
            <input
              id="search-sales"
              type="text"
              placeholder="Search by Sale Number (SALE-1001), Customer name, Phone, Vehicle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-surface-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label htmlFor="status-filter" className="block text-xs font-medium text-surface-600 mb-1">
              Sale Status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-surface-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Drafts (In Progress)</option>
              <option value="COMPLETED">Completed</option>
              <option value="VOIDED">Voided</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          className="p-4 rounded-md bg-danger-50 border border-danger-300 text-danger-700 text-sm font-medium"
        >
          {error}
        </div>
      )}

      {/* Sales Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-surface-200 text-sm">
            <thead className="bg-surface-50 text-surface-600 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-4 py-3 text-left">
                  Sale Number
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Customer / Vehicle
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Date
                </th>
                <th scope="col" className="px-4 py-3 text-center">
                  Tyres Qty
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Total Amount (₹)
                </th>
                <th scope="col" className="px-4 py-3 text-center">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-surface-500">
                    Loading sales records...
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-surface-500">
                    <div className="text-base font-semibold text-surface-700">No sales records found</div>
                    <div className="text-xs text-surface-400 mt-1">
                      {searchTerm || statusFilter !== "ALL"
                        ? "Try clearing search or filters."
                        : "Click '+ New Sale Draft (POS)' above to prepare a customer sale."}
                    </div>
                  </td>
                </tr>
              ) : (
                sales.map((sale) => {
                  const badge = getStatusBadgeProps(sale.status);
                  const dateStr = new Date(sale.saleDate).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });

                  return (
                    <tr key={sale.id} className="hover:bg-surface-50/60 transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <Link
                          href={`/sales/${sale.id}`}
                          className="font-bold text-primary-600 hover:text-primary-800 underline decoration-primary-300"
                        >
                          {sale.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {sale.customer ? (
                          <div>
                            <div className="font-semibold text-surface-900">{sale.customer.name}</div>
                            {sale.customer.vehicleNumber && (
                              <div className="text-xs font-mono text-surface-600">
                                {sale.customer.vehicleNumber}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-surface-500 italic text-xs">Walk-in Customer</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-surface-600 font-medium">
                        {dateStr}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-center font-bold text-surface-800">
                        {sale.totalQuantity} tyres ({sale.itemCount} items)
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-right font-extrabold text-surface-900">
                        ₹{Number(sale.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        <StatusBadge variant={badge.variant} label={badge.label} />
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-right">
                        <Link
                          href={`/sales/${sale.id}`}
                          className="text-xs font-semibold text-primary-600 hover:text-primary-800 px-2 py-1 rounded hover:bg-primary-50 transition-colors"
                        >
                          {sale.status === "DRAFT" ? "Edit Draft" : "View Details"}
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
