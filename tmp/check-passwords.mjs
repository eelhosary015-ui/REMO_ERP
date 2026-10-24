import pg from "pg";
import bcrypt from "bcryptjs";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
const rows = (await c.query("SELECT id, username, password, role, must_change_password FROM users ORDER BY id")).rows;
for (const u of rows) {
  const p = String(u.password || "");
  console.log(`#${u.id} ${u.username} | len=${p.length} | prefix=${p.slice(0,7)} | role=${u.role} | must_change=${u.must_change_password}`);
  for (const cand of ["123456","Admin@1234","elhosary123","admin","123456789","gIeqC8UhQA4HbL6s"]) {
    let ok = false;
    try { ok = bcrypt.compareSync(cand, p); } catch (e) { ok = "ERR"; }
    if (ok === true) console.log(`    ✅ يطابق: ${cand}`);
    if (ok === "ERR") console.log(`    ⚠️ hash غير صالح لـ bcrypt`);
  }
}
await c.end();
