import { erpPool, ERPEventBus } from "../../../server-erp-core.js";
import { toDateOnly } from "../../common/dateOnly.js";

export class InvoiceRepository {
  private static tablesEnsured = false;
  private static ensurePromise: Promise<void> | null = null;

  constructor() {
    this.ensureTablesExist();
  }

  private async ensureTablesExist(): Promise<void> {
    if (InvoiceRepository.tablesEnsured) return;
    if (InvoiceRepository.ensurePromise) return InvoiceRepository.ensurePromise;

    const invoiceTableDdl = `
      CREATE TABLE IF NOT EXISTS sales_invoices (
        id SERIAL PRIMARY KEY,
        invoice_no VARCHAR(100) UNIQUE NOT NULL,
        order_id INTEGER,
        quotation_id INTEGER,
        customer_id INTEGER,
        customer_name VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        due_date DATE,
        sales_rep VARCHAR(100),
        branch VARCHAR(100),
        branch_id INTEGER DEFAULT 1,
        warehouse_id INTEGER DEFAULT 1,
        warehouse VARCHAR(100),
        currency VARCHAR(50) DEFAULT 'جنيه مصري',
        payment_method VARCHAR(50) DEFAULT 'نقدي',
        notes TEXT,
        status VARCHAR(50) DEFAULT 'مسودة',
        is_posted BOOLEAN DEFAULT false,
        posted_at TIMESTAMP,
        posted_by VARCHAR(100),
        journal_entry_id INTEGER,
        subtotal DECIMAL(12,2) DEFAULT 0,
        discount_total DECIMAL(12,2) DEFAULT 0,
        tax_total DECIMAL(12,2) DEFAULT 0,
        net_amount DECIMAL(12,2) DEFAULT 0,
        total_cost DECIMAL(12,2) DEFAULT 0,
        paid_amount DECIMAL(12,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const itemsTableDdl = `
      CREATE TABLE IF NOT EXISTS sales_invoice_items (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
        item_id INTEGER,
        item_type VARCHAR(50) DEFAULT 'product',
        ingredient_id INTEGER,
        product_id INTEGER,
        barcode VARCHAR(100),
        code VARCHAR(50),
        name VARCHAR(255) NOT NULL,
        unit VARCHAR(50) DEFAULT 'قطعة',
        qty DECIMAL(12,2) NOT NULL,
        price DECIMAL(12,2) NOT NULL,
        unit_cost DECIMAL(12,2) DEFAULT 0,
        total_cost DECIMAL(12,2) DEFAULT 0,
        discount_percent DECIMAL(5,2) DEFAULT 0,
        vat_percent DECIMAL(5,2) DEFAULT 0,
        total DECIMAL(12,2) NOT NULL
      );
    `;

    const paymentsTableDdl = `
      CREATE TABLE IF NOT EXISTS sales_invoice_payments (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
        amount DECIMAL(12,2) NOT NULL,
        method VARCHAR(50),
        notes TEXT,
        paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    InvoiceRepository.ensurePromise = (async () => {
      try {
        await erpPool.query(invoiceTableDdl);
        await erpPool.query(itemsTableDdl);
        await erpPool.query(paymentsTableDdl);

        // Safe alterations to ensure newly added columns exist in existing deployments
        const alterStatements = [
          "ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS quotation_id INTEGER;",
          "ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS delivery_note_id INTEGER;",
          "ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS delivery_note_no VARCHAR(100);",
          "ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS branch_id INTEGER DEFAULT 1;",
          "ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS is_posted BOOLEAN DEFAULT false;",
          "ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS posted_at TIMESTAMP;",
          "ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS posted_by VARCHAR(100);",
          "ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS journal_entry_id INTEGER;",
          "ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS total_cost DECIMAL(12,2) DEFAULT 0;",
          "ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS item_id INTEGER;",
          "ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS item_type VARCHAR(50) DEFAULT 'product';",
          "ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS product_id INTEGER;",
          "ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);",
          "ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(12,2) DEFAULT 0;",
          "ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS total_cost DECIMAL(12,2) DEFAULT 0;"
        ];

        for (const st of alterStatements) {
          try {
            await erpPool.query(st);
          } catch (_) {}
        }

        InvoiceRepository.tablesEnsured = true;
      } catch (err: any) {
        // Handled
      } finally {
        InvoiceRepository.ensurePromise = null;
      }
    })();
    return InvoiceRepository.ensurePromise;
  }

  private mapRow(row: any): any {
    return {
      id: row.id,
      invoiceNo: row.invoice_no,
      orderId: row.order_id,
      quotationId: row.quotation_id,
      deliveryNoteId: row.delivery_note_id,
      deliveryNoteNo: row.delivery_note_no,
      customerId: row.customer_id,
      customerName: row.customer_name,
      date: toDateOnly(row.date),
      dueDate: toDateOnly(row.due_date) || null,
      salesRep: row.sales_rep,
      branch: row.branch,
      branchId: row.branch_id || 1,
      warehouseId: row.warehouse_id || 1,
      warehouse: row.warehouse || "المخزن الرئيسي",
      currency: row.currency || "جنيه مصري",
      paymentMethod: row.payment_method || "نقدي",
      notes: row.notes,
      status: row.status || "مسودة",
      isPosted: Boolean(row.is_posted),
      postedAt: row.posted_at ? new Date(row.posted_at).toISOString() : null,
      postedBy: row.posted_by,
      journalEntryId: row.journal_entry_id,
      subtotal: parseFloat(String(row.subtotal || 0)),
      discountTotal: parseFloat(String(row.discount_total || 0)),
      taxTotal: parseFloat(String(row.tax_total || 0)),
      netAmount: parseFloat(String(row.net_amount || 0)),
      totalCost: parseFloat(String(row.total_cost || 0)),
      paidAmount: parseFloat(String(row.paid_amount || 0)),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
      items: Array.isArray(row.items) ? row.items : []
    };
  }

  async getAll(): Promise<any[]> {
    await this.ensureTablesExist();
    const query = `
      SELECT i.*,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', it.id,
                   'itemId', it.item_id,
                   'itemType', it.item_type,
                   'ingredientId', it.ingredient_id,
                   'productId', it.product_id,
                   'barcode', it.barcode,
                   'code', it.code,
                   'name', it.name,
                   'unit', it.unit,
                   'qty', it.qty,
                   'price', it.price,
                   'unitCost', it.unit_cost,
                   'totalCost', it.total_cost,
                   'discountPercent', it.discount_percent,
                   'vatPercent', it.vat_percent,
                   'total', it.total
                 )
               ) FILTER (WHERE it.id IS NOT NULL),
               '[]'::json
             ) as items
      FROM sales_invoices i
      LEFT JOIN sales_invoice_items it ON i.id = it.invoice_id
      GROUP BY i.id
      ORDER BY i.created_at DESC
    `;
    const result = await erpPool.query(query);
    return result.rows.map((row: any) => this.mapRow(row));
  }

  async getById(id: number, client?: any): Promise<any | null> {
    await this.ensureTablesExist();
    const db = client || erpPool;
    const query = `
      SELECT i.*,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', it.id,
                   'itemId', it.item_id,
                   'itemType', it.item_type,
                   'ingredientId', it.ingredient_id,
                   'productId', it.product_id,
                   'barcode', it.barcode,
                   'code', it.code,
                   'name', it.name,
                   'unit', it.unit,
                   'qty', it.qty,
                   'price', it.price,
                   'unitCost', it.unit_cost,
                   'totalCost', it.total_cost,
                   'discountPercent', it.discount_percent,
                   'vatPercent', it.vat_percent,
                   'total', it.total
                 )
               ) FILTER (WHERE it.id IS NOT NULL),
               '[]'::json
             ) as items
      FROM sales_invoices i
      LEFT JOIN sales_invoice_items it ON i.id = it.invoice_id
      WHERE i.id = $1
      GROUP BY i.id
    `;
    const result = await db.query(query, [id]);
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async create(inv: any, externalClient?: any): Promise<any> {
    await this.ensureTablesExist();
    const shouldManageClient = !externalClient;
    const client = externalClient || (await erpPool.connect());

    try {
      if (shouldManageClient) {
        await client.query("BEGIN");
      }

      let invoiceNo = inv.invoiceNo;
      if (!invoiceNo) {
        // رقم الفاتورة يُحجز من تسلسل حقيقي لا من عدّاد الصفوف: COUNT(*) كان
        // ينقص عند حذف فاتورة فيُعيد استخدام رقم موجود (خطأ مفتاح مكرر) أو
        // يتخطى أرقامًا عند إنشاء فاتورة برقم يدوي، فتنحرف الأرقام عن بعضها
        // وتظهر فاتورة أمر بيع برقم لا يشبه رقم الأمر.
        const year = new Date(inv.date || new Date()).getFullYear();
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtext($1), $2)",
          ["sales-invoice-number", year],
        );
        const sequenceRes = await client.query(
          `SELECT COALESCE(MAX((regexp_match(invoice_no, $1))[1]::bigint), 0) AS sequence
             FROM sales_invoices
            WHERE invoice_no ~ $1`,
          [`^INV-${year}-([0-9]+)$`],
        );
        const nextNum = Number(sequenceRes.rows[0]?.sequence || 0) + 1;
        invoiceNo = `INV-${year}-${String(nextNum).padStart(6, '0')}`;
      }

      const insertInvQuery = `
        INSERT INTO sales_invoices (
          invoice_no, order_id, quotation_id, delivery_note_id, delivery_note_no, customer_id, customer_name, date, due_date,
          sales_rep, branch, branch_id, warehouse_id, warehouse, currency, payment_method,
          notes, status, is_posted, posted_at, posted_by, journal_entry_id,
          subtotal, discount_total, tax_total, net_amount, total_cost, paid_amount
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
        RETURNING *
      `;

      const invResult = await client.query(insertInvQuery, [
        invoiceNo,
        inv.orderId || null,
        inv.quotationId || null,
        inv.deliveryNoteId || null,
        inv.deliveryNoteNo || null,
        inv.customerId || null,
        inv.customerName,
        inv.date || new Date(),
        inv.dueDate || null,
        inv.salesRep || null,
        inv.branch || null,
        inv.branchId || 1,
        inv.warehouseId || 1,
        inv.warehouse || "المخزن الرئيسي",
        inv.currency || "جنيه مصري",
        inv.paymentMethod || "نقدي",
        inv.notes || null,
        inv.status || "مسودة",
        Boolean(inv.isPosted),
        inv.postedAt || null,
        inv.postedBy || null,
        inv.journalEntryId || null,
        inv.subtotal || 0,
        inv.discountTotal || 0,
        inv.taxTotal || 0,
        inv.netAmount || 0,
        inv.totalCost || 0,
        inv.paidAmount || 0
      ]);

      const insertedInv = invResult.rows[0];

      if (inv.items && inv.items.length > 0) {
        for (const item of inv.items) {
          const insertItemQuery = `
            INSERT INTO sales_invoice_items (
              invoice_id, item_id, item_type, ingredient_id, product_id, barcode,
              code, name, unit, qty, price, unit_cost, total_cost, discount_percent, vat_percent, total
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          `;
          await client.query(insertItemQuery, [
            insertedInv.id,
            item.itemId || null,
            item.itemType || "product",
            item.ingredientId || null,
            item.productId || null,
            item.barcode || null,
            item.code || null,
            item.name,
            item.unit || "قطعة",
            item.qty,
            item.price,
            item.unitCost || 0,
            item.totalCost || 0,
            item.discountPercent || 0,
            item.vatPercent !== undefined && item.vatPercent !== null ? item.vatPercent : 0,
            item.total
          ]);
        }
      }

      if (shouldManageClient) {
        await client.query("COMMIT");
      }

      return this.getById(insertedInv.id, client);
    } catch (error) {
      if (shouldManageClient) {
        await client.query("ROLLBACK");
      }
      throw error;
    } finally {
      if (shouldManageClient) {
        client.release();
      }
    }
  }

  async update(id: number, inv: any, externalClient?: any): Promise<any> {
    await this.ensureTablesExist();
    const shouldManageClient = !externalClient;
    const client = externalClient || (await erpPool.connect());

    try {
      if (shouldManageClient) {
        await client.query("BEGIN");
      }

      const updateInvQuery = `
        UPDATE sales_invoices
        SET customer_id = $1, customer_name = $2, date = $3, due_date = $4,
            sales_rep = $5, branch = $6, branch_id = $7, warehouse_id = $8, warehouse = $9,
            currency = $10, payment_method = $11, notes = $12, status = $13,
            is_posted = $14, posted_at = $15, posted_by = $16, journal_entry_id = $17,
            subtotal = $18, discount_total = $19, tax_total = $20, net_amount = $21,
            total_cost = $22, paid_amount = $23
        WHERE id = $24
        RETURNING *
      `;

      await client.query(updateInvQuery, [
        inv.customerId || null,
        inv.customerName,
        inv.date || new Date(),
        inv.dueDate || null,
        inv.salesRep || null,
        inv.branch || null,
        inv.branchId || 1,
        inv.warehouseId || 1,
        inv.warehouse || "المخزن الرئيسي",
        inv.currency || "جنيه مصري",
        inv.paymentMethod || "نقدي",
        inv.notes || null,
        inv.status || "مسودة",
        Boolean(inv.isPosted),
        inv.postedAt || null,
        inv.postedBy || null,
        inv.journalEntryId || null,
        inv.subtotal || 0,
        inv.discountTotal || 0,
        inv.taxTotal || 0,
        inv.netAmount || 0,
        inv.totalCost || 0,
        inv.paidAmount || 0,
        id
      ]);

      if (inv.items) {
        await client.query("DELETE FROM sales_invoice_items WHERE invoice_id = $1", [id]);

        for (const item of inv.items) {
          const insertItemQuery = `
            INSERT INTO sales_invoice_items (
              invoice_id, item_id, item_type, ingredient_id, product_id, barcode,
              code, name, unit, qty, price, unit_cost, total_cost, discount_percent, vat_percent, total
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          `;
          await client.query(insertItemQuery, [
            id,
            item.itemId || null,
            item.itemType || "product",
            item.ingredientId || null,
            item.productId || null,
            item.barcode || null,
            item.code || null,
            item.name,
            item.unit || "قطعة",
            item.qty,
            item.price,
            item.unitCost || 0,
            item.totalCost || 0,
            item.discountPercent || 0,
            item.vatPercent !== undefined && item.vatPercent !== null ? item.vatPercent : 0,
            item.total
          ]);
        }
      }

      if (shouldManageClient) {
        await client.query("COMMIT");
      }

      return this.getById(id, client);
    } catch (error) {
      if (shouldManageClient) {
        await client.query("ROLLBACK");
      }
      throw error;
    } finally {
      if (shouldManageClient) {
        client.release();
      }
    }
  }

  async delete(id: number): Promise<void> {
    await this.ensureTablesExist();
    await erpPool.query("DELETE FROM sales_invoices WHERE id = $1", [id]);
  }

  async recordPayment(invoiceId: number, amount: number, method?: string, notes?: string, externalClient?: any): Promise<any> {
    await this.ensureTablesExist();
    const shouldManageClient = !externalClient;
    const client = externalClient || (await erpPool.connect());

    try {
      if (shouldManageClient) {
        await client.query("BEGIN");
      }

      await client.query(
        `INSERT INTO sales_invoice_payments (invoice_id, amount, method, notes) VALUES ($1, $2, $3, $4)`,
        [invoiceId, amount, method || null, notes || null]
      );

      const updateResult = await client.query(
        `UPDATE sales_invoices
         SET paid_amount = paid_amount + $1,
             status = CASE
               WHEN paid_amount + $1 >= net_amount THEN 'مدفوعة'
               WHEN paid_amount + $1 > 0 THEN 'مدفوعة جزئياً'
               ELSE status
             END
         WHERE id = $2
         RETURNING *`,
        [amount, invoiceId]
      );

      if (shouldManageClient) {
        await client.query("COMMIT");
      }

      return updateResult.rows[0];
    } catch (error) {
      if (shouldManageClient) {
        await client.query("ROLLBACK");
      }
      throw error;
    } finally {
      if (shouldManageClient) {
        client.release();
      }
    }
  }
}
