const path = require('path');
const { Client } = require(path.join('c:', 'project', 'node_modules', 'pg'));

async function checkLocal() {
  const client = new Client({
    connectionString: 'postgresql://postgres:b1d1402aa35ac69d9edf2669f94d7e9c36b3f66284644b28502001407f61a2e5@localhost:5432/skubase?schema=public'
  });
  
  try {
    await client.connect();
    console.log('Connected to local database.');
    
    // Check columns
    const cols = await client.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'alignment_bills' AND column_name IN ('payment_mode', 'paid_amount')
      ORDER BY column_name;
    `);
    console.log('LOCAL_COLUMNS:', cols.rows);

    // Check enum
    const enums = await client.query(`
      SELECT e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'AlignmentPaymentMode';
    `);
    console.log('LOCAL_ENUMS:', enums.rows.map(r => r.enumlabel));

    // Check _prisma_migrations
    const migs = await client.query(`
      SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY finished_at ASC;
    `);
    console.log('LOCAL_MIGRATIONS:', migs.rows);
  } catch (err) {
    console.error('Error connecting to local DB:', err.message);
  } finally {
    await client.end();
  }
}

checkLocal();
