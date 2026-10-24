/** تحقق: أصل ثابت مرتبط بفرع/موظف + قيد شراء + إهلاك + استبعاد. */
import pg from "pg";
import { config } from "dotenv";
config({ quiet: true });
const BASE = "http://127.0.0.1:3100";
const URL = process.env.DATABASE_URL.replace(/\/[^/]+$/, "/erp_system1_test");
const db = new pg.Client({ connectionString: URL });
await db.connect();
const one = async (s, p) => (await db.query(s, p)).rows[0];

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

const branch = await one("SELECT id, name FROM branches ORDER BY id LIMIT 1");
const emp = await one("SELECT id, name FROM employees ORDER BY id LIMIT 1");
const acc = async (code) => await one("SELECT id, code, name_ar FROM accounts WHERE code=$1", [code]);
const assetAcc = await acc("1142"), accumAcc = await acc("1150"), expAcc = await acc("5101"), cashAcc = await acc("1110");
console.log("refs:", { branch: branch?.name, emp: emp?.name, assetAcc: assetAcc?.code, accumAcc: accumAcc?.code, expAcc: expAcc?.code });

const create = await api("POST", "/api/v2/fixed-assets", {
  code: "FA-TEST-" + Date.now(),
  name: "جهاز اختبار أصول",
  category: "أجهزة",
  purchaseDate: "2026-11-05",
  purchaseValue: 12000,
  salvageValue: 0,
  usefulLife: 5,
  branchId: branch?.id ?? null,
  employeeId: emp?.id ?? null,
  glAssetAccountId: assetAcc?.id,
  glAccumulatedId: accumAcc?.id,
  glDepreciationExpenseId: expAcc?.id,
  paymentAccountId: cashAcc?.id,
});
console.log("create:", create.status, JSON.stringify(create.data).slice(0, 260));
const asset = create.data;

const dep = await api("POST", `/api/v2/fixed-assets/${asset?.id}/depreciate`, { date: "2026-11-30", months: 1 });
console.log("depreciate:", dep.status, JSON.stringify(dep.data).slice(0, 200));

const disp = await api("POST", `/api/v2/fixed-assets/${asset?.id}/dispose`, { date: "2026-12-01", proceeds: 9000, paymentAccountId: cashAcc?.id });
console.log("dispose:", disp.status, JSON.stringify(disp.data).slice(0, 200));

const entries = await api("GET", `/api/v2/fixed-assets/${asset?.id}/entries`);
const list = Array.isArray(entries.data) ? entries.data : [];
console.log("entries:", list.map((e) => `${e.source_type}#${e.id} ${e.total_debit}/${e.total_credit}`));

const row = await one("SELECT accumulated_depreciation, net_value, status, acquisition_entry_id, disposal_entry_id FROM fixed_assets WHERE id=$1", [asset?.id]);
console.log("asset row:", row);

const unbalanced = await db.query(
  `SELECT je.id FROM journal_entries je JOIN journal_items ji ON ji.journal_entry_id=je.id
    WHERE je.source_type LIKE 'asset_%' AND je.source_id=$1
    GROUP BY je.id HAVING ABS(SUM(ji.debit)-SUM(ji.credit))>0.01`, [asset?.id]);
console.log("unbalanced asset entries:", unbalanced.rows.length);

console.log("\nSUMMARY", JSON.stringify({
  create_http: create.status,
  branch_linked: !!asset?.branchId,
  employee_linked: !!asset?.employeeId,
  acquisition_entry: asset?.acquisitionEntryId ?? null,
  depreciation_http: dep.status,
  depreciation_entry: dep.data?.journalEntryId ?? null,
  disposal_http: disp.status,
  disposal_entry: disp.data?.journalEntryId ?? null,
  entries_count: list.length,
  status: row?.status,
  accumulated: row?.accumulated_depreciation,
  net_value: row?.net_value,
}, null, 2));

await db.end();
