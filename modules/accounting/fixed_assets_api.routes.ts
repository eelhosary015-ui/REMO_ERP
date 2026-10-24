/**
 * Fixed Assets API — أصول ثابتة مرتبطة بالفرع والموظف ودفتر الأستاذ العام.
 *
 * المبدأ: كل حركة مالية على الأصل تُنشئ قيدًا محاسبيًا داخل نفس المعاملة،
 * ومرتبطة بمرجع فريد يمنع التكرار:
 *   - الشراء:  Dr حساب الأصل      / Cr الخزينة أو المورد
 *   - الإهلاك: Dr مصروف الإهلاك   / Cr مجمع الإهلاك
 *   - الاستبعاد: Dr مجمع الإهلاك + Dr النقدية / Cr الأصل + ربح/خسارة
 */
import { Router } from "express";
import { pool } from "../../server-db.js";
import { AccountRepository } from "../accounts/repositories/account.repository.js";
import { PeriodLockError } from "../accounts/services/period-lock.service.js";

const router = Router();
const repo = new AccountRepository();

/**
 * يضمن وجود جدول الأصول الثابتة وفهارسه على أي قاعدة بيانات، حتى لا تتعطل
 * الشاشة على بيئة لم تُنفَّذ عليها migration بعد. العملية idempotent.
 */
let schemaReady: Promise<void> | null = null;
export function ensureFixedAssetsSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS fixed_assets (
          id SERIAL PRIMARY KEY,
          asset_code VARCHAR(60),
          name TEXT NOT NULL,
          category TEXT,
          serial_number TEXT,
          location TEXT,
          company_id INTEGER,
          branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
          employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
          cost_center_id INTEGER REFERENCES cost_centers(id) ON DELETE SET NULL,
          purchase_date DATE,
          operation_date DATE,
          purchase_cost NUMERIC(18,2) DEFAULT 0,
          salvage_value NUMERIC(18,2) DEFAULT 0,
          useful_life_years NUMERIC(6,2) DEFAULT 0,
          depreciation_rate NUMERIC(6,2) DEFAULT 0,
          depreciation_method TEXT DEFAULT 'straight_line',
          accumulated_depreciation NUMERIC(18,2) DEFAULT 0,
          net_value NUMERIC(18,2) DEFAULT 0,
          status TEXT DEFAULT 'active',
          gl_asset_account_id INTEGER REFERENCES accounts(id),
          gl_accumulated_id INTEGER REFERENCES accounts(id),
          gl_depreciation_expense_id INTEGER REFERENCES accounts(id),
          acquisition_entry_id INTEGER,
          disposal_entry_id INTEGER,
          last_depreciation_date DATE,
          notes TEXT,
          created_by INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query("CREATE INDEX IF NOT EXISTS idx_fa_branch ON fixed_assets (branch_id)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_fa_employee ON fixed_assets (employee_id)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_fa_status ON fixed_assets (status)");
      await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS ux_fa_code ON fixed_assets (asset_code) WHERE asset_code IS NOT NULL");
      await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS ux_je_asset_acquisition ON journal_entries (source_type, source_id) WHERE source_type = 'asset_acquisition'");
      await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS ux_je_asset_disposal ON journal_entries (source_type, source_id) WHERE source_type = 'asset_disposal'");
      await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS ux_je_asset_depreciation ON journal_entries (source_type, reference) WHERE source_type = 'asset_depreciation'");
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

router.use(async (_req, _res, next) => {
  try {
    await ensureFixedAssetsSchema();
    next();
  } catch (error) {
    next(error);
  }
});

const n = (v: any) => {
  const x = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(x) ? x : 0;
};

/** يقبل YYYY-MM-DD أو DD/MM/YYYY ويعيد YYYY-MM-DD أو null. */
function toDate(value: any): string | null {
  if (!value) return null;
  const s = String(value).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

function toDisplay(value: any): string {
  const d = toDate(value);
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

async function accountConfig(): Promise<Record<string, number>> {
  const rows = (await pool.query("SELECT key, account_id FROM account_config WHERE account_id IS NOT NULL")).rows;
  return Object.fromEntries(rows.map((r: any) => [r.key, Number(r.account_id)]));
}

async function resolveAccounts(asset: any) {
  const cfg = await accountConfig();
  return {
    asset: Number(asset.gl_asset_account_id) || cfg.fixed_assets || cfg.inventory_asset || 0,
    accumulated: Number(asset.gl_accumulated_id) || cfg.accumulated_depreciation || 0,
    expense: Number(asset.gl_depreciation_expense_id) || cfg.depreciation_expense || cfg.cost_expense || 0,
    cash: cfg.cash || 0,
    bank: cfg.bank || 0,
    payable: cfg.accounts_payable || 0,
    otherIncome: cfg.other_income || 0,
    otherExpense: cfg.other_expense || cfg.cost_expense || 0,
  };
}

function toApi(row: any) {
  const cost = n(row.purchase_cost);
  const salvage = n(row.salvage_value);
  const accumulated = n(row.accumulated_depreciation);
  return {
    id: Number(row.id),
    code: row.asset_code || "",
    name: row.name || "",
    serialNumber: row.serial_number || "",
    category: row.category || "",
    location: row.location || "",
    custodian: row.employee_name || row.custodian_name || "",
    notes: row.notes || "",
    purchaseDate: toDisplay(row.purchase_date),
    operationDate: toDisplay(row.operation_date),
    purchaseValue: cost,
    salvageValue: salvage,
    depreciableCost: Math.max(0, cost - salvage),
    depreciationMethod: row.depreciation_method === "straight_line" ? "قسط ثابت" : (row.depreciation_method || "قسط ثابت"),
    usefulLife: n(row.useful_life_years),
    depreciationRate: n(row.depreciation_rate),
    accumulatedDepreciation: accumulated,
    netValue: cost - accumulated,
    status: row.status || "active",
    branchId: row.branch_id ? Number(row.branch_id) : null,
    branchName: row.branch_name || "",
    employeeId: row.employee_id ? Number(row.employee_id) : null,
    employeeName: row.employee_name || "",
    costCenterId: row.cost_center_id ? Number(row.cost_center_id) : null,
    glAssetAccountId: row.gl_asset_account_id ? Number(row.gl_asset_account_id) : null,
    glAccumulatedId: row.gl_accumulated_id ? Number(row.gl_accumulated_id) : null,
    glDepreciationExpenseId: row.gl_depreciation_expense_id ? Number(row.gl_depreciation_expense_id) : null,
    acquisitionEntryId: row.acquisition_entry_id ? Number(row.acquisition_entry_id) : null,
    disposalEntryId: row.disposal_entry_id ? Number(row.disposal_entry_id) : null,
    lastDepreciationDate: toDisplay(row.last_depreciation_date),
  };
}

const SELECT_BASE = `
  SELECT fa.*, b.name AS branch_name, e.name AS employee_name
    FROM fixed_assets fa
    LEFT JOIN branches b ON b.id = fa.branch_id
    LEFT JOIN employees e ON e.id = fa.employee_id
`;

async function loadAsset(db: any, id: number) {
  const row = (await db.query(`${SELECT_BASE} WHERE fa.id = $1`, [id])).rows[0];
  return row || null;
}

router.get("/", async (req: any, res: any) => {
  try {
    const { branchId, employeeId, status } = req.query;
    const where: string[] = [];
    const params: any[] = [];
    if (branchId) { params.push(Number(branchId)); where.push(`fa.branch_id = $${params.length}`); }
    if (employeeId) { params.push(Number(employeeId)); where.push(`fa.employee_id = $${params.length}`); }
    if (status && status !== "all") { params.push(String(status)); where.push(`fa.status = $${params.length}`); }
    const rows = (await pool.query(
      `${SELECT_BASE} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY fa.id DESC`,
      params,
    )).rows;
    res.json(rows.map(toApi));
  } catch (error: any) {
    console.error("Fixed assets list error:", error);
    res.status(500).json({ error: "فشل جلب الأصول الثابتة: " + error.message });
  }
});

router.post("/", async (req: any, res: any) => {
  const body = req.body || {};
  if (!String(body.name || "").trim()) return res.status(400).json({ error: "اسم الأصل مطلوب" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const purchaseDate = toDate(body.purchaseDate) || toDate(new Date());
    const cost = n(body.purchaseValue);
    const salvage = n(body.salvageValue);
    const life = n(body.usefulLife);

    const inserted = await client.query(
      `INSERT INTO fixed_assets
        (asset_code, name, category, serial_number, location, company_id, branch_id, employee_id, cost_center_id,
         purchase_date, operation_date, purchase_cost, salvage_value, useful_life_years, depreciation_rate,
         depreciation_method, accumulated_depreciation, net_value, status,
         gl_asset_account_id, gl_accumulated_id, gl_depreciation_expense_id, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,0,$12,$17,$18,$19,$20,$21,$22)
       RETURNING *`,
      [
        String(body.code || "").trim() || null,
        String(body.name).trim(),
        body.category || null,
        body.serialNumber || null,
        body.location || null,
        body.companyId ? Number(body.companyId) : null,
        body.branchId ? Number(body.branchId) : null,
        body.employeeId ? Number(body.employeeId) : null,
        body.costCenterId ? Number(body.costCenterId) : null,
        purchaseDate,
        toDate(body.operationDate),
        cost,
        salvage,
        life,
        n(body.depreciationRate) || (life > 0 ? Math.round((100 / life) * 100) / 100 : 0),
        "straight_line",
        "active",
        body.glAssetAccountId ? Number(body.glAssetAccountId) : null,
        body.glAccumulatedId ? Number(body.glAccumulatedId) : null,
        body.glDepreciationExpenseId ? Number(body.glDepreciationExpenseId) : null,
        body.notes || null,
        req.user?.id || null,
      ],
    );
    const asset = inserted.rows[0];
    let acquisitionEntryId: number | null = null;

    // قيد الشراء (اختياري): Dr الأصل / Cr الخزينة أو المورد
    if (cost > 0 && body.postAcquisition !== false) {
      const accounts = await resolveAccounts(asset);
      const creditAccount = Number(body.paymentAccountId) || accounts.cash || accounts.payable;
      if (accounts.asset && creditAccount && accounts.asset !== creditAccount) {
        const je = await repo.createJournalEntry(
          {
            date: purchaseDate,
            description: `شراء أصل ثابت ${asset.asset_code || ""} — ${asset.name}`.trim(),
            reference: `FA-ACQ-${asset.id}`,
            source_type: "asset_acquisition",
            source_id: Number(asset.id),
            status: "posted",
            created_by: req.user?.id || null,
            branch_id: asset.branch_id || null,
            items: [
              { account_id: accounts.asset, debit: cost, credit: 0, notes: `أصل ثابت — ${asset.name}` },
              { account_id: creditAccount, debit: 0, credit: cost, notes: `سداد/التزام شراء أصل — ${asset.name}` },
            ],
          },
          client,
        );
        acquisitionEntryId = Number(je.id);
        await client.query("UPDATE fixed_assets SET acquisition_entry_id = $1 WHERE id = $2", [acquisitionEntryId, asset.id]);
      }
    }

    await client.query("COMMIT");
    const fresh = await loadAsset(pool, Number(asset.id));
    res.status(201).json({ ...toApi(fresh), acquisitionEntryId });
  } catch (error: any) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    if (error instanceof PeriodLockError) return res.status(error.statusCode).json({ error: error.message, code: error.code });
    console.error("Fixed asset create error:", error);
    res.status(500).json({ error: error.message || "فشل إنشاء الأصل الثابت" });
  } finally {
    client.release();
  }
});

router.put("/:id", async (req: any, res: any) => {
  const id = Number(req.params.id);
  const body = req.body || {};
  try {
    const existing = await loadAsset(pool, id);
    if (!existing) return res.status(404).json({ error: "الأصل غير موجود" });
    const cost = body.purchaseValue !== undefined ? n(body.purchaseValue) : n(existing.purchase_cost);
    const accumulated = n(existing.accumulated_depreciation);
    await pool.query(
      `UPDATE fixed_assets
          SET asset_code = COALESCE($1, asset_code),
              name = COALESCE($2, name),
              category = $3,
              serial_number = $4,
              location = $5,
              branch_id = $6,
              employee_id = $7,
              cost_center_id = $8,
              purchase_date = COALESCE($9::date, purchase_date),
              operation_date = $10::date,
              purchase_cost = $11,
              salvage_value = $12,
              useful_life_years = $13,
              depreciation_rate = $14,
              gl_asset_account_id = $15,
              gl_accumulated_id = $16,
              gl_depreciation_expense_id = $17,
              notes = $18,
              net_value = $11 - $19,
              updated_at = NOW()
        WHERE id = $20`,
      [
        body.code ? String(body.code).trim() : null,
        body.name || null,
        body.category || null,
        body.serialNumber || null,
        body.location || null,
        body.branchId ? Number(body.branchId) : null,
        body.employeeId ? Number(body.employeeId) : null,
        body.costCenterId ? Number(body.costCenterId) : null,
        toDate(body.purchaseDate),
        toDate(body.operationDate),
        cost,
        n(body.salvageValue),
        n(body.usefulLife),
        n(body.depreciationRate),
        body.glAssetAccountId ? Number(body.glAssetAccountId) : null,
        body.glAccumulatedId ? Number(body.glAccumulatedId) : null,
        body.glDepreciationExpenseId ? Number(body.glDepreciationExpenseId) : null,
        body.notes || null,
        accumulated,
        id,
      ],
    );
    const fresh = await loadAsset(pool, id);
    res.json(toApi(fresh));
  } catch (error: any) {
    console.error("Fixed asset update error:", error);
    res.status(500).json({ error: error.message || "فشل تحديث الأصل" });
  }
});

router.delete("/:id", async (req: any, res: any) => {
  const id = Number(req.params.id);
  try {
    const asset = await loadAsset(pool, id);
    if (!asset) return res.status(404).json({ error: "الأصل غير موجود" });
    if (n(asset.accumulated_depreciation) > 0 || asset.acquisition_entry_id) {
      return res.status(409).json({
        error: "لا يمكن حذف أصل له قيود محاسبية. استخدم الاستبعاد (بيع/تخلص) للحفاظ على سجل التدقيق.",
        code: "ASSET_HAS_ENTRIES",
      });
    }
    await pool.query("DELETE FROM fixed_assets WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "فشل حذف الأصل" });
  }
});

/** ترحيل إهلاك دوري (شهر/عدة أشهر) بقسط ثابت. */
router.post("/:id/depreciate", async (req: any, res: any) => {
  const id = Number(req.params.id);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const asset = (await client.query("SELECT * FROM fixed_assets WHERE id = $1 FOR UPDATE", [id])).rows[0];
    if (!asset) throw Object.assign(new Error("الأصل غير موجود"), { statusCode: 404 });
    if (String(asset.status) === "disposed") throw Object.assign(new Error("الأصل مستبعد ولا يمكن إهلاكه"), { statusCode: 409 });

    const cost = n(asset.purchase_cost);
    const salvage = n(asset.salvage_value);
    const life = n(asset.useful_life_years);
    const accumulated = n(asset.accumulated_depreciation);
    const months = Math.max(1, Math.min(120, n(req.body?.months) || 1));
    const date = toDate(req.body?.date) || toDate(new Date()) || new Date().toISOString().slice(0, 10);

    if (life <= 0) throw Object.assign(new Error("العمر الإنتاجي غير محدد — لا يمكن احتساب الإهلاك"), { statusCode: 400 });

    const monthly = (cost - salvage) / (life * 12);
    const remaining = Math.max(0, cost - salvage - accumulated);
    const amount = Math.min(monthly * months, remaining);
    if (amount <= 0.005) throw Object.assign(new Error("الأصل مُهلك بالكامل — لا يوجد مبلغ للإهلاك"), { statusCode: 409 });

    const accounts = await resolveAccounts(asset);
    if (!accounts.expense || !accounts.accumulated) {
      throw Object.assign(new Error("حساب مصروف الإهلاك أو مجمع الإهلاك غير محدد للأصل"), { statusCode: 400 });
    }

    const yyyymm = date.slice(0, 7).replace("-", "");
    const je = await repo.createJournalEntry(
      {
        date,
        description: `إهلاك ${months} شهر — ${asset.asset_code || ""} ${asset.name}`.trim(),
        reference: `DEP-${asset.id}-${yyyymm}`,
        source_type: "asset_depreciation",
        source_id: Number(asset.id),
        status: "posted",
        created_by: req.user?.id || null,
        branch_id: asset.branch_id || null,
        items: [
          { account_id: accounts.expense, debit: amount, credit: 0, notes: `مصروف إهلاك — ${asset.name}`, cost_center_id: asset.cost_center_id || null },
          { account_id: accounts.accumulated, debit: 0, credit: amount, notes: `مجمع إهلاك — ${asset.name}` },
        ],
      },
      client,
    );

    const newAccumulated = Math.round((accumulated + amount) * 100) / 100;
    await client.query(
      `UPDATE fixed_assets
          SET accumulated_depreciation = $1, net_value = $2, last_depreciation_date = $3::date, updated_at = NOW()
        WHERE id = $4`,
      [newAccumulated, Math.max(0, Math.round((cost - newAccumulated) * 100) / 100), date, id],
    );

    await client.query("COMMIT");
    const fresh = await loadAsset(pool, id);
    res.json({ success: true, amount: Math.round(amount * 100) / 100, journalEntryId: Number(je.id), asset: toApi(fresh) });
  } catch (error: any) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    if (error instanceof PeriodLockError) return res.status(error.statusCode).json({ error: error.message, code: error.code });
    console.error("Asset depreciation error:", error);
    res.status(error.statusCode || 500).json({ error: error.message || "فشل ترحيل الإهلاك", code: error.code });
  } finally {
    client.release();
  }
});

/** استبعاد/بيع الأصل مع قيد متوازن. */
router.post("/:id/dispose", async (req: any, res: any) => {
  const id = Number(req.params.id);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const asset = (await client.query("SELECT * FROM fixed_assets WHERE id = $1 FOR UPDATE", [id])).rows[0];
    if (!asset) throw Object.assign(new Error("الأصل غير موجود"), { statusCode: 404 });
    if (String(asset.status) === "disposed") throw Object.assign(new Error("الأصل مستبعد بالفعل"), { statusCode: 409 });

    const cost = n(asset.purchase_cost);
    const accumulated = n(asset.accumulated_depreciation);
    const proceeds = n(req.body?.proceeds);
    const date = toDate(req.body?.date) || toDate(new Date()) || new Date().toISOString().slice(0, 10);
    const accounts = await resolveAccounts(asset);

    if (!accounts.asset) throw Object.assign(new Error("حساب الأصل غير محدد"), { statusCode: 400 });

    const nbv = Math.round((cost - accumulated) * 100) / 100;
    const gainLoss = Math.round((proceeds - nbv) * 100) / 100;
    const creditAccount = Number(req.body?.paymentAccountId) || accounts.cash || accounts.bank || 0;

    const items: any[] = [];
    if (accumulated > 0) items.push({ account_id: accounts.accumulated, debit: accumulated, credit: 0, notes: `إقفال مجمع الإهلاك — ${asset.name}` });
    if (proceeds > 0 && creditAccount) items.push({ account_id: creditAccount, debit: proceeds, credit: 0, notes: `متحصلات بيع أصل — ${asset.name}` });
    items.push({ account_id: accounts.asset, debit: 0, credit: cost, notes: `استبعاد أصل — ${asset.name}` });
    if (gainLoss > 0 && accounts.otherIncome) {
      items.push({ account_id: accounts.otherIncome, debit: 0, credit: gainLoss, notes: `ربح بيع أصل — ${asset.name}` });
    } else if (gainLoss < 0 && accounts.otherExpense) {
      items.push({ account_id: accounts.otherExpense, debit: Math.abs(gainLoss), credit: 0, notes: `خسارة بيع أصل — ${asset.name}` });
    }

    const je = await repo.createJournalEntry(
      {
        date,
        description: `استبعاد أصل ثابت ${asset.asset_code || ""} — ${asset.name}`.trim(),
        reference: `FA-DIS-${asset.id}`,
        source_type: "asset_disposal",
        source_id: Number(asset.id),
        status: "posted",
        created_by: req.user?.id || null,
        branch_id: asset.branch_id || null,
        items,
      },
      client,
    );

    await client.query(
      `UPDATE fixed_assets SET status = 'disposed', net_value = 0, disposal_entry_id = $1, updated_at = NOW() WHERE id = $2`,
      [Number(je.id), id],
    );

    await client.query("COMMIT");
    const fresh = await loadAsset(pool, id);
    res.json({ success: true, gainLoss, journalEntryId: Number(je.id), asset: toApi(fresh) });
  } catch (error: any) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    if (error instanceof PeriodLockError) return res.status(error.statusCode).json({ error: error.message, code: error.code });
    console.error("Asset disposal error:", error);
    res.status(error.statusCode || 500).json({ error: error.message || "فشل استبعاد الأصل", code: error.code });
  } finally {
    client.release();
  }
});

/** قيود الأصل — لعرضها في شاشة الحسابات العامة. */
router.get("/:id/entries", async (req: any, res: any) => {
  try {
    const rows = (await pool.query(
      `SELECT je.id, to_char(je.date,'YYYY-MM-DD') AS date, je.reference, je.description, je.source_type,
              je.total_debit, je.total_credit, je.status
         FROM journal_entries je
        WHERE (je.source_type IN ('asset_acquisition','asset_depreciation','asset_disposal') AND je.source_id = $1)
        ORDER BY je.date, je.id`,
      [Number(req.params.id)],
    )).rows;
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
