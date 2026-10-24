import pg from "pg";
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
await c.query("BEGIN");
try {
  const r = await c.query(`INSERT INTO journal_entries (date, description, status, total_debit, total_credit)
    VALUES ('2026-07-15','TEST CLOSED PERIOD GUARD', 'posted', 1, 1) RETURNING id`);
  console.log("❌ الإدخال نجح — الحماية لا تعمل. id=", r.rows[0].id);
} catch (e) {
  console.log("✅ الحماية تعمل — رُفض الإدخال:", e.message.slice(0, 140));
}
await c.query("ROLLBACK");
// تأكيد أن فترة مفتوحة تعمل
await c.query("BEGIN");
try {
  const r = await c.query(`INSERT INTO journal_entries (date, description, status, total_debit, total_credit)
    VALUES ('2026-10-21','TEST OPEN PERIOD', 'posted', 1, 1) RETURNING id`);
  console.log("✅ فترة أكتوبر المفتوحة تقبل الإدخال (id=" + r.rows[0].id + ")");
} catch (e) {
  console.log("❌ فترة مفتوحة رُفضت:", e.message.slice(0, 140));
}
await c.query("ROLLBACK");
await c.end();
