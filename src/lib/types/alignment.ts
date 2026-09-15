// =============================================================================
// Skubase — Alignment & Service Billing Types
// =============================================================================

import type { AlignmentDocType, AlignmentBillStatus } from "@prisma/client";

export interface AlignmentBillItemInput {
  particular: string;
  rate: number | string;
  quantity: number | string;
  displayOrder: number;
}

export interface CreateAlignmentBillInput {
  documentType: AlignmentDocType;
  customerId?: string | null;
  customerName: string;
  phoneNumber?: string | null;
  vehicleNumber: string;
  kilometers?: number | string | null;
  date?: string | Date;
  notes?: string | null;
  items: AlignmentBillItemInput[];
}

export interface AlignmentBillFilters {
  search?: string;
  documentType?: AlignmentDocType | "ALL";
  status?: AlignmentBillStatus | "ALL";
  customerId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface AlignmentBillItemView {
  id: string;
  displayOrder: number;
  particular: string;
  rate: string;
  quantity: string;
  amount: string;
}

export interface AlignmentBillView {
  id: string;
  billNumber: string;
  documentType: AlignmentDocType;
  date: string;
  customerId: string | null;
  customerName: string;
  phoneNumber: string | null;
  vehicleNumber: string;
  kilometers: number | null;
  totalAmount: string;
  status: AlignmentBillStatus;
  notes: string | null;
  createdById: string | null;
  createdBy?: {
    id: string;
    fullName: string;
    username: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
  items: AlignmentBillItemView[];
}
