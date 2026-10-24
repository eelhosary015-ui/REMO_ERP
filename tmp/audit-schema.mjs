import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const ROOT = ".";
const SKIP = new Set(["node_modules", "dist", ".git", ".zwork", "tmp", "backups", "android", "ios", "public"]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|cjs|js|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}
const files = walk(ROOT);
console.log("files scanned:", files.length);

const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
const tables = new Set((await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")).rows.map(r => r.table_name));
const cols = new Map();
for (const r of (await c.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public'")).rows) {
  if (!cols.has(r.table_name)) cols.set(r.table_name, new Set());
  cols.get(r.table_name).add(r.column_name);
}

const NOT_TABLES = new Set(["select", "unnest", "generate_series", "jsonb_array_elements", "json_array_elements", "lateral", "only", "values", "dual"]);

// استخراج نصوص SQL التقريبية: قوالب backtick أو سلاسل عادية تحتوي FROM/INSERT/UPDATE
const findings = { missingTables: [], missingColumns: [], seen: new Set() };

function scanSqlText(sql, file, lineNo) {
  const clean = sql
    .replace(/\$\{[^}]*\}/g, " __DYN__ ")
    .replace(/--[^\n]*/g, " ");

  // INSERT INTO t (a,b,c)
  for (const m of clean.matchAll(/INSERT\s+INTO\s+([a-zA-Z_][\w.]*)\s*\(([^)]*)\)/gi)) {
    const t = m[1].replace(/^public\./, "").toLowerCase();
    if (!tables.has(t)) { findings.missingTables.push({ file, line: lineNo, table: t, ctx: "INSERT" }); continue; }
    for (const raw of m[2].split(",")) {
      const col = raw.trim().replace(/["`]/g, "").replace(/\s.*$/, "").toLowerCase();
      if (!col || col.includes("__dyn__") || col === "select") continue;
      if (!cols.get(t).has(col)) findings.missingColumns.push({ file, line: lineNo, table: t, column: col, ctx: "INSERT" });
    }
  }

  // UPDATE t SET a=, b=
  for (const m of clean.matchAll(/UPDATE\s+([a-zA-Z_][\w.]*)\s+SET\s+([\s\S]*?)(?:\bWHERE\b|\bRETURNING\b|$)/gi)) {
    const t = m[1].replace(/^public\./, "").toLowerCase();
    if (!tables.has(t)) { findings.missingTables.push({ file, line: lineNo, table: t, ctx: "UPDATE" }); continue; }
    for (const part of m[2].split(",")) {
      const mm = /^\s*([a-zA-Z_]\w*)\s*=/.exec(part);
      if (!mm) continue;
      const col = mm[1].toLowerCase();
      if (["now", "current_timestamp"].includes(col)) continue;
      if (!cols.get(t).has(col)) findings.missingColumns.push({ file, line: lineNo, table: t, column: col, ctx: "UPDATE" });
    }
  }

  // FROM / JOIN
  for (const m of clean.matchAll(/\b(?:FROM|JOIN)\s+([a-zA-Z_][\w.]*)/gi)) {
    const t = m[1].replace(/^public\./, "").toLowerCase();
    if (NOT_TABLES.has(t)) continue;
    if (!tables.has(t)) findings.missingTables.push({ file, line: lineNo, table: t, ctx: "FROM/JOIN" });
  }
}

for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const lines = src.split("\n");
  // اقتراب: أي قالب backtick أو سلسلة فيها SQL
  const re = /`([^`]{20,8000})`|"([^"\n]{20,2000})"|'([^'\n]{20,2000})'/g;
  let m;
  while ((m = re.exec(src))) {
    const text = m[1] ?? m[2] ?? m[3] ?? "";
    if (!/\b(FROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|JOIN)\b/i.test(text)) continue;
    const lineNo = src.slice(0, m.index).split("\n").length;
    scanSqlText(text, f, lineNo);
  }
}

// إزالة التكرار
const uniq = (arr, keyFn) => {
  const seen = new Set();
  return arr.filter(x => { const k = keyFn(x); if (seen.has(k)) return false; seen.add(k); return true; });
};
findings.missingTables = uniq(findings.missingTables, x => `${x.file}:${x.line}:${x.table}`);
findings.missingColumns = uniq(findings.missingColumns, x => `${x.file}:${x.line}:${x.table}.${x.column}`);

console.log("\n=== جداول مذكورة في الكود وغير موجودة في القاعدة ===");
for (const t of findings.missingTables) console.log(`  ${t.file}:${t.line} → ${t.table} (${t.ctx})`);
console.log("  count:", findings.missingTables.length);

console.log("\n=== أعمدة مذكورة في INSERT/UPDATE وغير موجودة ===");
for (const t of findings.missingColumns.slice(0, 80)) console.log(`  ${t.file}:${t.line} → ${t.table}.${t.column} (${t.ctx})`);
console.log("  count:", findings.missingColumns.length);

fs.writeFileSync("tmp/audit-schema-findings.json", JSON.stringify(findings, null, 2));
await c.end();
