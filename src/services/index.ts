// =============================================================================
// Skubase — Services Layer
// =============================================================================
// This directory will contain business logic services.
//
// Each service module will encapsulate domain-specific operations:
//   - inventory.service.ts  → stock calculations, availability checks
//   - sales.service.ts      → sale recording, invoice generation
//   - purchase.service.ts   → purchase order management
//   - customer.service.ts   → customer operations
//   - supplier.service.ts   → supplier management
//   - report.service.ts     → report generation
//
// Services are pure business logic — they do NOT handle HTTP requests,
// authentication, or database connections directly. They receive
// dependencies (e.g., database client) via parameters.
//
// The AI agent (future) will interact with these service functions,
// NOT directly with the database.
export * from "./auth.service";
export * from "./inventory.service";
export * from "./supplier.service";
export * from "./purchase.service";
export * from "./customer.service";
export * from "./sale.service";
export * from "./payment.service";
export * from "./receipt.service";
export * from "./shop.service";
export * from "./return.service";
export * from "./warranty.service";



