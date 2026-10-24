const fs = require('fs');
let content = fs.readFileSync('server-db-init.ts', 'utf8');
content = content.replace('const tables = [\n        CREATE TABLE IF NOT EXISTS adjustment_reasons', 'const tables = [\n      `\n        CREATE TABLE IF NOT EXISTS adjustment_reasons');
fs.writeFileSync('server-db-init.ts', content);
