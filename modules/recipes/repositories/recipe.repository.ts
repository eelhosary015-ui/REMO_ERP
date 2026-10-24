import { erpPool } from "../../../server-erp-core.js";
import { CreateRecipeDTO } from "../dto/recipe.dto.js";

export class RecipeRepository {
  async getAll(): Promise<any[]> {
    const query = `
      SELECT pi.*, p.name as product_name, i.name as ingredient_name, i.unit
      FROM product_ingredients pi
      LEFT JOIN products p ON pi.product_id = p.id
      LEFT JOIN ingredients i ON pi.ingredient_id = i.id
      ORDER BY pi.product_id ASC
    `;
    const result = await erpPool.query(query);
    return result.rows;
  }

  async create(recipe: CreateRecipeDTO): Promise<any[]> {
    const client = await erpPool.connect();
    try {
      await client.query("BEGIN");

      // Clear existing ingredients for this product
      await client.query("DELETE FROM product_ingredients WHERE product_id = $1", [recipe.product_id]);

      const insertedItems: any[] = [];
      for (const item of recipe.items) {
        const query = `
          INSERT INTO product_ingredients (product_id, ingredient_id, quantity)
          VALUES ($1, $2, $3)
          RETURNING *
        `;
        const result = await client.query(query, [
          recipe.product_id,
          item.ingredient_id,
          item.quantity
        ]);
        insertedItems.push(result.rows[0]);
      }

      await client.query("COMMIT");
      return insertedItems;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
