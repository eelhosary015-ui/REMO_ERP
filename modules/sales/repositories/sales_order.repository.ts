import { erpPool } from "../../../server-erp-core.js";
import { toDateOnly } from "../../common/dateOnly.js";

export class SalesOrderRepository {
  private static tablesEnsured = false;
  private static ensurePromise: Promise<void> | null = null;

  constructor() {
    this.ensureTablesExist();
  }

  private async ensureTablesExist(): Promise<void> {
    if (SalesOrderRepository.tablesEnsured) return;
    if (SalesOrderRepository.ensurePromise) return SalesOrderRepository.ensurePromise;

    const orderTableDdl = `
      CREATE TABLE IF NOT EXISTS erp_sales_orders (
        id SERIAL PRIMARY KEY,
        order_no VARCHAR(100) UNIQUE NOT NULL,
        quotation_id INTEGER,
        customer_id INTEGER,
        customer_name VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        delivery_date DATE,
        sales_rep VARCHAR(100),
        payment_method VARCHAR(50),
        branch VARCHAR(100),
        branch_id INTEGER DEFAULT 1,
        warehouse VARCHAR(100),
        warehouse_id INTEGER DEFAULT 1,
        currency VARCHAR(50),
        notes TEXT,
        status VARCHAR(50) DEFAULT 'مفتوح',
        delivery_status VARCHAR(50) DEFAULT 'غير مسلم',
        invoice_status VARCHAR(50) DEFAULT 'غير مفوتر',
        payment_status VARCHAR(50) DEFAULT 'غير مسدد',
        total_qty DECIMAL(12,2) DEFAULT 0,
        total_amount DECIMAL(12,2) DEFAULT 0,
        delivered_qty DECIMAL(12,2) DEFAULT 0,
        remaining_qty DECIMAL(12,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const itemsTableDdl = `
      CREATE TABLE IF NOT EXISTS erp_sales_order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES erp_sales_orders(id) ON DELETE CASCADE,
        ingredient_id INTEGER,
        product_id INTEGER,
        item_code VARCHAR(50),
        item_name VARCHAR(255) NOT NULL,
        unit VARCHAR(50) DEFAULT 'قطعة',
        qty_required DECIMAL(12,2) NOT NULL,
        qty_available DECIMAL(12,2) DEFAULT 0,
        qty_reserved DECIMAL(12,2) DEFAULT 0,
        qty_delivered DECIMAL(12,2) DEFAULT 0,
        price DECIMAL(12,2) NOT NULL,
        unit_cost DECIMAL(12,2) DEFAULT 0,
        discount_percent DECIMAL(5,2) DEFAULT 0,
        vat_percent DECIMAL(5,2) DEFAULT 0,
        total DECIMAL(12,2) NOT NULL
      )
    `;

    SalesOrderRepository.ensurePromise = (async () => {
      try {
        await erpPool.query(orderTableDdl);
        await erpPool.query(itemsTableDdl);

        // Safe alterations to ensure columns exist on existing DBs
        await erpPool.query(`
          ALTER TABLE erp_sales_orders ADD COLUMN IF NOT EXISTS quotation_id INTEGER;
          ALTER TABLE erp_sales_orders ADD COLUMN IF NOT EXISTS customer_id INTEGER;
          ALTER TABLE erp_sales_orders ADD COLUMN IF NOT EXISTS branch_id INTEGER DEFAULT 1;
          ALTER TABLE erp_sales_orders ADD COLUMN IF NOT EXISTS warehouse_id INTEGER DEFAULT 1;
          ALTER TABLE erp_sales_orders ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(50) DEFAULT 'غير مسلم';
          ALTER TABLE erp_sales_orders ADD COLUMN IF NOT EXISTS invoice_status VARCHAR(50) DEFAULT 'غير مفوتر';
          ALTER TABLE erp_sales_orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'غير مسدد';
          ALTER TABLE erp_sales_order_items ADD COLUMN IF NOT EXISTS ingredient_id INTEGER;
          ALTER TABLE erp_sales_order_items ADD COLUMN IF NOT EXISTS product_id INTEGER;
          ALTER TABLE erp_sales_order_items ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(12,2) DEFAULT 0;
          ALTER TABLE erp_sales_order_items ADD COLUMN IF NOT EXISTS vat_percent DECIMAL(5,2) DEFAULT 0;
        `);

        SalesOrderRepository.tablesEnsured = true;
      } catch (err: any) {
        // Handled via pool
      } finally {
        SalesOrderRepository.ensurePromise = null;
      }
    })();
    return SalesOrderRepository.ensurePromise;
  }

  private mapOrderRow(row: any): any {
    return {
      id: row.id,
      orderNo: row.order_no,
      quotationId: row.quotation_id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      date: toDateOnly(row.date),
      deliveryDate: toDateOnly(row.delivery_date) || null,
      salesRep: row.sales_rep,
      paymentMethod: row.payment_method,
      branch: row.branch,
      branchId: row.branch_id || 1,
      warehouse: row.warehouse,
      warehouseId: row.warehouse_id || 1,
      currency: row.currency,
      notes: row.notes,
      status: row.status,
      deliveryStatus: row.delivery_status || 'غير مسلم',
      invoiceStatus: row.invoice_status || 'غير مفوتر',
      paymentStatus: row.payment_status || 'غير مسدد',
      totalQty: parseFloat(row.total_qty || 0),
      totalAmount: parseFloat(row.total_amount || 0),
      deliveredQty: parseFloat(row.delivered_qty || 0),
      remainingQty: parseFloat(row.remaining_qty || 0),
      items: row.items || []
    };
  }

  async getAll(): Promise<any[]> {
    await this.ensureTablesExist();

    const query = `
      SELECT o.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', i.id,
                   'ingredientId', i.ingredient_id,
                   'productId', i.product_id,
                   'itemCode', i.item_code,
                   'itemName', i.item_name,
                   'unit', i.unit,
                   'qtyRequired', i.qty_required,
                   'qtyAvailable', i.qty_available,
                   'qtyReserved', i.qty_reserved,
                   'qtyDelivered', i.qty_delivered,
                   'price', i.price,
                   'unitCost', i.unit_cost,
                   'discountPercent', i.discount_percent,
                   'vatPercent', i.vat_percent,
                   'total', i.total
                 )
               ) FILTER (WHERE i.id IS NOT NULL), 
               '[]'::json
             ) as items
      FROM erp_sales_orders o
      LEFT JOIN erp_sales_order_items i ON o.id = i.order_id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `;
    const result = await erpPool.query(query);
    return result.rows.map((row: any) => this.mapOrderRow(row));
  }

  async getById(id: number): Promise<any | null> {
    await this.ensureTablesExist();
    const query = `
      SELECT o.*,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', i.id,
                   'ingredientId', i.ingredient_id,
                   'productId', i.product_id,
                   'itemCode', i.item_code,
                   'itemName', i.item_name,
                   'unit', i.unit,
                   'qtyRequired', i.qty_required,
                   'qtyAvailable', i.qty_available,
                   'qtyReserved', i.qty_reserved,
                   'qtyDelivered', i.qty_delivered,
                   'price', i.price,
                   'unitCost', i.unit_cost,
                   'discountPercent', i.discount_percent,
                   'vatPercent', i.vat_percent,
                   'total', i.total
                 )
               ) FILTER (WHERE i.id IS NOT NULL),
               '[]'::json
             ) as items
      FROM erp_sales_orders o
      LEFT JOIN erp_sales_order_items i ON o.id = i.order_id
      WHERE o.id = $1
      GROUP BY o.id
    `;
    const result = await erpPool.query(query, [id]);
    if (result.rows.length === 0) return null;
    return this.mapOrderRow(result.rows[0]);
  }

  async getByOrderNo(orderNo: string): Promise<any | null> {
    await this.ensureTablesExist();
    const query = `
      SELECT o.*,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', i.id,
                   'ingredientId', i.ingredient_id,
                   'productId', i.product_id,
                   'itemCode', i.item_code,
                   'itemName', i.item_name,
                   'unit', i.unit,
                   'qtyRequired', i.qty_required,
                   'qtyAvailable', i.qty_available,
                   'qtyReserved', i.qty_reserved,
                   'qtyDelivered', i.qty_delivered,
                   'price', i.price,
                   'unitCost', i.unit_cost,
                   'discountPercent', i.discount_percent,
                   'vatPercent', i.vat_percent,
                   'total', i.total
                 )
               ) FILTER (WHERE i.id IS NOT NULL),
               '[]'::json
             ) as items
      FROM erp_sales_orders o
      LEFT JOIN erp_sales_order_items i ON o.id = i.order_id
      WHERE o.order_no = $1
      GROUP BY o.id
    `;
    const result = await erpPool.query(query, [orderNo]);
    if (result.rows.length === 0) return null;
    return this.mapOrderRow(result.rows[0]);
  }

  async create(order: any): Promise<any> {
    await this.ensureTablesExist();
    const client = await erpPool.connect();
    try {
      await client.query("BEGIN");

      // رقم أمر البيع المُرسل من الواجهة يُقبل فقط إذا لم يكن مستخدمًا بالفعل،
      // ثم يُولّد الخادم رقمًا من تسلسله لتجنب خطأ مفتاح مكرر على order_no.
      let orderNo = typeof order.orderNo === "string" && order.orderNo.trim() ? order.orderNo.trim() : null;
      if (orderNo) {
        const duplicate = await client.query(
          "SELECT 1 FROM erp_sales_orders WHERE order_no = $1 LIMIT 1",
          [orderNo],
        );
        if (duplicate.rows.length > 0) orderNo = null;
      }
      if (!orderNo) {
        // نفس منطق ترقيم الفواتير: تسلسل حقيقي من أعلى رقم مستخدم للسنة الحالية
        // بدلاً من COUNT(*) + 125 الذي كان يتخطى أرقامًا ويثبّت السنة على 2024.
        const year = new Date(order.date || new Date()).getFullYear();
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtext($1), $2)",
          ["sales-order-number", year],
        );
        const sequenceRes = await client.query(
          `SELECT COALESCE(MAX((regexp_match(order_no, $1))[1]::bigint), 0) AS sequence
             FROM erp_sales_orders
            WHERE order_no ~ $1`,
          [`^SO-${year}-([0-9]+)$`],
        );
        const nextNum = Number(sequenceRes.rows[0]?.sequence || 0) + 1;
        orderNo = `SO-${year}-${String(nextNum).padStart(4, '0')}`;
      }

      const insertOrderQuery = `
        INSERT INTO erp_sales_orders (
          order_no, quotation_id, customer_id, customer_name, date, delivery_date, sales_rep, 
          payment_method, branch, branch_id, warehouse, warehouse_id, currency, notes, status, 
          delivery_status, invoice_status, payment_status,
          total_qty, total_amount, delivered_qty, remaining_qty
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        RETURNING *
      `;

      const orderResult = await client.query(insertOrderQuery, [
        orderNo,
        order.quotationId || null,
        order.customerId || null,
        order.customerName,
        order.date || new Date(),
        order.deliveryDate || null,
        order.salesRep || null,
        order.paymentMethod || 'نقدي',
        order.branch || 'الفرع الرئيسي',
        order.branchId || 1,
        order.warehouse || 'المخزن الرئيسي',
        order.warehouseId || 1,
        order.currency || 'جنيه مصري',
        order.notes || null,
        order.status || 'مفتوح',
        order.deliveryStatus || 'غير مسلم',
        order.invoiceStatus || 'غير مفوتر',
        order.paymentStatus || 'غير مسدد',
        order.totalQty || 0,
        order.totalAmount || 0,
        order.deliveredQty || 0,
        order.remainingQty !== undefined ? order.remainingQty : (order.totalQty || 0)
      ]);

      const insertedOrder = orderResult.rows[0];

      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          const insertItemQuery = `
            INSERT INTO erp_sales_order_items (
              order_id, ingredient_id, product_id, item_code, item_name, unit, qty_required, 
              qty_available, qty_reserved, qty_delivered, price, unit_cost, discount_percent, vat_percent, total
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          `;
          await client.query(insertItemQuery, [
            insertedOrder.id,
            item.ingredientId || item.ingredient_id || null,
            item.productId || item.product_id || null,
            item.itemCode || item.code || null,
            item.itemName || item.name || 'صنف',
            item.unit || 'قطعة',
            item.qtyRequired || item.qty || 1,
            item.qtyAvailable || 0,
            item.qtyReserved || 0,
            item.qtyDelivered || 0,
            item.price || 0,
            item.unitCost || item.cost || 0,
            item.discountPercent || 0,
            item.vatPercent !== undefined && item.vatPercent !== null ? item.vatPercent : 0,
            item.total || ((item.qtyRequired || item.qty || 1) * (item.price || 0))
          ]);
        }
      }

      await client.query("COMMIT");
      return this.getById(insertedOrder.id);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async update(id: number, order: any): Promise<any> {
    await this.ensureTablesExist();
    const client = await erpPool.connect();
    try {
      await client.query("BEGIN");

      const updateOrderQuery = `
        UPDATE erp_sales_orders
        SET customer_name = $1, date = $2, delivery_date = $3, sales_rep = $4, 
            payment_method = $5, branch = $6, branch_id = $7, warehouse = $8, warehouse_id = $9, currency = $10, 
            notes = $11, status = $12, delivery_status = $13, invoice_status = $14, payment_status = $15,
            total_qty = $16, total_amount = $17, 
            delivered_qty = $18, remaining_qty = $19, quotation_id = COALESCE($20, quotation_id)
        WHERE id = $21
        RETURNING *
      `;

      const orderResult = await client.query(updateOrderQuery, [
        order.customerName,
        order.date || new Date(),
        order.deliveryDate || null,
        order.salesRep || null,
        order.paymentMethod || null,
        order.branch || null,
        order.branchId || 1,
        order.warehouse || null,
        order.warehouseId || 1,
        order.currency || null,
        order.notes || null,
        order.status || 'مفتوح',
        order.deliveryStatus || 'غير مسلم',
        order.invoiceStatus || 'غير مفوتر',
        order.paymentStatus || 'غير مسدد',
        order.totalQty || 0,
        order.totalAmount || 0,
        order.deliveredQty || 0,
        order.remainingQty || 0,
        order.quotationId || null,
        id
      ]);

      // Delete old items and insert updated ones
      await client.query("DELETE FROM erp_sales_order_items WHERE order_id = $1", [id]);

      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          const insertItemQuery = `
            INSERT INTO erp_sales_order_items (
              order_id, ingredient_id, product_id, item_code, item_name, unit, qty_required, 
              qty_available, qty_reserved, qty_delivered, price, unit_cost, discount_percent, vat_percent, total
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          `;
          await client.query(insertItemQuery, [
            id,
            item.ingredientId || item.ingredient_id || null,
            item.productId || item.product_id || null,
            item.itemCode || item.code || null,
            item.itemName || item.name || 'صنف',
            item.unit || 'قطعة',
            item.qtyRequired || item.qty || 1,
            item.qtyAvailable || 0,
            item.qtyReserved || 0,
            item.qtyDelivered || 0,
            item.price || 0,
            item.unitCost || item.cost || 0,
            item.discountPercent || 0,
            item.vatPercent !== undefined && item.vatPercent !== null ? item.vatPercent : 0,
            item.total || ((item.qtyRequired || item.qty || 1) * (item.price || 0))
          ]);
        }
      }

      await client.query("COMMIT");
      return this.getById(id);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async delete(id: number): Promise<void> {
    await this.ensureTablesExist();
    await erpPool.query("DELETE FROM erp_sales_orders WHERE id = $1", [id]);
  }
}
