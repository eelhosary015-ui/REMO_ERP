import fs from "node:fs";
const p = "modules/accounts/services/period-closing.service.ts";
let s = fs.readFileSync(p, "utf8");
const marker = "/** ملخص حالة الإقفال لفترة أو سنة — أرقام حقيقية من القاعدة. */";
if (!s.includes(marker)) { console.error("marker missing"); process.exit(1); }
const block = `/**
 * تقرير العمليات غير المكتملة: مستندات لها أثر مخزني/مالي بلا قيد،
 * أو قيود مرحّلة داخل فترة مغلقة، أو قيود بلا فترة/غير متوازنة.
 *
 * قراءة فقط — لا يُصلح ولا يعكس أي بيانات تاريخية تلقائيًا.
 */
export async function getIncompleteOperations(options: { from?: string; to?: string; limit?: number } = {}): Promise<any> {
  await ensurePeriodClosingSchema();
  const limit = Math.min(Math.max(Number(options.limit) || 200, 1), 1000);
  const from = options.from || "2000-01-01";
  const to = options.to || "2100-12-31";

  const safe = async (sql: string, params: any[] = []) => {
    try {
      return (await pool.query(sql, params)).rows;
    } catch {
      return [];
    }
  };

  const salesWithoutJe = await safe(
    \`SELECT id, invoice_no, customer_name, to_char(date,'YYYY-MM-DD') AS date, status, net_amount, journal_entry_id
        FROM sales_invoices
       WHERE is_posted = true AND journal_entry_id IS NULL
         AND date::date BETWEEN $1::date AND $2::date
       ORDER BY date DESC LIMIT $3\`,
    [from, to, limit],
  );

  const purchasesWithoutJe = await safe(
    \`SELECT id, invoice_number, supplier_id, to_char(date,'YYYY-MM-DD') AS date, status, total_amount, posted_journal_entry_id
        FROM purchases
       WHERE posted_journal_entry_id IS NULL
         AND COALESCE(status,'') NOT IN ('مسودة','draft','ملغي','cancelled','canceled','')
         AND date::date BETWEEN $1::date AND $2::date
       ORDER BY date DESC LIMIT $3\`,
    [from, to, limit],
  );

  const grnWithoutJe = await safe(
    \`SELECT id, receipt_no, supplier_id, to_char(date,'YYYY-MM-DD') AS date, status, net_amount, journal_entry_id
        FROM goods_receipts
       WHERE is_posted = true AND journal_entry_id IS NULL
         AND date::date BETWEEN $1::date AND $2::date
       ORDER BY date DESC LIMIT $3\`,
    [from, to, limit],
  );

  const postedInsideClosed = await safe(
    \`SELECT je.id, to_char(je.date,'YYYY-MM-DD') AS date, je.reference, je.source_type, je.status,
            fp.month, fp.year, to_char(fp.closed_at,'YYYY-MM-DD HH24:MI') AS closed_at
       FROM journal_entries je
       JOIN financial_periods fp ON fp.id = je.period_id
      WHERE je.status = 'posted'
        AND fp.status IN ('closed','frozen')
        AND COALESCE(je.source_type,'') NOT IN ('year_end_closing','closing','opening_balance')
        AND je.date::date BETWEEN $1::date AND $2::date
      ORDER BY je.date DESC LIMIT $3\`,
    [from, to, limit],
  );

  const missingPeriod = await safe(
    \`SELECT COUNT(*)::int AS count
       FROM journal_entries
      WHERE period_id IS NULL AND date::date BETWEEN $1::date AND $2::date\`,
    [from, to],
  );

  const unbalanced = await safe(
    \`SELECT je.id, to_char(je.date,'YYYY-MM-DD') AS date, je.reference,
            COALESCE(SUM(ji.debit),0)::numeric AS debit, COALESCE(SUM(ji.credit),0)::numeric AS credit
       FROM journal_entries je
       LEFT JOIN journal_items ji ON ji.journal_entry_id = je.id
      WHERE je.status = 'posted' AND je.date::date BETWEEN $1::date AND $2::date
      GROUP BY je.id
     HAVING ABS(COALESCE(SUM(ji.debit),0) - COALESCE(SUM(ji.credit),0)) > 0.01
      ORDER BY je.date DESC LIMIT $3\`,
    [from, to, limit],
  );

  const total = salesWithoutJe.length + purchasesWithoutJe.length + grnWithoutJe.length
    + postedInsideClosed.length + unbalanced.length + Number(missingPeriod[0]?.count || 0);

  return {
    generated_at: new Date().toISOString(),
    range: { from, to },
    summary: {
      total_items: total,
      sales_posted_without_journal: salesWithoutJe.length,
      purchases_posted_without_journal: purchasesWithoutJe.length,
      goods_receipts_without_journal: grnWithoutJe.length,
      journal_posted_inside_closed_period: postedInsideClosed.length,
      journal_entries_without_period: Number(missingPeriod[0]?.count || 0),
      unbalanced_journal_entries: unbalanced.length,
    },
    items: {
      sales_posted_without_journal: salesWithoutJe,
      purchases_posted_without_journal: purchasesWithoutJe,
      goods_receipts_without_journal: grnWithoutJe,
      journal_posted_inside_closed_period: postedInsideClosed,
      unbalanced_journal_entries: unbalanced,
    },
    note: "تقرير للعرض فقط: لا يحذف ولا يعكس ولا ينشئ قيودًا. أي معالجة تحتاج خطة معتمدة من المستخدم.",
  };
}

${marker}`;
s = s.replace(marker, block);
fs.writeFileSync(p, s, "utf8");
console.log("inserted");
