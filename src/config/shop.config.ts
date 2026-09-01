// =============================================================================
// Skubase — Shop & Business Information Configuration
// =============================================================================

export interface ShopConfig {
  name: string;
  tagline: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  phoneNumber: string;
  email: string;
  footerNotice: string;
}

export const defaultShopConfig: ShopConfig = {
  name: process.env.NEXT_PUBLIC_SHOP_NAME || "Skubase Tyre Hub",
  tagline: "Quality Tyres, Wheel Alignment & Expert Service",
  addressLine1: "Plot No. 42, Main Automotive Hub",
  addressLine2: "Opposite Transport Nagar, Link Road",
  city: "Mumbai, Maharashtra - 400001",
  phoneNumber: "+91 98765 43210",
  email: "contact@skubasetyres.com",
  footerNotice: "Thank you for your business! Please check wheel nuts & tyre pressure after 50 km.",
};
