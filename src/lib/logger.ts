// =============================================================================
// Skubase — Logger
// =============================================================================

/**
 * Environment-aware logging utility.
 *
 * - Development: all levels logged (debug, info, warn, error)
 * - Production: only warn and error logged
 * - Test: only error logged (keeps test output clean)
 *
 * This is a thin wrapper around console methods. In a future step, this can
 * be replaced with a structured logging library (e.g., pino, winston) that
 * writes to files, external services, or log aggregators.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getMinLevel(): number {
  const env = process.env.NODE_ENV;
  if (env === "production") return LOG_LEVELS.warn;
  if (env === "test") return LOG_LEVELS.error;
  return LOG_LEVELS.debug;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= getMinLevel();
}

function formatMessage(level: LogLevel, message: string, context?: string): string {
  const timestamp = new Date().toISOString();
  const prefix = context ? `[${context}]` : "";
  return `${timestamp} [${level.toUpperCase()}]${prefix} ${message}`;
}

export const logger = {
  debug(message: string, context?: string): void {
    if (shouldLog("debug")) {
      console.debug(formatMessage("debug", message, context));
    }
  },

  info(message: string, context?: string): void {
    if (shouldLog("info")) {
      console.info(formatMessage("info", message, context));
    }
  },

  warn(message: string, context?: string): void {
    if (shouldLog("warn")) {
      console.warn(formatMessage("warn", message, context));
    }
  },

  error(message: string, error?: unknown, context?: string): void {
    if (shouldLog("error")) {
      console.error(formatMessage("error", message, context));
      if (error instanceof Error) {
        console.error(error.stack);
      }
    }
  },
} as const;
