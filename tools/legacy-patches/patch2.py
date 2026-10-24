from pathlib import Path
p=Path('/mnt/data/phase4/modules/restaurant/restaurant_api.routes.ts')
s=p.read_text()
# checkout
route=s.index('router.post("/api/orders/:orderId/checkout"')
pos=s.find('const order = (await client.query("SELECT * FROM orders WHERE id = $1", [orderId])).rows[0];',route)
if pos!=-1:
 s=s[:pos]+s[pos:].replace('const order = (await client.query("SELECT * FROM orders WHERE id = $1", [orderId])).rows[0];','const order = (await client.query("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [orderId])).rows[0];',1)
needle='      await client.query("UPDATE orders SET is_paid = 1, payment_method = $2 WHERE id = $1", [orderId, payment_method]);'
if needle in s and 'alreadyPaid' not in s[route:s.index('  router.post("/api/orders/:id/cancel"',route)]:
 s=s.replace(needle,'      if (Boolean(order.is_paid)) { await client.query("COMMIT"); return res.json({ success: true, alreadyPaid: true }); }\n\n'+needle,1)
# cancel lock and guard
route=s.index('router.post("/api/orders/:id/cancel"')
pos=s.find('const order = (await client.query("SELECT * FROM orders WHERE id = $1", [id])).rows[0];',route)
if pos!=-1:
 s=s[:pos]+s[pos:].replace('const order = (await client.query("SELECT * FROM orders WHERE id = $1", [id])).rows[0];','const order = (await client.query("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [id])).rows[0];',1)
needle='      if (!order) throw new Error("Order not found");\n      \n      // 1. Update order status'
if needle in s and 'alreadyCancelled' not in s[route:]:
 s=s.replace(needle,'      if (!order) throw new Error("Order not found");\n      if (order.status === \'cancelled\') { await client.query("COMMIT"); return res.json({ success: true, alreadyCancelled: true }); }\n      \n      // 1. Update order status',1)
# cancel stock block
route=s.index('router.post("/api/orders/:id/cancel"')
start=s.index('      // 4. Reverse inventory deduction if applicable',route)
end=s.index('      await client.query("COMMIT");',start)
new='''      // 4. Reverse inventory deduction exactly once via the central engine.\n      if (order.is_deducted) {\n        let branchWarehouse = (await client.query("SELECT id FROM warehouses WHERE branch_id = $1 AND is_kitchen = 1 LIMIT 1", [order.branch_id])).rows[0];\n        if (!branchWarehouse) branchWarehouse = (await client.query("SELECT id FROM warehouses WHERE branch_id = $1 LIMIT 1", [order.branch_id])).rows[0];\n        if (!branchWarehouse) throw new Error("لا يوجد مخزن للفرع لعكس حركة المخزون");\n        const items = (await client.query("SELECT * FROM order_items WHERE order_id = $1", [id])).rows;\n        const stockMoves = new Map<string, number>();\n        for (const item of items) {\n          const recipe = await client.query("SELECT ingredient_id, quantity FROM product_ingredients WHERE product_id = $1", [item.product_id]);\n          for (const pi of recipe.rows) {\n            const qty = Number(pi.quantity || 0) * Number(item.quantity || 1);\n            if (qty <= 0) continue;\n            const key = String(pi.ingredient_id);\n            stockMoves.set(key, (stockMoves.get(key) || 0) + qty);\n          }\n        }\n        for (const [ingredientId, qty] of stockMoves) {\n          await moveStock(client, { warehouse_id: Number(branchWarehouse.id), ingredient_id: Number(ingredientId), delta: qty, ref_type: "pos_sale_cancel", ref_id: Number(id), user: String((req as any).user?.id || "system"), notes: `استرجاع مقادير أوردر ملغي رقم ${id}` });\n          await client.query("INSERT INTO inventory_transactions (warehouse_id, ingredient_id, quantity, type, reference_id, notes) VALUES ($1, $2, $3, 'in', $4, $5)", [branchWarehouse.id, ingredientId, qty, id, `استرجاع مقادير أوردر ملغي رقم ${id}`]);\n        }\n        await client.query("UPDATE orders SET is_deducted = 0 WHERE id = $1", [id]);\n      }\n\n'''
s=s[:start]+new+s[end:]
# web confirm stock replacement
route=s.index('router.post("/api/web-orders/:id/confirm"')
start=s.index('      // 3. Insert items',route)
# only replace stock deduction portion from comment Reduce to update web status
rstart=s.index('        // Reduce ingredient stock',start)
rend=s.index('      // 4. Update web order status',rstart)
# Keep item insert loop, replace only reduction loop after inserts: find end of for items by using marker.
new='''      // 3. Insert items and apply the inventory movement atomically.\n      const stockMoves = new Map<string, { warehouseId: number; ingredientId: number; qty: number }>();\n      for (const item of items) {\n        await client.query(`INSERT INTO order_items (order_id, product_id, size_name, quantity, price, notes) VALUES ($1, $2, $3, $4, $5, $6)`, [newOrderId, item.product_id, item.size_name, item.quantity, item.price, item.notes]);\n        const productRes = await client.query("SELECT warehouse_id, track_inventory FROM products WHERE id = $1", [item.product_id]);\n        const product = productRes.rows[0];\n        if (product?.track_inventory === false) continue;\n        let warehouseId = product?.warehouse_id;\n        if (!warehouseId) warehouseId = (await client.query("SELECT id FROM warehouses WHERE (branch_id = $1 AND is_kitchen = 1) OR branch_id = $1 OR is_main = true ORDER BY is_kitchen DESC, is_main DESC LIMIT 1", [webOrder.branch_id])).rows[0]?.id;\n        if (!warehouseId) throw new Error(`لا يوجد مخزن مرتبط بفرع الطلب للصنف #${item.product_id}`);\n        const recipe = await client.query("SELECT ingredient_id, quantity FROM product_ingredients WHERE product_id = $1", [item.product_id]);\n        for (const pi of recipe.rows) {\n          const qty = Number(pi.quantity || 0) * Number(item.quantity || 1);\n          if (qty <= 0) continue;\n          const key = `${warehouseId}:${pi.ingredient_id}`;\n          const current = stockMoves.get(key);\n          if (current) current.qty += qty;\n          else stockMoves.set(key, { warehouseId: Number(warehouseId), ingredientId: Number(pi.ingredient_id), qty });\n        }\n      }\n      for (const move of stockMoves.values()) {\n        await moveStock(client, { warehouse_id: move.warehouseId, ingredient_id: move.ingredientId, delta: -move.qty, ref_type: "web_order_sale", ref_id: Number(newOrderId), user: String(userId || "system"), notes: `خصم مقادير طلب ويب رقم ${newOrderId}` });\n        await client.query("INSERT INTO inventory_transactions (warehouse_id, ingredient_id, quantity, type, reference_id, notes) VALUES ($1, $2, $3, 'out', $4, $5)", [move.warehouseId, move.ingredientId, move.qty, newOrderId, `خصم مقادير طلب ويب رقم ${newOrderId}`]);\n      }\n      if (stockMoves.size > 0) await client.query("UPDATE orders SET is_deducted = 1 WHERE id = $1", [newOrderId]);\n\n'''
s=s[:start]+s[start:rstart]+new+s[rend:]
p.write_text(s)
print('patched2')
