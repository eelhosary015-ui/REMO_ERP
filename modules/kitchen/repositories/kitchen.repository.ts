import { erpPool } from "../../../server-erp-core.js";
import { UpdateKitchenItemStatusDTO } from "../dto/kitchen.dto.js";

export class KitchenRepository {
  async getActiveKitchenOrders(): Promise<any[]> {
    const query = `
      SELECT o.*, 
        json_agg(json_build_object(
          'id', oi.id,
          'product_id', oi.product_id,
          'product_name', p.name,
          'quantity', oi.quantity,
          'status', oi.status
        )) as items
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE o.status = 'cooking' OR oi.status IN ('pending', 'preparing')
      GROUP BY o.id
      ORDER BY o.created_at ASC
    `;
    const result = await erpPool.query(query);
    return result.rows;
  }

  async updateItemStatus(update: UpdateKitchenItemStatusDTO): Promise<any> {
    const query = `
      UPDATE order_items 
      SET status = $1 
      WHERE id = $2 AND order_id = $3
      RETURNING *
    `;
    const result = await erpPool.query(query, [update.status, update.item_id, update.order_id]);
    return result.rows[0];
  }
}
