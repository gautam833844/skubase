const path = require('path');
const root = 'c:\\project';
try {
  const p = require(path.join(root, 'node_modules', '@prisma', 'client', 'package.json'));
  console.log('Prisma Client:', p.version);
} catch(e) { console.log('Prisma Client: ERROR -', e.message); }
try {
  const a = require(path.join(root, 'node_modules', '@prisma', 'adapter-pg', 'package.json'));
  console.log('Adapter PG:', a.version);
} catch(e) { console.log('Adapter PG: ERROR -', e.message); }
try {
  const pg = require(path.join(root, 'node_modules', 'pg', 'package.json'));
  console.log('pg:', pg.version);
} catch(e) { console.log('pg: ERROR -', e.message); }
try {
  const prisma = require(path.join(root, 'node_modules', 'prisma', 'package.json'));
  console.log('prisma CLI:', prisma.version);
} catch(e) { console.log('prisma CLI: ERROR -', e.message); }
