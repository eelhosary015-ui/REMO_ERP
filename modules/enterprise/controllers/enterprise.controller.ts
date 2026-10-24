import { Request, Response } from 'express';
import * as repo from '../repositories/enterprise.repository.js';
import { logCreate, logUpdate, logDelete, logStatusChange } from '../services/audit.service.js';
import { CompanyContext } from '../middleware/companyContext.middleware.js';

// ═══════════════════════════════════════════════════════════════
// Enterprise Controllers
// Handles HTTP request/response - delegates to repositories
// ═══════════════════════════════════════════════════════════════

function getCtx(req: Request): CompanyContext | undefined {
  return (req as any).companyContext;
}

function handleError(res: Response, err: any, module: string) {
  console.error(`[${module}]`, err.message);
  res.status(500).json({ error: err.message });
}

// ─── 1. COMPANIES ───
export const companyController = {
  async getAll(req: Request, res: Response) {
    try {
      const rows = await repo.companyRepo.findAll();
      res.json(rows);
    } catch (err: any) { handleError(res, err, 'COMPANIES'); }
  },
  async create(req: Request, res: Response) {
    try {
      const record = await repo.companyRepo.create(req.body);
      await logCreate(req, 'enterprise', 'companies', record.id, record, 'Created company');
      res.json(record);
    } catch (err: any) { handleError(res, err, 'COMPANIES'); }
  },
  async update(req: Request, res: Response) {
    try {
      const old = await repo.companyRepo.findById(req.params.id);
      const record = await repo.companyRepo.update(req.params.id, req.body);
      if (!record) return res.status(404).json({ error: 'Not found' });
      await logUpdate(req, 'enterprise', 'companies', record.id, old, record);
      res.json(record);
    } catch (err: any) { handleError(res, err, 'COMPANIES'); }
  },
  async delete(req: Request, res: Response) {
    try {
      const old = await repo.companyRepo.findById(req.params.id);
      await repo.companyRepo.delete(req.params.id);
      await logDelete(req, 'enterprise', 'companies', req.params.id, old);
      res.json({ success: true });
    } catch (err: any) { handleError(res, err, 'COMPANIES'); }
  },
};

// ─── 2. ROLES ───
export const roleController = {
  async getAll(req: Request, res: Response) {
    try { res.json(await repo.roleRepo.findAll()); }
    catch (err: any) { handleError(res, err, 'ROLES'); }
  },
  async create(req: Request, res: Response) {
    try {
      const record = await repo.roleRepo.createWithPermissions(req.body);
      res.json(record);
    } catch (err: any) { handleError(res, err, 'ROLES'); }
  },
  async update(req: Request, res: Response) {
    try {
      const record = await repo.roleRepo.update(req.params.id, req.body);
      res.json(record || { error: 'Not found' });
    } catch (err: any) { handleError(res, err, 'ROLES'); }
  },
  async getPermissions(req: Request, res: Response) {
    try { res.json(await repo.roleRepo.getPermissions(req.params.id)); }
    catch (err: any) { handleError(res, err, 'ROLES'); }
  },
  async updatePermissions(req: Request, res: Response) {
    try {
      await repo.roleRepo.setPermissions(req.params.id, req.body.permissions || []);
      res.json({ success: true });
    } catch (err: any) { handleError(res, err, 'ROLES'); }
  },
  async delete(req: Request, res: Response) {
    try {
      await repo.roleRepo.delete(req.params.id);
      res.json({ success: true });
    } catch (err: any) { handleError(res, err, 'ROLES'); }
  },
};

// ─── 3. BATCHES ───
export const batchController = {
  async getAll(req: Request, res: Response) {
    try { res.json(await repo.batchRepo.findAll(req.query, getCtx(req))); }
    catch (err: any) { handleError(res, err, 'BATCHES'); }
  },
  async create(req: Request, res: Response) {
    try {
      const record = await repo.batchRepo.create(req.body, getCtx(req));
      await logCreate(req, 'inventory', 'batch_tracking', record.id, record);
      res.json(record);
    } catch (err: any) { handleError(res, err, 'BATCHES'); }
  },
  async update(req: Request, res: Response) {
    try { res.json(await repo.batchRepo.update(req.params.id, req.body) || { error: 'Not found' }); }
    catch (err: any) { handleError(res, err, 'BATCHES'); }
  },
};

// ─── 4. REORDERING RULES ───
export const reorderingController = {
  async getAll(req: Request, res: Response) {
    try { res.json(await repo.reorderingRepo.findAll()); }
    catch (err: any) { handleError(res, err, 'REORDERING'); }
  },
  async create(req: Request, res: Response) {
    try { res.json(await repo.reorderingRepo.create(req.body)); }
    catch (err: any) { handleError(res, err, 'REORDERING'); }
  },
  async update(req: Request, res: Response) {
    try { res.json(await repo.reorderingRepo.update(req.params.id, req.body) || { error: 'Not found' }); }
    catch (err: any) { handleError(res, err, 'REORDERING'); }
  },
  async delete(req: Request, res: Response) {
    try { await repo.reorderingRepo.delete(req.params.id); res.json({ success: true }); }
    catch (err: any) { handleError(res, err, 'REORDERING'); }
  },
  async getSuggestions(req: Request, res: Response) {
    try { res.json(await repo.reorderingRepo.getSuggestions()); }
    catch (err: any) { handleError(res, err, 'REORDERING'); }
  },
};

// ─── 5. STOCK VALUATION ───
export const stockValuationController = {
  async getAll(req: Request, res: Response) {
    try { res.json(await repo.stockValuationRepo.findAll(req.query)); }
    catch (err: any) { handleError(res, err, 'STOCK_VALUATION'); }
  },
  async calculate(req: Request, res: Response) {
    try { res.json(await repo.stockValuationRepo.calculate()); }
    catch (err: any) { handleError(res, err, 'STOCK_VALUATION'); }
  },
};

// ─── 6. BOM ───
export const bomController = {
  async getAll(req: Request, res: Response) {
    try { res.json(await repo.bomRepo.findAll()); }
    catch (err: any) { handleError(res, err, 'BOM'); }
  },
  async create(req: Request, res: Response) {
    try { res.json(await repo.bomRepo.create(req.body)); }
    catch (err: any) { handleError(res, err, 'BOM'); }
  },
  async delete(req: Request, res: Response) {
    try { await repo.bomRepo.delete(req.params.id); res.json({ success: true }); }
    catch (err: any) { handleError(res, err, 'BOM'); }
  },
};

// ─── 7. WORK CENTERS ───
export const workCenterController = {
  async getAll(req: Request, res: Response) {
    try { res.json(await repo.workCenterRepo.findAll()); }
    catch (err: any) { handleError(res, err, 'WORK_CENTERS'); }
  },
  async create(req: Request, res: Response) {
    try { res.json(await repo.workCenterRepo.create(req.body)); }
    catch (err: any) { handleError(res, err, 'WORK_CENTERS'); }
  },
  async update(req: Request, res: Response) {
    try { res.json(await repo.workCenterRepo.update(req.params.id, req.body) || { error: 'Not found' }); }
    catch (err: any) { handleError(res, err, 'WORK_CENTERS'); }
  },
  async delete(req: Request, res: Response) {
    try { await repo.workCenterRepo.delete(req.params.id); res.json({ success: true }); }
    catch (err: any) { handleError(res, err, 'WORK_CENTERS'); }
  },
};

// ─── 8. MANUFACTURING ORDERS ───
export const manufacturingController = {
  async getAll(req: Request, res: Response) {
    try { res.json(await repo.manufacturingRepo.findAll(req.query, getCtx(req))); }
    catch (err: any) { handleError(res, err, 'MANUFACTURING'); }
  },
  async create(req: Request, res: Response) {
    try {
      const record = await repo.manufacturingRepo.create(req.body, getCtx(req));
      await logCreate(req, 'production', 'manufacturing_orders', record.id, record);
      res.json(record);
    } catch (err: any) { handleError(res, err, 'MANUFACTURING'); }
  },
  async updateStatus(req: Request, res: Response) {
    try {
      const old = await repo.manufacturingRepo.findAll({ status: '' }, getCtx(req));
      const record = await repo.manufacturingRepo.updateStatus(req.params.id, req.body);
      if (!record) return res.status(404).json({ error: 'Not found' });
      if (req.body.status) {
        await logStatusChange(req, 'production', 'manufacturing_orders', record.id, record.status, req.body.status, 'MO status updated');
      }
      res.json(record);
    } catch (err: any) { handleError(res, err, 'MANUFACTURING'); }
  },
};

// ─── 9. QUALITY CHECKS ───
export const qualityController = {
  async getAll(req: Request, res: Response) {
    try { res.json(await repo.qualityRepo.findAll(req.query)); }
    catch (err: any) { handleError(res, err, 'QUALITY'); }
  },
  async create(req: Request, res: Response) {
    try { res.json(await repo.qualityRepo.create(req.body)); }
    catch (err: any) { handleError(res, err, 'QUALITY'); }
  },
};

// ─── 10. SCRAP ───
export const scrapController = {
  async getAll(req: Request, res: Response) {
    try { res.json(await repo.scrapRepo.findAll()); }
    catch (err: any) { handleError(res, err, 'SCRAP'); }
  },
  async create(req: Request, res: Response) {
    try { res.json(await repo.scrapRepo.create(req.body)); }
    catch (err: any) { handleError(res, err, 'SCRAP'); }
  },
};

// ─── 11. ASSETS ───
export const assetController = {
  async getAll(req: Request, res: Response) {
    try { res.json(await repo.assetRepo.findAll(req.query, getCtx(req))); }
    catch (err: any) { handleError(res, err, 'ASSETS'); }
  },
  async create(req: Request, res: Response) {
    try {
      const record = await repo.assetRepo.create(req.body);
      await logCreate(req, 'maintenance', 'maintenance_assets', record.id, record);
      res.json(record);
    } catch (err: any) { handleError(res, err, 'ASSETS'); }
  },
  async update(req: Request, res: Response) {
    try { res.json(await repo.assetRepo.update(req.params.id, req.body) || { error: 'Not found' }); }
    catch (err: any) { handleError(res, err, 'ASSETS'); }
  },
  async delete(req: Request, res: Response) {
    try {
      await repo.assetRepo.delete(req.params.id);
      res.json({ success: true });
    } catch (err: any) { handleError(res, err, 'ASSETS'); }
  },
};

// ─── 12. MAINTENANCE REQUESTS ───
export const maintenanceRequestController = {
  async getAll(req: Request, res: Response) {
    try { res.json(await repo.maintenanceRequestRepo.findAll(req.query)); }
    catch (err: any) { handleError(res, err, 'MAINT_REQUESTS'); }
  },
  async create(req: Request, res: Response) {
    try { res.json(await repo.maintenanceRequestRepo.create(req.body)); }
    catch (err: any) { handleError(res, err, 'MAINT_REQUESTS'); }
  },
  async update(req: Request, res: Response) {
    try { res.json(await repo.maintenanceRequestRepo.update(req.params.id, req.body) || { error: 'Not found' }); }
    catch (err: any) { handleError(res, err, 'MAINT_REQUESTS'); }
  },
};

// ─── 13. WORK ORDERS ───
export const workOrderController = {
  async getAll(req: Request, res: Response) {
    try { res.json(await repo.workOrderRepo.findAll(req.query)); }
    catch (err: any) { handleError(res, err, 'WORK_ORDERS'); }
  },
  async create(req: Request, res: Response) {
    try { res.json(await repo.workOrderRepo.create(req.body)); }
    catch (err: any) { handleError(res, err, 'WORK_ORDERS'); }
  },
  async update(req: Request, res: Response) {
    try { res.json(await repo.workOrderRepo.update(req.params.id, req.body) || { error: 'Not found' }); }
    catch (err: any) { handleError(res, err, 'WORK_ORDERS'); }
  },
};

// ─── 14. PREVENTIVE MAINTENANCE ───
export const preventiveMaintController = {
  async getAll(req: Request, res: Response) {
    try { res.json(await repo.preventiveMaintRepo.findAll()); }
    catch (err: any) { handleError(res, err, 'PREVENTIVE'); }
  },
  async create(req: Request, res: Response) {
    try { res.json(await repo.preventiveMaintRepo.create(req.body)); }
    catch (err: any) { handleError(res, err, 'PREVENTIVE'); }
  },
  async update(req: Request, res: Response) {
    try { res.json(await repo.preventiveMaintRepo.update(req.params.id, req.body) || { error: 'Not found' }); }
    catch (err: any) { handleError(res, err, 'PREVENTIVE'); }
  },
};

// ─── 15. LEADS ───
export const leadController = {
  async getAll(req: Request, res: Response) {
    try { res.json(await repo.leadRepo.findAll(req.query)); }
    catch (err: any) { handleError(res, err, 'LEADS'); }
  },
  async create(req: Request, res: Response) {
    try { res.json(await repo.leadRepo.create(req.body)); }
    catch (err: any) { handleError(res, err, 'LEADS'); }
  },
  async update(req: Request, res: Response) {
    try { res.json(await repo.leadRepo.update(req.params.id, req.body) || { error: 'Not found' }); }
    catch (err: any) { handleError(res, err, 'LEADS'); }
  },
  async delete(req: Request, res: Response) {
    try { await repo.leadRepo.delete(req.params.id); res.json({ success: true }); }
    catch (err: any) { handleError(res, err, 'LEADS'); }
  },
  async convert(req: Request, res: Response) {
    try {
      const result = await repo.leadRepo.convert(req.params.id, req.body);
      if (!result) return res.status(404).json({ error: 'Lead not found' });
      res.json(result);
    } catch (err: any) { handleError(res, err, 'LEADS'); }
  },
};

// ─── 16. OPPORTUNITIES ───
export const opportunityController = {
  async getAll(req: Request, res: Response) {
    try { res.json(await repo.opportunityRepo.findAll(req.query)); }
    catch (err: any) { handleError(res, err, 'OPPORTUNITIES'); }
  },
  async update(req: Request, res: Response) {
    try { res.json(await repo.opportunityRepo.update(req.params.id, req.body) || { error: 'Not found' }); }
    catch (err: any) { handleError(res, err, 'OPPORTUNITIES'); }
  },
};

// ─── 17. QUOTATIONS ───
export const quotationController = {
  async getAll(req: Request, res: Response) {
    try { res.json(await repo.quotationRepo.findAll(req.query)); }
    catch (err: any) { handleError(res, err, 'QUOTATIONS'); }
  },
  async create(req: Request, res: Response) {
    try { res.json(await repo.quotationRepo.create(req.body)); }
    catch (err: any) { handleError(res, err, 'QUOTATIONS'); }
  },
};

// ─── 18. ACTIVITIES ───
export const activityController = {
  async getAll(req: Request, res: Response) {
    try { res.json(await repo.activityRepo.findAll(req.query)); }
    catch (err: any) { handleError(res, err, 'ACTIVITIES'); }
  },
  async create(req: Request, res: Response) {
    try { res.json(await repo.activityRepo.create(req.body)); }
    catch (err: any) { handleError(res, err, 'ACTIVITIES'); }
  },
  async update(req: Request, res: Response) {
    try { res.json(await repo.activityRepo.update(req.params.id, req.body) || { error: 'Not found' }); }
    catch (err: any) { handleError(res, err, 'ACTIVITIES'); }
  },
};

// ─── 19. RECIPES ───
export const recipeController = {
  async getAll(req: Request, res: Response) {
    try { res.json(await repo.recipeRepo.findAll()); }
    catch (err: any) { handleError(res, err, 'RECIPES'); }
  },
  async create(req: Request, res: Response) {
    try { res.json(await repo.recipeRepo.create(req.body)); }
    catch (err: any) { handleError(res, err, 'RECIPES'); }
  },
};

// ─── 20. WASTE ───
export const wasteController = {
  async getAll(req: Request, res: Response) {
    try { res.json(await repo.wasteRepo.findAll(req.query)); }
    catch (err: any) { handleError(res, err, 'WASTE'); }
  },
  async create(req: Request, res: Response) {
    try { res.json(await repo.wasteRepo.create(req.body)); }
    catch (err: any) { handleError(res, err, 'WASTE'); }
  },
};

// ─── 21. AUDIT LOG ───
export const auditLogController = {
  async getAll(req: Request, res: Response) {
    try { res.json(await repo.auditLogRepo.findAll(req.query)); }
    catch (err: any) { handleError(res, err, 'AUDIT_LOG'); }
  },
};

// ─── 22. DASHBOARD KPIs ───
export const dashboardController = {
  async getKPIs(req: Request, res: Response) {
    try { res.json(await repo.dashboardRepo.getKPIs(req.query)); }
    catch (err: any) { handleError(res, err, 'DASHBOARD'); }
  },
};

// ─── 23. FINANCIAL REPORTS ───
export const financialReportController = {
  async trialBalance(req: Request, res: Response) {
    try { res.json(await repo.financialRepo.trialBalance(req.query.date_from as string, req.query.date_to as string)); }
    catch (err: any) { handleError(res, err, 'FINANCIAL_REPORTS'); }
  },
  async incomeStatement(req: Request, res: Response) {
    try { res.json(await repo.financialRepo.incomeStatement(req.query.date_from as string, req.query.date_to as string)); }
    catch (err: any) { handleError(res, err, 'FINANCIAL_REPORTS'); }
  },
  async balanceSheet(req: Request, res: Response) {
    try { res.json(await repo.financialRepo.balanceSheet(req.query.date_from as string, req.query.date_to as string)); }
    catch (err: any) { handleError(res, err, 'FINANCIAL_REPORTS'); }
  },
  async cashFlow(req: Request, res: Response) {
    try { res.json(await repo.financialRepo.cashFlow(req.query.date_from as string, req.query.date_to as string)); }
    catch (err: any) { handleError(res, err, 'FINANCIAL_REPORTS'); }
  },
};
