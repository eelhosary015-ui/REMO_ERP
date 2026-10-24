import { erpPool } from "../../../server-erp-core.js";
import { CreateDeliveryDTO, UpdateDeliveryDTO } from "../dto/delivery.dto.js";
import { toDateOnly } from "../../common/dateOnly.js";

export class DeliveryRepository {
  private static tablesEnsured = false;
  private static ensurePromise: Promise<void> | null = null;

  constructor() {
    this.ensureTablesExist();
  }

  private async ensureTablesExist(): Promise<void> {
    if (DeliveryRepository.tablesEnsured) return;
    if (DeliveryRepository.ensurePromise) return DeliveryRepository.ensurePromise;

    const deliveryTableDdl = `
      CREATE TABLE IF NOT EXISTS sales_delivery_notes (
        id SERIAL PRIMARY KEY,
        delivery_no VARCHAR(100) UNIQUE NOT NULL,
        order_id INTEGER,
        order_no VARCHAR(100),
        customer_id INTEGER,
        customer_name VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        driver VARCHAR(100),
        car_number VARCHAR(100),
        sales_rep VARCHAR(100),
        transportation VARCHAR(100),
        delivery_method VARCHAR(100),
        warehouse VARCHAR(100),
        warehouse_id INTEGER,
        notes TEXT,
        status VARCHAR(50) DEFAULT 'مسودة',
        total_qty_required DECIMAL(12,2) DEFAULT 0,
        total_qty_delivered DECIMAL(12,2) DEFAULT 0,
        total_qty_remaining DECIMAL(12,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const itemsTableDdl = `
      CREATE TABLE IF NOT EXISTS sales_delivery_note_items (
        id SERIAL PRIMARY KEY,
        delivery_id INTEGER NOT NULL REFERENCES sales_delivery_notes(id) ON DELETE CASCADE,
        ingredient_id INTEGER,
        product_id INTEGER,
        item_code VARCHAR(50),
        item_name VARCHAR(255) NOT NULL,
        unit VARCHAR(50) DEFAULT 'قطعة',
        qty_required DECIMAL(12,2) NOT NULL,
        qty_delivered DECIMAL(12,2) NOT NULL,
        price DECIMAL(12,2) DEFAULT 0,
        discount_percent DECIMAL(5,2) DEFAULT 0,
        total DECIMAL(12,2) DEFAULT 0
      )
    `;

    DeliveryRepository.ensurePromise = (async () => {
      try {
        await erpPool.query(deliveryTableDdl);
        await erpPool.query(itemsTableDdl);

        // Ensure enterprise tracking columns exist
        await erpPool.query(`
          ALTER TABLE sales_delivery_notes
          ADD COLUMN IF NOT EXISTS branch_id INTEGER DEFAULT 1,
          ADD COLUMN IF NOT EXISTS is_posted BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS posted_at TIMESTAMP,
          ADD COLUMN IF NOT EXISTS posted_by VARCHAR(100),
          ADD COLUMN IF NOT EXISTS journal_entry_id INTEGER,
          ADD COLUMN IF NOT EXISTS total_cost DECIMAL(12,2) DEFAULT 0,
          ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12,2) DEFAULT 0;

          ALTER TABLE sales_delivery_note_items
          ADD COLUMN IF NOT EXISTS product_id INTEGER,
          ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(12,2) DEFAULT 0,
          ADD COLUMN IF NOT EXISTS total_cost DECIMAL(12,2) DEFAULT 0;
        `);

        DeliveryRepository.tablesEnsured = true;
      } catch (err: any) {
        // Handled via pool
      } finally {
        DeliveryRepository.ensurePromise = null;
      }
    })();
    return DeliveryRepository.ensurePromise;
  }

  private mapRow(row: any): any {
    return {
      id: row.id,
      deliveryNo: row.delivery_no,
      orderId: row.order_id,
      orderNo: row.order_no,
      customerId: row.customer_id,
      customerName: row.customer_name,
      date: toDateOnly(row.date),
      driver: row.driver,
      carNumber: row.car_number,
      salesRep: row.sales_rep,
      transportation: row.transportation,
      deliveryMethod: row.delivery_method,
      warehouse: row.warehouse,
      warehouseId: row.warehouse_id,
      branchId: row.branch_id || 1,
      isPosted: !!row.is_posted,
      postedAt: row.posted_at,
      postedBy: row.posted_by,
      journalEntryId: row.journal_entry_id,
      totalCost: parseFloat(row.total_cost || 0),
      totalAmount: parseFloat(row.total_amount || 0),
      notes: row.notes,
      status: row.status,
      totalQtyRequired: parseFloat(row.total_qty_required || 0),
      totalQtyDelivered: parseFloat(row.total_qty_delivered || 0),
      totalQtyRemaining: parseFloat(row.total_qty_remaining || 0),
      items: row.items || []
    };
  }

  async getAll(): Promise<any[]> {
    await this.ensureTablesExist();
    const query = `
      SELECT d.*,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', it.id,
                   'ingredientId', it.ingredient_id,
                   'productId', it.product_id,
                   'itemCode', it.item_code,
                   'itemName', it.item_name,
                   'unit', it.unit,
                   'qtyRequired', it.qty_required,
                   'qtyDelivered', it.qty_delivered,
                   'price', it.price,
                   'discountPercent', it.discount_percent,
                   'unitCost', it.unit_cost,
                   'totalCost', it.total_cost,
                   'total', it.total
                 )
               ) FILTER (WHERE it.id IS NOT NULL),
               '[]'::json
             ) as items
      FROM sales_delivery_notes d
      LEFT JOIN sales_delivery_note_items it ON d.id = it.delivery_id
      GROUP BY d.id
      ORDER BY d.created_at DESC
    `;
    const result = await erpPool.query(query);
    return result.rows.map((row: any) => this.mapRow(row));
  }

  async getById(id: number): Promise<any | null> {
    await this.ensureTablesExist();
    const query = `
      SELECT d.*,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', it.id,
                   'ingredientId', it.ingredient_id,
                   'productId', it.product_id,
                   'itemCode', it.item_code,
                   'itemName', it.item_name,
                   'unit', it.unit,
                   'qtyRequired', it.qty_required,
                   'qtyDelivered', it.qty_delivered,
                   'price', it.price,
                   'discountPercent', it.discount_percent,
                   'unitCost', it.unit_cost,
                   'totalCost', it.total_cost,
                   'total', it.total
                 )
               ) FILTER (WHERE it.id IS NOT NULL),
               '[]'::json
             ) as items
      FROM sales_delivery_notes d
      LEFT JOIN sales_delivery_note_items it ON d.id = it.delivery_id
      WHERE d.id = $1
      GROUP BY d.id
    `;
    const result = await erpPool.query(query, [id]);
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async create(dto: CreateDeliveryDTO): Promise<any> {
    await this.ensureTablesExist();
    const client = await erpPool.connect();
    try {
      await client.query("BEGIN");

      const deliveryNo = dto.deliveryNo || `DN-${Date.now().toString().slice(-6)}`;
      const totalReq = (dto.items || []).reduce((s, i) => s + (Number(i.qtyRequired) || 0), 0);
      const totalDel = (dto.items || []).reduce((s, i) => s + (Number(i.qtyDelivered) || 0), 0);
      const totalRem = totalReq - totalDel;

      const insertDeliveryQuery = `
        INSERT INTO sales_delivery_notes (
          delivery_no, order_id, order_no, customer_id, customer_name,
          date, driver, car_number, sales_rep, transportation,
          delivery_method, warehouse, warehouse_id, notes, status,
          total_qty_required, total_qty_delivered, total_qty_remaining
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16, $17, $18
        )
        RETURNING *
      `;

      const deliveryResult = await client.query(insertDeliveryQuery, [
        deliveryNo,
        dto.orderId || null,
        dto.orderNo || null,
        dto.customerId || null,
        dto.customerName,
        dto.date || new Date().toISOString().split('T')[0],
        dto.driver || null,
        dto.carNumber || null,
        dto.salesRep || null,
        dto.transportation || 'نقل داخلي',
        dto.deliveryMethod || 'تسليم بواسطة الشركة',
        dto.warehouse || null,
        dto.warehouseId || null,
        dto.notes || null,
        dto.status || 'مسودة',
        totalReq,
        totalDel,
        totalRem
      ]);

      const deliveryId = deliveryResult.rows[0].id;

      if (dto.items && dto.items.length > 0) {
        for (const item of dto.items) {
          await client.query(`
            INSERT INTO sales_delivery_note_items (
              delivery_id, ingredient_id, product_id, item_code, item_name,
              unit, qty_required, qty_delivered, price, discount_percent, total
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `, [
            deliveryId,
            item.ingredientId || null,
            (item as any).productId || (item as any).product_id || null,
            item.itemCode || 'ITEM',
            item.itemName,
            item.unit || 'قطعة',
            Number(item.qtyRequired) || 0,
            Number(item.qtyDelivered) || 0,
            Number(item.price) || 0,
            Number(item.discountPercent) || 0,
            Number(item.total) || 0
          ]);
        }
      }

      await client.query("COMMIT");
      return this.getById(deliveryId);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async update(id: number, dto: UpdateDeliveryDTO): Promise<any> {
    await this.ensureTablesExist();
    const client = await erpPool.connect();
    try {
      await client.query("BEGIN");

      const existing = await this.getById(id);
      if (!existing) {
        throw new Error("Delivery note not found");
      }

      const totalReq = dto.items ? dto.items.reduce((s, i) => s + (Number(i.qtyRequired) || 0), 0) : existing.totalQtyRequired;
      const totalDel = dto.items ? dto.items.reduce((s, i) => s + (Number(i.qtyDelivered) || 0), 0) : existing.totalQtyDelivered;
      const totalRem = totalReq - totalDel;

      const updateQuery = `
        UPDATE sales_delivery_notes
        SET customer_name = COALESCE($1, customer_name),
            date = COALESCE($2, date),
            driver = COALESCE($3, driver),
            car_number = COALESCE($4, car_number),
            sales_rep = COALESCE($5, sales_rep),
            transportation = COALESCE($6, transportation),
            delivery_method = COALESCE($7, delivery_method),
            warehouse = COALESCE($8, warehouse),
            warehouse_id = COALESCE($9, warehouse_id),
            notes = COALESCE($10, notes),
            status = COALESCE($11, status),
            total_qty_required = $12,
            total_qty_delivered = $13,
            total_qty_remaining = $14
        WHERE id = $15
        RETURNING *
      `;

      await client.query(updateQuery, [
        dto.customerName || null,
        dto.date || null,
        dto.driver || null,
        dto.carNumber || null,
        dto.salesRep || null,
        dto.transportation || null,
        dto.deliveryMethod || null,
        dto.warehouse || null,
        dto.warehouseId || null,
        dto.notes || null,
        dto.status || null,
        totalReq,
        totalDel,
        totalRem,
        id
      ]);

      if (dto.items) {
        await client.query("DELETE FROM sales_delivery_note_items WHERE delivery_id = $1", [id]);
        for (const item of dto.items) {
          await client.query(`
            INSERT INTO sales_delivery_note_items (
              delivery_id, ingredient_id, item_code, item_name,
              unit, qty_required, qty_delivered, price, discount_percent, total
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [
            id,
            item.ingredientId || null,
            item.itemCode || 'ITEM',
            item.itemName,
            item.unit || 'قطعة',
            Number(item.qtyRequired) || 0,
            Number(item.qtyDelivered) || 0,
            Number(item.price) || 0,
            Number(item.discountPercent) || 0,
            Number(item.total) || 0
          ]);
        }
      }

      await client.query("COMMIT");
      return this.getById(id);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async delete(id: number): Promise<void> {
    await this.ensureTablesExist();
    await erpPool.query("DELETE FROM sales_delivery_notes WHERE id = $1", [id]);
  }
}
