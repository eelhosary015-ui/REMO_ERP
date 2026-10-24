import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const SKIP = new Set(["node_modules", "dist", ".git", ".zwork", "tmp", "backups", "android", "ios", "public", ".freebuff"]);
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|cjs|js|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}
const files = walk(".");

const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
const tables = new Set((await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")).rows.map(r => r.table_name));
const cols = new Map();
for (const r of (await c.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public'")).rows) {
  if (!cols.has(r.table_name)) cols.set(r.table_name, new Set());
  cols.get(r.table_name).add(r.column_name);
}

/** يقرأ أول وسيط لاستدعاء query( بدءًا من موضع القوس */
function readFirstArg(src, openParen) {
  let i = openParen + 1;
  while (i < src.length && /\s/.test(src[i])) i++;
  const q = src[i];
  if (q !== "`" && q !== "'" && q !== '"') return null;
  let out = "", depth = 0;
  i++;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\\") { out += src[i + 1] ?? ""; i += 2; continue; }
    if (q === "`" && ch === "$" && src[i + 1] === "{") {
      // تعبير داخل القالب — نتخطاه
      depth = 1; i += 2;
      while (i < src.length && depth > 0) {
        if (src[i] === "{") depth++;
        else if (src[i] === "}") depth--;
        i++;
      }
      out += " __DYN__ ";
      continue;
    }
    if (ch === q) break;
    out += ch; i++;
  }
  return out;
}

const missingTables = [], missingColumns = [];
const seenT = new Set(), seenC = new Set();

for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const re = /\.query\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    const sql = readFirstArg(src, m.index + ".query".length);
    if (!sql || sql.length < 8) continue;
    if (!/\b(SELECT|INSERT|UPDATE|DELETE|WITH)\b/i.test(sql)) continue;
    const line = src.slice(0, m.index).split("\n").length;
    const clean = sql.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");

    for (const im of clean.matchAll(/INSERT\s+INTO\s+([a-zA-Z_][\w.]*)\s*\(([^)]*)\)/gi)) {
      const t = im[1].replace(/^public\./, "").toLowerCase();
      if (t.includes("__dyn__")) continue;
      if (!tables.has(t)) { const k = `${f}:${line}:${t}`; if (!seenT.has(k)) { seenT.add(k); missingTables.push({ file: f, line, table: t, ctx: "INSERT" }); } continue; }
      for (const raw of im[2].split(",")) {
        const col = raw.trim().replace(/["`]/g, "").replace(/\s.*$/, "").toLowerCase();
        if (!col || !/^[a-z_]\w*$/.test(col)) continue;
        if (!cols.get(t).has(col)) { const k = `${f}:${line}:${t}.${col}`; if (!seenC.has(k)) { seenC.add(k); missingColumns.push({ file: f, line, table: t, column: col, ctx: "INSERT" }); } }
      }
    }

    for (const um of clean.matchAll(/UPDATE\s+([a-zA-Z_][\w.]*)\s+SET\s+([\s\S]*?)(?:\bWHERE\b|\bRETURNING\b|$)/gi)) {
      const t = um[1].replace(/^public\./, "").toLowerCase();
      if (t.includes("__dyn__")) continue;
      if (!tables.has(t)) { const k = `${f}:${line}:${t}`; if (!seenT.has(k)) { seenT.add(k); missingTables.push({ file: f, line, table: t, ctx: "UPDATE" }); } continue; }
      for (const part of um[2].split(",")) {
        const mm = /^\s*([a-zA-Z_]\w*)\s*=/.exec(part);
        if (!mm) continue;
        const col = mm[1].toLowerCase();
        if (!cols.get(t).has(col)) { const k = `${f}:${line}:${t}.${col}`; if (!seenC.has(k)) { seenC.add(k); missingColumns.push({ file: f, line, table: t, column: col, ctx: "UPDATE" }); } }
      }
    }

    for (const fm of clean.matchAll(/\b(?:FROM|JOIN)\s+([a-zA-Z_][\w.]*)/gi)) {
      const t = fm[1].replace(/^public\./, "").toLowerCase();
      if (t.includes("__dyn__") || ["unnest", "generate_series", "lateral", "only", "values", "dual"].includes(t)) continue;
      if (t.includes("information_schema") || t.includes("pg_")) continue;
      if (!tables.has(t) && tables.has(t.split(".").pop())) continue;
      if (!tables.has(t)) { const k = `${f}:${line}:${t}`; if (!seenT.has(k)) { seenT.add(k); missingTables.push({ file: f, line, table: t, ctx: "FROM/JOIN" }); } }
    }
  }
}

console.log("=== جداول مقترحة وغير موجودة (من .query فقط) ===");
for (const t of missingTables) console.log(`  ${t.file}:${t.line} → ${t.table} (${t.ctx})`);
console.log("count:", missingTables.length);

console.log("\n=== أعمدة INSERT/UPDATE غير موجودة ===");
for (const t of missingColumns) console.log(`  ${t.file}:${t.line} → ${t.table}.${t.column} (${t.ctx})`);
console.log("count:", missingColumns.length);
fs.writeFileSync("tmp/audit-schema2.json", JSON.stringify({ missingTables, missingColumns }, null, 2));
await c.end();
