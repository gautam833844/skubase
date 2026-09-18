// Test: Reproduce the exact listAlignmentBills query against production Neon
// Run from the project root: node scratch/test_list_bills_local.js
const path = require("path");

// Manually resolve modules from project's node_modules
const projectRoot = path.resolve(__dirname, "..");
const resolve = (mod) => require(path.join(projectRoot, "node_modules", mod));

async function test() {
  const { PrismaClient } = resolve("@prisma/client");
  const { PrismaPg } = resolve("@prisma/adapter-pg");
  const { Pool } = resolve("pg");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("ERROR: DATABASE_URL not set. Set it in the environment.");
    process.exit(1);
  }

  console.log("Connecting to Neon via PrismaPg adapter (same as production)...");

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });

  try {
    // Replicate EXACT query from listAlignmentBills
    console.log("\n--- Test 1: findMany with include ---");
    const [bills, totalCount] = await Promise.all([
      db.alignmentBill.findMany({
        where: {},
        include: {
          items: {
            orderBy: { displayOrder: "asc" },
          },
          createdBy: {
            select: { id: true, fullName: true, username: true },
          },
        },
        orderBy: { date: "desc" },
        skip: 0,
        take: 50,
      }),
      db.alignmentBill.count({ where: {} }),
    ]);

    console.log(`Total count: ${totalCount}`);
    console.log(`Bills returned: ${bills.length}`);

    for (const bill of bills) {
      console.log(
        `  ${bill.billNumber}: paymentMode=${bill.paymentMode}, paidAmount=${bill.paidAmount}, status=${bill.status}`
      );
    }

    // Test 2: format each bill same way as production
    console.log("\n--- Test 2: formatAlignmentBillView ---");
    for (const bill of bills) {
      try {
        const formatted = {
          id: bill.id,
          billNumber: bill.billNumber,
          documentType: bill.documentType,
          date: bill.date instanceof Date ? bill.date.toISOString() : String(bill.date),
          totalAmount: bill.totalAmount.toString(),
          paymentMode: bill.paymentMode ?? null,
          paidAmount: bill.paidAmount ? bill.paidAmount.toString() : null,
          status: bill.status,
          items: (bill.items || []).map((item) => ({
            id: item.id,
            rate: item.rate.toString(),
            quantity: item.quantity.toString(),
            amount: item.amount.toString(),
          })),
        };
        console.log(`  OK: ${formatted.billNumber}`);
      } catch (err) {
        console.error(`  FAIL: ${bill.billNumber}:`, err.message);
      }
    }

    // Test 3: DB columns check
    console.log("\n--- Test 3: DB columns ---");
    const rawCols =
      await db.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'alignment_bills' ORDER BY ordinal_position`;
    console.log("Columns:", rawCols.map((r) => r.column_name).join(", "));

    console.log("\n✅ All tests passed!");
  } catch (err) {
    console.error("\n❌ ERROR:", err.message);
    console.error("Stack:", err.stack);
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

test();
