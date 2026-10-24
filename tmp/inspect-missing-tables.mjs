import fs from "node:fs";
import path from "node:path";

const SKIP = new Set(["node_modules", "dist", ".git", ".zwork", "tmp", "backups", "android", "ios", "public"]);
function walk(d, o = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, o);
    else if (/\.(ts|tsx)$/.test(e.name)) o.push(p);
  }
  return o;
}

const tables = ["stock_batches", "stock_balances", "inventory_notifications", "supplier_ratings", "customer_ratings"];
const files = walk(".");

for (const t of tables) {
  console.log(`\n\n================ ${t} ================`);
  const cols = new Set();
  let refs = 0;
  for (const f of files) {
    const s = fs.readFileSync(f, "utf8");
    if (!s.includes(t)) continue;
    const lines = s.split("\n");
    lines.forEach((line, i) => {
      if (!line.includes(t)) return;
      refs++;
      if (refs <= 26) console.log(`${f}:${i + 1}  ${line.trim().slice(0, 190)}`);
      // استخراج أعمدة من INSERT
      const ins = new RegExp(`INSERT\\s+INTO\\s+${t}\\s*\\(([^)]*)\\)`, "i").exec(line);
      if (ins) ins[1].split(",").forEach(c => cols.add(c.trim()));
      // استخراج أعمدة من UPDATE ... SET
      const upd = new RegExp(`UPDATE\\s+${t}\\s+SET\\s+([\\s\\S]*?)(?:WHERE|$)`, "i").exec(line);
      if (upd) upd[1].split(",").forEach(p => { const m = /^\s*([a-z_]\w*)\s*=/.exec(p); if (m) cols.add(m[1]); });
    });
  }
  console.log(`\n--- إجمالي الإشارات: ${refs} | أعمدة INSERT/UPDATE: ${[...cols].join(", ") || "(لا شيء)"}`);
}
