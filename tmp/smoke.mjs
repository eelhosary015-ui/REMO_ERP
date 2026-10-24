import fs from "node:fs";

const BASE = "http://localhost:3106";
const token = "preview-bypass-token";
const paths = JSON.parse(fs.readFileSync("tmp/audit-fe-paths.json", "utf8"))
  .filter(p => p.methods.includes("GET") && !p.path.includes(":id"))
  .map(p => p.path);

const uniq = [...new Set(paths)];
console.log("GET endpoints to probe:", uniq.length);

const results = [];
for (const p of uniq) {
  const url = BASE + p;
  const started = Date.now();
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal });
    clearTimeout(t);
    let body = "";
    try { body = (await res.text()).slice(0, 300); } catch {}
    results.push({ path: p, status: res.status, ms: Date.now() - started, body: res.status >= 400 ? body : "" });
  } catch (e) {
    results.push({ path: p, status: 0, ms: Date.now() - started, body: String(e.message).slice(0, 200) });
  }
}

const bad = results.filter(r => r.status >= 400 || r.status === 0);
console.log(`\n=== نتائج: ${results.length} مسار — ${results.length - bad.length} ناجح، ${bad.length} فاشل ===`);
for (const r of bad.sort((a,b)=>a.status-b.status)) {
  console.log(`${r.status || "ERR"}\t${r.path}\t${r.body.replace(/\s+/g," ").slice(0,180)}`);
}
fs.writeFileSync("tmp/audit-api-results.json", JSON.stringify(results, null, 2));
