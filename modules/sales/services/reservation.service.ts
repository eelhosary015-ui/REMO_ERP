import { erpPool } from "../../../server-erp-core.js";
import { SalesAuditService } from "./audit.service.js";

export interface ReservationDTO {
  id?: number;
  reservationNo?: string;
  orderId?: number;
  orderNo?: string;
  customerName: string;
  salesRep?: string;
  productId?: number;
  ingredientId?: number;
  itemName: string;
  itemCode?: string;
  warehouseId?: number;
  warehouse?: string;
  qty: number;
  reserveDate: string;
  expiryDate: string;
  userName?: string;
  status?: 'Reserved' | 'Released' | 'Fulfilled' | 'Expired' | 'Cancelled' | string;
  notes?: string;
}

export class ReservationService {
  private static ensured = false;

  static async ensureTable(): Promise<void> {
    if (this.ensured) return;
    try {
      await erpPool.query(`
        CREATE TABLE IF NOT EXISTS sales_reservations (
          id SERIAL PRIMARY KEY,
          reservation_no VARCHAR(100) UNIQUE NOT NULL,
          order_id INTEGER,
          order_no VARCHAR(100),
          customer_name VARCHAR(255) NOT NULL,
          sales_rep VARCHAR(100),
          product_id INTEGER,
          ingredient_id INTEGER,
          item_name VARCHAR(255) NOT NULL,
          item_code VARCHAR(50),
          warehouse_id INTEGER DEFAULT 1,
          warehouse VARCHAR(100) DEFAULT 'المخزن الرئيسي',
          qty DECIMAL(12,2) NOT NULL,
          reserve_date DATE NOT NULL,
          expiry_date DATE NOT NULL,
          user_name VARCHAR(100) DEFAULT 'النظام',
          status VARCHAR(50) DEFAULT 'Reserved',
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        ALTER TABLE sales_reservations ADD COLUMN IF NOT EXISTS order_id INTEGER;
        ALTER TABLE sales_reservations ADD COLUMN IF NOT EXISTS order_no VARCHAR(100);
        ALTER TABLE sales_reservations ADD COLUMN IF NOT EXISTS sales_rep VARCHAR(100);
        ALTER TABLE sales_reservations ADD COLUMN IF NOT EXISTS product_id INTEGER;
        ALTER TABLE sales_reservations ADD COLUMN IF NOT EXISTS ingredient_id INTEGER;
        ALTER TABLE sales_reservations ADD COLUMN IF NOT EXISTS item_code VARCHAR(50);
        ALTER TABLE sales_reservations ADD COLUMN IF NOT EXISTS warehouse_id INTEGER DEFAULT 1;
        ALTER TABLE sales_reservations ADD COLUMN IF NOT EXISTS warehouse VARCHAR(100) DEFAULT 'المخزن الرئيسي';
        ALTER TABLE sales_reservations ADD COLUMN IF NOT EXISTS user_name VARCHAR(100) DEFAULT 'النظام';
      `);
      this.ensured = true;
    } catch (err: any) {
      console.warn("[ReservationService] Init warning:", err.message);
    }
  }

  static async getReservations(): Promise<any[]> {
    await this.ensureTable();
    const res = await erpPool.query(`
      SELECT r.*,
             COALESCE(i.quantity, p.stock, 0) as on_hand,
             COALESCE(i.reserved, 0) as current_warehouse_reserved,
             GREATEST(0, COALESCE(i.quantity, p.stock, 0) - COALESCE(i.reserved, 0)) as available_stock
      FROM sales_reservations r
      LEFT JOIN inventory_items i ON (i.warehouse_id = r.warehouse_id AND i.ingredient_id = r.ingredient_id)
      LEFT JOIN products p ON (p.id = r.product_id)
      ORDER BY r.created_at DESC
    `);
    return res.rows.map((r: any) => ({
      id: r.id,
      reservationNo: r.reservation_no,
      orderId: r.order_id,
      orderNo: r.order_no,
      customerName: r.customer_name,
      salesRep: r.sales_rep,
      productId: r.product_id,
      ingredientId: r.ingredient_id,
      itemName: r.item_name,
      itemCode: r.item_code,
      warehouseId: r.warehouse_id,
      warehouse: r.warehouse,
      qty: parseFloat(r.qty || 0),
      reserveDate: r.reserve_date ? new Date(r.reserve_date).toISOString().split('T')[0] : '',
      expiryDate: r.expiry_date ? new Date(r.expiry_date).toISOString().split('T')[0] : '',
      userName: r.user_name,
      status: r.status,
      notes: r.notes,
      onHand: parseFloat(r.on_hand || 0),
      availableStock: parseFloat(r.available_stock || 0),
      createdAt: r.created_at
    }));
  }

  static async getStockAvailability(warehouseId: number, itemNameOrCode: string): Promise<{
    onHand: number;
    reserved: number;
    available: number;
  }> {
    let ingId: number | null = null;
    let prodId: number | null = null;

    try {
      const ingLookup = await erpPool.query(
        "SELECT id FROM ingredients WHERE code = $1 OR name ILIKE $2 LIMIT 1",
        [itemNameOrCode, itemNameOrCode]
      );
      if (ingLookup.rows.length > 0) ingId = ingLookup.rows[0].id;
    } catch (_) {}

    if (!ingId) {
      try {
        const prodLookup = await erpPool.query(
          "SELECT id, ingredient_id, stock FROM products WHERE code = $1 OR name ILIKE $2 LIMIT 1",
          [itemNameOrCode, itemNameOrCode]
        );
        if (prodLookup.rows.length > 0) {
          prodId = prodLookup.rows[0].id;
          if (prodLookup.rows[0].ingredient_id) ingId = prodLookup.rows[0].ingredient_id;
        }
      } catch (_) {}
    }

    if (ingId) {
      const invRes = await erpPool.query(
        "SELECT quantity, reserved FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2 LIMIT 1",
        [warehouseId, ingId]
      );
      if (invRes.rows.length > 0) {
        const row = invRes.rows[0];
        const onHand = parseFloat(row.quantity || 0);
        const reserved = parseFloat(row.reserved || 0);
        return {
          onHand,
          reserved,
          available: Math.max(0, onHand - reserved)
        };
      }
    }

    if (prodId) {
      const prodRes = await erpPool.query("SELECT stock FROM products WHERE id = $1 LIMIT 1", [prodId]);
      if (prodRes.rows.length > 0) {
        const onHand = parseFloat(prodRes.rows[0].stock || 0);
        return { onHand, reserved: 0, available: onHand };
      }
    }

    return { onHand: 0, reserved: 0, available: 0 };
  }

  static async createReservation(dto: ReservationDTO): Promise<any> {
    await this.ensureTable();
    const client = await erpPool.connect();

    try {
      await client.query("BEGIN");

      const warehouseId = dto.warehouseId || 1;
      const countRes = await client.query("SELECT COUNT(*) as count FROM sales_reservations");
      const nextNum = parseInt(countRes.rows[0].count) + 1;
      const reservationNo = dto.reservationNo || `RES-${new Date().getFullYear()}-${String(nextNum).padStart(5, '0')}`;

      // Resolve ingredient/product if not provided
      let ingredientId = dto.ingredientId || null;
      let productId = dto.productId || null;

      if (!ingredientId && !productId) {
        const ingLookup = await client.query(
          "SELECT id FROM ingredients WHERE (code = $1 AND code != '') OR name ILIKE $2 LIMIT 1",
          [dto.itemCode || '', dto.itemName]
        );
        if (ingLookup.rows.length > 0) {
          ingredientId = ingLookup.rows[0].id;
        } else {
          const prodLookup = await client.query(
            "SELECT id, ingredient_id FROM products WHERE (code = $1 AND code != '') OR name ILIKE $2 LIMIT 1",
            [dto.itemCode || '', dto.itemName]
          );
          if (prodLookup.rows.length > 0) {
            productId = prodLookup.rows[0].id;
            if (prodLookup.rows[0].ingredient_id) ingredientId = prodLookup.rows[0].ingredient_id;
          }
        }
      }

      // Check available stock
      if (ingredientId) {
        const invRes = await client.query(
          "SELECT quantity, reserved FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2 FOR UPDATE",
          [warehouseId, ingredientId]
        );
        if (invRes.rows.length > 0) {
          const onHand = parseFloat(invRes.rows[0].quantity || 0);
          const reserved = parseFloat(invRes.rows[0].reserved || 0);
          const available = Math.max(0, onHand - reserved);

          if (available < dto.qty) {
            const err: any = new Error(`الكمية المتاحة للحجز (${available}) أقل من المطلوب حجزها (${dto.qty}). المخزون الفعلي: ${onHand}، المحجوز حالياً: ${reserved}`);
            err.statusCode = 422;
            throw err;
          }

          // Increment reserved balance in inventory_items (DOES NOT deduct on-hand quantity)
          await client.query(`
            UPDATE inventory_items
            SET reserved = COALESCE(reserved, 0) + $1,
                available = GREATEST(0, COALESCE(quantity, 0) - (COALESCE(reserved, 0) + $1))
            WHERE warehouse_id = $2 AND ingredient_id = $3
          `, [dto.qty, warehouseId, ingredientId]);
        }
      }

      const resStatus = dto.status || 'Reserved';
      const insertRes = await client.query(`
        INSERT INTO sales_reservations (
          reservation_no, order_id, order_no, customer_name, sales_rep,
          product_id, ingredient_id, item_name, item_code, warehouse_id, warehouse,
          qty, reserve_date, expiry_date, user_name, status, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *
      `, [
        reservationNo,
        dto.orderId || null,
        dto.orderNo || null,
        dto.customerName,
        dto.salesRep || null,
        productId,
        ingredientId,
        dto.itemName,
        dto.itemCode || null,
        warehouseId,
        dto.warehouse || 'المخزن الرئيسي',
        dto.qty,
        dto.reserveDate || new Date().toISOString().split('T')[0],
        dto.expiryDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        dto.userName || 'النظام',
        resStatus,
        dto.notes || null
      ]);

      const saved = insertRes.rows[0];

      // If linked to a sales order, update the order item's qty_reserved
      if (dto.orderId) {
        await client.query(`
          UPDATE erp_sales_order_items
          SET qty_reserved = COALESCE(qty_reserved, 0) + $1
          WHERE order_id = $2 AND (item_name ILIKE $3 OR item_code = $4)
        `, [dto.qty, dto.orderId, dto.itemName, dto.itemCode || '']);
      }

      await client.query("COMMIT");

      await SalesAuditService.log({
        entityType: 'reservation',
        entityId: saved.id,
        entityNumber: saved.reservation_no,
        action: 'حجز بضاعة',
        newStatus: resStatus,
        userName: dto.userName || dto.salesRep || 'المبيعات',
        details: {
          customerName: dto.customerName,
          itemName: dto.itemName,
          qty: dto.qty,
          warehouseId,
          orderNo: dto.orderNo
        }
      });

      return saved;
    } catch (err: any) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  static async releaseOrCancelReservation(id: number, newStatus: 'Released' | 'Cancelled', userName: string = 'النظام'): Promise<any> {
    await this.ensureTable();
    const client = await erpPool.connect();

    try {
      await client.query("BEGIN");

      const selectRes = await client.query("SELECT * FROM sales_reservations WHERE id = $1 FOR UPDATE", [id]);
      if (selectRes.rows.length === 0) {
        const err: any = new Error("الحجز غير موجود");
        err.statusCode = 404;
        throw err;
      }

      const resDoc = selectRes.rows[0];
      const oldStatus = resDoc.status;

      // Only active reservations release stock back to available
      if (oldStatus === 'Reserved' || oldStatus === 'محجوز') {
        const warehouseId = resDoc.warehouse_id || 1;
        const qty = parseFloat(resDoc.qty || 0);

        if (resDoc.ingredient_id) {
          await client.query(`
            UPDATE inventory_items
            SET reserved = GREATEST(0, COALESCE(reserved, 0) - $1),
                available = GREATEST(0, COALESCE(quantity, 0) - GREATEST(0, COALESCE(reserved, 0) - $1))
            WHERE warehouse_id = $2 AND ingredient_id = $3
          `, [qty, warehouseId, resDoc.ingredient_id]);
        }

        // If linked to sales order, decrement order item qty_reserved
        if (resDoc.order_id) {
          await client.query(`
            UPDATE erp_sales_order_items
            SET qty_reserved = GREATEST(0, COALESCE(qty_reserved, 0) - $1)
            WHERE order_id = $2 AND (item_name ILIKE $3 OR item_code = $4)
          `, [qty, resDoc.order_id, resDoc.item_name, resDoc.item_code || '']);
        }
      }

      const updateRes = await client.query(`
        UPDATE sales_reservations
        SET status = $1
        WHERE id = $2
        RETURNING *
      `, [newStatus, id]);

      await client.query("COMMIT");

      await SalesAuditService.log({
        entityType: 'reservation',
        entityId: id,
        entityNumber: resDoc.reservation_no,
        action: newStatus === 'Released' ? 'تحرير الحجز' : 'إلغاء الحجز',
        oldStatus,
        newStatus,
        userName,
        details: {
          qty: resDoc.qty,
          itemName: resDoc.item_name
        }
      });

      return updateRes.rows[0];
    } catch (err: any) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
