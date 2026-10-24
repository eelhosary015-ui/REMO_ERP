import { erpPool } from "../../../server-erp-core.js";

export interface ItemPriceDTO {
  id?: number;
  ingredientId?: number | null;
  productId?: number | null;
  itemCode: string;
  itemName: string;
  category?: string;
  unit?: string;
  priceListId?: number;
  priceListName?: string;
  sellingPrice: number;
  minSellingPrice?: number;
  maxDiscountPct?: number;
  isActive?: boolean;
  effectiveDate?: string;
  expiryDate?: string | null;
  notes?: string;
  userName?: string;
  changeReason?: string;
}

export class SalesPricingService {
  private static tablesInitialized = false;

  public static async ensureTablesExist(): Promise<void> {
    if (this.tablesInitialized) return;

    await erpPool.query(`
      CREATE TABLE IF NOT EXISTS sales_price_lists (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        code VARCHAR(50),
        type VARCHAR(50) DEFAULT 'جملة',
        discount_percent DECIMAL(5,2) DEFAULT 0,
        is_default BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sales_item_prices (
        id SERIAL PRIMARY KEY,
        ingredient_id INTEGER,
        product_id INTEGER,
        item_code VARCHAR(100) NOT NULL,
        item_name VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        unit VARCHAR(50) DEFAULT 'قطعة',
        price_list_id INTEGER DEFAULT 1 REFERENCES sales_price_lists(id) ON DELETE SET NULL,
        price_list_name VARCHAR(100) DEFAULT 'سعر البيع الأساسي',
        selling_price DECIMAL(12,2) NOT NULL DEFAULT 0,
        min_selling_price DECIMAL(12,2) DEFAULT 0,
        max_discount_pct DECIMAL(5,2) DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        effective_date DATE DEFAULT CURRENT_DATE,
        expiry_date DATE,
        notes TEXT,
        created_by VARCHAR(100) DEFAULT 'system',
        updated_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_item_code_pricelist UNIQUE (item_code, price_list_id)
      );

      CREATE TABLE IF NOT EXISTS sales_price_history (
        id SERIAL PRIMARY KEY,
        price_id INTEGER,
        ingredient_id INTEGER,
        product_id INTEGER,
        item_code VARCHAR(100) NOT NULL,
        item_name VARCHAR(255) NOT NULL,
        price_list_id INTEGER DEFAULT 1,
        price_list_name VARCHAR(100) DEFAULT 'سعر البيع الأساسي',
        old_price DECIMAL(12,2) NOT NULL DEFAULT 0,
        new_price DECIMAL(12,2) NOT NULL DEFAULT 0,
        cost_price DECIMAL(12,2) DEFAULT 0,
        margin_amount DECIMAL(12,2) DEFAULT 0,
        margin_pct DECIMAL(7,2) DEFAULT 0,
        change_reason TEXT,
        user_name VARCHAR(100) DEFAULT 'المستخدم',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sales_general_settings (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT NOT NULL,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure default price lists exist
    const plRes = await erpPool.query("SELECT COUNT(*) as cnt FROM sales_price_lists");
    if (parseInt(plRes.rows[0].cnt) === 0) {
      await erpPool.query(`
        INSERT INTO sales_price_lists (name, code, type, discount_percent, is_default, is_active, notes)
        VALUES 
          ('سعر البيع الأساسي (Standard Retail)', 'RETAIL', 'قطاعي', 0, true, true, 'قائمة التسعير القياسية المعتمدة لكافة مبيعات العملاء والقطاعي'),
          ('سعر الجملة (Wholesale)', 'WHOLESALE', 'جملة', 10, false, true, 'قائمة تسعير خاصة بكبار التجار ومشتريات الجملة'),
          ('سعر الشركات والمؤسسات (Corporate)', 'CORP', 'شركات', 15, false, true, 'أسعار تعاقدات الشركات والمناقصات والتوريدات الدورية'),
          ('سعر VIP الخاص (VIP Clients)', 'VIP', 'خاص', 20, false, true, 'تسعير مخصص لعملاء الفئة الأولى VIP');
      `);
    }

    // Ensure default sales general settings exist
    const setRes = await erpPool.query("SELECT COUNT(*) as cnt FROM sales_general_settings");
    if (parseInt(setRes.rows[0].cnt) === 0) {
      await erpPool.query(`
        INSERT INTO sales_general_settings (setting_key, setting_value, description)
        VALUES 
          ('default_vat_rate', '14', 'نسبة ضريبة القيمة المضافة الافتراضية (%)'),
          ('allow_price_override_in_orders', 'true', 'السماح لمندوبي المبيعات بتعديل سعر البيع في أمر البيع حسب الصلاحية'),
          ('enforce_min_selling_price', 'true', 'منع إصدار أوامر بيع بسعر أقل من الحد الأدنى للبيع المعتمد'),
          ('warn_zero_margin', 'true', 'تنبيه المستخدم عند بيع صنف بهامش ربح صفري أو سالب'),
          ('default_price_list_id', '1', 'معرف قائمة الأسعار الافتراضية');
      `);
    }

    this.tablesInitialized = true;
  }

  /**
   * Fetches all inventory items (from ingredients + products) merged with their sales pricing rules
   */
  public static async getAllPricingItems(filters: {
    search?: string;
    category?: string;
    unit?: string;
    priceListId?: number;
    status?: "all" | "active" | "inactive" | "unpriced";
  } = {}): Promise<any[]> {
    await this.ensureTablesExist();

    const priceListId = filters.priceListId || 1;

    // 0. Fetch all sales_products (dedicated sales products - single source of truth for sales)
    let spRows: any[] = [];
    try {
      const spQuery = `
        SELECT 
          COALESCE(sp.master_item_id, sp.inventory_item_id) as raw_ingredient_id,
          sp.id as raw_product_id,
          sp.code as item_code,
          sp.name as item_name,
          COALESCE(sp.category, 'منتجات مبيعات') as category,
          COALESCE(sp.unit, 'قطعة') as unit,
          COALESCE(ing.cost, ing.cost_price, ing.avg_cost, 0)::numeric as cost_price,
          COALESCE(
            CASE 
              WHEN $1 = 2 THEN NULLIF(sp.wholesale_price, 0)
              WHEN $1 = 3 THEN NULLIF(sp.special_price, 0)
              WHEN $1 = 4 THEN NULLIF(sp.special_price, 0)
              ELSE NULLIF(sp.retail_price, 0)
            END,
            sp.base_price, 0
          )::numeric as fallback_selling_price,
          sp.min_price::numeric as fallback_min_price,
          sp.max_discount_pct::numeric as fallback_max_discount,
          COALESCE((SELECT SUM(i.quantity) FROM inventory_items i WHERE i.ingredient_id = COALESCE(sp.master_item_id, sp.inventory_item_id)), 0)::numeric as total_stock,
          COALESCE((SELECT SUM(COALESCE(i.available, i.quantity - COALESCE(i.reserved,0))) FROM inventory_items i WHERE i.ingredient_id = COALESCE(sp.master_item_id, sp.inventory_item_id)), 0)::numeric as available_stock,
          'sales_product' as item_type,
          'sales_products' as source_table
        FROM sales_products sp
        LEFT JOIN ingredients ing ON ing.id = COALESCE(sp.master_item_id, sp.inventory_item_id)
        WHERE sp.is_active = true
        ORDER BY sp.id DESC
      `;
      const spRes = await erpPool.query(spQuery, [priceListId]);
      spRows = spRes.rows;
    } catch (_) {}

    // 1. Fetch all ingredients (warehouse items)
    const ingQuery = `
      SELECT 
        ing.id as raw_ingredient_id,
        NULL::int as raw_product_id,
        COALESCE(NULLIF(ing.code, ''), ing.item_code, ('ING-' || ing.id)) as item_code,
        ing.name as item_name,
        COALESCE(ing.item_group, ing.category, 'خامات ومخزون') as category,
        COALESCE(ing.unit, 'قطعة') as unit,
        COALESCE(ing.avg_cost, ing.cost_price, ing.last_purchase_price, ing.cost, 0)::numeric as cost_price,
        COALESCE(ing.selling_price, 0)::numeric as fallback_selling_price,
        COALESCE((SELECT SUM(i.quantity) FROM inventory_items i WHERE i.ingredient_id = ing.id), ing.current_stock, 0)::numeric as total_stock,
        COALESCE((SELECT SUM(i.available) FROM inventory_items i WHERE i.ingredient_id = ing.id), 
                 (SELECT SUM(i.quantity - COALESCE(i.reserved,0)) FROM inventory_items i WHERE i.ingredient_id = ing.id), 
                 ing.current_stock, 0)::numeric as available_stock,
        'inventory_item' as item_type,
        'ingredients' as source_table
      FROM ingredients ing
      ORDER BY ing.id ASC
    `;
    const ingRes = await erpPool.query(ingQuery);

    // 2. Fetch all products (finished goods)
    const prodQuery = `
      SELECT 
        p.ingredient_id as raw_ingredient_id,
        p.id as raw_product_id,
        COALESCE(NULLIF(p.code, ''), ('PRD-' || p.id)) as item_code,
        p.name as item_name,
        COALESCE(p.category, 'منتجات تامة') as category,
        COALESCE(p.unit, 'قطعة') as unit,
        COALESCE(p.cost, p.cost_price, 0)::numeric as cost_price,
        COALESCE(p.price, 0)::numeric as fallback_selling_price,
        COALESCE(p.stock, 0)::numeric as total_stock,
        COALESCE(p.stock, 0)::numeric as available_stock,
        'product' as item_type,
        'products' as source_table
      FROM products p
      ORDER BY p.id ASC
    `;
    const prodRes = await erpPool.query(prodQuery);

    // 3. Fetch all custom configured sales item prices for the active price list
    const pricesQuery = `
      SELECT * FROM sales_item_prices
      WHERE price_list_id = $1
    `;
    const pricesRes = await erpPool.query(pricesQuery, [priceListId]);
    const priceMap = new Map<string, any>();
    for (const row of pricesRes.rows) {
      priceMap.set(String(row.item_code).trim().toLowerCase(), row);
    }

    // Combine items without duplicate item_codes
    const combinedMap = new Map<string, any>();

    const processItem = (item: any) => {
      const codeKey = String(item.item_code).trim().toLowerCase();
      if (!codeKey) return;

      const configuredPrice = priceMap.get(codeKey);
      const cost = parseFloat(item.cost_price || 0);

      let sellingPrice = 0;
      let hasCustomPrice = false;
      let isActive = true;
      let minSellingPrice = 0;
      let maxDiscountPct = 0;
      let effectiveDate = new Date().toISOString().split("T")[0];
      let lastUpdated = null;
      let priceId = null;
      let notes = "";

      if (configuredPrice) {
        hasCustomPrice = true;
        priceId = configuredPrice.id;
        sellingPrice = parseFloat(configuredPrice.selling_price || 0);
        isActive = Boolean(configuredPrice.is_active);
        minSellingPrice = parseFloat(configuredPrice.min_selling_price || 0);
        maxDiscountPct = parseFloat(configuredPrice.max_discount_pct || 0);
        effectiveDate = configuredPrice.effective_date ? new Date(configuredPrice.effective_date).toISOString().split("T")[0] : effectiveDate;
        lastUpdated = configuredPrice.updated_at || configuredPrice.created_at;
        notes = configuredPrice.notes || "";
      } else {
        sellingPrice = parseFloat(item.fallback_selling_price || 0);
        // If selling price is not set, default it to cost or 0
        if (sellingPrice <= 0 && cost > 0) {
          sellingPrice = Math.round(cost * 1.3); // default 30% margin preview
        }
      }

      const marginAmount = sellingPrice - cost;
      const marginPct = cost > 0 ? ((marginAmount / cost) * 100) : (sellingPrice > 0 ? 100 : 0);

      const unifiedRow = {
        key: `${item.source_table}_${item.raw_product_id || item.raw_ingredient_id}`,
        priceId,
        ingredientId: item.raw_ingredient_id || null,
        productId: item.raw_product_id || null,
        itemCode: item.item_code,
        itemName: item.item_name,
        category: item.category,
        unit: item.unit,
        itemType: item.item_type,
        sourceTable: item.source_table,
        costPrice: cost,
        sellingPrice: sellingPrice,
        marginAmount: Math.round(marginAmount * 100) / 100,
        marginPct: Math.round(marginPct * 10) / 10,
        hasCustomPrice,
        isActive,
        priceListId,
        minSellingPrice,
        maxDiscountPct,
        effectiveDate,
        lastUpdated,
        notes,
        totalStock: parseFloat(item.total_stock || 0),
        availableStock: parseFloat(item.available_stock || 0),
        stockStatus: parseFloat(item.available_stock || 0) > 0 ? "متوفر" : "نفذ الرصيد"
      };

      combinedMap.set(codeKey, unifiedRow);
    };

    // First process sales_products (highest priority in sales module)
    for (const it of spRows) processItem(it);
    // Then ingredients and products
    for (const it of ingRes.rows) {
      const codeKey = String(it.item_code).trim().toLowerCase();
      if (!combinedMap.has(codeKey)) {
        processItem(it);
      }
    }
    for (const it of prodRes.rows) {
      const codeKey = String(it.item_code).trim().toLowerCase();
      if (!combinedMap.has(codeKey)) {
        processItem(it);
      }
    }

    let list = Array.from(combinedMap.values());

    // Apply Filters
    if (filters.search) {
      const s = filters.search.trim().toLowerCase();
      list = list.filter(it => 
        it.itemName.toLowerCase().includes(s) ||
        it.itemCode.toLowerCase().includes(s) ||
        it.category.toLowerCase().includes(s) ||
        it.unit.toLowerCase().includes(s)
      );
    }

    if (filters.category && filters.category !== "all") {
      list = list.filter(it => it.category === filters.category);
    }

    if (filters.unit && filters.unit !== "all") {
      list = list.filter(it => it.unit === filters.unit);
    }

    if (filters.status) {
      if (filters.status === "active") {
        list = list.filter(it => it.hasCustomPrice && it.isActive);
      } else if (filters.status === "inactive") {
        list = list.filter(it => it.hasCustomPrice && !it.isActive);
      } else if (filters.status === "unpriced") {
        list = list.filter(it => !it.hasCustomPrice || it.sellingPrice <= 0);
      }
    }

    return list;
  }

  /**
   * Save or update a selling price with audit trail
   */
  public static async saveItemPrice(dto: ItemPriceDTO): Promise<any> {
    await this.ensureTablesExist();

    const priceListId = dto.priceListId || 1;
    const priceListName = dto.priceListName || "سعر البيع الأساسي";
    const itemCode = dto.itemCode.trim();
    const itemName = dto.itemName.trim();
    const sellingPrice = Number(dto.sellingPrice) || 0;
    const minSellingPrice = Number(dto.minSellingPrice) || 0;
    const maxDiscountPct = Number(dto.maxDiscountPct) || 0;
    const isActive = dto.isActive !== undefined ? Boolean(dto.isActive) : true;
    const effectiveDate = dto.effectiveDate || new Date().toISOString().split("T")[0];
    const notes = dto.notes || "";
    const userName = dto.userName || "مدير المبيعات";
    const changeReason = dto.changeReason || "تحديث تسعير الصنف";

    // 1. Get current cost price from inventory/product
    let currentCost = 0;
    try {
      if (dto.ingredientId) {
        const costRes = await erpPool.query(
          "SELECT avg_cost, cost_price, last_purchase_price, cost FROM ingredients WHERE id = $1 LIMIT 1",
          [dto.ingredientId]
        );
        if (costRes.rows.length > 0) {
          const r = costRes.rows[0];
          currentCost = parseFloat(r.avg_cost || r.cost_price || r.last_purchase_price || r.cost || 0);
        }
      } else if (dto.productId) {
        const costRes = await erpPool.query(
          "SELECT cost, cost_price FROM products WHERE id = $1 LIMIT 1",
          [dto.productId]
        );
        if (costRes.rows.length > 0) {
          currentCost = parseFloat(costRes.rows[0].cost || costRes.rows[0].cost_price || 0);
        }
      } else {
        const costRes = await erpPool.query(
          "SELECT avg_cost, cost_price FROM ingredients WHERE (code = $1 AND code != '') OR name ILIKE $2 LIMIT 1",
          [itemCode, itemName]
        );
        if (costRes.rows.length > 0) {
          currentCost = parseFloat(costRes.rows[0].avg_cost || costRes.rows[0].cost_price || 0);
        }
      }
    } catch (_) {}

    // 2. Check existing price
    const existingRes = await erpPool.query(
      "SELECT * FROM sales_item_prices WHERE item_code = $1 AND price_list_id = $2 LIMIT 1",
      [itemCode, priceListId]
    );

    let oldPrice = 0;
    let savedPriceRecord: any;

    if (existingRes.rows.length > 0) {
      const existing = existingRes.rows[0];
      oldPrice = parseFloat(existing.selling_price || 0);

      const updateRes = await erpPool.query(`
        UPDATE sales_item_prices
        SET item_name = $1,
            category = COALESCE($2, category),
            unit = COALESCE($3, unit),
            price_list_name = $4,
            selling_price = $5,
            min_selling_price = $6,
            max_discount_pct = $7,
            is_active = $8,
            effective_date = $9,
            notes = $10,
            updated_by = $11,
            ingredient_id = COALESCE($12, ingredient_id),
            product_id = COALESCE($13, product_id),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $14
        RETURNING *
      `, [
        itemName,
        dto.category || null,
        dto.unit || 'قطعة',
        priceListName,
        sellingPrice,
        minSellingPrice,
        maxDiscountPct,
        isActive,
        effectiveDate,
        notes,
        userName,
        dto.ingredientId || null,
        dto.productId || null,
        existing.id
      ]);
      savedPriceRecord = updateRes.rows[0];
    } else {
      const insertRes = await erpPool.query(`
        INSERT INTO sales_item_prices (
          ingredient_id, product_id, item_code, item_name, category, unit,
          price_list_id, price_list_name, selling_price, min_selling_price,
          max_discount_pct, is_active, effective_date, notes, created_by, updated_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $15
        )
        RETURNING *
      `, [
        dto.ingredientId || null,
        dto.productId || null,
        itemCode,
        itemName,
        dto.category || 'عام',
        dto.unit || 'قطعة',
        priceListId,
        priceListName,
        sellingPrice,
        minSellingPrice,
        maxDiscountPct,
        isActive,
        effectiveDate,
        notes,
        userName
      ]);
      savedPriceRecord = insertRes.rows[0];
    }

    // 3. Log to price history audit log
    const marginAmount = sellingPrice - currentCost;
    const marginPct = currentCost > 0 ? ((marginAmount / currentCost) * 100) : 100;

    await erpPool.query(`
      INSERT INTO sales_price_history (
        price_id, ingredient_id, product_id, item_code, item_name,
        price_list_id, price_list_name, old_price, new_price,
        cost_price, margin_amount, margin_pct, change_reason, user_name
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13, $14
      )
    `, [
      savedPriceRecord.id,
      dto.ingredientId || null,
      dto.productId || null,
      itemCode,
      itemName,
      priceListId,
      priceListName,
      oldPrice,
      sellingPrice,
      currentCost,
      marginAmount,
      marginPct,
      changeReason,
      userName
    ]);

    // Also update standard selling_price on ingredients table so standard reports have sync
    try {
      if (priceListId === 1 && sellingPrice > 0) {
        await erpPool.query(`
          UPDATE ingredients SET selling_price = $1 WHERE (code = $2 AND code != '') OR name ILIKE $3
        `, [sellingPrice, itemCode, itemName]);
      }
    } catch (_) {}

    return savedPriceRecord;
  }

  /**
   * Toggle item price activation status
   */
  public static async togglePriceStatus(priceId: number, isActive: boolean, userName: string = "المستخدم"): Promise<any> {
    await this.ensureTablesExist();

    const res = await erpPool.query(`
      UPDATE sales_item_prices
      SET is_active = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `, [isActive, userName, priceId]);

    if (res.rows.length === 0) {
      throw new Error("سجل السعر غير موجود");
    }

    const row = res.rows[0];
    await erpPool.query(`
      INSERT INTO sales_price_history (
        price_id, ingredient_id, product_id, item_code, item_name,
        price_list_id, price_list_name, old_price, new_price,
        change_reason, user_name
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $8,
        $9, $10
      )
    `, [
      row.id,
      row.ingredient_id,
      row.product_id,
      row.item_code,
      row.item_name,
      row.price_list_id,
      row.price_list_name,
      row.selling_price,
      isActive ? "تفعيل سعر البيع" : "تعطيل وتجميد سعر البيع",
      userName
    ]);

    return row;
  }

  /**
   * Get price history audit logs
   */
  public static async getPriceHistory(filters: { itemCode?: string; priceListId?: number; limit?: number } = {}): Promise<any[]> {
    await this.ensureTablesExist();
    let query = `
      SELECT h.*, 
             to_char(h.created_at, 'YYYY-MM-DD HH24:MI') as formatted_date
      FROM sales_price_history h
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.itemCode) {
      params.push(filters.itemCode.trim());
      query += ` AND h.item_code = $${params.length}`;
    }

    if (filters.priceListId) {
      params.push(filters.priceListId);
      query += ` AND h.price_list_id = $${params.length}`;
    }

    query += ` ORDER BY h.created_at DESC LIMIT $${params.length + 1}`;
    params.push(filters.limit || 100);

    const res = await erpPool.query(query, params);
    return res.rows;
  }

  /**
   * Get all Price Lists
   */
  public static async getPriceLists(): Promise<any[]> {
    await this.ensureTablesExist();
    const res = await erpPool.query(`
      SELECT pl.*, 
             (SELECT COUNT(*) FROM sales_item_prices p WHERE p.price_list_id = pl.id) as total_items_count
      FROM sales_price_lists pl
      ORDER BY pl.id ASC
    `);
    return res.rows;
  }

  /**
   * Create or update price list
   */
  public static async savePriceList(data: { id?: number; name: string; code?: string; type?: string; discount_percent?: number; is_default?: boolean; notes?: string }): Promise<any> {
    await this.ensureTablesExist();
    if (data.is_default) {
      await erpPool.query("UPDATE sales_price_lists SET is_default = false");
    }

    if (data.id) {
      const res = await erpPool.query(`
        UPDATE sales_price_lists
        SET name = $1, code = $2, type = $3, discount_percent = $4, is_default = $5, notes = $6
        WHERE id = $7
        RETURNING *
      `, [data.name, data.code || 'CUSTOM', data.type || 'خاص', data.discount_percent || 0, !!data.is_default, data.notes || '', data.id]);
      return res.rows[0];
    } else {
      const res = await erpPool.query(`
        INSERT INTO sales_price_lists (name, code, type, discount_percent, is_default, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [data.name, data.code || `PL-${Date.now().toString().slice(-4)}`, data.type || 'خاص', data.discount_percent || 0, !!data.is_default, data.notes || '']);
      return res.rows[0];
    }
  }

  /**
   * Get General Sales Settings
   */
  public static async getGeneralSettings(): Promise<Record<string, string>> {
    await this.ensureTablesExist();
    const res = await erpPool.query("SELECT setting_key, setting_value FROM sales_general_settings");
    const settings: Record<string, string> = {};
    for (const row of res.rows) {
      settings[row.setting_key] = row.setting_value;
    }
    return settings;
  }

  /**
   * Save General Sales Settings
   */
  public static async saveGeneralSettings(settings: Record<string, string>): Promise<void> {
    await this.ensureTablesExist();
    for (const [key, value] of Object.entries(settings)) {
      await erpPool.query(`
        INSERT INTO sales_general_settings (setting_key, setting_value, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2, updated_at = CURRENT_TIMESTAMP
      `, [key, String(value)]);
    }
  }

  /**
   * Synchronize pricing rules from a Sales Product into sales_item_prices and all price lists
   */
  public static async syncFromSalesProduct(sp: any, userName: string = "مدير المبيعات"): Promise<void> {
    await this.ensureTablesExist();
    if (!sp || !sp.code) return;

    const itemCode = String(sp.code).trim();
    const itemName = String(sp.name || itemCode).trim();
    const category = sp.category || "منتجات مبيعات";
    const unit = sp.unit || "قطعة";
    const ingredientId = sp.master_item_id || sp.inventory_item_id || null;
    const productId = sp.id || null;
    const isActive = sp.is_active !== undefined ? Boolean(sp.is_active) : true;
    const basePrice = parseFloat(sp.base_price || sp.retail_price || 0);
    const minPrice = parseFloat(sp.min_price || 0);
    const maxDiscount = parseFloat(sp.max_discount_pct || 15);

    // 1. Get all active price lists
    const plRes = await erpPool.query("SELECT * FROM sales_price_lists WHERE is_active = true ORDER BY id ASC");
    const priceLists = plRes.rows;

    for (const pl of priceLists) {
      let targetPrice = basePrice;
      const plType = String(pl.type || "").trim();
      const plCode = String(pl.code || "").trim().toUpperCase();

      if (plType === "جملة" || plCode === "WHOLESALE") {
        targetPrice = parseFloat(sp.wholesale_price || 0) > 0 ? parseFloat(sp.wholesale_price) : (basePrice > 0 ? basePrice * (1 - (pl.discount_percent || 10) / 100) : 0);
      } else if (plType === "قطاعي" || plCode === "RETAIL" || pl.is_default) {
        targetPrice = parseFloat(sp.retail_price || 0) > 0 ? parseFloat(sp.retail_price) : basePrice;
      } else if (plType === "خاص" || plCode === "VIP" || plType === "شركات" || plCode === "CORP") {
        targetPrice = parseFloat(sp.special_price || 0) > 0 ? parseFloat(sp.special_price) : (basePrice > 0 ? basePrice * (1 - (pl.discount_percent || 15) / 100) : 0);
      } else if (pl.discount_percent && Number(pl.discount_percent) > 0) {
        targetPrice = basePrice > 0 ? basePrice * (1 - Number(pl.discount_percent) / 100) : basePrice;
      }

      await this.saveItemPrice({
        itemCode,
        itemName,
        category,
        unit,
        ingredientId,
        productId,
        priceListId: pl.id,
        priceListName: pl.name,
        sellingPrice: Math.round(targetPrice * 100) / 100,
        minSellingPrice: minPrice,
        maxDiscountPct: maxDiscount,
        isActive,
        userName,
        changeReason: "تسميع تلقائي من إعدادات منتج المبيعات",
      });
    }
  }

  /**
   * Toggle status for a sales product in item prices
   */
  public static async toggleSalesProductStatus(itemCode: string, isActive: boolean): Promise<void> {
    await this.ensureTablesExist();
    if (!itemCode) return;
    await erpPool.query(
      "UPDATE sales_item_prices SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE item_code = $2",
      [isActive, itemCode]
    );
  }

  /**
   * Delete prices for a sales product
   */
  public static async deleteSalesProductPrices(itemCode: string): Promise<void> {
    await this.ensureTablesExist();
    if (!itemCode) return;
    await erpPool.query("DELETE FROM sales_item_prices WHERE item_code = $1", [itemCode]);
  }
}
