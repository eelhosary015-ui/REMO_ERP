import fs from "node:fs";
import path from "node:path";

const roots = ["src"];
const files = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(e.name) && !p.includes("i18n")) files.push(p);
  }
}
roots.forEach(walk);

const counts = new Map();
const reQuoted = /["'`]([\u0600-\u06FF][^"'`\n]{1,60})["'`]/g;
const reJsxText = />\s*([\u0600-\u06FF][^<>{}\n]{1,60}?)\s*</g;

for (const f of files) {
  const s = fs.readFileSync(f, "utf8");
  for (const re of [reQuoted, reJsxText]) {
    let m;
    while ((m = re.exec(s))) {
      const t = m[1].trim().replace(/\s+/g, " ");
      if (!t || t.length < 2) continue;
      if (/^[\d\s.,%\-–—:]+$/.test(t)) continue;
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
}
const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 140);
console.log(JSON.stringify(top, null, 0));
