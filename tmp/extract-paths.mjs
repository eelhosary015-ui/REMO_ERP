import fs from "node:fs";
import path from "node:path";
const SKIP = new Set(["node_modules","dist",".git",".zwork","tmp","backups","android","ios","public"]);
function walk(d,o=[]){for(const e of fs.readdirSync(d,{withFileTypes:true})){if(SKIP.has(e.name))continue;const p=path.join(d,e.name);if(e.isDirectory())walk(p,o);else if(/\.(ts|tsx)$/.test(e.name))o.push(p);}return o;}
const files = walk("src");
const paths = new Map();
for (const f of files) {
  const s = fs.readFileSync(f, "utf8");
  for (const m of s.matchAll(/api\.(get|post|put|patch|delete)\(\s*[`"']([^`"']+)[`"']/g)) {
    const p = m[2].split("?")[0].replace(/\$\{[^}]*\}/g, ":id");
    if (!p.startsWith("/api")) continue;
    if (!paths.has(p)) paths.set(p, { methods: new Set(), files: new Set() });
    paths.get(p).methods.add(m[1].toUpperCase());
    paths.get(p).files.add(f);
  }
}
console.log("unique API paths referenced in frontend:", paths.size);
const list = [...paths.entries()].sort();
for (const [p, v] of list.slice(0, 260)) console.log(`${[...v.methods].join(",")}\t${p}`);
fs.writeFileSync("tmp/audit-fe-paths.json", JSON.stringify(list.map(([p,v])=>({path:p,methods:[...v.methods]})), null, 2));
