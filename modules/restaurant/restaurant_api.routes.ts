import { Router } from "express";
import { pool } from "../../server-db.js";
import { JWT_SECRET, upload, logAction, isMonthClosed, getSetting, formatArabicLine, buildReceiptRow, printOrderToKitchen, printTestReceipt, findReceiptPrinter, io } from "../../server.js";
import { ERPCache, ERPEventBus, ERPJobQueue, ERPAIAssistant } from "../../server-erp-core.js";
import { authenticateToken } from "../system/system_api.routes.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import fs from "fs";
import os from "os";
import { createHash } from "crypto";
import * as XLSX from "xlsx";
import { moveStock } from "../warehouses/services/inventory.service.js";
import { postSalesEntry } from "../accounts/services/auto-posting.service.js";
import { CUSTOMER_RECEIVABLE_SQL } from "../customers/services/customer-ledger.service.js";

const router = Router();
let posIdempotencyTableReady = false;
let posIdempotencyTablePromise: Promise<void> | null = null;
let posShiftSchemaReady = false;
let posShiftSchemaPromise: Promise<void> | null = null;

async function ensurePosShiftSchema(): Promise<void> {
  if (posShiftSchemaReady) return;
  if (!posShiftSchemaPromise) {
    posShiftSchemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS pos_shifts (
          id SERIAL PRIMARY KEY,
          shift_number VARCHAR(64) UNIQUE,
          user_id INTEGER NOT NULL REFERENCES users(id),
          employee_id INTEGER REFERENCES employees(id),
          branch_id INTEGER NOT NULL REFERENCES branches(id),
          terminal_id VARCHAR(64) NOT NULL,
          cashbox_id INTEGER NOT NULL REFERENCES treasury_accounts(id),
          opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
          expected_cash NUMERIC(14,2),
          actual_cash NUMERIC(14,2),
          cash_difference NUMERIC(14,2),
          status VARCHAR(16) NOT NULL DEFAULT 'open',
          opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          closed_at TIMESTAMP,
          variance_approved_at TIMESTAMP,
          variance_approved_by INTEGER REFERENCES users(id),
          opening_notes TEXT,
          closing_notes TEXT,
          closing_summary JSONB,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shift_id INTEGER REFERENCES pos_shifts(id)`);
      await pool.query(`ALTER TABLE treasury_transactions ADD COLUMN IF NOT EXISTS shift_id INTEGER REFERENCES pos_shifts(id)`);
      await pool.query(`ALTER TABLE treasury_transactions ADD COLUMN IF NOT EXISTS employee_id INTEGER`);
      await pool.query(`ALTER TABLE treasury_transactions ADD COLUMN IF NOT EXISTS terminal_id VARCHAR(64)`);
      await pool.query(`ALTER TABLE safe_transactions ADD COLUMN IF NOT EXISTS shift_id INTEGER REFERENCES pos_shifts(id)`);
      await pool.query(`ALTER TABLE pos_shifts ADD COLUMN IF NOT EXISTS variance_approved_at TIMESTAMP`);
      await pool.query(`ALTER TABLE pos_shifts ADD COLUMN IF NOT EXISTS variance_approved_by INTEGER REFERENCES users(id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_pos_shifts_user_status ON pos_shifts(user_id, status, opened_at DESC)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_pos_shifts_branch_terminal_status ON pos_shifts(branch_id, terminal_id, status)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_shift_id ON orders(shift_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_treasury_transactions_shift_id ON treasury_transactions(shift_id)`);
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_shift_cash_variance_once
        ON treasury_transactions(reference_type, reference_id)
        WHERE reference_type = 'pos_shift_variance'
      `);
      posShiftSchemaReady = true;
    })().catch((error) => {
      posShiftSchemaPromise = null;
      throw error;
    });
  }
  await posShiftSchemaPromise;
}

function canManageAllPOSShifts(user: any): boolean {
  const permissions = parseJsonObject(user?.permissions);
  return user?.role === "admin"
    || permissions.all === true
    || permissions.system_admin === true
    || permissions["pos.shifts_manage_all"] === true
    || permissions["pos.shift_view_all"] === true;
}

function canCloseOtherPOSShift(user: any): boolean {
  const permissions = parseJsonObject(user?.permissions);
  return user?.role === "admin"
    || permissions.all === true
    || permissions.system_admin === true
    || permissions["pos.shifts_manage_all"] === true
    || permissions["pos.shift_close_other"] === true
    || permissions["pos.shift_force_close"] === true;
}

function hasPOSShiftPermission(user: any, permission: string): boolean {
  const permissions = parseJsonObject(user?.permissions);
  return user?.role === "admin"
    || permissions.all === true
    || permissions.system_admin === true
    || permissions[permission] === true;
}

function canAccessPOSShiftBranch(user: any, branchId: number): boolean {
  const permissions = parseJsonObject(user?.permissions);
  return user?.role === "admin"
    || permissions.all === true
    || permissions.system_admin === true
    || permissions["pos.shifts_manage_all"] === true
    || !Number(user?.branch_id)
    || Number(user.branch_id) === branchId;
}

async function getPOSShiftSettings(db: any = pool): Promise<any> {
  const result = await db.query("SELECT value FROM settings WHERE key = 'pos_configuration' LIMIT 1");
  const value = result.rows[0]?.value;
  const configuration = parseJsonObject(value);
  return {
    enabled: configuration.shiftManagement?.enabled === true,
    openingBalanceMode: ["required", "optional", "none"].includes(configuration.shiftManagement?.openingBalanceMode)
      ? configuration.shiftManagement.openingBalanceMode
      : "optional",
    employeeOwnShiftOnly: configuration.shiftManagement?.employeeOwnShiftOnly !== false,
    allowMultipleOpenShifts: configuration.shiftManagement?.allowMultipleOpenShifts !== false,
    terminalId: String(configuration.shiftManagement?.terminalId || "POS-01").trim().slice(0, 64) || "POS-01",
  };
}

async function ensurePosIdempotencyTable(): Promise<void> {
  if (posIdempotencyTableReady) return;
  if (!posIdempotencyTablePromise) {
    posIdempotencyTablePromise = pool.query(`
      CREATE TABLE IF NOT EXISTS pos_order_idempotency (
        idempotency_key VARCHAR(200) PRIMARY KEY,
        payload_hash CHAR(64) NOT NULL,
        order_id INTEGER NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).then(() => {
      posIdempotencyTableReady = true;
    }).catch((error: any) => {
      posIdempotencyTablePromise = null;
      throw error;
    });
  }
  await posIdempotencyTablePromise;
}

const parseJsonObject = (value: any): Record<string, any> => {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

async function postPOSOrderAccountingEntry(client: any, order: any, userId?: number): Promise<any> {
  const existing = await client.query(
    `SELECT id FROM journal_entries
      WHERE source_type IN ('pos', 'restaurant') AND source_id = $1
      ORDER BY id DESC LIMIT 1`,
    [order.id]
  );
  if (existing.rows[0]) return existing.rows[0];

  const customer = order.customer_phone
    ? await client.query("SELECT id FROM customers WHERE phone = $1 LIMIT 1", [order.customer_phone])
    : await client.query("SELECT id FROM customers WHERE name ILIKE $1 LIMIT 1", [order.customer_name || ""]);
  const costResult = await client.query(
    `SELECT COALESCE(SUM(total_cost), 0) AS total_cost
       FROM inventory_transactions
      WHERE reference_id = $1 AND reference_type IN ('pos_sale', 'call_center_sale')`,
    [order.id]
  );
  const total = Number(order.total) || 0;
  const entry = await postSalesEntry({
    id: Number(order.id),
    total,
    discount: Number(order.discount) || 0,
    tax_amount: Number(order.tax_amount) || 0,
    net_total: total,
    total_cost: Number(costResult.rows[0]?.total_cost) || 0,
    payment_method: order.payment_method || "cash",
    customer_id: Number(customer.rows[0]?.id) || undefined,
    customer_name: order.customer_name || "عميل نقدي",
    branch_id: Number(order.branch_id) || 1,
    source_type: "pos",
    source_label: "إيرادات نقطة البيع",
    user_id: Number(userId || order.user_id) || undefined
  }, client);
  if (!entry?.id) throw new Error(`تعذر إنشاء قيد اليومية لأوردر POS رقم ${order.id}`);
  return entry;
}

const truthyDb = (value: any, fallback = true) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (value === true || value === 1 || value === "1" || value === "true") return true;
  if (value === false || value === 0 || value === "0" || value === "false") return false;
  return fallback;
};

const pickDb = (value: any, fallback: any) => (value === undefined || value === null || value === "" ? fallback : value);

const enrichCategoryRow = (category: any) => ({
  ...category,
  is_active: truthyDb(category.is_active, true),
  show_in_pos: truthyDb(category.show_in_pos, true),
  color: pickDb(category.color, "#2563eb"),
  icon: pickDb(category.icon, "package"),
  description: pickDb(category.description, ""),
  sort_order: Number(category.sort_order || 0),
  parent_id: category.parent_id ? Number(category.parent_id) : null,
});

const enrichProductRow = (product: any) => {
  const props = parseJsonObject(product.properties);
  const ingredientId = product.ingredient_id ? Number(product.ingredient_id) : (props.ingredient_id ? Number(props.ingredient_id) : null);
  const showInPos = truthyDb(pickDb(product.show_in_pos, pickDb(product.is_available_in_pos, props.show_in_pos ?? props.is_available_in_pos)), true);
  const isAvailableInPos = truthyDb(pickDb(product.is_available_in_pos, pickDb(product.show_in_pos, props.is_available_in_pos ?? props.show_in_pos)), true);
  const showInSales = truthyDb(pickDb(product.show_in_sales, pickDb(product.is_available_in_sales, props.show_in_sales ?? props.is_available_in_sales)), true);
  const isAvailableInSales = truthyDb(pickDb(product.is_available_in_sales, pickDb(product.show_in_sales, props.is_available_in_sales ?? props.show_in_sales)), true);
  const salesPrice = product.sales_price !== null && product.sales_price !== undefined && product.sales_price !== ""
    ? Number(product.sales_price)
    : (props.sales_price !== null && props.sales_price !== undefined && props.sales_price !== "" ? Number(props.sales_price) : null);

  return {
    ...product,
    ingredient_id: ingredientId,
    master_item_id: ingredientId,
    properties: props,
    price: Number(product.price || 0),
    cost: Number(pickDb(product.cost, props.cost || 0)),
    stock: Number(pickDb(product.stock, props.stock || 0)),
    min_stock: Number(pickDb(product.min_stock, props.min_stock || 0)),
    max_stock: Number(pickDb(product.max_stock, props.max_stock || 0)),
    tax_rate: Number(pickDb(product.tax_rate, props.tax_rate || 14)),
    code: pickDb(product.code, props.code || ""),
    barcode: pickDb(product.barcode, props.barcode || ""),
    unit: pickDb(product.unit, props.unit || "قطعة"),
    brand: pickDb(product.brand, props.brand || ""),
    business_profile: pickDb(product.business_profile, props.business_profile || "general"),
    item_type: pickDb(product.item_type, props.item_type || "sale"),
    show_in_pos: showInPos,
    is_available_in_pos: isAvailableInPos,
    show_in_sales: showInSales,
    is_available_in_sales: isAvailableInSales,
    sales_price: salesPrice,
    is_active: truthyDb(pickDb(product.is_active, props.is_active), true),
    is_favorite: truthyDb(pickDb(product.is_favorite, props.is_favorite), false),
    allow_discount: truthyDb(pickDb(product.allow_discount, props.allow_discount), true),
    track_inventory: truthyDb(pickDb(product.track_inventory, props.track_inventory), true),
    preparation_time: Number(pickDb(product.preparation_time, props.preparation_time || 0)),
    kitchen_station: pickDb(product.kitchen_station, props.kitchen_station || ""),
    size_label: pickDb(product.size_label, props.size_label || ""),
    color: pickDb(product.color, props.color || ""),
    material: pickDb(product.material, props.material || ""),
    supplier: pickDb(product.supplier, props.supplier || ""),
    shelf_life_days: Number(pickDb(product.shelf_life_days, props.shelf_life_days || 0)),
    display_order: Number(pickDb(product.display_order, props.display_order || 0)),
  };
};

const isEnabledForPOS = (row: any) => truthyDb(row.is_active, true) && truthyDb(row.show_in_pos, true);

const insertProductIngredientSafe = async (
  client: any,
  productId: number,
  ingredientId: number,
  quantity: number,
  sizeName: string = "",
  wastePercent: number = 0,
  unit: string = ""
) => {
  try {
    await client.query(
      "INSERT INTO product_ingredients (product_id, ingredient_id, quantity, size_name, waste_percent, unit) VALUES ($1, $2, $3, $4, $5, $6)",
      [productId, ingredientId, quantity || 0, sizeName || "", wastePercent || 0, unit || ""]
    );
  } catch (_) {
    try {
      await client.query(
        "INSERT INTO product_ingredients (product_id, ingredient_id, quantity, size_name, waste_percent) VALUES ($1, $2, $3, $4, $5)",
        [productId, ingredientId, quantity || 0, sizeName || "", wastePercent || 0]
      );
    } catch (_) {
      await client.query(
        "INSERT INTO product_ingredients (product_id, ingredient_id, quantity) VALUES ($1, $2, $3)",
        [productId, ingredientId, quantity || 0]
      );
    }
  }
};


const collectCategoryDescendantIds = (categories: any[], rootId: number | string) => {
  const normalizedRootId = Number(rootId);
  if (!Number.isFinite(normalizedRootId)) return [];

  const childrenByParent = new Map<number, any[]>();

  for (const category of categories) {
    const parentId = category.parent_id === null || category.parent_id === undefined ? null : Number(category.parent_id);
    if (parentId !== null) {
      const list = childrenByParent.get(parentId) || [];
      list.push(category);
      childrenByParent.set(parentId, list);
    }
  }

  const result = new Set<number>([normalizedRootId]);
  const stack = [...(childrenByParent.get(normalizedRootId) || [])];

  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;

    const id = Number(current.id);
    if (result.has(id)) continue;

    result.add(id);
    stack.push(...(childrenByParent.get(id) || []));
  }

  return Array.from(result);
};

const buildEnabledCategorySet = (categories: any[]) => {
  const byId = new Map<number, any>();
  categories.forEach((category) => byId.set(Number(category.id), category));

  const enabled = new Set<number>();

  const isPathEnabled = (categoryId: any): boolean => {
    const id = Number(categoryId);
    if (!Number.isFinite(id)) return false;
    if (enabled.has(id)) return true;

    const category = byId.get(id);
    if (!category || !isEnabledForPOS(category)) return false;

    if (category.parent_id && !isPathEnabled(category.parent_id)) {
      return false;
    }

    enabled.add(id);
    return true;
  };

  categories.forEach((category) => isPathEnabled(category.id));
  return enabled;
};


  // Print Order Endpoint
  router.post("/api/orders/:id/print", async (req, res) => {
    const { id } = req.params;
    try {
      const orderResult = await pool.query("SELECT * FROM orders WHERE id = $1", [id]);
      const order = orderResult.rows[0];
      if (!order) return res.status(404).json({ error: "Order not found" });

      const itemsResult = await pool.query(`
        SELECT oi.*, p.name 
        FROM order_items oi 
        JOIN products p ON oi.product_id = p.id 
        WHERE oi.order_id = $1
      `, [id]);
      const items = itemsResult.rows;

      await printOrderToKitchen(order.id, items, { 
        order_type: order.order_type, 
        table_number: order.table_number,
        notes: order.notes
      }, order.branch_id);

      res.json({ success: true });
    } catch (error) {
      console.error("Print error:", error);
      res.status(500).json({ error: "Failed to print order" });
    }
  });

  // Public Endpoints for Web Menu
  router.get("/api/public/menu-data", async (req, res) => {
    try {
      const cacheKey = "public:menu-data";
      const cached = ERPCache.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const categoriesResult = await pool.query("SELECT * FROM categories");
      const productsResult = await pool.query("SELECT * FROM products");
      const categories = categoriesResult.rows.map(enrichCategoryRow).filter(isEnabledForPOS);
      const products = productsResult.rows.map(enrichProductRow).filter(isEnabledForPOS);
      
      // Bulk fetch product sizes
      const sizesResult = await pool.query("SELECT * FROM product_sizes");
      const allSizes = sizesResult.rows;

      const sizesMap = new Map<number, any[]>();
      for (const size of allSizes) {
        if (!sizesMap.has(size.product_id)) {
          sizesMap.set(size.product_id, []);
        }
        sizesMap.get(size.product_id)!.push({
          ...size,
          price: parseFloat(size.price) || 0
        });
      }

      const productsWithData = products.map((p: any) => {
        return { 
          ...p, 
          price: parseFloat(p.price) || 0,
          sizes: sizesMap.get(p.id) || []
        };
      });

      const sysNameRes = await pool.query("SELECT value FROM settings WHERE key = 'system_name'");
      const logoRes = await pool.query("SELECT value FROM settings WHERE key = 'customer_menu_logo'");

      const responseData = { 
        categories, 
        products: productsWithData,
        systemName: sysNameRes.rows.length > 0 ? sysNameRes.rows[0].value : 'Remo Pro',
        logo: logoRes.rows.length > 0 ? logoRes.rows[0].value : null
      };

      ERPCache.set(cacheKey, responseData, 60); // Cache for 1 minute

      res.json(responseData);
    } catch (error) {
      console.error("Fetch web menu data error:", error);
      res.status(500).json({ error: "Failed to fetch menu data" });
    }
  });

  router.post("/api/public/call-waiter", async (req, res) => {
    const { branch_id, table_number } = req.body;
    try {
      io.emit("call_waiter", { branch_id, table_number, timestamp: new Date() });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to call waiter" });
    }
  });

  router.post("/api/public/submit-complaint", async (req, res) => {
    const { branch_id, table_number, customer_name, customer_phone, details } = req.body;
    try {
      const tableText = table_number ? ` (طاولة ${table_number})` : '';
      await pool.query(
        "INSERT INTO complaints (customer_name, customer_phone, category, details, branch_id) VALUES ($1, $2, $3, $4, $5)",
        [customer_name || 'عميل في المطعم', customer_phone || '', 'شكوى عميل داخلي' + tableText, details, branch_id]
      );
      io.emit("new_complaint", { branch_id, table_number, details, timestamp: new Date() });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to submit complaint" });
    }
  });

  router.post("/api/public/submit-rating", async (req, res) => {
    const { branch_id, table_number, rating, feedback } = req.body;
    try {
      await pool.query(
        "INSERT INTO customer_ratings (branch_id, table_number, rating, feedback) VALUES ($1, $2, $3, $4)",
        [branch_id, table_number, rating, feedback]
      );
      io.emit("new_rating", { branch_id, table_number, rating, feedback, timestamp: new Date() });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to submit rating" });
    }
  });

  router.post("/api/public/web-orders", async (req, res) => {
    const { branch_id, table_number, items, total, notes } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const orderResult = await client.query(
        "INSERT INTO web_orders (branch_id, table_number, total, notes) VALUES ($1, $2, $3, $4) RETURNING id",
        [branch_id, table_number, total, notes]
      );
      const webOrderId = orderResult.rows[0].id;

      for (const item of items) {
        await client.query(
          "INSERT INTO web_order_items (web_order_id, product_id, size_name, quantity, price, notes) VALUES ($1, $2, $3, $4, $5, $6)",
          [webOrderId, item.product_id, item.size_name, item.quantity, item.price, item.notes]
        );
      }

      await client.query('COMMIT');
      
      // Notify via Socket.io
      io.emit("new-web-order", { id: webOrderId, branch_id, table_number });

      res.json({ success: true, id: webOrderId });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error("Web order error:", error);
      res.status(500).json({ error: "Failed to submit web order" });
    } finally {
      client.release();
    }
  });

  // Web Orders Management Endpoints
  router.get("/api/web-orders", authenticateToken, async (req: any, res: any) => {
    const { branch_id } = req.query;
    try {
      let query = `
        SELECT wo.*, b.name as branch_name 
        FROM web_orders wo
        JOIN branches b ON wo.branch_id = b.id
        WHERE wo.status = 'pending'
      `;
      const params = [];
      if (branch_id) {
        params.push(branch_id);
        query += ` AND wo.branch_id = $1`;
      }
      query += " ORDER BY wo.timestamp DESC";
      
      const result = await pool.query(query, params);
      const orders = result.rows;
      
      const ordersWithItems = await Promise.all(orders.map(async (order: any) => {
        const itemsResult = await pool.query(`
          SELECT woi.*, p.name as product_name
          FROM web_order_items woi
          JOIN products p ON woi.product_id = p.id
          WHERE woi.web_order_id = $1
        `, [order.id]);
        return { ...order, items: itemsResult.rows };
      }));

      res.json(ordersWithItems);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch web orders" });
    }
  });

  router.post("/api/web-orders/:id/confirm", authenticateToken, async (req: any, res: any) => {
    const { id } = req.params;
    const { userId } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Get web order data
      const webOrderRes = await client.query("SELECT * FROM web_orders WHERE id = $1", [id]);
      const webOrder = webOrderRes.rows[0];
      if (!webOrder) throw new Error("Web order not found");

      const itemsRes = await client.query("SELECT * FROM web_order_items WHERE web_order_id = $1", [id]);
      const items = itemsRes.rows;

      // 2. Create the real order (similar to standard POS order logic)
      // Note: We'll assume it's dine_in and use table_number
      
      let daily_number = 1;
      const dailySeqRes = await client.query(`
        SELECT COALESCE(MAX(daily_number), 0) + 1 as next_val 
        FROM orders 
        WHERE branch_id = $1 AND DATE(timestamp) = CURRENT_DATE
      `, [webOrder.branch_id]);
      if (dailySeqRes.rows.length > 0) daily_number = dailySeqRes.rows[0].next_val;

      const orderResult = await client.query(`
        INSERT INTO orders (
          total, branch_id, user_id, table_number, is_paid, 
          notes, order_type, status, daily_number
        ) VALUES ($1, $2, $3, $4, 0, $5, 'dine_in', 'pending', $6)
        RETURNING id
      `, [webOrder.total, webOrder.branch_id, userId, webOrder.table_number, webOrder.notes, daily_number]);
      const newOrderId = orderResult.rows[0].id;

      // 3. Insert items and apply the inventory movement atomically.
      const stockMoves = new Map<string, { warehouseId: number; ingredientId: number; qty: number }>();
      for (const item of items) {
        await client.query(`INSERT INTO order_items (order_id, product_id, size_name, quantity, price, notes) VALUES ($1, $2, $3, $4, $5, $6)`, [newOrderId, item.product_id, item.size_name, item.quantity, item.price, item.notes]);
        const productRes = await client.query("SELECT warehouse_id, track_inventory FROM products WHERE id = $1", [item.product_id]);
        const product = productRes.rows[0];
        if (product?.track_inventory === false) continue;
        let warehouseId = product?.warehouse_id;
        if (!warehouseId) warehouseId = (await client.query("SELECT id FROM warehouses WHERE (branch_id = $1 AND is_kitchen::text IN ('1', 'true')) OR branch_id = $1 OR is_main::text IN ('1', 'true') ORDER BY is_kitchen DESC, is_main DESC LIMIT 1", [webOrder.branch_id])).rows[0]?.id;
        if (!warehouseId) throw new Error(`لا يوجد مخزن مرتبط بفرع الطلب للصنف #${item.product_id}`);
        const recipe = await client.query("SELECT ingredient_id, quantity FROM product_ingredients WHERE product_id = $1", [item.product_id]);
        for (const pi of recipe.rows) {
          const qty = Number(pi.quantity || 0) * Number(item.quantity || 1);
          if (qty <= 0) continue;
          const key = `${warehouseId}:${pi.ingredient_id}`;
          const current = stockMoves.get(key);
          if (current) current.qty += qty;
          else stockMoves.set(key, { warehouseId: Number(warehouseId), ingredientId: Number(pi.ingredient_id), qty });
        }
      }
      for (const move of stockMoves.values()) {
        await moveStock(client, { warehouse_id: move.warehouseId, ingredient_id: move.ingredientId, delta: -move.qty, ref_type: "web_order_sale", ref_id: Number(newOrderId), user: String(userId || "system"), notes: `خصم مقادير طلب ويب رقم ${newOrderId}` });
      }
      if (stockMoves.size > 0) await client.query("UPDATE orders SET is_deducted = 1 WHERE id = $1", [newOrderId]);

      // 4. Update web order status
      await client.query("UPDATE web_orders SET status = 'confirmed' WHERE id = $1", [id]);

      await client.query('COMMIT');
      
      // 5. Side effects (after commit for data consistency)
      try {
        // Print to kitchen
        const itemsForPrinting = items.map((it: any) => ({
          id: it.product_id,
          name: '', // Will be fetched inside printing function
          price: it.price,
          quantity: it.quantity,
          notes: it.notes
        }));
        
        printOrderToKitchen(newOrderId, itemsForPrinting, { order_type: 'dine_in', table_number: webOrder.table_number, notes: webOrder.notes }, webOrder.branch_id).catch(console.error);

        // Broadcast to kitchen
        const fullOrderRes = await pool.query(`
          SELECT o.*, b.name as branch_name 
          FROM orders o 
          LEFT JOIN branches b ON o.branch_id = b.id 
          WHERE o.id = $1
        `, [newOrderId]);
        const fullOrder = fullOrderRes.rows[0];
        
        const orderItemsRes = await pool.query(`
          SELECT oi.*, p.name as product_name 
          FROM order_items oi 
          JOIN products p ON oi.product_id = p.id 
          WHERE oi.order_id = $1
        `, [newOrderId]);
        const orderItems = orderItemsRes.rows;
        
        io.emit("new_order", { ...fullOrder, items: orderItems });
      } catch (err) {
        console.error("Post-confirmation side effects failed:", err);
      }
      
      res.json({ success: true, orderId: newOrderId });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error("Confirm web order error:", error);
      res.status(500).json({ error: "Failed to confirm web order" });
    } finally {
      client.release();
    }
  });

  router.post("/api/web-orders/:id/reject", authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query("UPDATE web_orders SET status = 'rejected' WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to reject web order" });
    }
  });

  // Centralized cache invalidation helper for products/categories modification
  const invalidateProductCache = () => {
    ERPCache.delete("pos:data");
    ERPCache.delete("products:manage-data");
    ERPCache.delete("ingredients:list");
    ERPCache.delete("public:menu-data");
  };

  // POS Endpoints
  router.get("/api/pos/data", async (req, res) => {
    try {
      const cacheKey = "pos:data";
      const cached = ERPCache.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const [
        categoriesResult,
        productsResult,
        ingredientsResult,
        sizesResult,
        invItemsRes,
        masterIngsRes
      ] = await Promise.all([
        pool.query("SELECT * FROM categories").catch(() => ({ rows: [] })),
        pool.query("SELECT * FROM products").catch(() => ({ rows: [] })),
        pool.query(`
          SELECT pi.*, i.name as ingredient_name, i.unit, i.cost as unit_cost
          FROM product_ingredients pi
          JOIN ingredients i ON pi.ingredient_id = i.id
        `).catch(() => ({ rows: [] })),
        pool.query("SELECT * FROM product_sizes").catch(() => ({ rows: [] })),
        pool.query(`
          SELECT warehouse_id, ingredient_id, quantity, reserved, 
                 (COALESCE(quantity, 0) - COALESCE(reserved, 0)) as available
          FROM inventory_items
        `).catch(() => ({ rows: [] })),
        pool.query(`
          SELECT id, name, unit, cost, avg_cost, current_stock, code, barcode
          FROM ingredients
        `).catch(() => ({ rows: [] }))
      ]);

      let allCategories = (categoriesResult.rows || []).map(enrichCategoryRow);
      if (allCategories.length === 0) {
        allCategories = [
          { id: 1, name: "المشروبات والقهوة", color: "#2563eb", icon: "coffee", is_active: true, show_in_pos: true, sort_order: 1 },
          { id: 2, name: "المأكولات والأطباق", color: "#10b981", icon: "utensils", is_active: true, show_in_pos: true, sort_order: 2 },
          { id: 3, name: "الحلويات والمخبوزات", color: "#f59e0b", icon: "cake", is_active: true, show_in_pos: true, sort_order: 3 },
          { id: 4, name: "منتجات عامة", color: "#6366f1", icon: "package", is_active: true, show_in_pos: true, sort_order: 4 }
        ];
      }
      const enabledCategoryIds = buildEnabledCategorySet(allCategories);
      const categories = allCategories.filter((category: any) => enabledCategoryIds.has(Number(category.id)));
      const products = (productsResult.rows || [])
        .map(enrichProductRow)
        .filter((product: any) => isEnabledForPOS(product) && (enabledCategoryIds.size === 0 || enabledCategoryIds.has(Number(product.category_id)) || !product.category_id));

      const allIngredients = ingredientsResult.rows || [];
      const allSizes = sizesResult.rows || [];

      // Index in memory for fast lookup
      const ingredientsMap = new Map<number, any[]>();
      for (const ing of allIngredients) {
        if (!ingredientsMap.has(ing.product_id)) {
          ingredientsMap.set(ing.product_id, []);
        }
        ingredientsMap.get(ing.product_id)!.push({
          ...ing,
          quantity: parseFloat(ing.quantity) || 0,
          unit_cost: parseFloat(ing.unit_cost) || 0
        });
      }

      const sizesMap = new Map<number, any[]>();
      for (const size of allSizes) {
        if (!sizesMap.has(size.product_id)) {
          sizesMap.set(size.product_id, []);
        }
        sizesMap.get(size.product_id)!.push({
          ...size,
          price: parseFloat(size.price) || 0
        });
      }

      const allInvItems = invItemsRes.rows || [];
      const allMasterIngs = masterIngsRes.rows || [];

      const invMap = new Map<string, number>();
      const totalInvMap = new Map<number, number>();
      for (const item of allInvItems) {
        const whId = Number(item.warehouse_id);
        const ingId = Number(item.ingredient_id);
        const avail = Math.max(0, parseFloat(item.available) || parseFloat(item.quantity) || 0);
        invMap.set(`${whId}:${ingId}`, (invMap.get(`${whId}:${ingId}`) || 0) + avail);
        totalInvMap.set(ingId, (totalInvMap.get(ingId) || 0) + avail);
      }

      const ingMasterMap = new Map<number, any>();
      for (const ing of allMasterIngs) {
        ingMasterMap.set(Number(ing.id), ing);
        if (!totalInvMap.has(Number(ing.id))) {
          totalInvMap.set(Number(ing.id), parseFloat(ing.current_stock) || 0);
        }
      }

      // Reconstruct products with standard JSON mapping and live stock computation
      const productsWithData = products.map((p: any) => {
        const recipe = ingredientsMap.get(p.id) || [];
        let computedStock = Number(p.stock || 0);

        if (p.track_inventory === false) {
          computedStock = 999999;
        } else if (recipe.length > 0) {
          // Recipe-based availability calculation
          let minPortions = Infinity;
          for (const r of recipe) {
            const ingId = Number(r.ingredient_id);
            const reqQty = Number(r.quantity || 1);
            if (reqQty <= 0) continue;
            const avail = p.warehouse_id ? (invMap.get(`${p.warehouse_id}:${ingId}`) || 0) : (totalInvMap.get(ingId) || 0);
            const portions = avail / reqQty;
            if (portions < minPortions) minPortions = portions;
          }
          computedStock = minPortions === Infinity ? 0 : Math.max(0, Math.floor(minPortions * 100) / 100);
        } else if (p.ingredient_id) {
          // Direct Master Item stock calculation
          const targetIngId = Number(p.ingredient_id);
          const avail = p.warehouse_id ? (invMap.get(`${p.warehouse_id}:${targetIngId}`) || 0) : (totalInvMap.get(targetIngId) ?? (parseFloat(ingMasterMap.get(targetIngId)?.current_stock) || 0));
          computedStock = Math.max(0, avail);
        }

        const masterIng = p.ingredient_id ? ingMasterMap.get(Number(p.ingredient_id)) : null;

        return {
          ...p,
          stock: computedStock,
          live_stock: computedStock,
          master_item_name: masterIng?.name || null,
          master_item_unit: masterIng?.unit || p.unit || "قطعة",
          master_item_code: masterIng?.code || p.code || null,
          price: parseFloat(p.price) || 0,
          ingredients: recipe,
          sizes: sizesMap.get(p.id) || []
        };
      });

      const responseData = { categories, products: productsWithData };
      ERPCache.set(cacheKey, responseData, 60); // Cache for 1 minute

      res.json(responseData);
    } catch (error) {
      console.warn("Fetch POS data warning:", error);
      res.json({ categories: [], products: [] });
    }
  });

  // Product Management Endpoints
  

  router.get("/api/products/manage-data", async (req, res) => {
    try {
      const cacheKey = "products:manage-data";
      if (!req.query.refresh) {
        const cached = ERPCache.get(cacheKey);
        if (cached) {
          return res.json(cached);
        }
      }

      const [
        categoriesResult,
        productsResult,
        ingredientsResult,
        sizesResult,
        invItemsRes,
        masterIngsRes
      ] = await Promise.all([
        pool.query("SELECT * FROM categories ORDER BY sort_order ASC").catch(() => ({ rows: [] })),
        pool.query("SELECT * FROM products ORDER BY id ASC").catch(() => ({ rows: [] })),
        pool.query(`
          SELECT pi.*, i.name as ingredient_name, i.unit, i.cost as unit_cost
          FROM product_ingredients pi
          JOIN ingredients i ON pi.ingredient_id = i.id
        `).catch(() => ({ rows: [] })),
        pool.query("SELECT * FROM product_sizes").catch(() => ({ rows: [] })),
        pool.query(`
          SELECT warehouse_id, ingredient_id, quantity, reserved, 
                 (COALESCE(quantity, 0) - COALESCE(reserved, 0)) as available
          FROM inventory_items
        `).catch(() => ({ rows: [] })),
        pool.query(`
          SELECT id, name, unit, cost, avg_cost, current_stock, code, barcode
          FROM ingredients
        `).catch(() => ({ rows: [] }))
      ]);

      const allInvItems = invItemsRes.rows || [];
      const allMasterIngs = masterIngsRes.rows || [];

      const invMap = new Map<string, number>();
      const totalInvMap = new Map<number, number>();
      for (const item of allInvItems) {
        const whId = Number(item.warehouse_id);
        const ingId = Number(item.ingredient_id);
        const avail = Math.max(0, parseFloat(item.available) || parseFloat(item.quantity) || 0);
        invMap.set(`${whId}:${ingId}`, (invMap.get(`${whId}:${ingId}`) || 0) + avail);
        totalInvMap.set(ingId, (totalInvMap.get(ingId) || 0) + avail);
      }

      const ingMasterMap = new Map<number, any>();
      for (const ing of allMasterIngs) {
        ingMasterMap.set(Number(ing.id), ing);
        if (!totalInvMap.has(Number(ing.id))) {
          totalInvMap.set(Number(ing.id), parseFloat(ing.current_stock) || 0);
        }
      }

      const ingredientsMap = new Map<number, any[]>();
      for (const ing of ingredientsResult.rows) {
        if (!ingredientsMap.has(ing.product_id)) ingredientsMap.set(ing.product_id, []);
        ingredientsMap.get(ing.product_id)!.push({
          ...ing,
          quantity: parseFloat(ing.quantity) || 0,
          unit_cost: parseFloat(ing.unit_cost) || 0
        });
      }

      const sizesMap = new Map<number, any[]>();
      for (const size of sizesResult.rows) {
        if (!sizesMap.has(size.product_id)) sizesMap.set(size.product_id, []);
        sizesMap.get(size.product_id)!.push({
          ...size,
          price: parseFloat(size.price) || 0
        });
      }

      const categories = categoriesResult.rows.map(enrichCategoryRow);
      const products = productsResult.rows.map((product: any) => {
        const enriched = enrichProductRow(product);
        const recipe = ingredientsMap.get(product.id) || [];
        let computedStock = Number(enriched.stock || 0);

        if (enriched.track_inventory === false) {
          computedStock = 999999;
        } else if (recipe.length > 0) {
          let minPortions = Infinity;
          for (const r of recipe) {
            const ingId = Number(r.ingredient_id);
            const reqQty = Number(r.quantity || 1);
            if (reqQty <= 0) continue;
            const avail = enriched.warehouse_id ? (invMap.get(`${enriched.warehouse_id}:${ingId}`) || 0) : (totalInvMap.get(ingId) || 0);
            const portions = avail / reqQty;
            if (portions < minPortions) minPortions = portions;
          }
          computedStock = minPortions === Infinity ? 0 : Math.max(0, Math.floor(minPortions * 100) / 100);
        } else if (enriched.ingredient_id) {
          const targetIngId = Number(enriched.ingredient_id);
          const avail = enriched.warehouse_id ? (invMap.get(`${enriched.warehouse_id}:${targetIngId}`) || 0) : (totalInvMap.get(targetIngId) ?? (parseFloat(ingMasterMap.get(targetIngId)?.current_stock) || 0));
          computedStock = Math.max(0, avail);
        }

        const masterIng = enriched.ingredient_id ? ingMasterMap.get(Number(enriched.ingredient_id)) : null;

        return {
          ...enriched,
          stock: computedStock,
          live_stock: computedStock,
          master_item_name: masterIng?.name || null,
          master_item_unit: masterIng?.unit || enriched.unit || "قطعة",
          master_item_code: masterIng?.code || enriched.code || null,
          ingredients: recipe,
          sizes: sizesMap.get(product.id) || []
        };
      });

      const responseData = { categories, products };
      ERPCache.set(cacheKey, responseData, 60);
      res.json(responseData);
    } catch (error) {
      console.error("Fetch product management data error:", error);
      res.status(500).json({ error: "Failed to fetch product management data" });
    }
  });

  router.get("/api/uom-conversions", async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM uom_conversions");
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch UOM conversions" });
    }
  });

  router.post("/api/uom-conversions", async (req, res) => {
    const { category, from_uom, to_uom, value } = req.body;
    try {
      const result = await pool.query(
        "INSERT INTO uom_conversions (category, from_uom, to_uom, value) VALUES ($1, $2, $3, $4) RETURNING id",
        [category, from_uom, to_uom, value]
      );
      res.json({ id: result.rows[0].id });
    } catch (error) {
      res.status(500).json({ error: "Failed to add UOM conversion" });
    }
  });

  router.delete("/api/uom-conversions/:id", async (req, res) => {
    try {
      await pool.query("DELETE FROM uom_conversions WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete UOM conversion" });
    }
  });

  router.get("/api/ingredients", async (req, res) => {
    try {
      const cacheKey = "ingredients:list";
      if (!req.query.refresh) {
        const cached = ERPCache.get(cacheKey);
        if (cached) {
          return res.json(cached);
        }
      }
      const result = await pool.query(`
        SELECT ing.*, COALESCE(NULLIF(ing.code, ''), ing.item_code) AS code
        FROM ingredients ing
        ORDER BY ing.id
      `);
      ERPCache.set(cacheKey, result.rows, 60);
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ingredients" });
    }
  });

  // Bulk import item master from Excel (the frontend sends only the validated item names).
  // The database remains the source of truth for item codes: each inserted row receives
  // ITEM-${1000 + id} after its serial ID is allocated, preventing duplicate codes.
  router.post("/api/ingredients/import", async (req, res) => {
    const client = await pool.connect();
    try {
      const rawNames = Array.isArray(req.body?.names) ? req.body.names : [];
      const names: string[] = [];
      const seen = new Set<string>();

      for (const raw of rawNames) {
        const name = String(raw ?? "").replace(/\s+/g, " ").trim();
        const key = name.toLocaleLowerCase("ar-EG");
        if (!name || seen.has(key)) continue;
        seen.add(key);
        names.push(name);
      }

      if (!names.length) {
        return res.status(400).json({ success: false, error: "لا توجد أسماء أصناف صالحة للاستيراد" });
      }
      if (names.length > 10000) {
        return res.status(400).json({ success: false, error: "الحد الأقصى للاستيراد في العملية الواحدة هو 10,000 صنف" });
      }

      await client.query("BEGIN");

      // Lock this bulk operation so two simultaneous imports cannot allocate conflicting
      // serial-derived codes while the transaction is running.
      await client.query("SELECT pg_advisory_xact_lock($1)", [928374651]);

      const existingResult = await client.query(
        `SELECT name FROM ingredients WHERE LOWER(TRIM(name)) = ANY($1::text[])`,
        [names.map(n => n.toLocaleLowerCase("ar-EG"))]
      );
      const existing = new Set(existingResult.rows.map((r: any) => String(r.name).replace(/\s+/g, " ").trim().toLocaleLowerCase("ar-EG")));

      const imported: Array<{ id: number; name: string; code: string }> = [];
      const skipped: string[] = [];

      for (let i = 0; i < names.length; i++) {
        const name = names[i];
        const key = name.toLocaleLowerCase("ar-EG");
        if (existing.has(key)) {
          skipped.push(name);
          continue;
        }

        // Temporary item code is unique to this operation; it is replaced immediately
        // with the final deterministic code based on the newly allocated database ID.
        const tempCode = `IMPORT-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`;
        const insertResult = await client.query(
          `INSERT INTO ingredients (
            name, unit, cost, supplier, min_stock, current_stock, item_group, item_code, code,
            is_fixed_asset, description, barcode, valuation_method, allow_negative_stock,
            allow_sales, allow_purchase
          ) VALUES ($1, 'قطعة', 0, NULL, 0, 0, NULL, $2::text, $3::text, 0, NULL, NULL, 'weighted_average', 0, 1, 1)
          RETURNING id`,
          [name, tempCode, tempCode]
        );

        const id = Number(insertResult.rows[0].id);
        const code = `ITEM-${1000 + id}`;
        await client.query(
          `UPDATE ingredients SET item_code = $1::text, code = $2::text WHERE id = $3`,
          [code, code, id]
        );

        imported.push({ id, name, code });
        existing.add(key);
      }

      await client.query("COMMIT");
      invalidateProductCache();
      res.json({
        success: true,
        imported_count: imported.length,
        skipped_count: skipped.length,
        imported,
        skipped
      });
    } catch (e: any) {
      await client.query("ROLLBACK");
      console.error("Ingredient bulk import failed:", e);
      res.status(500).json({ success: false, error: e.message || "فشل استيراد الأصناف" });
    } finally {
      client.release();
    }
  });

  router.post("/api/ingredients", async (req, res) => {
    const { 
      name, unit, cost, supplier, min_stock, current_stock,
      item_group, item_code, code, is_fixed_asset, asset_category, description,
      is_zero_rated, is_exempt, brand, shelf_life_in_days, end_of_life,
      default_material_request_type, valuation_method, warranty_period, weight_per_unit,
      allow_negative_stock, barcode, has_variants, parent_item_id, deferred_expense,
      deferred_expense_months, deferred_revenue, deferred_revenue_months, default_income_account,
      default_expense_account, customer, min_order_qty, lead_time_days, safety_stock,
      max_discount, grant_commission, allow_sales, allow_purchase, tax_template,
      inspection_required_before_purchase, inspection_required_before_delivery,
      is_manufactured, is_subcontracted, variant_colors, allow_alternative_item, alternative_items
    } = req.body;

    let finalItemCode = item_code || code;
    if (!finalItemCode || String(finalItemCode).trim() === "" || finalItemCode === "-" || !String(finalItemCode).startsWith("ITEM-")) {
      try {
        const maxIdRes = await pool.query("SELECT MAX(id) as max_id FROM ingredients");
        const nextId = (maxIdRes.rows[0]?.max_id || 0) + 1;
        finalItemCode = `ITEM-${1000 + nextId}`;
      } catch (e) {
        finalItemCode = `ITEM-${Math.floor(100000 + Math.random() * 900000)}`;
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Check if an ingredient with the same name already exists to prevent duplicate entries
      const existingIng = await client.query(
        `SELECT id, name, code, item_code, current_stock FROM ingredients WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) OR (code IS NOT NULL AND code = $2)`,
        [name, finalItemCode]
      );

      if (existingIng.rows.length > 0) {
        const existingId = existingIng.rows[0].id;
        const addStock = Number(current_stock || 0);
        if (addStock > 0) {
          await client.query(
            `UPDATE ingredients SET current_stock = COALESCE(current_stock, 0) + $1, cost = CASE WHEN $2 > 0 THEN $2 ELSE cost END WHERE id = $3`,
            [addStock, Number(cost || 0), existingId]
          );
        }
        await client.query("COMMIT");
        invalidateProductCache();
        return res.status(200).json({ success: true, id: existingId, item_code: existingIng.rows[0].item_code || existingIng.rows[0].code, message: "تم تحديث الصنف الحالي بنجاح ومنع التكرار" });
      }
      const result = await client.query(
        `INSERT INTO ingredients (
          name, unit, cost, supplier, min_stock, current_stock,
          item_group, item_code, code, is_fixed_asset, asset_category, description,
          is_zero_rated, is_exempt, brand, shelf_life_in_days, end_of_life,
          default_material_request_type, valuation_method, warranty_period, weight_per_unit,
          allow_negative_stock, barcode, has_variants, parent_item_id, deferred_expense,
          deferred_expense_months, deferred_revenue, deferred_revenue_months, default_income_account,
          default_expense_account, customer, min_order_qty, lead_time_days, safety_stock,
          max_discount, grant_commission, allow_sales, allow_purchase, tax_template,
          inspection_required_before_purchase, inspection_required_before_delivery,
          is_manufactured, is_subcontracted, variant_colors, allow_alternative_item
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17,
          $18, $19, $20, $21,
          $22, $23, $24, $25, $26,
          $27, $28, $29, $30,
          $31, $32, $33, $34, $35,
          $36, $37, $38, $39, $40,
          $41, $42,
          $43, $44, $45, $46
        ) RETURNING id`,
        [
          name, unit, cost || 0, supplier || null, min_stock || 0, current_stock || 0,
          item_group || null, finalItemCode, finalItemCode, is_fixed_asset ? 1 : 0, asset_category || null, description || null,
          is_zero_rated ? 1 : 0, is_exempt ? 1 : 0, brand || null, shelf_life_in_days || null, end_of_life || null,
          default_material_request_type || null, valuation_method || null, warranty_period || null, weight_per_unit || null,
          allow_negative_stock ? 1 : 0, barcode || null, has_variants ? 1 : 0, parent_item_id || null, deferred_expense ? 1 : 0,
          deferred_expense_months || null, deferred_revenue ? 1 : 0, deferred_revenue_months || null, default_income_account || null,
          default_expense_account || null, customer || null, min_order_qty || null, lead_time_days || null, safety_stock || null,
          max_discount || null, grant_commission ? 1 : 0, allow_sales === false ? 0 : 1, allow_purchase === false ? 0 : 1, tax_template || null,
          inspection_required_before_purchase ? 1 : 0, inspection_required_before_delivery ? 1 : 0,
          is_manufactured ? 1 : 0, is_subcontracted ? 1 : 0, variant_colors || null, allow_alternative_item ? 1 : 0
        ]
      );
      
      const newParentId = result.rows[0].id;
      
      if (allow_alternative_item && alternative_items && alternative_items.length > 0) {
        for (const alt of alternative_items) {
          await client.query(
            "INSERT INTO alternative_items (item_id, alternative_item_id, two_way) VALUES ($1, $2, $3)",
            [newParentId, alt.alternative_item_id, alt.two_way ? 1 : 0]
          );
        }
      }
      
      // Generate variants if has_variants is true and colors are provided
      if (has_variants && variant_colors) {
         const colors = variant_colors.split(',').map((c: string) => c.trim()).filter((c: string) => c);
         for (const color of colors) {
            await client.query(
              `INSERT INTO ingredients (
                name, unit, cost, supplier, min_stock, current_stock,
                item_group, item_code, is_fixed_asset, asset_category, description,
                is_zero_rated, is_exempt, brand, shelf_life_in_days, end_of_life,
                default_material_request_type, valuation_method, warranty_period, weight_per_unit,
                allow_negative_stock, barcode, has_variants, parent_item_id, deferred_expense,
                deferred_expense_months, deferred_revenue, deferred_revenue_months, default_income_account,
                default_expense_account, customer, min_order_qty, lead_time_days, safety_stock,
                max_discount, grant_commission, allow_sales, allow_purchase, tax_template,
                inspection_required_before_purchase, inspection_required_before_delivery,
                is_manufactured, is_subcontracted
              ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10, $11,
                $12, $13, $14, $15, $16,
                $17, $18, $19, $20,
                $21, $22, $23, $24, $25,
                $26, $27, $28, $29,
                $30, $31, $32, $33, $34,
                $35, $36, $37, $38, $39,
                $40, $41,
                $42, $43
              )`,
              [
                `${name} - ${color}`, unit, cost || 0, supplier || null, min_stock || 0, current_stock || 0,
                item_group || null, `${item_code || 'ITEM'}-${color.substring(0,3).toUpperCase()}`, is_fixed_asset ? 1 : 0, asset_category || null, description || null,
                is_zero_rated ? 1 : 0, is_exempt ? 1 : 0, brand || null, shelf_life_in_days || null, end_of_life || null,
                default_material_request_type || null, valuation_method || null, warranty_period || null, weight_per_unit || null,
                allow_negative_stock ? 1 : 0, barcode ? `${barcode}-${color}` : null, 0, newParentId, deferred_expense ? 1 : 0,
                deferred_expense_months || null, deferred_revenue ? 1 : 0, deferred_revenue_months || null, default_income_account || null,
                default_expense_account || null, customer || null, min_order_qty || null, lead_time_days || null, safety_stock || null,
                max_discount || null, grant_commission ? 1 : 0, allow_sales === false ? 0 : 1, allow_purchase === false ? 0 : 1, tax_template || null,
                inspection_required_before_purchase ? 1 : 0, inspection_required_before_delivery ? 1 : 0,
                is_manufactured ? 1 : 0, is_subcontracted ? 1 : 0
              ]
            );
         }
      }

      await client.query("COMMIT");
      client.release();
      invalidateProductCache();
      res.json({ id: newParentId });
    } catch (error) {
      await client.query("ROLLBACK");
      client.release();
      console.error(error);
      res.status(500).json({ error: "Failed to add ingredient" });
    }
  });

  router.put("/api/ingredients/:id", async (req, res) => {
    const { id } = req.params;
    const { 
      name, unit, cost, supplier, min_stock, current_stock,
      item_group, item_code, code, is_fixed_asset, asset_category, description,
      is_zero_rated, is_exempt, brand, shelf_life_in_days, end_of_life,
      default_material_request_type, valuation_method, warranty_period, weight_per_unit,
      allow_negative_stock, barcode, has_variants, parent_item_id, deferred_expense,
      deferred_expense_months, deferred_revenue, deferred_revenue_months, default_income_account,
      default_expense_account, customer, min_order_qty, lead_time_days, safety_stock,
      max_discount, grant_commission, allow_sales, allow_purchase, tax_template,
      inspection_required_before_purchase, inspection_required_before_delivery,
      is_manufactured, is_subcontracted, variant_colors
    } = req.body;

    try {
      await pool.query(
        `UPDATE ingredients SET 
          name = $1, unit = $2, cost = $3, supplier = $4, min_stock = $5, current_stock = $6,
          item_group = $7, item_code = $8, code = $9, is_fixed_asset = $10, asset_category = $11, description = $12,
          is_zero_rated = $13, is_exempt = $14, brand = $15, shelf_life_in_days = $16, end_of_life = $17,
          default_material_request_type = $18, valuation_method = $19, warranty_period = $20, weight_per_unit = $21,
          allow_negative_stock = $22, barcode = $23, has_variants = $24, parent_item_id = $25, deferred_expense = $26,
          deferred_expense_months = $27, deferred_revenue = $28, deferred_revenue_months = $29, default_income_account = $30,
          default_expense_account = $31, customer = $32, min_order_qty = $33, lead_time_days = $34, safety_stock = $35,
          max_discount = $36, grant_commission = $37, allow_sales = $38, allow_purchase = $39, tax_template = $40,
          inspection_required_before_purchase = $41, inspection_required_before_delivery = $42,
          is_manufactured = $43, is_subcontracted = $44, variant_colors = $45
        WHERE id = $46`,
        [
          name, unit, cost || 0, supplier || null, min_stock || 0, current_stock || 0,
          item_group || null, item_code || code || null, code || item_code || null, is_fixed_asset ? 1 : 0, asset_category || null, description || null,
          is_zero_rated ? 1 : 0, is_exempt ? 1 : 0, brand || null, shelf_life_in_days || null, end_of_life || null,
          default_material_request_type || null, valuation_method || null, warranty_period || null, weight_per_unit || null,
          allow_negative_stock ? 1 : 0, barcode || null, has_variants ? 1 : 0, parent_item_id || null, deferred_expense ? 1 : 0,
          deferred_expense_months || null, deferred_revenue ? 1 : 0, deferred_revenue_months || null, default_income_account || null,
          default_expense_account || null, customer || null, min_order_qty || null, lead_time_days || null, safety_stock || null,
          max_discount || null, grant_commission ? 1 : 0, allow_sales === false ? 0 : 1, allow_purchase === false ? 0 : 1, tax_template || null,
          inspection_required_before_purchase ? 1 : 0, inspection_required_before_delivery ? 1 : 0,
          is_manufactured ? 1 : 0, is_subcontracted ? 1 : 0, variant_colors || null,
          id
        ]
      );
      invalidateProductCache();
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update ingredient" });
    }
  });

  router.delete("/api/ingredients/:id", async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM product_ingredients WHERE ingredient_id = $1", [id]);
      await client.query("DELETE FROM waste_logs WHERE ingredient_id = $1", [id]);
      await client.query("DELETE FROM ingredients WHERE id = $1", [id]);
      await client.query("COMMIT");
      invalidateProductCache();
      res.json({ success: true });
    } catch (error) {
      await client.query("ROLLBACK");
      res.status(500).json({ error: "Failed to delete ingredient" });
    } finally {
      client.release();
    }
  });

  // Waste Logs Endpoints
  router.get("/api/waste-logs", async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT w.*, i.name as ingredient_name, i.unit
        FROM waste_logs w
        JOIN ingredients i ON w.ingredient_id = i.id
        ORDER BY w.date DESC
      `);
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch waste logs" });
    }
  });

  router.post("/api/waste-logs", async (req, res) => {
    const { ingredient_id, quantity, reason, cost } = req.body;

    // Month Lock Check
    const now = new Date();
    if (await isMonthClosed(now.getMonth() + 1, now.getFullYear())) {
      return res.status(403).json({ error: "لا يمكن إضافة هالك في شهر مغلق" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO waste_logs (ingredient_id, quantity, reason, cost) VALUES ($1, $2, $3, $4)",
        [ingredient_id, quantity, reason, cost]
      );
      // Reduce stock
      await client.query("UPDATE ingredients SET current_stock = current_stock - $1 WHERE id = $2", [quantity, ingredient_id]);
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (error) {
      await client.query("ROLLBACK");
      res.status(500).json({ error: "Failed to add waste log" });
    } finally {
      client.release();
    }
  });

  // Cost Reports Endpoints
  router.get("/api/costs/dishes", async (req, res) => {
    try {
      const productsResult = await pool.query("SELECT * FROM products");
      const products = productsResult.rows;
      
      const dishesWithCost = await Promise.all(products.map(async (p: any) => {
        const ingredientsResult = await pool.query(`
          SELECT pi.*, i.name as ingredient_name, i.unit, i.cost as unit_cost
          FROM product_ingredients pi
          JOIN ingredients i ON pi.ingredient_id = i.id
          WHERE pi.product_id = $1
        `, [p.id]);
        const ingredients = ingredientsResult.rows;

        const parsedPrice = parseFloat(p.price) || 0;
        const totalCost = ingredients.reduce((sum: number, ing: any) => sum + ((parseFloat(ing.quantity) || 0) * (parseFloat(ing.unit_cost) || 0)), 0);
        const profit = parsedPrice - totalCost;
        const profitMargin = parsedPrice > 0 ? (profit / parsedPrice) * 100 : 0;

        return {
          ...p,
          price: parsedPrice,
          ingredients,
          totalCost,
          profit,
          profitMargin
        };
      }));

      res.json(dishesWithCost);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dish costs" });
    }
  });

  router.post("/api/products/:id/ingredients", async (req, res) => {
    const { id } = req.params;
    const { ingredients } = req.body;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM product_ingredients WHERE product_id = $1", [id]);
      if (ingredients && ingredients.length > 0) {
        for (const ing of ingredients) {
          await insertProductIngredientSafe(client, Number(id), Number(ing.ingredient_id), Number(ing.quantity || 0), ing.size_name || "", Number(ing.waste_percent || 0), ing.unit || "");
        }
      }
      await client.query("COMMIT");
      invalidateProductCache();
      res.json({ success: true });
    } catch (error) {
      await client.query("ROLLBACK");
      res.status(500).json({ error: "Failed to update product ingredients" });
    } finally {
      client.release();
    }
  });

  router.post("/api/categories", async (req, res) => {
    const {
      name,
      printer_id,
      parent_id,
      color = "#2563eb",
      icon = "package",
      description = "",
      sort_order = 0,
      is_active = true,
      show_in_pos = true
    } = req.body;
    try {
      if (name) {
        let dupCheck: any = { rows: [] };
        try {
          dupCheck = await pool.query(
            `SELECT id FROM categories 
             WHERE TRIM(LOWER(name)) = TRIM(LOWER($1)) 
               AND COALESCE(parent_id, 0) = COALESCE($2, 0) 
               AND created_at >= NOW() - INTERVAL '3 seconds'`,
            [name, parent_id || 0]
          );
        } catch (dupErr: any) {
          if (dupErr?.code === "42703") {
            try {
              await pool.query("ALTER TABLE categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
              await pool.query("ALTER TABLE categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
            } catch (_) {}
          }
        }
        if (dupCheck.rows.length > 0) {
          return res.json({ id: dupCheck.rows[0].id, duplicatePrevented: true });
        }
      }

      const result = await pool.query(
        `INSERT INTO categories (
          name, printer_id, parent_id, color, icon, description, sort_order, is_active, show_in_pos
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [name, printer_id || null, parent_id || null, color, icon, description, sort_order || 0, is_active !== false, show_in_pos !== false]
      );
      invalidateProductCache();
      res.json({ id: result.rows[0].id });
    } catch (error) {
      console.error("Add category error:", error);
      res.status(500).json({ error: "Failed to add category", detail: (error as any)?.message || String(error) });
    }
  });

  router.put("/api/categories/:id", async (req, res) => {
    const { id } = req.params;
    const {
      name,
      printer_id,
      parent_id,
      color = "#2563eb",
      icon = "package",
      description = "",
      sort_order = 0,
      is_active = true,
      show_in_pos = true
    } = req.body;
    try {
      await pool.query(
        `UPDATE categories SET
          name = $1,
          printer_id = $2,
          parent_id = $3,
          color = $4,
          icon = $5,
          description = $6,
          sort_order = $7,
          is_active = $8,
          show_in_pos = $9
        WHERE id = $10`,
        [name, printer_id || null, parent_id || null, color, icon, description, sort_order || 0, is_active !== false, show_in_pos !== false, id]
      );
      invalidateProductCache();
      res.json({ success: true });
    } catch (error) {
      console.error("Update category error:", error);
      res.status(500).json({ error: "Failed to update category", detail: (error as any)?.message || String(error) });
    }
  });

  router.delete("/api/categories/:id", async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const allCategoriesResult = await client.query("SELECT id, parent_id FROM categories");
      const categoryIds = collectCategoryDescendantIds(allCategoriesResult.rows, id);

      if (!categoryIds.length) {
        throw new Error("التصنيف غير موجود");
      }

      const orderCheckResult = await client.query(`
        SELECT oi.id
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE p.category_id = ANY($1::int[])
        LIMIT 1
      `, [categoryIds]);

      const hasOrders = orderCheckResult.rows.length > 0;

      if (hasOrders) {
        await client.query(
          "UPDATE categories SET is_active = false, show_in_pos = false WHERE id = ANY($1::int[])",
          [categoryIds]
        );
        await client.query(
          "UPDATE products SET is_active = false, show_in_pos = false WHERE category_id = ANY($1::int[])",
          [categoryIds]
        );

        await client.query("COMMIT");
        invalidateProductCache();

        return res.json({
          success: true,
          message: `تم إخفاء القسم وكل الأقسام الفرعية (${categoryIds.length}) لوجود سجلات بيع مرتبطة`
        });
      }

      await client.query("DELETE FROM products WHERE category_id = ANY($1::int[])", [categoryIds]);
      const result = await client.query("DELETE FROM categories WHERE id = ANY($1::int[])", [categoryIds]);

      if (result.rowCount === 0) {
        throw new Error("التصنيف غير موجود");
      }

      await client.query("COMMIT");
      invalidateProductCache();

      return res.json({
        success: true,
        message: `تم حذف القسم وكل الأقسام الفرعية (${result.rowCount}) نهائياً`
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Delete category error:", error);
      res.status(500).json({ error: "فشل حذف التصنيف أو الأقسام الفرعية" });
    } finally {
      client.release();
    }
  });

  // Import products from an Excel file. Required column: "الصنف".
  // The file is uploaded directly from the user's device; no navigation/page is used.
  router.post("/api/products/import-excel", authenticateToken, upload.single("file") as any, async (req: any, res: any) => {
    const filePath = req.file?.path;
    try {
      if (!req.file || !filePath) {
        return res.status(400).json({
          success: false,
          error: "MISSING_FILE",
          message: "لم يتم اختيار ملف Excel. اختر ملف .xlsx أو .xls من جهازك ثم حاول مرة أخرى."
        });
      }

      const ext = String(path.extname(req.file.originalname || "")).toLowerCase();
      if (![".xlsx", ".xls"].includes(ext)) {
        return res.status(400).json({
          success: false,
          error: "INVALID_FILE_TYPE",
          message: "نوع الملف غير صحيح. يجب رفع ملف Excel بصيغة .xlsx أو .xls."
        });
      }

      const workbook = XLSX.read(fs.readFileSync(filePath), { type: "buffer" });
      const sheetName = workbook.SheetNames?.[0];
      if (!sheetName) {
        return res.status(400).json({
          success: false,
          error: "EMPTY_WORKBOOK",
          message: "ملف Excel لا يحتوي على أي ورقة عمل قابلة للقراءة."
        });
      }

      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "", raw: false });
      if (!rows.length) {
        return res.status(400).json({
          success: false,
          error: "EMPTY_SHEET",
          message: "ورقة Excel فارغة. أضف صف العناوين وصفوف الأصناف ثم أعد الرفع."
        });
      }

      const normalizeHeader = (value: any) => String(value ?? "")
        .replace(/^\uFEFF/, "")
        .replace(/[\u200E\u200F]/g, "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();

      const headers = (rows[0] || []).map((h: any) => String(h ?? "").trim());
      const itemColumnIndex = headers.findIndex((h) => normalizeHeader(h) === "الصنف");

      if (itemColumnIndex === -1) {
        return res.status(400).json({
          success: false,
          error: "MISSING_ITEM_COLUMN",
          message: "خطأ في ملف Excel: العمود المطلوب باسم «الصنف» غير موجود. سبب الخطأ: النظام يعتمد على هذا العمود لمعرفة أسماء الأصناف التي سيتم إنشاؤها.",
          headers,
          details: [
            "تأكد أن أول صف في الشيت يحتوي على عنوان العمود «الصنف» بالضبط.",
            "يمكن أن يحتوي الملف على أعمدة أخرى، لكن وجود «الصنف» إلزامي.",
            "كل صف بعد صف العناوين يجب أن يحتوي على اسم صنف واحد في عمود «الصنف»."
          ]
        });
      }

      const rawNames = rows.slice(1)
        .map((row: any[]) => String(row?.[itemColumnIndex] ?? "").trim())
        .filter(Boolean);

      if (!rawNames.length) {
        return res.status(400).json({
          success: false,
          error: "NO_PRODUCTS",
          message: "تم العثور على عمود «الصنف»، لكن لا توجد أسماء أصناف تحته. أضف اسم صنف في كل صف ثم أعد الرفع."
        });
      }

      const uniqueNames: string[] = [];
      const seen = new Set<string>();
      const duplicateInFile: string[] = [];
      for (const name of rawNames) {
        const key = name.toLocaleLowerCase("ar-EG");
        if (seen.has(key)) {
          duplicateInFile.push(name);
          continue;
        }
        seen.add(key);
        uniqueNames.push(name);
      }

      const client = await pool.connect();
      const created: any[] = [];
      const skipped: any[] = duplicateInFile.map((name) => ({ name, reason: "مكرر داخل ملف Excel" }));
      try {
        await client.query("BEGIN");
        // Serialize imports so generated item codes remain deterministic and unique.
        await client.query("SELECT pg_advisory_xact_lock(81273419)");

        for (const name of uniqueNames) {
          const existing = await client.query(
            "SELECT id, code FROM products WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1",
            [name]
          );
          if (existing.rows.length) {
            skipped.push({
              name,
              reason: `الصنف موجود بالفعل في النظام (كود: ${existing.rows[0].code || "بدون كود"})`
            });
            continue;
          }

          // Insert first, then derive the item code from the generated primary key.
          const inserted = await client.query(
            `INSERT INTO products (name, price, category_id, image, properties, code, barcode, unit, brand, stock, cost, min_stock, max_stock, tax_rate, business_profile, item_type, is_active, show_in_pos, is_favorite, allow_discount, track_inventory, preparation_time, kitchen_station, size_label, color, material, supplier, shelf_life_days, display_order)
             VALUES ($1, 0, NULL, '', $2, $3, '', 'قطعة', '', 0, 0, 0, 0, 14, 'general', 'sale', true, true, false, true, true, 0, '', '', '', '', '', 0, 0)
             RETURNING id`,
            [name, JSON.stringify({ source: "excel_import", imported_at: new Date().toISOString() }), `__IMPORT_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`]
          );
          const productId = Number(inserted.rows[0].id);
          const code = `ITEM-${String(productId).padStart(6, "0")}`;
          await client.query("UPDATE products SET code = $1, properties = $2 WHERE id = $3", [code, JSON.stringify({ source: "excel_import", imported_at: new Date().toISOString(), code }) , productId]);
          created.push({ id: productId, name, code });
        }

        await client.query("COMMIT");
        invalidateProductCache();

        return res.json({
          success: true,
          title: "تم استيراد الأصناف بنجاح",
          message: `تم إنشاء ${created.length} صنف جديد على السيستم وإنشاء كود صنف تلقائي لكل صنف.`,
          total_rows: rawNames.length,
          created_count: created.length,
          skipped_count: skipped.length,
          created,
          skipped
        });
      } catch (error: any) {
        await client.query("ROLLBACK");
        console.error("Excel products import error:", error);
        return res.status(500).json({
          success: false,
          error: "IMPORT_FAILED",
          message: `فشل حفظ الأصناف في قاعدة البيانات. سبب الخطأ: ${error?.message || "خطأ غير معروف"}`
        });
      } finally {
        client.release();
      }
    } catch (error: any) {
      console.error("Excel products file error:", error);
      return res.status(400).json({
        success: false,
        error: "INVALID_EXCEL",
        message: `تعذر قراءة ملف Excel. سبب الخطأ: ${error?.message || "الملف تالف أو غير صالح"}`
      });
    } finally {
      if (filePath) {
        try { fs.unlinkSync(filePath); } catch {}
      }
    }
  });

  router.get("/api/products", async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM products ORDER BY id ASC");
      res.json(result.rows.map(enrichProductRow));
    } catch (error: any) {
      console.error("Fetch products error:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  router.post("/api/products", async (req, res) => {
    const {
      name,
      price = 0,
      category_id,
      image = "",
      ingredients,
      sizes,
      warehouse_id,
      ingredient_id,
      master_item_id,
      properties,
      code = "",
      barcode = "",
      unit = "قطعة",
      brand = "",
      stock = 0,
      cost = 0,
      min_stock = 0,
      max_stock = 0,
      tax_rate = 14,
      business_profile = "general",
      item_type = "sale",
      is_active = true,
      show_in_pos = true,
      is_available_in_pos = true,
      show_in_sales = true,
      is_available_in_sales = true,
      sales_price = null,
      is_favorite = false,
      allow_discount = true,
      track_inventory = true,
      preparation_time = 0,
      kitchen_station = "",
      size_label = "",
      color = "",
      material = "",
      supplier = "",
      shelf_life_days = 0,
      display_order = 0
    } = req.body;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const resolvedShowInPos = show_in_pos !== false && is_available_in_pos !== false;
      const resolvedShowInSales = show_in_sales === true || is_available_in_sales === true;
      const parsedSalesPrice = sales_price !== undefined && sales_price !== null && sales_price !== "" ? Number(sales_price) : null;

      // Resolve Master Item / Inventory Item ID
      let resolvedIngredientId: number | null = ingredient_id ? Number(ingredient_id) : (master_item_id ? Number(master_item_id) : null);

      if (!resolvedIngredientId) {
        const recipeList = Array.isArray(ingredients) ? ingredients.filter((i: any) => i?.ingredient_id) : [];
        if (recipeList.length === 1 && recipeList[0].ingredient_id) {
          resolvedIngredientId = Number(recipeList[0].ingredient_id);
        } else if (recipeList.length === 0 && name && name.trim()) {
          // Check if an inventory item with exact matching name exists
          const existingIng = await client.query("SELECT id FROM ingredients WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1", [name.trim()]);
          if (existingIng.rows && existingIng.rows.length > 0) {
            resolvedIngredientId = Number(existingIng.rows[0].id);
          } else if (track_inventory !== false) {
            // Create a new Master Item in ingredients to maintain 1:1 integrity
            const createdIng = await client.query(`
              INSERT INTO ingredients (name, unit, cost, avg_cost, code, barcode, category, current_stock)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              RETURNING id
            `, [name.trim(), unit || "قطعة", cost || 0, cost || 0, code || "", barcode || "", "أصناف POS", stock || 0]);
            resolvedIngredientId = Number(createdIng.rows[0]?.id);
          }
        }
      }

      const mergedProperties = {
        ...parseJsonObject(properties),
        ingredient_id: resolvedIngredientId,
        code,
        barcode,
        unit,
        brand,
        stock,
        cost,
        min_stock,
        max_stock,
        tax_rate,
        business_profile,
        item_type,
        is_active: is_active !== false,
        show_in_pos: resolvedShowInPos,
        is_available_in_pos: resolvedShowInPos,
        show_in_sales: resolvedShowInSales,
        is_available_in_sales: resolvedShowInSales,
        sales_price: parsedSalesPrice,
        is_favorite: !!is_favorite,
        allow_discount: allow_discount !== false,
        track_inventory: track_inventory !== false,
        preparation_time,
        kitchen_station,
        size_label,
        color,
        material,
        supplier,
        shelf_life_days,
        display_order
      };

      const result = await client.query(
        `INSERT INTO products (
          name, price, category_id, image, warehouse_id, ingredient_id, properties,
          code, barcode, unit, brand, stock, cost, min_stock, max_stock, tax_rate,
          business_profile, item_type, is_active, show_in_pos, is_available_in_pos,
          show_in_sales, is_available_in_sales, sales_price, is_favorite,
          allow_discount, track_inventory, preparation_time, kitchen_station,
          size_label, color, material, supplier, shelf_life_days, display_order
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21,
          $22, $23, $24, $25,
          $26, $27, $28, $29,
          $30, $31, $32, $33, $34, $35
        ) RETURNING id`,
        [
          name, price, category_id, image, warehouse_id || null, resolvedIngredientId || null, JSON.stringify(mergedProperties),
          code, barcode, unit, brand, stock || 0, cost || 0, min_stock || 0, max_stock || 0, tax_rate || 0,
          business_profile, item_type, is_active !== false, resolvedShowInPos, resolvedShowInPos,
          resolvedShowInSales, resolvedShowInSales, parsedSalesPrice, !!is_favorite,
          allow_discount !== false, track_inventory !== false, preparation_time || 0, kitchen_station,
          size_label, color, material, supplier, shelf_life_days || 0, display_order || 0
        ]
      );
      const productId = result.rows[0].id;

      if (ingredients && Array.isArray(ingredients) && ingredients.filter((item: any) => item?.ingredient_id).length > 0) {
        for (const ing of ingredients.filter((item: any) => item?.ingredient_id)) {
          await insertProductIngredientSafe(client, productId, Number(ing.ingredient_id), Number(ing.quantity || 0), ing.size_name || "", Number(ing.waste_percent || 0), ing.unit || "");
        }
      } else if (resolvedIngredientId) {
        // Automatically sync 1:1 recipe for single-ingredient items
        await insertProductIngredientSafe(client, productId, resolvedIngredientId, 1, "", 0, "");
      }

      if (sizes && Array.isArray(sizes)) {
        for (const size of sizes.filter((item: any) => item?.name)) {
          await client.query(
            "INSERT INTO product_sizes (product_id, name, price) VALUES ($1, $2, $3)",
            [productId, size.name, size.price || 0]
          );
        }
      }

      await client.query("COMMIT");
      invalidateProductCache();
      res.json({ id: productId, ingredient_id: resolvedIngredientId });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Add product error:", error);
      res.status(500).json({ error: "Failed to add product", detail: (error as any)?.message || String(error) });
    } finally {
      client.release();
    }
  });

  router.put("/api/products/:id", async (req, res) => {
    const { id } = req.params;
    const {
      name,
      price = 0,
      category_id,
      image = "",
      ingredients,
      sizes,
      warehouse_id,
      ingredient_id,
      master_item_id,
      properties,
      code = "",
      barcode = "",
      unit = "قطعة",
      brand = "",
      stock = 0,
      cost = 0,
      min_stock = 0,
      max_stock = 0,
      tax_rate = 14,
      business_profile = "general",
      item_type = "sale",
      is_active = true,
      show_in_pos = true,
      is_available_in_pos = true,
      show_in_sales = true,
      is_available_in_sales = true,
      sales_price = null,
      is_favorite = false,
      allow_discount = true,
      track_inventory = true,
      preparation_time = 0,
      kitchen_station = "",
      size_label = "",
      color = "",
      material = "",
      supplier = "",
      shelf_life_days = 0,
      display_order = 0
    } = req.body;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const resolvedShowInPos = show_in_pos !== false && is_available_in_pos !== false;
      const resolvedShowInSales = show_in_sales === true || is_available_in_sales === true;
      const parsedSalesPrice = sales_price !== undefined && sales_price !== null && sales_price !== "" ? Number(sales_price) : null;

      // Resolve Master Item / Inventory Item ID
      let resolvedIngredientId: number | null = ingredient_id ? Number(ingredient_id) : (master_item_id ? Number(master_item_id) : null);

      if (!resolvedIngredientId) {
        const recipeList = Array.isArray(ingredients) ? ingredients.filter((i: any) => i?.ingredient_id) : [];
        if (recipeList.length === 1 && recipeList[0].ingredient_id) {
          resolvedIngredientId = Number(recipeList[0].ingredient_id);
        } else if (recipeList.length === 0 && name && name.trim()) {
          const existingIng = await client.query("SELECT id FROM ingredients WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1", [name.trim()]);
          if (existingIng.rows && existingIng.rows.length > 0) {
            resolvedIngredientId = Number(existingIng.rows[0].id);
          } else if (track_inventory !== false) {
            const currentProd = await client.query("SELECT ingredient_id FROM products WHERE id = $1", [id]);
            resolvedIngredientId = currentProd.rows[0]?.ingredient_id || null;
            if (!resolvedIngredientId) {
              const createdIng = await client.query(`
                INSERT INTO ingredients (name, unit, cost, avg_cost, code, barcode, category, current_stock)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id
              `, [name.trim(), unit || "قطعة", cost || 0, cost || 0, code || "", barcode || "", "أصناف POS", stock || 0]);
              resolvedIngredientId = Number(createdIng.rows[0]?.id);
            }
          }
        }
      }

      const mergedProperties = {
        ...parseJsonObject(properties),
        ingredient_id: resolvedIngredientId,
        code,
        barcode,
        unit,
        brand,
        stock,
        cost,
        min_stock,
        max_stock,
        tax_rate,
        business_profile,
        item_type,
        is_active: is_active !== false,
        show_in_pos: resolvedShowInPos,
        is_available_in_pos: resolvedShowInPos,
        show_in_sales: resolvedShowInSales,
        is_available_in_sales: resolvedShowInSales,
        sales_price: parsedSalesPrice,
        is_favorite: !!is_favorite,
        allow_discount: allow_discount !== false,
        track_inventory: track_inventory !== false,
        preparation_time,
        kitchen_station,
        size_label,
        color,
        material,
        supplier,
        shelf_life_days,
        display_order
      };

      await client.query(
        `UPDATE products SET
          name = $1,
          price = $2,
          category_id = $3,
          image = $4,
          warehouse_id = $5,
          ingredient_id = $6,
          properties = $7,
          code = $8,
          barcode = $9,
          unit = $10,
          brand = $11,
          stock = $12,
          cost = $13,
          min_stock = $14,
          max_stock = $15,
          tax_rate = $16,
          business_profile = $17,
          item_type = $18,
          is_active = $19,
          show_in_pos = $20,
          is_available_in_pos = $21,
          show_in_sales = $22,
          is_available_in_sales = $23,
          sales_price = $24,
          is_favorite = $25,
          allow_discount = $26,
          track_inventory = $27,
          preparation_time = $28,
          kitchen_station = $29,
          size_label = $30,
          color = $31,
          material = $32,
          supplier = $33,
          shelf_life_days = $34,
          display_order = $35
        WHERE id = $36`,
        [
          name, price, category_id, image, warehouse_id || null, resolvedIngredientId || null, JSON.stringify(mergedProperties),
          code, barcode, unit, brand, stock || 0, cost || 0, min_stock || 0, max_stock || 0, tax_rate || 0,
          business_profile, item_type, is_active !== false, resolvedShowInPos, resolvedShowInPos,
          resolvedShowInSales, resolvedShowInSales, parsedSalesPrice, !!is_favorite,
          allow_discount !== false, track_inventory !== false, preparation_time || 0, kitchen_station,
          size_label, color, material, supplier, shelf_life_days || 0, display_order || 0, id
        ]
      );

      await client.query("DELETE FROM product_ingredients WHERE product_id = $1", [id]);
      if (ingredients && Array.isArray(ingredients) && ingredients.filter((item: any) => item?.ingredient_id).length > 0) {
        for (const ing of ingredients.filter((item: any) => item?.ingredient_id)) {
          await insertProductIngredientSafe(client, Number(id), Number(ing.ingredient_id), Number(ing.quantity || 0), ing.size_name || "", Number(ing.waste_percent || 0), ing.unit || "");
        }
      } else if (resolvedIngredientId) {
        await insertProductIngredientSafe(client, Number(id), resolvedIngredientId, 1, "", 0, "");
      }

      await client.query("DELETE FROM product_sizes WHERE product_id = $1", [id]);
      if (sizes && Array.isArray(sizes)) {
        for (const size of sizes.filter((item: any) => item?.name)) {
          await client.query(
            "INSERT INTO product_sizes (product_id, name, price) VALUES ($1, $2, $3)",
            [id, size.name, size.price || 0]
          );
        }
      }

      await client.query("COMMIT");
      invalidateProductCache();
      res.json({ success: true, ingredient_id: resolvedIngredientId });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Update product error:", error);
      res.status(500).json({ error: "Failed to update product", detail: (error as any)?.message || String(error) });
    } finally {
      client.release();
    }
  });

  router.delete("/api/products/:id", async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      
      // Check for orders first
      const orderCheck = await client.query("SELECT id FROM order_items WHERE product_id = $1 LIMIT 1", [id]);
      const hasOrders = orderCheck.rows.length > 0;

      if (hasOrders) {
        // Soft delete
        await client.query("UPDATE products SET is_active = false WHERE id = $1", [id]);
        await client.query("COMMIT");
        invalidateProductCache();
        return res.json({ success: true, message: "تم الإخفاء لوجود طلبات سابقة" });
      } else {
        // Hard delete
        const result = await client.query("DELETE FROM products WHERE id = $1", [id]);
        if (result.rowCount === 0) throw new Error("الصنف غير موجود");
        
        await client.query("COMMIT");
        invalidateProductCache();
        return res.json({ success: true, message: "تم الحذف نهائياً" });
      }
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Delete product error:", error);
      res.status(500).json({ error: "فشل حذف الصنف" });
    } finally {
      client.release();
    }
  });

  router.get("/api/pos/shifts/options", authenticateToken, async (req, res) => {
    try {
      await ensurePosShiftSchema();
      const settings = await getPOSShiftSettings();
      const branchId = Number(req.query.branchId) || Number((req as any).user?.branch_id) || 1;
      if (!canAccessPOSShiftBranch((req as any).user, branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية عرض ورديات هذا الفرع" });
      }
      const terminalId = String(req.query.terminalId || settings.terminalId).trim().slice(0, 64);
      const userId = Number((req as any).user?.id);
      const [shiftResult, cashboxes, stats] = await Promise.all([
        pool.query(
          `SELECT s.*, u.username AS user_name, e.name AS employee_name, b.name AS branch_name, ta.name AS cashbox_name
             FROM pos_shifts s
             LEFT JOIN users u ON u.id = s.user_id
             LEFT JOIN employees e ON e.id = s.employee_id
             LEFT JOIN branches b ON b.id = s.branch_id
             LEFT JOIN treasury_accounts ta ON ta.id = s.cashbox_id
            WHERE s.user_id = $1 AND s.branch_id = $2 AND s.terminal_id = $3 AND s.status = 'open'
            ORDER BY s.id DESC LIMIT 1`,
          [userId, branchId, terminalId]
        ),
        pool.query(
          `SELECT id, name, type, current_balance, branch_id
             FROM treasury_accounts
            WHERE (branch_id = $1 OR branch_id IS NULL) AND lower(type) IN ('cash','petty_cash')
            ORDER BY (branch_id = $1) DESC, id`,
          [branchId]
        ),
        pool.query(
          `SELECT
             COUNT(*) FILTER (WHERE status = 'open')::int AS open_count,
             COUNT(*) FILTER (WHERE status = 'closed' AND closed_at::date = CURRENT_DATE)::int AS closed_today,
             COALESCE((
               SELECT SUM(o.total) FROM orders o
               JOIN pos_shifts s ON s.id = o.shift_id
               WHERE s.branch_id = $1 AND o.timestamp::date = CURRENT_DATE
                 AND lower(COALESCE(o.status,'')) NOT IN ('cancelled','canceled','ملغى','ملغاة')
             ),0) AS sales_today,
             COALESCE((
               SELECT SUM(COALESCE(NULLIF(o.paid_amount,0),o.total)) FROM orders o
               JOIN pos_shifts s ON s.id = o.shift_id
               WHERE s.branch_id = $1 AND o.timestamp::date = CURRENT_DATE AND o.is_paid=1
                 AND lower(COALESCE(o.payment_method,'')) IN ('cash','نقدي','نقد')
                 AND lower(COALESCE(o.status,'')) NOT IN ('cancelled','canceled','ملغى','ملغاة')
             ),0) AS cash_today,
             COALESCE(SUM(GREATEST(-cash_difference,0)) FILTER (WHERE status = 'closed' AND closed_at::date = CURRENT_DATE),0) AS shortage_today,
             COALESCE(SUM(GREATEST(cash_difference,0)) FILTER (WHERE status = 'closed' AND closed_at::date = CURRENT_DATE),0) AS surplus_today
           FROM pos_shifts
          WHERE branch_id = $1`,
          [branchId]
        )
      ]);
      res.json({
        settings,
        activeShift: shiftResult.rows[0] || null,
        cashboxes: cashboxes.rows,
        summary: stats.rows[0] || {},
        canApproveVariance: hasPOSShiftPermission((req as any).user, "pos.shift_variance_approve"),
      });
    } catch (error: any) {
      console.error("Load POS shift data failed:", error);
      res.status(500).json({ error: "تعذر تحميل بيانات الورديات", details: error.message });
    }
  });

  router.get("/api/pos/shifts", authenticateToken, async (req, res) => {
    try {
      await ensurePosShiftSchema();
      const user = (req as any).user;
      const canViewAll = canManageAllPOSShifts(user);
      const conditions = ["1=1"];
      const params: any[] = [];
      if (!canViewAll) {
        params.push(Number(user?.id));
        conditions.push(`s.user_id = $${params.length}`);
      }
      for (const [key, column] of [["branchId", "s.branch_id"], ["employeeId", "s.employee_id"]] as const) {
        const value = req.query[key];
        if (value && value !== "all" && Number.isInteger(Number(value))) {
          params.push(Number(value));
          conditions.push(`${column} = $${params.length}`);
        }
      }
      const status = String(req.query.status || "all");
      if (status !== "all") {
        params.push(status);
        conditions.push(`s.status = $${params.length}`);
      }
      const fromDate = String(req.query.startDate || "").slice(0, 10);
      if (fromDate) {
        params.push(fromDate);
        conditions.push(`s.opened_at >= $${params.length}::date`);
      }
      const toDate = String(req.query.endDate || "").slice(0, 10);
      if (toDate) {
        params.push(toDate);
        conditions.push(`s.opened_at < ($${params.length}::date + INTERVAL '1 day')`);
      }
      const result = await pool.query(
        `SELECT s.*, u.username AS user_name, e.name AS employee_name, b.name AS branch_name, ta.name AS cashbox_name,
                COALESCE(o.total_sales,0) AS total_sales, COALESCE(o.invoice_count,0)::int AS invoice_count,
                COALESCE(o.cash_sales,0) AS cash_sales, COALESCE(o.card_sales,0) AS card_sales
           FROM pos_shifts s
           LEFT JOIN users u ON u.id = s.user_id
           LEFT JOIN employees e ON e.id = s.employee_id
           LEFT JOIN branches b ON b.id = s.branch_id
           LEFT JOIN treasury_accounts ta ON ta.id = s.cashbox_id
           LEFT JOIN LATERAL (
             SELECT SUM(total) AS total_sales, COUNT(*) AS invoice_count,
                    SUM(CASE WHEN is_paid=1 AND lower(COALESCE(payment_method,'')) IN ('cash','نقدي','نقد') THEN COALESCE(NULLIF(paid_amount,0),total) ELSE 0 END) AS cash_sales,
                    SUM(CASE WHEN is_paid=1 AND lower(COALESCE(payment_method,'')) IN ('visa','mastercard','card','bank','instapay','wallet','transfer') THEN COALESCE(NULLIF(paid_amount,0),total) ELSE 0 END) AS card_sales
               FROM orders WHERE shift_id = s.id AND lower(COALESCE(status,'')) NOT IN ('cancelled','canceled','ملغى','ملغاة')
           ) o ON true
          WHERE ${conditions.join(" AND ")}
          ORDER BY s.opened_at DESC LIMIT 500`,
        params
      );
      res.json({ canManageAll: canViewAll, shifts: result.rows });
    } catch (error: any) {
      console.error("List POS shifts failed:", error);
      res.status(500).json({ error: "تعذر تحميل سجل الورديات", details: error.message });
    }
  });

  router.get("/api/pos/shifts/:id", authenticateToken, async (req, res) => {
    try {
      await ensurePosShiftSchema();
      const user = (req as any).user;
      const id = Number(req.params.id);
      const shift = (await pool.query(
        `SELECT s.*, u.username AS user_name, e.name AS employee_name, b.name AS branch_name, ta.name AS cashbox_name
           FROM pos_shifts s
           LEFT JOIN users u ON u.id = s.user_id
           LEFT JOIN employees e ON e.id = s.employee_id
           LEFT JOIN branches b ON b.id = s.branch_id
           LEFT JOIN treasury_accounts ta ON ta.id = s.cashbox_id
          WHERE s.id = $1`,
        [id]
      )).rows[0];
      if (!shift) return res.status(404).json({ error: "الوردية غير موجودة" });
      if (Number(shift.user_id) !== Number(user?.id) && !canManageAllPOSShifts(user)) {
        return res.status(403).json({ error: "ليس لديك صلاحية عرض وردية موظف آخر" });
      }
      const [orders, movements, journals, cost] = await Promise.all([
        pool.query(
          `SELECT id, daily_number, total, discount, payment_method, is_paid, paid_amount, timestamp, status
             FROM orders WHERE shift_id = $1 ORDER BY timestamp, id`,
          [id]
        ),
        pool.query(
          `SELECT id, amount, transaction_type, payment_method, reference_id, notes, created_at
             FROM treasury_transactions WHERE shift_id = $1 ORDER BY created_at, id`,
          [id]
        ),
        pool.query(
          `SELECT DISTINCT je.id, je.reference, je.description, je.date, je.total_debit, je.total_credit
             FROM journal_entries je JOIN orders o ON je.source_type = 'pos' AND je.source_id = o.id
            WHERE o.shift_id = $1 ORDER BY je.date, je.id`,
          [id]
        ),
        pool.query(
          `SELECT COALESCE(SUM(ji.debit - ji.credit),0) AS cogs
             FROM journal_entries je
             JOIN orders o ON je.source_type = 'pos' AND je.source_id = o.id
             JOIN journal_items ji ON ji.journal_entry_id = je.id
             JOIN accounts a ON a.id = ji.account_id
            WHERE o.shift_id = $1 AND a.code = '5100'`,
          [id]
        )
      ]);
      res.json({
        shift,
        orders: orders.rows,
        movements: movements.rows,
        journalEntries: journals.rows,
        cogs: Number(cost.rows[0]?.cogs || 0),
        canApproveVariance: hasPOSShiftPermission(user, "pos.shift_variance_approve"),
      });
    } catch (error: any) {
      console.error("Load POS shift details failed:", error);
      res.status(500).json({ error: "تعذر تحميل تفاصيل الوردية", details: error.message });
    }
  });

  router.post("/api/pos/shifts/open", authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
      await ensurePosShiftSchema();
      await client.query("BEGIN");
      const user = (req as any).user;
      const userId = Number(user?.id);
      if (!userId) throw new Error("تعذر تحديد المستخدم الحالي");
      const userPermissions = parseJsonObject(user?.permissions);
      if (userPermissions["pos.shift_open"] === false || userPermissions["pos.shift_open_close"] === false) {
        throw new Error("ليس لديك صلاحية فتح وردية");
      }
      const settings = await getPOSShiftSettings(client);
      if (!settings.enabled) throw new Error("نظام الورديات غير مفعل في إعدادات POS");
      const branchId = Number(req.body.branch_id) || Number(user?.branch_id);
      if (!canAccessPOSShiftBranch(user, branchId)) throw new Error("ليس لديك صلاحية فتح وردية لهذا الفرع");
      const terminalId = String(req.body.terminal_id || settings.terminalId).trim().slice(0, 64);
      const cashboxId = Number(req.body.cashbox_id);
      const openingProvided = req.body.opening_balance !== undefined && req.body.opening_balance !== null && req.body.opening_balance !== "";
      if (!branchId || !terminalId || !cashboxId) throw new Error("الفرع ونقطة البيع والخزينة مطلوبة لفتح الوردية");
      if (settings.openingBalanceMode === "required" && !openingProvided) throw new Error("يجب إدخال الرصيد الافتتاحي لفتح الوردية");
      const openingBalance = settings.openingBalanceMode === "none" ? 0 : (openingProvided ? Number(req.body.opening_balance) : 0);
      if (!Number.isFinite(openingBalance) || openingBalance < 0) throw new Error("الرصيد الافتتاحي غير صالح");

      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`pos-shift:${branchId}:${terminalId}`]);
      const existing = (await client.query(
        `SELECT id, shift_number, user_id FROM pos_shifts WHERE branch_id=$1 AND terminal_id=$2 AND status='open' FOR UPDATE`,
        [branchId, terminalId]
      )).rows[0];
      if (existing) {
        if (Number(existing.user_id) === userId) {
          await client.query("COMMIT");
          return res.json({ success: true, shift: existing, replayed: true });
        }
        throw new Error("توجد وردية مفتوحة بالفعل على نقطة البيع هذه");
      }
      if (!settings.allowMultipleOpenShifts) {
        const branchShift = (await client.query(
          "SELECT id FROM pos_shifts WHERE branch_id=$1 AND status='open' FOR UPDATE LIMIT 1",
          [branchId]
        )).rows[0];
        if (branchShift) throw new Error("إعدادات POS تمنع فتح أكثر من وردية في الفرع");
      }
      const account = (await client.query(
        `SELECT id FROM treasury_accounts WHERE id=$1 AND (branch_id=$2 OR branch_id IS NULL) AND lower(type) IN ('cash','petty_cash')`,
        [cashboxId, branchId]
      )).rows[0];
      if (!account) throw new Error("الخزينة المختارة غير متاحة لهذا الفرع");
      const employeeId = Number((await client.query("SELECT employee_id FROM users WHERE id=$1", [userId])).rows[0]?.employee_id) || null;
      const inserted = (await client.query(
        `INSERT INTO pos_shifts (user_id, employee_id, branch_id, terminal_id, cashbox_id, opening_balance, opening_notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [userId, employeeId, branchId, terminalId, cashboxId, openingBalance, req.body.notes || null]
      )).rows[0];
      const shiftNumber = `POS-${branchId}-${String(inserted.id).padStart(6, "0")}`;
      await client.query("UPDATE pos_shifts SET shift_number=$1 WHERE id=$2", [shiftNumber, inserted.id]);
      const shift = (await client.query("SELECT * FROM pos_shifts WHERE id=$1", [inserted.id])).rows[0];
      await client.query("COMMIT");
      res.status(201).json({ success: true, shift });
    } catch (error: any) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: error.message || "تعذر فتح الوردية" });
    } finally {
      client.release();
    }
  });

  router.post("/api/pos/shifts/:id/close", authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
      await ensurePosShiftSchema();
      await client.query("BEGIN");
      const shiftId = Number(req.params.id);
      const user = (req as any).user;
      const shift = (await client.query("SELECT * FROM pos_shifts WHERE id=$1 FOR UPDATE", [shiftId])).rows[0];
      if (!shift) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "الوردية غير موجودة" });
      }
      const isOwner = Number(shift.user_id) === Number(user?.id);
      if (!isOwner && !canCloseOtherPOSShift(user)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "لا يمكن إغلاق وردية موظف آخر دون صلاحية إدارية" });
      }
      if (shift.status === "closed") {
        await client.query("COMMIT");
        return res.json({ success: true, shift, replayed: true });
      }
      const userPermissions = parseJsonObject(user?.permissions);
      if (isOwner
        && (userPermissions["pos.shift_close_own"] === false || userPermissions["pos.shift_open_close"] === false)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "ليس لديك صلاحية إغلاق ورديتك" });
      }
      const actualCash = Number(req.body.actual_cash);
      if (!Number.isFinite(actualCash) || actualCash < 0) throw new Error("أدخل قيمة نقدية فعلية صحيحة");
      const summaryResult = await client.query(
        `SELECT COUNT(*)::int AS invoice_count,
                COALESCE(SUM(total),0) AS total_sales,
                COALESCE(SUM(discount),0) AS discounts,
                COALESCE(SUM(CASE WHEN lower(COALESCE(payment_method,'')) IN ('cash','نقدي','نقد') AND is_paid=1 THEN COALESCE(NULLIF(paid_amount,0),total) ELSE 0 END),0) AS cash_sales,
                COALESCE(SUM(CASE WHEN lower(COALESCE(payment_method,'')) IN ('visa','mastercard','card','bank','instapay','wallet','transfer') AND is_paid=1 THEN COALESCE(NULLIF(paid_amount,0),total) ELSE 0 END),0) AS non_cash_sales,
                0::numeric AS returns
           FROM orders
          WHERE shift_id=$1 AND lower(COALESCE(status,'')) NOT IN ('cancelled','canceled','ملغى','ملغاة')`,
        [shiftId]
      );
      const summary = summaryResult.rows[0] || {};
      const paymentBreakdown = await client.query(
        `SELECT COALESCE(jsonb_object_agg(payment_method, amount), '{}'::jsonb) AS payment_breakdown
           FROM (
             SELECT COALESCE(payment_method, 'unknown') AS payment_method,
                    SUM(CASE WHEN is_paid=1 THEN COALESCE(NULLIF(paid_amount,0),total) ELSE 0 END) AS amount
               FROM orders
              WHERE shift_id=$1 AND lower(COALESCE(status,'')) NOT IN ('cancelled','canceled','ملغى','ملغاة')
              GROUP BY COALESCE(payment_method, 'unknown')
           ) grouped_payments`,
        [shiftId]
      );
      const cashMovements = await client.query(
        `SELECT COALESCE(SUM(CASE
                    WHEN type IN ('out','petty_cash','vendor_payment','bank_deposit','deficit','transfer') THEN -ABS(amount)
                    ELSE ABS(amount)
                  END),0) AS adjustment
           FROM safe_transactions
          WHERE shift_id=$1 AND type <> 'sale'`,
        [shiftId]
      );
      const cashSales = Number(summary.cash_sales) || 0;
      const expectedCash = Number(shift.opening_balance || 0) + cashSales + (Number(cashMovements.rows[0]?.adjustment) || 0);
      const difference = Number((actualCash - expectedCash).toFixed(2));
      const finalSummary = {
        invoice_count: Number(summary.invoice_count) || 0,
        total_sales: Number(summary.total_sales) || 0,
        returns: 0,
        discounts: Number(summary.discounts) || 0,
        net_sales: Number(summary.total_sales || 0) - Number(summary.discounts || 0),
        cash_sales: cashSales,
        non_cash_sales: Number(summary.non_cash_sales) || 0,
        payment_breakdown: paymentBreakdown.rows[0]?.payment_breakdown || {},
        cash_adjustments: Number(cashMovements.rows[0]?.adjustment) || 0,
        expected_cash: expectedCash,
        cash_difference: difference,
        variance_pending_approval: difference !== 0,
      };
      finalSummary.expected_cash = expectedCash;
      const updated = (await client.query(
        `UPDATE pos_shifts
            SET status='closed', closed_at=CURRENT_TIMESTAMP, expected_cash=$1, actual_cash=$2,
                cash_difference=$3, closing_notes=$4, closing_summary=$5::jsonb
          WHERE id=$6 RETURNING *`,
        [expectedCash, actualCash, difference, req.body.notes || null, JSON.stringify(finalSummary), shiftId]
      )).rows[0];
      await client.query("COMMIT");
      res.json({ success: true, shift: updated, summary: finalSummary });
    } catch (error: any) {
      await client.query("ROLLBACK");
      console.error("Close POS shift failed:", error);
      res.status(400).json({ error: error.message || "تعذر إغلاق الوردية" });
    } finally {
      client.release();
    }
  });

  router.post("/api/pos/shifts/:id/approve-variance", authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
      await ensurePosShiftSchema();
      await client.query("BEGIN");
      const shiftId = Number(req.params.id);
      const user = (req as any).user;
      const shift = (await client.query("SELECT * FROM pos_shifts WHERE id=$1 FOR UPDATE", [shiftId])).rows[0];
      if (!shift) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "الوردية غير موجودة" });
      }
      if (shift.status !== "closed") throw new Error("لا يمكن اعتماد فرق وردية مفتوحة");
      const difference = Number(shift.cash_difference || 0);
      if (!hasPOSShiftPermission(user, "pos.shift_variance_approve")) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "ليس لديك صلاحية اعتماد فرق الجرد" });
      }
      if (difference === 0) {
        await client.query("UPDATE pos_shifts SET variance_approved_at=CURRENT_TIMESTAMP, variance_approved_by=$1 WHERE id=$2", [user?.id, shiftId]);
        await client.query("COMMIT");
        return res.json({ success: true, replayed: true, shift });
      }
      const settlePermission = difference < 0 ? "pos.shift_shortage_settle" : "pos.shift_surplus_settle";
      if (!hasPOSShiftPermission(user, settlePermission)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: difference < 0 ? "ليس لديك صلاحية تسوية العجز" : "ليس لديك صلاحية تسوية الزيادة" });
      }
      if (shift.variance_approved_at) {
        await client.query("COMMIT");
        return res.json({ success: true, replayed: true, shift });
      }
      const account = (await client.query("SELECT current_balance FROM treasury_accounts WHERE id=$1 FOR UPDATE", [shift.cashbox_id])).rows[0];
      if (!account) throw new Error("الخزينة المرتبطة بالوردية غير موجودة");
      const before = Number(account.current_balance || 0);
      const after = before + difference;
      const movement = await client.query(
        `INSERT INTO treasury_transactions
           (account_id, amount, transaction_type, reference_type, reference_id, notes, created_by, shift_id,
            employee_id, terminal_id, balance_before, balance_after, status, branch_id, date)
         VALUES ($1,$2,$3,'pos_shift_variance',$4,$5,$6,$7,$8,$9,$10,$11,'approved',$12,CURRENT_TIMESTAMP)
         ON CONFLICT (reference_type, reference_id) WHERE reference_type='pos_shift_variance' DO NOTHING
         RETURNING id`,
        [shift.cashbox_id, difference, difference > 0 ? "cash_in" : "cash_out", shiftId,
          `تسوية فرق جرد وردية ${shift.shift_number}`, user?.id, shiftId, shift.employee_id,
          shift.terminal_id, before, after, shift.branch_id]
      );
      if (movement.rowCount) {
        await client.query("UPDATE treasury_accounts SET current_balance=$1 WHERE id=$2", [after, shift.cashbox_id]);
      }
      const updated = (await client.query(
        "UPDATE pos_shifts SET variance_approved_at=CURRENT_TIMESTAMP, variance_approved_by=$1 WHERE id=$2 RETURNING *",
        [user?.id, shiftId]
      )).rows[0];
      await client.query("COMMIT");
      res.json({ success: true, shift: updated });
    } catch (error: any) {
      await client.query("ROLLBACK");
      console.error("Approve POS shift variance failed:", error);
      res.status(400).json({ error: error.message || "تعذر اعتماد فرق الوردية" });
    } finally {
      client.release();
    }
  });

  router.post("/api/pos/order", async (req, res) => {
    const idempotencyKey = String(req.get("Idempotency-Key") || req.body?.idempotency_key || "").trim();
    if (idempotencyKey.length > 200) {
      return res.status(400).json({ error: "مفتاح منع التكرار أطول من المسموح" });
    }
    const hashPayload = { ...req.body };
    delete hashPayload.idempotency_key;
    const requestHash = createHash("sha256").update(JSON.stringify(hashPayload)).digest("hex");

    let { 
      items, 
      total, 
      branch_id, 
      table_number = null, 
      is_paid = 1,
      customer_name = '',
      customer_phone = null,
      customer_phone_2 = null,
      customer_address = null,
      delivery_time = null,
      notes = null,
      order_type = 'dine_in',
      // user_id forced from token below, not from client request
      delivery_fee = 0,
      discount = 0,
      area_id = null,
      payment_method = 'cash',
      invoice_note = null,
      source = "pos",
      tax_amount = 0,
      service_charge = 0
    } = req.body;

    // Sanitize empty strings to null for database compatibility
    if (delivery_time === '') delivery_time = null;
    if (area_id === '') area_id = null;
    if (table_number === '') table_number = null;
    notes = notes || invoice_note || null;
    // قناة الأوردر (نقطة بيع / كول سنتر) تُحفظ فعلياً في الطلب حتى تنفصل الشاشات والتقارير عن بعضها
    const orderChannel = String(source || "").trim().toLowerCase() === "call_center" ? "call_center" : "pos";
    const normalizedPaymentMethod = String(payment_method || "").toLowerCase();
    if (["credit", "آجل", "اجل"].some((method) => normalizedPaymentMethod.includes(method))) {
      is_paid = 0;
    }

    // Validate items — an empty cart is only legal when opening a table
    // (unpaid order shell that the cashier fills from the POS screen).
    const isOpenTableRequest = !is_paid && table_number !== null && table_number !== undefined;
    if (!Array.isArray(items)) items = [];
    if (items.length === 0 && !isOpenTableRequest) {
      return res.status(400).json({ error: "الطلب يجب أن يحتوي على عنصر واحد على الأقل" });
    }
    for (const item of items) {
      if (!item.product_id && !item.id) {
        return res.status(400).json({ error: "كل عنصر يجب أن يحتوي على معرف منتج" });
      }
      if (!item.quantity || item.quantity <= 0) {
        return res.status(400).json({ error: "الكمية يجب أن تكون أكبر من صفر" });
      }
      if (item.price < 0) {
        return res.status(400).json({ error: "السعر لا يمكن أن يكون سالباً" });
      }
    }

    // Security: Verify total is roughly correct (within 1% of computed)
    const serverTotal = items.reduce((sum: number, item: any) => sum + (item.price || 0) * (item.quantity || 0), 0) - (discount || 0) + (tax_amount || 0) + (service_charge || 0);
    if (Math.abs(total - serverTotal) > serverTotal * 0.01 + 1) {
      console.warn(`POS order total mismatch: client=${total}, server=${serverTotal}`);
    }

    // Month Lock Check
    const now = new Date();
    if (await isMonthClosed(now.getMonth() + 1, now.getFullYear())) {
      return res.status(403).json({ error: "لا يمكن إضافة طلبات في شهر مغلق" });
    }

    const startTime = Date.now();
    let warehouseTime = 0;
    let accountingTime = 0;
    let treasuryTime = 0;
    const client = await pool.connect();
    let isReleased = false;
    const releaseClient = () => {
      if (!isReleased) {
        isReleased = true;
        try {
          client.release();
        } catch (_) {}
      }
    };
    try {
      await ensurePosShiftSchema();
      await ensurePosIdempotencyTable();
      await client.query('BEGIN');
      const shiftSettings = await getPOSShiftSettings(client);
      // Opening a table creates an empty unpaid order shell. The tables UI does
      // not send an idempotency key for that shell, so it must not be rejected by
      // the shift gate (an open shift is still required for the cashier).
      const isTableShellRequest = isOpenTableRequest && items.length === 0;
      if (shiftSettings.enabled && !idempotencyKey && !isTableShellRequest) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "مفتاح منع التكرار مطلوب عند تفعيل الورديات" });
      }

      if (idempotencyKey) {
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [idempotencyKey]);
        const existingRequest = await client.query(
          `SELECT p.payload_hash, p.order_id, o.daily_number
             FROM pos_order_idempotency p
             JOIN orders o ON o.id = p.order_id
            WHERE p.idempotency_key = $1
            LIMIT 1`,
          [idempotencyKey]
        );
        if (existingRequest.rows.length) {
          if (existingRequest.rows[0].payload_hash !== requestHash) {
            await client.query("ROLLBACK");
            return res.status(409).json({ error: "مفتاح العملية مستخدم لطلب POS مختلف" });
          }
          await client.query("COMMIT");
          return res.json({
            success: true,
            orderId: existingRequest.rows[0].order_id,
            dailyNumber: existingRequest.rows[0].daily_number,
            warnings: [],
            replayed: true
          });
        }
      }

      let activePOSShift: any = null;
      if (shiftSettings.enabled) {
        const cashierId = Number((req as any).user?.id);
        const branchId = Number(branch_id);
        const terminalId = String(req.body.pos_terminal_id || shiftSettings.terminalId).trim().slice(0, 64);
        if (!cashierId) {
          await client.query("ROLLBACK");
          return res.status(401).json({ error: "تسجيل الدخول مطلوب لاستخدام نقطة البيع مع نظام الورديات" });
        }
        if (!canAccessPOSShiftBranch((req as any).user, branchId)) {
          await client.query("ROLLBACK");
          return res.status(403).json({ error: "ليس لديك صلاحية البيع في هذا الفرع" });
        }
        activePOSShift = (await client.query(
          `SELECT id, employee_id, cashbox_id, terminal_id, branch_id
             FROM pos_shifts
            WHERE user_id=$1 AND branch_id=$2 AND terminal_id=$3 AND status='open'
            FOR UPDATE`,
          [cashierId, branchId, terminalId]
        )).rows[0];
        if (!activePOSShift) {
          await client.query("ROLLBACK");
          return res.status(409).json({ error: "يجب فتح وردية خاصة بك قبل تنفيذ عمليات البيع" });
        }
      }

      // Handle Customer Record
      if (customer_phone) {
        const existingCustomerRes = await client.query("SELECT id FROM customers WHERE phone = $1", [customer_phone]);
        const existingCustomer = existingCustomerRes.rows[0];
        if (existingCustomer) {
          await client.query(`
            UPDATE customers SET 
              name = $1, 
              phone_2 = $2, 
              address = $3, 
              last_order_date = CURRENT_TIMESTAMP,
              total_orders = total_orders + 1,
              total_spent = total_spent + $4
            WHERE id = $5
          `, [customer_name, customer_phone_2, customer_address, total, existingCustomer.id]);
        } else {
          await client.query(`
            INSERT INTO customers (name, phone, phone_2, address, last_order_date, total_orders, total_spent)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 1, $5)
          `, [customer_name, customer_phone, customer_phone_2, customer_address, total]);
        }
      }

      // Calculate daily unique number
      let daily_number = 1;
      const dailySeqRes = await client.query(`
        SELECT COALESCE(MAX(daily_number), 0) + 1 as next_val 
        FROM orders 
        WHERE branch_id = $1 AND DATE(timestamp) = CURRENT_DATE
      `, [branch_id]);
      if (dailySeqRes.rows.length > 0) {
        daily_number = dailySeqRes.rows[0].next_val;
      }

      const orderResult = await client.query(`
        INSERT INTO orders (
          total, branch_id, user_id, table_number, is_paid, 
          customer_name, customer_phone, customer_phone_2, 
          customer_address, delivery_time, notes, order_type,
          status, delivery_fee, discount, area_id, daily_number, payment_method,
          tax_amount, service_charge, shift_id, source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        RETURNING id
      `, [
        total, branch_id, (req as any).user?.id || null, table_number, is_paid, 
        customer_name, customer_phone, customer_phone_2, 
        customer_address, delivery_time, notes, order_type,
        (req.body.status && req.body.status !== 'completed') ? req.body.status : 'pending', delivery_fee, discount, area_id, daily_number, payment_method,
        tax_amount, service_charge, activePOSShift?.id || null, orderChannel
      ]);
      const orderId = orderResult.rows[0].id;

      // 1. Efficient Bulk Insert for order items (single query round-trip)
      if (Array.isArray(items) && items.length > 0) {
        const itemValues: string[] = [];
        const itemParams: any[] = [];
        let pIndex = 1;
        for (const item of items) {
          const prodId = item.id || item.product_id;
          if (!prodId) continue;
          itemValues.push(`($${pIndex++}, $${pIndex++}, $${pIndex++}, $${pIndex++}, $${pIndex++}, $${pIndex++})`);
          itemParams.push(
            orderId,
            prodId,
            item.selectedSize?.name || item.size_name || null,
            Number(item.quantity || 1),
            Number(item.price || 0),
            item.notes || null
          );
        }
        if (itemValues.length > 0) {
          await client.query(`
            INSERT INTO order_items (order_id, product_id, size_name, quantity, price, notes)
            VALUES ${itemValues.join(", ")}
          `, itemParams);
        }
      }
      
      // Skip side effects if it's a pending call center order
      if (req.body.status === 'call_center_pending') {
        await client.query('COMMIT');
        return res.json({ success: true, orderId, dailyNumber: daily_number });
      }

      // 2. Update Safe and Treasury if paid
      // NOTE: these side-effects run inside their own SAVEPOINT so that a failure
      // here can never roll back the order itself (a failing statement inside the
      // main transaction would otherwise abort it and silently drop the whole sale).
      const warnings: string[] = [];
      const tTreasuryStart = Date.now();
      if (is_paid) {
        const cashierId = Number((req as any).user?.id) || null;
        const methodNames: Record<string, string> = {
          cash: 'كاش',
          wallet: 'محفظة إلكترونية',
          instapay: 'إنستا باي',
          visa: 'فيزا / بطاقة',
          mastercard: 'ماستر كارد',
          credit: 'آجل / حساب عميل',
          mixed: 'دفع مختلط'
        };
        const methodNameAr = methodNames[payment_method] || 'كاش';
        const receiptAmount = Number(total || 0);
        const normalizedPaidMethod = String(payment_method || "").toLowerCase();
        const isCashPayment = ["cash", "نقد", "نقدي"].includes(normalizedPaidMethod);

        await client.query("SAVEPOINT pos_treasury");
        try {
          // 2a. Cash safe (drivers): branch safe → main safe (no branch) → first safe
          if (!activePOSShift) {
            let safeRes = await client.query("SELECT * FROM safes WHERE branch_id = $1 ORDER BY id ASC LIMIT 1", [branch_id]);
            let safe = safeRes.rows[0];
            if (!safe) {
              safeRes = await client.query("SELECT * FROM safes WHERE branch_id IS NULL ORDER BY id ASC LIMIT 1");
              safe = safeRes.rows[0];
            }
            if (!safe) {
              safeRes = await client.query("SELECT * FROM safes ORDER BY id ASC LIMIT 1");
              safe = safeRes.rows[0];
            }
            if (!safe && !activePOSShift) {
              const createSafeRes = await client.query("INSERT INTO safes (name, branch_id, balance) VALUES ('الخزينة الرئيسية', $1, 0) RETURNING *", [branch_id || 1]);
              safe = createSafeRes.rows[0];
            }

            if (safe) {
              await client.query("UPDATE safes SET balance = balance + $1 WHERE id = $2", [receiptAmount, safe.id]);
              await client.query(
                `INSERT INTO safe_transactions (safe_id, amount, type, notes, user_id, payment_method, reference_id, shift_id)
                 VALUES ($1, $2, 'sale', $3, $4, $5, $6, $7)`,
                [safe.id, receiptAmount, `تحصيل مبيعات POS أوردر #${orderId} (${methodNameAr})`, cashierId, payment_method, orderId, activePOSShift?.id || null]
              );
            }
          }

          // Card and digital receipts go to a bank account rather than the cashbox during a shift.
          let tAccRes;
          if (activePOSShift && isCashPayment) {
            tAccRes = await client.query("SELECT id, current_balance FROM treasury_accounts WHERE id=$1", [activePOSShift.cashbox_id]);
            if (!tAccRes.rows[0]) {
              tAccRes = await client.query("SELECT id, current_balance FROM treasury_accounts WHERE branch_id = $1 ORDER BY is_main DESC NULLS LAST, id ASC LIMIT 1", [branch_id]);
            }
          } else if (activePOSShift && normalizedPaidMethod !== "credit") {
            // Tier 1: bank account for this branch
            tAccRes = await client.query(
              "SELECT id, current_balance FROM treasury_accounts WHERE branch_id=$1 AND (lower(type)='bank' OR lower(type) LIKE '%bank%') ORDER BY is_main DESC NULLS LAST, id LIMIT 1",
              [branch_id]
            );
            // Tier 2: any bank account across branches
            if (!tAccRes.rows[0]) {
              tAccRes = await client.query("SELECT id, current_balance FROM treasury_accounts WHERE lower(type)='bank' OR lower(type) LIKE '%bank%' ORDER BY is_main DESC NULLS LAST, id LIMIT 1");
            }
            // Tier 3: any treasury account for this branch
            if (!tAccRes.rows[0]) {
              tAccRes = await client.query("SELECT id, current_balance FROM treasury_accounts WHERE branch_id=$1 ORDER BY is_main DESC NULLS LAST, id LIMIT 1", [branch_id]);
            }
            // Tier 4: shift cashbox
            if (!tAccRes.rows[0] && activePOSShift.cashbox_id) {
              tAccRes = await client.query("SELECT id, current_balance FROM treasury_accounts WHERE id=$1", [activePOSShift.cashbox_id]);
            }
            // Tier 5: main treasury account
            if (!tAccRes.rows[0]) {
              tAccRes = await client.query("SELECT id, current_balance FROM treasury_accounts WHERE is_main = true ORDER BY id LIMIT 1");
            }
            // Tier 6: any active treasury account
            if (!tAccRes.rows[0]) {
              tAccRes = await client.query("SELECT id, current_balance FROM treasury_accounts ORDER BY id LIMIT 1");
            }
            // Tier 7: self-healing provision of a default bank account
            if (!tAccRes.rows[0]) {
              tAccRes = await client.query(
                "INSERT INTO treasury_accounts (name, type, branch_id, current_balance, is_main, is_active) VALUES ('حساب البنك والتحصيل الإلكتروني (POS)', 'bank', $1, 0, true, true) RETURNING id, current_balance",
                [branch_id || 1]
              );
            }
          } else if (activePOSShift) {
            tAccRes = { rows: [] };
          } else {
            tAccRes = await client.query("SELECT id, current_balance FROM treasury_accounts WHERE branch_id = $1 ORDER BY is_main DESC NULLS LAST, id ASC LIMIT 1", [branch_id]);
            if (!tAccRes.rows[0]) {
              tAccRes = await client.query("SELECT id, current_balance FROM treasury_accounts WHERE is_main = true ORDER BY id ASC LIMIT 1");
            }
            if (!tAccRes.rows[0]) {
              tAccRes = await client.query("SELECT id, current_balance FROM treasury_accounts ORDER BY id ASC LIMIT 1");
            }
            if (!tAccRes.rows[0] && normalizedPaidMethod !== "credit") {
              tAccRes = await client.query(
                "INSERT INTO treasury_accounts (name, type, branch_id, current_balance, is_main, is_active) VALUES ('خزينة الفرع الرئيسية (POS)', 'cash', $1, 0, true, true) RETURNING id, current_balance",
                [branch_id || 1]
              );
            }
          }
          let tAcc = tAccRes?.rows ? tAccRes.rows[0] : null;

          if (tAcc) {
            const balanceBefore = Number(tAcc.current_balance || 0);
            const balanceAfter = balanceBefore + receiptAmount;
            await client.query(
              "UPDATE treasury_accounts SET current_balance = current_balance + $1 WHERE id = $2",
              [receiptAmount, tAcc.id]
            );
            await client.query(
              `INSERT INTO treasury_transactions (
                 account_id, amount, transaction_type, reference_type, reference_id, notes, description,
                 status, voucher_number, voucher_type, payment_method, client_type, client_name,
                 balance_before, balance_after, branch_id, created_by, date, shift_id, employee_id, terminal_id
               ) VALUES ($1, $2, 'cash_in', 'pos_order', $3, $4, $5, 'approved', $6, 'receipt', $7, 'customer', $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, $13, $14, $15)`,
              [
                tAcc.id,
                receiptAmount,
                orderId,
                `تحصيل مبيعات نقطة البيع (POS) — أوردر #${orderId} (${methodNameAr})`,
                `إيرادات نقطة البيع (POS) — أوردر #${orderId}`,
                `POS-${orderId}`,
                payment_method,
                customer_name || 'عميل نقدي',
                balanceBefore,
                balanceAfter,
                branch_id || null,
                cashierId,
                activePOSShift?.id || null,
                activePOSShift?.employee_id || null,
                activePOSShift?.terminal_id || null
              ]
            );
          }
          await client.query("RELEASE SAVEPOINT pos_treasury");
        } catch (tErr: any) {
          await client.query("ROLLBACK TO SAVEPOINT pos_treasury");
          const message = `تم حفظ الأوردر بنجاح، ملاحظة الخزينة: ${tErr?.message || tErr}`;
          warnings.push(message);
          console.warn("[POS -> Treasury] ", message);
        }
      }
      
      // 3. Handle Customer Transaction
      if (customer_phone) {
        const customerRes = await client.query("SELECT id FROM customers WHERE phone = $1 LIMIT 1", [customer_phone]);
        const customer = customerRes.rows[0];
        if (customer) {
          await client.query("INSERT INTO customer_transactions (customer_id, type, amount, notes, order_id) VALUES ($1, 'invoice', $2, $3, $4)",
            [customer.id, total, `فاتورة طلب رقم ${orderId}`, orderId]);
          
          if (is_paid) {
            await client.query("INSERT INTO customer_transactions (customer_id, type, amount, notes, order_id) VALUES ($1, 'payment', $2, $3, $4)",
              [customer.id, total, `سداد فاتورة طلب رقم ${orderId}`, orderId]);
          }
        }
      }
      treasuryTime = Date.now() - tTreasuryStart;
      
      // 4. Optimized Batch inventory deduction:
      const tWhStart = Date.now();
      const stockMoves = new Map<string, { warehouseId: number; ingredientId: number; qty: number }>();
      const prodIds = Array.from(new Set(items.map((i: any) => Number(i.id || i.product_id)).filter(Boolean)));
      
      if (prodIds.length > 0) {
        const prodRows = await client.query("SELECT id, name, warehouse_id, ingredient_id, track_inventory FROM products WHERE id = ANY($1::int[])", [prodIds]);
        const recipeRows = await client.query("SELECT product_id, ingredient_id, quantity FROM product_ingredients WHERE product_id = ANY($1::int[])", [prodIds]);
        const defWhRows = await client.query("SELECT id FROM warehouses WHERE (branch_id = $1 AND is_kitchen::text IN ('1', 'true')) OR branch_id = $1 OR is_main::text IN ('1', 'true') ORDER BY is_kitchen DESC, is_main DESC LIMIT 1", [branch_id]);

        const prodMap = new Map<number, any>();
        for (const p of prodRows.rows) prodMap.set(Number(p.id), p);

        const recipeMap = new Map<number, any[]>();
        for (const r of recipeRows.rows) {
          const pid = Number(r.product_id);
          if (!recipeMap.has(pid)) recipeMap.set(pid, []);
          recipeMap.get(pid)!.push(r);
        }

        const fallbackWhId = defWhRows.rows[0]?.id || 1;

        for (const item of items) {
          const productId = Number(item.id || item.product_id);
          if (!productId) continue;
          const product = prodMap.get(productId);
          if (product?.track_inventory === false) continue;
          const targetWarehouseId = Number(product?.warehouse_id || fallbackWhId);
          const itemQty = Number(item.quantity || 1);

          const recipes = recipeMap.get(productId);
          if (recipes && recipes.length > 0) {
            for (const pi of recipes) {
              const qty = Number(pi.quantity || 0) * itemQty;
              if (qty <= 0) continue;
              const key = `${targetWarehouseId}:${pi.ingredient_id}`;
              const current = stockMoves.get(key);
              if (current) current.qty += qty;
              else stockMoves.set(key, { warehouseId: targetWarehouseId, ingredientId: Number(pi.ingredient_id), qty });
            }
          } else if (product?.ingredient_id) {
            if (itemQty > 0) {
              const key = `${targetWarehouseId}:${product.ingredient_id}`;
              const current = stockMoves.get(key);
              if (current) current.qty += itemQty;
              else stockMoves.set(key, { warehouseId: targetWarehouseId, ingredientId: Number(product.ingredient_id), qty: itemQty });
            }
          }
        }
      }

      let deductedMoves = 0;
      let totalCost = 0;
      for (const move of stockMoves.values()) {
        const movement = await moveStock(client, {
          warehouse_id: move.warehouseId,
          ingredient_id: move.ingredientId,
          delta: -move.qty,
          ref_type: "pos_sale",
          ref_id: Number(orderId),
          user: String((req as any).user?.id || "system"),
          notes: `خصم مقادير بيع POS رقم ${orderId}`
        });
        totalCost += Number(movement.total_cost) || 0;
        deductedMoves++;
      }
      if (stockMoves.size > 0 && deductedMoves === stockMoves.size) {
        await client.query("UPDATE orders SET is_deducted = 1 WHERE id = $1", [orderId]);
      }
      warehouseTime = Date.now() - tWhStart;

      if (Number(total) > 0) {
        const accountingStartedAt = Date.now();
        const posCustomer = customer_phone
          ? await client.query("SELECT id FROM customers WHERE phone = $1 LIMIT 1", [customer_phone])
          : await client.query("SELECT id FROM customers WHERE name ILIKE $1 LIMIT 1", [customer_name || ""]);
        const journalEntry = await postSalesEntry({
          id: Number(orderId),
          total: Number(total),
          discount: Number(discount || 0),
          tax_amount: Number(tax_amount || 0),
          net_total: Number(total),
          total_cost: totalCost,
          payment_method: payment_method || "cash",
          customer_id: Number(posCustomer.rows[0]?.id) || undefined,
          customer_name: customer_name || "عميل نقدي",
          branch_id: Number(branch_id) || 1,
          source_type: "pos",
          source_label: "إيرادات نقطة البيع",
          user_id: Number((req as any).user?.id) || undefined
        }, client);
        if (!journalEntry?.id) {
          throw new Error(`تعذر إنشاء قيد اليومية لأوردر POS رقم ${orderId}`);
        }
        accountingTime = Date.now() - accountingStartedAt;
      }

      if (idempotencyKey) {
        await client.query(
          `INSERT INTO pos_order_idempotency (idempotency_key, payload_hash, order_id)
           VALUES ($1, $2, $3)`,
          [idempotencyKey, requestHash, orderId]
        );
      }

      await client.query('COMMIT');
      releaseClient(); // Safely release client back to pool immediately

      // Warn the cashier when this branch has no receipt printer linked (nothing would print)
      if (Number(total) > 0 && !(await findReceiptPrinter(branch_id || 1))) {
        warnings.push('لا توجد طابعة فواتير مربوطة بهذا الفرع — الأوردر اتسجل بدون طباعة تلقائية. أضف طابعة بدون أقسام من "إدارة الطابعات".');
      }

      // 5. Send HTTP Response immediately so Cashier UI is ultra responsive!
      res.json({ success: true, orderId, dailyNumber: daily_number, warnings });

      // 6. Asynchronous Background tasks: printing and socket broadcast
      setImmediate(async () => {
        printOrderToKitchen(orderId, items, { order_type, table_number, notes }, branch_id).catch(console.error);

        pool.query(`
          SELECT o.*, b.name as branch_name 
          FROM orders o 
          LEFT JOIN branches b ON o.branch_id = b.id 
          WHERE o.id = $1
        `, [orderId]).then((fullOrderRes: any) => {
          const fullOrder = fullOrderRes.rows[0];
          pool.query(`
            SELECT oi.*, p.name as product_name 
            FROM order_items oi 
            JOIN products p ON oi.product_id = p.id 
            WHERE oi.order_id = $1
          `, [orderId]).then((orderItemsRes: any) => {
            const orderItems = orderItemsRes.rows;
            io.emit("new_order", { ...fullOrder, items: orderItems });
          }).catch(() => {});
        }).catch(() => {});
      });

      return;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {}
      console.error("Order creation error:", error);
      res.status(500).json({ error: "Failed to save order", details: error instanceof Error ? error.message : String(error) });
    } finally {
      releaseClient();
    }
  });

  router.get("/api/call-center/pending-orders", authenticateToken, async (req, res) => {
    try {
      const ordersRes = await pool.query(`
        SELECT o.*, b.name as branch_name 
        FROM orders o 
        LEFT JOIN branches b ON o.branch_id = b.id 
        WHERE o.status = 'call_center_pending'
        ORDER BY o.timestamp DESC
      `);
      const orders = ordersRes.rows;

      const ordersWithItems = await Promise.all(orders.map(async (order: any) => {
        const itemsRes = await pool.query(`
          SELECT oi.*, p.name as product_name 
          FROM order_items oi 
          JOIN products p ON oi.product_id = p.id 
          WHERE oi.order_id = $1
        `, [order.id]);
        return { ...order, items: itemsRes.rows };
      }));

      res.json(ordersWithItems);
    } catch (error) {
      console.error("Failed to fetch pending orders:", error);
      res.status(500).json({ error: "Failed to fetch pending orders" });
    }
  });

  router.post("/api/call-center/confirm-order/:id", authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    const orderId = parseInt(id);
    const { branch_id } = req.body; // Allow changing branch at confirmation if needed
    
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const orderResult = await client.query("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [orderId]);
      const order = orderResult.rows[0];
      if (!order) throw new Error("Order not found");
      if (order.status !== 'call_center_pending') throw new Error("Order is not pending");

      const itemsResult = await client.query(`
        SELECT oi.*, p.name 
        FROM order_items oi 
        JOIN products p ON oi.product_id = p.id 
        WHERE oi.order_id = $1
      `, [orderId]);
      const items = itemsResult.rows;

      // Update order status and branch
      const finalBranchId = branch_id || order.branch_id;
      await client.query("UPDATE orders SET status = 'pending', branch_id = $1 WHERE id = $2", [finalBranchId, orderId]);

      // Now trigger all the side effects that were skipped
      const total = order.total;
      const is_paid = order.is_paid;
      const customer_phone = order.customer_phone;
      const user_id = req.user.id;

      // Update Customer Stats
      // Only update total_orders/total_spent if not already counted at creation
      // (call_center_pending orders have stats incremented during order creation, before the early return)
      if (customer_phone && order.status !== 'call_center_pending') {
        await client.query(`
          UPDATE customers SET 
            last_order_date = CURRENT_TIMESTAMP,
            total_orders = total_orders + 1,
            total_spent = total_spent + $1
          WHERE phone = $2
        `, [total, customer_phone]);
      }

      // Record customer transactions (invoice + optional payment) — always, even for confirmed call center orders
      if (customer_phone) {
        const customerResult = await client.query("SELECT id FROM customers WHERE phone = $1", [customer_phone]);
        const customer = customerResult.rows[0];
        if (customer) {
          await client.query(
            "INSERT INTO customer_transactions (customer_id, type, amount, notes, order_id) VALUES ($1, 'invoice', $2, $3, $4)",
            [customer.id, total, `فاتورة طلب رقم ${orderId}`, orderId]
          );
          
          if (is_paid) {
            await client.query(
              "INSERT INTO customer_transactions (customer_id, type, amount, notes, order_id) VALUES ($1, 'payment', $2, $3, $4)",
              [customer.id, total, `سداد فاتورة طلب رقم ${orderId}`, orderId]
            );
          }
        }
      }

      // Update Safe if paid
      if (is_paid) {
        const safeResult = await client.query("SELECT * FROM safes WHERE branch_id = $1", [finalBranchId]);
        const safe = safeResult.rows[0];
        if (safe) {
          const pm = order.payment_method || 'cash';
          const methodNames: Record<string, string> = {
            cash: 'كاش',
            wallet: 'محفظة إلكترونية',
            instapay: 'إنستا باي',
            visa: 'فيزا / بطاقة',
            mastercard: 'ماستر كارد',
            credit: 'آجل / حساب عميل',
            mixed: 'دفع مختلط'
          };
          const methodNameAr = methodNames[pm] || 'كاش';
          
          await client.query("UPDATE safes SET balance = balance + $1 WHERE id = $2", [total, safe.id]);
          await client.query(
            "INSERT INTO safe_transactions (safe_id, amount, type, notes, user_id, payment_method) VALUES ($1, $2, 'sale', $3, $4, $5)",
            [safe.id, total, `تحصيل أوردر رقم ${orderId} (${methodNameAr})`, user_id, pm]
          );
        }
      }

      // Central inventory deduction for confirmed call-center orders.
      const callCenterMoves = new Map<string, { warehouseId: number; ingredientId: number; qty: number }>();
      for (const item of items) {
        const productRes = await client.query("SELECT warehouse_id, track_inventory FROM products WHERE id = $1", [item.product_id]);
        const product = productRes.rows[0];
        if (product?.track_inventory === false) continue;
        let warehouseId = product?.warehouse_id;
        if (!warehouseId) warehouseId = (await client.query("SELECT id FROM warehouses WHERE (branch_id = $1 AND is_kitchen::text IN ('1', 'true')) OR branch_id = $1 OR is_main::text IN ('1', 'true') ORDER BY is_kitchen DESC, is_main DESC LIMIT 1", [finalBranchId])).rows[0]?.id;
        if (!warehouseId) throw new Error(`لا يوجد مخزن مرتبط بفرع الطلب للصنف #${item.product_id}`);
        const recipe = (await client.query("SELECT ingredient_id, quantity FROM product_ingredients WHERE product_id = $1", [item.product_id])).rows;
        for (const pi of recipe) {
          const qty = Number(pi.quantity || 0) * Number(item.quantity || 1);
          if (qty <= 0) continue;
          const key = `${warehouseId}:${pi.ingredient_id}`;
          const current = callCenterMoves.get(key);
          if (current) current.qty += qty;
          else callCenterMoves.set(key, { warehouseId: Number(warehouseId), ingredientId: Number(pi.ingredient_id), qty });
        }
      }
      for (const move of callCenterMoves.values()) {
        await moveStock(client, { warehouse_id: move.warehouseId, ingredient_id: move.ingredientId, delta: -move.qty, ref_type: "call_center_sale", ref_id: orderId, user: String(user_id || "system"), notes: `خصم مقادير مركز الاتصال رقم ${orderId}` });
      }
      if (callCenterMoves.size > 0) await client.query("UPDATE orders SET is_deducted = 1 WHERE id = $1", [orderId]);

      if (Number(total) > 0) {
        await postPOSOrderAccountingEntry(client, { ...order, branch_id: finalBranchId }, user_id);
      }

      await client.query("COMMIT");

      // Print to kitchen
      printOrderToKitchen(orderId, items, { 
        order_type: order.order_type, 
        table_number: order.table_number, 
        notes: order.notes 
      }, finalBranchId);

      // Broadcast to kitchen
      const fullOrderResult = await pool.query(`
        SELECT o.*, b.name as branch_name 
        FROM orders o 
        LEFT JOIN branches b ON o.branch_id = b.id 
        WHERE o.id = $1
      `, [id]);
      const fullOrder = fullOrderResult.rows[0];
      
      const orderItemsResult = await pool.query(`
        SELECT oi.*, p.name as product_name 
        FROM order_items oi 
        JOIN products p ON oi.product_id = p.id 
        WHERE oi.order_id = $1
      `, [id]);
      const orderItems = orderItemsResult.rows;
      
      io.emit("new_order", { ...fullOrder, items: orderItems });

      res.json({ success: true });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Order confirmation error:", error);
      res.status(500).json({ error: "Failed to confirm order", details: error instanceof Error ? error.message : String(error) });
    } finally {
      client.release();
    }
  });

  // Kitchen Endpoints
  router.get("/api/kitchen/orders", async (req, res) => {
    const { branchId, status } = req.query;
    try {
      console.log(`Fetching kitchen orders for branch: ${branchId || 'all'}, status: ${status || 'active'}...`);
      let query = `
        SELECT o.*, b.name as branch_name 
        FROM orders o 
        LEFT JOIN branches b ON o.branch_id = b.id 
        WHERE 1=1
      `;
      const params: any[] = [];
      if (branchId && branchId !== 'all' && branchId !== 'undefined' && branchId !== 'null') {
        params.push(branchId);
        query += ` AND o.branch_id = $${params.length}`;
      }

      if (status === 'all') {
        // Return today's orders or active orders
        query += ` AND (o.status IN ('pending', 'preparing', 'ready') OR DATE(o.timestamp) = CURRENT_DATE)`;
      } else if (status === 'completed') {
        query += ` AND o.status = 'completed' AND DATE(o.timestamp) = CURRENT_DATE`;
      } else if (status && status !== 'active') {
        params.push(status);
        query += ` AND o.status = $${params.length}`;
      } else {
        // Default: all active preparation and delivery orders (pending, preparing, ready)
        query += ` AND (o.status IN ('pending', 'preparing', 'ready'))`;
      }

      query += ` ORDER BY 
        CASE 
          WHEN o.status = 'pending' THEN 1 
          WHEN o.status = 'preparing' THEN 2 
          WHEN o.status = 'ready' THEN 3 
          ELSE 4 
        END, 
        o.timestamp ASC`;
      
      const result = await pool.query(query, params);
      const orders = result.rows;
      console.log(`Found ${orders.length} orders`);

      const ordersWithItems = await Promise.all(orders.map(async (order: any) => {
        try {
          const itemsResult = await pool.query(`
            SELECT oi.*, p.name as product_name 
            FROM order_items oi 
            JOIN products p ON oi.product_id = p.id 
            WHERE oi.order_id = $1
          `, [order.id]);
          return { ...order, items: itemsResult.rows };
        } catch (itemError) {
          console.error(`Error fetching items for order ${order.id}:`, itemError);
          return { ...order, items: [] };
        }
      }));

      res.json(ordersWithItems);
    } catch (error) {
      console.error("Kitchen orders fetch error:", error);
      res.status(500).json({ error: `Failed to fetch kitchen orders: ${error instanceof Error ? error.message : String(error)}` });
    }
  });

  router.post("/api/kitchen/orders/:id/status", async (req, res) => {
    const { id } = req.params;
    const { status, delivery_driver_id } = req.body;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const orderResult = await client.query("SELECT * FROM orders WHERE id = $1", [id]);
      const order = orderResult.rows[0];
      if (!order) throw new Error("Order not found");

      if (delivery_driver_id) {
         await client.query("UPDATE orders SET status = $1, delivery_driver_id = $2 WHERE id = $3", [status, delivery_driver_id, id]);
      } else {
         await client.query("UPDATE orders SET status = $1 WHERE id = $2", [status, id]);
      }

      if (status === 'preparing' && !order.is_deducted) {
        let branchWarehouse = (await client.query("SELECT id FROM warehouses WHERE branch_id = $1 AND is_kitchen = 1 LIMIT 1", [order.branch_id])).rows[0];
        if (!branchWarehouse) branchWarehouse = (await client.query("SELECT id FROM warehouses WHERE branch_id = $1 LIMIT 1", [order.branch_id])).rows[0];
        if (!branchWarehouse) throw new Error("لا يوجد مخزن للفرع لتنفيذ خصم الطلب");
        const itemsResult = await client.query("SELECT * FROM order_items WHERE order_id = $1", [id]);
        const stockMoves = new Map<string, number>();
        for (const item of itemsResult.rows) {
          const prodRes = await client.query("SELECT ingredient_id, track_inventory FROM products WHERE id = $1", [item.product_id]);
          const product = prodRes.rows[0];
          if (product?.track_inventory === false) continue;

          const recipe = await client.query("SELECT ingredient_id, quantity FROM product_ingredients WHERE product_id = $1", [item.product_id]);
          if (recipe.rows && recipe.rows.length > 0) {
            for (const pi of recipe.rows) {
              const qty = Number(pi.quantity || 0) * Number(item.quantity || 1);
              if (qty <= 0) continue;
              const key = String(pi.ingredient_id);
              stockMoves.set(key, (stockMoves.get(key) || 0) + qty);
            }
          } else if (product?.ingredient_id) {
            const qty = Number(item.quantity || 1);
            if (qty > 0) {
              const key = String(product.ingredient_id);
              stockMoves.set(key, (stockMoves.get(key) || 0) + qty);
            }
          }
        }
        for (const [ingredientId, qty] of stockMoves) {
          await moveStock(client, { warehouse_id: Number(branchWarehouse.id), ingredient_id: Number(ingredientId), delta: -qty, ref_type: "pos_sale", ref_id: Number(id), user: String((req as any).user?.id || "system"), notes: `خصم مقادير أوردر رقم ${id}` });
          await client.query("UPDATE ingredients SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM inventory_items WHERE ingredient_id = $1) WHERE id = $1", [ingredientId]);
        }
        await client.query("UPDATE orders SET is_deducted = 1 WHERE id = $1", [id]);
      }

      if ((status === 'completed' || status === 'delivered') && Number(order.total) > 0) {
        await postPOSOrderAccountingEntry(client, order, Number((req as any).user?.id) || undefined);
      }

      await client.query("COMMIT");
      
      let driver_name = null;
      if (delivery_driver_id) {
         const empRes = await client.query("SELECT name FROM employees WHERE id = $1", [delivery_driver_id]);
         if (empRes.rows.length > 0) driver_name = empRes.rows[0].name;
      }
      
      io.emit("order_status_updated", { id, status, delivery_driver_id, driver_name });
      res.json({ success: true });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Failed to update order status", error);
      res.status(500).json({ error: "Failed to update order status" });
    } finally {
      client.release();
    }
  });

  // Branch Reports Endpoints
  router.get("/api/reports/branch/tables", authenticateToken, async (req: any, res: any) => {
    const { startDate, endDate, tableNumber } = req.query;
    const user = req.user;
    
    try {
      let query = `
        SELECT 
          ts.id as "رقم الجلسة",
          ts.table_id as "رقم الطاولة",
          ts.start_time as "وقت البداية",
          ts.end_time as "وقت النهاية",
          ts.status as "حالة الجلسة",
          ts.guest_count as "عدد الضيوف",
          ts.notes as "ملاحظات",
          o.id as "رقم الطلب",
          o.daily_number as "رقم الفاتورة",
          o.total as "الإجمالي",
          o.status as "حالة الطلب"
        FROM table_sessions ts
        LEFT JOIN orders o ON o.table_id = ts.table_id AND (o.created_at >= ts.start_time AND (o.created_at <= ts.end_time OR ts.end_time IS NULL))
        WHERE 1=1
      `;
      const params: any[] = [];
      
      if (user.role !== 'admin' && user.branch_id) {
        params.push(user.branch_id);
        // Wait, table_sessions doesn't have branch_id. tables does. So we need to join table.
        // Let's replace query to join tables.
        query = `
          SELECT 
            ts.id as "رقم الجلسة",
            t.table_number as "رقم الطاولة",
            b.name as "الفرع",
            ts.start_time as "وقت البداية",
            ts.end_time as "وقت النهاية",
            CASE ts.status WHEN 'active' THEN 'مفتوحة' WHEN 'closed' THEN 'مغلقة' ELSE ts.status END as "حالة الجلسة",
            ts.guest_count as "عدد الضيوف",
            o.daily_number as "رقم الفاتورة",
            o.total as "الإجمالي",
            CASE o.status WHEN 'completed' THEN 'مكتمل' WHEN 'cancelled' THEN 'ملغي' ELSE 'تحت التجهيز' END as "حالة الطلب"
          FROM table_sessions ts
          JOIN tables t ON ts.table_id = t.id
          LEFT JOIN branches b ON t.branch_id = b.id
          LEFT JOIN orders o ON o.session_id = ts.id
          WHERE 1=1
        `;
        query += ` AND t.branch_id = $${params.length}`;
      } else {
        query = `
          SELECT 
            ts.id as "رقم الجلسة",
            t.table_number as "رقم الطاولة",
            b.name as "الفرع",
            ts.start_time as "وقت البداية",
            ts.end_time as "وقت النهاية",
            CASE ts.status WHEN 'active' THEN 'مفتوحة' WHEN 'closed' THEN 'مغلقة' ELSE ts.status END as "حالة الجلسة",
            ts.guest_count as "عدد الضيوف",
            o.daily_number as "رقم الفاتورة",
            o.total as "الإجمالي",
            CASE o.status WHEN 'completed' THEN 'مكتمل' WHEN 'cancelled' THEN 'ملغي' ELSE 'تحت التجهيز' END as "حالة الطلب"
          FROM table_sessions ts
          JOIN tables t ON ts.table_id = t.id
          LEFT JOIN branches b ON t.branch_id = b.id
          LEFT JOIN orders o ON o.session_id = ts.id
          WHERE 1=1
        `;
      }
      
      if (startDate) {
        params.push(startDate);
        query += ` AND DATE(ts.start_time) >= $${params.length}`;
      }
      if (endDate) {
        params.push(endDate);
        query += ` AND DATE(ts.start_time) <= $${params.length}`;
      }
      if (tableNumber) {
        params.push(tableNumber);
        query += ` AND t.table_number::text = $${params.length}`;
      }
      
      query += ` ORDER BY ts.start_time DESC`;
      
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to generate tables report" });
    }
  });

  router.get("/api/reports/branch/reservations", authenticateToken, async (req: any, res: any) => {
    const { startDate, endDate } = req.query;
    const user = req.user;
    
    try {
      let query = `
        SELECT 
          r.id as "رقم الحجز",
          b.name as "الفرع",
          r.customer_name as "اسم العميل",
          r.customer_phone as "رقم الهاتف",
          r.reservation_date as "تاريخ الحجز",
          r.reservation_time as "وقت الحجز",
          r.guests_count as "عدد الضيوف",
          t.table_number as "رقم الطاولة",
          CASE r.status 
            WHEN 'pending' THEN 'قيد الانتظار' 
            WHEN 'confirmed' THEN 'مؤكد' 
            WHEN 'cancelled' THEN 'ملغي' 
            WHEN 'completed' THEN 'مكتمل' 
            ELSE r.status 
          END as "الحالة",
          r.notes as "ملاحظات"
        FROM reservations r
        LEFT JOIN branches b ON r.branch_id = b.id
        LEFT JOIN tables t ON r.table_id = t.id
        WHERE 1=1
      `;
      const params: any[] = [];
      
      if (user.role !== 'admin' && user.branch_id) {
        params.push(user.branch_id);
        query += ` AND r.branch_id = $${params.length}`;
      }
      
      if (startDate) {
        params.push(startDate);
        query += ` AND r.reservation_date >= $${params.length}`;
      }
      if (endDate) {
        params.push(endDate);
        query += ` AND r.reservation_date <= $${params.length}`;
      }
      
      query += ` ORDER BY r.reservation_date DESC, r.reservation_time DESC`;
      
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to generate reservations report" });
    }
  });

  router.get("/api/reports/pos/detailed", authenticateToken, async (req: any, res: any) => {
    try {
      const user = req.user;
      const { report = "items", startDate, endDate } = req.query;
      const allowedReports = ["items", "employee_items", "employees", "categories", "details"];
      if (!allowedReports.includes(String(report))) {
        return res.status(400).json({ error: "نوع تقرير POS غير صالح" });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(startDate || "")) || !/^\d{4}-\d{2}-\d{2}$/.test(String(endDate || ""))) {
        return res.status(400).json({ error: "يجب تحديد فترة التقرير بصيغة تاريخ صحيحة" });
      }

      const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
      const pageSize = Math.min(100, Math.max(20, Math.floor(Number(req.query.pageSize) || 50)));
      const params: any[] = [startDate, endDate];
      const filters = [
        "o.timestamp >= $1::date",
        "o.timestamp < ($2::date + INTERVAL '1 day')",
        "COALESCE(o.source, 'pos') = 'pos'",
      ];
      const permissions = parseJsonObject(user?.permissions);
      const canSeeAllBranches = user?.role === "admin" || permissions.all === true
        || permissions.system_admin === true || permissions["branch_reports.all_branches"] === true;
      const canSeeAllUsers = user?.role === "admin" || permissions.all === true
        || permissions.system_admin === true || permissions["branch_reports.all_users"] === true
        || permissions["reports.branch_all_users"] === true;

      if (user?.branch_id && !canSeeAllBranches) {
        params.push(Number(user.branch_id));
        filters.push(`o.branch_id = $${params.length}`);
      } else if (!canSeeAllBranches && !user?.branch_id) {
        return res.status(403).json({ error: "لا يوجد فرع مرتبط بحسابك لعرض التقرير" });
      } else if (req.query.branchId && req.query.branchId !== "all") {
        const branchId = Number(req.query.branchId);
        if (!Number.isInteger(branchId) || branchId <= 0) return res.status(400).json({ error: "الفرع المحدد غير صالح" });
        params.push(branchId);
        filters.push(`o.branch_id = $${params.length}`);
      }
      if (!canSeeAllUsers) {
        if (!user?.id) return res.status(403).json({ error: "لا يوجد مستخدم مرتبط بحسابك لعرض التقرير" });
        params.push(Number(user?.id));
        filters.push(`o.user_id = $${params.length}`);
      } else if (req.query.userId && req.query.userId !== "all") {
        const userId = Number(req.query.userId);
        if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: "الموظف المحدد غير صالح" });
        params.push(userId);
        filters.push(`o.user_id = $${params.length}`);
      }
      if (req.query.categoryId && req.query.categoryId !== "all") {
        const categoryId = Number(req.query.categoryId);
        if (!Number.isInteger(categoryId) || categoryId <= 0) return res.status(400).json({ error: "القسم المحدد غير صالح" });
        params.push(categoryId);
        filters.push(`p.category_id = $${params.length}`);
      }
      if (req.query.productId && req.query.productId !== "all") {
        const productId = Number(req.query.productId);
        if (!Number.isInteger(productId) || productId <= 0) return res.status(400).json({ error: "الصنف المحدد غير صالح" });
        params.push(productId);
        filters.push(`oi.product_id = $${params.length}`);
      }
      if (req.query.paymentMethod && req.query.paymentMethod !== "all") {
        params.push(String(req.query.paymentMethod));
        filters.push(`o.payment_method = $${params.length}`);
      }
      if (req.query.status && req.query.status !== "all") {
        params.push(String(req.query.status));
        filters.push(`o.status = $${params.length}`);
      } else {
        filters.push(`lower(COALESCE(o.status,'')) NOT IN ('cancelled','canceled','ملغي','ملغى','ملغاة')`);
      }

      const baseCte = `
        WITH base_lines AS (
          SELECT o.id AS order_id,
                 COALESCE(o.daily_number, o.id) AS order_number,
                 o.timestamp AS sold_at,
                 o.branch_id,
                 COALESCE(b.name, 'غير محدد') AS branch_name,
                 o.user_id,
                 COALESCE(NULLIF(e.name, ''), NULLIF(u.username, ''), 'غير محدد') AS employee_name,
                 oi.product_id,
                 COALESCE(NULLIF(p.name, ''), 'صنف محذوف') AS product_name,
                 p.category_id,
                 COALESCE(NULLIF(c.name, ''), 'بدون قسم') AS category_name,
                 COALESCE(oi.quantity, 0)::numeric AS quantity,
                 COALESCE(oi.price, 0)::numeric AS unit_price,
                 (COALESCE(oi.quantity, 0) * COALESCE(oi.price, 0))::numeric AS line_gross,
                 (SELECT SUM(COALESCE(all_items.quantity, 0) * COALESCE(all_items.price, 0))
                    FROM order_items all_items
                   WHERE all_items.order_id = o.id)::numeric AS order_lines_gross,
                 COALESCE(NULLIF(o.discount_amount, 0), o.discount, 0)::numeric AS invoice_discount,
                 COALESCE(o.payment_method, 'cash') AS payment_method,
                 COALESCE(o.status, 'unknown') AS status
            FROM orders o
            JOIN order_items oi ON oi.order_id = o.id
            LEFT JOIN products p ON p.id = oi.product_id
            LEFT JOIN categories c ON c.id = p.category_id
            LEFT JOIN users u ON u.id = o.user_id
            LEFT JOIN employees e ON e.id = u.employee_id
            LEFT JOIN branches b ON b.id = o.branch_id
           WHERE ${filters.join(" AND ")}
        ),
        sales_lines AS (
          SELECT *,
                 CASE WHEN order_lines_gross > 0
                   THEN line_gross - invoice_discount * line_gross / order_lines_gross
                   ELSE line_gross
                 END AS line_net
            FROM base_lines
        )
      `;

      const groupedSelect: Record<string, { select: string; group: string; order: string }> = {
        items: {
          select: `product_id, product_name, category_id, category_name,
                   SUM(quantity) AS quantity_sold, COUNT(DISTINCT order_id)::int AS invoice_count,
                   SUM(line_gross) AS gross_sales, SUM(line_net) AS net_sales`,
          group: "product_id, product_name, category_id, category_name",
          order: "gross_sales DESC, quantity_sold DESC, product_name",
        },
        employee_items: {
          select: `user_id, employee_name, product_id, product_name, category_id, category_name,
                   SUM(quantity) AS quantity_sold, COUNT(DISTINCT order_id)::int AS invoice_count,
                   SUM(line_gross) AS gross_sales, SUM(line_net) AS net_sales`,
          group: "user_id, employee_name, product_id, product_name, category_id, category_name",
          order: "employee_name, gross_sales DESC, product_name",
        },
        employees: {
          select: `user_id, employee_name, COUNT(DISTINCT order_id)::int AS invoice_count,
                   SUM(quantity) AS quantity_sold, SUM(line_gross) AS gross_sales, SUM(line_net) AS net_sales`,
          group: "user_id, employee_name",
          order: "net_sales DESC, employee_name",
        },
        categories: {
          select: `category_id, category_name, COUNT(DISTINCT product_id)::int AS product_count,
                   SUM(quantity) AS quantity_sold, COUNT(DISTINCT order_id)::int AS invoice_count,
                   SUM(line_gross) AS gross_sales, SUM(line_net) AS net_sales`,
          group: "category_id, category_name",
          order: "gross_sales DESC, category_name",
        },
        details: {
          select: `order_id, order_number, sold_at, branch_name, employee_name, product_id, product_name,
                   category_name, quantity, unit_price, line_gross, line_net, payment_method, status`,
          group: "",
          order: "sold_at DESC, order_id DESC, product_name",
        },
      };
      const config = groupedSelect[String(report)];
      const countQuery = report === "details"
        ? `${baseCte} SELECT COUNT(*)::int AS count FROM sales_lines`
        : `${baseCte} SELECT COUNT(*)::int AS count FROM (SELECT 1 FROM sales_lines GROUP BY ${config.group}) grouped_rows`;
      const summaryQuery = `${baseCte}
        SELECT COUNT(DISTINCT order_id)::int AS invoice_count,
               COALESCE(SUM(quantity),0) AS quantity_sold,
               COALESCE(SUM(line_gross),0) AS gross_sales,
               COALESCE(SUM(line_net),0) AS net_sales
          FROM sales_lines`;
      const dataQuery = report === "details"
        ? `${baseCte} SELECT * FROM sales_lines ORDER BY ${config.order} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
        : `${baseCte} SELECT ${config.select} FROM sales_lines GROUP BY ${config.group} ORDER BY ${config.order} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      const employeeOptionsQuery = `${baseCte}
        SELECT DISTINCT user_id AS id, employee_name AS username
          FROM sales_lines
         ORDER BY employee_name`;
      const [countResult, summaryResult, dataResult, categoriesResult, productsResult, employeesResult] = await Promise.all([
        pool.query(countQuery, params),
        pool.query(summaryQuery, params),
        pool.query(dataQuery, [...params, pageSize, (page - 1) * pageSize]),
        pool.query("SELECT id, name FROM categories ORDER BY sort_order, name"),
        pool.query("SELECT id, name, category_id FROM products ORDER BY name"),
        pool.query(employeeOptionsQuery, params),
      ]);
      res.json({
        rows: dataResult.rows,
        totalRows: Number(countResult.rows[0]?.count || 0),
        summary: summaryResult.rows[0] || {},
        categories: categoriesResult.rows,
        products: productsResult.rows,
        employees: employeesResult.rows,
        page,
        pageSize,
      });
    } catch (error: any) {
      console.error("Detailed POS report failed:", error);
      res.status(500).json({ error: "تعذر إنشاء تقرير POS التفصيلي" });
    }
  });

  router.get("/api/reports/branch/sales", authenticateToken, async (req: any, res: any) => {
    const { startDate, endDate, branchId, userId, orderType, status } = req.query;
    const user = req.user;
    
    try {
      let query = `
        SELECT 
          o.id as "رقم الطلب",
          o.daily_number as "رقم الطلب اليومي",
          b.name as "الفرع",
          u.username as "الكاشير",
          COALESCE(o.customer_name, 'عميل نقدي') as "العميل",
          COALESCE(o.customer_phone, '-') as "هاتف العميل",
          CASE o.order_type 
            WHEN 'dine_in' THEN 'صالة / طاولة'
            WHEN 'takeaway' THEN 'تيك أواي'
            WHEN 'delivery' THEN 'دليفري'
            WHEN 'walk_in' THEN 'بيع مباشر'
            WHEN 'pick_up' THEN 'استلام من الفرع'
            WHEN 'membership' THEN 'عضوية'
            WHEN 'exchange' THEN 'استبدال'
            ELSE COALESCE(o.order_type, '-')
          END as "نوع الطلب",
          CASE o.payment_method
            WHEN 'cash' THEN 'كاش'
            WHEN 'wallet' THEN 'محفظة'
            WHEN 'visa' THEN 'فيزا'
            WHEN 'mastercard' THEN 'ماستر كارد'
            WHEN 'instapay' THEN 'إنستا باي'
            WHEN 'credit' THEN 'آجل'
            WHEN 'mixed' THEN 'دفع مختلط'
            ELSE COALESCE(o.payment_method, 'كاش')
          END as "طريقة الدفع",
          COALESCE(o.subtotal, o.total) as "المبلغ قبل الخصم",
          COALESCE(o.discount_amount, 0) as "الخصم",
          COALESCE(o.tax_amount, 0) as "الضريبة",
          COALESCE(o.service_charge, 0) as "رسوم الخدمة",
          o.total as "الصافي",
          COALESCE(o.paid_amount, o.total) as "المدفوع",
          CASE 
            WHEN o.status = 'completed' OR o.status = 'delivered' THEN 'مكتمل'
            WHEN o.status = 'pending' THEN 'قيد الانتظار'
            WHEN o.status = 'preparing' THEN 'جاري التحضير'
            WHEN o.status = 'ready' THEN 'جاهز'
            WHEN o.status = 'cancelled' THEN 'ملغي'
            WHEN o.status = 'hold' THEN 'معلق'
            ELSE COALESCE(o.status, '-')
          END as "الحالة",
          COALESCE(o.table_id::text, '-') as "رقم الطاولة",
          CASE o.source
            WHEN 'pos' THEN 'نقطة البيع'
            WHEN 'call_center' THEN 'كول سنتر'
            WHEN 'web' THEN 'أون لاين'
            ELSE COALESCE(o.source, 'نقطة البيع')
          END as "مصدر الطلب",
          COALESCE(
            (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id), 0
          ) as "عدد الأصناف",
          TO_CHAR(o.timestamp, 'YYYY-MM-DD') as "التاريخ",
          TO_CHAR(o.timestamp, 'HH:MI AM') as "الوقت",
          COALESCE(o.notes, '-') as "ملاحظات"
        FROM orders o
        LEFT JOIN branches b ON o.branch_id = b.id
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.timestamp >= $1::timestamp AND o.timestamp < ($2::date + interval '1 day')::timestamp
      `;
      const params: any[] = [startDate, endDate];

      if (status && status !== 'all') {
        params.push(status);
        query += ` AND o.status = $${params.length}`;
      } else {
        query += ` AND o.status != 'cancelled'`;
      }
      
      if (user.role !== 'admin' && user.branch_id) {
        params.push(user.branch_id);
        query += ` AND o.branch_id = $${params.length}`;
      } else if (branchId && branchId !== 'all' && branchId !== 'undefined' && branchId !== 'null') {
        params.push(branchId);
        query += ` AND o.branch_id = $${params.length}`;
      }

      if (userId && userId !== 'all' && userId !== 'undefined' && userId !== 'null') {
        params.push(userId);
        query += ` AND o.user_id = $${params.length}`;
      }

      if (orderType && orderType !== 'all') {
        params.push(orderType);
        query += ` AND o.order_type = $${params.length}`;
      }
      
      query += " ORDER BY o.timestamp DESC";
      
      const data = (await pool.query(query, params)).rows;
      res.json(data);
    } catch (error) {
      console.error("Failed to fetch sales report:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  router.get("/api/reports/branch/call-center", authenticateToken, async (req: any, res: any) => {
    const { startDate, endDate, branchId, userId } = req.query;
    const user = req.user;
    try {
      let query = `
        SELECT 
          o.id as "رقم الطلب",
          o.daily_number as "رقم الطلب اليومي",
          o.customer_name as "اسم العميل",
          o.customer_phone as "رقم الهاتف",
          o.customer_address as "العنوان",
          b.name as "الفرع الموجه إليه",
          CASE o.order_type 
            WHEN 'takeaway' THEN 'تيك أواي'
            WHEN 'delivery' THEN 'توصيل'
            ELSE o.order_type
          END as "نوع الطلب",
          CASE o.payment_method
            WHEN 'cash' THEN 'كاش'
            WHEN 'wallet' THEN 'محفظة موبايل'
            WHEN 'visa' THEN 'فيزا'
            WHEN 'mastercard' THEN 'ماستر كارد'
            WHEN 'instapay' THEN 'إنستا باي'
            WHEN 'credit' THEN 'آجل'
            WHEN 'mixed' THEN 'دفع مختلط'
            ELSE COALESCE(o.payment_method, 'كاش')
          END as "طريقة الدفع",
          o.total as "الإجمالي (ج.م)",
          u.username as "الموظف",
          TO_CHAR(o.timestamp, 'YYYY-MM-DD') as "التاريخ",
          TO_CHAR(o.timestamp, 'HH:MI AM') as "الوقت"
        FROM orders o
        LEFT JOIN branches b ON o.branch_id = b.id
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.timestamp >= $1::timestamp AND o.timestamp < ($2::date + interval '1 day')::timestamp AND o.status != 'cancelled'
        AND COALESCE(NULLIF(TRIM(o.source), ''), 'pos') = 'call_center'
        AND o.customer_phone IS NOT NULL AND o.customer_phone != ''
      `;
      const params: any[] = [startDate, endDate];
      
      // Branch filtering
      if (user.role !== 'admin' && user.branch_id) {
        params.push(user.branch_id);
        query += ` AND o.branch_id = $${params.length}`;
      } else if (branchId && branchId !== 'all' && branchId !== 'undefined' && branchId !== 'null') {
        params.push(branchId);
        query += ` AND o.branch_id = $${params.length}`;
      }

      // User filtering
      if (userId && userId !== 'all' && userId !== 'undefined' && userId !== 'null') {
        params.push(userId);
        query += ` AND o.user_id = $${params.length}`;
      }
      
      query += " ORDER BY o.timestamp DESC";
      
      const data = (await pool.query(query, params)).rows;
      res.json(data);
    } catch (error) {
      console.error("Failed to fetch call center report:", error);
      res.status(500).json({ error: "Failed to fetch call center report" });
    }
  });

  router.get("/api/reports/branch/warehouse", authenticateToken, async (req: any, res: any) => {
    const { startDate, endDate, branchId } = req.query;
    const user = req.user;
    try {
      // Get transfers
      let transfersQuery = `
        SELECT 
          'تحويل مخزني' as "نوع العملية",
          r.id as "رقم المرجع",
          fw.name as "من مخزن",
          tw.name as "إلى مخزن",
          CASE r.status
            WHEN 'pending' THEN 'قيد الانتظار'
            WHEN 'approved' THEN 'مقبول'
            WHEN 'shipped' THEN 'تم الشحن'
            WHEN 'received' THEN 'تم الاستلام'
            WHEN 'rejected' THEN 'مرفوض'
            ELSE r.status
          END as "الحالة",
          TO_CHAR(r.created_at, 'YYYY-MM-DD') as "التاريخ"
        FROM inventory_requests r
        LEFT JOIN warehouses fw ON r.from_warehouse_id = fw.id
        LEFT JOIN warehouses tw ON r.to_warehouse_id = tw.id
        WHERE r.created_at::date BETWEEN $1 AND $2
      `;
      const transfersParams: any[] = [startDate, endDate];
      
      // Branch filtering for transfers
      if (user.role !== 'admin' && user.branch_id) {
        transfersParams.push(user.branch_id, user.branch_id);
        transfersQuery += ` AND (fw.branch_id = $${transfersParams.length - 1} OR tw.branch_id = $${transfersParams.length})`;
      } else if (branchId && branchId !== 'all' && branchId !== 'undefined' && branchId !== 'null') {
        transfersParams.push(branchId, branchId);
        transfersQuery += ` AND (fw.branch_id = $${transfersParams.length - 1} OR tw.branch_id = $${transfersParams.length})`;
      }
      
      const transfers = (await pool.query(transfersQuery, transfersParams)).rows;

      // Get withdrawals for production (out transactions not related to transfers)
      let withdrawalsQuery = `
        SELECT 
          'سحب للإنتاج' as "نوع العملية",
          t.id as "رقم المرجع",
          w.name as "من مخزن",
          i.name as "إلى مخزن", -- Using 'إلى مخزن' column for ingredient name to match structure
          t.quantity || ' ' || i.unit as "الحالة", -- Using 'الحالة' column for quantity to match structure
          TO_CHAR(t.created_at, 'YYYY-MM-DD') as "التاريخ"
        FROM inventory_transactions t
        JOIN warehouses w ON t.warehouse_id = w.id
        JOIN ingredients i ON t.ingredient_id = i.id
        WHERE t.type = 'out' AND t.created_at::date BETWEEN $1 AND $2
      `;
      const withdrawalsParams: any[] = [startDate, endDate];
      
      // Branch filtering for withdrawals
      if (user.role !== 'admin' && user.branch_id) {
        withdrawalsParams.push(user.branch_id);
        withdrawalsQuery += ` AND w.branch_id = $${withdrawalsParams.length}`;
      } else if (branchId && branchId !== 'all' && branchId !== 'undefined' && branchId !== 'null') {
        withdrawalsParams.push(branchId);
        withdrawalsQuery += ` AND w.branch_id = $${withdrawalsParams.length}`;
      }
      
      const withdrawals = (await pool.query(withdrawalsQuery, withdrawalsParams)).rows;

      res.json([...transfers, ...withdrawals].sort((a: any, b: any) => new Date(b["التاريخ"]).getTime() - new Date(a["التاريخ"]).getTime()));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch warehouse report" });
    }
  });

  router.get("/api/reports/main-warehouse", async (req, res) => {
    try {
      const data = (await pool.query(`
        SELECT 
          ing.name as "الصنف",
          ing.category as "التصنيف",
          i.quantity as "الكمية المتاحة",
          ing.unit as "الوحدة",
          i.min_quantity as "الحد الأدنى",
          CASE 
            WHEN i.quantity <= i.min_quantity THEN 'يحتاج إعادة طلب'
            ELSE 'متوفر'
          END as "الحالة"
        FROM inventory_items i
        JOIN ingredients ing ON i.ingredient_id = ing.id
        JOIN warehouses w ON i.warehouse_id = w.id
        WHERE w.type = 'main'
        ORDER BY ing.category, ing.name
      `)).rows;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch main warehouse report" });
    }
  });

  router.get("/api/reports/warehouse-transactions", authenticateToken, async (req: any, res: any) => {
    const { startDate, endDate, warehouseId } = req.query;
    const user = req.user;
    const start = startDate || '1970-01-01';
    const end = endDate || '9999-12-31';

    try {
      let query = `
        SELECT 
          t.id,
          t.created_at as date,
          t.type,
          w.name as warehouse_name,
          i.name as ingredient_name,
          t.quantity,
          i.unit,
          i.cost,
          t.notes,
          CASE 
            WHEN t.type IN ('in', 'transfer_in', 'purchase', 'adjustment') THEN t.quantity * i.cost
            ELSE -1 * t.quantity * i.cost
          END as total_value
        FROM inventory_transactions t
        JOIN ingredients i ON t.ingredient_id = i.id
        JOIN warehouses w ON t.warehouse_id = w.id
        WHERE t.created_at::date BETWEEN $1 AND $2
      `;
      
      const params: any[] = [start, end];

      // Branch filtering
      if (user.role !== 'admin' && user.branch_id) {
        params.push(user.branch_id);
        query += ` AND w.branch_id = $${params.length}`;
      }

      if (warehouseId && warehouseId !== 'all') {
        params.push(warehouseId);
        query += ` AND t.warehouse_id = $${params.length}`;
      }

      query += ` ORDER BY t.created_at DESC`;

      const transactions = (await pool.query(query, params)).rows;
      
      // Calculate summary
      let totalIn = 0;
      let totalOut = 0;

      transactions.forEach((t: any) => {
        const val = parseFloat(t.total_value);
        if (val > 0) {
          totalIn += val;
        } else {
          totalOut += Math.abs(val);
        }
      });

      res.json({
        transactions,
        summary: {
          total_in: totalIn,
          total_out: totalOut,
          net_value: totalIn - totalOut
        }
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch warehouse transactions report" });
    }
  });

  router.get("/api/reports/general-ledger", async (req, res) => {
    const { startDate, endDate, accountId, costCenterId } = req.query;
    const start = startDate || '1970-01-01';
    const end = endDate || '9999-12-31';

    try {
      let query = `
        SELECT 
          je.id as entry_id,
          je.date,
          je.description,
          je.reference,
          a.code as account_code,
          a.name as account_name,
          ji.debit,
          ji.credit,
          cc.name as cost_center_name,
          ji.notes
        FROM journal_items ji
        JOIN journal_entries je ON ji.journal_entry_id = je.id
        JOIN accounts a ON ji.account_id = a.id
        LEFT JOIN cost_centers cc ON ji.cost_center_id = cc.id
        WHERE je.date::date BETWEEN $1 AND $2
      `;
      
      const params: any[] = [start, end];

      if (accountId && accountId !== 'all') {
        params.push(accountId);
        query += ` AND ji.account_id = $${params.length}`;
      }

      if (costCenterId && costCenterId !== 'all') {
        params.push(costCenterId);
        query += ` AND ji.cost_center_id = $${params.length}`;
      }

      query += ` ORDER BY je.date DESC, je.id DESC`;

      const transactions = (await pool.query(query, params)).rows;
      
      // Calculate summary
      let totalDebit = 0;
      let totalCredit = 0;

      transactions.forEach((t: any) => {
        totalDebit += parseFloat(t.debit) || 0;
        totalCredit += parseFloat(t.credit) || 0;
      });

      res.json({
        transactions,
        summary: {
          total_debit: totalDebit,
          total_credit: totalCredit,
          net_balance: totalDebit - totalCredit
        }
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch general ledger report" });
    }
  });

  router.get("/api/reports/branch/delivery", authenticateToken, async (req: any, res: any) => {
    const { startDate, endDate, branchId } = req.query;
    const user = req.user;
    try {
      let query = `
        SELECT 
          o.id as "رقم الطلب",
          o.daily_number as "رقم الطلب اليومي",
          o.customer_name as "اسم العميل",
          o.customer_phone as "رقم الهاتف",
          o.customer_address as "العنوان",
          b.name as "الفرع",
          o.total as "الإجمالي (ج.م)",
          o.status as "حالة الطلب",
          TO_CHAR(o.timestamp, 'YYYY-MM-DD') as "التاريخ",
          TO_CHAR(o.timestamp, 'HH:MI AM') as "الوقت"
        FROM orders o
        LEFT JOIN branches b ON o.branch_id = b.id
        WHERE o.order_type = 'delivery' AND o.timestamp >= $1::timestamp AND o.timestamp < ($2::date + interval '1 day')::timestamp AND o.status != 'cancelled'
      `;
      const params: any[] = [startDate, endDate];
      
      // Branch filtering
      if (user.role !== 'admin' && user.branch_id) {
        params.push(user.branch_id);
        query += ` AND o.branch_id = $${params.length}`;
      } else if (branchId && branchId !== 'all' && branchId !== 'undefined' && branchId !== 'null') {
        params.push(branchId);
        query += ` AND o.branch_id = $${params.length}`;
      }
      
      query += " ORDER BY o.timestamp DESC";
      
      const data = (await pool.query(query, params)).rows;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch delivery report" });
    }
  });


  router.get("/api/reports/branch/delivery-drivers", authenticateToken, async (req: any, res: any) => {
    const { startDate, endDate, branchId } = req.query;
    const user = req.user;
    try {
      let query = `
        SELECT
          COALESCE(e.name, 'بدون مندوب') as "اسم المندوب",
          COALESCE(b.name, 'غير محدد') as "الفرع",
          COUNT(o.id)::int as "عدد الطلبات",
          COALESCE(SUM(o.total), 0)::numeric(10,2) as "إجمالي المبيعات",
          COALESCE(AVG(o.total), 0)::numeric(10,2) as "متوسط الطلب",
          SUM(CASE WHEN o.status = 'completed' THEN 1 ELSE 0 END)::int as "طلبات مكتملة",
          SUM(CASE WHEN o.status = 'cancelled' THEN 1 ELSE 0 END)::int as "طلبات ملغاة",
          MIN(o.timestamp) as "أول طلب",
          MAX(o.timestamp) as "آخر طلب"
        FROM orders o
        LEFT JOIN branches b ON o.branch_id = b.id
        LEFT JOIN employees e ON o.delivery_driver_id = e.id
        WHERE o.order_type = 'delivery'
          AND o.timestamp >= COALESCE($1::timestamp, date_trunc('month', CURRENT_DATE))
          AND o.timestamp < (COALESCE($2::date, CURRENT_DATE) + interval '1 day')::timestamp
      `;
      const params: any[] = [startDate || null, endDate || null];

      if (user.role !== 'admin' && user.branch_id) {
        params.push(user.branch_id);
        query += ` AND o.branch_id = $${params.length}`;
      } else if (branchId && branchId !== 'all' && branchId !== 'undefined' && branchId !== 'null') {
        params.push(branchId);
        query += ` AND o.branch_id = $${params.length}`;
      }

      query += `
        GROUP BY COALESCE(e.name, 'بدون مندوب'), COALESCE(b.name, 'غير محدد')
        ORDER BY "إجمالي المبيعات" DESC, "عدد الطلبات" DESC
      `;

      const data = (await pool.query(query, params)).rows;
      res.json(data);
    } catch (error) {
      console.error("Failed to fetch delivery drivers report", error);
      res.status(500).json({ error: "Failed to fetch delivery drivers report" });
    }
  });

  router.get("/api/reports/branch/kitchen", authenticateToken, async (req: any, res: any) => {
    const { startDate, endDate, branchId } = req.query;
    const user = req.user;
    try {
      let query = `
        SELECT 
          o.id as "رقم الطلب",
          o.daily_number as "رقم الطلب اليومي",
          b.name as "الفرع",
          CASE o.order_type 
            WHEN 'dine_in' THEN 'صالة'
            WHEN 'takeaway' THEN 'تيك أواي'
            WHEN 'delivery' THEN 'توصيل'
            ELSE o.order_type
          END as "نوع الطلب",
          STRING_AGG(p.name || ' (x' || oi.quantity || ')', '، ') as "الأصناف",
          o.status as "حالة الطلب",
          TO_CHAR(o.timestamp, 'YYYY-MM-DD') as "التاريخ",
          TO_CHAR(o.timestamp, 'HH:MI AM') as "الوقت"
        FROM orders o
        LEFT JOIN branches b ON o.branch_id = b.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.timestamp >= $1::timestamp AND o.timestamp < ($2::date + interval '1 day')::timestamp AND o.status != 'cancelled'
      `;
      const params: any[] = [startDate, endDate];
      
      // Branch filtering
      if (user.role !== 'admin' && user.branch_id) {
        params.push(user.branch_id);
        query += ` AND o.branch_id = $${params.length}`;
      } else if (branchId && branchId !== 'all' && branchId !== 'undefined' && branchId !== 'null') {
        params.push(branchId);
        query += ` AND o.branch_id = $${params.length}`;
      }
      
      query += " GROUP BY o.id, b.name, o.daily_number ORDER BY o.timestamp DESC";
      
      const data = (await pool.query(query, params)).rows;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch kitchen report" });
    }
  });

  router.get("/api/reports/branch/web-orders", authenticateToken, async (req: any, res: any) => {
    const { startDate, endDate, branchId } = req.query;
    const user = req.user;
    try {
      let query = `
        SELECT 
          wo.id as "رقم الطلب",
          b.name as "الفرع",
          wo.table_number as "رقم الطاولة",
          wo.total as "الإجمالي (ج.م)",
          CASE wo.status 
            WHEN 'pending' THEN 'قيد الانتظار'
            WHEN 'confirmed' THEN 'تم التأكيد'
            WHEN 'rejected' THEN 'مرفوض'
            ELSE wo.status
          END as "الحالة",
          STRING_AGG(p.name || ' (x' || woi.quantity || ')', '، ') as "الأصناف",
          wo.notes as "ملاحظات العميل",
          TO_CHAR(wo.timestamp, 'YYYY-MM-DD') as "التاريخ",
          TO_CHAR(wo.timestamp, 'HH:MI AM') as "الوقت"
        FROM web_orders wo
        LEFT JOIN branches b ON wo.branch_id = b.id
        LEFT JOIN web_order_items woi ON wo.id = woi.web_order_id
        LEFT JOIN products p ON woi.product_id = p.id
        WHERE wo.timestamp >= $1::timestamp AND wo.timestamp < ($2::date + interval '1 day')::timestamp
      `;
      const params: any[] = [startDate, endDate];
      
      // Branch filtering
      if (user.role !== 'admin' && user.branch_id) {
        params.push(user.branch_id);
        query += ` AND wo.branch_id = $${params.length}`;
      } else if (branchId && branchId !== 'all' && branchId !== 'undefined' && branchId !== 'null') {
        params.push(branchId);
        query += ` AND wo.branch_id = $${params.length}`;
      }
      
      query += " GROUP BY wo.id, b.name ORDER BY wo.timestamp DESC";
      
      const data = (await pool.query(query, params)).rows;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch web orders report" });
    }
  });

  // End of Branch Reports Endpoints

  // Reservations Endpoints
  router.get("/api/reservations", async (req, res) => {
    const { branchId, date } = req.query;
    try {
      let query = "SELECT * FROM reservations WHERE 1=1";
      const params: any[] = [];
      
      if (branchId) {
        params.push(branchId);
        query += ` AND branch_id = $${params.length}`;
      }
      if (date) {
        params.push(date);
        query += ` AND reservation_date = $${params.length}`;
      }
      
      query += " ORDER BY reservation_date ASC, reservation_time ASC";
      
      const reservations = (await pool.query(query, params)).rows;
      res.json(reservations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reservations" });
    }
  });

  router.post("/api/reservations", async (req, res) => {
    const { branch_id, customer_name, customer_phone, reservation_date, reservation_time, guests_count, table_number, notes } = req.body;

    // Month Lock Check
    const resDate = reservation_date ? new Date(reservation_date) : new Date();
    if (await isMonthClosed(resDate.getMonth() + 1, resDate.getFullYear())) {
      return res.status(403).json({ error: "لا يمكن إضافة حجوزات في شهر مغلق" });
    }

    try {
      const result = await pool.query(`
        INSERT INTO reservations (branch_id, customer_name, customer_phone, reservation_date, reservation_time, guests_count, table_number, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [branch_id, customer_name, customer_phone, reservation_date, reservation_time, guests_count, table_number, notes]);
      res.json({ id: result.rows[0].id });
    } catch (error) {
      res.status(500).json({ error: "Failed to create reservation" });
    }
  });

  router.put("/api/reservations/:id/status", async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    // Month Lock Check
    const now = new Date();
    if (await isMonthClosed(now.getMonth() + 1, now.getFullYear())) {
      return res.status(403).json({ error: "لا يمكن تحديث حالة الحجز في شهر مغلق" });
    }

    try {
      await pool.query("UPDATE reservations SET status = $1 WHERE id = $2", [status, id]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update reservation status" });
    }
  });

  router.put("/api/reservations/:id", async (req, res) => {
    const { id } = req.params;
    const { customer_name, customer_phone, reservation_date, reservation_time, guests_count, table_number, notes } = req.body;

    // Month Lock Check
    const resDate = reservation_date ? new Date(reservation_date) : new Date();
    if (await isMonthClosed(resDate.getMonth() + 1, resDate.getFullYear())) {
      return res.status(403).json({ error: "لا يمكن تحديث الحجز في شهر مغلق" });
    }

    try {
      await pool.query(`
        UPDATE reservations 
        SET customer_name = $1, customer_phone = $2, reservation_date = $3, reservation_time = $4, guests_count = $5, table_number = $6, notes = $7
        WHERE id = $8
      `, [customer_name, customer_phone, reservation_date, reservation_time, guests_count, table_number, notes, id]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update reservation" });
    }
  });

  router.delete("/api/reservations/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query("DELETE FROM reservations WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete reservation" });
    }
  });

  router.get("/api/customers", async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
      res.set("Cache-Control", "no-store");
      let query = `SELECT c.*,
                          COALESCE((
                            SELECT SUM(${CUSTOMER_RECEIVABLE_SQL.replace(/\btype\b/g, "ct.type")})
                              FROM customer_transactions ct
                             WHERE ct.customer_id = c.id
                          ), 0) AS balance,
                          GREATEST(
                            COALESCE(c.total_spent, 0),
                            COALESCE((
                              SELECT SUM(ct.amount)
                                FROM customer_transactions ct
                               WHERE ct.customer_id = c.id
                                 AND ct.type IN ('invoice', 'debit')
                            ), 0)
                          ) AS sales_total_spent
                     FROM customers c
                    WHERE 1=1`;
      const params: any[] = [];
      
      if (startDate) {
        params.push(startDate);
        query += ` AND c.last_order_date >= $${params.length}`;
      }
      if (endDate) {
        params.push(endDate);
        query += ` AND c.last_order_date <= $${params.length}`;
      }
      query += " ORDER BY c.last_order_date DESC";
      
      const customers = (await pool.query(query, params)).rows;
      res.json(customers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  // BUG-ERP-008: this legacy INSERT referenced columns that do not exist on the
  // real `customers` table (`notes`, `tax_number`), so every create failed with a
  // PostgreSQL error surfaced as HTTP 500. The canonical shape used by V2 is
  // (name, phone, phone_2, email, address) and `customers.phone` is UNIQUE, so we
  // upsert on phone exactly like the V2 repository does.
  router.post("/api/customers", async (req, res) => {
    try {
      const { name, phone, phone_2, email, address } = req.body;
      const salesRepId = req.body.sales_rep_id === null || req.body.sales_rep_id === undefined || req.body.sales_rep_id === ""
        ? null
        : Number(req.body.sales_rep_id);
      if (!name || !name.trim()) return res.status(400).json({ error: "اسم العميل مطلوب" });
      if (!phone || !String(phone).trim()) return res.status(400).json({ error: "رقم الهاتف مطلوب" });
      if (salesRepId !== null) {
        if (!Number.isInteger(salesRepId) || salesRepId <= 0) {
          return res.status(400).json({ error: "مندوب المبيعات المحدد غير صالح" });
        }
        const repExists = await pool.query("SELECT id FROM sales_reps WHERE id = $1 LIMIT 1", [salesRepId]);
        if (repExists.rows.length === 0) {
          return res.status(400).json({ error: "مندوب المبيعات المحدد غير موجود" });
        }
      }
      const { rows } = await pool.query(
        `INSERT INTO customers (name, phone, phone_2, email, address, sales_rep_id, total_orders, total_spent)
         VALUES ($1, $2, $3, $4, $5, $6, 0, 0)
         ON CONFLICT (phone) DO UPDATE SET
           name = EXCLUDED.name,
           phone_2 = COALESCE(EXCLUDED.phone_2, customers.phone_2),
           email = COALESCE(EXCLUDED.email, customers.email),
           address = COALESCE(EXCLUDED.address, customers.address),
           sales_rep_id = COALESCE(EXCLUDED.sales_rep_id, customers.sales_rep_id)
         RETURNING *`,
        [name.trim(), String(phone).trim(), phone_2 || null, email || null, address || null, salesRepId]
      );
      res.status(201).json(rows[0]);
    } catch (error: any) {
      console.error("POST /api/customers failed:", error);
      res.status(500).json({ error: error.message || "فشل إضافة العميل" });
    }
  });

  router.get("/api/customers/search", async (req, res) => {
    const { phone } = req.query;
    try {
      const customer = (await pool.query("SELECT * FROM customers WHERE phone = $1", [phone])).rows[0];
      res.json(customer || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to search customer" });
    }
  });

  router.get("/api/customers/accounts", async (req, res) => {
    try {
      res.set("Cache-Control", "no-store");
      // PHASE 16: use the canonical receivable expression shared with the ERP
      // services instead of a hand-rolled invoice/payment subtraction that
      // ignored 'reversal'/'adjustment' rows.
      const accounts = (await pool.query(`
        SELECT c.id, c.name, c.phone,
               COALESCE((SELECT SUM(${CUSTOMER_RECEIVABLE_SQL.replace(/\btype\b/g, 'ct.type')})
                           FROM customer_transactions ct WHERE ct.customer_id = c.id), 0) as balance,
               (SELECT MAX(COALESCE(ct.date, ct.timestamp))
                  FROM customer_transactions ct WHERE ct.customer_id = c.id) as last_transaction_date
        FROM customers c
        ORDER BY c.name ASC
      `)).rows;
      res.json(accounts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customer accounts" });
    }
  });

  router.get("/api/customers/:id/transactions", async (req, res) => {
    const { id } = req.params;
    try {
      res.set("Cache-Control", "no-store");
      const transactions = (await pool.query(`
        SELECT ct.*,
               COALESCE(ct.date, ct.timestamp) AS transaction_date,
               SUM(${CUSTOMER_RECEIVABLE_SQL.replace(/\btype\b/g, "ct.type")})
                 OVER (
                   PARTITION BY ct.customer_id
                   ORDER BY COALESCE(ct.date, ct.timestamp), ct.id
                   ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                 ) AS running_balance
          FROM customer_transactions ct
         WHERE ct.customer_id = $1
         ORDER BY COALESCE(ct.date, ct.timestamp) DESC, ct.id DESC
      `, [id])).rows;
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  router.post("/api/customers/transactions", async (req, res) => {
    const { customer_id, type, amount, notes, order_id } = req.body;

    // Month Lock Check
    const now = new Date();
    if (await isMonthClosed(now.getMonth() + 1, now.getFullYear())) {
      return res.status(403).json({ error: "لا يمكن إضافة حركات عملاء في شهر مغلق" });
    }

    try {
      const result = await pool.query("INSERT INTO customer_transactions (customer_id, type, amount, notes, order_id) VALUES ($1, $2, $3, $4, $5) RETURNING id", [customer_id, type, amount, notes, order_id || null]);
      await pool.query(
        `UPDATE customers SET total_orders = COALESCE(total_orders, 0) + 1, 
         total_spent = COALESCE(total_spent, 0) + $1 
         WHERE id = $2`,
        [amount, customer_id]
      );
      res.json({ id: result.rows[0].id });
    } catch (error) {
      res.status(500).json({ error: "Failed to create transaction" });
    }
  });

  // Edit customer
  router.put('/api/customers/:id', authenticateToken, async (req, res) => {
    try {
      const { name, phone, email, address, notes, tax_number } = req.body;
      const hasSalesRepId = Object.prototype.hasOwnProperty.call(req.body, "sales_rep_id");
      const salesRepId = !hasSalesRepId || req.body.sales_rep_id === null || req.body.sales_rep_id === ""
        ? null
        : Number(req.body.sales_rep_id);
      if (hasSalesRepId && salesRepId !== null) {
        if (!Number.isInteger(salesRepId) || salesRepId <= 0) {
          return res.status(400).json({ error: "مندوب المبيعات المحدد غير صالح" });
        }
        const repExists = await pool.query("SELECT id FROM sales_reps WHERE id = $1 LIMIT 1", [salesRepId]);
        if (repExists.rows.length === 0) {
          return res.status(400).json({ error: "مندوب المبيعات المحدد غير موجود" });
        }
      }
      const { rows } = await pool.query(
        `UPDATE customers SET name=COALESCE($1,name), phone=COALESCE($2,phone), email=COALESCE($3,email),
         address=COALESCE($4,address), notes=COALESCE($5,notes), tax_number=COALESCE($6,tax_number),
         sales_rep_id=CASE WHEN $7 THEN $8 ELSE sales_rep_id END, updated_at=CURRENT_TIMESTAMP
         WHERE id=$9 RETURNING *`,
        [name, phone, email, address, notes, tax_number, hasSalesRepId, salesRepId, req.params.id]
      );
      if (!rows[0]) return res.status(404).json({ error: 'العميل غير موجود' });
      res.json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete customer
  router.delete('/api/customers/:id', authenticateToken, async (req, res) => {
    try {
      const { rows } = await pool.query('DELETE FROM customers WHERE id=$1 RETURNING id', [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: 'العميل غير موجود' });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delivery Endpoints
  
  router.get("/api/delivery/drivers", async (req, res) => {
    try {
      const { branchId } = req.query;
      let query = `
        SELECT e.id, e.name, e.branch_id, d.name as dept_name, e.job_title
        FROM employees e
        LEFT JOIN hr_departments d ON e.department_id = d.id
        WHERE (d.name LIKE '%دليفر%' 
           OR d.name LIKE '%دلفري%'
           OR d.name LIKE '%دلفر%'
           OR d.name LIKE '%توصيل%' 
           OR e.job_title LIKE '%طيار%'
           OR e.job_title LIKE '%دليفر%'
           OR e.job_title LIKE '%دلفري%'
           OR e.job_title LIKE '%سائق%'
           OR d.name ILIKE '%deliver%')
      `;
      let params: any[] = [];
      
      if (branchId && branchId !== 'all') {
        params.push(branchId);
        query += ` AND (e.branch_id = $${params.length} OR e.branch_id IS NULL)`;
      }
      
      const result = await pool.query(query, params);
      
      // Fallback: If no drivers matched the string patterns, but there are employees in exactly a department named exactly what they might have typed, let's just return all employees for that branch as a last resort if result is 0?
      // No, let's keep it strictly to what the query matches.
      
      res.json(result.rows);
    } catch (error) {
      console.error("Failed to fetch drivers:", error);
      res.status(500).json({ error: "Failed to fetch drivers" });
    }
  });

  router.get("/api/delivery/orders", async (req, res) => {
    try {
      const { branchId } = req.query;
      let query = `
        SELECT o.*, b.name as branch_name, e.name as driver_name 
        FROM orders o 
        LEFT JOIN branches b ON o.branch_id = b.id 
        LEFT JOIN employees e ON o.delivery_driver_id = e.id
        WHERE o.order_type = 'delivery'
      `;
      let params: any[] = [];
      
      if (branchId && branchId !== 'all') {
        query += ` AND o.branch_id = $1`;
        params.push(branchId);
      }
      
      query += ` ORDER BY o.timestamp DESC`;
      
      const orders = (await pool.query(query, params)).rows;

      const ordersWithItems = await Promise.all(orders.map(async (order: any) => {
        const items = (await pool.query(`
          SELECT oi.*, p.name as product_name 
          FROM order_items oi 
          JOIN products p ON oi.product_id = p.id 
          WHERE oi.order_id = $1
        `, [order.id])).rows;
        return { ...order, items };
      }));

      res.json(ordersWithItems);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch delivery orders" });
    }
  });

  // Table Management Endpoints
  router.get("/api/branches/:branchId/tables-status", async (req, res) => {
    const { branchId } = req.params;
    try {
      const openOrders = (await pool.query("SELECT table_number, id as order_id, total FROM orders WHERE branch_id = $1 AND is_paid = 0 AND status != 'cancelled'", [branchId])).rows;
      res.json(openOrders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tables status" });
    }
  });

  // POS Void Orders Search Endpoint
  router.get("/api/pos/orders-for-void", authenticateToken, async (req: any, res: any) => {
    const { branchId, search, date, source } = req.query;
    const user = req.user;
    try {
      let query = `
        SELECT 
          o.*, 
          b.name as branch_name, 
          u.username as cashier_name
        FROM orders o
        LEFT JOIN branches b ON o.branch_id = b.id
        LEFT JOIN users u ON o.user_id = u.id
        WHERE 1=1
      `;
      const params: any[] = [];

      // فصل القنوات: شاشة نقطة البيع تعرض أوردرات نقطة البيع فقط، وشاشة الكول سنتر تعرض أوردرات الكول سنتر فقط
      const channelScope = String(source || "").trim().toLowerCase();
      if (channelScope === "pos" || channelScope === "call_center") {
        params.push(channelScope);
        query += ` AND COALESCE(NULLIF(TRIM(o.source), ''), 'pos') = $${params.length}`;
      }

      if (user?.role !== 'admin' && user?.branch_id) {
        params.push(user.branch_id);
        query += ` AND o.branch_id = $${params.length}`;
      } else if (branchId && branchId !== 'all' && branchId !== 'undefined' && branchId !== 'null') {
        params.push(branchId);
        query += ` AND o.branch_id = $${params.length}`;
      }

      if (date) {
        params.push(date);
        query += ` AND o.timestamp::date = $${params.length}::date`;
      }

      if (search && String(search).trim()) {
        const s = String(search).trim();
        params.push(`%${s}%`);
        const pIdx = params.length;
        if (!isNaN(Number(s))) {
          params.push(Number(s));
          const numIdx = params.length;
          query += ` AND (o.id = $${numIdx} OR o.daily_number = $${numIdx} OR COALESCE(o.customer_name, '') ILIKE $${pIdx} OR COALESCE(o.customer_phone, '') ILIKE $${pIdx})`;
        } else {
          query += ` AND (COALESCE(o.customer_name, '') ILIKE $${pIdx} OR COALESCE(o.customer_phone, '') ILIKE $${pIdx} OR COALESCE(o.notes, '') ILIKE $${pIdx})`;
        }
      }

      query += ` ORDER BY o.timestamp DESC, o.id DESC LIMIT 100`;
      const orders = (await pool.query(query, params)).rows;

      const ordersWithItems = await Promise.all(
        orders.map(async (order: any) => {
          const items = (
            await pool.query(
              `SELECT oi.*, p.name as product_name, p.name, p.image
               FROM order_items oi
               LEFT JOIN products p ON oi.product_id = p.id
               WHERE oi.order_id = $1`,
              [order.id]
            )
          ).rows;
          return { ...order, items };
        })
      );

      res.json(ordersWithItems);
    } catch (error) {
      console.error("Failed to fetch orders for POS void:", error);
      res.status(500).json({ error: "تعذر جلب الطلبات للاسترجاع أو التعديل" });
    }
  });

  router.get("/api/orders/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const order = (await pool.query("SELECT * FROM orders WHERE id = $1", [id])).rows[0];
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch order" });
    }
  });

  router.put("/api/orders/:id", authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { items, total, notes, discount, tax_amount, service_charge } = req.body;
    const actingUserId = Number((req as any).user?.id) || 1;
    const actingUsername = (req as any).user?.username || "مستخدم";

    // Month Lock Check
    const now = new Date();
    if (await isMonthClosed(now.getMonth() + 1, now.getFullYear())) {
      return res.status(403).json({ error: "لا يمكن تحديث الطلب في شهر مغلق" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      
      const oldOrder = (await client.query("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [id])).rows[0];
      if (!oldOrder) throw new Error("Order not found");

      // فصل القنوات: شاشة الفود لا تعدّل أوردرات قناة أخرى
      const requestedScope = String((req.body?.scope ?? req.query?.scope ?? "")).trim().toLowerCase();
      if (requestedScope === "pos" || requestedScope === "call_center") {
        const orderChannel = String(oldOrder.source || "").trim().toLowerCase() === "call_center" ? "call_center" : "pos";
        if (orderChannel !== requestedScope) {
          await client.query("ROLLBACK");
          return res.status(403).json({
            error: requestedScope === "call_center"
              ? "هذا الأوردر تابع لنقطة البيع وليس للكول سنتر، ولا يمكن تعديله من شاشة الكول سنتر"
              : "هذا الأوردر تابع للكول سنتر وليس لنقطة البيع، ولا يمكن تعديله من شاشة نقطة البيع",
          });
        }
      }

      // Default warehouse fallback for products without a specific warehouse_id
      const defaultWhRes = await client.query(
        "SELECT id FROM warehouses WHERE (branch_id = $1 AND is_kitchen::text IN ('1', 'true')) OR branch_id = $1 OR is_main::text IN ('1', 'true') ORDER BY is_kitchen DESC, is_main DESC LIMIT 1",
        [oldOrder.branch_id]
      );
      const defaultWhId = Number(defaultWhRes.rows[0]?.id || 1);
      
      const oldItems = (await client.query("SELECT oi.*, p.name as product_name, p.warehouse_id FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = $1", [id])).rows;
      const modificationDetails = JSON.stringify({
        action: "pos_void_edit",
        user: actingUsername,
        old_total: Number(oldOrder.total || 0),
        new_total: Number(total || 0),
        old_items: oldItems.map((i: any) => ({ product_id: i.product_id, product_name: i.product_name || i.name, quantity: i.quantity, price: i.price })),
        new_items: (items || []).map((i: any) => ({ product_id: i.id || i.product_id, product_name: i.name || i.product_name, quantity: i.quantity, price: i.price }))
      });
      const modificationRes = await client.query(
        "INSERT INTO order_modifications (order_id, type, old_total, new_total, notes, details) VALUES ($1, 'modification', $2, $3, $4, $5) RETURNING id",
        [id, oldOrder.total, total, notes || `تعديل الطلب (Void) بواسطة ${actingUsername}`, modificationDetails]
      );
      const modificationId = Number(modificationRes.rows[0].id);
      
      // Reverse the old deduction through the central engine to each product's warehouse.
      if (oldOrder.is_deducted) {
        const moves = new Map<string, { warehouseId: number; ingredientId: number; qty: number }>();
        for (const item of oldItems) {
          const prodRes = await client.query("SELECT warehouse_id, ingredient_id, track_inventory FROM products WHERE id = $1", [item.product_id]);
          const product = prodRes.rows[0];
          if (product?.track_inventory === false) continue;
          const targetWhId = Number(product?.warehouse_id || defaultWhId);

          const recipe = (await client.query("SELECT ingredient_id, quantity FROM product_ingredients WHERE product_id = $1", [item.product_id])).rows;
          if (recipe.length > 0) {
            for (const pi of recipe) {
              const qty = Number(pi.quantity || 0) * Number(item.quantity || 1);
              const key = `${targetWhId}:${pi.ingredient_id}`;
              const cur = moves.get(key);
              if (cur) cur.qty += qty;
              else moves.set(key, { warehouseId: targetWhId, ingredientId: Number(pi.ingredient_id), qty });
            }
          } else if (product?.ingredient_id) {
            const qty = Number(item.quantity || 1);
            const key = `${targetWhId}:${product.ingredient_id}`;
            const cur = moves.get(key);
            if (cur) cur.qty += qty;
            else moves.set(key, { warehouseId: targetWhId, ingredientId: Number(product.ingredient_id), qty });
          }
        }
        for (const move of moves.values()) {
          await moveStock(client, { warehouse_id: move.warehouseId, ingredient_id: move.ingredientId, delta: move.qty, ref_type: "pos_order_edit_reverse", ref_id: modificationId, user: String(actingUserId), notes: `عكس مخزون تعديل أوردر رقم ${id}` });
          await client.query("UPDATE ingredients SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM inventory_items WHERE ingredient_id = $1) WHERE id = $1", [move.ingredientId]);
        }
      }

      // Delete existing items
      await client.query("DELETE FROM order_items WHERE order_id = $1", [id]);
      
      // Insert new items
      for (const item of items) {
        const prodId = item.id || item.product_id;
        await client.query("INSERT INTO order_items (order_id, product_id, size_name, quantity, price) VALUES ($1, $2, $3, $4, $5)", [id, prodId, item.selectedSize?.name || item.size_name || null, item.quantity, item.price]);
      }
      
      // Apply the replacement deduction through the central engine to each product's warehouse.
      let newTotalCost = 0;
      if (oldOrder.is_deducted) {
        const moves = new Map<string, { warehouseId: number; ingredientId: number; qty: number }>();
        for (const item of items) {
          const prodId = item.id || item.product_id;
          const prodRes = await client.query("SELECT warehouse_id, ingredient_id, track_inventory FROM products WHERE id = $1", [prodId]);
          const product = prodRes.rows[0];
          if (product?.track_inventory === false) continue;
          const targetWhId = Number(product?.warehouse_id || defaultWhId);

          const recipe = (await client.query("SELECT ingredient_id, quantity FROM product_ingredients WHERE product_id = $1", [prodId])).rows;
          if (recipe.length > 0) {
            for (const pi of recipe) {
              const qty = Number(pi.quantity || 0) * Number(item.quantity || 1);
              const key = `${targetWhId}:${pi.ingredient_id}`;
              const cur = moves.get(key);
              if (cur) cur.qty += qty;
              else moves.set(key, { warehouseId: targetWhId, ingredientId: Number(pi.ingredient_id), qty });
            }
          } else if (product?.ingredient_id) {
            const qty = Number(item.quantity || 1);
            const key = `${targetWhId}:${product.ingredient_id}`;
            const cur = moves.get(key);
            if (cur) cur.qty += qty;
            else moves.set(key, { warehouseId: targetWhId, ingredientId: Number(product.ingredient_id), qty });
          }
        }
        for (const move of moves.values()) {
          const movement = await moveStock(client, { warehouse_id: move.warehouseId, ingredient_id: move.ingredientId, delta: -move.qty, ref_type: "pos_order_edit_apply", ref_id: modificationId, user: String(actingUserId), notes: `خصم مخزون تعديل أوردر رقم ${id}` });
          newTotalCost += Number(movement.total_cost) || 0;
          await client.query("UPDATE ingredients SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM inventory_items WHERE ingredient_id = $1) WHERE id = $1", [move.ingredientId]);
        }
      }

      const finalTotal = Number(total || 0);
      const oldTotalNum = Number(oldOrder.total || 0);
      const diff = finalTotal - oldTotalNum;

      // Update order total and notes
      await client.query(
        "UPDATE orders SET total = $1, notes = $2, discount = COALESCE($3, discount), tax_amount = COALESCE($4, tax_amount), service_charge = COALESCE($5, service_charge) WHERE id = $6",
        [finalTotal, notes, discount !== undefined ? Number(discount) : null, tax_amount !== undefined ? Number(tax_amount) : null, service_charge !== undefined ? Number(service_charge) : null, id]
      );
      
      // 1. Update Safe & Treasury balance (difference)
      if (oldOrder.is_paid && Math.abs(diff) > 0.001) {
        // Legacy safes table
        const safeTxRes = await client.query(
          "SELECT * FROM safe_transactions WHERE reference_id = $1 ORDER BY id DESC LIMIT 1",
          [id]
        );
        let safeId = safeTxRes.rows[0]?.safe_id;
        if (!safeId) {
          const safeRow = (await client.query("SELECT id FROM safes WHERE branch_id = $1 ORDER BY id ASC LIMIT 1", [oldOrder.branch_id])).rows[0];
          safeId = safeRow?.id;
        }
        if (safeId) {
          await client.query("UPDATE safes SET balance = balance + $1 WHERE id = $2", [diff, safeId]);
          await client.query(
            "INSERT INTO safe_transactions (safe_id, amount, type, notes, user_id, payment_method, reference_id, shift_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
            [safeId, Math.abs(diff), diff >= 0 ? 'in' : 'out', `تعديل أوردر رقم ${id} (Void) - فرق القيمة (${notes || ''})`, actingUserId, oldOrder.payment_method || 'cash', id, oldOrder.shift_id || null]
          );
        }

        // Modern treasury_accounts & treasury_transactions
        const origTreasuryTxs = (await client.query(
          "SELECT * FROM treasury_transactions WHERE reference_type = 'pos_order' AND reference_id = $1 AND status != 'cancelled'",
          [id]
        )).rows;

        if (origTreasuryTxs.length > 0) {
          for (const tx of origTreasuryTxs) {
            const accRes = await client.query("SELECT id, current_balance FROM treasury_accounts WHERE id = $1 FOR UPDATE", [tx.account_id]);
            const acc = accRes.rows[0];
            if (acc) {
              const newBal = Number(acc.current_balance || 0) + diff;
              await client.query("UPDATE treasury_accounts SET current_balance = $1 WHERE id = $2", [newBal, acc.id]);
              await client.query(
                `UPDATE treasury_transactions 
                 SET amount = $1, balance_after = balance_before + $1, notes = $2, description = $3
                 WHERE id = $4`,
                [
                  finalTotal,
                  `تعديل مبيعات POS (Void) — أوردر #${id} (كان ${oldTotalNum} وأصبح ${finalTotal})`,
                  `إيرادات نقطة البيع (معدل) — أوردر #${id}`,
                  tx.id
                ]
              );
            }
          }
        } else {
          const tAccRes = await client.query(
            "SELECT id, current_balance FROM treasury_accounts WHERE branch_id = $1 ORDER BY is_main DESC NULLS LAST, id ASC LIMIT 1",
            [oldOrder.branch_id]
          );
          const tAcc = tAccRes.rows[0];
          if (tAcc) {
            const balBefore = Number(tAcc.current_balance || 0);
            const balAfter = balBefore + diff;
            await client.query("UPDATE treasury_accounts SET current_balance = $1 WHERE id = $2", [balAfter, tAcc.id]);
            await client.query(
              `INSERT INTO treasury_transactions (
                 account_id, amount, transaction_type, reference_type, reference_id, notes, description,
                 status, voucher_number, voucher_type, payment_method, client_type, client_name,
                 balance_before, balance_after, branch_id, created_by, date, shift_id
               ) VALUES ($1, $2, $3, 'pos_order_void_edit', $4, $5, $6, 'approved', $7, $8, $9, 'customer', $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, $15)`,
              [
                tAcc.id,
                diff,
                diff >= 0 ? 'cash_in' : 'cash_out',
                id,
                `فرق تعديل أوردر POS (Void) #${id} (${notes || ''})`,
                `تسوية تعديل أوردر POS #${id}`,
                `VOID-EDIT-${id}-${modificationId}`,
                diff >= 0 ? 'receipt' : 'payment',
                oldOrder.payment_method || 'cash',
                oldOrder.customer_name || 'عميل نقدي',
                balBefore,
                balAfter,
                oldOrder.branch_id || null,
                actingUserId,
                oldOrder.shift_id || null
              ]
            );
          }
        }
      }

      // 2. Update Customer Transactions if customer is linked
      if (oldOrder.customer_phone && Math.abs(diff) > 0.001) {
        await client.query(
          "UPDATE customers SET total_spent = GREATEST(0, COALESCE(total_spent, 0) + $1) WHERE phone = $2",
          [diff, oldOrder.customer_phone]
        );
        await client.query(
          "UPDATE customer_transactions SET amount = $1, notes = $2 WHERE order_id = $3 AND type = 'invoice'",
          [finalTotal, `فاتورة طلب رقم ${id} (معدلة Void)`, id]
        );
        if (oldOrder.is_paid) {
          await client.query(
            "UPDATE customer_transactions SET amount = $1, notes = $2 WHERE order_id = $3 AND type = 'payment'",
            [finalTotal, `سداد فاتورة طلب رقم ${id} (معدلة Void)`, id]
          );
        }
      }

      // 3. Update General Ledger (Journal Entries & Account Balances)
      const oldJEs = (await client.query(
        "SELECT * FROM journal_entries WHERE source_type IN ('pos', 'sales', 'restaurant') AND source_id = $1",
        [id]
      )).rows;

      for (const je of oldJEs) {
        const jItems = (await client.query("SELECT * FROM journal_items WHERE journal_entry_id = $1", [je.id])).rows;
        for (const ji of jItems) {
          const debit = parseFloat(ji.debit) || 0;
          const credit = parseFloat(ji.credit) || 0;
          await client.query("UPDATE accounts SET balance = balance - $1 + $2 WHERE id = $3", [debit, credit, ji.account_id]);
        }
        await client.query("DELETE FROM journal_items WHERE journal_entry_id = $1", [je.id]);
        await client.query("DELETE FROM journal_entries WHERE id = $1", [je.id]);
      }

      if (finalTotal > 0) {
        const posCustomer = oldOrder.customer_phone
          ? await client.query("SELECT id FROM customers WHERE phone = $1 LIMIT 1", [oldOrder.customer_phone])
          : await client.query("SELECT id FROM customers WHERE name ILIKE $1 LIMIT 1", [oldOrder.customer_name || ""]);
        await postSalesEntry({
          id: Number(id),
          total: finalTotal,
          discount: Number(discount !== undefined ? discount : (oldOrder.discount || 0)),
          tax_amount: Number(tax_amount !== undefined ? tax_amount : (oldOrder.tax_amount || 0)),
          net_total: finalTotal,
          total_cost: newTotalCost,
          payment_method: oldOrder.payment_method || "cash",
          customer_id: Number(posCustomer.rows[0]?.id) || undefined,
          customer_name: oldOrder.customer_name || "عميل نقدي",
          branch_id: Number(oldOrder.branch_id) || 1,
          source_type: "pos",
          source_label: "إيرادات نقطة البيع (معدل Void)",
          user_id: actingUserId
        }, client);
      }

      await client.query("COMMIT");

      // 4. Log Action in User Logs
      await logAction(
        actingUserId,
        "تعديل أوردر نقطة البيع (Void Edit)",
        "orders",
        Number(id),
        `قام المستخدم ${actingUsername} بتعديل الأوردر رقم #${id} (اليومي: ${oldOrder.daily_number || id}) من إجمالي ${oldTotalNum} ج.م إلى ${finalTotal} ج.م وتحديث الخزينة والحسابات العامة. السبب/الملاحظات: ${notes || 'تعديل من نقطة البيع'}`
      );

      const fullOrder = (await pool.query(`
        SELECT o.*, b.name as branch_name 
        FROM orders o 
        LEFT JOIN branches b ON o.branch_id = b.id 
        WHERE o.id = $1
      `, [id])).rows[0];
      
      const orderItems = (await pool.query(`
        SELECT oi.*, p.name as product_name 
        FROM order_items oi 
        JOIN products p ON oi.product_id = p.id 
        WHERE oi.order_id = $1
      `, [id])).rows;
      
      io.emit("order_updated", { ...fullOrder, items: orderItems });

      res.json({ success: true });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Failed to update order", error);
      res.status(500).json({ error: "Failed to update order" });
    } finally {
      client.release();
    }
  });

  router.get("/api/orders/:orderId/items", async (req, res) => {
    const { orderId } = req.params;
    try {
      const items = (await pool.query(`
        SELECT oi.*, p.name, p.image 
        FROM order_items oi 
        JOIN products p ON oi.product_id = p.id 
        WHERE oi.order_id = $1
      `, [orderId])).rows;
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch order items" });
    }
  });

  router.post("/api/orders/:orderId/add-items", async (req, res) => {
    const { orderId } = req.params;
    const { items, additionalTotal, notes, additionalDiscount } = req.body;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      
      if (!Array.isArray(items) || items.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "يجب إرسال صنف واحد على الأقل للإضافة" });
      }

      const order = (await client.query("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [orderId])).rows[0];
      if (!order) throw new Error("Order not found");

      // `additionalTotal` is optional: older callers only send the lines. Deriving it
      // (and coercing `order.total`, which node-postgres returns as a string) avoids the
      // "0.00NaN" numeric crash that turned every such addition into a 500.
      const itemsTotal = items.reduce((sum: number, i: any) => sum + Number(i.price || 0) * Number(i.quantity || 0), 0);
      const parsedTotal = Number(additionalTotal);
      const additionTotal = Number.isFinite(parsedTotal) ? parsedTotal : itemsTotal;
      const parsedDiscount = Number(additionalDiscount || 0);
      const additionDiscount = Number.isFinite(parsedDiscount) ? parsedDiscount : 0;
      const adjustedTotalInput = Math.max(0, additionTotal - additionDiscount);
      const customerLinesTotal = Number(order.total) + adjustedTotalInput;

      const additionDetails = items.map((i: any) => `${i.name || i.id} (x${i.quantity})`).join(', ');
      const additionRes = await client.query(
        "INSERT INTO order_modifications (order_id, type, old_total, new_total, notes, details) VALUES ($1, 'addition', $2, $3, $4, $5) RETURNING id",
        [orderId, Number(order.total), customerLinesTotal, notes || "إضافة عناصر", additionDetails]
      );
      const additionId = Number(additionRes.rows[0].id);

      for (const item of items) {
        await client.query("INSERT INTO order_items (order_id, product_id, size_name, quantity, price) VALUES ($1, $2, $3, $4, $5)", [orderId, item.id, item.selectedSize?.name || null, item.quantity, item.price]);
      }
      
      let updateQuery = "UPDATE orders SET total = total + $1, discount = COALESCE(discount, 0) + $2";
      const updateParams: any[] = [adjustedTotalInput, additionDiscount];
      
      if (notes) {
        updateQuery += ", notes = CASE WHEN notes IS NULL OR notes = '' THEN $3 ELSE notes || '\n' || $4 END";
        updateParams.push(notes, notes);
      }
      
      updateQuery += ` WHERE id = $${updateParams.length + 1}`;
      updateParams.push(orderId);
      
      await client.query(updateQuery, updateParams);

      if (order.is_deducted) {
        let branchWarehouse = (await client.query("SELECT id FROM warehouses WHERE branch_id = $1 AND is_kitchen = 1 LIMIT 1", [order.branch_id])).rows[0];
        if (!branchWarehouse) branchWarehouse = (await client.query("SELECT id FROM warehouses WHERE branch_id = $1 LIMIT 1", [order.branch_id])).rows[0];
        if (!branchWarehouse) throw new Error("لا يوجد مخزن للفرع لتنفيذ الإضافة");
        const moves = new Map<string, number>();
        for (const item of items) {
          const recipe = (await client.query("SELECT ingredient_id, quantity FROM product_ingredients WHERE product_id = $1", [item.id])).rows;
          for (const pi of recipe) {
            const qty = Number(pi.quantity || 0) * Number(item.quantity || 1);
            moves.set(String(pi.ingredient_id), (moves.get(String(pi.ingredient_id)) || 0) + qty);
          }
        }
        for (const [ingredientId, qty] of moves) {
          await moveStock(client, { warehouse_id: Number(branchWarehouse.id), ingredient_id: Number(ingredientId), delta: -qty, ref_type: "pos_order_add", ref_id: additionId, user: String((req as any).user?.id || "system"), notes: `خصم مقادير إضافية لأوردر رقم ${orderId}` });
        }
      }
      
      await client.query("COMMIT");
      
      const numericOrderId = parseInt(orderId);
      
      // Print added items to kitchen
      printOrderToKitchen(numericOrderId, items, { order_type: order.order_type, table_number: order.table_number, notes: notes ? `إضافة: ${notes}` : 'إضافة عناصر' }, order.branch_id);
      
      const fullOrder = (await pool.query(`
        SELECT o.*, b.name as branch_name 
        FROM orders o 
        LEFT JOIN branches b ON o.branch_id = b.id 
        WHERE o.id = $1
      `, [orderId])).rows[0];
      
      const orderItems = (await pool.query(`
        SELECT oi.*, p.name as product_name 
        FROM order_items oi 
        JOIN products p ON oi.product_id = p.id 
        WHERE oi.order_id = $1
      `, [orderId])).rows;
      
      io.emit("order_updated", { ...fullOrder, items: orderItems });

      res.json({ success: true, dailyNumber: fullOrder.daily_number || parseInt(orderId) });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Failed to add items to order", error);
      res.status(500).json({ error: "Failed to add items to order" });
    } finally {
      client.release();
    }
  });

  router.post("/api/orders/:orderId/checkout", async (req, res) => {
    const { orderId } = req.params;
    const { user_id, payment_method = 'cash' } = req.body || {};

    // Month Lock Check
    const now = new Date();
    if (await isMonthClosed(now.getMonth() + 1, now.getFullYear())) {
      return res.status(403).json({ error: "لا يمكن إتمام الطلب في شهر مغلق" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      
      const order = (await client.query("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [orderId])).rows[0];
      if (!order) throw new Error("Order not found");
      
      if (Boolean(order.is_paid)) { await client.query("COMMIT"); return res.json({ success: true, alreadyPaid: true }); }

      await client.query("UPDATE orders SET is_paid = 1, payment_method = $2 WHERE id = $1", [orderId, payment_method]);
      
      // Update Safe
      const safe = (await client.query("SELECT * FROM safes WHERE branch_id = $1", [order.branch_id])).rows[0];
      if (safe) {
        const methodNames: Record<string, string> = {
          cash: 'كاش',
          wallet: 'محفظة إلكترونية',
          instapay: 'إنستا باي',
          visa: 'فيزا / بطاقة',
          mastercard: 'ماستر كارد',
          credit: 'آجل / حساب عميل',
          mixed: 'دفع مختلط'
        };
        const methodNameAr = methodNames[payment_method] || 'كاش';

        await client.query("UPDATE safes SET balance = balance + $1 WHERE id = $2", [order.total, safe.id]);
        await client.query(
          "INSERT INTO safe_transactions (safe_id, amount, type, notes, user_id, payment_method) VALUES ($1, $2, 'sale', $3, $4, $5)",
          [safe.id, order.total, `تحصيل أوردر رقم ${orderId} (${methodNameAr})`, user_id || null, payment_method]
        );
      }

      await client.query("COMMIT");
      res.json({ success: true });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Checkout error:", error);
      res.status(500).json({ error: "Failed to checkout order" });
    } finally {
      client.release();
    }
  });

  router.post("/api/orders/:id/cancel", authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { notes } = req.body;
    const actingUserId = Number((req as any).user?.id) || 1;
    const actingUsername = (req as any).user?.username || "مستخدم";

    // Month Lock Check
    const now = new Date();
    if (await isMonthClosed(now.getMonth() + 1, now.getFullYear())) {
      return res.status(403).json({ error: "لا يمكن إلغاء الطلب في شهر مغلق" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      
      const order = (await client.query("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [id])).rows[0];
      if (!order) throw new Error("Order not found");
      if (order.status === 'cancelled') { await client.query("COMMIT"); return res.json({ success: true, alreadyCancelled: true }); }

      // فصل القنوات: لا تُلغى أوردرات الكول سنتر من شاشة نقطة البيع، ولا أوردرات نقطة البيع من شاشة الكول سنتر
      const requestedScope = String((req.body?.scope ?? req.query?.scope ?? "")).trim().toLowerCase();
      if (requestedScope === "pos" || requestedScope === "call_center") {
        const orderChannel = String(order.source || "").trim().toLowerCase() === "call_center" ? "call_center" : "pos";
        if (orderChannel !== requestedScope) {
          await client.query("ROLLBACK");
          return res.status(403).json({
            error: requestedScope === "call_center"
              ? "هذا الأوردر تابع لنقطة البيع وليس للكول سنتر، ولا يمكن إلغاؤه من شاشة الكول سنتر"
              : "هذا الأوردر تابع للكول سنتر وليس لنقطة البيع، ولا يمكن إلغاؤه من شاشة نقطة البيع",
          });
        }
      }
      
      const orderItems = (await client.query(
        "SELECT oi.*, p.name as product_name FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = $1",
        [id]
      )).rows;

      // 1. Update order status to cancelled (stays in orders table for cancelled orders reports)
      const cancelNote = notes ? `${notes} (ملغي بواسطة ${actingUsername})` : `إلغاء / استرجاع (Void) بواسطة ${actingUsername}`;
      await client.query(
        "UPDATE orders SET status = 'cancelled', notes = CASE WHEN notes IS NULL OR notes = '' THEN $2 ELSE notes || ' | ' || $2 END WHERE id = $1",
        [id, cancelNote]
      );
      
      // 2. Record modification with full details
      const cancelDetails = JSON.stringify({
        action: "pos_void_cancel",
        user: actingUsername,
        old_total: Number(order.total || 0),
        payment_method: order.payment_method,
        customer_name: order.customer_name,
        items: orderItems.map((i: any) => ({ product_id: i.product_id, product_name: i.product_name || i.name, quantity: i.quantity, price: i.price }))
      });
      await client.query(
        "INSERT INTO order_modifications (order_id, type, old_total, new_total, notes, details) VALUES ($1, 'cancellation', $2, 0, $3, $4)",
        [id, order.total, cancelNote, cancelDetails]
      );
      
      // 3. Update Safe & Treasury with proper Void / Refund Cash-out movements
      const orderTotal = Number(order.total || 0);
      if (order.is_paid && orderTotal > 0) {
        // 3a. Modern treasury_accounts & treasury_transactions (سجل حركات الخزينة والحسابات المالية)
        let targetAccountId: number | null = null;
        const origTreasuryTx = (await client.query(
          "SELECT * FROM treasury_transactions WHERE reference_type = 'pos_order' AND reference_id = $1 ORDER BY id DESC LIMIT 1",
          [id]
        )).rows[0];

        if (origTreasuryTx) {
          targetAccountId = Number(origTreasuryTx.account_id);
        } else {
          if (order.shift_id) {
            const shiftRes = await client.query("SELECT cashbox_id FROM pos_shifts WHERE id = $1", [order.shift_id]);
            targetAccountId = shiftRes.rows[0]?.cashbox_id ? Number(shiftRes.rows[0].cashbox_id) : null;
          }
          if (!targetAccountId) {
            const tAccRes = await client.query(
              "SELECT id FROM treasury_accounts WHERE branch_id = $1 ORDER BY is_main DESC NULLS LAST, id ASC LIMIT 1",
              [order.branch_id]
            );
            targetAccountId = tAccRes.rows[0]?.id ? Number(tAccRes.rows[0].id) : null;
          }
          if (!targetAccountId) {
            const firstAcc = await client.query("SELECT id FROM treasury_accounts ORDER BY is_main DESC NULLS LAST, id ASC LIMIT 1");
            targetAccountId = firstAcc.rows[0]?.id ? Number(firstAcc.rows[0].id) : null;
          }
        }

        if (targetAccountId) {
          const accRes = await client.query("SELECT id, current_balance FROM treasury_accounts WHERE id = $1 FOR UPDATE", [targetAccountId]);
          const tAcc = accRes.rows[0];
          if (tAcc) {
            const balBefore = Number(tAcc.current_balance || 0);
            const balAfter = balBefore - orderTotal;
            await client.query("UPDATE treasury_accounts SET current_balance = $1 WHERE id = $2", [balAfter, tAcc.id]);

            const voidTxRes = await client.query(
              `INSERT INTO treasury_transactions (
                 account_id, amount, transaction_type, reference_type, reference_id, notes, description,
                 status, voucher_number, voucher_type, payment_method, client_type, client_name,
                 balance_before, balance_after, branch_id, created_by, date, shift_id, reversal_transaction_id
               ) VALUES ($1, $2, 'cash_out', 'pos_order_void', $3, $4, $5, 'approved', $6, 'payment', $7, 'customer', $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, $13, $14)
               RETURNING id`,
              [
                tAcc.id,
                -orderTotal,
                id,
                `استرجاع / إلغاء أوردر نقطة البيع (Void) رقم #${id}${notes ? ' - ' + notes : ''}`,
                `استرداد مبيعات أوردر POS #${id} (Void)`,
                `VOID-POS-${id}`,
                order.payment_method || 'cash',
                order.customer_name || 'عميل نقدي',
                balBefore,
                balAfter,
                order.branch_id || null,
                actingUserId,
                order.shift_id || null,
                origTreasuryTx?.id || null
              ]
            );

            if (origTreasuryTx) {
              await client.query(
                `UPDATE treasury_transactions 
                 SET reversal_transaction_id = $1, 
                     notes = COALESCE(notes, '') || ' | تم الإلغاء (Void)' 
                 WHERE id = $2`,
                [voidTxRes.rows[0]?.id, origTreasuryTx.id]
              );
            }
          }
        }

        // 3b. Legacy safes & safe_transactions
        let safeId: number | null = null;
        const origSafeTx = (await client.query(
          "SELECT * FROM safe_transactions WHERE reference_id = $1 AND type = 'sale' ORDER BY id DESC LIMIT 1",
          [id]
        )).rows[0];

        if (origSafeTx) {
          safeId = Number(origSafeTx.safe_id);
        } else {
          const safeRes = await client.query("SELECT id FROM safes WHERE branch_id = $1 ORDER BY id ASC LIMIT 1", [order.branch_id]);
          safeId = safeRes.rows[0]?.id ? Number(safeRes.rows[0].id) : null;
          if (!safeId) {
            const firstSafe = await client.query("SELECT id FROM safes ORDER BY id ASC LIMIT 1");
            safeId = firstSafe.rows[0]?.id ? Number(firstSafe.rows[0].id) : null;
          }
        }

        if (safeId) {
          await client.query("UPDATE safes SET balance = balance - $1 WHERE id = $2", [orderTotal, safeId]);
          await client.query(
            `INSERT INTO safe_transactions (safe_id, amount, type, notes, user_id, payment_method, reference_id, shift_id)
             VALUES ($1, $2, 'out', $3, $4, $5, $6, $7)`,
            [
              safeId,
              orderTotal,
              `استرجاع أوردر نقطة البيع رقم #${id} (Void)${notes ? ' - ' + notes : ''}`,
              actingUserId,
              order.payment_method || 'cash',
              id,
              order.shift_id || null
            ]
          );
        }
      }

      // 4. General Accounts: Post counterpart reversal journal entry (قيد يومية عكسي متزن للفويد)
      const posJEs = (await client.query(
        "SELECT * FROM journal_entries WHERE source_type IN ('pos', 'sales', 'restaurant') AND source_id = $1",
        [id]
      )).rows;

      for (const origJE of posJEs) {
        const jItems = (await client.query(
          "SELECT * FROM journal_items WHERE journal_entry_id = $1",
          [origJE.id]
        )).rows;

        if (jItems.length > 0) {
          const revRef = `VOID-${origJE.reference || 'POS-' + id}`;
          const revDesc = `قيد عكسي / استرجاع أوردر نقطة البيع (Void) رقم #${id}`;
          const totalDebit = Number(origJE.total_credit || origJE.total_debit || 0);
          const totalCredit = totalDebit;

          const newJERes = await client.query(
            `INSERT INTO journal_entries (
              date, description, reference, source_type, source_id, status, total_debit, total_credit, created_by, branch_id, period_id
            ) VALUES (CURRENT_TIMESTAMP, $1, $2, 'pos_void', $3, 'posted', $4, $5, $6, $7, $8)
            RETURNING id`,
            [revDesc, revRef, id, totalDebit, totalCredit, actingUserId, origJE.branch_id, origJE.period_id]
          );
          const newJEId = newJERes.rows[0].id;

          for (const item of jItems) {
            const revDebit = Number(item.credit) || 0;
            const revCredit = Number(item.debit) || 0;

            await client.query(
              `INSERT INTO journal_items (
                journal_entry_id, account_id, debit, credit, notes, cost_center_id
              ) VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                newJEId,
                item.account_id,
                revDebit,
                revCredit,
                `عكس قيد أوردر نقطة بيع #${id}: ${item.notes || ''}`,
                item.cost_center_id || null
              ]
            );

            // Update account balance: balance = balance + (debit - credit)
            await client.query(
              "UPDATE accounts SET balance = balance + $1 WHERE id = $2",
              [revDebit - revCredit, item.account_id]
            );
          }

          // Mark original journal entry as reversed
          await client.query(
            "UPDATE journal_entries SET status = 'reversed', description = COALESCE(description, '') || ' | تم الإلغاء (Void)' WHERE id = $1",
            [origJE.id]
          );
        }
      }

      // 5. Reverse Customer Transactions & Stats if customer is linked
      if (order.customer_phone) {
        await client.query(
          `UPDATE customers 
           SET total_orders = GREATEST(0, COALESCE(total_orders, 1) - 1),
               total_spent = GREATEST(0, COALESCE(total_spent, 0) - $1)
           WHERE phone = $2`,
          [orderTotal, order.customer_phone]
        );
      }
      await client.query("DELETE FROM customer_transactions WHERE order_id = $1", [id]);

      // 6. Reverse inventory deduction exactly once to the EXACT warehouse(s) it was deducted from
      if (order.is_deducted) {
        // Step 6a: Check inventory_stock_ledger for exact deductions executed for this POS order
        const ledgerDeductions = (await client.query(
          `SELECT warehouse_id, ingredient_id, ABS(delta::numeric) AS qty
             FROM inventory_stock_ledger
            WHERE ref_type = 'pos_sale' AND ref_id = $1 AND field = 'quantity'`,
          [id]
        )).rows;

        if (ledgerDeductions.length > 0) {
          for (const deduction of ledgerDeductions) {
            const whId = Number(deduction.warehouse_id);
            const ingId = Number(deduction.ingredient_id);
            const qty = Number(deduction.qty);
            if (whId > 0 && ingId > 0 && qty > 0) {
              await moveStock(client, {
                warehouse_id: whId,
                ingredient_id: ingId,
                delta: qty, // Positive to restore into original warehouse
                ref_type: "pos_sale_cancel",
                ref_id: Number(id),
                user: String(actingUserId),
                notes: `استرجاع مقادير أوردر ملغي (Void) رقم ${id}`
              });
              await client.query(
                "UPDATE ingredients SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM inventory_items WHERE ingredient_id = $1) WHERE id = $1",
                [ingId]
              );
            }
          }
        } else {
          // Step 6b: Fallback if ledger records are not present: resolve warehouse per product
          const fallbackWhRes = await client.query(
            "SELECT id FROM warehouses WHERE (branch_id = $1 AND is_kitchen::text IN ('1', 'true')) OR branch_id = $1 OR is_main::text IN ('1', 'true') ORDER BY is_kitchen DESC, is_main DESC LIMIT 1",
            [order.branch_id]
          );
          const fallbackWhId = fallbackWhRes.rows[0]?.id || 1;

          const stockMoves = new Map<string, { warehouseId: number; ingredientId: number; qty: number }>();
          for (const item of orderItems) {
            const prodRes = await client.query(
              "SELECT warehouse_id, ingredient_id, track_inventory FROM products WHERE id = $1",
              [item.product_id]
            );
            const product = prodRes.rows[0];
            if (product?.track_inventory === false) continue;

            const targetWhId = Number(product?.warehouse_id || fallbackWhId);
            const recipe = await client.query(
              "SELECT ingredient_id, quantity FROM product_ingredients WHERE product_id = $1",
              [item.product_id]
            );
            if (recipe.rows && recipe.rows.length > 0) {
              for (const pi of recipe.rows) {
                const qty = Number(pi.quantity || 0) * Number(item.quantity || 1);
                if (qty <= 0) continue;
                const key = `${targetWhId}:${pi.ingredient_id}`;
                const cur = stockMoves.get(key);
                if (cur) cur.qty += qty;
                else stockMoves.set(key, { warehouseId: targetWhId, ingredientId: Number(pi.ingredient_id), qty });
              }
            } else if (product?.ingredient_id) {
              const qty = Number(item.quantity || 1);
              if (qty > 0) {
                const key = `${targetWhId}:${product.ingredient_id}`;
                const cur = stockMoves.get(key);
                if (cur) cur.qty += qty;
                else stockMoves.set(key, { warehouseId: targetWhId, ingredientId: Number(product.ingredient_id), qty });
              }
            }
          }

          for (const move of stockMoves.values()) {
            await moveStock(client, {
              warehouse_id: move.warehouseId,
              ingredient_id: move.ingredientId,
              delta: move.qty,
              ref_type: "pos_sale_cancel",
              ref_id: Number(id),
              user: String(actingUserId),
              notes: `استرجاع مقادير أوردر ملغي (Void) رقم ${id}`
            });
            await client.query(
              "UPDATE ingredients SET current_stock = (SELECT COALESCE(SUM(quantity), 0) FROM inventory_items WHERE ingredient_id = $1) WHERE id = $1",
              [move.ingredientId]
            );
          }
        }
        await client.query("UPDATE orders SET is_deducted = 0 WHERE id = $1", [id]);
      }

      await client.query("COMMIT");

      // 7. Log Action in User Logs
      await logAction(
        actingUserId,
        "إلغاء / استرجاع أوردر نقطة البيع (Void)",
        "orders",
        Number(id),
        `قام المستخدم ${actingUsername} بإلغاء واسترجاع الأوردر رقم #${id} (اليومي: ${order.daily_number || id}) بقيمة ${orderTotal} ج.م وتم إرجاع المنتجات للمخزن وتسجيل حركة الصرف بالخزينة وإصدار القيد العكسي بالحسابات العامة. السبب: ${notes || 'استرجاع من نقطة البيع (Void)'}`
      );

      io.emit("order_status_updated", { id: Number(id), status: "cancelled" });
      res.json({ success: true });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Cancel order error:", error);
      res.status(500).json({ error: "Failed to cancel order" });
    } finally {
      client.release();
    }
  });

  // Branch Management Endpoints
  router.get("/api/branches", async (req, res) => {
    try {
      const branches = (await pool.query("SELECT * FROM branches")).rows;
      res.json(branches);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch branches" });
    }
  });

  // Delivery Areas Endpoints
  router.get("/api/delivery-areas", async (req, res) => {
    const { branch_id } = req.query;
    try {
      let query = "SELECT * FROM delivery_areas";
      let params: any[] = [];
      if (branch_id) {
        query += " WHERE branch_id = $1";
        params.push(branch_id);
      }
      const areas = (await pool.query(query, params)).rows;
      res.json(areas);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch delivery areas" });
    }
  });

  router.post("/api/delivery-areas", authenticateToken, async (req, res) => {
    const { id, branch_id, name, price, is_active } = req.body;
    try {
      await pool.query(
        "INSERT INTO delivery_areas (id, branch_id, name, price, is_active) VALUES ($1, $2, $3, $4, $5)",
        [id, branch_id, name, price || 0, is_active !== false]
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to add delivery area" });
    }
  });

  router.put("/api/delivery-areas/:id", authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { name, price, is_active } = req.body;
    try {
      await pool.query(
        "UPDATE delivery_areas SET name = $1, price = $2, is_active = $3 WHERE id = $4",
        [name, price || 0, is_active !== false, id]
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update delivery area" });
    }
  });

  router.delete("/api/delivery-areas/:id", authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query("DELETE FROM delivery_areas WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete delivery area" });
    }
  });

  // Printers Endpoints
  router.get("/api/printers", async (req, res) => {
    const { branch_id } = req.query;
    try {
      let query = "SELECT * FROM printers";
      let params: any[] = [];
      if (branch_id) {
        query += " WHERE branch_id = $1";
        params.push(branch_id);
      }
      const printers = (await pool.query(query, params)).rows;
      const formattedPrinters = printers.map((p: any) => ({
        ...p,
        category_ids: p.category_ids ? (typeof p.category_ids === 'string' ? JSON.parse(p.category_ids) : p.category_ids) : []
      }));
      res.json(formattedPrinters);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch printers" });
    }
  });

  router.post("/api/printers", async (req, res) => {
    const { name, ip_address, port, is_active, branch_id, category_ids, connection_type, system_printer_name } = req.body;
    if (connection_type === 'local' && !system_printer_name) {
      return res.status(400).json({ error: "اختر طابعة من طابعات الجهاز أولاً" });
    }
    try {
      const result = await pool.query(
        "INSERT INTO printers (name, ip_address, port, is_active, branch_id, category_ids, connection_type, system_printer_name) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
        [name, ip_address || '', port || 9100, is_active === undefined ? 1 : is_active, branch_id || null, category_ids ? JSON.stringify(category_ids) : null, connection_type || 'ip', system_printer_name || null]
      );
      res.json({ id: result.rows[0].id });
    } catch (error) {
      res.status(500).json({ error: "Failed to add printer" });
    }
  });

  router.put("/api/printers/:id", async (req, res) => {
    const { id } = req.params;
    const { name, ip_address, port, is_active, branch_id, category_ids, connection_type, system_printer_name } = req.body;
    if (connection_type === 'local' && !system_printer_name) {
      return res.status(400).json({ error: "اختر طابعة من طابعات الجهاز أولاً" });
    }
    try {
      await pool.query(
        "UPDATE printers SET name = $1, ip_address = $2, port = $3, is_active = $4, branch_id = $5, category_ids = $6, connection_type = $7, system_printer_name = $8 WHERE id = $9",
        [name, ip_address || '', port || 9100, is_active === undefined ? 1 : is_active, branch_id || null, category_ids ? JSON.stringify(category_ids) : null, connection_type || 'ip', system_printer_name || null, id]
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update printer" });
    }
  });

  router.get("/api/system-printers", async (req, res) => {
    try {
      const { exec } = await import('child_process');
      const run = (command: string): Promise<string> =>
        new Promise((resolve) => {
          exec(command, { maxBuffer: 1024 * 1024 }, (err: any, stdout: string) => {
            resolve(err ? '' : String(stdout || ''));
          });
        });

      const parseList = (raw: string) => {
        if (!raw || !raw.trim()) return [];
        try {
          const parsed = JSON.parse(raw);
          const list = Array.isArray(parsed) ? parsed : [parsed];
          return list
            .map((p: any) => (typeof p === "string" ? { Name: p } : p))
            .filter((p: any) => p && p.Name)
            .map((p: any) => ({
              name: String(p.Name),
              isDefault: p.Default === true,
              status: p.WorkOffline ? "offline" : "ready"
            }));
        } catch {
          return raw
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((name) => ({ name, isDefault: false, status: "ready" }));
        }
      };

      const command = 'Get-Printer | Select-Object Name,Default,WorkOffline | ConvertTo-Json -Compress';
      // Force UTF-8 so Arabic printer names survive the pipe back to Node
      const utf8 = '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;';
      let list = parseList(await run(`powershell -NoProfile "${utf8}${command}"`));
      if (list.length === 0) {
        // Fallback for hosts where the print spooler cmdlet is unavailable
        const fallback = 'Get-CimInstance Win32_Printer | Select-Object Name,Default,WorkOffline | ConvertTo-Json -Compress';
        list = parseList(await run(`powershell -NoProfile "${utf8}${fallback}"`));
      }

      res.json(list);
    } catch (error) {
      res.json([]);
    }
  });

  // Print a short test receipt through a specific printer to verify its binding
  router.post("/api/printers/:id/test", async (req, res) => {
    const { id } = req.params;
    try {
      const printer = (await pool.query("SELECT * FROM printers WHERE id = $1", [id])).rows[0];
      if (!printer) {
        return res.status(404).json({ success: false, error: "الطابعة غير موجودة" });
      }

      const result = await printTestReceipt(printer);
      if (!result.ok) {
        return res.status(502).json({ success: false, error: result.message });
      }
      res.json({ success: true, message: result.message });
    } catch (error: any) {
      console.error("Printer test print failed:", error);
      res.status(500).json({ success: false, error: error?.message || "فشل اختبار الطباعة" });
    }
  });

  router.delete("/api/printers/:id", async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE categories SET printer_id = NULL WHERE printer_id = $1", [id]);
      await client.query("DELETE FROM printers WHERE id = $1", [id]);
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (error) {
      await client.query("ROLLBACK");
      res.status(500).json({ error: "Failed to delete printer" });
    } finally {
      client.release();
    }
  });

  router.get("/api/reports/orders/modifications", authenticateToken, async (req: any, res: any) => {
    const user = req.user;
    try {
      let query = `
        SELECT 
          om.id as "م",
          om.order_id as "رقم الطلب",
          o.daily_number as "رقم الطلب اليومي",
          CASE WHEN om.type = 'cancellation' THEN 'إلغاء' ELSE 'تعديل' END as "نوع العملية",
          om.old_total as "الإجمالي القديم",
          om.new_total as "الإجمالي الجديد",
          om.notes as "ملاحظات",
          TO_CHAR(om.date, 'YYYY-MM-DD HH24:MI:SS') as "التاريخ",
          b.name as "الفرع",
          om.details as "تفاصيل التعديل"
        FROM order_modifications om
        JOIN orders o ON om.order_id = o.id
        JOIN branches b ON o.branch_id = b.id
        WHERE 1=1
      `;
      const params: any[] = [];

      // Branch filtering
      if (user.role !== 'admin' && user.branch_id) {
        params.push(user.branch_id);
        query += ` AND o.branch_id = $${params.length}`;
      }

      // Date filtering
      const { startDate, endDate, from, to } = req.query;
      const start = startDate || from;
      const end = endDate || to;
      if (start) {
        params.push(start);
        query += ` AND om.date >= $${params.length}::timestamp`;
      }
      if (end) {
        params.push(`${end} 23:59:59`);
        query += ` AND om.date <= $${params.length}::timestamp`;
      }

      query += " ORDER BY om.date DESC";
      
      const modifications = (await pool.query(query, params)).rows;
      res.json(modifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch modifications" });
    }
  });

  router.post("/api/branches", async (req, res) => {
    const { name, tables_count, company_id } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Branch name is required" });
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // BUG-ERP-012 / PHASE 4: persist company_id so the branch is not orphaned.
      const companyId = company_id ?? (await client.query("SELECT id FROM companies ORDER BY id LIMIT 1")).rows[0]?.id ?? null;
      const result = await client.query(
        "INSERT INTO branches (name, tables_count, company_id) VALUES ($1, $2, $3) RETURNING id",
        [String(name).trim(), tables_count || 0, companyId]
      );
      const branchId = result.rows[0].id;
      
      // Automatically create a warehouse for the new branch
      await client.query("INSERT INTO warehouses (name, type, branch_id) VALUES ($1, 'branch', $2)", [`مخزن ${name}`, branchId]);
      
      // Automatically create a kitchen warehouse for the new branch
      await client.query("INSERT INTO warehouses (name, type, branch_id, is_kitchen) VALUES ($1, 'branch', $2, 1)", [`المخزن التشغيلي - ${name}`, branchId]);
      
      // Automatically create a safe for the new branch
      await client.query("INSERT INTO safes (name, branch_id, balance) VALUES ($1, $2, 0)", [`خزينة ${name}`, branchId]);
      
      await client.query("COMMIT");
      res.json({ id: branchId });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Failed to add branch:", error);
      res.status(500).json({ error: "Failed to add branch" });
    } finally {
      client.release();
    }
  });

  router.put("/api/branches/:id", async (req, res) => {
    const { id } = req.params;
    const { name, tables_count } = req.body;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE branches SET name = $1, tables_count = $2 WHERE id = $3", [name, tables_count, id]);
      
      // Update the corresponding warehouse name
      await client.query("UPDATE warehouses SET name = $1 WHERE branch_id = $2 AND is_kitchen = 0", [`مخزن ${name}`, id]);
      await client.query("UPDATE warehouses SET name = $1 WHERE branch_id = $2 AND is_kitchen = 1", [`المخزن التشغيلي - ${name}`, id]);
      
      // Update the corresponding safe name
      await client.query("UPDATE safes SET name = $1 WHERE branch_id = $2", [`خزينة ${name}`, id]);
      
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Failed to update branch:", error);
      res.status(500).json({ error: "Failed to update branch" });
    } finally {
      client.release();
    }
  });

  router.delete("/api/branches/:id", async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const inOrdersResult = await client.query("SELECT COUNT(*) as count FROM orders WHERE branch_id = $1", [id]);
      if (parseInt(inOrdersResult.rows[0].count) > 0) {
        throw new Error("Cannot delete branch because it has orders");
      }

      // Delete warehouse transactions
      const warehouses = (await client.query("SELECT id FROM warehouses WHERE branch_id = $1", [id])).rows;
      for (const warehouse of warehouses) {
        await client.query("DELETE FROM inventory_transactions WHERE warehouse_id = $1", [warehouse.id]);
        await client.query("DELETE FROM inventory_items WHERE warehouse_id = $1", [warehouse.id]);
      }
      await client.query("DELETE FROM warehouses WHERE branch_id = $1", [id]);
      
      // Delete safe transactions
      const safe = (await client.query("SELECT id FROM safes WHERE branch_id = $1", [id])).rows[0];
      if (safe) {
        await client.query("DELETE FROM safe_transactions WHERE safe_id = $1", [safe.id]);
      }
      await client.query("DELETE FROM safes WHERE branch_id = $1", [id]);
      
      // Delete the branch
      await client.query("DELETE FROM branches WHERE id = $1", [id]);
      
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (error: any) {
      await client.query("ROLLBACK");
      console.error("Failed to delete branch:", error);
      res.status(500).json({ error: error.message || "Failed to delete branch" });
    } finally {
      client.release();
    }
  });

export default router;
