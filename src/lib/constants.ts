// =============================================================================
// Skubase — Application Constants
// =============================================================================

/** Application metadata */
export const APP_NAME = "Skubase";
export const APP_DESCRIPTION =
  "Comprehensive tyre business management — inventory, sales, purchases, customers, and more.";
export const APP_VERSION = "0.1.0";

/** Authentication cookie name */
export const SESSION_COOKIE_NAME = "skubase_session";

/**
 * Navigation items for the sidebar.
 * Each item maps to a future application module.
 * `implemented` indicates whether the module is functional.
 */
export interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly icon: string;
  readonly implemented: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Dashboard", href: "/", icon: "dashboard", implemented: true },
  { label: "Inventory", href: "/inventory", icon: "inventory", implemented: true },
  { label: "Sales", href: "/sales", icon: "sales", implemented: true },
  { label: "Purchases", href: "/purchases", icon: "purchases", implemented: true },
  { label: "Customers", href: "/customers", icon: "customers", implemented: true },
  { label: "Suppliers", href: "/suppliers", icon: "suppliers", implemented: true },
  { label: "Warranties", href: "/warranty", icon: "warranty", implemented: true },
  { label: "Reports", href: "/reports", icon: "reports", implemented: false },
  { label: "Settings", href: "/settings", icon: "settings", implemented: true },
] as const;

/** Responsive breakpoints (must match Tailwind defaults) */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;
