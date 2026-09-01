// =============================================================================
// Skubase — Shared Type Definitions
// =============================================================================

/**
 * Standard API response envelope for future API routes.
 * Ensures consistent response shape across all endpoints.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    type: string;
    message: string;
  };
}

/**
 * Pagination parameters for list endpoints.
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Paginated response wrapper.
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
