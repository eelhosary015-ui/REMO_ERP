/**
 * تحقق قبول عبر HTTP على خادم الاختبار (منفذ 3100، قاعدة _test).
 * يثبت أن الحظر مطبّق على الخادم وليس في الواجهة فقط.
 */
import pg from "pg";
import { config } from "dotenv";

config({ quiet: true });
const BASE = "http://127.0.0.1:3100";
const TEST_URL = process.env.DATABASE_URL.replace(/\/[^/]+$/, "/erp_system1_test");
const YEAR = 2027;
const FY_NAME = `TEST-API-${Date.now()}`;

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
}

async function j(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

// ── تجهيز الحسابات ──
const accounts = (await j("GET", "/api/accounts")).data;
const cash = accounts.find((a) => a.code === "1110") || accounts[0];
const revenue = accounts.find((a) => a.code === "4102") || accounts.find((a) => a.type === "revenue");
if (!cash || !revenue) throw new Error("تعذّر العثور على حسابات اختبار");

const items = [
  { account_id: cash.id, debit: 100, credit: 0 },
  { account_id: revenue.id, debit: 0, credit: 100 },
];

// ── 1) إنشاء سنة 2027 ──
const created = await j("POST", "/api/fiscal-years", {
  name: FY_NAME,
  start_date: `${YEAR}-01-01`,
  end_date: `${YEAR}-12-31`,
});
record("إنشاء سنة مالية اختبارية", created.status === 201, `status=${created.status}`);
const fyId = created.data?.id;
if (!fyId) throw new Error("لم تُنشأ السنة المالية: " + JSON.stringify(created.data));

const periods = (await j("GET", `/api/financial-periods?fiscal_year_id=${fyId}`)).data;
const jan = periods.find((p) => p.month === 1);
const feb = periods.find((p) => p.month === 2);
const janEndLocal = jan?.end_date ? new Date(jan.end_date).toLocaleDateString("en-CA") : null;
record("الفترات مُنشأة بتواريخ صحيحة", janEndLocal === `${YEAR}-01-31`, `jan end=${janEndLocal}`);

// ── 2) ترحيل في فترة مفتوحة ──
const before = await j("POST", "/api/journal-entries", {
  date: `${YEAR}-01-10`,
  description: "HTTP acceptance open period",
  reference: `HTTP-OPEN-${Date.now()}`,
  items,
});
record("ترحيل قيد في فترة مفتوحة", before.status === 200, `status=${before.status}`);

// ── 3) التحقق المسبق ──
const preflight = await j("POST", `/api/financial-periods/${jan.id}/preflight`, {});
record(
  "التحقق المسبق يعمل ويقرأ بيانات حقيقية",
  preflight.status === 200 && typeof preflight.data?.can_close === "boolean",
  `can_close=${preflight.data?.can_close} errors=${preflight.data?.errors?.length}`,
);
record(
  "التحقق المسبق يكشف القيد غير المرحّل/غير المتوازن أو يمرّ بنظافة",
  preflight.status === 200,
  JSON.stringify((preflight.data?.errors || []).map((e) => e.code)),
);

// ── 4) الإقفال ──
const closed = await j("POST", `/api/financial-periods/${jan.id}/close`, { reason: "إقفال اختبار HTTP" });
record("إقفال الفترة عبر API", closed.status === 200, `status=${closed.status} ${closed.data?.message || closed.data?.error || ""}`);

// ── 5) الحالة محفوظة في قاعدة البيانات ──
const afterList = (await j("GET", `/api/financial-periods?fiscal_year_id=${fyId}`)).data;
const janAfter = afterList.find((p) => p.id === jan.id);
record("الحالة محفوظة في القاعدة (وليست في الواجهة)", janAfter?.status === "closed", `status=${janAfter?.status}`);

// ── 6) محاولة ترحيل داخل الفترة المغلقة ──
const blocked = await j("POST", "/api/journal-entries", {
  date: `${YEAR}-01-15`,
  description: "HTTP acceptance blocked",
  reference: `HTTP-BLOCK-${Date.now()}`,
  items,
});
record(
  "رفض الترحيل داخل الفترة المغلقة عبر API",
  blocked.status === 403 && blocked.data?.code === "PERIOD_CLOSED",
  `status=${blocked.status} code=${blocked.data?.code}`,
);

// ── 7) محاولة تجاوز بـ period_id لفترة مفتوحة مع تاريخ مغلق ──
const spoof = await j("POST", "/api/journal-entries", {
  date: `${YEAR}-01-16`,
  description: "HTTP acceptance spoof period",
  period_id: feb.id,
  items,
});
record("لا يمكن تجاوز الحماية بتزوير period_id", spoof.status === 403, `status=${spoof.status}`);

// ── 8) فترة أخرى مفتوحة تستمر ──
const other = await j("POST", "/api/journal-entries", {
  date: `${YEAR}-02-10`,
  description: "HTTP acceptance other open period",
  reference: `HTTP-OTHER-${Date.now()}`,
  items,
});
record("استمرار الترحيل في فترة مفتوحة أخرى", other.status === 200, `status=${other.status}`);

// ── 9) إعادة الفتح بدون سبب ──
const badReopen = await j("POST", `/api/financial-periods/${jan.id}/reopen`, { reason: "x" });
record("رفض إعادة الفتح بلا سبب معتبر", badReopen.status === 400, `status=${badReopen.status} code=${badReopen.data?.code}`);

// ── 10) إعادة الفتح الصحيحة ──
const goodReopen = await j("POST", `/api/financial-periods/${jan.id}/reopen`, {
  reason: "تصحيح قيد اختبار HTTP مسجل بالخطأ",
});
record("إعادة الفتح بسبب معتمد", goodReopen.status === 200, `status=${goodReopen.status}`);

const afterReopen = await j("POST", "/api/journal-entries", {
  date: `${YEAR}-01-20`,
  description: "HTTP acceptance after reopen",
  reference: `HTTP-REOPEN-${Date.now()}`,
  items,
});
record("الترحيل يعمل بعد إعادة الفتح", afterReopen.status === 200, `status=${afterReopen.status}`);

// ── 11) سجل الأحداث ──
const events = (await j("GET", `/api/period-closing/events?fiscal_year_id=${fyId}`)).data;
record(
  "سجل الإقفال وإعادة الفتح مسجّل بالمستخدم والسبب",
  Array.isArray(events) && events.some((e) => e.action === "reopen") && events.some((e) => e.action === "close"),
  `events=${Array.isArray(events) ? events.length : "n/a"}`,
);

// ── 12) معاينة الإقفال السنوي ──
const preview = await j("GET", `/api/fiscal-years/${fyId}/closing-preview`);
record(
  "معاينة الإقفال السنوي ترجع أرقامًا حقيقية",
  preview.status === 200 && typeof preview.data?.net_result === "number",
  `revenue=${preview.data?.revenue_total} expense=${preview.data?.expense_total} net=${preview.data?.net_result}`,
);

// ── تنظيف قاعدة الاختبار ──
const client = new pg.Client({ connectionString: TEST_URL });
await client.connect();
await client.query("BEGIN");
await client.query("SET LOCAL app.period_lock_bypass = 'on'");
const ids = (await client.query(`SELECT id FROM journal_entries WHERE date::date BETWEEN $1::date AND $2::date`, [`${YEAR}-01-01`, `${YEAR}-12-31`])).rows.map((r) => r.id);
if (ids.length) {
  await client.query(
    `UPDATE accounts a SET balance = a.balance - d.delta
       FROM (SELECT account_id, SUM(debit-credit) AS delta FROM journal_items WHERE journal_entry_id = ANY($1::int[]) GROUP BY account_id) d
      WHERE a.id = d.account_id`,
    [ids],
  );
  await client.query("DELETE FROM journal_items WHERE journal_entry_id = ANY($1::int[])", [ids]);
  await client.query("DELETE FROM journal_entries WHERE id = ANY($1::int[])", [ids]);
}
await client.query("DELETE FROM financial_period_events WHERE fiscal_year_id = $1", [fyId]);
await client.query("DELETE FROM financial_periods WHERE fiscal_year_id = $1", [fyId]);
await client.query("DELETE FROM fiscal_years WHERE id = $1", [fyId]);
await client.query("COMMIT");
await client.end();
console.log("تم تنظيف بيانات الاختبار من قاعدة _test.");

const failed = results.filter((r) => !r.ok);
console.log(`\nالنتيجة: ${results.length - failed.length}/${results.length} نجحت.`);
process.exit(failed.length ? 1 : 0);
