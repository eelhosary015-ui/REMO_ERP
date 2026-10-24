/** تحقق: سند خزينة ينشئ قيدًا داخل نفس المعاملة، مرة واحدة فقط. */
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

const acc = await one("SELECT id, name, current_balance FROM treasury_accounts ORDER BY id LIMIT 1");
const before = await one("SELECT current_balance FROM treasury_accounts WHERE id=$1", [acc.id]);
console.log("account:", acc.id, acc.name, "balance:", before.current_balance);

const key = "TEST-VCH-" + Date.now();
const payload = {
  account_id: acc.id,
  amount: 250,
  transaction_type: "cash_in",
  voucher_type: "receipt",
  payment_method: "cash",
  client_type: "other",
  client_name: "اختبار ترحيل الخزينة",
  notes: "اختبار آلي: سند قبض يجب أن يُنشئ قيدًا",
  idempotency_key: key,
};

const r1 = await api("POST", "/api/treasury/transactions", payload);
console.log("create:", r1.status, JSON.stringify(r1.data).slice(0, 220));

const v = await one(
  "SELECT id, amount, fin_number, balance_before, balance_after FROM treasury_transactions WHERE idempotency_key=$1 ORDER BY id DESC LIMIT 1",
  [key],
);
console.log("voucher:", v);

const je = v?.fin_number
  ? await one("SELECT id, reference, total_debit, total_credit, source_type, source_id FROM journal_entries WHERE reference=$1 ORDER BY id DESC LIMIT 1", [v.fin_number])
  : null;
console.log("journal entry:", je);

const lines = je
  ? (await db.query("SELECT account_id, debit, credit FROM journal_items WHERE journal_entry_id=$1", [je.id])).rows
  : [];
console.log("lines:", lines);

const dr = lines.reduce((s, l) => s + Number(l.debit), 0);
const cr = lines.reduce((s, l) => s + Number(l.credit), 0);

// إعادة إرسال نفس الطلب
const r2 = await api("POST", "/api/treasury/transactions", payload);
const dup = await one("SELECT count(*)::int n FROM treasury_transactions WHERE idempotency_key=$1", [key]);
const dupJe = await one("SELECT count(*)::int n FROM journal_entries WHERE source_type='treasury_voucher' AND source_id=$1", [v?.id || -1]);

console.log("\n--- SUMMARY ---");
console.log(JSON.stringify({
  create_http: r1.status,
  voucher_saved: !!v,
  fin_number: v?.fin_number ?? null,
  journal_entry: je?.id ?? null,
  balanced: Math.abs(dr - cr) < 0.005,
  debit: dr,
  credit: cr,
  duplicate_request_http: r2.status,
  duplicate_vouchers: dup.n,
  duplicate_journal_entries: dupJe.n,
}, null, 2));

await db.end();
