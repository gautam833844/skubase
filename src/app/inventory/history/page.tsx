"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface MovementRecord {
  id: string;
  productId: string;
  movementType: string;
  quantityDelta: number;
  balanceAfter: number;
  referenceType: string | null;
  reason: string | null;
  createdAt: string;
  product: {
    id: string;
    brand: string;
    size: string;
    pattern: string;
  };
  actor: {
    id: string;
    fullName: string;
    username: string | null;
  } | null;
}

export default function InventoryHistoryPage() {
  const [movements, setMovements] = useState<MovementRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);

  const refreshMovements = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadMovements() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/inventory/movements");
        const json = await res.json();

        if (ignore) return;

        if (!res.ok || !json.success) {
          setError(json.error ?? "Failed to load inventory movements.");
        } else {
          setMovements(json.data ?? []);
        }
      } catch {
        if (!ignore) {
          setError("Network error while loading movement ledger.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadMovements();

    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/inventory"
              className="text-xs text-primary-600 hover:text-primary-800 font-semibold"
            >
              ← Back to Inventory
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight mt-1">
            Inventory Movement Ledger
          </h1>
          <p className="text-sm text-surface-500 mt-1">
            Immutable audit record of all physical stock additions, removals, and manual adjustments.
          </p>
        </div>
        <div>
          <Button variant="outline" size="sm" onClick={refreshMovements} disabled={isLoading}>
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

      {/* Movements Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-surface-200 text-sm">
            <thead className="bg-surface-50 text-surface-600 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-4 py-3 text-left">
                  Date & Time
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Tyre Product
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Movement Type
                </th>
                <th scope="col" className="px-4 py-3 text-center">
                  Stock Change
                </th>
                <th scope="col" className="px-4 py-3 text-center">
                  Balance After
                </th>
                <th scope="col" className="px-4 py-3 text-left">
                  Reason / Notes
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Performed By
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-surface-500">
                    Loading movement records...
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-surface-500">
                    <div className="text-base font-semibold text-surface-700">No stock movements recorded yet</div>
                    <div className="text-xs text-surface-400 mt-1">
                      When you adjust stock or receive tyres, every change will appear in this ledger.
                    </div>
                  </td>
                </tr>
              ) : (
                movements.map((m) => {
                  const isPositive = m.quantityDelta > 0;
                  const dateStr = new Date(m.createdAt).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  });

                  return (
                    <tr key={m.id} className="hover:bg-surface-50/60 transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-surface-600 font-medium">
                        {dateStr}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-bold text-surface-900">
                          {m.product.brand} {m.product.size}
                        </div>
                        {m.product.pattern && (
                          <div className="text-xs text-surface-500">{m.product.pattern}</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                            m.movementType.includes("IN") || m.movementType === "PURCHASE_RECEIPT"
                              ? "bg-success-50 text-success-700 border border-success-200"
                              : "bg-warning-50 text-warning-800 border border-warning-200"
                          }`}
                        >
                          {m.movementType.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                            isPositive
                              ? "bg-success-100 text-success-800"
                              : "bg-danger-100 text-danger-800"
                          }`}
                        >
                          {isPositive ? `+${m.quantityDelta}` : m.quantityDelta}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-center font-bold text-surface-900">
                        {m.balanceAfter}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-surface-700 max-w-xs truncate">
                        {m.reason ?? "Manual adjustment"}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-right text-xs font-medium text-surface-600">
                        {m.actor?.fullName ?? m.actor?.username ?? "System"}
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
