import { jsPDF } from "jspdf";
import { db } from "@/lib/db";
import { requirePermission, getPermissionScope, type AuthActor } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors";
import { Prisma } from "@prisma/client";
import { getShopSettings } from "./shop.service";
import type { ShopSettingView } from "@/lib/types/shop";
import type { ReceiptItemView, ReceiptPaymentView } from "@/lib/types/receipt";

export interface SaleReceiptView {
  saleId: string;
  invoiceNumber: string;
  saleDate: string;
  status: string;
  isDraft: boolean;
  documentTitle: string;
  shop: ShopSettingView;
  customer: {
    name: string;
    phoneNumber: string | null;
    vehicleNumber: string | null;
    vehicleModel: string | null;
    address: string | null;
  } | null;
  seller: {
    fullName: string;
    username: string | null;
  } | null;
  items: ReceiptItemView[];
  itemCount: number;
  totalQuantity: number;
  subtotal: string | number;
  discountAmount: string | number;
  totalAmount: string | number;
  totalPaid: string | number;
  remainingBalance: string | number;
  paymentStatus: string;
  payments: ReceiptPaymentView[];
  notes: string | null;
}

export {
  type ReceiptItemView,
  type ReceiptPaymentView,
};

/**
 * Retrieves finalized receipt data for a sale:
 * - Authorizes user access with scoped IDOR check (sales:view_history).
 * - Uses dynamic, centralized shop settings from database.
 * - Uses historical SaleItem prices & quantities (zero catalog recalculation).
 * - Strictly omits internal cost prices and profit margins from the customer view.
 * - Computes exact Decimal financial totals, amount paid, and remaining balance.
 * - Leaves all database records, stock levels, and payments completely unchanged.
 */
export async function getSaleReceipt(saleId: string, actor: AuthActor): Promise<SaleReceiptView> {
  requirePermission(actor, "sales:view_history", "OWN");

  const scope = getPermissionScope(actor, "sales:view_history");

  const [sale, shopSettings] = await Promise.all([
    db.sale.findUnique({
      where: { id: saleId },
      include: {
        customer: true,
        createdBy: {
          select: { id: true, fullName: true, username: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, brand: true, size: true, pattern: true },
            },
          },
        },
        payments: {
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    getShopSettings(actor),
  ]);

  if (!sale) {
    throw new AppError("NOT_FOUND", `Sale ${saleId} not found`, "Sale record not found.");
  }

  // IDOR protection for staff
  if (scope === "OWN" && sale.createdById !== actor.id) {
    throw new AppError(
      "AUTHORIZATION",
      `Actor ${actor.id} cannot view receipt for sale created by ${sale.createdById}`,
      "You do not have permission to view this receipt."
    );
  }

  const isDraft = sale.status === "DRAFT";
  const documentTitle = isDraft ? "DRAFT ESTIMATE (NOT A FINAL BILL)" : "SALE RECEIPT";

  // Exact Decimal calculations
  const totalPaid = sale.payments.reduce(
    (sum, p) => sum.add(p.amount),
    new Prisma.Decimal(0)
  );

  const remainingBalance = sale.totalAmount.sub(totalPaid);

  const receiptItems: ReceiptItemView[] = sale.items.map((item) => ({
    id: item.id,
    brand: item.product?.brand ?? "Tyre",
    size: item.product?.size ?? "",
    pattern: item.product?.pattern ?? null,
    quantity: item.quantity,
    unitPrice: item.unitPrice.toString(),
    discountAmount: item.discountAmount.toString(),
    totalPrice: item.totalPrice.toString(),
  }));

  const totalQuantity = receiptItems.reduce((sum, item) => sum + item.quantity, 0);

  const receiptPayments: ReceiptPaymentView[] = sale.payments.map((p) => ({
    id: p.id,
    amount: p.amount.toString(),
    paymentMethod: p.paymentMethod,
    referenceNumber: p.referenceNumber,
    paymentDate: p.paymentDate.toISOString(),
  }));

  return {
    saleId: sale.id,
    invoiceNumber: sale.invoiceNumber,
    saleDate: sale.saleDate.toISOString(),
    status: sale.status,
    isDraft,
    documentTitle,
    shop: shopSettings,
    customer: sale.customer
      ? {
          name: sale.customer.name,
          phoneNumber: sale.customer.phoneNumber,
          vehicleNumber: sale.customer.vehicleNumber,
          vehicleModel: sale.customer.vehicleModel,
          address: sale.customer.address,
        }
      : null,
    seller: sale.createdBy
      ? {
          fullName: sale.createdBy.fullName,
          username: sale.createdBy.username,
        }
      : null,
    items: receiptItems,
    itemCount: receiptItems.length,
    totalQuantity,
    subtotal: sale.subtotal.toString(),
    discountAmount: sale.discountAmount.toString(),
    totalAmount: sale.totalAmount.toString(),
    totalPaid: totalPaid.toString(),
    remainingBalance: remainingBalance.toString(),
    paymentStatus: sale.paymentStatus,
    payments: receiptPayments,
    notes: sale.notes,
  };
}

/**
 * Generates a clean, professional, multi-page capable A4 PDF document for the receipt.
 */
export async function generateReceiptPdf(receipt: SaleReceiptView): Promise<Uint8Array> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 15;
  const contentWidth = pageWidth - margin * 2; // 180mm

  let cursorY = margin;

  const checkPageBreak = (neededHeight: number) => {
    if (cursorY + neededHeight > pageHeight - margin - 15) {
      doc.addPage();
      cursorY = margin;
      drawHeader();
    }
  };

  const drawHeader = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59); // surface-800
    doc.text(receipt.shop.name, pageWidth / 2, cursorY, { align: "center" });
    cursorY += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // surface-500
    if (receipt.shop.tagline) {
      doc.text(receipt.shop.tagline, pageWidth / 2, cursorY, { align: "center" });
      cursorY += 4.5;
    }
    if (receipt.shop.address) {
      doc.text(receipt.shop.address, pageWidth / 2, cursorY, { align: "center" });
      cursorY += 4.5;
    }
    const contactParts: string[] = [];
    if (receipt.shop.phoneNumber) contactParts.push(`Phone: ${receipt.shop.phoneNumber}`);
    if (receipt.shop.email) contactParts.push(`Email: ${receipt.shop.email}`);
    if (receipt.shop.gstin) contactParts.push(`GSTIN: ${receipt.shop.gstin}`);
    if (contactParts.length > 0) {
      doc.text(contactParts.join(" | "), pageWidth / 2, cursorY, { align: "center" });
      cursorY += 4.5;
    }
    cursorY += 2;

    // Document Title Banner
    doc.setDrawColor(203, 213, 225); // surface-300
    doc.setLineWidth(0.3);
    doc.line(margin, cursorY, margin + contentWidth, cursorY);
    cursorY += 5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    if (receipt.isDraft) {
      doc.setTextColor(217, 119, 6); // warning amber
    } else {
      doc.setTextColor(15, 23, 42); // slate-900
    }
    doc.text(receipt.documentTitle, pageWidth / 2, cursorY, { align: "center" });
    cursorY += 6;

    doc.setDrawColor(203, 213, 225);
    doc.line(margin, cursorY, margin + contentWidth, cursorY);
    cursorY += 6;
  };

  // 1. Render Shop Header
  drawHeader();

  // 2. Receipt Meta & Customer Information Block
  const blockTop = cursorY;
  doc.setFontSize(9);

  // Left column: Sale Meta
  doc.setFont("helvetica", "bold");
  doc.setTextColor(51, 65, 85);
  doc.text("Receipt Number:", margin, cursorY);
  doc.setFont("helvetica", "normal");
  doc.text(receipt.invoiceNumber, margin + 30, cursorY);
  cursorY += 4.5;

  doc.setFont("helvetica", "bold");
  doc.text("Date & Time:", margin, cursorY);
  doc.setFont("helvetica", "normal");
  doc.text(new Date(receipt.saleDate).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }), margin + 30, cursorY);
  cursorY += 4.5;

  doc.setFont("helvetica", "bold");
  doc.text("Billed By:", margin, cursorY);
  doc.setFont("helvetica", "normal");
  doc.text(receipt.seller?.fullName ?? receipt.seller?.username ?? "Sales Desk", margin + 30, cursorY);
  cursorY += 4.5;

  doc.setFont("helvetica", "bold");
  doc.text("Payment Status:", margin, cursorY);
  doc.setFont("helvetica", "bold");
  if (receipt.paymentStatus === "PAID") {
    doc.setTextColor(22, 101, 52); // green
  } else if (receipt.paymentStatus === "PARTIALLY_PAID") {
    doc.setTextColor(180, 83, 9); // amber
  } else {
    doc.setTextColor(185, 28, 28); // red
  }
  doc.text(receipt.paymentStatus, margin + 30, cursorY);

  // Right column: Customer Info
  let rightColY = blockTop;
  const rightColX = margin + 100;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(51, 65, 85);
  doc.text("Customer Information:", rightColX, rightColY);
  rightColY += 4.5;

  doc.setFont("helvetica", "normal");
  if (receipt.customer) {
    doc.text(`Name: ${receipt.customer.name}`, rightColX, rightColY);
    rightColY += 4.5;
    if (receipt.customer.phoneNumber) {
      doc.text(`Phone: ${receipt.customer.phoneNumber}`, rightColX, rightColY);
      rightColY += 4.5;
    }
    if (receipt.customer.vehicleNumber) {
      doc.text(
        `Vehicle: ${receipt.customer.vehicleNumber}${receipt.customer.vehicleModel ? ` (${receipt.customer.vehicleModel})` : ""}`,
        rightColX,
        rightColY
      );
      rightColY += 4.5;
    }
  } else {
    doc.text("Walk-in Customer", rightColX, rightColY);
    rightColY += 4.5;
  }

  cursorY = Math.max(cursorY, rightColY) + 4;

  // 3. Items Table Header
  checkPageBreak(30);

  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(margin, cursorY, contentWidth, 7, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);

  doc.text("#", margin + 2, cursorY + 4.8);
  doc.text("Tyre Item Description", margin + 10, cursorY + 4.8);
  doc.text("Qty", margin + 105, cursorY + 4.8, { align: "center" });
  doc.text("Unit Price (₹)", margin + 135, cursorY + 4.8, { align: "right" });
  doc.text("Discount (₹)", margin + 155, cursorY + 4.8, { align: "right" });
  doc.text("Total (₹)", margin + contentWidth - 2, cursorY + 4.8, { align: "right" });

  cursorY += 8;

  // 4. Items Table Rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  receipt.items.forEach((item, index) => {
    checkPageBreak(10);

    const desc = `${item.brand} ${item.size}${item.pattern ? ` (${item.pattern})` : ""}`;
    const unitPriceFormatted = Number(item.unitPrice).toLocaleString("en-IN", { minimumFractionDigits: 2 });
    const discountFormatted = Number(item.discountAmount) > 0
      ? `-${Number(item.discountAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
      : "—";
    const totalPriceFormatted = Number(item.totalPrice).toLocaleString("en-IN", { minimumFractionDigits: 2 });

    doc.setTextColor(71, 85, 105);
    doc.text((index + 1).toString(), margin + 2, cursorY + 4);
    doc.setTextColor(15, 23, 42);
    doc.text(desc, margin + 10, cursorY + 4);
    doc.text(item.quantity.toString(), margin + 105, cursorY + 4, { align: "center" });
    doc.text(unitPriceFormatted, margin + 135, cursorY + 4, { align: "right" });
    doc.setTextColor(185, 28, 28);
    doc.text(discountFormatted, margin + 155, cursorY + 4, { align: "right" });
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text(totalPriceFormatted, margin + contentWidth - 2, cursorY + 4, { align: "right" });
    doc.setFont("helvetica", "normal");

    cursorY += 6;
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, cursorY, margin + contentWidth, cursorY);
    cursorY += 1;
  });

  cursorY += 3;

  // 5. Financial Totals Summary Block
  checkPageBreak(35);

  const subtotalFormatted = Number(receipt.subtotal).toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const totalDiscountFormatted = Number(receipt.discountAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const totalAmountFormatted = Number(receipt.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const totalPaidFormatted = Number(receipt.totalPaid).toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const remainingFormatted = Number(receipt.remainingBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 });

  const totalsBoxWidth = 75;
  const totalsBoxX = margin + contentWidth - totalsBoxWidth;

  doc.setFillColor(248, 250, 252);
  doc.rect(totalsBoxX, cursorY, totalsBoxWidth, 26, "F");
  doc.setDrawColor(226, 232, 240);
  doc.rect(totalsBoxX, cursorY, totalsBoxWidth, 26, "S");

  let tY = cursorY + 4.5;
  doc.setFontSize(8.5);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Subtotal:", totalsBoxX + 4, tY);
  doc.text(`₹${subtotalFormatted}`, totalsBoxX + totalsBoxWidth - 4, tY, { align: "right" });
  tY += 4.5;

  if (Number(receipt.discountAmount) > 0) {
    doc.setTextColor(185, 28, 28);
    doc.text("Total Discount:", totalsBoxX + 4, tY);
    doc.text(`-₹${totalDiscountFormatted}`, totalsBoxX + totalsBoxWidth - 4, tY, { align: "right" });
    tY += 4.5;
  }

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Grand Total:", totalsBoxX + 4, tY);
  doc.text(`₹${totalAmountFormatted}`, totalsBoxX + totalsBoxWidth - 4, tY, { align: "right" });
  tY += 4.5;

  doc.setTextColor(22, 101, 52);
  doc.text("Amount Paid:", totalsBoxX + 4, tY);
  doc.text(`₹${totalPaidFormatted}`, totalsBoxX + totalsBoxWidth - 4, tY, { align: "right" });
  tY += 4.5;

  doc.setTextColor(Number(receipt.remainingBalance) > 0 ? 180 : 71, Number(receipt.remainingBalance) > 0 ? 83 : 85, Number(receipt.remainingBalance) > 0 ? 9 : 105);
  doc.text("Balance Due:", totalsBoxX + 4, tY);
  doc.text(`₹${remainingFormatted}`, totalsBoxX + totalsBoxWidth - 4, tY, { align: "right" });

  cursorY += 30;

  // 6. Payment History Summary
  if (receipt.payments.length > 0) {
    checkPageBreak(20);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text("Payment Transactions", margin, cursorY);
    cursorY += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);

    receipt.payments.forEach((p) => {
      checkPageBreak(6);
      const pDate = new Date(p.paymentDate).toLocaleDateString("en-IN", { dateStyle: "medium" });
      const pRef = p.referenceNumber ? ` (Ref: ${p.referenceNumber})` : "";
      const pAmount = Number(p.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 });
      doc.text(`• ${pDate} — ${p.paymentMethod}${pRef}: ₹${pAmount}`, margin + 2, cursorY);
      cursorY += 4;
    });

    cursorY += 4;
  }

  // 7. Footer Note & Page Numbering
  checkPageBreak(15);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(receipt.shop.billFooter || "Thank you for your business!", pageWidth / 2, cursorY + 4, { align: "center" });

  // Add Page Numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${i} of ${totalPages} — ${receipt.invoiceNumber}`, pageWidth / 2, pageHeight - 7, { align: "center" });
  }

  return new Uint8Array(doc.output("arraybuffer"));
}
