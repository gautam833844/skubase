import { db } from "@/lib/db";
import { requirePermission, getPermissionScope, type AuthActor } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors";
import { Prisma } from "@prisma/client";
import type {
  CreateReturnInput,
  SaleReturnView,
  SaleReturnItemView,
  SaleReturnableItemView,
} from "@/lib/types/returns";

export {
  type CreateReturnInput,
  type SaleReturnView,
  type SaleReturnItemView,
  type SaleReturnableItemView,
};

/**
 * Generates the next human-readable sequential Return Number (RET-1001, RET-1002, ...)
 */
export async function generateNextReturnNumber(
  tx: Omit<typeof db, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">
): Promise<string> {
  const count = await tx.saleReturn.count();
  const nextSeq = count + 1001;
  let returnNumber = `RET-${nextSeq}`;

  // Collision safety check
  let exists = await tx.saleReturn.findUnique({ where: { returnNumber } });
  let offset = 1;
  while (exists) {
    returnNumber = `RET-${nextSeq + offset}`;
    exists = await tx.saleReturn.findUnique({ where: { returnNumber } });
    offset++;
  }

  return returnNumber;
}

/**
 * Calculates remaining returnable quantities for each line item on a completed sale.
 */
export async function getSaleReturnableItems(
  saleId: string,
  actor: AuthActor
): Promise<SaleReturnableItemView[]> {
  requirePermission(actor, "returns:view", "OWN");
  const scope = getPermissionScope(actor, "returns:view");

  const sale = await db.sale.findUnique({
    where: { id: saleId },
    include: {
      items: {
        include: {
          product: true,
          returnItems: {
            include: {
              return: true,
            },
          },
        },
      },
    },
  });

  if (!sale) {
    throw new AppError("NOT_FOUND", `Sale ${saleId} not found`, "Sale record not found.");
  }

  // IDOR protection for staff
  if (scope === "OWN" && sale.createdById !== actor.id) {
    throw new AppError(
      "AUTHORIZATION",
      `Actor ${actor.id} cannot view returns for sale created by ${sale.createdById}`,
      "You do not have permission to view returns for this sale."
    );
  }

  return sale.items.map((item) => {
    const alreadyReturned = item.returnItems
      .filter((r) => r.return.status === "COMPLETED")
      .reduce((sum, r) => sum + r.quantity, 0);

    const returnableQuantity = Math.max(0, item.quantity - alreadyReturned);

    return {
      saleItemId: item.id,
      productId: item.productId,
      brand: item.product.brand,
      size: item.product.size,
      pattern: item.product.pattern || null,
      soldQuantity: item.quantity,
      alreadyReturnedQuantity: alreadyReturned,
      returnableQuantity,
      unitPrice: item.unitPrice.toString(),
    };
  });
}

/**
 * Creates a Sale Return record against a completed sale:
 * - Atomic database transaction (db.$transaction).
 * - Enforces returns:create authorization.
 * - Validates sale status is COMPLETED (Draft sales strictly rejected).
 * - Validates return quantities <= remaining returnable quantities.
 * - Restores physical inventory for SELLABLE items and logs SALE_RETURN movement.
 * - Calculates exact Decimal return value from historical SaleItem selling prices.
 * - Strictly preserves original Sale, SaleItem, and Payment records.
 */
export async function createSaleReturn(
  input: CreateReturnInput,
  actor: AuthActor
): Promise<SaleReturnView> {
  requirePermission(actor, "returns:create", "ALL");

  if (!input.saleId) {
    throw new AppError("VALIDATION", "Sale ID is required", "Please select a sale to return.");
  }

  if (!input.items || input.items.length === 0) {
    throw new AppError("VALIDATION", "At least one item must be returned", "Please select items to return.");
  }

  return db.$transaction(async (tx) => {
    // 1. Fetch Sale with items and previous returns
    const sale = await tx.sale.findUnique({
      where: { id: input.saleId },
      include: {
        customer: true,
        createdBy: true,
        items: {
          include: {
            product: true,
            returnItems: {
              include: {
                return: true,
              },
            },
          },
        },
      },
    });

    if (!sale) {
      throw new AppError("NOT_FOUND", `Sale ${input.saleId} not found`, "Sale record not found.");
    }

    if (sale.status !== "COMPLETED") {
      throw new AppError(
        "VALIDATION",
        `Cannot return items for sale in state ${sale.status}. Only COMPLETED sales support returns.`,
        "Returns can only be processed on completed sales."
      );
    }

    // 2. Validate and calculate return items
    let calculatedTotalReturnAmount = new Prisma.Decimal(0);
    const returnItemOperations: Array<{
      saleItemId: string;
      productId: string;
      brand: string;
      size: string;
      pattern: string | null;
      quantity: number;
      unitPrice: Prisma.Decimal;
      totalPrice: Prisma.Decimal;
      condition: "SELLABLE" | "DAMAGED" | "NON_SELLABLE";
      reason: string | null;
    }> = [];

    for (const itemInput of input.items) {
      if (!Number.isInteger(itemInput.quantity) || itemInput.quantity <= 0) {
        throw new AppError(
          "VALIDATION",
          `Return quantity must be a positive integer, received ${itemInput.quantity}`,
          "Please enter a valid positive quantity for each returned item."
        );
      }

      const saleItem = sale.items.find((si) => si.id === itemInput.saleItemId);
      if (!saleItem) {
        throw new AppError(
          "VALIDATION",
          `SaleItem ${itemInput.saleItemId} does not belong to sale ${sale.id}`,
          "Invalid sale item selected for return."
        );
      }

      // Calculate previously returned quantity
      const alreadyReturned = saleItem.returnItems
        .filter((r) => r.return.status === "COMPLETED")
        .reduce((sum, r) => sum + r.quantity, 0);

      const returnable = saleItem.quantity - alreadyReturned;

      if (itemInput.quantity > returnable) {
        throw new AppError(
          "VALIDATION",
          `Cannot return ${itemInput.quantity} units of ${saleItem.product.brand} ${saleItem.product.size}. Maximum returnable is ${returnable}.`,
          `Return quantity (${itemInput.quantity}) exceeds remaining returnable quantity (${returnable}).`
        );
      }

      const itemTotalPrice = saleItem.unitPrice.mul(itemInput.quantity);
      calculatedTotalReturnAmount = calculatedTotalReturnAmount.add(itemTotalPrice);

      const condition = itemInput.condition || "SELLABLE";

      returnItemOperations.push({
        saleItemId: saleItem.id,
        productId: saleItem.productId,
        brand: saleItem.product.brand,
        size: saleItem.product.size,
        pattern: saleItem.product.pattern || null,
        quantity: itemInput.quantity,
        unitPrice: saleItem.unitPrice,
        totalPrice: itemTotalPrice,
        condition,
        reason: itemInput.reason ? itemInput.reason.trim() : null,
      });
    }

    // 3. Refund validation
    const refundStatus = input.refundStatus || "PENDING";
    const refundAmount = input.refundAmount
      ? new Prisma.Decimal(input.refundAmount)
      : new Prisma.Decimal(0);

    if (refundAmount.gt(calculatedTotalReturnAmount)) {
      throw new AppError(
        "VALIDATION",
        `Refund amount ₹${refundAmount} cannot exceed total return value ₹${calculatedTotalReturnAmount}`,
        "Refund amount cannot exceed return value."
      );
    }

    if (refundAmount.lt(0)) {
      throw new AppError("VALIDATION", "Refund amount cannot be negative", "Refund amount must be positive.");
    }

    // 4. Generate next sequential return number
    const returnNumber = await generateNextReturnNumber(tx);

    // 5. Create SaleReturn header record
    const saleReturn = await tx.saleReturn.create({
      data: {
        returnNumber,
        saleId: sale.id,
        customerId: sale.customerId,
        totalAmount: calculatedTotalReturnAmount,
        refundAmount,
        status: "COMPLETED",
        refundStatus,
        reason: input.reason ? input.reason.trim() : null,
        notes: input.notes ? input.notes.trim() : null,
        createdById: actor.id,
      },
    });

    // 6. Process Return Items & Restore Inventory for SELLABLE items
    const createdReturnItems: SaleReturnItemView[] = [];

    for (const op of returnItemOperations) {
      const returnItem = await tx.saleReturnItem.create({
        data: {
          returnId: saleReturn.id,
          saleItemId: op.saleItemId,
          productId: op.productId,
          quantity: op.quantity,
          unitPrice: op.unitPrice,
          totalPrice: op.totalPrice,
          condition: op.condition,
          reason: op.reason,
        },
      });

      // Restore physical stock if item is in SELLABLE condition
      if (op.condition === "SELLABLE") {
        await tx.product.update({
          where: { id: op.productId },
          data: {
            quantityOnHand: { increment: op.quantity },
          },
        });

        const product = await tx.product.findUniqueOrThrow({
          where: { id: op.productId },
        });

        // Create immutable SALE_RETURN inventory ledger entry
        await tx.inventoryMovement.create({
          data: {
            productId: op.productId,
            movementType: "SALE_RETURN",
            quantityDelta: op.quantity,
            balanceAfter: product.quantityOnHand,
            referenceType: "SaleReturn",
            referenceId: saleReturn.id,
            reason: `Return ${returnNumber} for Sale ${sale.invoiceNumber}`,
            actorId: actor.id,
          },
        });
      }

      createdReturnItems.push({
        id: returnItem.id,
        saleItemId: returnItem.saleItemId,
        productId: returnItem.productId,
        brand: op.brand,
        size: op.size,
        pattern: op.pattern,
        quantity: returnItem.quantity,
        unitPrice: returnItem.unitPrice.toString(),
        totalPrice: returnItem.totalPrice.toString(),
        condition: returnItem.condition,
        reason: returnItem.reason,
      });
    }

    // 7. Record Audit Log
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        entityName: "SaleReturn",
        entityId: saleReturn.id,
        action: "RETURN_CREATED",
        newState: {
          returnNumber,
          saleId: sale.id,
          saleInvoiceNumber: sale.invoiceNumber,
          totalAmount: calculatedTotalReturnAmount.toString(),
          itemCount: createdReturnItems.length,
          refundStatus,
        },
      },
    });

    return {
      id: saleReturn.id,
      returnNumber: saleReturn.returnNumber,
      saleId: saleReturn.saleId,
      saleInvoiceNumber: sale.invoiceNumber,
      customerId: sale.customerId,
      customerName: sale.customer?.name ?? null,
      returnDate: saleReturn.returnDate.toISOString(),
      totalAmount: saleReturn.totalAmount.toString(),
      refundAmount: saleReturn.refundAmount.toString(),
      status: saleReturn.status,
      refundStatus: saleReturn.refundStatus,
      reason: saleReturn.reason,
      notes: saleReturn.notes,
      createdBy: {
        fullName: actor.id,
        username: null,
      },
      items: createdReturnItems,
      createdAt: saleReturn.createdAt.toISOString(),
    };
  });
}

/**
 * Retrieves all return records for a specific sale.
 */
export async function getSaleReturns(
  saleId: string,
  actor: AuthActor
): Promise<SaleReturnView[]> {
  requirePermission(actor, "returns:view", "OWN");
  const scope = getPermissionScope(actor, "returns:view");

  const sale = await db.sale.findUnique({
    where: { id: saleId },
    select: { id: true, createdById: true },
  });

  if (!sale) {
    throw new AppError("NOT_FOUND", `Sale ${saleId} not found`, "Sale record not found.");
  }

  // IDOR check for staff
  if (scope === "OWN" && sale.createdById !== actor.id) {
    throw new AppError(
      "AUTHORIZATION",
      `Actor ${actor.id} cannot view returns for sale created by ${sale.createdById}`,
      "You do not have permission to view returns for this sale."
    );
  }

  const returns = await db.saleReturn.findMany({
    where: { saleId },
    include: {
      sale: {
        select: { invoiceNumber: true },
      },
      customer: {
        select: { name: true },
      },
      createdBy: {
        select: { fullName: true, username: true },
      },
      items: {
        include: {
          product: {
            select: { brand: true, size: true, pattern: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return returns.map((r) => ({
    id: r.id,
    returnNumber: r.returnNumber,
    saleId: r.saleId,
    saleInvoiceNumber: r.sale.invoiceNumber,
    customerId: r.customerId,
    customerName: r.customer?.name ?? null,
    returnDate: r.returnDate.toISOString(),
    totalAmount: r.totalAmount.toString(),
    refundAmount: r.refundAmount.toString(),
    status: r.status,
    refundStatus: r.refundStatus,
    reason: r.reason,
    notes: r.notes,
    createdBy: r.createdBy
      ? {
          fullName: r.createdBy.fullName,
          username: r.createdBy.username,
        }
      : null,
    items: r.items.map((item) => ({
      id: item.id,
      saleItemId: item.saleItemId,
      productId: item.productId,
      brand: item.product.brand,
      size: item.product.size,
      pattern: item.product.pattern || null,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toString(),
      totalPrice: item.totalPrice.toString(),
      condition: item.condition,
      reason: item.reason,
    })),
    createdAt: r.createdAt.toISOString(),
  }));
}
