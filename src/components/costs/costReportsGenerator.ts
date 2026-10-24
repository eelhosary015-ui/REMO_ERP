import { COST_REPORTS_REGISTRY, CostReportDefinition } from './costReportsData';

export interface GeneratorParams {
  reportId: string;
  costs?: any[];
  filteredCosts?: any[];
  centers?: any[];
  items?: any[];
  budgets?: any[];
  branches?: any[];
  products?: any[];
  ingredients?: any[];
  employees?: any[];
  departments?: any[];
  suppliers?: any[];
  customers?: any[];
  filters?: {
    fromDate?: string;
    toDate?: string;
    branch?: string;
    center?: string;
    search?: string;
  };
}

export interface GeneratedReportOutput {
  definition: CostReportDefinition;
  rows: any[];
  kpiValues: Record<string, any>;
  chartData: any[];
  totalValue: number;
}

export function generateCostReportData(params: GeneratorParams): GeneratedReportOutput {
  const cleanId = (params.reportId || '').startsWith('report_') ? params.reportId : `report_${params.reportId || 'op_summary'}`;
  const def = COST_REPORTS_REGISTRY[cleanId] || COST_REPORTS_REGISTRY['report_op_summary'];

  // Real entity datasets strictly from database / API
  const realCosts = Array.isArray(params.costs) ? params.costs : [];
  
  const activeCenters = Array.isArray(params.centers) ? params.centers.map((c, i) => ({
    id: c.id || i + 1,
    code: c.code || `CC-${String(c.id || i + 1).padStart(2, '0')}`,
    name: c.name || c.cost_center_name || 'مركز تكلفة',
    type: c.type || 'تشغيلي إنتاجي',
    department: c.department || c.notes || 'إدارة التشغيل',
    manager: c.manager || 'مسؤول المركز',
    budget: Number(c.budget || c.budget_amount || 0),
    actual: Number(c.actual || c.actual_amount || 0)
  })) : [];

  const activeItems = Array.isArray(params.items) ? params.items.map((it, i) => ({
    id: it.id || i + 1,
    code: it.code || `CI-${String(it.id || i + 1).padStart(2, '0')}`,
    name: it.name || it.cost_item_name || 'بند تكلفة',
    nature: it.nature || 'مباشرة',
    behavior: it.behavior || 'متغيرة',
    glAccount: it.gl_account || `${310000 + i * 1000} - حساب التكاليف`,
    spentAmount: Number(it.spent_amount || it.total || it.amount || 0)
  })) : [];

  const activeProducts = Array.isArray(params.products) ? params.products.map((p, i) => {
    const salePrice = Number(p.sale_price ?? p.salePrice ?? p.price ?? p.selling_price ?? 0);
    const materialCost = Number(p.material_cost ?? p.materialCost ?? p.raw_material ?? p.food_cost ?? p.cost_price ?? p.cost ?? 0);
    const laborCost = Number(p.labor_cost ?? p.laborCost ?? p.direct_labor ?? 0);
    const overheadCost = Number(p.overhead_cost ?? p.overheadCost ?? p.indirect_overhead ?? 0);
    const packagingCost = Number(p.packaging_cost ?? p.packagingCost ?? p.packaging ?? 0);
    const totalUnitCost = Number(p.total_unit_cost ?? p.totalUnitCost ?? (materialCost + laborCost + overheadCost));
    const profitMargin = Number(p.profit_margin ?? p.profitMargin ?? (salePrice - totalUnitCost));
    const marginPct = salePrice > 0 ? Number(((profitMargin / salePrice) * 100).toFixed(1)) : 0;
    const foodCostPct = salePrice > 0 ? Number(((materialCost / salePrice) * 100).toFixed(1)) : 0;
    const hasRecipe = Boolean(p.has_recipe || p.hasRecipe || Number(p.ingredients_count) > 0 || p.production_bom_id || p.recipe_id);
    const recipeName = p.recipe_name || p.bom_name || (hasRecipe ? 'وصفة مسجلة' : 'غير متوفرة');
    const ingredientsCount = Number(p.ingredients_count || 0);
    
    let rating = 'لا توجد وصفة مسجلة';
    if (hasRecipe || totalUnitCost > 0) {
      if (marginPct >= 50) rating = 'ممتاز - ربحية عالية';
      else if (marginPct >= 30) rating = 'جيد - ضمن المستهدف';
      else if (marginPct > 0) rating = 'منخفض - يحتاج مراجعة';
      else rating = 'خاسر / بدون هامش';
    }

    let pricingHealth = 'بدون وصفة';
    if (hasRecipe || totalUnitCost > 0) {
      if (foodCostPct > 0 && foodCostPct <= 35) pricingHealth = 'صحي ومثالي';
      else if (foodCostPct > 35) pricingHealth = 'مرتفع التكلفة';
      else pricingHealth = 'بحاجة لبيانات';
    }

    return {
      id: p.id || `prd_${i + 1}`,
      code: p.code || p.item_code || p.sku || `PRD-${p.id || (i + 1)}`,
      name: p.name || 'منتج غير مسمى',
      category: p.category || 'عام',
      unit: p.unit || 'وحدة',
      salePrice,
      sellingPrice: salePrice,
      materialCost,
      ingredientCost: materialCost,
      laborCost,
      overheadCost,
      operationalCost: overheadCost,
      packagingCost,
      totalUnitCost,
      unitCost: totalUnitCost,
      profitMargin,
      grossProfit: profitMargin,
      marginPct,
      foodCostPct,
      suggestedPrice: totalUnitCost > 0 ? Number((totalUnitCost * 1.4).toFixed(2)) : 0,
      rating,
      pricingHealth,
      hasRecipe,
      recipeName,
      ingredientsCount,
      branchId: p.branch_id || p.branchId,
      costCenterId: p.cost_center_id || p.costCenterId
    };
  }) : [];

  const activeBranches = Array.isArray(params.branches) ? params.branches.map((b, i) => ({
    id: b.id || i + 1,
    code: b.code || `BR-${String(b.id || i + 1).padStart(2, '0')}`,
    name: b.name || `فرع ${i + 1}`,
    location: b.location || b.address || 'الفرع الرئيسي',
    laborCost: Number(b.labor_cost || 0),
    operatingCost: Number(b.operating_cost || 0),
    materialsCost: Number(b.materials_cost || 0),
    totalBranchCost: Number(b.total_cost || b.total_branch_cost || 0),
    salesTotal: Number(b.sales_total || 0),
    staffCount: Number(b.staff_count || 0)
  })) : [];

  const activeEmployees = Array.isArray(params.employees) ? params.employees.map((e, i) => ({
    id: e.id || i + 1,
    code: e.code || `EMP-${String(e.id || i + 1).padStart(3, '0')}`,
    name: e.name || 'موظف',
    dept: e.department || e.dept || 'إدارة التشغيل',
    role: e.job_title || e.role || 'فني تشغيل',
    laborType: e.labor_type || (i % 2 === 0 ? 'عمالة مباشرة' : 'عمالة غير مباشرة'),
    baseSalary: Number(e.base_salary || e.basic_salary || e.salary || 0),
    allowances: Number(e.allowances || 0),
    branch: e.branch || 'الفرع الرئيسي'
  })) : [];

  const activeIngredients = Array.isArray(params.ingredients) ? params.ingredients.map((ing, i) => {
    const unitPrice = Number(ing.unit_cost ?? ing.unitPrice ?? ing.cost_price ?? ing.avg_cost ?? ing.cost ?? ing.last_purchase_price ?? 0);
    const consumedQty = Number(ing.quantity ?? ing.consumedQty ?? ing.current_stock ?? 0);
    const wastePercent = Number(ing.waste_percent ?? ing.wastePercent ?? 0);
    const totalCost = Number(ing.total_cost ?? (unitPrice * consumedQty).toFixed(2));
    return {
      id: ing.id || (i + 1),
      code: ing.code || ing.item_code || `ING-${ing.id || (i + 1)}`,
      name: ing.name || 'خامة أولية',
      unit: ing.unit || 'كجم',
      unitPrice,
      consumedQty,
      wastePercent,
      totalCost,
      warehouse: ing.warehouse || ing.warehouse_name || 'المخزن الرئيسي'
    };
  }) : [];

  const activeSuppliers = Array.isArray(params.suppliers) ? params.suppliers.map((s, i) => ({
    id: s.id || (i + 1),
    name: s.name || 'مورد',
    type: s.type || s.category || 'توريدات عامة',
    invoicesCount: Number(s.invoices_count || s.invoicesCount || 0),
    totalPurchases: Number(s.total_purchases || s.totalPurchases || s.balance || 0)
  })) : [];

  const activeBudgets = Array.isArray(params.budgets) ? params.budgets : [];

  const activeTransactions = realCosts.map((c, i) => ({
    voucherNo: c.voucher_no || `V-${String(i + 1).padStart(4, '0')}`,
    date: c.date ? c.date.split('T')[0] : (c.created_at ? c.created_at.split('T')[0] : ''),
    costItem: c.cost_item_name || c.category || 'مصروفات عامة',
    costCenter: c.cost_center_name || 'المركز الرئيسي',
    branch: c.branch || 'الفرع الرئيسي',
    payMethod: c.payment_method || 'تحويل بنكي',
    netAmount: Number(c.amount || 0),
    taxAmount: Number(c.tax || c.vat || 0),
    totalAmount: Number(c.total || c.amount || 0),
    status: ['approved', 'معتمد', 'موافق عليه'].includes(String(c.approval_status || c.status).toLowerCase()) ? 'معتمد' : 'معلق',
    approvedBy: c.approved_by || 'المدير المالي',
    glEntry: c.gl_entry || `JV-${40000 + i}`,
    createdBy: c.created_by || 'المحاسب',
    priority: c.priority || 'عادية'
  }));

  let rows: any[] = [];
  let kpiValues: Record<string, any> = {};
  let chartData: any[] = [];
  let totalValue = 0;

  // Dispatch data computation based on report definition category and ID
  switch (def.id) {
    // -------------------------------------------------------------
    // OPERATIONAL REPORTS
    // -------------------------------------------------------------
    case 'report_op_summary': {
      const grouped: Record<string, { total: number; approved: number; pending: number; count: number }> = {};
      activeTransactions.forEach(t => {
        const cat = t.costItem;
        if (!grouped[cat]) grouped[cat] = { total: 0, approved: 0, pending: 0, count: 0 };
        grouped[cat].total += t.totalAmount;
        grouped[cat].count += 1;
        if (t.status === 'معتمد') grouped[cat].approved += t.totalAmount;
        else grouped[cat].pending += t.totalAmount;
      });

      const totalAll = Object.values(grouped).reduce((s, g) => s + g.total, 0);
      rows = Object.entries(grouped).map(([cat, data]) => ({
        name: cat,
        costType: data.total > 100000 ? 'تكلفة تشغيلية كبرى' : 'تكلفة دورية',
        txnCount: data.count,
        approvedValue: data.approved,
        pendingValue: data.pending,
        totalValue: data.total,
        percentage: totalAll > 0 ? (data.total / totalAll) * 100 : 0
      })).sort((a, b) => b.totalValue - a.totalValue);

      totalValue = totalAll;
      chartData = rows.map(r => ({ name: r.name, value: r.totalValue, approved: r.approvedValue, pending: r.pendingValue }));
      kpiValues = {
        totalCost: totalAll,
        txnCount: activeTransactions.length,
        avgCost: activeTransactions.length ? Math.round(totalAll / activeTransactions.length) : 0,
        topCategory: rows[0]?.name || '-'
      };
      break;
    }

    case 'report_op_daily': {
      const dayMap: Record<string, { cash: number; bank: number; total: number; count: number }> = {};
      activeTransactions.forEach(t => {
        const d = t.date;
        if (!d) return;
        if (!dayMap[d]) dayMap[d] = { cash: 0, bank: 0, total: 0, count: 0 };
        dayMap[d].total += t.totalAmount;
        dayMap[d].count += 1;
        if (t.payMethod.includes('خزينة') || t.payMethod.includes('كاش')) dayMap[d].cash += t.totalAmount;
        else dayMap[d].bank += t.totalAmount;
      });

      const sortedDates = Object.keys(dayMap).sort();
      let prev = 0;
      rows = sortedDates.map(d => {
        const info = dayMap[d];
        const growth = prev > 0 ? ((info.total - prev) / prev) * 100 : 0;
        prev = info.total;
        const dateObj = new Date(d);
        const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        return {
          date: d,
          dayName: Number.isNaN(dateObj.getDay()) ? 'يومي' : dayNames[dateObj.getDay()],
          txnCount: info.count,
          cashAmount: info.cash,
          bankAmount: info.bank,
          totalValue: info.total,
          growthRate: growth
        };
      });

      totalValue = rows.reduce((s, r) => s + r.totalValue, 0);
      const topDay = [...rows].sort((a, b) => b.totalValue - a.totalValue)[0];
      chartData = rows.map(r => ({ name: r.date, value: r.totalValue, cash: r.cashAmount, bank: r.bankAmount }));
      kpiValues = {
        totalCost: totalValue,
        peakDay: topDay?.date || '-',
        avgDaily: rows.length ? Math.round(totalValue / rows.length) : 0,
        daysCount: rows.length
      };
      break;
    }

    case 'report_op_transactions': {
      rows = activeTransactions;
      totalValue = rows.reduce((s, r) => s + r.totalAmount, 0);
      chartData = rows.slice(0, 15).map(r => ({ name: r.voucherNo, value: r.totalAmount, tax: r.taxAmount }));
      kpiValues = {
        txnCount: rows.length,
        netAmount: rows.reduce((s, r) => s + r.netAmount, 0),
        vatAmount: rows.reduce((s, r) => s + r.taxAmount, 0),
        totalCost: totalValue
      };
      break;
    }

    case 'report_op_approved': {
      rows = activeTransactions.filter(t => t.status === 'معتمد');
      totalValue = rows.reduce((s, r) => s + r.totalAmount, 0);
      chartData = rows.map(r => ({ name: r.voucherNo, value: r.totalAmount }));
      kpiValues = {
        approvedTotal: totalValue,
        approvedCount: rows.length,
        approvalRate: activeTransactions.length > 0 ? Math.round((rows.length / activeTransactions.length) * 100) : 0,
        lastApprovedDate: rows[0]?.date || '-'
      };
      break;
    }

    case 'report_op_pending': {
      rows = activeTransactions.filter(t => t.status === 'معلق');
      totalValue = rows.reduce((s, r) => s + Number(r.totalAmount || 0), 0);
      chartData = rows.map(r => ({ name: r.voucherNo, value: Number(r.totalAmount || 0) }));
      const maxPendingVal = rows.length > 0 ? Math.max(...rows.map(r => Number(r.totalAmount || 0))) : 0;
      kpiValues = {
        pendingTotal: totalValue,
        pendingCount: rows.length,
        maxPending: maxPendingVal,
        requiredRole: 'المدير المالي'
      };
      break;
    }

    // -------------------------------------------------------------
    // COST CENTERS REPORTS
    // -------------------------------------------------------------
    case 'report_cc_all':
    case 'report_cc_highest':
    case 'report_cc_lowest':
    case 'report_cc_compare': {
      const totalBudget = activeCenters.reduce((s, c) => s + c.budget, 0);
      const totalActual = activeCenters.reduce((s, c) => s + c.actual, 0);

      let processed = activeCenters.map(c => {
        const remaining = c.budget - c.actual;
        const rate = c.budget > 0 ? (c.actual / c.budget) * 100 : 0;
        const share = totalActual > 0 ? (c.actual / totalActual) * 100 : 0;
        let status = 'آمن - ضمن الحدود';
        if (rate > 100) status = 'تجاوز الموازنة';
        else if (rate >= 90) status = 'تحذير - اقترب من الحد';
        return {
          code: c.code,
          name: c.name,
          type: c.type,
          department: c.department,
          manager: c.manager,
          budget: c.budget,
          actual: c.actual,
          remaining,
          consumptionRate: rate,
          sharePct: share,
          variance: remaining,
          efficiency: rate <= 95 ? 'عالي الكفاءة' : 'يحتاج ترشيد',
          status,
          riskLevel: rate > 100 ? 'مرتفع' : 'طبيعي',
          savingsAmount: Math.max(0, remaining)
        };
      });

      if (def.id === 'report_cc_highest') {
        processed = processed.sort((a, b) => b.actual - a.actual);
      } else if (def.id === 'report_cc_lowest') {
        processed = processed.sort((a, b) => a.actual - b.actual);
      } else {
        processed = processed.sort((a, b) => b.actual - a.actual);
      }

      rows = processed.map((p, idx) => ({ ...p, rank: `#${idx + 1}` }));
      totalValue = totalActual;
      chartData = rows.map(r => ({ name: r.name, value: r.actual, budget: r.budget, actual: r.actual }));
      kpiValues = {
        totalActualCosts: totalActual,
        totalBudgets: totalBudget,
        centersCount: rows.length,
        avgCenterConsumption: rows.length ? Math.round(totalActual / rows.length) : 0,
        highestCenter: rows[0]?.name || '-',
        lowestCenter: rows[rows.length - 1]?.name || '-',
        maxRiskCenter: rows.find(r => r.consumptionRate > 100)?.name || 'لا يوجد تجاوز',
        overallBurnRate: totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0
      };
      break;
    }

    // -------------------------------------------------------------
    // COST ITEMS REPORTS
    // -------------------------------------------------------------
    case 'report_item_all':
    case 'report_item_direct':
    case 'report_item_indirect':
    case 'report_item_variable':
    case 'report_item_fixed': {
      let filtered = activeItems;
      if (def.id === 'report_item_direct') filtered = activeItems.filter(i => i.nature === 'مباشرة');
      else if (def.id === 'report_item_indirect') filtered = activeItems.filter(i => i.nature === 'غير مباشرة');
      else if (def.id === 'report_item_variable') filtered = activeItems.filter(i => i.behavior === 'متغيرة');
      else if (def.id === 'report_item_fixed') filtered = activeItems.filter(i => i.behavior === 'ثابتة');

      const sumItems = filtered.reduce((s, it) => s + it.spentAmount, 0);
      rows = filtered.map(it => ({
        code: it.code,
        name: it.name,
        nature: it.nature,
        behavior: it.behavior,
        glAccount: it.glAccount,
        spentAmount: it.spentAmount,
        totalAmount: it.spentAmount,
        sharePct: sumItems > 0 ? (it.spentAmount / sumItems) * 100 : 0,
        fixedPortion: it.behavior === 'ثابتة' ? it.spentAmount : 0,
        variablePortion: it.behavior === 'متغيرة' ? it.spentAmount : 0,
        costType: it.nature
      })).sort((a, b) => b.spentAmount - a.spentAmount);

      totalValue = sumItems;
      chartData = rows.map(r => ({ name: r.name, value: r.spentAmount }));
      kpiValues = {
        totalItemsCost: sumItems,
        itemsCount: rows.length,
        directCostTotal: rows.filter(r => r.nature === 'مباشرة').reduce((s, r) => s + r.spentAmount, 0),
        indirectCostTotal: rows.filter(r => r.nature === 'غير مباشرة').reduce((s, r) => s + r.spentAmount, 0),
        topCostItem: rows[0]?.name || '-',
        avgItemCost: rows.length ? Math.round(sumItems / rows.length) : 0
      };
      break;
    }

    // -------------------------------------------------------------
    // PRODUCTS COSTING & BOM REPORTS (REAL DATABASE JOIN DATA)
    // -------------------------------------------------------------
    case 'report_prod_cost':
    case 'report_prod_unit':
    case 'report_prod_margin': {
      rows = activeProducts.map(p => {
        return {
          code: p.code,
          name: p.name,
          category: p.category,
          unit: p.unit,
          salePrice: p.salePrice,
          sellingPrice: p.salePrice,
          materialCost: p.materialCost,
          ingredientCost: p.materialCost,
          packagingCost: p.packagingCost,
          operationalCost: p.overheadCost,
          laborCost: p.laborCost,
          overheadCost: p.overheadCost,
          totalUnitCost: p.totalUnitCost,
          unitCost: p.totalUnitCost,
          profitMargin: p.profitMargin,
          grossProfit: p.profitMargin,
          marginPct: p.marginPct,
          foodCostPct: p.foodCostPct,
          suggestedPrice: p.suggestedPrice,
          rating: p.rating,
          pricingHealth: p.pricingHealth,
          hasRecipe: p.hasRecipe,
          recipeName: p.recipeName,
          ingredientsCount: p.ingredientsCount
        };
      });

      if (def.id === 'report_prod_margin') {
        rows = rows.sort((a, b) => b.marginPct - a.marginPct);
      } else {
        rows = rows.sort((a, b) => (b.hasRecipe ? 1 : 0) - (a.hasRecipe ? 1 : 0) || b.totalUnitCost - a.totalUnitCost);
      }

      totalValue = rows.reduce((s, r) => s + r.totalUnitCost, 0);
      chartData = rows.slice(0, 15).map(r => ({
        name: r.name,
        cost: r.totalUnitCost,
        price: r.salePrice,
        profit: r.profitMargin,
        value: r.totalUnitCost
      }));

      const pricedRows = rows.filter(r => r.hasRecipe || r.totalUnitCost > 0);
      const avgCost = pricedRows.length > 0 ? pricedRows.reduce((s, r) => s + r.totalUnitCost, 0) / pricedRows.length : 0;
      const avgMargin = pricedRows.length > 0 ? pricedRows.reduce((s, r) => s + r.marginPct, 0) / pricedRows.length : 0;
      const avgFoodCost = pricedRows.length > 0 ? pricedRows.reduce((s, r) => s + r.foodCostPct, 0) / pricedRows.length : 0;
      const sortedByCost = [...pricedRows].sort((a, b) => b.totalUnitCost - a.totalUnitCost);

      kpiValues = {
        avgProductCost: Math.round(avgCost),
        avgMarginPct: Number(avgMargin.toFixed(1)),
        avgFoodCostPct: Number(avgFoodCost.toFixed(1)),
        productsCount: rows.length,
        maxCostProd: sortedByCost[0]?.name || '-',
        minCostProd: sortedByCost[sortedByCost.length - 1]?.name || '-',
        avgUnitCost: Math.round(avgCost),
        pricedCount: pricedRows.length,
        topMargin: pricedRows.length > 0 ? Math.max(...pricedRows.map(r => r.marginPct)) : 0,
        lowestMargin: pricedRows.length > 0 ? Math.min(...pricedRows.map(r => r.marginPct)) : 0,
        expectedProfit: pricedRows.reduce((s, r) => s + (r.profitMargin * 100), 0),
        repriceCount: pricedRows.filter(r => r.marginPct < 30).length
      };
      break;
    }

    case 'report_prod_material': {
      rows = activeIngredients.map(ing => ({
        code: ing.code,
        name: ing.name,
        unit: ing.unit,
        unitPrice: ing.unitPrice,
        consumedQty: ing.consumedQty,
        wastePercent: ing.wastePercent,
        totalCost: ing.totalCost,
        warehouse: ing.warehouse
      }));
      totalValue = rows.reduce((s, r) => s + r.totalCost, 0);
      chartData = rows.slice(0, 15).map(r => ({ name: r.name, value: r.totalCost }));
      const sortedIngs = [...rows].sort((a, b) => b.totalCost - a.totalCost);
      kpiValues = {
        totalIngredients: totalValue,
        topIngredient: sortedIngs[0]?.name || '-',
        avgScrap: rows.length > 0 ? Number((rows.reduce((s, r) => s + r.wastePercent, 0) / rows.length).toFixed(1)) : 0,
        ingredientsCount: rows.length
      };
      break;
    }

    case 'report_prod_operation': {
      // Real operational breakdown based on product costs or general expenses
      const laborTotal = activeProducts.reduce((s, p) => s + p.laborCost, 0);
      const overheadTotal = activeProducts.reduce((s, p) => s + p.overheadCost, 0);
      const packagingTotal = activeProducts.reduce((s, p) => s + p.packagingCost, 0);

      rows = [];
      if (laborTotal > 0) {
        rows.push({
          overheadType: 'أجور ورواتب العمالة المباشرة للطهي والإنتاج',
          allocationBase: 'ساعات العمل والإنتاج الفعلي',
          ratePerHour: 35,
          allocatedAmount: laborTotal,
          sharePct: 0
        });
      }
      if (overheadTotal > 0) {
        rows.push({
          overheadType: 'استهلاك طاقة كهربائية وغاز ومرافق تصنيع',
          allocationBase: 'ساعات تشغيل الأفران والمعدات',
          ratePerHour: 45,
          allocatedAmount: overheadTotal * 0.5,
          sharePct: 0
        });
        rows.push({
          overheadType: 'صيانة وقائية وإهلاك آلات ومعدات',
          allocationBase: 'القسط الثابت الشهري',
          ratePerHour: 30,
          allocatedAmount: overheadTotal * 0.5,
          sharePct: 0
        });
      }
      if (packagingTotal > 0) {
        rows.push({
          overheadType: 'مستلزمات التعبئة والتغليف وأكياس التسليم',
          allocationBase: 'حجم الإنتاج الفعلي بالوحدة',
          ratePerHour: 15,
          allocatedAmount: packagingTotal,
          sharePct: 0
        });
      }

      totalValue = rows.reduce((s, r) => s + r.allocatedAmount, 0);
      rows = rows.map(r => ({
        ...r,
        sharePct: totalValue > 0 ? Number(((r.allocatedAmount / totalValue) * 100).toFixed(1)) : 0
      }));
      chartData = rows.map(r => ({ name: r.overheadType, value: r.allocatedAmount }));
      kpiValues = {
        totalOverhead: totalValue,
        hourlyRate: rows.length > 0 ? 120 : 0,
        energyCost: overheadTotal * 0.5,
        maintCost: overheadTotal * 0.5
      };
      break;
    }

    // -------------------------------------------------------------
    // BRANCHES COSTING REPORTS
    // -------------------------------------------------------------
    case 'report_branch_cost':
    case 'report_branch_compare':
    case 'report_branch_profit': {
      const totalAllCosts = activeBranches.reduce((s, b) => s + b.totalBranchCost, 0);
      const totalAllSales = activeBranches.reduce((s, b) => s + b.salesTotal, 0);

      rows = activeBranches.map(b => {
        const netProfit = b.salesTotal - b.totalBranchCost;
        const profitMargin = b.salesTotal > 0 ? (netProfit / b.salesTotal) * 100 : 0;
        const costToSales = b.salesTotal > 0 ? (b.totalBranchCost / b.salesTotal) * 100 : 0;
        return {
          code: b.code,
          name: b.name,
          location: b.location,
          branch: b.name,
          laborCost: b.laborCost,
          operatingCost: b.operatingCost,
          rentOpsCost: b.operatingCost,
          materialsCost: b.materialsCost,
          totalBranchCost: b.totalBranchCost,
          totalCost: b.totalBranchCost,
          salesTotal: b.salesTotal,
          revenue: b.salesTotal,
          netProfit,
          profitMargin,
          marginPct: profitMargin,
          costToSales,
          staffCount: b.staffCount,
          laborCostPerStaff: b.staffCount > 0 ? Math.round(b.laborCost / b.staffCount) : 0,
          efficiencyRating: costToSales <= 40 ? 'عالي الربحية' : 'متوسط الأداء',
          sharePct: totalAllCosts > 0 ? (b.totalBranchCost / totalAllCosts) * 100 : 0
        };
      });

      totalValue = totalAllCosts;
      chartData = rows.map(r => ({ name: r.name, value: r.totalBranchCost, sales: r.salesTotal, profit: r.netProfit }));
      kpiValues = {
        totalAllBranchesCost: totalAllCosts,
        totalBranchesRevenue: totalAllSales,
        branchesCount: rows.length,
        avgBranchCost: rows.length ? Math.round(totalAllCosts / rows.length) : 0,
        highestCostBranch: rows.sort((a, b) => b.totalBranchCost - a.totalBranchCost)[0]?.name || '-',
        mostProfitableBranch: rows.sort((a, b) => b.netProfit - a.netProfit)[0]?.name || '-',
        overallBranchProfitMargin: totalAllSales > 0 ? ((totalAllSales - totalAllCosts) / totalAllSales) * 100 : 0
      };
      break;
    }

    // -------------------------------------------------------------
    // BUDGETS & VARIANCE REPORTS
    // -------------------------------------------------------------
    case 'report_bud_status':
    case 'report_bud_variance':
    case 'report_bud_burn': {
      rows = activeBudgets.map((b, i) => {
        const planned = Number(b.amount || b.budget_amount || 0);
        const actual = Number(b.spent || b.actual_amount || 0);
        const variance = planned - actual;
        const burnRate = planned > 0 ? (actual / planned) * 100 : 0;
        let status = 'ضمن الموازنة';
        if (burnRate > 100) status = 'تجاوز';
        else if (burnRate >= 90) status = 'تحذير';
        return {
          code: b.code || `BDG-${i + 1}`,
          name: b.name || b.category || 'موازنة تشغيلية',
          category: b.category || 'عام',
          budgetPeriod: b.period || 'سنوي 2026',
          allocatedBudget: planned,
          budgetCap: planned,
          actualSpent: actual,
          actual: actual,
          varianceAmount: variance,
          variance: variance,
          burnRatePct: burnRate,
          burnRate: burnRate,
          remainingBudget: Math.max(0, variance),
          status,
          healthStatus: burnRate <= 95 ? 'ممتاز' : 'حرج'
        };
      });

      totalValue = rows.reduce((s, r) => s + r.actualSpent, 0);
      chartData = rows.map(r => ({ name: r.name, budget: r.allocatedBudget, actual: r.actualSpent, value: r.actualSpent }));
      kpiValues = {
        totalAllocatedBudget: rows.reduce((s, r) => s + r.allocatedBudget, 0),
        totalSpent: totalValue,
        budgetSaved: rows.reduce((s, r) => s + Math.max(0, r.varianceAmount), 0),
        avgBurnRate: rows.length ? Number((rows.reduce((s, r) => s + r.burnRatePct, 0) / rows.length).toFixed(1)) : 0
      };
      break;
    }

    // -------------------------------------------------------------
    // DEFAULT & ANALYTICAL CHARTS
    // -------------------------------------------------------------
    default: {
      if (def.id.includes('prod') || def.id.includes('product')) {
        rows = activeProducts.map(p => ({
          name: p.name,
          code: p.code,
          category: p.category,
          salePrice: p.salePrice,
          totalUnitCost: p.totalUnitCost,
          profitMargin: p.profitMargin,
          marginPct: p.marginPct,
          foodCostPct: p.foodCostPct,
          rating: p.rating,
          hasRecipe: p.hasRecipe
        }));
        totalValue = rows.reduce((s, r) => s + r.totalUnitCost, 0);
        chartData = rows.slice(0, 15).map(r => ({ name: r.name, value: r.totalUnitCost, price: r.salePrice, profit: r.profitMargin }));
        kpiValues = {
          totalCost: totalValue,
          productsCount: rows.length,
          avgProductCost: rows.length ? Math.round(totalValue / rows.length) : 0
        };
      } else {
        rows = activeCenters.map(c => ({
          name: c.name,
          budget: c.budget,
          actual: c.actual,
          amount: c.actual,
          variance: c.budget - c.actual,
          sharePct: 20.0
        }));
        totalValue = rows.reduce((s, r) => s + r.actual, 0);
        chartData = rows.map(r => ({ name: r.name, value: r.actual, budget: r.budget, actual: r.actual }));
        kpiValues = {
          totalCost: totalValue,
          topCenter: rows[0]?.name || '-',
          centersCount: rows.length,
          avgCenterCost: rows.length ? Math.round(totalValue / rows.length) : 0
        };
      }
      break;
    }
  }

  // Apply filters (Search query, branch, center)
  if (params.filters) {
    const q = (params.filters.search || '').trim().toLowerCase();
    const branch = params.filters.branch;
    const center = params.filters.center;

    if (q) {
      rows = rows.filter(r => {
        return Object.values(r).some(val => val !== undefined && val !== null && String(val).toLowerCase().includes(q));
      });
    }

    if (branch && branch !== 'all') {
      rows = rows.filter(r => !r.branch || r.branch.includes(branch) || r.name?.includes(branch));
    }

    if (center && center !== 'all') {
      rows = rows.filter(r => !r.costCenter || r.costCenter.includes(center) || r.name?.includes(center));
    }
  }

  return {
    definition: def,
    rows,
    kpiValues,
    chartData,
    totalValue
  };
}
