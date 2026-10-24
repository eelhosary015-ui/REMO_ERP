const fs = require('fs');
let content = fs.readFileSync('modules/hr/hr_api.routes.ts', 'utf8');
content = content.replace(/await client\.query\("DELETE FROM attendance"\);/g, 'await pool.query("DELETE FROM attendance");');
fs.writeFileSync('modules/hr/hr_api.routes.ts', content);
