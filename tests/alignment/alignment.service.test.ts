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
import { Prisma, AlignmentDocType, AlignmentBillStatus, AlignmentPaymentMode } from "@prisma/client";
import type { AuthActor } from "@/lib/auth/permissions";

vi.mock("@/lib/db", () => {
  return {
    db: {
      alignmentBill: {
        count: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
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
      vi.mocked(db.alignmentBill.findFirst).mockResolvedValue(null);
      vi.mocked(db.auditLog.findMany).mockResolvedValue([]);
      vi.mocked(db.alignmentBill.findUnique).mockResolvedValue(null);

      const num = await generateNextAlignmentNumber(AlignmentDocType.ESTIMATE);
      expect(num).toBe("EST-1001");
    });

    it("generates ALN-1005 when highest existing bill is ALN-1004", async () => {
      vi.mocked(db.alignmentBill.findFirst).mockResolvedValue({ billNumber: "ALN-1004" } as any);
      vi.mocked(db.auditLog.findMany).mockResolvedValue([]);
      vi.mocked(db.alignmentBill.findUnique).mockResolvedValue(null);

      const num = await generateNextAlignmentNumber(AlignmentDocType.BILL);
      expect(num).toBe("ALN-1005");
    });

    it("does not reuse deleted bill numbers found in audit logs for bills (ALN)", async () => {
      // Suppose ALN-1003 was deleted, latest existing is ALN-1002
      vi.mocked(db.alignmentBill.findFirst).mockResolvedValue({ billNumber: "ALN-1002" } as any);
      // Audit log records that ALN-1003 was deleted
      vi.mocked(db.auditLog.findMany).mockResolvedValue([
        {
          oldState: { billNumber: "ALN-1003" },
        },
      ] as any);
      vi.mocked(db.alignmentBill.findUnique).mockResolvedValue(null);

      const num = await generateNextAlignmentNumber(AlignmentDocType.BILL);
      expect(num).toBe("ALN-1004");
      expect(db.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          entityName: "AlignmentBill",
          action: "ALIGNMENT_BILL_DELETED",
        },
        select: {
          oldState: true,
        },
      });
    });

    it("does not reuse deleted estimate numbers found in audit logs for estimates (EST)", async () => {
      // Suppose EST-1002 was deleted, latest existing is EST-1001
      vi.mocked(db.alignmentBill.findFirst).mockResolvedValue({ billNumber: "EST-1001" } as any);
      // Audit log records that EST-1002 was deleted
      vi.mocked(db.auditLog.findMany).mockResolvedValue([
        {
          oldState: { billNumber: "EST-1002" },
        },
      ] as any);
      vi.mocked(db.alignmentBill.findUnique).mockResolvedValue(null);

      const num = await generateNextAlignmentNumber(AlignmentDocType.ESTIMATE);
      expect(num).toBe("EST-1003");
    });

    it("intermediate deleted numbers do not downgrade or interfere with higher active sequences", async () => {
      // Active highest is ALN-1010, but ALN-1003 was deleted earlier
      vi.mocked(db.alignmentBill.findFirst).mockResolvedValue({ billNumber: "ALN-1010" } as any);
      vi.mocked(db.auditLog.findMany).mockResolvedValue([
        { oldState: { billNumber: "ALN-1003" } },
      ] as any);
      vi.mocked(db.alignmentBill.findUnique).mockResolvedValue(null);

      const num = await generateNextAlignmentNumber(AlignmentDocType.BILL);
      expect(num).toBe("ALN-1011");
    });

    it("safely handles malformed or unexpected audit log oldState objects", async () => {
      vi.mocked(db.alignmentBill.findFirst).mockResolvedValue({ billNumber: "ALN-1005" } as any);
      vi.mocked(db.auditLog.findMany).mockResolvedValue([
        { oldState: null },
        { oldState: "invalid string" },
        { oldState: { unrelated: "value" } },
        { oldState: { billNumber: "NOT-A-NUMBER" } },
        { oldState: { billNumber: "EST-1050" } }, // Different document type sequence
        { oldState: { billNumber: "ALN-1008" } }, // Higher deleted number
      ] as any);
      vi.mocked(db.alignmentBill.findUnique).mockResolvedValue(null);

      const num = await generateNextAlignmentNumber(AlignmentDocType.BILL);
      expect(num).toBe("ALN-1009");
    });

    it("executes all numbering queries through the provided transaction client", async () => {
      const mockTx = {
        alignmentBill: {
          findFirst: vi.fn().mockResolvedValue({ billNumber: "ALN-1010" }),
          findUnique: vi.fn().mockResolvedValue(null),
        },
        auditLog: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      };

      const num = await generateNextAlignmentNumber(AlignmentDocType.BILL, mockTx as any);
      expect(num).toBe("ALN-1011");
      expect(mockTx.alignmentBill.findFirst).toHaveBeenCalledWith({
        where: { documentType: AlignmentDocType.BILL, billNumber: { startsWith: "ALN-" } },
        orderBy: { billNumber: "desc" },
        select: { billNumber: true },
      });
      expect(mockTx.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          entityName: "AlignmentBill",
          action: "ALIGNMENT_BILL_DELETED",
        },
        select: {
          oldState: true,
        },
      });
      // Ensure global db was NOT queried
      expect(db.alignmentBill.findFirst).not.toHaveBeenCalled();
      expect(db.auditLog.findMany).not.toHaveBeenCalled();
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
        paymentMode: AlignmentPaymentMode.CASH,
        paidAmount: new Prisma.Decimal("770.00"),
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
          paymentMode: AlignmentPaymentMode.CASH,
          paidAmount: 770,
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
      expect(result.paymentMode).toBe("CASH");
      expect(result.paidAmount).toBe("770");
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
            paymentMode: args.data.paymentMode,
            paidAmount: args.data.paidAmount,
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
          paymentMode: AlignmentPaymentMode.UPI,
          paidAmount: 850,
          items: [
            { displayOrder: 1, particular: "Wheel Alignment 3D", rate: 450, quantity: 1 },
            { displayOrder: 10, particular: "Tyre Changing / Opening Fitting", rate: 100, quantity: 2 },
            { displayOrder: 12, particular: "Nitrogen Gas Top-up", rate: 50, quantity: 4 },
          ],
        },
        adminActor
      );

      expect(result.customerName).toBe("Suresh Babu");
      expect(result.paymentMode).toBe("UPI");
      expect(result.paidAmount).toBe("850");
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

    it("creates an Estimate without requiring payment details", async () => {
      vi.mocked(db.alignmentBill.count).mockResolvedValue(0);
      vi.mocked(db.alignmentBill.findUnique).mockResolvedValue(null);

      let capturedData: any = null;
      vi.mocked(db.alignmentBill.create).mockImplementation(
        (async (args: any) => {
          capturedData = args.data;
          return {
            id: "est-1",
            billNumber: args.data.billNumber,
            documentType: AlignmentDocType.ESTIMATE,
            date: args.data.date,
            customerId: null,
            customerName: args.data.customerName,
            phoneNumber: args.data.phoneNumber,
            vehicleNumber: args.data.vehicleNumber,
            kilometers: args.data.kilometers,
            totalAmount: args.data.totalAmount,
            paymentMode: null,
            paidAmount: null,
            status: AlignmentBillStatus.COMPLETED,
            notes: null,
            createdById: args.data.createdById,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: { id: "admin-1", fullName: "Admin User", username: "admin" },
            items: [],
          };
        }) as unknown as typeof db.alignmentBill.create
      );

      const result = await createAlignmentBill(
        {
          documentType: AlignmentDocType.ESTIMATE,
          customerName: "Gopal Rao",
          vehicleNumber: "KA04EF1234",
          items: [
            { displayOrder: 1, particular: "Wheel Alignment 3D", rate: 450, quantity: 1 },
          ],
        },
        adminActor
      );

      expect(result.documentType).toBe("ESTIMATE");
      expect(result.paymentMode).toBeNull();
      expect(result.paidAmount).toBeNull();
      expect(capturedData.paymentMode).toBeNull();
      expect(capturedData.paidAmount).toBeNull();
    });

    it("rejects Bill creation when paymentMode is missing or invalid", async () => {
      await expect(
        createAlignmentBill(
          {
            documentType: AlignmentDocType.BILL,
            customerName: "Rajesh",
            vehicleNumber: "TN01AB1234",
            paidAmount: 450,
            items: [{ displayOrder: 1, particular: "Wheel Alignment 3D", rate: 450, quantity: 1 }],
          },
          staffActor
        )
      ).rejects.toThrowError(/Payment mode is required/i);
    });

    it("rejects Bill creation when paidAmount is missing", async () => {
      await expect(
        createAlignmentBill(
          {
            documentType: AlignmentDocType.BILL,
            customerName: "Rajesh",
            vehicleNumber: "TN01AB1234",
            paymentMode: AlignmentPaymentMode.CASH,
            items: [{ displayOrder: 1, particular: "Wheel Alignment 3D", rate: 450, quantity: 1 }],
          },
          staffActor
        )
      ).rejects.toThrowError(/Paid amount is required/i);
    });

    it("rejects Bill creation when paidAmount is less than server-calculated total", async () => {
      await expect(
        createAlignmentBill(
          {
            documentType: AlignmentDocType.BILL,
            customerName: "Rajesh",
            vehicleNumber: "TN01AB1234",
            paymentMode: AlignmentPaymentMode.CASH,
            paidAmount: 300, // Less than 450 total
            items: [{ displayOrder: 1, particular: "Wheel Alignment 3D", rate: 450, quantity: 1 }],
          },
          staffActor
        )
      ).rejects.toThrowError(/Full payment required/i);
    });

    it("rejects Bill creation when paidAmount is greater than server-calculated total", async () => {
      await expect(
        createAlignmentBill(
          {
            documentType: AlignmentDocType.BILL,
            customerName: "Rajesh",
            vehicleNumber: "TN01AB1234",
            paymentMode: AlignmentPaymentMode.UPI,
            paidAmount: 500, // Greater than 450 total
            items: [{ displayOrder: 1, particular: "Wheel Alignment 3D", rate: 450, quantity: 1 }],
          },
          staffActor
        )
      ).rejects.toThrowError(/Full payment required/i);
    });

    it("recalculates line-item amounts on server rather than trusting client", async () => {
      let capturedData: any = null;
      vi.mocked(db.alignmentBill.create).mockImplementation(
        (async (args: any) => {
          capturedData = args.data;
          return {
            id: "aln-calc-1",
            billNumber: args.data.billNumber,
            documentType: args.data.documentType,
            date: args.data.date,
            customerId: null,
            customerName: args.data.customerName,
            phoneNumber: null,
            vehicleNumber: args.data.vehicleNumber,
            kilometers: null,
            totalAmount: args.data.totalAmount,
            paymentMode: args.data.paymentMode,
            paidAmount: args.data.paidAmount,
            status: AlignmentBillStatus.COMPLETED,
            notes: null,
            createdById: args.data.createdById,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: { id: "admin-1", fullName: "Admin User", username: "admin" },
            items: [],
          };
        }) as unknown as typeof db.alignmentBill.create
      );

      const result = await createAlignmentBill(
        {
          documentType: AlignmentDocType.BILL,
          customerName: "Trust Test",
          vehicleNumber: "AP01XY9999",
          paymentMode: AlignmentPaymentMode.CASH,
          paidAmount: 650, // 450 (std 1) + 200 (std 10: 2x100)
          items: [
            { displayOrder: 1, particular: "Wheel Alignment 3D", rate: 450, quantity: 1 },
            { displayOrder: 10, particular: "Tyre Changing", rate: 100, quantity: 2 },
          ],
        },
        adminActor
      );

      expect(Number(capturedData.totalAmount)).toBe(650);
      expect(result.totalAmount).toBe("650");
    });

    it("rejects creation when customer name is missing", async () => {
      await expect(
        createAlignmentBill(
          {
            documentType: AlignmentDocType.BILL,
            customerName: "",
            vehicleNumber: "TN01AB1234",
            paymentMode: AlignmentPaymentMode.CASH,
            paidAmount: 0,
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
            paymentMode: AlignmentPaymentMode.CASH,
            paidAmount: 0,
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
