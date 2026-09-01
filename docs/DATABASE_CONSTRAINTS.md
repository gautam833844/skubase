# Skubase — Database Constraints & Migration Guide

This document defines the PostgreSQL database-level constraints, check rules, and immutability triggers that must be incorporated into SQL migrations alongside the Prisma schema.

---

## 1. PostgreSQL Check Constraints (Raw SQL Additions)

While Prisma defines primary keys, foreign keys, and unique indexes, critical business invariants must be enforced directly at the database engine level via PostgreSQL `CHECK` constraints to prevent data corruption.

### 1.1 Products Table
```sql
-- Ensure physical stock cannot drop below zero
ALTER TABLE "products" 
ADD CONSTRAINT "chk_products_qoh_non_negative" 
CHECK ("quantity_on_hand" >= 0);

-- Ensure prices and average costs are non-negative
ALTER TABLE "products" 
ADD CONSTRAINT "chk_products_prices_non_negative" 
CHECK ("unit_price" >= 0 AND "average_cost_price" >= 0);

-- Ensure min stock alert is non-negative
ALTER TABLE "products" 
ADD CONSTRAINT "chk_products_min_stock_non_negative" 
CHECK ("min_stock_alert" >= 0);
```

### 1.2 Customer Order Items Table
```sql
-- Ensure requested quantity is positive
ALTER TABLE "customer_order_items" 
ADD CONSTRAINT "chk_co_items_qty_requested_positive" 
CHECK ("quantity_requested" > 0);

-- Ensure fulfilled quantity does not exceed requested quantity
ALTER TABLE "customer_order_items" 
ADD CONSTRAINT "chk_co_items_qty_fulfilled_valid" 
CHECK ("quantity_fulfilled" >= 0 AND "quantity_fulfilled" <= "quantity_requested");

-- Ensure reserved quantity is non-negative and does not exceed remaining demand
ALTER TABLE "customer_order_items" 
ADD CONSTRAINT "chk_co_items_qty_reserved_valid" 
CHECK ("quantity_reserved" >= 0 AND "quantity_reserved" <= ("quantity_requested" - "quantity_fulfilled"));
```

### 1.3 Purchase Order & Receipt Items Table
```sql
-- Ensure ordered quantity is positive
ALTER TABLE "purchase_order_items" 
ADD CONSTRAINT "chk_po_items_qty_ordered_positive" 
CHECK ("quantity_ordered" > 0);

-- Ensure received quantity on PO item is non-negative
ALTER TABLE "purchase_order_items" 
ADD CONSTRAINT "chk_po_items_qty_received_non_negative" 
CHECK ("quantity_received" >= 0);

-- Ensure physical receipt quantity is positive
ALTER TABLE "purchase_receipt_items" 
ADD CONSTRAINT "chk_receipt_items_qty_positive" 
CHECK ("quantity_received" > 0);

-- Ensure unit cost on receipt is non-negative
ALTER TABLE "purchase_receipt_items" 
ADD CONSTRAINT "chk_receipt_items_cost_non_negative" 
CHECK ("unit_cost" >= 0);
```

### 1.4 Sales & Sale Items Table
```sql
-- Ensure sale line item quantity is positive
ALTER TABLE "sale_items" 
ADD CONSTRAINT "chk_sale_items_qty_positive" 
CHECK ("quantity" > 0);

-- Ensure sale item prices are non-negative
ALTER TABLE "sale_items" 
ADD CONSTRAINT "chk_sale_items_prices_non_negative" 
CHECK ("unit_price" >= 0 AND "cost_price" >= 0 AND "discount_amount" >= 0 AND "total_price" >= 0);

-- Ensure sale header totals are non-negative
ALTER TABLE "sales" 
ADD CONSTRAINT "chk_sales_totals_non_negative" 
CHECK ("subtotal" >= 0 AND "discount_amount" >= 0 AND "tax_amount" >= 0 AND "total_amount" >= 0);
```

### 1.5 Payments Table
```sql
-- Ensure payment amounts are strictly positive
ALTER TABLE "payments" 
ADD CONSTRAINT "chk_payments_amount_positive" 
CHECK ("amount" > 0);
```

---

## 2. Immutability Enforcement for Audit Logs & Inventory Ledger

Neither Prisma nor application code alone guarantees immutability against direct SQL access. The PostgreSQL database engine enforces append-only immutability via database triggers.

```sql
-- Function to block UPDATE and DELETE operations
CREATE OR REPLACE FUNCTION prevent_audit_ledger_mutation() 
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Immutability violation: UPDATE and DELETE operations are strictly prohibited on %', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- Trigger for audit_logs
CREATE TRIGGER trg_immutable_audit_logs
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_ledger_mutation();

-- Trigger for inventory_movements
CREATE TRIGGER trg_immutable_inventory_movements
BEFORE UPDATE OR DELETE ON "inventory_movements"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_ledger_mutation();
```

---

## 3. Pending Business Decisions & Flexible Design

The database schema has been intentionally designed to accommodate pending business decisions without requiring schema overhauls:

| Decision Area | Status | How Schema Handles It Flexibly |
|---|---|---|
| **GST / Tax Invoicing** | Pending Owner input | `Sale.taxAmount` stores gross tax amount; if itemized HSN/CGST/SGST is needed later, tax rate fields can be added to `SaleItem`. |
| **Walk-in Anonymous Sales** | Pending Owner input | `Sale.customerId` is nullable; walk-in cash customers do not require registration. |
| **Payment Modes** | Pending Owner input | `PaymentMethod` enum covers `CASH`, `UPI`, `CARD`, `BANK_TRANSFER`, `CHEQUE`. Additional modes can be appended cleanly. |
| **Credit / Khata Accounts** | Pending Owner input | Supported via `PaymentStatus.PARTIALLY_PAID` / `UNPAID` where `Sale.totalAmount - SUM(payments.amount) = Outstanding Balance`. |
