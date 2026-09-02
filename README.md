# Skubase

Skubase is a specialized business management application designed for tyre retail and wholesale operations. It replaces manual registers and disjointed spreadsheets with a unified system for tracking tyre stock, processing sales, handling procurement, managing warranties, and monitoring business profitability.

- Live Demo: https://skubase-sandy.vercel.app/

---

## Features

### Dashboard
- Centralized overview with direct navigation links to all operational modules.
- Responsive layout with desktop sidebar and mobile navigation drawer.

### Inventory Management
- Tyre-specific catalog tracking brands, tyre sizes, patterns, and categories.
- Real-time physical quantity tracking with low-stock alert thresholds.
- Controlled stock adjustments with mandatory reasons, audit logging, and concurrency control.
- Immutable inventory movement ledger recording every stock addition, deduction, and transfer.

### Sales & Payments
- Multi-item sales orders with draft state preservation and live stock validation.
- Atomic sale confirmation that deducts physical stock and prevents negative inventory.
- Multi-method payment processing supporting Cash, UPI, Card, Bank Transfer, Cheque, and Credit.
- Support for split payments, partial payments, and balance due tracking.
- Printable sales receipts and PDF invoice layouts.

### Purchases & Suppliers
- Supplier directory with contact details and GST identification numbers.
- Purchase order workflows from draft to ordering and receipt.
- Goods receipt processing with atomic inventory increments and automated unit cost updates.

### Customers
- Customer directory tracking contact information, purchase history, and vehicle numbers.
- Direct association of customer profiles with sales orders and warranty claims.

### Returns & Warranty
- Sales returns workflow with line-item return ceilings to prevent over-returns.
- Routing of returned tyres to sellable restock or damaged scrap.
- Warranty claim intake with serial/DOT code recording and manufacturer review statuses.
- Replacement tyre fulfillment linked directly to inventory deductions.

### Reports
Dedicated business analytics module (Version 1) providing four practical reports:
- Stock Valuation & Status: Active product counts, physical stock totals, inventory value at cost, inventory value at retail, and estimated gross margin.
- Low Stock Alerts: Real-time list of products at or below safety alert thresholds, highlighting out-of-stock items and reorder deficits.
- Sales & Gross Profit: Date-filtered revenue summary (Today, Last 7 Days, This Month, Custom Range) calculating Net Sales, Cost of Goods Sold (COGS) based on historic item cost, Gross Profit, Profit Margin percentage, and payment collection breakdowns.
- Stock Movement Ledger: Chronological audit trail of all physical tyre movements with date filters, movement type filters, quantity deltas, and resulting balances.

### Authentication & Security
- Secure user authentication using Argon2id password hashing.
- Database-backed opaque session tokens with automatic sliding expiry.
- Role-based access control with predefined permission scopes for Admin/Owner, Manager, and Staff roles.
- Sliding-window rate limiting on sensitive authentication endpoints to mitigate brute-force attacks.
- Origin validation on state-modifying requests to protect against CSRF attacks.

### Settings & Billing
- Centralized business profile configuration for shop name, address, phone number, and GSTIN.
- Customizable receipt headers and bill footer notes reflected dynamically on invoices.

---

## Technology Stack

| Layer | Technology | Role in Project |
| :--- | :--- | :--- |
| **Framework** | Next.js (App Router) | Full-stack React framework for UI rendering and API routes |
| **UI Library** | React | Component-based user interface |
| **Language** | TypeScript | Static type safety and compile-time verification across client and server |
| **Styling** | Tailwind CSS | Utility-first responsive styling and design system |
| **Database** | PostgreSQL | Relational database engine supporting ACID transactions |
| **ORM** | Prisma | Type-safe database queries, schema management, and client generation |
| **Authentication** | Argon2id (`@node-rs/argon2`) | Memory-hard cryptographic password hashing |
| **Testing** | Vitest | Unit, service, and API test runner |
| **Component Testing** | React Testing Library | DOM integration and component user-flow testing |
| **Static Analysis** | ESLint | Code quality, linting, and best-practice enforcement |
| **Formatting** | Prettier | Consistent code formatting |
| **Hosting** | Vercel | Production application hosting and continuous deployment |
| **Cloud Database** | Neon | Serverless managed PostgreSQL database for production |

---

## Application Architecture

```
User Browser
    │
    ▼
Next.js Application (Hosted on Vercel)
    │
    ├─ Next.js App Router (React Server & Client Components)
    ├─ Next.js API Routes (Server-side controllers & request validation)
    ├─ Service Layer (Business logic, transactions, and permission checks)
    └─ Prisma Client (Type-safe query engine & connection pooling)
    │
    ▼
PostgreSQL Database (Hosted on Neon)
```

The application uses the Next.js App Router architecture. Client interactions trigger requests to Next.js API routes or server actions. The service layer verifies caller permissions, enforces business constraints, and executes database queries within transactions using Prisma Client. Production data is stored in a managed PostgreSQL database on Neon.

---

## Screenshots

Screenshots will be added here in a future documentation update.

Planned screenshots:
- Dashboard
- Inventory
- Sales & Billing
- Purchases
- Reports

---

## Getting Started

### Prerequisites

- Node.js (v20.x or v22.x or later)
- npm (v10.x or later)
- A running PostgreSQL instance (local or hosted)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/gautam833844/skubase.git
   cd skubase
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```
   Open `.env.local` and set your PostgreSQL connection string:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/skubase?schema=public"
   ```

4. Generate the Prisma Client and sync the database schema:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. Start the local development server:
   ```bash
   npm run dev
   ```

6. Open the application:
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

---

## Development Commands

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Starts the Next.js development server |
| `npm run build` | Generates the Prisma client and creates an optimized production build |
| `npm start` | Starts the Next.js production server |
| `npm run typecheck` | Runs the TypeScript compiler to verify static types (`tsc --noEmit`) |
| `npm run lint` | Runs ESLint to identify code quality and style issues |
| `npm run test` | Runs the full Vitest automated test suite |
| `npm run test:coverage` | Runs the test suite and generates a code coverage report |
| `npx prisma validate` | Validates the Prisma schema syntax and relations |
| `npx prisma generate` | Generates the type-safe Prisma Client from schema definitions |

---

## Testing & Quality

All automated checks are maintained and verified:

- Automated Test Suite: 45 test files, 277 tests passing (Vitest)
- TypeScript Compilation: 0 type errors (`tsc --noEmit`)
- Linting: 0 warnings, 0 errors (`eslint`)
- Production Build: Successfully compiled with Next.js Turbopack

---

## Security

- Passwords are securely hashed using memory-hard Argon2id.
- Authentication uses opaque session identifiers stored in the database; no sensitive user data is embedded in client tokens.
- Role-based access control enforces permissions at both the service and API route layer.
- Secrets and connection strings are managed through environment variables and excluded from source control via `.gitignore`.
- CSRF origin checking is enforced on state-modifying requests.

---

## Deployment

- Source Control: Hosted on GitHub (`main` branch)
- Hosting Platform: Deployed on Vercel with automated build checks and Prisma client generation
- Production Database: Serverless PostgreSQL hosted on Neon
- Live Application: https://skubase-sandy.vercel.app/

---

## Version

- Current Version: V1
- Release Status: Production V1 (includes Reports Module V1)

---

## Future Improvements

The following capabilities are planned for future releases:

- Dashboard KPI widgets for daily and monthly sales/profit summaries
- Export functionality for reports (CSV and printable formats)
- Advanced analytics including tyre brand market share and seasonal demand forecasting
- Automated backup verification and restore management workflows
- Barcode scanning integration for tyre stock intake and sales checkout

---

## Project Structure

```
skubase/
├── docs/             # Documentation assets and architecture notes
├── prisma/           # Database schema and Prisma configuration
├── public/           # Static web assets
├── src/
│   ├── app/          # Next.js App Router pages and API route handlers
│   ├── components/   # Reusable UI components and layout shell
│   ├── lib/          # Utilities, database clients, constants, and errors
│   └── services/     # Server-side business logic and domain services
└── tests/            # Automated test suites (unit, service, component, e2e)
```

---

## Important Notes

- Environment files (`.env`, `.env.local`) must never be committed to source control.
- Production database credentials are not included in the repository.
- A functional PostgreSQL instance is required for both local development and testing.
