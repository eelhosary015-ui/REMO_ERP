import fs from "node:fs";
const p = "modules/sales/services/sales_order.service.ts";
let s = fs.readFileSync(p, "utf8");
const startMarker = "    } else {\n\n      // Check if invoice already exists";
const endMarker = "    } else {\n      // Mark order as 'مؤكد' without stock movement";
const a = s.indexOf(startMarker);
const b = s.indexOf(endMarker);
if (a === -1 || b === -1 || b < a) { console.error("markers not found", a, b); process.exit(1); }
const removed = s.slice(a, b);
s = s.slice(0, a) + s.slice(b);
fs.writeFileSync(p, s, "utf8");
console.log("removed chars:", removed.length);
console.log("remaining else blocks:", (s.match(/\} else \{/g) || []).length);
