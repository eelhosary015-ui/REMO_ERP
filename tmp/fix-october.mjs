import pg from "pg";
const APPLY = process.argv.includes("apply");
const c = new pg.Client({ connectionString: "postgres://postgres:Aa017217*@127.0.0.1:5432/erp_system2" });
await c.connect();
const q = async (sql, p = []) => (await c.query(sql, p)).rows;
const log = (m) => console.log((APPLY ? "" : "[معاينة] ") + m);

const PERIOD = (await q(`SELECT id FROM financial_periods WHERE year=2026 AND month=10`))[0].id;
const acct = async (code) => (await q(`SELECT id FROM accounts WHERE code=$1`, [code]))[0]?.id;

await c.query("BEGIN");
try {
  // ── 1) ترحيل قيد استحقاق المرتبات ──
  const je32 = (await q(`SELECT id, status, total_debit FROM journal_entries WHERE id=32`))[0];
  log(`1) JE#32 (${je32.total_debit}) → posted`);
  if (APPLY) await c.query(`UPDATE journal_entries SET status='posted', period_id=COALESCE(period_id,$1) WHERE id=32`, [PERIOD]);

  // ── 2) ترحيل JE#5 ليعادل القيد العكسي JE#6 (صافي صفر) ──
  log(`2) JE#5 (سداد 100) → posted (يعادل JE#6 المرحّل)`);
  if (APPLY) await c.query(`UPDATE journal_entries SET status='posted', period_id=COALESCE(period_id,$1) WHERE id=5`, [PERIOD]);

  // ── 3) إلغاء الفاتورتين التجريبيتين ──
  log(`3) إلغاء INV-TEST (#14, #15) — 2052.00`);
  if (APPLY) await c.query(`UPDATE sales_invoices SET status='ملغاة', is_posted=false WHERE id IN (14,15)`);

  // ── 4) تطبيق تحصيل 1500 على الفاتورة #28 ──
  log(`4) فاتورة #28: paid_amount = 1500.00 (تحصيل REC-2026-0010)`);
  if (APPLY) await c.query(`UPDATE sales_invoices SET paid_amount=1500.00, status='مدفوعة جزئياً' WHERE id=28`);

  // ── 5) مطابقة المورد #3 (دفعة مقدمة 50) ──
  log(`5) المورد #3: balance = -50.00 (دفعة مقدمة)`);
  if (APPLY) await c.query(`UPDATE suppliers SET balance=-50.00 WHERE id=3`);

  // ── 6) ربط 29 قيد بفترة أكتوبر ──
  const cnt = (await q(`SELECT count(*)::int n FROM journal_entries WHERE date::date BETWEEN '2026-10-01' AND '2026-10-31' AND period_id IS NULL`))[0].n;
  log(`6) ربط ${cnt} قيد بفترة أكتوبر (period_id=${PERIOD})`);
  if (APPLY) await c.query(`UPDATE journal_entries SET period_id=$1 WHERE date::date BETWEEN '2026-10-01' AND '2026-10-31' AND period_id IS NULL`, [PERIOD]);

  // ── 7) تواريخ حركات الخزينة الناقصة ──
  const noDate = (await q(`SELECT count(*)::int n FROM treasury_transactions WHERE date IS NULL`))[0].n;
  log(`7) ضبط تاريخ ${noDate} حركة خزينة من created_at`);
  if (APPLY) await c.query(`UPDATE treasury_transactions SET date = created_at::date WHERE date IS NULL`);

  // ── 8) ربط حركات الخزينة المرحّلة مسبقاً بقيودها ──
  const links = [
    [2, 3], [4, 4], [18, 20], [19, 20], [20, 28], [21, 30], [22, 33], [28, 55], [32, 61], [34, 62], [40, 69],
  ];
  for (const [txId, jeId] of links) {
    const je = (await q(`SELECT id, date::date d FROM journal_entries WHERE id=$1`, [jeId]))[0];
    const fin = `FIN-${je.d.toISOString().slice(0, 10).replace(/-/g, "")}-${String(je.id).padStart(6, "0")}`;
    log(`8) TX#${txId} ← JE#${jeId} (${fin})`);
    if (APPLY) {
      await c.query(`UPDATE treasury_transactions SET fin_number=$1 WHERE id=$2`, [fin, txId]);
      await c.query(`UPDATE journal_entries SET fin_number=COALESCE(fin_number,$1) WHERE id=$2`, [fin, jeId]);
    }
  }

  // ── 9) إغلاق الحركة الملغاة #5 ──
  log(`9) TX#5 (ملغاة) → fin_number = CANCELED-5`);
  if (APPLY) await c.query(`UPDATE treasury_transactions SET fin_number='CANCELED-5' WHERE id=5`);

  // ── 10) إنشاء حساب رأس المال + القيود الخمسة الناقصة ──
  const capitalCode = "3100";
  let capitalId = await acct(capitalCode);
  log(`10) حساب ${capitalCode} (رأس المال / إيداعات المالك) ${capitalId ? "موجود" : "سيُنشأ"}`);
  if (!capitalId && APPLY) {
    const r = await c.query(`
      INSERT INTO accounts (code, name, type, parent_id, balance, name_ar, name_en, account_type, account_nature, level, is_leaf, allow_posting, status, is_active, currency)
      VALUES ('3100','رأس المال / إيداعات المالك','equity',NULL,0,'رأس المال / إيداعات المالك','Owner Capital','EQUITY','credit',1,true,true,true,true,'EGP')
      RETURNING id`);
    capitalId = r.rows[0].id;
  }
  if (!capitalId && !APPLY) capitalId = -1;

  const cashId = await acct("1110");
  const arId = await acct("1130");
  const apId = await acct("2110");

  const newEntries = [
    { tx: 1, date: "2026-10-13", dr: cashId, cr: capitalId, amount: 10000.00, desc: "إيداع نقدي من الشركة — سند REC-2026-0001" },
    { tx: 3, date: "2026-10-14", dr: cashId, cr: capitalId, amount: 100000.00, desc: "إيداع نقدي من الشركة — سند REC-2026-0002" },
    { tx: 10, date: "2026-10-14", dr: arId, cr: cashId, amount: 206.25, desc: "صرف للعميل الحصري — سند PAY-2026-0004" },
    { tx: 11, date: "2026-10-14", dr: arId, cr: cashId, amount: 250.00, desc: "صرف للعميل الحصري — سند PAY-2026-0005" },
    { tx: 33, date: "2026-10-19", dr: cashId, cr: apId, amount: 150.00, desc: "استرداد من المورد مورد تيست 3 — سند REC-2026-0009" },
  ];

  for (const e of newEntries) {
    const exists = (await q(`SELECT id FROM journal_entries WHERE source_type='treasury_voucher' AND source_id=$1`, [e.tx]))[0];
    if (exists) { log(`10) TX#${e.tx} له قيد بالفعل (JE#${exists.id}) — تخطي`); continue; }
    log(`10) قيد جديد TX#${e.tx}: DR ${e.amount} / CR ${e.amount} — ${e.desc}`);
    if (APPLY) {
      const ins = await c.query(`
        INSERT INTO journal_entries (date, description, reference, source_type, source_id, status, total_debit, total_credit, period_id, created_at)
        VALUES ($1,$2,$3,'treasury_voucher',$4,'posted',$5,$5,$6,NOW()) RETURNING id`,
        [e.date, e.desc, `TX-${e.tx}`, e.tx, e.amount, PERIOD]);
      const jeId = ins.rows[0].id;
      await c.query(`INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes) VALUES ($1,$2,$3,0,$4)`, [jeId, e.dr, e.amount, e.desc]);
      await c.query(`INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes) VALUES ($1,$2,0,$3,$4)`, [jeId, e.cr, e.amount, e.desc]);
      const fin = `FIN-${e.date.replace(/-/g, "")}-${String(jeId).padStart(6, "0")}`;
      await c.query(`UPDATE treasury_transactions SET fin_number=$1 WHERE id=$2`, [fin, e.tx]);
      await c.query(`UPDATE journal_entries SET fin_number=$1 WHERE id=$2`, [fin, jeId]);
    }
  }

  if (APPLY) { await c.query("COMMIT"); console.log("\n✅ تم التنفيذ"); }
  else { await c.query("ROLLBACK"); console.log("\n(معاينة فقط — لم يُكتب شيء)"); }
} catch (e) {
  await c.query("ROLLBACK");
  console.error("❌ فشل:", e.message);
  process.exit(1);
}
await c.end();
