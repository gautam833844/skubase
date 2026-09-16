"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge, type BadgeVariant } from "@/components/ui/StatusBadge";
import { NavIcon } from "@/components/ui/NavIcon";
import type { SaleStatus, PaymentStatus, PaymentMethod } from "@prisma/client";
import type { SalePaymentDetails } from "@/lib/types/payments";
import type { SaleReturnView, SaleReturnableItemView } from "@/lib/types/returns";
import type { WarrantyClaimSummaryView, SaleItemWarrantyEligibilityView } from "@/lib/types/warranty";

interface SaleDetailView {
  id: string;
  invoiceNumber: string;
  saleDate: string;
  status: SaleStatus;
  paymentStatus: PaymentStatus;
  subtotal: string | number;
  discountAmount: string | number;
  taxAmount: string | number;
  totalAmount: string | number;
  notes: string | null;
  customer: {
    id: string;
    name: string;
    phoneNumber: string | null;
    vehicleNumber: string | null;
    vehicleModel: string | null;
    address: string | null;
  } | null;
  createdBy: {
    id: string;
    fullName: string;
    username: string | null;
  } | null;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    unitPrice: string | number;
    costPrice: string | number;
    discountAmount: string | number;
    totalPrice: string | number;
    product: {
      id: string;
      brand: string;
      size: string;
      pattern: string;
      unitPrice: string | number;
      quantityOnHand: number;
    };
  }>;
  itemCount: number;
  totalQuantity: number;
}

export default function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolvedParams = "then" in params ? use(params) : params;
  const saleId = resolvedParams.id;

  const [sale, setSale] = useState<SaleDetailView | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<SalePaymentDetails | null>(null);
  const [returns, setReturns] = useState<SaleReturnView[]>([]);
  const [returnableItems, setReturnableItems] = useState<SaleReturnableItemView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Edit Notes Modal
  const [isEditNotesOpen, setIsEditNotesOpen] = useState(false);
  const [editNotesText, setEditNotesText] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Confirm Sale Modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Record Payment Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Process Return Modal
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returnConditions, setReturnConditions] = useState<Record<string, "SELLABLE" | "DAMAGED" | "NON_SELLABLE">>({});
  const [returnReasons, setReturnReasons] = useState<Record<string, string>>({});
  const [returnGeneralReason, setReturnGeneralReason] = useState("");
  const [returnGeneralNotes, setReturnGeneralNotes] = useState("");
  const [refundOption, setRefundOption] = useState<"PENDING" | "REFUNDED">("PENDING");
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);

  // Warranty Claims State
  const [warrantyClaims, setWarrantyClaims] = useState<WarrantyClaimSummaryView[]>([]);
  const [warrantyEligibility, setWarrantyEligibility] = useState<SaleItemWarrantyEligibilityView[]>([]);
  const [isWarrantyModalOpen, setIsWarrantyModalOpen] = useState(false);
  const [warrantySaleItemId, setWarrantySaleItemId] = useState("");
  const [warrantyIssue, setWarrantyIssue] = useState("");
  const [warrantyInspection, setWarrantyInspection] = useState("");
  const [warrantyDotCode, setWarrantyDotCode] = useState("");
  const [warrantyExternalRef, setWarrantyExternalRef] = useState("");
  const [warrantySubmitting, setWarrantySubmitting] = useState(false);
  const [warrantyError, setWarrantyError] = useState<string | null>(null);

  const refreshSale = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadSaleData() {
      setIsLoading(true);
      setError(null);
      try {
        const [saleRes, paymentRes, returnsRes, warrantyRes] = await Promise.all([
          fetch(`/api/sales/${saleId}`),
          fetch(`/api/sales/${saleId}/payments`),
          fetch(`/api/sales/${saleId}/returns`),
          fetch(`/api/sales/${saleId}/warranty`),
        ]);

        const saleJson = await saleRes.json();
        const paymentJson = await paymentRes.json();
        const returnsJson = await returnsRes.json();
        const warrantyJson = await warrantyRes.json();

        if (ignore) return;

        if (!saleRes.ok || !saleJson.success) {
          setError(saleJson.error ?? "Failed to load sale.");
        } else {
          setSale(saleJson.data);
          setEditNotesText(saleJson.data.notes ?? "");
        }

        if (paymentRes.ok && paymentJson.success) {
          setPaymentDetails(paymentJson.data);
        }

        if (returnsRes.ok && returnsJson.success) {
          setReturns(returnsJson.data.returns || []);
          setReturnableItems(returnsJson.data.returnableItems || []);
        }

        if (warrantyRes.ok && warrantyJson.success) {
          setWarrantyClaims(warrantyJson.data.claims || []);
          setWarrantyEligibility(warrantyJson.data.items || []);
        }
      } catch {
        if (!ignore) {
          setError("Network error while loading sale.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadSaleData();

    return () => {
      ignore = true;
    };
  }, [saleId, refreshKey]);

  const handleUpdateNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sale) return;

    setModalError(null);
    setFormSubmitting(true);

    try {
      const res = await fetch(`/api/sales/${sale.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: editNotesText }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setModalError(json.error ?? "Failed to update notes.");
        setFormSubmitting(false);
        return;
      }

      setSuccessMessage("Sale notes updated successfully!");
      setIsEditNotesOpen(false);
      refreshSale();
    } catch {
      setModalError("Network error updating notes.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleConfirmSale = async () => {
    if (!sale) return;

    setConfirmError(null);
    setConfirmSubmitting(true);

    try {
      const res = await fetch(`/api/sales/${sale.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setConfirmError(json.error ?? "Failed to confirm sale.");
        setConfirmSubmitting(false);
        return;
      }

      setSuccessMessage(json.message ?? "Sale confirmed and stock deducted successfully!");
      setIsConfirmModalOpen(false);
      refreshSale();
    } catch {
      setConfirmError("Network error confirming sale.");
    } finally {
      setConfirmSubmitting(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sale) return;

    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setPaymentError("Please enter a valid positive payment amount.");
      return;
    }

    setPaymentError(null);
    setPaymentSubmitting(true);

    try {
      const res = await fetch(`/api/sales/${sale.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(paymentAmount),
          paymentMethod,
          referenceNumber: paymentRef || undefined,
          notes: paymentNotes || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setPaymentError(json.error ?? "Failed to record payment.");
        setPaymentSubmitting(false);
        return;
      }

      setSuccessMessage(json.message ?? "Payment recorded successfully!");
      setIsPaymentModalOpen(false);
      setPaymentAmount("");
      setPaymentRef("");
      setPaymentNotes("");
      refreshSale();
    } catch {
      setPaymentError("Network error recording payment.");
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const calculateTotalReturnValue = () => {
    return Object.entries(returnQuantities).reduce((sum, [saleItemId, qty]) => {
      if (qty <= 0) return sum;
      const item = returnableItems.find((i) => i.saleItemId === saleItemId);
      if (!item) return sum;
      return sum + Number(item.unitPrice) * qty;
    }, 0);
  };

  const handleProcessReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sale) return;

    const itemsToReturn = Object.entries(returnQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([saleItemId, qty]) => ({
        saleItemId,
        quantity: qty,
        condition: returnConditions[saleItemId] || "SELLABLE",
        reason: returnReasons[saleItemId] || undefined,
      }));

    if (itemsToReturn.length === 0) {
      setReturnError("Please select at least 1 item quantity to return.");
      return;
    }

    setReturnError(null);
    setReturnSubmitting(true);

    const totalReturnValue = calculateTotalReturnValue();

    try {
      const res = await fetch(`/api/sales/${sale.id}/returns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: itemsToReturn,
          reason: returnGeneralReason || undefined,
          notes: returnGeneralNotes || undefined,
          refundStatus: refundOption,
          refundAmount: refundOption === "REFUNDED" ? totalReturnValue : 0,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setReturnError(json.error ?? "Failed to process return.");
        setReturnSubmitting(false);
        return;
      }

      setSuccessMessage(`Return ${json.data.returnNumber} recorded successfully! Inventory has been restored.`);
      setSuccessMessage(
        `Successfully processed return #${json.data.returnNumber} for ₹${parseFloat(json.data.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}.`
      );
      setIsReturnModalOpen(false);
      refreshSale();
    } catch {
      setReturnError("Network error while submitting sales return.");
    } finally {
      setReturnSubmitting(false);
    }
  };

  const handleCreateWarrantyClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sale || !warrantySaleItemId) return;

    if (!warrantyIssue.trim()) {
      setWarrantyError("Please describe the customer's reported defect.");
      return;
    }

    setWarrantyError(null);
    setWarrantySubmitting(true);

    try {
      const res = await fetch(`/api/sales/${sale.id}/warranty`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleItemId: warrantySaleItemId,
          issueDescription: warrantyIssue.trim(),
          inspectionNotes: warrantyInspection.trim() || undefined,
          dotSerialCode: warrantyDotCode.trim() || undefined,
          externalClaimReference: warrantyExternalRef.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setWarrantyError(json.error ?? "Failed to create warranty claim.");
        setWarrantySubmitting(false);
        return;
      }

      setSuccessMessage(`Warranty claim #${json.data.claimNumber} logged successfully!`);
      setIsWarrantyModalOpen(false);
      refreshSale();
    } catch {
      setWarrantyError("Network error while submitting warranty claim.");
    } finally {
      setWarrantySubmitting(false);
    }
  };

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

  const getPaymentStatusBadgeProps = (status: PaymentStatus): { variant: BadgeVariant; label: string } => {
    switch (status) {
      case "PAID":
        return { variant: "success", label: "Paid" };
      case "PARTIALLY_PAID":
        return { variant: "warning", label: "Partially Paid" };
      case "UNPAID":
        return { variant: "danger", label: "Unpaid" };
      default:
        return { variant: "neutral", label: status };
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-surface-500 font-medium">
        Loading sale record...
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className="space-y-4">
        <Link href="/sales" className="text-xs text-primary-600 font-semibold">
          ← Back to Sales
        </Link>
        <div className="p-4 bg-danger-50 text-danger-700 font-medium rounded border border-danger-200">
          {error ?? "Sale record not found."}
        </div>
      </div>
    );
  }

  const badge = getStatusBadgeProps(sale.status);
  const paymentBadge = getPaymentStatusBadgeProps(sale.paymentStatus);

  const totalAmountNum = Number(sale.totalAmount);
  const totalPaidNum = paymentDetails ? Number(paymentDetails.totalPaid) : 0;
  const remainingBalanceNum = paymentDetails
    ? Number(paymentDetails.remainingBalance)
    : Math.max(0, totalAmountNum - totalPaidNum);

  const totalReturnableUnits = returnableItems.reduce(
    (sum, item) => sum + item.returnableQuantity,
    0
  );
  const totalReturnedValue = returns.reduce(
    (sum, r) => sum + Number(r.totalAmount),
    0
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/sales"
            className="text-xs text-primary-600 hover:text-primary-800 font-semibold"
          >
            ← Back to Sales
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-2xl font-extrabold text-surface-900">{sale.invoiceNumber}</h1>
            <StatusBadge label={badge.label} variant={badge.variant} />
            {sale.status === "COMPLETED" && (
              <StatusBadge label={paymentBadge.label} variant={paymentBadge.variant} />
            )}
          </div>
          <p className="text-xs text-surface-500 mt-0.5">
            Date:{" "}
            {new Date(sale.saleDate).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {sale.status === "DRAFT" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditNotesOpen(true)}
                className="cursor-pointer font-semibold"
              >
                Edit Notes
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setConfirmError(null);
                  setIsConfirmModalOpen(true);
                }}
                className="cursor-pointer font-bold"
              >
                Confirm Sale (Deduct Stock)
              </Button>
            </>
          )}

          {sale.status === "COMPLETED" && (
            <>
              <Link href={`/sales/${sale.id}/receipt`}>
                <Button variant="outline" size="sm" className="cursor-pointer font-semibold inline-flex items-center gap-1.5">
                  <NavIcon name="file-text" className="w-3.5 h-3.5 text-surface-500" />
                  View Receipt / Bill
                </Button>
              </Link>
              {remainingBalanceNum > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setPaymentError(null);
                    setPaymentAmount(remainingBalanceNum.toFixed(2));
                    setPaymentMethod("CASH");
                    setPaymentRef("");
                    setPaymentNotes("");
                    setIsPaymentModalOpen(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 font-bold cursor-pointer inline-flex items-center gap-1.5"
                >
                  <NavIcon name="plus" className="w-3.5 h-3.5" />
                  Record Payment
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={totalReturnableUnits === 0}
                onClick={() => {
                  setReturnError(null);
                  setReturnQuantities({});
                  setReturnConditions({});
                  setReturnReasons({});
                  setReturnGeneralReason("");
                  setReturnGeneralNotes("");
                  setRefundOption("PENDING");
                  setIsReturnModalOpen(true);
                }}
                className="cursor-pointer font-semibold text-surface-700 hover:text-surface-900 border-surface-300 inline-flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                Process Return {totalReturnableUnits > 0 && `(${totalReturnableUnits} eligible)`}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setWarrantyError(null);
                  setWarrantySaleItemId(warrantyEligibility[0]?.saleItemId || "");
                  setWarrantyIssue("");
                  setWarrantyInspection("");
                  setWarrantyDotCode("");
                  setWarrantyExternalRef("");
                  setIsWarrantyModalOpen(true);
                }}
                className="cursor-pointer font-semibold text-surface-700 hover:text-surface-900 border-surface-300 inline-flex items-center gap-1.5"
              >
                <NavIcon name="warranty" className="w-3.5 h-3.5 text-surface-500" />
                Create Warranty Claim
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div
          role="status"
          className="p-4 bg-success-50 text-success-800 text-sm font-semibold rounded-lg border border-success-200 flex items-center justify-between"
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

      {/* Payment & Return Summary Cards for Completed Sales */}
      {sale.status === "COMPLETED" && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="p-4 border-l-4 border-l-primary-500">
            <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
              Total Sale Amount
            </div>
            <div className="mt-1 text-2xl font-extrabold text-surface-900">
              ₹{totalAmountNum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-0.5 text-xs text-surface-500">Original sale total</div>
          </Card>

          <Card className="p-4 border-l-4 border-l-emerald-500">
            <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
              Amount Paid
            </div>
            <div className="mt-1 text-2xl font-extrabold text-emerald-600">
              ₹{totalPaidNum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-0.5 text-xs text-surface-500">
              {paymentDetails?.payments.length ?? 0} recorded payment(s)
            </div>
          </Card>

          <Card
            className={`p-4 border-l-4 ${
              remainingBalanceNum === 0 ? "border-l-success-500" : "border-l-warning-500"
            }`}
          >
            <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
              Remaining Balance
            </div>
            <div
              className={`mt-1 text-2xl font-extrabold ${
                remainingBalanceNum === 0 ? "text-success-600" : "text-warning-600"
              }`}
            >
              ₹{remainingBalanceNum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-0.5 text-xs text-surface-500">
              {remainingBalanceNum === 0 ? "Settled completely" : "Outstanding balance"}
            </div>
          </Card>

          <Card className="p-4 border-l-4 border-l-indigo-500">
            <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
              Total Returns
            </div>
            <div className="mt-1 text-2xl font-extrabold text-indigo-700">
              ₹{totalReturnedValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-0.5 text-xs text-surface-500">
              {returns.length} return record(s)
            </div>
          </Card>
        </div>
      )}

      {/* Customer Info Card */}
      <Card className="p-4">
        <div className="text-xs font-bold text-surface-800 uppercase tracking-wider mb-2">
          Customer & Vehicle Information
        </div>
        {sale.customer ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-xs text-surface-500 block">Customer Name</span>
              <span className="font-bold text-surface-900">{sale.customer.name}</span>
            </div>
            <div>
              <span className="text-xs text-surface-500 block">Phone Number</span>
              <span className="font-medium text-surface-800">
                {sale.customer.phoneNumber || "—"}
              </span>
            </div>
            <div>
              <span className="text-xs text-surface-500 block">Vehicle Number</span>
              <span className="font-mono font-bold text-surface-900">
                {sale.customer.vehicleNumber || "—"}
              </span>
              {sale.customer.vehicleModel && (
                <span className="text-xs text-surface-500 block">
                  ({sale.customer.vehicleModel})
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="text-xs text-surface-500 italic">
            Walk-in Customer (No customer record attached)
          </div>
        )}
      </Card>

      {/* Items Table */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3.5 bg-surface-50 border-b border-surface-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-surface-800 uppercase tracking-wider">
            Sale Line Items
          </h2>
          <span className="text-xs text-surface-500 font-medium">
            {sale.itemCount} item(s), {sale.totalQuantity} total tyre(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-surface-200 text-sm">
            <thead className="bg-surface-50 text-surface-600 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-4 py-3 text-left">
                  Tyre Product
                </th>
                <th scope="col" className="px-4 py-3 text-center">
                  Stock Status
                </th>
                <th scope="col" className="px-4 py-3 text-center">
                  Qty Sold
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Unit Price (₹)
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Discount (₹)
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Line Total (₹)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 bg-white">
              {sale.items.map((item) => (
                <tr key={item.id} className="hover:bg-surface-50/60 transition-colors">
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <div className="font-bold text-surface-900">
                      {item.product.brand} {item.product.size}
                    </div>
                    {item.product.pattern && (
                      <div className="text-xs text-surface-500">{item.product.pattern}</div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-center text-xs">
                    <span
                      className={`px-2 py-0.5 rounded font-medium ${
                        item.product.quantityOnHand >= item.quantity
                          ? "bg-success-50 text-success-700"
                          : "bg-warning-50 text-warning-800 font-bold"
                      }`}
                    >
                      {item.product.quantityOnHand} in stock
                    </span>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-center font-bold text-surface-900">
                    {item.quantity}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-right font-medium text-surface-800">
                    ₹{Number(item.unitPrice).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-right text-xs text-surface-600">
                    {Number(item.discountAmount) > 0
                      ? `-₹${Number(item.discountAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-right font-bold text-surface-900">
                    ₹{Number(item.totalPrice).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div className="p-4 bg-surface-50 border-t border-surface-200 flex justify-end">
          <div className="w-64 space-y-1.5 text-xs text-surface-700">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-semibold text-surface-900">
                ₹{Number(sale.subtotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            {Number(sale.discountAmount) > 0 && (
              <div className="flex justify-between text-danger-700">
                <span>Total Discount:</span>
                <span className="font-semibold">
                  -₹{Number(sale.discountAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm font-extrabold text-surface-900 pt-2 border-t border-surface-200">
              <span>Grand Total:</span>
              <span className="text-base text-primary-800">
                ₹{Number(sale.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Returns & Refunds History Card */}
      {sale.status === "COMPLETED" && (
        <Card className="overflow-hidden">
          <div className="px-5 py-3.5 bg-surface-50 border-b border-surface-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-surface-800 uppercase tracking-wider">
              Returns & Refunds History
            </h2>
            <span className="text-xs text-surface-500 font-medium">
              {returns.length} return record(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-surface-200 text-sm">
              <thead className="bg-surface-50 text-surface-600 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left">
                    Return #
                  </th>
                  <th scope="col" className="px-4 py-3 text-left">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-3 text-left">
                    Returned Items
                  </th>
                  <th scope="col" className="px-4 py-3 text-left">
                    Reason / Notes
                  </th>
                  <th scope="col" className="px-4 py-3 text-left">
                    Refund Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Return Value (₹)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 bg-white">
                {returns.length > 0 ? (
                  returns.map((ret) => (
                    <tr key={ret.id} className="hover:bg-surface-50/60 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-xs text-primary-800">
                        {ret.returnNumber}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-surface-600">
                        {new Date(ret.returnDate).toLocaleDateString("en-IN", {
                          dateStyle: "medium",
                        })}
                      </td>
                      <td className="px-4 py-3 text-xs text-surface-800">
                        <ul className="space-y-1">
                          {ret.items.map((i) => (
                            <li key={i.id} className="flex items-center gap-1.5">
                              <span className="font-semibold">{i.quantity}x</span>
                              <span>
                                {i.brand} {i.size}
                              </span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                  i.condition === "SELLABLE"
                                    ? "bg-success-50 text-success-700"
                                    : "bg-danger-50 text-danger-700"
                                }`}
                              >
                                {i.condition}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-4 py-3 text-xs text-surface-600">
                        {ret.reason && <div className="font-medium text-surface-800">{ret.reason}</div>}
                        {ret.notes && <div className="text-surface-500 italic">{ret.notes}</div>}
                        {!ret.reason && !ret.notes && "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold ${
                            ret.refundStatus === "REFUNDED"
                              ? "bg-success-50 text-success-700"
                              : ret.refundStatus === "CREDITED"
                              ? "bg-primary-50 text-primary-700"
                              : "bg-warning-50 text-warning-800"
                          }`}
                        >
                          {ret.refundStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-surface-900">
                        ₹{Number(ret.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-xs text-surface-500">
                      No returns recorded for this sale. Click &quot;↩️ Process Return&quot; if the customer returns tyres.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Warranty Claims History Card */}
      {sale.status === "COMPLETED" && (
        <Card className="overflow-hidden">
          <div className="px-5 py-3.5 bg-surface-50 border-b border-surface-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-surface-800 uppercase tracking-wider">
              Warranty Claims History
            </h2>
            <span className="text-xs text-surface-500 font-medium">
              {warrantyClaims.length} claim(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-surface-200 text-sm">
              <thead className="bg-surface-50 text-surface-600 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left">
                    Claim #
                  </th>
                  <th scope="col" className="px-4 py-3 text-left">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-3 text-left">
                    Tyre Product
                  </th>
                  <th scope="col" className="px-4 py-3 text-left">
                    Reported Issue
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
                {warrantyClaims.length > 0 ? (
                  warrantyClaims.map((claim) => (
                    <tr key={claim.id} className="hover:bg-surface-50/60 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-xs text-primary-800">
                        <Link href={`/warranty/${claim.id}`} className="hover:underline">
                          {claim.claimNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-surface-600">
                        {new Date(claim.createdAt).toLocaleDateString("en-IN", {
                          dateStyle: "medium",
                        })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-surface-900">
                        {claim.productBrand} {claim.productSize}
                      </td>
                      <td className="px-4 py-3 text-xs text-surface-700 max-w-xs truncate">
                        {claim.issueDescription}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs">
                        <StatusBadge
                          label={claim.status.replace("_", " ")}
                          variant={claim.status === "RESOLVED" ? "success" : claim.status === "APPROVED" ? "info" : claim.status === "UNDER_REVIEW" ? "warning" : "info"}
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-xs">
                        <Link href={`/warranty/${claim.id}`}>
                          <Button variant="secondary" size="sm" className="text-xs font-semibold">
                            View Claim →
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-xs text-surface-500">
                      No warranty claims logged for this sale. Click &quot;Create Warranty Claim&quot; if a tyre has a suspected defect.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Payment History Card for Completed Sales */}
      {sale.status === "COMPLETED" && (
        <Card className="overflow-hidden">
          <div className="px-5 py-3.5 bg-surface-50 border-b border-surface-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-surface-800 uppercase tracking-wider">
              Payment Transactions History
            </h2>
            <span className="text-xs text-surface-500 font-medium">
              {paymentDetails?.payments.length ?? 0} transaction(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-surface-200 text-sm">
              <thead className="bg-surface-50 text-surface-600 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left">
                    Date & Time
                  </th>
                  <th scope="col" className="px-4 py-3 text-left">
                    Method
                  </th>
                  <th scope="col" className="px-4 py-3 text-left">
                    Reference / Notes
                  </th>
                  <th scope="col" className="px-4 py-3 text-left">
                    Recorded By
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Amount (₹)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 bg-white">
                {paymentDetails && paymentDetails.payments.length > 0 ? (
                  paymentDetails.payments.map((p) => (
                    <tr key={p.id} className="hover:bg-surface-50/60 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-surface-600">
                        {new Date(p.paymentDate).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-primary-50 text-primary-700">
                          {p.paymentMethod}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-surface-600">
                        {p.referenceNumber && (
                          <div className="font-mono text-surface-800">Ref: {p.referenceNumber}</div>
                        )}
                        {p.notes && <div className="text-surface-500 italic">{p.notes}</div>}
                        {!p.referenceNumber && !p.notes && "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-surface-700">
                        {p.createdBy?.fullName ?? p.createdBy?.username ?? "Seller"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-surface-900">
                        ₹{Number(p.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-xs text-surface-500">
                      No payments recorded yet. Click &quot;+ Record Payment&quot; to add a payment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Notes Card */}
      {sale.notes && (
        <Card className="p-4 text-xs">
          <span className="font-bold text-surface-800 uppercase block mb-1">Billing Notes</span>
          <p className="text-surface-600">{sale.notes}</p>
        </Card>
      )}

      {/* Status Notice */}
      {sale.status === "DRAFT" ? (
        <div className="p-3.5 bg-warning-50 rounded border border-warning-200 text-xs text-warning-900 flex items-start gap-2">
          <span className="font-bold shrink-0">Note:</span>
          <div>
            <strong>Draft Status:</strong> This record is currently in Draft.
            Physical stock has NOT been deducted. Click{" "}
            <span className="font-bold">&quot;Confirm Sale (Deduct Stock)&quot;</span> above to finalize.
          </div>
        </div>
      ) : sale.status === "COMPLETED" ? (
        <div className="p-3.5 bg-success-50 rounded border border-success-200 text-xs text-success-900 flex items-start gap-2">
          <NavIcon name="check" className="w-4 h-4 text-success-600 shrink-0 mt-0.5" />
          <div>
            <strong>Sale Completed:</strong> Physical stock has been deducted from the warehouse inventory.
          </div>
        </div>
      ) : null}

      {/* PROCESS SALES RETURN MODAL */}
      {isReturnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-surface-200 pb-3 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-extrabold text-surface-900">Process Sales Return</h2>
                <p className="text-xs text-surface-500 mt-0.5">
                  Sale Number: <span className="font-bold text-surface-800">{sale.invoiceNumber}</span>
                </p>
              </div>
              <button
                onClick={() => setIsReturnModalOpen(false)}
                className="text-surface-400 hover:text-surface-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {returnError && (
              <div className="p-3 bg-danger-50 text-danger-700 text-xs font-semibold rounded border border-danger-200">
                {returnError}
              </div>
            )}

            <form onSubmit={handleProcessReturn} className="space-y-4">
              {/* Returnable Items Selection Table */}
              <div className="border border-surface-200 rounded overflow-hidden">
                <table className="min-w-full divide-y divide-surface-200 text-xs">
                  <thead className="bg-surface-50 text-surface-600 font-semibold uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">Tyre Item</th>
                      <th className="px-3 py-2 text-center">Sold / Returnable</th>
                      <th className="px-3 py-2 text-center">Return Qty</th>
                      <th className="px-3 py-2 text-left">Condition</th>
                      <th className="px-3 py-2 text-right">Unit Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 bg-white">
                    {returnableItems.map((item) => {
                      const qty = returnQuantities[item.saleItemId] || 0;
                      return (
                        <tr key={item.saleItemId} className="hover:bg-surface-50/50">
                          <td className="px-3 py-2.5">
                            <div className="font-bold text-surface-900">
                              {item.brand} {item.size}
                            </div>
                            {item.pattern && <div className="text-surface-500">{item.pattern}</div>}
                          </td>
                          <td className="px-3 py-2.5 text-center whitespace-nowrap">
                            <span className="font-medium">{item.soldQuantity} sold</span>
                            <div className="text-[11px] text-primary-700 font-bold">
                              {item.returnableQuantity} returnable
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <input
                              type="number"
                              min={0}
                              max={item.returnableQuantity}
                              value={qty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 0;
                                setReturnQuantities((prev) => ({
                                  ...prev,
                                  [item.saleItemId]: Math.min(item.returnableQuantity, Math.max(0, val)),
                                }));
                              }}
                              disabled={item.returnableQuantity === 0}
                              className="w-16 px-2 py-1 text-center font-bold border border-surface-300 rounded focus:ring-1 focus:ring-primary-500 outline-none"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <select
                              value={returnConditions[item.saleItemId] || "SELLABLE"}
                              onChange={(e) =>
                                setReturnConditions((prev) => ({
                                  ...prev,
                                  [item.saleItemId]: e.target.value as "SELLABLE" | "DAMAGED",
                                }))
                              }
                              disabled={qty === 0}
                              className="px-2 py-1 text-xs border border-surface-300 rounded focus:ring-1 focus:ring-primary-500 outline-none"
                            >
                              <option value="SELLABLE">Sellable (Add to Stock)</option>
                              <option value="DAMAGED">Damaged / Non-Sellable</option>
                            </select>
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium text-surface-800">
                            ₹{Number(item.unitPrice).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Live Calculation Summary */}
              <div className="p-3 bg-surface-50 rounded border border-surface-200 flex justify-between items-center text-sm">
                <span className="font-bold text-surface-700">Total Return Value:</span>
                <span className="text-lg font-extrabold text-primary-800">
                  ₹{calculateTotalReturnValue().toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Refund Option */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-surface-700">
                  Refund State
                </label>
                <div className="flex gap-4 text-xs font-medium">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="refundOption"
                      value="PENDING"
                      checked={refundOption === "PENDING"}
                      onChange={() => setRefundOption("PENDING")}
                    />
                    <span>Pending Refund / Store Credit</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="refundOption"
                      value="REFUNDED"
                      checked={refundOption === "REFUNDED"}
                      onChange={() => setRefundOption("REFUNDED")}
                    />
                    <span>Cash Refund Paid Immediately</span>
                  </label>
                </div>
              </div>

              {/* Return Reason & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-1">
                    Return Reason
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Wrong size chosen by customer"
                    value={returnGeneralReason}
                    onChange={(e) => setReturnGeneralReason(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-1">
                    Additional Notes
                  </label>
                  <input
                    type="text"
                    placeholder="Optional notes..."
                    value={returnGeneralNotes}
                    onChange={(e) => setReturnGeneralNotes(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
              </div>

              {/* Inventory Restoration Warning */}
              <div className="p-3 bg-primary-50 text-primary-900 text-xs rounded-lg border border-primary-200 flex items-start gap-2">
                <span className="font-bold">Inventory Safety Notice:</span> Confirming this return will
                automatically increment warehouse stock for all items marked <strong>&quot;Sellable&quot;</strong> and create an
                immutable <strong>SALE_RETURN</strong> inventory ledger entry. Historical sale numbers and original payment
                receipts remain preserved.
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-surface-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsReturnModalOpen(false)}
                  disabled={returnSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={returnSubmitting || calculateTotalReturnValue() <= 0}
                  className="bg-primary-700 hover:bg-primary-800 font-bold cursor-pointer"
                >
                  {returnSubmitting ? "Processing Return..." : "Confirm & Restore Stock"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="border-b border-surface-200 pb-3">
              <h2 className="text-lg font-extrabold text-surface-900">Record Customer Payment</h2>
              <p className="text-xs text-surface-500 mt-0.5">
                Sale Number: <span className="font-bold text-surface-800">{sale.invoiceNumber}</span>
              </p>
            </div>

            {paymentError && (
              <div className="p-3 bg-danger-50 text-danger-700 text-xs font-semibold rounded border border-danger-200">
                {paymentError}
              </div>
            )}

            {/* Financial Balance Summary */}
            <div className="p-3 bg-surface-50 rounded text-xs space-y-1 text-surface-700">
              <div className="flex justify-between">
                <span>Sale Total:</span>
                <span className="font-bold text-surface-900">
                  ₹{totalAmountNum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Already Paid:</span>
                <span className="font-bold text-emerald-600">
                  ₹{totalPaidNum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between border-t border-surface-200 pt-1 text-sm font-bold">
                <span>Remaining Balance:</span>
                <span className="text-primary-800">
                  ₹{remainingBalanceNum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">
                  Payment Amount (₹) <span className="text-danger-600">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={remainingBalanceNum}
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-sm font-bold border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">
                  Payment Method <span className="text-danger-600">*</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="CARD">Debit / Credit Card</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">
                  Transaction / Reference # (Optional)
                </label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="e.g., UPI Ref / UTR / Cheque Number"
                  className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g., Paid via customer GPay"
                  className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPaymentModalOpen(false)}
                  disabled={paymentSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={paymentSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 font-bold cursor-pointer"
                >
                  {paymentSubmitting ? "Recording..." : "Confirm & Save Payment"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM SALE MODAL */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="border-b border-surface-200 pb-3">
              <h2 className="text-lg font-extrabold text-surface-900">Confirm & Finalize Sale</h2>
              <p className="text-xs text-surface-500 mt-0.5">
                Invoice Number: <span className="font-bold text-surface-800">{sale.invoiceNumber}</span>
              </p>
            </div>

            {confirmError && (
              <div className="p-3 bg-danger-50 text-danger-700 text-xs font-semibold rounded border border-danger-200">
                {confirmError}
              </div>
            )}

            <div className="text-xs text-surface-700 space-y-2">
              <p>
                Confirming this sale will transition it from <strong>DRAFT</strong> to{" "}
                <strong>COMPLETED</strong> and immediately deduct:
              </p>
              <div className="bg-surface-50 p-2.5 rounded border border-surface-200">
                <span className="font-bold text-surface-900 block mb-1">
                  Items to Deduct from Warehouse:
                </span>
                <ul className="list-disc list-inside space-y-0.5">
                  {sale.items.map((i) => (
                    <li key={i.id}>
                      <span className="font-semibold">{i.quantity}x</span> {i.product.brand}{" "}
                      {i.product.size}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-warning-800 font-medium">
                Note: Once finalized, stock cannot be restored without a formal return workflow.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-surface-200">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={confirmSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleConfirmSale}
                disabled={confirmSubmitting}
                className="bg-success-600 hover:bg-success-700 font-bold cursor-pointer"
              >
                {confirmSubmitting ? "Deducting Stock..." : "Confirm & Deduct Stock"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT DRAFT NOTES MODAL */}
      {isEditNotesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-surface-200 pb-2.5">
              <h2 className="text-base font-bold text-surface-900">Edit Sale Notes</h2>
              <button
                onClick={() => setIsEditNotesOpen(false)}
                className="text-surface-400 hover:text-surface-600 text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-2.5 bg-danger-50 text-danger-700 text-xs font-medium rounded border border-danger-200">
                {modalError}
              </div>
            )}

            <form onSubmit={handleUpdateNotes} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">
                  Sale Notes
                </label>
                <textarea
                  rows={3}
                  value={editNotesText}
                  onChange={(e) => setEditNotesText(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditNotesOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={formSubmitting}>
                  {formSubmitting ? "Saving..." : "Save Notes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* CREATE WARRANTY CLAIM MODAL */}
      {isWarrantyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-surface-200 pb-3 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-extrabold text-surface-900">Create Warranty Claim</h2>
                <p className="text-xs text-surface-500 mt-0.5">
                  Sale Number: <span className="font-bold text-surface-800">{sale.invoiceNumber}</span>
                </p>
              </div>
              <button
                onClick={() => setIsWarrantyModalOpen(false)}
                className="text-surface-400 hover:text-surface-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-primary-50 rounded border border-primary-200 text-xs text-primary-900 font-medium">
              ℹ️ <strong>Warranty Intake:</strong> This logs a customer warranty defect claim (WAR-XXXX). It does <strong>not</strong> rewrite historical sales, deduct stock immediately, or issue payments.
            </div>

            {warrantyError && (
              <div className="p-3 bg-danger-50 text-danger-700 text-xs font-semibold rounded border border-danger-200">
                {warrantyError}
              </div>
            )}

            <form onSubmit={handleCreateWarrantyClaim} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-surface-800 mb-1">
                  Select Tyre Sold under Warranty *
                </label>
                <select
                  value={warrantySaleItemId}
                  onChange={(e) => setWarrantySaleItemId(e.target.value)}
                  className="w-full px-3 py-2 border border-surface-300 rounded bg-white font-medium focus:ring-2 focus:ring-primary-500 outline-none"
                  required
                >
                  {warrantyEligibility.map((item) => (
                    <option key={item.saleItemId} value={item.saleItemId}>
                      {item.brand} {item.size} ({item.soldQuantity} sold @ ₹{Number(item.unitPrice).toLocaleString("en-IN")})
                      {item.hasActiveClaim ? ` — [ACTIVE CLAIM: ${item.activeClaimNumber}]` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-surface-800 mb-1">
                  Customer Reported Defect / Problem *
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Sidewall bulge, tread separation, air leakage near bead..."
                  value={warrantyIssue}
                  onChange={(e) => setWarrantyIssue(e.target.value)}
                  className="w-full px-3 py-2 border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-surface-800 mb-1">
                  Shop Initial Inspection Observations
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Visible bubble on outer sidewall, no puncture patch detected..."
                  value={warrantyInspection}
                  onChange={(e) => setWarrantyInspection(e.target.value)}
                  className="w-full px-3 py-2 border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-surface-800 mb-1">
                    DOT / Tyre Serial Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DOT 4B08 5225"
                    value={warrantyDotCode}
                    onChange={(e) => setWarrantyDotCode(e.target.value)}
                    className="w-full px-3 py-2 border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-surface-800 mb-1">
                    Brand Claim Ref # (if known)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. APOLLO-REF-109"
                    value={warrantyExternalRef}
                    onChange={(e) => setWarrantyExternalRef(e.target.value)}
                    className="w-full px-3 py-2 border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-surface-200">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={warrantySubmitting}
                  onClick={() => setIsWarrantyModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={warrantySubmitting}
                  className="font-bold"
                >
                  {warrantySubmitting ? "Creating Claim..." : "Create Warranty Claim"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
