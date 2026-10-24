import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();

const cols = async (t) => (await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position", [t])).rows;
console.log("=== operating_costs columns ===");
console.log((await cols("operating_costs")).map(r => r.column_name).join(", "));
console.log("\n=== cost_items columns ===");
console.log((await cols("cost_items")).map(r => r.column_name).join(", "));

console.log("\n=== آخر تكاليف تشغيلية ===");
const oc = await c.query("SELECT * FROM operating_costs ORDER BY id DESC LIMIT 3");
for (const r of oc.rows) console.log(JSON.stringify(r, null, 0).slice(0, 900));

console.log("\n=== بنود التكلفة ===");
const ci = await c.query("SELECT * FROM cost_items ORDER BY id LIMIT 20");
for (const r of ci.rows) console.log(JSON.stringify(r).slice(0, 400));

console.log("\n=== JE-000069 ===");
const je = await c.query("SELECT id, entry_number, entry_date, description, source_type, source_id, status, total_debit FROM journal_entries WHERE entry_number = 'JE-000069' OR id = (SELECT max(id) FROM journal_entries) ORDER BY id DESC LIMIT 2");
for (const r of je.rows) console.log(JSON.stringify(r));
const lines = await c.query(`SELECT ji.id, ji.account_id, a.code, a.name, ji.debit, ji.credit, ji.description, ji.cost_center_id
  FROM journal_items ji JOIN accounts a ON a.id = ji.account_id
  WHERE ji.entry_id = (SELECT id FROM journal_entries WHERE entry_number='JE-000069' LIMIT 1)`);
for (const r of lines.rows) console.log(JSON.stringify(r));

await c.end();
