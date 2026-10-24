/**
 * تحقق سلوكي من دورة الهالك (بدون أي أثر دائم على البيانات):
 *  - قراءة الأرصدة المتاحة
 *  - إنشاء إذن ثم اعتماد داخل معاملة تُعكس (ROLLBACK) مع التأكد من الخصم والسجلات
 *  - منع الاعتماد المزدوج
 *  - الإلغاء وإرجاع الرصيد
 *  - رفض كمية أكبر من المتاح
 */
import { pool } from "../server-db.js";
import {
  approveWastageTx,
  cancelWastageTx,
  createWastageDocument,
  ensureWastageSchema,
  getWastageSummary,
  listAvailableWastageItems,
  listWastageReasons,
} from "../modules/warehouses/services/wastage.service.js";

let passed = 0;
let failed = 0;
const check = (condition: boolean, label: string, extra?: any) => {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}`, extra === undefined ? "" : JSON.stringify(extra));
  }
};

const cleanup = async (docId: number) => {
  await pool.query(`DELETE FROM inventory_wastage_items WHERE wastage_id = $1`, [docId]).catch(() => {});
  await pool.query(`DELETE FROM inventory_wastage WHERE id = $1`, [docId]).catch(() => {});
};

(async () => {
  await ensureWastageSchema();
  console.log("\n[1] أسباب الهالك");
  const reasons = await listWastageReasons();
  check(reasons.length >= 4, `الأسباب موجودة فعلياً (${reasons.length})`, reasons.map((r: any) => r.name_ar));

  console.log("\n[2] أرصدة المخزن (المشكلة المُبلَّغ عنها)");
  const avail = await listAvailableWastageItems(1, { includeZero: true });
  console.log("    أرتدة المخزن 1:", avail.map((a) => `${a.name}=${a.available_qty}${a.unit}`).join(" | "));
  check(avail.length > 0, "المسار يعيد أصناف المخزن");
  check(avail.some((a) => a.available_qty > 0), "يوجد صنف برصيد فعلي > 0");
  check(avail.every((a) => a.ingredient_id !== null), "كل الأصناف مرتبطة بصنف مخزني");

  const target = avail.find((a) => a.available_qty >= 2) || avail.find((a) => a.available_qty > 0);
  if (!target) throw new Error("لا يوجد صنف برصيد لاختبار الاعتماد");

  console.log(`\n[3] إنشاء إذن هالك للصنف «${target.name}» بكمية 2`);
  const doc = await createWastageDocument(
    {
      warehouse_id: 1,
      wastage_type: "storage",
      reason_id: reasons[0].id,
      responsible_person: "اختبار آلي",
      notes: "verify script",
      items: [{ product_id: target.product_id, wastage_qty: 2 }],
    },
    { id: 1, name: "verify" }
  );
  check(!!doc.id, `تم إنشاء الإذن ${doc.wastage_number}`);
  check(Number(doc.total_value) === Math.round(2 * target.unit_cost * 10000) / 10000, "قيمة الإذن = الكمية × تكلفة المخزن", {
    total: doc.total_value,
    unit_cost: target.unit_cost,
  });
  check(doc.status === "draft", "الحالة مسودة بعد الإنشاء");

  const client: any = await pool.connect();
  let beforeQty = 0;
  try {
    const before = await client.query(
      `SELECT quantity FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2`,
      [1, target.ingredient_id]
    );
    beforeQty = Number(before.rows[0]?.quantity || 0);

    await client.query("BEGIN");

    console.log("\n[4] الاعتماد داخل معاملة اختبارية");
    const approved = await approveWastageTx(client, doc.id, { id: 1, name: "verify" });
    check(approved.wastage.status === "approved", "حالة الإذن أصبحت معتمد");
    check(approved.movements.length === 1, "تم تسجيل حركة خصم واحدة");

    const after = await client.query(
      `SELECT quantity FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2`,
      [1, target.ingredient_id]
    );
    const afterQty = Number(after.rows[0]?.quantity || 0);
    check(Math.abs(afterQty - (beforeQty - 2)) < 0.0001, `الرصيد نقص فعلياً: ${beforeQty} → ${afterQty}`);

    const ledger = await client.query(
      `SELECT delta, after_qty, event_key FROM inventory_stock_ledger WHERE ref_type = 'wastage' AND ref_id = $1`,
      [doc.id]
    );
    check(ledger.rows.length === 1, "سجل الحركة (ledger) يحوي حركة الهالك");
    check(Number(ledger.rows[0]?.delta) === -2, "الحركة سالبة بقيمة الكمية", ledger.rows[0]);

    const txRow = await client.query(
      `SELECT type, quantity, reference_no FROM inventory_transactions WHERE reference_type = 'wastage' AND reference_id = $1`,
      [doc.id]
    );
    check(txRow.rows.length === 1, "حركة الهالك ظهرت في تقارير المخزن (inventory_transactions)");
    check(txRow.rows[0]?.type === "wastage", "نوع الحركة wastage", txRow.rows[0]);

    const second = await approveWastageTx(client, doc.id, { id: 1, name: "verify" });
    check(second.alreadyApproved === true, "إعادة الاعتماد لا تخصم مرة أخرى");
    const afterSecond = await client.query(
      `SELECT quantity FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2`,
      [1, target.ingredient_id]
    );
    check(Number(afterSecond.rows[0]?.quantity) === afterQty, "الرصيد لم يتغير بعد إعادة الاعتماد");

    console.log("\n[5] الإلغاء وإرجاع الرصيد");
    const cancel = await cancelWastageTx(client, doc.id, { id: 1, name: "verify" }, "اختبار");
    check(cancel.reversed === true, "تم عكس الأثر المخزني");
    const restored = await client.query(
      `SELECT quantity FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2`,
      [1, target.ingredient_id]
    );
    check(Math.abs(Number(restored.rows[0]?.quantity) - beforeQty) < 0.0001, `الرصيد عاد إلى ${beforeQty}`);

    await client.query("ROLLBACK");
    console.log("    ↳ ROLLBACK: لم تُحفظ أي حركة على قاعدة البيانات");
  } catch (error: any) {
    await client.query("ROLLBACK").catch(() => {});
    failed++;
    console.log("  ❌ خطأ أثناء الاختبار:", error.message);
  } finally {
    client.release();
  }

  const statusAfterRollback = await pool.query(`SELECT status FROM inventory_wastage WHERE id = $1`, [doc.id]);
  check(statusAfterRollback.rows[0]?.status === "draft", "بعد ROLLBACK بقي الإذن مسودة (لا أثر دائم)");

  console.log("\n[6] رفض كمية أكبر من المتاح");
  try {
    await createWastageDocument(
      {
        warehouse_id: 1,
        wastage_type: "breakage",
        reason_id: reasons[0].id,
        items: [{ product_id: target.product_id, wastage_qty: target.available_qty + 1000 }],
      },
      { id: 1, name: "verify" }
    );
    check(false, "كان يجب رفض الكمية الزائدة");
  } catch (error: any) {
    check(error.code === "INSUFFICIENT_STOCK", "رفض بخطأ INSUFFICIENT_STOCK مع رسالة عربية", error.message);
    check(/الرصيد غير كافٍ/.test(error.message || ""), "الرسالة توضح المتاح والمطلوب", error.message);
  }

  console.log("\n[7] ملخص الشاشة");
  const summary = await getWastageSummary({});
  check(typeof summary.total_docs === "number", `ملخص الأذون: ${summary.total_docs} إذن / ${summary.total_value} ج.م`);

  await cleanup(doc.id);
  const leftover = await pool.query(`SELECT COUNT(*)::int AS c FROM inventory_wastage WHERE notes = 'verify script'`);
  check(Number(leftover.rows[0].c) === 0, "تم تنظيف بيانات الاختبار");

  console.log(`\nالنتيجة: ${passed} ناجح / ${failed} فاشل`);
  process.exitCode = failed === 0 ? 0 : 1;
  await (pool as any).end?.();
})().catch(async (error) => {
  console.error("FATAL:", error);
  process.exitCode = 1;
  await (pool as any).end?.().catch(() => {});
});
