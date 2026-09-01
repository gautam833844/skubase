// =============================================================================
// Skubase — CSRF & Origin Validation
// =============================================================================

/**
 * Validates the Origin and Referer headers for state-changing HTTP requests.
 * Ensures the request originated from the configured application domain.
 */
export function validateRequestOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");

  // In Next.js App Router, if origin header is present, it must match host
  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (host && originUrl.host === host) {
        return true;
      }
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (appUrl) {
        const expectedHost = new URL(appUrl).host;
        if (originUrl.host === expectedHost) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  // Fallback to referer header if origin is absent
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (host && refererUrl.host === host) {
        return true;
      }
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (appUrl) {
        const expectedHost = new URL(appUrl).host;
        if (refererUrl.host === expectedHost) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  // In non-browser environments or local dev without origin header, check host
  return Boolean(host);
}

/**
 * Validates a redirect URL to prevent Open Redirect attacks.
 * Only allows safe relative paths (e.g. "/inventory", "/dashboard").
 * Blocks absolute URLs, protocol-relative URLs ("//evil.com"), and javascript:/data: URIs.
 */
export function isSafeRedirectUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") {
    return false;
  }

  const trimmed = url.trim();

  // Must start with "/" and not with "//" or "/\"
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return false;
  }

  // Reject javascript:, data:, vbscript: protocols
  if (/^(\/|\\)*[a-zA-Z0-9_-]+:/i.test(trimmed)) {
    return false;
  }

  // Reject CRLF characters
  if (/[\r\n]/.test(trimmed)) {
    return false;
  }

  return true;
}
