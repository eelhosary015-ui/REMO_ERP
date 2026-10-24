import { describe, it, expect } from "vitest";
import { moveStock } from "../../modules/warehouses/services/inventory.service.js";
import { ensureIngredient, ensureWarehouse, uniqueTag, withRollback } from "../helpers/testDb.js";

describe("حركة المخزون — الدخول والخروج وتأثيرهما على الرصيد", () => {
  it("يرفع الرصيد عند الدخول ويخفضه عند الخروج ويحفظ سجل الحركات", async () => {
    await withRollback(async (client) => {
      const warehouseId = await ensureWarehouse(client, uniqueTag("WH"));
      const ingredientId = await ensureIngredient(client, uniqueTag("ITEM"));

      const receipt = await moveStock(client, {
        warehouse_id: warehouseId,
        ingredient_id: ingredientId,
        delta: 10,
        ref_type: "goods_receipt",
        ref_id: 9001,
        unit_cost: 50,
      });
      expect(receipt.before).toBe(0);
      expect(receipt.after).toBe(10);
      expect(receipt.unit_cost).toBe(50);
      expect(receipt.total_cost).toBe(500);

      const issue = await moveStock(client, {
        warehouse_id: warehouseId,
        ingredient_id: ingredientId,
        delta: -4,
        ref_type: "sales_invoice",
        ref_id: 9002,
      });
      expect(issue.before).toBe(10);
      expect(issue.after).toBe(6);

      const stock = await client.query(
        "SELECT quantity, available, avg_cost FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2",
        [warehouseId, ingredientId],
      );
      expect(stock.rows).toHaveLength(1);
      expect(Number(stock.rows[0].quantity)).toBe(6);
      expect(Number(stock.rows[0].available)).toBe(6);
      // Weighted average cost stays at the receipt cost when issuing.
      expect(Number(stock.rows[0].avg_cost)).toBe(50);

      const ingredient = await client.query("SELECT current_stock FROM ingredients WHERE id = $1", [ingredientId]);
      expect(Number(ingredient.rows[0].current_stock)).toBe(6);

      const ledger = await client.query(
        "SELECT delta, after_qty FROM inventory_stock_ledger WHERE warehouse_id = $1 AND ingredient_id = $2 ORDER BY id",
        [warehouseId, ingredientId],
      );
      expect(ledger.rows).toHaveLength(2);
      expect(Number(ledger.rows[0].delta)).toBe(10);
      expect(Number(ledger.rows[1].delta)).toBe(-4);

      const transactions = await client.query(
        "SELECT quantity, balance_before, balance_after FROM inventory_transactions WHERE warehouse_id = $1 AND ingredient_id = $2 ORDER BY id",
        [warehouseId, ingredientId],
      );
      expect(transactions.rows).toHaveLength(2);
      expect(Number(transactions.rows[1].balance_before)).toBe(10);
      expect(Number(transactions.rows[1].balance_after)).toBe(6);
    });
  });

  it("يرفض الصرف بأكثر من الرصيد المتاح ولا يغيّر الرصيد", async () => {
    await withRollback(async (client) => {
      const warehouseId = await ensureWarehouse(client, uniqueTag("WH"));
      const ingredientId = await ensureIngredient(client, uniqueTag("ITEM"));

      await moveStock(client, {
        warehouse_id: warehouseId,
        ingredient_id: ingredientId,
        delta: 5,
        ref_type: "goods_receipt",
        ref_id: 9101,
        unit_cost: 20,
      });

      await expect(
        moveStock(client, {
          warehouse_id: warehouseId,
          ingredient_id: ingredientId,
          delta: -6,
          ref_type: "sales_invoice",
          ref_id: 9102,
        }),
      ).rejects.toThrow(/الرصيد غير كافٍ/);

      const stock = await client.query(
        "SELECT quantity FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2",
        [warehouseId, ingredientId],
      );
      expect(Number(stock.rows[0].quantity)).toBe(5);
    });
  });

  it("لا يسمح بحركة بكمية صفر أو بصنف غير معروف", async () => {
    await withRollback(async (client) => {
      const warehouseId = await ensureWarehouse(client, uniqueTag("WH"));
      const ingredientId = await ensureIngredient(client, uniqueTag("ITEM"));

      await expect(
        moveStock(client, { warehouse_id: warehouseId, ingredient_id: ingredientId, delta: 0, ref_type: "manual", ref_id: 1 }),
      ).rejects.toThrow(/كمية الحركة غير صحيحة/);

      await expect(
        moveStock(client, { warehouse_id: 2_000_000_000, ingredient_id: ingredientId, delta: 1, ref_type: "manual", ref_id: 2 }),
      ).rejects.toThrow(/المخزن غير موجود/);
    });
  });

  it("يعالج نفس رقم الحركة مرتين بأمان (لا يخصم مرتين)", async () => {
    await withRollback(async (client) => {
      const warehouseId = await ensureWarehouse(client, uniqueTag("WH"));
      const ingredientId = await ensureIngredient(client, uniqueTag("ITEM"));
      const options = {
        warehouse_id: warehouseId,
        ingredient_id: ingredientId,
        delta: 7,
        ref_type: "goods_receipt" as const,
        ref_id: 9200,
        unit_cost: 10,
      };

      const first = await moveStock(client, options);
      const replay = await moveStock(client, options);

      expect(first.replayed).toBe(false);
      expect(replay.replayed).toBe(true);
      expect(replay.after).toBe(7);

      const stock = await client.query(
        "SELECT quantity FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2",
        [warehouseId, ingredientId],
      );
      expect(Number(stock.rows[0].quantity)).toBe(7);
    });
  });
});
