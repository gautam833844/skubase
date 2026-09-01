import { describe, it, expect, vi, beforeEach } from "vitest";
import { issueWarrantyReplacement } from "@/services/warranty.service";
import type { AuthActor } from "@/lib/auth/permissions";

// =============================================================================
// Stateful Concurrent In-Memory Database Mock for Warranty Replacement Transactions
// Simulates concurrent transactional database execution with row locking & atomic isolation
// =============================================================================

interface MockDbProduct {
  id: string;
  brand: string;
  size: string;
  quantityOnHand: number;
}

interface MockDbClaim {
  id: string;
  claimNumber: string;
  status: "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "RESOLVED" | "REJECTED" | "CANCELLED";
  productId: string;
  quantity: number;
  replacementQuantity: number;
  resolutionType: string | null;
  resolutionNotes: string | null;
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
  claims: new Map<string, MockDbClaim>(),
  movements: [] as MockDbMovement[],
  auditLogs: [] as Array<{ action: string; entityId: string }>,
  txLock: Promise.resolve(),
};

vi.mock("@/lib/db", () => {
  return {
    db: {
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        const previousLock = state.txLock;
        let releaseLock: () => void;
        state.txLock = new Promise<void>((resolve) => {
          releaseLock = resolve;
        });

        await previousLock;

        try {
          const tx = {
            warrantyClaim: {
              findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
                const claim = state.claims.get(where.id);
                if (!claim) return null;
                const product = state.products.get(claim.productId);
                return {
                  ...claim,
                  product,
                  sale: { invoiceNumber: "SALE-1001", saleDate: new Date() },
                  saleItem: { unitPrice: 6500 },
                  customer: { name: "Anil Kapoor" },
                  createdBy: { fullName: "Admin Owner" },
                };
              }),
              update: vi.fn(async ({ where, data }: { where: { id: string }; data: { status: "RESOLVED"; resolutionType: string; resolutionNotes: string; replacementProductId: string; replacementQuantity: number; [key: string]: unknown } }) => {
                const claim = state.claims.get(where.id);
                if (!claim) throw new Error("Claim not found");
                claim.status = data.status;
                claim.resolutionType = data.resolutionType;
                claim.resolutionNotes = data.resolutionNotes;
                claim.replacementQuantity = data.replacementQuantity;
                return {
                  ...claim,
                  product: state.products.get(claim.productId),
                  replacementProduct: state.products.get(data.replacementProductId),
                  sale: { invoiceNumber: "SALE-1001", saleDate: new Date() },
                  saleItem: { unitPrice: 6500 },
                  customer: { name: "Anil Kapoor" },
                  createdBy: { fullName: "Admin Owner" },
                  createdAt: new Date(),
                  updatedAt: new Date(),
                };
              }),
            },
            product: {
              findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
                return state.products.get(where.id) || null;
              }),
              update: vi.fn(async ({ where, data }: { where: { id: string }; data: { quantityOnHand: { decrement: number } } }) => {
                const prod = state.products.get(where.id);
                if (!prod) throw new Error("Product not found");
                prod.quantityOnHand -= data.quantityOnHand.decrement;
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

describe("True Concurrent Warranty Replacement Tests", () => {
  const adminActor: AuthActor = { id: "admin-1", role: "ADMIN_OWNER" };

  beforeEach(() => {
    state.products.clear();
    // Critical stock = exactly 1 tyre available in shop
    state.products.set("prod-1", {
      id: "prod-1",
      brand: "Bridgestone",
      size: "195/65 R15",
      quantityOnHand: 1,
    });

    state.claims.clear();
    state.claims.set("claim-1", {
      id: "claim-1",
      claimNumber: "WAR-1001",
      status: "APPROVED",
      productId: "prod-1",
      quantity: 1,
      replacementQuantity: 0,
      resolutionType: null,
      resolutionNotes: null,
    });

    state.movements = [];
    state.auditLogs = [];
    state.txLock = Promise.resolve();
  });

  it("handles simultaneous replacement requests on stock = 1 safely (1 succeeds, 1 rejected, stock never negative)", async () => {
    // Launch two simultaneous replacement issuance requests
    const requestA = issueWarrantyReplacement(
      "claim-1",
      { replacementQuantity: 1, notes: "Staff member A issuing replacement" },
      adminActor
    );

    const requestB = issueWarrantyReplacement(
      "claim-1",
      { replacementQuantity: 1, notes: "Staff member B issuing replacement" },
      adminActor
    );

    const [resultA, resultB] = await Promise.allSettled([requestA, requestB]);

    const successful = [resultA, resultB].filter((r) => r.status === "fulfilled");
    const rejected = [resultA, resultB].filter((r) => r.status === "rejected");

    // 1. Exactly ONE must succeed and ONE must be rejected
    expect(successful).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // 2. Physical warehouse inventory must be exactly 0 (Never -1)
    const product = state.products.get("prod-1")!;
    expect(product.quantityOnHand).toBe(0);

    // 3. Exactly ONE WARRANTY_OUT_REPLACEMENT inventory movement created
    expect(state.movements).toHaveLength(1);
    expect(state.movements[0].movementType).toBe("WARRANTY_OUT_REPLACEMENT");
    expect(state.movements[0].quantityDelta).toBe(-1);
    expect(state.movements[0].balanceAfter).toBe(0);

    // 4. Claim status updated to RESOLVED with replacementQuantity = 1
    const claim = state.claims.get("claim-1")!;
    expect(claim.status).toBe("RESOLVED");
    expect(claim.replacementQuantity).toBe(1);
  });
});
