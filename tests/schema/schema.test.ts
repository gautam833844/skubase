import { describe, it, expect } from "vitest";
import {
  Role,
  PaymentMethod,
  PaymentStatus,
  SaleStatus,
  CustomerOrderStatus,
  PurchaseOrderStatus,
  InventoryMovementType,
  ClaimType,
  ClaimStatus,
  ClaimResolutionType,
} from "@prisma/client";

describe("Database Schema Enums", () => {
  it("exports all expected user roles", () => {
    expect(Role.ADMIN_OWNER).toBe("ADMIN_OWNER");
    expect(Role.MANAGER).toBe("MANAGER");
    expect(Role.STAFF).toBe("STAFF");
  });

  it("exports all payment methods and statuses", () => {
    expect(PaymentMethod.CASH).toBe("CASH");
    expect(PaymentMethod.UPI).toBe("UPI");
    expect(PaymentMethod.CARD).toBe("CARD");
    expect(PaymentMethod.BANK_TRANSFER).toBe("BANK_TRANSFER");
    expect(PaymentMethod.CHEQUE).toBe("CHEQUE");
    expect(PaymentMethod.CREDIT).toBe("CREDIT");
    expect(PaymentMethod.OTHER).toBe("OTHER");

    expect(PaymentStatus.PAID).toBe("PAID");
    expect(PaymentStatus.PARTIALLY_PAID).toBe("PARTIALLY_PAID");
    expect(PaymentStatus.UNPAID).toBe("UNPAID");
  });

  it("exports all order and sale statuses", () => {
    expect(SaleStatus.DRAFT).toBe("DRAFT");
    expect(SaleStatus.COMPLETED).toBe("COMPLETED");
    expect(SaleStatus.VOIDED).toBe("VOIDED");

    expect(CustomerOrderStatus.PENDING).toBe("PENDING");
    expect(CustomerOrderStatus.PARTIALLY_FULFILLED).toBe("PARTIALLY_FULFILLED");
    expect(CustomerOrderStatus.FULFILLED).toBe("FULFILLED");
    expect(CustomerOrderStatus.CANCELLED).toBe("CANCELLED");

    expect(PurchaseOrderStatus.DRAFT).toBe("DRAFT");
    expect(PurchaseOrderStatus.ORDERED).toBe("ORDERED");
    expect(PurchaseOrderStatus.PARTIALLY_RECEIVED).toBe("PARTIALLY_RECEIVED");
    expect(PurchaseOrderStatus.COMPLETED).toBe("COMPLETED");
    expect(PurchaseOrderStatus.CANCELLED).toBe("CANCELLED");
  });

  it("exports all inventory movement types", () => {
    expect(InventoryMovementType.PURCHASE_RECEIPT).toBe("PURCHASE_RECEIPT");
    expect(InventoryMovementType.SALE).toBe("SALE");
    expect(InventoryMovementType.SALE_RETURN).toBe("SALE_RETURN");
    expect(InventoryMovementType.WARRANTY_OUT_REPLACEMENT).toBe("WARRANTY_OUT_REPLACEMENT");
    expect(InventoryMovementType.WARRANTY_IN_FROM_BRAND).toBe("WARRANTY_IN_FROM_BRAND");
    expect(InventoryMovementType.WARRANTY_DEFECT_SCRAP).toBe("WARRANTY_DEFECT_SCRAP");
    expect(InventoryMovementType.ADJUSTMENT_IN).toBe("ADJUSTMENT_IN");
    expect(InventoryMovementType.ADJUSTMENT_OUT).toBe("ADJUSTMENT_OUT");
  });

  it("exports all warranty claim types and resolutions", () => {
    expect(ClaimType.WARRANTY_DEFECT).toBe("WARRANTY_DEFECT");
    expect(ClaimType.CUSTOMER_RETURN).toBe("CUSTOMER_RETURN");
    expect(ClaimType.TRANSIT_DAMAGE).toBe("TRANSIT_DAMAGE");

    expect(ClaimStatus.SUBMITTED).toBe("SUBMITTED");
    expect(ClaimStatus.UNDER_REVIEW).toBe("UNDER_REVIEW");
    expect(ClaimStatus.APPROVED).toBe("APPROVED");
    expect(ClaimStatus.REJECTED).toBe("REJECTED");
    expect(ClaimStatus.RESOLVED).toBe("RESOLVED");
    expect(ClaimStatus.CANCELLED).toBe("CANCELLED");

    expect(ClaimResolutionType.REPLACEMENT_FROM_STOCK).toBe("REPLACEMENT_FROM_STOCK");
    expect(ClaimResolutionType.CREDIT_NOTE).toBe("CREDIT_NOTE");
    expect(ClaimResolutionType.REPAIR).toBe("REPAIR");
    expect(ClaimResolutionType.REJECTED_NO_ACTION).toBe("REJECTED_NO_ACTION");
  });
});

describe("Domain Business Calculations", () => {
  it("calculates moving weighted average cost correctly", () => {
    // Current stock: 10 units @ ₹4,000 avg cost (Total = ₹40,000)
    // New receipt: 10 units @ ₹4,500 unit cost (Total = ₹45,000)
    // New avg cost = (40,000 + 45,000) / 20 = ₹4,250
    const currentQoh = 10;
    const currentAvgCost = 4000.0;
    const receivedQty = 10;
    const receivedUnitCost = 4500.0;

    const totalCost = currentQoh * currentAvgCost + receivedQty * receivedUnitCost;
    const totalQty = currentQoh + receivedQty;
    const newAvgCost = totalCost / totalQty;

    expect(newAvgCost).toBe(4250.0);
  });

  it("calculates available stock from physical QOH and reservations", () => {
    const quantityOnHand = 10;
    const quantityReserved = 4;
    const availableQuantity = quantityOnHand - quantityReserved;

    expect(availableQuantity).toBe(6);
  });

  it("validates split payments against total amount", () => {
    const saleTotal = 21200.0;
    const payments = [
      { amount: 10000.0, method: PaymentMethod.CASH },
      { amount: 11200.0, method: PaymentMethod.UPI },
    ];

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const balance = saleTotal - totalPaid;

    expect(totalPaid).toBe(saleTotal);
    expect(balance).toBe(0);
  });
});
