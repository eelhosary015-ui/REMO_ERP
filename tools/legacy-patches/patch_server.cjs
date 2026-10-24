const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');
content = content.replace('import { getRequiredAdvancedPermissionKeys } from "./src/utils/advancedPermissions.js";', 'import { getRequiredAdvancedPermissionKeys } from "./src/utils/advancedPermissions.js";\nimport { adjustmentsRouter } from "./modules/warehouses/routes/adjustments.routes.js";');
fs.writeFileSync('server.ts', content);
console.log("Patched server.ts");
