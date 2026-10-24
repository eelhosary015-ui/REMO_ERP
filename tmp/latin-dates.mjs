import fs from "node:fs";
const f = "src/components/inventory/EnterpriseStockBalanceView.tsx";
let s = fs.readFileSync(f, "utf8");
const before = (s.match(/"ar-EG"/g) || []).length;
s = s.replace(/"ar-EG"/g, '"ar-EG-u-nu-latn"');
fs.writeFileSync(f, s, "utf8");
console.log("remaining \"ar-EG\" occurrences replaced:", before);
