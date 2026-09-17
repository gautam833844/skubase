"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
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

  // Selection & Permanent Delete State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const headerCheckboxRef = useRef<HTMLInputElement>(null);

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
        const fetchedBills: AlignmentBillView[] = Array.isArray(data.data) ? data.data : (data.data?.bills ?? []);
        setBills(fetchedBills);
        // Clean up selected IDs that are no longer in fetched bills
        setSelectedIds((prev) => {
          const next = new Set<string>();
          const currentIds = new Set(fetchedBills.map((b) => b.id));
          for (const id of prev) {
            if (currentIds.has(id)) next.add(id);
          }
          return next;
        });
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

  // Header checkbox indeterminate state sync
  const isAllSelected = bills.length > 0 && selectedIds.size === bills.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < bills.length;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isSomeSelected;
    }
  }, [isSomeSelected]);

  const handleToggleRow = (id: string, e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(bills.map((b) => b.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch("/api/alignment", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setDeleteError(json.error || "Failed to delete selected alignment documents.");
        setIsDeleting(false);
        return;
      }

      setSuccessMessage(json.message || `Successfully deleted ${selectedIds.size} document(s).`);
      setSelectedIds(new Set());
      setShowDeleteModal(false);
      await fetchBills();
    } catch {
      setDeleteError("Network error while deleting documents.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
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

      {/* Success Notification */}
      {successMessage && (
        <div
          role="status"
          className="p-4 bg-success-50 text-success-800 text-sm font-semibold rounded-lg border border-success-200 flex items-center justify-between shadow-xs"
        >
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-success-600 hover:text-success-800 font-bold ml-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter & Search Bar + Selection Actions */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          {/* Document Type Tabs */}
          <div className="flex bg-surface-100 p-1 rounded-lg w-full md:w-auto">
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

          {/* Right side: Selection Actions & Search Input */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2.5 bg-danger-50 border border-danger-200 px-3 py-1.5 rounded-lg text-sm">
                <span className="font-semibold text-danger-800 text-xs">
                  {selectedIds.size} selected
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null);
                    setShowDeleteModal(true);
                  }}
                  className="px-2.5 py-1 text-xs font-bold bg-danger-600 hover:bg-danger-700 text-white rounded cursor-pointer transition-colors shadow-xs"
                >
                  Delete Selected
                </button>
              </div>
            )}

            <div className="w-full md:w-80">
              <input
                type="text"
                placeholder="Search Bill No, Customer, Vehicle..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-surface-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
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
                  <th className="px-4 py-3 w-12 text-center">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      aria-label="Select all documents"
                      checked={isAllSelected}
                      onChange={handleToggleAll}
                      className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                    />
                  </th>
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
                {bills.map((bill) => {
                  const isSelected = selectedIds.has(bill.id);
                  return (
                    <tr
                      key={bill.id}
                      className={`transition-colors ${
                        isSelected ? "bg-primary-50/50 hover:bg-primary-50/75" : "hover:bg-surface-50/75"
                      }`}
                    >
                      <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select bill ${bill.billNumber}`}
                          checked={isSelected}
                          onChange={(e) => handleToggleRow(bill.id, e)}
                          className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                        />
                      </td>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-surface-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-danger-100 text-danger-600 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 id="delete-modal-title" className="text-lg font-bold text-surface-900">
                  Delete selected documents?
                </h3>
                <p className="text-sm text-surface-600 mt-1 leading-relaxed">
                  These Alignment bills/estimates will be permanently deleted along with their service items. This action cannot be undone.
                </p>
                <p className="text-xs font-medium text-surface-500 mt-2">
                  Selected count: <span className="font-bold text-surface-800">{selectedIds.size}</span>
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 bg-danger-50 border border-danger-200 text-danger-700 text-xs rounded-md">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-surface-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-sm font-semibold text-surface-700 bg-surface-100 hover:bg-surface-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteSelected}
                className="px-4 py-2 text-sm font-bold text-white bg-danger-600 hover:bg-danger-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
