import { erpPool } from "../../../server-erp-core.js";
import { CreateSupplierDTO, UpdateSupplierDTO, SupplierTransactionDTO } from "../dto/supplier.dto.js";

export class SupplierRepository {
  async getAll(filters?: { search?: string; status?: string; group?: string }): Promise<any[]> {
    let query = "SELECT * FROM suppliers WHERE 1=1";
    const params: any[] = [];
    let idx = 1;

    if (filters?.search) {
      query += ` AND (name ILIKE $${idx} OR phone ILIKE $${idx} OR phone_2 ILIKE $${idx} OR email ILIKE $${idx})`;
      params.push(`%${filters.search}%`);
      idx++;
    }
    if (filters?.status) {
      query += ` AND status = $${idx}`;
      params.push(filters.status);
      idx++;
    }
    if (filters?.group) {
      query += ` AND group_name = $${idx}`;
      params.push(filters.group);
      idx++;
    }

    query += " ORDER BY created_at DESC";

    const result = await erpPool.query(query, params);
    return result.rows;
  }

  async findById(id: number): Promise<any> {
    const result = await erpPool.query("SELECT * FROM suppliers WHERE id = $1", [id]);
    if (result.rows.length === 0) return null;

    const stats = await erpPool.query(
      `SELECT
        COALESCE((SELECT SUM(total_amount) FROM purchases WHERE supplier_id = $1), 0) as total_purchases,
        COALESCE((SELECT SUM(paid_amount) FROM purchases WHERE supplier_id = $1), 0) as total_paid,
        COALESCE((SELECT SUM(amount) FROM supplier_transactions WHERE supplier_id = $1 AND type = 'payment'), 0) as total_payments,
        COALESCE((SELECT SUM(amount) FROM supplier_transactions WHERE supplier_id = $1 AND type = 'return'), 0) as total_returns,
        (SELECT COUNT(*) FROM purchases WHERE supplier_id = $1) as purchase_count
      `,
      [id]
    );

    return { ...result.rows[0], ...stats.rows[0] };
  }

  async create(dto: CreateSupplierDTO): Promise<any> {
    const query = `
      INSERT INTO suppliers (name, phone, phone_2, email, address, commercial_register, tax_number, group_name, payment_terms, credit_limit, balance, opening_balance, notes, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;
    const result = await erpPool.query(query, [
      dto.name,
      dto.phone || null,
      dto.phone_2 || null,
      dto.email || null,
      dto.address || null,
      dto.commercial_register || null,
      dto.tax_number || null,
      dto.group_name || null,
      dto.payment_terms || 'cash',
      dto.credit_limit || 0,
      0,
      dto.opening_balance || 0,
      dto.notes || null,
      dto.status || 'active'
    ]);
    return result.rows[0];
  }

  async update(id: number, dto: UpdateSupplierDTO): Promise<any> {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;

    const updatableFields: (keyof UpdateSupplierDTO)[] = [
      'name', 'phone', 'phone_2', 'email', 'address',
      'commercial_register', 'tax_number', 'group_name',
      'payment_terms', 'credit_limit', 'notes', 'status'
    ];

    for (const field of updatableFields) {
      if (dto[field] !== undefined) {
        fields.push(`${field} = $${idx}`);
        params.push(dto[field]);
        idx++;
      }
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = NOW()`);
    params.push(id);

    const query = `UPDATE suppliers SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    const result = await erpPool.query(query, params);

    if (result.rows.length === 0) return null;
    return result.rows[0];
  }

  async delete(id: number): Promise<boolean> {
    // Check if supplier has purchases
    const checkResult = await erpPool.query(
      "SELECT COUNT(*) as count FROM purchases WHERE supplier_id = $1",
      [id]
    );
    const purchaseCount = parseInt(checkResult.rows[0].count);
    if (purchaseCount > 0) {
      throw new Error("لا يمكن حذف مورد مرتبط بعمليات شراء");
    }

    // Delete supplier transactions first
    await erpPool.query("DELETE FROM supplier_transactions WHERE supplier_id = $1", [id]);

    // Delete purchase orders references
    await erpPool.query("DELETE FROM purchase_order_items WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE supplier_id = $1)", [id]);
    await erpPool.query("DELETE FROM purchase_orders WHERE supplier_id = $1", [id]);

    // Delete purchase request references
    await erpPool.query("DELETE FROM purchase_request_items WHERE purchase_request_id IN (SELECT id FROM purchase_requests WHERE supplier_id = $1)", [id]);
    await erpPool.query("DELETE FROM purchase_requests WHERE supplier_id = $1", [id]);

    const result = await erpPool.query("DELETE FROM suppliers WHERE id = $1 RETURNING id", [id]);
    return result.rows.length > 0;
  }

  async getTransactions(supplierId: number, filters?: { from?: string; to?: string; type?: string; limit?: number; offset?: number }): Promise<any[]> {
    let query = "SELECT * FROM supplier_transactions WHERE supplier_id = $1";
    const params: any[] = [supplierId];
    let idx = 2;

    if (filters?.from) {
      query += ` AND timestamp >= $${idx}`;
      params.push(filters.from);
      idx++;
    }
    if (filters?.to) {
      query += ` AND timestamp <= $${idx}`;
      params.push(filters.to);
      idx++;
    }
    if (filters?.type) {
      query += ` AND type = $${idx}`;
      params.push(filters.type);
      idx++;
    }

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    query += ` ORDER BY timestamp DESC LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(limit, offset);

    const result = await erpPool.query(query, params);
    return result.rows;
  }

  async recordTransaction(dto: SupplierTransactionDTO): Promise<any> {
    const client = await erpPool.connect();
    try {
      await client.query("BEGIN");

      const txResult = await client.query(
        `INSERT INTO supplier_transactions (supplier_id, type, amount, notes, reference_id, payment_method, reference_type, currency, due_date, document_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [dto.supplier_id, dto.type, dto.amount, dto.notes || null, dto.reference_id || null, (dto as any).payment_method || null, (dto as any).reference_type || null, (dto as any).currency || 'EGP', (dto as any).due_date || null, (dto as any).document_number || null]
      );

      // Update supplier balance
      if (dto.type === 'purchase' || dto.type === 'adjustment') {
        await client.query(
          "UPDATE suppliers SET balance = balance + $1, updated_at = NOW() WHERE id = $2",
          [dto.amount, dto.supplier_id]
        );
      } else if (dto.type === 'payment' || dto.type === 'return') {
        await client.query(
          "UPDATE suppliers SET balance = balance - $1, updated_at = NOW() WHERE id = $2",
          [dto.amount, dto.supplier_id]
        );
      }

      // Supplier payment -> Treasury/Bank: safe_id is the treasury account id.
      if (dto.type === 'payment' && Number((dto as any).safe_id || 0) > 0) {
        const safeId = Number((dto as any).safe_id);
        const method = String((dto as any).payment_method || 'cash').toLowerCase();
        const acc = await client.query(`SELECT id,current_balance FROM treasury_accounts WHERE id=$1 AND status='active' FOR UPDATE`, [safeId]);
        if (acc.rows[0]) {
          const before = Number(acc.rows[0].current_balance || 0);
          const after = before - Number(dto.amount);
          const voucher = `PAY-SUP-${txResult.rows[0].id}-${Date.now().toString().slice(-6)}`;
          await client.query(`INSERT INTO treasury_transactions (account_id,amount,transaction_type,reference_type,reference_id,notes,status,voucher_number,voucher_type,payment_method,client_type,client_name,balance_before,balance_after) VALUES ($1,$2,'cash_out','supplier_payment',$3,$4,'approved',$5,'payment',$6,'supplier',$7,$8,$9)`, [safeId,-Number(dto.amount),txResult.rows[0].id,`سداد للمورد #${dto.supplier_id}`,voucher,method,`supplier #${dto.supplier_id}`,before,after]);
          await client.query(`UPDATE treasury_accounts SET current_balance=current_balance-$1, available_balance=COALESCE(available_balance,current_balance)-$1 WHERE id=$2`, [Number(dto.amount),safeId]);
        }
      }

      await client.query("COMMIT");
      return txResult.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getPurchases(supplierId: number): Promise<any[]> {
    const query = `
      SELECT p.*, w.name as warehouse_name
      FROM purchases p
      LEFT JOIN warehouses w ON p.warehouse_id = w.id
      WHERE p.supplier_id = $1
      ORDER BY p.date DESC
    `;
    const result = await erpPool.query(query, [supplierId]);
    return result.rows;
  }

  async getPurchaseOrders(supplierId: number): Promise<any[]> {
    const query = `
      SELECT * FROM purchase_orders
      WHERE supplier_id = $1
      ORDER BY date DESC
    `;
    const result = await erpPool.query(query, [supplierId]);
    return result.rows;
  }

  async getBalanceSummary(supplierId: number): Promise<any> {
    const result = await erpPool.query(
      `SELECT
        COALESCE(opening_balance, 0) as opening_balance,
        COALESCE(balance, 0) as current_balance,
        COALESCE((SELECT SUM(amount) FROM supplier_transactions WHERE supplier_id = $1 AND type = 'purchase' AND COALESCE(reference_type,'') <> 'opening_balance'), 0) as total_purchases,
        COALESCE((SELECT SUM(amount) FROM supplier_transactions WHERE supplier_id = $1 AND type = 'payment'), 0) as total_payments,
        COALESCE((SELECT SUM(amount) FROM supplier_transactions WHERE supplier_id = $1 AND type = 'return'), 0) as total_returns,
        COALESCE((SELECT SUM(amount) FROM supplier_transactions WHERE supplier_id = $1 AND type = 'adjustment' AND COALESCE(reference_type,'') <> 'opening_balance'), 0) as total_adjustments
      FROM suppliers WHERE id = $1`,
      [supplierId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    row.calculated_balance = (
      parseFloat(row.opening_balance) +
      parseFloat(row.total_purchases) +
      parseFloat(row.total_adjustments) -
      parseFloat(row.total_payments) -
      parseFloat(row.total_returns)
    ).toFixed(2);

    return row;
  }

  async getStatement(supplierId: number, filters?: { fromDate?: string; toDate?: string }): Promise<any[]> {
    let query = `
      SELECT st.*,
        CASE
          WHEN st.type = 'purchase' THEN st.amount
          WHEN st.type = 'payment' THEN -st.amount
          WHEN st.type = 'return' THEN -st.amount
          WHEN st.type = 'adjustment' THEN st.amount
          ELSE 0
        END as effect,
        s.balance as current_balance
      FROM supplier_transactions st
      JOIN suppliers s ON s.id = st.supplier_id
      WHERE st.supplier_id = $1
    `;
    const params: any[] = [supplierId];
    let idx = 2;

    if (filters?.fromDate) {
      query += ` AND st.timestamp >= $${idx}`;
      params.push(filters.fromDate);
      idx++;
    }
    if (filters?.toDate) {
      query += ` AND st.timestamp <= $${idx}`;
      params.push(filters.toDate);
      idx++;
    }

    query += " ORDER BY st.timestamp ASC";

    const result = await erpPool.query(query, params);
    const rows = result.rows;

    // Build running balance
    let running = 0;
    // Get balance before the first transaction if date filters are applied
    if (filters?.fromDate) {
      const beforeResult = await erpPool.query(
        `SELECT COALESCE(SUM(CASE WHEN type IN ('purchase', 'adjustment') THEN amount WHEN type IN ('payment', 'return') THEN -amount ELSE 0 END), 0) as balance
         FROM supplier_transactions WHERE supplier_id = $1 AND timestamp < $2`,
        [supplierId, filters.fromDate]
      );
      running = parseFloat(beforeResult.rows[0].balance) + parseFloat(rows[0]?.opening_balance || 0);
    }

    return rows.map((row: any) => {
      running += parseFloat(row.effect || 0);
      return { ...row, running_balance: running };
    });
  }

  async getTopSuppliers(limit: number = 10): Promise<any[]> {
    const query = `
      SELECT s.id, s.name, s.phone, s.group_name,
        COALESCE(SUM(p.total_amount), 0) as total_purchase_amount,
        COUNT(p.id) as purchase_count
      FROM suppliers s
      LEFT JOIN purchases p ON p.supplier_id = s.id
      WHERE s.status = 'active'
      GROUP BY s.id, s.name, s.phone, s.group_name
      ORDER BY total_purchase_amount DESC
      LIMIT $1
    `;
    const result = await erpPool.query(query, [limit]);
    return result.rows;
  }

  async updateBalance(supplierId: number, amountDiff: number): Promise<void> {
    await erpPool.query(
      "UPDATE suppliers SET balance = balance + $1, updated_at = NOW() WHERE id = $2",
      [amountDiff, supplierId]
    );
  }
}