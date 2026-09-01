import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSaleReturn } from "@/services/return.service";
import { Prisma } from "@prisma/client";
import type { AuthActor } from "@/lib/auth/permissions";

// =============================================================================
// Stateful Concurrent In-Memory Database Mock
// Simulates concurrent transactional database execution with row locking & atomic isolation
// =============================================================================

interface MockDbProduct {
  id: string;
  brand: string;
  size: string;
  pattern: string | null;
  quantityOnHand: number;
}

interface MockDbSaleItem {
  id: string;
  saleId: string;
  productId: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
}

interface MockDbSale {
  id: string;
  invoiceNumber: string;
  status: "DRAFT" | "COMPLETED";
  customerId: string | null;
  items: MockDbSaleItem[];
}

interface MockDbReturnItem {
  id: string;
  returnId: string;
  saleItemId: string;
  productId: string;
  quantity: number;
  condition: "SELLABLE" | "DAMAGED" | "NON_SELLABLE";
}

interface MockDbReturn {
  id: string;
  returnNumber: string;
  saleId: string;
  status: "COMPLETED" | "CANCELLED";
  items: MockDbReturnItem[];
}

interface MockDbMovement {
  id: string;
  productId: string;
  movementType: string;
  quantityDelta: number;
  balanceAfter: number;
  referenceId: string;
}

const state = {
  products: new Map<string, MockDbProduct>(),
  sales: new Map<string, MockDbSale>(),
  returns: new Map<string, MockDbReturn>(),
  movements: [] as MockDbMovement[],
  auditLogs: [] as Array<{ action: string; entityId: string }>,
  txLock: Promise.resolve(),
};

vi.mock("@/lib/db", () => {
  return {
    db: {
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        // Enforce transaction isolation queue simulating database row locking
        const previousLock = state.txLock;
        let releaseLock: () => void;
        state.txLock = new Promise<void>((resolve) => {
          releaseLock = resolve;
        });

        await previousLock;

        try {
          // Transaction context with current live snapshot of database state
          const tx = {
            sale: {
              findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
                const sale = state.sales.get(where.id);
                if (!sale) return null;

                const itemsWithRelations = sale.items.map((item) => {
                  const product = state.products.get(item.productId);
                  const returnItemsForThisItem: Array<{
                    id: string;
                    quantity: number;
                    return: { status: string };
                  }> = [];

                  for (const ret of state.returns.values()) {
                    for (const retItem of ret.items) {
                      if (retItem.saleItemId === item.id) {
                        returnItemsForThisItem.push({
                          id: retItem.id,
                          quantity: retItem.quantity,
                          return: { status: ret.status },
                        });
                      }
                    }
                  }

                  return {
                    ...item,
                    product,
                    returnItems: returnItemsForThisItem,
                  };
                });

                return {
                  ...sale,
                  customer: { id: "cust-1", name: "Anand Sharma" },
                  createdBy: { id: "admin-1", fullName: "Admin Owner" },
                  items: itemsWithRelations,
                };
              }),
            },
            saleReturn: {
              count: vi.fn(async () => state.returns.size),
              findUnique: vi.fn(async ({ where }: { where: { returnNumber?: string } }) => {
                if (where.returnNumber) {
                  for (const r of state.returns.values()) {
                    if (r.returnNumber === where.returnNumber) return r;
                  }
                }
                return null;
              }),
              create: vi.fn(async ({ data }: { data: { returnNumber: string; saleId: string; status: "COMPLETED" | "CANCELLED"; [key: string]: unknown } }) => {
                const returnRecord: MockDbReturn = {
                  id: `ret-${state.returns.size + 1}`,
                  returnNumber: data.returnNumber,
                  saleId: data.saleId,
                  status: data.status,
                  items: [],
                };
                state.returns.set(returnRecord.id, returnRecord);
                return {
                  ...data,
                  id: returnRecord.id,
                  returnDate: new Date(),
                  createdAt: new Date(),
                };
              }),
            },
            saleReturnItem: {
              create: vi.fn(async ({ data }: { data: { returnId: string; saleItemId: string; productId: string; quantity: number; condition: "SELLABLE" | "DAMAGED" | "NON_SELLABLE"; [key: string]: unknown } }) => {
                const itemRecord: MockDbReturnItem = {
                  id: `ret-item-${Date.now()}-${Math.random()}`,
                  returnId: data.returnId,
                  saleItemId: data.saleItemId,
                  productId: data.productId,
                  quantity: data.quantity,
                  condition: data.condition,
                };
                const parentReturn = state.returns.get(data.returnId);
                if (parentReturn) {
                  parentReturn.items.push(itemRecord);
                }
                return {
                  ...data,
                  id: itemRecord.id,
                };
              }),
            },
            product: {
              update: vi.fn(async ({ where, data }: { where: { id: string }; data: { quantityOnHand: { increment: number } } }) => {
                const prod = state.products.get(where.id);
                if (!prod) throw new Error("Product not found");
                prod.quantityOnHand += data.quantityOnHand.increment;
                return prod;
              }),
              findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
                const prod = state.products.get(where.id);
                if (!prod) throw new Error("Product not found");
                return prod;
              }),
            },
            inventoryMovement: {
              create: vi.fn(async ({ data }: { data: { productId: string; movementType: string; quantityDelta: number; balanceAfter: number; referenceId: string; [key: string]: unknown } }) => {
                const movement: MockDbMovement = {
                  id: `mov-${state.movements.length + 1}`,
                  productId: data.productId,
                  movementType: data.movementType,
                  quantityDelta: data.quantityDelta,
                  balanceAfter: data.balanceAfter,
                  referenceId: data.referenceId,
                };
                state.movements.push(movement);
                return movement;
              }),
            },
            auditLog: {
              create: vi.fn(async ({ data }: { data: { action: string; entityId: string; [key: string]: unknown } }) => {
                state.auditLogs.push({ action: data.action, entityId: data.entityId });
                return data;
              }),
            },
          };

          return await cb(tx);
        } finally {
          releaseLock!();
        }
      }),
    },
  };
});

describe("True Concurrent Returns & Idempotency Integration Tests", () => {
  const adminActor: AuthActor = { id: "admin-1", role: "ADMIN_OWNER" };

  beforeEach(() => {
    // Reset database state to pristine scenario:
    // Initial Stock = 6 (after sold 4 from initial 10)
    state.products.clear();
    state.products.set("prod-1", {
      id: "prod-1",
      brand: "MRF",
      size: "195/65 R15",
      pattern: "ZLX",
      quantityOnHand: 6,
    });

    state.sales.clear();
    state.sales.set("sale-1", {
      id: "sale-1",
      invoiceNumber: "SALE-1001",
      status: "COMPLETED",
      customerId: "cust-1",
      items: [
        {
          id: "si-1",
          saleId: "sale-1",
          productId: "prod-1",
          quantity: 4, // Sold 4 tyres
          unitPrice: new Prisma.Decimal(5000),
        },
      ],
    });

    state.returns.clear();
    state.movements = [];
    state.auditLogs = [];
    state.txLock = Promise.resolve();
  });

  it("handles competing concurrent return requests (Req A = 3, Req B = 3 on sold qty = 4) safely without overselling", async () => {
    // Both requests fired concurrently
    const requestA = createSaleReturn(
      {
        saleId: "sale-1",
        items: [{ saleItemId: "si-1", quantity: 3, condition: "SELLABLE" }],
        reason: "Request A",
      },
      adminActor
    );

    const requestB = createSaleReturn(
      {
        saleId: "sale-1",
        items: [{ saleItemId: "si-1", quantity: 3, condition: "SELLABLE" }],
        reason: "Request B",
      },
      adminActor
    );

    // Execute concurrently using Promise.allSettled
    const [resultA, resultB] = await Promise.allSettled([requestA, requestB]);

    // 1. One request MUST succeed and the other MUST fail
    const successfulResults = [resultA, resultB].filter((r) => r.status === "fulfilled");
    const failedResults = [resultA, resultB].filter((r) => r.status === "rejected");

    expect(successfulResults).toHaveLength(1);
    expect(failedResults).toHaveLength(1);

    // The failed request must have a clear validation error about returnable quantity
    const rejectedReason = (failedResults[0] as PromiseRejectedResult).reason;
    expect(rejectedReason.message).toMatch(/Maximum returnable is 1/i);

    // 2. Physical inventory must ONLY be restored for the successful return (+3)
    const product = state.products.get("prod-1")!;
    expect(product.quantityOnHand).toBe(9); // Initial 6 + 3 = 9 (Never 6 + 3 + 3 = 12)

    // 3. Exactly one SALE_RETURN inventory movement created
    expect(state.movements).toHaveLength(1);
    expect(state.movements[0].movementType).toBe("SALE_RETURN");
    expect(state.movements[0].quantityDelta).toBe(3);
    expect(state.movements[0].balanceAfter).toBe(9);

    // 4. Exactly one SaleReturn record exists
    expect(state.returns.size).toBe(1);

    // 5. Original SaleItem.quantity remains 4
    const originalSale = state.sales.get("sale-1")!;
    expect(originalSale.items[0].quantity).toBe(4);
  });

  it("handles duplicate submission of the SAME return request idempotently", async () => {
    // User accidentally double clicks "Confirm Return" (2 identical requests)
    const reqPayload = {
      saleId: "sale-1",
      items: [{ saleItemId: "si-1", quantity: 3, condition: "SELLABLE" as const }],
      reason: "Double click return",
    };

    const duplicateA = createSaleReturn(reqPayload, adminActor);
    const duplicateB = createSaleReturn(reqPayload, adminActor);

    const [resA, resB] = await Promise.allSettled([duplicateA, duplicateB]);

    const successes = [resA, resB].filter((r) => r.status === "fulfilled");
    const rejections = [resA, resB].filter((r) => r.status === "rejected");

    // Only 1 return created, second rejected due to remaining quantity limit
    expect(successes).toHaveLength(1);
    expect(rejections).toHaveLength(1);

    // Stock incremented only once
    const product = state.products.get("prod-1")!;
    expect(product.quantityOnHand).toBe(9); // 6 + 3
    expect(state.movements).toHaveLength(1);
  });

  it("allows multiple concurrent returns if their combined quantity is <= sold quantity", async () => {
    // Sold = 4. Concurrent Request A = 2, Concurrent Request B = 2. Combined = 4 <= 4.
    const requestA = createSaleReturn(
      {
        saleId: "sale-1",
        items: [{ saleItemId: "si-1", quantity: 2, condition: "SELLABLE" }],
        reason: "Customer partial return 1",
      },
      adminActor
    );

    const requestB = createSaleReturn(
      {
        saleId: "sale-1",
        items: [{ saleItemId: "si-1", quantity: 2, condition: "SELLABLE" }],
        reason: "Customer partial return 2",
      },
      adminActor
    );

    const [resA, resB] = await Promise.allSettled([requestA, requestB]);

    // Both should succeed because combined quantity (2 + 2 = 4) <= 4
    expect(resA.status).toBe("fulfilled");
    expect(resB.status).toBe("fulfilled");

    // Final inventory = 6 + 2 + 2 = 10
    const product = state.products.get("prod-1")!;
    expect(product.quantityOnHand).toBe(10);

    // 2 SALE_RETURN movements created with distinct return numbers
    expect(state.movements).toHaveLength(2);
    expect(state.movements[0].quantityDelta).toBe(2);
    expect(state.movements[1].quantityDelta).toBe(2);
    expect(state.returns.size).toBe(2);

    // Any subsequent return must fail because 4 - 4 = 0 returnable
    await expect(
      createSaleReturn(
        {
          saleId: "sale-1",
          items: [{ saleItemId: "si-1", quantity: 1, condition: "SELLABLE" }],
        },
        adminActor
      )
    ).rejects.toThrow(/Maximum returnable is 0/i);
  });
});
