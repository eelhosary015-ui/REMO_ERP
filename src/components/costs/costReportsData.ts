// Cost Reports Configuration and Domain Data Engine
export interface CostReportDefinition {
  id: string;
  category: 'operational' | 'centers' | 'items' | 'products' | 'projects' | 'branches' | 'employees' | 'budgets' | 'analytics';
  categoryLabel: string;
  title: string;
  subtitle: string;
  iconName: string;
  chartType: 'bar' | 'pie' | 'line' | 'area' | 'horizontal_bar' | 'table_only';
  kpis: {
    label: string;
    valueKey: string;
    isCurrency?: boolean;
    isPercent?: boolean;
    subtext?: string;
    trend?: 'up' | 'down' | 'neutral';
    color?: string;
  }[];
  columns: {
    key: string;
    label: string;
    isCurrency?: boolean;
    isPercent?: boolean;
    isBadge?: boolean;
    badgeColorKey?: string;
    align?: 'right' | 'center' | 'left';
    width?: string;
  }[];
}

export const COST_REPORT_CATEGORIES = [
  { id: 'all', label: 'كافة التقارير', icon: 'Layers', count: 52 },
  { id: 'operational', label: 'التقارير التشغيلية', icon: 'FileText', count: 8 },
  { id: 'centers', label: 'مراكز التكلفة', icon: 'Layers', count: 5 },
  { id: 'items', label: 'عناصر التكلفة', icon: 'Tag', count: 4 },
  { id: 'products', label: 'تكاليف المنتجات', icon: 'Package', count: 5 },
  { id: 'projects', label: 'تكاليف المشاريع', icon: 'Briefcase', count: 4 },
  { id: 'branches', label: 'تكاليف الفروع', icon: 'Building', count: 3 },
  { id: 'employees', label: 'تكاليف العمالة', icon: 'Users', count: 4 },
  { id: 'budgets', label: 'الموازنات والانحرافات', icon: 'Percent', count: 8 },
  { id: 'analytics', label: 'التحليلات والرسوم', icon: 'BarChart3', count: 11 },
];

export const COST_REPORTS_REGISTRY: Record<string, CostReportDefinition> = {
  // 1. Operational Reports
  report_op_summary: {
    id: 'report_op_summary',
    category: 'operational',
    categoryLabel: 'التقارير التشغيلية',
    title: 'ملخص التكاليف التشغيلية',
    subtitle: 'إجمالي التكاليف مصنفة حسب طبيعتها ونوع الإنفاق ومعدلات التوزيع',
    iconName: 'FileText',
    chartType: 'bar',
    kpis: [
      { label: 'إجمالي التكاليف', valueKey: 'totalCost', isCurrency: true, subtext: 'الفترة الحالية' },
      { label: 'عدد العمليات', valueKey: 'txnCount', subtext: 'سندات مسجلة' },
      { label: 'متوسط قيمة العملية', valueKey: 'avgCost', isCurrency: true, subtext: 'لكل سند' },
      { label: 'أعلى فئة تكلفة', valueKey: 'topCategory', subtext: 'الأكثر استنزافاً' }
    ],
    columns: [
      { key: 'name', label: 'فئة / تصنيف التكلفة', align: 'right' },
      { key: 'costType', label: 'طبيعة التكلفة', isBadge: true, align: 'center' },
      { key: 'txnCount', label: 'عدد السندات', align: 'center' },
      { key: 'approvedValue', label: 'المعتمد', isCurrency: true, align: 'right' },
      { key: 'pendingValue', label: 'المعلق', isCurrency: true, align: 'right' },
      { key: 'totalValue', label: 'إجمالي التكلفة', isCurrency: true, align: 'right' },
      { key: 'percentage', label: 'النسبة من الإجمالي', isPercent: true, align: 'center' }
    ]
  },
  report_op_daily: {
    id: 'report_op_daily',
    category: 'operational',
    categoryLabel: 'التقارير التشغيلية',
    title: 'تقرير التكاليف اليومية',
    subtitle: 'حركة الإنفاق وسندات الصرف اليومية والتوزيع الزمني للنفقات',
    iconName: 'Calendar',
    chartType: 'line',
    kpis: [
      { label: 'إجمالي التكلفة اليومية', valueKey: 'totalCost', isCurrency: true },
      { label: 'أعلى يوم إنفاقاً', valueKey: 'peakDay' },
      { label: 'متوسط الإنفاق اليومي', valueKey: 'avgDaily', isCurrency: true },
      { label: 'عدد الأيام المسجلة', valueKey: 'daysCount' }
    ],
    columns: [
      { key: 'date', label: 'التاريخ', align: 'right' },
      { key: 'dayName', label: 'اليوم', align: 'right' },
      { key: 'txnCount', label: 'عدد السندات', align: 'center' },
      { key: 'cashAmount', label: 'نقدي / خزينة', isCurrency: true, align: 'right' },
      { key: 'bankAmount', label: 'بنكي / آجل', isCurrency: true, align: 'right' },
      { key: 'totalValue', label: 'إجمالي المصروف', isCurrency: true, align: 'right' },
      { key: 'growthRate', label: 'مقارنة باليوم السابق', isPercent: true, align: 'center' }
    ]
  },
  report_op_weekly: {
    id: 'report_op_weekly',
    category: 'operational',
    categoryLabel: 'التقارير التشغيلية',
    title: 'تقرير التكاليف الأسبوعية',
    subtitle: 'متابعة الإنفاق أسبوعياً ودراسة دورة التدفقات النقدية الخارجة',
    iconName: 'Calendar',
    chartType: 'bar',
    kpis: [
      { label: 'إجمالي إنفاق الأسابيع', valueKey: 'totalCost', isCurrency: true },
      { label: 'متوسط التكلفة الأسبوعية', valueKey: 'avgWeekly', isCurrency: true },
      { label: 'أعلى أسبوع إنفاقاً', valueKey: 'peakWeek' },
      { label: 'نسبة التغير الأسبوعي', valueKey: 'weeklyChange', isPercent: true }
    ],
    columns: [
      { key: 'weekLabel', label: 'الأسبوع / الفترة', align: 'right' },
      { key: 'startDate', label: 'بداية الأسبوع', align: 'center' },
      { key: 'endDate', label: 'نهاية الأسبوع', align: 'center' },
      { key: 'directCost', label: 'تكاليف مباشرة', isCurrency: true, align: 'right' },
      { key: 'indirectCost', label: 'تكاليف غير مباشرة', isCurrency: true, align: 'right' },
      { key: 'totalValue', label: 'إجمالي الأسبوع', isCurrency: true, align: 'right' },
      { key: 'trendStatus', label: 'مسار الإنفاق', isBadge: true, align: 'center' }
    ]
  },
  report_op_monthly: {
    id: 'report_op_monthly',
    category: 'operational',
    categoryLabel: 'التقارير التشغيلية',
    title: 'تقرير التكاليف الشهرية',
    subtitle: 'التطور الشهري للمصروفات ومعدل النمو المالي مقارنة بالموازنة',
    iconName: 'Calendar',
    chartType: 'area',
    kpis: [
      { label: 'إجمالي الإنفاق السنوي', valueKey: 'totalCost', isCurrency: true },
      { label: 'متوسط الإنفاق الشهري', valueKey: 'avgMonthly', isCurrency: true },
      { label: 'أعلى شهر إنفاقاً', valueKey: 'peakMonth' },
      { label: 'معدل التغير الشهري', valueKey: 'monthlyTrend', isPercent: true }
    ],
    columns: [
      { key: 'monthName', label: 'الشهر المالي', align: 'right' },
      { key: 'budgetCap', label: 'الموازنة الشهرية', isCurrency: true, align: 'right' },
      { key: 'actualSpent', label: 'المنصرف الفعلي', isCurrency: true, align: 'right' },
      { key: 'variance', label: 'الوفر / العجز', isCurrency: true, align: 'right' },
      { key: 'burnRate', label: 'نسبة الصرف', isPercent: true, align: 'center' },
      { key: 'status', label: 'حالة الشهر', isBadge: true, align: 'center' }
    ]
  },
  report_op_yearly: {
    id: 'report_op_yearly',
    category: 'operational',
    categoryLabel: 'التقارير التشغيلية',
    title: 'تقرير التكاليف السنوية',
    subtitle: 'توزيع التكاليف السنوية على مدار الأرباع المالية (Q1 - Q4)',
    iconName: 'Calendar',
    chartType: 'bar',
    kpis: [
      { label: 'إجمالي تكاليف السنة', valueKey: 'totalCost', isCurrency: true },
      { label: 'موازنة العام المعتمدة', valueKey: 'annualBudget', isCurrency: true },
      { label: 'وفر الموازنة السنوي', valueKey: 'budgetSaved', isCurrency: true },
      { label: 'نسبة استهلاك الموازنة', valueKey: 'annualBurn', isPercent: true }
    ],
    columns: [
      { key: 'quarterName', label: 'الربع المالي', align: 'right' },
      { key: 'plannedCost', label: 'المخطط', isCurrency: true, align: 'right' },
      { key: 'actualCost', label: 'الفعلي', isCurrency: true, align: 'right' },
      { key: 'diffAmount', label: 'الانحراف المالي', isCurrency: true, align: 'right' },
      { key: 'percentage', label: 'حصة الربع من التكلفة', isPercent: true, align: 'center' },
      { key: 'performance', label: 'الأداء والتقييم', isBadge: true, align: 'center' }
    ]
  },
  report_op_transactions: {
    id: 'report_op_transactions',
    category: 'operational',
    categoryLabel: 'التقارير التشغيلية',
    title: 'سجل عمليات وسندات التكاليف التفصيلي',
    subtitle: 'سجل قيود التكاليف المالي الكامل شاملاً أرقام السندات والبيان والمراكز',
    iconName: 'FileText',
    chartType: 'table_only',
    kpis: [
      { label: 'إجمالي السندات', valueKey: 'txnCount' },
      { label: 'إجمالي المبالغ الصافية', valueKey: 'netAmount', isCurrency: true },
      { label: 'إجمالي ضريبة القيمة المضافة', valueKey: 'vatAmount', isCurrency: true },
      { label: 'إجمالي السندات شامل الضريبة', valueKey: 'totalCost', isCurrency: true }
    ],
    columns: [
      { key: 'voucherNo', label: 'رقم السند', align: 'center' },
      { key: 'date', label: 'التاريخ', align: 'center' },
      { key: 'costItem', label: 'بند التكلفة', align: 'right' },
      { key: 'costCenter', label: 'مركز التكلفة', align: 'right' },
      { key: 'branch', label: 'الفرع', align: 'right' },
      { key: 'payMethod', label: 'طريقة الدفع', align: 'center' },
      { key: 'netAmount', label: 'المبلغ الصافي', isCurrency: true, align: 'right' },
      { key: 'taxAmount', label: 'الضريبة', isCurrency: true, align: 'right' },
      { key: 'totalAmount', label: 'الإجمالي', isCurrency: true, align: 'right' },
      { key: 'status', label: 'حالة السند', isBadge: true, align: 'center' }
    ]
  },
  report_op_approved: {
    id: 'report_op_approved',
    category: 'operational',
    categoryLabel: 'التقارير التشغيلية',
    title: 'تقرير العمليات المعتمدة',
    subtitle: 'سندات وعمليات التكاليف المعتمدة نهائياً والمرحلة للدفاتر',
    iconName: 'CheckCircle2',
    chartType: 'bar',
    kpis: [
      { label: 'قيمة العمليات المعتمدة', valueKey: 'approvedTotal', isCurrency: true },
      { label: 'عدد العمليات المعتمدة', valueKey: 'approvedCount' },
      { label: 'نسبة الاعتماد', valueKey: 'approvalRate', isPercent: true },
      { label: 'آخر اعتماد تم', valueKey: 'lastApprovedDate' }
    ],
    columns: [
      { key: 'voucherNo', label: 'رقم السند', align: 'center' },
      { key: 'date', label: 'تاريخ المستند', align: 'center' },
      { key: 'approvedBy', label: 'المعتمد', align: 'right' },
      { key: 'costItem', label: 'بند التكلفة', align: 'right' },
      { key: 'costCenter', label: 'مركز التكلفة', align: 'right' },
      { key: 'amount', label: 'المبلغ المعتمد', isCurrency: true, align: 'right' },
      { key: 'glEntry', label: 'القيد المحاسبي', align: 'center' }
    ]
  },
  report_op_pending: {
    id: 'report_op_pending',
    category: 'operational',
    categoryLabel: 'التقارير التشغيلية',
    title: 'تقرير العمليات المعلقة قيد المراجعة',
    subtitle: 'سندات ومطالبات التكاليف المعلقة التي تنتظر موافقة المسئولين الماليين',
    iconName: 'Clock',
    chartType: 'pie',
    kpis: [
      { label: 'إجمالي المبالغ المعلقة', valueKey: 'pendingTotal', isCurrency: true },
      { label: 'عدد السندات المعلقة', valueKey: 'pendingCount' },
      { label: 'أعلى سند معلق', valueKey: 'maxPending', isCurrency: true },
      { label: 'مستوى الاعتماد المطلوب', valueKey: 'requiredRole' }
    ],
    columns: [
      { key: 'voucherNo', label: 'رقم السند', align: 'center' },
      { key: 'date', label: 'تاريخ الإنشاء', align: 'center' },
      { key: 'createdBy', label: 'محرر السند', align: 'right' },
      { key: 'costItem', label: 'بند التكلفة', align: 'right' },
      { key: 'amount', label: 'المبلغ المطلوب', isCurrency: true, align: 'right' },
      { key: 'workflowLevel', label: 'مستوى التدقيق', align: 'center' },
      { key: 'priority', label: 'الأولوية', isBadge: true, align: 'center' }
    ]
  },

  // 2. Cost Centers Reports
  report_cc_all: {
    id: 'report_cc_all',
    category: 'centers',
    categoryLabel: 'مراكز التكلفة',
    title: 'تقرير مراكز التكلفة الشامل',
    subtitle: 'كشف تفصيلي لكافة مراكز التكلفة، موازناتها، التكاليف الفعلية ومعدل الكفاءة',
    iconName: 'Layers',
    chartType: 'bar',
    kpis: [
      { label: 'عدد مراكز التكلفة', valueKey: 'centersCount' },
      { label: 'إجمالي الموازنات', valueKey: 'totalBudget', isCurrency: true },
      { label: 'إجمالي المصروف الفعلي', valueKey: 'totalActual', isCurrency: true },
      { label: 'متوسط نسبة الاستهلاك', valueKey: 'avgConsumption', isPercent: true }
    ],
    columns: [
      { key: 'code', label: 'كود المركز', align: 'center' },
      { key: 'name', label: 'اسم مركز التكلفة', align: 'right' },
      { key: 'type', label: 'نوع المركز', isBadge: true, align: 'center' },
      { key: 'department', label: 'الإدارة المسئولة', align: 'right' },
      { key: 'manager', label: 'المشرف المسؤول', align: 'right' },
      { key: 'budget', label: 'الموازنة المرصودة', isCurrency: true, align: 'right' },
      { key: 'actual', label: 'المنصرف الفعلي', isCurrency: true, align: 'right' },
      { key: 'remaining', label: 'المتبقي', isCurrency: true, align: 'right' },
      { key: 'consumptionRate', label: 'نسبة الاستهلاك', isPercent: true, align: 'center' },
      { key: 'status', label: 'حالة المركز', isBadge: true, align: 'center' }
    ]
  },
  report_cc_compare: {
    id: 'report_cc_compare',
    category: 'centers',
    categoryLabel: 'مراكز التكلفة',
    title: 'مقارنة مراكز التكلفة',
    subtitle: 'مقارنة تحليلية لأداء المراكز التشغيلية، حصتها من التكلفة العامة والتباين',
    iconName: 'ArrowRightLeft',
    chartType: 'horizontal_bar',
    kpis: [
      { label: 'أعلى مركز استهلاكاً', valueKey: 'topSpender' },
      { label: 'أقل مركز استهلاكاً', valueKey: 'lowestSpender' },
      { label: 'متوسط تكلفة المركز', valueKey: 'avgCost', isCurrency: true },
      { label: 'مراكز تجاوزت الموازنة', valueKey: 'exceededCount' }
    ],
    columns: [
      { key: 'name', label: 'مركز التكلفة', align: 'right' },
      { key: 'actual', label: 'المنصرف الفعلي', isCurrency: true, align: 'right' },
      { key: 'budget', label: 'الموازنة المقدرة', isCurrency: true, align: 'right' },
      { key: 'variance', label: 'الفارق المالي', isCurrency: true, align: 'right' },
      { key: 'sharePct', label: 'الحصة من إجمالي الشركة', isPercent: true, align: 'center' },
      { key: 'efficiency', label: 'مؤشر الكفاءة', isBadge: true, align: 'center' }
    ]
  },
  report_cc_highest: {
    id: 'report_cc_highest',
    category: 'centers',
    categoryLabel: 'مراكز التكلفة',
    title: 'أعلى مراكز التكلفة استهلاكاً',
    subtitle: 'ترتيب تنازلي لأكثر مراكز التكلفة إنفاقاً وتأثيراً على الربحية',
    iconName: 'TrendingUp',
    chartType: 'bar',
    kpis: [
      { label: 'إجمالي إنفاق أعلى 5 مراكز', valueKey: 'top5Total', isCurrency: true },
      { label: 'نسبتها من التكلفة العامة', valueKey: 'top5Share', isPercent: true },
      { label: 'المركز الأول', valueKey: 'centerRank1' },
      { label: 'قيمة استهلاك المركز الأول', valueKey: 'centerRank1Val', isCurrency: true }
    ],
    columns: [
      { key: 'rank', label: 'الترتيب', align: 'center' },
      { key: 'name', label: 'اسم مركز التكلفة', align: 'right' },
      { key: 'category', label: 'النشاط', align: 'right' },
      { key: 'actual', label: 'إجمالي الإنفاق', isCurrency: true, align: 'right' },
      { key: 'sharePct', label: 'النسبة من الإجمالي', isPercent: true, align: 'center' },
      { key: 'riskLevel', label: 'مستوى الإنذار', isBadge: true, align: 'center' }
    ]
  },
  report_cc_lowest: {
    id: 'report_cc_lowest',
    category: 'centers',
    categoryLabel: 'مراكز التكلفة',
    title: 'أقل مراكز التكلفة استهلاكاً',
    subtitle: 'المراكز ذات الإنفاق الاقتصادي أو الأنشطة ذات التكلفة المنخفضة',
    iconName: 'TrendingDown',
    chartType: 'bar',
    kpis: [
      { label: 'إجمالي إنفاق أقل المراكز', valueKey: 'lowestTotal', isCurrency: true },
      { label: 'المركز الأقل تكلفة', valueKey: 'minSpender' },
      { label: 'قيمة إنفاقه', valueKey: 'minSpenderVal', isCurrency: true },
      { label: 'نسبة الوفر المحقق', valueKey: 'savingsRate', isPercent: true }
    ],
    columns: [
      { key: 'rank', label: 'الترتيب', align: 'center' },
      { key: 'name', label: 'اسم المركز', align: 'right' },
      { key: 'actual', label: 'المصروف الفعلي', isCurrency: true, align: 'right' },
      { key: 'budget', label: 'الموازنة', isCurrency: true, align: 'right' },
      { key: 'savingsAmount', label: 'الوفر المالي', isCurrency: true, align: 'right' },
      { key: 'status', label: 'التقييم', isBadge: true, align: 'center' }
    ]
  },
  report_cc_dept: {
    id: 'report_cc_dept',
    category: 'centers',
    categoryLabel: 'مراكز التكلفة',
    title: 'تكلفة الإدارات والأقسام',
    subtitle: 'توزيع النفقات التراكمية على الهيكل التنظيمي والإداري للمنشأة',
    iconName: 'Building2',
    chartType: 'pie',
    kpis: [
      { label: 'عدد الإدارات', valueKey: 'deptCount' },
      { label: 'أعلى إدارة تكلفة', valueKey: 'topDept' },
      { label: 'إجمالي تكاليف الإدارات', valueKey: 'totalCost', isCurrency: true },
      { label: 'متوسط تكلفة الإدارة', valueKey: 'avgDeptCost', isCurrency: true }
    ],
    columns: [
      { key: 'deptName', label: 'الإدارة / القسم', align: 'right' },
      { key: 'centersCount', label: 'عدد مراكز التكلفة التابعة', align: 'center' },
      { key: 'employeesCount', label: 'عدد الكادر', align: 'center' },
      { key: 'directCosts', label: 'تكاليف مباشرة', isCurrency: true, align: 'right' },
      { key: 'overheadCosts', label: 'مصاريف عمومية وإدارية', isCurrency: true, align: 'right' },
      { key: 'totalValue', label: 'إجمالي التكلفة', isCurrency: true, align: 'right' },
      { key: 'sharePct', label: 'النسبة من الموازنة العامة', isPercent: true, align: 'center' }
    ]
  },

  // 3. Cost Items Reports
  report_item_all: {
    id: 'report_item_all',
    category: 'items',
    categoryLabel: 'عناصر التكلفة',
    title: 'دليل عناصر وبنود التكلفة',
    subtitle: 'كشف بنود ومصادر التكاليف وتصنيفاتها المباشرة وغير المباشرة وحسابات الأستاذ',
    iconName: 'Tag',
    chartType: 'bar',
    kpis: [
      { label: 'عدد عناصر التكلفة', valueKey: 'itemsCount' },
      { label: 'تكاليف متغيرة', valueKey: 'variableCost', isCurrency: true },
      { label: 'تكاليف ثابتة', valueKey: 'fixedCost', isCurrency: true },
      { label: 'إجمالي بنود التكلفة', valueKey: 'totalCost', isCurrency: true }
    ],
    columns: [
      { key: 'code', label: 'كود البند', align: 'center' },
      { key: 'name', label: 'اسم عنصر التكلفة', align: 'right' },
      { key: 'nature', label: 'الطبيعة', isBadge: true, align: 'center' },
      { key: 'behavior', label: 'السلوك', isBadge: true, align: 'center' },
      { key: 'glAccount', label: 'الحساب المحاسبي المرتبط', align: 'right' },
      { key: 'spentAmount', label: 'المنصرف الفعلي', isCurrency: true, align: 'right' },
      { key: 'sharePct', label: 'النسبة من التكلفة', isPercent: true, align: 'center' }
    ]
  },
  report_item_expense: {
    id: 'report_item_expense',
    category: 'items',
    categoryLabel: 'عناصر التكلفة',
    title: 'تقرير المصروفات حسب العنصر',
    subtitle: 'حركات المصروفات الفعلية موزعة على كل بند من بنود الصرف',
    iconName: 'FileText',
    chartType: 'bar',
    kpis: [
      { label: 'إجمالي المصروفات', valueKey: 'totalCost', isCurrency: true },
      { label: 'أعلى بند مصروف', valueKey: 'topExpenseItem' },
      { label: 'عدد سندات المصروفات', valueKey: 'vouchersCount' },
      { label: 'متوسط قيمة البند', valueKey: 'avgExpense', isCurrency: true }
    ],
    columns: [
      { key: 'name', label: 'عنصر المصروف', align: 'right' },
      { key: 'category', label: 'التصنيف', align: 'center' },
      { key: 'txnCount', label: 'عدد العمليات', align: 'center' },
      { key: 'avgAmount', label: 'متوسط العملية', isCurrency: true, align: 'right' },
      { key: 'totalAmount', label: 'إجمالي المصروف', isCurrency: true, align: 'right' },
      { key: 'sharePct', label: 'النسبة', isPercent: true, align: 'center' }
    ]
  },
  report_item_compare: {
    id: 'report_item_compare',
    category: 'items',
    categoryLabel: 'عناصر التكلفة',
    title: 'مقارنة عناصر التكلفة',
    subtitle: 'مقارنة هيكلية بين التكاليف الثابتة والمتغيرة، المباشرة وغير المباشرة',
    iconName: 'ArrowRightLeft',
    chartType: 'pie',
    kpis: [
      { label: 'نسبة التكلفة المتغيرة', valueKey: 'variablePct', isPercent: true },
      { label: 'نسبة التكلفة الثابتة', valueKey: 'fixedPct', isPercent: true },
      { label: 'التكاليف المباشرة', valueKey: 'directAmount', isCurrency: true },
      { label: 'التكاليف غير المباشرة', valueKey: 'indirectAmount', isCurrency: true }
    ],
    columns: [
      { key: 'groupName', label: 'مجموعة التكلفة', align: 'right' },
      { key: 'itemsCount', label: 'عدد البنود', align: 'center' },
      { key: 'amount', label: 'المبلغ الإجمالي', isCurrency: true, align: 'right' },
      { key: 'sharePct', label: 'النسبة المئوية', isPercent: true, align: 'center' },
      { key: 'impact', label: 'التأثير على التكلفة', isBadge: true, align: 'center' }
    ]
  },
  report_item_highest: {
    id: 'report_item_highest',
    category: 'items',
    categoryLabel: 'عناصر التكلفة',
    title: 'أعلى عناصر وبنود التكلفة',
    subtitle: 'قائمة بأكبر 10 بنود تكلفة مسببة للإنفاق (Cost Drivers)',
    iconName: 'TrendingUp',
    chartType: 'horizontal_bar',
    kpis: [
      { label: 'إجمالي أعلى 10 بنود', valueKey: 'top10Total', isCurrency: true },
      { label: 'نسبة تركز التكلفة', valueKey: 'top10Share', isPercent: true },
      { label: 'أكبر بند تكلفة', valueKey: 'topItemName' },
      { label: 'قيمته', valueKey: 'topItemVal', isCurrency: true }
    ],
    columns: [
      { key: 'rank', label: 'الترتيب', align: 'center' },
      { key: 'name', label: 'بند التكلفة', align: 'right' },
      { key: 'category', label: 'النوع', align: 'center' },
      { key: 'amount', label: 'إجمالي الصرف', isCurrency: true, align: 'right' },
      { key: 'sharePct', label: 'النسبة من الإنفاق', isPercent: true, align: 'center' },
      { key: 'action', label: 'التوصية الرقابية', isBadge: true, align: 'center' }
    ]
  },

  // 4. Products Costing Reports
  report_prod_cost: {
    id: 'report_prod_cost',
    category: 'products',
    categoryLabel: 'تكاليف المنتجات',
    title: 'تقرير تكاليف المنتجات وقوائم المكونات',
    subtitle: 'تحليل دقيق لتكلفة المواد، العمالة والمصاريف غير المباشرة لكل منتج',
    iconName: 'Package',
    chartType: 'bar',
    kpis: [
      { label: 'متوسط تكلفة المنتج', valueKey: 'avgProductCost', isCurrency: true },
      { label: 'متوسط هامش الربح', valueKey: 'avgMarginPct', isPercent: true },
      { label: 'نسبة تكلفة الطعام (Food Cost)', valueKey: 'avgFoodCostPct', isPercent: true },
      { label: 'عدد المنتجات المسجلة', valueKey: 'productsCount' }
    ],
    columns: [
      { key: 'code', label: 'كود الصنف', align: 'center' },
      { key: 'name', label: 'اسم المنتج', align: 'right' },
      { key: 'category', label: 'الفئة', align: 'right' },
      { key: 'salePrice', label: 'سعر البيع', isCurrency: true, align: 'right' },
      { key: 'materialCost', label: 'تكلفة الخامات', isCurrency: true, align: 'right' },
      { key: 'laborCost', label: 'العمالة المباشرة', isCurrency: true, align: 'right' },
      { key: 'overheadCost', label: 'صناعية غير مباشرة', isCurrency: true, align: 'right' },
      { key: 'totalUnitCost', label: 'إجمالي تكلفة الوحدة', isCurrency: true, align: 'right' },
      { key: 'profitMargin', label: 'هامش الربح', isCurrency: true, align: 'right' },
      { key: 'marginPct', label: 'نسبة الهامش', isPercent: true, align: 'center' },
      { key: 'rating', label: 'تقييم الربحية', isBadge: true, align: 'center' }
    ]
  },
  report_prod_unit: {
    id: 'report_prod_unit',
    category: 'products',
    categoryLabel: 'تكاليف المنتجات',
    title: 'تقرير تكلفة الوحدة للمنتجات',
    subtitle: 'تفصيل حصة القطعة/الوجبة الواحدة من الخامات والطاقة والتشغيل',
    iconName: 'Hash',
    chartType: 'bar',
    kpis: [
      { label: 'أعلى منتج تكلفة للوحدة', valueKey: 'maxCostProd' },
      { label: 'أقل منتج تكلفة للوحدة', valueKey: 'minCostProd' },
      { label: 'متوسط التكلفة للوحدة', valueKey: 'avgUnitCost', isCurrency: true },
      { label: 'حجم المنتجات المسعرة', valueKey: 'pricedCount' }
    ],
    columns: [
      { key: 'name', label: 'المنتج', align: 'right' },
      { key: 'unit', label: 'وحدة القياس', align: 'center' },
      { key: 'ingredientCost', label: 'خامات ومكونات', isCurrency: true, align: 'right' },
      { key: 'packagingCost', label: 'مواد تعبئة وتغليف', isCurrency: true, align: 'right' },
      { key: 'operationalCost', label: 'تشغيل وطاقة', isCurrency: true, align: 'right' },
      { key: 'unitCost', label: 'صافي تكلفة الوحدة', isCurrency: true, align: 'right' },
      { key: 'suggestedPrice', label: 'السعر المقترح (3x)', isCurrency: true, align: 'right' }
    ]
  },
  report_prod_margin: {
    id: 'report_prod_margin',
    category: 'products',
    categoryLabel: 'تكاليف المنتجات',
    title: 'تقرير هوامش ربحية المنتجات',
    subtitle: 'ترتيب المنتجات بحسب هامش المساهمة ومعدل العائد المالي',
    iconName: 'DollarSign',
    chartType: 'horizontal_bar',
    kpis: [
      { label: 'أعلى هامش ربح محقق', valueKey: 'topMargin', isPercent: true },
      { label: 'أدنى هامش ربح', valueKey: 'lowestMargin', isPercent: true },
      { label: 'إجمالي الأرباح المتوقعة', valueKey: 'expectedProfit', isCurrency: true },
      { label: 'منتجات تحتاج إعادة تسعير', valueKey: 'repriceCount' }
    ],
    columns: [
      { key: 'name', label: 'اسم المنتج', align: 'right' },
      { key: 'sellingPrice', label: 'سعر البيع', isCurrency: true, align: 'right' },
      { key: 'unitCost', label: 'التكلفة الإجمالية', isCurrency: true, align: 'right' },
      { key: 'grossProfit', label: 'هامش الربح (ج.م)', isCurrency: true, align: 'right' },
      { key: 'marginPct', label: 'نسبة هامش الربح', isPercent: true, align: 'center' },
      { key: 'foodCostPct', label: 'Food Cost %', isPercent: true, align: 'center' },
      { key: 'pricingHealth', label: 'سلامة التسعير', isBadge: true, align: 'center' }
    ]
  },
  report_prod_material: {
    id: 'report_prod_material',
    category: 'products',
    categoryLabel: 'تكاليف المنتجات',
    title: 'تقرير تكلفة المواد الخام والخامات الغذائية',
    subtitle: 'استهلاك الخامات الأولية والمكونات في أوامر التشغيل والوصفات',
    iconName: 'Layers',
    chartType: 'bar',
    kpis: [
      { label: 'إجمالي قيمة المواد الخام', valueKey: 'totalIngredients', isCurrency: true },
      { label: 'أعلى خامة استهلاكاً', valueKey: 'topIngredient' },
      { label: 'متوسط نسبة الهدر', valueKey: 'avgScrap', isPercent: true },
      { label: 'عدد الخامات والمواد', valueKey: 'ingredientsCount' }
    ],
    columns: [
      { key: 'code', label: 'كود الخامة', align: 'center' },
      { key: 'name', label: 'اسم المكون / الخامة', align: 'right' },
      { key: 'unit', label: 'الوحدة', align: 'center' },
      { key: 'unitPrice', label: 'متوسط سعر الشراء', isCurrency: true, align: 'right' },
      { key: 'consumedQty', label: 'الكمية المستهلكة', align: 'center' },
      { key: 'wastePercent', label: 'نسبة الفاقد / الهدر', isPercent: true, align: 'center' },
      { key: 'totalCost', label: 'إجمالي قيمة الاستهلاك', isCurrency: true, align: 'right' },
      { key: 'warehouse', label: 'المخزن الرئيسي', align: 'right' }
    ]
  },
  report_prod_operation: {
    id: 'report_prod_operation',
    category: 'products',
    categoryLabel: 'تكاليف المنتجات',
    title: 'تقرير تكاليف التشغيل والتصنيع غير المباشرة',
    subtitle: 'نصيب المنتجات وأوامر الإنتاج من الطاقة، الغاز، الصيانة والإشراف',
    iconName: 'Activity',
    chartType: 'pie',
    kpis: [
      { label: 'إجمالي مصاريف التشغيل', valueKey: 'totalOverhead', isCurrency: true },
      { label: 'معدل التحميل بالساعة', valueKey: 'hourlyRate', isCurrency: true },
      { label: 'تكلفة الطاقة والغاز', valueKey: 'energyCost', isCurrency: true },
      { label: 'تكلفة الصيانة وقطع الغيار', valueKey: 'maintCost', isCurrency: true }
    ],
    columns: [
      { key: 'overheadType', label: 'نوع المصروف التشغيلي', align: 'right' },
      { key: 'allocationBase', label: 'أساس التوزيع والتحميل', align: 'right' },
      { key: 'ratePerHour', label: 'المعدل / ساعة إنتاج', isCurrency: true, align: 'right' },
      { key: 'allocatedAmount', label: 'المبلغ المحمل', isCurrency: true, align: 'right' },
      { key: 'sharePct', label: 'النسبة من التشغيل', isPercent: true, align: 'center' }
    ]
  },

  // 5. Projects Costing Reports
  report_proj_cost: {
    id: 'report_proj_cost',
    category: 'projects',
    categoryLabel: 'تكاليف المشاريع',
    title: 'تقرير تكاليف المشاريع وأوامر التشغيل الخاصة',
    subtitle: 'متابعة الموازنة المرصودة مقابل المنفذ الفعلي لكل مشروع أو تعاقد',
    iconName: 'Briefcase',
    chartType: 'bar',
    kpis: [
      { label: 'إجمالي تكاليف المشاريع', valueKey: 'totalCost', isCurrency: true },
      { label: 'موازنة المشاريع الكلية', valueKey: 'totalBudget', isCurrency: true },
      { label: 'عدد المشاريع النشطة', valueKey: 'projectsCount' },
      { label: 'متوسط تكلفة المشروع', valueKey: 'avgCost', isCurrency: true }
    ],
    columns: [
      { key: 'code', label: 'كود المشروع', align: 'center' },
      { key: 'name', label: 'اسم المشروع / الطلبية', align: 'right' },
      { key: 'client', label: 'العميل / الجهة', align: 'right' },
      { key: 'budget', label: 'الموازنة المقدرة', isCurrency: true, align: 'right' },
      { key: 'actual', label: 'المنصرف الفعلي', isCurrency: true, align: 'right' },
      { key: 'variance', label: 'الوفر / التجاوز', isCurrency: true, align: 'right' },
      { key: 'completionRate', label: 'نسبة الإنجاز', isPercent: true, align: 'center' },
      { key: 'status', label: 'الحالة', isBadge: true, align: 'center' }
    ]
  },
  report_proj_profit: {
    id: 'report_proj_profit',
    category: 'projects',
    categoryLabel: 'تكاليف المشاريع',
    title: 'تقرير ربحية المشاريع والطلبيات',
    subtitle: 'مقارنة إيرادات التعاقد مع التكاليف الفعلية لاحتساب صافي الربح',
    iconName: 'DollarSign',
    chartType: 'bar',
    kpis: [
      { label: 'إجمالي إيرادات المشاريع', valueKey: 'totalRevenue', isCurrency: true },
      { label: 'إجمالي تكاليف التنفيذ', valueKey: 'totalCost', isCurrency: true },
      { label: 'صافي الربح الإجمالي', valueKey: 'netProfit', isCurrency: true },
      { label: 'متوسط نسبة الربحية', valueKey: 'profitMargin', isPercent: true }
    ],
    columns: [
      { key: 'name', label: 'المشروع', align: 'right' },
      { key: 'revenue', label: 'الإيراد المحقق', isCurrency: true, align: 'right' },
      { key: 'directCost', label: 'التكلفة المباشرة', isCurrency: true, align: 'right' },
      { key: 'indirectCost', label: 'التكلفة غير المباشرة', isCurrency: true, align: 'right' },
      { key: 'netProfit', label: 'صافي الربح', isCurrency: true, align: 'right' },
      { key: 'marginPct', label: 'نسبة الربحية', isPercent: true, align: 'center' },
      { key: 'status', label: 'التقييم المالي', isBadge: true, align: 'center' }
    ]
  },
  report_proj_progress: {
    id: 'report_proj_progress',
    category: 'projects',
    categoryLabel: 'تكاليف المشاريع',
    title: 'تقرير نسبة الإنجاز والإنفاق على المشاريع',
    subtitle: 'مطابقة التقدم الميداني مع معدل الصرف المالي لكشف المخاطر مبكراً',
    iconName: 'Percent',
    chartType: 'line',
    kpis: [
      { label: 'متوسط نسبة الإنجاز', valueKey: 'avgProgress', isPercent: true },
      { label: 'مشاريع متأخرة مالياً', valueKey: 'delayedCount' },
      { label: 'مشاريع ضمن المخطط', valueKey: 'onTrackCount' },
      { label: 'معدل حرق الموازنة', valueKey: 'burnRate', isPercent: true }
    ],
    columns: [
      { key: 'name', label: 'المشروع', align: 'right' },
      { key: 'plannedProgress', label: 'الإنجاز المخطط', isPercent: true, align: 'center' },
      { key: 'actualProgress', label: 'الإنجاز الفعلي', isPercent: true, align: 'center' },
      { key: 'budgetSpentPct', label: 'نسبة الصرف المالي', isPercent: true, align: 'center' },
      { key: 'scheduleVariance', label: 'الانحراف الزمني', align: 'center' },
      { key: 'healthStatus', label: 'سلامة المشروع', isBadge: true, align: 'center' }
    ]
  },
  report_proj_compare: {
    id: 'report_proj_compare',
    category: 'projects',
    categoryLabel: 'تكاليف المشاريع',
    title: 'مقارنة أداء المشاريع',
    subtitle: 'مقارنة قياسية بين كافة المشاريع للتعرف على أفضل الممارسات التشغيلية',
    iconName: 'ArrowRightLeft',
    chartType: 'horizontal_bar',
    kpis: [
      { label: 'أفضل مشروع ربحية', valueKey: 'bestProject' },
      { label: 'أعلى مشروع تكلفة', valueKey: 'highestCostProject' },
      { label: 'إجمالي قيمة التعاقدات', valueKey: 'contractsTotal', isCurrency: true },
      { label: 'متوسط العائد على التكلفة', valueKey: 'avgROI', isPercent: true }
    ],
    columns: [
      { key: 'name', label: 'المشروع', align: 'right' },
      { key: 'contractValue', label: 'قيمة العقد', isCurrency: true, align: 'right' },
      { key: 'actualCost', label: 'التكلفة الفعلية', isCurrency: true, align: 'right' },
      { key: 'profitAmount', label: 'قيمة الربح', isCurrency: true, align: 'right' },
      { key: 'roiPct', label: 'معدل العائد (ROI)', isPercent: true, align: 'center' },
      { key: 'rank', label: 'الترتيب العام', align: 'center' }
    ]
  },

  // 6. Branches Costing Reports
  report_branch_cost: {
    id: 'report_branch_cost',
    category: 'branches',
    categoryLabel: 'تكاليف الفروع',
    title: 'تقرير تكاليف الفروع والمنافذ',
    subtitle: 'إجمالي نفقات التشغيل، الإيجارات، الرواتب والخامات لكل فرع',
    iconName: 'Building',
    chartType: 'bar',
    kpis: [
      { label: 'إجمالي تكاليف الفروع', valueKey: 'totalCost', isCurrency: true },
      { label: 'أعلى فرع تكلفة', valueKey: 'topBranch' },
      { label: 'متوسط تكلفة الفرع', valueKey: 'avgBranchCost', isCurrency: true },
      { label: 'عدد الفروع النشطة', valueKey: 'branchesCount' }
    ],
    columns: [
      { key: 'code', label: 'كود الفرع', align: 'center' },
      { key: 'name', label: 'اسم الفرع', align: 'right' },
      { key: 'location', label: 'المدينة / المنطقة', align: 'right' },
      { key: 'laborCost', label: 'تكلفة العمالة', isCurrency: true, align: 'right' },
      { key: 'operatingCost', label: 'مصاريف التشغيل والإيجار', isCurrency: true, align: 'right' },
      { key: 'materialsCost', label: 'الخامات والمشتريات', isCurrency: true, align: 'right' },
      { key: 'totalBranchCost', label: 'إجمالي التكاليف', isCurrency: true, align: 'right' },
      { key: 'salesTotal', label: 'مبيعات الفرع', isCurrency: true, align: 'right' },
      { key: 'costToSalesRatio', label: 'نسبة التكلفة للمبيعات', isPercent: true, align: 'center' },
      { key: 'status', label: 'كفاءة الفرع', isBadge: true, align: 'center' }
    ]
  },
  report_branch_compare: {
    id: 'report_branch_compare',
    category: 'branches',
    categoryLabel: 'تكاليف الفروع',
    title: 'مقارنة تكاليف الفروع',
    subtitle: 'مقارنة معيارية بين تكاليف الفروع ونسب استنزاف الموازنات',
    iconName: 'ArrowRightLeft',
    chartType: 'horizontal_bar',
    kpis: [
      { label: 'الفرع الأكثر كفاءة', valueKey: 'bestBranch' },
      { label: 'الفرع الأعلى مصاريف', valueKey: 'worstBranch' },
      { label: 'الفارق بين أعلى وأدنى فرع', valueKey: 'branchSpread', isCurrency: true },
      { label: 'متوسط نسبة التكلفة للمبيعات', valueKey: 'avgCostSales', isPercent: true }
    ],
    columns: [
      { key: 'name', label: 'الفرع', align: 'right' },
      { key: 'totalCost', label: 'التكلفة الإجمالية', isCurrency: true, align: 'right' },
      { key: 'budget', label: 'الموازنة المقررة', isCurrency: true, align: 'right' },
      { key: 'variance', label: 'الانحراف', isCurrency: true, align: 'right' },
      { key: 'sharePct', label: 'الحصة من الإنفاق الكلي', isPercent: true, align: 'center' },
      { key: 'costEfficiency', label: 'مؤشر الكفاءة التشغيلية', isBadge: true, align: 'center' }
    ]
  },
  report_branch_profit: {
    id: 'report_branch_profit',
    category: 'branches',
    categoryLabel: 'تكاليف الفروع',
    title: 'تقرير ربحية الفروع وصافي الدخل',
    subtitle: 'تحليل هامش الربح الصافي بعد خصم كافة التكاليف المباشرة والمركزية',
    iconName: 'DollarSign',
    chartType: 'bar',
    kpis: [
      { label: 'إجمالي مبيعات الفروع', valueKey: 'totalSales', isCurrency: true },
      { label: 'إجمالي تكاليف الفروع', valueKey: 'totalCosts', isCurrency: true },
      { label: 'صافي أرباح الفروع', valueKey: 'netIncome', isCurrency: true },
      { label: 'الفرع الأكثر ربحية', valueKey: 'mostProfitableBranch' }
    ],
    columns: [
      { key: 'name', label: 'الفرع', align: 'right' },
      { key: 'sales', label: 'إجمالي المبيعات', isCurrency: true, align: 'right' },
      { key: 'costOfSales', label: 'تكلفة البضاعة (COGS)', isCurrency: true, align: 'right' },
      { key: 'expenses', label: 'المصروفات التشغيلية', isCurrency: true, align: 'right' },
      { key: 'netProfit', label: 'صافي الربح', isCurrency: true, align: 'right' },
      { key: 'profitMarginPct', label: 'نسبة صافي الربح', isPercent: true, align: 'center' },
      { key: 'rank', label: 'ترتيب الربحية', align: 'center' }
    ]
  },

  // 7. Employees Costing Reports
  report_emp_cost: {
    id: 'report_emp_cost',
    category: 'employees',
    categoryLabel: 'تكاليف العمالة',
    title: 'تقرير تكلفة الموظفين والكوادر',
    subtitle: 'تفصيل الرواتب الأساسية، البدلات، التأمينات ومكافآت الإنتاج لكل موظف',
    iconName: 'User',
    chartType: 'bar',
    kpis: [
      { label: 'إجمالي تكلفة الرواتب', valueKey: 'totalPayroll', isCurrency: true },
      { label: 'متوسط تكلفة الموظف', valueKey: 'avgEmpCost', isCurrency: true },
      { label: 'عدد الموظفين', valueKey: 'empCount' },
      { label: 'أعلى إدارة كلفة رواتب', valueKey: 'topSalaryDept' }
    ],
    columns: [
      { key: 'code', label: 'الرقم الوظيفي', align: 'center' },
      { key: 'name', label: 'اسم الموظف', align: 'right' },
      { key: 'dept', label: 'القسم / الإدارة', align: 'right' },
      { key: 'role', label: 'المسمى الوظيفي', align: 'right' },
      { key: 'laborType', label: 'نوع العمالة', isBadge: true, align: 'center' },
      { key: 'baseSalary', label: 'الراتب الأساسي', isCurrency: true, align: 'right' },
      { key: 'allowances', label: 'البدلات والمزايا', isCurrency: true, align: 'right' },
      { key: 'totalCost', label: 'إجمالي تكلفة الموظف', isCurrency: true, align: 'right' },
      { key: 'branch', label: 'الفرع / المركز', align: 'right' }
    ]
  },
  report_emp_dept: {
    id: 'report_emp_dept',
    category: 'employees',
    categoryLabel: 'تكاليف العمالة',
    title: 'تكلفة العمالة حسب القسم والإدارة',
    subtitle: 'توزيع فاتورة الأجور والمرتبات على الهيكل الإداري والأقسام الفنية',
    iconName: 'Users',
    chartType: 'pie',
    kpis: [
      { label: 'أعلى قسم كلفة رواتب', valueKey: 'topDept' },
      { label: 'إجمالي أجور العمالة', valueKey: 'totalCost', isCurrency: true },
      { label: 'نسبة الأجور من المبيعات', valueKey: 'laborCostRatio', isPercent: true },
      { label: 'متوسط أجر الموظف بالشركة', valueKey: 'companyAvgWage', isCurrency: true }
    ],
    columns: [
      { key: 'deptName', label: 'القسم / الإدارة', align: 'right' },
      { key: 'headcount', label: 'عدد العمالة', align: 'center' },
      { key: 'totalWages', label: 'إجمالي الأجور', isCurrency: true, align: 'right' },
      { key: 'avgWage', label: 'متوسط أجر الفرد', isCurrency: true, align: 'right' },
      { key: 'sharePct', label: 'الحصة من فاتورة الرواتب', isPercent: true, align: 'center' },
      { key: 'productivity', label: 'مستوى الإنتاجية', isBadge: true, align: 'center' }
    ]
  },
  report_emp_admin: {
    id: 'report_emp_admin',
    category: 'employees',
    categoryLabel: 'تكاليف العمالة',
    title: 'تكلفة الكادر الإداري والمكتبي',
    subtitle: 'رواتب الإدارات المالية، الموارد البشرية، المشتريات ومكتب الإدارة',
    iconName: 'Building2',
    chartType: 'bar',
    kpis: [
      { label: 'إجمالي التكاليف الإدارية', valueKey: 'totalAdminCost', isCurrency: true },
      { label: 'نسبتها من إجمالي الرواتب', valueKey: 'adminCostShare', isPercent: true },
      { label: 'عدد الكادر الإداري', valueKey: 'adminCount' },
      { label: 'متوسط تكلفة الكادر الإداري', valueKey: 'avgAdminWage', isCurrency: true }
    ],
    columns: [
      { key: 'title', label: 'الوظيفة الإدارية', align: 'right' },
      { key: 'dept', label: 'الإدارة', align: 'right' },
      { key: 'count', label: 'العدد', align: 'center' },
      { key: 'salaries', label: 'إجمالي الرواتب', isCurrency: true, align: 'right' },
      { key: 'benefits', label: 'التأمينات والبدلات', isCurrency: true, align: 'right' },
      { key: 'total', label: 'التكلفة الإجمالية', isCurrency: true, align: 'right' },
      { key: 'sharePct', label: 'النسبة', isPercent: true, align: 'center' }
    ]
  },
  report_emp_labor: {
    id: 'report_emp_labor',
    category: 'employees',
    categoryLabel: 'تكاليف العمالة',
    title: 'تقرير تكلفة العمالة المباشرة في التشغيل',
    subtitle: 'أجور الطهاة، مساعدي الإنتاج، عمال المخبز وطواقم الخدمة بالصالة',
    iconName: 'Users',
    chartType: 'bar',
    kpis: [
      { label: 'إجمالي العمالة المباشرة', valueKey: 'totalDirectLabor', isCurrency: true },
      { label: 'متوسط تكلفة ساعة العمل', valueKey: 'avgHourlyCost', isCurrency: true },
      { label: 'نسبة العمالة المباشرة', valueKey: 'directLaborShare', isPercent: true },
      { label: 'ساعات العمل المنجزة', valueKey: 'totalHours' }
    ],
    columns: [
      { key: 'stationName', label: 'محطة العمل / الخط الإنتاجي', align: 'right' },
      { key: 'workersCount', label: 'عدد العمالة المباشرة', align: 'center' },
      { key: 'totalHours', label: 'ساعات التشغيل', align: 'center' },
      { key: 'hourlyRate', label: 'متوسط أجر الساعة', isCurrency: true, align: 'right' },
      { key: 'totalLaborCost', label: 'إجمالي التكلفة المحملة', isCurrency: true, align: 'right' },
      { key: 'costPerUnit', label: 'نصيب الوحدة المنتجة', isCurrency: true, align: 'right' }
    ]
  },

  // 8. Budgets & Variance Reports
  report_budget_actual: {
    id: 'report_budget_actual',
    category: 'budgets',
    categoryLabel: 'الموازنات والانحرافات',
    title: 'تقرير الموازنة التقديرية مقابل الفعلي (Budget vs Actual)',
    subtitle: 'مقارنة شاملة بين الاعتمادات المالية والمنصرف الفعلي وتحديد نسب الصرف',
    iconName: 'BookOpen',
    chartType: 'bar',
    kpis: [
      { label: 'إجمالي الموازنة المعتمدة', valueKey: 'totalBudget', isCurrency: true },
      { label: 'إجمالي المنصرف الفعلي', valueKey: 'totalActual', isCurrency: true },
      { label: 'صافي الوفر / العجز', valueKey: 'netVariance', isCurrency: true },
      { label: 'نسبة الصرف الإجمالية', valueKey: 'burnRate', isPercent: true }
    ],
    columns: [
      { key: 'name', label: 'مركز التكلفة / البند', align: 'right' },
      { key: 'period', label: 'الفترة المالية', align: 'center' },
      { key: 'budgetAmount', label: 'الموازنة المعتمدة', isCurrency: true, align: 'right' },
      { key: 'actualAmount', label: 'المنصرف الفعلي', isCurrency: true, align: 'right' },
      { key: 'varianceAmount', label: 'الانحراف المالي (الوفر/العجز)', isCurrency: true, align: 'right' },
      { key: 'burnPct', label: 'نسبة الصرف', isPercent: true, align: 'center' },
      { key: 'budgetStatus', label: 'حالة الموازنة', isBadge: true, align: 'center' }
    ]
  },
  report_budget_consumption: {
    id: 'report_budget_consumption',
    category: 'budgets',
    categoryLabel: 'الموازنات والانحرافات',
    title: 'تقرير نسبة استهلاك الموازنات',
    subtitle: 'مؤشرات استهلاك الموازنات مع شريط تقدم ملون لتفادي التجاوز المالي',
    iconName: 'Percent',
    chartType: 'horizontal_bar',
    kpis: [
      { label: 'متوسط معدل الاستهلاك', valueKey: 'avgBurnRate', isPercent: true },
      { label: 'بنود اقتربت من النفاد', valueKey: 'nearLimitCount' },
      { label: 'بنود آمنة (أقل من 70%)', valueKey: 'safeCount' },
      { label: 'بنود متجاوزة (أكثر من 100%)', valueKey: 'exceededCount' }
    ],
    columns: [
      { key: 'name', label: 'البند / المركز', align: 'right' },
      { key: 'allocatedBudget', label: 'المخصص المالي', isCurrency: true, align: 'right' },
      { key: 'usedAmount', label: 'المستهلك حتى الآن', isCurrency: true, align: 'right' },
      { key: 'consumptionPct', label: 'نسبة الاستهلاك', isPercent: true, align: 'center' },
      { key: 'alertStatus', label: 'مستوى الأمان', isBadge: true, align: 'center' }
    ]
  },
  report_budget_remaining: {
    id: 'report_budget_remaining',
    category: 'budgets',
    categoryLabel: 'الموازنات والانحرافات',
    title: 'تقرير المتبقي من الموازنة المالية',
    subtitle: 'الأرصدة المالية المتاحة للصرف المتبقية حتى نهاية الفترة المحاسبية',
    iconName: 'Wallet',
    chartType: 'bar',
    kpis: [
      { label: 'إجمالي الرصيد المتبقي المتاح', valueKey: 'totalRemaining', isCurrency: true },
      { label: 'نسبة المتبقي العام', valueKey: 'remainingRate', isPercent: true },
      { label: 'أعلى مركز به رصيد متاح', valueKey: 'topAvailableCenter' },
      { label: 'أيام العمل المتبقية بالفترة', valueKey: 'remainingDays' }
    ],
    columns: [
      { key: 'name', label: 'مركز التكلفة / الحساب', align: 'right' },
      { key: 'originalBudget', label: 'الموازنة الأصلية', isCurrency: true, align: 'right' },
      { key: 'spentSoFar', label: 'المنصرف', isCurrency: true, align: 'right' },
      { key: 'remainingBalance', label: 'الرصيد المتبقي المتاح', isCurrency: true, align: 'right' },
      { key: 'remainingPct', label: 'نسبة المتبقي %', isPercent: true, align: 'center' },
      { key: 'availability', label: 'إمكانية الصرف', isBadge: true, align: 'center' }
    ]
  },
  report_budget_exceeded: {
    id: 'report_budget_exceeded',
    category: 'budgets',
    categoryLabel: 'الموازنات والانحرافات',
    title: 'تقرير تجاوز الموازنات وبنود الخطر',
    subtitle: 'حصر البنود والمراكز التي تخطت المخصص المعتمد لدراسة أسباب العجز',
    iconName: 'AlertTriangle',
    chartType: 'bar',
    kpis: [
      { label: 'إجمالي مبالغ التجاوز', valueKey: 'totalExceeded', isCurrency: true },
      { label: 'عدد البنود المتجاوزة', valueKey: 'exceededItemsCount' },
      { label: 'أعلى نسبة تجاوز', valueKey: 'maxExceedRate', isPercent: true },
      { label: 'أكبر بند تجاوزاً', valueKey: 'topExceededItem' }
    ],
    columns: [
      { key: 'name', label: 'البند المتجاوز', align: 'right' },
      { key: 'dept', label: 'الإدارة المسئولة', align: 'right' },
      { key: 'budget', label: 'الموازنة المقررة', isCurrency: true, align: 'right' },
      { key: 'actual', label: 'المنصرف الفعلي', isCurrency: true, align: 'right' },
      { key: 'excessAmount', label: 'مبلغ التجاوز', isCurrency: true, align: 'right' },
      { key: 'excessPct', label: 'نسبة التجاوز', isPercent: true, align: 'center' },
      { key: 'severity', label: 'درجة الخطورة', isBadge: true, align: 'center' }
    ]
  },
  report_var_standard: {
    id: 'report_var_standard',
    category: 'budgets',
    categoryLabel: 'الموازنات والانحرافات',
    title: 'التكلفة المعيارية مقابل الفعلية (Standard vs Actual)',
    subtitle: 'مقارنة التكاليف المعيارية الهندسية/التشغيلية بالتكلفة المحققة فعلياً',
    iconName: 'ArrowRightLeft',
    chartType: 'bar',
    kpis: [
      { label: 'إجمالي التكلفة المعيارية', valueKey: 'totalStandard', isCurrency: true },
      { label: 'إجمالي التكلفة الفعلية', valueKey: 'totalActual', isCurrency: true },
      { label: 'صافي الانحراف المعياري', valueKey: 'standardVariance', isCurrency: true },
      { label: 'معدل الانحراف المعياري', valueKey: 'varianceRate', isPercent: true }
    ],
    columns: [
      { key: 'name', label: 'عنصر التكلفة المعيارية', align: 'right' },
      { key: 'stdUnitCost', label: 'التكلفة المعيارية للوحدة', isCurrency: true, align: 'right' },
      { key: 'actUnitCost', label: 'التكلفة الفعلية للوحدة', isCurrency: true, align: 'right' },
      { key: 'unitVariance', label: 'انحراف الوحدة', isCurrency: true, align: 'right' },
      { key: 'totalStdCost', label: 'إجمالي المعياري', isCurrency: true, align: 'right' },
      { key: 'totalActCost', label: 'إجمالي الفعلي', isCurrency: true, align: 'right' },
      { key: 'varType', label: 'طبيعة الانحراف', isBadge: true, align: 'center' }
    ]
  },
  report_var_ratio: {
    id: 'report_var_ratio',
    category: 'budgets',
    categoryLabel: 'الموازنات والانحرافات',
    title: 'تقرير نسب ومعدلات الانحراف',
    subtitle: 'تحليل نسبي للانحرافات المالية والتشغيلية وتصنيفها كملائم أو غير ملائم',
    iconName: 'Percent',
    chartType: 'horizontal_bar',
    kpis: [
      { label: 'متوسط نسبة الانحراف', valueKey: 'avgVarPct', isPercent: true },
      { label: 'انحرافات إيجابية (ملائمة)', valueKey: 'favorableCount' },
      { label: 'انحرافات سلبية (غير ملائمة)', valueKey: 'unfavorableCount' },
      { label: 'أعلى نسبة انحراف', valueKey: 'maxVarPct', isPercent: true }
    ],
    columns: [
      { key: 'name', label: 'بند التكلفة', align: 'right' },
      { key: 'budgetVal', label: 'المقدر', isCurrency: true, align: 'right' },
      { key: 'actualVal', label: 'الفعلي', isCurrency: true, align: 'right' },
      { key: 'diffVal', label: 'قيمة الفرق', isCurrency: true, align: 'right' },
      { key: 'ratioPct', label: 'نسبة الانحراف %', isPercent: true, align: 'center' },
      { key: 'classification', label: 'التصنيف المحاسبي', isBadge: true, align: 'center' }
    ]
  },
  report_var_reasons: {
    id: 'report_var_reasons',
    category: 'budgets',
    categoryLabel: 'الموازنات والانحرافات',
    title: 'تحليل أسباب الانحرافات والتوصيات',
    subtitle: 'تفسير الأسباب الجذرية لانحراف التكلفة (أسعار المواد، كفاءة العمالة، الهدر)',
    iconName: 'HelpCircle',
    chartType: 'pie',
    kpis: [
      { label: 'أهم سبب انحراف', valueKey: 'primaryReason' },
      { label: 'انحراف ناتج عن أسعار الخامات', valueKey: 'priceVariance', isCurrency: true },
      { label: 'انحراف ناتج عن كفاءة الاستخدام والهدر', valueKey: 'efficiencyVariance', isCurrency: true },
      { label: 'إجمالي الخسائر المعيارية', valueKey: 'totalLosses', isCurrency: true }
    ],
    columns: [
      { key: 'costElement', label: 'عنصر الانحراف', align: 'right' },
      { key: 'rootCause', label: 'السبب الجذري للانحراف', align: 'right' },
      { key: 'category', label: 'نوع السبب (سعر/كفاءة/هدر)', align: 'center' },
      { key: 'financialImpact', label: 'الأثر المالي', isCurrency: true, align: 'right' },
      { key: 'correctiveAction', label: 'الإجراء التصحيحي الموصى به', align: 'right' }
    ]
  },
  report_var_highest: {
    id: 'report_var_highest',
    category: 'budgets',
    categoryLabel: 'الموازنات والانحرافات',
    title: 'أعلى الانحرافات المالية والتشغيلية',
    subtitle: 'قائمة بأكبر الفروقات السلبية بين المخطط والفعلي التي تتطلب تدخلاً عاجلاً',
    iconName: 'TrendingUp',
    chartType: 'horizontal_bar',
    kpis: [
      { label: 'إجمالي أكبر 5 انحرافات', valueKey: 'top5Variance', isCurrency: true },
      { label: 'أعلى انحراف منفرد', valueKey: 'topSingleVar', isCurrency: true },
      { label: 'النسبة من إجمالي العجز', valueKey: 'shareOfDeficit', isPercent: true },
      { label: 'حالة المتابعة', valueKey: 'followupStatus' }
    ],
    columns: [
      { key: 'rank', label: 'الترتيب', align: 'center' },
      { key: 'name', label: 'اسم البند / المركز', align: 'right' },
      { key: 'planned', label: 'المخطط', isCurrency: true, align: 'right' },
      { key: 'actual', label: 'الفعلي', isCurrency: true, align: 'right' },
      { key: 'variance', label: 'مبلغ الانحراف', isCurrency: true, align: 'right' },
      { key: 'variancePct', label: 'النسبة %', isPercent: true, align: 'center' },
      { key: 'priority', label: 'أولوية التدخل', isBadge: true, align: 'center' }
    ]
  },

  // 9. Analytics & Charts
  report_ana_product: {
    id: 'report_ana_product',
    category: 'analytics',
    categoryLabel: 'التحليلات والرسوم',
    title: 'تحليل التكاليف حسب المنتجات',
    subtitle: 'رسم بياني وتحليلي لتوزيع التكاليف الصناعية على خطوط المنتجات',
    iconName: 'PieChart',
    chartType: 'pie',
    kpis: [
      { label: 'إجمالي تكلفة المنتجات', valueKey: 'totalCost', isCurrency: true },
      { label: 'أعلى منتج استهلاكاً', valueKey: 'topProduct' },
      { label: 'متوسط تكلفة الوجبة', valueKey: 'avgCost', isCurrency: true },
      { label: 'عدد أصناف المنيو', valueKey: 'menuCount' }
    ],
    columns: [
      { key: 'name', label: 'المنتج / الصنف', align: 'right' },
      { key: 'unitsSold', label: 'الكميات المباعة', align: 'center' },
      { key: 'unitCost', label: 'تكلفة الوحدة', isCurrency: true, align: 'right' },
      { key: 'totalCost', label: 'إجمالي التكلفة', isCurrency: true, align: 'right' },
      { key: 'sharePct', label: 'حصة المنتج %', isPercent: true, align: 'center' }
    ]
  },
  report_ana_branch: {
    id: 'report_ana_branch',
    category: 'analytics',
    categoryLabel: 'التحليلات والرسوم',
    title: 'تحليل التكاليف حسب الفروع والمواقع',
    subtitle: 'توزيع جغرافي وإحصائي لتكاليف الفروع والمنافذ ونقاط البيع',
    iconName: 'PieChart',
    chartType: 'pie',
    kpis: [
      { label: 'إجمالي تكاليف الفروع', valueKey: 'totalCost', isCurrency: true },
      { label: 'الفرع الأكبر إنفاقاً', valueKey: 'largestBranch' },
      { label: 'متوسط الفرع', valueKey: 'avgBranch', isCurrency: true },
      { label: 'نسبة تكاليف الفروع من الإجمالي', valueKey: 'branchShare', isPercent: true }
    ],
    columns: [
      { key: 'name', label: 'اسم الفرع', align: 'right' },
      { key: 'city', label: 'المدينة', align: 'right' },
      { key: 'totalCost', label: 'إجمالي التكلفة', isCurrency: true, align: 'right' },
      { key: 'sharePct', label: 'النسبة من الشركة', isPercent: true, align: 'center' },
      { key: 'perf', label: 'التقييم', isBadge: true, align: 'center' }
    ]
  },
  report_ana_project: {
    id: 'report_ana_project',
    category: 'analytics',
    categoryLabel: 'التحليلات والرسوم',
    title: 'تحليل التكاليف حسب المشاريع',
    subtitle: 'توزيع النفقات الاستثمارية والتشغيلية على المشاريع والعقود',
    iconName: 'PieChart',
    chartType: 'pie',
    kpis: [
      { label: 'تكاليف المشاريع المنفذة', valueKey: 'totalCost', isCurrency: true },
      { label: 'المشروع الأكبر استثماراً', valueKey: 'topProject' },
      { label: 'نسبة التكاليف المحملة', valueKey: 'allocatedPct', isPercent: true },
      { label: 'عدد المشاريع المحللة', valueKey: 'projectsCount' }
    ],
    columns: [
      { key: 'name', label: 'المشروع', align: 'right' },
      { key: 'contractValue', label: 'قيمة العقد', isCurrency: true, align: 'right' },
      { key: 'costValue', label: 'إجمالي المصروف', isCurrency: true, align: 'right' },
      { key: 'sharePct', label: 'النسبة المئوية', isPercent: true, align: 'center' }
    ]
  },
  report_ana_supplier: {
    id: 'report_ana_supplier',
    category: 'analytics',
    categoryLabel: 'التحليلات والرسوم',
    title: 'تحليل التكاليف حسب الموردين',
    subtitle: 'حجم الإنفاق المالي على مشتريات الخامات لكل مورد وشركاء التوريد',
    iconName: 'PieChart',
    chartType: 'pie',
    kpis: [
      { label: 'إجمالي مشتريات الموردين', valueKey: 'totalSuppliersCost', isCurrency: true },
      { label: 'المورد الرئيسي الأول', valueKey: 'topSupplier' },
      { label: 'قيمة مشتريات المورد الأول', valueKey: 'topSupplierVal', isCurrency: true },
      { label: 'عدد الموردين النشطين', valueKey: 'suppliersCount' }
    ],
    columns: [
      { key: 'supplierName', label: 'اسم المورد / الشركة', align: 'right' },
      { key: 'supplyType', label: 'نوع التوريد', align: 'center' },
      { key: 'invoicesCount', label: 'عدد الفواتير', align: 'center' },
      { key: 'totalPurchases', label: 'إجمالي المشتريات', isCurrency: true, align: 'right' },
      { key: 'sharePct', label: 'النسبة من التوريدات', isPercent: true, align: 'center' }
    ]
  },
  report_ana_customer: {
    id: 'report_ana_customer',
    category: 'analytics',
    categoryLabel: 'التحليلات والرسوم',
    title: 'تحليل تكاليف خدمة العملاء والطلبيات',
    subtitle: 'التكاليف التشغيلية والتسليم المرتبطة بخدمة كبار العملاء والشركات',
    iconName: 'PieChart',
    chartType: 'pie',
    kpis: [
      { label: 'إجمالي تكلفة خدمة العملاء', valueKey: 'totalCost', isCurrency: true },
      { label: 'أكبر عميل تكلفة', valueKey: 'topCustomer' },
      { label: 'متوسط تكلفة خدمة الطلب', valueKey: 'avgOrderCost', isCurrency: true },
      { label: 'عدد حسابات العملاء', valueKey: 'custCount' }
    ],
    columns: [
      { key: 'customerName', label: 'اسم العميل / الجهة', align: 'right' },
      { key: 'ordersCount', label: 'عدد الطلبيات', align: 'center' },
      { key: 'deliveryCost', label: 'تكاليف التوصيل', isCurrency: true, align: 'right' },
      { key: 'totalServiceCost', label: 'إجمالي تكلفة الخدمة', isCurrency: true, align: 'right' },
      { key: 'sharePct', label: 'النسبة %', isPercent: true, align: 'center' }
    ]
  },
  report_ana_center: {
    id: 'report_ana_center',
    category: 'analytics',
    categoryLabel: 'التحليلات والرسوم',
    title: 'التحليل الهيكلي لمراكز التكلفة',
    subtitle: 'توزيع الحصص النسبية لمراكز التكلفة على الدائرة المالية الكلية',
    iconName: 'PieChart',
    chartType: 'pie',
    kpis: [
      { label: 'إجمالي تكلفة المراكز', valueKey: 'totalCost', isCurrency: true },
      { label: 'مركز التكلفة الأول', valueKey: 'topCenter' },
      { label: 'نسبة المركز الأول', valueKey: 'topCenterShare', isPercent: true },
      { label: 'متوسط استهلاك المراكز', valueKey: 'avgCenterCost', isCurrency: true }
    ],
    columns: [
      { key: 'name', label: 'مركز التكلفة', align: 'right' },
      { key: 'amount', label: 'إجمالي التكلفة', isCurrency: true, align: 'right' },
      { key: 'budget', label: 'الموازنة', isCurrency: true, align: 'right' },
      { key: 'sharePct', label: 'النسبة من الإجمالي', isPercent: true, align: 'center' }
    ]
  },
  report_ana_item: {
    id: 'report_ana_item',
    category: 'analytics',
    categoryLabel: 'التحليلات والرسوم',
    title: 'التحليل النسبي لبنود وعناصر المصروفات',
    subtitle: 'دراسة الحصص النسبية لبنود التكاليف المباشرة وغير المباشرة',
    iconName: 'PieChart',
    chartType: 'pie',
    kpis: [
      { label: 'إجمالي البنود', valueKey: 'itemsCount' },
      { label: 'أعلى بند تكلفة', valueKey: 'topItem' },
      { label: 'نسبة أعلى بند', valueKey: 'topItemShare', isPercent: true },
      { label: 'إجمالي الإنفاق', valueKey: 'totalCost', isCurrency: true }
    ],
    columns: [
      { key: 'name', label: 'عنصر التكلفة', align: 'right' },
      { key: 'category', label: 'التصنيف', align: 'center' },
      { key: 'amount', label: 'المبلغ الإجمالي', isCurrency: true, align: 'right' },
      { key: 'sharePct', label: 'النسبة المئوية', isPercent: true, align: 'center' }
    ]
  },
  report_ana_period: {
    id: 'report_ana_period',
    category: 'analytics',
    categoryLabel: 'التحليلات والرسوم',
    title: 'تحليل التكاليف عبر الفترات الزمنية',
    subtitle: 'دراسة المقارنة بين الفترات الزمنية ومعدلات الصعود والهبوط في الإنفاق',
    iconName: 'LineChart',
    chartType: 'line',
    kpis: [
      { label: 'متوسط الإنفاق بالفترة', valueKey: 'periodAvg', isCurrency: true },
      { label: 'فترة الذروة', valueKey: 'peakPeriod' },
      { label: 'معدل التذبذب الزمني', valueKey: 'volatilityPct', isPercent: true },
      { label: 'إجمالي الفترات المحللة', valueKey: 'periodsCount' }
    ],
    columns: [
      { key: 'periodLabel', label: 'الفترة الزمنية', align: 'right' },
      { key: 'spentAmount', label: 'المنصرف', isCurrency: true, align: 'right' },
      { key: 'previousAmount', label: 'الفترة السابقة', isCurrency: true, align: 'right' },
      { key: 'growthPct', label: 'نسبة النمو / التغير', isPercent: true, align: 'center' },
      { key: 'trend', label: 'الاتجاه', isBadge: true, align: 'center' }
    ]
  },
  report_chart_trend: {
    id: 'report_chart_trend',
    category: 'analytics',
    categoryLabel: 'التحليلات والرسوم',
    title: 'رسم بياني: مسار واتجاه التكاليف (Cost Trend)',
    subtitle: 'الخط البياني الزمني التراكمي لمسار الإنفاق على مدار الأشهر',
    iconName: 'TrendingUp',
    chartType: 'area',
    kpis: [
      { label: 'إجمالي الإنفاق التراكمي', valueKey: 'cumulativeCost', isCurrency: true },
      { label: 'معدل النمو الشهري', valueKey: 'trendRate', isPercent: true },
      { label: 'التوقع للشهر القادم', valueKey: 'forecastNext', isCurrency: true },
      { label: 'ثبات التكلفة', valueKey: 'stabilityRating' }
    ],
    columns: [
      { key: 'month', label: 'الشهر', align: 'right' },
      { key: 'amount', label: 'تكلفة الشهر', isCurrency: true, align: 'right' },
      { key: 'cumulative', label: 'التراكمي', isCurrency: true, align: 'right' },
      { key: 'changeRate', label: 'التغير %', isPercent: true, align: 'center' }
    ]
  },
  report_chart_monthly: {
    id: 'report_chart_monthly',
    category: 'analytics',
    categoryLabel: 'التحليلات والرسوم',
    title: 'رسم بياني: التحليل الشهري للأعمدة (Monthly Cost Analysis)',
    subtitle: 'أعمدة بيانية مقارنة للإنفاق الشهري مقابل المستهدف',
    iconName: 'BarChart3',
    chartType: 'bar',
    kpis: [
      { label: 'إجمالي الأشهر المسجلة', valueKey: 'totalCost', isCurrency: true },
      { label: 'متوسط الشهر', valueKey: 'avgMonthly', isCurrency: true },
      { label: 'أعلى شهر', valueKey: 'maxMonth' },
      { label: 'أقل شهر', valueKey: 'minMonth' }
    ],
    columns: [
      { key: 'month', label: 'الشهر', align: 'right' },
      { key: 'budget', label: 'الموازنة المقررة', isCurrency: true, align: 'right' },
      { key: 'actual', label: 'الفعلي المحقق', isCurrency: true, align: 'right' },
      { key: 'variance', label: 'الانحراف', isCurrency: true, align: 'right' }
    ]
  },
  report_chart_branch: {
    id: 'report_chart_branch',
    category: 'analytics',
    categoryLabel: 'التحليلات والرسوم',
    title: 'رسم بياني: مقارنة تكاليف الفروع',
    subtitle: 'أعمدة بيانية توضح حصة كل فرع من المصروفات التشغيلية',
    iconName: 'BarChart3',
    chartType: 'bar',
    kpis: [
      { label: 'إجمالي الفروع', valueKey: 'totalCost', isCurrency: true },
      { label: 'الفرع الأول إنفاقاً', valueKey: 'topBranch' },
      { label: 'حصة الفرع الأول', valueKey: 'topBranchShare', isPercent: true },
      { label: 'متوسط الفرع', valueKey: 'avgCost', isCurrency: true }
    ],
    columns: [
      { key: 'branch', label: 'الفرع', align: 'right' },
      { key: 'laborCost', label: 'العمالة', isCurrency: true, align: 'right' },
      { key: 'rentOpsCost', label: 'الإيجار والتشغيل', isCurrency: true, align: 'right' },
      { key: 'totalCost', label: 'إجمالي الفرع', isCurrency: true, align: 'right' },
      { key: 'sharePct', label: 'النسبة %', isPercent: true, align: 'center' }
    ]
  },
  report_chart_product: {
    id: 'report_chart_product',
    category: 'analytics',
    categoryLabel: 'التحليلات والرسوم',
    title: 'رسم بياني: تحليل تكاليف المنتجات',
    subtitle: 'مخطط بياني لهيكل تكلفة كل صنف مقارنة بسعر بيعه',
    iconName: 'BarChart3',
    chartType: 'bar',
    kpis: [
      { label: 'متوسط تكلفة الصنف', valueKey: 'avgCost', isCurrency: true },
      { label: 'متوسط سعر البيع', valueKey: 'avgPrice', isCurrency: true },
      { label: 'متوسط الربح للوحدة', valueKey: 'avgProfit', isCurrency: true },
      { label: 'المنتجات الرابحة', valueKey: 'profitableCount' }
    ],
    columns: [
      { key: 'name', label: 'المنتج', align: 'right' },
      { key: 'cost', label: 'التكلفة', isCurrency: true, align: 'right' },
      { key: 'price', label: 'سعر البيع', isCurrency: true, align: 'right' },
      { key: 'profit', label: 'الربح', isCurrency: true, align: 'right' },
      { key: 'marginPct', label: 'هامش الربح %', isPercent: true, align: 'center' }
    ]
  },
  report_chart_center: {
    id: 'report_chart_center',
    category: 'analytics',
    categoryLabel: 'التحليلات والرسوم',
    title: 'رسم بياني: تحليل مراكز التكلفة',
    subtitle: 'أعمدة بيانية لتوزيع التكلفة على المراكز الإنتاجية والخدمية',
    iconName: 'BarChart3',
    chartType: 'bar',
    kpis: [
      { label: 'إجمالي تكلفة المراكز', valueKey: 'totalCost', isCurrency: true },
      { label: 'أعلى مركز استهلاكاً', valueKey: 'topCenter' },
      { label: 'عدد المراكز', valueKey: 'centersCount' },
      { label: 'متوسط المركز', valueKey: 'avgCenterCost', isCurrency: true }
    ],
    columns: [
      { key: 'name', label: 'مركز التكلفة', align: 'right' },
      { key: 'budget', label: 'الموازنة', isCurrency: true, align: 'right' },
      { key: 'actual', label: 'المنصرف الفعلي', isCurrency: true, align: 'right' },
      { key: 'variance', label: 'الانحراف', isCurrency: true, align: 'right' }
    ]
  },
  report_chart_budget: {
    id: 'report_chart_budget',
    category: 'analytics',
    categoryLabel: 'التحليلات والرسوم',
    title: 'رسم بياني: مسار الموازنة التقديرية (Budget Area)',
    subtitle: 'مخطط مساحي يقارن سقف الموازنة بالمنحنى التصاعدي للصرف الفعلي',
    iconName: 'AreaChart',
    chartType: 'area',
    kpis: [
      { label: 'سقف الموازنة الكلي', valueKey: 'totalBudget', isCurrency: true },
      { label: 'إجمالي المنصرف', valueKey: 'totalActual', isCurrency: true },
      { label: 'نسبة استهلاك السقف', valueKey: 'burnRate', isPercent: true },
      { label: 'الفائض المالي المتوقع', valueKey: 'expectedSurplus', isCurrency: true }
    ],
    columns: [
      { key: 'period', label: 'الفترة', align: 'right' },
      { key: 'budgetLimit', label: 'سقف الموازنة', isCurrency: true, align: 'right' },
      { key: 'actualCumulative', label: 'المنصرف التراكمي', isCurrency: true, align: 'right' },
      { key: 'burnPct', label: 'نسبة الاستهلاك', isPercent: true, align: 'center' }
    ]
  },
  report_chart_variance: {
    id: 'report_chart_variance',
    category: 'analytics',
    categoryLabel: 'التحليلات والرسوم',
    title: 'رسم بياني: أعمدة الانحرافات المالية',
    subtitle: 'أعمدة ثنائية الاتجاه توضح الوفر المالي الإيجابي والعجز المالي السلبي',
    iconName: 'BarChart3',
    chartType: 'bar',
    kpis: [
      { label: 'صافي الانحراف المالي', valueKey: 'netVariance', isCurrency: true },
      { label: 'إجمالي الوفر المحقق', valueKey: 'totalSavings', isCurrency: true },
      { label: 'إجمالي العجز المالي', valueKey: 'totalDeficit', isCurrency: true },
      { label: 'مؤشر التوازن المالي', valueKey: 'balanceIndex' }
    ],
    columns: [
      { key: 'item', label: 'البند / المركز', align: 'right' },
      { key: 'varianceValue', label: 'قيمة الانحراف', isCurrency: true, align: 'right' },
      { key: 'status', label: 'النوع (وفر / عجز)', isBadge: true, align: 'center' }
    ]
  },
  report_chart_top_centers: {
    id: 'report_chart_top_centers',
    category: 'analytics',
    categoryLabel: 'التحليلات والرسوم',
    title: 'رسم بياني: أعلى 10 مراكز تكلفة',
    subtitle: 'أعمدة بيانية أفقية لمراكز التكلفة العشرة الأكثر استهلاكاً',
    iconName: 'BarChart3',
    chartType: 'horizontal_bar',
    kpis: [
      { label: 'إنفاق أعلى 10 مراكز', valueKey: 'top10Total', isCurrency: true },
      { label: 'نسبتها من الإنفاق', valueKey: 'top10Share', isPercent: true },
      { label: 'المركز الأول', valueKey: 'rank1Center' },
      { label: 'إنفاق المركز الأول', valueKey: 'rank1Val', isCurrency: true }
    ],
    columns: [
      { key: 'rank', label: 'الترتيب', align: 'center' },
      { key: 'name', label: 'مركز التكلفة', align: 'right' },
      { key: 'amount', label: 'إجمالي الإنفاق', isCurrency: true, align: 'right' },
      { key: 'sharePct', label: 'النسبة %', isPercent: true, align: 'center' }
    ]
  },
  report_chart_top_expenses: {
    id: 'report_chart_top_expenses',
    category: 'analytics',
    categoryLabel: 'التحليلات والرسوم',
    title: 'رسم بياني: أعلى فئات المصروفات',
    subtitle: 'أعمدة ترتيب تنازلي لأكثر بنود المصاريف تأثيراً على الربحية',
    iconName: 'BarChart3',
    chartType: 'horizontal_bar',
    kpis: [
      { label: 'إجمالي أعلى المصروفات', valueKey: 'topExpensesTotal', isCurrency: true },
      { label: 'أعلى بند مصروف', valueKey: 'topExpenseItem' },
      { label: 'قيمة أعلى بند', valueKey: 'topExpenseVal', isCurrency: true },
      { label: 'نسبته من المصاريف', valueKey: 'topExpenseShare', isPercent: true }
    ],
    columns: [
      { key: 'rank', label: 'الترتيب', align: 'center' },
      { key: 'name', label: 'بند المصروف', align: 'right' },
      { key: 'amount', label: 'المبلغ', isCurrency: true, align: 'right' },
      { key: 'sharePct', label: 'النسبة %', isPercent: true, align: 'center' }
    ]
  },
  report_chart_top_products: {
    id: 'report_chart_top_products',
    category: 'analytics',
    categoryLabel: 'التحليلات والرسوم',
    title: 'رسم بياني: أعلى المنتجات تكلفة',
    subtitle: 'ترتيب المنتجات الأكثر استهلاكاً للمواد الخام وتكاليف التشغيل',
    iconName: 'BarChart3',
    chartType: 'horizontal_bar',
    kpis: [
      { label: 'إجمالي تكلفة أعلى المنتجات', valueKey: 'topProdsTotal', isCurrency: true },
      { label: 'المنتج الأعلى تكلفة للوحدة', valueKey: 'topProdName' },
      { label: 'تكلفة وحدته', valueKey: 'topProdCost', isCurrency: true },
      { label: 'هامش ربحه', valueKey: 'topProdMargin', isPercent: true }
    ],
    columns: [
      { key: 'rank', label: 'الترتيب', align: 'center' },
      { key: 'name', label: 'المنتج', align: 'right' },
      { key: 'cost', label: 'تكلفة الوحدة', isCurrency: true, align: 'right' },
      { key: 'price', label: 'سعر البيع', isCurrency: true, align: 'right' },
      { key: 'marginPct', label: 'نسبة الهامش', isPercent: true, align: 'center' }
    ]
  },
  report_chart_period_compare: {
    id: 'report_chart_period_compare',
    category: 'analytics',
    categoryLabel: 'التحليلات والرسوم',
    title: 'رسم بياني: مقارنة الفترات الزمنية المتقابلة',
    subtitle: 'خطوط بيانية مزدوجة لمقارنة إنفاق العام الحالي مع العام السابق',
    iconName: 'LineChart',
    chartType: 'line',
    kpis: [
      { label: 'تكلفة العام الحالي', valueKey: 'currentYearCost', isCurrency: true },
      { label: 'تكلفة العام السابق', valueKey: 'prevYearCost', isCurrency: true },
      { label: 'نسبة التغير السنوي', valueKey: 'annualGrowth', isPercent: true },
      { label: 'مؤشر التحكم في التكاليف', valueKey: 'costControlScore' }
    ],
    columns: [
      { key: 'month', label: 'الشهر', align: 'right' },
      { key: 'current', label: 'العام الحالي', isCurrency: true, align: 'right' },
      { key: 'previous', label: 'العام السابق', isCurrency: true, align: 'right' },
      { key: 'diff', label: 'الفارق', isCurrency: true, align: 'right' },
      { key: 'growthPct', label: 'معدل التغير %', isPercent: true, align: 'center' }
    ]
  }
};
