"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CONTROLLED_ADJUSTMENT_REASONS, type AdjustmentType } from "@/lib/types/inventory";

interface ProductItem {
  id: string;
  brand: string;
  size: string;
  pattern: string;
  unitPrice: string | number;
  averageCostPrice: string | number;
  quantityOnHand: number;
  minStockAlert: number;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

interface InventoryMetrics {
  totalPhysicalTyres: number;
  totalActiveProducts: number;
}

export default function InventoryPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [metrics, setMetrics] = useState<InventoryMetrics>({
    totalPhysicalTyres: 0,
    totalActiveProducts: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<string>("ALL");
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "INACTIVE" | "ALL">("ACTIVE");

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);

  // Form states for Add Product
  const [addBrand, setAddBrand] = useState("");
  const [addSize, setAddSize] = useState("");
  const [addPattern, setAddPattern] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [addMinAlert, setAddMinAlert] = useState("4");
  const [addNotes, setAddNotes] = useState("");
  const [addInitialStock, setAddInitialStock] = useState("0");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form states for Stock Adjustment
  const [adjustType, setAdjustType] = useState<AdjustmentType>("ADD");
  const [adjustQuantity, setAdjustQuantity] = useState("1");
  const [adjustReason, setAdjustReason] = useState<string>(CONTROLLED_ADJUSTMENT_REASONS[0]);
  const [adjustNotes, setAdjustNotes] = useState("");

  // Form states for Edit Product
  const [editPrice, setEditPrice] = useState("");
  const [editMinAlert, setEditMinAlert] = useState("4");
  const [editNotes, setEditNotes] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshProducts = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (searchTerm) params.set("search", searchTerm);
        if (selectedBrand !== "ALL") params.set("brand", selectedBrand);
        if (lowStockFilter) params.set("lowStockOnly", "true");
        params.set("status", statusFilter);

        const res = await fetch(`/api/inventory/products?${params.toString()}`);
        const json = await res.json();

        if (ignore) return;

        if (!res.ok || !json.success) {
          setError(json.error ?? "Failed to load products.");
        } else {
          setProducts(json.data ?? []);
          if (json.metrics) {
            setMetrics(json.metrics);
          }
        }
      } catch {
        if (!ignore) {
          setError("Network error while loading inventory.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      ignore = true;
    };
  }, [searchTerm, selectedBrand, lowStockFilter, statusFilter, refreshKey]);

  // Unique brand list for filter dropdown
  const uniqueBrands = useMemo(() => {
    const brands = new Set<string>();
    products.forEach((p) => {
      if (p.brand) brands.add(p.brand.toUpperCase());
    });
    return Array.from(brands).sort();
  }, [products]);

  // Low stock count in current view
  const lowStockCount = useMemo(() => {
    return products.filter((p) => p.isActive && p.quantityOnHand <= p.minStockAlert).length;
  }, [products]);

  // Stock Adjustment Preview Calculation
  const adjustedStockPreview = useMemo(() => {
    if (!selectedProduct) return 0;
    const current = selectedProduct.quantityOnHand;
    const num = Number(adjustQuantity) || 0;

    if (adjustType === "ADD") return current + num;
    if (adjustType === "REMOVE") return current - num;
    if (adjustType === "SET_ACTUAL") return num;
    return current;
  }, [selectedProduct, adjustType, adjustQuantity]);

  // Handle Add Product Submit
  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    setModalError(null);
    setFormSubmitting(true);

    try {
      const res = await fetch("/api/inventory/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: addBrand,
          size: addSize,
          pattern: addPattern,
          unitPrice: parseFloat(addPrice),
          minStockAlert: parseInt(addMinAlert, 10),
          notes: addNotes,
          initialQuantity: parseInt(addInitialStock, 10) || 0,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setModalError(json.error ?? "Failed to create product.");
        setFormSubmitting(false);
        return;
      }

      setIsAddModalOpen(false);
      setAddBrand("");
      setAddSize("");
      setAddPattern("");
      setAddPrice("");
      setAddMinAlert("4");
      setAddNotes("");
      setAddInitialStock("0");
      refreshProducts();
    } catch {
      setModalError("Network error while creating product.");
    } finally {
      setFormSubmitting(false);
    }
  }

  // Handle Stock Adjustment Submit
  async function handleAdjustStock(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProduct) return;
    setModalError(null);
    setFormSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        productId: selectedProduct.id,
        adjustmentType: adjustType,
        reason: adjustReason,
        notes: adjustNotes,
      };

      if (adjustType === "SET_ACTUAL") {
        payload.actualCount = parseInt(adjustQuantity, 10);
      } else {
        payload.quantity = parseInt(adjustQuantity, 10);
      }

      const res = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setModalError(json.error ?? "Failed to adjust stock.");
        setFormSubmitting(false);
        return;
      }

      setIsAdjustModalOpen(false);
      setSelectedProduct(null);
      refreshProducts();
    } catch {
      setModalError("Network error while adjusting stock.");
    } finally {
      setFormSubmitting(false);
    }
  }

  // Handle Edit Product Submit
  async function handleEditProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProduct) return;
    setModalError(null);
    setFormSubmitting(true);

    try {
      const res = await fetch(`/api/inventory/products/${selectedProduct.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitPrice: parseFloat(editPrice),
          minStockAlert: parseInt(editMinAlert, 10),
          notes: editNotes,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setModalError(json.error ?? "Failed to update product.");
        setFormSubmitting(false);
        return;
      }

      setIsEditModalOpen(false);
      setSelectedProduct(null);
      refreshProducts();
    } catch {
      setModalError("Network error while updating product.");
    } finally {
      setFormSubmitting(false);
    }
  }

  // Handle Product Deactivate / Reactivate
  async function handleToggleActive(product: ProductItem) {
    const action = product.isActive ? "DEACTIVATE" : "REACTIVATE";
    const confirmText = product.isActive
      ? `Are you sure you want to deactivate ${product.brand} ${product.size}?`
      : `Reactivate ${product.brand} ${product.size}?`;

    if (!window.confirm(confirmText)) return;

    try {
      const res = await fetch(`/api/inventory/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        refreshProducts();
      } else {
        alert(json.error ?? "Failed to update product status.");
      }
    } catch {
      alert("Network error updating product status.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Tyre Inventory</h1>
          <p className="text-sm text-surface-500 mt-1">
            Physical stock tracking, catalogue management, and controlled manual adjustments.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/inventory/history">
            <Button variant="outline" size="sm" className="cursor-pointer">
              Movement History
            </Button>
          </Link>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setModalError(null);
              setIsAddModalOpen(true);
            }}
            className="cursor-pointer"
          >
            + Add New Tyre
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 border-l-4 border-l-primary-500">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
            Total Tyres in Stock
          </div>
          <div className="mt-2 text-3xl font-extrabold text-surface-900">
            {metrics.totalPhysicalTyres.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-surface-500">Physical count on hand</div>
        </Card>

        <Card className="p-5 border-l-4 border-l-surface-400">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
            Active Tyre SKUs
          </div>
          <div className="mt-2 text-3xl font-extrabold text-surface-900">
            {metrics.totalActiveProducts.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-surface-500">Unique brand/size combinations</div>
        </Card>

        <Card
          className={`p-5 border-l-4 ${
            lowStockCount > 0 ? "border-l-warning-500 bg-warning-50/20" : "border-l-success-500"
          }`}
        >
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
            Low Stock Alerts
          </div>
          <div
            className={`mt-2 text-3xl font-extrabold ${
              lowStockCount > 0 ? "text-warning-600" : "text-success-600"
            }`}
          >
            {lowStockCount}
          </div>
          <div className="mt-1 text-xs text-surface-500">Items at or below min alert threshold</div>
        </Card>
      </div>

      {/* Search & Filter Controls */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Quick Search */}
          <div className="sm:col-span-2">
            <label htmlFor="search" className="block text-xs font-medium text-surface-600 mb-1">
              Search Tyres
            </label>
            <input
              id="search"
              type="text"
              placeholder="Search by brand, size (195/65 R15), or pattern..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-surface-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Brand Filter */}
          <div>
            <label htmlFor="brand-filter" className="block text-xs font-medium text-surface-600 mb-1">
              Brand Filter
            </label>
            <select
              id="brand-filter"
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-surface-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            >
              <option value="ALL">All Brands</option>
              {uniqueBrands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Status & Low Stock Toggles */}
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => setLowStockFilter((prev) => !prev)}
              className={`flex-1 px-3 py-2 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                lowStockFilter
                  ? "bg-warning-100 border-warning-400 text-warning-800 font-bold"
                  : "bg-surface-50 border-surface-300 text-surface-600 hover:bg-surface-100"
              }`}
            >
              {lowStockFilter ? "⚠️ Low Stock Filter Active" : "Filter Low Stock"}
            </button>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "ACTIVE" | "INACTIVE" | "ALL")}
              className="px-2 py-2 text-xs border border-surface-300 rounded-md bg-white text-surface-700"
              aria-label="Status filter"
            >
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Deactivated</option>
              <option value="ALL">All</option>
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

      {/* Products Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-surface-200 text-sm">
            <thead className="bg-surface-50 text-surface-600 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-4 py-3 text-left">
                  Brand & Pattern
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Tyre Size
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Selling Price
                </th>
                <th scope="col" className="px-4 py-3 text-center">
                  Stock on Hand
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
                  <td colSpan={6} className="px-4 py-8 text-center text-surface-500">
                    Loading inventory records...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-surface-500">
                    <div className="text-base font-semibold text-surface-700">No tyres found</div>
                    <div className="text-xs text-surface-400 mt-1">
                      {searchTerm || selectedBrand !== "ALL" || lowStockFilter
                        ? "Try clearing your filters or search terms."
                        : "Click '+ Add New Tyre' above to create your first tyre product."}
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isLow = p.quantityOnHand <= p.minStockAlert;
                  const isOut = p.quantityOnHand === 0;

                  return (
                    <tr key={p.id} className="hover:bg-surface-50/60 transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-bold text-surface-900">{p.brand}</div>
                        {p.pattern && (
                          <div className="text-xs text-surface-500 font-medium">{p.pattern}</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap font-semibold text-surface-800">
                        {p.size}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-right font-medium text-surface-900">
                        ₹{Number(p.unitPrice).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                            isOut
                              ? "bg-danger-100 text-danger-700"
                              : isLow
                              ? "bg-warning-100 text-warning-800"
                              : "bg-success-100 text-success-800"
                          }`}
                        >
                          {p.quantityOnHand} in stock
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        <StatusBadge
                          variant={p.isActive ? (isOut ? "danger" : isLow ? "warning" : "success") : "neutral"}
                          label={!p.isActive ? "Inactive" : isOut ? "Out of Stock" : isLow ? "Low Stock" : "In Stock"}
                        />
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-right space-x-2">
                        {p.isActive && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedProduct(p);
                                setAdjustType("ADD");
                                setAdjustQuantity("1");
                                setAdjustReason(CONTROLLED_ADJUSTMENT_REASONS[0]);
                                setAdjustNotes("");
                                setModalError(null);
                                setIsAdjustModalOpen(true);
                              }}
                              className="text-xs font-semibold text-primary-600 hover:text-primary-800 px-2 py-1 rounded hover:bg-primary-50 transition-colors cursor-pointer"
                            >
                              Adjust Stock
                            </button>
                            <button
                              onClick={() => {
                                setSelectedProduct(p);
                                setEditPrice(String(p.unitPrice));
                                setEditMinAlert(String(p.minStockAlert));
                                setEditNotes(p.notes ?? "");
                                setModalError(null);
                                setIsEditModalOpen(true);
                              }}
                              className="text-xs font-medium text-surface-600 hover:text-surface-900 px-2 py-1 rounded hover:bg-surface-100 transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleToggleActive(p)}
                          className={`text-xs font-medium px-2 py-1 rounded transition-colors cursor-pointer ${
                            p.isActive
                              ? "text-danger-600 hover:text-danger-800 hover:bg-danger-50"
                              : "text-success-600 hover:text-success-800 hover:bg-success-50"
                          }`}
                        >
                          {p.isActive ? "Deactivate" : "Reactivate"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* =========================================================================
          MODAL 1: ADD PRODUCT MODAL
         ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-200 pb-3">
              <h2 className="text-lg font-bold text-surface-900">Add New Tyre Product</h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
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

            <form onSubmit={handleAddProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">
                  Brand <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MRF, Apollo, Bridgestone, CEAT"
                  value={addBrand}
                  onChange={(e) => setAddBrand(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">
                  Tyre Size <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 195/65 R15, 145/80 R12"
                  value={addSize}
                  onChange={(e) => setAddSize(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">
                  Pattern / Model Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. ZVTV, Amazer 4G, SecuraDrive"
                  value={addPattern}
                  onChange={(e) => setAddPattern(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-1">
                    Selling Price (₹) <span className="text-danger-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="4500.00"
                    value={addPrice}
                    onChange={(e) => setAddPrice(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-1">
                    Min Stock Alert
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={addMinAlert}
                    onChange={(e) => setAddMinAlert(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">
                  Initial Physical Stock (Optional)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={addInitialStock}
                  onChange={(e) => setAddInitialStock(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                />
                <p className="text-[11px] text-surface-400 mt-0.5">
                  If greater than 0, an initial ledger entry will automatically be recorded.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional notes or supplier details..."
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={formSubmitting}>
                  {formSubmitting ? "Creating..." : "Create Tyre"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: MANUAL STOCK ADJUSTMENT MODAL
         ========================================================================= */}
      {isAdjustModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-surface-200 pb-3">
              <div>
                <h2 className="text-lg font-bold text-surface-900">Manual Stock Adjustment</h2>
                <p className="text-xs text-surface-500">
                  {selectedProduct.brand} {selectedProduct.size} {selectedProduct.pattern}
                </p>
              </div>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
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

            {/* Current Stock Banner */}
            <div className="bg-surface-50 p-3 rounded-md flex items-center justify-between">
              <span className="text-xs text-surface-600 font-medium">Current System Stock:</span>
              <span className="text-base font-extrabold text-surface-900">
                {selectedProduct.quantityOnHand} tyres
              </span>
            </div>

            <form onSubmit={handleAdjustStock} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">
                  Adjustment Action
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType("ADD")}
                    className={`py-2 text-xs font-bold rounded border cursor-pointer ${
                      adjustType === "ADD"
                        ? "bg-success-50 border-success-500 text-success-700"
                        : "bg-white border-surface-300 text-surface-600 hover:bg-surface-50"
                    }`}
                  >
                    + Add Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType("REMOVE")}
                    className={`py-2 text-xs font-bold rounded border cursor-pointer ${
                      adjustType === "REMOVE"
                        ? "bg-danger-50 border-danger-500 text-danger-700"
                        : "bg-white border-surface-300 text-surface-600 hover:bg-surface-50"
                    }`}
                  >
                    - Remove Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType("SET_ACTUAL")}
                    className={`py-2 text-xs font-bold rounded border cursor-pointer ${
                      adjustType === "SET_ACTUAL"
                        ? "bg-primary-50 border-primary-500 text-primary-700"
                        : "bg-white border-surface-300 text-surface-600 hover:bg-surface-50"
                    }`}
                  >
                    Set Count
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">
                  {adjustType === "SET_ACTUAL" ? "Actual Physical Count" : "Quantity"}
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              {/* Calculated Result Preview */}
              <div
                className={`p-2.5 rounded text-xs font-medium flex items-center justify-between ${
                  adjustedStockPreview < 0
                    ? "bg-danger-50 text-danger-700 border border-danger-300"
                    : "bg-surface-100 text-surface-800"
                }`}
              >
                <span>Resulting Stock Balance:</span>
                <span className="font-bold text-sm">
                  {adjustedStockPreview < 0
                    ? "Error: Negative Stock!"
                    : `${adjustedStockPreview} tyres`}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">
                  Controlled Reason <span className="text-danger-500">*</span>
                </label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                >
                  {CONTROLLED_ADJUSTMENT_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">
                  Explanatory Note
                </label>
                <input
                  type="text"
                  placeholder="Optional detail (e.g. found 1 tyre behind rack)..."
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAdjustModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={formSubmitting || adjustedStockPreview < 0}
                >
                  {formSubmitting ? "Adjusting..." : "Confirm Adjustment"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: EDIT PRODUCT MODAL
         ========================================================================= */}
      {isEditModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-surface-200 pb-3">
              <div>
                <h2 className="text-lg font-bold text-surface-900">Edit Product</h2>
                <p className="text-xs text-surface-500">
                  {selectedProduct.brand} {selectedProduct.size} {selectedProduct.pattern}
                </p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
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

            <form onSubmit={handleEditProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">
                  Selling Price (₹) <span className="text-danger-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                />
                <p className="text-[11px] text-surface-400 mt-0.5">
                  Updating selling price does not alter historical sales invoices.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">
                  Min Stock Alert Threshold
                </label>
                <input
                  type="number"
                  min="0"
                  value={editMinAlert}
                  onChange={(e) => setEditMinAlert(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={formSubmitting}>
                  {formSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
