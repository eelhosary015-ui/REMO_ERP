import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_cost_test" });
await c.connect();
const r = await c.query("SELECT id, year, month, status FROM financial_periods WHERE year=2026 ORDER BY month");
for (const x of r.rows) console.log(`${x.id}\t${x.year}-${String(x.month).padStart(2,'0')}\t${x.status}`);
await c.end();
