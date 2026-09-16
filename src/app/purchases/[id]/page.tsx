"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge, type BadgeVariant } from "@/components/ui/StatusBadge";
import { NavIcon } from "@/components/ui/NavIcon";
import type { PurchaseOrderStatus } from "@prisma/client";

interface PODetailView {
  id: string;
  poNumber: string;
  orderDate: string;
  status: PurchaseOrderStatus;
  expectedDate: string | null;
  notes: string | null;
  supplier: {
    id: string;
    name: string;
    contactPerson: string | null;
    phoneNumber: string | null;
    whatsappNumber: string | null;
    address: string | null;
  };
  createdBy: {
    id: string;
    fullName: string;
    username: string | null;
  } | null;
  items: Array<{
    id: string;
    productId: string;
    quantityOrdered: number;
    quantityReceived: number;
    remainingQuantity: number;
    unitCost: string | number | null;
    product: {
      id: string;
      brand: string;
      size: string;
      pattern: string;
      quantityOnHand: number;
      averageCostPrice: string | number;
    };
  }>;
  receipts: Array<{
    id: string;
    receiptNumber: string;
    receivedDate: string;
    supplierInvoiceNo: string | null;
    notes: string | null;
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
  }>;
  summary: {
    totalOrdered: number;
    totalReceived: number;
    remaining: number;
  };
}

interface ReceiveItemInputState {
  purchaseOrderItemId: string;
  productId: string;
  brand: string;
  size: string;
  pattern: string;
  remaining: number;
  quantityToReceive: string;
  unitCost: string;
}

export default function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const poId = resolvedParams.id;

  const [order, setOrder] = useState<PODetailView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Receiving Modal
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [receiveInvoiceNo, setReceiveInvoiceNo] = useState("");
  const [receiveNotes, setReceiveNotes] = useState("");
  const [receiveItemsState, setReceiveItemsState] = useState<ReceiveItemInputState[]>([]);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const refreshOrder = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadOrder() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/purchases/${poId}`);
        const json = await res.json();

        if (ignore) return;

        if (!res.ok || !json.success) {
          setError(json.error ?? "Failed to load purchase order.");
        } else {
          setOrder(json.data);
        }
      } catch {
        if (!ignore) {
          setError("Network error while loading purchase order.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadOrder();

    return () => {
      ignore = true;
    };
  }, [poId, refreshKey]);

  const openReceiveModal = () => {
    if (!order) return;
    setModalError(null);
    setReceiveInvoiceNo("");
    setReceiveNotes("");

    // Prepare receiving lines for items that have remaining quantity > 0
    const itemsToReceive = order.items
      .filter((i) => i.remainingQuantity > 0)
      .map((i) => ({
        purchaseOrderItemId: i.id,
        productId: i.productId,
        brand: i.product.brand,
        size: i.product.size,
        pattern: i.product.pattern,
        remaining: i.remainingQuantity,
        quantityToReceive: String(i.remainingQuantity),
        unitCost: i.unitCost ? String(i.unitCost) : String(i.product.averageCostPrice),
      }));

    setReceiveItemsState(itemsToReceive);
    setIsReceiveModalOpen(true);
  };

  const handleReceiveItemChange = (
    index: number,
    field: "quantityToReceive" | "unitCost",
    value: string
  ) => {
    setReceiveItemsState((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  async function handleConfirmReceive(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;
    setModalError(null);
    setFormSubmitting(true);

    try {
      // Validate quantities on client before sending
      const itemsPayload = [];
      for (const item of receiveItemsState) {
        const qty = parseInt(item.quantityToReceive, 10);
        if (isNaN(qty) || qty < 0) {
          setModalError(`Invalid quantity for ${item.brand} ${item.size}.`);
          setFormSubmitting(false);
          return;
        }

        if (qty > item.remaining) {
          setModalError(
            `Cannot receive ${qty} tyres for ${item.brand} ${item.size}. Only ${item.remaining} remaining on order.`
          );
          setFormSubmitting(false);
          return;
        }

        if (qty > 0) {
          itemsPayload.push({
            purchaseOrderItemId: item.purchaseOrderItemId,
            productId: item.productId,
            quantityReceived: qty,
            unitCost: item.unitCost ? parseFloat(item.unitCost) : undefined,
          });
        }
      }

      if (itemsPayload.length === 0) {
        setModalError("Please enter at least 1 tyre to receive.");
        setFormSubmitting(false);
        return;
      }

      const res = await fetch(`/api/purchases/${order.id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierInvoiceNo: receiveInvoiceNo || undefined,
          notes: receiveNotes || undefined,
          items: itemsPayload,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setModalError(json.error ?? "Failed to process receipt.");
        setFormSubmitting(false);
        return;
      }

      setIsReceiveModalOpen(false);
      refreshOrder();
    } catch {
      setModalError("Network error while receiving goods.");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleCancelOrder() {
    if (!order) return;
    if (!window.confirm(`Are you sure you want to cancel Purchase Order ${order.poNumber}?`)) return;

    try {
      const res = await fetch(`/api/purchases/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        refreshOrder();
      } else {
        alert(json.error ?? "Failed to cancel order.");
      }
    } catch {
      alert("Network error cancelling purchase order.");
    }
  }

  const getStatusBadgeProps = (status: PurchaseOrderStatus): { variant: BadgeVariant; label: string } => {
    switch (status) {
      case "ORDERED":
        return { variant: "info", label: "Ordered (Pending)" };
      case "PARTIALLY_RECEIVED":
        return { variant: "warning", label: "Partially Received" };
      case "COMPLETED":
        return { variant: "success", label: "Completed" };
      case "CANCELLED":
        return { variant: "danger", label: "Cancelled" };
      case "DRAFT":
      default:
        return { variant: "neutral", label: "Draft" };
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-surface-500 font-medium">
        Loading purchase order details...
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <Link href="/purchases" className="text-xs text-primary-600 font-semibold">
          ← Back to Purchase Orders
        </Link>
        <div className="p-4 bg-danger-50 text-danger-700 font-medium rounded border border-danger-200">
          {error ?? "Purchase order not found."}
        </div>
      </div>
    );
  }

  const badge = getStatusBadgeProps(order.status);
  const canReceive = order.status === "ORDERED" || order.status === "PARTIALLY_RECEIVED";
  const canCancel = (order.status === "ORDERED" || order.status === "DRAFT") && order.summary.totalReceived === 0;

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
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-2xl font-extrabold text-surface-900 tracking-tight">
              {order.poNumber}
            </h1>
            <StatusBadge variant={badge.variant} label={badge.label} />
          </div>
          <p className="text-xs text-surface-500 mt-0.5">
            Placed with <span className="font-bold text-surface-800">{order.supplier.name}</span> on{" "}
            {new Date(order.orderDate).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canCancel && (
            <Button variant="outline" size="sm" onClick={handleCancelOrder} className="cursor-pointer text-danger-600">
              Cancel Order
            </Button>
          )}
          {canReceive && (
            <Button variant="primary" size="sm" onClick={openReceiveModal} className="cursor-pointer inline-flex items-center gap-1.5">
              <NavIcon name="box" className="w-3.5 h-3.5" />
              Receive Goods
            </Button>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-primary-500">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Ordered Qty</div>
          <div className="mt-1 text-2xl font-extrabold text-surface-900">{order.summary.totalOrdered}</div>
          <div className="mt-0.5 text-xs text-surface-500">Total tyres requested</div>
        </Card>

        <Card className="p-4 border-l-4 border-l-success-500">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Received Qty</div>
          <div className="mt-1 text-2xl font-extrabold text-success-600">{order.summary.totalReceived}</div>
          <div className="mt-0.5 text-xs text-surface-500">Tyres already received into stock</div>
        </Card>

        <Card className="p-4 border-l-4 border-l-warning-500">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Remaining Qty</div>
          <div className="mt-1 text-2xl font-extrabold text-warning-600">{order.summary.remaining}</div>
          <div className="mt-0.5 text-xs text-surface-500">Pending delivery</div>
        </Card>

        <Card className="p-4 border-l-4 border-l-surface-400">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Supplier Contact</div>
          <div className="mt-1 text-sm font-bold text-surface-900 truncate">
            {order.supplier.contactPerson || order.supplier.name}
          </div>
          <div className="mt-0.5 text-xs text-surface-500">{order.supplier.phoneNumber || "No phone recorded"}</div>
        </Card>
      </div>

      {/* Ordered Line Items Progress */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3.5 bg-surface-50 border-b border-surface-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-surface-800 uppercase tracking-wider">
            Ordered Line Items & Fulfillment Progress
          </h2>
          <span className="text-xs text-surface-500 font-medium">{order.items.length} item(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-surface-200 text-sm">
            <thead className="bg-surface-50 text-surface-600 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-4 py-3 text-left">
                  Tyre Product
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Agreed Unit Cost
                </th>
                <th scope="col" className="px-4 py-3 text-center">
                  Ordered
                </th>
                <th scope="col" className="px-4 py-3 text-center">
                  Received
                </th>
                <th scope="col" className="px-4 py-3 text-center">
                  Remaining
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Line Total (Est)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 bg-white">
              {order.items.map((item) => {
                const cost = Number(item.unitCost) || 0;
                const lineTotal = cost * item.quantityOrdered;

                return (
                  <tr key={item.id} className="hover:bg-surface-50/60 transition-colors">
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-bold text-surface-900">
                        {item.product.brand} {item.product.size}
                      </div>
                      {item.product.pattern && (
                        <div className="text-xs text-surface-500">{item.product.pattern}</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-right font-medium text-surface-800">
                      ₹{cost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-center font-bold text-surface-900">
                      {item.quantityOrdered}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-center font-semibold text-success-700">
                      {item.quantityReceived}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-center font-bold">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          item.remainingQuantity > 0 ? "bg-warning-50 text-warning-800" : "text-surface-400"
                        }`}
                      >
                        {item.remainingQuantity}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-right font-semibold text-surface-900">
                      ₹{lineTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Receipts History Timeline */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3.5 bg-surface-50 border-b border-surface-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-surface-800 uppercase tracking-wider">
            Purchase Receipts & Inventory Inward Ledger
          </h2>
          <span className="text-xs text-surface-500 font-medium">{order.receipts.length} receipt(s)</span>
        </div>

        {order.receipts.length === 0 ? (
          <div className="p-8 text-center text-surface-500">
            <div className="text-sm font-semibold text-surface-700">No goods received yet</div>
            <div className="text-xs text-surface-400 mt-1">
              When supplier deliveries arrive, click &quot;Receive Goods&quot; above to log items into stock.
            </div>
          </div>
        ) : (
          <div className="divide-y divide-surface-200">
            {order.receipts.map((rcpt) => (
              <div key={rcpt.id} className="p-4 bg-white hover:bg-surface-50/50 transition-colors space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs gap-2">
                  <div>
                    <span className="font-extrabold text-primary-700 text-sm">{rcpt.receiptNumber}</span>
                    <span className="text-surface-500 ml-2">
                      Received on{" "}
                      {new Date(rcpt.receivedDate).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                  <div className="text-surface-600 font-medium">
                    {rcpt.supplierInvoiceNo && (
                      <span className="bg-surface-100 px-2 py-0.5 rounded mr-2">
                        Invoice: {rcpt.supplierInvoiceNo}
                      </span>
                    )}
                    <span>Logged by {rcpt.createdBy?.fullName ?? rcpt.createdBy?.username ?? "Staff"}</span>
                  </div>
                </div>

                {/* Items in this receipt */}
                <div className="bg-surface-50 p-2.5 rounded border border-surface-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {rcpt.items.map((rItem) => (
                      <div key={rItem.id} className="flex items-center justify-between">
                        <span className="font-medium text-surface-800">
                          {rItem.product.brand} {rItem.product.size} {rItem.product.pattern}
                        </span>
                        <span className="font-bold text-success-800">
                          +{rItem.quantityReceived} tyres @ ₹{Number(rItem.unitCost).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* RECEIVE GOODS MODAL */}
      {isReceiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-200 pb-3">
              <div>
                <h2 className="text-lg font-bold text-surface-900">Receive Goods into Inventory</h2>
                <p className="text-xs text-surface-500">Purchase Order {order.poNumber}</p>
              </div>
              <button
                onClick={() => setIsReceiveModalOpen(false)}
                className="text-surface-400 hover:text-surface-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-danger-50 text-danger-700 text-xs font-medium rounded border border-danger-200">
                {modalError}
              </div>
            )}

            <form onSubmit={handleConfirmReceive} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-1">
                    Supplier Invoice # (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-9842"
                    value={receiveInvoiceNo}
                    onChange={(e) => setReceiveInvoiceNo(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-1">
                    Receipt Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Batch 1 delivery..."
                    value={receiveNotes}
                    onChange={(e) => setReceiveNotes(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-surface-800 uppercase tracking-wider">
                  Tyres Arrived in Shipment
                </label>

                {receiveItemsState.map((item, idx) => (
                  <div
                    key={item.purchaseOrderItemId}
                    className="p-3 bg-surface-50 rounded border border-surface-200 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-surface-900">
                        {item.brand} {item.size} {item.pattern}
                      </span>
                      <span className="text-surface-600 bg-surface-200 px-2 py-0.5 rounded font-medium">
                        Remaining: {item.remaining} tyres
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-surface-600 font-medium mb-0.5">
                          Quantity Received <span className="text-danger-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={item.remaining}
                          required
                          value={item.quantityToReceive}
                          onChange={(e) =>
                            handleReceiveItemChange(idx, "quantityToReceive", e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 text-xs border border-surface-300 rounded outline-none font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-surface-600 font-medium mb-0.5">
                          Actual Purchase Unit Cost (₹)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={item.unitCost}
                          onChange={(e) =>
                            handleReceiveItemChange(idx, "unitCost", e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 text-xs border border-surface-300 rounded outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-primary-50/60 rounded border border-primary-200 text-xs text-primary-900">
                <span className="font-bold">Inventory Impact:</span> Confirming this receipt will
                immediately increase physical stock on hand and recalculate moving weighted-average costs.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsReceiveModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={formSubmitting}>
                  {formSubmitting ? "Processing..." : "Confirm & Inward Tyres"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
