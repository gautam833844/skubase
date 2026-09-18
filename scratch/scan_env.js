const { URL } = require('url');

console.log('=== PROCESS.ENV SAFE DATABASE SCAN ===');
let foundDb = false;

for (const [key, value] of Object.entries(process.env)) {
  if (
    key.includes('DATABASE') || 
    key.includes('POSTGRES') || 
    key.includes('NEON') || 
    key.includes('DB_') || 
    key.includes('PRISMA') ||
    (typeof value === 'string' && value.startsWith('postgres'))
  ) {
    foundDb = true;
    try {
      const u = new URL(value);
      console.log(`Env Key: ${key}`);
      console.log(`  Hostname: ${u.hostname}`);
      console.log(`  Port: ${u.port}`);
      console.log(`  Database: ${u.pathname}`);
      console.log(`  Is Neon: ${u.hostname.includes('neon.tech')}`);
      console.log(`  Is Localhost: ${u.hostname === 'localhost' || u.hostname === '127.0.0.1'}`);
    } catch {
      console.log(`Env Key: ${key} (non-url value, length: ${value.length})`);
    }
  }
}

if (!foundDb) {
  console.log('No database-related environment variables found in process.env.');
}
