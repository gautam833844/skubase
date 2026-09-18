const fs = require('fs');
const path = require('path');
const { URL } = require('url');

function parseSafe(urlStr) {
  try {
    const u = new URL(urlStr);
    return {
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port,
      pathname: u.pathname,
      searchParams: Array.from(u.searchParams.keys()),
      isNeon: u.hostname.includes('neon.tech'),
      isLocalhost: u.hostname === 'localhost' || u.hostname === '127.0.0.1',
    };
  } catch (e) {
    return { error: 'Invalid URL structure' };
  }
}

const envFiles = ['.env.local', '.env.production', '.env'];
console.log('=== ENVIRONMENT FILES INSPECTION (SAFE METADATA ONLY) ===');

for (const envFile of envFiles) {
  const filePath = path.join('c:', 'project', envFile);
  if (fs.existsSync(filePath)) {
    console.log(`\nFile: ${envFile} (EXISTS)`);
    const content = fs.readFileSync(filePath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...rest] = trimmed.split('=');
        const varName = key.trim();
        let val = rest.join('=').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        
        if (varName.includes('DATABASE') || varName.includes('POSTGRES') || varName.includes('URL') || varName.includes('PRISMA')) {
          console.log(`  Variable: ${varName}`);
          const safe = parseSafe(val);
          console.log(`    Hostname: ${safe.hostname}`);
          console.log(`    Port: ${safe.port}`);
          console.log(`    Database: ${safe.pathname}`);
          console.log(`    Is Localhost: ${safe.isLocalhost}`);
          console.log(`    Is Neon: ${safe.isNeon}`);
          console.log(`    Params present: ${safe.searchParams ? safe.searchParams.join(', ') : 'none'}`);
        } else {
          console.log(`  Variable: ${varName} (non-db var)`);
        }
      }
    }
  } else {
    console.log(`\nFile: ${envFile} (NOT FOUND)`);
  }
}
