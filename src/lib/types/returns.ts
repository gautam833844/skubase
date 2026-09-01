// =============================================================================
// Skubase — Sales Return & Refund Types
// =============================================================================

export interface CreateReturnItemInput {
  saleItemId: string;
  quantity: number;
  condition?: "SELLABLE" | "DAMAGED" | "NON_SELLABLE";
  reason?: string | null;
}

export interface CreateReturnInput {
  saleId: string;
  items: CreateReturnItemInput[];
  reason?: string | null;
  notes?: string | null;
  refundStatus?: "PENDING" | "REFUNDED" | "CREDITED" | "NO_REFUND";
  refundAmount?: number | string | null;
}

export interface SaleReturnItemView {
  id: string;
  saleItemId: string;
  productId: string;
  brand: string;
  size: string;
  pattern: string | null;
  quantity: number;
  unitPrice: string | number;
  totalPrice: string | number;
  condition: string;
  reason: string | null;
}

export interface SaleReturnView {
  id: string;
  returnNumber: string;
  saleId: string;
  saleInvoiceNumber: string;
  customerId: string | null;
  customerName: string | null;
  returnDate: string;
  totalAmount: string | number;
  refundAmount: string | number;
  status: string;
  refundStatus: string;
  reason: string | null;
  notes: string | null;
  createdBy: {
    fullName: string;
    username: string | null;
  } | null;
  items: SaleReturnItemView[];
  createdAt: string;
}

export interface SaleReturnableItemView {
  saleItemId: string;
  productId: string;
  brand: string;
  size: string;
  pattern: string | null;
  soldQuantity: number;
  alreadyReturnedQuantity: number;
  returnableQuantity: number;
  unitPrice: string | number;
}
