// =============================================================================
// Skubase — Warranty Management Service (Step 10)
// =============================================================================

import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requirePermission, requireScope, type AuthActor } from "@/lib/auth/permissions";
import type { ClaimStatus, ClaimType, ClaimResolutionType } from "@prisma/client";
import type {
  CreateWarrantyClaimInput,
  UpdateWarrantyClaimStatusInput,
  IssueWarrantyReplacementInput,
  ResolveWarrantyClaimInput,
  WarrantyFilter,
  WarrantyClaimView,
  WarrantyClaimSummaryView,
  SaleItemWarrantyEligibilityView,
  WarrantyMetricsView,
} from "@/lib/types/warranty";

// -----------------------------------------------------------------------------
// Helper: Sequential Unique Claim Number Generator
// Format: WAR-1001, WAR-1002, etc.
// -----------------------------------------------------------------------------

async function generateNextClaimNumber(tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]): Promise<string> {
  const count = await tx.warrantyClaim.count();
  let candidateNum = 1001 + count;
  let candidate = `WAR-${candidateNum}`;

  while (await tx.warrantyClaim.findUnique({ where: { claimNumber: candidate } })) {
    candidateNum++;
    candidate = `WAR-${candidateNum}`;
  }

  return candidate;
}

// -----------------------------------------------------------------------------
// 1. Get Sale Warranty Eligibility & Existing Claims
// -----------------------------------------------------------------------------

export async function getSaleWarrantyEligibility(
  saleId: string,
  actor: AuthActor
): Promise<{
  saleId: string;
  invoiceNumber: string;
  saleDate: string;
  customerName: string | null;
  items: SaleItemWarrantyEligibilityView[];
  claims: WarrantyClaimSummaryView[];
}> {
  const scope = requireScope(actor, "warranties:view");

  const sale = await db.sale.findUnique({
    where: { id: saleId },
    include: {
      customer: true,
      items: {
        include: {
          product: true,
          warrantyClaims: true,
        },
      },
      warrantyClaims: {
        include: {
          product: true,
          customer: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!sale) {
    throw new AppError("NOT_FOUND", "Sale not found");
  }

  if (sale.status !== "COMPLETED") {
    throw new AppError("VALIDATION", "Only COMPLETED sales are eligible for warranty claims");
  }

  if (scope === "OWN" && sale.createdById !== actor.id) {
    throw new AppError("AUTHORIZATION", "You cannot view warranty details for this sale");
  }

  const items: SaleItemWarrantyEligibilityView[] = sale.items.map((item) => {
    // Find active claim if any (SUBMITTED, UNDER_REVIEW, APPROVED)
    const activeClaim = item.warrantyClaims.find(
      (c) => c.status === "SUBMITTED" || c.status === "UNDER_REVIEW" || c.status === "APPROVED"
    );

    return {
      saleItemId: item.id,
      productId: item.productId,
      brand: item.product.brand,
      size: item.product.size,
      pattern: item.product.pattern,
      unitPrice: item.unitPrice.toString(),
      soldQuantity: item.quantity,
      hasActiveClaim: Boolean(activeClaim),
      activeClaimNumber: activeClaim ? activeClaim.claimNumber : null,
      activeClaimStatus: activeClaim ? activeClaim.status : null,
    };
  });

  const claims: WarrantyClaimSummaryView[] = sale.warrantyClaims.map((c) => ({
    id: c.id,
    claimNumber: c.claimNumber,
    saleInvoiceNumber: sale.invoiceNumber,
    saleDate: sale.saleDate.toISOString(),
    customerName: sale.customer ? sale.customer.name : null,
    productBrand: c.product.brand,
    productSize: c.product.size,
    status: c.status,
    issueDescription: c.issueDescription,
    resolutionType: c.resolutionType,
    replacementQuantity: c.replacementQuantity,
    createdAt: c.createdAt.toISOString(),
  }));

  return {
    saleId: sale.id,
    invoiceNumber: sale.invoiceNumber,
    saleDate: sale.saleDate.toISOString(),
    customerName: sale.customer ? sale.customer.name : null,
    items,
    claims,
  };
}

// -----------------------------------------------------------------------------
// 2. Create Warranty Claim
// -----------------------------------------------------------------------------

export async function createWarrantyClaim(
  input: CreateWarrantyClaimInput,
  actor: AuthActor
): Promise<WarrantyClaimView> {
  requirePermission(actor, "warranties:create");

  if (!input.saleId || !input.saleItemId) {
    throw new AppError("VALIDATION", "Sale ID and Sale Item ID are required");
  }

  const issueDesc = input.issueDescription?.trim();
  if (!issueDesc || issueDesc.length < 3) {
    throw new AppError("VALIDATION", "Issue description is required (min 3 characters)");
  }
  if (issueDesc.length > 1000) {
    throw new AppError("VALIDATION", "Issue description exceeds maximum length of 1000 characters");
  }

  const result = await db.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({
      where: { id: input.saleId },
      include: {
        customer: true,
        items: {
          where: { id: input.saleItemId },
          include: {
            product: true,
            warrantyClaims: true,
          },
        },
      },
    });

    if (!sale) {
      throw new AppError("NOT_FOUND", "Sale not found");
    }

    if (sale.status !== "COMPLETED") {
      throw new AppError("VALIDATION", "Warranty claims can only be filed against COMPLETED sales");
    }

    const saleItem = sale.items[0];
    if (!saleItem) {
      throw new AppError("NOT_FOUND", "Sale item does not belong to this sale");
    }

    // Check for existing active claim on this sale item
    const existingActiveClaim = saleItem.warrantyClaims.find(
      (c) => c.status === "SUBMITTED" || c.status === "UNDER_REVIEW" || c.status === "APPROVED"
    );
    if (existingActiveClaim) {
      throw new AppError(
        "VALIDATION",
        `An active warranty claim (${existingActiveClaim.claimNumber}) is already in progress for this item`
      );
    }

    const claimQty = input.quantity ?? 1;
    if (claimQty <= 0 || claimQty > saleItem.quantity) {
      throw new AppError(
        "VALIDATION",
        `Claim quantity must be between 1 and original sold quantity (${saleItem.quantity})`
      );
    }

    const claimNumber = await generateNextClaimNumber(tx);

    const claim = await tx.warrantyClaim.create({
      data: {
        claimNumber,
        saleId: sale.id,
        saleItemId: saleItem.id,
        productId: saleItem.productId,
        customerId: sale.customerId,
        supplierId: input.supplierId || null,
        claimType: "WARRANTY_DEFECT",
        status: "SUBMITTED",
        quantity: claimQty,
        issueDescription: issueDesc,
        dotSerialCode: input.dotSerialCode?.trim() || null,
        inspectionNotes: input.inspectionNotes?.trim() || null,
        externalClaimReference: input.externalClaimReference?.trim() || null,
        createdById: actor.id,
      },
      include: {
        sale: true,
        product: true,
        customer: true,
        supplier: true,
        createdBy: true,
      },
    });

    // Transactional Audit Log
    await tx.auditLog.create({
      data: {
        action: "WARRANTY_CLAIM_CREATED",
        entityName: "WarrantyClaim",
        entityId: claim.id,
        actorId: actor.id,
        newState: {
          claimNumber: claim.claimNumber,
          saleInvoiceNumber: sale.invoiceNumber,
          product: `${saleItem.product.brand} ${saleItem.product.size}`,
          status: "SUBMITTED",
          quantity: claimQty,
        },
      },
    });

    return claim;
  });

  return formatWarrantyClaimView(result);
}

// -----------------------------------------------------------------------------
// 3. List Warranty Claims (With Search, Filters, Metrics)
// -----------------------------------------------------------------------------

export async function listWarrantyClaims(
  filter: WarrantyFilter = {},
  actor: AuthActor
): Promise<{
  claims: WarrantyClaimSummaryView[];
  metrics: WarrantyMetricsView;
  pagination: { page: number; limit: number; totalCount: number; totalPages: number };
}> {
  const scope = requireScope(actor, "warranties:view");

  const page = Math.max(1, filter.page ?? 1);
  const limit = Math.min(100, Math.max(1, filter.limit ?? 25));
  const skip = (page - 1) * limit;

  // Base where clause
  const where: Record<string, unknown> = {};

  if (scope === "OWN") {
    where.OR = [
      { createdById: actor.id },
      { sale: { createdById: actor.id } },
    ];
  }

  if (filter.status) {
    where.status = filter.status;
  }

  if (filter.saleId) {
    where.saleId = filter.saleId;
  }

  if (filter.customerId) {
    where.customerId = filter.customerId;
  }

  if (filter.search?.trim()) {
    const q = filter.search.trim();
    const searchConditions = [
      { claimNumber: { contains: q, mode: "insensitive" } },
      { sale: { invoiceNumber: { contains: q, mode: "insensitive" } } },
      { customer: { name: { contains: q, mode: "insensitive" } } },
      { customer: { phoneNumber: { contains: q, mode: "insensitive" } } },
      { product: { brand: { contains: q, mode: "insensitive" } } },
      { product: { size: { contains: q, mode: "insensitive" } } },
      { externalClaimReference: { contains: q, mode: "insensitive" } },
    ];

    if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: searchConditions }];
      delete where.OR;
    } else {
      where.OR = searchConditions;
    }
  }

  const [claims, totalCount, statusCounts] = await Promise.all([
    db.warrantyClaim.findMany({
      where,
      include: {
        sale: true,
        product: true,
        customer: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.warrantyClaim.count({ where }),
    db.warrantyClaim.groupBy({
      by: ["status"],
      _count: { id: true },
      where: scope === "OWN" ? { OR: [{ createdById: actor.id }, { sale: { createdById: actor.id } }] } : undefined,
    }),
  ]);

  const metrics: WarrantyMetricsView = {
    totalClaims: 0,
    submittedClaims: 0,
    underReviewClaims: 0,
    approvedClaims: 0,
    resolvedClaims: 0,
    rejectedClaims: 0,
  };

  for (const item of statusCounts) {
    const count = item._count.id;
    metrics.totalClaims += count;
    if (item.status === "SUBMITTED") metrics.submittedClaims = count;
    else if (item.status === "UNDER_REVIEW") metrics.underReviewClaims = count;
    else if (item.status === "APPROVED") metrics.approvedClaims = count;
    else if (item.status === "RESOLVED") metrics.resolvedClaims = count;
    else if (item.status === "REJECTED") metrics.rejectedClaims = count;
  }

  const claimSummaries: WarrantyClaimSummaryView[] = claims.map((c) => ({
    id: c.id,
    claimNumber: c.claimNumber,
    saleInvoiceNumber: c.sale.invoiceNumber,
    saleDate: c.sale.saleDate.toISOString(),
    customerName: c.customer ? c.customer.name : null,
    productBrand: c.product.brand,
    productSize: c.product.size,
    status: c.status,
    issueDescription: c.issueDescription,
    resolutionType: c.resolutionType,
    replacementQuantity: c.replacementQuantity,
    createdAt: c.createdAt.toISOString(),
  }));

  return {
    claims: claimSummaries,
    metrics,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
    },
  };
}

// -----------------------------------------------------------------------------
// 4. Get Warranty Claim by ID
// -----------------------------------------------------------------------------

export async function getWarrantyClaimById(
  claimId: string,
  actor: AuthActor
): Promise<WarrantyClaimView> {
  const scope = requireScope(actor, "warranties:view");

  const claim = await db.warrantyClaim.findUnique({
    where: { id: claimId },
    include: {
      sale: {
        include: {
          items: true,
        },
      },
      saleItem: true,
      product: true,
      replacementProduct: true,
      customer: true,
      supplier: true,
      createdBy: true,
    },
  });

  if (!claim) {
    throw new AppError("NOT_FOUND", "Warranty claim not found");
  }

  if (scope === "OWN" && claim.createdById !== actor.id && claim.sale.createdById !== actor.id) {
    throw new AppError("AUTHORIZATION", "You do not have access to view this warranty claim");
  }

  return formatWarrantyClaimView(claim);
}

// -----------------------------------------------------------------------------
// 5. Update Warranty Claim Status / Decision
// -----------------------------------------------------------------------------

export async function updateWarrantyClaimStatus(
  claimId: string,
  input: UpdateWarrantyClaimStatusInput,
  actor: AuthActor
): Promise<WarrantyClaimView> {
  requirePermission(actor, "warranties:manage");

  const claim = await db.warrantyClaim.findUnique({
    where: { id: claimId },
    include: {
      sale: true,
      product: true,
    },
  });

  if (!claim) {
    throw new AppError("NOT_FOUND", "Warranty claim not found");
  }

  // Enforce server-side explicit state machine
  const currentStatus = claim.status;
  const nextStatus = input.status;

  const allowedTransitions: Record<ClaimStatus, ClaimStatus[]> = {
    SUBMITTED: ["UNDER_REVIEW", "CANCELLED"],
    UNDER_REVIEW: ["APPROVED", "REJECTED", "CANCELLED"],
    APPROVED: ["RESOLVED", "CANCELLED"],
    REJECTED: [], // Terminal
    RESOLVED: [], // Terminal
    CANCELLED: [], // Terminal
  };

  if (!allowedTransitions[currentStatus]?.includes(nextStatus)) {
    throw new AppError(
      "VALIDATION",
      `Invalid status transition from ${currentStatus} to ${nextStatus}`
    );
  }

  const updateData: Record<string, unknown> = {
    status: nextStatus,
  };

  let auditAction = `WARRANTY_CLAIM_${nextStatus}`;

  if (nextStatus === "UNDER_REVIEW") {
    updateData.submittedAt = new Date();
    if (input.externalClaimReference) updateData.externalClaimReference = input.externalClaimReference.trim();
    if (input.inspectionNotes) updateData.inspectionNotes = input.inspectionNotes.trim();
    if (input.supplierId) updateData.supplierId = input.supplierId;
    auditAction = "WARRANTY_CLAIM_SUBMITTED";
  } else if (nextStatus === "APPROVED" || nextStatus === "REJECTED") {
    updateData.decisionAt = new Date();
    if (input.decisionNotes) updateData.decisionNotes = input.decisionNotes.trim();
    auditAction = nextStatus === "APPROVED" ? "WARRANTY_CLAIM_APPROVED" : "WARRANTY_CLAIM_REJECTED";
  }

  const updatedClaim = await db.$transaction(async (tx) => {
    const res = await tx.warrantyClaim.update({
      where: { id: claimId },
      data: updateData,
      include: {
        sale: true,
        saleItem: true,
        product: true,
        replacementProduct: true,
        customer: true,
        supplier: true,
        createdBy: true,
      },
    });

    await tx.auditLog.create({
      data: {
        action: auditAction,
        entityName: "WarrantyClaim",
        entityId: claimId,
        actorId: actor.id,
        oldState: { status: currentStatus },
        newState: { status: nextStatus, decisionNotes: input.decisionNotes || null },
      },
    });

    return res;
  });

  return formatWarrantyClaimView(updatedClaim);
}

// -----------------------------------------------------------------------------
// 6. Issue Warranty Replacement Tyre (Atomic Inventory Deduction)
// -----------------------------------------------------------------------------

export async function issueWarrantyReplacement(
  claimId: string,
  input: IssueWarrantyReplacementInput = {},
  actor: AuthActor
): Promise<WarrantyClaimView> {
  requirePermission(actor, "warranties:manage");

  const result = await db.$transaction(async (tx) => {
    const claim = await tx.warrantyClaim.findUnique({
      where: { id: claimId },
      include: {
        sale: true,
        saleItem: true,
        product: true,
      },
    });

    if (!claim) {
      throw new AppError("NOT_FOUND", "Warranty claim not found");
    }

    if (claim.status !== "APPROVED") {
      throw new AppError(
        "VALIDATION",
        `Replacement can only be issued for APPROVED claims (current: ${claim.status})`
      );
    }

    if (claim.replacementQuantity > 0 || claim.resolutionType === "REPLACEMENT_FROM_STOCK") {
      throw new AppError("VALIDATION", "A replacement tyre has already been issued for this claim");
    }

    const replacementProductId = input.replacementProductId || claim.productId;
    const replacementQuantity = input.replacementQuantity ?? claim.quantity;

    if (replacementQuantity <= 0) {
      throw new AppError("VALIDATION", "Replacement quantity must be a positive integer");
    }

    // Verify stock availability
    const replacementProduct = await tx.product.findUnique({
      where: { id: replacementProductId },
    });

    if (!replacementProduct) {
      throw new AppError("NOT_FOUND", "Replacement product not found in inventory");
    }

    if (replacementProduct.quantityOnHand < replacementQuantity) {
      throw new AppError(
        "VALIDATION",
        `Insufficient inventory for replacement. Available: ${replacementProduct.quantityOnHand}, Requested: ${replacementQuantity}`
      );
    }

    // Atomic inventory deduction
    const updatedProduct = await tx.product.update({
      where: { id: replacementProductId },
      data: {
        quantityOnHand: { decrement: replacementQuantity },
      },
    });

    // Create immutable WARRANTY_OUT_REPLACEMENT inventory ledger entry
    await tx.inventoryMovement.create({
      data: {
        productId: replacementProductId,
        movementType: "WARRANTY_OUT_REPLACEMENT",
        quantityDelta: -replacementQuantity,
        balanceAfter: updatedProduct.quantityOnHand,
        referenceType: "WarrantyClaim",
        referenceId: claim.id,
        reason: `Warranty replacement for claim ${claim.claimNumber}`,
        actorId: actor.id,
      },
    });

    // Update claim status to RESOLVED with replacement details
    const updatedClaim = await tx.warrantyClaim.update({
      where: { id: claim.id },
      data: {
        status: "RESOLVED",
        resolutionType: "REPLACEMENT_FROM_STOCK",
        resolutionNotes: input.notes?.trim() || "Replacement tyre issued from store inventory",
        resolvedAt: new Date(),
        replacementProductId,
        replacementQuantity,
      },
      include: {
        sale: true,
        saleItem: true,
        product: true,
        replacementProduct: true,
        customer: true,
        supplier: true,
        createdBy: true,
      },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        action: "WARRANTY_REPLACEMENT_ISSUED",
        entityName: "WarrantyClaim",
        entityId: claim.id,
        actorId: actor.id,
        newState: {
          claimNumber: claim.claimNumber,
          replacementProduct: `${replacementProduct.brand} ${replacementProduct.size}`,
          replacementQuantity,
          remainingStock: updatedProduct.quantityOnHand,
          status: "RESOLVED",
        },
      },
    });

    return updatedClaim;
  });

  return formatWarrantyClaimView(result);
}

// -----------------------------------------------------------------------------
// 7. Resolve Warranty Claim (Non-Stock Resolution: Credit/Repair/No-Action)
// -----------------------------------------------------------------------------

export async function resolveWarrantyClaim(
  claimId: string,
  input: ResolveWarrantyClaimInput,
  actor: AuthActor
): Promise<WarrantyClaimView> {
  requirePermission(actor, "warranties:manage");

  if (!input.resolutionType) {
    throw new AppError("VALIDATION", "Resolution type is required");
  }

  const claim = await db.warrantyClaim.findUnique({
    where: { id: claimId },
  });

  if (!claim) {
    throw new AppError("NOT_FOUND", "Warranty claim not found");
  }

  if (claim.status === "RESOLVED" || claim.status === "CANCELLED") {
    throw new AppError("VALIDATION", `Cannot resolve claim that is already ${claim.status}`);
  }

  const updatedClaim = await db.$transaction(async (tx) => {
    const res = await tx.warrantyClaim.update({
      where: { id: claimId },
      data: {
        status: "RESOLVED",
        resolutionType: input.resolutionType,
        resolutionNotes: input.resolutionNotes?.trim() || null,
        resolvedAt: new Date(),
      },
      include: {
        sale: true,
        saleItem: true,
        product: true,
        replacementProduct: true,
        customer: true,
        supplier: true,
        createdBy: true,
      },
    });

    await tx.auditLog.create({
      data: {
        action: "WARRANTY_CLAIM_RESOLVED",
        entityName: "WarrantyClaim",
        entityId: claimId,
        actorId: actor.id,
        newState: {
          resolutionType: input.resolutionType,
          resolutionNotes: input.resolutionNotes || null,
          status: "RESOLVED",
        },
      },
    });

    return res;
  });

  return formatWarrantyClaimView(updatedClaim);
}

// -----------------------------------------------------------------------------
// Helper: View Formatter
// -----------------------------------------------------------------------------

type DecimalLike = { toString(): string } | string | number;

function formatWarrantyClaimView(c: {
  id: string;
  claimNumber: string;
  saleId: string;
  saleItemId: string;
  productId: string;
  customerId: string | null;
  supplierId: string | null;
  claimType: ClaimType;
  status: ClaimStatus;
  quantity: number;
  issueDescription: string;
  dotSerialCode: string | null;
  inspectionNotes: string | null;
  externalClaimReference: string | null;
  submittedAt: Date | null;
  decisionAt: Date | null;
  decisionNotes: string | null;
  resolutionType: ClaimResolutionType | null;
  resolutionNotes: string | null;
  resolvedAt: Date | null;
  replacementProductId: string | null;
  replacementQuantity: number;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  sale?: { invoiceNumber: string; saleDate: Date; items?: Array<{ id: string; unitPrice: DecimalLike }> };
  saleItem?: { unitPrice: DecimalLike };
  product: { brand: string; size: string; pattern: string | null };
  replacementProduct?: { brand: string; size: string; pattern: string | null } | null;
  customer?: { name: string; phoneNumber: string | null; vehicleNumber: string | null } | null;
  supplier?: { name: string } | null;
  createdBy?: { fullName: string; username: string | null } | null;
}): WarrantyClaimView {
  // Find sold price from sale item
  let soldPrice = "0.00";
  if (c.saleItem?.unitPrice) {
    soldPrice = c.saleItem.unitPrice.toString();
  } else if (c.sale?.items) {
    const si = c.sale.items.find((i) => i.id === c.saleItemId);
    if (si) soldPrice = si.unitPrice.toString();
  }

  return {
    id: c.id,
    claimNumber: c.claimNumber,
    saleId: c.saleId,
    saleInvoiceNumber: c.sale?.invoiceNumber || "",
    saleDate: c.sale?.saleDate ? c.sale.saleDate.toISOString() : c.createdAt.toISOString(),
    saleItemId: c.saleItemId,
    productId: c.productId,
    productBrand: c.product.brand,
    productSize: c.product.size,
    productPattern: c.product.pattern,
    productSoldPrice: soldPrice,
    customerId: c.customerId,
    customerName: c.customer ? c.customer.name : null,
    customerPhone: c.customer?.phoneNumber || null,
    customerVehicle: c.customer?.vehicleNumber || null,
    supplierId: c.supplierId,
    supplierName: c.supplier ? c.supplier.name : null,
    claimType: c.claimType,
    status: c.status,
    quantity: c.quantity,
    issueDescription: c.issueDescription,
    dotSerialCode: c.dotSerialCode,
    inspectionNotes: c.inspectionNotes,
    externalClaimReference: c.externalClaimReference,
    submittedAt: c.submittedAt ? c.submittedAt.toISOString() : null,
    decisionAt: c.decisionAt ? c.decisionAt.toISOString() : null,
    decisionNotes: c.decisionNotes,
    resolutionType: c.resolutionType,
    resolutionNotes: c.resolutionNotes,
    resolvedAt: c.resolvedAt ? c.resolvedAt.toISOString() : null,
    replacementProductId: c.replacementProductId,
    replacementProductBrand: c.replacementProduct?.brand || null,
    replacementProductSize: c.replacementProduct?.size || null,
    replacementProductPattern: c.replacementProduct?.pattern || null,
    replacementQuantity: c.replacementQuantity,
    createdById: c.createdById,
    createdByName: c.createdBy ? c.createdBy.fullName : null,
    createdAt: c.createdAt ? (typeof c.createdAt === "string" ? c.createdAt : (c.createdAt as Date).toISOString()) : new Date().toISOString(),
    updatedAt: c.updatedAt ? (typeof c.updatedAt === "string" ? c.updatedAt : (c.updatedAt as Date).toISOString()) : new Date().toISOString(),
  };
}
