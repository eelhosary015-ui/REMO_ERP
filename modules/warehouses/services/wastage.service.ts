/**
 * خدمة الهالك والتالف المخزني
 * ─────────────────────────────────────────────────────────────
 * دورة العمل المعتمدة:
 *   مسودة (draft) → اعتماد (approved) → خصم فعلي من المخزن + قيد محاسبي + تكلفة
 *   ويمكن إلغاء اعتماد (cancelled) لعكس الأثر المخزني والمحاسبي.
 *
 * كل حركة مخزنية تمر عبر المحرك الموحد `moveStock` (inventory.service) حتى تظهر في:
 *   - أرصدة inventory_items (المصدر الرسمي للرصيد)
 *   - سجل inventory_stock_ledger (بمفتاح حركة يمنع التكرار)
 *   - inventory_movements + inventory_transactions (بطاقة الصنف والتقارير)
 */
import { pool } from "../../../server-db.js";
import { moveStock } from "./inventory.service.js";

export const WASTAGE_TYPES = ["storage", "breakage", "expired", "manufacturing"] as const;
export type WastageType = (typeof WASTAGE_TYPES)[number];

const DEFAULT_WASTAGE_REASONS: Array<{ name_ar: string; name_en: string; type: WastageType }> = [
  { name_ar: "تلف أثناء التخزين", name_en: "Storage damage", type: "storage" },
  { name_ar: "كسر وتلف أثناء المناولة", name_en: "Handling breakage", type: "breakage" },
  { name_ar: "انتهاء فترة الصلاحية", name_en: "Expiry", type: "expired" },
  { name_ar: "هالك تشغيل وإعداد", name_en: "Production scrap", type: "manufacturing" },
];

function httpError(message: string, statusCode = 400, code?: string, details?: any) {
  const error: any = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  if (details) error.details = details;
  return error;
}

const num = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const round4 = (value: number) => Math.round(value * 10000) / 10000;

// ─────────────────────────────────────────────────────────────
// 1. المخطط (مُهاجر ذاتياً — idempotent)
// ─────────────────────────────────────────────────────────────
let schemaReady: Promise<void> | null = null;

async function tryAlter(sql: string) {
  try {
    await pool.query(sql);
  } catch (error: any) {
    // الجداول تُنشأ في تهيئة المخازن؛ لا نُفشل الطلب إن كان الجدول لم يُنشأ بعد.
    console.warn(`[Wastage Schema] ${error.message}`);
  }
}

export function ensureWastageSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await tryAlter(`ALTER TABLE inventory_wastage ADD COLUMN IF NOT EXISTS branch_id INTEGER`);
      await tryAlter(`ALTER TABLE inventory_wastage ADD COLUMN IF NOT EXISTS total_qty NUMERIC(15,3) DEFAULT 0`);
      await tryAlter(`ALTER TABLE inventory_wastage ADD COLUMN IF NOT EXISTS journal_entry_id INTEGER`);
      await tryAlter(`ALTER TABLE inventory_wastage ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP`);
      await tryAlter(`ALTER TABLE inventory_wastage ADD COLUMN IF NOT EXISTS cancelled_by INTEGER`);
      await tryAlter(`ALTER TABLE inventory_wastage ADD COLUMN IF NOT EXISTS cancel_reason TEXT`);
      await tryAlter(`ALTER TABLE inventory_wastage_items ADD COLUMN IF NOT EXISTS ingredient_id INTEGER`);
      await tryAlter(`ALTER TABLE inventory_wastage_items ADD COLUMN IF NOT EXISTS available_qty NUMERIC(15,3)`);
      await tryAlter(`ALTER TABLE inventory_wastage_items ADD COLUMN IF NOT EXISTS unit VARCHAR(50)`);
      await tryAlter(`CREATE INDEX IF NOT EXISTS idx_inventory_wastage_status ON inventory_wastage(status)`);
      await tryAlter(`CREATE INDEX IF NOT EXISTS idx_inventory_wastage_items_wastage ON inventory_wastage_items(wastage_id)`);
      await seedWastageReasons();
    })().catch((error: any) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

/** يضمن وجود أسباب هالك حقيقية في الجدول (كانت الواجهة تعرض أسباباً وهمية بمعرّفات غير موجودة). */
export async function seedWastageReasons(): Promise<void> {
  const count = await pool.query(`SELECT COUNT(*)::int AS c FROM wastage_reasons`);
  if (num(count.rows[0]?.c) > 0) return;
  for (const reason of DEFAULT_WASTAGE_REASONS) {
    await pool.query(
      `INSERT INTO wastage_reasons (name_ar, name_en, type, is_active) VALUES ($1,$2,$3,true)`,
      [reason.name_ar, reason.name_en, reason.type]
    );
  }
}

export async function listWastageReasons(type?: string) {
  await ensureWastageSchema();
  let sql = `SELECT id, name_ar, name_en, type, is_active FROM wastage_reasons WHERE is_active IS NOT FALSE`;
  const params: any[] = [];
  if (type && type !== "manufacturing") {
    params.push(type);
    sql += ` AND (type = $1 OR type = 'all')`;
  }
  sql += ` ORDER BY id ASC`;
  const result = await pool.query(sql, params);
  return result.rows;
}

// ─────────────────────────────────────────────────────────────
// 2. الرصيد المتاح في المخزن (مصدر شاشة الهالك)
// ─────────────────────────────────────────────────────────────
export interface AvailableItem {
  product_id: number;
  ingredient_id: number | null;
  name: string;
  unit: string;
  code: string | null;
  barcode: string | null;
  quantity: number;
  reserved: number;
  available_qty: number;
  unit_cost: number;
  tracked: boolean;
}

/**
 * أصناف المخزن المتاحة للهالك مع الرصيد الفعلي.
 * الرصيد يُقرأ من inventory_items (المصدر الرسمي) وليس من الجداول القديمة.
 * المنتجات غير المرتبطة بصنف مخزني تُعاد بـ tracked=false حتى تُعطّل في الواجهة
 * بدل أن تُهلك بخصم صامت من رصيد غير موجود.
 */
export async function listAvailableWastageItems(
  warehouseId: number,
  options: { search?: string; includeZero?: boolean; limit?: number } = {}
): Promise<AvailableItem[]> {
  if (!warehouseId) throw httpError("المخزن مطلوب", 400, "WAREHOUSE_REQUIRED");
  const search = String(options.search || "").trim();
  const includeZero = options.includeZero === true;
  const limit = Math.min(Math.max(num(options.limit, 300), 1), 1000);

  const result = await pool.query(
    `SELECT q.* FROM (
        SELECT
          p.id::int AS product_id,
          COALESCE(p.ingredient_id, ing_by_name.id)::int AS ingredient_id,
          p.name,
          COALESCE(NULLIF(p.unit, ''), ing.unit, 'وحدة') AS unit,
          p.code,
          p.barcode,
          COALESCE(s.quantity, 0)::numeric AS quantity,
          COALESCE(s.reserved, 0)::numeric AS reserved,
          GREATEST(COALESCE(s.quantity, 0) - COALESCE(s.reserved, 0), 0)::numeric AS available_qty,
          COALESCE(s.stock_cost, NULLIF(p.cost, 0), NULLIF(p.cost_price, 0), 0)::numeric AS unit_cost,
          (COALESCE(p.ingredient_id, ing_by_name.id) IS NOT NULL) AS tracked
        FROM products p
        LEFT JOIN ingredients ing ON ing.id = p.ingredient_id
        LEFT JOIN LATERAL (
          SELECT i.id FROM ingredients i
           WHERE p.ingredient_id IS NULL AND i.name = p.name
           ORDER BY i.id LIMIT 1
        ) ing_by_name ON TRUE
        LEFT JOIN LATERAL (
          SELECT
            COALESCE(SUM(ii.quantity), 0) AS quantity,
            COALESCE(SUM(ii.reserved), 0) AS reserved,
            MAX(COALESCE(NULLIF(ii.avg_cost, 0), NULLIF(ii.cost, 0), NULLIF(ii.unit_cost, 0))) AS stock_cost
          FROM inventory_items ii
          WHERE ii.warehouse_id = $1
            AND ii.ingredient_id = COALESCE(p.ingredient_id, ing_by_name.id)
        ) s ON TRUE
        WHERE COALESCE(p.is_active, TRUE) IS NOT FALSE
          AND ($2 = '' OR p.name ILIKE $3 OR COALESCE(p.code, '') ILIKE $3 OR COALESCE(p.barcode, '') ILIKE $3)
      ) q
     WHERE ($4::boolean OR q.available_qty > 0)
     ORDER BY q.available_qty DESC, q.name ASC
     LIMIT $5`,
    [warehouseId, search, `%${search}%`, includeZero, limit]
  );

  return result.rows.map((row: any) => ({
    product_id: num(row.product_id),
    ingredient_id: row.ingredient_id === null ? null : num(row.ingredient_id),
    name: String(row.name || ""),
    unit: String(row.unit || "وحدة"),
    code: row.code ?? null,
    barcode: row.barcode ?? null,
    quantity: num(row.quantity),
    reserved: num(row.reserved),
    available_qty: num(row.available_qty),
    unit_cost: num(row.unit_cost),
    tracked: row.tracked === true,
  }));
}

// ─────────────────────────────────────────────────────────────
// 3. تجهيز الأصناف والتحقق منها (تحقق على السيرفر لا في الواجهة فقط)
// ─────────────────────────────────────────────────────────────
async function resolveIngredientForProduct(client: any, productId: number): Promise<number | null> {
  const result = await client.query(
    `SELECT COALESCE(p.ingredient_id, (
        SELECT i.id FROM ingredients i WHERE i.name = p.name ORDER BY i.id LIMIT 1
     )) AS ingredient_id
       FROM products p WHERE p.id = $1`,
    [productId]
  );
  if (!result.rows.length) return null;
  return result.rows[0].ingredient_id ? num(result.rows[0].ingredient_id) : null;
}

interface DraftItem {
  product_id: number;
  ingredient_id: number;
  name: string;
  unit: string;
  current_qty: number;
  available_qty: number;
  wastage_qty: number;
  unit_cost: number;
  total_cost: number;
}

async function buildDocumentItems(
  client: any,
  warehouseId: number,
  rawItems: any[],
  allowNegative: boolean
): Promise<{ items: DraftItem[]; totalValue: number; totalQty: number }> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw httpError("لا يمكن حفظ إذن هالك بدون أصناف", 400, "EMPTY_ITEMS");
  }

  const seen = new Set<number>();
  const items: DraftItem[] = [];

  for (const raw of rawItems) {
    const productId = num(raw.product_id);
    if (!productId) throw httpError("صنف غير صالح في إذن الهالك", 400, "INVALID_PRODUCT");
    if (seen.has(productId)) {
      throw httpError("لا يمكن تكرار نفس الصنف في إذن الهالك — عدّل الكمية في السطر الموجود", 400, "DUPLICATE_PRODUCT");
    }
    seen.add(productId);

    const product = await client.query(
      `SELECT p.id, p.name, COALESCE(NULLIF(p.unit, ''), 'وحدة') AS unit, p.cost, p.cost_price
         FROM products p WHERE p.id = $1`,
      [productId]
    );
    if (!product.rows.length) throw httpError(`الصنف #${productId} غير موجود`, 404, "PRODUCT_NOT_FOUND");
    const prod = product.rows[0];

    const ingredientId = await resolveIngredientForProduct(client, productId);
    if (!ingredientId) {
      throw httpError(
        `الصنف «${prod.name}» غير مرتبط بصنف مخزني — اربطه من شاشة المنتجات قبل تسجيل الهالك`,
        400,
        "PRODUCT_NOT_TRACKED",
        { product_id: productId }
      );
    }

    const qty = num(raw.wastage_qty ?? raw.quantity);
    if (qty <= 0) throw httpError(`كمية الهالك غير صحيحة للصنف «${prod.name}»`, 400, "INVALID_QTY", { product_id: productId });

    const stock = await client.query(
      `SELECT
          COALESCE(SUM(quantity), 0)::numeric AS quantity,
          COALESCE(SUM(reserved), 0)::numeric AS reserved,
          MAX(COALESCE(NULLIF(avg_cost, 0), NULLIF(cost, 0), NULLIF(unit_cost, 0))) AS stock_cost
         FROM inventory_items
        WHERE warehouse_id = $1 AND ingredient_id = $2`,
      [warehouseId, ingredientId]
    );
    const onHand = num(stock.rows[0]?.quantity);
    const reserved = num(stock.rows[0]?.reserved);
    const available = Math.max(onHand - reserved, 0);

    if (!allowNegative && qty > available) {
      throw httpError(
        `الرصيد غير كافٍ للصنف «${prod.name}». المتاح: ${round4(available)} ${prod.unit} — المطلوب: ${round4(qty)}`,
        409,
        "INSUFFICIENT_STOCK",
        { product_id: productId, name: prod.name, available: round4(available), requested: round4(qty), unit: prod.unit }
      );
    }

    const requestedCost = num(raw.unit_cost);
    const unitCost = requestedCost > 0
      ? requestedCost
      : num(stock.rows[0]?.stock_cost) || num(prod.cost) || num(prod.cost_price);

    items.push({
      product_id: productId,
      ingredient_id: ingredientId,
      name: String(prod.name || ""),
      unit: String(prod.unit || "وحدة"),
      current_qty: round4(onHand),
      available_qty: round4(available),
      wastage_qty: round4(qty),
      unit_cost: round4(unitCost),
      total_cost: round4(qty * unitCost),
    });
  }

  const totalValue = round4(items.reduce((sum, item) => sum + item.total_cost, 0));
  const totalQty = round4(items.reduce((sum, item) => sum + item.wastage_qty, 0));
  return { items, totalValue, totalQty };
}

async function nextWastageNumber(client: any): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `WST-${year}-`;
  const result = await client.query(
    `SELECT COALESCE(MAX(SUBSTRING(wastage_number FROM '([0-9]+)$')::int), 0) AS last_no
       FROM inventory_wastage
      WHERE wastage_number LIKE $1`,
    [`${prefix}%`]
  );
  const next = num(result.rows[0]?.last_no) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

async function refreshWastageTotals(client: any, wastageId: number) {
  const totals = await client.query(
    `SELECT COALESCE(SUM(wastage_qty), 0)::numeric AS qty,
            COALESCE(SUM(total_cost), 0)::numeric AS value
       FROM inventory_wastage_items WHERE wastage_id = $1`,
    [wastageId]
  );
  const totalQty = round4(num(totals.rows[0]?.qty));
  const totalValue = round4(num(totals.rows[0]?.value));
  await client.query(
    `UPDATE inventory_wastage
        SET total_value = $2, total_qty = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1`,
    [wastageId, totalValue, totalQty]
  );
  return { totalValue, totalQty };
}

async function assertWarehouse(client: any, warehouseId: number) {
  const result = await client.query(
    `SELECT id, name, branch_id, COALESCE(allow_negative_stock, FALSE) AS allow_negative_stock
       FROM warehouses WHERE id = $1`,
    [warehouseId]
  );
  if (!result.rows.length) throw httpError("المخزن غير موجود", 404, "WAREHOUSE_NOT_FOUND");
  return result.rows[0];
}

async function insertItems(client: any, wastageId: number, items: DraftItem[]) {
  for (const item of items) {
    await client.query(
      `INSERT INTO inventory_wastage_items
         (wastage_id, product_id, ingredient_id, unit, current_qty, available_qty, wastage_qty, unit_cost, total_cost)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        wastageId,
        item.product_id,
        item.ingredient_id,
        item.unit,
        item.current_qty,
        item.available_qty,
        item.wastage_qty,
        item.unit_cost,
        item.total_cost,
      ]
    );
  }
}

// ─────────────────────────────────────────────────────────────
// 4. إنشاء / تعديل مسودة
// ─────────────────────────────────────────────────────────────
export async function createWastageDocument(payload: any, actor: { id?: number; name?: string } = {}) {
  await ensureWastageSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const warehouseId = num(payload.warehouse_id);
    if (!warehouseId) throw httpError("يجب اختيار المخزن", 400, "WAREHOUSE_REQUIRED");
    const warehouse = await assertWarehouse(client, warehouseId);

    const wastageType = String(payload.wastage_type || "").trim();
    if (!WASTAGE_TYPES.includes(wastageType as WastageType)) {
      throw httpError("نوع الهالك غير صحيح", 400, "INVALID_TYPE");
    }

    const reasonId = num(payload.reason_id) || null;
    if (reasonId) {
      const reason = await client.query(`SELECT id FROM wastage_reasons WHERE id = $1`, [reasonId]);
      if (!reason.rows.length) throw httpError("سبب الهالك غير موجود", 400, "INVALID_REASON");
    } else {
      throw httpError("يجب اختيار سبب الهالك", 400, "REASON_REQUIRED");
    }

    const { items, totalValue, totalQty } = await buildDocumentItems(
      client,
      warehouseId,
      payload.items,
      warehouse.allow_negative_stock === true
    );

    const wastageDate = payload.wastage_date ? String(payload.wastage_date) : null;
    const status = payload.status === "approved" ? "draft" : String(payload.status || "draft");
    if (!["draft", "pending"].includes(status)) {
      throw httpError("حالة غير مدعومة عند الإنشاء", 400, "INVALID_STATUS");
    }

    let created: any = null;
    let lastError: any = null;
    for (let attempt = 0; attempt < 3 && !created; attempt++) {
      try {
        const wastageNumber = await nextWastageNumber(client);
        const inserted = await client.query(
          `INSERT INTO inventory_wastage
             (wastage_number, wastage_date, warehouse_id, wastage_type, reason_id, responsible_person,
              notes, total_value, total_qty, status, created_by, branch_id)
           VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING *`,
          [
            wastageNumber,
            wastageDate,
            warehouseId,
            wastageType,
            reasonId,
            payload.responsible_person || null,
            payload.notes || null,
            totalValue,
            totalQty,
            status,
            num(actor.id) || num(payload.created_by) || null,
            warehouse.branch_id || null,
          ]
        );
        created = inserted.rows[0];
      } catch (error: any) {
        lastError = error;
        if (error?.code !== "23505") throw error; // 23505 = رقم مكرر، أعد المحاولة
      }
    }
    if (!created) throw lastError || httpError("تعذر توليد رقم إذن الهالك", 500, "NUMBERING_FAILED");

    await insertItems(client, created.id, items);
    const totals = await refreshWastageTotals(client, created.id);

    await client.query("COMMIT");
    return { ...created, ...totals, items };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateWastageDraft(wastageId: number, payload: any, actor: { id?: number; name?: string } = {}) {
  await ensureWastageSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const header = await client.query(`SELECT * FROM inventory_wastage WHERE id = $1 FOR UPDATE`, [wastageId]);
    if (!header.rows.length) throw httpError("إذن الهالك غير موجود", 404, "NOT_FOUND");
    const doc = header.rows[0];
    if (doc.status === "approved") throw httpError("لا يمكن تعديل إذن معتمد", 409, "ALREADY_APPROVED");
    if (doc.status === "cancelled") throw httpError("لا يمكن تعديل إذن ملغى", 409, "CANCELLED");

    const warehouseId = num(payload.warehouse_id) || num(doc.warehouse_id);
    const warehouse = await assertWarehouse(client, warehouseId);

    const wastageType = String(payload.wastage_type || doc.wastage_type || "").trim();
    if (!WASTAGE_TYPES.includes(wastageType as WastageType)) {
      throw httpError("نوع الهالك غير صحيح", 400, "INVALID_TYPE");
    }
    const reasonId = num(payload.reason_id) || num(doc.reason_id) || null;
    if (!reasonId) throw httpError("يجب اختيار سبب الهالك", 400, "REASON_REQUIRED");

    const { items, totalValue, totalQty } = await buildDocumentItems(
      client,
      warehouseId,
      payload.items,
      warehouse.allow_negative_stock === true
    );

    await client.query(
      `UPDATE inventory_wastage
          SET warehouse_id = $2, wastage_type = $3, reason_id = $4, responsible_person = $5,
              notes = $6, wastage_date = COALESCE($7::date, wastage_date),
              total_value = $8, total_qty = $9, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [
        wastageId,
        warehouseId,
        wastageType,
        reasonId,
        payload.responsible_person || null,
        payload.notes || null,
        payload.wastage_date ? String(payload.wastage_date) : null,
        totalValue,
        totalQty,
      ]
    );

    await client.query(`DELETE FROM inventory_wastage_items WHERE wastage_id = $1`, [wastageId]);
    await insertItems(client, wastageId, items);
    const totals = await refreshWastageTotals(client, wastageId);

    const updated = await client.query(`SELECT * FROM inventory_wastage WHERE id = $1`, [wastageId]);
    await client.query("COMMIT");
    return { ...updated.rows[0], ...totals, items };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────
// 5. الاعتماد — الخصم الفعلي من المخزن
// ─────────────────────────────────────────────────────────────
export interface ApproveResult {
  wastage: any;
  items: any[];
  totalValue: number;
  totalQty: number;
  alreadyApproved: boolean;
  movements: Array<{ product_id: number; name: string; quantity: number; before: number; after: number; unit_cost: number }>;
}

/**
 * يعتمد الإذن داخل المعاملة المفتوحة من المستدعي (بدون COMMIT) حتى يمكن اختباره بالعكس.
 * كل صنف يُخصم عبر moveStock بمفتاح حركة فريد => لا خصم مزدوج عند إعادة المحاولة.
 */
export async function approveWastageTx(
  client: any,
  wastageId: number,
  actor: { id?: number; name?: string } = {}
): Promise<ApproveResult> {
  const headerRes = await client.query(`SELECT * FROM inventory_wastage WHERE id = $1 FOR UPDATE`, [wastageId]);
  if (!headerRes.rows.length) throw httpError("إذن الهالك غير موجود", 404, "NOT_FOUND");
  const doc = headerRes.rows[0];

  const currentItems = await client.query(
    `SELECT * FROM inventory_wastage_items WHERE wastage_id = $1 ORDER BY id ASC`,
    [wastageId]
  );

  if (doc.status === "approved") {
    const totals = await client.query(
      `SELECT COALESCE(SUM(wastage_qty),0)::numeric AS qty, COALESCE(SUM(total_cost),0)::numeric AS value
         FROM inventory_wastage_items WHERE wastage_id = $1`,
      [wastageId]
    );
    return {
      wastage: doc,
      items: currentItems.rows,
      totalValue: round4(num(totals.rows[0]?.value)),
      totalQty: round4(num(totals.rows[0]?.qty)),
      alreadyApproved: true,
      movements: [],
    };
  }
  if (doc.status === "cancelled") throw httpError("لا يمكن اعتماد إذن ملغى", 409, "CANCELLED");
  if (!currentItems.rows.length) throw httpError("لا يمكن اعتماد إذن بدون أصناف", 400, "EMPTY_ITEMS");

  const warehouse = await assertWarehouse(client, num(doc.warehouse_id));
  const allowNegative = warehouse.allow_negative_stock === true;
  const movements: ApproveResult["movements"] = [];

  for (const item of currentItems.rows) {
    const qty = round4(num(item.wastage_qty));
    if (qty <= 0) throw httpError(`كمية الهالك غير صحيحة في البند #${item.id}`, 400, "INVALID_QTY");

    const ingredientId = num(item.ingredient_id) || (await resolveIngredientForProduct(client, num(item.product_id)));
    if (!ingredientId) {
      throw httpError(
        `الصنف في البند #${item.id} غير مرتبط بصنف مخزني — لا يمكن خصمه من المخزن`,
        400,
        "PRODUCT_NOT_TRACKED"
      );
    }

    let unitCost = num(item.unit_cost);
    if (unitCost <= 0) {
      const costRes = await client.query(
        `SELECT MAX(COALESCE(NULLIF(avg_cost,0), NULLIF(cost,0), NULLIF(unit_cost,0))) AS c
           FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2`,
        [num(doc.warehouse_id), ingredientId]
      );
      unitCost = num(costRes.rows[0]?.c);
    }

    let movement: any;
    try {
      movement = await moveStock(client, {
        warehouse_id: num(doc.warehouse_id),
        ingredient_id: ingredientId,
        delta: -qty,
        ref_type: "wastage",
        ref_id: wastageId,
        event_key: `wastage:${wastageId}:item:${item.id}`,
        reference_no: doc.wastage_number,
        user: actor.name || (actor.id ? `user#${actor.id}` : "system"),
        unit_cost: unitCost > 0 ? unitCost : undefined,
        notes: `هالك ${doc.wastage_number || ""} — ${doc.notes || "اعتماد إذن هالك"}`.slice(0, 250),
      });
    } catch (error: any) {
      if (error?.code === "INSUFFICIENT_STOCK") {
        const productName = await client
          .query(`SELECT name FROM products WHERE id = $1`, [num(item.product_id)])
          .then((r: any) => r.rows[0]?.name)
          .catch(() => null);
        throw httpError(
          `الرصيد غير كافٍ للصنف «${productName || `#${item.product_id}`}». المتاح: ${round4(error.available)} — المطلوب: ${round4(qty)}`,
          409,
          "INSUFFICIENT_STOCK",
          { ...(error.details || {}), product_id: num(item.product_id), name: productName, available: round4(error.available), requested: qty }
        );
      }
      if (error?.message?.includes("الرصيد غير كافٍ") && !allowNegative) {
        throw httpError(
          `الرصيد غير كافٍ للصنف #${item.product_id} — المتاح: ${round4(error.available)} — المطلوب: ${round4(qty)}`,
          409,
          "INSUFFICIENT_STOCK",
          { product_id: num(item.product_id), available: round4(error.available), requested: qty }
        );
      }
      throw error;
    }

    const finalUnitCost = round4(num(movement.unit_cost) || unitCost);
    const finalTotal = round4(qty * finalUnitCost);
    await client.query(
      `UPDATE inventory_wastage_items
          SET ingredient_id = $2, current_qty = $3, available_qty = $4, unit_cost = $5, total_cost = $6
        WHERE id = $1`,
      [item.id, ingredientId, round4(num(movement.before)), round4(num(movement.before)), finalUnitCost, finalTotal]
    );

    movements.push({
      product_id: num(item.product_id),
      name: "",
      quantity: qty,
      before: round4(num(movement.before)),
      after: round4(num(movement.after)),
      unit_cost: finalUnitCost,
    });
  }

  const totals = await refreshWastageTotals(client, wastageId);
  const updated = await client.query(
    `UPDATE inventory_wastage
        SET status = 'approved',
            approved_by = COALESCE($2, approved_by),
            approved_at = CURRENT_TIMESTAMP,
            total_value = $3,
            total_qty = $4,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *`,
    [wastageId, num(actor.id) || null, totals.totalValue, totals.totalQty]
  );

  const items = await client.query(`SELECT * FROM inventory_wastage_items WHERE wastage_id = $1 ORDER BY id ASC`, [wastageId]);
  const names = await client.query(`SELECT id, name FROM products WHERE id = ANY($1::int[])`, [items.rows.map((i: any) => num(i.product_id) || 0)]);
  const nameMap = new Map(names.rows.map((r: any) => [num(r.id), r.name]));
  const enriched = items.rows.map((row: any) => ({ ...row, product_name: nameMap.get(num(row.product_id)) || null }));
  movements.forEach((m) => { m.name = String(nameMap.get(m.product_id) || ""); });

  return {
    wastage: updated.rows[0],
    items: enriched,
    totalValue: totals.totalValue,
    totalQty: totals.totalQty,
    alreadyApproved: false,
    movements,
  };
}

// ─────────────────────────────────────────────────────────────
// 6. الإلغاء — عكس الأثر المخزني
// ─────────────────────────────────────────────────────────────
export async function cancelWastageTx(
  client: any,
  wastageId: number,
  actor: { id?: number; name?: string } = {},
  reason?: string
) {
  const headerRes = await client.query(`SELECT * FROM inventory_wastage WHERE id = $1 FOR UPDATE`, [wastageId]);
  if (!headerRes.rows.length) throw httpError("إذن الهالك غير موجود", 404, "NOT_FOUND");
  const doc = headerRes.rows[0];
  if (doc.status === "cancelled") return { wastage: doc, reversed: false, alreadyCancelled: true };
  if (doc.status !== "approved") {
    // مسودة: تُلغى إدارياً بدون حركة مخزنية
    const updated = await client.query(
      `UPDATE inventory_wastage
          SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, cancelled_by = $2,
              cancel_reason = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 RETURNING *`,
      [wastageId, num(actor.id) || null, reason || "إلغاء مسودة"]
    );
    return { wastage: updated.rows[0], reversed: false, alreadyCancelled: false };
  }

  const items = await client.query(`SELECT * FROM inventory_wastage_items WHERE wastage_id = $1 ORDER BY id ASC`, [wastageId]);
  for (const item of items.rows) {
    const qty = round4(num(item.wastage_qty));
    if (qty <= 0) continue;
    const ingredientId = num(item.ingredient_id) || (await resolveIngredientForProduct(client, num(item.product_id)));
    if (!ingredientId) continue;
    await moveStock(client, {
      warehouse_id: num(doc.warehouse_id),
      ingredient_id: ingredientId,
      delta: qty,
      ref_type: "wastage_cancel",
      ref_id: wastageId,
      event_key: `wastage-cancel:${wastageId}:item:${item.id}`,
      reference_no: doc.wastage_number,
      user: actor.name || (actor.id ? `user#${actor.id}` : "system"),
      unit_cost: num(item.unit_cost) || undefined,
      notes: `إلغاء اعتماد هالك ${doc.wastage_number || ""}`.slice(0, 250),
    });
  }

  const updated = await client.query(
    `UPDATE inventory_wastage
        SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, cancelled_by = $2,
            cancel_reason = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 RETURNING *`,
    [wastageId, num(actor.id) || null, reason || "إلغاء اعتماد"]
  );

  return { wastage: updated.rows[0], reversed: true, alreadyCancelled: false };
}

// ─────────────────────────────────────────────────────────────
// 7. القراءة والتجميع
// ─────────────────────────────────────────────────────────────
export function buildWastageFilters(query: any) {
  const where: string[] = ["1=1"];
  const params: any[] = [];

  if (query.warehouse_id) {
    params.push(num(query.warehouse_id));
    where.push(`w.warehouse_id = $${params.length}`);
  }
  if (query.wastage_type) {
    params.push(String(query.wastage_type));
    where.push(`w.wastage_type = $${params.length}`);
  }
  if (query.status) {
    params.push(String(query.status));
    where.push(`w.status = $${params.length}`);
  }
  if (query.search) {
    params.push(`%${String(query.search).trim()}%`);
    where.push(`(w.wastage_number ILIKE $${params.length} OR w.notes ILIKE $${params.length} OR w.responsible_person ILIKE $${params.length})`);
  }
  if (query.date_from) {
    params.push(String(query.date_from));
    where.push(`w.wastage_date >= $${params.length}::date`);
  }
  if (query.date_to) {
    params.push(String(query.date_to));
    where.push(`w.wastage_date < ($${params.length}::date + INTERVAL '1 day')`);
  }

  return { clause: where.join(" AND "), params };
}

export async function listWastageDocuments(query: any) {
  await ensureWastageSchema();
  const { clause, params } = buildWastageFilters(query);
  const result = await pool.query(
    `SELECT w.*, wh.name AS warehouse_name, u.username AS created_by_name,
            ap.username AS approved_by_name, r.name_ar AS reason_name, r.type AS reason_type,
            (SELECT COUNT(*)::int FROM inventory_wastage_items i WHERE i.wastage_id = w.id) AS items_count,
            COALESCE(w.total_qty, (SELECT COALESCE(SUM(i.wastage_qty),0) FROM inventory_wastage_items i WHERE i.wastage_id = w.id)) AS total_qty
       FROM inventory_wastage w
       LEFT JOIN warehouses wh ON wh.id = w.warehouse_id
       LEFT JOIN users u ON u.id = w.created_by
       LEFT JOIN users ap ON ap.id = w.approved_by
       LEFT JOIN wastage_reasons r ON r.id = w.reason_id
      WHERE ${clause}
      ORDER BY w.created_at DESC, w.id DESC`,
    params
  );
  return result.rows;
}

export async function getWastageDocument(wastageId: number) {
  await ensureWastageSchema();
  const header = await pool.query(
    `SELECT w.*, wh.name AS warehouse_name, u.username AS created_by_name,
            ap.username AS approved_by_name, r.name_ar AS reason_name, r.type AS reason_type
       FROM inventory_wastage w
       LEFT JOIN warehouses wh ON wh.id = w.warehouse_id
       LEFT JOIN users u ON u.id = w.created_by
       LEFT JOIN users ap ON ap.id = w.approved_by
       LEFT JOIN wastage_reasons r ON r.id = w.reason_id
      WHERE w.id = $1`,
    [wastageId]
  );
  if (!header.rows.length) throw httpError("إذن الهالك غير موجود", 404, "NOT_FOUND");

  const items = await pool.query(
    `SELECT i.*,
            COALESCE(p.name, ig.name, 'صنف #' || i.product_id) AS product_name,
            COALESCE(NULLIF(p.unit, ''), ig.unit, i.unit, 'وحدة') AS unit
       FROM inventory_wastage_items i
       LEFT JOIN products p ON p.id = i.product_id
       LEFT JOIN ingredients ig ON ig.id = i.ingredient_id
      WHERE i.wastage_id = $1
      ORDER BY i.id ASC`,
    [wastageId]
  );

  return { ...header.rows[0], items: items.rows };
}

export async function getWastageSummary(query: any = {}) {
  await ensureWastageSchema();
  const { clause, params } = buildWastageFilters(query);

  const totals = await pool.query(
    `SELECT COUNT(*)::int AS total_docs,
            COALESCE(SUM(w.total_value), 0)::numeric AS total_value,
            COALESCE(SUM(w.total_qty), 0)::numeric AS total_qty,
            COUNT(*) FILTER (WHERE w.status = 'draft')::int AS draft_count,
            COUNT(*) FILTER (WHERE w.status = 'approved')::int AS approved_count,
            COUNT(*) FILTER (WHERE w.status = 'cancelled')::int AS cancelled_count,
            COUNT(*) FILTER (WHERE date_trunc('month', w.wastage_date) = date_trunc('month', CURRENT_DATE))::int AS month_docs,
            COALESCE(SUM(w.total_value) FILTER (WHERE date_trunc('month', w.wastage_date) = date_trunc('month', CURRENT_DATE)), 0)::numeric AS month_value
       FROM inventory_wastage w
      WHERE ${clause}`,
    params
  );

  const byType = await pool.query(
    `SELECT w.wastage_type, COUNT(*)::int AS docs, COALESCE(SUM(w.total_value),0)::numeric AS value
       FROM inventory_wastage w
      WHERE ${clause}
      GROUP BY w.wastage_type
      ORDER BY value DESC`,
    params
  );

  const topProducts = await pool.query(
    `SELECT COALESCE(p.name, 'صنف #' || i.product_id) AS name,
            COALESCE(SUM(i.wastage_qty), 0)::numeric AS qty,
            COALESCE(SUM(i.total_cost), 0)::numeric AS value
       FROM inventory_wastage_items i
       JOIN inventory_wastage w ON w.id = i.wastage_id
       LEFT JOIN products p ON p.id = i.product_id
      WHERE ${clause} AND w.status = 'approved'
      GROUP BY COALESCE(p.name, 'صنف #' || i.product_id)
      ORDER BY value DESC, qty DESC
      LIMIT 5`,
    params
  );

  const row = totals.rows[0] || {};
  return {
    total_docs: num(row.total_docs),
    total_value: round4(num(row.total_value)),
    total_qty: round4(num(row.total_qty)),
    draft_count: num(row.draft_count),
    approved_count: num(row.approved_count),
    cancelled_count: num(row.cancelled_count),
    month_docs: num(row.month_docs),
    month_value: round4(num(row.month_value)),
    by_type: byType.rows.map((r: any) => ({ type: r.wastage_type, docs: num(r.docs), value: round4(num(r.value)) })),
    top_products: topProducts.rows.map((r: any) => ({ name: r.name, qty: round4(num(r.qty)), value: round4(num(r.value)) })),
  };
}

// ─────────────────────────────────────────────────────────────
// 8. تنبيهات الحد الأدنى بعد الخصم
// ─────────────────────────────────────────────────────────────
export async function notifyLowStockAfterWastage(warehouseId: number, ingredientIds: number[]) {
  const unique = Array.from(new Set(ingredientIds.filter((id) => Number.isFinite(id) && id > 0)));
  for (const ingredientId of unique) {
    try {
      const row = await pool.query(
        `SELECT ii.quantity, i.name, i.min_stock
           FROM inventory_items ii
           JOIN ingredients i ON i.id = ii.ingredient_id
          WHERE ii.warehouse_id = $1 AND ii.ingredient_id = $2`,
        [warehouseId, ingredientId]
      );
      const item = row.rows[0];
      if (!item) continue;
      const minStock = num(item.min_stock);
      if (minStock <= 0 || num(item.quantity) > minStock) continue;

      const existing = await pool.query(
        `SELECT id FROM inventory_notifications
          WHERE ingredient_id = $1 AND warehouse_id = $2 AND type = 'low_stock' AND read = false`,
        [ingredientId, warehouseId]
      );
      if (existing.rows.length) continue;

      await pool.query(
        `INSERT INTO inventory_notifications (type, ingredient_id, warehouse_id, message, severity, read, created_at)
         VALUES ('low_stock', $1, $2, $3, 'warning', false, NOW())`,
        [ingredientId, warehouseId, `${item.name} وصل للحد الأدنى بعد تسجيل هالك (${round4(num(item.quantity))}/${minStock})`]
      );
    } catch {
      // التنبيهات لا تُفشل عملية الهالك
    }
  }
}
