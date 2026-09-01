import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupplier } from "@/services/supplier.service";
import { createProduct } from "@/services/inventory.service";
import { createPurchaseOrder, receivePurchaseOrder } from "@/services/purchase.service";
import { createCustomer } from "@/services/customer.service";
import { createSaleDraft, confirmSale } from "@/services/sale.service";
import { recordPayment, getSalePayments } from "@/services/payment.service";
import { db } from "@/lib/db";
import { Prisma, type Product, type Supplier, type PurchaseOrder, type PurchaseReceipt, type Customer, type Sale, type Payment } from "@prisma/client";
import type { AuthActor } from "@/lib/auth/permissions";

vi.mock("@/lib/db", () => {
  return {
    db: {
      supplier: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      product: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        count: vi.fn(),
        aggregate: vi.fn(),
      },
      purchaseOrder: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      purchaseOrderItem: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      purchaseReceipt: {
        create: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
      },
      purchaseReceiptItem: {
        create: vi.fn(),
      },
      customer: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      sale: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      saleItem: {
        createMany: vi.fn(),
        update: vi.fn(),
      },
      payment: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      inventoryMovement: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      shopSetting: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      saleReturn: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      saleReturnItem: {
        create: vi.fn(),
      },
      warrantyClaim: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        return cb(db);
      }),
    },
  };
});

describe("Complete End-to-End Shop Workflow Integration Test (Steps 1–6)", () => {
  const adminActor: AuthActor = { id: "admin-1", role: "ADMIN_OWNER" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes complete lifecycle: Supplier -> Product -> PO -> Partial Receipts -> Customer -> Draft Sale -> Confirm Sale -> Multiple Payments", async () => {
    // 1. Create Supplier
    const mockSupplier: Supplier = {
      id: "supp-100",
      name: "Bridgestone India Pvt Ltd",
      contactPerson: "Rajesh Kumar",
      phoneNumber: "9876543210",
      whatsappNumber: null,
      gstNumber: null,
      address: "Pune",
      isActive: true,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(db.supplier.create).mockResolvedValue(mockSupplier);

    const supplier = await createSupplier(
      {
        name: "Bridgestone India Pvt Ltd",
        contactPerson: "Rajesh Kumar",
        phoneNumber: "9876543210",
      },
      adminActor
    );
    expect(supplier.name).toBe("Bridgestone India Pvt Ltd");
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "SUPPLIER_CREATED" }),
      })
    );

    // 2. Create Tyre Product
    const mockProduct: Product = {
      id: "prod-100",
      brand: "Bridgestone",
      size: "195/65 R15",
      pattern: "B290",
      unitPrice: new Prisma.Decimal(5000),
      averageCostPrice: new Prisma.Decimal(0),
      quantityOnHand: 0,
      minStockAlert: 2,
      isActive: true,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(db.product.findUnique).mockResolvedValue(null); // No duplicates
    vi.mocked(db.product.create).mockResolvedValue(mockProduct);

    const product = await createProduct(
      {
        brand: "Bridgestone",
        size: "195/65 R15",
        pattern: "B290",
        unitPrice: 5000,
      },
      adminActor
    );
    expect(product.brand).toBe("Bridgestone");
    expect(product.quantityOnHand).toBe(0);

    // 3. Create Purchase Order for 4 tyres @ ₹4,000
    const mockPO = {
      id: "po-100",
      poNumber: "PO-1001",
      supplierId: "supp-100",
      orderDate: new Date(),
      status: "ORDERED" as const,
      expectedDate: null,
      notes: null,
      createdById: "admin-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [
        {
          id: "po-item-1",
          purchaseOrderId: "po-100",
          productId: "prod-100",
          quantityOrdered: 4,
          quantityReceived: 0,
          unitCost: new Prisma.Decimal(4000),
        },
      ],
    };
    vi.mocked(db.supplier.findUnique).mockResolvedValue(mockSupplier);
    vi.mocked(db.product.findMany).mockResolvedValue([mockProduct]);
    vi.mocked(db.purchaseOrder.count).mockResolvedValue(0);
    vi.mocked(db.purchaseOrder.create).mockResolvedValue(mockPO as unknown as PurchaseOrder);

    const po = await createPurchaseOrder(
      {
        supplierId: "supp-100",
        items: [{ productId: "prod-100", quantityOrdered: 4, unitCost: 4000 }],
      },
      adminActor
    );
    expect(po.poNumber).toBe("PO-1001");
    expect(po.status).toBe("ORDERED");

    // 4. First Partial Inwarding: Receive 2 tyres
    vi.mocked(db.purchaseOrder.findUnique).mockResolvedValue({
      ...mockPO,
      supplier: mockSupplier,
      items: [
        {
          ...mockPO.items[0],
          product: mockProduct,
        },
      ],
    } as unknown as PurchaseOrder);
    vi.mocked(db.purchaseReceipt.count).mockResolvedValue(0);
    vi.mocked(db.purchaseReceipt.create).mockResolvedValue({ id: "rec-1" } as PurchaseReceipt);
    vi.mocked(db.product.findUniqueOrThrow).mockResolvedValue(mockProduct);
    vi.mocked(db.purchaseOrderItem.findMany).mockResolvedValue([
      { ...mockPO.items[0], quantityReceived: 2 },
    ] as unknown as Awaited<ReturnType<typeof db.purchaseOrderItem.findMany>>);

    const receipt1 = await receivePurchaseOrder(
      {
        purchaseOrderId: "po-100",
        items: [{ purchaseOrderItemId: "po-item-1", productId: "prod-100", quantityReceived: 2, unitCost: 4000 }],
      },
      adminActor
    );
    expect(receipt1).toBeDefined();

    // Verify Product Stock updated to 2 & Average Cost to ₹4,000
    expect(db.product.update).toHaveBeenCalledWith({
      where: { id: "prod-100" },
      data: {
        quantityOnHand: 2,
        averageCostPrice: new Prisma.Decimal(4000),
      },
    });
    // Verify Movement delta +2, balanceAfter = 2
    expect(db.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: "prod-100",
        movementType: "PURCHASE_RECEIPT",
        quantityDelta: 2,
        balanceAfter: 2,
      }),
    });

    // 5. Second Partial Inwarding: Receive remaining 2 tyres
    const productAfterReceipt1: Product = {
      ...mockProduct,
      quantityOnHand: 2,
      averageCostPrice: new Prisma.Decimal(4000),
    };
    vi.mocked(db.purchaseOrder.findUnique).mockResolvedValue({
      ...mockPO,
      supplier: mockSupplier,
      items: [
        {
          ...mockPO.items[0],
          quantityReceived: 2,
          product: productAfterReceipt1,
        },
      ],
    } as unknown as PurchaseOrder);
    vi.mocked(db.purchaseReceipt.count).mockResolvedValue(1);
    vi.mocked(db.product.findUniqueOrThrow).mockResolvedValue(productAfterReceipt1);
    vi.mocked(db.purchaseOrderItem.findMany).mockResolvedValue([
      { ...mockPO.items[0], quantityReceived: 4 },
    ] as unknown as Awaited<ReturnType<typeof db.purchaseOrderItem.findMany>>);

    await receivePurchaseOrder(
      {
        purchaseOrderId: "po-100",
        items: [{ purchaseOrderItemId: "po-item-1", productId: "prod-100", quantityReceived: 2, unitCost: 4000 }],
      },
      adminActor
    );

    // Verify Stock increased to 4 & PO status became COMPLETED
    expect(db.product.update).toHaveBeenCalledWith({
      where: { id: "prod-100" },
      data: {
        quantityOnHand: 4,
        averageCostPrice: new Prisma.Decimal(4000),
      },
    });
    expect(db.purchaseOrder.update).toHaveBeenCalledWith({
      where: { id: "po-100" },
      data: { status: "COMPLETED" },
    });

    // 6. Create Customer
    const mockCustomer: Customer = {
      id: "cust-100",
      name: "Sunil Verma",
      phoneNumber: "9820011223",
      vehicleNumber: "MH02CB1234",
      vehicleModel: "Honda City",
      address: "Andheri West, Mumbai",
      notes: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(db.customer.create).mockResolvedValue(mockCustomer);

    const customer = await createCustomer(
      {
        name: "Sunil Verma",
        phoneNumber: "9820011223",
        vehicleNumber: "MH02CB1234",
      },
      adminActor
    );
    expect(customer.name).toBe("Sunil Verma");

    // 7. Create Draft Sale: 2 tyres @ ₹5,000 each (Total = ₹10,000)
    const productInStock4: Product = {
      ...mockProduct,
      quantityOnHand: 4,
      averageCostPrice: new Prisma.Decimal(4000),
    };
    const mockDraftSale = {
      id: "sale-100",
      invoiceNumber: "SALE-1001",
      customerId: "cust-100",
      saleDate: new Date(),
      status: "DRAFT",
      paymentStatus: "UNPAID",
      subtotal: new Prisma.Decimal(10000),
      discountAmount: new Prisma.Decimal(0),
      taxAmount: new Prisma.Decimal(0),
      totalAmount: new Prisma.Decimal(10000),
      notes: null,
      createdById: "admin-1",
      items: [
        {
          id: "sale-item-1",
          productId: "prod-100",
          quantity: 2,
          unitPrice: new Prisma.Decimal(5000),
          costPrice: new Prisma.Decimal(4000),
          discountAmount: new Prisma.Decimal(0),
          totalPrice: new Prisma.Decimal(10000),
          product: productInStock4,
        },
      ],
      customer: mockCustomer,
    };
    vi.mocked(db.customer.findUnique).mockResolvedValue(mockCustomer);
    vi.mocked(db.product.findMany).mockResolvedValue([productInStock4]);
    vi.mocked(db.sale.count).mockResolvedValue(0);
    vi.mocked(db.sale.create).mockResolvedValue(mockDraftSale as unknown as Sale);

    const saleDraft = await createSaleDraft(
      {
        customerId: "cust-100",
        items: [{ productId: "prod-100", quantity: 2, unitPrice: 5000 }],
      },
      adminActor
    );
    expect(saleDraft.status).toBe("DRAFT");
    expect(saleDraft.totalAmount).toEqual(new Prisma.Decimal(10000));

    // CRITICAL DRAFT INVARIANT: Physical stock remains 4, NO movement created
    expect(db.product.updateMany).not.toHaveBeenCalled();

    // 8. Confirm Sale: Deduct inventory (4 -> 2) & create SALE movement
    vi.mocked(db.sale.findUnique).mockResolvedValue(mockDraftSale as unknown as Sale);
    vi.mocked(db.product.findUnique).mockResolvedValue(productInStock4);
    vi.mocked(db.product.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(db.sale.update).mockResolvedValue({
      ...mockDraftSale,
      status: "COMPLETED",
    } as unknown as Sale);

    const confirmedSale = await confirmSale("sale-100", adminActor);
    expect(confirmedSale.status).toBe("COMPLETED");

    // Verify atomic conditional stock deduction (4 - 2 = 2)
    expect(db.product.updateMany).toHaveBeenCalledWith({
      where: { id: "prod-100", quantityOnHand: { gte: 2 } },
      data: { quantityOnHand: { decrement: 2 } },
    });
    // Verify SALE InventoryMovement created with delta = -2, balanceAfter = 2
    expect(db.inventoryMovement.create).toHaveBeenCalledWith({
      data: {
        productId: "prod-100",
        movementType: "SALE",
        quantityDelta: -2,
        balanceAfter: 2,
        referenceType: "Sale",
        referenceId: "sale-100",
        reason: "Sale SALE-1001",
        actorId: "admin-1",
      },
    });

    // 9. Record First Payment: ₹5,000 Cash (Remaining = ₹5,000 -> Status = PARTIALLY_PAID)
    const completedSaleWithoutPayments = {
      ...mockDraftSale,
      status: "COMPLETED",
      paymentStatus: "UNPAID",
      payments: [],
    };
    vi.mocked(db.sale.findUnique).mockResolvedValue(completedSaleWithoutPayments as unknown as Sale);
    vi.mocked(db.payment.create).mockResolvedValue({
      id: "pay-1",
      saleId: "sale-100",
      amount: new Prisma.Decimal(5000),
      paymentMethod: "CASH",
    } as Payment);

    const payment1 = await recordPayment(
      {
        saleId: "sale-100",
        amount: 5000,
        paymentMethod: "CASH",
      },
      adminActor
    );
    expect(payment1.paymentStatus).toBe("PARTIALLY_PAID");
    expect(payment1.totalPaid.toNumber()).toBe(5000);
    expect(payment1.remainingBalance.toNumber()).toBe(5000);

    // 10. Record Second Payment: ₹5,000 UPI (Remaining = ₹0 -> Status = PAID)
    const completedSaleWithFirstPayment = {
      ...mockDraftSale,
      status: "COMPLETED",
      paymentStatus: "PARTIALLY_PAID",
      payments: [
        {
          id: "pay-1",
          saleId: "sale-100",
          amount: new Prisma.Decimal(5000),
          paymentMethod: "CASH",
        },
      ] as Payment[],
    };
    vi.mocked(db.sale.findUnique).mockResolvedValue(completedSaleWithFirstPayment as unknown as Sale);
    vi.mocked(db.payment.create).mockResolvedValue({
      id: "pay-2",
      saleId: "sale-100",
      amount: new Prisma.Decimal(5000),
      paymentMethod: "UPI",
    } as Payment);

    const payment2 = await recordPayment(
      {
        saleId: "sale-100",
        amount: 5000,
        paymentMethod: "UPI",
        referenceNumber: "UPI-11223344",
      },
      adminActor
    );
    expect(payment2.paymentStatus).toBe("PAID");
    expect(payment2.totalPaid.toNumber()).toBe(10000);
    expect(payment2.remainingBalance.toNumber()).toBe(0);

    // 11. Verify Payment History & Balances
    const finalSaleRecord = {
      ...mockDraftSale,
      status: "COMPLETED",
      paymentStatus: "PAID",
      payments: [
        {
          id: "pay-1",
          saleId: "sale-100",
          amount: new Prisma.Decimal(5000),
          paymentMethod: "CASH",
          createdAt: new Date(),
        },
        {
          id: "pay-2",
          saleId: "sale-100",
          amount: new Prisma.Decimal(5000),
          paymentMethod: "UPI",
          createdAt: new Date(),
        },
      ] as Payment[],
    };
    vi.mocked(db.sale.findUnique).mockResolvedValue(finalSaleRecord as unknown as Sale);

    const salePaymentDetails = await getSalePayments("sale-100", adminActor);
    expect(salePaymentDetails.paymentStatus).toBe("PAID");
    expect(salePaymentDetails.totalPaid.toNumber()).toBe(10000);
    expect(salePaymentDetails.remainingBalance.toNumber()).toBe(0);
    expect(salePaymentDetails.payments).toHaveLength(2);
  });
});
