const fs = require('fs');
let content = fs.readFileSync('server-db-init.ts', 'utf8');
content = content.replace('total_cost DECIMAL(15,4)\n        )', 'total_cost DECIMAL(15,4)\n        )\n      `');
fs.writeFileSync('server-db-init.ts', content);
