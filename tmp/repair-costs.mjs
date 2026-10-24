import fs from "node:fs";
import path from "node:path";

const files = [
  "Costs.tsx",
  "costs/CostsReportsDetails.tsx",
  "costs/product-costing/BOMMaterialsTable.tsx",
  "costs/product-costing/CostReportsTab.tsx",
  "costs/product-costing/VarianceAndAuditTab.tsx",
  "production/CostManagement.tsx",
];

const IMPORT_LINE = 'import { pageRows, PaginationBar, usePaginationState } from';

function importBlockEnd(lines) {
  // آخر سطر من كتلة الاستيرادات في أعلى الملف (يدعم import متعدد الأسطر)
  let i = 0;
  let lastEnd = -1;
  while (i < lines.length && i < 400) {
    const line = lines[i].trim();
    if (line.startsWith("import ") || line.startsWith("import{")) {
      // هل البيان مكتمل في نفس السطر؟
      if (/from\s+['"]/.test(line) || /^import\s+['"]/.test(line)) {
        lastEnd = i;
        i++;
        continue;
      }
      // متعدد الأسطر — استمر لحد from
      let j = i + 1;
      while (j < lines.length && !/from\s+['"]/.test(lines[j])) j++;
      if (j < lines.length) lastEnd = j;
      i = j + 1;
      continue;
    }
    if (line === "" || line.startsWith("//")) { i++; continue; }
    break;
  }
  return lastEnd;
}

for (const f of files) {
  const target = path.join("src", "components", f);
  let src = fs.readFileSync(target, "utf8");
  const before = src;

  // 1) إصلاح onPageSize الناقص
  src = src.replace(/onPageSize=(pgn\d+)\.setPageSize\}/g, "onPageSize={$1.setPageSize}");

  // 2) إزالة سطر الاستيراد لو مزروع جوّه import متعدد الأسطر
  const lines = src.split("\n");
  const idxs = [];
  lines.forEach((l, i) => { if (l.trim().startsWith(IMPORT_LINE)) idxs.push(i); });
  let removed = false;
  for (const i of idxs) {
    let p = i - 1;
    while (p >= 0 && lines[p].trim() === "") p--;
    const prev = p >= 0 ? lines[p].trim() : "";
    const misplaced = prev.startsWith("import") && !/from\s+['"]/.test(prev) || (prev.endsWith("{") && !prev.includes("}"));
    const alreadyOutside = /from\s+['"]/.test(lines[i]);
    if (misplaced && !alreadyOutside) { lines.splice(i, 1); removed = true; break; }
  }
  let out = lines.join("\n");

  // 3) لو الاستيراد مش موجود أصلاً، ضيفه بعد كتلة الاستيرادات
  const has = out.split("\n").some((l) => l.trim().startsWith(IMPORT_LINE));
  if (!has) {
    const ls = out.split("\n");
    const end = importBlockEnd(ls);
    const rel = path.relative(path.dirname(target), path.join("src", "components", "PaginationBar")).replace(/\\/g, "/");
    const relPath = rel.startsWith(".") ? rel : "./" + rel;
    ls.splice(end + 1, 0, `import { pageRows, PaginationBar, usePaginationState } from "${relPath}";`);
    out = ls.join("\n");
  }

  if (out !== before) {
    fs.writeFileSync(target, out, "utf8");
    console.log(`fixed: ${f}${removed ? " (import moved)" : ""}`);
  } else {
    console.log(`unchanged: ${f}`);
  }
}
