import { db } from "@/lib/db";
import { requirePermission, hasPermission, type AuthActor } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors";
import { Prisma } from "@prisma/client";
import {
  type ProductFilters,
  type CreateProductInput,
  type UpdateProductInput,
  type AdjustStockInput,
  type MovementFilters,
  type AdjustmentType,
  type AdjustmentReason,
  CONTROLLED_ADJUSTMENT_REASONS,
} from "@/lib/types/inventory";

export {
  type ProductFilters,
  type CreateProductInput,
  type UpdateProductInput,
  type AdjustStockInput,
  type MovementFilters,
  type AdjustmentType,
  type AdjustmentReason,
  CONTROLLED_ADJUSTMENT_REASONS,
};

/**
 * Normalizes tyre strings (e.g., trims excess whitespace).
 */
export function normalizeTyreAttribute(val: string | undefined | null): string {
  if (!val) return "";
  return val.trim();
}

/**
 * Lists products with filtering, search, sorting, and stock metrics.
 */
export async function listProducts(filters: ProductFilters = {}, actor: AuthActor) {
  requirePermission(actor, "inventory:view");

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  const skip = (page - 1) * limit;

  const whereClause: Prisma.ProductWhereInput = {};

  // Status filter
  if (filters.status === "ACTIVE" || !filters.status) {
    whereClause.isActive = true;
  } else if (filters.status === "INACTIVE") {
    whereClause.isActive = false;
  }
  // If ALL, no isActive filter applied

  // Brand / Size / Pattern filters
  if (filters.brand) {
    whereClause.brand = { equals: filters.brand.trim(), mode: "insensitive" };
  }
  if (filters.size) {
    whereClause.size = { equals: filters.size.trim(), mode: "insensitive" };
  }
  if (filters.pattern) {
    whereClause.pattern = { equals: filters.pattern.trim(), mode: "insensitive" };
  }

  // Search filter across brand, size, pattern
  if (filters.search && filters.search.trim()) {
    const searchTerms = filters.search.trim().split(/\s+/);
    whereClause.AND = searchTerms.map((term) => ({
      OR: [
        { brand: { contains: term, mode: "insensitive" } },
        { size: { contains: term, mode: "insensitive" } },
        { pattern: { contains: term, mode: "insensitive" } },
      ],
    }));
  }

  // Fetch products and total count
  const [products, totalCount, activeMetrics] = await Promise.all([
    db.product.findMany({
      where: whereClause,
      orderBy: {
        [filters.sortBy ?? "brand"]: filters.sortOrder ?? "asc",
      },
      skip,
      take: limit,
    }),
    db.product.count({ where: whereClause }),
    db.product.aggregate({
      where: { isActive: true },
      _sum: { quantityOnHand: true },
      _count: { id: true },
    }),
  ]);

  // Calculate summary counts
  const totalPhysicalTyres = activeMetrics._sum.quantityOnHand ?? 0;
  const totalActiveProducts = activeMetrics._count.id ?? 0;

  // Filter low stock if requested in memory or query
  let resultProducts = products;
  if (filters.lowStockOnly) {
    resultProducts = products.filter((p) => p.quantityOnHand <= p.minStockAlert);
  }

  return {
    products: resultProducts,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
    metrics: {
      totalPhysicalTyres,
      totalActiveProducts,
    },
  };
}

/**
 * Retrieves a single product by ID with its recent movement history.
 */
export async function getProductById(id: string, actor: AuthActor) {
  requirePermission(actor, "inventory:view");

  const product = await db.product.findUnique({
    where: { id },
    include: {
      inventoryMovements: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!product) {
    throw new AppError("NOT_FOUND", `Product with id ${id} not found`, "Product not found.");
  }

  return product;
}

/**
 * Creates a new tyre product. If initialQuantity > 0 is supplied,
 * creates the product and an initial ADJUSTMENT_IN ledger movement atomically.
 */
export async function createProduct(input: CreateProductInput, actor: AuthActor) {
  requirePermission(actor, "inventory:view");

  const brand = normalizeTyreAttribute(input.brand);
  const size = normalizeTyreAttribute(input.size);
  const pattern = normalizeTyreAttribute(input.pattern);

  if (!brand) {
    throw new AppError("VALIDATION", "Brand is required", "Please enter a tyre brand.");
  }
  if (!size) {
    throw new AppError("VALIDATION", "Size is required", "Please enter a tyre size (e.g. 195/65 R15).");
  }

  const numPrice = Number(input.unitPrice);
  if (isNaN(numPrice) || numPrice < 0) {
    throw new AppError("VALIDATION", "Invalid unit price", "Selling price must be a positive number.");
  }

  const numCost = input.averageCostPrice !== undefined ? Number(input.averageCostPrice) : 0;
  if (isNaN(numCost) || numCost < 0) {
    throw new AppError("VALIDATION", "Invalid cost price", "Cost price cannot be negative.");
  }

  const minStockAlert = input.minStockAlert !== undefined ? Number(input.minStockAlert) : 4;
  if (isNaN(minStockAlert) || minStockAlert < 0) {
    throw new AppError("VALIDATION", "Invalid min stock alert", "Min stock alert cannot be negative.");
  }

  const initialQty = input.initialQuantity !== undefined ? Number(input.initialQuantity) : 0;
  if (isNaN(initialQty) || initialQty < 0) {
    throw new AppError("VALIDATION", "Invalid initial quantity", "Initial quantity cannot be negative.");
  }

  try {
    const result = await db.$transaction(async (tx) => {
      // 1. Create product
      const product = await tx.product.create({
        data: {
          brand,
          size,
          pattern,
          unitPrice: new Prisma.Decimal(numPrice),
          averageCostPrice: new Prisma.Decimal(numCost),
          quantityOnHand: initialQty,
          minStockAlert,
          notes: input.notes?.trim() ?? null,
          isActive: true,
        },
      });

      // 2. If initial stock is recorded, log initial ledger movement
      if (initialQty > 0) {
        await tx.inventoryMovement.create({
          data: {
            productId: product.id,
            movementType: "ADJUSTMENT_IN",
            quantityDelta: initialQty,
            balanceAfter: initialQty,
            referenceType: "INITIAL_STOCK",
            reason: input.initialReason?.trim() || "Initial stock on product onboarding",
            actorId: actor.id,
          },
        });
      }

      // 3. Create Audit Log
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          entityName: "Product",
          entityId: product.id,
          action: "PRODUCT_CREATED",
          newState: {
            brand: product.brand,
            size: product.size,
            pattern: product.pattern,
            unitPrice: product.unitPrice.toString(),
            initialStock: initialQty,
          },
        },
      });

      return product;
    });

    return result;
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        "VALIDATION",
        `Duplicate product constraint violated for (${brand}, ${size}, ${pattern})`,
        `A product with Brand "${brand}", Size "${size}", and Pattern "${pattern}" already exists.`
      );
    }
    throw error;
  }
}

/**
 * Updates product details (price, alert threshold, notes).
 * Does not rewrite historical sales or movements.
 */
export async function updateProduct(id: string, input: UpdateProductInput, actor: AuthActor) {
  requirePermission(actor, "inventory:view");

  const existing = await db.product.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("NOT_FOUND", `Product with id ${id} not found`, "Product not found.");
  }

  const updateData: Prisma.ProductUpdateInput = {};

  if (input.brand !== undefined) {
    const brand = normalizeTyreAttribute(input.brand);
    if (!brand) throw new AppError("VALIDATION", "Brand is required", "Brand cannot be empty.");
    updateData.brand = brand;
  }

  if (input.size !== undefined) {
    const size = normalizeTyreAttribute(input.size);
    if (!size) throw new AppError("VALIDATION", "Size is required", "Size cannot be empty.");
    updateData.size = size;
  }

  if (input.pattern !== undefined) {
    updateData.pattern = normalizeTyreAttribute(input.pattern);
  }

  if (input.unitPrice !== undefined) {
    // Only users with prices:edit permission can change selling price
    if (!hasPermission(actor, "prices:edit")) {
      throw new AppError(
        "AUTHORIZATION",
        "Actor lacks prices:edit permission",
        "You do not have permission to modify selling prices."
      );
    }

    const price = Number(input.unitPrice);
    if (isNaN(price) || price < 0) {
      throw new AppError("VALIDATION", "Invalid unit price", "Selling price must be a non-negative number.");
    }
    updateData.unitPrice = new Prisma.Decimal(price);
  }

  if (input.minStockAlert !== undefined) {
    const alert = Number(input.minStockAlert);
    if (isNaN(alert) || alert < 0) {
      throw new AppError("VALIDATION", "Invalid min stock alert", "Min stock alert cannot be negative.");
    }
    updateData.minStockAlert = alert;
  }

  if (input.notes !== undefined) {
    updateData.notes = input.notes ? input.notes.trim() : null;
  }

  try {
    const updated = await db.product.update({
      where: { id },
      data: updateData,
    });

    await db.auditLog.create({
      data: {
        actorId: actor.id,
        entityName: "Product",
        entityId: id,
        action: "PRODUCT_UPDATED",
        oldState: {
          brand: existing.brand,
          size: existing.size,
          pattern: existing.pattern,
          unitPrice: existing.unitPrice.toString(),
        },
        newState: {
          brand: updated.brand,
          size: updated.size,
          pattern: updated.pattern,
          unitPrice: updated.unitPrice.toString(),
        },
      },
    });

    return updated;
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        "VALIDATION",
        "Duplicate product identity violation on update",
        "A tyre with this Brand, Size, and Pattern already exists."
      );
    }
    throw error;
  }
}

/**
 * Soft deactivates a product. Preserves all historical sales & movement data.
 */
export async function deactivateProduct(id: string, actor: AuthActor) {
  requirePermission(actor, "inventory:view");

  const existing = await db.product.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("NOT_FOUND", `Product with id ${id} not found`, "Product not found.");
  }

  const updated = await db.product.update({
    where: { id },
    data: { isActive: false },
  });

  await db.auditLog.create({
    data: {
      actorId: actor.id,
      entityName: "Product",
      entityId: id,
      action: "PRODUCT_DEACTIVATED",
    },
  });

  return updated;
}

/**
 * Reactivates a previously soft-deactivated product.
 */
export async function reactivateProduct(id: string, actor: AuthActor) {
  requirePermission(actor, "inventory:view");

  const existing = await db.product.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("NOT_FOUND", `Product with id ${id} not found`, "Product not found.");
  }

  const updated = await db.product.update({
    where: { id },
    data: { isActive: true },
  });

  await db.auditLog.create({
    data: {
      actorId: actor.id,
      entityName: "Product",
      entityId: id,
      action: "PRODUCT_REACTIVATED",
    },
  });

  return updated;
}

/**
 * Performs a controlled manual stock adjustment with concurrency protection
 * and immutable ledger movement generation.
 */
export async function adjustStock(input: AdjustStockInput, actor: AuthActor) {
  // 1. Enforce inventory:adjust permission (Owner only)
  requirePermission(actor, "inventory:adjust");

  if (!input.productId) {
    throw new AppError("VALIDATION", "Product ID is required", "Please select a product to adjust.");
  }

  const reason = input.reason?.trim();
  if (!reason) {
    throw new AppError(
      "VALIDATION",
      "Adjustment reason is required",
      "Please select or provide a reason for the stock adjustment."
    );
  }

  const formattedReason = input.notes?.trim()
    ? `${reason}: ${input.notes.trim()}`
    : reason;

  return await db.$transaction(async (tx) => {
    // 2. Fetch current product record inside transaction
    const product = await tx.product.findUnique({
      where: { id: input.productId },
    });

    if (!product) {
      throw new AppError(
        "NOT_FOUND",
        `Product ${input.productId} not found during adjustment`,
        "The selected product was not found."
      );
    }

    const currentQty = product.quantityOnHand;
    let delta = 0;
    let balanceAfter = currentQty;

    // 3. Compute delta based on adjustment type
    if (input.adjustmentType === "ADD") {
      const qty = Number(input.quantity);
      if (isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
        throw new AppError(
          "VALIDATION",
          "Invalid quantity to add",
          "Quantity to add must be a whole positive number."
        );
      }
      delta = qty;
      balanceAfter = currentQty + delta;
    } else if (input.adjustmentType === "REMOVE") {
      const qty = Number(input.quantity);
      if (isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
        throw new AppError(
          "VALIDATION",
          "Invalid quantity to remove",
          "Quantity to remove must be a whole positive number."
        );
      }
      delta = -qty;
      balanceAfter = currentQty + delta;
    } else if (input.adjustmentType === "SET_ACTUAL") {
      const actual = Number(input.actualCount);
      if (isNaN(actual) || actual < 0 || !Number.isInteger(actual)) {
        throw new AppError(
          "VALIDATION",
          "Invalid actual count",
          "Actual stock count must be a non-negative whole number."
        );
      }
      delta = actual - currentQty;
      balanceAfter = actual;
    } else {
      throw new AppError(
        "VALIDATION",
        `Unknown adjustment type: ${input.adjustmentType}`,
        "Invalid adjustment type."
      );
    }

    // 4. Strict Negative Stock Prevention
    if (balanceAfter < 0) {
      throw new AppError(
        "VALIDATION",
        `Adjustment would produce negative stock (${currentQty} + ${delta} = ${balanceAfter})`,
        `Cannot remove ${Math.abs(delta)} tyres. Only ${currentQty} tyre(s) currently in stock.`
      );
    }

    // If delta is 0 (no actual change), return without writing redundant movement
    if (delta === 0) {
      return {
        product,
        movement: null,
        message: "No stock change needed. Physical count matches system count.",
      };
    }

    // 5. Update cached quantityOnHand on product
    const updatedProduct = await tx.product.update({
      where: { id: product.id },
      data: { quantityOnHand: balanceAfter },
    });

    // 6. Create immutable ledger movement record
    const movement = await tx.inventoryMovement.create({
      data: {
        productId: product.id,
        movementType: delta > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
        quantityDelta: delta,
        balanceAfter,
        referenceType: "MANUAL_ADJUSTMENT",
        reason: formattedReason,
        actorId: actor.id,
      },
    });

    // 7. Record security audit log
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        entityName: "Product",
        entityId: product.id,
        action: "STOCK_ADJUSTED",
        oldState: { quantityOnHand: currentQty },
        newState: {
          quantityOnHand: balanceAfter,
          delta,
          reason: formattedReason,
          movementId: movement.id,
        },
      },
    });

    return {
      product: updatedProduct,
      movement,
      message: `Stock successfully adjusted from ${currentQty} to ${balanceAfter} (${delta > 0 ? "+" : ""}${delta}).`,
    };
  });
}

/**
 * Lists inventory movements with filtering and pagination.
 */
export async function listInventoryMovements(filters: MovementFilters = {}, actor: AuthActor) {
  requirePermission(actor, "inventory:view");

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  const skip = (page - 1) * limit;

  const whereClause: Prisma.InventoryMovementWhereInput = {};

  if (filters.productId) {
    whereClause.productId = filters.productId;
  }
  if (filters.actorId) {
    whereClause.actorId = filters.actorId;
  }

  const [movements, totalCount] = await Promise.all([
    db.inventoryMovement.findMany({
      where: whereClause,
      include: {
        product: {
          select: {
            id: true,
            brand: true,
            size: true,
            pattern: true,
          },
        },
        actor: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.inventoryMovement.count({ where: whereClause }),
  ]);

  return {
    movements,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
}
