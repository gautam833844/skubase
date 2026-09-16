"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { NavIcon } from "@/components/ui/NavIcon";
import type { AlignmentBillView } from "@/lib/types/alignment";
import type { ShopSettingView } from "@/lib/types/shop";

export default function AlignmentBillDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolvedParams = "then" in params ? use(params) : params;
  const id = resolvedParams.id;

  const [bill, setBill] = useState<AlignmentBillView | null>(null);
  const [shop, setShop] = useState<ShopSettingView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [billRes, shopRes] = await Promise.all([
          fetch(`/api/alignment/${id}`),
          fetch("/api/settings"),
        ]);

        const billData = await billRes.json();
        const shopData = await shopRes.json();

        if (ignore) return;

        if (billData.success) {
          setBill(billData.data);
        } else {
          setError(billData.error || "Failed to load document");
        }

        if (shopData.success) {
          setShop(shopData.data);
        }
      } catch {
        if (!ignore) {
          setError("Network error loading document");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    loadData();

    return () => {
      ignore = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-100 flex items-center justify-center p-6 text-surface-500 font-medium">
        Loading alignment document...
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="min-h-screen bg-surface-100 p-6">
        <div className="max-w-xl mx-auto space-y-4 pt-12">
          <Link href="/alignment" className="text-xs text-primary-600 hover:text-primary-800 font-semibold">
            ← Back to Alignment List
          </Link>
          <div className="p-4 bg-danger-50 text-danger-700 font-semibold rounded border border-danger-200">
            {error || "Document not found."}
          </div>
        </div>
      </div>
    );
  }

  const shopName = shop?.name || "Preethi Tyres";
  const addressLine = shop?.address || "OPP DIWAKER BUS DEPOT, NEAR RAJAHAMSA GUEST HOUSE.";
  const phoneNumbers = shop?.phoneNumber || "99630 00932, 99898 12444";

  const docDate = new Date(bill.date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-surface-100 p-4 sm:p-6 print:p-0 print:bg-white print:min-h-0">
      {/* Print Specific CSS */}
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 6mm 8mm;
        }
        @media print {
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print,
          aside,
          header,
          nav,
          footer {
            display: none !important;
          }
          #printable-bill {
            border: 2px solid black !important;
            box-shadow: none !important;
            margin: 0 auto !important;
            padding: 10px 14px !important;
            width: 100% !important;
            max-width: 100% !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          table, tr, td, th {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Screen Action Header (Hidden during printing) */}
      <div className="max-w-3xl mx-auto mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <Link
            href="/alignment"
            className="text-xs text-primary-600 hover:text-primary-800 font-semibold"
          >
            ← Back to Alignment List
          </Link>
          <h1 className="text-xl font-extrabold text-surface-900 mt-1">
            {bill.documentType}: {bill.billNumber}
          </h1>
          <p className="text-xs text-surface-500">
            Vehicle: <span className="font-mono font-bold text-surface-700">{bill.vehicleNumber}</span> • Customer: {bill.customerName}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            onClick={() => window.print()}
            className="cursor-pointer inline-flex items-center gap-1.5"
          >
            <NavIcon name="printer" className="w-4 h-4" />
            <span>Print Bill</span>
          </Button>
          <a
            href={`/api/alignment/${bill.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="inline-block"
          >
            <Button variant="secondary" size="sm" className="cursor-pointer inline-flex items-center gap-1.5">
              <NavIcon name="download" className="w-4 h-4" />
              <span>Download PDF</span>
            </Button>
          </a>
        </div>
      </div>

      {/* Main Printable Document Container */}
      <div className="max-w-3xl mx-auto">
        <div
          id="printable-bill"
          className="bg-white border-2 border-black rounded-none p-5 sm:p-7 text-black shadow-md print:shadow-none print:border-2 print:border-black print:p-3"
          style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
        >
          {/* 1. Header (Exact Physical Reference Format) */}
          <div className="text-center space-y-0.5 pb-2 border-b-2 border-black">
            {/* Title: Large, centered, serif, italic, underlined */}
            <h1
              className="text-3xl sm:text-4xl font-extrabold text-black tracking-wide underline underline-offset-4 leading-tight"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic" }}
            >
              {shopName}
            </h1>

            {/* Black solid horizontal bar with white bold text */}
            <div className="pt-2 pb-1">
              <div
                className="bg-black text-white py-1 px-4 text-center font-bold tracking-wider text-xs sm:text-sm uppercase inline-block w-full"
                style={{ backgroundColor: "#000000", color: "#ffffff" }}
              >
                For : WHEELS BALANCING &amp; ALIGNMENT - CENTRE
              </div>
            </div>

            {/* Address Line */}
            <p className="text-[11.5px] font-bold text-black uppercase tracking-tight pt-0.5">
              {addressLine}
            </p>

            {/* Location & Mobile contact line with Mob emphasis */}
            <p className="text-[11.5px] text-black">
              <span className="font-semibold">ANANTHAPURAMU - 515001. </span>
              <span className="font-black text-black ml-1">Mob : {phoneNumbers}</span>
            </p>
          </div>

          {/* 2. Metadata Box */}
          <div className="py-2 border-b border-black text-xs space-y-1.5">
            <div className="flex justify-between items-center font-bold">
              <div>
                <span>Bill No: </span>
                <span className="font-mono text-sm">{bill.billNumber}</span>
              </div>
              <div className="px-3 py-0.5 border border-black font-black text-xs uppercase tracking-wider">
                {bill.documentType}
              </div>
              <div>
                <span>Date: </span>
                <span className="font-semibold">{docDate}</span>
              </div>
            </div>

            <div className="flex items-baseline">
              <span className="font-bold w-10 shrink-0">M/s:</span>
              <span className="font-semibold text-xs border-b border-dotted border-surface-400 flex-1 pb-0.5">
                {bill.customerName}
                {bill.phoneNumber ? ` (Ph: ${bill.phoneNumber})` : ""}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex items-baseline">
                <span className="font-bold w-16 shrink-0">Veh No:</span>
                <span className="font-mono font-bold text-xs">{bill.vehicleNumber}</span>
              </div>
              <div className="flex items-baseline">
                <span className="font-bold mr-2">KM:</span>
                <span className="font-mono font-bold">
                  {bill.kilometers !== null ? bill.kilometers.toLocaleString("en-IN") : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* 3. 11-Row Service Items Table */}
          <div className="py-0">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr
                  className="border-b-2 border-black bg-surface-100 font-extrabold text-black"
                  style={{ backgroundColor: "#f1f5f9" }}
                >
                  <th className="py-1.5 px-2 text-center w-10 border-r border-black">S.No.</th>
                  <th className="py-1.5 px-2.5 border-r border-black">Particulars</th>
                  <th className="py-1.5 px-2.5 text-right w-24 border-r border-black">Rates (Rs.)</th>
                  <th className="py-1.5 px-2 text-center w-14 border-r border-black">Qty.</th>
                  <th className="py-1.5 px-2.5 text-right w-28">Amount (Rs.)</th>
                </tr>
              </thead>
              <tbody>
                {bill.items.map((item) => {
                  const rateNum = parseFloat(item.rate);
                  const qtyNum = parseFloat(item.quantity);
                  const amtNum = parseFloat(item.amount);
                  const hasValue = rateNum > 0 && qtyNum > 0;

                  return (
                    <tr
                      key={item.displayOrder}
                      className="border-b border-surface-300 font-medium"
                    >
                      <td className="py-1 px-2 text-center border-r border-black text-surface-800">
                        {item.displayOrder}
                      </td>
                      <td className="py-1 px-2.5 border-r border-black font-semibold text-black">
                        {item.particular}
                      </td>
                      <td className="py-1 px-2.5 text-right border-r border-black font-mono">
                        {hasValue
                          ? rateNum.toLocaleString("en-IN", { minimumFractionDigits: 2 })
                          : ""}
                      </td>
                      <td className="py-1 px-2 text-center border-r border-black font-mono">
                        {hasValue ? qtyNum.toString() : ""}
                      </td>
                      <td className="py-1 px-2.5 text-right font-mono font-bold text-black">
                        {hasValue
                          ? amtNum.toLocaleString("en-IN", { minimumFractionDigits: 2 })
                          : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Total Row */}
              <tfoot>
                <tr
                  className="border-t-2 border-b-2 border-black bg-surface-100 font-extrabold text-black"
                  style={{ backgroundColor: "#f1f5f9" }}
                >
                  <td colSpan={4} className="py-1.5 px-2.5 text-right border-r border-black uppercase tracking-wide">
                    TOTAL Rs.
                  </td>
                  <td className="py-1.5 px-2.5 text-right font-mono text-sm font-black">
                    {Number(bill.totalAmount).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* 4. Authentic Split Footer (ELOGI + Signature) */}
          <div className="grid grid-cols-2 gap-3 pt-3 mt-1 text-xs">
            {/* Left Box: ELOGI / Manufacturing Wheel Alignment */}
            <div className="border border-black p-2.5 min-h-[4.5rem] flex flex-col justify-center">
              <span className="font-black text-sm block tracking-wider text-black">ELOGI</span>
              <span className="font-bold text-xs block text-black mt-0.5">
                Manufacturing Wheel Alignment
              </span>
            </div>

            {/* Right Box: For Preethi Tyres / Signature */}
            <div className="border border-black p-2.5 min-h-[4.5rem] flex flex-col justify-between items-center text-center">
              <span className="font-bold text-xs uppercase tracking-wide text-black">
                For {shopName}
              </span>
              <div className="w-4/5 border-b border-surface-500 mt-5 mb-0.5"></div>
              <span className="text-xs font-semibold text-black">
                Signature
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
