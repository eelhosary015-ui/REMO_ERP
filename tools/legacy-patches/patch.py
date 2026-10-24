from pathlib import Path
p=Path('/mnt/data/phase4/modules/restaurant/restaurant_api.routes.ts')
s=p.read_text()
if 'import { moveStock }' not in s:
 s=s.replace('import * as XLSX from "xlsx";\n','import * as XLSX from "xlsx";\nimport { moveStock } from "../warehouses/services/inventory.service.js";\n')
# POS
route=s.index('router.post("/api/pos/order"')
start=s.index('// Reduce ingredient stock based on product recipe proportions',route)
start=s.rfind('\n',0,start)+1
end=s.find("await client.query('COMMIT');",start)
end=s.rfind('\n',0,end)
new='''      // Central inventory deduction: one canonical movement per POS order.\n      const stockMoves = new Map<string, { warehouseId: number; ingredientId: number; qty: number }>();\n      for (const item of items) {\n        const productId = item.id || item.product_id;\n        if (!productId) continue;\n        const prodRes = await client.query("SELECT warehouse_id, track_inventory FROM products WHERE id = $1", [productId]);\n        const product = prodRes.rows[0];\n        if (product?.track_inventory === false) continue;\n        let targetWarehouseId = product?.warehouse_id;\n        if (!targetWarehouseId) {\n          const whRes = await client.query("SELECT id FROM warehouses WHERE (branch_id = $1 AND is_kitchen = 1) OR branch_id = $1 OR is_main = true ORDER BY is_kitchen DESC, is_main DESC LIMIT 1", [branch_id]);\n          targetWarehouseId = whRes.rows[0]?.id;\n        }\n        if (!targetWarehouseId) throw new Error(`لا يوجد مخزن مرتبط بفرع الطلب للصنف #${productId}`);\n        const recipe = await client.query("SELECT ingredient_id, quantity FROM product_ingredients WHERE product_id = $1", [productId]);\n        for (const pi of recipe.rows) {\n          const qty = Number(pi.quantity || 0) * Number(item.quantity || 1);\n          if (qty <= 0) continue;\n          const key = `${targetWarehouseId}:${pi.ingredient_id}`;\n          const current = stockMoves.get(key);\n          if (current) current.qty += qty;\n          else stockMoves.set(key, { warehouseId: Number(targetWarehouseId), ingredientId: Number(pi.ingredient_id), qty });\n        }\n      }\n      for (const move of stockMoves.values()) {\n        await moveStock(client, { warehouse_id: move.warehouseId, ingredient_id: move.ingredientId, delta: -move.qty, ref_type: "pos_sale", ref_id: Number(orderId), user: String((req as any).user?.id || "system"), notes: `خصم مقادير بيع POS رقم ${orderId}` });\n        await client.query("INSERT INTO inventory_transactions (warehouse_id, ingredient_id, quantity, type, reference_id, notes) VALUES ($1, $2, $3, 'out', $4, $5)", [move.warehouseId, move.ingredientId, move.qty, orderId, `سحب مقادير - بيع طلب رقم ${orderId}`]);\n      }\n      if (stockMoves.size > 0) await client.query("UPDATE orders SET is_deducted = 1 WHERE id = $1", [orderId]);\n\n'''
s=s[:start]+new+s[end:]
# kitchen
route=s.index('router.post("/api/kitchen/orders/:id/status"')
pos=s.find('const orderResult = await client.query("SELECT * FROM orders WHERE id = $1");',route)
if pos!=-1:
 s=s[:pos]+s[pos:].replace('const orderResult = await client.query("SELECT * FROM orders WHERE id = $1");','const orderResult = await client.query("SELECT * FROM orders WHERE id = $1 FOR UPDATE");',1)
route=s.index('router.post("/api/kitchen/orders/:id/status"')
start=s.index("if (status === 'preparing' && !order.is_deducted)",route)
start=s.rfind('\n',0,start)+1
end=s.find('await client.query("COMMIT");',start)
end=s.rfind('\n',0,end)
new='''      if (status === 'preparing' && !order.is_deducted) {\n        let branchWarehouse = (await client.query("SELECT id FROM warehouses WHERE branch_id = $1 AND is_kitchen = 1 LIMIT 1", [order.branch_id])).rows[0];\n        if (!branchWarehouse) branchWarehouse = (await client.query("SELECT id FROM warehouses WHERE branch_id = $1 LIMIT 1", [order.branch_id])).rows[0];\n        if (!branchWarehouse) throw new Error("لا يوجد مخزن للفرع لتنفيذ خصم الطلب");\n        const itemsResult = await client.query("SELECT * FROM order_items WHERE order_id = $1", [id]);\n        const stockMoves = new Map<string, number>();\n        for (const item of itemsResult.rows) {\n          const recipe = await client.query("SELECT ingredient_id, quantity FROM product_ingredients WHERE product_id = $1", [item.product_id]);\n          for (const pi of recipe.rows) {\n            const qty = Number(pi.quantity || 0) * Number(item.quantity || 1);\n            if (qty <= 0) continue;\n            const key = String(pi.ingredient_id);\n            stockMoves.set(key, (stockMoves.get(key) || 0) + qty);\n          }\n        }\n        for (const [ingredientId, qty] of stockMoves) {\n          await moveStock(client, { warehouse_id: Number(branchWarehouse.id), ingredient_id: Number(ingredientId), delta: -qty, ref_type: "pos_sale", ref_id: Number(id), user: String((req as any).user?.id || "system"), notes: `خصم مقادير أوردر رقم ${id}` });\n          await client.query("INSERT INTO inventory_transactions (warehouse_id, ingredient_id, quantity, type, reference_id, notes) VALUES ($1, $2, $3, 'out', $4, $5)", [branchWarehouse.id, ingredientId, qty, id, `خصم مقادير أوردر رقم ${id}`]);\n        }\n        await client.query("UPDATE orders SET is_deducted = 1 WHERE id = $1", [id]);\n      }\n'''
s=s[:start]+new+s[end:]
p.write_text(s)
print('done')
