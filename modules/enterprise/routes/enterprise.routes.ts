import { Router } from 'express';
import { companyContextMiddleware } from '../middleware/companyContext.middleware.js';
import * as ctrl from '../controllers/enterprise.controller.js';
import * as v from '../validators/enterprise.validator.js';

// ═══════════════════════════════════════════════════════════════
// Enterprise Routes — Layered Architecture
// Routes → Controllers → Repositories → Database
// ═══════════════════════════════════════════════════════════════

export const enterpriseRoutes = Router();

// Apply company context middleware to all enterprise routes
enterpriseRoutes.use(companyContextMiddleware);

// ─── 1. COMPANIES ───
enterpriseRoutes.get('/companies', ctrl.companyController.getAll);
enterpriseRoutes.post('/companies', v.validateCreateCompany, ctrl.companyController.create);
enterpriseRoutes.put('/companies/:id', ctrl.companyController.update);
enterpriseRoutes.delete('/companies/:id', ctrl.companyController.delete);

// ─── 2. ROLES & PERMISSIONS ───
enterpriseRoutes.get('/roles', ctrl.roleController.getAll);
enterpriseRoutes.post('/roles', v.validateCreateRole, ctrl.roleController.create);
enterpriseRoutes.put('/roles/:id', ctrl.roleController.update);
enterpriseRoutes.get('/roles/:id/permissions', ctrl.roleController.getPermissions);
enterpriseRoutes.put('/roles/:id/permissions', v.validateUpdateRolePermissions, ctrl.roleController.updatePermissions);
enterpriseRoutes.delete('/roles/:id', ctrl.roleController.delete);

// ─── 3. BATCH / LOT TRACKING ───
enterpriseRoutes.get('/batches', ctrl.batchController.getAll);
enterpriseRoutes.post('/batches', v.validateCreateBatch, ctrl.batchController.create);
enterpriseRoutes.put('/batches/:id', ctrl.batchController.update);

// ─── 4. REORDERING RULES ───
enterpriseRoutes.get('/reordering-rules', ctrl.reorderingController.getAll);
enterpriseRoutes.post('/reordering-rules', v.validateCreateReorderingRule, ctrl.reorderingController.create);
enterpriseRoutes.put('/reordering-rules/:id', ctrl.reorderingController.update);
enterpriseRoutes.delete('/reordering-rules/:id', ctrl.reorderingController.delete);
enterpriseRoutes.get('/reordering-rules/suggestions', ctrl.reorderingController.getSuggestions);

// ─── 5. STOCK VALUATION ───
enterpriseRoutes.get('/stock-valuation', ctrl.stockValuationController.getAll);
enterpriseRoutes.post('/stock-valuation/calculate', ctrl.stockValuationController.calculate);

// ─── 6. PRODUCTION — BOM ───
enterpriseRoutes.get('/boms', ctrl.bomController.getAll);
enterpriseRoutes.post('/boms', v.validateCreateBOM, ctrl.bomController.create);
enterpriseRoutes.delete('/boms/:id', ctrl.bomController.delete);

// ─── 7. WORK CENTERS ───
enterpriseRoutes.get('/work-centers', ctrl.workCenterController.getAll);
enterpriseRoutes.post('/work-centers', v.validateCreateWorkCenter, ctrl.workCenterController.create);
enterpriseRoutes.put('/work-centers/:id', ctrl.workCenterController.update);
enterpriseRoutes.delete('/work-centers/:id', ctrl.workCenterController.delete);

// ─── 8. MANUFACTURING ORDERS ───
enterpriseRoutes.get('/manufacturing-orders', ctrl.manufacturingController.getAll);
enterpriseRoutes.post('/manufacturing-orders', v.validateCreateMO, ctrl.manufacturingController.create);
enterpriseRoutes.put('/manufacturing-orders/:id/status', v.validateUpdateMOStatus, ctrl.manufacturingController.updateStatus);

// ─── 9. QUALITY CHECKS ───
enterpriseRoutes.get('/quality-checks', ctrl.qualityController.getAll);
enterpriseRoutes.post('/quality-checks', v.validateCreateQualityCheck, ctrl.qualityController.create);

// ─── 10. SCRAP RECORDS ───
enterpriseRoutes.get('/scrap', ctrl.scrapController.getAll);
enterpriseRoutes.post('/scrap', ctrl.scrapController.create);

// ─── 11. MAINTENANCE — ASSETS ───
enterpriseRoutes.get('/assets', ctrl.assetController.getAll);
enterpriseRoutes.post('/assets', v.validateCreateAsset, ctrl.assetController.create);
enterpriseRoutes.put('/assets/:id', ctrl.assetController.update);
enterpriseRoutes.delete('/assets/:id', ctrl.assetController.delete);

// ─── 12. MAINTENANCE — REQUESTS ───
enterpriseRoutes.get('/maintenance-requests', ctrl.maintenanceRequestController.getAll);
enterpriseRoutes.post('/maintenance-requests', v.validateCreateMaintenanceRequest, ctrl.maintenanceRequestController.create);
enterpriseRoutes.put('/maintenance-requests/:id', ctrl.maintenanceRequestController.update);

// ─── 13. WORK ORDERS ───
enterpriseRoutes.get('/work-orders', ctrl.workOrderController.getAll);
enterpriseRoutes.post('/work-orders', v.validateCreateWorkOrder, ctrl.workOrderController.create);
enterpriseRoutes.put('/work-orders/:id', ctrl.workOrderController.update);

// ─── 14. PREVENTIVE MAINTENANCE ───
enterpriseRoutes.get('/preventive-maintenance', ctrl.preventiveMaintController.getAll);
enterpriseRoutes.post('/preventive-maintenance', ctrl.preventiveMaintController.create);
enterpriseRoutes.put('/preventive-maintenance/:id', ctrl.preventiveMaintController.update);

// ─── 15. CRM — LEADS ───
enterpriseRoutes.get('/leads', ctrl.leadController.getAll);
enterpriseRoutes.post('/leads', v.validateCreateLead, ctrl.leadController.create);
enterpriseRoutes.put('/leads/:id', ctrl.leadController.update);
enterpriseRoutes.delete('/leads/:id', ctrl.leadController.delete);
enterpriseRoutes.post('/leads/:id/convert', ctrl.leadController.convert);

// ─── 16. CRM — OPPORTUNITIES ───
enterpriseRoutes.get('/opportunities', ctrl.opportunityController.getAll);
enterpriseRoutes.put('/opportunities/:id', ctrl.opportunityController.update);

// ─── 17. CRM — QUOTATIONS ───
enterpriseRoutes.get('/quotations', ctrl.quotationController.getAll);
enterpriseRoutes.post('/quotations', v.validateCreateQuotation, ctrl.quotationController.create);

// ─── 18. CRM — ACTIVITIES ───
enterpriseRoutes.get('/activities', ctrl.activityController.getAll);
enterpriseRoutes.post('/activities', ctrl.activityController.create);
enterpriseRoutes.put('/activities/:id', ctrl.activityController.update);

// ─── 19. RECIPES ───
enterpriseRoutes.get('/recipes', ctrl.recipeController.getAll);
enterpriseRoutes.post('/recipes', v.validateCreateRecipe, ctrl.recipeController.create);

// ─── 20. WASTE RECORDS ───
enterpriseRoutes.get('/waste', ctrl.wasteController.getAll);
enterpriseRoutes.post('/waste', v.validateCreateWaste, ctrl.wasteController.create);

// ─── 21. ENTERPRISE AUDIT LOG ───
enterpriseRoutes.get('/audit-log', ctrl.auditLogController.getAll);

// ─── 22. ENTERPRISE DASHBOARD KPIs ───
enterpriseRoutes.get('/dashboard/kpis', ctrl.dashboardController.getKPIs);

// ─── 23. FINANCIAL REPORTS ───
enterpriseRoutes.get('/financial-reports/trial-balance', ctrl.financialReportController.trialBalance);
enterpriseRoutes.get('/financial-reports/income-statement', ctrl.financialReportController.incomeStatement);
enterpriseRoutes.get('/financial-reports/balance-sheet', ctrl.financialReportController.balanceSheet);
enterpriseRoutes.get('/financial-reports/cash-flow', ctrl.financialReportController.cashFlow);