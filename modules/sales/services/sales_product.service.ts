import { SalesProductRepository } from "../repositories/sales_product.repository.js";
import { CreateSalesProductDTO, UpdateSalesProductDTO } from "../dto/sales_product.dto.js";
import { ERPCache, ERPEventBus, erpPool } from "../../../server-erp-core.js";
import { SalesAuditService } from "./audit.service.js";
import { SalesPricingService } from "./pricing.service.js";

const CACHE_KEY_PRODUCTS_PREFIX = "sales:products";

export class SalesProductService {
  private repository: SalesProductRepository;

  constructor() {
    this.repository = new SalesProductRepository();
  }

  async getProducts(params?: {
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
    return this.repository.getAll(params);
  }

  async getProductById(id: number): Promise<any> {
    const product = await this.repository.getById(id);
    if (!product) {
      const err: any = new Error(`المنتج رقم ${id} غير موجود`);
      err.statusCode = 404;
      throw err;
    }
    return product;
  }

  async getStats(): Promise<any> {
    return this.repository.getStats();
  }

  async createProduct(dto: CreateSalesProductDTO, user?: any): Promise<any> {
    if (!dto.name || !dto.name.trim()) {
      const err: any = new Error("اسم منتج المبيعات مطلوب");
      err.statusCode = 400;
      throw err;
    }

    // Auto-generate code if empty
    if (!dto.code || !dto.code.trim()) {
      dto.code = `SPRD-${Date.now().toString().slice(-6)}`;
    }

    // Ensure master_item_id exists if provided
    if (dto.master_item_id) {
      const checkRes = await erpPool.query("SELECT id, name FROM ingredients WHERE id = $1", [dto.master_item_id]);
      if (checkRes.rows.length === 0) {
        dto.master_item_id = null;
        dto.inventory_item_id = null;
      }
    }

    const created = await this.repository.create(dto);
    ERPCache.clear();

    // Propagate pricing rules and auto-sync with sales price lists
    try {
      await SalesPricingService.syncFromSalesProduct(created, user?.username || user?.name || "المبيعات");
    } catch (e: any) {
      console.warn("[SalesProductService] Pricing sync warning:", e.message);
    }

    ERPEventBus.getInstance().emitEvent("SalesProductCreated", {
      productId: created.id,
      name: created.name,
      code: created.code,
      masterItemId: created.masterItemId,
      basePrice: created.basePrice,
      timestamp: new Date(),
    });

    await SalesAuditService.log({
      entityType: "sales_product",
      entityId: created.id,
      entityNumber: created.code,
      action: "إضافة منتج مبيعات جديد",
      userName: user?.username || user?.name || "المبيعات",
      details: {
        name: created.name,
        code: created.code,
        category: created.category,
        basePrice: created.basePrice,
        masterItemId: created.masterItemId,
        masterItemName: created.masterItemName,
      },
    });

    return created;
  }

  async updateProduct(id: number, dto: UpdateSalesProductDTO, user?: any): Promise<any> {
    const existing = await this.repository.getById(id);
    if (!existing) {
      const err: any = new Error(`منتج المبيعات رقم ${id} غير موجود`);
      err.statusCode = 404;
      throw err;
    }

    const updated = await this.repository.update(id, dto);
    ERPCache.clear();

    // Propagate pricing changes and auto-sync with sales price lists
    try {
      await SalesPricingService.syncFromSalesProduct(updated, user?.username || user?.name || "المبيعات");
    } catch (e: any) {
      console.warn("[SalesProductService] Pricing sync warning on update:", e.message);
    }

    ERPEventBus.getInstance().emitEvent("SalesProductUpdated", {
      productId: id,
      name: updated.name,
      code: updated.code,
      timestamp: new Date(),
    });

    await SalesAuditService.log({
      entityType: "sales_product",
      entityId: id,
      entityNumber: updated.code,
      action: "تعديل منتج مبيعات",
      userName: user?.username || user?.name || "المبيعات",
      details: {
        name: updated.name,
        code: updated.code,
        basePrice: updated.basePrice,
        masterItemId: updated.masterItemId,
      },
    });

    return updated;
  }

  async toggleProductStatus(id: number, user?: any): Promise<any> {
    const toggled = await this.repository.toggleStatus(id);
    ERPCache.clear();

    try {
      await SalesPricingService.toggleSalesProductStatus(toggled.code, toggled.isActive);
    } catch (e: any) {
      console.warn("[SalesProductService] Pricing status toggle warning:", e.message);
    }

    await SalesAuditService.log({
      entityType: "sales_product",
      entityId: id,
      entityNumber: toggled.code,
      action: toggled.isActive ? "تفعيل منتج المبيعات" : "تعطيل منتج المبيعات",
      userName: user?.username || user?.name || "المبيعات",
      details: {
        name: toggled.name,
        isActive: toggled.isActive,
      },
    });

    return toggled;
  }

  async deleteProduct(id: number, user?: any): Promise<void> {
    const existing = await this.repository.getById(id);
    if (!existing) {
      const err: any = new Error(`منتج المبيعات رقم ${id} غير موجود`);
      err.statusCode = 404;
      throw err;
    }

    await this.repository.delete(id);
    ERPCache.clear();

    try {
      await SalesPricingService.deleteSalesProductPrices(existing.code);
    } catch (e: any) {
      console.warn("[SalesProductService] Pricing delete warning:", e.message);
    }

    ERPEventBus.getInstance().emitEvent("SalesProductDeleted", {
      productId: id,
      name: existing.name,
      timestamp: new Date(),
    });

    await SalesAuditService.log({
      entityType: "sales_product",
      entityId: id,
      entityNumber: existing.code,
      action: "حذف منتج مبيعات",
      userName: user?.username || user?.name || "المبيعات",
      details: {
        name: existing.name,
        code: existing.code,
      },
    });
  }

  async getProductMovement(id: number): Promise<any[]> {
    return this.repository.getMovementHistory(id);
  }

  async getMasterInventoryItems(search?: string, warehouseId?: number): Promise<any[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push(`(
        ing.name ILIKE $${idx} OR
        ing.code ILIKE $${idx} OR
        ing.item_code ILIKE $${idx} OR
        ing.barcode ILIKE $${idx} OR
        ing.item_group ILIKE $${idx}
      )`);
      values.push(q);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
      SELECT 
        ing.id,
        ing.name,
        COALESCE(NULLIF(ing.code, ''), ing.item_code, CONCAT('ITEM-', ing.id)) as code,
        ing.unit,
        ing.barcode,
        ing.item_group as category,
        COALESCE(ing.cost, ing.cost_price, ing.avg_cost, 0) as cost,
        COALESCE(ing.last_purchase_price, ing.cost, 0) as last_purchase_price,
        (
          SELECT COALESCE(SUM(i.quantity), 0)
          FROM inventory_items i
          WHERE i.ingredient_id = ing.id
        ) as total_stock,
        (
          SELECT COALESCE(SUM(COALESCE(i.available, i.quantity - COALESCE(i.reserved, 0))), 0)
          FROM inventory_items i
          WHERE i.ingredient_id = ing.id
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
          WHERE ii.ingredient_id = ing.id
        ) as warehouses
      FROM ingredients ing
      ${whereClause}
      ORDER BY ing.name ASC
      LIMIT 100
    `;

    const res = await erpPool.query(query, values);
    return res.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      unit: r.unit || "قطعة",
      barcode: r.barcode || "",
      category: r.category || "أصناف مخزنية",
      cost: parseFloat(r.cost || "0"),
      lastPurchasePrice: parseFloat(r.last_purchase_price || "0"),
      totalStock: parseFloat(r.total_stock || "0"),
      availableStock: parseFloat(r.available_stock || "0"),
      warehouses: r.warehouses || [],
    }));
  }
}
