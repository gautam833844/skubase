import type { ShopSettingView } from "./shop";

// =============================================================================
// Skubase — Sale Bill & Receipt Types
// =============================================================================

export interface ReceiptItemView {
  id: string;
  brand: string;
  size: string;
  pattern: string | null;
  quantity: number;
  unitPrice: string | number;
  discountAmount: string | number;
  totalPrice: string | number;
}

export interface ReceiptPaymentView {
  id: string;
  amount: string | number;
  paymentMethod: string;
  referenceNumber: string | null;
  paymentDate: string;
}

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
