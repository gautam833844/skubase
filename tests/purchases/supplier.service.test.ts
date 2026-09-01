import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deactivateSupplier,
  reactivateSupplier,
} from "@/services/supplier.service";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { Supplier } from "@prisma/client";
import type { AuthActor } from "@/lib/auth/permissions";

vi.mock("@/lib/db", () => {
  return {
    db: {
      supplier: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        return cb(db);
      }),
    },
  };
});

describe("Supplier Service Unit Tests", () => {
  const adminActor: AuthActor = { id: "admin-1", role: "ADMIN_OWNER" };
  const managerActor: AuthActor = { id: "manager-1", role: "MANAGER" };
  const staffActor: AuthActor = { id: "staff-1", role: "STAFF" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Supplier Creation & Validation", () => {
    it("creates a supplier with phone, WhatsApp, and contact person", async () => {
      const mockCreated: Partial<Supplier> = {
        id: "sup-1",
        name: "Metro Tyre Distributors",
        contactPerson: "Ramesh Kumar",
        phoneNumber: "9876543210",
        whatsappNumber: "9876543210",
        gstNumber: "27AABCU9603R1ZM",
        address: "Plot 14, Industrial Area",
        notes: null,
        isActive: true,
      };

      vi.mocked(db.supplier.create).mockResolvedValue(mockCreated as Supplier);

      const result = await createSupplier(
        {
          name: "Metro Tyre Distributors",
          contactPerson: "Ramesh Kumar",
          phoneNumber: "9876543210",
          whatsappNumber: "9876543210",
          gstNumber: "27AABCU9603R1ZM",
          address: "Plot 14, Industrial Area",
        },
        adminActor
      );

      expect(result.id).toBe("sup-1");
      expect(result.name).toBe("Metro Tyre Distributors");
      expect(db.supplier.create).toHaveBeenCalled();
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "SUPPLIER_CREATED" }),
        })
      );
    });

    it("rejects supplier with empty name", async () => {
      await expect(
        createSupplier({ name: "   " }, adminActor)
      ).rejects.toThrow("Supplier name is required");
    });

    it("allows MANAGER to create a supplier (suppliers:manage permission)", async () => {
      vi.mocked(db.supplier.create).mockResolvedValue({
        id: "sup-2",
        name: "Apollo North Agency",
        isActive: true,
      } as Supplier);

      const result = await createSupplier({ name: "Apollo North Agency" }, managerActor);
      expect(result.id).toBe("sup-2");
    });

    it("blocks STAFF from creating a supplier (403 Forbidden)", async () => {
      try {
        await createSupplier({ name: "Unpermitted Supplier" }, staffActor);
        expect.unreachable("Should have thrown 403");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AppError);
        const appErr = err as AppError;
        expect(appErr.statusCode).toBe(403);
      }
    });
  });

  describe("Supplier Updates & Deactivation", () => {
    const existingSupplier: Partial<Supplier> = {
      id: "sup-1",
      name: "Metro Tyre Distributors",
      contactPerson: "Ramesh",
      phoneNumber: "9876543210",
      isActive: true,
    };

    it("updates supplier details", async () => {
      vi.mocked(db.supplier.findUnique).mockResolvedValue(existingSupplier as Supplier);
      vi.mocked(db.supplier.update).mockResolvedValue({
        ...existingSupplier,
        phoneNumber: "9999999999",
      } as Supplier);

      const result = await updateSupplier("sup-1", { phoneNumber: "9999999999" }, adminActor);
      expect(result.phoneNumber).toBe("9999999999");
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "SUPPLIER_UPDATED" }),
        })
      );
    });

    it("soft-deactivates supplier without deleting historical purchases", async () => {
      vi.mocked(db.supplier.findUnique).mockResolvedValue(existingSupplier as Supplier);
      vi.mocked(db.supplier.update).mockResolvedValue({
        ...existingSupplier,
        isActive: false,
      } as Supplier);

      const result = await deactivateSupplier("sup-1", adminActor);
      expect(result.isActive).toBe(false);
      expect(db.supplier.update).toHaveBeenCalledWith({
        where: { id: "sup-1" },
        data: { isActive: false },
      });
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "SUPPLIER_DEACTIVATED" }),
        })
      );
    });

    it("reactivates a supplier", async () => {
      vi.mocked(db.supplier.findUnique).mockResolvedValue({
        ...existingSupplier,
        isActive: false,
      } as Supplier);
      vi.mocked(db.supplier.update).mockResolvedValue({
        ...existingSupplier,
        isActive: true,
      } as Supplier);

      const result = await reactivateSupplier("sup-1", adminActor);
      expect(result.isActive).toBe(true);
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "SUPPLIER_REACTIVATED" }),
        })
      );
    });
  });

  describe("Supplier Listing & Retrieval", () => {
    it("lists suppliers with counts", async () => {
      vi.mocked(db.supplier.findMany).mockResolvedValue([
        {
          id: "sup-1",
          name: "Metro Tyre Distributors",
          isActive: true,
          _count: { purchaseOrders: 5, purchaseReceipts: 3 },
        } as unknown as (Supplier & { _count: { purchaseOrders: number; purchaseReceipts: number } }),
      ]);
      vi.mocked(db.supplier.count).mockResolvedValue(1);

      const result = await listSuppliers({ search: "Metro" }, adminActor);
      expect(result.suppliers).toHaveLength(1);
      expect(result.metrics.totalActiveSuppliers).toBe(1);
    });

    it("retrieves supplier with purchase order history", async () => {
      vi.mocked(db.supplier.findUnique).mockResolvedValue({
        id: "sup-1",
        name: "Metro Tyre Distributors",
        purchaseOrders: [],
        purchaseReceipts: [],
      } as unknown as Supplier);

      const result = await getSupplierById("sup-1", adminActor);
      expect(result.id).toBe("sup-1");
    });
  });
});
