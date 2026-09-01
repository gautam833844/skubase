// =============================================================================
// Skubase — Customer & Sales Foundation Types
// =============================================================================

import type { SaleStatus, PaymentStatus } from "@prisma/client";

export interface CustomerFilters {
  search?: string;
  status?: "ACTIVE" | "INACTIVE" | "ALL";
  page?: number;
  limit?: number;
}

export interface CreateCustomerInput {
  name: string;
  phoneNumber?: string;
  vehicleNumber?: string;
  vehicleModel?: string;
  address?: string;
  notes?: string;
}

export interface UpdateCustomerInput {
  name?: string;
  phoneNumber?: string;
  vehicleNumber?: string;
  vehicleModel?: string;
  address?: string;
  notes?: string;
}

export interface SaleItemInput {
  productId: string;
  quantity: number;
  unitPrice?: number | string;
  discountAmount?: number | string;
}

export interface CreateSaleDraftInput {
  customerId?: string | null;
  notes?: string;
  items: SaleItemInput[];
}

export interface UpdateSaleDraftInput {
  customerId?: string | null;
  notes?: string;
  items?: SaleItemInput[];
}

export interface SaleFilters {
  search?: string;
  status?: SaleStatus | "ALL";
  customerId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface SaleSummaryView {
  id: string;
  invoiceNumber: string;
  saleDate: string;
  status: SaleStatus;
  paymentStatus: PaymentStatus;
  subtotal: string | number;
  discountAmount: string | number;
  taxAmount: string | number;
  totalAmount: string | number;
  notes: string | null;
  customer: {
    id: string;
    name: string;
    phoneNumber: string | null;
    vehicleNumber: string | null;
  } | null;
  createdBy: {
    id: string;
    fullName: string;
    username: string | null;
  } | null;
  itemCount: number;
  totalQuantity: number;
}
