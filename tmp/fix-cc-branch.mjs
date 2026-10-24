import fs from "node:fs";
const p = "modules/accounts/services/auto-posting.service.ts";
let s = fs.readFileSync(p, "utf8");
const before = (s.match(/orderData\.branch_id \|\| null/g) || []).length;
s = s.split("cost_center_id: orderData.branch_id || null").join("cost_center_id: orderData.cost_center_id || null");
const after = (s.match(/cost_center_id: orderData\.branch_id \|\| null/g) || []).length;
// purchase fallback
s = s.split("cost_center_id: purchaseData.cost_center_id || purchaseData.branch_id || null").join("cost_center_id: purchaseData.cost_center_id || null");
fs.writeFileSync(p, s, "utf8");
console.log("orderData branch_id occurrences before:", before, "after:", after);
