"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge, type BadgeVariant } from "@/components/ui/StatusBadge";
import { NavIcon } from "@/components/ui/NavIcon";
import type { ClaimStatus, ClaimResolutionType } from "@prisma/client";
import type { WarrantyClaimView } from "@/lib/types/warranty";

// =============================================================================
// /warranty/[id] — Single Warranty Claim Detail & Management Page
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

export default function WarrantyClaimDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolvedParams = "then" in params ? use(params) : params;
  const claimId = resolvedParams.id;

  const [claim, setClaim] = useState<WarrantyClaimView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Status Change / Review Modal
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<ClaimStatus | "">("");
  const [statusNotes, setStatusNotes] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [inspectionNotes, setInspectionNotes] = useState("");
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Replacement Modal
  const [isReplacementModalOpen, setIsReplacementModalOpen] = useState(false);
  const [replacementQty, setReplacementQty] = useState(1);
  const [replacementNotes, setReplacementNotes] = useState("");
  const [replacementSubmitting, setReplacementSubmitting] = useState(false);
  const [replacementError, setReplacementError] = useState<string | null>(null);

  // Resolution Modal (Non-stock)
  const [isResolutionModalOpen, setIsResolutionModalOpen] = useState(false);
  const [resolutionType, setResolutionType] = useState<ClaimResolutionType>("CREDIT_NOTE");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolutionSubmitting, setResolutionSubmitting] = useState(false);
  const [resolutionError, setResolutionError] = useState<string | null>(null);

  const refreshClaim = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadClaim() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/warranty/${claimId}`);
        const json = await res.json();

        if (ignore) return;

        if (!res.ok || !json.success) {
          setError(json.error || "Failed to load warranty claim.");
        } else {
          setClaim(json.data);
          setExternalRef(json.data.externalClaimReference || "");
          setInspectionNotes(json.data.inspectionNotes || "");
        }
      } catch {
        if (!ignore) setError("Network error while loading warranty claim.");
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadClaim();

    return () => {
      ignore = true;
    };
  }, [claimId, refreshKey]);

  // Handle Status Update (SUBMITTED -> UNDER_REVIEW, APPROVED, REJECTED, CANCELLED)
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claim || !targetStatus) return;

    setStatusError(null);
    setStatusSubmitting(true);

    try {
      const res = await fetch(`/api/warranty/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: targetStatus,
          decisionNotes: statusNotes || undefined,
          externalClaimReference: externalRef || undefined,
          inspectionNotes: inspectionNotes || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setStatusError(json.error || "Failed to update claim status.");
        setStatusSubmitting(false);
        return;
      }

      setSuccessMessage(`Claim status updated to ${targetStatus.replace("_", " ")} successfully!`);
      setIsStatusModalOpen(false);
      setStatusNotes("");
      refreshClaim();
    } catch {
      setStatusError("Network error updating status.");
    } finally {
      setStatusSubmitting(false);
    }
  };

  // Handle Replacement Issuance (Deducts Physical Inventory)
  const handleIssueReplacement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claim) return;

    setReplacementError(null);
    setReplacementSubmitting(true);

    try {
      const res = await fetch(`/api/warranty/${claim.id}/replacement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replacementQuantity: replacementQty,
          notes: replacementNotes || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setReplacementError(json.error || "Failed to issue replacement.");
        setReplacementSubmitting(false);
        return;
      }

      setSuccessMessage("Replacement tyre issued and stock deducted from inventory successfully!");
      setIsReplacementModalOpen(false);
      refreshClaim();
    } catch {
      setReplacementError("Network error issuing replacement.");
    } finally {
      setReplacementSubmitting(false);
    }
  };

  // Handle Non-Stock Resolution (Credit Note, Repair, No Action)
  const handleResolveClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claim) return;

    setResolutionError(null);
    setResolutionSubmitting(true);

    try {
      const res = await fetch(`/api/warranty/${claim.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolutionType,
          resolutionNotes: resolutionNotes || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setResolutionError(json.error || "Failed to resolve claim.");
        setResolutionSubmitting(false);
        return;
      }

      setSuccessMessage("Warranty claim resolved successfully!");
      setIsResolutionModalOpen(false);
      refreshClaim();
    } catch {
      setResolutionError("Network error resolving claim.");
    } finally {
      setResolutionSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-surface-500 text-sm">
        Loading warranty claim details...
      </div>
    );
  }

  if (error || !claim) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <Link href="/warranty" className="text-xs text-primary-600 hover:text-primary-800 font-semibold">
          ← Back to Warranties
        </Link>
        <Card className="p-6 text-center text-danger-700 bg-danger-50 border-danger-200">
          <p className="font-bold">{error || "Claim not found."}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link href="/warranty" className="text-xs text-primary-600 hover:text-primary-800 font-semibold">
            ← Back to Warranties
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-2xl font-extrabold text-surface-900 font-mono tracking-tight">
              {claim.claimNumber}
            </h1>
            <StatusBadge
              label={claim.status.replace("_", " ")}
              variant={getStatusBadgeVariant(claim.status)}
            />
          </div>
          <p className="text-xs text-surface-500 mt-0.5">
            Created on {new Date(claim.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
            {claim.createdByName && ` by ${claim.createdByName}`}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {claim.status === "SUBMITTED" && (
            <>
              <Button
                variant="primary"
                size="sm"
                className="font-bold inline-flex items-center gap-1.5"
                onClick={() => {
                  setTargetStatus("UNDER_REVIEW");
                  setStatusNotes("");
                  setStatusError(null);
                  setIsStatusModalOpen(true);
                }}
              >
                <NavIcon name="file-text" className="w-4 h-4" />
                <span>Submit for Brand Review</span>
              </Button>
              <Button
                variant="danger"
                size="sm"
                className="font-semibold"
                onClick={() => {
                  setTargetStatus("CANCELLED");
                  setStatusNotes("");
                  setStatusError(null);
                  setIsStatusModalOpen(true);
                }}
              >
                Cancel Claim
              </Button>
            </>
          )}

          {claim.status === "UNDER_REVIEW" && (
            <>
              <Button
                variant="primary"
                size="sm"
                className="font-bold bg-emerald-600 hover:bg-emerald-700 inline-flex items-center gap-1.5"
                onClick={() => {
                  setTargetStatus("APPROVED");
                  setStatusNotes("");
                  setStatusError(null);
                  setIsStatusModalOpen(true);
                }}
              >
                <NavIcon name="check" className="w-4 h-4" />
                <span>Approve Claim</span>
              </Button>
              <Button
                variant="danger"
                size="sm"
                className="font-semibold inline-flex items-center gap-1.5"
                onClick={() => {
                  setTargetStatus("REJECTED");
                  setStatusNotes("");
                  setStatusError(null);
                  setIsStatusModalOpen(true);
                }}
              >
                <NavIcon name="close" className="w-4 h-4" />
                <span>Reject Claim</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setTargetStatus("CANCELLED");
                  setStatusNotes("");
                  setStatusError(null);
                  setIsStatusModalOpen(true);
                }}
              >
                Cancel Claim
              </Button>
            </>
          )}

          {claim.status === "APPROVED" && (
            <>
              <Button
                variant="primary"
                size="sm"
                className="font-bold bg-primary-600 hover:bg-primary-700 inline-flex items-center gap-1.5"
                onClick={() => {
                  setReplacementQty(claim.quantity);
                  setReplacementNotes("");
                  setReplacementError(null);
                  setIsReplacementModalOpen(true);
                }}
              >
                <NavIcon name="inventory" className="w-4 h-4" />
                <span>Issue Replacement (Deduct Stock)</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="font-semibold"
                onClick={() => {
                  setResolutionType("CREDIT_NOTE");
                  setResolutionNotes("");
                  setResolutionError(null);
                  setIsResolutionModalOpen(true);
                }}
              >
                Resolve without Stock Replacement
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-3.5 rounded-md bg-success-50 border border-success-200 text-success-800 text-xs font-semibold flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <NavIcon name="check" className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </span>
          <button onClick={() => setSuccessMessage(null)} className="p-1 text-success-900 hover:bg-success-100 rounded">
            <NavIcon name="close" className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Timeline Card */}
      <Card className="p-4 bg-surface-50 border-surface-200">
        <div className="text-[11px] font-bold text-surface-500 uppercase tracking-wider mb-3">
          Claim Progress Pipeline
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className={`p-2.5 rounded-md border ${claim.status !== "CANCELLED" ? "bg-white border-primary-200 shadow-sm" : "bg-surface-100 border-surface-200 text-surface-400"}`}>
            <span className="text-[10px] text-surface-400 block font-bold">STEP 1</span>
            <span className="font-bold text-surface-900">Claim Created</span>
            <span className="text-[10px] text-surface-500 block">
              {new Date(claim.createdAt).toLocaleDateString("en-IN", { dateStyle: "short" })}
            </span>
          </div>

          <div className={`p-2.5 rounded-md border ${claim.submittedAt ? "bg-white border-amber-200 shadow-sm" : "bg-surface-100 border-surface-200 text-surface-400"}`}>
            <span className="text-[10px] text-surface-400 block font-bold">STEP 2</span>
            <span className="font-bold text-surface-900">Brand Review</span>
            <span className="text-[10px] text-surface-500 block">
              {claim.submittedAt ? new Date(claim.submittedAt).toLocaleDateString("en-IN", { dateStyle: "short" }) : "Pending submission"}
            </span>
          </div>

          <div className={`p-2.5 rounded-md border ${claim.decisionAt ? "bg-white border-primary-200 shadow-sm" : "bg-surface-100 border-surface-200 text-surface-400"}`}>
            <span className="text-[10px] text-surface-400 block font-bold">STEP 3</span>
            <span className="font-bold text-surface-900">
              {claim.status === "REJECTED" ? "Claim Rejected" : "Claim Decision"}
            </span>
            <span className="text-[10px] text-surface-500 block">
              {claim.decisionAt ? new Date(claim.decisionAt).toLocaleDateString("en-IN", { dateStyle: "short" }) : "Awaiting decision"}
            </span>
          </div>

          <div className={`p-2.5 rounded-md border ${claim.status === "RESOLVED" ? "bg-emerald-50 border-emerald-300 shadow-sm text-emerald-900" : "bg-surface-100 border-surface-200 text-surface-400"}`}>
            <span className="text-[10px] text-surface-400 block font-bold">STEP 4</span>
            <span className="font-bold">
              {claim.resolutionType === "REPLACEMENT_FROM_STOCK" ? "Tyre Replaced" : "Claim Resolved"}
            </span>
            <span className="text-[10px] block">
              {claim.resolvedAt ? new Date(claim.resolvedAt).toLocaleDateString("en-IN", { dateStyle: "short" }) : "Pending outcome"}
            </span>
          </div>
        </div>
      </Card>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer & Sale Info */}
        <Card className="p-5 space-y-4">
          <h2 className="text-xs font-bold text-surface-700 uppercase tracking-wider border-b border-surface-200 pb-2">
            Original Sale & Customer Information
          </h2>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-surface-500 block">Sale Invoice</span>
              <Link href={`/sales`} className="font-mono font-bold text-primary-600 hover:underline">
                {claim.saleInvoiceNumber}
              </Link>
            </div>
            <div>
              <span className="text-surface-500 block">Sale Date</span>
              <span className="font-medium text-surface-800">
                {new Date(claim.saleDate).toLocaleDateString("en-IN", { dateStyle: "medium" })}
              </span>
            </div>
            <div>
              <span className="text-surface-500 block">Customer Name</span>
              <span className="font-bold text-surface-900">
                {claim.customerName || "Walk-in Customer"}
              </span>
            </div>
            <div>
              <span className="text-surface-500 block">Phone Number</span>
              <span className="font-medium text-surface-800">{claim.customerPhone || "—"}</span>
            </div>
            {claim.customerVehicle && (
              <div className="col-span-2">
                <span className="text-surface-500 block">Vehicle Number</span>
                <span className="font-mono font-bold text-surface-900">{claim.customerVehicle}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Product / Tyre Info */}
        <Card className="p-5 space-y-4">
          <h2 className="text-xs font-bold text-surface-700 uppercase tracking-wider border-b border-surface-200 pb-2">
            Tyre Product Under Claim
          </h2>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="col-span-2">
              <span className="text-surface-500 block">Tyre Product</span>
              <span className="text-sm font-extrabold text-surface-900">
                {claim.productBrand} {claim.productSize}
              </span>
              {claim.productPattern && (
                <span className="text-surface-500 block">Pattern: {claim.productPattern}</span>
              )}
            </div>
            <div>
              <span className="text-surface-500 block">Quantity Claimed</span>
              <span className="font-bold text-surface-900">{claim.quantity} tyre(s)</span>
            </div>
            <div>
              <span className="text-surface-500 block">Sold Price</span>
              <span className="font-semibold text-surface-800">
                ₹{Number(claim.productSoldPrice).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            {claim.dotSerialCode && (
              <div className="col-span-2">
                <span className="text-surface-500 block">DOT / Serial Code</span>
                <span className="font-mono font-semibold text-surface-800">{claim.dotSerialCode}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Defect & Inspection */}
        <Card className="p-5 space-y-4">
          <h2 className="text-xs font-bold text-surface-700 uppercase tracking-wider border-b border-surface-200 pb-2">
            Defect Details & Inspection Notes
          </h2>
          <div className="space-y-3 text-xs">
            <div>
              <span className="text-surface-500 block font-semibold">Customer Reported Problem:</span>
              <p className="mt-1 p-2.5 bg-surface-50 rounded-md border border-surface-200 text-surface-900 font-medium">
                {claim.issueDescription}
              </p>
            </div>
            <div>
              <span className="text-surface-500 block font-semibold">Shop Inspection Notes:</span>
              <p className="mt-1 p-2.5 bg-surface-50 rounded-md border border-surface-200 text-surface-800 italic">
                {claim.inspectionNotes || "No shop inspection notes recorded yet."}
              </p>
            </div>
          </div>
        </Card>

        {/* Brand Submission & Resolution */}
        <Card className="p-5 space-y-4">
          <h2 className="text-xs font-bold text-surface-700 uppercase tracking-wider border-b border-surface-200 pb-2">
            Brand Review & Resolution
          </h2>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-surface-500 block">External Reference #</span>
              <span className="font-mono font-semibold text-surface-900">
                {claim.externalClaimReference || "—"}
              </span>
            </div>
            <div>
              <span className="text-surface-500 block">Supplier / Brand</span>
              <span className="font-medium text-surface-800">{claim.supplierName || "—"}</span>
            </div>

            {claim.decisionNotes && (
              <div className="col-span-2">
                <span className="text-surface-500 block">Decision Notes</span>
                <p className="mt-1 p-2 bg-surface-50 rounded border border-surface-200 text-surface-800">
                  {claim.decisionNotes}
                </p>
              </div>
            )}

            {claim.resolutionType && (
              <div className="col-span-2 pt-2 border-t border-surface-200">
                <span className="text-surface-500 block">Resolution Outcome</span>
                <div className="font-bold text-emerald-700 text-sm mt-0.5">
                  {claim.resolutionType.replace(/_/g, " ")}
                </div>
                {claim.replacementProductBrand && (
                  <div className="mt-1 text-xs text-surface-700">
                    Issued: {claim.replacementQuantity}x {claim.replacementProductBrand}{" "}
                    {claim.replacementProductSize}
                  </div>
                )}
                {claim.resolutionNotes && (
                  <p className="mt-1 text-xs text-surface-600 italic">
                    Notes: {claim.resolutionNotes}
                  </p>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Modal 1: Update Status / Review / Decision */}
      {isStatusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-base font-bold text-surface-900">
              {targetStatus === "UNDER_REVIEW" && "Submit Claim for Brand Review"}
              {targetStatus === "APPROVED" && "Approve Warranty Claim"}
              {targetStatus === "REJECTED" && "Reject Warranty Claim"}
              {targetStatus === "CANCELLED" && "Cancel Warranty Claim"}
            </h2>

            {statusError && (
              <div className="p-2.5 rounded bg-danger-50 border border-danger-200 text-danger-800 text-xs">
                {statusError}
              </div>
            )}

            <form onSubmit={handleUpdateStatus} className="space-y-3 text-xs">
              {targetStatus === "UNDER_REVIEW" && (
                <>
                  <div>
                    <label className="block text-surface-700 font-semibold mb-1">
                      External Brand Claim Reference (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. MRF-CLAIM-2026-981"
                      value={externalRef}
                      onChange={(e) => setExternalRef(e.target.value)}
                      className="w-full px-3 py-2 border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-surface-700 font-semibold mb-1">
                      Inspection Notes (optional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Enter inspection observations..."
                      value={inspectionNotes}
                      onChange={(e) => setInspectionNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {(targetStatus === "APPROVED" || targetStatus === "REJECTED") && (
                <div>
                  <label className="block text-surface-700 font-semibold mb-1">
                    Decision Notes / Brand Remarks
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter brand/shop decision remarks..."
                    value={statusNotes}
                    onChange={(e) => setStatusNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-surface-200">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={statusSubmitting}
                  onClick={() => setIsStatusModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={statusSubmitting}
                  className={targetStatus === "REJECTED" ? "bg-danger-600 hover:bg-danger-700" : ""}
                >
                  {statusSubmitting ? "Saving..." : "Confirm Status Update"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Issue Replacement Tyre (Atomic Inventory Deduction) */}
      {isReplacementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-base font-bold text-surface-900">
              Issue Warranty Replacement Tyre
            </h2>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-900 text-xs leading-relaxed font-medium flex items-start gap-2">
              <span className="shrink-0 text-amber-600 font-bold">!</span>
              <div>
                <strong>Inventory Action:</strong> Confirming this replacement will immediately
                deduct <strong>{replacementQty} unit(s)</strong> of{" "}
                <strong>
                  {claim.productBrand} {claim.productSize}
                </strong>{" "}
                from current store stock and mark the warranty claim as <strong>RESOLVED</strong>.
              </div>
            </div>

            {replacementError && (
              <div className="p-2.5 rounded bg-danger-50 border border-danger-200 text-danger-800 text-xs">
                {replacementError}
              </div>
            )}

            <form onSubmit={handleIssueReplacement} className="space-y-3 text-xs">
              <div>
                <label className="block text-surface-700 font-semibold mb-1">
                  Replacement Quantity
                </label>
                <input
                  type="number"
                  min={1}
                  max={claim.quantity}
                  value={replacementQty}
                  onChange={(e) => setReplacementQty(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-surface-700 font-semibold mb-1">
                  Resolution Notes (optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Fresh stock tyre issued to customer upon brand approval"
                  value={replacementNotes}
                  onChange={(e) => setReplacementNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-surface-200">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={replacementSubmitting}
                  onClick={() => setIsReplacementModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={replacementSubmitting}
                  className="font-bold bg-primary-600 hover:bg-primary-700"
                >
                  {replacementSubmitting ? "Deducting Stock..." : "Confirm & Deduct Replacement"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Non-Stock Resolution */}
      {isResolutionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-base font-bold text-surface-900">
              Resolve Warranty Claim
            </h2>

            {resolutionError && (
              <div className="p-2.5 rounded bg-danger-50 border border-danger-200 text-danger-800 text-xs">
                {resolutionError}
              </div>
            )}

            <form onSubmit={handleResolveClaim} className="space-y-3 text-xs">
              <div>
                <label className="block text-surface-700 font-semibold mb-1">
                  Resolution Outcome Type
                </label>
                <select
                  value={resolutionType}
                  onChange={(e) => setResolutionType(e.target.value as ClaimResolutionType)}
                  className="w-full px-3 py-2 border border-surface-300 rounded bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="CREDIT_NOTE">Credit Note Issued</option>
                  <option value="REPAIR">Tyre Repaired & Returned</option>
                  <option value="REJECTED_NO_ACTION">No Action (Customer Advised)</option>
                </select>
              </div>

              <div>
                <label className="block text-surface-700 font-semibold mb-1">
                  Resolution Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Enter resolution details..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-surface-200">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={resolutionSubmitting}
                  onClick={() => setIsResolutionModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={resolutionSubmitting}
                >
                  {resolutionSubmitting ? "Resolving..." : "Save Resolution"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
