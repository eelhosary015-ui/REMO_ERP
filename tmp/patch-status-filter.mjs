import fs from "node:fs";
const p = "modules/accounts/services/period-closing.service.ts";
let s = fs.readFileSync(p, "utf8");
const a = "AND COALESCE(status, '') NOT IN ('cancelled', 'canceled', 'draft', 'quotation')`,";
const b = "AND COALESCE(status, '') NOT IN ('cancelled', 'canceled', 'draft', 'quotation', 'ملغاة', 'ملغي', 'مسودة')`,";
const c2 = "FROM sales_invoices WHERE COALESCE(status, '') NOT IN ('cancelled', 'canceled', 'draft')`,";
const d = "FROM sales_invoices WHERE COALESCE(status, '') NOT IN ('cancelled', 'canceled', 'draft', 'ملغاة', 'ملغي', 'مسودة')`,";
if (!s.includes(a) || !s.includes(c2)) { console.error("anchors not found"); process.exit(1); }
s = s.replace(a, b).replace(c2, d);
fs.writeFileSync(p, s, "utf8");
console.log("status filter patched");
