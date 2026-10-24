import fs from "node:fs";
const f = "src/components/inventory/StockItemDetailsDrawer.tsx";
let s = fs.readFileSync(f, "utf8");
const b = s;
s = s.replace('Number(n || 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 })',
              'Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })');
s = s.replace(/"ar-EG"/g, '"ar-EG-u-nu-latn"');
fs.writeFileSync(f, s, "utf8");
console.log("drawer updated:", s !== b, "| remaining ar-EG:", (s.match(/"ar-EG"/g) || []).length);
