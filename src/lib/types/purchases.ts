// =============================================================================
// Skubase — Supplier & Purchase Types & Constants
// =============================================================================

import type { PurchaseOrderStatus } from "@prisma/client";

export interface SupplierFilters {
  search?: string;
  status?: "ACTIVE" | "INACTIVE" | "ALL";
  page?: number;
  limit?: number;
}

export interface CreateSupplierInput {
  name: string;
  contactPerson?: string;
  phoneNumber?: string;
  whatsappNumber?: string;
  gstNumber?: string;
  address?: string;
  notes?: string;
}

export interface UpdateSupplierInput {
  name?: string;
  contactPerson?: string;
  phoneNumber?: string;
  whatsappNumber?: string;
  gstNumber?: string;
  address?: string;
  notes?: string;
}

export interface PurchaseOrderItemInput {
  productId: string;
  quantityOrdered: number;
  unitCost?: number | string;
}

export interface CreatePurchaseOrderInput {
  supplierId: string;
  expectedDate?: string;
  notes?: string;
  items: PurchaseOrderItemInput[];
}

export interface PurchaseOrderFilters {
  search?: string;
  supplierId?: string;
  status?: PurchaseOrderStatus | "ALL";
  page?: number;
  limit?: number;
}

export interface ReceiveReceiptItemInput {
  purchaseOrderItemId: string;
  productId: string;
  quantityReceived: number;
  unitCost?: number | string;
}

export interface CreatePurchaseReceiptInput {
  purchaseOrderId: string;
  supplierInvoiceNo?: string;
  notes?: string;
  items: ReceiveReceiptItemInput[];
}

export interface PurchaseReceiptFilters {
  purchaseOrderId?: string;
  supplierId?: string;
  page?: number;
  limit?: number;
}
