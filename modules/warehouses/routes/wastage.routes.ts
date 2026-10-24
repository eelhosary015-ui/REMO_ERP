import { Router, Request, Response } from "express";
import { pool } from "../../../server-db.js";
import { ERPEventBus } from "../../../server-erp-core.js";
import { postWastageEntry } from "../../accounts/services/auto-posting.service.js";
import { recordWastageCost } from "../../costs/services/cost.integration.service.js";
import { AccountRepository } from "../../accounts/repositories/account.repository.js";
import { logAction } from "../../system/services/audit.service.js";
import {
  approveWastageTx,
  cancelWastageTx,
  createWastageDocument,
  getWastageDocument,
  getWastageSummary,
  listAvailableWastageItems,
  listWastageDocuments,
  listWastageReasons,
  notifyLowStockAfterWastage,
  updateWastageDraft,
} from "../services/wastage.service.js";

const router = Router();

function respondError(res: Response, error: any, fallbackMessage: string) {
  const status = Number(error?.statusCode) || (error?.code === "INSUFFICIENT_STOCK" ? 409 : 500);
  if (status >= 500) console.error(`[Wastage] ${fallbackMessage}:`, error);
  res.status(status).json({
    error: error?.message || fallbackMessage,
    code: error?.code || null,
    details: error?.details || null,
  });
}

function actorFrom(req: Request) {
  const user: any = (req as any).user || {};
  return {
    id: Number(user.id) || Number(req.body?.user_id) || undefined,
    name: user.username || user.name || req.body?.user || undefined,
  };
}

// ── تجميعات الشاشة (KPIs) ──
router.get("/api/inventory-wastage/summary", async (req: Request, res: Response) => {
  try {
    res.json(await getWastageSummary(req.query));
  } catch (error: any) {
    respondError(res, error, "تعذر تحميل ملخص الهالك");
  }
});

// ── الأصناف المتاحة في المخزن مع الرصيد الفعلي ──
router.get("/api/inventory-wastage/available-items", async (req: Request, res: Response) => {
  try {
    const warehouseId = Number(req.query.warehouse_id);
    if (!warehouseId) return res.status(400).json({ error: "يجب اختيار المخزن أولاً", code: "WAREHOUSE_REQUIRED" });
    const items = await listAvailableWastageItems(warehouseId, {
      search: req.query.search ? String(req.query.search) : "",
      includeZero: String(req.query.include_zero || "") === "1" || String(req.query.include_zero) === "true",
    });
    res.json({ warehouse_id: warehouseId, count: items.length, items });
  } catch (error: any) {
    respondError(res, error, "تعذر تحميل أرصدة الأصناف");
  }
});

// ── أسباب الهالك ──
router.get("/api/wastage-reasons", async (req: Request, res: Response) => {
  try {
    res.json(await listWastageReasons(req.query.type ? String(req.query.type) : undefined));
  } catch (error: any) {
    respondError(res, error, "تعذر تحميل أسباب الهالك");
  }
});

// ── قائمة الأذون ──
router.get("/api/inventory-wastage", async (req: Request, res: Response) => {
  try {
    res.json(await listWastageDocuments(req.query));
  } catch (error: any) {
    respondError(res, error, "تعذر تحميل أذون الهالك");
  }
});

// ── إذن واحد ──
router.get("/api/inventory-wastage/:id", async (req: Request, res: Response) => {
  try {
    res.json(await getWastageDocument(Number(req.params.id)));
  } catch (error: any) {
    respondError(res, error, "تعذر تحميل إذن الهالك");
  }
});

// ── إنشاء (مسودة) ──
router.post("/api/inventory-wastage", async (req: Request, res: Response) => {
  try {
    const actor = actorFrom(req);
    const created = await createWastageDocument({ ...req.body, status: "draft" }, actor);
    const names = (created.items || []).slice(0, 4).map((item: any) => item.name).join(" / ");
    await logAction(
      Number(actor.id) || 0,
      "تسجيل إذن هالك",
      "inventory_wastage",
      Number(created.id),
      `إذن هالك ${created.wastage_number} — ${created.items?.length || 0} صنف (${names}) — إجمالي ${Number(created.total_value).toLocaleString("ar-EG")} ج.م — المخزن #${created.warehouse_id}`,
      {
        module: "الهالك والتالف",
        entityRef: created.wastage_number,
        amount: Number(created.total_value) || null,
        requestBody: req.body,
        meta: { warehouse_id: created.warehouse_id, wastage_type: created.wastage_type, items: created.items?.length || 0 },
      }
    );
    res.status(201).json(created);
  } catch (error: any) {
    respondError(res, error, "تعذر حفظ إذن الهالك");
  }
});

// ── تعديل مسودة ──
router.put("/api/inventory-wastage/:id", async (req: Request, res: Response) => {
  try {
    const actor = actorFrom(req);
    const updated = await updateWastageDraft(Number(req.params.id), req.body, actor);
    await logAction(
      Number(actor.id) || 0,
      "تعديل مسودة هالك",
      "inventory_wastage",
      Number(updated.id),
      `تعديل مسودة ${updated.wastage_number} — ${updated.items?.length || 0} صنف — إجمالي ${Number(updated.total_value).toLocaleString("ar-EG")} ج.م`,
      { module: "الهالك والتالف", entityRef: updated.wastage_number, amount: Number(updated.total_value) || null, requestBody: req.body }
    );
    res.json(updated);
  } catch (error: any) {
    respondError(res, error, "تعذر تعديل إذن الهالك");
  }
});

// ── حذف مسودة ──
router.delete("/api/inventory-wastage/:id", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const id = Number(req.params.id);
    await client.query("BEGIN");
    const header = await client.query(`SELECT status FROM inventory_wastage WHERE id = $1 FOR UPDATE`, [id]);
    if (!header.rows.length) throw Object.assign(new Error("إذن الهالك غير موجود"), { statusCode: 404 });
    if (header.rows[0].status === "approved") {
      throw Object.assign(new Error("لا يمكن حذف إذن معتمد — استخدم الإلغاء لعكس أثره"), { statusCode: 409 });
    }
    await client.query(`DELETE FROM inventory_wastage_items WHERE wastage_id = $1`, [id]);
    await client.query(`DELETE FROM inventory_wastage WHERE id = $1`, [id]);
    await client.query("COMMIT");
    await logAction(
      Number(actorFrom(req).id) || 0,
      "حذف مسودة هالك",
      "inventory_wastage",
      id,
      `حذف مسودة إذن هالك رقم #${id} نهائياً (لم تكن معتمدة ولم تؤثر على الرصيد)`,
      { module: "الهالك والتالف", severity: "high" }
    );
    res.json({ success: true, id });
  } catch (error: any) {
    await client.query("ROLLBACK");
    respondError(res, error, "تعذر حذف إذن الهالك");
  } finally {
    client.release();
  }
});

// ── اعتماد: خصم فعلي من المخزن + قيد محاسبي + تكلفة + أحداث ──
router.post("/api/inventory-wastage/:id/approve", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const actor = actorFrom(req);
  const client = await pool.connect();
  let result: Awaited<ReturnType<typeof approveWastageTx>>;
  try {
    await client.query("BEGIN");
    result = await approveWastageTx(client, id, actor);
    await client.query("COMMIT");
  } catch (error: any) {
    await client.query("ROLLBACK");
    return respondError(res, error, "تعذر اعتماد إذن الهالك");
  } finally {
    client.release();
  }

  const doc = result.wastage;
  let accounting: any = { posted: false, entry_id: null, message: null };
  let costing: any = { posted: false, lines: 0 };

  if (!result.alreadyApproved) {
    try {
      const entry = await postWastageEntry({
        id: doc.id,
        wastage_number: doc.wastage_number,
        total_cost: result.totalValue,
        warehouse_id: doc.warehouse_id,
        branch_id: doc.branch_id || undefined,
        notes: doc.notes,
        items: result.items,
      });
      if (entry) {
        accounting = { posted: true, entry_id: entry.id, reference: entry.reference || null, message: null };
        await pool.query(`UPDATE inventory_wastage SET journal_entry_id = $1 WHERE id = $2`, [entry.id, doc.id]);
      } else {
        accounting = {
          posted: false,
          entry_id: null,
          message: "لم يُنشأ قيد محاسبي — راجع ربط حسابات المخزون (أصل المخزون / تكلفة المبيعات) في إعدادات الحسابات",
        };
      }
    } catch (glError: any) {
      console.error("[Wastage] GL posting error:", glError.message);
      accounting = { posted: false, entry_id: null, message: `تعذر ترحيل القيد المحاسبي: ${glError.message}` };
    }

    try {
      const lines = await recordWastageCost(doc.id);
      costing = { posted: Number(lines) > 0, lines: Number(lines) || 0 };
    } catch (costError: any) {
      console.error("[Wastage] Cost integration error:", costError.message);
      costing = { posted: false, lines: 0, message: costError.message };
    }

    try {
      await notifyLowStockAfterWastage(
        Number(doc.warehouse_id),
        result.items.map((item: any) => Number(item.ingredient_id)).filter(Boolean)
      );
    } catch {
      /* التنبيهات اختيارية */
    }

    try {
      ERPEventBus.getInstance().emitEvent("InventoryWastageApproved", {
        id: doc.id,
        wastage_number: doc.wastage_number,
        total_cost: result.totalValue,
        total_qty: result.totalQty,
        warehouse_id: doc.warehouse_id,
        branch_id: doc.branch_id,
        items: result.items,
        movements: result.movements,
      });
    } catch {
      /* الأحداث لا تُفشل الاعتماد */
    }
  }

  await logAction(
    Number(actor.id) || 0,
    "اعتماد إذن هالك وخصم من المخزن",
    "inventory_wastage",
    id,
    `اعتماد ${doc.wastage_number} — خصم ${result.totalQty.toLocaleString("ar-EG")} وحدة بقيمة ${result.totalValue.toLocaleString("ar-EG")} ج.م من المخزن #${doc.warehouse_id}` +
      (accounting.posted ? ` — قيد محاسبي #${accounting.entry_id}` : ` — بدون قيد محاسبي (${accounting.message || "غير مربوط"})`),
    {
      module: "الهالك والتالف",
      entityRef: doc.wastage_number,
      amount: result.totalValue,
      severity: "high",
      meta: {
        warehouse_id: doc.warehouse_id,
        items: result.items.length,
        total_qty: result.totalQty,
        journal_entry_id: accounting.entry_id || null,
        cost_posted: costing.posted,
        movements: result.movements,
      },
    }
  );

  res.json({
    ...doc,
    items: result.items,
    total_value: result.totalValue,
    total_qty: result.totalQty,
    already_approved: result.alreadyApproved,
    movements: result.movements,
    accounting,
    costing,
  });
});

// ── إلغاء: عكس الخصم + عكس القيد ──
router.post("/api/inventory-wastage/:id/cancel", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const actor = actorFrom(req);
  const reason = req.body?.reason ? String(req.body.reason) : undefined;
  const client = await pool.connect();
  let result: Awaited<ReturnType<typeof cancelWastageTx>>;
  try {
    await client.query("BEGIN");
    result = await cancelWastageTx(client, id, actor, reason);
    await client.query("COMMIT");
  } catch (error: any) {
    await client.query("ROLLBACK");
    return respondError(res, error, "تعذر إلغاء إذن الهالك");
  } finally {
    client.release();
  }

  let accounting: any = { reversed: false, entry_id: null, message: null };
  if (result.reversed) {
    try {
      const entry = await pool.query(
        `SELECT id FROM journal_entries
          WHERE source_type = 'inventory_wastage' AND source_id = $1
            AND LOWER(COALESCE(status, '')) NOT IN ('canceled', 'cancelled')
          ORDER BY id DESC LIMIT 1`,
        [id]
      );
      if (entry.rows.length) {
        const reversal = await new AccountRepository().reverseJournalEntry(Number(entry.rows[0].id), Number(actor.id) || 0);
        accounting = { reversed: true, entry_id: reversal?.id || null, original_entry_id: Number(entry.rows[0].id), message: null };
      } else {
        accounting = { reversed: false, entry_id: null, message: "لا يوجد قيد محاسبي مرتبط بالإذن لعكسه" };
      }
    } catch (glError: any) {
      console.error("[Wastage] GL reversal error:", glError.message);
      accounting = { reversed: false, entry_id: null, message: `تعذر عكس القيد: ${glError.message}` };
    }

    try {
      ERPEventBus.getInstance().emitEvent("InventoryWastageCancelled", {
        id,
        wastage_number: result.wastage?.wastage_number,
        warehouse_id: result.wastage?.warehouse_id,
        reason: reason || null,
      });
    } catch {
      /* ignore */
    }
  }

  await logAction(
    Number(actor.id) || 0,
    result.reversed ? "إلغاء اعتماد هالك وإرجاع للمخزن" : "إلغاء إذن هالك",
    "inventory_wastage",
    id,
    `إلغاء ${result.wastage?.wastage_number || `#${id}`}` +
      (result.reversed ? ` — إرجاع ${Number(result.wastage?.total_qty || 0).toLocaleString("ar-EG")} وحدة للمخزن #${result.wastage?.warehouse_id}` : " — كانت مسودة") +
      (reason ? ` — السبب: ${reason}` : ""),
    {
      module: "الهالك والتالف",
      entityRef: result.wastage?.wastage_number || null,
      amount: Number(result.wastage?.total_value || 0) || null,
      severity: "high",
      meta: { reason: reason || null, stock_reversed: result.reversed, journal_reversed: accounting.reversed, reversal_entry_id: accounting.entry_id || null },
    }
  );

  res.json({ ...result.wastage, cancelled: true, stock_reversed: result.reversed, accounting });
});

export const wastageRouter = router;
