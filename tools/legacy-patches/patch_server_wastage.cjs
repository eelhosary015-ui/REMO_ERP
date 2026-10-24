const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');
content = content.replace('import { adjustmentsRouter } from "./modules/warehouses/routes/adjustments.routes.js";', 'import { adjustmentsRouter } from "./modules/warehouses/routes/adjustments.routes.js";\nimport { wastageRouter } from "./modules/warehouses/routes/wastage.routes.js";');
content = content.replace('app.use(adjustmentsRouter);', 'app.use(adjustmentsRouter);\n  app.use(wastageRouter);');
fs.writeFileSync('server.ts', content);
console.log("Patched server.ts with wastage routes");
