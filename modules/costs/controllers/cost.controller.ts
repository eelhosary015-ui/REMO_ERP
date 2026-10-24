import { Request, Response } from 'express';
import { costService } from '../services/cost.service.js';
import { getCostIntegrationLedger, getCostIntegrationSummary, rebuildAllCostIntegrations, recordProductionCost, recordPurchaseCost } from '../services/cost.integration.service.js';

export class CostController {
  async getOperatingCostDashboard(req: Request, res: Response): Promise<void> {
    try {
      const data = await costService.getOperatingCostDashboard({
        from: req.query.from as string,
        to: req.query.to as string,
        branch: req.query.branch as string,
        costCenterId: req.query.cost_center_id ? Number(req.query.cost_center_id) : undefined,
        costItemId: req.query.cost_item_id ? Number(req.query.cost_item_id) : undefined
      });
      res.json({ success: true, data });
    } catch (err: any) { res.status(500).json({ success: false, error: err?.message || 'فشل تحميل لوحة التكاليف' }); }
  }

  async transitionOperatingCost(req: Request, res: Response): Promise<void> {
    try {
      const result = await costService.transitionOperatingCost(Number(req.params.id), String(req.body?.status || ''), (req as any).user);
      res.json({ success: true, data: result });
    } catch (err: any) { res.status(400).json({ success: false, error: err?.message || 'فشل تغيير حالة التكلفة' }); }
  }

  async previewCostAllocation(req: Request, res: Response): Promise<void> {
    try { res.json({ success: true, data: await costService.previewCostAllocation(req.body || {}) }); }
    catch (err: any) { res.status(400).json({ success: false, error: err?.message || 'فشل معاينة التخصيص' }); }
  }

  async allocateOperatingCost(req: Request, res: Response): Promise<void> {
    try { res.json({ success: true, data: await costService.allocateOperatingCost(Number(req.params.id), req.body || {}, (req as any).user) }); }
    catch (err: any) { res.status(400).json({ success: false, error: err?.message || 'فشل تخصيص التكلفة' }); }
  }

  async getCostAuditTrail(req: Request, res: Response): Promise<void> {
    try { res.json({ success: true, data: await costService.getCostAuditTrail(Number(req.params.id)) }); }
    catch (err: any) { res.status(500).json({ success: false, error: err?.message || 'فشل تحميل سجل التدقيق' }); }
  }

  async getIntegrationSummary(req: Request, res: Response): Promise<void> {
    try {
      const data = await getCostIntegrationSummary({
        from: req.query.from as string,
        to: req.query.to as string,
        warehouseId: req.query.warehouse_id ? Number(req.query.warehouse_id) : undefined,
        productId: req.query.product_id ? Number(req.query.product_id) : undefined,
        supplierId: req.query.supplier_id ? Number(req.query.supplier_id) : undefined
      });
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'فشل استرجاع ملخص تكامل التكاليف' });
    }
  }

  async getIntegrationLedger(req: Request, res: Response): Promise<void> {
    try {
      const data = await getCostIntegrationLedger({
        from: req.query.from as string,
        to: req.query.to as string,
        sourceType: req.query.source_type as string,
        transactionType: req.query.transaction_type as string,
        limit: req.query.limit ? Number(req.query.limit) : undefined
      });
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'فشل استرجاع دفتر تكامل التكاليف' });
    }
  }

  async rebuildPurchaseIntegration(req: Request, res: Response): Promise<void> {
    try {
      const count = await recordPurchaseCost(Number(req.params.id));
      res.json({ success: true, data: { purchaseTransactions: count } });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message || 'فشل إعادة ربط الشراء بالتكاليف' });
    }
  }

  async rebuildProductionIntegration(req: Request, res: Response): Promise<void> {
    try {
      const recorded = await recordProductionCost(String(req.params.orderNumber));
      res.json({ success: true, data: { recorded } });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message || 'فشل إعادة ربط الإنتاج بالتكاليف' });
    }
  }

  async rebuildAllIntegrations(req: Request, res: Response): Promise<void> {
    try {
      res.json({ success: true, data: await rebuildAllCostIntegrations() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'فشل إعادة بناء تكامل التكاليف' });
    }
  }

  // ────────────────── OPERATING COSTS ──────────────────

  async listCosts(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        branch: req.query.branch as string,
        department: req.query.department as string,
        cost_center_id: req.query.cost_center_id ? Number(req.query.cost_center_id) : undefined,
        cost_item_id: req.query.cost_item_id ? Number(req.query.cost_item_id) : undefined,
        date_from: req.query.date_from as string,
        date_to: req.query.date_to as string,
        status: req.query.status as string,
        approval_status: req.query.approval_status as string,
        allocation_status: req.query.allocation_status as string,
        source: req.query.source as string,
        search: req.query.search as string,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined
      };

      const costs = await costService.getOperatingCosts(filters);
      res.json({ success: true, data: costs });
    } catch (err: any) {
      console.error('[CostController] listCosts error:', err?.message || err);
      res.status(500).json({ success: false, error: err?.message || 'فشل استرجاع سجلات التكاليف' });
    }
  }

  async getCost(req: Request, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (!id || isNaN(id)) {
        res.status(400).json({ success: false, error: 'معرف التكلفة غير صحيح' });
        return;
      }

      const cost = await costService.getOperatingCostById(id);
      if (!cost) {
        res.status(404).json({ success: false, error: 'سجل التكلفة غير موجود' });
        return;
      }

      res.json({ success: true, data: cost });
    } catch (err: any) {
      console.error('[CostController] getCost error:', err?.message || err);
      res.status(500).json({ success: false, error: err?.message || 'فشل استرجاع تفاصيل التكلفة' });
    }
  }

  async createCost(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const idempotencyKey = (req.headers['x-idempotency-key'] as string) || req.body?.idempotency_key;

      const result = await costService.createOperatingCost(req.body || {}, user, idempotencyKey);
      if (!result.cost?.id) {
        throw Object.assign(new Error('لم تؤكد قاعدة البيانات حفظ سجل التكلفة'), { status: 500 });
      }
      res.status(201).json({
        success: true,
        data: result.cost,
        journal_entry: result.journal_entry,
        replayed: result.replayed
      });
    } catch (err: any) {
      console.error('[CostController] createCost error:', err?.message || err);
      const code = String(err?.code || '');
      const connectionFailure = code.startsWith('08') || code.startsWith('ECONN') ||
        ['57P01', '57P02', '57P03', '53300'].includes(code);
      const status = err?.status || (connectionFailure ? 503 : code ? 500 : 400);
      res.status(status).json({
        success: false,
        error: connectionFailure
          ? 'تعذر الاتصال بقاعدة بيانات PostgreSQL؛ لم يتم تأكيد حفظ التكلفة'
          : err?.message || 'فشل تسجيل التكلفة التشغيلية'
      });
    }
  }

  async updateCost(req: Request, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (!id || isNaN(id)) {
        res.status(400).json({ success: false, error: 'معرف التكلفة غير صحيح' });
        return;
      }

      const user = (req as any).user;
      const updated = await costService.updateOperatingCost(id, req.body, user);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      console.error('[CostController] updateCost error:', err?.message || err);
      res.status(400).json({ success: false, error: err?.message || 'فشل تحديث سجل التكلفة' });
    }
  }

  async deleteCost(req: Request, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (!id || isNaN(id)) {
        res.status(400).json({ success: false, error: 'معرف التكلفة غير صحيح' });
        return;
      }

      const user = (req as any).user;
      await costService.deleteOperatingCost(id, user);
      res.json({ success: true, message: 'تم حذف سجل التكلفة بنجاح' });
    } catch (err: any) {
      console.error('[CostController] deleteCost error:', err?.message || err);
      res.status(400).json({ success: false, error: err?.message || 'فشل حذف سجل التكلفة' });
    }
  }

  async postCostToLedger(req: Request, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (!id || isNaN(id)) {
        res.status(400).json({ success: false, error: 'معرف التكلفة غير صحيح' });
        return;
      }

      const user = (req as any).user;
      const result = await costService.postCostToLedger(id, user);
      res.json({ success: true, ...result });
    } catch (err: any) {
      console.error('[CostController] postCostToLedger error:', err?.message || err);
      res.status(400).json({ success: false, error: err?.message || 'فشل ترحيل التكلفة إلى القيود اليومية' });
    }
  }

  async approveCost(req: Request, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (!id || isNaN(id)) {
        res.status(400).json({ success: false, error: 'معرف التكلفة غير صحيح' });
        return;
      }

      const user = (req as any).user;
      const result = await costService.approveOperatingCost(id, user);
      res.json({ success: true, data: result, message: 'تم اعتماد المصروف بنجاح' });
    } catch (err: any) {
      console.error('[CostController] approveCost error:', err?.message || err);
      res.status(400).json({ success: false, error: err?.message || 'فشل اعتماد المصروف' });
    }
  }

  async cancelCost(req: Request, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (!id || isNaN(id)) {
        res.status(400).json({ success: false, error: 'معرف التكلفة غير صحيح' });
        return;
      }

      const user = (req as any).user;
      const reason = req.body?.reason;
      const result = await costService.cancelOperatingCost(id, user, reason);
      res.json({ success: true, data: result, message: 'تم إلغاء المصروف بنجاح' });
    } catch (err: any) {
      console.error('[CostController] cancelCost error:', err?.message || err);
      res.status(400).json({ success: false, error: err?.message || 'فشل إلغاء المصروف' });
    }
  }

  async clearAllData(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      await costService.clearAllData(user);
      res.json({ success: true, message: 'تم تفريغ بيانات التكاليف بالكامل بنجاح' });
    } catch (err: any) {
      console.error('[CostController] clearAllData error:', err?.message || err);
      res.status(500).json({ success: false, error: err?.message || 'فشل تفريغ البيانات' });
    }
  }

  // ────────────────── COST CENTERS ──────────────────

  async listCostCenters(req: Request, res: Response): Promise<void> {
    try {
      const centers = await costService.getCostCenters();
      res.json({ success: true, data: centers });
    } catch (err: any) {
      console.error('[CostController] listCostCenters error:', err?.message || err);
      res.status(500).json({ success: false, error: err?.message });
    }
  }

  async createCostCenter(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const result = await costService.createCostCenter(req.body, user);
      res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      console.error('[CostController] createCostCenter error:', err?.message || err);
      res.status(400).json({ success: false, error: err?.message });
    }
  }

  async updateCostCenter(req: Request, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      const user = (req as any).user;
      const result = await costService.updateCostCenter(id, req.body, user);
      res.json({ success: true, data: result });
    } catch (err: any) {
      console.error('[CostController] updateCostCenter error:', err?.message || err);
      res.status(400).json({ success: false, error: err?.message });
    }
  }

  async deleteCostCenter(req: Request, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      const user = (req as any).user;
      await costService.deleteCostCenter(id, user);
      res.json({ success: true, message: 'تم حذف مركز التكلفة بنجاح' });
    } catch (err: any) {
      console.error('[CostController] deleteCostCenter error:', err?.message || err);
      res.status(400).json({ success: false, error: err?.message });
    }
  }

  // ────────────────── COST ITEMS ──────────────────

  async listCostItems(req: Request, res: Response): Promise<void> {
    try {
      const items = await costService.getCostItems();
      res.json({ success: true, data: items });
    } catch (err: any) {
      console.error('[CostController] listCostItems error:', err?.message || err);
      res.status(500).json({ success: false, error: err?.message });
    }
  }

  async createCostItem(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const result = await costService.createCostItem(req.body, user);
      res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      console.error('[CostController] createCostItem error:', err?.message || err);
      res.status(400).json({ success: false, error: err?.message });
    }
  }

  async updateCostItem(req: Request, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      const user = (req as any).user;
      const result = await costService.updateCostItem(id, req.body, user);
      res.json({ success: true, data: result });
    } catch (err: any) {
      console.error('[CostController] updateCostItem error:', err?.message || err);
      res.status(400).json({ success: false, error: err?.message });
    }
  }

  async deleteCostItem(req: Request, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      const user = (req as any).user;
      await costService.deleteCostItem(id, user);
      res.json({ success: true, message: 'تم حذف بند التكلفة بنجاح' });
    } catch (err: any) {
      console.error('[CostController] deleteCostItem error:', err?.message || err);
      res.status(400).json({ success: false, error: err?.message });
    }
  }

  // ────────────────── ESTIMATED BUDGETS ──────────────────

  async listBudgets(req: Request, res: Response): Promise<void> {
    try {
      const budgets = await costService.getBudgets();
      res.json({ success: true, data: budgets });
    } catch (err: any) {
      console.error('[CostController] listBudgets error:', err?.message || err);
      res.status(500).json({ success: false, error: err?.message });
    }
  }

  async createBudget(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const result = await costService.createBudget(req.body, user);
      res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      console.error('[CostController] createBudget error:', err?.message || err);
      res.status(400).json({ success: false, error: err?.message });
    }
  }

  async deleteBudget(req: Request, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      const user = (req as any).user;
      await costService.deleteBudget(id, user);
      res.json({ success: true, message: 'تم حذف الموازنة بنجاح' });
    } catch (err: any) {
      console.error('[CostController] deleteBudget error:', err?.message || err);
      res.status(400).json({ success: false, error: err?.message });
    }
  }

  // ────────────────── STANDARD & PRODUCT COSTS ──────────────────

  async getStandardCosts(req: Request, res: Response): Promise<void> {
    try {
      const standards = await costService.getStandardCosts();
      res.json({ success: true, data: standards[0] || null });
    } catch (err: any) {
      console.error('[CostController] getStandardCosts error:', err?.message || err);
      res.status(500).json({ success: false, error: err?.message });
    }
  }

  async saveStandardCosts(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const result = await costService.saveStandardCost(req.body, user);
      res.json({ success: true, data: result });
    } catch (err: any) {
      console.error('[CostController] saveStandardCosts error:', err?.message || err);
      res.status(400).json({ success: false, error: err?.message });
    }
  }

  async getProductCosts(req: Request, res: Response): Promise<void> {
    try {
      const costs = await costService.getProductCosts();
      res.json({ success: true, data: costs });
    } catch (err: any) {
      console.error('[CostController] getProductCosts error:', err?.message || err);
      res.status(500).json({ success: false, error: err?.message });
    }
  }

  async getProductCostReport(req: Request, res: Response): Promise<void> {
    try {
      const {
        search,
        fromDate,
        toDate,
        costCenter,
        branchId,
        branch,
        category,
        hasRecipe
      } = req.query;

      const reportData = await costService.getProductCostReport({
        search: typeof search === 'string' ? search : undefined,
        fromDate: typeof fromDate === 'string' ? fromDate : undefined,
        toDate: typeof toDate === 'string' ? toDate : undefined,
        costCenter: typeof costCenter === 'string' ? costCenter : undefined,
        branchId: typeof branchId === 'string' ? branchId : typeof branch === 'string' ? branch : undefined,
        category: typeof category === 'string' ? category : undefined,
        hasRecipe: typeof hasRecipe === 'string' ? hasRecipe : undefined
      });

      res.json({ success: true, data: reportData });
    } catch (err: any) {
      console.error('[CostController] getProductCostReport error:', err?.message || err);
      res.status(500).json({ success: false, error: err?.message });
    }
  }

  async saveProductCosts(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const result = await costService.saveProductCost(req.body, user);
      res.json({ success: true, data: result });
    } catch (err: any) {
      console.error('[CostController] saveProductCosts error:', err?.message || err);
      res.status(400).json({ success: false, error: err?.message });
    }
  }

  // ────────────────── SETTINGS ──────────────────

  async getSettings(req: Request, res: Response): Promise<void> {
    try {
      const settings = await costService.getSettings();
      res.json({ success: true, data: settings });
    } catch (err: any) {
      console.error('[CostController] getSettings error:', err?.message || err);
      res.status(500).json({ success: false, error: err?.message });
    }
  }

  async saveSettings(req: Request, res: Response): Promise<void> {
    try {
      await costService.saveSettings(req.body?.settings || req.body);
      res.json({ success: true, message: 'تم حفظ الإعدادات بنجاح' });
    } catch (err: any) {
      console.error('[CostController] saveSettings error:', err?.message || err);
      res.status(400).json({ success: false, error: err?.message });
    }
  }

  // ────────────────── RECIPE COSTING ──────────────────

  async getRecipeProducts(req: Request, res: Response): Promise<void> {
    try {
      const search = req.query.search as string | undefined;
      const warehouseId = req.query.warehouse_id as string | undefined;
      const limitRaw = Number(req.query.limit);
      const offsetRaw = Number(req.query.offset);
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : undefined;
      const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : undefined;
      const { data, total } = await costService.getRecipeProducts(search, warehouseId, { limit, offset });
      res.json({ success: true, data, total, limit: limit ?? null, offset: offset ?? 0 });
    } catch (err: any) {
      console.error('[CostController] getRecipeProducts error:', err?.message || err);
      res.status(500).json({ success: false, error: err?.message });
    }
  }

  async getAllIngredientsWithCost(req: Request, res: Response): Promise<void> {
    try {
      const warehouseId = req.query.warehouse_id ? Number(req.query.warehouse_id) : undefined;
      const ingredients = await costService.getAllIngredientsWithCost(warehouseId);
      res.json({ success: true, data: ingredients });
    } catch (err: any) {
      console.error('[CostController] getAllIngredientsWithCost error:', err?.message || err);
      res.status(500).json({ success: false, error: err?.message });
    }
  }

  async updateRecipeIngredients(req: Request, res: Response): Promise<void> {
    try {
      const { product_id, ingredients, yield_portions } = req.body;
      if (!product_id) {
        res.status(400).json({ success: false, error: 'رقم المنتج (product_id) مطلوب' });
        return;
      }
      const user = (req as any).user;
      await costService.updateRecipeIngredients(String(product_id), ingredients || [], yield_portions, user);
      res.json({ success: true, message: 'تم حفظ وتحديث مكونات الـ Recipe للمنتج بنجاح' });
    } catch (err: any) {
      console.error('[CostController] updateRecipeIngredients error:', err?.message || err);
      res.status(400).json({ success: false, error: err?.message });
    }
  }

  async calculateRecipeCost(req: Request, res: Response): Promise<void> {
    try {
      const productId = req.params.productId;
      const costSourceParam = (req.query.costSource as string) || 'weighted_avg';
      const warehouseId = (req.query.warehouse_id as string) || 'all';

      const result = await costService.calculateRecipeCost(productId, costSourceParam, warehouseId);
      res.json({ success: true, data: result });
    } catch (err: any) {
      console.error('[CostController] calculateRecipeCost error:', err?.message || err);
      res.status(err?.message?.includes('غير موجود') ? 404 : 500).json({ success: false, error: err?.message });
    }
  }

  async saveRecipeCost(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const result = await costService.saveRecipeCost(req.body, user);
      res.json({ success: true, data: result });
    } catch (err: any) {
      console.error('[CostController] saveRecipeCost error:', err?.message || err);
      res.status(400).json({ success: false, error: err?.message });
    }
  }

  async getRecipeCostHistory(req: Request, res: Response): Promise<void> {
    try {
      const productId = req.params.productId;
      const history = await costService.getRecipeCostHistory(productId);
      res.json({ success: true, data: history });
    } catch (err: any) {
      console.error('[CostController] getRecipeCostHistory error:', err?.message || err);
      res.status(500).json({ success: false, error: err?.message });
    }
  }

  // ────────────────── ACTIVITY LOGS ──────────────────

  async getActivityLogs(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 100;
      const logs = await costService.getActivityLogs(limit);
      res.json({ success: true, data: logs });
    } catch (err: any) {
      console.error('[CostController] getActivityLogs error:', err?.message || err);
      res.status(500).json({ success: false, error: err?.message });
    }
  }

  async logActivity(req: Request, res: Response): Promise<void> {
    try {
      const { action, details } = req.body;
      const user = (req as any).user;
      await costService.logActivity(action, details, user?.username || 'النظام');
      res.json({ success: true, message: 'تم تسجيل النشاط بنجاح' });
    } catch (err: any) {
      console.error('[CostController] logActivity error:', err?.message || err);
      res.status(400).json({ success: false, error: err?.message });
    }
  }

  // ────────────────── INTEGRATIONS ──────────────────

  async getIntegrationEmployees(req: Request, res: Response): Promise<void> {
    try {
      const data = await costService.getIntegrationEmployees();
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  }

  async getIntegrationSuppliers(req: Request, res: Response): Promise<void> {
    try {
      const data = await costService.getIntegrationSuppliers();
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  }

  async getIntegrationCustomers(req: Request, res: Response): Promise<void> {
    try {
      const data = await costService.getIntegrationCustomers();
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  }

  async getIntegrationProducts(req: Request, res: Response): Promise<void> {
    try {
      const data = await costService.getIntegrationProducts();
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  }

  async getIntegrationIngredients(req: Request, res: Response): Promise<void> {
    try {
      const data = await costService.getIntegrationIngredients();
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  }

  async getIntegrationWarehouses(req: Request, res: Response): Promise<void> {
    try {
      const data = await costService.getIntegrationWarehouses();
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  }

  async getIntegrationAccounts(req: Request, res: Response): Promise<void> {
    try {
      const data = await costService.getIntegrationAccounts();
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  }
}

export const costController = new CostController();
