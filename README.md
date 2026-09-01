# Skubase

**Production-grade tyre business management application.**

---

## 1. Project Overview

Skubase is a specialized, production-ready enterprise management web application purpose-built for tyre retail and wholesale operations. It provides end-to-end management for tyre inventory tracking, supplier procurement, multi-stage sales workflows, customer records, payment handling, returns/refunds, warranty pipelines, and audit logging.

---

## 2. Implemented Features (Steps 1–10)

- **Step 1 — Foundation**: Next.js 16 App Router, Tailwind CSS 4 design system, responsive layout shell, structured error handling with `AppError`.
- **Step 2 — Database Foundation**: PostgreSQL schema with 21 synchronized domain tables, Prisma 7 client integration, check constraints, and relational data integrity.
- **Step 3 — Authentication & Authorization**: Session-based opaque database tokens, Argon2id memory-hard password hashing (12+ char policy), constant-time verification, dual-key sliding-window rate limiting, and role-based access control (`ADMIN_OWNER`, `MANAGER`, `STAFF`).
- **Step 4A — Tyre Inventory Management**: Product catalog with tyre sizing, load/speed indexes, pattern, category, stock thresholds, physical stock ledger, and immutable movement audits (`PURCHASE_RECEIPT`, `SALE_DEDUCTION`, `MANUAL_ADJUSTMENT`, `SALE_RETURN`).
- **Step 4B — Suppliers & Purchasing**: Supplier management, purchase orders (`DRAFT`, `ORDERED`, `PARTIALLY_RECEIVED`, `COMPLETED`, `CANCELLED`), and atomic receipt processing with automated cost and inventory updates.
- **Step 5A — Customer Management & Sales Drafts**: Customer registry, vehicle tracking, price tiering, and multi-item draft sales with unit price calculations and stock availability validation.
- **Step 5B — Sale Confirmation & Inventory Deduction**: Atomic sale confirmation, physical stock deduction, negative stock prevention, and immutable movement logging.
- **Step 6 — Payment Management**: Multi-method payments (`CASH`, `UPI`, `CARD`, `BANK_TRANSFER`, `CHEQUE`, `CREDIT`, `OTHER`), partial payment tracking, overpayment rejection, and automated sale payment status transitions (`UNPAID`, `PARTIALLY_PAID`, `PAID`).
- **Step 7 — Bills & Receipts**: Professional sales receipt generation, tax invoice layouts, printable invoice preview, and PDF export formatting.
- **Step 8 — Shop & Business Settings**: Centralized shop configuration (business name, address, GSTIN, phone, receipt notes/terms) dynamically reflected across bills and receipts.
- **Step 9 — Sales Returns & Refunds**: Auditable return tracking preserving historical sales immutability, line-item returnable ceiling calculations, sellable vs. damaged condition routing, atomic stock restoration, and financial refund tracking.
- **Step 10 — Warranty Management**: Comprehensive warranty claim intake, brand inspection review workflows, scrap/defect logging, and stock replacement fulfillment.

---

## 3. Technology Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Framework** | Next.js 16 (App Router + Turbopack) | Full-stack React framework with SSR and Route Handlers |
| **Frontend** | React 19 + Tailwind CSS 4 | Modern component library with curated responsive styling |
| **Language** | TypeScript 5 | Strict static typing and compile-time verification |
| **Database** | PostgreSQL 18 + Prisma ORM 7.10 | Type-safe schema management and connection pooling |
| **Security** | `@node-rs/argon2` (Argon2id) | Memory-hard cryptographic password hashing |
| **Testing** | Vitest 4 + React Testing Library 16 | Fast unit, service, API, and component integration tests |
| **Code Quality** | ESLint 9 + Prettier 3 | Automated linting and code formatting |

---

## 4. Getting Started

### Prerequisites

- **Node.js**: v20.x or v24.x
- **npm**: v10.x or v11.x
- **PostgreSQL**: 16, 17, or 18

### Installation

1. Clone repository:
   ```bash
   git clone https://github.com/gautam833844/skubase.git
   cd skubase
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Configure your PostgreSQL connection string in `.env.local`:
   ```env
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/skubase?schema=public"
   ```

4. Synchronize database schema:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. Development & Quality Commands

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Start development server with Turbopack |
| `npm run build` | Create production bundle |
| `npm start` | Start production server |
| `npm run typecheck` | Run TypeScript compiler check (`tsc --noEmit`) |
| `npm run lint` | Run ESLint static analysis |
| `npm run test` | Run Vitest test suite (43 suites, 260 tests) |
| `npm run test:coverage` | Run tests with code coverage report |
| `npx prisma validate` | Validate Prisma schema |
| `npx prisma generate` | Generate Prisma Client types |

---

## 6. Security & Credentials Notice

- **Never commit real credentials**: `.env` and `.env.local` files are strictly excluded via `.gitignore`.
- **Database sessions**: User sessions use opaque cryptographically generated random tokens stored in the database with sliding expiry.
- **Passwords**: All passwords are validated for minimum length (12+ characters) and hashed using Argon2id with memory-hard parameters.
