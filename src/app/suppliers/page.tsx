"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface SupplierItem {
  id: string;
  name: string;
  contactPerson: string | null;
  phoneNumber: string | null;
  whatsappNumber: string | null;
  gstNumber: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  _count: {
    purchaseOrders: number;
    purchaseReceipts: number;
  };
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [totalActive, setTotalActive] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "INACTIVE" | "ALL">("ACTIVE");
  const [refreshKey, setRefreshKey] = useState(0);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierItem | null>(null);

  // Add form states
  const [addName, setAddName] = useState("");
  const [addContactPerson, setAddContactPerson] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addWhatsapp, setAddWhatsapp] = useState("");
  const [addGst, setAddGst] = useState("");
  const [addAddress, setAddAddress] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Edit form states
  const [editName, setEditName] = useState("");
  const [editContactPerson, setEditContactPerson] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editGst, setEditGst] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const refreshSuppliers = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadSuppliers() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (searchTerm) params.set("search", searchTerm);
        params.set("status", statusFilter);

        const res = await fetch(`/api/suppliers?${params.toString()}`);
        const json = await res.json();

        if (ignore) return;

        if (!res.ok || !json.success) {
          setError(json.error ?? "Failed to load suppliers.");
        } else {
          setSuppliers(json.data ?? []);
          if (json.metrics) {
            setTotalActive(json.metrics.totalActiveSuppliers ?? 0);
          }
        }
      } catch {
        if (!ignore) {
          setError("Network error while loading suppliers.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadSuppliers();

    return () => {
      ignore = true;
    };
  }, [searchTerm, statusFilter, refreshKey]);

  async function handleAddSupplier(e: React.FormEvent) {
    e.preventDefault();
    setModalError(null);
    setFormSubmitting(true);

    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addName,
          contactPerson: addContactPerson,
          phoneNumber: addPhone,
          whatsappNumber: addWhatsapp,
          gstNumber: addGst,
          address: addAddress,
          notes: addNotes,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setModalError(json.error ?? "Failed to create supplier.");
        setFormSubmitting(false);
        return;
      }

      setIsAddModalOpen(false);
      setAddName("");
      setAddContactPerson("");
      setAddPhone("");
      setAddWhatsapp("");
      setAddGst("");
      setAddAddress("");
      setAddNotes("");
      refreshSuppliers();
    } catch {
      setModalError("Network error creating supplier.");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleEditSupplier(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSupplier) return;
    setModalError(null);
    setFormSubmitting(true);

    try {
      const res = await fetch(`/api/suppliers/${selectedSupplier.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          contactPerson: editContactPerson,
          phoneNumber: editPhone,
          whatsappNumber: editWhatsapp,
          gstNumber: editGst,
          address: editAddress,
          notes: editNotes,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setModalError(json.error ?? "Failed to update supplier.");
        setFormSubmitting(false);
        return;
      }

      setIsEditModalOpen(false);
      setSelectedSupplier(null);
      refreshSuppliers();
    } catch {
      setModalError("Network error updating supplier.");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleToggleActive(supplier: SupplierItem) {
    const action = supplier.isActive ? "DEACTIVATE" : "REACTIVATE";
    const confirmText = supplier.isActive
      ? `Are you sure you want to deactivate ${supplier.name}?`
      : `Reactivate ${supplier.name}?`;

    if (!window.confirm(confirmText)) return;

    try {
      const res = await fetch(`/api/suppliers/${supplier.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        refreshSuppliers();
      } else {
        alert(json.error ?? "Failed to update supplier status.");
      }
    } catch {
      alert("Network error updating supplier status.");
    }
  }

  const supplierStats = useMemo(() => {
    return {
      active: totalActive,
      total: suppliers.length,
    };
  }, [totalActive, suppliers.length]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Suppliers Directory</h1>
          <p className="text-sm text-surface-500 mt-1">
            Manage tyre distributors, phone/WhatsApp contacts, and procurement history.
          </p>
        </div>
        <div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setModalError(null);
              setIsAddModalOpen(true);
            }}
            className="cursor-pointer"
          >
            + Add New Supplier
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5 border-l-4 border-l-primary-500">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
            Active Suppliers
          </div>
          <div className="mt-2 text-3xl font-extrabold text-surface-900">
            {supplierStats.active}
          </div>
          <div className="mt-1 text-xs text-surface-500">Eligible for purchase orders</div>
        </Card>

        <Card className="p-5 border-l-4 border-l-surface-400">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
            Total In Directory
          </div>
          <div className="mt-2 text-3xl font-extrabold text-surface-900">
            {supplierStats.total}
          </div>
          <div className="mt-1 text-xs text-surface-500">Including historical vendors</div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label htmlFor="search" className="block text-xs font-medium text-surface-600 mb-1">
              Search Suppliers
            </label>
            <input
              id="search"
              type="text"
              placeholder="Search by supplier name, contact person, phone, WhatsApp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-surface-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label htmlFor="status" className="block text-xs font-medium text-surface-600 mb-1">
              Status Filter
            </label>
            <select
              id="status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "ACTIVE" | "INACTIVE" | "ALL")}
              className="w-full px-3 py-2 text-sm border border-surface-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="ACTIVE">Active Suppliers</option>
              <option value="INACTIVE">Deactivated Only</option>
              <option value="ALL">All Suppliers</option>
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

      {/* Suppliers Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-surface-200 text-sm">
            <thead className="bg-surface-50 text-surface-600 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-4 py-3 text-left">
                  Supplier Name
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Contact Person
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Phone / WhatsApp
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  GST Number
                </th>
                <th scope="col" className="px-4 py-3 text-center">
                  Orders / Receipts
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
                  <td colSpan={7} className="px-4 py-8 text-center text-surface-500">
                    Loading suppliers...
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-surface-500">
                    <div className="text-base font-semibold text-surface-700">No suppliers found</div>
                    <div className="text-xs text-surface-400 mt-1">
                      {searchTerm
                        ? "Try adjusting your search terms."
                        : "Click '+ Add New Supplier' above to create your first supplier contact."}
                    </div>
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-50/60 transition-colors">
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-bold text-surface-900">{s.name}</div>
                      {s.address && <div className="text-xs text-surface-500 truncate max-w-xs">{s.address}</div>}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-surface-700">
                      {s.contactPerson || "—"}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-surface-800 font-medium">
                      <div>{s.phoneNumber || "—"}</div>
                      {s.whatsappNumber && (
                        <div className="text-xs text-success-700 font-medium">WA: {s.whatsappNumber}</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-xs text-surface-600 font-mono">
                      {s.gstNumber || "—"}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-center text-xs text-surface-600 font-medium">
                      {s._count.purchaseOrders} POs / {s._count.purchaseReceipts} Receipts
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-center">
                      <StatusBadge
                        variant={s.isActive ? "success" : "neutral"}
                        label={s.isActive ? "Active" : "Inactive"}
                      />
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-right space-x-2">
                      <button
                        onClick={() => {
                          setSelectedSupplier(s);
                          setEditName(s.name);
                          setEditContactPerson(s.contactPerson ?? "");
                          setEditPhone(s.phoneNumber ?? "");
                          setEditWhatsapp(s.whatsappNumber ?? "");
                          setEditGst(s.gstNumber ?? "");
                          setEditAddress(s.address ?? "");
                          setEditNotes(s.notes ?? "");
                          setModalError(null);
                          setIsEditModalOpen(true);
                        }}
                        className="text-xs font-semibold text-primary-600 hover:text-primary-800 px-2 py-1 rounded hover:bg-primary-50 transition-colors cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleActive(s)}
                        className={`text-xs font-medium px-2 py-1 rounded transition-colors cursor-pointer ${
                          s.isActive
                            ? "text-danger-600 hover:text-danger-800 hover:bg-danger-50"
                            : "text-success-600 hover:text-success-800 hover:bg-success-50"
                        }`}
                      >
                        {s.isActive ? "Deactivate" : "Reactivate"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ADD SUPPLIER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-200 pb-3">
              <h2 className="text-lg font-bold text-surface-900">Add New Supplier</h2>
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

            <form onSubmit={handleAddSupplier} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">
                  Supplier / Agency Name <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Metro Tyre Distributors"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">Contact Person</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar"
                  value={addContactPerson}
                  onChange={(e) => setAddContactPerson(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-1">WhatsApp Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={addWhatsapp}
                    onChange={(e) => setAddWhatsapp(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">GST Number (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 27AABCU9603R1ZM"
                  value={addGst}
                  onChange={(e) => setAddGst(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">Address / Warehouse</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Plot 14, Industrial Area..."
                  value={addAddress}
                  onChange={(e) => setAddAddress(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional delivery terms, payment conditions..."
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
                  {formSubmitting ? "Saving..." : "Create Supplier"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SUPPLIER MODAL */}
      {isEditModalOpen && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-200 pb-3">
              <h2 className="text-lg font-bold text-surface-900">Edit Supplier</h2>
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

            <form onSubmit={handleEditSupplier} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">
                  Supplier Name <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">Contact Person</label>
                <input
                  type="text"
                  value={editContactPerson}
                  onChange={(e) => setEditContactPerson(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-1">WhatsApp Number</label>
                  <input
                    type="text"
                    value={editWhatsapp}
                    onChange={(e) => setEditWhatsapp(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">GST Number</label>
                <input
                  type="text"
                  value={editGst}
                  onChange={(e) => setEditGst(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">Address</label>
                <textarea
                  rows={2}
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
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
