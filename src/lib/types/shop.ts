// =============================================================================
// Skubase — Shop / Business Settings Types
// =============================================================================

export interface ShopSettingView {
  id: string;
  name: string;
  tagline: string | null;
  address: string | null;
  phoneNumber: string | null;
  email: string | null;
  website: string | null;
  gstin: string | null;
  billFooter: string | null;
  updatedAt: string;
}

export interface UpdateShopSettingsInput {
  name: string;
  tagline?: string | null;
  address?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  website?: string | null;
  gstin?: string | null;
  billFooter?: string | null;
}
