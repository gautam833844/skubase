import { db } from "@/lib/db";
import { requirePermission, hasPermission, type AuthActor } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors";
import { Prisma } from "@prisma/client";
import {
  type SupplierFilters,
  type CreateSupplierInput,
  type UpdateSupplierInput,
} from "@/lib/types/purchases";

// =============================================================================
// Skubase — Supplier Service
// =============================================================================

export { type SupplierFilters, type CreateSupplierInput, type UpdateSupplierInput };

/**
 * Lists suppliers with search, status filtering, and pagination.
 */
export async function listSuppliers(filters: SupplierFilters = {}, actor: AuthActor) {
  // Allow suppliers:manage, or staff with purchases:create/purchases:receive for dropdowns
  const canManage = hasPermission(actor, "suppliers:manage");
  const canReceive = hasPermission(actor, "purchases:receive");

  if (!canManage && !canReceive) {
    throw new AppError(
      "AUTHORIZATION",
      "Actor lacks permission to view suppliers",
      "You do not have permission to view suppliers."
    );
  }

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  const skip = (page - 1) * limit;

  const whereClause: Prisma.SupplierWhereInput = {};

  if (filters.status === "ACTIVE" || !filters.status) {
    whereClause.isActive = true;
  } else if (filters.status === "INACTIVE") {
    whereClause.isActive = false;
  }

  if (filters.search && filters.search.trim()) {
    const searchTerms = filters.search.trim().split(/\s+/);
    whereClause.AND = searchTerms.map((term) => ({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { contactPerson: { contains: term, mode: "insensitive" } },
        { phoneNumber: { contains: term, mode: "insensitive" } },
        { whatsappNumber: { contains: term, mode: "insensitive" } },
      ],
    }));
  }

  const [suppliers, totalCount, activeCount] = await Promise.all([
    db.supplier.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { purchaseOrders: true, purchaseReceipts: true },
        },
      },
      orderBy: { name: "asc" },
      skip,
      take: limit,
    }),
    db.supplier.count({ where: whereClause }),
    db.supplier.count({ where: { isActive: true } }),
  ]);

  return {
    suppliers,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
    metrics: {
      totalActiveSuppliers: activeCount,
      totalSuppliers: totalCount,
    },
  };
}

/**
 * Retrieves a single supplier by ID with purchase history summary.
 */
export async function getSupplierById(id: string, actor: AuthActor) {
  const canManage = hasPermission(actor, "suppliers:manage");
  const canReceive = hasPermission(actor, "purchases:receive");

  if (!canManage && !canReceive) {
    throw new AppError(
      "AUTHORIZATION",
      "Actor lacks permission to view supplier details",
      "You do not have permission to view supplier details."
    );
  }

  const supplier = await db.supplier.findUnique({
    where: { id },
    include: {
      purchaseOrders: {
        orderBy: { orderDate: "desc" },
        take: 10,
        include: {
          items: {
            include: { product: true },
          },
        },
      },
      purchaseReceipts: {
        orderBy: { receivedDate: "desc" },
        take: 10,
        include: {
          items: {
            include: { product: true },
          },
        },
      },
    },
  });

  if (!supplier) {
    throw new AppError("NOT_FOUND", `Supplier ${id} not found`, "Supplier not found.");
  }

  return supplier;
}

/**
 * Creates a new supplier.
 */
export async function createSupplier(input: CreateSupplierInput, actor: AuthActor) {
  requirePermission(actor, "suppliers:manage");

  const name = input.name?.trim();
  if (!name) {
    throw new AppError("VALIDATION", "Supplier name is required", "Please enter a supplier name.");
  }

  const supplier = await db.$transaction(async (tx) => {
    const created = await tx.supplier.create({
      data: {
        name,
        contactPerson: input.contactPerson?.trim() || null,
        phoneNumber: input.phoneNumber?.trim() || null,
        whatsappNumber: input.whatsappNumber?.trim() || null,
        gstNumber: input.gstNumber?.trim() || null,
        address: input.address?.trim() || null,
        notes: input.notes?.trim() || null,
        isActive: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        entityName: "Supplier",
        entityId: created.id,
        action: "SUPPLIER_CREATED",
        newState: {
          name: created.name,
          phoneNumber: created.phoneNumber,
          contactPerson: created.contactPerson,
        },
      },
    });

    return created;
  });

  return supplier;
}

/**
 * Updates supplier details.
 */
export async function updateSupplier(id: string, input: UpdateSupplierInput, actor: AuthActor) {
  requirePermission(actor, "suppliers:manage");

  const existing = await db.supplier.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("NOT_FOUND", `Supplier ${id} not found`, "Supplier not found.");
  }

  const updateData: Prisma.SupplierUpdateInput = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new AppError("VALIDATION", "Supplier name cannot be empty", "Supplier name is required.");
    updateData.name = name;
  }
  if (input.contactPerson !== undefined) {
    updateData.contactPerson = input.contactPerson ? input.contactPerson.trim() : null;
  }
  if (input.phoneNumber !== undefined) {
    updateData.phoneNumber = input.phoneNumber ? input.phoneNumber.trim() : null;
  }
  if (input.whatsappNumber !== undefined) {
    updateData.whatsappNumber = input.whatsappNumber ? input.whatsappNumber.trim() : null;
  }
  if (input.gstNumber !== undefined) {
    updateData.gstNumber = input.gstNumber ? input.gstNumber.trim() : null;
  }
  if (input.address !== undefined) {
    updateData.address = input.address ? input.address.trim() : null;
  }
  if (input.notes !== undefined) {
    updateData.notes = input.notes ? input.notes.trim() : null;
  }

  const updated = await db.$transaction(async (tx) => {
    const res = await tx.supplier.update({
      where: { id },
      data: updateData,
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        entityName: "Supplier",
        entityId: id,
        action: "SUPPLIER_UPDATED",
        oldState: { name: existing.name, phoneNumber: existing.phoneNumber },
        newState: { name: res.name, phoneNumber: res.phoneNumber },
      },
    });

    return res;
  });

  return updated;
}

/**
 * Soft deactivates a supplier without deleting historical purchases or receipts.
 */
export async function deactivateSupplier(id: string, actor: AuthActor) {
  requirePermission(actor, "suppliers:manage");

  const existing = await db.supplier.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("NOT_FOUND", `Supplier ${id} not found`, "Supplier not found.");
  }

  const updated = await db.$transaction(async (tx) => {
    const res = await tx.supplier.update({
      where: { id },
      data: { isActive: false },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        entityName: "Supplier",
        entityId: id,
        action: "SUPPLIER_DEACTIVATED",
      },
    });

    return res;
  });

  return updated;
}

/**
 * Reactivates a deactivated supplier.
 */
export async function reactivateSupplier(id: string, actor: AuthActor) {
  requirePermission(actor, "suppliers:manage");

  const existing = await db.supplier.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("NOT_FOUND", `Supplier ${id} not found`, "Supplier not found.");
  }

  const updated = await db.$transaction(async (tx) => {
    const res = await tx.supplier.update({
      where: { id },
      data: { isActive: true },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        entityName: "Supplier",
        entityId: id,
        action: "SUPPLIER_REACTIVATED",
      },
    });

    return res;
  });

  return updated;
}
