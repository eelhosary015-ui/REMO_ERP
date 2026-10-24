import pg from "pg";
import { config } from "dotenv";
config({ quiet: true });
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const SQL = `
  SELECT a.id, a.code, COALESCE(a.name_ar,a.name) name, a.type, a.account_nature,
    COALESCE((SELECT SUM(CASE WHEN a.account_nature='CREDIT' THEN ji_open.credit-ji_open.debit ELSE ji_open.debit-ji_open.credit END)
      FROM journal_items ji_open JOIN journal_entries je_open ON ji_open.journal_entry_id=je_open.id
      WHERE ji_open.account_id=a.id AND je_open.date::date < $1 AND je_open.status <> 'canceled'),0) AS opening_balance,
    COALESCE((SELECT SUM(ji_period.debit) FROM journal_items ji_period JOIN journal_entries je_period ON ji_period.journal_entry_id=je_period.id
      WHERE ji_period.account_id=a.id AND je_period.date::date BETWEEN $2 AND $3 AND je_period.status <> 'canceled'),0) AS period_debit,
    COALESCE((SELECT SUM(ji_period.credit) FROM journal_items ji_period JOIN journal_entries je_period ON ji_period.journal_entry_id=je_period.id
      WHERE ji_period.account_id=a.id AND je_period.date::date BETWEEN $4 AND $5 AND je_period.status <> 'canceled'),0) AS period_credit
  FROM accounts a WHERE a.status = true ORDER BY a.code`;

function compute(rows) {
  let td = 0, tc = 0;
  const out = [];
  for (const r of rows) {
    const ob = Number(r.opening_balance), pd = Number(r.period_debit), pc = Number(r.period_credit);
    const isCredit = String(r.account_nature || "").toUpperCase() === "CREDIT" || ["liability","equity","revenue"].includes(r.type);
    const balance = isCredit ? ob + pc - pd : ob + pd - pc;
    if (balance > 0 && !isCredit) td += balance;
    else if (balance > 0 && isCredit) tc += balance;
    else if (balance < 0 && isCredit) td += Math.abs(balance);
    else if (balance < 0 && !isCredit) tc += Math.abs(balance);
    out.push({ id: r.id, code: r.code, name: r.name, type: r.type, nature: r.account_nature, ob, pd, pc, balance, isCredit });
  }
  return { td: Math.round(td * 100) / 100, tc: Math.round(tc * 100) / 100, out };
}

const ranges = [
  ["2026-10-01", "2026-10-31"],
  ["2026-10-31", "2026-10-31"],
];
const results = [];
for (const [s, e] of ranges) {
  const rows = (await c.query(SQL, [s, s, e, s, e])).rows;
  const r = compute(rows);
  results.push({ s, e, ...r });
  console.log(`\n=== ${s} → ${e} === debit=${r.td} credit=${r.tc} diff=${(r.td - r.tc).toFixed(2)}`);
}

const [a, b] = results;
console.log("\n=== accounts whose balance differs between the two ranges ===");
for (const ra of a.out) {
  const rb = b.out.find((x) => x.id === ra.id);
  if (!rb) continue;
  if (Math.abs(ra.balance - rb.balance) > 0.001) {
    console.log(JSON.stringify({
      code: ra.code, name: ra.name, type: ra.type, nature: ra.nature, isCredit: ra.isCredit,
      range1: { ob: ra.ob, pd: ra.pd, pc: ra.pc, balance: ra.balance },
      range2: { ob: rb.ob, pd: rb.pd, pc: rb.pc, balance: rb.balance },
    }));
  }
}

await c.end();
