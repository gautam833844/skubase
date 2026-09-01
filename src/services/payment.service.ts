import { db } from "@/lib/db";
import { requirePermission, getPermissionScope, type AuthActor } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors";
import { Prisma, type PaymentMethod, type PaymentStatus } from "@prisma/client";
import {
  type RecordPaymentInput,
  type SalePaymentDetails,
} from "@/lib/types/payments";

export {
  type RecordPaymentInput,
  type SalePaymentDetails,
};

/**
 * Records a customer payment against a completed sale:
 * - Strictly verifies user authentication & payments:record permission.
 * - Rejects payments against DRAFT or VOIDED sales.
 * - Validates payment amount > 0 and amount <= remaining balance using exact Prisma.Decimal arithmetic.
 * - Generates immutable Payment record with method, reference, and creator.
 * - Atomically recalculates total paid and updates Sale.paymentStatus (UNPAID -> PARTIALLY_PAID -> PAID).
 * - Creates an immutable AuditLog entry (PAYMENT_RECORDED).
 * - Does NOT modify physical inventory or create InventoryMovements.
 */
export async function recordPayment(input: RecordPaymentInput, actor: AuthActor) {
  requirePermission(actor, "payments:record");

  if (!input.saleId) {
    throw new AppError("VALIDATION", "Sale ID is required", "Please specify a sale for this payment.");
  }

  // Parse and validate payment amount
  const rawAmount = Number(input.amount);
  if (isNaN(rawAmount) || rawAmount <= 0) {
    throw new AppError(
      "VALIDATION",
      `Invalid payment amount: ${input.amount}`,
      "Payment amount must be a positive number greater than zero."
    );
  }

  const paymentDecimal = new Prisma.Decimal(rawAmount);

  // Validate payment method
  const validMethods: PaymentMethod[] = [
    "CASH",
    "UPI",
    "CARD",
    "BANK_TRANSFER",
    "CHEQUE",
    "CREDIT",
    "OTHER",
  ];

  if (!validMethods.includes(input.paymentMethod)) {
    throw new AppError(
      "VALIDATION",
      `Invalid payment method: ${input.paymentMethod}`,
      "Please select a valid payment method."
    );
  }

  const scope = getPermissionScope(actor, "sales:view_history");

  return await db.$transaction(async (tx) => {
    // 1. Fetch sale with existing payments inside transaction
    const sale = await tx.sale.findUnique({
      where: { id: input.saleId },
      include: {
        payments: true,
      },
    });

    if (!sale) {
      throw new AppError("NOT_FOUND", `Sale ${input.saleId} not found`, "Sale record not found.");
    }

    // Scoped authorization check
    if (scope === "OWN" && sale.createdById !== actor.id) {
      throw new AppError(
        "AUTHORIZATION",
        `Actor ${actor.id} cannot record payment for sale created by ${sale.createdById}`,
        "You do not have permission to record payments for this sale."
      );
    }

    // 2. Validate sale state
    if (sale.status === "DRAFT") {
      throw new AppError(
        "VALIDATION",
        `Cannot record payment on DRAFT sale ${sale.invoiceNumber}`,
        "Cannot record payment for a draft sale. Please confirm the sale first."
      );
    }

    if (sale.status === "VOIDED") {
      throw new AppError(
        "VALIDATION",
        `Cannot record payment on VOIDED sale ${sale.invoiceNumber}`,
        "Cannot record payment for a voided sale."
      );
    }

    if (sale.status !== "COMPLETED") {
      throw new AppError(
        "VALIDATION",
        `Cannot record payment on sale ${sale.invoiceNumber} with status ${sale.status}`,
        `Cannot record payment for a sale with status "${sale.status}".`
      );
    }

    // 3. Compute current total paid and remaining balance with exact Decimal math
    const currentTotalPaid = sale.payments.reduce(
      (sum, p) => sum.add(p.amount),
      new Prisma.Decimal(0)
    );

    const remainingBalance = sale.totalAmount.sub(currentTotalPaid);

    if (remainingBalance.lessThanOrEqualTo(0)) {
      throw new AppError(
        "VALIDATION",
        `Sale ${sale.invoiceNumber} is already fully paid`,
        "This sale is already fully paid."
      );
    }

    if (paymentDecimal.greaterThan(remainingBalance)) {
      throw new AppError(
        "VALIDATION",
        `Payment amount ₹${paymentDecimal} exceeds remaining balance ₹${remainingBalance} on sale ${sale.invoiceNumber}`,
        `Payment amount (₹${paymentDecimal}) exceeds the remaining balance (₹${remainingBalance}).`
      );
    }

    // 4. Create immutable Payment record
    const payment = await tx.payment.create({
      data: {
        saleId: sale.id,
        amount: paymentDecimal,
        paymentMethod: input.paymentMethod,
        referenceNumber: input.referenceNumber?.trim() || null,
        notes: input.notes?.trim() || null,
        paymentDate: new Date(),
        createdById: actor.id,
      },
      include: {
        createdBy: {
          select: { id: true, fullName: true, username: true },
        },
      },
    });

    // 5. Recalculate new total paid and new remaining balance
    const newTotalPaid = currentTotalPaid.add(paymentDecimal);
    const newRemainingBalance = sale.totalAmount.sub(newTotalPaid);

    let newPaymentStatus: PaymentStatus = "UNPAID";
    if (newTotalPaid.equals(sale.totalAmount)) {
      newPaymentStatus = "PAID";
    } else if (newTotalPaid.greaterThan(0)) {
      newPaymentStatus = "PARTIALLY_PAID";
    }

    // 6. Update Sale payment status
    await tx.sale.update({
      where: { id: sale.id },
      data: {
        paymentStatus: newPaymentStatus,
      },
    });

    // 7. Create AuditLog record
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        entityName: "Payment",
        entityId: payment.id,
        action: "PAYMENT_RECORDED",
        newState: {
          paymentId: payment.id,
          saleId: sale.id,
          invoiceNumber: sale.invoiceNumber,
          amount: paymentDecimal.toString(),
          paymentMethod: input.paymentMethod,
          previousTotalPaid: currentTotalPaid.toString(),
          newTotalPaid: newTotalPaid.toString(),
          remainingBalance: newRemainingBalance.toString(),
          paymentStatus: newPaymentStatus,
        },
      },
    });

    return {
      payment,
      paymentStatus: newPaymentStatus,
      totalPaid: newTotalPaid,
      remainingBalance: newRemainingBalance,
    };
  });
}

/**
 * Retrieves payment history and balance details for a sale.
 */
export async function getSalePayments(saleId: string, actor: AuthActor): Promise<SalePaymentDetails> {
  requirePermission(actor, "payments:view", "OWN");

  const scope = getPermissionScope(actor, "sales:view_history");

  const sale = await db.sale.findUnique({
    where: { id: saleId },
    include: {
      payments: {
        include: {
          createdBy: {
            select: { id: true, fullName: true, username: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!sale) {
    throw new AppError("NOT_FOUND", `Sale ${saleId} not found`, "Sale record not found.");
  }

  if (scope === "OWN" && sale.createdById !== actor.id) {
    throw new AppError(
      "AUTHORIZATION",
      `Actor ${actor.id} cannot view payments for sale created by ${sale.createdById}`,
      "You do not have permission to view payments for this sale."
    );
  }

  const totalPaid = sale.payments.reduce(
    (sum, p) => sum.add(p.amount),
    new Prisma.Decimal(0)
  );

  const remainingBalance = sale.totalAmount.sub(totalPaid);

  return {
    saleId: sale.id,
    invoiceNumber: sale.invoiceNumber,
    saleStatus: sale.status,
    totalAmount: sale.totalAmount,
    totalPaid,
    remainingBalance,
    paymentStatus: sale.paymentStatus,
    payments: sale.payments,
  };
}
