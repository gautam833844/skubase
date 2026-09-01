"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface PurchaseReceiptRecord {
  id: string;
  receiptNumber: string;
  receivedDate: string;
  supplierInvoiceNo: string | null;
  notes: string | null;
  supplier: {
    id: string;
    name: string;
  };
  purchaseOrder: {
    id: string;
    poNumber: string;
  } | null;
  createdBy: {
    id: string;
    fullName: string;
    username: string | null;
  } | null;
  items: Array<{
    id: string;
    quantityReceived: number;
    unitCost: string | number;
    product: {
      id: string;
      brand: string;
      size: string;
      pattern: string;
    };
  }>;
}

export default function PurchaseReceiptsPage() {
  const [receipts, setReceipts] = useState<PurchaseReceiptRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshReceipts = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadReceipts() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/purchases/receipts");
        const json = await res.json();

        if (ignore) return;

        if (!res.ok || !json.success) {
          setError(json.error ?? "Failed to load purchase receipts.");
        } else {
          setReceipts(json.data ?? []);
        }
      } catch {
        if (!ignore) {
          setError("Network error while loading receipts.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadReceipts();

    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/purchases"
            className="text-xs text-primary-600 hover:text-primary-800 font-semibold"
          >
            ← Back to Purchase Orders
          </Link>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight mt-1">
            Purchase Receipts Ledger
          </h1>
          <p className="text-sm text-surface-500 mt-1">
            Immutable audit record of all inward tyre deliveries received from suppliers.
          </p>
        </div>
        <div>
          <Button variant="outline" size="sm" onClick={refreshReceipts} disabled={isLoading}>
            Refresh Ledger
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          className="p-4 rounded-md bg-danger-50 border border-danger-300 text-danger-700 text-sm font-medium"
        >
          {error}
        </div>
      )}

      {/* Receipts Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-surface-200 text-sm">
            <thead className="bg-surface-50 text-surface-600 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-4 py-3 text-left">
                  Receipt #
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Date
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Purchase Order
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Supplier
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Supplier Invoice
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Tyres Inwarded
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Received By
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-surface-500">
                    Loading receipts ledger...
                  </td>
                </tr>
              ) : receipts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-surface-500">
                    <div className="text-base font-semibold text-surface-700">No receipts recorded yet</div>
                    <div className="text-xs text-surface-400 mt-1">
                      When goods are received against purchase orders, individual inward records will appear here.
                    </div>
                  </td>
                </tr>
              ) : (
                receipts.map((r) => {
                  const dateStr = new Date(r.receivedDate).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  });

                  return (
                    <tr key={r.id} className="hover:bg-surface-50/60 transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap font-bold text-primary-700">
                        {r.receiptNumber}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-surface-600 font-medium">
                        {dateStr}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {r.purchaseOrder ? (
                          <Link
                            href={`/purchases/${r.purchaseOrder.id}`}
                            className="font-semibold text-primary-600 hover:text-primary-800 underline decoration-primary-300"
                          >
                            {r.purchaseOrder.poNumber}
                          </Link>
                        ) : (
                          <span className="text-surface-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap font-medium text-surface-900">
                        {r.supplier.name}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-surface-600 font-mono">
                        {r.supplierInvoiceNo || "—"}
                      </td>
                      <td className="px-4 py-3.5 text-xs">
                        <div className="space-y-1">
                          {r.items.map((item) => (
                            <div key={item.id} className="flex items-center gap-2">
                              <span className="font-bold text-success-800">
                                +{item.quantityReceived}
                              </span>
                              <span className="text-surface-800">
                                {item.product.brand} {item.product.size} {item.product.pattern}
                              </span>
                              <span className="text-surface-500 font-medium">
                                @ ₹{Number(item.unitCost).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-right text-xs font-medium text-surface-600">
                        {r.createdBy?.fullName ?? r.createdBy?.username ?? "Staff"}
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
