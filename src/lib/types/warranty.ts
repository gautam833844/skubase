// =============================================================================
// Skubase — Warranty Management Types (Step 10)
// =============================================================================

import type { ClaimStatus, ClaimType, ClaimResolutionType } from "@prisma/client";

/**
 * Input for creating a new warranty claim against a completed sale item.
 */
export interface CreateWarrantyClaimInput {
  saleId: string;
  saleItemId: string;
  issueDescription: string;
  dotSerialCode?: string;
  inspectionNotes?: string;
  externalClaimReference?: string;
  supplierId?: string;
  quantity?: number;
}

/**
 * Input for updating the status/decision of a warranty claim.
 */
export interface UpdateWarrantyClaimStatusInput {
  status: ClaimStatus;
  decisionNotes?: string;
  inspectionNotes?: string;
  externalClaimReference?: string;
  supplierId?: string;
}

/**
 * Input for issuing a replacement tyre from shop inventory.
 */
export interface IssueWarrantyReplacementInput {
  replacementProductId?: string;
  replacementQuantity?: number;
  notes?: string;
}

/**
 * Input for resolving a warranty claim without stock deduction (credit/repair/no-action).
 */
export interface ResolveWarrantyClaimInput {
  resolutionType: ClaimResolutionType;
  resolutionNotes?: string;
}

/**
 * Filter parameters for listing warranty claims.
 */
export interface WarrantyFilter {
  status?: ClaimStatus;
  search?: string;
  customerId?: string;
  saleId?: string;
  page?: number;
  limit?: number;
}

/**
 * Detailed view of a warranty claim.
 */
export interface WarrantyClaimView {
  id: string;
  claimNumber: string;
  saleId: string;
  saleInvoiceNumber: string;
  saleDate: string;
  saleItemId: string;
  productId: string;
  productBrand: string;
  productSize: string;
  productPattern: string | null;
  productSoldPrice: string;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerVehicle: string | null;
  supplierId: string | null;
  supplierName: string | null;
  claimType: ClaimType;
  status: ClaimStatus;
  quantity: number;
  issueDescription: string;
  dotSerialCode: string | null;
  inspectionNotes: string | null;
  externalClaimReference: string | null;
  submittedAt: string | null;
  decisionAt: string | null;
  decisionNotes: string | null;
  resolutionType: ClaimResolutionType | null;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  replacementProductId: string | null;
  replacementProductBrand: string | null;
  replacementProductSize: string | null;
  replacementProductPattern: string | null;
  replacementQuantity: number;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Summary view for warranty claim cards / tables.
 */
export interface WarrantyClaimSummaryView {
  id: string;
  claimNumber: string;
  saleInvoiceNumber: string;
  saleDate: string;
  customerName: string | null;
  productBrand: string;
  productSize: string;
  status: ClaimStatus;
  issueDescription: string;
  resolutionType: ClaimResolutionType | null;
  replacementQuantity: number;
  createdAt: string;
}

/**
 * Summary view of a sale item's warranty claim eligibility.
 */
export interface SaleItemWarrantyEligibilityView {
  saleItemId: string;
  productId: string;
  brand: string;
  size: string;
  pattern: string | null;
  unitPrice: string;
  soldQuantity: number;
  hasActiveClaim: boolean;
  activeClaimNumber: string | null;
  activeClaimStatus: ClaimStatus | null;
}

/**
 * High-level KPI metrics for warranty management dashboard.
 */
export interface WarrantyMetricsView {
  totalClaims: number;
  submittedClaims: number;
  underReviewClaims: number;
  approvedClaims: number;
  resolvedClaims: number;
  rejectedClaims: number;
}
