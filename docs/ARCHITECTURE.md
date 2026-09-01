# Skubase — Architecture

## Overview

Skubase is a tyre business management application built with Next.js 16 (App Router), TypeScript, and Tailwind CSS v4. It follows a layered architecture that separates UI, API, business logic, and data access.

## Architecture Layers

```
User (Browser — Mobile / Desktop)
         ↓
┌─────────────────────────────────┐
│   UI Layer (React Components)   │  Server Components + Client Components
│   src/app/ + src/components/    │
└──────────┬──────────────────────┘
           ↓
┌─────────────────────────────────┐
│   API Layer (Route Handlers)    │  Next.js API routes (future)
│   src/app/api/                  │  Middleware for auth, validation
└──────────┬──────────────────────┘
           ↓
┌─────────────────────────────────┐
│   Service Layer                 │  Pure business logic functions
│   src/services/                 │  No HTTP, no DB — receives dependencies
└──────────┬──────────────────────┘
           ↓
┌─────────────────────────────────┐
│   Data Access Layer             │  Prisma ORM (future)
│   Repository pattern            │
└──────────┬──────────────────────┘
           ↓
┌─────────────────────────────────┐
│   PostgreSQL Database           │  Not connected in Step 1
└─────────────────────────────────┘
```

### Layer Responsibilities

| Layer | Responsibility | Current Status |
|-------|---------------|----------------|
| **UI** | Render interface, handle user interactions | ✅ Shell & Login UI implemented |
| **API** | HTTP endpoints, CSRF validation, session endpoints | ✅ Auth endpoints implemented (`/api/auth/*`) |
| **Services** | Business rules, auth orchestration, scoped permissions | ✅ AuthService & Permission evaluators implemented |
| **Data Access** | Type-safe queries via Prisma ORM (`src/lib/db.ts`) | ✅ Schema & client generated |
| **Database** | Persistent storage (PostgreSQL) | ⏳ Awaiting local/cloud PostgreSQL connection |

### Key Design Decisions

1. **Service layer is framework-agnostic**: Business logic in `src/services/` is pure TypeScript with no framework imports. This makes it testable, portable, and accessible to the future AI agent.

2. **AI interacts through services, not the database**: The future AI agent will call service functions (e.g., `inventoryService.checkStock()`) rather than writing SQL directly. This ensures business rules are always enforced.

3. **Server Components by default**: Pages and layouts use React Server Components unless they need client-side interactivity (e.g., sidebar toggle). This keeps sensitive logic off the client.

4. **Centralized configuration**: All environment-dependent values flow through `src/config/app.config.ts`, not scattered `process.env` calls.

5. **Structured error handling**: All errors use the `AppError` class with type classification, ensuring user-friendly messages and proper logging.

## Future Modules

Each module will follow the same pattern:

```
src/
├── app/[module]/        → Pages and route handlers
├── components/[module]/ → Module-specific components (if needed)
├── services/[module].service.ts → Business logic
└── types/[module].types.ts      → Type definitions
```

Planned modules: Inventory, Sales, Purchases, Customers, Suppliers, Warranties, Reports, Authentication, AI Agent.
