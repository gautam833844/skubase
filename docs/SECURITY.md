# Skubase — Security Practices

## Current Status: Foundation (Step 1)

This document tracks what security measures have been implemented and what remains to be done.

---

## ✅ Implemented

### Environment Variable Management
- `.env.example` documents all required variables with no real values
- `.env.local` is gitignored and never committed
- No secrets, passwords, or API keys are hardcoded anywhere in the codebase

### HTTP Security Headers
Configured in `next.config.ts`, applied to all routes:
- `X-Content-Type-Options: nosniff` — prevents MIME type sniffing
- `X-Frame-Options: SAMEORIGIN` — prevents clickjacking via iframes
- `Referrer-Policy: strict-origin-when-cross-origin` — controls referrer information
- `Permissions-Policy` — disables camera, microphone, geolocation, browsing-topics
- `X-DNS-Prefetch-Control: on` — enables DNS prefetching for performance
- `X-Powered-By` header removed — hides server technology

### Error Handling
- `AppError` class separates user-safe messages from technical details
- Technical error details (stack traces, internal state) are never exposed to users
- Custom 404 page provides a user-friendly response for missing routes

### Server/Client Separation
- Next.js App Router enforces that server-only modules cannot be imported in client code
- Sensitive configuration is read server-side only via `process.env` (non-`NEXT_PUBLIC_` variables)

### Code Quality
- TypeScript strict mode catches type errors at compile time
- ESLint with Next.js and TypeScript rules enforces code quality
- Prettier ensures consistent formatting

---

## ✅ Implemented Security Controls

### Authentication & Sessions
- [x] Dual-identifier login (Email or Username) with lowercase/trimmed normalization
- [x] Memory-hard Argon2id password hashing (`@node-rs/argon2`)
- [x] 12-character minimum password length policy with common password blocking
- [x] Constant-time dummy password verification on unknown accounts (user enumeration prevention)
- [x] Database-backed opaque 256-bit random session tokens (SHA-256 hash stored in DB)
- [x] Instantaneous session revocation on logout, password change, and user disablement
- [x] `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` (in production) session cookie (`skubase_session`)
- [x] Dual-key rate limiting (IP-based and Account-based) with progressive cooldown

### Authorization & Access Control
- [x] Server-enforced hybrid RBAC with scoped permissions (`ALL`, `OWN`, `NONE`)
- [x] Clean service layer query filtering for `OWN` scope (e.g. staff sales history)
- [x] Next.js 16 route protection middleware redirecting unauthenticated requests to `/login`
- [x] Generic, safe authentication error messages ("Invalid identifier or password.")

### API & Request Security
- [x] CSRF defense-in-depth: `SameSite=Lax` + `Origin`/`Referer` header validation on mutating API requests
- [x] Open redirect protection with strict relative URL sanitization (`isSafeRedirectUrl`)
- [x] Immutable security audit logging for authentication events (`AUTH_LOGIN_SUCCESS`, `AUTH_LOGIN_FAILED`, etc.)
- [x] Zero secret logging policy (passwords, tokens, and hashes are never logged)

## ⏳ Planned (Next Steps)

### Production Database & Infrastructure
- [ ] Active PostgreSQL connection with TLS
- [ ] Production database least-privilege role assignment
- [ ] Distributed Redis-backed rate limiting (for multi-instance deployments)
- [ ] Transactional SMTP provider integration for email password reset delivery

### Content Security Policy
- [ ] CSP headers (deferred until all external resources are known)

### Audit & Monitoring
- [ ] Audit logging for sensitive operations
- [ ] Failed login attempt logging
- [ ] Structured logging to external service

### Data Protection
- [ ] Encryption at rest (database level)
- [ ] Encryption in transit (TLS/HTTPS)
- [ ] Sensitive data handling (PII minimization)
- [ ] Backup and recovery procedures

---

## Threat Awareness

This application will handle business-sensitive data including:
- Financial records (sales, purchases, pricing)
- Customer personal information
- Supplier/dealer details
- Inventory valuations

Security is not a one-time implementation but an ongoing concern. Each new module must be reviewed for security implications before deployment.
