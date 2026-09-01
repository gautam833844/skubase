"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge, type BadgeVariant } from "@/components/ui/StatusBadge";
import type { ClaimStatus } from "@prisma/client";
import type { WarrantyClaimSummaryView, WarrantyMetricsView } from "@/lib/types/warranty";

// =============================================================================
// /warranty — Warranty Claims Dashboard & List Page
// =============================================================================

function getStatusBadgeVariant(status: ClaimStatus): BadgeVariant {
  switch (status) {
    case "SUBMITTED":
      return "info";
    case "UNDER_REVIEW":
      return "warning";
    case "APPROVED":
      return "info";
    case "RESOLVED":
      return "success";
    case "REJECTED":
    case "CANCELLED":
      return "danger";
    default:
      return "neutral";
  }
}

export default function WarrantyPage() {
  const [claims, setClaims] = useState<WarrantyClaimSummaryView[]>([]);
  const [metrics, setMetrics] = useState<WarrantyMetricsView>({
    totalClaims: 0,
    submittedClaims: 0,
    underReviewClaims: 0,
    approvedClaims: 0,
    resolvedClaims: 0,
    rejectedClaims: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (selectedStatus !== "ALL") params.set("status", selectedStatus);
        if (searchQuery.trim()) params.set("search", searchQuery.trim());
        params.set("page", page.toString());
        params.set("limit", "25");

        const res = await fetch(`/api/warranty?${params.toString()}`);
        const json = await res.json();

        if (ignore) return;

        if (!res.ok || !json.success) {
          setError(json.error || "Failed to load warranty claims");
        } else {
          setClaims(json.data || []);
          if (json.metrics) setMetrics(json.metrics);
          if (json.pagination) {
            setTotalPages(json.pagination.totalPages);
            setTotalCount(json.pagination.totalCount);
          }
        }
      } catch {
        if (!ignore) {
          setError("Network error while loading warranty claims.");
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
  }, [selectedStatus, searchQuery, page]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-surface-900 tracking-tight">
            Warranty Claims Management
          </h1>
          <p className="text-xs text-surface-500 mt-1">
            Track tyre defect claims, brand inspection decisions, and customer replacements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/sales">
            <Button variant="secondary" size="sm" className="font-semibold">
              ← View Sales to Claim
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3 border-l-4 border-l-surface-400">
          <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider">
            Total Claims
          </div>
          <div className="text-xl font-extrabold text-surface-900 mt-0.5">
            {metrics.totalClaims}
          </div>
        </Card>

        <Card className="p-3 border-l-4 border-l-sky-500">
          <div className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">
            Submitted
          </div>
          <div className="text-xl font-extrabold text-sky-700 mt-0.5">
            {metrics.submittedClaims}
          </div>
        </Card>

        <Card className="p-3 border-l-4 border-l-amber-500">
          <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
            Under Review
          </div>
          <div className="text-xl font-extrabold text-amber-700 mt-0.5">
            {metrics.underReviewClaims}
          </div>
        </Card>

        <Card className="p-3 border-l-4 border-l-primary-500">
          <div className="text-[10px] font-bold text-primary-600 uppercase tracking-wider">
            Approved
          </div>
          <div className="text-xl font-extrabold text-primary-700 mt-0.5">
            {metrics.approvedClaims}
          </div>
        </Card>

        <Card className="p-3 border-l-4 border-l-emerald-500">
          <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
            Resolved
          </div>
          <div className="text-xl font-extrabold text-emerald-700 mt-0.5">
            {metrics.resolvedClaims}
          </div>
        </Card>

        <Card className="p-3 border-l-4 border-l-rose-500">
          <div className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">
            Rejected
          </div>
          <div className="text-xl font-extrabold text-rose-700 mt-0.5">
            {metrics.rejectedClaims}
          </div>
        </Card>
      </div>

      {/* Filters & Search Card */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="w-full sm:w-80">
            <input
              type="text"
              placeholder="Search Claim #, Customer, Sale, Tyre..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs px-3 py-2 border border-surface-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-semibold text-surface-600 whitespace-nowrap">
              Status:
            </span>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="text-xs px-3 py-2 border border-surface-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="APPROVED">Approved</option>
              <option value="RESOLVED">Resolved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Error Banner */}
      {error && (
        <div className="p-3 rounded-md bg-danger-50 border border-danger-200 text-danger-800 text-xs font-medium">
          {error}
        </div>
      )}

      {/* Claims Table Card */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3.5 bg-surface-50 border-b border-surface-200 flex items-center justify-between">
          <h2 className="text-xs font-bold text-surface-800 uppercase tracking-wider">
            Warranty Claims ({totalCount})
          </h2>
          <span className="text-xs text-surface-500">
            Page {page} of {totalPages}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-surface-200 text-sm">
            <thead className="bg-surface-50 text-surface-600 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-4 py-3 text-left">
                  Claim Number
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Sale / Date
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Customer
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Tyre Product
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Issue Reported
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-surface-500">
                    Loading warranty claims...
                  </td>
                </tr>
              ) : claims.length > 0 ? (
                claims.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-50/60 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link
                        href={`/warranty/${c.id}`}
                        className="font-mono font-bold text-xs text-primary-600 hover:text-primary-800 hover:underline"
                      >
                        {c.claimNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      <Link
                        href={`/sales`}
                        className="font-semibold text-surface-900 hover:text-primary-700"
                      >
                        {c.saleInvoiceNumber}
                      </Link>
                      <div className="text-surface-500 text-[11px]">
                        {new Date(c.saleDate).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      <div className="font-semibold text-surface-800">
                        {c.customerName || "Walk-in Customer"}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      <div className="font-bold text-surface-900">
                        {c.productBrand} {c.productSize}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-surface-700 max-w-xs truncate">
                      {c.issueDescription}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      <StatusBadge
                        label={c.status.replace("_", " ")}
                        variant={getStatusBadgeVariant(c.status)}
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-xs">
                      <Link href={`/warranty/${c.id}`}>
                        <Button variant="secondary" size="sm" className="text-xs font-semibold">
                          View Details →
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-xs text-surface-500">
                    No warranty claims found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-surface-200 bg-surface-50 flex items-center justify-between text-xs">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-surface-600 font-medium">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
