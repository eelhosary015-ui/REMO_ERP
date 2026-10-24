process.env.DATABASE_URL = "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_cost_test";

const { postCostEntry } = await import("../modules/accounts/services/auto-posting.service.js");

const cases = [
  { label: "بند كهرباء مربوط (cost_item_id=1)", payload: { category: "الإدارة", amount: 777, cost_item_id: 1, payment_method: "نقدي", date: "2026-10-21", cost_center_id: 1, notes: "TEST-ELEC-LINKED" } },
  { label: "تصنيف utilities بدون بند", payload: { category: "utilities", amount: 111, payment_method: "نقدي", date: "2026-10-21", notes: "TEST-UTILITIES-CAT" } },
  { label: "تصنيف غير معروف (الإدارة) بدون بند", payload: { category: "الإدارة", amount: 55, payment_method: "نقدي", date: "2026-10-21", notes: "TEST-ADMIN" } },
];

for (const c of cases) {
  try {
    const entry = await postCostEntry(c.payload);
    const pg = await import("pg");
    const client = new pg.default.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    const lines = await client.query(
      `SELECT a.code, a.name, ji.debit, ji.credit
       FROM journal_items ji JOIN accounts a ON a.id = ji.account_id
       WHERE ji.journal_entry_id = $1 ORDER BY ji.debit DESC`,
      [entry.id]
    );
    await client.end();
    console.log(`\n✓ ${c.label} → JE ${entry.id}`);
    for (const l of lines.rows) console.log(`   ${l.code} ${l.name} | DR ${l.debit} | CR ${l.credit}`);
  } catch (e) {
    console.log(`\n✗ ${c.label} → ${e.message}`);
  }
}
process.exit(0);
