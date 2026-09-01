import { db } from "@/lib/db";
import { requirePermission, hasPermission, type AuthActor } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors";
import { Prisma, type PurchaseOrderStatus } from "@prisma/client";
import {
  type PurchaseOrderFilters,
  type CreatePurchaseOrderInput,
  type CreatePurchaseReceiptInput,
  type PurchaseReceiptFilters,
} from "@/lib/types/purchases";

// =============================================================================
// Skubase — Purchase Order & Receiving Service
// =============================================================================

export {
  type PurchaseOrderFilters,
  type CreatePurchaseOrderInput,
  type CreatePurchaseReceiptInput,
  type PurchaseReceiptFilters,
};

/**
 * Generates the next sequential human-readable PO number (e.g. PO-1001).
 */
export async function generateNextPONumber(): Promise<string> {
  const count = await db.purchaseOrder.count();
  const nextSeq = 1001 + count;
  let candidate = `PO-${nextSeq}`;

  let exists = await db.purchaseOrder.findUnique({ where: { poNumber: candidate } });
  let offset = 1;
  while (exists) {
    candidate = `PO-${nextSeq + offset}`;
    exists = await db.purchaseOrder.findUnique({ where: { poNumber: candidate } });
    offset++;
  }

  return candidate;
}

/**
 * Generates the next sequential human-readable Receipt number (e.g. PR-1001).
 */
export async function generateNextReceiptNumber(): Promise<string> {
  const count = await db.purchaseReceipt.count();
  const nextSeq = 1001 + count;
  let candidate = `PR-${nextSeq}`;

  let exists = await db.purchaseReceipt.findUnique({ where: { receiptNumber: candidate } });
  let offset = 1;
  while (exists) {
    candidate = `PR-${nextSeq + offset}`;
    exists = await db.purchaseReceipt.findUnique({ where: { receiptNumber: candidate } });
    offset++;
  }

  return candidate;
}

/**
 * Lists purchase orders with search, status filtering, and pagination.
 */
export async function listPurchaseOrders(filters: PurchaseOrderFilters = {}, actor: AuthActor) {
  const canCreate = hasPermission(actor, "purchases:create");
  const canReceive = hasPermission(actor, "purchases:receive");

  if (!canCreate && !canReceive) {
    throw new AppError(
      "AUTHORIZATION",
      "Actor lacks permission to view purchase orders",
      "You do not have permission to view purchase orders."
    );
  }

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  const skip = (page - 1) * limit;

  const whereClause: Prisma.PurchaseOrderWhereInput = {};

  if (filters.status && filters.status !== "ALL") {
    whereClause.status = filters.status;
  }
  if (filters.supplierId) {
    whereClause.supplierId = filters.supplierId;
  }

  if (filters.search && filters.search.trim()) {
    const search = filters.search.trim();
    whereClause.OR = [
      { poNumber: { contains: search, mode: "insensitive" } },
      { supplier: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [orders, totalCount, statusCounts] = await Promise.all([
    db.purchaseOrder.findMany({
      where: whereClause,
      include: {
        supplier: {
          select: { id: true, name: true, phoneNumber: true },
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
        _count: {
          select: { receipts: true },
        },
      },
      orderBy: { orderDate: "desc" },
      skip,
      take: limit,
    }),
    db.purchaseOrder.count({ where: whereClause }),
    db.purchaseOrder.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
  ]);

  // Compute total ordered and received quantities for each order
  const enrichedOrders = orders.map((order) => {
    const totalOrdered = order.items.reduce((sum, item) => sum + item.quantityOrdered, 0);
    const totalReceived = order.items.reduce((sum, item) => sum + item.quantityReceived, 0);
    const remaining = totalOrdered - totalReceived;

    return {
      ...order,
      summary: {
        totalOrdered,
        totalReceived,
        remaining,
      },
    };
  });

  return {
    orders: enrichedOrders,
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
 * Retrieves a single purchase order by ID with all item details and receipts history.
 */
export async function getPurchaseOrderById(id: string, actor: AuthActor) {
  const canCreate = hasPermission(actor, "purchases:create");
  const canReceive = hasPermission(actor, "purchases:receive");

  if (!canCreate && !canReceive) {
    throw new AppError(
      "AUTHORIZATION",
      "Actor lacks permission to view purchase order details",
      "You do not have permission to view purchase order details."
    );
  }

  const order = await db.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      createdBy: {
        select: { id: true, fullName: true, username: true },
      },
      items: {
        include: {
          product: true,
        },
      },
      receipts: {
        orderBy: { receivedDate: "desc" },
        include: {
          createdBy: {
            select: { id: true, fullName: true, username: true },
          },
          items: {
            include: {
              product: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new AppError("NOT_FOUND", `Purchase order ${id} not found`, "Purchase order not found.");
  }

  const enrichedItems = order.items.map((item) => ({
    ...item,
    remainingQuantity: Math.max(0, item.quantityOrdered - item.quantityReceived),
  }));

  const totalOrdered = enrichedItems.reduce((sum, item) => sum + item.quantityOrdered, 0);
  const totalReceived = enrichedItems.reduce((sum, item) => sum + item.quantityReceived, 0);
  const remaining = totalOrdered - totalReceived;

  return {
    ...order,
    items: enrichedItems,
    summary: {
      totalOrdered,
      totalReceived,
      remaining,
    },
  };
}

/**
 * Creates a new purchase order with line items.
 */
export async function createPurchaseOrder(input: CreatePurchaseOrderInput, actor: AuthActor) {
  requirePermission(actor, "purchases:create");

  if (!input.supplierId) {
    throw new AppError("VALIDATION", "Supplier ID is required", "Please select a supplier.");
  }

  if (!input.items || input.items.length === 0) {
    throw new AppError("VALIDATION", "At least one item is required", "Please add at least one tyre to order.");
  }

  const supplier = await db.supplier.findUnique({ where: { id: input.supplierId } });
  if (!supplier) {
    throw new AppError("NOT_FOUND", `Supplier ${input.supplierId} not found`, "Selected supplier not found.");
  }
  if (!supplier.isActive) {
    throw new AppError(
      "VALIDATION",
      `Supplier ${supplier.name} is deactivated`,
      "Cannot create a purchase order for a deactivated supplier."
    );
  }

  // Validate items
  const productIds = input.items.map((i) => i.productId);
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
  });

  const productMap = new Map(products.map((p) => [p.id, p]));

  for (const item of input.items) {
    const prod = productMap.get(item.productId);
    if (!prod) {
      throw new AppError("NOT_FOUND", `Product ${item.productId} not found`, "One of the selected tyres does not exist.");
    }
    if (!prod.isActive) {
      throw new AppError(
        "VALIDATION",
        `Product ${prod.brand} ${prod.size} is deactivated`,
        `Cannot order deactivated product "${prod.brand} ${prod.size}".`
      );
    }
    const qty = Number(item.quantityOrdered);
    if (isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
      throw new AppError("VALIDATION", "Invalid order quantity", "Ordered quantity must be a positive whole number.");
    }
    if (item.unitCost !== undefined) {
      const cost = Number(item.unitCost);
      if (isNaN(cost) || cost < 0) {
        throw new AppError("VALIDATION", "Invalid purchase cost", "Agreed unit cost cannot be negative.");
      }
    }
  }

  const poNumber = await generateNextPONumber();

  const createdOrder = await db.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.create({
      data: {
        poNumber,
        supplierId: input.supplierId,
        orderDate: new Date(),
        status: "ORDERED",
        expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
        notes: input.notes?.trim() || null,
        createdById: actor.id,
        items: {
          create: input.items.map((item) => ({
            productId: item.productId,
            quantityOrdered: Number(item.quantityOrdered),
            quantityReceived: 0,
            unitCost: item.unitCost !== undefined ? new Prisma.Decimal(Number(item.unitCost)) : null,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        entityName: "PurchaseOrder",
        entityId: po.id,
        action: "PURCHASE_ORDER_CREATED",
        newState: {
          poNumber: po.poNumber,
          supplierId: po.supplierId,
          itemCount: po.items.length,
        },
      },
    });

    return po;
  });

  return createdOrder;
}

/**
 * Updates the status of a purchase order (e.g. Cancel order).
 */
export async function updatePurchaseOrderStatus(
  id: string,
  newStatus: PurchaseOrderStatus,
  actor: AuthActor
) {
  requirePermission(actor, "purchases:create");

  const order = await db.purchaseOrder.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!order) {
    throw new AppError("NOT_FOUND", `Purchase order ${id} not found`, "Purchase order not found.");
  }

  const totalReceived = order.items.reduce((sum, item) => sum + item.quantityReceived, 0);

  if (newStatus === "CANCELLED") {
    if (totalReceived > 0) {
      throw new AppError(
        "VALIDATION",
        `Cannot cancel purchase order ${order.poNumber} with ${totalReceived} received items`,
        "Cannot cancel a purchase order that has already received tyres."
      );
    }
  }

  const updated = await db.$transaction(async (tx) => {
    const res = await tx.purchaseOrder.update({
      where: { id },
      data: { status: newStatus },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        entityName: "PurchaseOrder",
        entityId: id,
        action: newStatus === "CANCELLED" ? "PURCHASE_ORDER_CANCELLED" : "PURCHASE_ORDER_UPDATED",
        oldState: { status: order.status },
        newState: { status: newStatus },
      },
    });

    return res;
  });

  return updated;
}

/**
 * Receives goods against a Purchase Order with:
 * - Strict remaining quantity check (rejects over-receiving)
 * - Atomic inventory quantity increase
 * - Atomic moving-weighted average cost recalculation
 * - Immutable InventoryMovement ledger generation
 * - Concurrency protection
 */
export async function receivePurchaseOrder(input: CreatePurchaseReceiptInput, actor: AuthActor) {
  requirePermission(actor, "purchases:receive");

  if (!input.purchaseOrderId) {
    throw new AppError("VALIDATION", "Purchase order ID is required", "Please specify a purchase order.");
  }

  if (!input.items || input.items.length === 0) {
    throw new AppError("VALIDATION", "At least one item to receive is required", "Please specify items to receive.");
  }

  return await db.$transaction(async (tx) => {
    // 1. Fetch Purchase Order with items and supplier
    const order = await tx.purchaseOrder.findUnique({
      where: { id: input.purchaseOrderId },
      include: {
        supplier: true,
        items: {
          include: { product: true },
        },
      },
    });

    if (!order) {
      throw new AppError("NOT_FOUND", `Purchase order ${input.purchaseOrderId} not found`, "Purchase order not found.");
    }

    if (order.status === "CANCELLED") {
      throw new AppError(
        "VALIDATION",
        `Purchase order ${order.poNumber} is cancelled`,
        "Cannot receive goods for a cancelled purchase order."
      );
    }

    if (order.status === "COMPLETED") {
      throw new AppError(
        "VALIDATION",
        `Purchase order ${order.poNumber} is already completed`,
        "This purchase order has already been fully received."
      );
    }

    const itemMap = new Map(order.items.map((i) => [i.id, i]));
    const receiptNumber = await generateNextReceiptNumber();

    // 2. Validate receiving quantities against remaining quantities
    for (const itemInput of input.items) {
      const poItem = itemMap.get(itemInput.purchaseOrderItemId);
      if (!poItem) {
        throw new AppError(
          "VALIDATION",
          `Item ${itemInput.purchaseOrderItemId} does not belong to PO ${order.poNumber}`,
          "Invalid purchase order line item."
        );
      }

      const qty = Number(itemInput.quantityReceived);
      if (isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
        throw new AppError(
          "VALIDATION",
          "Invalid received quantity",
          "Received quantity must be a positive whole number."
        );
      }

      const remaining = poItem.quantityOrdered - poItem.quantityReceived;
      if (qty > remaining) {
        throw new AppError(
          "VALIDATION",
          `Over-receiving attempt on ${poItem.product.brand} ${poItem.product.size}: received=${qty}, remaining=${remaining}`,
          `Cannot receive ${qty} tyres for ${poItem.product.brand} ${poItem.product.size}. Only ${remaining} tyre(s) remaining on order.`
        );
      }
    }

    // 3. Create PurchaseReceipt
    const receipt = await tx.purchaseReceipt.create({
      data: {
        receiptNumber,
        purchaseOrderId: order.id,
        supplierId: order.supplierId,
        receivedDate: new Date(),
        supplierInvoiceNo: input.supplierInvoiceNo?.trim() || null,
        notes: input.notes?.trim() || null,
        createdById: actor.id,
      },
    });

    // 4. Process each received item
    for (const itemInput of input.items) {
      const poItem = itemMap.get(itemInput.purchaseOrderItemId)!;
      const qtyReceived = Number(itemInput.quantityReceived);

      // Determine unit cost: user override, or PO agreed unit cost, or product current avg cost
      let unitCostDecimal: Prisma.Decimal;
      if (itemInput.unitCost !== undefined && itemInput.unitCost !== "") {
        unitCostDecimal = new Prisma.Decimal(Number(itemInput.unitCost));
      } else if (poItem.unitCost !== null) {
        unitCostDecimal = poItem.unitCost;
      } else {
        unitCostDecimal = poItem.product.averageCostPrice;
      }

      // Create PurchaseReceiptItem
      await tx.purchaseReceiptItem.create({
        data: {
          purchaseReceiptId: receipt.id,
          purchaseOrderItemId: poItem.id,
          productId: poItem.productId,
          quantityReceived: qtyReceived,
          unitCost: unitCostDecimal,
        },
      });

      // Update PurchaseOrderItem.quantityReceived
      const updatedItemReceived = poItem.quantityReceived + qtyReceived;
      await tx.purchaseOrderItem.update({
        where: { id: poItem.id },
        data: { quantityReceived: updatedItemReceived },
      });

      // Fetch latest Product state for moving-average calculation
      const product = await tx.product.findUniqueOrThrow({
        where: { id: poItem.productId },
      });

      const oldQty = product.quantityOnHand;
      const oldAvgCost = product.averageCostPrice;
      const newQty = oldQty + qtyReceived;

      // Calculate Moving Weighted Average Cost:
      // newAvgCost = oldQty === 0 ? receivedCost : ((oldQty * oldAvgCost) + (qtyReceived * unitCostDecimal)) / newQty
      let newAvgCost: Prisma.Decimal;
      if (oldQty <= 0) {
        newAvgCost = unitCostDecimal;
      } else {
        const totalOldVal = oldAvgCost.mul(oldQty);
        const totalNewVal = unitCostDecimal.mul(qtyReceived);
        const combinedVal = totalOldVal.add(totalNewVal);
        newAvgCost = combinedVal.div(newQty);
      }

      // Update Product quantityOnHand and moving average cost
      await tx.product.update({
        where: { id: product.id },
        data: {
          quantityOnHand: newQty,
          averageCostPrice: newAvgCost,
        },
      });

      // Record immutable InventoryMovement
      await tx.inventoryMovement.create({
        data: {
          productId: product.id,
          movementType: "PURCHASE_RECEIPT",
          quantityDelta: qtyReceived,
          balanceAfter: newQty,
          referenceType: "PURCHASE_RECEIPT",
          referenceId: receipt.id,
          reason: `Purchase receipt ${receiptNumber} from ${order.supplier.name}`,
          actorId: actor.id,
        },
      });
    }

    // 5. Check if all PO items are fully received
    const allPoItems = await tx.purchaseOrderItem.findMany({
      where: { purchaseOrderId: order.id },
    });

    const isFullyReceived = allPoItems.every(
      (item) => item.quantityReceived >= item.quantityOrdered
    );

    const nextStatus: PurchaseOrderStatus = isFullyReceived ? "COMPLETED" : "PARTIALLY_RECEIVED";

    await tx.purchaseOrder.update({
      where: { id: order.id },
      data: { status: nextStatus },
    });

    // 6. Record AuditLog
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        entityName: "PurchaseReceipt",
        entityId: receipt.id,
        action: "PURCHASE_RECEIVED",
        newState: {
          receiptNumber,
          poNumber: order.poNumber,
          supplierId: order.supplierId,
          itemCount: input.items.length,
          poStatus: nextStatus,
        },
      },
    });

    return {
      receipt,
      receiptNumber,
      poStatus: nextStatus,
      message: `Successfully received goods for ${order.poNumber}. Receipt: ${receiptNumber}.`,
    };
  });
}

/**
 * Lists purchase receipts with pagination.
 */
export async function listPurchaseReceipts(filters: PurchaseReceiptFilters = {}, actor: AuthActor) {
  const canCreate = hasPermission(actor, "purchases:create");
  const canReceive = hasPermission(actor, "purchases:receive");

  if (!canCreate && !canReceive) {
    throw new AppError(
      "AUTHORIZATION",
      "Actor lacks permission to view purchase receipts",
      "You do not have permission to view purchase receipts."
    );
  }

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  const skip = (page - 1) * limit;

  const whereClause: Prisma.PurchaseReceiptWhereInput = {};

  if (filters.purchaseOrderId) {
    whereClause.purchaseOrderId = filters.purchaseOrderId;
  }
  if (filters.supplierId) {
    whereClause.supplierId = filters.supplierId;
  }

  const [receipts, totalCount] = await Promise.all([
    db.purchaseReceipt.findMany({
      where: whereClause,
      include: {
        supplier: {
          select: { id: true, name: true },
        },
        purchaseOrder: {
          select: { id: true, poNumber: true },
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
      orderBy: { receivedDate: "desc" },
      skip,
      take: limit,
    }),
    db.purchaseReceipt.count({ where: whereClause }),
  ]);

  return {
    receipts,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
}
