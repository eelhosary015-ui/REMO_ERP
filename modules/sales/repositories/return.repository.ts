import { erpPool } from "../../../server-erp-core.js";
import { toDateOnly } from "../../common/dateOnly.js";

export class ReturnRepository {
  private static tablesEnsured = false;
  private static ensurePromise: Promise<void> | null = null;

  constructor() {}

  public async ensureTablesExist(): Promise<void> {
    if (ReturnRepository.tablesEnsured) return;
    if (ReturnRepository.ensurePromise) return ReturnRepository.ensurePromise;

    const returnTableDdl = `
      CREATE TABLE IF NOT EXISTS sales_returns (
        id SERIAL PRIMARY KEY,
        return_no TEXT UNIQUE NOT NULL,
        invoice_id TEXT,
        customer_name TEXT NOT NULL,
        date DATE NOT NULL,
        reason TEXT,
        return_type TEXT,
        refund_method TEXT,
        sales_rep TEXT,
        warehouse TEXT,
        notes TEXT,
        status TEXT DEFAULT 'مسودة',
        items_total DECIMAL(10,2) DEFAULT 0.00,
        discount_total DECIMAL(10,2) DEFAULT 0.00,
        tax_total DECIMAL(10,2) DEFAULT 0.00,
        expenses DECIMAL(10,2) DEFAULT 0.00,
        grand_total DECIMAL(10,2) DEFAULT 0.00,
        total_cost DECIMAL(12,2) DEFAULT 0.00,
        journal_entry_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const itemsTableDdl = `
      CREATE TABLE IF NOT EXISTS sales_return_items (
        id SERIAL PRIMARY KEY,
        return_id INTEGER NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
        item_code TEXT NOT NULL,
        item_name TEXT NOT NULL,
        unit TEXT,
        qty_invoiced DECIMAL(10,2) NOT NULL,
        qty_returned DECIMAL(10,2) NOT NULL,
        discount DECIMAL(10,2) DEFAULT 0.00,
        tax_rate DECIMAL(10,2) DEFAULT 0.00,
        price DECIMAL(10,2) NOT NULL,
        total DECIMAL(10,2) NOT NULL,
        unit_cost DECIMAL(12,4) DEFAULT 0.00,
        total_cost DECIMAL(12,2) DEFAULT 0.00
      )
    `;

    ReturnRepository.ensurePromise = (async () => {
      try {
        await erpPool.query(returnTableDdl);
        await erpPool.query(itemsTableDdl);
        await erpPool.query(`
          ALTER TABLE sales_returns
            ADD COLUMN IF NOT EXISTS total_cost DECIMAL(12,2) DEFAULT 0.00,
            ADD COLUMN IF NOT EXISTS journal_entry_id INTEGER,
            ADD COLUMN IF NOT EXISTS customer_id INTEGER,
            ADD COLUMN IF NOT EXISTS warehouse_id INTEGER,
            ADD COLUMN IF NOT EXISTS branch_id INTEGER DEFAULT 1,
            ADD COLUMN IF NOT EXISTS invoice_no TEXT,
            ADD COLUMN IF NOT EXISTS order_id INTEGER,
            ADD COLUMN IF NOT EXISTS order_no TEXT,
            ADD COLUMN IF NOT EXISTS treasury_transaction_id INTEGER,
            ADD COLUMN IF NOT EXISTS financial_transaction_id INTEGER,
            ADD COLUMN IF NOT EXISTS fin_number TEXT;
          ALTER TABLE sales_return_items
            ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(12,4) DEFAULT 0.00,
            ADD COLUMN IF NOT EXISTS total_cost DECIMAL(12,2) DEFAULT 0.00,
            ADD COLUMN IF NOT EXISTS invoice_item_id INTEGER,
            ADD COLUMN IF NOT EXISTS product_id INTEGER,
            ADD COLUMN IF NOT EXISTS ingredient_id INTEGER;
        `);
        ReturnRepository.tablesEnsured = true;
      } catch (err: any) {
        // Handled via pool
      } finally {
        ReturnRepository.ensurePromise = null;
      }
    })();
    return ReturnRepository.ensurePromise;
  }

  async getAll(): Promise<any[]> {
    await this.ensureTablesExist();

    const query = `
      SELECT r.*,
             si.id AS original_invoice_id,
             si.invoice_no AS original_invoice_no,
             si.order_id AS original_order_id,
             so.order_no AS original_order_no,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', i.id,
                   'invoiceItemId', i.invoice_item_id,
                   'productId', i.product_id,
                   'ingredientId', i.ingredient_id,
                   'itemCode', i.item_code,
                   'itemName', i.item_name,
                   'unit', i.unit,
                   'qtyInvoiced', i.qty_invoiced,
                   'qtyReturned', i.qty_returned,
                   'discount', i.discount,
                   'taxRate', i.tax_rate,
                   'price', i.price,
                   'unitCost', i.unit_cost,
                   'totalCost', i.total_cost,
                   'total', i.total
                 )
               ) FILTER (WHERE i.id IS NOT NULL),
               '[]'::json
             ) AS items
      FROM sales_returns r
      LEFT JOIN sales_return_items i ON r.id = i.return_id
      /*
       * يربط المرتجع بفاتورته الأصلية بقرار حتمي واحد (أولوية الرقم المحفوظ ثم
       * المعرّف الداخلي) بدل أي شرط يطابق أكثر من فاتورة فيكرّر صف المرتجع
       * ويعرض رقم فاتورة أخرى.
       */
      LEFT JOIN LATERAL (
        SELECT s.id, s.invoice_no, s.order_id
          FROM sales_invoices s
         WHERE s.id::text = REGEXP_REPLACE(r.invoice_id, '^INV-0*', '', 'i')
            OR s.id::text = r.invoice_id
            OR (r.invoice_no IS NOT NULL AND s.invoice_no = r.invoice_no)
            OR s.invoice_no ILIKE r.invoice_id
         ORDER BY CASE
                    WHEN r.invoice_no IS NOT NULL AND s.invoice_no = r.invoice_no THEN 0
                    WHEN s.id::text = REGEXP_REPLACE(r.invoice_id, '^INV-0*', '', 'i') THEN 1
                    WHEN s.id::text = r.invoice_id THEN 2
                    ELSE 3
                  END,
                  s.id ASC
         LIMIT 1
      ) si ON true
      LEFT JOIN erp_sales_orders so ON so.id = si.order_id
      GROUP BY r.id, si.id, si.invoice_no, si.order_id, so.order_no
      ORDER BY r.created_at DESC
    `;
    const result = await erpPool.query(query);
    const returnsList = await Promise.all(result.rows.map(async (row: any) => {
      let items = Array.isArray(row.items) && row.items.length > 0 ? row.items : [];
      if (items.length === 0) {
        try {
          const itemRows = await erpPool.query(
            "SELECT * FROM sales_return_items WHERE return_id = $1 ORDER BY id ASC",
            [row.id]
          );
          items = itemRows.rows.map((i: any) => ({
            id: i.id,
            invoiceItemId: i.invoice_item_id || i.invoiceItemId || i.id,
            productId: i.product_id || i.productId || null,
            ingredientId: i.ingredient_id || i.ingredientId || null,
            itemCode: i.item_code || i.itemCode || "ITEM",
            itemName: i.item_name || i.itemName || "صنف",
            unit: i.unit || "قطعة",
            qtyInvoiced: Number(i.qty_invoiced || i.qtyInvoiced || 0),
            qtyReturned: Number(i.qty_returned || i.qtyReturned || 0),
            remainingQty: Math.max(0, Number(i.qty_invoiced || i.qtyInvoiced || 0) - Number(i.qty_returned || i.qtyReturned || 0)),
            discount: Number(i.discount || 0),
            taxRate: Number(i.tax_rate || i.taxRate || 0),
            price: Number(i.price || 0),
            unitCost: Number(i.unit_cost || i.unitCost || 0),
            totalCost: Number(i.total_cost || i.totalCost || 0),
            total: Number(i.total || 0),
          }));
        } catch (_) {}
      }
      return this.mapRow(row, items);
    }));
    return returnsList;
  }

  /**
   * يحوّل صف قاعدة البيانات إلى مستند مرتجع.
   * رقم الفاتورة المعروض يأتي دائمًا من مستند الفاتورة نفسه (invoice_no) وليس
   * من أي معرّف داخلي، ومعرّف الفاتورة يُعاد حلّه إلى الفاتورة الحقيقية.
   */
  private mapRow(row: any, items: any[]): any {
    return {
      id: row.id,
      returnNo: row.return_no,
      invoiceId: row.original_invoice_id ? String(row.original_invoice_id) : row.invoice_id,
      invoiceNo: row.invoice_no || row.original_invoice_no || row.invoice_id,
      orderId: row.order_id || row.original_order_id || null,
      orderNo: row.order_no || row.original_order_no || null,
      customerId: row.customer_id,
      customerName: row.customer_name,
      date: toDateOnly(row.date),
      reason: row.reason,
      returnType: row.return_type,
      refundMethod: row.refund_method,
      salesRep: row.sales_rep,
      warehouse: row.warehouse,
      warehouseId: row.warehouse_id,
      branchId: row.branch_id || 1,
      notes: row.notes,
      status: row.status,
      itemsTotal: parseFloat(row.items_total || 0),
      discountTotal: parseFloat(row.discount_total || 0),
      taxTotal: parseFloat(row.tax_total || 0),
      expenses: parseFloat(row.expenses || 0),
      grandTotal: parseFloat(row.grand_total || 0),
      totalCost: parseFloat(row.total_cost || 0),
      journalEntryId: row.journal_entry_id,
      treasuryTransactionId: row.treasury_transaction_id || null,
      financialTransactionId: row.financial_transaction_id || null,
      finNumber: row.fin_number || null,
      items
    };
  }

  async getById(id: number): Promise<any | null> {
    await this.ensureTablesExist();
    const query = `
      SELECT r.*,
             si.id AS original_invoice_id,
             si.invoice_no AS original_invoice_no,
             si.order_id AS original_order_id,
             so.order_no AS original_order_no,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', i.id,
                   'invoiceItemId', i.invoice_item_id,
                   'productId', i.product_id,
                   'ingredientId', i.ingredient_id,
                   'itemCode', i.item_code,
                   'itemName', i.item_name,
                   'unit', i.unit,
                   'qtyInvoiced', i.qty_invoiced,
                   'qtyReturned', i.qty_returned,
                   'discount', i.discount,
                   'taxRate', i.tax_rate,
                   'price', i.price,
                   'unitCost', i.unit_cost,
                   'totalCost', i.total_cost,
                   'total', i.total
                 )
               ) FILTER (WHERE i.id IS NOT NULL),
               '[]'::json
             ) as items
      FROM sales_returns r
      LEFT JOIN sales_return_items i ON r.id = i.return_id
      LEFT JOIN LATERAL (
        SELECT s.id, s.invoice_no, s.order_id
          FROM sales_invoices s
         WHERE s.id::text = REGEXP_REPLACE(r.invoice_id, '^INV-0*', '', 'i')
            OR s.id::text = r.invoice_id
            OR (r.invoice_no IS NOT NULL AND s.invoice_no = r.invoice_no)
            OR s.invoice_no ILIKE r.invoice_id
         ORDER BY CASE
                    WHEN r.invoice_no IS NOT NULL AND s.invoice_no = r.invoice_no THEN 0
                    WHEN s.id::text = REGEXP_REPLACE(r.invoice_id, '^INV-0*', '', 'i') THEN 1
                    WHEN s.id::text = r.invoice_id THEN 2
                    ELSE 3
                  END,
                  s.id ASC
         LIMIT 1
      ) si ON true
      LEFT JOIN erp_sales_orders so ON so.id = si.order_id
      WHERE r.id = $1
      GROUP BY r.id, si.id, si.invoice_no, si.order_id, so.order_no
    `;
    const result = await erpPool.query(query, [id]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];

    let items = Array.isArray(row.items) && row.items.length > 0 ? row.items : [];
    if (items.length === 0) {
      try {
        const itemRows = await erpPool.query(
          "SELECT * FROM sales_return_items WHERE return_id = $1 ORDER BY id ASC",
          [id]
        );
        items = itemRows.rows.map((i: any) => ({
          id: i.id,
          invoiceItemId: i.invoice_item_id || i.invoiceItemId || i.id,
          productId: i.product_id || i.productId || null,
          ingredientId: i.ingredient_id || i.ingredientId || null,
          itemCode: i.item_code || i.itemCode || "ITEM",
          itemName: i.item_name || i.itemName || "صنف",
          unit: i.unit || "قطعة",
          qtyInvoiced: Number(i.qty_invoiced || i.qtyInvoiced || 0),
          qtyReturned: Number(i.qty_returned || i.qtyReturned || 0),
          remainingQty: Math.max(0, Number(i.qty_invoiced || i.qtyInvoiced || 0) - Number(i.qty_returned || i.qtyReturned || 0)),
          discount: Number(i.discount || 0),
          taxRate: Number(i.tax_rate || i.taxRate || 0),
          price: Number(i.price || 0),
          unitCost: Number(i.unit_cost || i.unitCost || 0),
          totalCost: Number(i.total_cost || i.totalCost || 0),
          total: Number(i.total || 0),
        }));
      } catch (_) {}
    }

    return this.mapRow(row, items);
  }

  async create(ret: any, externalClient?: any): Promise<any> {
    await this.ensureTablesExist();
    const shouldManageClient = !externalClient;
    const client = externalClient || await erpPool.connect();
    try {
      if (shouldManageClient) await client.query("BEGIN");

      // رقم المرتجع يُحجز دائمًا من قاعدة البيانات: الرقم القادم من الواجهة يُقبل
      // فقط إذا كان غير مستخدم. الاعتماد على عدّاد الواجهة كان ينشئ خطأ تكرار
      // المفتاح (أو أرقامًا مكررة لمرتجعات مختلفة) عند حذف أي مرتجع.
      const year = new Date(ret.date || new Date()).getFullYear();
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext($1), $2)",
        ["sales-return-number", year],
      );

      let returnNo = typeof ret.returnNo === "string" && ret.returnNo.trim() ? ret.returnNo.trim() : null;
      if (returnNo) {
        const duplicate = await client.query(
          "SELECT 1 FROM sales_returns WHERE return_no = $1 LIMIT 1",
          [returnNo],
        );
        if (duplicate.rows.length > 0) returnNo = null;
      }
      if (!returnNo) {
        const sequenceRes = await client.query(
          `SELECT COALESCE(MAX((regexp_match(return_no, $1))[1]::bigint), 0) AS sequence
             FROM sales_returns
            WHERE return_no ~ $1`,
          [`^SR-${year}-([0-9]+)$`],
        );
        const nextNum = Number(sequenceRes.rows[0]?.sequence || 0) + 1;
        returnNo = `SR-${year}-${String(nextNum).padStart(6, '0')}`;
      }

      const insertRetQuery = `
        INSERT INTO sales_returns (
          return_no, invoice_id, invoice_no, order_id, order_no, customer_name, date, reason, 
          return_type, refund_method, sales_rep, warehouse, notes, status, 
          items_total, discount_total, tax_total, expenses, grand_total, total_cost,
          customer_id, warehouse_id, branch_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
        RETURNING *
      `;

      const retResult = await client.query(insertRetQuery, [
        returnNo,
        ret.invoiceId ? String(ret.invoiceId) : null,
        ret.invoiceNo || null,
        ret.orderId || null,
        ret.orderNo || null,
        ret.customerName,
        ret.date || new Date(),
        ret.reason || null,
        ret.returnType || null,
        ret.refundMethod || null,
        ret.salesRep || null,
        ret.warehouse || null,
        ret.notes || null,
        ret.status || 'مسودة',
        ret.itemsTotal || 0,
        ret.discountTotal || 0,
        ret.taxTotal || 0,
        ret.expenses || 0,
        ret.grandTotal || 0,
        ret.totalCost || 0,
        ret.customerId || null,
        ret.warehouseId || null,
        ret.branchId || 1
      ]);

      const insertedRet = retResult.rows[0];

      if (ret.items && ret.items.length > 0) {
        for (const item of ret.items) {
          const insertItemQuery = `
            INSERT INTO sales_return_items (
              return_id, item_code, item_name, unit, qty_invoiced, qty_returned, discount, tax_rate, price, total, unit_cost, total_cost,
              invoice_item_id, product_id, ingredient_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          `;
          await client.query(insertItemQuery, [
            insertedRet.id,
            item.itemCode,
            item.itemName,
            item.unit || 'قطعة',
            item.qtyInvoiced,
            item.qtyReturned,
            item.discount || 0,
            item.taxRate || 0,
            item.price,
            item.total,
            item.unitCost || 0,
            item.totalCost || 0,
            item.invoiceItemId || null,
            item.productId || null,
            item.ingredientId || null
          ]);
        }
      }

      if (shouldManageClient) await client.query("COMMIT");
      return insertedRet;
    } catch (error) {
      if (shouldManageClient) await client.query("ROLLBACK");
      throw error;
    } finally {
      if (shouldManageClient) client.release();
    }
  }

  async update(id: number, ret: any, externalClient?: any): Promise<any> {
    await this.ensureTablesExist();
    const shouldManageClient = !externalClient;
    const client = externalClient || await erpPool.connect();
    try {
      if (shouldManageClient) await client.query("BEGIN");

      const updateRetQuery = `
        UPDATE sales_returns
        SET invoice_id = $1, customer_name = $2, date = $3, reason = $4, 
            return_type = $5, refund_method = $6, sales_rep = $7, warehouse = $8, 
            notes = $9, status = $10, items_total = $11, discount_total = $12, 
            tax_total = $13, expenses = $14, grand_total = $15,
            customer_id = COALESCE($16, customer_id),
            warehouse_id = COALESCE($17, warehouse_id),
            branch_id = COALESCE($18, branch_id)
        WHERE id = $19
        RETURNING *
      `;

      const retResult = await client.query(updateRetQuery, [
        ret.invoiceId || null,
        ret.customerName,
        ret.date || new Date(),
        ret.reason || null,
        ret.returnType || null,
        ret.refundMethod || null,
        ret.salesRep || null,
        ret.warehouse || null,
        ret.notes || null,
        ret.status || 'مسودة',
        ret.itemsTotal || 0,
        ret.discountTotal || 0,
        ret.taxTotal || 0,
        ret.expenses || 0,
        ret.grandTotal || 0,
        ret.customerId || null,
        ret.warehouseId || null,
        ret.branchId || null,
        id
      ]);

      // Delete old items and insert updated ones
      await client.query("DELETE FROM sales_return_items WHERE return_id = $1", [id]);

      if (ret.items && ret.items.length > 0) {
        for (const item of ret.items) {
          const insertItemQuery = `
            INSERT INTO sales_return_items (
              return_id, item_code, item_name, unit, qty_invoiced, qty_returned, discount, tax_rate, price, total,
              unit_cost, total_cost, invoice_item_id, product_id, ingredient_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          `;
          await client.query(insertItemQuery, [
            id,
            item.itemCode || item.code || "ITEM",
            item.itemName || item.name || "صنف",
            item.unit || 'قطعة',
            item.qtyInvoiced ?? 0,
            item.qtyReturned,
            item.discount || 0,
            item.taxRate || 0,
            item.price,
            item.total,
            item.unitCost || 0,
            item.totalCost || 0,
            item.invoiceItemId || null,
            item.productId || null,
            item.ingredientId || null
          ]);
        }
      }

      if (shouldManageClient) await client.query("COMMIT");
      return retResult.rows[0];
    } catch (error) {
      if (shouldManageClient) await client.query("ROLLBACK");
      throw error;
    } finally {
      if (shouldManageClient) client.release();
    }
  }

  async delete(id: number): Promise<void> {
    await this.ensureTablesExist();
    await erpPool.query("DELETE FROM sales_returns WHERE id = $1", [id]);
  }
}
