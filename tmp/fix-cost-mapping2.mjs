import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
await c.query("BEGIN");

const ins = async (code, name, nameEn, accountType) => {
  await c.query(`
    INSERT INTO accounts (code, name, type, parent_id, balance, name_ar, name_en, account_type, account_nature, level, is_leaf, allow_posting, status, is_active, currency)
    SELECT $1::text, $2::text, 'expense', NULL, 0, $2::varchar, $3::varchar, $4::varchar, 'debit', 1, true, true, true, true, 'EGP'
    WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = $1::text)
  `, [code, name, nameEn, accountType]);
};
await ins("5102", "مصروفات الكهرباء والمرافق", "Utilities Expense", "EXPENSE");
await ins("5103", "مصروفات إدارية وعمومية", "General & Administrative Expenses", "EXPENSE");

const ids = (await c.query("SELECT code, id FROM accounts WHERE code IN ('5102','5103')")).rows;
const A5102 = ids.find(r => r.code === '5102').id;
const A5103 = ids.find(r => r.code === '5103').id;
console.log("accounts:", { A5102, A5103 });

const r1 = await c.query(`UPDATE account_config SET account_id = $1, updated_at = NOW() WHERE key = 'utilities_expense'`, [A5102]);
const r2 = await c.query(`UPDATE account_config SET account_id = $1, updated_at = NOW()
  WHERE key IN ('cost_expense','operating_expense','other_expense','rent_expense','maintenance_expense','supplies_expense','transport_expense','marketing_expense','insurance_expense','refund_expense')`, [A5103]);
console.log("config rows:", { utilities: r1.rowCount, general: r2.rowCount });

const r3 = await c.query(`UPDATE cost_items SET accounting_account_id = $1
  WHERE (name ILIKE '%كهرب%' OR arabic_name ILIKE '%كهرب%') AND accounting_account_id IS NULL`, [A5102]);
console.log("cost_items linked:", r3.rowCount);

await c.query("COMMIT");

console.log("\n=== after ===");
for (const r of (await c.query(`SELECT key, account_id FROM account_config WHERE key IN ('utilities_expense','cost_expense','cost_of_goods_sold','payroll_expense','rent_expense') ORDER BY key`)).rows)
  console.log(`${r.key} → ${r.account_id}`);
for (const r of (await c.query(`SELECT id, name, accounting_account_id FROM cost_items ORDER BY id`)).rows)
  console.log(`item ${r.id} ${String(r.name).trim()} → ${r.accounting_account_id}`);
await c.end();
