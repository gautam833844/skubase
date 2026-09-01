// =============================================================================
// Skubase — Inventory Types & Constants
// =============================================================================

export const CONTROLLED_ADJUSTMENT_REASONS = [
  "Physical count correction",
  "Damaged tyre",
  "Missing tyre",
  "Data correction",
  "Initial inventory count",
  "Other",
] as const;

export type AdjustmentReason = (typeof CONTROLLED_ADJUSTMENT_REASONS)[number];

export type AdjustmentType = "ADD" | "REMOVE" | "SET_ACTUAL";

export interface ProductFilters {
  search?: string;
  brand?: string;
  size?: string;
  pattern?: string;
  status?: "ACTIVE" | "INACTIVE" | "ALL";
  lowStockOnly?: boolean;
  sortBy?: "brand" | "size" | "quantityOnHand" | "unitPrice";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface CreateProductInput {
  brand: string;
  size: string;
  pattern?: string;
  unitPrice: number | string;
  averageCostPrice?: number | string;
  minStockAlert?: number;
  notes?: string;
  initialQuantity?: number;
  initialReason?: string;
}

export interface UpdateProductInput {
  brand?: string;
  size?: string;
  pattern?: string;
  unitPrice?: number | string;
  minStockAlert?: number;
  notes?: string;
}

export interface AdjustStockInput {
  productId: string;
  adjustmentType: AdjustmentType;
  quantity?: number;
  actualCount?: number;
  reason: string;
  notes?: string;
}

export interface MovementFilters {
  productId?: string;
  actorId?: string;
  page?: number;
  limit?: number;
}
