import { erpPool } from "../../../server-erp-core.js";
import { CreateSalesProductDTO, UpdateSalesProductDTO } from "../dto/sales_product.dto.js";

export class SalesProductRepository {
  private static tableInitialized = false;

  async initTable(): Promise<void> {
    if (SalesProductRepository.tableInitialized) return;
    try {
      await erpPool.query(`
        CREATE TABLE IF NOT EXISTS sales_products (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          code VARCHAR(100) UNIQUE,
          sku VARCHAR(100),
          barcode VARCHAR(100),
          category VARCHAR(100) DEFAULT 'منتجات عامة',
          category_id INTEGER,
          product_type VARCHAR(50) DEFAULT 'sale',
          unit VARCHAR(50) DEFAULT 'قطعة',
          description TEXT,
          is_active BOOLEAN DEFAULT true,
          image TEXT,
          master_item_id INTEGER REFERENCES ingredients(id) ON DELETE SET NULL,
          inventory_item_id INTEGER REFERENCES ingredients(id) ON DELETE SET NULL,
          base_price DECIMAL(12,2) DEFAULT 0,
          wholesale_price DECIMAL(12,2) DEFAULT 0,
          retail_price DECIMAL(12,2) DEFAULT 0,
          special_price DECIMAL(12,2) DEFAULT 0,
          min_price DECIMAL(12,2) DEFAULT 0,
          allow_price_override BOOLEAN DEFAULT false,
          allow_below_min_price BOOLEAN DEFAULT false,
          currency VARCHAR(50) DEFAULT 'جنيه مصري',
          price_list_id INTEGER,
          taxable BOOLEAN DEFAULT true,
          tax_type VARCHAR(50) DEFAULT 'VAT',
          tax_rate DECIMAL(5,2) DEFAULT 14,
          price_includes_tax BOOLEAN DEFAULT false,
          default_warehouse_id INTEGER,
          default_warehouse VARCHAR(255) DEFAULT 'المخزن الرئيسي',
          allow_multi_warehouse BOOLEAN DEFAULT true,
          allow_negative_stock BOOLEAN DEFAULT false,
          reorder_level DECIMAL(10,2) DEFAULT 0,
          min_order_qty DECIMAL(10,2) DEFAULT 1,
          max_order_qty DECIMAL(10,2) DEFAULT 1000,
          track_batches BOOLEAN DEFAULT false,
          track_serials BOOLEAN DEFAULT false,
          track_expiry BOOLEAN DEFAULT false,
          is_sellable BOOLEAN DEFAULT true,
          allow_discount BOOLEAN DEFAULT true,
          max_discount_pct DECIMAL(5,2) DEFAULT 15,
          allow_credit_sale BOOLEAN DEFAULT true,
          allow_exceed_credit BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_sales_products_code ON sales_products(code);
        CREATE INDEX IF NOT EXISTS idx_sales_products_sku ON sales_products(sku);
        CREATE INDEX IF NOT EXISTS idx_sales_products_barcode ON sales_products(barcode);
        CREATE INDEX IF NOT EXISTS idx_sales_products_master_item ON sales_products(master_item_id);
      `);
      SalesProductRepository.tableInitialized = true;
    } catch (err: any) {
      console.error("[SalesProductRepository] Init table error:", err.message);
    }
  }

  async getAll(params?: {
    search?: string;
    category?: string;
    isActive?: boolean;
    hasMasterItem?: boolean;
    hasPrice?: boolean;
    warehouseId?: number;
    productType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ products: any[]; total: number }> {
    await this.initTable();

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params?.search && params.search.trim()) {
      const q = `%${params.search.trim()}%`;
      conditions.push(`(
        sp.name ILIKE $${idx} OR
        sp.code ILIKE $${idx} OR
        sp.sku ILIKE $${idx} OR
        sp.barcode ILIKE $${idx} OR
        ing.name ILIKE $${idx} OR
        ing.code ILIKE $${idx} OR
        ing.item_code ILIKE $${idx} OR
        ing.barcode ILIKE $${idx}
      )`);
      values.push(q);
      idx++;
    }

    if (params?.category && params.category !== "all") {
      conditions.push(`sp.category = $${idx}`);
      values.push(params.category);
      idx++;
    }

    if (params?.isActive !== undefined) {
      conditions.push(`sp.is_active = $${idx}`);
      values.push(params.isActive);
      idx++;
    }

    if (params?.hasMasterItem !== undefined) {
      if (params.hasMasterItem) {
        conditions.push(`(sp.master_item_id IS NOT NULL OR sp.inventory_item_id IS NOT NULL)`);
      } else {
        conditions.push(`(sp.master_item_id IS NULL AND sp.inventory_item_id IS NULL)`);
      }
    }

    if (params?.hasPrice !== undefined) {
      if (params.hasPrice) {
        conditions.push(`(sp.base_price > 0 OR sp.retail_price > 0)`);
      } else {
        conditions.push(`(sp.base_price = 0 AND sp.retail_price = 0)`);
      }
    }

    if (params?.productType && params.productType !== "all") {
      conditions.push(`sp.product_type = $${idx}`);
      values.push(params.productType);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countQuery = `
      SELECT COUNT(*) as total
      FROM sales_products sp
      LEFT JOIN ingredients ing ON COALESCE(sp.master_item_id, sp.inventory_item_id) = ing.id
      ${whereClause}
    `;

    const countRes = await erpPool.query(countQuery, values);
    const total = parseInt(countRes.rows[0]?.total || "0", 10);

    let paginationClause = "";
    if (params?.limit) {
      paginationClause += ` LIMIT $${idx}`;
      values.push(params.limit);
      idx++;
      if (params?.offset) {
        paginationClause += ` OFFSET $${idx}`;
        values.push(params.offset);
        idx++;
      }
    }

    const query = `
      SELECT 
        sp.*,
        COALESCE(sp.master_item_id, sp.inventory_item_id) as resolved_master_item_id,
        ing.name as master_item_name,
        COALESCE(NULLIF(ing.code, ''), ing.item_code) as master_item_code,
        ing.unit as master_item_unit,
        ing.barcode as master_item_barcode,
        COALESCE(ing.cost, ing.cost_price, ing.avg_cost, 0) as inventory_cost,
        COALESCE(ing.last_purchase_price, ing.cost, 0) as last_purchase_price,
        (
          SELECT COALESCE(SUM(i.quantity), 0)
          FROM inventory_items i
          WHERE i.ingredient_id = COALESCE(sp.master_item_id, sp.inventory_item_id)
        ) as total_stock,
        (
          SELECT COALESCE(SUM(COALESCE(i.available, i.quantity - COALESCE(i.reserved, 0))), 0)
          FROM inventory_items i
          WHERE i.ingredient_id = COALESCE(sp.master_item_id, sp.inventory_item_id)
        ) as available_stock,
        (
          SELECT json_agg(
            json_build_object(
              'warehouseId', w.id,
              'warehouseName', w.name,
              'quantity', COALESCE(ii.quantity, 0),
              'available', COALESCE(ii.available, ii.quantity - COALESCE(ii.reserved, 0), 0)
            )
          )
          FROM inventory_items ii
          JOIN warehouses w ON ii.warehouse_id = w.id
          WHERE ii.ingredient_id = COALESCE(sp.master_item_id, sp.inventory_item_id)
        ) as warehouse_stock_details
      FROM sales_products sp
      LEFT JOIN ingredients ing ON COALESCE(sp.master_item_id, sp.inventory_item_id) = ing.id
      ${whereClause}
      ORDER BY sp.id DESC
      ${paginationClause}
    `;

    const res = await erpPool.query(query, values);
    let products = res.rows.map((r: any) => this.mapRowToProduct(r));

    // Include POS & shared Products available in Sales (الربط الموحد مع منتجات نقطة البيع)
    try {
      let isPosLinked = false;
      let strategy = "markup";
      let margin = 10;
      let defaultVatRate = 0;

      try {
        const setRes = await erpPool.query("SELECT value FROM settings WHERE key = 'sales_settings_config'");
        if (setRes.rows.length > 0 && setRes.rows[0].value) {
          const parsed = typeof setRes.rows[0].value === "string" ? JSON.parse(setRes.rows[0].value) : setRes.rows[0].value;
          if (parsed) {
            isPosLinked = Boolean(parsed.linkPosWithSales);
            strategy = parsed.posPriceStrategy || "markup";
            margin = Number(parsed.posPriceMarginPercent ?? 10);
            if (parsed.defaultVatRate !== undefined && parsed.defaultVatRate !== null) {
              defaultVatRate = Number(parsed.defaultVatRate);
            }
          }
        }
      } catch (_) {}

      products = products.map((pr: any) => ({
        ...pr,
        taxRate: pr.taxable === false ? 0 : (defaultVatRate === 0 && pr.taxRate === 14 ? 0 : pr.taxRate)
      }));

      if (params?.productType !== "sale") {
        let posQuery = `
          SELECT 
            p.*,
            c.name as category_name,
            ing.name as master_item_name,
            COALESCE(NULLIF(ing.code, ''), ing.item_code) as master_item_code,
            COALESCE(ing.cost, ing.cost_price, ing.avg_cost, 0) as inventory_cost,
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
        `;

        const posConds: string[] = [
          `((p.is_available_in_sales = true OR p.show_in_sales = true) OR $1 = true)`
        ];
        const posVals: any[] = [isPosLinked];
        let pIdx = 2;

        if (params?.search && params.search.trim()) {
          posConds.push(`(p.name ILIKE $${pIdx} OR p.code ILIKE $${pIdx} OR p.barcode ILIKE $${pIdx} OR ing.name ILIKE $${pIdx} OR ing.code ILIKE $${pIdx})`);
          posVals.push(`%${params.search.trim()}%`);
          pIdx++;
        }
        if (params?.isActive !== undefined) {
          posConds.push(`p.is_active = $${pIdx}`);
          posVals.push(params.isActive);
          pIdx++;
        }
        if (posConds.length > 0) {
          posQuery += ` WHERE ${posConds.join(" AND ")}`;
        }
        posQuery += ` ORDER BY p.id ASC`;

        const posRes = await erpPool.query(posQuery, posVals);
        const posProductsList: any[] = [];
        for (const p of posRes.rows) {
          // Prevent duplicates if already present in products array
          const code = p.code || `PRD-${p.id}`;
          const alreadyExists = products.some(
            (pr: any) =>
              (pr.posProductId && Number(pr.posProductId) === Number(p.id)) ||
              (pr.code && String(pr.code).trim().toLowerCase() === code.trim().toLowerCase())
          );
          if (alreadyExists) continue;

          const posPrice = parseFloat(p.price || "0");
          let customSalesPrice = p.sales_price !== null && p.sales_price !== undefined ? parseFloat(p.sales_price) : null;
          if ((customSalesPrice === null || isNaN(customSalesPrice) || customSalesPrice <= 0) && p.properties) {
            const props = typeof p.properties === "string" ? JSON.parse(p.properties || "{}") : p.properties;
            if (props?.sales_price && parseFloat(props.sales_price) > 0) {
              customSalesPrice = parseFloat(props.sales_price);
            }
          }

          let salesPrice = customSalesPrice && customSalesPrice > 0 ? customSalesPrice : posPrice;
          if (!customSalesPrice || customSalesPrice <= 0) {
            if (strategy === "markup") {
              salesPrice = Math.round(posPrice * (1 + margin / 100) * 100) / 100;
            } else if (strategy === "discount") {
              salesPrice = Math.max(0, Math.round(posPrice * (1 - margin / 100) * 100) / 100);
            }
          }

          const cost = parseFloat(p.inventory_cost || p.cost || "0");
          const profitAmount = salesPrice > cost ? salesPrice - cost : 0;
          const profitMarginPct = salesPrice > 0 ? parseFloat(((profitAmount / salesPrice) * 100).toFixed(2)) : 0;

          const isSharedInBoth = (p.show_in_pos !== false && p.is_available_in_pos !== false) &&
                                 (p.show_in_sales === true || p.is_available_in_sales === true);

          posProductsList.push({
            id: p.id,
            name: p.name,
            code: code,
            sku: code,
            barcode: p.barcode || "",
            category: p.category_name || "منتجات نقطة البيع (POS)",
            categoryId: p.category_id || null,
            productType: "pos_linked",
            unit: p.unit || "قطعة",
            description: `منتج موحد - سعر الكاشير POS: ${posPrice} ج.م | سعر المبيعات: ${salesPrice} ج.م`,
            isActive: p.is_active !== false,
            image: p.image || "",
            masterItemId: p.ingredient_id || null,
            masterItemName: p.master_item_name || null,
            masterItemCode: p.master_item_code || null,
            masterItemUnit: p.unit || "قطعة",
            masterItemBarcode: p.barcode || "",
            inventoryCost: cost,
            lastPurchasePrice: cost,
            totalStock: parseFloat(p.total_stock || "0"),
            availableStock: parseFloat(p.available_stock || "0"),
            warehouseStockDetails: [],
            basePrice: salesPrice,
            wholesalePrice: Math.round(salesPrice * 0.95 * 100) / 100,
            retailPrice: salesPrice,
            specialPrice: Math.round(salesPrice * 0.90 * 100) / 100,
            minPrice: Math.round(salesPrice * 0.85 * 100) / 100,
            allowPriceOverride: true,
            allowBelowMinPrice: false,
            currency: "جنيه مصري",
            taxable: defaultVatRate > 0,
            taxType: "VAT",
            taxRate: defaultVatRate === 0 && parseFloat(p.tax_rate ?? "0") === 14 ? 0 : parseFloat(p.tax_rate ?? String(defaultVatRate)),
            priceIncludesTax: false,
            defaultWarehouseId: p.warehouse_id || 1,
            defaultWarehouse: "المخزن الرئيسي",
            allowMultiWarehouse: true,
            allowNegativeStock: false,
            reorderLevel: parseFloat(p.min_stock || "0"),
            minOrderQty: 1,
            maxOrderQty: 1000,
            trackBatches: false,
            trackSerials: false,
            trackExpiry: false,
            isSellable: true,
            allowDiscount: true,
            maxDiscountPct: 15,
            allowCreditSale: true,
            allowExceedCredit: false,
            profitAmount,
            profitMarginPct,
            isPosLinked: true,
            isSharedInBoth,
            posPrice: posPrice,
            posProductId: p.id,
            createdAt: p.created_at || new Date().toISOString(),
            updatedAt: p.updated_at || new Date().toISOString(),
          });
        }

        if (params?.productType === "pos_linked") {
          products = posProductsList;
        } else {
          products = [...products, ...posProductsList];
        }
      }
    } catch (err: any) {
      console.error("[SalesProductRepository] Merge POS products error:", err.message);
    }

    return { products, total: products.length };
  }

  async getById(id: number): Promise<any | null> {
    await this.initTable();
    const query = `
      SELECT 
        sp.*,
        COALESCE(sp.master_item_id, sp.inventory_item_id) as resolved_master_item_id,
        ing.name as master_item_name,
        COALESCE(NULLIF(ing.code, ''), ing.item_code) as master_item_code,
        ing.unit as master_item_unit,
        ing.barcode as master_item_barcode,
        COALESCE(ing.cost, ing.cost_price, ing.avg_cost, 0) as inventory_cost,
        COALESCE(ing.last_purchase_price, ing.cost, 0) as last_purchase_price,
        (
          SELECT COALESCE(SUM(i.quantity), 0)
          FROM inventory_items i
          WHERE i.ingredient_id = COALESCE(sp.master_item_id, sp.inventory_item_id)
        ) as total_stock,
        (
          SELECT COALESCE(SUM(COALESCE(i.available, i.quantity - COALESCE(i.reserved, 0))), 0)
          FROM inventory_items i
          WHERE i.ingredient_id = COALESCE(sp.master_item_id, sp.inventory_item_id)
        ) as available_stock,
        (
          SELECT json_agg(
            json_build_object(
              'warehouseId', w.id,
              'warehouseName', w.name,
              'quantity', COALESCE(ii.quantity, 0),
              'available', COALESCE(ii.available, ii.quantity - COALESCE(ii.reserved, 0), 0)
            )
          )
          FROM inventory_items ii
          JOIN warehouses w ON ii.warehouse_id = w.id
          WHERE ii.ingredient_id = COALESCE(sp.master_item_id, sp.inventory_item_id)
        ) as warehouse_stock_details
      FROM sales_products sp
      LEFT JOIN ingredients ing ON COALESCE(sp.master_item_id, sp.inventory_item_id) = ing.id
      WHERE sp.id = $1
    `;
    const res = await erpPool.query(query, [id]);
    if (res.rows.length > 0) {
      return this.mapRowToProduct(res.rows[0]);
    }

    // Fallback: Check if product exists in POS `products` table and auto-bridge it
    try {
      const posRes = await erpPool.query("SELECT * FROM products WHERE id = $1", [id]);
      if (posRes.rows.length > 0) {
        const p = posRes.rows[0];
        const price = parseFloat(p.price || 0);
        const code = p.code || `POS-${p.id}`;

        const insertRes = await erpPool.query(
          `INSERT INTO sales_products (
            name, code, barcode, category, unit, base_price, retail_price,
            wholesale_price, special_price, min_price, is_active, master_item_id,
            inventory_item_id, tax_rate, default_warehouse
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT (code) DO UPDATE SET
            name = EXCLUDED.name,
            base_price = EXCLUDED.base_price,
            retail_price = EXCLUDED.retail_price
          RETURNING id`,
          [
            p.name,
            code,
            p.barcode || null,
            p.category_name || "منتجات نقطة البيع (POS)",
            p.unit || "قطعة",
            price,
            price,
            Math.round(price * 0.95 * 100) / 100,
            Math.round(price * 0.90 * 100) / 100,
            Math.round(price * 0.85 * 100) / 100,
            p.is_active !== false,
            p.ingredient_id || null,
            p.ingredient_id || null,
            parseFloat(p.tax_rate ?? "14"),
            "المخزن الرئيسي"
          ]
        );

        const newId = insertRes.rows[0].id;
        const reFetch = await erpPool.query(query, [newId]);
        if (reFetch.rows.length > 0) {
          return this.mapRowToProduct(reFetch.rows[0]);
        }
      }
    } catch (e) {
      console.warn("[SalesProductRepository] getById POS fallback notice:", e);
    }

    return null;
  }

  async getStats(): Promise<{
    totalProducts: number;
    activeProducts: number;
    inactiveProducts: number;
    linkedToInventory: number;
    noPrice: number;
    unlinkedFromInventory: number;
    lowStockCount: number;
    totalLinkedStockValue: number;
  }> {
    await this.initTable();
    const query = `
      SELECT
        COUNT(*) as total_products,
        COUNT(*) FILTER (WHERE sp.is_active = true) as active_products,
        COUNT(*) FILTER (WHERE sp.is_active = false) as inactive_products,
        COUNT(*) FILTER (WHERE sp.master_item_id IS NOT NULL OR sp.inventory_item_id IS NOT NULL) as linked_to_inventory,
        COUNT(*) FILTER (WHERE (sp.base_price = 0 OR sp.base_price IS NULL) AND (sp.retail_price = 0 OR sp.retail_price IS NULL)) as no_price,
        COUNT(*) FILTER (WHERE sp.master_item_id IS NULL AND sp.inventory_item_id IS NULL) as unlinked_from_inventory
      FROM sales_products sp
    `;

    const res = await erpPool.query(query);
    const row = res.rows[0] || {};

    // Calculate low stock and linked stock valuation accurately from joined inventory tables
    const stockStatsQuery = `
      SELECT
        COUNT(DISTINCT sp.id) FILTER (
          WHERE (
            SELECT COALESCE(SUM(i.quantity), 0)
            FROM inventory_items i
            WHERE i.ingredient_id = COALESCE(sp.master_item_id, sp.inventory_item_id)
          ) <= sp.reorder_level
        ) as low_stock_count,
        COALESCE(
          SUM(
            (
              SELECT COALESCE(SUM(i.quantity), 0)
              FROM inventory_items i
              WHERE i.ingredient_id = COALESCE(sp.master_item_id, sp.inventory_item_id)
            ) * COALESCE(ing.cost, ing.cost_price, ing.avg_cost, 0)
          ),
          0
        ) as total_stock_value
      FROM sales_products sp
      LEFT JOIN ingredients ing ON COALESCE(sp.master_item_id, sp.inventory_item_id) = ing.id
      WHERE sp.master_item_id IS NOT NULL OR sp.inventory_item_id IS NOT NULL
    `;

    const stockRes = await erpPool.query(stockStatsQuery);
    const stockRow = stockRes.rows[0] || {};

    return {
      totalProducts: parseInt(row.total_products || "0", 10),
      activeProducts: parseInt(row.active_products || "0", 10),
      inactiveProducts: parseInt(row.inactive_products || "0", 10),
      linkedToInventory: parseInt(row.linked_to_inventory || "0", 10),
      noPrice: parseInt(row.no_price || "0", 10),
      unlinkedFromInventory: parseInt(row.unlinked_from_inventory || "0", 10),
      lowStockCount: parseInt(stockRow.low_stock_count || "0", 10),
      totalLinkedStockValue: parseFloat(stockRow.total_stock_value || "0"),
    };
  }

  async create(dto: CreateSalesProductDTO): Promise<any> {
    await this.initTable();
    const masterItemId = dto.master_item_id !== undefined ? dto.master_item_id : (dto.masterItemId !== undefined ? dto.masterItemId : (dto.inventory_item_id !== undefined ? dto.inventory_item_id : dto.inventoryItemId || null));
    const code = dto.code?.trim() || `SPRD-${Date.now().toString().slice(-6)}`;

    const name = dto.name?.trim() || "منتج جديد";
    const sku = dto.sku?.trim() || code;
    const barcode = dto.barcode?.trim() || null;
    const category = dto.category?.trim() || "منتجات عامة";
    const category_id = dto.category_id !== undefined ? dto.category_id : (dto.categoryId || null);
    const product_type = dto.product_type || dto.productType || "sale";
    const unit = dto.unit || "قطعة";
    const description = dto.description || "";
    const is_active = dto.is_active !== undefined ? dto.is_active : (dto.isActive !== undefined ? dto.isActive : true);
    const image = dto.image || "";
    const base_price = dto.base_price !== undefined ? dto.base_price : (dto.basePrice || 0);
    const wholesale_price = dto.wholesale_price !== undefined ? dto.wholesale_price : (dto.wholesalePrice || 0);
    const retail_price = dto.retail_price !== undefined ? dto.retail_price : (dto.retailPrice || base_price);
    const special_price = dto.special_price !== undefined ? dto.special_price : (dto.specialPrice || 0);
    const min_price = dto.min_price !== undefined ? dto.min_price : (dto.minPrice || 0);
    const allow_price_override = dto.allow_price_override !== undefined ? dto.allow_price_override : (dto.allowPriceOverride || false);
    const allow_below_min_price = dto.allow_below_min_price !== undefined ? dto.allow_below_min_price : (dto.allowBelowMinPrice || false);
    const currency = dto.currency || "جنيه مصري";
    const price_list_id = dto.price_list_id !== undefined ? dto.price_list_id : (dto.priceListId || null);
    const taxable = dto.taxable !== undefined ? dto.taxable : false;
    const tax_type = dto.tax_type || dto.taxType || "VAT";
    const tax_rate = dto.tax_rate !== undefined ? dto.tax_rate : (dto.taxRate !== undefined ? dto.taxRate : 0);
    const price_includes_tax = dto.price_includes_tax !== undefined ? dto.price_includes_tax : (dto.priceIncludesTax || false);
    const default_warehouse_id = dto.default_warehouse_id !== undefined ? dto.default_warehouse_id : (dto.defaultWarehouseId || null);
    const default_warehouse = dto.default_warehouse || dto.defaultWarehouse || "المخزن الرئيسي";
    const allow_multi_warehouse = dto.allow_multi_warehouse !== undefined ? dto.allow_multi_warehouse : (dto.allowMultiWarehouse !== undefined ? dto.allowMultiWarehouse : true);
    const allow_negative_stock = dto.allow_negative_stock !== undefined ? dto.allow_negative_stock : (dto.allowNegativeStock || false);
    const reorder_level = dto.reorder_level !== undefined ? dto.reorder_level : (dto.reorderLevel || 0);
    const min_order_qty = dto.min_order_qty !== undefined ? dto.min_order_qty : (dto.minOrderQty || 1);
    const max_order_qty = dto.max_order_qty !== undefined ? dto.max_order_qty : (dto.maxOrderQty || 1000);
    const track_batches = dto.track_batches !== undefined ? dto.track_batches : (dto.trackBatches || false);
    const track_serials = dto.track_serials !== undefined ? dto.track_serials : (dto.trackSerials || false);
    const track_expiry = dto.track_expiry !== undefined ? dto.track_expiry : (dto.trackExpiry || false);
    const is_sellable = dto.is_sellable !== undefined ? dto.is_sellable : (dto.isSellable !== undefined ? dto.isSellable : true);
    const allow_discount = dto.allow_discount !== undefined ? dto.allow_discount : (dto.allowDiscount !== undefined ? dto.allowDiscount : true);
    const max_discount_pct = dto.max_discount_pct !== undefined ? dto.max_discount_pct : (dto.maxDiscountPct || 15);
    const allow_credit_sale = dto.allow_credit_sale !== undefined ? dto.allow_credit_sale : (dto.allowCreditSale !== undefined ? dto.allowCreditSale : true);
    const allow_exceed_credit = dto.allow_exceed_credit !== undefined ? dto.allow_exceed_credit : (dto.allowExceedCredit || false);

    const query = `
      INSERT INTO sales_products (
        name, code, sku, barcode, category, category_id, product_type, unit, description,
        is_active, image, master_item_id, inventory_item_id, base_price, wholesale_price,
        retail_price, special_price, min_price, allow_price_override, allow_below_min_price,
        currency, price_list_id, taxable, tax_type, tax_rate, price_includes_tax,
        default_warehouse_id, default_warehouse, allow_multi_warehouse, allow_negative_stock,
        reorder_level, min_order_qty, max_order_qty, track_batches, track_serials,
        track_expiry, is_sellable, allow_discount, max_discount_pct, allow_credit_sale,
        allow_exceed_credit, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26,
        $27, $28, $29, $30,
        $31, $32, $33, $34, $35,
        $36, $37, $38, $39, $40,
        $41, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) RETURNING id
    `;

    const values = [
      name, code, sku, barcode, category, category_id, product_type, unit, description,
      is_active, image, masterItemId, masterItemId, base_price, wholesale_price,
      retail_price, special_price, min_price, allow_price_override, allow_below_min_price,
      currency, price_list_id, taxable, tax_type, tax_rate, price_includes_tax,
      default_warehouse_id, default_warehouse, allow_multi_warehouse, allow_negative_stock,
      reorder_level, min_order_qty, max_order_qty, track_batches, track_serials,
      track_expiry, is_sellable, allow_discount, max_discount_pct, allow_credit_sale,
      allow_exceed_credit
    ];

    const res = await erpPool.query(query, values);
    return this.getById(res.rows[0].id);
  }

  async update(id: number | string, dto: UpdateSalesProductDTO): Promise<any> {
    await this.initTable();
    const numericId = typeof id === "number" ? id : parseInt(String(id), 10);
    let existing = await this.getById(numericId);

    if (!existing) {
      // Fallback: If not found by numeric ID, check if there's an existing record with matching code
      if (dto.code) {
        const byCode = await erpPool.query("SELECT id FROM sales_products WHERE code = $1 LIMIT 1", [dto.code]);
        if (byCode.rows.length > 0) {
          existing = await this.getById(byCode.rows[0].id);
        }
      }
    }

    if (!existing) {
      // Create fresh product if updating a POS product not yet bridged
      return this.create({
        name: dto.name || "منتج مبيعات",
        code: dto.code || `SPRD-${Date.now().toString().slice(-6)}`,
        ...dto
      });
    }

    const targetId = existing.id;

    // Normalize both snake_case and camelCase values
    const name = dto.name !== undefined ? dto.name.trim() : existing.name;
    const code = dto.code !== undefined ? dto.code.trim() : existing.code;
    const sku = dto.sku !== undefined ? dto.sku.trim() : existing.sku;
    const barcode = dto.barcode !== undefined ? dto.barcode.trim() : existing.barcode;
    const category = dto.category !== undefined ? dto.category.trim() : existing.category;
    const category_id = dto.category_id !== undefined ? dto.category_id : (dto.categoryId !== undefined ? dto.categoryId : existing.categoryId);
    const product_type = dto.product_type !== undefined ? dto.product_type : (dto.productType !== undefined ? dto.productType : existing.productType);
    const unit = dto.unit !== undefined ? dto.unit : existing.unit;
    const description = dto.description !== undefined ? dto.description : existing.description;
    const is_active = dto.is_active !== undefined ? dto.is_active : (dto.isActive !== undefined ? dto.isActive : existing.isActive);
    const image = dto.image !== undefined ? dto.image : existing.image;

    const masterItemId = dto.master_item_id !== undefined
      ? dto.master_item_id
      : (dto.masterItemId !== undefined
        ? dto.masterItemId
        : (dto.inventory_item_id !== undefined
          ? dto.inventory_item_id
          : (dto.inventoryItemId !== undefined ? dto.inventoryItemId : existing.masterItemId)));

    const base_price = dto.base_price !== undefined ? dto.base_price : (dto.basePrice !== undefined ? dto.basePrice : existing.basePrice);
    const wholesale_price = dto.wholesale_price !== undefined ? dto.wholesale_price : (dto.wholesalePrice !== undefined ? dto.wholesalePrice : existing.wholesalePrice);
    const retail_price = dto.retail_price !== undefined ? dto.retail_price : (dto.retailPrice !== undefined ? dto.retailPrice : existing.retailPrice);
    const special_price = dto.special_price !== undefined ? dto.special_price : (dto.specialPrice !== undefined ? dto.specialPrice : existing.specialPrice);
    const min_price = dto.min_price !== undefined ? dto.min_price : (dto.minPrice !== undefined ? dto.minPrice : existing.minPrice);

    const allow_price_override = dto.allow_price_override !== undefined ? dto.allow_price_override : (dto.allowPriceOverride !== undefined ? dto.allowPriceOverride : existing.allowPriceOverride);
    const allow_below_min_price = dto.allow_below_min_price !== undefined ? dto.allow_below_min_price : (dto.allowBelowMinPrice !== undefined ? dto.allowBelowMinPrice : existing.allowBelowMinPrice);
    const currency = dto.currency !== undefined ? dto.currency : existing.currency;
    const price_list_id = dto.price_list_id !== undefined ? dto.price_list_id : (dto.priceListId !== undefined ? dto.priceListId : existing.priceListId);

    const taxable = dto.taxable !== undefined ? dto.taxable : existing.taxable;
    const tax_type = dto.tax_type !== undefined ? dto.tax_type : (dto.taxType !== undefined ? dto.taxType : existing.taxType);
    const tax_rate = dto.tax_rate !== undefined ? dto.tax_rate : (dto.taxRate !== undefined ? dto.taxRate : existing.taxRate);
    const price_includes_tax = dto.price_includes_tax !== undefined ? dto.price_includes_tax : (dto.priceIncludesTax !== undefined ? dto.priceIncludesTax : existing.priceIncludesTax);

    const default_warehouse_id = dto.default_warehouse_id !== undefined ? dto.default_warehouse_id : (dto.defaultWarehouseId !== undefined ? dto.defaultWarehouseId : existing.defaultWarehouseId);
    const default_warehouse = dto.default_warehouse !== undefined ? dto.default_warehouse : (dto.defaultWarehouse !== undefined ? dto.defaultWarehouse : existing.defaultWarehouse);
    const allow_multi_warehouse = dto.allow_multi_warehouse !== undefined ? dto.allow_multi_warehouse : (dto.allowMultiWarehouse !== undefined ? dto.allowMultiWarehouse : existing.allowMultiWarehouse);
    const allow_negative_stock = dto.allow_negative_stock !== undefined ? dto.allow_negative_stock : (dto.allowNegativeStock !== undefined ? dto.allowNegativeStock : existing.allowNegativeStock);

    const reorder_level = dto.reorder_level !== undefined ? dto.reorder_level : (dto.reorderLevel !== undefined ? dto.reorderLevel : existing.reorderLevel);
    const min_order_qty = dto.min_order_qty !== undefined ? dto.min_order_qty : (dto.minOrderQty !== undefined ? dto.minOrderQty : existing.minOrderQty);
    const max_order_qty = dto.max_order_qty !== undefined ? dto.max_order_qty : (dto.maxOrderQty !== undefined ? dto.maxOrderQty : existing.maxOrderQty);

    const track_batches = dto.track_batches !== undefined ? dto.track_batches : (dto.trackBatches !== undefined ? dto.trackBatches : existing.trackBatches);
    const track_serials = dto.track_serials !== undefined ? dto.track_serials : (dto.trackSerials !== undefined ? dto.trackSerials : existing.trackSerials);
    const track_expiry = dto.track_expiry !== undefined ? dto.track_expiry : (dto.trackExpiry !== undefined ? dto.trackExpiry : existing.trackExpiry);

    const is_sellable = dto.is_sellable !== undefined ? dto.is_sellable : (dto.isSellable !== undefined ? dto.isSellable : existing.isSellable);
    const allow_discount = dto.allow_discount !== undefined ? dto.allow_discount : (dto.allowDiscount !== undefined ? dto.allowDiscount : existing.allowDiscount);
    const max_discount_pct = dto.max_discount_pct !== undefined ? dto.max_discount_pct : (dto.maxDiscountPct !== undefined ? dto.maxDiscountPct : existing.maxDiscountPct);
    const allow_credit_sale = dto.allow_credit_sale !== undefined ? dto.allow_credit_sale : (dto.allowCreditSale !== undefined ? dto.allowCreditSale : existing.allowCreditSale);
    const allow_exceed_credit = dto.allow_exceed_credit !== undefined ? dto.allow_exceed_credit : (dto.allowExceedCredit !== undefined ? dto.allowExceedCredit : existing.allowExceedCredit);

    const query = `
      UPDATE sales_products SET
        name = $1,
        code = $2,
        sku = $3,
        barcode = $4,
        category = $5,
        category_id = $6,
        product_type = $7,
        unit = $8,
        description = $9,
        is_active = $10,
        image = $11,
        master_item_id = $12,
        inventory_item_id = $13,
        base_price = $14,
        wholesale_price = $15,
        retail_price = $16,
        special_price = $17,
        min_price = $18,
        allow_price_override = $19,
        allow_below_min_price = $20,
        currency = $21,
        price_list_id = $22,
        taxable = $23,
        tax_type = $24,
        tax_rate = $25,
        price_includes_tax = $26,
        default_warehouse_id = $27,
        default_warehouse = $28,
        allow_multi_warehouse = $29,
        allow_negative_stock = $30,
        reorder_level = $31,
        min_order_qty = $32,
        max_order_qty = $33,
        track_batches = $34,
        track_serials = $35,
        track_expiry = $36,
        is_sellable = $37,
        allow_discount = $38,
        max_discount_pct = $39,
        allow_credit_sale = $40,
        allow_exceed_credit = $41,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $42
      RETURNING id
    `;

    const values = [
      name, code, sku, barcode, category, category_id, product_type, unit, description,
      is_active, image, masterItemId, masterItemId, base_price, wholesale_price,
      retail_price, special_price, min_price, allow_price_override, allow_below_min_price,
      currency, price_list_id, taxable, tax_type, tax_rate, price_includes_tax,
      default_warehouse_id, default_warehouse, allow_multi_warehouse, allow_negative_stock,
      reorder_level, min_order_qty, max_order_qty, track_batches, track_serials,
      track_expiry, is_sellable, allow_discount, max_discount_pct, allow_credit_sale,
      allow_exceed_credit, targetId
    ];

    await erpPool.query(query, values);

    // Also sync updates to POS `products` table if linked
    try {
      if (code) {
        await erpPool.query(
          `UPDATE products SET
            name = $1,
            price = $2,
            barcode = COALESCE($3, barcode),
            unit = $4,
            tax_rate = $5,
            is_active = $6
          WHERE code = $7 OR id = $8`,
          [name, retail_price || base_price, barcode, unit, tax_rate, is_active, code, numericId]
        );
      }
    } catch (posErr) {
      console.warn("[SalesProductRepository] Sync POS table notice:", posErr);
    }

    return this.getById(targetId);
  }

  async toggleStatus(id: number): Promise<any> {
    await this.initTable();
    const res = await erpPool.query(
      `UPDATE sales_products SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [id]
    );
    if (res.rows.length === 0) throw new Error("المنتج غير موجود");
    return this.getById(id);
  }

  async delete(id: number): Promise<void> {
    await this.initTable();
    await erpPool.query("DELETE FROM sales_products WHERE id = $1", [id]);
  }

  async getMovementHistory(id: number): Promise<any[]> {
    await this.initTable();
    const product = await this.getById(id);
    if (!product) return [];

    const movements: any[] = [];

    // 1. Sales Invoices Items
    try {
      const invRes = await erpPool.query(`
        SELECT 
          i.id as invoice_id,
          i.invoice_no,
          i.date,
          i.customer_name,
          i.status,
          it.qty,
          it.unit_price,
          it.total,
          it.total_cost,
          'فاتورة مبيعات' as movement_type
        FROM sales_invoice_items it
        JOIN sales_invoices i ON it.invoice_id = i.id
        WHERE (it.product_id = $1 OR (it.ingredient_id IS NOT NULL AND it.ingredient_id = $2))
        ORDER BY i.date DESC, i.id DESC
        LIMIT 50
      `, [id, product.master_item_id || -1]);

      for (const r of invRes.rows) {
        movements.push({
          type: "فاتورة مبيعات",
          docNo: r.invoice_no || `INV-${r.invoice_id}`,
          date: r.date,
          party: r.customer_name,
          qty: parseFloat(r.qty || 0),
          price: parseFloat(r.unit_price || 0),
          total: parseFloat(r.total || 0),
          cost: parseFloat(r.total_cost || 0),
          status: r.status,
        });
      }
    } catch (_) {}

    // 2. Sales Orders Items
    try {
      const orderRes = await erpPool.query(`
        SELECT 
          o.id as order_id,
          o.order_no,
          o.date,
          o.customer_name,
          o.status,
          it.qty,
          it.unit_price,
          it.total,
          'أمر بيع' as movement_type
        FROM erp_sales_order_items it
        JOIN erp_sales_orders o ON it.order_id = o.id
        WHERE (it.product_id = $1 OR (it.ingredient_id IS NOT NULL AND it.ingredient_id = $2))
        ORDER BY o.date DESC, o.id DESC
        LIMIT 50
      `, [id, product.master_item_id || -1]);

      for (const r of orderRes.rows) {
        movements.push({
          type: "أمر بيع",
          docNo: r.order_no || `SO-${r.order_id}`,
          date: r.date,
          party: r.customer_name,
          qty: parseFloat(r.qty || 0),
          price: parseFloat(r.unit_price || 0),
          total: parseFloat(r.total || 0),
          cost: 0,
          status: r.status,
        });
      }
    } catch (_) {}

    return movements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  private mapRowToProduct(row: any): any {
    const cost = parseFloat(row.inventory_cost || "0");
    const sellingPrice = parseFloat(row.base_price || row.retail_price || "0");
    const profitAmount = sellingPrice > cost ? sellingPrice - cost : 0;
    const profitMarginPct = sellingPrice > 0 ? ((profitAmount / sellingPrice) * 100).toFixed(2) : "0.00";

    return {
      id: row.id,
      name: row.name,
      code: row.code,
      sku: row.sku || row.code,
      barcode: row.barcode,
      category: row.category || "منتجات عامة",
      categoryId: row.category_id,
      productType: row.product_type || "sale",
      unit: row.unit || "قطعة",
      description: row.description || "",
      isActive: row.is_active,
      image: row.image || "",
      masterItemId: row.resolved_master_item_id,
      masterItemName: row.master_item_name,
      masterItemCode: row.master_item_code,
      masterItemUnit: row.master_item_unit,
      masterItemBarcode: row.master_item_barcode,
      inventoryCost: cost,
      lastPurchasePrice: parseFloat(row.last_purchase_price || "0"),
      totalStock: parseFloat(row.total_stock || "0"),
      availableStock: parseFloat(row.available_stock || "0"),
      warehouseStockDetails: row.warehouse_stock_details || [],
      basePrice: parseFloat(row.base_price || "0"),
      wholesalePrice: parseFloat(row.wholesale_price || "0"),
      retailPrice: parseFloat(row.retail_price || "0"),
      specialPrice: parseFloat(row.special_price || "0"),
      minPrice: parseFloat(row.min_price || "0"),
      allowPriceOverride: row.allow_price_override,
      allowBelowMinPrice: row.allow_below_min_price,
      currency: row.currency || "جنيه مصري",
      priceListId: row.price_list_id,
      taxable: row.taxable !== false && parseFloat(row.tax_rate ?? "0") > 0,
      taxType: row.tax_type || "VAT",
      taxRate: row.taxable === false ? 0 : parseFloat(row.tax_rate ?? "0"),
      priceIncludesTax: row.price_includes_tax,
      defaultWarehouseId: row.default_warehouse_id,
      defaultWarehouse: row.default_warehouse || "المخزن الرئيسي",
      allowMultiWarehouse: row.allow_multi_warehouse,
      allowNegativeStock: row.allow_negative_stock,
      reorderLevel: parseFloat(row.reorder_level || "0"),
      minOrderQty: parseFloat(row.min_order_qty || "1"),
      maxOrderQty: parseFloat(row.max_order_qty || "1000"),
      trackBatches: row.track_batches,
      trackSerials: row.track_serials,
      trackExpiry: row.track_expiry,
      isSellable: row.is_sellable,
      allowDiscount: row.allow_discount,
      maxDiscountPct: parseFloat(row.max_discount_pct || "15"),
      allowCreditSale: row.allow_credit_sale,
      allowExceedCredit: row.allow_exceed_credit,
      profitAmount,
      profitMarginPct: parseFloat(profitMarginPct),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
