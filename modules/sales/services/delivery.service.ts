import { DeliveryRepository } from "../repositories/delivery.repository.js";
import { CreateDeliveryDTO, UpdateDeliveryDTO } from "../dto/delivery.dto.js";
import { ERPCache, ERPEventBus, erpPool } from "../../../server-erp-core.js";
import { moveStock } from "../../warehouses/services/inventory.service.js";
import { postDeliveryEntry } from "../../accounts/services/auto-posting.service.js";
import { SalesAuditService } from "./audit.service.js";

const LIST_CACHE_KEY = "sales:deliveries:all";

export class DeliveryService {
  private repository: DeliveryRepository;

  constructor() {
    this.repository = new DeliveryRepository();
  }

  async getDeliveries(): Promise<any[]> {
    const cached = ERPCache.get(LIST_CACHE_KEY);
    if (cached) return cached;

    const deliveries = await this.repository.getAll();
    ERPCache.set(LIST_CACHE_KEY, deliveries, 60);
    return deliveries;
  }

  async getDeliveryById(id: number): Promise<any> {
    const delivery = await this.repository.getById(id);
    if (!delivery) {
      const err: any = new Error("إذن التسليم غير موجود");
      err.statusCode = 404;
      throw err;
    }
    return delivery;
  }

  private async resolveItemDetails(client: any, item: any, warehouseId: number) {
    let ingredientId = item.ingredientId ? Number(item.ingredientId) : null;
    let productId = (item as any).productId ? Number((item as any).productId) : null;
    let itemType = item.itemType || (productId && !ingredientId ? "product" : ingredientId && !productId ? "inventory_item" : null);
    let unitCost = Number(item.unitCost) || Number(item.cost) || 0;
    let resolvedName = item.itemName || item.name || "";
    let resolvedCode = item.itemCode || item.code || "";
    let resolvedUnit = item.unit || "قطعة";

    // 0. Dedicated Sales Product lookup (Single Source of Truth for Sales Module).
    //
    // Only items explicitly flagged as sales products may be resolved here: `products.id`,
    // `ingredients.id` and `sales_products.id` are independent sequences, so matching a bare
    // itemId/productId against sales_products.id silently renames the line after an
    // unrelated sales product and moves the wrong inventory item.
    const explicitSalesProductId = Number((item as any).salesProductId) || 0;
    const isSalesProductItem =
      explicitSalesProductId > 0 ||
      item.itemType === "sales_product" ||
      (item as any).source === "sales_products";
    if (isSalesProductItem) {
      try {
        const spId = explicitSalesProductId || Number((item as any).productId) || Number(item.itemId) || 0;
        // Match by numeric id, then fall back to code/SKU/barcode/name.
        const spLookup: any = await client.query(`
          SELECT sp.*,
                 COALESCE(sp.master_item_id, sp.inventory_item_id) as resolved_master_id,
                 ing.id as ing_id, ing.name as ing_name, ing.code as ing_code, ing.unit as ing_unit,
                 COALESCE(ing.avg_cost, ing.cost_price, ing.last_purchase_price, ing.cost, 0) as ing_cost
          FROM sales_products sp
          LEFT JOIN ingredients ing ON ing.id = COALESCE(sp.master_item_id, sp.inventory_item_id)
          WHERE (sp.id = $1 AND $1 > 0)
             OR (sp.code = $2 AND $2 != '')
             OR (sp.sku = $2 AND $2 != '')
             OR (sp.barcode = $2 AND $2 != '')
             OR (sp.name ILIKE $3 AND $3 != '')
          ORDER BY
            CASE WHEN sp.id = $1 AND $1 > 0 THEN 0 ELSE 1 END,
            CASE WHEN sp.code = $2 AND $2 != '' THEN 0 ELSE 1 END,
            CASE WHEN sp.barcode = $2 AND $2 != '' THEN 0 ELSE 1 END,
            sp.id ASC
          LIMIT 1
        `, [spId, resolvedCode, resolvedName]);

        if (spLookup && spLookup.rows.length > 0) {
          const sp = spLookup.rows[0];
          if (sp.resolved_master_id) {
            // Strictly deduct the master inventory item from warehouse
            ingredientId = Number(sp.resolved_master_id);
            productId = null;
            itemType = "inventory_item";
            resolvedName = sp.name || resolvedName;
            resolvedCode = sp.code || resolvedCode;
            resolvedUnit = sp.unit || sp.ing_unit || resolvedUnit;
            if (unitCost <= 0) {
              unitCost = parseFloat(sp.ing_cost || 0);
            }
          } else if (ingredientId) {
            // Keep the explicitly provided ingredientId from the order item
            productId = null;
            itemType = "inventory_item";
            resolvedName = sp.name || resolvedName;
            resolvedCode = sp.code || resolvedCode;
            resolvedUnit = sp.unit || resolvedUnit;
          } else {
            productId = sp.id;
            ingredientId = null;
            itemType = "product";
            resolvedName = sp.name || resolvedName;
            resolvedCode = sp.code || resolvedCode;
            resolvedUnit = sp.unit || resolvedUnit;
          }
        }
      } catch (_) {}
    }

    // 0.5 POS Product lookup (منتجات نقطة البيع)
    if (!ingredientId && ((item as any).posProductId || (item as any).itemType === "pos_product" || (item as any).source === "pos_products")) {
      try {
        const pId = Number((item as any).posProductId || (item as any).productId || (item as any).itemId || 0);
        const posLookup = await client.query(`
          SELECT p.*, ing.name as ing_name, ing.unit as ing_unit,
                 COALESCE(ing.avg_cost, ing.cost_price, ing.last_purchase_price, ing.cost, 0) as ing_cost
          FROM products p
          LEFT JOIN ingredients ing ON ing.id = p.ingredient_id
          WHERE (p.id = $1 AND $1 > 0) OR (p.code = $2 AND $2 != '') OR p.name ILIKE $3
          LIMIT 1
        `, [pId, resolvedCode, resolvedName]);

        if (posLookup.rows.length > 0) {
          const prod = posLookup.rows[0];
          if (prod.ingredient_id) {
            ingredientId = Number(prod.ingredient_id);
            productId = null;
            itemType = "inventory_item";
            resolvedName = prod.name || resolvedName;
            resolvedCode = prod.code || resolvedCode;
            resolvedUnit = prod.unit || prod.ing_unit || resolvedUnit;
            if (unitCost <= 0) {
              unitCost = parseFloat(prod.ing_cost || prod.cost || 0);
            }
          } else {
            productId = prod.id;
            ingredientId = null;
            itemType = "product";
            resolvedName = prod.name || resolvedName;
            resolvedCode = prod.code || resolvedCode;
            resolvedUnit = prod.unit || resolvedUnit;
          }
        }
      } catch (_) {}
    }

    // 1. If explicitly an ingredient (صنف مخزني) or ingredientId is provided
    if (ingredientId || itemType === "inventory_item" || item.source === "ingredients") {
      try {
        const ingLookup = await client.query(
          "SELECT id, name, code, unit, cost_price, avg_cost, last_purchase_price FROM ingredients WHERE id = $1 OR (code = $2 AND code != '') OR name ILIKE $3 LIMIT 1",
          [ingredientId || 0, resolvedCode, resolvedName]
        );
        if (ingLookup.rows.length > 0) {
          const ing = ingLookup.rows[0];
          ingredientId = ing.id;
          productId = null; // Strictly ensure it is treated as an ingredient
          itemType = "inventory_item";
          resolvedName = resolvedName || ing.name;
          resolvedCode = resolvedCode || ing.code;
          resolvedUnit = resolvedUnit || ing.unit;
          if (unitCost <= 0) {
            unitCost = parseFloat(ing.avg_cost || ing.cost_price || ing.last_purchase_price || 0);
          }
        }
      } catch (_) {}
    } else if (productId || itemType === "product" || item.source === "products") {
      // 2. If explicitly a product (منتج تام)
      try {
        const prodLookup = await client.query(
          "SELECT id, name, code, unit, cost, cost_price, ingredient_id, track_inventory FROM products WHERE id = $1 OR (code = $2 AND code != '') OR name ILIKE $3 LIMIT 1",
          [productId || 0, resolvedCode, resolvedName]
        );
        if (prodLookup.rows.length > 0) {
          const prod = prodLookup.rows[0];
          productId = prod.id;
          if (prod.track_inventory !== false && prod.ingredient_id) {
            ingredientId = Number(prod.ingredient_id);
            productId = null;
            itemType = "inventory_item";
          } else {
            ingredientId = null;
            itemType = "product";
          }
          resolvedName = resolvedName || prod.name;
          resolvedCode = resolvedCode || prod.code;
          resolvedUnit = resolvedUnit || prod.unit;
          if (unitCost <= 0) {
            unitCost = parseFloat(prod.cost || prod.cost_price || 0);
          }
        }
      } catch (_) {}
    } else {
      // 3. Auto-detect by code or name
      try {
        const ingLookup = await client.query(
          "SELECT id, name, code, unit, cost_price, avg_cost, last_purchase_price FROM ingredients WHERE (code = $1 AND code != '') OR name ILIKE $2 LIMIT 1",
          [resolvedCode, resolvedName]
        );
        if (ingLookup.rows.length > 0) {
          const ing = ingLookup.rows[0];
          ingredientId = ing.id;
          productId = null;
          itemType = "inventory_item";
          resolvedName = resolvedName || ing.name;
          resolvedCode = resolvedCode || ing.code;
          resolvedUnit = resolvedUnit || ing.unit;
          if (unitCost <= 0) {
            unitCost = parseFloat(ing.avg_cost || ing.cost_price || ing.last_purchase_price || 0);
          }
        } else {
          const prodLookup = await client.query(
            "SELECT id, name, code, unit, cost, cost_price FROM products WHERE (code = $1 AND code != '') OR name ILIKE $2 LIMIT 1",
            [resolvedCode, resolvedName]
          );
          if (prodLookup.rows.length > 0) {
            const prod = prodLookup.rows[0];
            productId = prod.id;
            ingredientId = null;
            itemType = "product";
            resolvedName = resolvedName || prod.name;
            resolvedCode = resolvedCode || prod.code;
            resolvedUnit = resolvedUnit || prod.unit;
            if (unitCost <= 0) {
              unitCost = parseFloat(prod.cost || prod.cost_price || 0);
            }
          }
        }
      } catch (_) {}
    }

    // 4. Warehouse-specific cost lookup for ingredient
    if (ingredientId && unitCost <= 0) {
      try {
        const stockRes = await client.query(
          "SELECT avg_cost, last_cost, cost FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2 LIMIT 1",
          [warehouseId, ingredientId]
        );
        if (stockRes.rows.length > 0) {
          const row = stockRes.rows[0];
          unitCost = parseFloat(row.avg_cost || row.last_cost || row.cost || 0);
        }
      } catch (_) {}
    }

    return {
      ingredientId,
      productId,
      itemType,
      unitCost: isNaN(unitCost) ? 0 : unitCost,
      resolvedName,
      resolvedCode,
      resolvedUnit
    };
  }

  async createDelivery(dto: CreateDeliveryDTO): Promise<any> {
    const delivery = await this.repository.create(dto);
    ERPCache.delete(LIST_CACHE_KEY);

    // If delivery is created as confirmed/delivered, execute stock deduction and auto-posting
    if (dto.status === "معتمد" || dto.status === "تم التسليم") {
      return await this.confirmAndDispatchDelivery(delivery.id, dto.salesRep || "sales_module");
    }

    ERPEventBus.getInstance().emitEvent("SalesDeliveryCreated", {
      deliveryId: delivery.id,
      deliveryNo: delivery.deliveryNo,
      customerName: delivery.customerName,
      totalQtyDelivered: delivery.totalQtyDelivered,
      timestamp: new Date()
    });

    await SalesAuditService.log({
      entityType: 'delivery_note',
      entityId: delivery.id,
      entityNumber: delivery.deliveryNo,
      action: 'إنشاء إذن تسليم',
      newStatus: delivery.status || 'مسودة',
      userName: (dto as any).userName || dto.salesRep || 'المستودعات',
      details: {
        orderId: delivery.orderId,
        orderNo: delivery.orderNo,
        customerName: delivery.customerName,
        itemsCount: delivery.items?.length || 0
      }
    });

    return delivery;
  }

  async updateDelivery(id: number, dto: UpdateDeliveryDTO): Promise<any> {
    const found = await this.repository.getById(id);
    if (!found) {
      const err: any = new Error("إذن التسليم غير موجود");
      err.statusCode = 404;
      throw err;
    }

    const isNewlyConfirmed = (dto.status === "معتمد" || dto.status === "تم التسليم") && !found.isPosted;

    const delivery = await this.repository.update(id, dto);
    ERPCache.delete(LIST_CACHE_KEY);

    await SalesAuditService.log({
      entityType: 'delivery_note',
      entityId: id,
      entityNumber: found.deliveryNo,
      action: 'تعديل إذن تسليم',
      oldStatus: found.status,
      newStatus: dto.status || found.status,
      userName: (dto as any).userName || dto.salesRep || found.salesRep || 'المستودعات'
    });

    if (isNewlyConfirmed) {
      return await this.confirmAndDispatchDelivery(id, dto.salesRep || found.salesRep || "sales_module");
    }

    ERPEventBus.getInstance().emitEvent("SalesDeliveryUpdated", {
      deliveryId: id,
      timestamp: new Date()
    });

    return delivery;
  }

  /**
   * Confirms a delivery note, executes authoritative inventory stock deduction,
   * posts General Ledger COGS and inventory journal entry, and updates linked sales orders.
   *
   * Idempotency & Transactional Safety:
   * 1. Uses SELECT ... FOR UPDATE to lock the row.
   * 2. Checks is_posted flag to prevent double stock deduction and double GL posting.
   * 3. Validates Available Stock >= Delivery Quantity for all items upfront. If any item is deficient, rolls back and aborts.
   * 4. Deducts stock within a single ACID transaction via moveStock.
   * 5. Posts General Ledger entry and links journal_entry_id.
   * 6. Updates Sales Order delivered and remaining quantities.
   */
  async confirmAndDispatchDelivery(
    id: number,
    postedBy: string = "system",
    options?: { deferCogsEntry?: boolean; client?: any }
  ): Promise<any> {
    // عند تمرير client من المستدعي نشاركه معاملته بدل فتح معاملة مستقلة،
    // حتى يُردّ خصم المخزون تلقائيًا إذا فشل أي جزء من العملية الأصلية.
    const externalClient = options?.client;
    const client = externalClient || (await erpPool.connect());
    const ownTransaction = !externalClient;
    try {
      if (ownTransaction) await client.query("BEGIN");

      // 1. Lock delivery row FOR UPDATE to prevent race conditions and double submission
      const lockRes = await client.query("SELECT * FROM sales_delivery_notes WHERE id = $1 FOR UPDATE", [id]);
      if (lockRes.rows.length === 0) {
        const err: any = new Error("إذن التسليم غير موجود");
        err.statusCode = 404;
        throw err;
      }

      const lockedRow = lockRes.rows[0];

      // Idempotency: Prevent double dispatch and double GL posting
      if (lockedRow.is_posted || lockedRow.status === 'تم التسليم') {
        if (ownTransaction) await client.query("COMMIT");
        const alreadyDispatched = await this.repository.getById(id);
        return {
          ...alreadyDispatched,
          alreadyPosted: true,
          message: "إذن التسليم معتمد ومصروف بالفعل مسبقاً (تم منع التكرار)."
        };
      }

      const delivery = await this.repository.getById(id);
      if (!delivery) {
        const err: any = new Error("إذن التسليم غير موجود");
        err.statusCode = 404;
        throw err;
      }

      // 2. Resolve Warehouse — the numeric id saved on the delivery note is authoritative.
      //    The name is only a fallback for legacy notes, and matching ignores the trailing
      //    spaces that exist in the warehouses table.
      let warehouseId = Number(delivery.warehouseId) || Number(lockedRow.warehouse_id) || 0;
      if (warehouseId > 0) {
        const exists = await client.query("SELECT id FROM warehouses WHERE id = $1 LIMIT 1", [warehouseId]);
        if (!exists.rows[0]) warehouseId = 0;
      }
      const targetWhName = delivery.warehouse || lockedRow.warehouse;
      if (!warehouseId && targetWhName) {
        const whRes = await client.query(
          "SELECT id FROM warehouses WHERE TRIM(name) ILIKE TRIM($1) OR code = $1 OR id::text = $1 ORDER BY id LIMIT 1",
          [String(targetWhName)]
        );
        if (whRes.rows.length > 0) warehouseId = Number(whRes.rows[0].id);
      }
      if (!warehouseId) {
        const err: any = new Error("المخزن المحدد لإذن التسليم غير موجود — اختر المخزن وأعد المحاولة");
        err.statusCode = 400;
        throw err;
      }

      // 3. Pre-check stock availability for ALL items before deducting anything
      const deficits: Array<{
        itemName: string;
        itemCode: string;
        requiredQty: number;
        availableQty: number;
        deficit: number;
      }> = [];

      const resolvedItems: Array<{
        rawItem: any;
        resolved: any;
        qty: number;
        unitCost: number;
      }> = [];

      for (const item of (delivery.items || [])) {
        const qty = Number(item.qtyDelivered || item.qtyRequired) || 0;
        if (qty <= 0) continue;

        const resolved = await this.resolveItemDetails(client, item, warehouseId);
        const unitCost = Number(item.unitCost) || resolved.unitCost || 0;

        let availableQty = 0;

        if (resolved.ingredientId) {
          // Warehouse balances are authoritative; never fall back to global item-master stock.
          const invRes = await client.query(
            `SELECT COALESCE(SUM(quantity),0) AS quantity,
                    COALESCE(SUM(reserved),0) AS reserved
               FROM inventory_items
              WHERE warehouse_id = $1 AND ingredient_id = $2`,
            [warehouseId, resolved.ingredientId]
          );
          const row = invRes.rows[0] || {};
          availableQty = Math.max(0, Number(row.quantity || 0) - Number(row.reserved || 0));
        } else if (resolved.productId) {
          const tracked = await client.query(
            "SELECT track_inventory FROM products WHERE id=$1 LIMIT 1",
            [resolved.productId]
          );
          if (tracked.rows[0]?.track_inventory === false) availableQty = qty;
        } else {
          // If neither product nor ingredient exists in db, treat as non-stock custom item
          availableQty = qty;
        }

        if (availableQty < qty) {
          deficits.push({
            itemName: resolved.resolvedName || item.itemName,
            itemCode: resolved.resolvedCode || item.itemCode || "—",
            requiredQty: qty,
            availableQty,
            deficit: qty - availableQty
          });
        }

        resolvedItems.push({
          rawItem: item,
          resolved,
          qty,
          unitCost
        });
      }

      // If any deficit exists, roll back and abort with structured Arabic error
      if (deficits.length > 0) {
        const deficitLines = deficits.map(d =>
          `• الصنف: "${d.itemName}" (كود: ${d.itemCode}) — المطلوب: ${d.requiredQty}، المتاح بالمخزن: ${d.availableQty}، العجز: ${d.deficit}`
        ).join("\n");

        const err: any = new Error(
          `عجز في المخزون: لا يمكن صرف إذن التسليم لوجود عجز في الكميات المتاحة:\n${deficitLines}`
        );
        err.statusCode = 422;
        err.deficits = deficits;
        throw err;
      }

      // 4. Sufficient stock confirmed. Proceed with deduction and costing
      let totalCalculatedCost = 0;
      let totalAmount = 0;
      const itemsToPost: Array<{ name: string; qty: number; cost?: number }> = [];

      for (const resItem of resolvedItems) {
        const { rawItem, resolved, qty } = resItem;
        let unitCost = Number(resolved.unitCost) || Number(rawItem.unitCost) || 0;
        let itemCost = qty * unitCost;
        totalAmount += (Number(rawItem.price) || 0) * qty;

        // Authoritative stock deduction in inventory_items if tracked as ingredient
        if (resolved.ingredientId) {
          const movement = await moveStock(client, {
            warehouse_id: warehouseId,
            ingredient_id: resolved.ingredientId,
            field: "quantity",
            delta: -qty,
            ref_type: "sales_delivery",
            ref_id: delivery.id,
            user: postedBy,
            notes: `صرف وتسليم بضاعة إذن #${delivery.deliveryNo} — ${resolved.resolvedName || rawItem.itemName} (أمر بيع #${delivery.orderNo || '—'})`
          });
          unitCost = Number(movement.unit_cost) || 0;
          itemCost = Number(movement.total_cost) || 0;
        } else if (resolved.productId) {
          // المنتجات غير المرتبطة بصنف مخزني لا يمكن خصمها من مخزن محدد.
          // لا نعدّل مخزونًا إجماليًا بصمت لأن ذلك يخالف المخزن المختار.
          const tracked = await client.query(
            "SELECT track_inventory FROM products WHERE id = $1 LIMIT 1",
            [resolved.productId]
          );
          if (tracked.rows[0]?.track_inventory !== false) {
            const err: any = new Error(
              `المنتج "${resolved.resolvedName || rawItem.itemName}" غير مربوط بصنف مخزني، لذلك لا يمكن خصمه من المخزن المحدد. اربطه بصنف مخزني من شاشة المنتجات أولًا.`
            );
            err.statusCode = 422;
            throw err;
          }
        }

        // Update item costs on sales_delivery_note_items
        if (rawItem.id) {
          await client.query(`
            UPDATE sales_delivery_note_items
            SET unit_cost = $1, total_cost = $2, ingredient_id = COALESCE(ingredient_id, $3)
            WHERE id = $4
          `, [unitCost, itemCost, resolved.ingredientId, rawItem.id]);
        }
        totalCalculatedCost += itemCost;
        itemsToPost.push({
          name: resolved.resolvedName || rawItem.itemName,
          qty,
          cost: unitCost
        });
      }

      // 5. Post General Ledger Entry (Double-Entry: Debit COGS, Credit Inventory Asset)
      let journalEntryId: number | null = null;
      if (!options?.deferCogsEntry) {
        const je = await postDeliveryEntry({
          id: delivery.id,
          delivery_no: delivery.deliveryNo,
          order_id: delivery.orderId,
          order_no: delivery.orderNo,
          customer_name: delivery.customerName,
          total_cost: totalCalculatedCost,
          total_amount: totalAmount,
          branch_id: delivery.branchId || 1,
          warehouse_id: warehouseId,
          warehouse_name: delivery.warehouse || `مخزن ${warehouseId}`,
          items: itemsToPost
        });
        journalEntryId = je?.id || null;
        if (totalCalculatedCost > 0 && !journalEntryId) {
          throw new Error(`تعذر إنشاء قيد تكلفة إذن التسليم #${delivery.deliveryNo}`);
        }
      }

      // 6. Update Delivery Note Record
      await client.query(`
        UPDATE sales_delivery_notes
        SET status = 'تم التسليم',
            is_posted = true,
            posted_at = CURRENT_TIMESTAMP,
            posted_by = $1,
            journal_entry_id = COALESCE($2, journal_entry_id),
            total_cost = $3,
            total_amount = $4,
            warehouse_id = $5
        WHERE id = $6
      `, [postedBy, journalEntryId, totalCalculatedCost, totalAmount, warehouseId, delivery.id]);

      // 7. Update linked Sales Order delivered and remaining quantities
      if (delivery.orderId || delivery.orderNo) {
        try {
          const totalDelivered = Number(delivery.totalQtyDelivered) || Number(delivery.totalQtyRequired) || 0;
          await client.query(`
            UPDATE erp_sales_orders
            SET delivered_qty = COALESCE(delivered_qty, 0) + $1,
                remaining_qty = GREATEST(0, total_qty - (COALESCE(delivered_qty, 0) + $1)),
                status = CASE 
                  WHEN (total_qty - (COALESCE(delivered_qty, 0) + $1)) <= 0 THEN 'مكتمل'
                  ELSE 'تم التسليم جزئياً'
                END,
                delivery_status = CASE 
                  WHEN (total_qty - (COALESCE(delivered_qty, 0) + $1)) <= 0 THEN 'تم التسليم'
                  ELSE 'تم التسليم جزئياً'
                END
            WHERE id = $2 OR order_no = $3
          `, [totalDelivered, delivery.orderId || 0, delivery.orderNo || '']);
          ERPCache.delete("sales:orders:all");
        } catch (ordErr: any) {
          console.warn("[DeliveryService] Sales order quantity update warning:", ordErr.message);
        }
      }

      if (ownTransaction) {
        await client.query("COMMIT");
        ERPCache.delete(LIST_CACHE_KEY);

        await SalesAuditService.log({
          entityType: 'delivery_note',
          entityId: delivery.id,
          entityNumber: delivery.deliveryNo,
          action: 'اعتماد وصرف من المخزن',
          oldStatus: delivery.status,
          newStatus: 'تم التسليم',
          userName: postedBy,
          details: {
            totalCost: totalCalculatedCost,
            journalEntryId,
            warehouseId,
            orderNo: delivery.orderNo
          }
        });

        ERPEventBus.getInstance().emitEvent("SalesDeliveryPosted", {
          deliveryId: delivery.id,
          deliveryNo: delivery.deliveryNo,
          journalEntryId,
          totalCost: totalCalculatedCost,
          timestamp: new Date()
        });
      }

      return await this.repository.getById(id);
    } catch (err: any) {
      if (ownTransaction) await client.query("ROLLBACK");
      throw err;
    } finally {
      if (ownTransaction) client.release();
    }
  }

  async deleteDelivery(id: number): Promise<void> {
    const found = await this.repository.getById(id);
    if (!found) {
      const err: any = new Error("إذن التسليم غير موجود");
      err.statusCode = 404;
      throw err;
    }

    if (found.isPosted) {
      const err: any = new Error("لا يمكن حذف إذن تسليم معتمد ومصروف من المخزن وقيده مرحل للحسابات.");
      err.statusCode = 400;
      throw err;
    }

    // If linked to an order, rollback delivered quantities
    if (found.orderId && found.totalQtyDelivered) {
      try {
        const qty = Number(found.totalQtyDelivered) || 0;
        await erpPool.query(`
          UPDATE erp_sales_orders
          SET delivered_qty = GREATEST(0, COALESCE(delivered_qty, 0) - $1),
              remaining_qty = LEAST(total_qty, COALESCE(remaining_qty, 0) + $1),
              status = CASE 
                WHEN GREATEST(0, COALESCE(delivered_qty, 0) - $1) = 0 THEN 'مؤكد'
                ELSE 'تم التسليم جزئياً'
              END,
              delivery_status = CASE 
                WHEN GREATEST(0, COALESCE(delivered_qty, 0) - $1) = 0 THEN 'غير مسلم'
                ELSE 'تم التسليم جزئياً'
              END
          WHERE id = $2
        `, [qty, found.orderId]);
        ERPCache.delete("sales:orders:all");
      } catch (e: any) {
        console.warn("Rollback order on delete delivery notice:", e.message);
      }
    }

    await this.repository.delete(id);
    ERPCache.delete(LIST_CACHE_KEY);

    await SalesAuditService.log({
      entityType: 'delivery_note',
      entityId: id,
      entityNumber: found.deliveryNo,
      action: 'حذف إذن تسليم',
      oldStatus: found.status,
      newStatus: 'محذوف',
      userName: 'المستودعات'
    });

    ERPEventBus.getInstance().emitEvent("SalesDeliveryDeleted", {
      deliveryId: id,
      timestamp: new Date()
    });
  }
}
