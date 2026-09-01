"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge, type BadgeVariant } from "@/components/ui/StatusBadge";
import type { PurchaseOrderStatus } from "@prisma/client";

interface PurchaseOrderItemView {
  id: string;
  poNumber: string;
  orderDate: string;
  status: PurchaseOrderStatus;
  notes: string | null;
  supplier: {
    id: string;
    name: string;
    phoneNumber: string | null;
  };
  summary: {
    totalOrdered: number;
    totalReceived: number;
    remaining: number;
  };
  items: Array<{
    id: string;
    productId: string;
    quantityOrdered: number;
    quantityReceived: number;
    unitCost: string | number | null;
    product: {
      id: string;
      brand: string;
      size: string;
      pattern: string;
    };
  }>;
}

interface SupplierOption {
  id: string;
  name: string;
}

interface ProductOption {
  id: string;
  brand: string;
  size: string;
  pattern: string;
  averageCostPrice: string | number;
}

interface NewPOItemRow {
  productId: string;
  quantityOrdered: string;
  unitCost: string;
}

export default function PurchasesPage() {
  const [orders, setOrders] = useState<PurchaseOrderItemView[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [refreshKey, setRefreshKey] = useState(0);

  // Create PO Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [suppliersList, setSuppliersList] = useState<SupplierOption[]>([]);
  const [productsList, setProductsList] = useState<ProductOption[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [poNotes, setPoNotes] = useState("");
  const [poItems, setPoItems] = useState<NewPOItemRow[]>([
    { productId: "", quantityOrdered: "4", unitCost: "" },
  ]);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const refreshOrders = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadOrders() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (searchTerm) params.set("search", searchTerm);
        if (statusFilter !== "ALL") params.set("status", statusFilter);

        const res = await fetch(`/api/purchases?${params.toString()}`);
        const json = await res.json();

        if (ignore) return;

        if (!res.ok || !json.success) {
          setError(json.error ?? "Failed to load purchase orders.");
        } else {
          setOrders(json.data ?? []);
          if (json.statusCounts) {
            setStatusCounts(json.statusCounts);
          }
        }
      } catch {
        if (!ignore) {
          setError("Network error while loading purchase orders.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadOrders();

    return () => {
      ignore = true;
    };
  }, [searchTerm, statusFilter, refreshKey]);

  // Load active suppliers & products when opening Create PO Modal
  const openCreateModal = async () => {
    setModalError(null);
    setIsCreateModalOpen(true);

    try {
      const [supRes, prodRes] = await Promise.all([
        fetch("/api/suppliers?status=ACTIVE"),
        fetch("/api/inventory/products?status=ACTIVE"),
      ]);

      const [supJson, prodJson] = await Promise.all([supRes.json(), prodRes.json()]);

      if (supJson.success && supJson.data) {
        setSuppliersList(supJson.data);
        if (supJson.data.length > 0 && !selectedSupplierId) {
          setSelectedSupplierId(supJson.data[0].id);
        }
      }

      if (prodJson.success && prodJson.data) {
        setProductsList(prodJson.data);
        if (prodJson.data.length > 0 && poItems[0].productId === "") {
          setPoItems([{ productId: prodJson.data[0].id, quantityOrdered: "4", unitCost: "" }]);
        }
      }
    } catch {
      setModalError("Failed to fetch suppliers or tyre products list.");
    }
  };

  const handleAddItemRow = () => {
    const defaultProdId = productsList.length > 0 ? productsList[0].id : "";
    setPoItems((prev) => [...prev, { productId: defaultProdId, quantityOrdered: "4", unitCost: "" }]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (poItems.length === 1) return;
    setPoItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof NewPOItemRow, value: string) => {
    setPoItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  async function handleCreatePO(e: React.FormEvent) {
    e.preventDefault();
    setModalError(null);
    setFormSubmitting(true);

    try {
      if (!selectedSupplierId) {
        setModalError("Please select a supplier.");
        setFormSubmitting(false);
        return;
      }

      const formattedItems = poItems.map((item) => ({
        productId: item.productId,
        quantityOrdered: parseInt(item.quantityOrdered, 10),
        unitCost: item.unitCost ? parseFloat(item.unitCost) : undefined,
      }));

      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: selectedSupplierId,
          expectedDate: expectedDate || undefined,
          notes: poNotes || undefined,
          items: formattedItems,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setModalError(json.error ?? "Failed to create purchase order.");
        setFormSubmitting(false);
        return;
      }

      setIsCreateModalOpen(false);
      setPoNotes("");
      setExpectedDate("");
      setPoItems([{ productId: "", quantityOrdered: "4", unitCost: "" }]);
      refreshOrders();
    } catch {
      setModalError("Network error creating purchase order.");
    } finally {
      setFormSubmitting(false);
    }
  }

  const estimatedTotalValue = useMemo(() => {
    return poItems.reduce((sum, item) => {
      const qty = parseInt(item.quantityOrdered, 10) || 0;
      const cost = parseFloat(item.unitCost) || 0;
      return sum + qty * cost;
    }, 0);
  }, [poItems]);

  const getStatusBadgeProps = (status: PurchaseOrderStatus): { variant: BadgeVariant; label: string } => {
    switch (status) {
      case "ORDERED":
        return { variant: "info", label: "Ordered" };
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Purchase Orders</h1>
          <p className="text-sm text-surface-500 mt-1">
            Create supplier orders, track partial delivery progress, and receive stock into inventory.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/purchases/receipts">
            <Button variant="outline" size="sm" className="cursor-pointer">
              Receipts Ledger
            </Button>
          </Link>
          <Button
            variant="primary"
            size="sm"
            onClick={openCreateModal}
            className="cursor-pointer"
          >
            + Create Purchase Order
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-primary-500">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Total Orders</div>
          <div className="mt-1 text-2xl font-extrabold text-surface-900">{orders.length}</div>
          <div className="mt-0.5 text-xs text-surface-500">All purchase records</div>
        </Card>

        <Card className="p-4 border-l-4 border-l-info-500">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Pending Orders</div>
          <div className="mt-1 text-2xl font-extrabold text-info-600">
            {(statusCounts["ORDERED"] ?? 0) + (statusCounts["DRAFT"] ?? 0)}
          </div>
          <div className="mt-0.5 text-xs text-surface-500">Awaiting supplier delivery</div>
        </Card>

        <Card className="p-4 border-l-4 border-l-warning-500">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Partially Received</div>
          <div className="mt-1 text-2xl font-extrabold text-warning-600">
            {statusCounts["PARTIALLY_RECEIVED"] ?? 0}
          </div>
          <div className="mt-0.5 text-xs text-surface-500">Partial shipments arrived</div>
        </Card>

        <Card className="p-4 border-l-4 border-l-success-500">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Fully Received</div>
          <div className="mt-1 text-2xl font-extrabold text-success-600">
            {statusCounts["COMPLETED"] ?? 0}
          </div>
          <div className="mt-0.5 text-xs text-surface-500">Fulfilled orders</div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label htmlFor="search-po" className="block text-xs font-medium text-surface-600 mb-1">
              Search Orders
            </label>
            <input
              id="search-po"
              type="text"
              placeholder="Search by PO Number (PO-1001) or Supplier name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-surface-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label htmlFor="status-filter" className="block text-xs font-medium text-surface-600 mb-1">
              Order Status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-surface-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ORDERED">Ordered (Pending)</option>
              <option value="PARTIALLY_RECEIVED">Partially Received</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
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

      {/* Orders Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-surface-200 text-sm">
            <thead className="bg-surface-50 text-surface-600 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-4 py-3 text-left">
                  PO Number
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Supplier
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Order Date
                </th>
                <th scope="col" className="px-4 py-3 text-center">
                  Ordered Qty
                </th>
                <th scope="col" className="px-4 py-3 text-center">
                  Received Qty
                </th>
                <th scope="col" className="px-4 py-3 text-center">
                  Remaining
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
                  <td colSpan={8} className="px-4 py-8 text-center text-surface-500">
                    Loading purchase orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-surface-500">
                    <div className="text-base font-semibold text-surface-700">No purchase orders found</div>
                    <div className="text-xs text-surface-400 mt-1">
                      {searchTerm || statusFilter !== "ALL"
                        ? "Try clearing your search or status filters."
                        : "Click '+ Create Purchase Order' above to place your first tyre order with a supplier."}
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((po) => {
                  const badge = getStatusBadgeProps(po.status);
                  const orderDateStr = new Date(po.orderDate).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });

                  return (
                    <tr key={po.id} className="hover:bg-surface-50/60 transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <Link
                          href={`/purchases/${po.id}`}
                          className="font-bold text-primary-600 hover:text-primary-800 underline decoration-primary-300"
                        >
                          {po.poNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap font-medium text-surface-900">
                        {po.supplier.name}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-surface-600 text-xs">
                        {orderDateStr}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-center font-bold text-surface-800">
                        {po.summary.totalOrdered}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-center font-semibold text-success-700">
                        {po.summary.totalReceived}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-center font-bold">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            po.summary.remaining > 0 ? "text-warning-800 bg-warning-50" : "text-surface-400"
                          }`}
                        >
                          {po.summary.remaining}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        <StatusBadge variant={badge.variant} label={badge.label} />
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-right space-x-2">
                        <Link
                          href={`/purchases/${po.id}`}
                          className="text-xs font-semibold text-primary-600 hover:text-primary-800 px-2 py-1 rounded hover:bg-primary-50 transition-colors"
                        >
                          {po.status === "COMPLETED" ? "View Details" : "Receive / View"}
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

      {/* CREATE PURCHASE ORDER MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-200 pb-3">
              <div>
                <h2 className="text-lg font-bold text-surface-900">Create Purchase Order</h2>
                <p className="text-xs text-surface-500">Order tyres from an active distributor</p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
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

            <form onSubmit={handleCreatePO} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-1">
                    Select Supplier <span className="text-danger-500">*</span>
                  </label>
                  <select
                    required
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                  >
                    <option value="" disabled>
                      -- Choose a Supplier --
                    </option>
                    {suppliersList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-1">
                    Expected Delivery Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                  />
                </div>
              </div>

              {/* Order Items Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-surface-800 uppercase tracking-wider">
                    Ordered Tyre Items <span className="text-danger-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-xs font-bold text-primary-600 hover:text-primary-800 cursor-pointer"
                  >
                    + Add Another Tyre
                  </button>
                </div>

                <div className="space-y-2">
                  {poItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-surface-50 rounded border border-surface-200 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                    >
                      <div className="sm:col-span-6">
                        <label className="block text-[11px] text-surface-500 font-medium mb-0.5">
                          Tyre Product
                        </label>
                        <select
                          required
                          value={item.productId}
                          onChange={(e) => handleItemChange(idx, "productId", e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs border border-surface-300 rounded bg-white outline-none"
                        >
                          <option value="" disabled>
                            -- Select Tyre --
                          </option>
                          {productsList.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.brand} {p.size} {p.pattern ? `(${p.pattern})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] text-surface-500 font-medium mb-0.5">
                          Quantity
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.quantityOrdered}
                          onChange={(e) => handleItemChange(idx, "quantityOrdered", e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-surface-300 rounded outline-none"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[11px] text-surface-500 font-medium mb-0.5">
                          Agreed Cost (₹)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="e.g. 4000.00"
                          value={item.unitCost}
                          onChange={(e) => handleItemChange(idx, "unitCost", e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-surface-300 rounded outline-none"
                        />
                      </div>

                      <div className="sm:col-span-1 text-center pt-3">
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          disabled={poItems.length === 1}
                          className={`text-sm ${
                            poItems.length === 1
                              ? "text-surface-300 cursor-not-allowed"
                              : "text-danger-500 hover:text-danger-700 cursor-pointer"
                          }`}
                          title="Remove item"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Estimated Total */}
              {estimatedTotalValue > 0 && (
                <div className="p-3 bg-surface-100 rounded flex items-center justify-between text-xs font-semibold text-surface-800">
                  <span>Estimated Total Order Value:</span>
                  <span className="text-base font-extrabold text-surface-900">
                    ₹{estimatedTotalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">
                  Order Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Dispatch via Transport XYZ, urgent delivery requested..."
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={formSubmitting}>
                  {formSubmitting ? "Creating Order..." : "Place Purchase Order"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
