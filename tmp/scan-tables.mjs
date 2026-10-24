import fs from "node:fs";
import path from "node:path";

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(e.name)) out.push(p);
  }
  return out;
}
const files = walk("src");

// يقرأ للخلف من ".map(" لتحديد تعبير المصفوفة (موازنة الأقواس)
function readExprBack(s, mapIdx) {
  let j = mapIdx - 1;
  while (j >= 0 && /\s/.test(s[j])) j--;
  const exprEnd = j + 1;
  let k = j, parens = 0, brackets = 0, braces = 0;
  while (k >= 0) {
    const c = s[k];
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
  return { expr: s.slice(k + 1, exprEnd).trim(), start: k + 1 };
}

const results = [];
for (const f of files) {
  const s = fs.readFileSync(f, "utf8");
  const mapRe = /\.map\(/g;
  let m;
  while ((m = mapRe.exec(s))) {
    const after = s.slice(m.index, m.index + 900);
    if (!/<tr[\s>]/.test(after)) continue;
    // يجب أن يكون <tr> ناتج الرندر وليس نصًا ساكنًا بعيدًا — نقصر النافذة على أول قوس للكولباك
    const cb = after.slice(0, 700);
    if (!/<tr[\s>]/.test(cb)) continue;
    const { expr, start } = readExprBack(s, m.index);
    const line = s.slice(0, m.index).split("\n").length;
    const flat = expr.replace(/\s+/g, " ");
    const flags = [];
    if (/\.slice\(/.test(flat)) flags.push("SLICED");
    if (/current\w*Items|paginated|paged\w|PageRows|pageRows|visibleRows|rowsPerPage|currentPage|itemsPerPage|Pagination/i.test(flat)) flags.push("PAGINATED?");
    if (/^\[.*\]$/.test(flat)) {
      const est = (flat.match(/,/g) || []).length + 1;
      flags.push("LITERAL~" + est);
    }
    if (/^(Object\.(keys|entries|values)|\d+|months|weekDays|days|years)/i.test(flat)) flags.push("STATIC?");
    results.push({ f, line, flat, flags: flags.join(","), exprStart: start });
  }
}
// تجميع سريع
const byFile = {};
for (const r of results) (byFile[r.f] ||= []).push(r);
for (const [f, arr] of Object.entries(byFile)) {
  console.log("\n=== " + f + " (" + arr.length + ")");
  for (const r of arr) console.log(`  L${r.line} ${r.flags ? "[" + r.flags + "] " : ""}${r.flat.slice(0, 110)}`);
}
console.log("\nTOTAL map-tr sites:", results.length, "files:", Object.keys(byFile).length);
