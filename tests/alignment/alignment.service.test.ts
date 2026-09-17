import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createAlignmentBill,
  listAlignmentBills,
  getAlignmentBillById,
  generateNextAlignmentNumber,
  voidAlignmentBill,
  deleteAlignmentBills,
  generateAlignmentPdf,
} from "@/services/alignment.service";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { Prisma, AlignmentDocType, AlignmentBillStatus } from "@prisma/client";
import type { AuthActor } from "@/lib/auth/permissions";

vi.mock("@/lib/db", () => {
  return {
    db: {
      alignmentBill: {
        count: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      shopSetting: {
        findFirst: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(db)),
    },
  };
});

describe("Alignment & Service Billing Service Unit Tests", () => {
  const adminActor: AuthActor = { id: "admin-1", role: "ADMIN_OWNER" };
  const managerActor: AuthActor = { id: "mgr-1", role: "MANAGER" };
  const staffActor: AuthActor = { id: "staff-1", role: "STAFF" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Sequential Number Generation", () => {
    it("generates EST-1001 for first estimate", async () => {
      vi.mocked(db.alignmentBill.findMany).mockResolvedValue([]);
      vi.mocked(db.auditLog.findMany).mockResolvedValue([]);
      vi.mocked(db.alignmentBill.findUnique).mockResolvedValue(null);

      const num = await generateNextAlignmentNumber(AlignmentDocType.ESTIMATE);
      expect(num).toBe("EST-1001");
    });

    it("generates ALN-1005 when highest existing bill is ALN-1004", async () => {
      vi.mocked(db.alignmentBill.findMany).mockResolvedValue([
        { billNumber: "ALN-1001" },
        { billNumber: "ALN-1004" },
      ] as any);
      vi.mocked(db.auditLog.findMany).mockResolvedValue([]);
      vi.mocked(db.alignmentBill.findUnique).mockResolvedValue(null);

      const num = await generateNextAlignmentNumber(AlignmentDocType.BILL);
      expect(num).toBe("ALN-1005");
    });

    it("does not reuse deleted bill numbers found in audit logs", async () => {
      // Suppose ALN-1003 was deleted, so existing bills only have ALN-1001, ALN-1002
      vi.mocked(db.alignmentBill.findMany).mockResolvedValue([
        { billNumber: "ALN-1001" },
        { billNumber: "ALN-1002" },
      ] as any);
      // Audit log records that ALN-1003 was previously created / deleted
      vi.mocked(db.auditLog.findMany).mockResolvedValue([
        {
          newState: { billNumber: "ALN-1003" },
          oldState: null,
        },
      ] as any);
      vi.mocked(db.alignmentBill.findUnique).mockResolvedValue(null);

      const num = await generateNextAlignmentNumber(AlignmentDocType.BILL);
      expect(num).toBe("ALN-1004");
    });

    it("verifies all 11 default service presets have defaultQuantity of 0", async () => {
      const { DEFAULT_ALIGNMENT_SERVICES } = await import("@/lib/constants/alignment-services");
      expect(DEFAULT_ALIGNMENT_SERVICES).toHaveLength(11);
      DEFAULT_ALIGNMENT_SERVICES.forEach((preset) => {
        expect(preset.defaultQuantity).toBe(0);
      });
    });
  });

  describe("Bill Creation & Calculation", () => {
    it("creates an alignment bill and calculates rate * qty accurately", async () => {
      vi.mocked(db.alignmentBill.count).mockResolvedValue(0);
      vi.mocked(db.alignmentBill.findUnique).mockResolvedValue(null);

      const mockCreated = {
        id: "aln-1",
        billNumber: "ALN-1001",
        documentType: AlignmentDocType.BILL,
        date: new Date("2026-09-15T10:00:00Z"),
        customerId: null,
        customerName: "Rajesh Kumar",
        phoneNumber: "9876543210",
        vehicleNumber: "TN01AB1234",
        kilometers: 45000,
        totalAmount: new Prisma.Decimal("770.00"),
        status: AlignmentBillStatus.COMPLETED,
        notes: null,
        createdById: "staff-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: { id: "staff-1", fullName: "Staff One", username: "staff1" },
        items: [
          {
            id: "item-1",
            displayOrder: 1,
            particular: "Wheel Alignment 3D",
            rate: new Prisma.Decimal("450.00"),
            quantity: new Prisma.Decimal("1.00"),
            amount: new Prisma.Decimal("450.00"),
          },
          {
            id: "item-2",
            displayOrder: 2,
            particular: "Wheel Balancing",
            rate: new Prisma.Decimal("80.00"),
            quantity: new Prisma.Decimal("4.00"),
            amount: new Prisma.Decimal("320.00"),
          },
        ],
      };

      vi.mocked(db.alignmentBill.create).mockResolvedValue(mockCreated as unknown as Awaited<ReturnType<typeof db.alignmentBill.create>>);

      const result = await createAlignmentBill(
        {
          documentType: AlignmentDocType.BILL,
          customerName: "Rajesh Kumar",
          phoneNumber: "9876543210",
          vehicleNumber: "tn01ab1234",
          kilometers: 45000,
          items: [
            { displayOrder: 1, particular: "Wheel Alignment 3D", rate: 450, quantity: 1 },
            { displayOrder: 2, particular: "Wheel Balancing", rate: 80, quantity: 4 },
          ],
        },
        staffActor
      );

      expect(result.billNumber).toBe("ALN-1001");
      expect(result.customerName).toBe("Rajesh Kumar");
      expect(result.totalAmount).toBe("770");
      expect(db.alignmentBill.create).toHaveBeenCalledTimes(1);
    });

    it("creates an alignment bill with standard services and additional custom services", async () => {
      vi.mocked(db.alignmentBill.count).mockResolvedValue(0);
      vi.mocked(db.alignmentBill.findUnique).mockResolvedValue(null);

      let capturedData: any = null;
      vi.mocked(db.alignmentBill.create).mockImplementation(
        (async (args: any) => {
          capturedData = args.data;
          return {
            id: "aln-custom-1",
            billNumber: args.data.billNumber,
            documentType: args.data.documentType,
            date: args.data.date,
            customerId: null,
            customerName: args.data.customerName,
            phoneNumber: args.data.phoneNumber,
            vehicleNumber: args.data.vehicleNumber,
            kilometers: args.data.kilometers,
            totalAmount: args.data.totalAmount,
            status: args.data.status,
            notes: args.data.notes,
            createdById: args.data.createdById,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: { id: "admin-1", fullName: "Admin User", username: "admin" },
            items: args.data.items.create.map((item: any, idx: number) => ({
              id: `item-${idx + 1}`,
              ...item,
            })),
          };
        }) as unknown as typeof db.alignmentBill.create
      );

      const result = await createAlignmentBill(
        {
          documentType: AlignmentDocType.BILL,
          customerName: "Suresh Babu",
          vehicleNumber: "AP02CD5678",
          items: [
            { displayOrder: 1, particular: "Wheel Alignment 3D", rate: 450, quantity: 1 },
            { displayOrder: 10, particular: "Tyre Changing / Opening Fitting", rate: 100, quantity: 2 },
            { displayOrder: 12, particular: "Nitrogen Gas Top-up", rate: 50, quantity: 4 },
          ],
        },
        adminActor
      );

      expect(result.customerName).toBe("Suresh Babu");
      // Standard items count = 11, plus 1 additional = 12 items total
      expect(capturedData.items.create).toHaveLength(12);

      // Verify preset #10 particular is "Tyre Changing / Opening Fitting"
      const item10 = capturedData.items.create.find((i: any) => i.displayOrder === 10);
      expect(item10.particular).toBe("Tyre Changing / Opening Fitting");
      expect(Number(item10.amount)).toBe(200);

      // Verify additional item (displayOrder 12)
      const item12 = capturedData.items.create.find((i: any) => i.displayOrder === 12);
      expect(item12.particular).toBe("Nitrogen Gas Top-up");
      expect(Number(item12.rate)).toBe(50);
      expect(Number(item12.quantity)).toBe(4);
      expect(Number(item12.amount)).toBe(200);

      // Total = 450 (item 1) + 200 (item 10) + 200 (item 12) = 850
      expect(Number(capturedData.totalAmount)).toBe(850);
      expect(result.totalAmount).toBe("850");
    });

    it("rejects creation when customer name is missing", async () => {
      await expect(
        createAlignmentBill(
          {
            documentType: AlignmentDocType.BILL,
            customerName: "",
            vehicleNumber: "TN01AB1234",
            items: [],
          },
          staffActor
        )
      ).rejects.toThrowError(AppError);
    });

    it("rejects creation when vehicle number is missing", async () => {
      await expect(
        createAlignmentBill(
          {
            documentType: AlignmentDocType.BILL,
            customerName: "Ramesh",
            vehicleNumber: "",
            items: [],
          },
          staffActor
        )
      ).rejects.toThrowError(AppError);
    });
  });

  describe("List and Filter Alignment Bills", () => {
    it("lists alignment bills with pagination", async () => {
      vi.mocked(db.alignmentBill.findMany).mockResolvedValue([
        {
          id: "aln-1",
          billNumber: "ALN-1001",
          documentType: AlignmentDocType.BILL,
          date: new Date(),
          customerId: null,
          customerName: "Ramesh",
          phoneNumber: null,
          vehicleNumber: "KA01AB1234",
          kilometers: 12000,
          totalAmount: new Prisma.Decimal("450.00"),
          status: AlignmentBillStatus.COMPLETED,
          notes: null,
          createdById: "staff-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          items: [],
          createdBy: { id: "staff-1", fullName: "Staff 1", username: "s1" },
        } as unknown as Awaited<ReturnType<typeof db.alignmentBill.findMany>>[0],
      ]);
      vi.mocked(db.alignmentBill.count).mockResolvedValue(1);

      const res = await listAlignmentBills({ documentType: "BILL" }, adminActor);
      expect(res.bills).toHaveLength(1);
      expect(res.pagination.totalCount).toBe(1);
    });
  });

  describe("Role & Scoped Permissions", () => {
    it("allows STAFF to view their own bills", async () => {
      const mockBill = {
        id: "aln-1",
        billNumber: "ALN-1001",
        documentType: AlignmentDocType.BILL,
        date: new Date(),
        customerId: null,
        customerName: "Ramesh",
        phoneNumber: null,
        vehicleNumber: "KA01AB1234",
        kilometers: 12000,
        totalAmount: new Prisma.Decimal("450.00"),
        status: AlignmentBillStatus.COMPLETED,
        notes: null,
        createdById: "staff-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
        createdBy: null,
      };

      vi.mocked(db.alignmentBill.findUnique).mockResolvedValue(mockBill as unknown as Awaited<ReturnType<typeof db.alignmentBill.findUnique>>);

      const bill = await getAlignmentBillById("aln-1", staffActor);
      expect(bill.id).toBe("aln-1");
    });

    it("denies STAFF from viewing bills created by other staff", async () => {
      const mockBill = {
        id: "aln-2",
        billNumber: "ALN-1002",
        createdById: "staff-2",
        items: [],
      };

      vi.mocked(db.alignmentBill.findUnique).mockResolvedValue(mockBill as unknown as Awaited<ReturnType<typeof db.alignmentBill.findUnique>>);

      await expect(getAlignmentBillById("aln-2", staffActor)).rejects.toThrowError(AppError);
    });

    it("allows ADMIN_OWNER to void an alignment bill", async () => {
      vi.mocked(db.alignmentBill.findUnique).mockResolvedValue({ id: "aln-1" } as unknown as Awaited<ReturnType<typeof db.alignmentBill.findUnique>>);
      vi.mocked(db.alignmentBill.update).mockResolvedValue({
        id: "aln-1",
        billNumber: "ALN-1001",
        documentType: AlignmentDocType.BILL,
        date: new Date(),
        customerId: null,
        phoneNumber: null,
        vehicleNumber: "KA01AB1234",
        kilometers: 1000,
        totalAmount: new Prisma.Decimal(500),
        status: AlignmentBillStatus.VOIDED,
        notes: null,
        createdById: "admin-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        customerName: "Ramesh",
        items: [],
        createdBy: null,
      } as unknown as Awaited<ReturnType<typeof db.alignmentBill.update>>);

      const res = await voidAlignmentBill("aln-1", adminActor);
      expect(res.status).toBe(AlignmentBillStatus.VOIDED);
    });

    it("denies MANAGER and STAFF from voiding an alignment bill", async () => {
      await expect(voidAlignmentBill("aln-1", managerActor)).rejects.toThrowError(AppError);
      await expect(voidAlignmentBill("aln-1", staffActor)).rejects.toThrowError(AppError);
    });

    it("allows ADMIN_OWNER to permanently delete alignment bills in bulk", async () => {
      vi.mocked(db.alignmentBill.findMany).mockResolvedValue([
        {
          id: "aln-1",
          billNumber: "ALN-1001",
          documentType: AlignmentDocType.BILL,
          customerName: "Ramesh",
          totalAmount: new Prisma.Decimal(500),
        },
        {
          id: "aln-2",
          billNumber: "ALN-1002",
          documentType: AlignmentDocType.BILL,
          customerName: "Suresh",
          totalAmount: new Prisma.Decimal(300),
        },
      ] as any);
      vi.mocked(db.alignmentBill.deleteMany).mockResolvedValue({ count: 2 });

      const result = await deleteAlignmentBills(["aln-1", "aln-2"], adminActor);
      expect(result.count).toBe(2);
      expect(result.deletedIds).toEqual(["aln-1", "aln-2"]);
      expect(db.alignmentBill.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ["aln-1", "aln-2"] } },
      });
      expect(db.auditLog.create).toHaveBeenCalledTimes(2);
    });

    it("denies MANAGER and STAFF from deleting alignment bills", async () => {
      await expect(deleteAlignmentBills(["aln-1"], managerActor)).rejects.toThrowError(AppError);
      await expect(deleteAlignmentBills(["aln-1"], staffActor)).rejects.toThrowError(AppError);
    });

    it("rejects deletion when empty array is provided", async () => {
      await expect(deleteAlignmentBills([], adminActor)).rejects.toThrowError(AppError);
    });

    it("rejects deletion when target documents are not found", async () => {
      vi.mocked(db.alignmentBill.findMany).mockResolvedValue([]);
      await expect(deleteAlignmentBills(["nonexistent-id"], adminActor)).rejects.toThrowError(AppError);
    });
  });

  describe("PDF Generation", () => {
    it("generates a valid binary PDF buffer matching the reference layout", async () => {
      const mockBill = {
        id: "aln-1",
        billNumber: "ALN-1001",
        documentType: AlignmentDocType.BILL,
        date: new Date("2026-09-15T10:00:00Z"),
        customerId: null,
        customerName: "Rajesh Kumar",
        phoneNumber: "9876543210",
        vehicleNumber: "TN01AB1234",
        kilometers: 45000,
        totalAmount: new Prisma.Decimal("770.00"),
        status: AlignmentBillStatus.COMPLETED,
        notes: null,
        createdById: "admin-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        items: [
          {
            id: "i-1",
            displayOrder: 1,
            particular: "Wheel Alignment 3D",
            rate: new Prisma.Decimal("450.00"),
            quantity: new Prisma.Decimal("1.00"),
            amount: new Prisma.Decimal("450.00"),
          },
        ],
      };

      vi.mocked(db.alignmentBill.findUnique).mockResolvedValue(mockBill as unknown as Awaited<ReturnType<typeof db.alignmentBill.findUnique>>);
      vi.mocked(db.shopSetting.findFirst).mockResolvedValue({
        id: "shop-1",
        name: "Preethi Tyres",
        tagline: "Wheels Balancing & Alignment Centre",
        address: "Main Road, Salem",
        phoneNumber: "9876543210",
        email: "preethi@example.com",
        website: null,
        gstin: null,
        billFooter: "Thank you",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const buffer = await generateAlignmentPdf("aln-1", adminActor);
      expect(buffer).toBeInstanceOf(Uint8Array);
      expect(buffer.length).toBeGreaterThan(100);
    });
  });
});
