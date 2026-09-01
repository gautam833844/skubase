"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface CustomerItem {
  id: string;
  name: string;
  phoneNumber: string | null;
  vehicleNumber: string | null;
  vehicleModel: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  _count: {
    sales: number;
  };
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [totalActive, setTotalActive] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "INACTIVE" | "ALL">("ACTIVE");
  const [refreshKey, setRefreshKey] = useState(0);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);

  // Add form states
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addVehicleNumber, setAddVehicleNumber] = useState("");
  const [addVehicleModel, setAddVehicleModel] = useState("");
  const [addAddress, setAddAddress] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Edit form states
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editVehicleNumber, setEditVehicleNumber] = useState("");
  const [editVehicleModel, setEditVehicleModel] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const refreshCustomers = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadCustomers() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (searchTerm) params.set("search", searchTerm);
        params.set("status", statusFilter);

        const res = await fetch(`/api/customers?${params.toString()}`);
        const json = await res.json();

        if (ignore) return;

        if (!res.ok || !json.success) {
          setError(json.error ?? "Failed to load customers.");
        } else {
          setCustomers(json.data ?? []);
          if (json.metrics) {
            setTotalActive(json.metrics.totalActiveCustomers ?? 0);
          }
        }
      } catch {
        if (!ignore) {
          setError("Network error while loading customers.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadCustomers();

    return () => {
      ignore = true;
    };
  }, [searchTerm, statusFilter, refreshKey]);

  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault();
    setModalError(null);
    setFormSubmitting(true);

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addName,
          phoneNumber: addPhone || undefined,
          vehicleNumber: addVehicleNumber || undefined,
          vehicleModel: addVehicleModel || undefined,
          address: addAddress || undefined,
          notes: addNotes || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setModalError(json.error ?? "Failed to create customer.");
        setFormSubmitting(false);
        return;
      }

      setIsAddModalOpen(false);
      setAddName("");
      setAddPhone("");
      setAddVehicleNumber("");
      setAddVehicleModel("");
      setAddAddress("");
      setAddNotes("");
      refreshCustomers();
    } catch {
      setModalError("Network error creating customer.");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleEditCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustomer) return;
    setModalError(null);
    setFormSubmitting(true);

    try {
      const res = await fetch(`/api/customers/${selectedCustomer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          phoneNumber: editPhone,
          vehicleNumber: editVehicleNumber,
          vehicleModel: editVehicleModel,
          address: editAddress,
          notes: editNotes,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setModalError(json.error ?? "Failed to update customer.");
        setFormSubmitting(false);
        return;
      }

      setIsEditModalOpen(false);
      setSelectedCustomer(null);
      refreshCustomers();
    } catch {
      setModalError("Network error updating customer.");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleToggleActive(customer: CustomerItem) {
    const action = customer.isActive ? "DEACTIVATE" : "REACTIVATE";
    const confirmText = customer.isActive
      ? `Are you sure you want to deactivate customer ${customer.name}?`
      : `Reactivate customer ${customer.name}?`;

    if (!window.confirm(confirmText)) return;

    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        refreshCustomers();
      } else {
        alert(json.error ?? "Failed to update customer status.");
      }
    } catch {
      alert("Network error updating customer status.");
    }
  }

  const customerStats = useMemo(() => {
    return {
      active: totalActive,
      total: customers.length,
    };
  }, [totalActive, customers.length]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Customer Records</h1>
          <p className="text-sm text-surface-500 mt-1">
            Maintain customer vehicle details, contact numbers, and purchase history.
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
            + Add New Customer
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5 border-l-4 border-l-primary-500">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
            Active Customers
          </div>
          <div className="mt-2 text-3xl font-extrabold text-surface-900">
            {customerStats.active}
          </div>
          <div className="mt-1 text-xs text-surface-500">Available for billing and sales</div>
        </Card>

        <Card className="p-5 border-l-4 border-l-surface-400">
          <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
            Total Customer Records
          </div>
          <div className="mt-2 text-3xl font-extrabold text-surface-900">
            {customerStats.total}
          </div>
          <div className="mt-1 text-xs text-surface-500">Including historical customer profiles</div>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label htmlFor="search-customers" className="block text-xs font-medium text-surface-600 mb-1">
              Search Customers
            </label>
            <input
              id="search-customers"
              type="text"
              placeholder="Search by customer name, phone number, vehicle number (MH02AB1234)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-surface-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label htmlFor="status-filter" className="block text-xs font-medium text-surface-600 mb-1">
              Status Filter
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "ACTIVE" | "INACTIVE" | "ALL")}
              className="w-full px-3 py-2 text-sm border border-surface-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="ACTIVE">Active Customers</option>
              <option value="INACTIVE">Deactivated Only</option>
              <option value="ALL">All Records</option>
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

      {/* Customers Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-surface-200 text-sm">
            <thead className="bg-surface-50 text-surface-600 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-4 py-3 text-left">
                  Customer Name
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Phone Number
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Vehicle Number & Model
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Address
                </th>
                <th scope="col" className="px-4 py-3 text-center">
                  Total Sales
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
                    Loading customers...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-surface-500">
                    <div className="text-base font-semibold text-surface-700">No customers found</div>
                    <div className="text-xs text-surface-400 mt-1">
                      {searchTerm
                        ? "Try adjusting your search criteria."
                        : "Click '+ Add New Customer' above to save your first customer profile."}
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-50/60 transition-colors">
                    <td className="px-4 py-3.5 whitespace-nowrap font-bold text-surface-900">
                      {c.name}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap font-medium text-surface-800">
                      {c.phoneNumber || "—"}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {c.vehicleNumber ? (
                        <div>
                          <span className="font-mono font-bold text-surface-900 bg-surface-100 px-1.5 py-0.5 rounded text-xs">
                            {c.vehicleNumber}
                          </span>
                          {c.vehicleModel && (
                            <span className="text-xs text-surface-500 ml-1.5">{c.vehicleModel}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-surface-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-surface-600 max-w-xs truncate">
                      {c.address || "—"}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-center text-xs font-semibold text-surface-700">
                      {c._count.sales} sale(s)
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-center">
                      <StatusBadge
                        variant={c.isActive ? "success" : "neutral"}
                        label={c.isActive ? "Active" : "Inactive"}
                      />
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-right space-x-2">
                      <button
                        onClick={() => {
                          setSelectedCustomer(c);
                          setEditName(c.name);
                          setEditPhone(c.phoneNumber ?? "");
                          setEditVehicleNumber(c.vehicleNumber ?? "");
                          setEditVehicleModel(c.vehicleModel ?? "");
                          setEditAddress(c.address ?? "");
                          setEditNotes(c.notes ?? "");
                          setModalError(null);
                          setIsEditModalOpen(true);
                        }}
                        className="text-xs font-semibold text-primary-600 hover:text-primary-800 px-2 py-1 rounded hover:bg-primary-50 transition-colors cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleActive(c)}
                        className={`text-xs font-medium px-2 py-1 rounded transition-colors cursor-pointer ${
                          c.isActive
                            ? "text-danger-600 hover:text-danger-800 hover:bg-danger-50"
                            : "text-success-600 hover:text-success-800 hover:bg-success-50"
                        }`}
                      >
                        {c.isActive ? "Deactivate" : "Reactivate"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ADD CUSTOMER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-200 pb-3">
              <h2 className="text-lg font-bold text-surface-900">Add New Customer</h2>
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

            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">
                  Customer Name <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sunil Sharma"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">
                  Phone Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 9820123456"
                  value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-1">
                    Vehicle Number (Reg #)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MH 02 AB 1234"
                    value={addVehicleNumber}
                    onChange={(e) => setAddVehicleNumber(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-1">
                    Vehicle Model
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Hyundai Creta"
                    value={addVehicleModel}
                    onChange={(e) => setAddVehicleModel(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">Address (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Andheri West, Mumbai..."
                  value={addAddress}
                  onChange={(e) => setAddAddress(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional customer preferences or tyre fitting notes..."
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
                  {formSubmitting ? "Saving..." : "Save Customer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CUSTOMER MODAL */}
      {isEditModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-200 pb-3">
              <h2 className="text-lg font-bold text-surface-900">Edit Customer</h2>
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

            <form onSubmit={handleEditCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1">
                  Customer Name <span className="text-danger-500">*</span>
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
                <label className="block text-xs font-semibold text-surface-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-1">
                    Vehicle Number (Reg #)
                  </label>
                  <input
                    type="text"
                    value={editVehicleNumber}
                    onChange={(e) => setEditVehicleNumber(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-1">
                    Vehicle Model
                  </label>
                  <input
                    type="text"
                    value={editVehicleModel}
                    onChange={(e) => setEditVehicleModel(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
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
