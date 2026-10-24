import fs from "node:fs";

function readExprBack(s, mapIdx) {
  let j = mapIdx - 1;
  while (j >= 0 && /\s/.test(s[j])) j--;
  const exprEnd = j + 1;
  let k = j, parens = 0, brackets = 0, braces = 0;
  while (k >= 0) {
    const c = s[k];
    if (c === ";") break;
    if (/\s/.test(c)) { k--; continue; }
    if (c === ")") parens++;
    else if (c === "(") { if (parens === 0) break; parens--; }
    else if (c === "]") brackets++;
    else if (c === "[") { if (brackets === 0) break; brackets--; }
    else if (c === "}") braces++;
    else if (c === "{") { if (braces === 0) break; braces--; }
    else if (parens === 0 && brackets === 0 && braces === 0) {
      if (!/[\w$.]/.test(c)) break;
    }
    k--;
  }
  return { expr: s.slice(k + 1, exprEnd).trim(), start: k + 1, brokeAt: s[k] };
}

for (const [f, lineNo] of [["src/components/HotelManagement.tsx", 2410], ["src/components/inventory/reports/InventoryReportsView.tsx", 1157], ["src/components/sales/SalesSettings.tsx", 1448]]) {
  const s = fs.readFileSync(f, "utf8");
  const lines = s.split("\n");
  let lineStart = 0;
  for (let i = 0; i < lineNo - 1; i++) lineStart += lines[i].length + 1;
  const lineEnd = lineStart + lines[lineNo - 1].length;
  const mapRe = /\.map\(/g;
  let m;
  console.log(`\n### ${f} L${lineNo}`);
  while ((m = mapRe.exec(s))) {
    if (m.index < lineStart || m.index >= lineEnd) continue;
    const after = s.slice(m.index, m.index + 1200);
    const trIdx = after.search(/<tr[\s>/]/);
    console.log("  map at", m.index, "| trIdx:", trIdx, "| backticks:", (after.slice(0, trIdx).match(/`/g) || []).length);
    if (trIdx === -1) continue;
    const bt = (after.slice(0, trIdx).match(/`/g) || []).length;
    if (bt % 2 === 1) { console.log("  -> rejected: backtick parity"); continue; }
    let { expr, start, brokeAt } = readExprBack(s, m.index);
    const rawSlice = s.slice(start, m.index);
    const retPrefix = /^\s*return\s+/.exec(rawSlice);
    if (retPrefix) {
      start += retPrefix[0].length;
      expr = s.slice(start, m.index).trim();
    }
    console.log("  brokeAt:", JSON.stringify(brokeAt), "| expr:", JSON.stringify(expr.slice(0, 120)));
  }
}
