const fs = require('fs');
let content = fs.readFileSync('modules/warehouses/routes/wastage.routes.ts', 'utf8');
content = content.replace(
  /\\`Wastage Expense for \\\${waste.wastage_number}\\`/g,
  '`Wastage Expense for ${waste.wastage_number}`'
);
fs.writeFileSync('modules/warehouses/routes/wastage.routes.ts', content);
console.log("Fixed syntax error");
