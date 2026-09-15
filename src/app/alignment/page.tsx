"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { AlignmentBillView } from "@/lib/types/alignment";

export default function AlignmentBillingPage() {
  const [bills, setBills] = useState<AlignmentBillView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState<"ALL" | "BILL" | "ESTIMATE">("ALL");

  const fetchBills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (docTypeFilter !== "ALL") params.set("documentType", docTypeFilter);

      const res = await fetch(`/api/alignment?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setBills(data.data || []);
      } else {
        setError(data.error || "Failed to load alignment records");
      }
    } catch {
      setError("Network error loading alignment records");
    } finally {
      setLoading(false);
    }
  }, [search, docTypeFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBills();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchBills]);

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-surface-900 tracking-tight">
              Alignment & Service Billing
            </h1>
            <p className="text-sm text-surface-500 mt-1">
              Workshop documentation for wheel alignment, balancing, and shop services
            </p>
          </div>
          <Link href="/alignment/new">
            <Button variant="primary">
              + New Estimate / Bill
            </Button>
          </Link>
        </div>

        {/* Filter & Search Bar */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            {/* Document Type Tabs */}
            <div className="flex bg-surface-100 p-1 rounded-lg w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setDocTypeFilter("ALL")}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  docTypeFilter === "ALL"
                    ? "bg-white text-surface-900 shadow-sm"
                    : "text-surface-600 hover:text-surface-900"
                }`}
              >
                All Documents
              </button>
              <button
                type="button"
                onClick={() => setDocTypeFilter("BILL")}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  docTypeFilter === "BILL"
                    ? "bg-white text-primary-700 shadow-sm"
                    : "text-surface-600 hover:text-surface-900"
                }`}
              >
                Bills
              </button>
              <button
                type="button"
                onClick={() => setDocTypeFilter("ESTIMATE")}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  docTypeFilter === "ESTIMATE"
                    ? "bg-white text-amber-700 shadow-sm"
                    : "text-surface-600 hover:text-surface-900"
                }`}
              >
                Estimates
              </button>
            </div>

            {/* Search Input */}
            <div className="w-full sm:w-80">
              <input
                type="text"
                placeholder="Search Bill No, Customer, Vehicle..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-surface-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </Card>

        {/* Records Table */}
        <Card className="overflow-hidden">
          {error && (
            <div className="p-4 bg-danger-50 border-b border-danger-200 text-danger-700 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="p-12 text-center text-surface-500 text-sm">
              Loading alignment records...
            </div>
          ) : bills.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <p className="text-surface-600 text-base font-medium">No alignment records found</p>
              <p className="text-surface-400 text-xs">
                Create a new estimate or bill to generate workshop documentation.
              </p>
              <Link href="/alignment/new">
                <Button variant="outline" size="sm">
                  Create First Bill / Estimate
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-50 text-surface-600 border-b border-surface-200 text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3">Bill No.</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Customer (M/s)</th>
                    <th className="px-6 py-3">Veh No.</th>
                    <th className="px-6 py-3">KM.</th>
                    <th className="px-6 py-3 text-right">Total (₹)</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {bills.map((bill) => (
                    <tr key={bill.id} className="hover:bg-surface-50/75 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-surface-900">
                        <Link href={`/alignment/${bill.id}`} className="hover:text-primary-600 hover:underline">
                          {bill.billNumber}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge
                          label={bill.documentType}
                          variant={bill.documentType === "BILL" ? "success" : "warning"}
                        />
                      </td>
                      <td className="px-6 py-4 text-surface-600">
                        {new Date(bill.date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4 font-medium text-surface-900">
                        {bill.customerName}
                        {bill.phoneNumber && (
                          <span className="block text-xs text-surface-400 font-normal">
                            {bill.phoneNumber}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono font-semibold text-surface-800">
                        {bill.vehicleNumber}
                      </td>
                      <td className="px-6 py-4 text-surface-600">
                        {bill.kilometers !== null ? bill.kilometers.toLocaleString("en-IN") : "—"}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-surface-900">
                        ₹{Number(bill.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <Link href={`/alignment/${bill.id}`}>
                          <button className="px-2.5 py-1 text-xs font-semibold bg-surface-100 text-surface-700 rounded hover:bg-surface-200 cursor-pointer">
                            View / Print
                          </button>
                        </Link>
                        <a
                          href={`/api/alignment/${bill.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 text-xs font-semibold bg-primary-50 text-primary-700 rounded hover:bg-primary-100 inline-block"
                        >
                          PDF
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
