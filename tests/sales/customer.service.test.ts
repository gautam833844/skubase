import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deactivateCustomer,
  reactivateCustomer,
} from "@/services/customer.service";
import { db } from "@/lib/db";
import type { Customer } from "@prisma/client";
import type { AuthActor } from "@/lib/auth/permissions";

vi.mock("@/lib/db", () => {
  return {
    db: {
      customer: {
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

describe("Customer Service Unit Tests", () => {
  const adminActor: AuthActor = { id: "admin-1", role: "ADMIN_OWNER" };
  const staffActor: AuthActor = { id: "staff-1", role: "STAFF" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Customer Creation & Validation", () => {
    it("creates a customer with phone, vehicle number, and vehicle model", async () => {
      const mockCreated: Partial<Customer> = {
        id: "cust-1",
        name: "Sunil Sharma",
        phoneNumber: "9820123456",
        vehicleNumber: "MH02AB1234",
        vehicleModel: "Hyundai Creta",
        address: "Andheri West, Mumbai",
        notes: null,
        isActive: true,
      };

      vi.mocked(db.customer.create).mockResolvedValue(mockCreated as Customer);

      const result = await createCustomer(
        {
          name: "Sunil Sharma",
          phoneNumber: "9820123456",
          vehicleNumber: "MH 02 AB 1234",
          vehicleModel: "Hyundai Creta",
          address: "Andheri West, Mumbai",
        },
        staffActor
      );

      expect(result.id).toBe("cust-1");
      expect(result.name).toBe("Sunil Sharma");
      expect(db.customer.create).toHaveBeenCalled();
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "CUSTOMER_CREATED" }),
        })
      );
    });

    it("allows duplicate phone numbers across distinct customers", async () => {
      // Two family members sharing the same contact number
      const mockCreated2: Partial<Customer> = {
        id: "cust-2",
        name: "Pooja Sharma",
        phoneNumber: "9820123456", // Same phone as Sunil
        vehicleNumber: "MH02CD5678",
        isActive: true,
      };

      vi.mocked(db.customer.create).mockResolvedValue(mockCreated2 as Customer);

      const result = await createCustomer(
        {
          name: "Pooja Sharma",
          phoneNumber: "9820123456",
          vehicleNumber: "MH02CD5678",
        },
        adminActor
      );

      expect(result.id).toBe("cust-2");
      expect(result.name).toBe("Pooja Sharma");
    });

    it("rejects customer with empty name", async () => {
      await expect(
        createCustomer({ name: "   " }, adminActor)
      ).rejects.toThrow("Customer name is required");
    });
  });

  describe("Customer Updates & Soft Deactivation", () => {
    const existingCustomer: Partial<Customer> = {
      id: "cust-1",
      name: "Sunil Sharma",
      phoneNumber: "9820123456",
      vehicleNumber: "MH02AB1234",
      isActive: true,
    };

    it("updates customer details", async () => {
      vi.mocked(db.customer.findUnique).mockResolvedValue(existingCustomer as Customer);
      vi.mocked(db.customer.update).mockResolvedValue({
        ...existingCustomer,
        phoneNumber: "9999999999",
      } as Customer);

      const result = await updateCustomer("cust-1", { phoneNumber: "9999999999" }, adminActor);
      expect(result.phoneNumber).toBe("9999999999");
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "CUSTOMER_UPDATED" }),
        })
      );
    });

    it("soft-deactivates customer without deleting history", async () => {
      vi.mocked(db.customer.findUnique).mockResolvedValue(existingCustomer as Customer);
      vi.mocked(db.customer.update).mockResolvedValue({
        ...existingCustomer,
        isActive: false,
      } as Customer);

      const result = await deactivateCustomer("cust-1", adminActor);
      expect(result.isActive).toBe(false);
      expect(db.customer.update).toHaveBeenCalledWith({
        where: { id: "cust-1" },
        data: { isActive: false },
      });
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "CUSTOMER_DEACTIVATED" }),
        })
      );
    });

    it("reactivates a customer", async () => {
      vi.mocked(db.customer.findUnique).mockResolvedValue({
        ...existingCustomer,
        isActive: false,
      } as Customer);
      vi.mocked(db.customer.update).mockResolvedValue({
        ...existingCustomer,
        isActive: true,
      } as Customer);

      const result = await reactivateCustomer("cust-1", adminActor);
      expect(result.isActive).toBe(true);
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "CUSTOMER_REACTIVATED" }),
        })
      );
    });
  });

  describe("Customer Listing & Search", () => {
    it("searches customers across name, phone, and vehicle", async () => {
      vi.mocked(db.customer.findMany).mockResolvedValue([
        {
          id: "cust-1",
          name: "Sunil Sharma",
          phoneNumber: "9820123456",
          vehicleNumber: "MH02AB1234",
          isActive: true,
          _count: { sales: 4 },
        } as unknown as (Customer & { _count: { sales: number } }),
      ]);
      vi.mocked(db.customer.count).mockResolvedValue(1);

      const result = await listCustomers({ search: "MH02AB1234" }, staffActor);
      expect(result.customers).toHaveLength(1);
      expect(result.customers[0].name).toBe("Sunil Sharma");
      expect(result.metrics.totalActiveCustomers).toBe(1);
    });

    it("retrieves customer with sales history", async () => {
      vi.mocked(db.customer.findUnique).mockResolvedValue({
        id: "cust-1",
        name: "Sunil Sharma",
        sales: [],
        _count: { sales: 0 },
      } as unknown as Customer);

      const result = await getCustomerById("cust-1", adminActor);
      expect(result.id).toBe("cust-1");
    });
  });
});
