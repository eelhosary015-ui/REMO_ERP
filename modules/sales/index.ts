import { Router, Request, Response } from "express";
import { QuotationController } from "./controllers/quotation.controller.js";
import { SalesOrderController } from "./controllers/sales_order.controller.js";
import { DeliveryController } from "./controllers/delivery.controller.js";
import { ReturnController } from "./controllers/return.controller.js";
import { InvoiceController } from "./controllers/invoice.controller.js";
import { SalesProductController } from "./controllers/sales_product.controller.js";
import { ReservationService } from "./services/reservation.service.js";
import { SalesAuditService } from "./services/audit.service.js";
import { erpPool } from "../../server-erp-core.js";

const salesRoutes = Router();
const quotationController = new QuotationController();
const orderController = new SalesOrderController();
const deliveryController = new DeliveryController();
const returnController = new ReturnController();
const invoiceController = new InvoiceController();
const productController = new SalesProductController();

// 0. Sales Products & Settings (إدارة منتجات المبيعات والربط بالمخازن)
salesRoutes.get("/products", productController.getProducts);
salesRoutes.get("/products/stats", productController.getStats);
salesRoutes.get("/products/master-items", productController.getMasterItems);
salesRoutes.get("/products/:id", productController.getProductById);
salesRoutes.get("/products/:id/movement", productController.getMovement);
salesRoutes.post("/products", productController.createProduct);
salesRoutes.put("/products/:id", productController.updateProduct);
salesRoutes.patch("/products/:id/toggle-status", productController.toggleStatus);
salesRoutes.delete("/products/:id", productController.deleteProduct);

// 1. Quotations
salesRoutes.get("/quotations", quotationController.getQuotations);
salesRoutes.post("/quotations", quotationController.createQuotation);
salesRoutes.put("/quotations/:id", quotationController.updateQuotation);
salesRoutes.delete("/quotations/:id", quotationController.deleteQuotation);

// 2. Sales Orders
salesRoutes.get("/orders", orderController.getSalesOrders);
salesRoutes.post("/orders", orderController.createSalesOrder);
salesRoutes.post("/orders/:id/confirm-and-deliver", orderController.confirmAndDeliverOrder);
salesRoutes.put("/orders/:id", orderController.updateSalesOrder);
salesRoutes.delete("/orders/:id", orderController.deleteSalesOrder);

// 3. Delivery Notes (إذن تسليم)
salesRoutes.get("/deliveries", deliveryController.getDeliveries);
salesRoutes.get("/deliveries/:id", deliveryController.getDeliveryById);
salesRoutes.post("/deliveries", deliveryController.createDelivery);
salesRoutes.post("/deliveries/:id/confirm", deliveryController.confirmAndDispatch);
salesRoutes.put("/deliveries/:id", deliveryController.updateDelivery);
salesRoutes.delete("/deliveries/:id", deliveryController.deleteDelivery);

// 4. Sales Invoices (فاتورة مبيعات)
salesRoutes.get("/invoices", invoiceController.getInvoices);
salesRoutes.get("/invoices/:id", invoiceController.getInvoiceById);
salesRoutes.post("/invoices", invoiceController.createInvoice);
salesRoutes.post("/invoices/:id/post", invoiceController.postInvoice);
salesRoutes.post("/invoices/:id/cancel", invoiceController.cancelInvoice);
salesRoutes.put("/invoices/:id", invoiceController.updateInvoice);
salesRoutes.delete("/invoices/:id", invoiceController.deleteInvoice);
salesRoutes.post("/invoices/:id/payments", invoiceController.recordPayment);

// 5. Sales Returns (مرتجع مبيعات)
salesRoutes.get("/returns/eligible-invoices", returnController.getEligibleInvoices);
salesRoutes.get("/returns/invoices/:id/return-details", returnController.getInvoiceReturnDetails);
salesRoutes.get("/returns", returnController.getReturns);
salesRoutes.get("/returns/:id", returnController.getReturnById);
salesRoutes.post("/returns", returnController.createReturn);
salesRoutes.put("/returns/:id", returnController.updateReturn);
salesRoutes.delete("/returns/:id", returnController.deleteReturn);

// 6. Contracts (عقود التوريد)
salesRoutes.get("/contracts", async (req: Request, res: Response) => {
  try {
    await erpPool.query(`
      CREATE TABLE IF NOT EXISTS sales_contracts (
        id SERIAL PRIMARY KEY,
        contract_no VARCHAR(100) UNIQUE NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        total_value DECIMAL(12,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'ساري',
        payment_terms TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const result = await erpPool.query("SELECT * FROM sales_contracts ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

salesRoutes.post("/contracts", async (req: Request, res: Response) => {
  try {
    const { contract_no, customer_name, start_date, end_date, total_value = 0, status = 'ساري', payment_terms, notes } = req.body;
    const contractNo = contract_no || `CNT-${Date.now().toString().slice(-6)}`;
    const result = await erpPool.query(`
      INSERT INTO sales_contracts (contract_no, customer_name, start_date, end_date, total_value, status, payment_terms, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [contractNo, customer_name, start_date, end_date, total_value, status, payment_terms, notes]);
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

salesRoutes.delete("/contracts/:id", async (req: Request, res: Response) => {
  try {
    await erpPool.query("DELETE FROM sales_contracts WHERE id = $1", [req.params.id]);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Reservations (حجز البضاعة)
salesRoutes.get("/reservations", async (req: Request, res: Response) => {
  try {
    const list = await ReservationService.getReservations();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

salesRoutes.get("/reservations/availability", async (req: Request, res: Response) => {
  try {
    const warehouseId = parseInt(req.query.warehouseId as string) || 1;
    const item = (req.query.item as string) || '';
    const availability = await ReservationService.getStockAvailability(warehouseId, item);
    res.json(availability);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

salesRoutes.post("/reservations", async (req: Request, res: Response) => {
  try {
    const b = req.body;
    const created = await ReservationService.createReservation({
      reservationNo: b.reservation_no || b.reservationNo,
      orderId: b.order_id || b.orderId,
      orderNo: b.order_no || b.orderNo,
      customerName: b.customer_name || b.customerName,
      salesRep: b.sales_rep || b.salesRep,
      productId: b.product_id || b.productId,
      ingredientId: b.ingredient_id || b.ingredientId,
      itemName: b.item_name || b.itemName,
      itemCode: b.item_code || b.itemCode,
      warehouseId: b.warehouse_id || b.warehouseId,
      warehouse: b.warehouse,
      qty: parseFloat(b.qty || 0),
      reserveDate: b.reserve_date || b.reserveDate,
      expiryDate: b.expiry_date || b.expiryDate,
      userName: b.user_name || b.userName,
      status: b.status || 'Reserved',
      notes: b.notes
    });
    res.status(201).json(created);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

salesRoutes.patch("/reservations/:id/release", async (req: Request, res: Response) => {
  try {
    const released = await ReservationService.releaseOrCancelReservation(
      parseInt(req.params.id),
      'Released',
      req.body.userName || 'المستخدم'
    );
    res.json(released);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

salesRoutes.patch("/reservations/:id/cancel", async (req: Request, res: Response) => {
  try {
    const cancelled = await ReservationService.releaseOrCancelReservation(
      parseInt(req.params.id),
      'Cancelled',
      req.body.userName || 'المستخدم'
    );
    res.json(cancelled);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

salesRoutes.delete("/reservations/:id", async (req: Request, res: Response) => {
  try {
    await ReservationService.releaseOrCancelReservation(parseInt(req.params.id), 'Cancelled', 'حذف');
    await erpPool.query("DELETE FROM sales_reservations WHERE id = $1", [req.params.id]);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Sales Reps & Commissions (المندوبين والعمولات)
salesRoutes.get("/sales-reps", async (req: Request, res: Response) => {
  try {
    await erpPool.query(`
      CREATE TABLE IF NOT EXISTS sales_reps (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        email VARCHAR(100),
        target_amount DECIMAL(12,2) DEFAULT 0,
        achieved_amount DECIMAL(12,2) DEFAULT 0,
        commission_rate DECIMAL(5,2) DEFAULT 2.5,
        total_commission DECIMAL(12,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'نشط',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const result = await erpPool.query("SELECT * FROM sales_reps ORDER BY name ASC");
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

salesRoutes.post("/sales-reps", async (req: Request, res: Response) => {
  try {
    const { name, phone, email, target_amount = 0, achieved_amount = 0, commission_rate = 2.5, status = 'نشط' } = req.body;
    const total_commission = (Number(achieved_amount) * Number(commission_rate)) / 100;
    const result = await erpPool.query(`
      INSERT INTO sales_reps (name, phone, email, target_amount, achieved_amount, commission_rate, total_commission, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [name, phone, email, target_amount, achieved_amount, commission_rate, total_commission, status]);
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

salesRoutes.delete("/sales-reps/:id", async (req: Request, res: Response) => {
  try {
    await erpPool.query("DELETE FROM sales_reps WHERE id = $1", [req.params.id]);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Price Lists (قوائم الأسعار)
salesRoutes.get("/price-lists", async (req: Request, res: Response) => {
  try {
    await erpPool.query(`
      CREATE TABLE IF NOT EXISTS sales_price_lists (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) DEFAULT 'جملة',
        discount_percent DECIMAL(5,2) DEFAULT 0,
        is_default BOOLEAN DEFAULT false,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const result = await erpPool.query("SELECT * FROM sales_price_lists ORDER BY id ASC");
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

salesRoutes.post("/price-lists", async (req: Request, res: Response) => {
  try {
    const { name, type = 'جملة', discount_percent = 0, is_default = false, notes } = req.body;
    const result = await erpPool.query(`
      INSERT INTO sales_price_lists (name, type, discount_percent, is_default, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [name, type, discount_percent, is_default, notes]);
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

salesRoutes.delete("/price-lists/:id", async (req: Request, res: Response) => {
  try {
    await erpPool.query("DELETE FROM sales_price_lists WHERE id = $1", [req.params.id]);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Unified Smart Search for Quotations & Sales Items (Sales Products + Master Items + Products)
salesRoutes.get("/items/search", async (req: Request, res: Response) => {
  try {
    const rawQ = (req.query.q as string || "").trim();
    const q = rawQ.toLowerCase();
    const warehouseParam = (req.query.warehouse as string || "").trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 30, 1), 50);

    // Resolve warehouse if provided
    let warehouseId: number | null = null;
    let resolvedWarehouseName: string = warehouseParam;
    if (warehouseParam) {
      try {
        // Match ignoring leading/trailing whitespace: stored warehouse names are padded
        // (e.g. "مخزن بلبييس ") while the request param is already trimmed.
        const whRes = await erpPool.query(
          "SELECT id, name FROM warehouses WHERE TRIM(name) ILIKE $1 OR id::text = $1 LIMIT 1",
          [warehouseParam]
        );
        if (whRes.rows.length > 0) {
          warehouseId = whRes.rows[0].id;
          resolvedWarehouseName = whRes.rows[0].name;
        }
      } catch (_) {}
    }

    const unifiedList: any[] = [];

    let isPosLinked = false;
    let posPriceStrategy = "markup";
    let posPriceMargin = 10;
    let defaultVatRate = 0;
    try {
      const setRes = await erpPool.query("SELECT value FROM settings WHERE key = 'sales_settings_config'");
      if (setRes.rows.length > 0 && setRes.rows[0].value) {
        const parsed = typeof setRes.rows[0].value === "string" ? JSON.parse(setRes.rows[0].value) : setRes.rows[0].value;
        if (parsed) {
          isPosLinked = Boolean(parsed.linkPosWithSales);
          posPriceStrategy = parsed.posPriceStrategy || "markup";
          posPriceMargin = Number(parsed.posPriceMarginPercent ?? 10);
          if (parsed.defaultVatRate !== undefined && parsed.defaultVatRate !== null) {
            defaultVatRate = parseFloat(parsed.defaultVatRate) || 0;
          }
        }
      }
    } catch (_) {}

    // 0. Fetch sales_products (Dedicated Sales Products with link to inventory)
    try {
      const spQuery = `
        SELECT 
          sp.*,
          COALESCE(sp.master_item_id, sp.inventory_item_id) as resolved_master_item_id,
          ing.name as master_name,
          COALESCE(NULLIF(ing.code, ''), ing.item_code) as master_code,
          COALESCE(ing.cost, ing.cost_price, ing.avg_cost, 0) as inv_cost,
          (
            SELECT COALESCE(SUM(i.quantity), 0)
            FROM inventory_items i
            WHERE i.ingredient_id = COALESCE(sp.master_item_id, sp.inventory_item_id)
          ) as total_stock,
          (
            SELECT COALESCE(SUM(COALESCE(i.available, i.quantity - COALESCE(i.reserved, 0))), 0)
            FROM inventory_items i
            WHERE i.ingredient_id = COALESCE(sp.master_item_id, sp.inventory_item_id)
              AND ($2::int IS NULL OR i.warehouse_id = $2)
          ) as wh_available
        FROM sales_products sp
        LEFT JOIN ingredients ing ON COALESCE(sp.master_item_id, sp.inventory_item_id) = ing.id
        WHERE sp.is_active = true
          AND (
            $1 = ''
            OR LOWER(CONCAT_WS(' ', sp.name, sp.code, sp.barcode, sp.sku, sp.category, ing.name, ing.code, ing.item_code))
              LIKE '%' || $1 || '%'
          )
        ORDER BY
          CASE WHEN LOWER(sp.name) = $1 OR LOWER(sp.code) = $1 OR LOWER(sp.barcode) = $1 OR LOWER(sp.sku) = $1 THEN 0 ELSE 1 END,
          CASE WHEN LOWER(sp.name) LIKE $1 || '%' OR LOWER(sp.code) LIKE $1 || '%' OR LOWER(sp.barcode) LIKE $1 || '%' OR LOWER(sp.sku) LIKE $1 || '%' THEN 0 ELSE 1 END,
          sp.id DESC
        LIMIT $3
      `;
      const spRes = await erpPool.query(spQuery, [q, warehouseId, limit]);
      for (const sp of spRes.rows) {
        const name = String(sp.name || "").trim();
        const code = String(sp.code || `SPRD-${sp.id}`).trim();
        const barcode = String(sp.barcode || "").trim();
        const sku = String(sp.sku || code).trim();
        const unit = String(sp.unit || "قطعة").trim();
        const category = String(sp.category || "منتجات مبيعات").trim();
        const rawPlId = req.query.priceListId ? Number(req.query.priceListId) : null;
        let price = parseFloat(sp.base_price || sp.retail_price || 0);
        if (rawPlId === 2 && parseFloat(sp.wholesale_price || 0) > 0) {
          price = parseFloat(sp.wholesale_price);
        } else if ((rawPlId === 3 || rawPlId === 4) && parseFloat(sp.special_price || 0) > 0) {
          price = parseFloat(sp.special_price);
        }
        const cost = parseFloat(sp.inv_cost || 0);
        const rawSpTax = sp.taxable === false ? 0 : parseFloat(sp.tax_rate ?? defaultVatRate);
        const taxRate = defaultVatRate === 0 && rawSpTax === 14 ? 0 : rawSpTax;
        const totalStock = parseFloat(sp.total_stock ?? 0);
        const availableStock = parseFloat(sp.wh_available ?? totalStock);

        const isMatch = !q ||
          name.toLowerCase().includes(q) ||
          code.toLowerCase().includes(q) ||
          barcode.toLowerCase().includes(q) ||
          sku.toLowerCase().includes(q) ||
          category.toLowerCase().includes(q) ||
          String(sp.master_name || "").toLowerCase().includes(q) ||
          String(sp.master_code || "").toLowerCase().includes(q);

        if (isMatch) {
          unifiedList.push({
            itemId: sp.id,
            productId: sp.id,
            salesProductId: sp.id,
            ingredientId: sp.resolved_master_item_id || null,
            masterItemId: sp.resolved_master_item_id || null,
            masterItemName: sp.master_name || null,
            masterItemCode: sp.master_code || null,
            itemType: "sales_product",
            typeLabel: "منتج مبيعات",
            name,
            code,
            barcode,
            sku,
            unit,
            category,
            price,
            basePrice: parseFloat(sp.base_price || 0),
            wholesalePrice: parseFloat(sp.wholesale_price || 0),
            retailPrice: parseFloat(sp.retail_price || 0),
            specialPrice: parseFloat(sp.special_price || 0),
            minPrice: parseFloat(sp.min_price || 0),
            allowPriceOverride: sp.allow_price_override ?? false,
            allowDiscount: sp.allow_discount ?? true,
            maxDiscountPct: parseFloat(sp.max_discount_pct ?? 15),
            taxable: sp.taxable ?? true,
            taxType: sp.tax_type || "VAT",
            taxRate,
            priceIncludesTax: sp.price_includes_tax ?? false,
            cost,
            stock: totalStock,
            availableStock,
            warehouse: resolvedWarehouseName || sp.default_warehouse || "المخزن الرئيسي",
            warehouseId: warehouseId || sp.default_warehouse_id,
            source: "sales_products"
          });
        }
      }
    } catch (err) {
      console.error("[Search] Sales products fetch error:", err);
      throw err;
    }

    // 0.1 Fetch POS & Shared Products available in Sales (منتجات نقطة البيع والمبيعات الموحدة)
    try {
      const posQuery = `
        SELECT 
          p.*,
          c.name as category_name,
          ing.name as master_name,
          COALESCE(NULLIF(ing.code, ''), ing.item_code) as master_code,
          COALESCE(ing.cost, ing.cost_price, ing.avg_cost, 0) as inv_cost,
          (
            SELECT COALESCE(SUM(i.quantity), 0)
            FROM inventory_items i
            WHERE i.ingredient_id = p.ingredient_id
          ) as total_stock,
          (
            SELECT COALESCE(SUM(COALESCE(i.available, i.quantity - COALESCE(i.reserved, 0))), 0)
            FROM inventory_items i
            WHERE i.ingredient_id = p.ingredient_id
              AND ($3::int IS NULL OR i.warehouse_id = $3)
          ) as wh_available
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN ingredients ing ON p.ingredient_id = ing.id
        WHERE (p.is_active = true OR p.is_active IS NULL)
          AND (
            p.is_available_in_sales = true 
            OR p.show_in_sales = true 
            OR $2 = true
          )
          AND (
            $1 = ''
            OR LOWER(CONCAT_WS(' ', p.name, p.code, p.barcode, p.sku, c.name, ing.name, ing.code, ing.item_code))
              LIKE '%' || $1 || '%'
          )
        ORDER BY
          CASE WHEN LOWER(p.name) = $1 OR LOWER(p.code) = $1 OR LOWER(p.barcode) = $1 OR LOWER(p.sku) = $1 THEN 0 ELSE 1 END,
          CASE WHEN LOWER(p.name) LIKE $1 || '%' OR LOWER(p.code) LIKE $1 || '%' OR LOWER(p.barcode) LIKE $1 || '%' OR LOWER(p.sku) LIKE $1 || '%' THEN 0 ELSE 1 END,
          p.id ASC
        LIMIT $4
      `;
      const posRes = await erpPool.query(posQuery, [q, isPosLinked, warehouseId, limit]);
      for (const p of posRes.rows) {
        const name = String(p.name || "").trim();
        const code = String(p.code || `PRD-${p.id}`).trim();
        const barcode = String(p.barcode || "").trim();
        const sku = String(p.sku || code).trim();
        const unit = String(p.unit || "قطعة").trim();
        const category = String(p.category_name || "منتجات نقطة البيع").trim();
        const posPrice = parseFloat(p.price || 0);

        // Check if explicit sales price is defined on product, else calculate based on strategy
        let customSalesPrice = p.sales_price !== null && p.sales_price !== undefined ? parseFloat(p.sales_price) : null;
        if ((customSalesPrice === null || isNaN(customSalesPrice) || customSalesPrice <= 0) && p.properties) {
          const props = typeof p.properties === "string" ? JSON.parse(p.properties || "{}") : p.properties;
          if (props?.sales_price && parseFloat(props.sales_price) > 0) {
            customSalesPrice = parseFloat(props.sales_price);
          }
        }

        let salesPrice = customSalesPrice && customSalesPrice > 0 ? customSalesPrice : posPrice;
        if (!customSalesPrice || customSalesPrice <= 0) {
          if (posPriceStrategy === "markup") {
            salesPrice = Math.round(posPrice * (1 + posPriceMargin / 100) * 100) / 100;
          } else if (posPriceStrategy === "discount") {
            salesPrice = Math.max(0, Math.round(posPrice * (1 - posPriceMargin / 100) * 100) / 100);
          } else if (posPriceStrategy === "same") {
            salesPrice = posPrice;
          }
        }

        const rawPlId = req.query.priceListId ? Number(req.query.priceListId) : null;
        if (rawPlId === 2) {
          salesPrice = Math.round((customSalesPrice || posPrice) * 0.95 * 100) / 100;
        } else if (rawPlId === 3 || rawPlId === 4) {
          salesPrice = Math.round((customSalesPrice || posPrice) * 0.90 * 100) / 100;
        }

        const cost = parseFloat(p.cost || p.inv_cost || 0);
        const rawPosTax = parseFloat(p.tax_rate ?? defaultVatRate);
        const taxRate = defaultVatRate === 0 && rawPosTax === 14 ? 0 : rawPosTax;
        const totalStock = parseFloat(p.total_stock ?? p.stock ?? 0);
        const availableStock = parseFloat(p.wh_available ?? totalStock);

        const isMatch = !q ||
          name.toLowerCase().includes(q) ||
          code.toLowerCase().includes(q) ||
          barcode.toLowerCase().includes(q) ||
          sku.toLowerCase().includes(q) ||
          category.toLowerCase().includes(q) ||
          String(p.master_name || "").toLowerCase().includes(q) ||
          String(p.master_code || "").toLowerCase().includes(q);

        // Check if already in unifiedList from sales_products to prevent duplicates
        const alreadyExists = unifiedList.some(
          (u) =>
            (u.productId && Number(u.productId) === Number(p.id)) ||
            (u.code && String(u.code).trim().toLowerCase() === code.toLowerCase())
        );

        if (isMatch && !alreadyExists) {
          const isSharedInBoth = (p.show_in_pos !== false && p.is_available_in_pos !== false) &&
                                 (p.show_in_sales === true || p.is_available_in_sales === true);
          unifiedList.push({
            itemId: p.id,
            productId: p.id,
            posProductId: p.id,
            ingredientId: p.ingredient_id || null,
            masterItemId: p.ingredient_id || null,
            masterItemName: p.master_name || null,
            masterItemCode: p.master_code || null,
            itemType: "pos_product",
            typeLabel: isSharedInBoth ? "منتج موحد (POS + مبيعات)" : "منتج مبيعات",
            name,
            code,
            barcode,
            sku,
            unit,
            category,
            price: salesPrice,
            posPrice,
            priceDifference: Math.round((salesPrice - posPrice) * 100) / 100,
            priceDifferencePct: posPrice > 0 ? Math.round(((salesPrice - posPrice) / posPrice) * 100) : 0,
            basePrice: salesPrice,
            wholesalePrice: Math.round(salesPrice * 0.95 * 100) / 100,
            retailPrice: salesPrice,
            specialPrice: Math.round(salesPrice * 0.90 * 100) / 100,
            minPrice: Math.round(salesPrice * 0.85 * 100) / 100,
            allowPriceOverride: true,
            allowDiscount: true,
            maxDiscountPct: 15,
            taxable: true,
            taxType: "VAT",
            taxRate,
            priceIncludesTax: false,
            cost,
            stock: totalStock,
            availableStock,
            warehouse: resolvedWarehouseName || "المخزن الرئيسي",
            warehouseId: p.warehouse_id || warehouseId || 1,
            source: "pos_products",
            isPosLinked: true
          });
        }
      }
    } catch (err) {
      console.error("[Search] POS products fetch error:", err);
      throw err;
    }

    // 1. Fetch ingredients (inventory items) from database with per-warehouse stock
    let ingredients: any[] = [];
    try {
      if (warehouseId) {
        const ingRes = await erpPool.query(`
          SELECT ing.*,
            COALESCE(NULLIF(ing.code, ''), ing.item_code) AS code,
            COALESCE((SELECT i.available FROM inventory_items i WHERE i.ingredient_id = ing.id AND i.warehouse_id = $1 LIMIT 1),
                     (SELECT i.quantity - COALESCE(i.reserved, 0) FROM inventory_items i WHERE i.ingredient_id = ing.id AND i.warehouse_id = $1 LIMIT 1),
                     0) AS wh_available,
            COALESCE((SELECT i.quantity FROM inventory_items i WHERE i.ingredient_id = ing.id AND i.warehouse_id = $1 LIMIT 1), 0) AS wh_stock,
            (SELECT COALESCE(SUM(i.quantity),0) FROM inventory_items i WHERE i.ingredient_id = ing.id) AS total_stock
          FROM ingredients ing
          WHERE (
            $2 = ''
            OR LOWER(CONCAT_WS(' ', ing.name, ing.code, ing.item_code, ing.barcode, ing.sku, ing.category, ing.item_group))
              LIKE '%' || $2 || '%'
          )
          ORDER BY
            CASE WHEN LOWER(ing.name) = $2 OR LOWER(ing.code) = $2 OR LOWER(ing.item_code) = $2 OR LOWER(ing.barcode) = $2 OR LOWER(ing.sku) = $2 THEN 0 ELSE 1 END,
            CASE WHEN LOWER(ing.name) LIKE $2 || '%' OR LOWER(ing.code) LIKE $2 || '%' OR LOWER(ing.item_code) LIKE $2 || '%' OR LOWER(ing.barcode) LIKE $2 || '%' OR LOWER(ing.sku) LIKE $2 || '%' THEN 0 ELSE 1 END,
            ing.id ASC
          LIMIT $3
        `, [warehouseId, q, limit]);
        ingredients = ingRes.rows || [];
      } else {
        const ingRes = await erpPool.query(`
          SELECT ing.*,
            COALESCE(NULLIF(ing.code, ''), ing.item_code) AS code,
            (SELECT COALESCE(SUM(i.available), SUM(i.quantity - COALESCE(i.reserved, 0)), 0) FROM inventory_items i WHERE i.ingredient_id = ing.id) AS wh_available,
            (SELECT COALESCE(SUM(i.quantity),0) FROM inventory_items i WHERE i.ingredient_id = ing.id) AS total_stock
          FROM ingredients ing
          WHERE (
            $1 = ''
            OR LOWER(CONCAT_WS(' ', ing.name, ing.code, ing.item_code, ing.barcode, ing.sku, ing.category, ing.item_group))
              LIKE '%' || $1 || '%'
          )
          ORDER BY
            CASE WHEN LOWER(ing.name) = $1 OR LOWER(ing.code) = $1 OR LOWER(ing.item_code) = $1 OR LOWER(ing.barcode) = $1 OR LOWER(ing.sku) = $1 THEN 0 ELSE 1 END,
            CASE WHEN LOWER(ing.name) LIKE $1 || '%' OR LOWER(ing.code) LIKE $1 || '%' OR LOWER(ing.item_code) LIKE $1 || '%' OR LOWER(ing.barcode) LIKE $1 || '%' OR LOWER(ing.sku) LIKE $1 || '%' THEN 0 ELSE 1 END,
            ing.id ASC
          LIMIT $2
        `, [q, limit]);
        ingredients = ingRes.rows || [];
      }
    } catch (err) {
      console.error("[Search] Inventory items fetch error:", err);
      throw err;
    }

    // Map ingredients (inventory items)
    for (const ing of ingredients) {
      const name = String(ing.name || ing.ingredient_name || "").trim();
      const code = String(ing.code || ing.item_code || `ITEM-${1000 + ing.id}`).trim();
      const barcode = String(ing.barcode || "").trim();
      const sku = String(ing.sku || ing.item_code || code).trim();
      const unit = String(ing.unit || "قطعة").trim();
      const category = String(ing.category || ing.item_group || "أصناف مخزنية").trim();
      const price = parseFloat(ing.selling_price || ing.price || ing.last_purchase_price || ing.avg_cost || ing.cost_price || ing.cost || 0);
      const cost = parseFloat(ing.cost_price || ing.avg_cost || ing.last_purchase_price || ing.cost || 0);
      const rawIngTax = parseFloat(ing.tax_rate ?? defaultVatRate);
      const taxRate = defaultVatRate === 0 && rawIngTax === 14 ? 0 : rawIngTax;
      const totalStock = parseFloat(ing.total_stock ?? ing.current_stock ?? 0);
      const whAvailable = warehouseId !== null ? parseFloat(ing.wh_available ?? 0) : totalStock;

      const isMatch = !q ||
        name.toLowerCase().includes(q) ||
        code.toLowerCase().includes(q) ||
        barcode.toLowerCase().includes(q) ||
        sku.toLowerCase().includes(q) ||
        category.toLowerCase().includes(q);

      if (isMatch) {
        unifiedList.push({
          itemId: ing.id,
          ingredientId: ing.id,
          itemType: "inventory_item",
          typeLabel: "صنف مخزني",
          name,
          code,
          barcode,
          sku,
          unit,
          category,
          price,
          cost,
          taxRate,
          stock: totalStock,
          availableStock: whAvailable,
          warehouse: resolvedWarehouseName || "المخزن الرئيسي",
          warehouseId: warehouseId,
          source: "ingredients"
        });
      }
    }

    // Sort: exact matches first, then sales_products first, then prefix matches, then alphabetical
    if (q) {
      unifiedList.sort((a, b) => {
        const aExact = a.name.toLowerCase() === q || a.code.toLowerCase() === q || a.barcode.toLowerCase() === q || a.sku.toLowerCase() === q;
        const bExact = b.name.toLowerCase() === q || b.code.toLowerCase() === q || b.barcode.toLowerCase() === q || b.sku.toLowerCase() === q;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        if (a.source === "sales_products" && b.source !== "sales_products") return -1;
        if (a.source !== "sales_products" && b.source === "sales_products") return 1;

        const aStarts = a.name.toLowerCase().startsWith(q) || a.code.toLowerCase().startsWith(q) || a.barcode.toLowerCase().startsWith(q);
        const bStarts = b.name.toLowerCase().startsWith(q) || b.code.toLowerCase().startsWith(q) || b.barcode.toLowerCase().startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        return a.name.localeCompare(b.name, "ar");
      });
    }

    res.json(unifiedList.slice(0, limit));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9.1 POS Integration Status, All Products, and Preview Endpoints (تكامل وعرض جميع منتجات نقطة البيع)
salesRoutes.get("/pos/status", async (req: Request, res: Response) => {
  try {
    let isPosLinked = false;
    let posPriceStrategy = "markup";
    let posPriceMarginPercent = 10;
    let syncActiveOnly = true;

    try {
      const setRes = await erpPool.query("SELECT value FROM settings WHERE key = 'sales_settings_config'");
      if (setRes.rows.length > 0 && setRes.rows[0].value) {
        const parsed = typeof setRes.rows[0].value === "string" ? JSON.parse(setRes.rows[0].value) : setRes.rows[0].value;
        isPosLinked = Boolean(parsed.linkPosWithSales);
        posPriceStrategy = parsed.posPriceStrategy || "markup";
        posPriceMarginPercent = Number(parsed.posPriceMarginPercent ?? 10);
        syncActiveOnly = parsed.posSyncActiveOnly !== false;
      }
    } catch (_) {}

    const totalPosProductsRes = await erpPool.query("SELECT COUNT(*) as cnt FROM products").catch(() => ({ rows: [{ cnt: 0 }] }));
    const activePosProductsRes = await erpPool.query("SELECT COUNT(*) as cnt FROM products WHERE is_active = true OR is_active IS NULL").catch(() => ({ rows: [{ cnt: 0 }] }));
    const salesEnabledRes = await erpPool.query(`
      SELECT COUNT(*) as cnt FROM products 
      WHERE is_available_in_sales = true 
         OR show_in_sales = true
    `).catch(() => ({ rows: [{ cnt: 0 }] }));

    res.json({
      success: true,
      isPosLinked,
      posPriceStrategy,
      posPriceMarginPercent,
      syncActiveOnly,
      totalPosProducts: parseInt(totalPosProductsRes.rows[0]?.cnt || "0", 10),
      activePosProducts: parseInt(activePosProductsRes.rows[0]?.cnt || "0", 10),
      salesEnabledProducts: parseInt(salesEnabledRes.rows[0]?.cnt || "0", 10)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

salesRoutes.get("/pos/preview", async (req: Request, res: Response) => {
  try {
    let posPriceStrategy = (req.query.strategy as string) || "markup";
    let margin = parseFloat((req.query.margin as string) || "10");
    const searchQuery = (req.query.q as string || "").trim();
    const category = (req.query.category as string || "").trim();
    const salesStatus = (req.query.salesStatus as string || "").trim();
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 500;

    let whereClauses: string[] = [];
    let values: any[] = [];
    let vIdx = 1;

    if (searchQuery) {
      whereClauses.push(`(p.name ILIKE $${vIdx} OR p.code ILIKE $${vIdx} OR p.barcode ILIKE $${vIdx} OR ing.name ILIKE $${vIdx} OR ing.code ILIKE $${vIdx})`);
      values.push(`%${searchQuery}%`);
      vIdx++;
    }

    if (category && category !== "all") {
      whereClauses.push(`c.name = $${vIdx}`);
      values.push(category);
      vIdx++;
    }

    if (salesStatus === "enabled") {
      whereClauses.push(`(p.is_available_in_sales = true OR p.show_in_sales = true)`);
    } else if (salesStatus === "disabled") {
      whereClauses.push(`(COALESCE(p.is_available_in_sales, false) = false AND COALESCE(p.show_in_sales, false) = false)`);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const query = `
      SELECT p.id, p.name, p.code, p.barcode, p.price as pos_price, p.sales_price, p.cost, p.unit, p.is_active,
             p.is_available_in_pos, p.is_available_in_sales, p.show_in_pos, p.show_in_sales, p.properties,
             p.ingredient_id,
             c.name as category_name,
             ing.name as ingredient_name,
             COALESCE(NULLIF(ing.code, ''), ing.item_code) as ingredient_code,
             ing.unit as ingredient_unit,
             (
               SELECT COALESCE(SUM(i.quantity), 0)
               FROM inventory_items i
               WHERE i.ingredient_id = p.ingredient_id
             ) as total_stock,
             (
               SELECT COALESCE(SUM(COALESCE(i.available, i.quantity - COALESCE(i.reserved, 0))), 0)
               FROM inventory_items i
               WHERE i.ingredient_id = p.ingredient_id
             ) as available_stock
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN ingredients ing ON p.ingredient_id = ing.id
      ${whereStr}
      ORDER BY p.id ASC
      LIMIT $${vIdx}
    `;
    values.push(limit);

    const result = await erpPool.query(query, values).catch(() => ({ rows: [] }));
    const items = result.rows.map((p: any) => {
      const posPrice = parseFloat(p.pos_price || 0);
      let customSalesPrice = p.sales_price !== null && p.sales_price !== undefined ? parseFloat(p.sales_price) : null;
      if ((customSalesPrice === null || isNaN(customSalesPrice) || customSalesPrice <= 0) && p.properties) {
        const props = typeof p.properties === "string" ? JSON.parse(p.properties || "{}") : p.properties;
        if (props?.sales_price && parseFloat(props.sales_price) > 0) {
          customSalesPrice = parseFloat(props.sales_price);
        }
      }

      let salesPrice = customSalesPrice && customSalesPrice > 0 ? customSalesPrice : posPrice;
      if (!customSalesPrice || customSalesPrice <= 0) {
        if (posPriceStrategy === "markup") {
          salesPrice = Math.round(posPrice * (1 + margin / 100) * 100) / 100;
        } else if (posPriceStrategy === "discount") {
          salesPrice = Math.max(0, Math.round(posPrice * (1 - margin / 100) * 100) / 100);
        }
      }

      const isAvailableInSales = Boolean(
        p.is_available_in_sales || 
        p.show_in_sales || 
        (p.properties && (typeof p.properties === 'object' ? p.properties.is_available_in_sales || p.properties.show_in_sales : false))
      );

      const isAvailableInPos = p.is_available_in_pos !== false && p.show_in_pos !== false;

      return {
        id: p.id,
        name: p.name,
        code: p.code || `POS-${p.id}`,
        barcode: p.barcode || "",
        category: p.category_name || "منتجات نقطة البيع (POS)",
        unit: p.unit || "قطعة",
        ingredientId: p.ingredient_id || null,
        ingredientName: p.ingredient_name || null,
        ingredientCode: p.ingredient_code || null,
        ingredientUnit: p.ingredient_unit || p.unit || "قطعة",
        totalStock: parseFloat(p.total_stock || "0"),
        availableStock: parseFloat(p.available_stock || "0"),
        posPrice,
        customSalesPrice,
        salesPrice,
        priceDifference: Math.round((salesPrice - posPrice) * 100) / 100,
        priceDifferencePct: posPrice > 0 ? Math.round(((salesPrice - posPrice) / posPrice) * 100) : 0,
        isActive: p.is_active !== false,
        isAvailableInPos,
        isAvailableInSales,
        showInSales: isAvailableInSales,
      };
    });

    res.json({ success: true, items, total: items.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle a single POS product's Sales availability
salesRoutes.post("/pos/toggle-sales-availability", async (req: Request, res: Response) => {
  try {
    const { productId, isAvailableInSales, salesPrice } = req.body;
    if (!productId) {
      return res.status(400).json({ error: "معرف المنتج مطلوب" });
    }

    const currentRes = await erpPool.query("SELECT * FROM products WHERE id = $1", [productId]);
    if (currentRes.rows.length === 0) {
      return res.status(404).json({ error: "المنتج غير موجود" });
    }

    const currentProd = currentRes.rows[0];
    let currentProps = typeof currentProd.properties === "string" ? JSON.parse(currentProd.properties || "{}") : (currentProd.properties || {});
    
    const newSalesAvailable = isAvailableInSales !== undefined ? Boolean(isAvailableInSales) : !Boolean(currentProd.is_available_in_sales || currentProd.show_in_sales);
    
    currentProps = {
      ...currentProps,
      is_available_in_sales: newSalesAvailable,
      show_in_sales: newSalesAvailable,
      is_available_in_pos: currentProd.is_available_in_pos !== false,
      show_in_pos: currentProd.show_in_pos !== false,
    };

    if (salesPrice !== undefined) {
      currentProps.sales_price = salesPrice ? parseFloat(salesPrice) : null;
    }

    const updateRes = await erpPool.query(`
      UPDATE products 
      SET 
        is_available_in_sales = $1,
        show_in_sales = $1,
        sales_price = COALESCE($2, sales_price),
        properties = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [
      newSalesAvailable,
      salesPrice !== undefined ? (salesPrice ? parseFloat(salesPrice) : null) : currentProd.sales_price,
      JSON.stringify(currentProps),
      productId
    ]);

    res.json({
      success: true,
      message: newSalesAvailable ? "تم تفعيل المنتج في مبيعات بنجاح" : "تم إلغاء تفعيل المنتج من المبيعات",
      product: updateRes.rows[0]
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk enable/disable all POS products for Sales
salesRoutes.post("/pos/bulk-toggle-sales", async (req: Request, res: Response) => {
  try {
    const { enableAll, productIds } = req.body;
    const shouldEnable = enableAll !== undefined ? Boolean(enableAll) : true;

    if (Array.isArray(productIds) && productIds.length > 0) {
      await erpPool.query(`
        UPDATE products
        SET 
          is_available_in_sales = $1,
          show_in_sales = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ANY($2::int[])
      `, [shouldEnable, productIds]);
    } else {
      await erpPool.query(`
        UPDATE products
        SET 
          is_available_in_sales = $1,
          show_in_sales = $1,
          updated_at = CURRENT_TIMESTAMP
      `, [shouldEnable]);
    }

    res.json({
      success: true,
      message: shouldEnable ? "تم تفعيل كافة منتجات نقطة البيع (POS) في موديول المبيعات بنجاح!" : "تم تعطيل ظهور منتجات نقطة البيع في المبيعات بنجاح."
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Sales General Ledger Journals (قيود اليومية للمبيعات)
salesRoutes.get("/journals", async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT je.*,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', ji.id,
                   'accountId', ji.account_id,
                   'accountCode', a.code,
                   'accountName', a.name,
                   'debit', ji.debit,
                   'credit', ji.credit,
                   'notes', ji.notes
                 )
               ) FILTER (WHERE ji.id IS NOT NULL),
               '[]'::json
             ) as items
      FROM journal_entries je
      LEFT JOIN journal_items ji ON je.id = ji.journal_entry_id
      LEFT JOIN accounts a ON ji.account_id = a.id
      WHERE je.source_type IN ('sales', 'sales_return', 'sales_reversal')
      GROUP BY je.id
      ORDER BY je.date DESC, je.id DESC
      LIMIT 100
    `;
    const result = await erpPool.query(query);
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Real-time Live Sales Analytics & Summary (التقارير الحية للمبيعات)
salesRoutes.get("/reports/summary", async (req: Request, res: Response) => {
  try {
    const invoicesRes = await erpPool.query(`
      SELECT
        COUNT(*) as total_invoices_count,
        COALESCE(SUM(CASE WHEN is_posted = true THEN net_amount ELSE 0 END), 0) as total_posted_sales,
        COALESCE(SUM(CASE WHEN is_posted = true THEN total_cost ELSE 0 END), 0) as total_cogs,
        COALESCE(SUM(CASE WHEN is_posted = true THEN discount_total ELSE 0 END), 0) as total_discounts,
        COALESCE(SUM(CASE WHEN is_posted = true THEN tax_total ELSE 0 END), 0) as total_vat,
        COALESCE(SUM(CASE WHEN is_posted = true THEN paid_amount ELSE 0 END), 0) as total_paid,
        COALESCE(SUM(CASE WHEN is_posted = true THEN (net_amount - paid_amount) ELSE 0 END), 0) as total_receivables,
        COALESCE(SUM(CASE WHEN is_posted = false AND status = 'مسودة' THEN net_amount ELSE 0 END), 0) as total_draft_sales
      FROM sales_invoices
      WHERE status != 'ملغاة'
    `);

    const returnsRes = await erpPool.query(`
      SELECT
        COUNT(*) as total_returns_count,
        COALESCE(SUM(grand_total), 0) as total_returns_amount,
        COALESCE(SUM(total_cost), 0) as total_returns_cost
      FROM sales_returns
      WHERE status != 'ملغى'
    `);

    const topItemsRes = await erpPool.query(`
      SELECT
        it.name,
        it.code,
        SUM(it.qty) as total_qty_sold,
        SUM(it.total) as total_revenue,
        SUM(it.total_cost) as total_cost
      FROM sales_invoice_items it
      JOIN sales_invoices i ON it.invoice_id = i.id
      WHERE i.is_posted = true AND i.status != 'ملغاة'
      GROUP BY it.name, it.code
      ORDER BY total_revenue DESC
      LIMIT 10
    `);

    const invSummary = invoicesRes.rows[0] || {};
    const retSummary = returnsRes.rows[0] || {};

    const netSales = Math.max(0, parseFloat(invSummary.total_posted_sales || 0) - parseFloat(retSummary.total_returns_amount || 0));
    const netCogs = Math.max(0, parseFloat(invSummary.total_cogs || 0) - parseFloat(retSummary.total_returns_cost || 0));
    const grossProfit = netSales - netCogs;
    const profitMarginPct = netSales > 0 ? ((grossProfit / netSales) * 100).toFixed(2) : "0.00";

    res.json({
      success: true,
      data: {
        totalInvoicesCount: parseInt(invSummary.total_invoices_count || 0),
        totalPostedSales: parseFloat(invSummary.total_posted_sales || 0),
        totalReturnsAmount: parseFloat(retSummary.total_returns_amount || 0),
        netSales,
        totalCogs: netCogs,
        grossProfit,
        profitMarginPct: parseFloat(profitMarginPct),
        totalDiscounts: parseFloat(invSummary.total_discounts || 0),
        totalVat: parseFloat(invSummary.total_vat || 0),
        totalPaid: parseFloat(invSummary.total_paid || 0),
        totalReceivables: parseFloat(invSummary.total_receivables || 0),
        totalDraftSales: parseFloat(invSummary.total_draft_sales || 0),
        topSellingItems: topItemsRes.rows.map((r: any) => ({
          name: r.name,
          code: r.code,
          qtySold: parseFloat(r.total_qty_sold || 0),
          revenue: parseFloat(r.total_revenue || 0),
          cost: parseFloat(r.total_cost || 0),
          profit: parseFloat(r.total_revenue || 0) - parseFloat(r.total_cost || 0)
        }))
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 12. Clean/Reset Sales Demo Data
salesRoutes.post("/reset-demo-data", async (req: Request, res: Response) => {
  try {
    const tablesToClean = [
      "sales_return_items",
      "sales_returns",
      "sales_invoice_payments",
      "sales_invoice_items",
      "sales_invoices",
      "sales_delivery_note_items",
      "sales_delivery_notes",
      "erp_sales_order_items",
      "erp_sales_orders",
      "sales_quotation_items",
      "sales_quotations",
      "sales_contracts",
      "sales_reservations"
    ];
    for (const table of tablesToClean) {
      try {
        await erpPool.query(`DELETE FROM ${table}`);
      } catch (_) {
        // Table might not exist yet
      }
    }
    res.json({ success: true, message: "تم تفريغ جميع البيانات التجريبية والافتراضية لمديول المبيعات بنجاح، المديول يبدأ من الصفر." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

salesRoutes.get("/audit-logs", async (req: Request, res: Response) => {
  try {
    const logs = await SalesAuditService.getLogs({
      entityType: req.query.entityType as string,
      entityId: req.query.entityId ? Number(req.query.entityId) : undefined
    });
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export function bootstrapSalesModule() {
  console.log("⚡ Bootstrapping Sales (Quotations, Sales Orders, Deliveries, Invoices, Returns & CRM) Module...");
}

export { salesRoutes };
export * from "./dto/quotation.dto.js";
export * from "./dto/sales_order.dto.js";
export * from "./dto/delivery.dto.js";
export * from "./dto/return.dto.js";
export * from "./dto/invoice.dto.js";
export * from "./validators/quotation.validator.js";
export * from "./validators/sales_order.validator.js";
export * from "./validators/return.validator.js";
export * from "./validators/invoice.validator.js";
export * from "./services/quotation.service.js";
export * from "./services/sales_order.service.js";
export * from "./services/delivery.service.js";
export * from "./services/return.service.js";
export * from "./services/invoice.service.js";
export * from "./services/reservation.service.js";
export * from "./services/audit.service.js";
export * from "./dto/sales_product.dto.js";
export * from "./services/sales_product.service.js";
export * from "./controllers/sales_product.controller.js";
