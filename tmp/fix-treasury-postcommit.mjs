import fs from "node:fs";

const file = "modules/accounting/treasury_api.routes.ts";
let s = fs.readFileSync(file, "utf8");

// 1) إزالة تعطيل الترحيل المؤجل (لم يعد له معنى بعد الترحيل داخل المعاملة)
s = s.replace("      // أُلغي الترحيل المؤجل بعد الـCOMMIT: أصبح داخل المعاملة\n      glSupplierPayment = null;\n", "");

// 2) حذف كتلة الترحيل بعد الـCOMMIT بالكامل
const startMarker = "    // Post the general-ledger entry for the supplier payment now that the money";
const endMarker = "    res.json({";
const a = s.indexOf(startMarker);
const b = s.indexOf(endMarker, a);
if (a === -1 || b === -1) throw new Error("post-commit block not found");
s = s.slice(0, a) + s.slice(b);

// 3) متغير لتخزين رقم القيد الناتج عن السند
const beginAnchor = `  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── Idempotency: prevent duplicate voucher creation for the same request ──`;
if (!s.includes(beginAnchor)) {
  // احتياطي: أول BEGIN داخل معالج السندات
  const handler = s.indexOf('router.post("/api/treasury/transactions"');
  const begin = s.indexOf('await client.query("BEGIN");', handler);
  if (handler === -1 || begin === -1) throw new Error("handler begin not found");
  s = s.slice(0, begin) + `await client.query("BEGIN");\n    let lastVoucherJournalEntryId: number | null = null;` + s.slice(begin + 'await client.query("BEGIN");'.length);
} else {
  s = s.replace(beginAnchor, beginAnchor.replace('await client.query("BEGIN");', 'await client.query("BEGIN");\n    let lastVoucherJournalEntryId: number | null = null;'));
}

// 4) حفظ رقم القيد بعد إنشائه
s = s.replace(
  'await client.query("UPDATE treasury_transactions SET fin_number = $1 WHERE id = $2", [glEntry.reference, postedTx.id]);',
  'await client.query("UPDATE treasury_transactions SET fin_number = $1 WHERE id = $2", [glEntry.reference, postedTx.id]);\n        lastVoucherJournalEntryId = Number(glEntry.id) || null;',
);

// 5) الاستجابة
s = s.replace(
  "gl_posted: customerReceiptResult ? Boolean(customerReceiptResult.journalEntryId) : glPosted,",
  "gl_posted: true,",
);
s = s.replace(
  "journal_entry_id: customerReceiptResult?.journalEntryId || null,",
  "journal_entry_id: customerReceiptResult?.journalEntryId || lastVoucherJournalEntryId,",
);

fs.writeFileSync(file, s, "utf8");
console.log("post-commit block removed");
console.log("glPosted refs:", (s.match(/glPosted/g) || []).length);
console.log("glSupplierPayment refs:", (s.match(/glSupplierPayment/g) || []).length);
console.log("lastVoucherJournalEntryId refs:", (s.match(/lastVoucherJournalEntryId/g) || []).length);
