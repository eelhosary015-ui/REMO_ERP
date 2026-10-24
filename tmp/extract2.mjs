import fs from "node:fs";
let raw = fs.readFileSync("tmp/audit-vitest.log", "utf8").replace(/\x1b\[[0-9;]*m/g, "");
const lines = raw.split("\n");
for (const key of ["sales-invoice.test.ts > إصدار فاتورة مبيعات — المستند والقيود والأرصدة > فاتورة نقدية", "sales-return.test.ts > مرتجع المبيعات", "sales-invoice.test.ts > إصدار فاتورة مبيعات — المستند والقيود والأرصدة > ينشئ ويربط الحسابات الناقصة"]) {
  const i = lines.findIndex(l => l.startsWith(" FAIL ") && l.includes(key));
  if (i === -1) { console.log("not found:", key); continue; }
  console.log("\n### " + lines[i].trim());
  for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) { const t = lines[j].trim(); if (t) console.log("   " + t.slice(0, 200)); }
}
