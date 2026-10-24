const fs = require('fs');
let c = fs.readFileSync('server-db-init.ts', 'utf8');

const alter = `
    try {
      await client.query("ALTER TABLE fingerprint_devices ADD COLUMN timezone_shift INTEGER DEFAULT 0");
    } catch(e) {}
`;

if (!c.includes('timezone_shift')) {
  c = c.replace(/await client\.query\(`\s*CREATE TABLE IF NOT EXISTS fingerprint_devices/, alter + '\n    await client.query(`CREATE TABLE IF NOT EXISTS fingerprint_devices');
  fs.writeFileSync('server-db-init.ts', c);
  console.log("Added alter script to server-db-init");
}
