import { db } from "@/lib/db";
import { requirePermission, hasPermission, getPermissionScope, type AuthActor } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors";
import { Prisma } from "@prisma/client";
import {
  type SaleFilters,
  type CreateSaleDraftInput,
  type UpdateSaleDraftInput,
  type SaleItemInput,
} from "@/lib/types/sales";

// =============================================================================
// Skubase — Sales Foundation & Draft Management Service
// =============================================================================

export {
  type SaleFilters,
  type CreateSaleDraftInput,
  type UpdateSaleDraftInput,
  type SaleItemInput,
};

/**
 * Generates the next sequential human-readable Sale/Invoice number (e.g. SALE-1001).
 */
export async function generateNextSaleNumber(): Promise<string> {
  const count = await db.sale.count();
  const nextSeq = 1001 + count;
  let candidate = `SALE-${nextSeq}`;

  let exists = await db.sale.findUnique({ where: { invoiceNumber: candidate } });
  let offset = 1;
  while (exists) {
    candidate = `SALE-${nextSeq + offset}`;
    exists = await db.sale.findUnique({ where: { invoiceNumber: candidate } });
    offset++;
  }

  return candidate;
}

/**
 * Lists sales with scoped authorization, search, status filtering, and pagination.
 */
export async function listSales(filters: SaleFilters = {}, actor: AuthActor) {
  const scope = getPermissionScope(actor, "sales:view_history");
  if (scope === "NONE") {
    throw new AppError(
      "AUTHORIZATION",
      "Actor lacks permission to view sales history",
      "You do not have permission to view sales history."
    );
  }

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  const skip = (page - 1) * limit;

  const whereClause: Prisma.SaleWhereInput = {};

  // Enforce scoped authorization
  if (scope === "OWN") {
    whereClause.createdById = actor.id;
  }

  if (filters.status && filters.status !== "ALL") {
    whereClause.status = filters.status;
  }

  if (filters.customerId) {
    whereClause.customerId = filters.customerId;
  }

  if (filters.search && filters.search.trim()) {
    const search = filters.search.trim();
    whereClause.OR = [
      { invoiceNumber: { contains: search, mode: "insensitive" } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
      { customer: { phoneNumber: { contains: search, mode: "insensitive" } } },
      { customer: { vehicleNumber: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [sales, totalCount, statusCounts] = await Promise.all([
    db.sale.findMany({
      where: whereClause,
      include: {
        customer: {
          select: { id: true, name: true, phoneNumber: true, vehicleNumber: true },
        },
        createdBy: {
          select: { id: true, fullName: true, username: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, brand: true, size: true, pattern: true },
            },
          },
        },
      },
      orderBy: { saleDate: "desc" },
      skip,
      take: limit,
    }),
    db.sale.count({ where: whereClause }),
    db.sale.groupBy({
      by: ["status"],
      where: scope === "OWN" ? { createdById: actor.id } : {},
      _count: { id: true },
    }),
  ]);

  const enrichedSales = sales.map((sale) => {
    const totalQuantity = sale.items.reduce((sum, item) => sum + item.quantity, 0);
    return {
      ...sale,
      itemCount: sale.items.length,
      totalQuantity,
    };
  });

  return {
    sales: enrichedSales,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
    statusCounts: statusCounts.reduce((acc, curr) => {
      acc[curr.status] = curr._count.id;
      return acc;
    }, {} as Record<string, number>),
  };
}

/**
 * Retrieves a single sale by ID with all item details and product stock info.
 */
export async function getSaleById(id: string, actor: AuthActor) {
  const scope = getPermissionScope(actor, "sales:view_history");
  if (scope === "NONE") {
    throw new AppError(
      "AUTHORIZATION",
      "Actor lacks permission to view sales",
      "You do not have permission to view sales."
    );
  }

  const sale = await db.sale.findUnique({
    where: { id },
    include: {
      customer: true,
      createdBy: {
        select: { id: true, fullName: true, username: true },
      },
      items: {
        include: {
          product: {
            select: {
              id: true,
              brand: true,
              size: true,
              pattern: true,
              unitPrice: true,
              averageCostPrice: true,
              quantityOnHand: true,
            },
          },
        },
      },
    },
  });

  if (!sale) {
    throw new AppError("NOT_FOUND", `Sale ${id} not found`, "Sale not found.");
  }

  // Enforce scoped ownership check
  if (scope === "OWN" && sale.createdById !== actor.id) {
    throw new AppError(
      "AUTHORIZATION",
      `Actor ${actor.id} cannot view sale ${id} owned by ${sale.createdById}`,
      "You do not have permission to view this sale."
    );
  }

  const totalQuantity = sale.items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    ...sale,
    itemCount: sale.items.length,
    totalQuantity,
  };
}

/**
 * Creates a new Sale Draft with flexible item pricing, stock checking, and zero stock deduction.
 */
export async function createSaleDraft(input: CreateSaleDraftInput, actor: AuthActor) {
  requirePermission(actor, "sales:create");

  if (!input.items || input.items.length === 0) {
    throw new AppError("VALIDATION", "At least one tyre item is required", "Please add at least one tyre to the sale.");
  }

  // Customer validation (optional)
  let customerId: string | null = null;
  if (input.customerId) {
    const customer = await db.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) {
      throw new AppError("NOT_FOUND", `Customer ${input.customerId} not found`, "Selected customer not found.");
    }
    if (!customer.isActive) {
      throw new AppError(
        "VALIDATION",
        `Customer ${customer.name} is deactivated`,
        "Cannot attach a deactivated customer to a sale."
      );
    }
    customerId = customer.id;
  }

  // Product & Price validation
  const productIds = input.items.map((i) => i.productId);
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const canEditPrices = hasPermission(actor, "prices:edit");

  let subtotal = new Prisma.Decimal(0);
  let totalDiscount = new Prisma.Decimal(0);

  const preparedItems: Prisma.SaleItemCreateManySaleInput[] = [];

  for (const item of input.items) {
    const prod = productMap.get(item.productId);
    if (!prod) {
      throw new AppError("NOT_FOUND", `Product ${item.productId} not found`, "One of the selected tyres does not exist.");
    }
    if (!prod.isActive) {
      throw new AppError(
        "VALIDATION",
        `Product ${prod.brand} ${prod.size} is deactivated`,
        `Cannot sell deactivated product "${prod.brand} ${prod.size}".`
      );
    }

    const qty = Number(item.quantity);
    if (isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
      throw new AppError("VALIDATION", "Invalid sale quantity", "Quantity must be a positive whole number.");
    }

    // Determine unit price
    let unitPriceDecimal: Prisma.Decimal;
    if (item.unitPrice !== undefined && item.unitPrice !== "") {
      const customPrice = new Prisma.Decimal(Number(item.unitPrice));
      if (customPrice.lessThan(0)) {
        throw new AppError("VALIDATION", "Negative unit price", "Selling price cannot be negative.");
      }

      // Check price modification authorization
      if (!customPrice.equals(prod.unitPrice)) {
        if (!canEditPrices) {
          throw new AppError(
            "AUTHORIZATION",
            `Actor ${actor.id} attempted to change catalog price for ${prod.brand} ${prod.size}`,
            "You do not have permission to modify selling prices."
          );
        }
      }
      unitPriceDecimal = customPrice;
    } else {
      unitPriceDecimal = prod.unitPrice;
    }

    // Determine discount
    let discountDecimal = new Prisma.Decimal(0);
    if (item.discountAmount !== undefined && item.discountAmount !== "") {
      discountDecimal = new Prisma.Decimal(Number(item.discountAmount));
      if (discountDecimal.lessThan(0)) {
        throw new AppError("VALIDATION", "Negative discount", "Discount amount cannot be negative.");
      }
    }

    const lineSubtotal = unitPriceDecimal.mul(qty);
    const lineTotal = lineSubtotal.sub(discountDecimal);
    if (lineTotal.lessThan(0)) {
      throw new AppError("VALIDATION", "Discount exceeds line subtotal", "Item discount cannot exceed line total.");
    }

    subtotal = subtotal.add(lineSubtotal);
    totalDiscount = totalDiscount.add(discountDecimal);

    preparedItems.push({
      productId: prod.id,
      quantity: qty,
      unitPrice: unitPriceDecimal,
      costPrice: prod.averageCostPrice, // Capture historical cost
      discountAmount: discountDecimal,
      totalPrice: lineTotal,
    });
  }

  const totalAmount = subtotal.sub(totalDiscount);
  const invoiceNumber = await generateNextSaleNumber();

  // Create Sale Draft (CRITICAL: NO stock deduction here)
  const createdSale = await db.$transaction(async (tx) => {
    const sale = await tx.sale.create({
      data: {
        invoiceNumber,
        customerId,
        saleDate: new Date(),
        subtotal,
        discountAmount: totalDiscount,
        taxAmount: new Prisma.Decimal(0),
        totalAmount,
        status: "DRAFT",
        paymentStatus: "UNPAID",
        notes: input.notes?.trim() || null,
        createdById: actor.id,
        items: {
          createMany: {
            data: preparedItems,
          },
        },
      },
      include: {
        items: {
          include: { product: true },
        },
        customer: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        entityName: "Sale",
        entityId: sale.id,
        action: "SALE_DRAFT_CREATED",
        newState: {
          invoiceNumber: sale.invoiceNumber,
          customerId: sale.customerId,
          itemCount: sale.items.length,
          totalAmount: sale.totalAmount.toString(),
        },
      },
    });

    return sale;
  });

  return createdSale;
}

/**
 * Updates an existing Sale Draft.
 */
export async function updateSaleDraft(id: string, input: UpdateSaleDraftInput, actor: AuthActor) {
  requirePermission(actor, "sales:create");

  const existingSale = await db.sale.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!existingSale) {
    throw new AppError("NOT_FOUND", `Sale ${id} not found`, "Sale not found.");
  }

  if (existingSale.status !== "DRAFT") {
    throw new AppError(
      "VALIDATION",
      `Cannot edit sale ${existingSale.invoiceNumber} with status ${existingSale.status}`,
      "Only draft sales can be edited."
    );
  }

  const scope = getPermissionScope(actor, "sales:view_history");
  if (scope === "OWN" && existingSale.createdById !== actor.id) {
    throw new AppError(
      "AUTHORIZATION",
      `Actor ${actor.id} cannot edit sale ${id} owned by ${existingSale.createdById}`,
      "You do not have permission to edit this sale."
    );
  }

  // Customer validation
  let customerId = existingSale.customerId;
  if (input.customerId !== undefined) {
    if (input.customerId === null || input.customerId === "") {
      customerId = null;
    } else {
      const customer = await db.customer.findUnique({ where: { id: input.customerId } });
      if (!customer) {
        throw new AppError("NOT_FOUND", `Customer ${input.customerId} not found`, "Customer not found.");
      }
      if (!customer.isActive) {
        throw new AppError(
          "VALIDATION",
          `Customer ${customer.name} is deactivated`,
          "Cannot attach a deactivated customer to a sale."
        );
      }
      customerId = customer.id;
    }
  }

  let subtotal = existingSale.subtotal;
  let totalDiscount = existingSale.discountAmount;
  let totalAmount = existingSale.totalAmount;
  let preparedItems: Prisma.SaleItemCreateManyInput[] | null = null;

  if (input.items !== undefined) {
    if (input.items.length === 0) {
      throw new AppError("VALIDATION", "Sale must have at least one tyre item", "Sale must contain at least one tyre.");
    }

    const productIds = input.items.map((i) => i.productId);
    const products = await db.product.findMany({
      where: { id: { in: productIds } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));
    const canEditPrices = hasPermission(actor, "prices:edit");

    subtotal = new Prisma.Decimal(0);
    totalDiscount = new Prisma.Decimal(0);
    preparedItems = [];

    for (const item of input.items) {
      const prod = productMap.get(item.productId);
      if (!prod) {
        throw new AppError("NOT_FOUND", `Product ${item.productId} not found`, "Selected tyre does not exist.");
      }
      if (!prod.isActive) {
        throw new AppError(
          "VALIDATION",
          `Product ${prod.brand} ${prod.size} is deactivated`,
          `Cannot sell deactivated product "${prod.brand} ${prod.size}".`
        );
      }

      const qty = Number(item.quantity);
      if (isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
        throw new AppError("VALIDATION", "Invalid sale quantity", "Quantity must be a positive whole number.");
      }

      let unitPriceDecimal: Prisma.Decimal;
      if (item.unitPrice !== undefined && item.unitPrice !== "") {
        const customPrice = new Prisma.Decimal(Number(item.unitPrice));
        if (customPrice.lessThan(0)) {
          throw new AppError("VALIDATION", "Negative unit price", "Selling price cannot be negative.");
        }

        if (!customPrice.equals(prod.unitPrice)) {
          if (!canEditPrices) {
            throw new AppError(
              "AUTHORIZATION",
              `Actor ${actor.id} attempted to change catalog price for ${prod.brand} ${prod.size}`,
              "You do not have permission to modify selling prices."
            );
          }
        }
        unitPriceDecimal = customPrice;
      } else {
        unitPriceDecimal = prod.unitPrice;
      }

      let discountDecimal = new Prisma.Decimal(0);
      if (item.discountAmount !== undefined && item.discountAmount !== "") {
        discountDecimal = new Prisma.Decimal(Number(item.discountAmount));
        if (discountDecimal.lessThan(0)) {
          throw new AppError("VALIDATION", "Negative discount", "Discount cannot be negative.");
        }
      }

      const lineSubtotal = unitPriceDecimal.mul(qty);
      const lineTotal = lineSubtotal.sub(discountDecimal);
      if (lineTotal.lessThan(0)) {
        throw new AppError("VALIDATION", "Discount exceeds line subtotal", "Item discount cannot exceed line total.");
      }

      subtotal = subtotal.add(lineSubtotal);
      totalDiscount = totalDiscount.add(discountDecimal);

      preparedItems.push({
        saleId: id,
        productId: prod.id,
        quantity: qty,
        unitPrice: unitPriceDecimal,
        costPrice: prod.averageCostPrice,
        discountAmount: discountDecimal,
        totalPrice: lineTotal,
      });
    }

    totalAmount = subtotal.sub(totalDiscount);
  }

  const updatedSale = await db.$transaction(async (tx) => {
    if (preparedItems !== null) {
      // Replace items
      await tx.saleItem.deleteMany({ where: { saleId: id } });
      await tx.saleItem.createMany({ data: preparedItems });
    }

    const updated = await tx.sale.update({
      where: { id },
      data: {
        customerId,
        notes: input.notes !== undefined ? (input.notes ? input.notes.trim() : null) : undefined,
        subtotal,
        discountAmount: totalDiscount,
        totalAmount,
      },
      include: {
        items: {
          include: { product: true },
        },
        customer: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        entityName: "Sale",
        entityId: id,
        action: "SALE_DRAFT_UPDATED",
        newState: {
          invoiceNumber: updated.invoiceNumber,
          customerId: updated.customerId,
          totalAmount: updated.totalAmount.toString(),
        },
      },
    });

    return updated;
  });

  return updatedSale;
}

/**
 * Confirms and finalizes a Draft Sale:
 * - Re-validates sale state, user authorization, and scoped permissions.
 * - Idempotently handles already completed sales (returns existing completed sale without duplicate effects).
 * - Enforces atomic transaction for:
 *   1. Product-level stock check (sufficient stock required).
 *   2. Atomic conditional decrement of physical stock (quantityOnHand).
 *   3. Immutable SALE InventoryMovement generation (with before and after balances).
 *   4. Historical cost capture on SaleItem (product.averageCostPrice).
 *   5. Final exact Decimal calculations (subtotal, totalDiscount, totalAmount).
 *   6. Status transition: DRAFT -> COMPLETED.
 *   7. Audit log creation: SALE_CONFIRMED.
 * - Concurrency protection: If another transaction consumes the stock first, the conditional decrement fails
 *   and rolls back the entire transaction.
 */
export async function confirmSale(id: string, actor: AuthActor) {
  requirePermission(actor, "sales:create");

  const scope = getPermissionScope(actor, "sales:view_history");

  return await db.$transaction(async (tx) => {
    // 1. Fetch sale record inside transaction
    const sale = await tx.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: { product: true },
        },
      },
    });

    if (!sale) {
      throw new AppError("NOT_FOUND", `Sale ${id} not found`, "Sale record not found.");
    }

    // IDOR / Scoped permission check
    if (scope === "OWN" && sale.createdById !== actor.id) {
      throw new AppError(
        "AUTHORIZATION",
        `Actor ${actor.id} cannot confirm sale created by ${sale.createdById}`,
        "You do not have permission to confirm this sale."
      );
    }

    // Idempotency check: If already completed, return existing completed sale safely
    if (sale.status === "COMPLETED") {
      return sale;
    }

    if (sale.status === "VOIDED") {
      throw new AppError(
        "VALIDATION",
        `Cannot confirm voided sale ${sale.invoiceNumber}`,
        "This sale has been voided and cannot be confirmed."
      );
    }

    if (sale.status !== "DRAFT") {
      throw new AppError(
        "VALIDATION",
        `Invalid status ${sale.status} for confirmation on ${sale.invoiceNumber}`,
        `Cannot confirm sale with status ${sale.status}.`
      );
    }

    if (!sale.items || sale.items.length === 0) {
      throw new AppError(
        "VALIDATION",
        `Sale ${sale.invoiceNumber} has no items`,
        "Cannot confirm an empty sale with no tyres."
      );
    }

    // Group items by productId to aggregate total quantities required per product
    const productQuantities = new Map<string, number>();
    for (const item of sale.items) {
      if (item.quantity <= 0 || !Number.isInteger(item.quantity)) {
        throw new AppError(
          "VALIDATION",
          `Invalid item quantity ${item.quantity} in sale ${sale.invoiceNumber}`,
          "Sale item contains an invalid tyre quantity."
        );
      }
      const currentAgg = productQuantities.get(item.productId) ?? 0;
      productQuantities.set(item.productId, currentAgg + item.quantity);
    }

    // Deduct inventory and record InventoryMovements
    for (const [productId, requiredQty] of productQuantities.entries()) {
      const product = await tx.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new AppError(
          "NOT_FOUND",
          `Product ${productId} in sale ${sale.invoiceNumber} not found`,
          "One of the tyres in this sale no longer exists."
        );
      }

      if (!product.isActive) {
        throw new AppError(
          "VALIDATION",
          `Product ${product.brand} ${product.size} is deactivated`,
          `Cannot complete sale: tyre "${product.brand} ${product.size}" has been deactivated.`
        );
      }

      if (product.quantityOnHand < requiredQty) {
        throw new AppError(
          "VALIDATION",
          `Insufficient stock for product ${product.brand} ${product.size}: available=${product.quantityOnHand}, required=${requiredQty}`,
          `Insufficient stock for "${product.brand} ${product.size}". Only ${product.quantityOnHand} available in stock, but ${requiredQty} requested.`
        );
      }

      // Atomic conditional decrement to protect against concurrent sales
      const updateResult = await tx.product.updateMany({
        where: {
          id: productId,
          quantityOnHand: { gte: requiredQty },
        },
        data: {
          quantityOnHand: { decrement: requiredQty },
        },
      });

      if (updateResult.count === 0) {
        throw new AppError(
          "VALIDATION",
          `Concurrent stock conflict on product ${product.brand} ${product.size}`,
          `Stock was modified by another transaction for "${product.brand} ${product.size}". Please retry.`
        );
      }

      const balanceAfter = product.quantityOnHand - requiredQty;

      // Create immutable SALE InventoryMovement
      await tx.inventoryMovement.create({
        data: {
          productId,
          movementType: "SALE",
          quantityDelta: -requiredQty,
          balanceAfter,
          referenceType: "Sale",
          referenceId: sale.id,
          reason: `Sale ${sale.invoiceNumber}`,
          actorId: actor.id,
        },
      });
    }

    // Recompute exact Decimal totals & preserve historical cost
    let subtotal = new Prisma.Decimal(0);
    let totalDiscount = new Prisma.Decimal(0);

    for (const item of sale.items) {
      const lineSubtotal = item.unitPrice.mul(item.quantity);
      const lineTotal = lineSubtotal.sub(item.discountAmount);
      if (lineTotal.lessThan(0)) {
        throw new AppError("VALIDATION", "Negative line total", "Sale item line total cannot be negative.");
      }

      subtotal = subtotal.add(lineSubtotal);
      totalDiscount = totalDiscount.add(item.discountAmount);

      // If costPrice was 0, capture product's moving-average cost price
      if (item.costPrice.equals(0) && item.product.averageCostPrice.greaterThan(0)) {
        await tx.saleItem.update({
          where: { id: item.id },
          data: { costPrice: item.product.averageCostPrice },
        });
      }
    }

    const totalAmount = subtotal.sub(totalDiscount);

    // Finalize Sale status to COMPLETED
    const completedSale = await tx.sale.update({
      where: { id },
      data: {
        status: "COMPLETED",
        subtotal,
        discountAmount: totalDiscount,
        totalAmount,
        updatedAt: new Date(),
      },
      include: {
        customer: true,
        createdBy: {
          select: { id: true, fullName: true, username: true },
        },
        items: {
          include: { product: true },
        },
      },
    });

    // Create AuditLog record
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        entityName: "Sale",
        entityId: id,
        action: "SALE_CONFIRMED",
        oldState: {
          status: "DRAFT",
          invoiceNumber: sale.invoiceNumber,
        },
        newState: {
          status: "COMPLETED",
          invoiceNumber: completedSale.invoiceNumber,
          totalAmount: totalAmount.toString(),
          itemCount: completedSale.items?.length ?? sale.items.length,
          totalQuantity: (completedSale.items ?? sale.items).reduce((s, i) => s + i.quantity, 0),
        },
      },
    });

    return completedSale;
  });
}
