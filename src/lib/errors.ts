// =============================================================================
// Skubase — Error Handling
// =============================================================================

/**
 * Categorizes errors by their source so the application can respond
 * appropriately (e.g., show user-friendly message vs. log internally).
 */
export type AppErrorType =
  | "VALIDATION"
  | "AUTHENTICATION"
  | "AUTHORIZATION"
  | "NOT_FOUND"
  | "NETWORK"
  | "INTERNAL";

/**
 * Maps error types to HTTP status codes for API responses.
 */
const STATUS_CODE_MAP: Record<AppErrorType, number> = {
  VALIDATION: 400,
  AUTHENTICATION: 401,
  AUTHORIZATION: 403,
  NOT_FOUND: 404,
  NETWORK: 502,
  INTERNAL: 500,
};

/**
 * Maps error types to user-safe default messages.
 * Technical details should never be exposed to end users.
 */
const DEFAULT_USER_MESSAGES: Record<AppErrorType, string> = {
  VALIDATION: "Please check your input and try again.",
  AUTHENTICATION: "Please log in to continue.",
  AUTHORIZATION: "You do not have permission to perform this action.",
  NOT_FOUND: "The requested item was not found.",
  NETWORK: "Unable to connect to the server. Please try again.",
  INTERNAL: "Something went wrong. Please try again later.",
};

/**
 * Structured application error with type classification, HTTP status code,
 * and separate user-safe / technical messages.
 */
export class AppError extends Error {
  public readonly type: AppErrorType;
  public readonly statusCode: number;
  public readonly userMessage: string;

  constructor(
    type: AppErrorType,
    technicalMessage: string,
    userMessage?: string
  ) {
    super(technicalMessage);
    this.name = "AppError";
    this.type = type;
    this.statusCode = STATUS_CODE_MAP[type];
    this.userMessage = userMessage ?? DEFAULT_USER_MESSAGES[type];

    // Maintains proper stack trace in V8 engines
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

/**
 * Type guard to check if an unknown value is an AppError.
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Returns a user-safe error message from any error.
 * Never exposes technical details to the end user.
 */
export function getUserMessage(error: unknown): string {
  if (isAppError(error)) {
    return error.userMessage;
  }
  return DEFAULT_USER_MESSAGES.INTERNAL;
}
