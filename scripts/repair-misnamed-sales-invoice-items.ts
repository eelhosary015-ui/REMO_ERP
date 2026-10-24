import { erpPool } from "../server-erp-core.js";

/**
 * Repairs sales-invoice lines that were renamed by the old sales-product resolution bug.
 *
 * Invoices generated from a sales order used to resolve `itemId = ingredientId` against
 * `sales_products.id`. Because both tables use independent sequences, a sold ingredient
 * (e.g. "قماش" #1) could be rewritten as whatever sales product shared that number
 * (e.g. FIN-8371 "منتج الحصري") and point at that product's master inventory item.
 *
 * The originating order line still holds the truth, so this script restores name / code /
 * ingredient linkage from it. It is a dry run unless `--apply` is passed.
 *
 * It deliberately does not touch cost columns or already-posted journal entries; the
 * inventory cost posted for those invoices may still need an accounting adjustment.
 */

interface Candidate {
  invoice_item_id: number;
  invoice_id: number;
  invoice_no: string;
  line_no: string | number;
  current_name: string;
  current_code: string | null;
  current_ingredient_id: number | null;
  order_item_name: string;
  order_item_code: string | null;
  order_ingredient_id: number | null;
  order_product_id: number | null;
  matched_sales_product: string | null;
}

const applyChanges = process.argv.includes("--apply");

async function main(): Promise<void> {
  const result = await erpPool.query(`
    WITH invoice_lines AS (
      SELECT it.id, it.invoice_id, it.name, it.code, it.ingredient_id, it.product_id,
             i.invoice_no, i.order_id,
             ROW_NUMBER() OVER (PARTITION BY it.invoice_id ORDER BY it.id) AS line_no
        FROM sales_invoice_items it
        JOIN sales_invoices i ON i.id = it.invoice_id
       WHERE i.order_id IS NOT NULL
    ),
    invoice_counts AS (
      SELECT invoice_id, COUNT(*) AS item_count
        FROM sales_invoice_items
       GROUP BY invoice_id
    ),
    order_lines AS (
      SELECT oi.order_id, oi.item_name, oi.item_code, oi.ingredient_id, oi.product_id,
             ROW_NUMBER() OVER (PARTITION BY oi.order_id ORDER BY oi.id) AS line_no,
             COUNT(*) OVER (PARTITION BY oi.order_id) AS item_count
        FROM erp_sales_order_items oi
    )
    SELECT il.id AS invoice_item_id,
           il.invoice_id,
           il.invoice_no,
           il.line_no,
           il.name AS current_name,
           il.code AS current_code,
           il.ingredient_id AS current_ingredient_id,
           ol.item_name AS order_item_name,
           ol.item_code AS order_item_code,
           ol.ingredient_id AS order_ingredient_id,
           ol.product_id AS order_product_id,
           sp.name AS matched_sales_product
      FROM invoice_lines il
      JOIN invoice_counts ic ON ic.invoice_id = il.invoice_id
      JOIN order_lines ol
        ON ol.order_id = il.order_id
       AND ol.line_no = il.line_no
       AND ol.item_count = ic.item_count
      LEFT JOIN sales_products sp
        ON (sp.id = il.ingredient_id OR sp.code = il.code)
       AND (LOWER(BTRIM(sp.name)) = LOWER(BTRIM(il.name)) OR sp.code = il.code)
     WHERE LOWER(BTRIM(COALESCE(il.name, ''))) <> LOWER(BTRIM(COALESCE(ol.item_name, '')))
        OR LOWER(BTRIM(COALESCE(il.code, ''))) <> LOWER(BTRIM(COALESCE(ol.item_code, '')))
     ORDER BY il.invoice_id, il.line_no
  `);

  const candidates = result.rows as Candidate[];
  const repairable = candidates.filter((row) => row.matched_sales_product);
  const skipped = candidates.filter((row) => !row.matched_sales_product);

  console.log(
    `${applyChanges ? "وضع التطبيق" : "معاينة فقط"}: بنود فواتير تحتاج مراجعة = ${candidates.length}، قابلة للإصلاح = ${repairable.length}`,
  );

  for (const row of candidates) {
    const marker = row.matched_sales_product ? "إصلاح" : "تخطي";
    console.log(
      `[${marker}] ${row.invoice_no} بند #${row.line_no} (item #${row.invoice_item_id}): ` +
        `"${row.current_name}" (${row.current_code || "—"}) → "${row.order_item_name}" (${row.order_item_code || "—"})` +
        (row.matched_sales_product ? ` — كان مطابقاً لمنتج المبيعات "${row.matched_sales_product}"` : " — لا يطابق أي منتج مبيعات، يحتاج مراجعة يدوية"),
    );
  }

  if (!applyChanges) {
    console.log("لم يتم تعديل أي بيانات. أعد التشغيل مع --apply لتطبيق الإصلاح.");
    return;
  }

  let repaired = 0;
  for (const row of repairable) {
    await erpPool.query(
      `UPDATE sales_invoice_items it
          SET name = $1,
              code = COALESCE(
                NULLIF($2, ''),
                (SELECT NULLIF(code, '') FROM ingredients WHERE id = $3),
                it.code
              ),
              ingredient_id = $3,
              product_id = $4
        WHERE it.id = $5`,
      [row.order_item_name, row.order_item_code || "", row.order_ingredient_id, row.order_product_id, row.invoice_item_id],
    );
    repaired += 1;
  }

  console.log(`تم إصلاح ${repaired} بند، وتخطي ${skipped.length} بند يحتاج مراجعة يدوية.`);
}

main()
  .catch((error) => {
    console.error("تعذر تشغيل إصلاح أسماء بنود فواتير المبيعات:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (typeof erpPool.end === "function") await erpPool.end();
  });
