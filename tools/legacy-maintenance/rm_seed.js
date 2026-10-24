const fs = require('fs');
let content = fs.readFileSync('src/components/CustomersSuppliersView.tsx', 'utf8');

content = content.replace(/const SEED_SUPPLIERS: ExtendedClient\[\] = \[\s*\{[\s\S]*?\},\s*\];/m, 'const SEED_SUPPLIERS: ExtendedClient[] = [];');
content = content.replace(/const SEED_CUSTOMERS: ExtendedClient\[\] = \[\s*\{[\s\S]*?\},\s*\];/m, 'const SEED_CUSTOMERS: ExtendedClient[] = [];');

fs.writeFileSync('src/components/CustomersSuppliersView.tsx', content);
