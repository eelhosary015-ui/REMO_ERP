const fs = require('fs');
let content = fs.readFileSync('src/components/Inventory.tsx', 'utf8');

// Import
content = content.replace(
  'import InventoryAdjustmentsView from "./inventory/adjustments/InventoryAdjustmentsView";',
  'import InventoryAdjustmentsView from "./inventory/adjustments/InventoryAdjustmentsView";\nimport WastageView from "./inventory/wastage/WastageView";'
);

// Switch case
content = content.replace(
  'case "damaged": return renderDamaged();',
  'case "damaged": return <WastageView onNotify={showToast} userRole={userRole} />;'
);

fs.writeFileSync('src/components/Inventory.tsx', content);
console.log("Patched Inventory.tsx to use WastageView");
