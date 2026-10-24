import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();

console.log("=== chart of accounts ===");
const acc = await c.query("SELECT id, code, name, account_type, is_active, allow_posting FROM accounts ORDER BY code");
for (const r of acc.rows) console.log(`${r.id}\t${r.code}\t${r.name}\t${r.account_type}\tpost=${r.allow_posting}`);

console.log("\n=== cost_items (بنود التكلفة) ===");
const ci = await c.query("SELECT id, code, name, category, accounting_account_id, is_active FROM cost_items ORDER BY id").catch(e => ({ rows: [{ err: e.message }] }));
for (const r of ci.rows) console.log(JSON.stringify(r));

console.log("\n=== operating_costs (آخر 5) ===");
const oc = await c.query("SELECT id, voucher_no, date, category, cost_item_id, cost_item_name, amount, department, accounting_account FROM operating_costs ORDER BY id DESC LIMIT 5").catch(e => ({ rows: [{ err: e.message }] }));
for (const r of oc.rows) console.log(JSON.stringify(r));

console.log("\n=== account_config (expense keys) ===");
const cfg = await c.query("SELECT key, account_id FROM account_config WHERE key ILIKE '%expense%' OR key ILIKE '%cost%' OR key ILIKE '%utilit%' ORDER BY key");
for (const r of cfg.rows) console.log(`${r.key} → ${r.account_id}`);

await c.end();
