import { erpPool } from "../../../server-erp-core.js";
import { CreateOrderDTO, UpdateOrderDTO } from "../dto/order.dto.js";

export class OrderRepository {
  async create(order: CreateOrderDTO): Promise<any> {
    const client = await erpPool.connect();
    try {
      await client.query("BEGIN");
      
      const orderQuery = `
        INSERT INTO orders (
          branch_id, user_id, table_number, customer_name, customer_phone, 
          customer_phone_2, customer_address, notes, order_type, total, 
          delivery_fee, area_id, payment_method, status, is_paid
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `;
      
      const orderValues = [
        order.branch_id,
        order.user_id || null,
        order.table_number || null,
        order.customer_name || null,
        order.customer_phone || null,
        order.customer_phone_2 || null,
        order.customer_address || null,
        order.notes || null,
        order.order_type,
        order.total,
        order.delivery_fee || 0,
        order.area_id || null,
        order.payment_method || "cash",
        "pending",
        order.payment_method && order.payment_method !== "cash" ? 1 : 0
      ];

      const orderResult = await client.query(orderQuery, orderValues);
      const insertedOrder = orderResult.rows[0];

      // Insert order items
      const itemQuery = `
        INSERT INTO order_items (order_id, product_id, size_name, quantity, price, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const insertedItems = [];
      for (const item of order.items) {
        const itemResult = await client.query(itemQuery, [
          insertedOrder.id,
          item.product_id,
          item.size_name || null,
          item.quantity,
          item.price,
          item.notes || null
        ]);
        insertedItems.push(itemResult.rows[0]);
      }

      await client.query("COMMIT");
      return { ...insertedOrder, items: insertedItems };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(id: number): Promise<any> {
    const orderResult = await erpPool.query("SELECT * FROM orders WHERE id = $1", [id]);
    if (orderResult.rows.length === 0) return null;
    
    const itemsResult = await erpPool.query("SELECT * FROM order_items WHERE order_id = $1", [id]);
    return { ...orderResult.rows[0], items: itemsResult.rows };
  }

  async update(id: number, data: UpdateOrderDTO): Promise<any> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }
    if (data.is_paid !== undefined) {
      fields.push(`is_paid = $${paramIndex++}`);
      values.push(data.is_paid);
    }
    if (data.notes !== undefined) {
      fields.push(`notes = $${paramIndex++}`);
      values.push(data.notes);
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const query = `
      UPDATE orders 
      SET ${fields.join(", ")} 
      WHERE id = $${paramIndex} 
      RETURNING *
    `;

    const result = await erpPool.query(query, values);
    if (result.rows.length === 0) return null;
    return this.findById(id);
  }
}
