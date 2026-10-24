import { Router, Request, Response } from "express";
import { pool } from "../../server-db.js";
import { ERPEventBus } from "../../server-erp-core.js";
import multer from "multer";
import crypto from "crypto";
import { PurchaseService } from "./services/purchase.service.js";
import { createPostedGoodsReceiptForPurchase } from "./services/purchase-integration.service.js";
import { postPurchaseReturnEntry } from "../accounts/services/auto-posting.service.js";
import { recordPurchaseReturnCost } from "../costs/services/cost.integration.service.js";

const router = Router();

// Supplier documents are stored directly in PostgreSQL (BYTEA).
// Keep uploads bounded to protect the ERP server/database.
const supplierDocumentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set([
      "application/pdf", "image/jpeg", "image/png", "image/webp",
      "image/tiff", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ]);
    cb(null, allowed.has(file.mimetype));
  }
});

const purchaseRequestUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set([
      "application/pdf", "image/jpeg", "image/png", "image/webp",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain"
    ]);
    cb(null, allowed.has(file.mimetype));
  }
});

// ─── Suppliers Enterprise API ───

const supplierSelect = `
  SELECT s.*,
    COALESCE((SELECT SUM(p.total_amount) FROM purchases p WHERE p.supplier_id = s.id), 0) AS total_purchases,
    COALESCE((SELECT SUM(p.paid_amount) FROM purchases p WHERE p.supplier_id = s.id), 0) AS total_paid,
    COALESCE((SELECT SUM(st.amount) FROM supplier_transactions st WHERE st.supplier_id = s.id AND st.type = 'payment'), 0) AS total_payments,
    COALESCE((SELECT SUM(st.amount) FROM supplier_transactions st WHERE st.supplier_id = s.id AND st.type = 'return'), 0) AS total_returns,
    (SELECT COUNT(*) FROM purchases p WHERE p.supplier_id = s.id) AS purchase_count,
    CASE WHEN COALESCE(s.credit_limit,0) > 0 THEN ROUND((GREATEST(COALESCE(s.balance,0),0) / s.credit_limit) * 100, 2) ELSE 0 END AS credit_utilization
  FROM suppliers s
`;

router.get("/api/suppliers", async (req, res) => {
  try {
    const { search, status, group, approval_status } = req.query;
    let query = supplierSelect + " WHERE 1=1";
    const params: any[] = [];
    let idx = 1;
    if (search) { query += ` AND (s.name ILIKE $${idx} OR s.name_en ILIKE $${idx} OR s.supplier_code ILIKE $${idx} OR s.phone ILIKE $${idx} OR s.tax_number ILIKE $${idx} OR s.email ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
    if (status) { query += ` AND s.status = $${idx}`; params.push(status); idx++; }
    if (group) { query += ` AND s.group_name = $${idx}`; params.push(group); idx++; }
    if (approval_status) { query += ` AND s.approval_status = $${idx}`; params.push(approval_status); idx++; }
    query += " ORDER BY s.created_at DESC, s.id DESC";
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/api/suppliers/:id", async (req, res) => {
  try {
    const result = await pool.query(supplierSelect + " WHERE s.id = $1", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Supplier not found" });
    const supplier = result.rows[0];
    const [contacts, banks, documents, evals] = await Promise.all([
      pool.query("SELECT * FROM supplier_contacts WHERE supplier_id = $1 ORDER BY is_primary DESC, id DESC", [req.params.id]),
      pool.query("SELECT id, supplier_id, bank_name, account_name, account_number, iban, swift, branch, currency, is_default, notes, created_at FROM supplier_bank_accounts WHERE supplier_id = $1 ORDER BY is_default DESC, id DESC", [req.params.id]),
      pool.query("SELECT id, supplier_id, document_type, document_number, file_name, issue_date, expiry_date, status, notes, mime_type, file_size, checksum_sha256, uploaded_by, created_at FROM supplier_documents WHERE supplier_id = $1 ORDER BY expiry_date NULLS LAST, id DESC", [req.params.id]),
      pool.query("SELECT * FROM supplier_evaluations WHERE supplier_id = $1 ORDER BY evaluation_date DESC, id DESC LIMIT 20", [req.params.id])
    ]);
    res.json({ ...supplier, contacts: contacts.rows, bank_accounts: banks.rows, documents: documents.rows, evaluations: evals.rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/api/suppliers", async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, name_en, phone, phone_2, email, address, commercial_register, tax_number, group_name, payment_terms, credit_limit, opening_balance, notes, status, currency, contact_person, website, country, city } = req.body;
    if (!String(name || '').trim()) return res.status(400).json({ error: "Supplier name is required" });
    await client.query("BEGIN");
    const duplicate = await client.query(`SELECT id FROM suppliers WHERE lower(trim(name)) = lower(trim($1)) OR ($2 <> '' AND tax_number = $2) LIMIT 1`, [name, tax_number || '']);
    if (duplicate.rows.length) { await client.query("ROLLBACK"); return res.status(409).json({ error: "يوجد مورد مسجل بنفس الاسم أو الرقم الضريبي" }); }
    const opening = Number(opening_balance) || 0;
    const result = await client.query(
      `INSERT INTO suppliers (name, name_en, phone, phone_2, email, address, commercial_register, tax_number, group_name, payment_terms, credit_limit, balance, opening_balance, notes, status, currency, contact_person, website, country, city, approval_status, approved_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,$13,$14,$15,$16,$17,$18,$19,'approved',NOW()) RETURNING *`,
      [name.trim(), name_en || null, phone || null, phone_2 || null, email || null, address || null, commercial_register || null, tax_number || null, group_name || null, payment_terms || 'cash', Number(credit_limit) || 0, opening, notes || null, status || 'active', currency || 'EGP', contact_person || null, website || null, country || null, city || null]
    );
    const supplier = result.rows[0];
    await client.query(`UPDATE suppliers SET supplier_code = 'SUP-' || LPAD(id::text, 6, '0') WHERE id = $1`, [supplier.id]);
    if (opening > 0) {
      await client.query(`INSERT INTO supplier_transactions (supplier_id,type,amount,notes,reference_id,reference_type,currency,status) VALUES ($1,'purchase',$2,'رصيد افتتاحي',$1,'opening_balance',$3,'posted')`, [supplier.id, opening, currency || 'EGP']);
    }
    await client.query("COMMIT");
    res.status(201).json((await pool.query(supplierSelect + " WHERE s.id = $1", [supplier.id])).rows[0]);
  } catch (err: any) { await client.query("ROLLBACK"); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

router.put("/api/suppliers/:id", async (req, res) => {
  try {
    const allowed = ['name','name_en','phone','phone_2','email','address','commercial_register','tax_number','group_name','payment_terms','credit_limit','notes','status','currency','contact_person','website','country','city','assigned_user_id','approval_status'];
    const fields: string[] = [], params: any[] = [];
    for (const field of allowed) {
      if (req.body[field] !== undefined) { params.push(req.body[field]); fields.push(`${field} = $${params.length}`); }
    }
    if (!fields.length) return res.json((await pool.query(supplierSelect + " WHERE s.id = $1", [req.params.id])).rows[0] || null);
    params.push(req.params.id);
    const result = await pool.query(`UPDATE suppliers SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING id`, params);
    if (!result.rows.length) return res.status(404).json({ error: "Supplier not found" });
    res.json((await pool.query(supplierSelect + " WHERE s.id = $1", [req.params.id])).rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/api/suppliers/:id", async (req, res) => {
  try {
    const history = await pool.query(`SELECT
      (SELECT COUNT(*) FROM purchases WHERE supplier_id=$1) +
      (SELECT COUNT(*) FROM supplier_transactions WHERE supplier_id=$1) +
      (SELECT COUNT(*) FROM purchase_orders WHERE supplier_id=$1) AS count`, [req.params.id]);
    if (Number(history.rows[0].count) > 0) {
      await pool.query("UPDATE suppliers SET status='inactive', updated_at=NOW() WHERE id=$1", [req.params.id]);
      return res.json({ success: true, deactivated: true, message: "تم إيقاف المورد للحفاظ على السجل المالي" });
    }
    const result = await pool.query("DELETE FROM suppliers WHERE id=$1 RETURNING id", [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: "Supplier not found" });
    res.json({ success: true, deleted: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/api/suppliers/:id/payments", async (req, res) => {
  const client = await pool.connect();
  try {
    const supplierId = Number(req.params.id);
    const amount = Number(req.body.amount);
    const paymentMethod = req.body.payment_method || 'cash';
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Payment amount must be positive" });
    const supplier = await client.query("SELECT * FROM suppliers WHERE id=$1 FOR UPDATE", [supplierId]);
    if (!supplier.rows.length) return res.status(404).json({ error: "Supplier not found" });
    await client.query("BEGIN");
    const tx = await client.query(`INSERT INTO supplier_transactions (supplier_id,type,amount,notes,payment_method,reference_type,currency,status) VALUES ($1,'payment',$2,$3,$4,'supplier_payment',$5,'posted') RETURNING *`, [supplierId, amount, req.body.notes || null, paymentMethod, supplier.rows[0].currency || 'EGP']);
    await client.query("UPDATE suppliers SET balance = balance - $1, updated_at=NOW() WHERE id=$2", [amount, supplierId]);
    const allocations = Array.isArray(req.body.allocations) ? req.body.allocations : [];
    let allocated = 0;
    for (const a of allocations) {
      const purchaseId = Number(a.purchase_id), part = Number(a.amount);
      if (!purchaseId || !Number.isFinite(part) || part <= 0) continue;
      const purchase = await client.query(`SELECT id,total_amount,paid_amount FROM purchases WHERE id=$1 AND supplier_id=$2 FOR UPDATE`, [purchaseId, supplierId]);
      if (!purchase.rows.length) throw new Error(`فاتورة شراء غير صالحة: ${purchaseId}`);
      const remaining = Math.max(0, Number(purchase.rows[0].total_amount) - Number(purchase.rows[0].paid_amount || 0));
      const applied = Math.min(part, remaining, amount - allocated);
      if (applied <= 0) continue;
      await client.query(`INSERT INTO supplier_payment_allocations (payment_transaction_id,purchase_id,allocated_amount) VALUES ($1,$2,$3)`, [tx.rows[0].id, purchaseId, applied]);
      const newPaid = Number(purchase.rows[0].paid_amount || 0) + applied;
      await client.query(`UPDATE purchases SET paid_amount=$1, payment_status=CASE WHEN $1 >= total_amount THEN 'paid' WHEN $1 > 0 THEN 'partially_paid' ELSE 'unpaid' END WHERE id=$2`, [newPaid, purchaseId]);
      allocated += applied;
    }
    await client.query("COMMIT");
    try { ERPEventBus.getInstance().emitEvent("SupplierPaymentRecorded", { supplierId, supplierName: supplier.rows[0].name, amount, paymentMethod, transactionId: tx.rows[0].id, allocatedAmount: allocated, timestamp: new Date() }); } catch {}
    res.status(201).json({ ...tx.rows[0], allocated_amount: allocated, unallocated_amount: amount - allocated });
  } catch (err: any) { await client.query("ROLLBACK"); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

router.get("/api/suppliers/:id/payments", async (req, res) => {
  try {
    const result = await pool.query(`SELECT st.*, COALESCE(SUM(spa.allocated_amount),0) allocated_amount FROM supplier_transactions st LEFT JOIN supplier_payment_allocations spa ON spa.payment_transaction_id=st.id WHERE st.supplier_id=$1 AND st.type='payment' GROUP BY st.id ORDER BY st.timestamp DESC`, [req.params.id]);
    res.json(result.rows);
  } catch (err:any) { res.status(500).json({error: err.message}); }
});

router.get("/api/suppliers/:id/transactions", async (req, res) => {
  try {
    const { from, to, type, limit = 100, offset = 0 } = req.query;
    let query = "SELECT * FROM supplier_transactions WHERE supplier_id=$1"; const params:any[]=[req.params.id]; let idx=2;
    if (from) { query += ` AND timestamp >= $${idx}`; params.push(from); idx++; }
    if (to) { query += ` AND timestamp <= $${idx}`; params.push(to); idx++; }
    if (type) { query += ` AND type = $${idx}`; params.push(type); idx++; }
    query += ` ORDER BY timestamp DESC, id DESC LIMIT $${idx} OFFSET $${idx+1}`; params.push(Math.min(Number(limit)||100,500), Math.max(Number(offset)||0,0));
    res.json((await pool.query(query,params)).rows);
  } catch (err:any) { res.status(500).json({error:err.message}); }
});

router.get("/api/suppliers/:id/statement", async (req, res) => {
  try {
    const supplierId = Number(req.params.id);
    if (!Number.isInteger(supplierId) || supplierId <= 0) {
      return res.status(400).json({ error: "Invalid supplier ID" });
    }

    const from = String(req.query.from || "").trim() || null;
    const to = String(req.query.to || "").trim() || null;
    if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) return res.status(400).json({ error: "Invalid from date" });
    if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) return res.status(400).json({ error: "Invalid to date" });
    if (from && to && from > to) return res.status(400).json({ error: "from date cannot be after to date" });

    const supplierResult = await pool.query(
      `SELECT id, name, supplier_code, currency, COALESCE(opening_balance,0) AS opening_balance
       FROM suppliers WHERE id=$1`,
      [supplierId]
    );
    if (!supplierResult.rows.length) return res.status(404).json({ error: "Supplier not found" });

    const supplierOpening = Number(supplierResult.rows[0].opening_balance || 0);
    const effectSql = `CASE
      WHEN st.type IN ('purchase','adjustment') THEN COALESCE(st.amount,0)
      WHEN st.type IN ('payment','return') THEN -COALESCE(st.amount,0)
      ELSE 0
    END`;
    // Opening-balance rows are already represented by suppliers.opening_balance,
    // so they must never be counted a second time in the statement.
    const baseWhere = `st.supplier_id=$1 AND COALESCE(st.reference_type,'') <> 'opening_balance'`;
    const params:any[]=[supplierId];
    let idx=2;
    let periodWhere = baseWhere;
    if (from) { periodWhere += ` AND st.timestamp >= $${idx}::date`; params.push(from); idx++; }
    if (to) { periodWhere += ` AND st.timestamp < ($${idx}::date + INTERVAL '1 day')`; params.push(to); idx++; }

    const [rowsResult, beforeResult] = await Promise.all([
      pool.query(`SELECT st.*, ${effectSql} AS effect FROM supplier_transactions st WHERE ${periodWhere} ORDER BY st.timestamp ASC, st.id ASC`, params),
      from
        ? pool.query(`SELECT COALESCE(SUM(${effectSql}),0) AS balance FROM supplier_transactions st WHERE ${baseWhere} AND st.timestamp < $2::date`, [supplierId, from])
        : Promise.resolve({ rows: [{ balance: 0 }] } as any)
    ]);

    const openingAtStart = supplierOpening + Number(beforeResult.rows[0]?.balance || 0);
    const currentBalanceResult = await pool.query(
      `SELECT COALESCE(s.balance,0) AS current_balance,
              COALESCE(s.opening_balance,0) + COALESCE(SUM(CASE
                WHEN COALESCE(st.reference_type,'')='opening_balance' THEN 0
                WHEN st.type IN ('purchase','adjustment') THEN st.amount
                WHEN st.type IN ('payment','return') THEN -st.amount
                ELSE 0 END),0) AS calculated_balance
       FROM suppliers s LEFT JOIN supplier_transactions st ON st.supplier_id=s.id
       WHERE s.id=$1 GROUP BY s.id`, [supplierId]
    );
    const currentBalance = Number(currentBalanceResult.rows[0]?.current_balance || 0);
    const calculatedCurrentBalance = Number(currentBalanceResult.rows[0]?.calculated_balance || 0);
    const reconciliationDifference = Number((currentBalance - calculatedCurrentBalance).toFixed(2));
    let running = openingAtStart;
    const transactions = rowsResult.rows.map((row:any) => {
      running += Number(row.effect || 0);
      return { ...row, effect: Number(row.effect || 0), running_balance: Number(running.toFixed(2)) };
    });

    const totalDebit = transactions.reduce((sum:number, row:any) => sum + (Number(row.effect) > 0 ? Number(row.effect) : 0), 0);
    const totalCredit = transactions.reduce((sum:number, row:any) => sum + (Number(row.effect) < 0 ? Math.abs(Number(row.effect)) : 0), 0);
    const closingBalance = Number((openingAtStart + totalDebit - totalCredit).toFixed(2));

    res.json({
      supplier: supplierResult.rows[0],
      summary: {
        opening_balance: Number(supplierOpening.toFixed(2)),
        opening_balance_at_start: Number(openingAtStart.toFixed(2)),
        total_debit: Number(totalDebit.toFixed(2)),
        total_credit: Number(totalCredit.toFixed(2)),
        period_net: Number((totalDebit - totalCredit).toFixed(2)),
        closing_balance: closingBalance,
        current_balance: currentBalance,
        calculated_current_balance: calculatedCurrentBalance,
        reconciliation_difference: reconciliationDifference,
        reconciled: Math.abs(reconciliationDifference) < 0.01,
        from,
        to
      },
      transactions
    });
  } catch(err:any) {
    console.error("Supplier statement error:", err);
    res.status(500).json({error: err.message || "Failed to generate supplier statement"});
  }
});

router.get("/api/suppliers-reports", async (req,res)=>{
  try {
    const from = String(req.query.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10));
    const to = String(req.query.to || new Date().toISOString().slice(0,10));
    const search = req.query.search ? String(req.query.search).trim() : "";
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const supplier_id = req.query.supplier_id ? Number(req.query.supplier_id) : null;
    const type = req.query.type ? String(req.query.type).trim() : "";

    if (type) {
      // Return paginated data for specific report type
      if (type === "returns") {
        let whereClauses = ["pr.return_date BETWEEN $1::date AND $2::date"];
        const params: any[] = [from, to];
        if (supplier_id && !isNaN(supplier_id)) {
          whereClauses.push(`pr.supplier_id = $${params.length + 1}`);
          params.push(supplier_id);
        }
        if (search) {
          whereClauses.push(`(s.name ILIKE $${params.length + 1} OR pr.return_number ILIKE $${params.length + 1} OR p.invoice_number ILIKE $${params.length + 1})`);
          params.push(`%${search}%`);
        }
        const whereSql = whereClauses.join(" AND ");

        const countRes = await pool.query(`
          SELECT COUNT(*)::int AS total_records 
          FROM purchase_returns pr 
          LEFT JOIN suppliers s ON s.id = pr.supplier_id 
          LEFT JOIN purchases p ON p.id = pr.purchase_id
          WHERE ${whereSql}
        `, params);
        const total_records = countRes.rows[0]?.total_records || 0;

        params.push(limit);
        const limitIdx = params.length;
        params.push(offset);
        const offsetIdx = params.length;

        const returnsQuery = `
          SELECT pr.id, pr.return_number, pr.return_date, pr.total_amount, pr.status, s.name supplier_name, p.invoice_number
          FROM purchase_returns pr 
          LEFT JOIN suppliers s ON s.id = pr.supplier_id 
          LEFT JOIN purchases p ON p.id = pr.purchase_id
          WHERE ${whereSql} 
          ORDER BY pr.return_date DESC, pr.id DESC 
          LIMIT $${limitIdx} OFFSET $${offsetIdx}
        `;
        const result = await pool.query(returnsQuery, params);
        return res.json({ total_records, page, limit, rows: result.rows });
      }

      if (type === "top") {
        let whereClauses = ["1=1"];
        const params: any[] = [];
        if (supplier_id && !isNaN(supplier_id)) {
          whereClauses.push(`s.id = $${params.length + 1}`);
          params.push(supplier_id);
        }
        if (search) {
          whereClauses.push(`(s.name ILIKE $${params.length + 1} OR s.supplier_code ILIKE $${params.length + 1})`);
          params.push(`%${search}%`);
        }
        const whereSql = whereClauses.join(" AND ");

        const countRes = await pool.query(`
          SELECT COUNT(*)::int AS total_records 
          FROM suppliers s
          WHERE ${whereSql}
        `, params);
        const total_records = countRes.rows[0]?.total_records || 0;

        params.push(from);
        const fromIdx = params.length;
        params.push(to);
        const toIdx = params.length;

        params.push(limit);
        const limitIdx = params.length;
        params.push(offset);
        const offsetIdx = params.length;

        const topQuery = `
          SELECT s.id, s.supplier_code, s.name, s.name_en, s.status, s.rating, s.balance,
            COALESCE(SUM(p.total_amount), 0) total_purchases, COUNT(p.id) purchase_count,
            COALESCE(SUM(p.paid_amount), 0) paid_amount,
            COALESCE((SELECT SUM(pr.total_amount) FROM purchase_returns pr WHERE pr.supplier_id = s.id AND pr.return_date BETWEEN $${fromIdx}::date AND $${toIdx}::date), 0) return_amount
          FROM suppliers s 
          LEFT JOIN purchases p ON p.supplier_id = s.id AND p.date::date BETWEEN $${fromIdx}::date AND $${toIdx}::date
          WHERE ${whereSql}
          GROUP BY s.id 
          ORDER BY total_purchases DESC 
          LIMIT $${limitIdx} OFFSET $${offsetIdx}
        `;
        const result = await pool.query(topQuery, params);
        return res.json({ total_records, page, limit, rows: result.rows });
      }

      if (type === "overdue") {
        let whereClauses = ["COALESCE(p.due_date, p.date::date) < CURRENT_DATE", "p.total_amount > COALESCE(p.paid_amount, 0)"];
        const params: any[] = [];
        if (supplier_id && !isNaN(supplier_id)) {
          whereClauses.push(`s.id = $${params.length + 1}`);
          params.push(supplier_id);
        }
        if (search) {
          whereClauses.push(`(s.name ILIKE $${params.length + 1} OR s.supplier_code ILIKE $${params.length + 1})`);
          params.push(`%${search}%`);
        }
        const whereSql = whereClauses.join(" AND ");

        const countRes = await pool.query(`
          SELECT COUNT(DISTINCT s.id)::int AS total_records
          FROM suppliers s
          JOIN purchases p ON p.supplier_id = s.id
          WHERE ${whereSql}
        `, params);
        const total_records = countRes.rows[0]?.total_records || 0;

        params.push(from);
        const fromIdx = params.length;
        params.push(to);
        const toIdx = params.length;

        params.push(limit);
        const limitIdx = params.length;
        params.push(offset);
        const offsetIdx = params.length;

        const overdueQuery = `
          SELECT s.id, s.supplier_code, s.name, s.name_en, s.balance, s.credit_limit,
            COALESCE(SUM(GREATEST(p.total_amount - COALESCE(p.paid_amount, 0), 0)), 0) outstanding,
            COALESCE(SUM(CASE WHEN COALESCE(p.due_date, p.date::date) < CURRENT_DATE AND p.total_amount > COALESCE(p.paid_amount, 0) THEN GREATEST(p.total_amount - COALESCE(p.paid_amount, 0), 0) ELSE 0 END), 0) overdue
          FROM suppliers s 
          LEFT JOIN purchases p ON p.supplier_id = s.id AND p.date::date BETWEEN $${fromIdx}::date AND $${toIdx}::date
          WHERE ${whereSql}
          GROUP BY s.id 
          HAVING COALESCE(SUM(CASE WHEN COALESCE(p.due_date, p.date::date) < CURRENT_DATE AND p.total_amount > COALESCE(p.paid_amount, 0) THEN GREATEST(p.total_amount - COALESCE(p.paid_amount, 0), 0) ELSE 0 END), 0) > 0
          ORDER BY overdue DESC 
          LIMIT $${limitIdx} OFFSET $${offsetIdx}
        `;
        const result = await pool.query(overdueQuery, params);
        return res.json({ total_records, page, limit, rows: result.rows });
      }

      if (type === "performance") {
        let whereClauses = ["se.evaluation_date BETWEEN $1::date AND $2::date"];
        const params: any[] = [from, to];
        if (supplier_id && !isNaN(supplier_id)) {
          whereClauses.push(`s.id = $${params.length + 1}`);
          params.push(supplier_id);
        }
        if (search) {
          whereClauses.push(`(s.name ILIKE $${params.length + 1} OR s.supplier_code ILIKE $${params.length + 1})`);
          params.push(`%${search}%`);
        }
        const whereSql = whereClauses.join(" AND ");

        const countRes = await pool.query(`
          SELECT COUNT(DISTINCT s.id)::int AS total_records
          FROM suppliers s
          JOIN supplier_evaluations se ON se.supplier_id = s.id
          WHERE ${whereSql}
        `, params);
        const total_records = countRes.rows[0]?.total_records || 0;

        params.push(limit);
        const limitIdx = params.length;
        params.push(offset);
        const offsetIdx = params.length;

        const performanceQuery = `
          SELECT s.id, s.supplier_code, s.name, s.name_en, ROUND(AVG(se.overall_score), 2) overall_score,
            ROUND(AVG(se.quality_score), 2) quality_score, ROUND(AVG(se.delivery_score), 2) delivery_score,
            ROUND(AVG(se.price_score), 2) price_score, ROUND(AVG(se.service_score), 2) service_score, COUNT(se.id) evaluations
          FROM suppliers s 
          JOIN supplier_evaluations se ON se.supplier_id = s.id
          WHERE ${whereSql} 
          GROUP BY s.id 
          ORDER BY overall_score DESC 
          LIMIT $${limitIdx} OFFSET $${offsetIdx}
        `;
        const result = await pool.query(performanceQuery, params);
        return res.json({ total_records, page, limit, rows: result.rows });
      }

      if (type === "prices") {
        let whereClauses = ["p.date::date BETWEEN $1::date AND $2::date"];
        const params: any[] = [from, to];
        if (supplier_id && !isNaN(supplier_id)) {
          whereClauses.push(`p.supplier_id = $${params.length + 1}`);
          params.push(supplier_id);
        }
        if (search) {
          whereClauses.push(`(s.name ILIKE $${params.length + 1} OR i.name ILIKE $${params.length + 1})`);
          params.push(`%${search}%`);
        }
        const whereSql = whereClauses.join(" AND ");

        const countRes = await pool.query(`
          SELECT COUNT(DISTINCT (i.id, p.supplier_id))::int AS total_records
          FROM purchase_items pi 
          JOIN purchases p ON p.id = pi.purchase_id 
          JOIN suppliers s ON s.id = p.supplier_id
          LEFT JOIN ingredients i ON i.id = pi.ingredient_id
          WHERE ${whereSql}
        `, params);
        const total_records = countRes.rows[0]?.total_records || 0;

        params.push(limit);
        const limitIdx = params.length;
        params.push(offset);
        const offsetIdx = params.length;

        const pricesQuery = `
          SELECT i.id, i.name ingredient_name, p.supplier_id, s.name supplier_name,
            ROUND(AVG(pi.unit_price), 2) avg_price, MIN(pi.unit_price) min_price, MAX(pi.unit_price) max_price,
            SUM(pi.quantity) quantity, MAX(p.date) last_purchase_date
          FROM purchase_items pi 
          JOIN purchases p ON p.id = pi.purchase_id 
          JOIN suppliers s ON s.id = p.supplier_id
          LEFT JOIN ingredients i ON i.id = pi.ingredient_id
          WHERE ${whereSql} 
          GROUP BY i.id, i.name, p.supplier_id, s.name 
          ORDER BY last_purchase_date DESC 
          LIMIT $${limitIdx} OFFSET $${offsetIdx}
        `;
        const result = await pool.query(pricesQuery, params);
        return res.json({ total_records, page, limit, rows: result.rows });
      }

      if (type === "overview") {
        let whereClauses = ["1=1"];
        const params: any[] = [];
        if (supplier_id && !isNaN(supplier_id)) {
          whereClauses.push(`s.id = $${params.length + 1}`);
          params.push(supplier_id);
        }
        if (search) {
          whereClauses.push(`(s.name ILIKE $${params.length + 1} OR s.supplier_code ILIKE $${params.length + 1})`);
          params.push(`%${search}%`);
        }
        const whereSql = whereClauses.join(" AND ");

        const countRes = await pool.query(`
          SELECT COUNT(*)::int AS total_records 
          FROM suppliers s
          WHERE ${whereSql}
        `, params);
        const total_records = countRes.rows[0]?.total_records || 0;

        params.push(from);
        const fromIdx = params.length;
        params.push(to);
        const toIdx = params.length;

        params.push(limit);
        const limitIdx = params.length;
        params.push(offset);
        const offsetIdx = params.length;

        const overviewQuery = `
          SELECT s.id, s.supplier_code, s.name, s.name_en, s.status, s.rating, s.balance, s.credit_limit,
            COALESCE(SUM(p.total_amount), 0) total_purchases, COUNT(p.id) purchase_count,
            COALESCE(SUM(p.paid_amount), 0) paid_amount,
            COALESCE(SUM(GREATEST(p.total_amount - COALESCE(p.paid_amount, 0), 0)), 0) remaining_amount,
            COALESCE((SELECT SUM(pr.total_amount) FROM purchase_returns pr WHERE pr.supplier_id = s.id AND pr.return_date BETWEEN $${fromIdx}::date AND $${toIdx}::date), 0) return_amount
          FROM suppliers s 
          LEFT JOIN purchases p ON p.supplier_id = s.id AND p.date::date BETWEEN $${fromIdx}::date AND $${toIdx}::date
          WHERE ${whereSql}
          GROUP BY s.id 
          ORDER BY total_purchases DESC, s.name ASC
          LIMIT $${limitIdx} OFFSET $${offsetIdx}
        `;
        const result = await pool.query(overviewQuery, params);
        return res.json({ total_records, page, limit, rows: result.rows });
      }

      if (type === "payments") {
        let whereClauses = ["st.timestamp::date BETWEEN $1::date AND $2::date", "st.type = 'payment'"];
        const params: any[] = [from, to];
        if (supplier_id && !isNaN(supplier_id)) {
          whereClauses.push(`st.supplier_id = $${params.length + 1}`);
          params.push(supplier_id);
        }
        if (search) {
          whereClauses.push(`(s.name ILIKE $${params.length + 1} OR st.notes ILIKE $${params.length + 1})`);
          params.push(`%${search}%`);
        }
        const whereSql = whereClauses.join(" AND ");

        const countRes = await pool.query(`
          SELECT COUNT(*)::int AS total_records, COALESCE(SUM(st.amount), 0)::numeric AS total_amount
          FROM supplier_transactions st
          LEFT JOIN suppliers s ON s.id = st.supplier_id
          WHERE ${whereSql}
        `, params);
        const total_records = countRes.rows[0]?.total_records || 0;
        const total_amount = Number(countRes.rows[0]?.total_amount || 0);

        params.push(limit);
        const limitIdx = params.length;
        params.push(offset);
        const offsetIdx = params.length;

        const paymentsQuery = `
          SELECT st.id, st.supplier_id, s.name as supplier_name, st.amount, st.currency, st.payment_method, st.notes, st.reference_type, st.reference_id, st.timestamp
          FROM supplier_transactions st
          LEFT JOIN suppliers s ON s.id = st.supplier_id
          WHERE ${whereSql}
          ORDER BY st.timestamp DESC, st.id DESC
          LIMIT $${limitIdx} OFFSET $${offsetIdx}
        `;
        const result = await pool.query(paymentsQuery, params);
        return res.json({ total_records, total_amount, page, limit, rows: result.rows });
      }
    }

    const params = [from, to];
    const [monthly, payments, returns, top, overdue, performance, prices] = await Promise.all([
      pool.query(`SELECT TO_CHAR(d::date,'YYYY-MM') AS month,
        COALESCE((SELECT SUM(p.total_amount) FROM purchases p WHERE p.date::date >= d::date AND p.date::date < (d::date + INTERVAL '1 month') AND p.date::date BETWEEN $1::date AND $2::date),0) purchases,
        COALESCE((SELECT SUM(st.amount) FROM supplier_transactions st WHERE st.type='payment' AND st.timestamp::date >= d::date AND st.timestamp::date < (d::date + INTERVAL '1 month') AND st.timestamp::date BETWEEN $1::date AND $2::date),0) payments,
        COALESCE((SELECT SUM(pr.total_amount) FROM purchase_returns pr WHERE pr.return_date >= d::date AND pr.return_date < (d::date + INTERVAL '1 month') AND pr.return_date BETWEEN $1::date AND $2::date),0) returns
        FROM generate_series(date_trunc('month',$1::date),date_trunc('month',$2::date),'1 month') d ORDER BY d` , params),
      pool.query(`SELECT COALESCE(st.payment_method,'cash') payment_method, COUNT(*) count, COALESCE(SUM(st.amount),0) amount
        FROM supplier_transactions st WHERE st.type='payment' AND st.timestamp::date BETWEEN $1::date AND $2::date GROUP BY COALESCE(st.payment_method,'cash') ORDER BY amount DESC`, params),
      pool.query(`SELECT pr.id,pr.return_number,pr.return_date,pr.total_amount,pr.status,s.name supplier_name,p.invoice_number
        FROM purchase_returns pr LEFT JOIN suppliers s ON s.id=pr.supplier_id LEFT JOIN purchases p ON p.id=pr.purchase_id
        WHERE pr.return_date BETWEEN $1::date AND $2::date ORDER BY pr.return_date DESC,pr.id DESC LIMIT 10`, params),
      pool.query(`SELECT s.id,s.supplier_code,s.name,s.name_en,s.status,s.rating,s.balance,
        COALESCE(SUM(p.total_amount),0) total_purchases,COUNT(p.id) purchase_count,
        COALESCE(SUM(p.paid_amount),0) paid_amount,
        COALESCE((SELECT SUM(pr.total_amount) FROM purchase_returns pr WHERE pr.supplier_id=s.id AND pr.return_date BETWEEN $1::date AND $2::date),0) return_amount
        FROM suppliers s LEFT JOIN purchases p ON p.supplier_id=s.id AND p.date::date BETWEEN $1::date AND $2::date
        GROUP BY s.id ORDER BY total_purchases DESC LIMIT 10`, params),
      pool.query(`SELECT s.id,s.supplier_code,s.name,s.name_en,s.balance,s.credit_limit,
        COALESCE(SUM(GREATEST(p.total_amount-COALESCE(p.paid_amount,0),0)),0) outstanding,
        COALESCE(SUM(CASE WHEN COALESCE(p.due_date,p.date::date)<CURRENT_DATE AND p.total_amount>COALESCE(p.paid_amount,0) THEN GREATEST(p.total_amount-COALESCE(p.paid_amount,0),0) ELSE 0 END),0) overdue
        FROM suppliers s LEFT JOIN purchases p ON p.supplier_id=s.id AND p.date::date >= $1::date AND p.date::date <= $2::date
        GROUP BY s.id HAVING COALESCE(SUM(CASE WHEN COALESCE(p.due_date,p.date::date)<CURRENT_DATE AND p.total_amount>COALESCE(p.paid_amount,0) THEN GREATEST(p.total_amount-COALESCE(p.paid_amount,0),0) ELSE 0 END),0)>0
        ORDER BY overdue DESC LIMIT 10`, [from,to]),
      pool.query(`SELECT s.id,s.supplier_code,s.name,s.name_en,ROUND(AVG(se.overall_score),2) overall_score,
        ROUND(AVG(se.quality_score),2) quality_score,ROUND(AVG(se.delivery_score),2) delivery_score,
        ROUND(AVG(se.price_score),2) price_score,ROUND(AVG(se.service_score),2) service_score,COUNT(se.id) evaluations
        FROM suppliers s JOIN supplier_evaluations se ON se.supplier_id=s.id
        WHERE se.evaluation_date BETWEEN $1::date AND $2::date GROUP BY s.id ORDER BY overall_score DESC LIMIT 10`, params),
      pool.query(`SELECT i.id,i.name ingredient_name,p.supplier_id,s.name supplier_name,
        ROUND(AVG(pi.unit_price),2) avg_price,MIN(pi.unit_price) min_price,MAX(pi.unit_price) max_price,
        SUM(pi.quantity) quantity,MAX(p.date) last_purchase_date
        FROM purchase_items pi JOIN purchases p ON p.id=pi.purchase_id JOIN suppliers s ON s.id=p.supplier_id
        LEFT JOIN ingredients i ON i.id=pi.ingredient_id
        WHERE p.date::date BETWEEN $1::date AND $2::date GROUP BY i.id,i.name,p.supplier_id,s.name ORDER BY last_purchase_date DESC LIMIT 10`, params)
    ]);
    res.json({from,to,monthly:monthly.rows,payment_methods:payments.rows,returns:returns.rows,top_suppliers:top.rows,overdue_suppliers:overdue.rows,performance:performance.rows,price_history:prices.rows});
  } catch(err:any) { res.status(500).json({error:err.message}); }
});

router.get("/api/suppliers-detailed-report", async (req, res) => {
  try {
    const from = req.query.from ? String(req.query.from).trim() : "";
    const to = req.query.to ? String(req.query.to).trim() : "";
    const supplier_id = req.query.supplier_id ? Number(req.query.supplier_id) : null;
    const supplier_name = req.query.supplier_name ? String(req.query.supplier_name).trim() : "";
    const invoice_number = req.query.invoice_number ? String(req.query.invoice_number).trim() : "";
    const search = req.query.search ? String(req.query.search).trim() : "";
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const whereClauses: string[] = ["1=1"];
    const params: any[] = [];
    let idx = 1;

    if (from) {
      whereClauses.push(`COALESCE(p.date::date, CURRENT_DATE) >= $${idx}::date`);
      params.push(from);
      idx++;
    }
    if (to) {
      whereClauses.push(`COALESCE(p.date::date, CURRENT_DATE) <= $${idx}::date`);
      params.push(to);
      idx++;
    }
    if (supplier_id && !isNaN(supplier_id)) {
      whereClauses.push(`s.id = $${idx}`);
      params.push(supplier_id);
      idx++;
    }
    if (supplier_name) {
      whereClauses.push(`(s.name ILIKE $${idx} OR s.name_en ILIKE $${idx} OR s.supplier_code ILIKE $${idx})`);
      params.push(`%${supplier_name}%`);
      idx++;
    }
    if (invoice_number) {
      whereClauses.push(`(
        p.invoice_number ILIKE $${idx} OR 
        p.supplier_invoice_number ILIKE $${idx} OR 
        COALESCE(p.internal_invoice_number, '') ILIKE $${idx} OR
        ('PINV-' || LPAD(p.id::text, 6, '0')) ILIKE $${idx}
      )`);
      params.push(`%${invoice_number}%`);
      idx++;
    }
    if (search) {
      whereClauses.push(`(
        s.name ILIKE $${idx} OR 
        s.name_en ILIKE $${idx} OR 
        s.supplier_code ILIKE $${idx} OR
        s.phone ILIKE $${idx} OR
        p.invoice_number ILIKE $${idx} OR 
        p.supplier_invoice_number ILIKE $${idx} OR 
        COALESCE(p.internal_invoice_number, '') ILIKE $${idx} OR
        ('PINV-' || LPAD(p.id::text, 6, '0')) ILIKE $${idx} OR
        COALESCE(i.name, prod.name, pi.item_code, '') ILIKE $${idx} OR
        COALESCE(i.item_code, prod.barcode, pi.item_code, '') ILIKE $${idx}
      )`);
      params.push(`%${search}%`);
      idx++;
    }

    const whereSql = whereClauses.join(" AND ");

    // Compute exact aggregate KPIs for the entire filtered set
    const kpiRes = await pool.query(`
      SELECT 
        COUNT(pi.id)::int AS total_items_count,
        COALESCE(SUM(pi.quantity), 0)::float AS total_items_quantity,
        COALESCE(SUM(pi.total_price), 0)::float AS total_items_price,
        COUNT(DISTINCT pi.purchase_id)::int AS invoices_count,
        COUNT(DISTINCT p.supplier_id)::int AS suppliers_count
      FROM purchase_items pi
      JOIN purchases p ON p.id = pi.purchase_id
      JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN ingredients i ON i.id = pi.ingredient_id
      LEFT JOIN products prod ON prod.id = pi.product_id
      LEFT JOIN warehouses w ON w.id = p.warehouse_id
      WHERE ${whereSql}
    `, params);

    const financialsRes = await pool.query(`
      SELECT 
        COALESCE(SUM(p.total_amount), 0)::float AS total_invoices_amount,
        COALESCE(SUM(p.paid_amount), 0)::float AS total_paid_amount,
        COALESCE(SUM(GREATEST(0, p.total_amount - COALESCE(p.paid_amount, 0))), 0)::float AS total_remaining_amount
      FROM purchases p
      WHERE p.id IN (
        SELECT DISTINCT pi.purchase_id 
        FROM purchase_items pi
        JOIN purchases p2 ON p2.id = pi.purchase_id
        JOIN suppliers s ON s.id = p2.supplier_id
        LEFT JOIN ingredients i ON i.id = pi.ingredient_id
        LEFT JOIN products prod ON prod.id = pi.product_id
        LEFT JOIN warehouses w ON w.id = p2.warehouse_id
        WHERE ${whereSql}
      )
    `, params);

    const breakdownCountRes = await pool.query(`
      SELECT COUNT(*)::int AS total_count FROM (
        SELECT s.id
        FROM purchase_items pi
        JOIN purchases p ON p.id = pi.purchase_id
        JOIN suppliers s ON s.id = p.supplier_id
        LEFT JOIN ingredients i ON i.id = pi.ingredient_id
        LEFT JOIN products prod ON prod.id = pi.product_id
        WHERE ${whereSql}
        GROUP BY s.id, s.name, s.supplier_code, COALESCE(i.name, prod.name, pi.item_code, 'صنف غير محدد'), COALESCE(i.item_code, prod.barcode, pi.item_code, ''), COALESCE(i.unit, prod.unit, pi.unit, 'قطعة')
      ) as t
    `, params);

    const total_items_count = kpiRes.rows[0]?.total_items_count || 0;
    const total_items_quantity = kpiRes.rows[0]?.total_items_quantity || 0;
    const total_items_price = kpiRes.rows[0]?.total_items_price || 0;
    const invoices_count = kpiRes.rows[0]?.invoices_count || 0;
    const suppliers_count = kpiRes.rows[0]?.suppliers_count || 0;

    const total_invoices_amount = financialsRes.rows[0]?.total_invoices_amount || 0;
    const total_paid_amount = financialsRes.rows[0]?.total_paid_amount || 0;
    const total_remaining_amount = financialsRes.rows[0]?.total_remaining_amount || 0;
    const total_breakdown_count = breakdownCountRes.rows[0]?.total_count || 0;

    const paginatedParams = [...params];
    paginatedParams.push(limit);
    const limitIdx = paginatedParams.length;
    paginatedParams.push(offset);
    const offsetIdx = paginatedParams.length;

    const itemsQuery = `
      SELECT 
        pi.id AS item_id,
        pi.purchase_id,
        pi.ingredient_id,
        pi.product_id,
        pi.quantity,
        pi.unit_price,
        pi.total_price,
        COALESCE(i.name, prod.name, pi.item_code, 'صنف غير محدد') AS item_name,
        COALESCE(i.item_code, prod.barcode, pi.item_code, '') AS item_code,
        COALESCE(i.unit, prod.unit, pi.unit, 'قطعة') AS unit,
        
        COALESCE(p.invoice_number, p.internal_invoice_number, 'PINV-' || LPAD(p.id::text, 6, '0')) AS invoice_number,
        p.supplier_invoice_number,
        p.internal_invoice_number,
        COALESCE(p.date::date, CURRENT_DATE) AS invoice_date,
        p.due_date,
        p.status AS invoice_status,
        p.payment_status,
        COALESCE(p.total_amount, 0) AS invoice_total_amount,
        COALESCE(p.paid_amount, 0) AS invoice_paid_amount,
        GREATEST(0, COALESCE(p.total_amount, 0) - COALESCE(p.paid_amount, 0)) AS invoice_remaining_amount,
        COALESCE(p.tax_amount, 0) AS invoice_tax_amount,
        COALESCE(p.discount_amount, 0) AS invoice_discount_amount,
        p.notes AS invoice_notes,
        w.name AS warehouse_name,
        
        s.id AS supplier_id,
        s.name AS supplier_name,
        s.name_en AS supplier_name_en,
        s.supplier_code,
        s.phone AS supplier_phone,
        s.tax_number AS supplier_tax_number,
        s.payment_terms AS supplier_payment_terms,
        COALESCE(s.credit_limit, 0) AS supplier_credit_limit,
        COALESCE(s.opening_balance, 0) AS supplier_opening_balance,
        COALESCE(s.balance, 0) AS supplier_current_balance,
        s.status AS supplier_status,
        s.rating AS supplier_rating
      FROM purchase_items pi
      JOIN purchases p ON p.id = pi.purchase_id
      JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN ingredients i ON i.id = pi.ingredient_id
      LEFT JOIN products prod ON prod.id = pi.product_id
      LEFT JOIN warehouses w ON w.id = p.warehouse_id
      WHERE ${whereSql}
      ORDER BY p.date DESC NULLS LAST, p.id DESC, pi.id ASC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const supplierItemsSummaryQuery = `
      SELECT 
        s.id AS supplier_id,
        s.name AS supplier_name,
        s.supplier_code,
        COALESCE(i.name, prod.name, pi.item_code, 'صنف غير محدد') AS item_name,
        COALESCE(i.item_code, prod.barcode, pi.item_code, '') AS item_code,
        COALESCE(i.unit, prod.unit, pi.unit, 'قطعة') AS unit,
        COUNT(DISTINCT p.id) AS invoices_count,
        SUM(pi.quantity) AS total_quantity,
        ROUND(AVG(pi.unit_price), 2) AS avg_unit_price,
        MIN(pi.unit_price) AS min_unit_price,
        MAX(pi.unit_price) AS max_unit_price,
        SUM(pi.total_price) AS total_amount,
        MAX(p.date::date) AS last_supplied_date
      FROM purchase_items pi
      JOIN purchases p ON p.id = pi.purchase_id
      JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN ingredients i ON i.id = pi.ingredient_id
      LEFT JOIN products prod ON prod.id = pi.product_id
      WHERE ${whereSql}
      GROUP BY s.id, s.name, s.supplier_code, COALESCE(i.name, prod.name, pi.item_code, 'صنف غير محدد'), COALESCE(i.item_code, prod.barcode, pi.item_code, ''), COALESCE(i.unit, prod.unit, pi.unit, 'قطعة')
      ORDER BY s.name ASC, total_amount DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const [itemsRes, supplierItemsRes] = await Promise.all([
      pool.query(itemsQuery, paginatedParams),
      pool.query(supplierItemsSummaryQuery, paginatedParams)
    ]);

    const rows = itemsRes.rows;
    const uniqueInvoices = new Map<number, any>();
    const uniqueSuppliers = new Map<number, any>();

    for (const r of rows) {
      if (!uniqueInvoices.has(r.purchase_id)) {
        uniqueInvoices.set(r.purchase_id, {
          purchase_id: r.purchase_id,
          supplier_id: r.supplier_id,
          supplier_name: r.supplier_name,
          invoice_number: r.invoice_number,
          supplier_invoice_number: r.supplier_invoice_number,
          invoice_date: r.invoice_date,
          due_date: r.due_date,
          invoice_status: r.invoice_status,
          payment_status: r.payment_status,
          warehouse_name: r.warehouse_name,
          invoice_notes: r.invoice_notes,
          total_amount: Number(r.invoice_total_amount || 0),
          paid_amount: Number(r.invoice_paid_amount || 0),
          remaining_amount: Number(r.invoice_remaining_amount || 0),
          items_count: 0
        });
      }
      const inv = uniqueInvoices.get(r.purchase_id);
      inv.items_count++;

      if (!uniqueSuppliers.has(r.supplier_id)) {
        uniqueSuppliers.set(r.supplier_id, {
          supplier_id: r.supplier_id,
          supplier_name: r.supplier_name,
          supplier_name_en: r.supplier_name_en,
          supplier_code: r.supplier_code,
          supplier_phone: r.supplier_phone,
          supplier_tax_number: r.supplier_tax_number,
          supplier_payment_terms: r.supplier_payment_terms,
          supplier_credit_limit: Number(r.supplier_credit_limit || 0),
          supplier_opening_balance: Number(r.supplier_opening_balance || 0),
          supplier_current_balance: Number(r.supplier_current_balance || 0),
          supplier_status: r.supplier_status,
          supplier_rating: Number(r.supplier_rating || 0),
          invoices_count: 0,
          items_count: 0,
          total_purchases: 0,
          total_paid: 0,
          total_remaining: 0,
          total_quantity: 0
        });
      }
      const supp = uniqueSuppliers.get(r.supplier_id);
      supp.items_count++;
      supp.total_quantity += Number(r.quantity || 0);
    }

    uniqueInvoices.forEach(inv => {
      const supp = uniqueSuppliers.get(inv.supplier_id);
      if (supp) {
        supp.invoices_count++;
        supp.total_purchases += inv.total_amount;
        supp.total_paid += inv.paid_amount;
        supp.total_remaining += inv.remaining_amount;
      }
    });

    res.json({
      filters: { from, to, supplier_id, supplier_name, invoice_number, search, page, limit },
      kpis: {
        total_invoices_amount,
        total_paid_amount,
        total_remaining_amount,
        total_items_quantity,
        total_items_price,
        invoices_count,
        items_count: total_items_count,
        suppliers_count,
        total_breakdown_count
      },
      items: rows,
      invoices: Array.from(uniqueInvoices.values()),
      suppliers_summary: Array.from(uniqueSuppliers.values()),
      supplier_items_breakdown: supplierItemsRes.rows
    });
  } catch (err: any) {
    console.error("Error in /api/suppliers-detailed-report:", err);
    res.status(500).json({ error: err.message || "Failed to generate detailed suppliers report" });
  }
});

router.get("/api/suppliers-aging", async (req,res)=>{
  try {
    const asOf = String(req.query.as_of || new Date().toISOString().slice(0,10));
    const search = req.query.search ? String(req.query.search).trim() : "";
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const params: any[] = [];
    let whereClause = "1=1";
    if (search) {
      params.push(`%${search}%`);
      whereClause = `(s.name ILIKE $${params.length} OR s.name_en ILIKE $${params.length} OR s.supplier_code ILIKE $${params.length})`;
    }

    const countRes = await pool.query(`
      SELECT COUNT(*)::int AS total_records 
      FROM suppliers s 
      WHERE ${whereClause}
    `, params);
    const total_records = countRes.rows[0]?.total_records || 0;

    params.push(asOf);
    const asOfIdx = params.length;

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const mainQuery = `
      WITH inv AS (
        SELECT p.id, p.supplier_id, p.invoice_number, p.date, p.due_date, p.total_amount, p.paid_amount,
          GREATEST(p.total_amount - COALESCE(p.paid_amount, 0), 0) outstanding,
          GREATEST(($${asOfIdx}::date - COALESCE(p.due_date, p.date::date)), 0) overdue_days
        FROM purchases p 
        WHERE p.date::date <= $${asOfIdx}::date AND p.total_amount > COALESCE(p.paid_amount, 0)
      ) 
      SELECT s.id, s.supplier_code, s.name, s.name_en, s.credit_limit, s.balance,
        COALESCE(SUM(inv.outstanding), 0) outstanding,
        COALESCE(SUM(CASE WHEN inv.overdue_days = 0 THEN inv.outstanding ELSE 0 END), 0) current_amount,
        COALESCE(SUM(CASE WHEN inv.overdue_days BETWEEN 1 AND 30 THEN inv.outstanding ELSE 0 END), 0) bucket_1_30,
        COALESCE(SUM(CASE WHEN inv.overdue_days BETWEEN 31 AND 60 THEN inv.outstanding ELSE 0 END), 0) bucket_31_60,
        COALESCE(SUM(CASE WHEN inv.overdue_days BETWEEN 61 AND 90 THEN inv.outstanding ELSE 0 END), 0) bucket_61_90,
        COALESCE(SUM(CASE WHEN inv.overdue_days > 90 THEN inv.outstanding ELSE 0 END), 0) bucket_over_90
      FROM suppliers s 
      LEFT JOIN inv ON inv.supplier_id = s.id 
      WHERE ${whereClause}
      GROUP BY s.id 
      ORDER BY outstanding DESC 
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const result = await pool.query(mainQuery, params);
    res.json({ as_of: asOf, total_records, page, limit, rows: result.rows });
  } catch(err:any) { res.status(500).json({error:err.message}); }
});

router.get("/api/suppliers/:id/aging", async (req,res)=>{
  try {
    const asOf=String(req.query.as_of || new Date().toISOString().slice(0,10));
    const result=await pool.query(`SELECT p.id,p.invoice_number,p.date,p.due_date,p.total_amount,p.paid_amount,
      GREATEST(p.total_amount-COALESCE(p.paid_amount,0),0) outstanding,
      CASE WHEN COALESCE(p.due_date,p.date::date)>$2::date THEN 0 ELSE ($2::date-COALESCE(p.due_date,p.date::date)) END overdue_days
      FROM purchases p WHERE p.supplier_id=$1 AND p.total_amount>COALESCE(p.paid_amount,0) ORDER BY overdue_days DESC,p.date ASC`,[req.params.id,asOf]);
    res.json({as_of:asOf,rows:result.rows});
  }catch(err:any){res.status(500).json({error:err.message});}
});

router.post("/api/suppliers/:id/recalculate-balance", async(req,res)=>{
  try{
    const result=await pool.query(`SELECT COALESCE(s.opening_balance,0)+COALESCE(SUM(CASE WHEN COALESCE(st.reference_type,'')='opening_balance' THEN 0 WHEN st.type IN ('purchase','adjustment') THEN st.amount WHEN st.type IN ('payment','return') THEN -st.amount ELSE 0 END),0) balance FROM suppliers s LEFT JOIN supplier_transactions st ON st.supplier_id=s.id WHERE s.id=$1 GROUP BY s.id`,[req.params.id]);
    if(!result.rows.length)return res.status(404).json({error:'Supplier not found'});
    await pool.query("UPDATE suppliers SET balance=$1,updated_at=NOW() WHERE id=$2",[result.rows[0].balance,req.params.id]);
    res.json({supplier_id:Number(req.params.id),balance:Number(result.rows[0].balance)});
  }catch(err:any){res.status(500).json({error:err.message});}
});

// Contacts
router.get("/api/suppliers/:id/contacts", async(req,res)=>{try{res.json((await pool.query("SELECT * FROM supplier_contacts WHERE supplier_id=$1 ORDER BY is_primary DESC,id DESC",[req.params.id])).rows);}catch(e:any){res.status(500).json({error:e.message});}});
router.post("/api/suppliers/:id/contacts", async(req,res)=>{try{const {name,job_title,phone,mobile,email,is_primary,notes}=req.body;if(!name)return res.status(400).json({error:'name is required'});if(is_primary)await pool.query("UPDATE supplier_contacts SET is_primary=false WHERE supplier_id=$1",[req.params.id]);const r=await pool.query("INSERT INTO supplier_contacts(supplier_id,name,job_title,phone,mobile,email,is_primary,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",[req.params.id,name,job_title||null,phone||null,mobile||null,email||null,!!is_primary,notes||null]);res.status(201).json(r.rows[0]);}catch(e:any){res.status(500).json({error:e.message});}});
router.delete("/api/suppliers/:id/contacts/:contactId", async(req,res)=>{try{await pool.query("DELETE FROM supplier_contacts WHERE id=$1 AND supplier_id=$2",[req.params.contactId,req.params.id]);res.json({success:true});}catch(e:any){res.status(500).json({error:e.message});}});

// Bank accounts
router.get("/api/suppliers/:id/bank-accounts", async(req,res)=>{try{res.json((await pool.query("SELECT id,supplier_id,bank_name,account_name,account_number,iban,swift,branch,currency,is_default,notes FROM supplier_bank_accounts WHERE supplier_id=$1 ORDER BY is_default DESC,id DESC",[req.params.id])).rows);}catch(e:any){res.status(500).json({error:e.message});}});
router.post("/api/suppliers/:id/bank-accounts", async(req,res)=>{try{const {bank_name,account_name,account_number,iban,swift,branch,currency,is_default,notes}=req.body;if(!bank_name)return res.status(400).json({error:'bank_name is required'});if(is_default)await pool.query("UPDATE supplier_bank_accounts SET is_default=false WHERE supplier_id=$1",[req.params.id]);const r=await pool.query("INSERT INTO supplier_bank_accounts(supplier_id,bank_name,account_name,account_number,iban,swift,branch,currency,is_default,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,supplier_id,bank_name,account_name,account_number,iban,swift,branch,currency,is_default,notes",[req.params.id,bank_name,account_name||null,account_number||null,iban||null,swift||null,branch||null,currency||'EGP',!!is_default,notes||null]);res.status(201).json(r.rows[0]);}catch(e:any){res.status(500).json({error:e.message});}});
router.delete("/api/suppliers/:id/bank-accounts/:accountId", async(req,res)=>{try{await pool.query("DELETE FROM supplier_bank_accounts WHERE id=$1 AND supplier_id=$2",[req.params.accountId,req.params.id]);res.json({success:true});}catch(e:any){res.status(500).json({error:e.message});}});

// Documents and evaluations
router.get("/api/suppliers/:id/documents", async(req,res)=>{try{res.json((await pool.query("SELECT id,supplier_id,document_type,document_number,file_name,issue_date,expiry_date,status,notes,mime_type,file_size,checksum_sha256,uploaded_by,created_at FROM supplier_documents WHERE supplier_id=$1 ORDER BY expiry_date NULLS LAST,id DESC",[req.params.id])).rows);}catch(e:any){res.status(500).json({error:e.message});}});
router.post("/api/suppliers/:id/documents", supplierDocumentUpload.single("file") as any, async(req,res)=>{
  try {
    const {document_type,document_number,issue_date,expiry_date,status,notes}=req.body;
    if(!document_type) return res.status(400).json({error:"document_type is required"});
    const supplier = await pool.query("SELECT id FROM suppliers WHERE id=$1",[req.params.id]);
    if(!supplier.rowCount) return res.status(404).json({error:"Supplier not found"});
    const file = req.file;
    if(!file) return res.status(400).json({error:"file is required"});
    const checksum = crypto.createHash("sha256").update(file.buffer).digest("hex");
    const r=await pool.query(
      `INSERT INTO supplier_documents(supplier_id,document_type,document_number,file_name,file_url,issue_date,expiry_date,status,notes,file_data,mime_type,file_size,checksum_sha256)
       VALUES($1,$2,$3,$4,NULL,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id,supplier_id,document_type,document_number,file_name,issue_date,expiry_date,status,notes,mime_type,file_size,checksum_sha256,created_at`,
      [req.params.id,document_type,document_number||null,file.originalname,issue_date||null,expiry_date||null,status||"active",notes||null,file.buffer,file.mimetype,file.size,checksum]
    );
    res.status(201).json(r.rows[0]);
  } catch(e:any) {
    if(e?.code === "LIMIT_FILE_SIZE") return res.status(413).json({error:"حجم المستند يتجاوز 15MB"});
    res.status(500).json({error:e.message});
  }
});
router.get("/api/suppliers/:id/documents/:documentId/download", async(req,res)=>{
  try {
    const r=await pool.query("SELECT file_name,mime_type,file_size,file_data FROM supplier_documents WHERE id=$1 AND supplier_id=$2",[req.params.documentId,req.params.id]);
    if(!r.rowCount || !r.rows[0].file_data) return res.status(404).json({error:"Document file not found"});
    const d=r.rows[0];
    res.setHeader("Content-Type", d.mime_type || "application/octet-stream");
    res.setHeader("Content-Length", String(d.file_size || d.file_data.length));
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(d.file_name || "supplier-document")}`);
    res.send(d.file_data);
  } catch(e:any) { res.status(500).json({error:e.message}); }
});
router.delete("/api/suppliers/:id/documents/:documentId", async(req,res)=>{try{await pool.query("DELETE FROM supplier_documents WHERE id=$1 AND supplier_id=$2",[req.params.documentId,req.params.id]);res.json({success:true});}catch(e:any){res.status(500).json({error:e.message});}});
router.get("/api/suppliers/:id/evaluations", async(req,res)=>{try{res.json((await pool.query("SELECT * FROM supplier_evaluations WHERE supplier_id=$1 ORDER BY evaluation_date DESC,id DESC",[req.params.id])).rows);}catch(e:any){res.status(500).json({error:e.message});}});
router.post("/api/suppliers/:id/evaluations", async(req,res)=>{try{const q=(v:any)=>Math.max(0,Math.min(100,Number(v)||0));const scores=[q(req.body.quality_score),q(req.body.delivery_score),q(req.body.price_score),q(req.body.service_score)];const overall=(scores.reduce((a,b)=>a+b,0)/4).toFixed(2);const r=await pool.query("INSERT INTO supplier_evaluations(supplier_id,evaluation_date,quality_score,delivery_score,price_score,service_score,overall_score,notes) VALUES($1,COALESCE($2,CURRENT_DATE),$3,$4,$5,$6,$7,$8) RETURNING *",[req.params.id,req.body.evaluation_date||null,...scores,overall,req.body.notes||null]);await pool.query("UPDATE suppliers SET rating=ROUND($1)::integer,updated_at=NOW() WHERE id=$2",[overall,req.params.id]);res.status(201).json(r.rows[0]);}catch(e:any){res.status(500).json({error:e.message});}});

router.get("/api/suppliers-price-history", async(req,res)=>{try{const {supplier_id,ingredient_id}=req.query;const params:any[]=[];let where=' WHERE 1=1';if(supplier_id){params.push(supplier_id);where+=` AND p.supplier_id=$${params.length}`;}if(ingredient_id){params.push(ingredient_id);where+=` AND pi.ingredient_id=$${params.length}`;}const r=await pool.query(`SELECT p.supplier_id,s.name supplier_name,pi.ingredient_id,i.name ingredient_name,pi.unit_price,p.date,p.invoice_number FROM purchase_items pi JOIN purchases p ON p.id=pi.purchase_id JOIN suppliers s ON s.id=p.supplier_id LEFT JOIN ingredients i ON i.id=pi.ingredient_id ${where} ORDER BY p.date DESC LIMIT 500`,params);res.json(r.rows);}catch(e:any){res.status(500).json({error:e.message});}});

router.get("/api/suppliers-dashboard", async(req,res)=>{try{const [stats,aging]=await Promise.all([pool.query(`SELECT COUNT(*) total_suppliers,COUNT(*) FILTER(WHERE status='active') active_suppliers,COALESCE(SUM(GREATEST(balance,0)),0) total_payable,COALESCE((SELECT SUM(total_amount) FROM purchases WHERE date>=CURRENT_DATE-INTERVAL '30 days'),0) purchases_30d,COALESCE((SELECT SUM(amount) FROM supplier_transactions WHERE type='payment' AND timestamp>=CURRENT_DATE-INTERVAL '30 days'),0) payments_30d,COALESCE((SELECT COUNT(*) FROM purchase_orders WHERE status IN ('draft','pending','approved','partially_received')),0) pending_orders FROM suppliers`),pool.query(`SELECT COALESCE(SUM(GREATEST(p.total_amount-COALESCE(p.paid_amount,0),0)),0) overdue_payable FROM purchases p WHERE COALESCE(p.due_date,p.date::date)<CURRENT_DATE AND p.total_amount>COALESCE(p.paid_amount,0)`) ]);res.json({stats:{...stats.rows[0],...aging.rows[0]}});}catch(e:any){res.status(500).json({error:e.message});}});

// ═══════════════════════════════════════
// PURCHASE ORDERS V1 API
// ═══════════════════════════════════════
// Ensure purchase_orders has tax and subtotal columns
(async () => {
  try {
    await pool.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(14,2) DEFAULT 0`);
    await pool.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(6,2) DEFAULT 0`);
    await pool.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(14,2) DEFAULT 0`);
    await pool.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(14,2) DEFAULT 0`);
    await pool.query(`ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(6,2) DEFAULT 0`);
    await pool.query(`ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(14,2) DEFAULT 0`);
    await pool.query(`UPDATE purchase_orders SET subtotal = COALESCE(NULLIF(subtotal, 0), total_amount - COALESCE(tax_amount, 0), 0) WHERE subtotal IS NULL OR subtotal = 0`);
  } catch (err) {
    console.warn("Warning ensuring purchase_orders tax columns:", err);
  }
})();

router.get("/api/purchase-orders", async (req: Request, res: Response) => {
  try {
    const { status, supplier_id, remaining_qty } = req.query;
    let query = `
      SELECT 
        po.*, 
        s.name as supplier_name,
        COALESCE((SELECT COUNT(*) FROM purchase_order_items poi WHERE poi.purchase_order_id = po.id AND (poi.quantity - COALESCE(poi.received_quantity, 0)) > 0), 0) as remaining_items_count,
        COALESCE((SELECT COUNT(*) FROM purchase_order_items poi WHERE poi.purchase_order_id = po.id), 0) as total_items_count,
        COALESCE((SELECT SUM(quantity) FROM purchase_order_items poi WHERE poi.purchase_order_id = po.id), 0) as total_ordered_qty,
        COALESCE((SELECT SUM(received_quantity) FROM purchase_order_items poi WHERE poi.purchase_order_id = po.id), 0) as total_received_qty
      FROM purchase_orders po 
      LEFT JOIN suppliers s ON po.supplier_id = s.id 
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;
    if (status) {
      if (status === "approved") {
        query += ` AND po.status IN ('approved', 'partially_received')`;
      } else {
        query += ` AND po.status = $${idx}`;
        params.push(status);
        idx++;
      }
    }
    if (supplier_id) { query += ` AND po.supplier_id = $${idx}`; params.push(supplier_id); idx++; }
    if (remaining_qty) {
      query += ` AND EXISTS (SELECT 1 FROM purchase_order_items poi WHERE poi.purchase_order_id = po.id AND (poi.quantity - COALESCE(poi.received_quantity, 0)) > 0)`;
    }
    query += " ORDER BY po.date DESC, po.id DESC";
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/api/purchase-orders/:id", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT po.*, s.name as supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id = s.id WHERE po.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Purchase order not found" });
    const items = await pool.query(
      `SELECT poi.*, COALESCE(i.name,p.name) as ingredient_name, COALESCE(i.unit,poi.unit,'قطعة') as unit, COALESCE(i.item_code,p.barcode,poi.item_code) as resolved_item_code FROM purchase_order_items poi LEFT JOIN ingredients i ON poi.ingredient_id = i.id LEFT JOIN products p ON poi.product_id=p.id WHERE poi.purchase_order_id = $1`,
      [req.params.id]
    );
    res.json({ ...result.rows[0], items: items.rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/api/purchase-orders", async (req: Request, res: Response) => {
  try {
    const {
      supplier_id,
      delivery_date,
      notes,
      items,
      requested_by,
      purchase_request_id,
      branch_id,
      cost_center_id,
      currency,
      subtotal: rawSubtotal,
      tax_rate: rawTaxRate,
      tax_amount: rawTaxAmount,
      discount_amount: rawDiscountAmount,
    } = req.body;
    if (!supplier_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "supplier_id and items are required" });
    }
    const itemsNetSum = items.reduce(
      (sum: number, i: any) => sum + (Number(i.quantity || 0) * Number(i.unit_price || 0)),
      0
    );
    const subtotal = Math.round((Number(rawSubtotal) > 0 ? Number(rawSubtotal) : itemsNetSum) * 100) / 100;
    const discount_amount = Math.max(0, Number(rawDiscountAmount || 0));
    const netBeforeTax = Math.max(0, subtotal - discount_amount);
    const tax_rate = Math.max(0, Number(rawTaxRate || 0));
    const computedTax = rawTaxAmount !== undefined && rawTaxAmount !== "" && rawTaxAmount !== null
      ? Math.max(0, Number(rawTaxAmount) || 0)
      : Math.round((netBeforeTax * (tax_rate / 100)) * 100) / 100;
    const tax_amount = Math.round(computedTax * 100) / 100;
    const total_amount = Math.round((netBeforeTax + tax_amount) * 100) / 100;

    // Check if approval is required for this purchase order
    let requiresApproval = true;
    try {
      const setting = await pool.query("SELECT * FROM approval_settings WHERE module_type = 'purchase_order'");
      if (setting.rows.length > 0) {
        requiresApproval = setting.rows[0].requires_approval;
        // Auto-approve if below threshold
        if (requiresApproval && setting.rows[0].auto_approve_below > 0 && total_amount < parseFloat(setting.rows[0].auto_approve_below)) {
          requiresApproval = false;
        }
      }
    } catch (_e) { /* default: requires approval */ }

    const poStatus = requiresApproval ? 'pending_approval' : 'approved';
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const poResult = await client.query(
        `INSERT INTO purchase_orders (supplier_id, delivery_date, status, subtotal, tax_rate, tax_amount, discount_amount, total_amount, notes, requested_by, currency, purchase_request_id, branch_id, cost_center_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
        [
          supplier_id,
          delivery_date || null,
          poStatus,
          subtotal,
          tax_rate,
          tax_amount,
          discount_amount,
          total_amount,
          notes || null,
          requested_by || null,
          currency || 'EGP',
          purchase_request_id ? Number(purchase_request_id) : null,
          branch_id ? Number(branch_id) : null,
          cost_center_id ? Number(cost_center_id) : null
        ]
      );
      const poId = poResult.rows[0].id;
      await client.query(`UPDATE purchase_orders SET order_number='PO-' || TO_CHAR(CURRENT_DATE,'YYYYMMDD') || '-' || LPAD(id::text,6,'0') WHERE id=$1`, [poId]);
      for (const item of items) {
        const itemTaxRate = item.tax_rate !== undefined ? Number(item.tax_rate) : tax_rate;
        const lineNet = Number(item.quantity || 0) * Number(item.unit_price || 0);
        const itemTaxAmount = item.tax_amount !== undefined ? Number(item.tax_amount) : Math.round((lineNet * (itemTaxRate / 100)) * 100) / 100;
        try {
          await client.query(
            `INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, product_id, item_code, unit, quantity, unit_price, tax_rate, tax_amount, total_price, expiry_date, batch_number) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [poId, item.ingredient_id || null, item.product_id || null, item.item_code || null, item.unit || null, item.quantity, item.unit_price, itemTaxRate, itemTaxAmount, lineNet, item.expiry_date || null, item.batch_number || null]
          );
        } catch (_colErr) {
          await client.query(
            `INSERT INTO purchase_order_items (purchase_order_id, ingredient_id, product_id, item_code, unit, quantity, unit_price, total_price) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [poId, item.ingredient_id || null, item.product_id || null, item.item_code || null, item.unit || null, item.quantity, item.unit_price, lineNet]
          );
        }
      }

      // Auto-create approval request if needed
      if (requiresApproval) {
        // Get supplier name for title
        const supplierName = await client.query("SELECT name FROM suppliers WHERE id = $1", [supplier_id]);
        const sName = supplierName.rows[0]?.name || 'مورد';
        await client.query(
          `INSERT INTO approval_requests (module_type, reference_id, title, description, requested_by, metadata)
           VALUES ('purchase_order', $1, $2, $3, $4, $5)`,
          [poId, `أمر شراء #${poId} - ${sName}`, `إجمالي المبلغ شامل الضريبة: ${total_amount} جنيه (الضريبة: ${tax_amount} جنيه)`, requested_by || 'system', JSON.stringify({ subtotal, tax_amount, total_amount, supplier_id, item_count: items.length })]
        );
      }

      await client.query("COMMIT");
      res.status(201).json({ ...poResult.rows[0], items, requires_approval: requiresApproval });
    } catch (e) { await client.query("ROLLBACK"); throw e; }
    finally { client.release(); }
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put("/api/purchase-orders/:id", async (req: Request, res: Response) => {
  try {
    const { status, delivery_date, notes, tax_rate, tax_amount, subtotal, total_amount } = req.body;
    const result = await pool.query(
      `UPDATE purchase_orders
       SET status = COALESCE($1, status),
           delivery_date = COALESCE($2, delivery_date),
           notes = COALESCE($3, notes),
           tax_rate = COALESCE($4, tax_rate),
           tax_amount = COALESCE($5, tax_amount),
           subtotal = COALESCE($6, subtotal),
           total_amount = COALESCE($7, total_amount)
       WHERE id = $8 RETURNING *`,
      [
        status,
        delivery_date,
        notes,
        tax_rate !== undefined ? Number(tax_rate) : null,
        tax_amount !== undefined ? Number(tax_amount) : null,
        subtotal !== undefined ? Number(subtotal) : null,
        total_amount !== undefined ? Number(total_amount) : null,
        req.params.id
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Purchase order not found" });
    res.json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/api/purchase-orders/:id", async (req: Request, res: Response) => {
  try {
    await pool.query("DELETE FROM purchase_order_items WHERE purchase_order_id = $1", [req.params.id]);
    const result = await pool.query("DELETE FROM purchase_orders WHERE id = $1 AND status = 'pending' RETURNING *", [req.params.id]);
    if (result.rows.length === 0) return res.status(400).json({ error: "Can only delete pending orders" });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════
// PURCHASE REQUESTS V2 API
// No approval workflow is introduced here. A request is a procurement
// requirement document that can later be linked to quotations/orders.
// ═══════════════════════════════════════
async function logPurchaseActivity(entityType: string, entityId: number, action: string, details: any = {}, createdBy?: string) {
  try {
    await pool.query(
      `INSERT INTO purchase_activity_log (entity_type,entity_id,action,details,created_by) VALUES ($1,$2,$3,$4,$5)`,
      [entityType, entityId, action, JSON.stringify(details || {}), createdBy || null]
    );
  } catch (e) {
    console.warn('[Purchases] activity log failed:', e);
  }
}

router.get("/api/purchase-requests", async (req: Request, res: Response) => {
  try {
    const { status, branch_id, warehouse_id, priority, requested_by, from_date, to_date, q } = req.query;
    const params: any[] = [];
    let where = 'WHERE 1=1';
    const add = (sql: string, value: any) => { params.push(value); where += ` AND ${sql.replace('?', `$${params.length}`)}`; };
    if (status) add('pr.status = ?', status);
    if (branch_id) add('pr.branch_id = ?', branch_id);
    if (warehouse_id) add('pr.warehouse_id = ?', warehouse_id);
    if (priority) add('pr.priority = ?', priority);
    if (requested_by) add('pr.requested_by ILIKE ?', `%${requested_by}%`);
    if (from_date) add('pr.date::date >= ?::date', from_date);
    if (to_date) add('pr.date::date <= ?::date', to_date);
    if (q) {
      params.push(`%${q}%`);
      const n = params.length;
      where += ` AND (pr.request_number ILIKE $${n} OR pr.requested_by ILIKE $${n} OR pr.department ILIKE $${n} OR pr.reason ILIKE $${n})`;
    }
    const result = await pool.query(`
      SELECT pr.*,
        b.name AS branch_name,
        w.name AS warehouse_name,
        cc.name AS cost_center_name,
        ci.name AS cost_item_name,
        COALESCE((SELECT COUNT(*) FROM purchase_request_items pri WHERE pri.purchase_request_id=pr.id),0)::int AS items_count,
        COALESCE((SELECT SUM(COALESCE(pri.total_price, pri.quantity*COALESCE(pri.unit_price,0))) FROM purchase_request_items pri WHERE pri.purchase_request_id=pr.id),0) AS calculated_total
      FROM purchase_requests pr
      LEFT JOIN branches b ON b.id=pr.branch_id
      LEFT JOIN warehouses w ON w.id=pr.warehouse_id
      LEFT JOIN cost_centers cc ON cc.id=pr.cost_center_id
      LEFT JOIN cost_items ci ON ci.id=pr.cost_item_id
      ${where}
      ORDER BY pr.date DESC, pr.id DESC
    `, params);
    res.json(result.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/api/purchase-requests/:id", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT pr.*, b.name branch_name, w.name warehouse_name, cc.name cost_center_name, ci.name cost_item_name
      FROM purchase_requests pr
      LEFT JOIN branches b ON b.id=pr.branch_id
      LEFT JOIN warehouses w ON w.id=pr.warehouse_id
      LEFT JOIN cost_centers cc ON cc.id=pr.cost_center_id
      LEFT JOIN cost_items ci ON ci.id=pr.cost_item_id
      WHERE pr.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Purchase request not found" });
    const [items, attachments, activity] = await Promise.all([
      pool.query(`SELECT pri.*, COALESCE(i.name,p.name,pri.name) AS resolved_name, COALESCE(i.unit,pri.unit) AS resolved_unit, COALESCE(i.item_code,p.barcode,pri.item_code) AS resolved_code FROM purchase_request_items pri LEFT JOIN ingredients i ON i.id=CASE WHEN pri.item_type='ingredient' AND pri.ingredient_id ~ '^[0-9]+$' THEN pri.ingredient_id::integer ELSE NULL END LEFT JOIN products p ON p.id=pri.product_id WHERE pri.purchase_request_id=$1 ORDER BY pri.id`, [req.params.id]),
      pool.query(`SELECT id,file_name,mime_type,file_size,created_by,created_at FROM purchase_request_attachments WHERE purchase_request_id=$1 ORDER BY id DESC`, [req.params.id]),
      pool.query(`SELECT id,action,details,created_by,created_at FROM purchase_activity_log WHERE entity_type='purchase_request' AND entity_id=$1 ORDER BY id DESC`, [req.params.id])
    ]);
    res.json({ ...result.rows[0], items: items.rows, attachments: attachments.rows, activity: activity.rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/api/purchase-requests/:id/attachments/:attachmentId", async (req: Request, res: Response) => {
  try {
    const r = await pool.query(`SELECT file_name,mime_type,file_data FROM purchase_request_attachments WHERE id=$1 AND purchase_request_id=$2`, [req.params.attachmentId, req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Attachment not found' });
    res.setHeader('Content-Type', r.rows[0].mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${String(r.rows[0].file_name).replace(/"/g, '')}"`);
    res.send(r.rows[0].file_data);
  } catch (err:any) { res.status(500).json({error: err.message}); }
});

/**
 * BUG-ERP-011 / PHASE 5: a business validation failure is the caller's fault and
 * must surface as 400/422, never as a blanket 500. `ValidationError` carries the
 * HTTP status so the shared catch block can honour it.
 */
class PurchaseValidationError extends Error {
  statusCode: number;
  error: string;
  constructor(message: string, statusCode = 422, error = "VALIDATION_ERROR") {
    super(message);
    this.name = "PurchaseValidationError";
    this.statusCode = statusCode;
    this.error = error;
  }
}

router.post("/api/purchase-requests", async (req: Request, res: Response) => {
  const client = await pool.connect();
  const idempotencyKey = String(req.get("Idempotency-Key") || req.body?.idempotency_key || "").trim() || null;
  try {
    const {
      requested_by, notes, items, branch_id, warehouse_id, department, required_date,
      priority, reason, justification, cost_center_id, cost_item_id, currency, created_by, source_type
    } = req.body;

    // Idempotency: repeated clicks/retries with the same key return the original request
    // instead of inserting a second purchase request.
    if (idempotencyKey) {
      const existing = await client.query(`
        SELECT pr.*, b.name branch_name, w.name warehouse_name, cc.name cost_center_name, ci.name cost_item_name
        FROM purchase_requests pr
        LEFT JOIN branches b ON b.id=pr.branch_id
        LEFT JOIN warehouses w ON w.id=pr.warehouse_id
        LEFT JOIN cost_centers cc ON cc.id=pr.cost_center_id
        LEFT JOIN cost_items ci ON ci.id=pr.cost_item_id
        WHERE pr.idempotency_key=$1
        LIMIT 1
      `, [idempotencyKey]);
      if (existing.rows.length) return res.status(200).json(existing.rows[0]);
    }

    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "items are required" });
    if (!requested_by) return res.status(400).json({ error: "requested_by is required" });
    if (branch_id && !(await client.query('SELECT 1 FROM branches WHERE id=$1', [Number(branch_id)])).rows.length) return res.status(400).json({error:'الفرع المحدد غير موجود'});
    if (warehouse_id && !(await client.query('SELECT 1 FROM warehouses WHERE id=$1', [Number(warehouse_id)])).rows.length) return res.status(400).json({error:'المخزن المحدد غير موجود'});
    if (cost_center_id && !(await client.query('SELECT 1 FROM cost_centers WHERE id=$1', [Number(cost_center_id)])).rows.length) return res.status(400).json({error:'مركز التكلفة المحدد غير موجود'});
    if (cost_item_id && !(await client.query('SELECT 1 FROM cost_items WHERE id=$1', [Number(cost_item_id)])).rows.length) return res.status(400).json({error:'بند التكلفة المحدد غير موجود'});

    await client.query('BEGIN');
    const prResult = await client.query(`
      INSERT INTO purchase_requests (requested_by,notes,branch_id,warehouse_id,department,required_date,priority,reason,justification,cost_center_id,cost_item_id,currency,created_by,status,source_type,submitted_at,idempotency_key)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'Draft',$14,NULL,$15)
      RETURNING *
    `, [requested_by, notes || null, branch_id ? Number(branch_id) : null, warehouse_id ? Number(warehouse_id) : null, department || null, required_date || null, priority || 'normal', reason || null, justification || null, cost_center_id ? Number(cost_center_id) : null, cost_item_id ? Number(cost_item_id) : null, currency || 'EGP', created_by || requested_by, source_type || 'manual', idempotencyKey]);
    const prId = prResult.rows[0].id;
    const requestNumber = `PR-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(prId).padStart(6,'0')}`;
    await client.query(`UPDATE purchase_requests SET request_number=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2`, [requestNumber, prId]);

    let estimatedTotal = 0;
    for (const raw of items) {
      const rawId = raw.ingredient_id != null ? String(raw.ingredient_id) : '';
      const itemType = raw.item_type || (raw.product_id || rawId.startsWith('p_') ? 'product' : 'ingredient');
      const ingredientId = itemType === 'ingredient' && rawId && /^\d+$/.test(rawId) ? Number(rawId) : null;
      const productId = itemType === 'product' ? Number(raw.product_id || (rawId.startsWith('p_') ? rawId.slice(2) : rawId)) || null : null;
      const quantity = Number(raw.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new PurchaseValidationError(
          `الكمية غير صحيحة للصنف ${raw.name || raw.item_code || ''}: يجب أن تكون أكبر من صفر`,
          422,
          "VALIDATION_ERROR"
        );
      }
      let master:any = null;
      if (ingredientId) master = (await client.query(`SELECT id,name,unit,cost,item_code,min_stock,max_stock,current_stock FROM ingredients WHERE id=$1`, [ingredientId])).rows[0];
      if (!master && productId) master = (await client.query(`SELECT id,name,price AS cost,barcode AS item_code FROM products WHERE id=$1`, [productId])).rows[0];
      if (!master) {
        throw new PurchaseValidationError(`الصنف غير موجود: ${raw.name || raw.item_code || rawId}`, 422, "ITEM_NOT_FOUND");
      }
      const unit = raw.unit || master.unit || 'قطعة';
      const unitPrice = Number(raw.unit_price ?? master.cost ?? 0) || 0;
      let stock = 0, minStock = 0, maxStock = 0;
      if (ingredientId) {
        const stockQ = await client.query(`SELECT COALESCE(SUM(quantity),0) stock FROM inventory_items WHERE ingredient_id=$1 ${warehouse_id ? 'AND warehouse_id=$2' : ''}`, warehouse_id ? [ingredientId, Number(warehouse_id)] : [ingredientId]);
        stock = Number(stockQ.rows[0]?.stock || master.current_stock || 0);
        minStock = Number(master.min_stock || 0);
        maxStock = Number(master.max_stock || 0);
      }
      const total = quantity * unitPrice;
      estimatedTotal += total;
      const suggested = Number(raw.suggested_quantity ?? (maxStock > stock ? Math.max(maxStock-stock, 0) : Math.max(minStock-stock, 0)));
      await client.query(`
        INSERT INTO purchase_request_items (purchase_request_id,ingredient_id,product_id,item_type,item_code,name,unit,quantity,unit_price,stock_on_hand,min_stock,max_stock,suggested_quantity,total_price,notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      `, [prId, ingredientId, productId, itemType, raw.item_code || master.item_code || null, raw.name || master.name, unit, quantity, unitPrice, stock, minStock, maxStock, Number.isFinite(suggested) ? suggested : 0, total, raw.notes || null]);
    }
    await client.query(`UPDATE purchase_requests SET estimated_total=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2`, [estimatedTotal, prId]);
    await client.query('COMMIT');
    await logPurchaseActivity('purchase_request', prId, 'created', {request_number: requestNumber, estimated_total: estimatedTotal, items_count: items.length}, created_by || requested_by);
    const details = await pool.query(`SELECT pr.*,b.name branch_name,w.name warehouse_name,cc.name cost_center_name,ci.name cost_item_name FROM purchase_requests pr LEFT JOIN branches b ON b.id=pr.branch_id LEFT JOIN warehouses w ON w.id=pr.warehouse_id LEFT JOIN cost_centers cc ON cc.id=pr.cost_center_id LEFT JOIN cost_items ci ON ci.id=pr.cost_item_id WHERE pr.id=$1`, [prId]);
    res.status(201).json(details.rows[0]);
  } catch (err: any) {
    await client.query('ROLLBACK').catch(()=>{});

    // Concurrent double-clicks can race before either transaction commits. The unique
    // idempotency index makes one insert win; the loser returns that same saved request.
    if (idempotencyKey && err?.code === '23505') {
      try {
        const existing = await pool.query(`
          SELECT pr.*, b.name branch_name, w.name warehouse_name, cc.name cost_center_name, ci.name cost_item_name
          FROM purchase_requests pr
          LEFT JOIN branches b ON b.id=pr.branch_id
          LEFT JOIN warehouses w ON w.id=pr.warehouse_id
          LEFT JOIN cost_centers cc ON cc.id=pr.cost_center_id
          LEFT JOIN cost_items ci ON ci.id=pr.cost_item_id
          WHERE pr.idempotency_key=$1
          LIMIT 1
        `, [idempotencyKey]);
        if (existing.rows.length) return res.status(200).json(existing.rows[0]);
      } catch (_) { /* fall through to the original error */ }
    }
    // BUG-ERP-011: honour the status carried by a business validation error
    // instead of masking every failure as 500.
    if (err instanceof PurchaseValidationError || typeof err?.statusCode === "number") {
      const code = err.statusCode || 422;
      return res.status(code).json({
        success: false,
        error: err.error || "VALIDATION_ERROR",
        message: err.message || "Invalid purchase request payload",
      });
    }
    console.error("POST /api/purchase-requests failed:", err);
    res.status(500).json({ error: err.message || 'Failed to create purchase request' });
  } finally { client.release(); }
});

router.post("/api/purchase-requests/:id/attachments", (purchaseRequestUpload.array('files', 10) as any), async (req: Request, res: Response) => {
  try {
    const requestId = Number(req.params.id);
    const exists = await pool.query('SELECT 1 FROM purchase_requests WHERE id=$1', [requestId]);
    if (!exists.rows.length) return res.status(404).json({error:'Purchase request not found'});
    const files = (req.files || []) as any[];
    if (!files.length) return res.status(400).json({error:'لم يتم اختيار ملفات'});
    const createdBy = String(req.body.created_by || 'system');
    const saved:any[]=[];
    for (const file of files) {
      const r = await pool.query(`INSERT INTO purchase_request_attachments (purchase_request_id,file_name,mime_type,file_size,file_data,created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,file_name,mime_type,file_size,created_by,created_at`, [requestId,file.originalname,file.mimetype,file.size,file.buffer,createdBy]);
      saved.push(r.rows[0]);
    }
    await logPurchaseActivity('purchase_request', requestId, 'attachment_added', {count:saved.length}, createdBy);
    res.status(201).json(saved);
  } catch (err:any) { res.status(500).json({error: err.message || 'Failed to upload attachments'}); }
});

router.put("/api/purchase-requests/:id", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const id = Number(req.params.id);
    const current = await client.query('SELECT * FROM purchase_requests WHERE id=$1 FOR UPDATE', [id]);
    if (!current.rows.length) return res.status(404).json({error:'Purchase request not found'});
    if (current.rows[0].purchase_order_id) return res.status(400).json({error:'لا يمكن تعديل طلب مرتبط بأمر شراء'});
    const b=req.body;
    await client.query('BEGIN');
    const result=await client.query(`UPDATE purchase_requests SET requested_by=COALESCE($1,requested_by),notes=COALESCE($2,notes),branch_id=COALESCE($3,branch_id),warehouse_id=COALESCE($4,warehouse_id),department=COALESCE($5,department),required_date=COALESCE($6,required_date),priority=COALESCE($7,priority),reason=COALESCE($8,reason),justification=COALESCE($9,justification),cost_center_id=COALESCE($10,cost_center_id),cost_item_id=COALESCE($11,cost_item_id),currency=COALESCE($12,currency),status=COALESCE($13,status),updated_at=CURRENT_TIMESTAMP WHERE id=$14 RETURNING *`, [b.requested_by,b.notes,b.branch_id?Number(b.branch_id):null,b.warehouse_id?Number(b.warehouse_id):null,b.department,b.required_date,b.priority,b.reason,b.justification,b.cost_center_id?Number(b.cost_center_id):null,b.cost_item_id?Number(b.cost_item_id):null,b.currency,b.status,id]);
    if (Array.isArray(b.items)) {
      await client.query('DELETE FROM purchase_request_items WHERE purchase_request_id=$1',[id]);
      let estimatedTotal=0;
      for (const raw of b.items) {
        const rawId=raw.ingredient_id!=null?String(raw.ingredient_id):'';
        const itemType=raw.item_type || (raw.product_id || rawId.startsWith('p_') ? 'product':'ingredient');
        const ingredientId=itemType==='ingredient' && /^\d+$/.test(rawId) ? Number(rawId):null;
        const productId=itemType==='product' ? Number(raw.product_id || (rawId.startsWith('p_')?rawId.slice(2):rawId)) || null:null;
        const master=ingredientId ? (await client.query('SELECT id,name,unit,cost,item_code,min_stock,max_stock,current_stock FROM ingredients WHERE id=$1',[ingredientId])).rows[0] : productId ? (await client.query('SELECT id,name,price cost,barcode item_code FROM products WHERE id=$1',[productId])).rows[0] : null;
        if(!master) throw new Error(`الصنف غير موجود: ${raw.name||raw.item_code||rawId}`);
        const qty=Number(raw.quantity); if(!Number.isFinite(qty)||qty<=0) throw new Error(`الكمية غير صحيحة للصنف ${master.name}`);
        const price=Number(raw.unit_price ?? master.cost ?? 0)||0;
        let stock=0,min=0,max=0;
        if(ingredientId){const sq=await client.query(`SELECT COALESCE(SUM(quantity),0) stock FROM inventory_items WHERE ingredient_id=$1 ${b.warehouse_id?'AND warehouse_id=$2':''}`,b.warehouse_id?[ingredientId,Number(b.warehouse_id)]:[ingredientId]);stock=Number(sq.rows[0]?.stock||master.current_stock||0);min=Number(master.min_stock||0);max=Number(master.max_stock||0);}
        const total=qty*price;estimatedTotal+=total;
        await client.query(`INSERT INTO purchase_request_items (purchase_request_id,ingredient_id,product_id,item_type,item_code,name,unit,quantity,unit_price,stock_on_hand,min_stock,max_stock,suggested_quantity,total_price,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,[id,ingredientId,productId,itemType,raw.item_code||master.item_code||null,raw.name||master.name,raw.unit||master.unit||'قطعة',qty,price,stock,min,max,Number(raw.suggested_quantity||Math.max(max>stock?max-stock:min-stock,0)),total,raw.notes||null]);
      }
      await client.query('UPDATE purchase_requests SET estimated_total=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2',[estimatedTotal,id]);
    }
    await client.query('COMMIT');
    await logPurchaseActivity('purchase_request',id,'updated',{fields:Object.keys(b),items_replaced:Array.isArray(b.items)},b.created_by || b.requested_by || current.rows[0].created_by);
    res.json(result.rows[0]);
  } catch(err:any){await client.query('ROLLBACK').catch(()=>{});res.status(500).json({error:err.message});} finally{client.release();}
});

router.delete("/api/purchase-requests/:id", async (req: Request, res: Response) => {
  try {
    const id=Number(req.params.id);
    const r=await pool.query(`DELETE FROM purchase_requests WHERE id=$1 AND LOWER(COALESCE(status,'draft')) NOT IN ('approved','completed') AND purchase_order_id IS NULL RETURNING id,request_number,status`,[id]);
    if(!r.rows.length)return res.status(400).json({error:'لا يمكن حذف طلب شراء معتمد/مكتمل أو مرتبط بأمر شراء'});
    await logPurchaseActivity('purchase_request',id,'deleted',{request_number:r.rows[0].request_number},req.body?.created_by);
    res.json({success:true});
  } catch(err:any){res.status(500).json({error:err.message});}
});

router.post("/api/purchase-requests/:id/cancel", async (req: Request, res: Response) => {
  try {
    const r=await pool.query(`UPDATE purchase_requests SET status='Cancelled',cancelled_at=CURRENT_TIMESTAMP,cancellation_reason=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND COALESCE(status,'Draft') NOT IN ('Cancelled','Approved') RETURNING *`,[req.body?.reason||null,Number(req.params.id)]);
    if(!r.rows.length)return res.status(400).json({error:'لا يمكن إلغاء طلب الشراء في حالته الحالية'});
    await logPurchaseActivity('purchase_request',Number(req.params.id),'cancelled',{reason:req.body?.reason||null},req.body?.created_by);
    res.json(r.rows[0]);
  } catch(err:any){res.status(500).json({error:err.message});}
});

// Existing legacy conversion endpoint is intentionally kept intact for compatibility.
router.post("/api/purchase-requests/:id/approve", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const requestId = Number(req.params.id);
    const { supplier_id, delivery_date, notes, approved_by, tax_rate: rawTaxRate, tax_amount: rawTaxAmount } = req.body;
    if (!supplier_id) return res.status(400).json({ error: "supplier_id is required to create the purchase order" });
    await client.query("BEGIN");
    const pr = await client.query(`SELECT * FROM purchase_requests WHERE id=$1 FOR UPDATE`, [requestId]);
    if (!pr.rows[0]) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Purchase request not found" }); }
    if (pr.rows[0].purchase_order_id) {
      const existing = await client.query(`SELECT * FROM purchase_orders WHERE id=$1`, [pr.rows[0].purchase_order_id]);
      await client.query("ROLLBACK");
      return res.json({ ...pr.rows[0], purchase_order: existing.rows[0] || null, already_converted: true });
    }
    if (String(pr.rows[0].status).toLowerCase() === 'rejected') { await client.query("ROLLBACK"); return res.status(400).json({ error: "Rejected purchase request cannot be approved" }); }
    const items = await client.query(`SELECT * FROM purchase_request_items WHERE purchase_request_id=$1 ORDER BY id`, [requestId]);
    if (!items.rows.length) { await client.query("ROLLBACK"); return res.status(400).json({ error: "Purchase request has no items" }); }
    const subtotal = Math.round(items.rows.reduce((sum:any, i:any) => sum + Number(i.quantity||0) * Number(i.unit_price||0), 0) * 100) / 100;
    const taxRate = Math.max(0, Number(rawTaxRate || 0));
    const taxAmount = rawTaxAmount !== undefined && rawTaxAmount !== "" && rawTaxAmount !== null
      ? Math.max(0, Number(rawTaxAmount) || 0)
      : Math.round((subtotal * (taxRate / 100)) * 100) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;
    const po = await client.query(
      `INSERT INTO purchase_orders (supplier_id,delivery_date,status,subtotal,tax_rate,tax_amount,total_amount,notes,requested_by,currency,purchase_request_id,branch_id,cost_center_id)
       VALUES ($1,$2,'approved',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [Number(supplier_id), delivery_date || null, subtotal, taxRate, taxAmount, total, notes || pr.rows[0].notes || `من طلب الشراء #${requestId}`, pr.rows[0].requested_by || null, pr.rows[0].currency || 'EGP', requestId, pr.rows[0].branch_id || null, pr.rows[0].cost_center_id || null]
    );
    const poId = po.rows[0].id;
    await client.query(`UPDATE purchase_orders SET order_number='PO-' || TO_CHAR(CURRENT_DATE,'YYYYMMDD') || '-' || LPAD(id::text,6,'0') WHERE id=$1`, [poId]);
    for (const item of items.rows) {
      const lineNet = Number(item.quantity||0) * Number(item.unit_price||0);
      const itemTaxAmt = Math.round((lineNet * (taxRate / 100)) * 100) / 100;
      await client.query(`INSERT INTO purchase_order_items (purchase_order_id,ingredient_id,product_id,item_code,unit,quantity,unit_price,tax_rate,tax_amount,total_price) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [poId, item.ingredient_id ? Number(item.ingredient_id) : null, item.product_id ? Number(item.product_id) : null, item.item_code || null, item.unit || null, Number(item.quantity||0), Number(item.unit_price||0), taxRate, itemTaxAmt, lineNet]);
    }
    const updated = await client.query(`UPDATE purchase_requests SET status='Approved', purchase_order_id=$1, approved_by=$2, approved_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=$3 RETURNING *`, [poId, approved_by || 'admin', requestId]);
    await client.query("COMMIT");
    await logPurchaseActivity('purchase_request',requestId,'converted_to_order',{purchase_order_id:poId, tax_amount: taxAmount, total_amount: total},approved_by || 'admin');
    const poDetails = await pool.query(`SELECT po.*,s.name supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id WHERE po.id=$1`, [poId]);
    res.json({ ...updated.rows[0], purchase_order: { ...poDetails.rows[0], items: items.rows } });
  } catch (err:any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message || "Failed to approve purchase request" });
  } finally { client.release(); }
});

// ═══════════════════════════════════════
// PURCHASES V1 API
// ═══════════════════════════════════════
router.get("/api/purchases", async (req: Request, res: Response) => {
  try {
    const { supplier_id, warehouse_id, status } = req.query;
    let query = `
      SELECT p.*, s.name as supplier_name, w.name as warehouse_name, po.order_number as purchase_order_number,
        COALESCE((SELECT SUM(pr.total_amount) FROM purchase_returns pr WHERE pr.purchase_id = p.id AND pr.status = 'approved'), 0) AS returned_amount,
        COALESCE((SELECT SUM(pr.total_quantity) FROM purchase_returns pr WHERE pr.purchase_id = p.id AND pr.status = 'approved'), 0) AS returned_quantity,
        p.total_amount - COALESCE((SELECT SUM(pr.total_amount) FROM purchase_returns pr WHERE pr.purchase_id = p.id AND pr.status = 'approved'), 0) AS net_total
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN warehouses w ON p.warehouse_id = w.id
      LEFT JOIN purchase_orders po ON po.id = p.purchase_order_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;
    if (supplier_id) { query += ` AND p.supplier_id = $${idx}`; params.push(supplier_id); idx++; }
    if (warehouse_id) { query += ` AND p.warehouse_id = $${idx}`; params.push(warehouse_id); idx++; }
    if (status) { query += ` AND p.status = $${idx}`; params.push(status); idx++; }
    query += " ORDER BY p.date DESC";
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/api/purchases/dashboard", async (_req: Request, res: Response) => {
  try {
    const [kpi, orders, overdue, receiving, matching] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(p.total_amount) FILTER (WHERE p.date::date >= date_trunc('month',CURRENT_DATE)::date),0) month_purchases,
        COALESCE(SUM(GREATEST(p.total_amount-COALESCE(p.paid_amount,0),0)),0) outstanding,
        COALESCE(SUM(p.total_amount) FILTER (WHERE p.date::date >= CURRENT_DATE-30),0) purchases_30d,
        COUNT(*) FILTER (WHERE p.payment_status <> 'paid') unpaid_invoices,
        COUNT(*) FILTER (WHERE COALESCE(p.matching_status,'pending') IN ('pending','exception')) matching_exceptions FROM purchases p`),
      pool.query(`SELECT COUNT(*) FILTER (WHERE status IN ('pending_approval','pending','approved','partially_received')) open_orders,
        COALESCE(SUM(total_amount) FILTER (WHERE status IN ('pending_approval','pending','approved','partially_received')),0) open_order_value FROM purchase_orders`),
      pool.query(`SELECT COUNT(*) overdue_invoices,COALESCE(SUM(GREATEST(total_amount-COALESCE(paid_amount,0),0)),0) overdue_amount FROM purchases WHERE COALESCE(due_date,date::date)<CURRENT_DATE AND total_amount>COALESCE(paid_amount,0)`),
      pool.query(`SELECT COUNT(*) pending_receipts,COALESCE(SUM((SELECT COALESCE(SUM(rejected_qty),0) FROM goods_receipt_items WHERE goods_receipt_id=gr.id)),0) rejected_quantity FROM goods_receipts gr WHERE gr.status IN ('draft','submitted','qc_pending','qc_approved','warehouse_approved')`),
      pool.query(`SELECT COALESCE(matching_status,'pending') matching_status,COUNT(*) count,COALESCE(SUM(total_amount),0) amount FROM purchases GROUP BY COALESCE(matching_status,'pending') ORDER BY count DESC`)
    ]);
    res.json({success:true,kpis:{...kpi.rows[0],...orders.rows[0],...overdue.rows[0],...receiving.rows[0]},matching:matching.rows});
  } catch(e:any) { res.status(500).json({error:e.message}); }
});

router.get("/api/purchases/:id", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT p.*, s.name as supplier_name, w.name as warehouse_name 
       FROM purchases p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       LEFT JOIN warehouses w ON p.warehouse_id = w.id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Purchase not found" });
    const purchase = result.rows[0];
    const items = await pool.query(
      `SELECT pi.*, COALESCE(i.name, pi.item_code) as ingredient_name, COALESCE(i.unit, pi.unit, 'قطعة') as unit 
       FROM purchase_items pi
       LEFT JOIN ingredients i ON pi.ingredient_id = i.id
       WHERE pi.purchase_id = $1`,
      [req.params.id]
    );

    // Enrich items with current and available stock in the invoice's warehouse
    const enrichedItems = [];
    for (const item of items.rows) {
      const ingId = item.ingredient_id || item.product_id;
      let stockQty = 0;
      let availableQty = 0;
      if (purchase.warehouse_id && ingId) {
        const stockRes = await pool.query(
          `SELECT quantity, reserved, available,
                  GREATEST(COALESCE(quantity, 0) - COALESCE(reserved, 0), 0) AS derived_available
             FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2`,
          [purchase.warehouse_id, ingId]
        );
        if (stockRes.rows.length > 0) {
          stockQty = Number(stockRes.rows[0].quantity || 0);
          // `available` is a cached column and can be stale if a stock writer forgot
          // to refresh it. quantity - reserved is always the authoritative value.
          availableQty = Number(stockRes.rows[0].derived_available ?? 0);
        }
      }
      enrichedItems.push({
        ...item,
        current_warehouse_stock: stockQty,
        available_warehouse_stock: availableQty,
      });
    }

    // المرتجعات المرتبطة بهذه الفاتورة — تظهر داخل تفاصيل الفاتورة مباشرة
    const returnsRes = await pool.query(
      `SELECT id, return_number, status, return_date, total_quantity, total_amount, stock_posted, created_at
         FROM purchase_returns WHERE purchase_id = $1 ORDER BY id DESC`,
      [req.params.id]
    );
    const approvedReturns = returnsRes.rows.filter((r: any) => r.status === "approved");
    const returnedAmount = approvedReturns.reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0);
    const returnedQuantity = approvedReturns.reduce((s: number, r: any) => s + Number(r.total_quantity || 0), 0);
    const invoiceTotal = Number(purchase.total_amount || 0);

    res.json({
      ...purchase,
      items: enrichedItems,
      returns: returnsRes.rows,
      returned_amount: returnedAmount,
      returned_quantity: returnedQuantity,
      net_total: invoiceTotal - returnedAmount
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/api/purchases", async (req: Request, res: Response) => {
  try {
    const payload = { ...req.body, purchase_order_id: req.body.purchase_order_id || req.body.order_id || null };
    if (!payload.supplier_id || !payload.warehouse_id || !Array.isArray(payload.items) || payload.items.length === 0) {
      return res.status(400).json({ error: "supplier_id, warehouse_id, and items are required" });
    }
    const service = new PurchaseService();
    const purchase = await service.createPurchase(payload);
    res.status(201).json(purchase);
  } catch (err: any) {
    console.error("Unified purchase create error:", err);
    res.status(500).json({ error: err.message || "Failed to record purchase" });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// PURCHASES ENTERPRISE API
// ═══════════════════════════════════════════════════════════════════════

router.get("/api/purchase-receipts", async (req: Request, res: Response) => {
  try {
    const { purchase_order_id, supplier_id, status } = req.query; const params:any[]=[]; let where='WHERE 1=1'; let i=1;
    if(purchase_order_id){where+=` AND gr.purchase_order_id=$${i++}`;params.push(purchase_order_id)}
    if(supplier_id){where+=` AND gr.supplier_id=$${i++}`;params.push(supplier_id)}
    if(status){where+=` AND gr.status=$${i++}`;params.push(status)}
    const r=await pool.query(`SELECT gr.*, gr.receipt_no AS receipt_number, po.order_number, s.name supplier_name, w.name warehouse_name,
      (SELECT COALESCE(SUM(gri.received_qty),0) FROM goods_receipt_items gri WHERE gri.goods_receipt_id=gr.id) total_quantity,
      (SELECT COALESCE(SUM(gri.accepted_qty),0) FROM goods_receipt_items gri WHERE gri.goods_receipt_id=gr.id) accepted_quantity,
      (SELECT COALESCE(SUM(gri.rejected_qty),0) FROM goods_receipt_items gri WHERE gri.goods_receipt_id=gr.id) rejected_quantity
      FROM goods_receipts gr LEFT JOIN purchase_orders po ON po.id=gr.purchase_order_id LEFT JOIN suppliers s ON s.id=gr.supplier_id LEFT JOIN warehouses w ON w.id=gr.warehouse_id ${where} ORDER BY gr.date DESC,gr.id DESC`,params);
    res.json(r.rows);
  } catch(e:any){res.status(500).json({error:e.message});}
});

router.get("/api/purchase-orders/:id/receivable", async (req: Request,res: Response)=>{
  try{ const r=await pool.query(`SELECT poi.id,poi.purchase_order_id,poi.ingredient_id,poi.product_id,COALESCE(i.name,p.name) ingredient_name,COALESCE(i.unit,poi.unit,'قطعة') unit,poi.quantity ordered_quantity,COALESCE(poi.received_quantity,0) received_quantity,GREATEST(poi.quantity-COALESCE(poi.received_quantity,0),0) remaining_quantity,poi.unit_price,poi.expiry_date,poi.batch_number FROM purchase_order_items poi LEFT JOIN ingredients i ON i.id=poi.ingredient_id LEFT JOIN products p ON p.id=poi.product_id WHERE poi.purchase_order_id=$1 ORDER BY poi.id`,[req.params.id]); res.json(r.rows); }
  catch(e:any){res.status(500).json({error:e.message});}
});

router.post("/api/purchase-receipts", async (req: Request,res: Response)=>{
  const client=await pool.connect();
  const idempotencyKey = String(req.get("Idempotency-Key") || req.body?.idempotency_key || "").trim() || null;
  try{
    const {purchase_order_id,supplier_id,warehouse_id,receipt_date,notes,created_by,items,tax_amount,tax_rate,discount_amount,shipping_amount}=req.body;
    if(!warehouse_id || !Array.isArray(items) || !items.length) return res.status(400).json({error:'warehouse_id and items are required'});
    await client.query('BEGIN');
    let order:any=null;
    if(purchase_order_id){
      const q=await client.query('SELECT * FROM purchase_orders WHERE id=$1 FOR UPDATE',[purchase_order_id]);
      if(!q.rows.length) throw new Error('Purchase order not found');
      order=q.rows[0];
    }
    const supplierId=Number(supplier_id||order?.supplier_id||0)||null;
    const receipt = await createPostedGoodsReceiptForPurchase(client, {
      supplier_id: supplierId, warehouse_id: Number(warehouse_id), purchase_order_id: purchase_order_id || null,
      supplier_invoice_no: null, invoice_number: null, idempotency_key: idempotencyKey, currency: 'EGP', created_by, notes: notes || null,
      tax_amount: Number(tax_amount || 0), tax_rate: Number(tax_rate || 0), discount_amount: Number(discount_amount || 0), shipping_amount: Number(shipping_amount || 0),
      date: receipt_date || new Date().toISOString().split('T')[0]
    }, 0, items.map((raw:any)=>({
      purchase_order_item_id: raw.purchase_order_item_id,
      ingredient_id: raw.ingredient_id,
      received_quantity: Number(raw.received_quantity ?? raw.quantity ?? 0),
      accepted_quantity: Number(raw.accepted_quantity ?? raw.received_quantity ?? raw.quantity ?? 0),
      rejected_quantity: Number(raw.rejected_quantity ?? 0),
      unit_price: Number(raw.unit_price ?? 0),
      ordered_quantity: Number(raw.ordered_quantity ?? 0),
      rejection_reason: raw.rejection_reason || null,
      unit: raw.unit || null,
      expiry_date: raw.expiry_date || null,
      batch_number: raw.batch_number || null,
      location_id: raw.location_id || null
    })), { markInvoiced: false });

    await client.query('COMMIT');
    const gr = await pool.query(`SELECT * FROM goods_receipts WHERE id=$1`, [receipt.id]);
    res.status(201).json({ ...gr.rows[0], id: receipt.id, receipt_number: receipt.receipt_no, canonical_goods_receipt_id: receipt.id, total_quantity: items.reduce((n:any,i:any)=>n+Number(i.received_quantity??i.quantity??0),0), accepted_quantity: items.reduce((n:any,i:any)=>n+Number(i.accepted_quantity??i.received_quantity??i.quantity??0),0), rejected_quantity: items.reduce((n:any,i:any)=>n+Number(i.rejected_quantity??0),0) });
  }catch(e:any){
    await client.query('ROLLBACK').catch(()=>{});
    // If two Save requests arrive concurrently, the unique idempotency index
    // makes the second one reuse the already committed receipt instead of
    // touching stock a second time.
    if (idempotencyKey && e?.code === '23505') {
      try {
        const existing = await pool.query(
          `SELECT gr.*, gr.receipt_no AS receipt_number,
             (SELECT COALESCE(SUM(gri.received_qty),0) FROM goods_receipt_items gri WHERE gri.goods_receipt_id=gr.id) total_quantity,
             (SELECT COALESCE(SUM(gri.accepted_qty),0) FROM goods_receipt_items gri WHERE gri.goods_receipt_id=gr.id) accepted_quantity,
             (SELECT COALESCE(SUM(gri.rejected_qty),0) FROM goods_receipt_items gri WHERE gri.goods_receipt_id=gr.id) rejected_quantity
           FROM goods_receipts gr WHERE gr.idempotency_key=$1 LIMIT 1`,
          [idempotencyKey]
        );
        if (existing.rows[0]) return res.status(200).json(existing.rows[0]);
      } catch (_) { /* fall through to the original error */ }
    }
    console.error('[Purchases Receiving] transaction failed:',e);
    res.status(500).json({error:e?.message||'فشل حفظ الاستلام',detail:e?.detail||null,code:e?.code||null});
  }finally{client.release();}
});

router.get("/api/purchases/:id/three-way-match", async (req: Request,res: Response)=>{
  try{
    const p=await pool.query(`SELECT p.*,po.order_number FROM purchases p LEFT JOIN purchase_orders po ON po.id=p.purchase_order_id WHERE p.id=$1`,[req.params.id]); if(!p.rows.length)return res.status(404).json({error:'Purchase invoice not found'});
    const inv=p.rows[0]; const order=inv.purchase_order_id?await pool.query(`SELECT poi.id,poi.ingredient_id,poi.quantity ordered_quantity,COALESCE(poi.received_quantity,0) received_quantity,poi.unit_price FROM purchase_order_items poi WHERE poi.purchase_order_id=$1`,[inv.purchase_order_id]):{rows:[]};
    const invoiceItems=await pool.query('SELECT * FROM purchase_items WHERE purchase_id=$1',[inv.id]);
    const ordered=order.rows.reduce((s:any,r:any)=>s+Number(r.ordered_quantity||0),0), received=order.rows.reduce((s:any,r:any)=>s+Number(r.received_quantity||0),0), invoiced=invoiceItems.rows.reduce((s:any,r:any)=>s+Number(r.quantity||0),0);
    const orderTotal=order.rows.reduce((s:any,r:any)=>s+Number(r.ordered_quantity||0)*Number(r.unit_price||0),0);
    const invSubtotal = Number(inv.subtotal || (Number(inv.total_amount || 0) - Number(inv.tax_amount || 0)));
    const amountOk=!order.rows.length||Math.abs(invSubtotal-orderTotal)<0.05||Math.abs(Number(inv.total_amount)-orderTotal)<0.05;
    const qtyOk=!order.rows.length||invoiced<=received+0.000001; const status=amountOk&&qtyOk?'matched':'exception';
    await pool.query('UPDATE purchases SET matching_status=$1,updated_at=NOW() WHERE id=$2',[status,inv.id]); res.json({purchase:inv,status,checks:{quantity:{ordered,received,invoiced,ok:qtyOk},amount:{invoice_total:Number(inv.total_amount),invoice_subtotal:invSubtotal,order_total:orderTotal,ok:amountOk}},order_items:order.rows,invoice_items:invoiceItems.rows});
  }catch(e:any){res.status(500).json({error:e.message});}
});

// ═══════════════════════════════════════
// PURCHASE RETURNS V1 API
// ═══════════════════════════════════════
router.get("/api/returns/next-number", (_req: Request, res: Response) => {
  const num = `RET-${Date.now()}`;
  res.json({ number: num, next_number: num });
});

router.get(["/api/returns", "/api/purchase-returns"], async (req: Request, res: Response) => {
  try {
    const { supplier_id, status } = req.query;
    let query = `SELECT pr.*, s.name as supplier_name, p.invoice_number, w.name as warehouse_name 
                 FROM purchase_returns pr 
                 LEFT JOIN suppliers s ON pr.supplier_id = s.id 
                 LEFT JOIN purchases p ON pr.purchase_id = p.id 
                 LEFT JOIN warehouses w ON pr.warehouse_id = w.id 
                 WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;
    if (supplier_id) { query += ` AND pr.supplier_id = $${idx}`; params.push(supplier_id); idx++; }
    if (status) { query += ` AND pr.status = $${idx}`; params.push(status); idx++; }
    query += " ORDER BY COALESCE(pr.return_date, pr.created_at) DESC";
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get(["/api/returns/:id", "/api/purchase-returns/:id"], async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT pr.*, s.name as supplier_name, p.invoice_number, w.name as warehouse_name 
       FROM purchase_returns pr 
       LEFT JOIN suppliers s ON pr.supplier_id = s.id 
       LEFT JOIN purchases p ON pr.purchase_id = p.id 
       LEFT JOIN warehouses w ON pr.warehouse_id = w.id 
       WHERE pr.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Purchase return not found" });
    const ret = result.rows[0];
    const itemsRes = await pool.query(
      `SELECT pri.*, COALESCE(pri.ingredient_name, i.name) as ingredient_name, COALESCE(pri.unit, i.unit, 'قطعة') as unit
       FROM purchase_return_items pri
       LEFT JOIN ingredients i ON pri.ingredient_id = i.id
       WHERE pri.return_id = $1`,
      [req.params.id]
    );
    res.json({ ...ret, items: itemsRes.rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Endpoint to validate available stock for return items before approval
router.post(["/api/returns/validate-stock", "/api/purchase-returns/validate-stock"], async (req: Request, res: Response) => {
  try {
    const { warehouse_id, items } = req.body;
    const whId = Number(warehouse_id);
    if (!whId) return res.status(400).json({ error: "warehouse_id is required" });

    const returnItems = (Array.isArray(items) ? items : []).map((it: any) => ({
      ingredient_id: Number(it.ingredient_id || it.id || 0),
      quantity: Number(it.return_quantity ?? it.quantity ?? 0),
      name: it.ingredient_name || it.name || `صنف #${it.ingredient_id || it.id}`,
      unit: it.unit || "قطعة",
    })).filter((it: any) => it.quantity > 0 && it.ingredient_id > 0);

    const checkResults = [];
    let hasDeficit = false;

    for (const item of returnItems) {
      const stockRes = await pool.query(
        `SELECT id, quantity, reserved,
                GREATEST(COALESCE(quantity, 0) - COALESCE(reserved, 0), 0) AS derived_available
           FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2`,
        [whId, item.ingredient_id]
      );
      const availableQty = stockRes.rows.length > 0
        ? Number(stockRes.rows[0].derived_available ?? 0)
        : 0;

      const isSufficient = availableQty >= item.quantity && availableQty > 0;
      if (!isSufficient) hasDeficit = true;

      checkResults.push({
        ingredient_id: item.ingredient_id,
        name: item.name,
        unit: item.unit,
        requested_quantity: item.quantity,
        available_quantity: availableQty,
        deficit: Math.max(0, item.quantity - availableQty),
        is_sufficient: isSufficient,
        reason: availableQty <= 0
          ? "تم استهلاك أو بيع الصنف بالكامل من المخزن (الرصيد: 0)"
          : `الرصيد المتاح بالمخزن (${availableQty} ${item.unit}) أقل من الكمية المطلوبة (${item.quantity} ${item.unit}) نظراً لاستهلاك أو بيع جزء منه`
      });
    }

    res.json({
      valid: !hasDeficit,
      items: checkResults,
      rejected_count: checkResults.filter(r => !r.is_sufficient).length
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Return-save hardening: one logical save request must create one return only.
(async () => {
  try {
    await pool.query(`ALTER TABLE purchase_returns ADD COLUMN IF NOT EXISTS idempotency_key TEXT`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_purchase_returns_idempotency_key ON purchase_returns(idempotency_key) WHERE idempotency_key IS NOT NULL`);
    await pool.query(`ALTER TABLE purchase_returns ADD COLUMN IF NOT EXISTS subtotal NUMERIC(14,2) DEFAULT 0`);
    await pool.query(`ALTER TABLE purchase_returns ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(7,3) DEFAULT 0`);
    await pool.query(`ALTER TABLE purchase_returns ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(14,2) DEFAULT 0`);
    await pool.query(`ALTER TABLE purchase_return_items ADD COLUMN IF NOT EXISTS subtotal NUMERIC(14,2) DEFAULT 0`);
    await pool.query(`ALTER TABLE purchase_return_items ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(7,3) DEFAULT 0`);
    await pool.query(`ALTER TABLE purchase_return_items ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(14,2) DEFAULT 0`);
  } catch (e) { console.warn("Purchase return idempotency & tax schema guard:", (e as any)?.message || e); }
})();

router.post(["/api/returns", "/api/purchase-returns"], async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { 
      supplier_id, 
      purchase_id, 
      purchase_invoice_id, 
      warehouse_id, 
      total_amount, 
      totals, 
      notes, 
      status = "draft", 
      date, 
      return_date, 
      return_number: custom_return_no,
      idempotency_key,
      items
    } = req.body;

    const actualSupplierId = Number(supplier_id);
    const actualPurchaseId = purchase_id || purchase_invoice_id ? Number(purchase_id || purchase_invoice_id) : null;
    let actualWarehouseId = warehouse_id ? Number(warehouse_id) : null;

    if (!actualSupplierId) {
      return res.status(400).json({ error: "يجب تحديد المورد لإتمام عملية المرتجع" });
    }

    // Resolve warehouse and tax information from original purchase invoice if not provided directly
    let invoiceTaxRate = 0;
    if (actualPurchaseId) {
      const pRes = await client.query(
        "SELECT warehouse_id, supplier_id, subtotal, tax_amount, tax_rate, total_amount FROM purchases WHERE id = $1",
        [actualPurchaseId]
      );
      if (pRes.rows.length > 0) {
        const invRow = pRes.rows[0];
        if (!actualWarehouseId) {
          actualWarehouseId = Number(invRow.warehouse_id || 0);
        }
        if (invRow.tax_rate !== undefined && Number(invRow.tax_rate) > 0) {
          invoiceTaxRate = Number(invRow.tax_rate);
        } else if (Number(invRow.tax_amount || 0) > 0 && Number(invRow.subtotal || 0) > 0) {
          invoiceTaxRate = Math.round((Number(invRow.tax_amount) / Number(invRow.subtotal)) * 10000) / 100;
        } else if (Number(invRow.tax_amount || 0) > 0 && Number(invRow.total_amount || 0) > Number(invRow.tax_amount)) {
          const invSub = Number(invRow.total_amount) - Number(invRow.tax_amount);
          invoiceTaxRate = Math.round((Number(invRow.tax_amount) / invSub) * 10000) / 100;
        }
      }
    }

    const defaultTaxRate = req.body.tax_rate !== undefined && req.body.tax_rate !== null
      ? Number(req.body.tax_rate)
      : (totals?.tax_rate !== undefined ? Number(totals.tax_rate) : invoiceTaxRate);

    const returnItems = (Array.isArray(items) ? items : []).map((it: any) => {
      const returnQty = Number(it.return_quantity ?? it.quantity ?? 0);
      const ingredientId = Number(it.ingredient_id ?? it.id ?? 0);
      const purchaseItemId = it.purchase_item_id || it.id ? Number(it.purchase_item_id || it.id) : null;
      const unitPrice = Number(it.unit_price ?? 0);
      const whId = Number(it.warehouse_id || actualWarehouseId || 0);
      const lineSubtotal = Math.round(returnQty * unitPrice * 100) / 100;
      const itemTaxRate = it.tax_rate !== undefined && it.tax_rate !== null
        ? Number(it.tax_rate)
        : defaultTaxRate;
      const itemTaxAmount = it.tax_amount !== undefined && it.tax_amount !== null
        ? Number(it.tax_amount)
        : Math.round((lineSubtotal * (itemTaxRate / 100)) * 100) / 100;
      const lineTotalPrice = it.total_price !== undefined
        ? Number(it.total_price)
        : Math.round((lineSubtotal + itemTaxAmount) * 100) / 100;

      return {
        ...it,
        return_quantity: returnQty,
        quantity: returnQty,
        ingredient_id: ingredientId,
        purchase_item_id: purchaseItemId,
        unit_price: unitPrice,
        subtotal: lineSubtotal,
        tax_rate: itemTaxRate,
        tax_amount: itemTaxAmount,
        total_price: lineTotalPrice,
        warehouse_id: whId
      };
    }).filter((it: any) => it.return_quantity > 0);

    if (returnItems.length === 0) {
      return res.status(400).json({ error: "يجب تحديد صنف واحد على الأقل وإدخال كمية المرتجع" });
    }

    const computedTotalQuantity = returnItems.reduce((s: number, i: any) => s + i.return_quantity, 0);
    const computedSubtotal = Math.round(returnItems.reduce((s: number, i: any) => s + (i.subtotal || 0), 0) * 100) / 100;
    const computedTaxAmount = Math.round(returnItems.reduce((s: number, i: any) => s + (i.tax_amount || 0), 0) * 100) / 100;
    const computedTotalAmount = Math.round((computedSubtotal + computedTaxAmount) * 100) / 100;

    const actualSubtotal = req.body.subtotal !== undefined
      ? Number(req.body.subtotal)
      : (totals?.subtotal !== undefined ? Number(totals.subtotal) : computedSubtotal);

    const actualTaxAmount = req.body.tax_amount !== undefined
      ? Number(req.body.tax_amount)
      : (totals?.tax_amount !== undefined ? Number(totals.tax_amount) : computedTaxAmount);

    const actualTotalAmount = Number(
      total_amount ?? totals?.amount ?? totals?.total_amount ?? (actualSubtotal + actualTaxAmount)
    );
    const actualTaxRate = actualSubtotal > 0
      ? Math.round((actualTaxAmount / actualSubtotal) * 10000) / 100
      : defaultTaxRate;

    const actualTotalQuantity = Number(req.body.total_quantity ?? totals?.quantity ?? computedTotalQuantity);
    const returnNumber = custom_return_no || `RET-${Date.now()}`;
    const actualReturnDate = date || return_date || new Date().toISOString().split("T")[0];
    const isApproved = status === "approved";

    await client.query("BEGIN");

    // Idempotent save: repeated clicks/retries return the existing record instead of creating another one.
    if (idempotency_key) {
      const existing = await client.query(`SELECT * FROM purchase_returns WHERE idempotency_key = $1 FOR UPDATE`, [String(idempotency_key)]);
      if (existing.rows.length > 0) {
        await client.query("COMMIT");
        return res.status(200).json({ success: true, already_exists: true, stock_deducted: !!existing.rows[0].stock_posted, ...existing.rows[0] });
      }
    }

    // ═══ CRITICAL VALIDATION: REJECT RETURN IF ITEMS CONSUMED, SOLD, OR NOT IN WAREHOUSE ═══
    if (isApproved) {
      const rejectedItems: Array<{
        ingredient_id: number;
        name: string;
        unit: string;
        requested_quantity: number;
        available_quantity: number;
        deficit: number;
        reason: string;
      }> = [];

      for (const item of returnItems) {
        const whId = item.warehouse_id || actualWarehouseId;
        const ingId = item.ingredient_id;
        const requestedQty = item.return_quantity;

        if (!whId) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "المخزن غير محدد للصنف المرتجع" });
        }

        // Fetch stock in the warehouse with row lock
        const stockRes = await client.query(
          `SELECT id, quantity, reserved, available, avg_cost,
                  GREATEST(COALESCE(quantity, 0) - COALESCE(reserved, 0), 0) AS derived_available
             FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2 FOR UPDATE`,
          [whId, ingId]
        );

        // Fetch ingredient name
        const ingRes = await client.query(`SELECT name, unit FROM ingredients WHERE id = $1`, [ingId]);
        const ingName = ingRes.rows[0]?.name || item.ingredient_name || item.name || `صنف #${ingId}`;
        const ingUnit = ingRes.rows[0]?.unit || item.unit || "قطعة";

        if (stockRes.rows.length === 0) {
          // Item has no record in this warehouse at all (zero stock / never stocked or consumed)
          rejectedItems.push({
            ingredient_id: ingId,
            name: ingName,
            unit: ingUnit,
            requested_quantity: requestedQty,
            available_quantity: 0,
            deficit: requestedQty,
            reason: "الصنف غير موجود في رصيد هذا المخزن نهائياً (الرصيد المتاح: 0)"
          });
          continue;
        }

        const stockRow = stockRes.rows[0];
        const availableQty = Number(stockRow.derived_available ?? 0);
        // Self-heal a stale cached `available` column so inventory screens and
        // future checks agree with the authoritative balance.
        if (Number(stockRow.available ?? -1) !== availableQty) {
          await client.query(`UPDATE inventory_items SET available = $1 WHERE id = $2`, [availableQty, stockRow.id]);
        }

        // Check if available stock is zero or less than requested return quantity
        if (availableQty <= 0) {
          rejectedItems.push({
            ingredient_id: ingId,
            name: ingName,
            unit: ingUnit,
            requested_quantity: requestedQty,
            available_quantity: 0,
            deficit: requestedQty,
            reason: "تم استهلاك أو بيع كامل كمية الصنف من المخزن (الرصيد المتاح: 0)"
          });
        } else if (availableQty < requestedQty) {
          rejectedItems.push({
            ingredient_id: ingId,
            name: ingName,
            unit: ingUnit,
            requested_quantity: requestedQty,
            available_quantity: availableQty,
            deficit: requestedQty - availableQty,
            reason: `الرصيد المتاح بالمخزن (${availableQty} ${ingUnit}) غير كافٍ لإرجاع الكمية المطلوبة (${requestedQty} ${ingUnit}) نظراً لاستهلاك أو بيع جزء من الصنف`
          });
        }
      }

      // If any items are missing, consumed, or sold, REJECT THE RETURN AND ROLLBACK
      if (rejectedItems.length > 0) {
        await client.query("ROLLBACK");
        const detailsMsg = rejectedItems
          .map(r => `• ${r.name}: المطلوب إرجاعه (${r.requested_quantity} ${r.unit}) بينما المتاح بالمخزن (${r.available_quantity} ${r.unit}) - ${r.reason}`)
          .join("\n");

        return res.status(400).json({
          success: false,
          rejected: true,
          error: "تم رفض اعتماد المرتجع لعدم كفاية الرصيد بالمخزن",
          message: `تم رفض اعتماد المرتجع: تعذر إرجاع الأصناف نظراً لاستهلاكها أو بيعها أو عدم توفر الرصيد الكافي بالمخزن:\n${detailsMsg}`,
          rejected_items: rejectedItems
        });
      }
    }

    // Prevent returning more than the quantity actually received, minus quantities already returned.
    if (actualPurchaseId) {
      for (const item of returnItems) {
        if (!item.ingredient_id) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "الصنف المرتجع غير مرتبط بصنف صحيح في الفاتورة" });
        }
        const receivedRes = await client.query(
          `SELECT COALESCE(SUM(quantity),0) AS received_qty
             FROM purchase_items WHERE purchase_id = $1 AND ingredient_id = $2`,
          [actualPurchaseId, item.ingredient_id]
        );
        const returnedRes = await client.query(
          `SELECT COALESCE(SUM(pri.quantity),0) AS returned_qty
             FROM purchase_return_items pri
             JOIN purchase_returns pr ON pr.id = pri.return_id
            WHERE pr.purchase_id = $1 AND pri.ingredient_id = $2 AND pr.status = 'approved'`,
          [actualPurchaseId, item.ingredient_id]
        );
        const receivedQty = Number(receivedRes.rows[0]?.received_qty || 0);
        const returnedQty = Number(returnedRes.rows[0]?.returned_qty || 0);
        const remainingQty = Math.max(0, receivedQty - returnedQty);
        if (item.return_quantity > remainingQty + 0.000001) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            success: false, rejected: true,
            error: "كمية المرتجع تتجاوز الكمية المتاحة للإرجاع من الفاتورة",
            message: `الصنف ${item.ingredient_name || item.name || item.ingredient_id}: الكمية المتاحة للإرجاع ${remainingQty} بينما المطلوب ${item.return_quantity}.`
          });
        }
      }
    }

    // ═══ INSERT PURCHASE RETURN RECORD ═══
    const retResult = await client.query(
      `INSERT INTO purchase_returns (
        return_number, idempotency_key, supplier_id, purchase_id, warehouse_id,
        return_date, status, notes, total_quantity, total_amount, stock_posted,
        subtotal, tax_rate, tax_amount
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [
        returnNumber,
        idempotency_key ? String(idempotency_key) : null,
        actualSupplierId, 
        actualPurchaseId, 
        actualWarehouseId, 
        actualReturnDate, 
        status, 
        notes || null, 
        actualTotalQuantity, 
        actualTotalAmount, 
        isApproved,
        actualSubtotal,
        actualTaxRate,
        actualTaxAmount
      ]
    );
    const returnId = retResult.rows[0].id;

    // ═══ INSERT RETURN ITEMS RECORD ═══
    for (const item of returnItems) {
      await client.query(
        `INSERT INTO purchase_return_items (
          return_id, purchase_item_id, ingredient_id, ingredient_name,
          unit, quantity, unit_price, reason, notes, total_price,
          subtotal, tax_rate, tax_amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          returnId,
          item.purchase_item_id || null,
          item.ingredient_id,
          item.ingredient_name || item.name || null,
          item.unit || "قطعة",
          item.return_quantity,
          item.unit_price,
          item.reason || null,
          item.notes || null,
          item.total_price,
          item.subtotal || Math.round(item.return_quantity * item.unit_price * 100) / 100,
          item.tax_rate || 0,
          item.tax_amount || 0
        ]
      );
    }

    // ═══ IF APPROVED: DEDUCT WAREHOUSE STOCK & UPDATE SUPPLIER BALANCE ═══
    if (isApproved) {
      // Update supplier balance (reduce debt owed to supplier including tax)
      await client.query(
        `UPDATE suppliers SET balance = GREATEST(0, balance - $1) WHERE id = $2`,
        [actualTotalAmount, actualSupplierId]
      );

      // Log supplier sub-ledger transaction (gross amount including tax)
      const txnNote = actualTaxAmount > 0
        ? `${notes || `مرتجع شراء ${returnNumber}`} (صافي: ${actualSubtotal} + ضريبة: ${actualTaxAmount} = إجمالي: ${actualTotalAmount})`
        : (notes || `مرتجع شراء ${returnNumber}`);

      await client.query(
        `INSERT INTO supplier_transactions (
          supplier_id, type, amount, notes, reference_id, reference_type, status
        ) VALUES ($1, 'return', $2, $3, $4, 'purchase_return', 'posted')`,
        [actualSupplierId, actualTotalAmount, txnNote, returnId]
      );

      // Deduct warehouse stock and record movements
      for (const item of returnItems) {
        const whId = item.warehouse_id || actualWarehouseId;
        const ingId = item.ingredient_id;
        const qty = item.return_quantity;

        const stockRes = await client.query(
          `SELECT id, quantity, available, avg_cost FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2 FOR UPDATE`,
          [whId, ingId]
        );

        const before = Number(stockRes.rows[0]?.quantity || 0);
        const after = Math.max(0, before - qty);
        const unitCost = Number(item.unit_price || stockRes.rows[0]?.avg_cost || 0);

        if (stockRes.rows[0]) {
          await client.query(
            `UPDATE inventory_items 
             SET quantity = $1, available = GREATEST($1 - COALESCE(reserved, 0), 0), updated_at = CURRENT_TIMESTAMP 
             WHERE id = $2`,
            [after, stockRes.rows[0].id]
          );
        }

        // Keep ingredient total stock synced
        await client.query(
          `UPDATE ingredients SET current_stock = GREATEST(0, COALESCE(current_stock, 0) - $1) WHERE id = $2`,
          [qty, ingId]
        );

        // Inventory ledger transaction
        await client.query(
          `INSERT INTO inventory_transactions (
            transaction_number, warehouse_id, ingredient_id, quantity, type,
            unit_cost, total_cost, balance_before, balance_after, reference_type,
            reference_id, reference_no, status, notes, date
          ) VALUES ($1, $2, $3, $4, 'return', $5, $6, $7, $8, 'purchase_return', $9, $10, 'posted', $11, CURRENT_DATE)`,
          [
            `TXN-RET-${returnId}-${ingId}`,
            whId,
            ingId,
            -qty,
            unitCost,
            -qty * unitCost,
            before,
            after,
            returnId,
            returnNumber,
            `مرتجع شراء ${returnNumber}`
          ]
        );

        // Inventory audit movement
        await client.query(
          `INSERT INTO inventory_movements (
            warehouse_id, ingredient_id, field, before_qty, delta, after_qty,
            ref_type, ref_id, "user", notes, created_at
          ) VALUES ($1, $2, 'quantity', $3, $4, $5, 'purchase_return', $6, 'system', $7, CURRENT_TIMESTAMP)`,
          [whId, ingId, before, -qty, after, returnId, `مرتجع شراء ${returnNumber}`]
        );
      }
    }

    await client.query("COMMIT");

    if (isApproved) {
      try {
        await postPurchaseReturnEntry({
          id: returnId,
          return_number: returnNumber,
          total: actualTotalAmount,
          subtotal: actualSubtotal,
          tax_amount: actualTaxAmount,
          tax_rate: actualTaxRate,
          supplier_id: actualSupplierId,
          warehouse_id: actualWarehouseId ? Number(actualWarehouseId) : undefined
        });
      } catch (glErr: any) {
        console.warn("[GL Integration] Purchase return posting note:", glErr.message);
      }

      try {
        await recordPurchaseReturnCost(returnId);
      } catch (cstErr: any) {
        console.warn("[Cost Integration] Purchase return cost note:", cstErr.message);
      }

      try {
        ERPEventBus.getInstance().emitEvent("PurchaseReturnApproved", {
          id: returnId,
          return_number: returnNumber,
          supplier_id: actualSupplierId,
          total_amount: actualTotalAmount,
          warehouse_id: actualWarehouseId,
          items: returnItems
        });
      } catch (_) {}
    }

    res.status(201).json({
      success: true,
      stock_deducted: isApproved,
      message: isApproved ? "تم اعتماد المرتجع وخصم الأصناف من المخزن بنجاح" : "تم حفظ مسودة المرتجع بنجاح",
      ...retResult.rows[0]
    });
  } catch (err: any) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.put(["/api/returns/:id", "/api/purchase-returns/:id"], async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { status, notes } = req.body;
    const returnId = Number(req.params.id);

    await client.query("BEGIN");
    const existingRes = await client.query("SELECT * FROM purchase_returns WHERE id = $1 FOR UPDATE", [returnId]);
    if (existingRes.rows.length === 0) {
      await client.query("ROLLBACK");
      client.release();
      return res.status(404).json({ error: "Purchase return not found" });
    }

    const ret = existingRes.rows[0];

    // Idempotent approval: a second click must never deduct stock twice.
    if (status === "approved" && ret.stock_posted) {
      await client.query("COMMIT");
      client.release();
      return res.json({ success: true, already_approved: true, stock_deducted: true, ...ret });
    }

    // If changing status to 'approved' and stock not yet posted, validate stock and deduct
    if (status === "approved" && !ret.stock_posted) {

      // Fetch items for this return
      const itemsRes = await client.query("SELECT * FROM purchase_return_items WHERE return_id = $1", [returnId]);
      const returnItems = itemsRes.rows;

      if (returnItems.length === 0) {
        await client.query("ROLLBACK");
        client.release();
        return res.status(400).json({ error: "لا توجد أصناف في هذا المرتجع لاعتمادها" });
      }

      // Verify that the return does not exceed the received quantity after previous approved returns.
      if (ret.purchase_id) {
        for (const item of returnItems) {
          const receivedRes = await client.query(
            `SELECT COALESCE(SUM(quantity),0) AS received_qty FROM purchase_items WHERE purchase_id = $1 AND ingredient_id = $2`,
            [ret.purchase_id, item.ingredient_id]
          );
          const returnedRes = await client.query(
            `SELECT COALESCE(SUM(pri.quantity),0) AS returned_qty
               FROM purchase_return_items pri
               JOIN purchase_returns pr ON pr.id = pri.return_id
              WHERE pr.purchase_id = $1 AND pri.ingredient_id = $2 AND pr.status = 'approved' AND pr.id <> $3`,
            [ret.purchase_id, item.ingredient_id, returnId]
          );
          const remainingQty = Math.max(0, Number(receivedRes.rows[0]?.received_qty || 0) - Number(returnedRes.rows[0]?.returned_qty || 0));
          if (Number(item.quantity) > remainingQty + 0.000001) {
            await client.query("ROLLBACK");
            client.release();
            return res.status(400).json({
              success: false, rejected: true,
              error: "كمية المرتجع تتجاوز الكمية المتاحة للإرجاع من الفاتورة",
              message: `الصنف ${item.ingredient_name || item.ingredient_id}: الكمية المتاحة للإرجاع ${remainingQty} بينما المطلوب ${item.quantity}.`
            });
          }
        }
      }

      const whId = Number(ret.warehouse_id);
      const rejectedItems: Array<{
        ingredient_id: number;
        name: string;
        unit: string;
        requested_quantity: number;
        available_quantity: number;
        deficit: number;
        reason: string;
      }> = [];

      for (const item of returnItems) {
        const ingId = Number(item.ingredient_id);
        const requestedQty = Number(item.quantity);

        const stockRes = await client.query(
          `SELECT id, quantity, reserved, available, avg_cost,
                  GREATEST(COALESCE(quantity, 0) - COALESCE(reserved, 0), 0) AS derived_available
             FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2 FOR UPDATE`,
          [whId, ingId]
        );

        const ingRes = await client.query(`SELECT name, unit FROM ingredients WHERE id = $1`, [ingId]);
        const ingName = ingRes.rows[0]?.name || item.ingredient_name || `صنف #${ingId}`;
        const ingUnit = ingRes.rows[0]?.unit || item.unit || "قطعة";

        if (stockRes.rows.length === 0) {
          rejectedItems.push({
            ingredient_id: ingId,
            name: ingName,
            unit: ingUnit,
            requested_quantity: requestedQty,
            available_quantity: 0,
            deficit: requestedQty,
            reason: "الصنف غير متوفر في رصيد هذا المخزن نهائياً (الرصيد: 0)"
          });
          continue;
        }

        const stockRow = stockRes.rows[0];
        const availableQty = Number(stockRow.derived_available ?? 0);
        if (Number(stockRow.available ?? -1) !== availableQty) {
          await client.query(`UPDATE inventory_items SET available = $1 WHERE id = $2`, [availableQty, stockRow.id]);
        }

        if (availableQty <= 0) {
          rejectedItems.push({
            ingredient_id: ingId,
            name: ingName,
            unit: ingUnit,
            requested_quantity: requestedQty,
            available_quantity: 0,
            deficit: requestedQty,
            reason: "تم استهلاك أو بيع كامل كمية الصنف من المخزن (الرصيد المتاح: 0)"
          });
        } else if (availableQty < requestedQty) {
          rejectedItems.push({
            ingredient_id: ingId,
            name: ingName,
            unit: ingUnit,
            requested_quantity: requestedQty,
            available_quantity: availableQty,
            deficit: requestedQty - availableQty,
            reason: `الرصيد المتاح بالمخزن (${availableQty} ${ingUnit}) غير كافٍ لإرجاع الكمية المطلوبة (${requestedQty} ${ingUnit}) نظراً لاستهلاك أو بيع جزء من الصنف`
          });
        }
      }

      if (rejectedItems.length > 0) {
        await client.query("ROLLBACK");
        client.release();
        const detailsMsg = rejectedItems
          .map(r => `• ${r.name}: المطلوب إرجاعه (${r.requested_quantity} ${r.unit}) بينما المتاح بالمخزن (${r.available_quantity} ${r.unit}) - ${r.reason}`)
          .join("\n");

        return res.status(400).json({
          success: false,
          rejected: true,
          error: "تم رفض اعتماد المرتجع لعدم كفاية الرصيد بالمخزن",
          message: `تم رفض اعتماد المرتجع: تعذر إرجاع الأصناف نظراً لاستهلاكها أو بيعها أو عدم توفر الرصيد الكافي بالمخزن:\n${detailsMsg}`,
          rejected_items: rejectedItems
        });
      }

      // Deduct stock and update supplier
      let totalAmount = Number(ret.total_amount || 0);
      let subtotalAmount = Number(ret.subtotal || 0);
      let taxAmount = Number(ret.tax_amount || 0);
      let taxRate = Number(ret.tax_rate || 0);
      const supplierId = Number(ret.supplier_id);
      const returnNumber = ret.return_number;

      // If return record had 0 subtotal/tax_amount, calculate from return items or original purchase invoice
      if (subtotalAmount <= 0 && returnItems.length > 0) {
        subtotalAmount = Math.round(returnItems.reduce((s: number, i: any) => s + (Number(i.subtotal) || (Number(i.quantity) * Number(i.unit_price))), 0) * 100) / 100;
        taxAmount = Math.round(returnItems.reduce((s: number, i: any) => s + (Number(i.tax_amount) || 0), 0) * 100) / 100;
      }
      if (subtotalAmount > 0 && taxAmount === 0 && ret.purchase_id) {
        try {
          const invRes = await client.query("SELECT tax_rate, tax_amount, subtotal, total_amount FROM purchases WHERE id = $1", [ret.purchase_id]);
          if (invRes.rows[0]) {
            const inv = invRes.rows[0];
            const invTaxRate = Number(inv.tax_rate || 0);
            if (invTaxRate > 0) {
              taxRate = invTaxRate;
              taxAmount = Math.round((subtotalAmount * (taxRate / 100)) * 100) / 100;
              totalAmount = Math.round((subtotalAmount + taxAmount) * 100) / 100;
            }
          }
        } catch (_) {}
      }

      if (totalAmount <= 0 && subtotalAmount > 0) {
        totalAmount = Math.round((subtotalAmount + taxAmount) * 100) / 100;
      }

      if (supplierId && totalAmount > 0) {
        await client.query(`UPDATE suppliers SET balance = GREATEST(0, balance - $1) WHERE id = $2`, [totalAmount, supplierId]);
        const txnNote = taxAmount > 0
          ? `${ret.notes || `مرتجع شراء ${returnNumber}`} (صافي: ${subtotalAmount} + ضريبة: ${taxAmount} = إجمالي: ${totalAmount})`
          : (ret.notes || `مرتجع شراء ${returnNumber}`);

        await client.query(
          `INSERT INTO supplier_transactions (supplier_id, type, amount, notes, reference_id, reference_type, status)
           VALUES ($1, 'return', $2, $3, $4, 'purchase_return', 'posted')`,
          [supplierId, totalAmount, txnNote, returnId]
        );
      }

      for (const item of returnItems) {
        const ingId = Number(item.ingredient_id);
        const qty = Number(item.quantity);

        const stockRes = await client.query(
          `SELECT id, quantity, available, avg_cost FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2 FOR UPDATE`,
          [whId, ingId]
        );

        const before = Number(stockRes.rows[0]?.quantity || 0);
        const after = Math.max(0, before - qty);
        const unitCost = Number(item.unit_price || stockRes.rows[0]?.avg_cost || 0);

        if (stockRes.rows[0]) {
          await client.query(
            `UPDATE inventory_items SET quantity = $1, available = GREATEST($1 - COALESCE(reserved, 0), 0), updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [after, stockRes.rows[0].id]
          );
        }

        await client.query(`UPDATE ingredients SET current_stock = GREATEST(0, COALESCE(current_stock, 0) - $1) WHERE id = $2`, [qty, ingId]);

        await client.query(
          `INSERT INTO inventory_transactions (transaction_number, warehouse_id, ingredient_id, quantity, type, unit_cost, total_cost, balance_before, balance_after, reference_type, reference_id, reference_no, status, notes, date)
           VALUES ($1, $2, $3, $4, 'return', $5, $6, $7, $8, 'purchase_return', $9, $10, 'posted', $11, CURRENT_DATE)`,
          [`TXN-RET-${returnId}-${ingId}`, whId, ingId, -qty, unitCost, -qty * unitCost, before, after, returnId, returnNumber, `مرتجع شراء ${returnNumber}`]
        );

        await client.query(
          `INSERT INTO inventory_movements (warehouse_id, ingredient_id, field, before_qty, delta, after_qty, ref_type, ref_id, "user", notes, created_at)
           VALUES ($1, $2, 'quantity', $3, $4, $5, 'purchase_return', $6, 'system', $7, CURRENT_TIMESTAMP)`,
          [whId, ingId, before, -qty, after, returnId, `مرتجع شراء ${returnNumber}`]
        );
      }

      const updated = await client.query(
        `UPDATE purchase_returns SET status = 'approved', stock_posted = true, subtotal = $1, tax_rate = $2, tax_amount = $3, total_amount = $4, notes = COALESCE($5, notes), updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *`,
        [subtotalAmount, taxRate, taxAmount, totalAmount, notes, returnId]
      );

      await client.query("COMMIT");

      try {
        await postPurchaseReturnEntry({
          id: returnId,
          return_number: returnNumber,
          total: totalAmount,
          subtotal: subtotalAmount,
          tax_amount: taxAmount,
          tax_rate: taxRate,
          supplier_id: supplierId,
          warehouse_id: ret.warehouse_id
        });
      } catch (glErr: any) {
        console.warn("[GL Integration] Purchase return approval posting note:", glErr.message);
      }

      try {
        await recordPurchaseReturnCost(returnId);
      } catch (cstErr: any) {
        console.warn("[Cost Integration] Purchase return approval cost note:", cstErr.message);
      }

      try {
        ERPEventBus.getInstance().emitEvent("PurchaseReturnApproved", {
          id: returnId,
          return_number: returnNumber,
          supplier_id: supplierId,
          total_amount: totalAmount,
          warehouse_id: ret.warehouse_id
        });
      } catch (_) {}

      client.release();
      return res.json({
        success: true,
        message: "تم اعتماد المرتجع وخصم الأصناف من المخزن بنجاح",
        ...updated.rows[0]
      });
    }

    // Normal update (notes or other status without posting stock)
    const result = await client.query(
      `UPDATE purchase_returns SET status = COALESCE($1, status), notes = COALESCE($2, notes), updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *`,
      [status, notes, returnId]
    );
    await client.query("COMMIT");
    client.release();
    res.json(result.rows[0]);
  } catch (err: any) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    client.release();
    res.status(500).json({ error: err.message });
  }
});

// Initialize purchase_quotations table
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS purchase_quotations (
        id SERIAL PRIMARY KEY,
        quotation_number TEXT,
        request_id INTEGER,
        supplier_id INTEGER,
        supplier TEXT,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        delivery_date DATE,
        estimated_value DECIMAL(10,2) DEFAULT 0,
        status TEXT DEFAULT 'Draft',
        notes TEXT,
        items JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Enterprise quotation detail fields / backward-compatible migrations
    await pool.query(`ALTER TABLE purchase_quotations ADD COLUMN IF NOT EXISTS quotation_date DATE`);
    await pool.query(`ALTER TABLE purchase_quotations ADD COLUMN IF NOT EXISTS valid_until DATE`);
    await pool.query(`ALTER TABLE purchase_quotations ADD COLUMN IF NOT EXISTS payment_terms TEXT DEFAULT ''`);
    await pool.query(`ALTER TABLE purchase_quotations ADD COLUMN IF NOT EXISTS delivery_terms TEXT DEFAULT ''`);
    await pool.query(`ALTER TABLE purchase_quotations ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EGP'`);
    await pool.query(`ALTER TABLE purchase_quotations ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(12,2) DEFAULT 0`);
    await pool.query(`ALTER TABLE purchase_quotations ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(12,2) DEFAULT 0`);
    await pool.query(`ALTER TABLE purchase_quotations ADD COLUMN IF NOT EXISTS subtotal DECIMAL(12,2) DEFAULT 0`);
    await pool.query(`ALTER TABLE purchase_quotations ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12,2) DEFAULT 0`);
    await pool.query(`ALTER TABLE purchase_quotations ADD COLUMN IF NOT EXISTS contact_person TEXT DEFAULT ''`);
    await pool.query(`ALTER TABLE purchase_quotations ADD COLUMN IF NOT EXISTS contact_phone TEXT DEFAULT ''`);
    await pool.query(`ALTER TABLE purchase_quotations ADD COLUMN IF NOT EXISTS reference_number TEXT DEFAULT ''`);
    await pool.query(`UPDATE purchase_quotations SET quotation_date = COALESCE(quotation_date, date::date), subtotal = COALESCE(subtotal, estimated_value, 0), total_amount = COALESCE(total_amount, estimated_value, 0) WHERE quotation_date IS NULL OR subtotal IS NULL OR total_amount IS NULL`);
  } catch (err) {
    console.error("Error setting up purchase_quotations table:", err);
  }
})();

// ═══════════════════════════════════════
// PURCHASE QUOTATIONS V1 API
// ═══════════════════════════════════════
async function syncQuotationItems(quotationId: number, items: any[]) {
  await pool.query(`DELETE FROM purchase_quotation_items WHERE quotation_id=$1`, [quotationId]);
  for (const raw of Array.isArray(items) ? items : []) {
    const rawId = raw.ingredient_id != null ? String(raw.ingredient_id) : '';
    const itemType = raw.item_type || (raw.product_id || rawId.startsWith('p_') ? 'product' : 'ingredient');
    const ingredientId = itemType === 'ingredient' && /^\d+$/.test(rawId) ? Number(rawId) : null;
    const productId = itemType === 'product' ? Number(raw.product_id || (rawId.startsWith('p_') ? rawId.slice(2) : rawId)) || null : null;
    const qty=Number(raw.quantity||0); const price=Number(raw.unit_price||0);
    if(qty<=0) continue;
    await pool.query(`INSERT INTO purchase_quotation_items (quotation_id,ingredient_id,product_id,item_type,item_code,name,unit,quantity,unit_price,discount_amount,tax_amount,total_price,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [quotationId,ingredientId,productId,itemType,raw.item_code||null,raw.name||null,raw.unit||null,qty,price,Number(raw.discount_amount||0),Number(raw.tax_amount||0),Number(raw.total_price ?? qty*price),raw.notes||null]);
  }
}

router.get(["/api/purchase-quotations", "/api/quotations"], async (req: Request, res: Response) => {
  try {
    const { status, supplier_id, request_id } = req.query;
    let query = "SELECT * FROM purchase_quotations WHERE 1=1";
    const params: any[] = [];
    let idx = 1;
    if (status) { query += ` AND status = $${idx}`; params.push(status); idx++; }
    if (supplier_id) { query += ` AND supplier_id = $${idx}`; params.push(supplier_id); idx++; }
    if (request_id) { query += ` AND request_id = $${idx}`; params.push(request_id); idx++; }
    query += " ORDER BY date DESC, id DESC";
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get(["/api/purchase-quotations/:id", "/api/quotations/:id"], async (req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT * FROM purchase_quotations WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Quotation not found" });
    const items = await pool.query(`SELECT * FROM purchase_quotation_items WHERE quotation_id=$1 ORDER BY id`, [req.params.id]);
    res.json({ ...result.rows[0], items: items.rows.length ? items.rows : (result.rows[0].items || []) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post(["/api/purchase-quotations", "/api/quotations"], async (req: Request, res: Response) => {
  try {
    const { quotation_number, request_id, supplier_id, supplier, quotation_date, delivery_date, valid_until, estimated_value, subtotal, discount_amount, tax_amount, total_amount, status, notes, items, payment_terms, delivery_terms, currency, contact_person, contact_phone, reference_number } = req.body;
    const qNumber = quotation_number || `RFQ-${Date.now().toString().slice(-6)}`;
    const itemsJson = JSON.stringify(items || []);
    const sub = Number(subtotal ?? estimated_value ?? 0);
    const discount = Number(discount_amount || 0);
    const tax = Number(tax_amount || 0);
    const total = Number(total_amount ?? (sub - discount + tax));
    const result = await pool.query(
      `INSERT INTO purchase_quotations 
       (quotation_number, request_id, supplier_id, supplier, quotation_date, delivery_date, valid_until, estimated_value, subtotal, discount_amount, tax_amount, total_amount, status, notes, items, payment_terms, delivery_terms, currency, contact_person, contact_phone, reference_number)
       VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE), $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21) RETURNING *`,
      [
        qNumber, request_id ? Number(request_id) : null, supplier_id ? Number(supplier_id) : null, supplier || "مورد عام",
        quotation_date || null, delivery_date || null, valid_until || null, total, sub, discount, tax, total, status || "Draft", notes || "", itemsJson, payment_terms || "", delivery_terms || "", currency || "EGP", contact_person || "", contact_phone || "", reference_number || ""
      ]
    );
    await syncQuotationItems(Number(result.rows[0].id), items || []);
    res.status(201).json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put(["/api/purchase-quotations/:id", "/api/quotations/:id"], async (req: Request, res: Response) => {
  try {
    const { quotation_number, request_id, supplier_id, supplier, quotation_date, delivery_date, valid_until, estimated_value, subtotal, discount_amount, tax_amount, total_amount, status, notes, items, payment_terms, delivery_terms, currency, contact_person, contact_phone, reference_number } = req.body;
    const itemsJson = items !== undefined ? JSON.stringify(items) : null;
    const result = await pool.query(
      `UPDATE purchase_quotations SET 
        quotation_number = COALESCE($1, quotation_number), request_id = COALESCE($2, request_id), supplier_id = COALESCE($3, supplier_id), supplier = COALESCE($4, supplier),
        quotation_date = COALESCE($5, quotation_date), delivery_date = COALESCE($6, delivery_date), valid_until = COALESCE($7, valid_until),
        estimated_value = COALESCE($8, estimated_value), subtotal = COALESCE($9, subtotal), discount_amount = COALESCE($10, discount_amount), tax_amount = COALESCE($11, tax_amount), total_amount = COALESCE($12, total_amount),
        status = COALESCE($13, status), notes = COALESCE($14, notes), items = COALESCE($15, items), payment_terms = COALESCE($16, payment_terms), delivery_terms = COALESCE($17, delivery_terms),
        currency = COALESCE($18, currency), contact_person = COALESCE($19, contact_person), contact_phone = COALESCE($20, contact_phone), reference_number = COALESCE($21, reference_number), updated_at = CURRENT_TIMESTAMP
       WHERE id = $22 RETURNING *`,
      [quotation_number, request_id ? Number(request_id) : null, supplier_id ? Number(supplier_id) : null, supplier, quotation_date, delivery_date, valid_until, estimated_value !== undefined ? Number(estimated_value) : null, subtotal !== undefined ? Number(subtotal) : null, discount_amount !== undefined ? Number(discount_amount) : null, tax_amount !== undefined ? Number(tax_amount) : null, total_amount !== undefined ? Number(total_amount) : null, status, notes, itemsJson, payment_terms, delivery_terms, currency, contact_person, contact_phone, reference_number, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Quotation not found" });
    if (items !== undefined) await syncQuotationItems(Number(req.params.id), items || []);
    res.json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete(["/api/purchase-quotations/:id", "/api/quotations/:id"], async (req: Request, res: Response) => {
  try {
    const result = await pool.query("DELETE FROM purchase_quotations WHERE id = $1 RETURNING *", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Quotation not found" });
    res.json({ success: true, message: "Quotation deleted" });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export async function ensureDefaultSuppliers() {
  // Operational suppliers table left clean for user testing without dummy seeds
}

export default router;
