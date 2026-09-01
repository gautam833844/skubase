import type { PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";

// =============================================================================
// Skubase — Payment Types & DTOs
// =============================================================================

export interface RecordPaymentInput {
  saleId: string;
  amount: number | string;
  paymentMethod: PaymentMethod;
  referenceNumber?: string | null;
  notes?: string | null;
}

export interface PaymentSummary {
  id: string;
  saleId: string | null;
  amount: string | number | Prisma.Decimal;
  paymentMethod: PaymentMethod;
  referenceNumber: string | null;
  paymentDate: string | Date;
  notes: string | null;
  createdById: string | null;
  createdBy?: {
    id: string;
    fullName: string;
    username: string | null;
  } | null;
  createdAt: string | Date;
}

export interface SalePaymentDetails {
  saleId: string;
  invoiceNumber: string;
  saleStatus: string;
  totalAmount: Prisma.Decimal;
  totalPaid: Prisma.Decimal;
  remainingBalance: Prisma.Decimal;
  paymentStatus: PaymentStatus;
  payments: PaymentSummary[];
}
