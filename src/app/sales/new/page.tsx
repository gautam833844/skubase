"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface CustomerOption {
  id: string;
  name: string;
  phoneNumber: string | null;
  vehicleNumber: string | null;
}

interface ProductOption {
  id: string;
  brand: string;
  size: string;
  pattern: string;
  unitPrice: string | number;
  quantityOnHand: number;
}

interface NewSaleItemRow {
  productId: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
}

export default function NewSalePage() {
  const router = useRouter();

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [saleNotes, setSaleNotes] = useState("");
  const [saleItems, setSaleItems] = useState<NewSaleItemRow[]>([
    { productId: "", quantity: "1", unitPrice: "", discountAmount: "" },
  ]);

  const [formSubmitting, setFormSubmitting] = useState(false);

  // Quick Add Customer Inline Modal
  const [isQuickCustomerOpen, setIsQuickCustomerOpen] = useState(false);
  const [qcName, setQcName] = useState("");
  const [qcPhone, setQcPhone] = useState("");
  const [qcVehicle, setQcVehicle] = useState("");
  const [qcSubmitting, setQcSubmitting] = useState(false);
  const [qcError, setQcError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const [custRes, prodRes] = await Promise.all([
          fetch("/api/customers?status=ACTIVE"),
          fetch("/api/inventory/products?status=ACTIVE"),
        ]);

        const [custJson, prodJson] = await Promise.all([custRes.json(), prodRes.json()]);

        if (ignore) return;

        if (custJson.success && custJson.data) {
          setCustomers(custJson.data);
        }
        if (prodJson.success && prodJson.data) {
          setProducts(prodJson.data);
          if (prodJson.data.length > 0) {
            const firstProd = prodJson.data[0];
            setSaleItems((prev) => {
              if (prev.length === 1 && prev[0].productId === "") {
                return [
                  {
                    productId: firstProd.id,
                    quantity: "1",
                    unitPrice: String(firstProd.unitPrice),
                    discountAmount: "",
                  },
                ];
              }
              return prev;
            });
          }
        }
      } catch {
        if (!ignore) {
          setError("Failed to load customer list or tyre catalog.");
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
  }, []);

  const productMap = useMemo(() => {
    return new Map(products.map((p) => [p.id, p]));
  }, [products]);

  const handleAddItemRow = () => {
    const defaultProd = products.length > 0 ? products[0] : null;
    setSaleItems((prev) => [
      ...prev,
      {
        productId: defaultProd ? defaultProd.id : "",
        quantity: "1",
        unitPrice: defaultProd ? String(defaultProd.unitPrice) : "",
        discountAmount: "",
      },
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (saleItems.length === 1) return;
    setSaleItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProductSelect = (index: number, productId: string) => {
    const prod = productMap.get(productId);
    setSaleItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        productId,
        unitPrice: prod ? String(prod.unitPrice) : updated[index].unitPrice,
      };
      return updated;
    });
  };

  const handleItemChange = (index: number, field: keyof NewSaleItemRow, value: string) => {
    setSaleItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const calculations = useMemo(() => {
    const rowDetails = saleItems.map((item) => {
      const prod = productMap.get(item.productId);
      const qty = parseInt(item.quantity, 10) || 0;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      const discount = parseFloat(item.discountAmount) || 0;

      const lineSubtotal = qty * unitPrice;
      const lineTotal = Math.max(0, lineSubtotal - discount);
      const stockOnHand = prod ? prod.quantityOnHand : 0;
      const isStockLow = prod ? qty > stockOnHand : false;

      return {
        lineSubtotal,
        discount,
        lineTotal,
        stockOnHand,
        isStockLow,
      };
    });

    const subtotal = rowDetails.reduce((sum, r) => sum + r.lineSubtotal, 0);
    const totalDiscount = rowDetails.reduce((sum, r) => sum + r.discount, 0);
    const grandTotal = Math.max(0, subtotal - totalDiscount);

    return {
      subtotal,
      totalDiscount,
      grandTotal,
      rowDetails,
    };
  }, [saleItems, productMap]);

  async function handleQuickAddCustomer(e: React.FormEvent) {
    e.preventDefault();
    setQcError(null);
    setQcSubmitting(true);

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: qcName,
          phoneNumber: qcPhone || undefined,
          vehicleNumber: qcVehicle || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setQcError(json.error ?? "Failed to create customer.");
        setQcSubmitting(false);
        return;
      }

      setCustomers((prev) => [json.data, ...prev]);
      setSelectedCustomerId(json.data.id);
      setIsQuickCustomerOpen(false);
      setQcName("");
      setQcPhone("");
      setQcVehicle("");
    } catch {
      setQcError("Network error creating customer.");
    } finally {
      setQcSubmitting(false);
    }
  }

  async function handleSaveSaleDraft(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFormSubmitting(true);

    try {
      const formattedItems = [];
      for (const item of saleItems) {
        if (!item.productId) {
          setError("Please select a tyre for every line item.");
          setFormSubmitting(false);
          return;
        }

        const qty = parseInt(item.quantity, 10);
        if (isNaN(qty) || qty <= 0) {
          setError("Quantity must be a positive whole number.");
          setFormSubmitting(false);
          return;
        }

        formattedItems.push({
          productId: item.productId,
          quantity: qty,
          unitPrice: item.unitPrice ? parseFloat(item.unitPrice) : undefined,
          discountAmount: item.discountAmount ? parseFloat(item.discountAmount) : undefined,
        });
      }

      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomerId || null,
          notes: saleNotes || undefined,
          items: formattedItems,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Failed to create sale draft.");
        setFormSubmitting(false);
        return;
      }

      router.push(`/sales/${json.data.id}`);
    } catch {
      setError("Network error saving sale draft.");
      setFormSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <Link href="/sales" className="text-xs text-primary-600 hover:text-primary-800 font-semibold">
          ← Back to Sales
        </Link>
        <h1 className="text-2xl font-bold text-surface-900 tracking-tight mt-1">
          Create Sale Draft (POS)
        </h1>
        <p className="text-sm text-surface-500 mt-0.5">
          Select tyres, enter selling prices, and prepare a customer sale. Stock is not deducted for drafts.
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          className="p-4 bg-danger-50 text-danger-700 text-sm font-medium rounded border border-danger-300"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSaveSaleDraft} className="space-y-6">
        {/* Customer Selection Card */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-surface-800 uppercase tracking-wider">
              Customer Information (Optional)
            </label>
            <button
              type="button"
              onClick={() => {
                setQcError(null);
                setIsQuickCustomerOpen(true);
              }}
              className="text-xs font-bold text-primary-600 hover:text-primary-800 cursor-pointer"
            >
              + Quick Add Customer
            </button>
          </div>

          <div>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none bg-white"
            >
              <option value="">-- Walk-in Customer (No customer record) --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phoneNumber ? `(${c.phoneNumber})` : ""} {c.vehicleNumber ? `[${c.vehicleNumber}]` : ""}
                </option>
              ))}
            </select>
          </div>
        </Card>

        {/* Tyre Line Items Card */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-surface-800 uppercase tracking-wider">
              Tyre Products in Sale <span className="text-danger-500">*</span>
            </label>
            <button
              type="button"
              onClick={handleAddItemRow}
              className="text-xs font-bold text-primary-600 hover:text-primary-800 cursor-pointer"
            >
              + Add Another Tyre
            </button>
          </div>

          <div className="space-y-3">
            {saleItems.map((item, idx) => {
              const rowCalc = calculations.rowDetails[idx];
              const selectedProd = productMap.get(item.productId);

              return (
                <div
                  key={idx}
                  className="p-3.5 bg-surface-50 rounded-lg border border-surface-200 space-y-2"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                    {/* Tyre Product Selector */}
                    <div className="sm:col-span-5">
                      <label className="block text-[11px] text-surface-500 font-medium mb-0.5">
                        Tyre Product
                      </label>
                      <select
                        required
                        value={item.productId}
                        onChange={(e) => handleProductSelect(idx, e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-surface-300 rounded bg-white outline-none font-medium"
                      >
                        <option value="" disabled>
                          -- Select Tyre --
                        </option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.brand} {p.size} {p.pattern ? `(${p.pattern})` : ""} — In Stock: {p.quantityOnHand}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-surface-500 font-medium mb-0.5">
                        Qty
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-surface-300 rounded outline-none font-bold"
                      />
                    </div>

                    {/* Selling Price */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-surface-500 font-medium mb-0.5">
                        Unit Price (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        placeholder="Catalog price"
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-surface-300 rounded outline-none font-semibold"
                      />
                    </div>

                    {/* Discount */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-surface-500 font-medium mb-0.5">
                        Discount (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={item.discountAmount}
                        onChange={(e) => handleItemChange(idx, "discountAmount", e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-surface-300 rounded outline-none"
                      />
                    </div>

                    {/* Remove Row */}
                    <div className="sm:col-span-1 text-center pt-3">
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        disabled={saleItems.length === 1}
                        className={`text-sm ${
                          saleItems.length === 1
                            ? "text-surface-300 cursor-not-allowed"
                            : "text-danger-500 hover:text-danger-700 cursor-pointer"
                        }`}
                        title="Remove tyre"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Stock Availability & Line Total Indicator */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs pt-1 border-t border-surface-200/60 gap-1">
                    <div>
                      {selectedProd && (
                        <span
                          className={`font-medium ${
                            rowCalc.isStockLow
                              ? "text-warning-800 bg-warning-50 px-1.5 py-0.5 rounded font-bold"
                              : "text-surface-600"
                          }`}
                        >
                          {rowCalc.isStockLow
                            ? `Low stock: Only ${rowCalc.stockOnHand} available in physical stock.`
                            : `Physical Stock: ${rowCalc.stockOnHand} available`}
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-surface-900">
                      Line Total: ₹{rowCalc.lineTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals Summary */}
          <div className="p-4 bg-surface-100 rounded-lg space-y-1.5 text-xs text-surface-700">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-semibold text-surface-900">
                ₹{calculations.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            {calculations.totalDiscount > 0 && (
              <div className="flex justify-between text-danger-700">
                <span>Total Discount:</span>
                <span className="font-semibold">
                  -₹{calculations.totalDiscount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm font-extrabold text-surface-900 pt-2 border-t border-surface-200">
              <span>Grand Total:</span>
              <span className="text-base text-primary-800">
                ₹{calculations.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </Card>

        {/* Sale Notes Card */}
        <Card className="p-4">
          <label className="block text-xs font-semibold text-surface-700 mb-1">
            Sale / Billing Notes (Optional)
          </label>
          <textarea
            rows={2}
            placeholder="e.g. Fitting and wheel balancing completed, customer requested warranty bill..."
            value={saleNotes}
            onChange={(e) => setSaleNotes(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
          />
        </Card>

        {/* Informational Stock Notice */}
        <div className="p-3.5 bg-info-50 rounded border border-info-200 text-xs text-info-900">
          <span className="font-bold">ℹ️ Note:</span> Saving this record creates a{" "}
          <span className="font-bold">Sale Draft</span>. Physical inventory on hand is NOT deducted
          until the sale is finalized in subsequent steps.
        </div>

        {/* Submit Actions */}
        <div className="flex justify-end gap-3">
          <Link href="/sales">
            <Button type="button" variant="outline" size="sm">
              Cancel
            </Button>
          </Link>
          <Button type="submit" variant="primary" size="sm" disabled={formSubmitting || isLoading}>
            {formSubmitting ? "Saving Draft..." : "Save Sale Draft"}
          </Button>
        </div>
      </form>

      {/* QUICK ADD CUSTOMER MODAL */}
      {isQuickCustomerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-surface-200 pb-2.5">
              <h2 className="text-base font-bold text-surface-900">Quick Add Customer</h2>
              <button
                onClick={() => setIsQuickCustomerOpen(false)}
                className="text-surface-400 hover:text-surface-600 text-base"
              >
                ✕
              </button>
            </div>

            {qcError && (
              <div className="p-2.5 bg-danger-50 text-danger-700 text-xs font-medium rounded border border-danger-200">
                {qcError}
              </div>
            )}

            <form onSubmit={handleQuickAddCustomer} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">
                  Customer Name <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Patel"
                  value={qcName}
                  onChange={(e) => setQcName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210"
                  value={qcPhone}
                  onChange={(e) => setQcPhone(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">Vehicle Reg Number</label>
                <input
                  type="text"
                  placeholder="e.g. MH 02 AB 1234"
                  value={qcVehicle}
                  onChange={(e) => setQcVehicle(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none uppercase font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsQuickCustomerOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={qcSubmitting}>
                  {qcSubmitting ? "Adding..." : "Add & Select"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
