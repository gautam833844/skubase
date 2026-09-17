import { jsPDF } from "jspdf";
import { db } from "@/lib/db";
import { requirePermission, getPermissionScope, type AuthActor } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors";
import { Prisma, AlignmentDocType, AlignmentBillStatus } from "@prisma/client";
import { getShopSettings } from "./shop.service";
import { DEFAULT_ALIGNMENT_SERVICES } from "@/lib/constants/alignment-services";
import type {
  CreateAlignmentBillInput,
  AlignmentBillFilters,
  AlignmentBillView,
} from "@/lib/types/alignment";

// =============================================================================
// Skubase — Alignment & Service Billing Service
// =============================================================================

/**
 * Generates the next sequential number for an Alignment document.
 * Estimates: EST-1001, EST-1002...
 * Bills:     ALN-1001, ALN-1002...
 * Guarantees that deleted bill numbers are consumed and never reused.
 */
export async function generateNextAlignmentNumber(documentType: AlignmentDocType): Promise<string> {
  const prefix = documentType === "ESTIMATE" ? "EST" : "ALN";

  // Find max sequence number from existing bills
  const bills = await db.alignmentBill.findMany({
    where: { documentType },
    select: { billNumber: true },
  });

  let maxSeq = 1000;
  const prefixRegex = new RegExp(`^${prefix}-(\\d+)$`);

  for (const b of bills) {
    const match = b.billNumber.match(prefixRegex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  // Also check audit logs to ensure deleted bill numbers are never reused
  try {
    const auditLogs = await db.auditLog.findMany({
      where: { entityName: "AlignmentBill" },
      select: { newState: true, oldState: true },
    });

    for (const log of auditLogs) {
      const states = [log.newState, log.oldState];
      for (const st of states) {
        if (st && typeof st === "object" && "billNumber" in st) {
          const bn = String((st as any).billNumber);
          const match = bn.match(prefixRegex);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxSeq) {
              maxSeq = num;
            }
          }
        }
      }
    }
  } catch {
    // If audit log query fails for any reason, continue with maxSeq from bills
  }

  const nextSeq = maxSeq + 1;
  let candidate = `${prefix}-${nextSeq}`;

  let exists = await db.alignmentBill.findUnique({ where: { billNumber: candidate } });
  let offset = 1;
  while (exists) {
    candidate = `${prefix}-${nextSeq + offset}`;
    exists = await db.alignmentBill.findUnique({ where: { billNumber: candidate } });
    offset++;
  }

  return candidate;
}

/**
 * Creates a new Alignment Bill or Estimate.
 * - Enforces alignment:create permission.
 * - Validates customer and vehicle metadata.
 * - Calculates line-item amounts and grand total.
 * - Stores snapshot without touching Tyre Sales, Inventory, or stock levels.
 */
export async function createAlignmentBill(
  input: CreateAlignmentBillInput,
  actor: AuthActor
): Promise<AlignmentBillView> {
  requirePermission(actor, "alignment:create", "ALL");

  const customerName = input.customerName?.trim();
  if (!customerName || customerName.length < 2) {
    throw new AppError(
      "VALIDATION",
      "Customer name (M/s) is required and must be at least 2 characters",
      "Please enter the customer name."
    );
  }

  const vehicleNumber = input.vehicleNumber?.trim().toUpperCase();
  if (!vehicleNumber || vehicleNumber.length < 3) {
    throw new AppError(
      "VALIDATION",
      "Vehicle number (Veh No.) is required",
      "Please enter a valid vehicle number."
    );
  }

  let parsedKm: number | null = null;
  if (input.kilometers !== undefined && input.kilometers !== null && input.kilometers !== "") {
    parsedKm = parseInt(String(input.kilometers).replace(/,/g, ""), 10);
    if (isNaN(parsedKm) || parsedKm < 0) {
      throw new AppError(
        "VALIDATION",
        "Kilometers (KM) must be a non-negative number",
        "Please enter a valid kilometer reading."
      );
    }
  }

  const docType = input.documentType === "ESTIMATE" ? AlignmentDocType.ESTIMATE : AlignmentDocType.BILL;

  // Build items preserving standard order + additional services
  const inputItemsMap = new Map<number, { rate: number; quantity: number }>();
  const additionalItems: { particular: string; rate: number; quantity: number }[] = [];

  if (Array.isArray(input.items)) {
    input.items.forEach((item, index) => {
      const order = Number(item.displayOrder);
      const rate = Math.max(0, parseFloat(String(item.rate || 0)));
      const qty = Math.max(0, parseFloat(String(item.quantity || 0)));
      const cleanRate = isNaN(rate) ? 0 : rate;
      const cleanQty = isNaN(qty) ? 0 : qty;
      const part = typeof item.particular === "string" ? item.particular.trim() : "";

      if (order >= 1 && order <= 11) {
        inputItemsMap.set(order, { rate: cleanRate, quantity: cleanQty });
      } else if (order > 11 || index >= 11 || (!order && part)) {
        if (part) {
          additionalItems.push({
            particular: part,
            rate: cleanRate,
            quantity: cleanQty,
          });
        }
      }
    });
  }

  let computedTotal = 0;
  const processedItems: {
    particular: string;
    displayOrder: number;
    rate: Prisma.Decimal;
    quantity: Prisma.Decimal;
    amount: Prisma.Decimal;
  }[] = [];

  // 1. Process 11 standard services
  DEFAULT_ALIGNMENT_SERVICES.forEach((preset) => {
    const override = inputItemsMap.get(preset.displayOrder);
    const rate = override ? override.rate : preset.defaultRate;
    const quantity = override ? override.quantity : preset.defaultQuantity;
    const amount = Number((rate * quantity).toFixed(2));
    computedTotal += amount;

    processedItems.push({
      particular: preset.particular,
      displayOrder: preset.displayOrder,
      rate: new Prisma.Decimal(rate.toFixed(2)),
      quantity: new Prisma.Decimal(quantity.toFixed(2)),
      amount: new Prisma.Decimal(amount.toFixed(2)),
    });
  });

  // 2. Process optional additional services (displayOrder 12, 13...)
  let nextDisplayOrder = 12;
  additionalItems.forEach((addl) => {
    const amount = Number((addl.rate * addl.quantity).toFixed(2));
    computedTotal += amount;

    processedItems.push({
      particular: addl.particular,
      displayOrder: nextDisplayOrder++,
      rate: new Prisma.Decimal(addl.rate.toFixed(2)),
      quantity: new Prisma.Decimal(addl.quantity.toFixed(2)),
      amount: new Prisma.Decimal(amount.toFixed(2)),
    });
  });

  const finalBill = await db.$transaction(async (tx) => {
    const billNumber = await generateNextAlignmentNumber(docType);

    const bill = await tx.alignmentBill.create({
      data: {
        billNumber,
        documentType: docType,
        date: input.date ? new Date(input.date) : new Date(),
        customerId: input.customerId || null,
        customerName,
        phoneNumber: input.phoneNumber?.trim() || null,
        vehicleNumber,
        kilometers: parsedKm,
        totalAmount: new Prisma.Decimal(computedTotal.toFixed(2)),
        status: AlignmentBillStatus.COMPLETED,
        notes: input.notes?.trim() || null,
        createdById: actor.id,
        items: {
          create: processedItems.map((item) => ({
            particular: item.particular,
            displayOrder: item.displayOrder,
            rate: item.rate,
            quantity: item.quantity,
            amount: item.amount,
          })),
        },
      },
      include: {
        items: {
          orderBy: { displayOrder: "asc" },
        },
        createdBy: {
          select: { id: true, fullName: true, username: true },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        entityName: "AlignmentBill",
        entityId: bill.id,
        action: "ALIGNMENT_BILL_CREATED",
        newState: {
          billNumber: bill.billNumber,
          documentType: bill.documentType,
          customerName: bill.customerName,
          vehicleNumber: bill.vehicleNumber,
          totalAmount: bill.totalAmount.toString(),
        },
      },
    });

    return bill;
  });

  return formatAlignmentBillView(finalBill);
}

/**
 * Lists Alignment Bills and Estimates with search, filters, pagination, and role scoping.
 */
export async function listAlignmentBills(
  filters: AlignmentBillFilters = {},
  actor: AuthActor
) {
  const scope = getPermissionScope(actor, "alignment:view_history");
  if (scope === "NONE") {
    throw new AppError(
      "AUTHORIZATION",
      "Actor lacks permission to view alignment history",
      "You do not have permission to view alignment history."
    );
  }

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  const skip = (page - 1) * limit;

  const whereClause: Prisma.AlignmentBillWhereInput = {};

  if (scope === "OWN") {
    whereClause.createdById = actor.id;
  }

  if (filters.documentType && filters.documentType !== "ALL") {
    whereClause.documentType = filters.documentType;
  }

  if (filters.status && filters.status !== "ALL") {
    whereClause.status = filters.status;
  }

  if (filters.customerId) {
    whereClause.customerId = filters.customerId;
  }

  if (filters.search && filters.search.trim()) {
    const s = filters.search.trim();
    whereClause.OR = [
      { billNumber: { contains: s, mode: "insensitive" } },
      { customerName: { contains: s, mode: "insensitive" } },
      { phoneNumber: { contains: s, mode: "insensitive" } },
      { vehicleNumber: { contains: s, mode: "insensitive" } },
    ];
  }

  const [bills, totalCount] = await Promise.all([
    db.alignmentBill.findMany({
      where: whereClause,
      include: {
        items: {
          orderBy: { displayOrder: "asc" },
        },
        createdBy: {
          select: { id: true, fullName: true, username: true },
        },
      },
      orderBy: { date: "desc" },
      skip,
      take: limit,
    }),
    db.alignmentBill.count({ where: whereClause }),
  ]);

  return {
    bills: bills.map(formatAlignmentBillView),
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
}

/**
 * Retrieves a single Alignment Bill by ID with all item rows.
 */
export async function getAlignmentBillById(id: string, actor: AuthActor): Promise<AlignmentBillView> {
  const scope = getPermissionScope(actor, "alignment:view_history");
  if (scope === "NONE") {
    throw new AppError(
      "AUTHORIZATION",
      "Actor lacks permission to view alignment history",
      "You do not have permission to view alignment documents."
    );
  }

  const bill = await db.alignmentBill.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { displayOrder: "asc" },
      },
      createdBy: {
        select: { id: true, fullName: true, username: true },
      },
    },
  });

  if (!bill) {
    throw new AppError("NOT_FOUND", `Alignment bill ${id} not found`, "Document not found.");
  }

  if (scope === "OWN" && bill.createdById !== actor.id) {
    throw new AppError(
      "AUTHORIZATION",
      `Actor ${actor.id} cannot view document owned by ${bill.createdById}`,
      "You do not have permission to view this document."
    );
  }

  return formatAlignmentBillView(bill);
}

/**
 * Voids an Alignment Bill (Restricted to ADMIN_OWNER).
 */
export async function voidAlignmentBill(id: string, actor: AuthActor): Promise<AlignmentBillView> {
  requirePermission(actor, "alignment:void", "ALL");

  const existing = await db.alignmentBill.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("NOT_FOUND", `Alignment bill ${id} not found`, "Document not found.");
  }

  const updated = await db.alignmentBill.update({
    where: { id },
    data: { status: AlignmentBillStatus.VOIDED },
    include: {
      items: {
        orderBy: { displayOrder: "asc" },
      },
      createdBy: {
        select: { id: true, fullName: true, username: true },
      },
    },
  });

  await db.auditLog.create({
    data: {
      actorId: actor.id,
      entityName: "AlignmentBill",
      entityId: id,
      action: "ALIGNMENT_BILL_VOIDED",
    },
  });

  return formatAlignmentBillView(updated);
}

/**
 * Permanently deletes one or more Alignment Bills/Estimates (Restricted to ADMIN_OWNER).
 * - Cascade removes associated AlignmentBillItem records.
 * - Customer, Product, Sale, Inventory, and other modules remain untouched.
 * - Records an audit log for each deleted document.
 */
export async function deleteAlignmentBills(
  ids: string[],
  actor: AuthActor
): Promise<{ count: number; deletedIds: string[] }> {
  if (actor.role !== "ADMIN_OWNER") {
    throw new AppError(
      "AUTHORIZATION",
      `Actor ${actor.id} with role ${actor.role} cannot delete alignment documents`,
      "Only administrators can permanently delete alignment documents."
    );
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    throw new AppError(
      "VALIDATION",
      "No alignment bill IDs provided for deletion",
      "Please select at least one alignment document to delete."
    );
  }

  const cleanIds = Array.from(new Set(ids.map((id) => String(id).trim()).filter(Boolean)));
  if (cleanIds.length === 0) {
    throw new AppError(
      "VALIDATION",
      "Invalid alignment bill IDs provided",
      "Please select valid alignment documents to delete."
    );
  }

  const targetBills = await db.alignmentBill.findMany({
    where: { id: { in: cleanIds } },
    select: {
      id: true,
      billNumber: true,
      documentType: true,
      customerName: true,
      totalAmount: true,
    },
  });

  if (targetBills.length === 0) {
    throw new AppError(
      "NOT_FOUND",
      "No matching alignment bills found for deletion",
      "The selected alignment documents could not be found."
    );
  }

  const matchedIds = targetBills.map((b) => b.id);

  return await db.$transaction(async (tx) => {
    // 1. Delete AlignmentBill records (AlignmentBillItem will cascade delete)
    const deleteResult = await tx.alignmentBill.deleteMany({
      where: { id: { in: matchedIds } },
    });

    // 2. Create AuditLog records for each deleted bill
    for (const bill of targetBills) {
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          entityName: "AlignmentBill",
          entityId: bill.id,
          action: "ALIGNMENT_BILL_DELETED",
          oldState: {
            billNumber: bill.billNumber,
            documentType: bill.documentType,
            customerName: bill.customerName,
            totalAmount: bill.totalAmount.toString(),
          },
        },
      });
    }

    return {
      count: deleteResult.count,
      deletedIds: matchedIds,
    };
  });
}

/**
 * Generates exact printable PDF matching the physical reference bill.
 */
export async function generateAlignmentPdf(id: string, actor: AuthActor): Promise<Uint8Array> {
  const [bill, shop] = await Promise.all([
    getAlignmentBillById(id, actor),
    getShopSettings(actor),
  ]);

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = 12;

  const shopTitle = shop.name || "Preethi Tyres";
  const addressLine = shop.address || "OPP DIWAKER BUS DEPOT, NEAR RAJAHAMSA GUEST HOUSE.";
  const phoneNumbers = shop.phoneNumber || "99630 00932, 99898 12444";

  // 1. Header (Exact Physical Reference Match)
  // Title: Large, centered, italic-leaning
  doc.setFont("times", "bolditalic");
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42);
  doc.text(shopTitle, pageWidth / 2, cursorY + 4, { align: "center" });

  // Underline for title
  const titleWidth = doc.getTextWidth(shopTitle);
  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(0.4);
  doc.line(pageWidth / 2 - titleWidth / 2, cursorY + 5.5, pageWidth / 2 + titleWidth / 2, cursorY + 5.5);
  cursorY += 8;

  // Solid black horizontal bar with white bold text
  doc.setFillColor(0, 0, 0);
  doc.rect(margin, cursorY, contentWidth, 6.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text("For : WHEELS BALANCING & ALIGNMENT - CENTRE", pageWidth / 2, cursorY + 4.5, { align: "center" });
  cursorY += 9.5;

  // Address line
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(addressLine.toUpperCase(), pageWidth / 2, cursorY, { align: "center" });
  cursorY += 4.2;

  // Location & Mobile contact line with Mob emphasis
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const locationText = "ANANTHAPURAMU - 515001.  ";
  const mobText = `Mob : ${phoneNumbers}`;
  const fullContactWidth = doc.getTextWidth(locationText) + doc.getTextWidth(mobText);
  const contactStartX = pageWidth / 2 - fullContactWidth / 2;

  doc.text(locationText, contactStartX, cursorY);
  doc.setFont("helvetica", "bold");
  doc.text(mobText, contactStartX + doc.getTextWidth(locationText), cursorY);
  cursorY += 4;

  // Header Divider
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.5);
  doc.line(margin, cursorY, margin + contentWidth, cursorY);
  cursorY += 1;

  // 2. Bill Meta Information Box
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);

  // Row 1: Bill No. | ESTIMATE / BILL | Date
  doc.setFont("helvetica", "bold");
  doc.text(`Bill No: ${bill.billNumber}`, margin + 2, cursorY + 4);

  const docTypeLabel = bill.documentType === "ESTIMATE" ? "ESTIMATE" : "BILL";
  doc.setFontSize(10);
  doc.text(`[ ${docTypeLabel} ]`, pageWidth / 2, cursorY + 4, { align: "center" });

  doc.setFontSize(8.5);
  const formattedDate = new Date(bill.date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  doc.text(`Date: ${formattedDate}`, margin + contentWidth - 2, cursorY + 4, { align: "right" });
  cursorY += 6.5;

  // Row 2: M/s (Customer Name)
  doc.setFont("helvetica", "bold");
  doc.text("M/s:", margin + 2, cursorY + 4);
  doc.setFont("helvetica", "normal");
  doc.text(bill.customerName + (bill.phoneNumber ? ` (Ph: ${bill.phoneNumber})` : ""), margin + 14, cursorY + 4);
  cursorY += 6;

  // Row 3: Veh No. | KM.
  doc.setFont("helvetica", "bold");
  doc.text("Veh No:", margin + 2, cursorY + 4);
  doc.setFont("helvetica", "normal");
  doc.text(bill.vehicleNumber, margin + 20, cursorY + 4);

  doc.setFont("helvetica", "bold");
  doc.text("KM:", margin + contentWidth - 40, cursorY + 4);
  doc.setFont("helvetica", "normal");
  doc.text(bill.kilometers !== null ? bill.kilometers.toLocaleString("en-IN") : "—", margin + contentWidth - 2, cursorY + 4, { align: "right" });
  cursorY += 7;

  // Divider above table
  doc.line(margin, cursorY, margin + contentWidth, cursorY);

  // 3. Service Table (Particulars | Qty. | Rates | Amount)
  const tableHeaderY = cursorY;
  const colSNo = margin + 7;
  const colPart = margin + 16;
  const colQty = margin + 108;
  const colRate = margin + 144;
  const colAmt = margin + contentWidth - 4;

  doc.setFillColor(245, 245, 245);
  doc.rect(margin, tableHeaderY, contentWidth, 7, "F");
  doc.rect(margin, tableHeaderY, contentWidth, 7, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);

  doc.text("S.No.", colSNo, tableHeaderY + 4.8, { align: "center" });
  doc.text("Particulars", colPart, tableHeaderY + 4.8);
  doc.text("Qty.", colQty, tableHeaderY + 4.8, { align: "center" });
  doc.text("Rates (Rs.)", colRate, tableHeaderY + 4.8, { align: "right" });
  doc.text("Amount (Rs.)", colAmt, tableHeaderY + 4.8, { align: "right" });

  cursorY += 7;

  doc.setFontSize(8.5);
  bill.items.forEach((item, idx) => {
    const rowY = cursorY;
    const isEven = idx % 2 === 1;

    if (isEven) {
      doc.setFillColor(252, 252, 252);
      doc.rect(margin, rowY, contentWidth, 7.5, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);

    // S.No
    doc.text(item.displayOrder.toString(), colSNo, rowY + 5, { align: "center" });

    // Particulars
    doc.text(item.particular, colPart, rowY + 5);

    // Qty, Rates, Amount
    const rateNum = parseFloat(item.rate);
    const qtyNum = parseFloat(item.quantity);
    const amtNum = parseFloat(item.amount);

    if (rateNum > 0 && qtyNum > 0) {
      doc.text(qtyNum.toString(), colQty, rowY + 5, { align: "center" });
      doc.text(rateNum.toLocaleString("en-IN", { minimumFractionDigits: 2 }), colRate, rowY + 5, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.text(amtNum.toLocaleString("en-IN", { minimumFractionDigits: 2 }), colAmt, rowY + 5, { align: "right" });
      doc.setFont("helvetica", "normal");
    } else {
      doc.setTextColor(180, 180, 180);
      doc.text("-", colQty, rowY + 5, { align: "center" });
      doc.text("-", colRate, rowY + 5, { align: "right" });
      doc.text("-", colAmt, rowY + 5, { align: "right" });
    }

    // Row Bottom Border
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(margin, rowY + 7.5, margin + contentWidth, rowY + 7.5);

    cursorY += 7.5;
  });

  // Table Outer Box & Column Grid Lines
  const tableContentEndY = cursorY;
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.4);
  doc.rect(margin, tableHeaderY, contentWidth, tableContentEndY - tableHeaderY, "S");

  // Vertical Separators
  doc.line(margin + 14, tableHeaderY, margin + 14, tableContentEndY);
  doc.line(margin + 98, tableHeaderY, margin + 98, tableContentEndY);
  doc.line(margin + 118, tableHeaderY, margin + 118, tableContentEndY);
  doc.line(margin + 148, tableHeaderY, margin + 148, tableContentEndY);

  // 4. Total Row
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, cursorY, contentWidth, 8, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text("TOTAL Rs.", margin + 148 - 4, cursorY + 5.5, { align: "right" });

  const totalFormatted = Number(bill.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 });
  doc.text(totalFormatted, colAmt, cursorY + 5.5, { align: "right" });
  cursorY += 12;

  // 5. Authentic Physical Reference Footer (ELOGI + For Preethi Tyres / Signature)
  const footerBoxHeight = 24;
  const footerBoxY = cursorY;

  // Left Box: ELOGI / Manufacturing Wheel Alignment Note (WITHOUT maintenance bullets)
  const leftBoxWidth = contentWidth * 0.50;
  doc.rect(margin, footerBoxY, leftBoxWidth, footerBoxHeight, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("ELOGI", margin + 4, footerBoxY + 8);
  doc.setFontSize(8.5);
  doc.text("Manufacturing Wheel Alignment", margin + 4, footerBoxY + 16);

  // Right Box: For Preethi Tyres / Signature
  const rightBoxX = margin + leftBoxWidth + 4;
  const rightBoxWidth = contentWidth - leftBoxWidth - 4;
  doc.rect(rightBoxX, footerBoxY, rightBoxWidth, footerBoxHeight, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`For ${shopTitle}`, rightBoxX + rightBoxWidth / 2, footerBoxY + 7, { align: "center" });

  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);
  doc.line(rightBoxX + 10, footerBoxY + 17, rightBoxX + rightBoxWidth - 10, footerBoxY + 17);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(40, 40, 40);
  doc.text("Signature", rightBoxX + rightBoxWidth / 2, footerBoxY + 21, { align: "center" });

  return new Uint8Array(doc.output("arraybuffer"));
}

type AlignmentBillWithRelations = Prisma.AlignmentBillGetPayload<{
  include: {
    items: true;
    createdBy: {
      select: { id: true; fullName: true; username: true };
    };
  };
}>;

function formatAlignmentBillView(bill: AlignmentBillWithRelations): AlignmentBillView {
  return {
    id: bill.id,
    billNumber: bill.billNumber,
    documentType: bill.documentType,
    date: bill.date instanceof Date ? bill.date.toISOString() : String(bill.date),
    customerId: bill.customerId,
    customerName: bill.customerName,
    phoneNumber: bill.phoneNumber,
    vehicleNumber: bill.vehicleNumber,
    kilometers: bill.kilometers,
    totalAmount: bill.totalAmount.toString(),
    status: bill.status,
    notes: bill.notes,
    createdById: bill.createdById,
    createdBy: bill.createdBy
      ? {
          id: bill.createdBy.id,
          fullName: bill.createdBy.fullName,
          username: bill.createdBy.username,
        }
      : null,
    createdAt: bill.createdAt instanceof Date ? bill.createdAt.toISOString() : String(bill.createdAt),
    updatedAt: bill.updatedAt instanceof Date ? bill.updatedAt.toISOString() : String(bill.updatedAt),
    items: (bill.items || []).map((item) => ({
      id: item.id,
      displayOrder: item.displayOrder,
      particular: item.particular,
      rate: item.rate.toString(),
      quantity: item.quantity.toString(),
      amount: item.amount.toString(),
    })),
  };
}
