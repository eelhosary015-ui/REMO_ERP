import pg from "pg";
import { config } from "dotenv";
config({quiet:true});
for (const [label, url] of [["test", process.env.DATABASE_URL.replace(/\/[^/]+$/, "/erp_system1_test")], ["prod", process.env.DATABASE_URL]]) {
  const c = new pg.Client({connectionString: url});
  await c.connect();
  const e = await c.query("select count(*)::int n from employees");
  const b = await c.query("select count(*)::int n from branches");
  let fa = "missing";
  try { await c.query("select 1 from fixed_assets limit 1"); fa = "exists"; } catch { fa = "missing"; }
  console.log(label, {employees: e.rows[0].n, branches: b.rows[0].n, fixed_assets: fa});
  await c.end();
}
