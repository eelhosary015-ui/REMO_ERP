import fs from "node:fs";
const f = "modules/purchases/suppliers_api.routes.ts";
let s = fs.readFileSync(f, "utf8");
const before = s;

// ISSUE-13a: alias صريح للعمود month
s = s.replace("SELECT TO_CHAR(d::date,'YYYY-MM') month,", "SELECT TO_CHAR(d::date,'YYYY-MM') AS month,");

// ISSUE-13b: استعلام overdue لا يستخدم $1 → نضيف حد البداية
s = s.replace(
  "FROM suppliers s LEFT JOIN purchases p ON p.supplier_id=s.id AND p.date::date <= $2::date",
  "FROM suppliers s LEFT JOIN purchases p ON p.supplier_id=s.id AND p.date::date >= $1::date AND p.date::date <= $2::date"
);

if (s !== before) { fs.writeFileSync(f, s, "utf8"); console.log("ISSUE-13 fixed"); }
else console.log("ISSUE-13: anchors not found");
