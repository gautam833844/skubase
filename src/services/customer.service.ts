import { db } from "@/lib/db";
import { requirePermission, type AuthActor } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors";
import { Prisma } from "@prisma/client";
import {
  type CustomerFilters,
  type CreateCustomerInput,
  type UpdateCustomerInput,
} from "@/lib/types/sales";

// =============================================================================
// Skubase — Customer Service
// =============================================================================

export {
  type CustomerFilters,
  type CreateCustomerInput,
  type UpdateCustomerInput,
};

/**
 * Lists customers with search across Name, Phone, Vehicle Number, status filter, and pagination.
 */
export async function listCustomers(filters: CustomerFilters = {}, actor: AuthActor) {
  requirePermission(actor, "customers:manage");

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  const skip = (page - 1) * limit;

  const whereClause: Prisma.CustomerWhereInput = {};

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
        { phoneNumber: { contains: term, mode: "insensitive" } },
        { vehicleNumber: { contains: term, mode: "insensitive" } },
        { vehicleModel: { contains: term, mode: "insensitive" } },
      ],
    }));
  }

  const [customers, totalCount, activeCount] = await Promise.all([
    db.customer.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { sales: true },
        },
      },
      orderBy: { name: "asc" },
      skip,
      take: limit,
    }),
    db.customer.count({ where: whereClause }),
    db.customer.count({ where: { isActive: true } }),
  ]);

  return {
    customers,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
    metrics: {
      totalActiveCustomers: activeCount,
      totalCustomers: totalCount,
    },
  };
}

/**
 * Retrieves a customer by ID with sales history.
 */
export async function getCustomerById(id: string, actor: AuthActor) {
  requirePermission(actor, "customers:manage");

  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      sales: {
        orderBy: { saleDate: "desc" },
        include: {
          items: {
            include: { product: true },
          },
        },
      },
      _count: {
        select: { sales: true },
      },
    },
  });

  if (!customer) {
    throw new AppError("NOT_FOUND", `Customer ${id} not found`, "Customer not found.");
  }

  return customer;
}

/**
 * Creates a new customer record.
 */
export async function createCustomer(input: CreateCustomerInput, actor: AuthActor) {
  requirePermission(actor, "customers:manage");

  const name = input.name?.trim();
  if (!name) {
    throw new AppError("VALIDATION", "Customer name is required", "Please enter a customer name.");
  }

  const customer = await db.$transaction(async (tx) => {
    const created = await tx.customer.create({
      data: {
        name,
        phoneNumber: input.phoneNumber?.trim() || null,
        vehicleNumber: input.vehicleNumber ? input.vehicleNumber.trim().toUpperCase() : null,
        vehicleModel: input.vehicleModel?.trim() || null,
        address: input.address?.trim() || null,
        notes: input.notes?.trim() || null,
        isActive: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        entityName: "Customer",
        entityId: created.id,
        action: "CUSTOMER_CREATED",
        newState: {
          name: created.name,
          phoneNumber: created.phoneNumber,
          vehicleNumber: created.vehicleNumber,
        },
      },
    });

    return created;
  });

  return customer;
}

/**
 * Updates an existing customer record.
 */
export async function updateCustomer(id: string, input: UpdateCustomerInput, actor: AuthActor) {
  requirePermission(actor, "customers:manage");

  const existing = await db.customer.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("NOT_FOUND", `Customer ${id} not found`, "Customer not found.");
  }

  const updateData: Prisma.CustomerUpdateInput = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new AppError("VALIDATION", "Customer name cannot be empty", "Customer name is required.");
    updateData.name = name;
  }
  if (input.phoneNumber !== undefined) {
    updateData.phoneNumber = input.phoneNumber ? input.phoneNumber.trim() : null;
  }
  if (input.vehicleNumber !== undefined) {
    updateData.vehicleNumber = input.vehicleNumber ? input.vehicleNumber.trim().toUpperCase() : null;
  }
  if (input.vehicleModel !== undefined) {
    updateData.vehicleModel = input.vehicleModel ? input.vehicleModel.trim() : null;
  }
  if (input.address !== undefined) {
    updateData.address = input.address ? input.address.trim() : null;
  }
  if (input.notes !== undefined) {
    updateData.notes = input.notes ? input.notes.trim() : null;
  }

  const updated = await db.$transaction(async (tx) => {
    const res = await tx.customer.update({
      where: { id },
      data: updateData,
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        entityName: "Customer",
        entityId: id,
        action: "CUSTOMER_UPDATED",
        oldState: { name: existing.name, phoneNumber: existing.phoneNumber, vehicleNumber: existing.vehicleNumber },
        newState: { name: res.name, phoneNumber: res.phoneNumber, vehicleNumber: res.vehicleNumber },
      },
    });

    return res;
  });

  return updated;
}

/**
 * Soft deactivates a customer without deleting or affecting historical sales.
 */
export async function deactivateCustomer(id: string, actor: AuthActor) {
  requirePermission(actor, "customers:manage");

  const existing = await db.customer.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("NOT_FOUND", `Customer ${id} not found`, "Customer not found.");
  }

  const updated = await db.$transaction(async (tx) => {
    const res = await tx.customer.update({
      where: { id },
      data: { isActive: false },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        entityName: "Customer",
        entityId: id,
        action: "CUSTOMER_DEACTIVATED",
      },
    });

    return res;
  });

  return updated;
}

/**
 * Reactivates a deactivated customer.
 */
export async function reactivateCustomer(id: string, actor: AuthActor) {
  requirePermission(actor, "customers:manage");

  const existing = await db.customer.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("NOT_FOUND", `Customer ${id} not found`, "Customer not found.");
  }

  const updated = await db.$transaction(async (tx) => {
    const res = await tx.customer.update({
      where: { id },
      data: { isActive: true },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        entityName: "Customer",
        entityId: id,
        action: "CUSTOMER_REACTIVATED",
      },
    });

    return res;
  });

  return updated;
}
