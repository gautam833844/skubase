// =============================================================================
// Skubase — Application Configuration
// =============================================================================

/**
 * Centralized application configuration.
 * All runtime-configurable values should be read from here,
 * not directly from process.env throughout the codebase.
 */
export const appConfig = {
  /** Application display name */
  name: "KMR Group",

  /** Application version (from package.json) */
  version: "0.1.0",

  /** Base URL for the application */
  baseUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",

  /** Current environment */
  env: (process.env.NODE_ENV ?? "development") as "development" | "production" | "test",

  /** Whether running in development mode */
  isDev: process.env.NODE_ENV === "development",

  /** Whether running in production mode */
  isProd: process.env.NODE_ENV === "production",
} as const;
