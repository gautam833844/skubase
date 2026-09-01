"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { StatusBadge, type BadgeVariant } from "@/components/ui/StatusBadge";
import type { SaleReceiptView } from "@/lib/types/receipt";

export default function SaleReceiptPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolvedParams = "then" in params ? use(params) : params;
  const saleId = resolvedParams.id;

  const [receipt, setReceipt] = useState<SaleReceiptView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadReceipt() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/sales/${saleId}/receipt`);
        const json = await res.json();

        if (ignore) return;

        if (!res.ok || !json.success) {
          setError(json.error ?? "Failed to load receipt.");
        } else {
          setReceipt(json.data);
        }
      } catch {
        if (!ignore) {
          setError("Network error loading receipt.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadReceipt();

    return () => {
      ignore = true;
    };
  }, [saleId]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!receipt) return;
    setIsDownloadingPdf(true);
    try {
      const res = await fetch(`/api/sales/${saleId}/receipt/pdf`);
      if (!res.ok) {
        alert("Failed to download PDF. Please try again.");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Receipt-${receipt.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      alert("Error downloading PDF.");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const getPaymentStatusBadgeProps = (status: string): { variant: BadgeVariant; label: string } => {
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
      <div className="p-12 text-center text-surface-500 font-medium">
        Loading receipt details...
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="p-6 max-w-xl mx-auto space-y-4">
        <Link href={`/sales/${saleId}`} className="text-xs text-primary-600 font-semibold">
          ← Back to Sale
        </Link>
        <div className="p-4 bg-danger-50 text-danger-700 font-semibold rounded border border-danger-200">
          {error ?? "Receipt not found."}
        </div>
      </div>
    );
  }

  const paymentBadge = getPaymentStatusBadgeProps(receipt.paymentStatus);

  return (
    <div className="min-h-screen bg-surface-100 p-4 sm:p-6 print:p-0 print:bg-white print:min-h-0">
      <style>{`
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
          }
          aside,
          header,
          .no-print {
            display: none !important;
          }
          .print-container {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .page-break {
            page-break-inside: avoid;
          }
        }
      `}</style>

      {/* Action Header (Hidden during printing) */}
      <div className="max-w-3xl mx-auto mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <Link
            href={`/sales/${saleId}`}
            className="text-xs text-primary-600 hover:text-primary-800 font-semibold"
          >
            ← Back to Sale Record ({receipt.invoiceNumber})
          </Link>
          <h1 className="text-xl font-extrabold text-surface-900 mt-1">
            Sales Bill & Receipt Preview
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="cursor-pointer font-bold"
          >
            🖨️ Print Receipt
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="bg-primary-700 hover:bg-primary-800 font-bold cursor-pointer"
          >
            {isDownloadingPdf ? "Generating PDF..." : "📥 Download PDF"}
          </Button>
        </div>
      </div>

      {/* Draft Warning Banner */}
      {receipt.isDraft && (
        <div className="max-w-3xl mx-auto mb-4 p-3.5 bg-warning-50 text-warning-900 border border-warning-200 rounded-lg text-xs font-semibold no-print">
          ⚠️ <span className="font-bold">Draft Sale Notice:</span> This is a draft estimate and not a finalized bill. Physical inventory has not yet been deducted.
        </div>
      )}

      {/* Printable Receipt Paper Container */}
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md border border-surface-200 p-6 sm:p-8 text-surface-900 print-container print:shadow-none print:border-none print:p-4">
        {/* 1. Shop Header */}
        <div className="text-center border-b border-surface-200 pb-5">
          <h2 className="text-2xl font-black tracking-tight text-surface-900 uppercase">
            {receipt.shop.name}
          </h2>
          {receipt.shop.tagline && (
            <p className="text-xs font-semibold text-surface-600 mt-0.5">{receipt.shop.tagline}</p>
          )}
          {receipt.shop.address && (
            <p className="text-xs text-surface-500 mt-1">{receipt.shop.address}</p>
          )}
          <p className="text-xs text-surface-500 mt-0.5">
            {receipt.shop.phoneNumber && (
              <>
                Phone: <span className="font-semibold text-surface-700">{receipt.shop.phoneNumber}</span>
              </>
            )}
            {receipt.shop.email && (
              <>
                {receipt.shop.phoneNumber ? " | " : ""}Email:{" "}
                <span className="font-semibold text-surface-700">{receipt.shop.email}</span>
              </>
            )}
            {receipt.shop.gstin && (
              <>
                {" | "}GSTIN: <span className="font-semibold text-surface-700">{receipt.shop.gstin}</span>
              </>
            )}
          </p>

          <div className="mt-4 pt-3 border-t border-dashed border-surface-300">
            <h3
              className={`text-sm font-extrabold uppercase tracking-wider ${
                receipt.isDraft ? "text-warning-700" : "text-surface-900"
              }`}
            >
              {receipt.documentTitle}
            </h3>
          </div>
        </div>

        {/* 2. Metadata & Customer Block */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-b border-surface-200 text-xs">
          {/* Sale Meta */}
          <div className="space-y-1.5">
            <div className="flex">
              <span className="w-28 text-surface-500 font-semibold">Receipt Number:</span>
              <span className="font-bold text-surface-900">{receipt.invoiceNumber}</span>
            </div>
            <div className="flex">
              <span className="w-28 text-surface-500 font-semibold">Date & Time:</span>
              <span className="font-medium text-surface-800">
                {new Date(receipt.saleDate).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            </div>
            <div className="flex">
              <span className="w-28 text-surface-500 font-semibold">Billed By:</span>
              <span className="font-medium text-surface-800">
                {receipt.seller?.fullName ?? receipt.seller?.username ?? "Sales Desk"}
              </span>
            </div>
            <div className="flex items-center">
              <span className="w-28 text-surface-500 font-semibold">Payment Status:</span>
              <StatusBadge variant={paymentBadge.variant} label={paymentBadge.label} />
            </div>
          </div>

          {/* Customer Meta */}
          <div className="space-y-1.5 sm:border-l sm:border-surface-200 sm:pl-4">
            <span className="font-bold text-surface-900 uppercase tracking-wider block mb-1">
              Customer Information
            </span>
            {receipt.customer ? (
              <>
                <div className="flex">
                  <span className="w-20 text-surface-500 font-semibold">Name:</span>
                  <span className="font-bold text-surface-900">{receipt.customer.name}</span>
                </div>
                {receipt.customer.phoneNumber && (
                  <div className="flex">
                    <span className="w-20 text-surface-500 font-semibold">Phone:</span>
                    <span className="font-medium text-surface-800">{receipt.customer.phoneNumber}</span>
                  </div>
                )}
                {receipt.customer.vehicleNumber && (
                  <div className="flex">
                    <span className="w-20 text-surface-500 font-semibold">Vehicle:</span>
                    <span className="font-mono font-bold text-surface-900">
                      {receipt.customer.vehicleNumber}
                      {receipt.customer.vehicleModel && (
                        <span className="font-sans font-normal text-surface-600 ml-1">
                          ({receipt.customer.vehicleModel})
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <p className="text-surface-600 italic">Walk-in Customer</p>
            )}
          </div>
        </div>

        {/* 3. Items Table */}
        <div className="py-4">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-surface-300 font-extrabold text-surface-700 uppercase">
                <th className="py-2 pr-2 text-center w-8">#</th>
                <th className="py-2 px-2">Tyre Item Description</th>
                <th className="py-2 px-2 text-center w-12">Qty</th>
                <th className="py-2 px-2 text-right w-24">Price (₹)</th>
                <th className="py-2 px-2 text-right w-24">Discount (₹)</th>
                <th className="py-2 pl-2 text-right w-28">Total (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200">
              {receipt.items.map((item, index) => (
                <tr key={item.id} className="page-break">
                  <td className="py-2.5 pr-2 text-center text-surface-500">{index + 1}</td>
                  <td className="py-2.5 px-2">
                    <span className="font-bold text-surface-900">
                      {item.brand} {item.size}
                    </span>
                    {item.pattern && (
                      <span className="text-surface-500 ml-1.5 font-normal">({item.pattern})</span>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-center font-bold text-surface-900">
                    {item.quantity}
                  </td>
                  <td className="py-2.5 px-2 text-right font-medium text-surface-800">
                    ₹{Number(item.unitPrice).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-2 text-right text-surface-600">
                    {Number(item.discountAmount) > 0
                      ? `-₹${Number(item.discountAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                      : "—"}
                  </td>
                  <td className="py-2.5 pl-2 text-right font-bold text-surface-900">
                    ₹{Number(item.totalPrice).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 4. Financial Totals Summary */}
        <div className="border-t border-surface-300 pt-4 flex justify-end page-break">
          <div className="w-72 space-y-1.5 text-xs">
            <div className="flex justify-between text-surface-700">
              <span>Subtotal:</span>
              <span className="font-semibold text-surface-900">
                ₹{Number(receipt.subtotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            {Number(receipt.discountAmount) > 0 && (
              <div className="flex justify-between text-danger-700">
                <span>Total Discount:</span>
                <span className="font-semibold">
                  -₹{Number(receipt.discountAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm font-extrabold text-surface-900 pt-2 border-t border-surface-200">
              <span>Grand Total:</span>
              <span className="text-primary-800">
                ₹{Number(receipt.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-xs font-semibold text-emerald-700 pt-1">
              <span>Amount Paid:</span>
              <span>
                ₹{Number(receipt.totalPaid).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-xs font-bold text-surface-900 pt-1 border-t border-dashed border-surface-200">
              <span>Balance Due:</span>
              <span
                className={
                  Number(receipt.remainingBalance) > 0 ? "text-warning-700" : "text-success-700"
                }
              >
                ₹{Number(receipt.remainingBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* 5. Payment Details Section */}
        {receipt.payments.length > 0 && (
          <div className="border-t border-surface-200 mt-6 pt-4 page-break">
            <h4 className="text-xs font-bold text-surface-800 uppercase tracking-wider mb-2">
              Payment Record Summary
            </h4>
            <div className="space-y-1 text-xs text-surface-600">
              {receipt.payments.map((p) => (
                <div key={p.id} className="flex justify-between py-0.5">
                  <span>
                    •{" "}
                    {new Date(p.paymentDate).toLocaleDateString("en-IN", {
                      dateStyle: "medium",
                    })}{" "}
                    — <span className="font-semibold text-surface-800">{p.paymentMethod}</span>
                    {p.referenceNumber && (
                      <span className="font-mono text-surface-500 ml-1">
                        (Ref: {p.referenceNumber})
                      </span>
                    )}
                  </span>
                  <span className="font-semibold text-surface-900">
                    ₹{Number(p.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. Notes Section */}
        {receipt.notes && (
          <div className="border-t border-surface-200 mt-4 pt-3 text-xs text-surface-600 page-break">
            <span className="font-bold text-surface-800 uppercase block mb-0.5">Notes:</span>
            <p>{receipt.notes}</p>
          </div>
        )}

        {/* 7. Footer Notice */}
        <div className="border-t border-surface-200 mt-6 pt-4 text-center text-[11px] text-surface-500 italic page-break">
          {receipt.shop.billFooter || "Thank you for your business!"}
        </div>
      </div>
    </div>
  );
}
