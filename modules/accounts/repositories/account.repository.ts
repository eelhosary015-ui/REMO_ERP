import { pool } from "../../../server-db.js";
import { assertPeriodOpen, translatePeriodTriggerError } from "../services/period-lock.service.js";

/** تاريخ اليوم بالتوقيت المحلي (وليس UTC) بصيغة YYYY-MM-DD. */
function localYMD(reference: Date = new Date()): string {
  return `${reference.getFullYear()}-${String(reference.getMonth() + 1).padStart(2, "0")}-${String(reference.getDate()).padStart(2, "0")}`;
}

export class AccountRepository {
  async getAllAccounts(): Promise<any[]> {
    const result = await pool.query("SELECT * FROM accounts WHERE status = true ORDER BY code ASC");
    return result.rows;
  }

  async getAccountById(id: number): Promise<any> {
    const result = await pool.query("SELECT * FROM accounts WHERE id = $1", [id]);
    return result.rows[0];
  }

  async getAccountTree(): Promise<any[]> {
    const result = await pool.query("SELECT * FROM accounts WHERE status = true ORDER BY code ASC");
    const accounts = result.rows;
    const map = new Map<number, any>();
    const roots: any[] = [];

    for (const acc of accounts) {
      acc.children = [];
      map.set(acc.id, acc);
    }

    for (const acc of accounts) {
      if (acc.parent_id && map.has(acc.parent_id)) {
        map.get(acc.parent_id).children.push(acc);
      } else {
        roots.push(acc);
      }
    }
    return roots;
  }

  async getJournalEntries(filters: {
    page?: number;
    page_size?: number;
    date_from?: string;
    date_to?: string;
    source_type?: string;
    status?: string;
    account_id?: number;
    period_id?: number;
  } = {}): Promise<{ data: any[]; total: number }> {
    const page = filters.page || 1;
    const pageSize = Math.min(filters.page_size || 50, 200);
    const offset = (page - 1) * pageSize;
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (filters.date_from) {
      conditions.push(`je.date >= $${paramIdx++}`);
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      conditions.push(`je.date <= $${paramIdx++}`);
      params.push(filters.date_to);
    }
    if (filters.source_type) {
      conditions.push(`je.source_type = $${paramIdx++}`);
      params.push(filters.source_type);
    }
    if (filters.status) {
      conditions.push(`je.status = $${paramIdx++}`);
      params.push(filters.status);
    }
    if (filters.account_id) {
      conditions.push(`EXISTS (SELECT 1 FROM journal_items ji WHERE ji.journal_entry_id = je.id AND ji.account_id = $${paramIdx++})`);
      params.push(filters.account_id);
    }
    if (filters.period_id) {
      conditions.push(`je.period_id = $${paramIdx++}`);
      params.push(filters.period_id);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM journal_entries je ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await pool.query(`
      SELECT je.*,
        TO_CHAR(je.date, 'YYYY-MM-DD') AS date,
        u.username as created_by_name,
        fp.month || '/' || fp.year as period_name,
        b.name as branch_name,
        COALESCE(
          (SELECT si.invoice_no FROM sales_invoices si
            WHERE je.source_type = 'SALES_INVOICE' AND si.id = je.source_id),
          (SELECT 'POS-' || o.daily_number::text FROM orders o
            WHERE je.source_type = 'pos' AND o.id = je.source_id),
          (SELECT sr.return_no FROM sales_returns sr
            WHERE je.source_type = 'sales_return' AND sr.id = je.source_id)
        ) as source_document_number,
        COALESCE(
          (SELECT si.customer_name FROM sales_invoices si
            WHERE je.source_type = 'SALES_INVOICE' AND si.id = je.source_id),
          (SELECT o.customer_name FROM orders o
            WHERE je.source_type = 'pos' AND o.id = je.source_id),
          (SELECT sr.customer_name FROM sales_returns sr
            WHERE je.source_type = 'sales_return' AND sr.id = je.source_id)
        ) as source_customer_name,
        COALESCE(
          (SELECT COALESCE(si.warehouse, w.name) FROM sales_invoices si
             LEFT JOIN warehouses w ON w.id = si.warehouse_id
            WHERE je.source_type = 'SALES_INVOICE' AND si.id = je.source_id),
          (SELECT sr.warehouse FROM sales_returns sr
            WHERE je.source_type = 'sales_return' AND sr.id = je.source_id),
          (SELECT string_agg(DISTINCT w.name, ', ')
             FROM inventory_stock_ledger isl
             JOIN warehouses w ON w.id = isl.warehouse_id
            WHERE je.source_type = 'pos'
              AND isl.ref_type = 'pos_sale'
              AND isl.ref_id = je.source_id)
        ) as source_warehouse_name,
        json_agg(json_build_object(
          'id', ji.id,
          'account_id', ji.account_id,
          'account_code', a.code,
          'account_name', COALESCE(a.name_ar, a.name),
          'debit', ji.debit,
          'credit', ji.credit,
          'notes', ji.notes,
          'cost_center_id', ji.cost_center_id,
          'cost_center_name', cc.name
        ) ORDER BY ji.id) as items
      FROM journal_entries je
      LEFT JOIN journal_items ji ON je.id = ji.journal_entry_id
      LEFT JOIN accounts a ON ji.account_id = a.id
      LEFT JOIN cost_centers cc ON ji.cost_center_id = cc.id
      LEFT JOIN users u ON je.created_by = u.id
      LEFT JOIN financial_periods fp ON je.period_id = fp.id
      LEFT JOIN branches b ON je.branch_id = b.id
      ${where}
      GROUP BY je.id, u.username, fp.month, fp.year, b.name
      ORDER BY je.date DESC, je.id DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `, [...params, pageSize, offset]);

    return { data: dataResult.rows, total };
  }

  async getAccountLedger(accountId: number, filters: {
    date_from?: string;
    date_to?: string;
    cost_center_id?: number;
    page?: number;
    page_size?: number;
  } = {}): Promise<{ data: any[]; total: number; opening_balance: number }> {
    const page = filters.page || 1;
    const pageSize = Math.min(filters.page_size || 50, 200);
    const offset = (page - 1) * pageSize;

    // Get opening balance (sum of all items before date_from)
    let openingBalance = 0;
    if (filters.date_from) {
      const obResult = await pool.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN a.account_nature = 'debit' THEN ji.debit - ji.credit ELSE ji.credit - ji.debit END), 0) as balance
        FROM journal_items ji
        JOIN journal_entries je ON ji.journal_entry_id = je.id
        JOIN accounts a ON ji.account_id = a.id
        WHERE ji.account_id = $1 AND je.date < $2 AND je.status != 'canceled'
      `, [accountId, filters.date_from]);
      openingBalance = parseFloat(obResult.rows[0].balance) || 0;
    }

    const conditions: string[] = ["ji.account_id = $1"];
    const params: any[] = [accountId];
    let paramIdx = 2;

    if (filters.date_from) {
      conditions.push(`je.date >= $${paramIdx++}`);
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      conditions.push(`je.date <= $${paramIdx++}`);
      params.push(filters.date_to);
    }
    if (filters.cost_center_id) {
      conditions.push(`ji.cost_center_id = $${paramIdx++}`);
      params.push(filters.cost_center_id);
    }

    const where = `WHERE ${conditions.join(' AND ')} AND je.status != 'canceled'`;

    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT ji.id) FROM journal_items ji JOIN journal_entries je ON ji.journal_entry_id = je.id ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataResult = await pool.query(`
      SELECT ji.id, ji.debit, ji.credit, ji.notes,
        ji.cost_center_id, cc.name as cost_center_name,
        je.id as entry_id, TO_CHAR(je.date, 'YYYY-MM-DD') AS date, je.description, je.reference, je.source_type
      FROM journal_items ji
      JOIN journal_entries je ON ji.journal_entry_id = je.id
      LEFT JOIN cost_centers cc ON ji.cost_center_id = cc.id
      ${where}
      ORDER BY je.date, ji.id
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `, [...params, pageSize, offset]);

    return { data: dataResult.rows, total, opening_balance: openingBalance };
  }

  async createAccount(acc: any): Promise<any> {
    const query = `
      INSERT INTO accounts (code, name, name_ar, name_en, parent_id, type, account_type, account_nature, level, is_leaf, allow_posting, status, balance)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    const result = await pool.query(query, [
      acc.code,
      acc.name || acc.name_ar || '',
      acc.name_ar || acc.name || '',
      acc.name_en || null,
      acc.parent_id || null,
      acc.type,
      acc.account_type || null,
      acc.account_nature || this.inferNature(acc.type),
      acc.level || 1,
      acc.is_leaf !== false,
      acc.allow_posting !== false,
      acc.status !== false,
      acc.balance || 0
    ]);
    return result.rows[0];
  }

  async updateAccount(id: number, updates: any): Promise<any> {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;

    const allowed = ['code', 'name', 'name_ar', 'name_en', 'parent_id', 'type', 'account_type', 'account_nature', 'level', 'is_leaf', 'allow_posting', 'status'];
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = $${idx++}`);
        params.push(updates[key]);
      }
    }

    if (fields.length === 0) throw new Error("No fields to update");
    params.push(id);

    const result = await pool.query(
      `UPDATE accounts SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    return result.rows[0];
  }

  async deleteAccount(id: number): Promise<void> {
    await pool.query("DELETE FROM accounts WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM accounts c WHERE c.parent_id = $1)", [id]);
  }

  async createJournalEntry(entry: any, externalClient?: any): Promise<any> {
    const shouldManageClient = !externalClient;
    const client = externalClient || await pool.connect();
    try {
      if (shouldManageClient) await client.query("BEGIN");

      if (!entry.items || !Array.isArray(entry.items) || entry.items.length === 0) {
        throw new Error("القيد اليومي يجب أن يحتوي على بنود");
      }

      let totalDebit = 0;
      let totalCredit = 0;
      for (const item of entry.items) {
        if (!item.account_id || item.account_id === 'undefined' || item.account_id === 'null' || isNaN(Number(item.account_id))) {
          throw new Error("فشل إنشاء القيد اليومي: يحتوي القيد على بند بحساب غير محدد (account_id is missing or invalid)");
        }
        totalDebit += parseFloat(item.debit) || 0;
        totalCredit += parseFloat(item.credit) || 0;
      }

      if (Math.abs(totalDebit - totalCredit) > 0.001) {
        throw new Error(`فشل إنشاء القيد اليومي: القيد غير متزن (إجمالي المدين ${totalDebit.toFixed(2)} لا يساوي إجمالي الدائن ${totalCredit.toFixed(2)})`);
      }

      if (totalDebit <= 0) {
        throw new Error("فشل إنشاء القيد اليومي: إجمالي مبلغ القيد يجب أن يكون أكبر من صفر");
      }

      // ── حماية الفترة المالية ─────────────────────────────────────────────
      // هذه هي نقطة المرور الموحّدة لكل الترحيلات التلقائية (مبيعات، مشتريات،
      // خزائن، مرتبات، فنادق، استلام مخزني...). القرار يعتمد على تاريخ القيد
      // نفسه، وتُستنتج الفترة منه بدل الثقة بـ period_id المرسل من المستدعي.
      const entryDate = entry.date || localYMD();
      let resolvedPeriodId: number | null = null;
      try {
        const period = await assertPeriodOpen(client, entryDate, "ترحيل القيد");
        resolvedPeriodId = period ? Number(period.id) : null;
      } catch (error) {
        throw translatePeriodTriggerError(error);
      }

      const entryResult = await client.query(`
        INSERT INTO journal_entries (date, description, reference, source_type, source_id, status, total_debit, total_credit, created_by, branch_id, period_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        entryDate,
        entry.description || entry.notes || null,
        entry.reference || entry.reference_number || null,
        entry.source_type || 'manual',
        entry.source_id || null,
        entry.status || 'posted',
        totalDebit,
        totalCredit,
        entry.created_by || null,
        entry.branch_id || null,
        resolvedPeriodId
      ]);
      const newEntry = entryResult.rows[0];

      const itemIds: number[] = [];
      for (const item of entry.items) {
        let validCostCenterId: number | null = null;
        if (item.cost_center_id && !isNaN(Number(item.cost_center_id))) {
          try {
            const ccCheck = await client.query("SELECT id FROM cost_centers WHERE id = $1 LIMIT 1", [Number(item.cost_center_id)]);
            if (ccCheck.rows.length > 0) {
              validCostCenterId = ccCheck.rows[0].id;
            }
          } catch (_) {}
        }

        const itemResult = await client.query(`
          INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes, cost_center_id)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `, [
          newEntry.id,
          item.account_id,
          parseFloat(item.debit) || 0,
          parseFloat(item.credit) || 0,
          item.notes || null,
          validCostCenterId
        ]);
        itemIds.push(itemResult.rows[0].id);
      }

      // Update account balances
      for (const item of entry.items) {
        const debit = parseFloat(item.debit) || 0;
        const credit = parseFloat(item.credit) || 0;
        if (debit > 0 || credit > 0) {
          await client.query(`
            UPDATE accounts SET balance = balance + $1 WHERE id = $2
          `, [debit - credit, item.account_id]);
        }
      }

      if (shouldManageClient) await client.query("COMMIT");
      return { ...newEntry, item_ids: itemIds };
    } catch (error) {
      if (shouldManageClient) await client.query("ROLLBACK");
      throw error;
    } finally {
      if (shouldManageClient) client.release();
    }
  }

  async reverseJournalEntry(entryId: number, userId: number): Promise<any> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Get original entry
      const origResult = await client.query(
        "SELECT * FROM journal_entries WHERE id = $1",
        [entryId]
      );
      const orig = origResult.rows[0];
      if (!orig) throw new Error("Journal entry not found");

      // منع العكس المتكرر: القيد الملغى لا يُلغى مرة أخرى، ولا يُنشأ عكس ثانٍ لنفس القيد.
      if (["canceled", "cancelled"].includes(String(orig.status || "").toLowerCase())) {
        throw new Error("القيد ملغى بالفعل ولا يمكن عكسه مرة أخرى");
      }
      const priorReversal = await client.query(
        "SELECT id FROM journal_entries WHERE source_type = 'adjustment' AND reference = $1 LIMIT 1",
        [`REV-${orig.reference || orig.id}`],
      );
      if (priorReversal.rows.length > 0) {
        throw new Error(`يوجد قيد عكسي سابق لهذا القيد (رقم ${priorReversal.rows[0].id}) — لا يُسمح بالعكس المزدوج`);
      }

      // Get items
      const itemsResult = await client.query(
        "SELECT * FROM journal_items WHERE journal_entry_id = $1",
        [entryId]
      );

      // Create reversal entry (swap debit/credit)
      const reversalItems = itemsResult.rows.map((item: any) => ({
        account_id: item.account_id,
        debit: item.credit,
        credit: item.debit,
        notes: `إلغاء قيد رقم ${orig.id}`,
        cost_center_id: item.cost_center_id
      }));

      const reversalDate = localYMD();
      let reversalPeriodId: number | null = null;
      try {
        const period = await assertPeriodOpen(client, reversalDate, "ترحيل قيد عكسي");
        reversalPeriodId = period ? Number(period.id) : null;
      } catch (error) {
        throw translatePeriodTriggerError(error);
      }

      const revResult = await client.query(`
        INSERT INTO journal_entries (date, description, reference, source_type, status, total_debit, total_credit, created_by, period_id)
        VALUES ($1, $2, $3, $4, 'posted', $5, $6, $7, $8)
        RETURNING *
      `, [
        reversalDate,
        `إلغاء قيد: ${orig.description || orig.reference || ''}`,
        `REV-${orig.reference || orig.id}`,
        'adjustment',
        orig.total_credit,
        orig.total_debit,
        userId,
        reversalPeriodId
      ]);
      const reversal = revResult.rows[0];

      for (const item of reversalItems) {
        await client.query(`
          INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes, cost_center_id)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [reversal.id, item.account_id, item.debit, item.credit, item.notes, item.cost_center_id]);

        // Reverse balance
        await client.query(
          "UPDATE accounts SET balance = balance + $1 WHERE id = $2",
          [item.debit - item.credit, item.account_id]
        );
      }

      // Mark original as canceled
      await client.query(
        "UPDATE journal_entries SET status = 'canceled' WHERE id = $1",
        [entryId]
      );

      await client.query("COMMIT");
      return reversal;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private inferNature(type: string): string {
    switch (type) {
      case 'asset':
      case 'expense':
        return 'debit';
      case 'liability':
      case 'equity':
      case 'revenue':
        return 'credit';
      default:
        return 'debit';
    }
  }
}