"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DEFAULT_ALIGNMENT_SERVICES } from "@/lib/constants/alignment-services";

interface ServiceRowState {
  displayOrder: number;
  particular: string;
  rate: string;
  quantity: string;
}

export default function NewAlignmentBillPage() {
  const router = useRouter();

  // Document Metadata
  const [documentType, setDocumentType] = useState<"ESTIMATE" | "BILL">("BILL");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [customerName, setCustomerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [kilometers, setKilometers] = useState("");
  const [notes, setNotes] = useState("");

  // 11 Fixed Pre-populated Services
  const [services, setServices] = useState<ServiceRowState[]>(() =>
    DEFAULT_ALIGNMENT_SERVICES.map((s) => ({
      displayOrder: s.displayOrder,
      particular: s.particular,
      rate: "",
      quantity: "",
    }))
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live Calculations
  const rowAmounts = useMemo(() => {
    return services.map((s) => {
      const rateNum = parseFloat(s.rate) || 0;
      const qtyNum = parseFloat(s.quantity) || 0;
      return rateNum * qtyNum;
    });
  }, [services]);

  const grandTotal = useMemo(() => {
    return rowAmounts.reduce((acc, curr) => acc + curr, 0);
  }, [rowAmounts]);

  const handleItemChange = (index: number, field: "rate" | "quantity", value: string) => {
    setServices((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customerName.trim()) {
      setError("Customer name (M/s) is required");
      return;
    }
    if (!vehicleNumber.trim()) {
      setError("Vehicle number is required");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        documentType,
        date: new Date(date).toISOString(),
        customerName: customerName.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        kilometers: kilometers ? parseInt(kilometers, 10) : undefined,
        notes: notes.trim() || undefined,
        items: services.map((s) => ({
          particular: s.particular,
          rate: parseFloat(s.rate) || 0,
          quantity: parseFloat(s.quantity) || 0,
          displayOrder: s.displayOrder,
        })),
      };

      const res = await fetch("/api/alignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        router.push(`/alignment/${json.data.id}`);
      } else {
        setError(json.error || "Failed to create alignment bill");
      }
    } catch {
      setError("Network error submitting alignment bill");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/alignment" className="text-xs text-primary-600 hover:underline">
              ← Back to Alignment Bills
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight mt-1">
            New {documentType === "ESTIMATE" ? "Alignment Estimate" : "Alignment Bill"}
          </h1>
          <p className="text-sm text-surface-500">
            Generate printable workshop documentation with 11 standard services
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-danger-50 border border-danger-200 text-danger-700 text-sm rounded-lg font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Document Header Details */}
        <Card className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-surface-200 pb-4">
            {/* Toggle: Estimate vs Bill */}
            <div>
              <label className="block text-xs font-bold text-surface-700 uppercase mb-1">
                Document Type
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDocumentType("BILL")}
                  className={`px-4 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                    documentType === "BILL"
                      ? "bg-primary-600 text-white shadow-sm"
                      : "bg-surface-100 text-surface-600 hover:bg-surface-200"
                  }`}
                >
                  BILL (ALN-...)
                </button>
                <button
                  type="button"
                  onClick={() => setDocumentType("ESTIMATE")}
                  className={`px-4 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                    documentType === "ESTIMATE"
                      ? "bg-amber-600 text-white shadow-sm"
                      : "bg-surface-100 text-surface-600 hover:bg-surface-200"
                  }`}
                >
                  ESTIMATE (EST-...)
                </button>
              </div>
            </div>

            {/* Date Input */}
            <div className="w-full sm:w-auto">
              <label className="block text-xs font-bold text-surface-700 uppercase mb-1">
                Document Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full sm:w-44 px-3 py-2 text-sm bg-white border border-surface-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-medium"
              />
            </div>
          </div>

          {/* Customer & Vehicle Information Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-surface-700 uppercase mb-1">
                M/s (Customer Name) <span className="text-danger-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Rajesh Kumar"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-white border border-surface-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-surface-700 uppercase mb-1">
                Veh No. <span className="text-danger-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. TN 01 AB 1234"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                required
                className="w-full px-3 py-2 text-sm bg-white border border-surface-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-surface-700 uppercase mb-1">
                KM. (Odometer)
              </label>
              <input
                type="number"
                placeholder="e.g. 45000"
                value={kilometers}
                onChange={(e) => setKilometers(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-surface-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-surface-700 uppercase mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-surface-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="sm:col-span-2 md:col-span-4">
              <label className="block text-xs font-bold text-surface-700 uppercase mb-1">
                Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="Optional notes or remarks"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-surface-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </Card>

        {/* 11 Services Fixed Table */}
        <Card className="p-0 overflow-hidden">
          <div className="bg-surface-50 px-5 py-3 border-b border-surface-200 flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-surface-700">
              Service Particulars & Rates (11 Services)
            </h3>
            <span className="text-xs text-surface-500 font-normal">
              Leave unperformed services blank or 0
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-100 text-surface-700 text-xs font-bold border-b border-surface-200 uppercase">
                <tr>
                  <th className="py-2.5 px-4 text-center w-12">S.No.</th>
                  <th className="py-2.5 px-4">Particulars</th>
                  <th className="py-2.5 px-4 text-right w-36">Rates (₹)</th>
                  <th className="py-2.5 px-4 text-center w-28">Qty.</th>
                  <th className="py-2.5 px-4 text-right w-36">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {services.map((row, idx) => {
                  const isFilled = rowAmounts[idx] > 0;
                  return (
                    <tr
                      key={row.displayOrder}
                      className={`transition-colors ${isFilled ? "bg-primary-50/30" : "hover:bg-surface-50/50"}`}
                    >
                      <td className="py-2 px-4 text-center font-bold text-surface-500">
                        {row.displayOrder}
                      </td>
                      <td className="py-2 px-4 font-semibold text-surface-900">
                        {row.particular}
                      </td>
                      <td className="py-2 px-4 text-right">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0.00"
                          value={row.rate}
                          onChange={(e) => handleItemChange(idx, "rate", e.target.value)}
                          className="w-full px-2.5 py-1 text-right text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 font-medium"
                        />
                      </td>
                      <td className="py-2 px-4 text-center">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="1"
                          value={row.quantity}
                          onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                          className="w-full px-2 py-1 text-center text-sm border border-surface-300 rounded focus:ring-2 focus:ring-primary-500 font-medium"
                        />
                      </td>
                      <td className="py-2 px-4 text-right font-mono font-bold text-surface-900">
                        {rowAmounts[idx] > 0
                          ? `₹${rowAmounts[idx].toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Total Row */}
          <div className="bg-surface-100 p-4 border-t border-surface-300 flex justify-between items-center">
            <span className="text-sm font-extrabold uppercase text-surface-800 tracking-wider">
              Total Amount
            </span>
            <div className="text-xl font-extrabold font-mono text-primary-800">
              ₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </Card>

        {/* Action Bar */}
        <div className="flex justify-end gap-3 pt-2">
          <Link href="/alignment">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            variant="primary"
            disabled={submitting}
            className="px-8 py-2.5 text-sm font-bold"
          >
            {submitting
              ? "Saving..."
              : documentType === "ESTIMATE"
              ? "Save & Preview Estimate"
              : "Save & Generate Bill"}
          </Button>
        </div>
      </form>
    </div>
  );
}
