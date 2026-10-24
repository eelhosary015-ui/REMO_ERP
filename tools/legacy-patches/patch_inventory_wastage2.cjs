const fs = require('fs');
let content = fs.readFileSync('src/components/Inventory.tsx', 'utf8');

content = content.replace(
  'case "damaged": return <WastageView onNotify={showToast} userRole={userRole} />;',
  'case "damaged": return <WastageView onNotify={showToast} userRole="admin" />;'
);

fs.writeFileSync('src/components/Inventory.tsx', content);
console.log("Patched Inventory.tsx to use admin role");
