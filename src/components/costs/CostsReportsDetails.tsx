import React, { useState, useMemo } from 'react';
import {
  FileText,
  Layers,
  Tag,
  Package,
  Briefcase,
  Building,
  Users,
  Percent,
  BarChart3,
  PieChart,
  LineChart,
  AreaChart,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Printer,
  Download,
  Search,
  RefreshCw,
  ArrowRightLeft,
  Wallet,
  Building2,
  HelpCircle,
  Activity,
  Hash,
  Filter,
  Check
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart as RechartsLineChart,
  Line,
  AreaChart as RechartsAreaChart,
  Area,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import * as XLSX from 'xlsx';
import { downloadDataAsPdf } from '../../utils/pdfExport';
import { api } from '../../utils/api';
import {
  COST_REPORT_CATEGORIES,
  COST_REPORTS_REGISTRY,
  CostReportDefinition
} from './costReportsData';
import { generateCostReportData } from './costReportsGenerator';
import { pageRows, PaginationBar, usePaginationState } from "../PaginationBar";

const CHART_COLORS = [
  '#4f46e5', // Indigo
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#3b82f6', // Blue
  '#14b8a6', // Teal
  '#f97316', // Orange
];

interface CostsReportsDetailsProps {
  reportId?: string;
  onSelectReport?: (reportId: string) => void;
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
}

export const CostsReportsDetails: React.FC<CostsReportsDetailsProps> = ({
  reportId = 'report_op_summary',
  onSelectReport,
  costs = [],
  filteredCosts = [],
  centers = [],
  items = [],
  budgets = [],
  branches = [],
  products = [],
  ingredients = [],
  employees = [],
  departments = [],
  suppliers = [],
  customers = []
}) => {  const pgn1 = usePaginationState();

  // Current active report ID (supports both external prop and internal switching)
  const [currentReportId, setCurrentReportId] = useState<string>(() => {
    const raw = reportId || 'report_op_summary';
    return raw.startsWith('report_') ? raw : `report_${raw}`;
  });

  // Category filter for the reports navigation
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // Filters state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedCenter, setSelectedCenter] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Live API data states for real cost reports
  const [liveProducts, setLiveProducts] = useState<any[]>([]);
  const [liveIngredients, setLiveIngredients] = useState<any[]>([]);
  const [loadingLiveReport, setLoadingLiveReport] = useState<boolean>(false);

  // Fetch real product cost reports directly from backend API
  const fetchLiveReportData = async () => {
    try {
      setLoadingLiveReport(true);
      const queryParams = new URLSearchParams();
      if (fromDate) queryParams.append('from_date', fromDate);
      if (toDate) queryParams.append('to_date', toDate);
      if (selectedBranch && selectedBranch !== 'all') queryParams.append('branch_id', selectedBranch);
      if (selectedCenter && selectedCenter !== 'all') queryParams.append('cost_center_id', selectedCenter);
      if (searchTerm) queryParams.append('search', searchTerm);

      const [resProd, resIng] = await Promise.all([
        api.get(`/api/costs/reports/product-costs?${queryParams.toString()}`).catch(() => null),
        api.get(`/api/costs/recipe-costing/all-ingredients`).catch(() => null)
      ]);

      if (resProd && resProd.ok) {
        const json = await resProd.json();
        if (json.success && Array.isArray(json.data)) {
          setLiveProducts(json.data);
        }
      }

      if (resIng && resIng.ok) {
        const jsonIng = await resIng.json();
        if (jsonIng.success && Array.isArray(jsonIng.data)) {
          setLiveIngredients(jsonIng.data);
        }
      }
    } catch (e) {
      console.warn("Failed to load live cost report data from API:", e);
    } finally {
      setLoadingLiveReport(false);
      setIsRefreshing(false);
    }
  };

  React.useEffect(() => {
    fetchLiveReportData();
  }, [fromDate, toDate, selectedBranch, selectedCenter, currentReportId]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchLiveReportData();
  };

  // Sync when prop changes
  React.useEffect(() => {
    if (reportId) {
      const normalized = reportId.startsWith('report_') ? reportId : `report_${reportId}`;
      if (normalized !== currentReportId) {
        setCurrentReportId(normalized);
      }
    }
  }, [reportId]);

  const handleSelectReport = (newId: string) => {
    setCurrentReportId(newId);
    if (onSelectReport) {
      onSelectReport(newId);
    }
  };

  // Generate the specific report data using real data sources
  const effectiveProducts = liveProducts.length > 0 ? liveProducts : products;
  const effectiveIngredients = liveIngredients.length > 0 ? liveIngredients : ingredients;

  const reportOutput = useMemo(() => {
    return generateCostReportData({
      reportId: currentReportId,
      costs: filteredCosts.length > 0 ? filteredCosts : costs,
      centers,
      items,
      budgets,
      branches,
      products: effectiveProducts,
      ingredients: effectiveIngredients,
      employees,
      departments,
      suppliers,
      customers,
      filters: {
        fromDate,
        toDate,
        branch: selectedBranch,
        center: selectedCenter,
        search: searchTerm
      }
    });
  }, [
    currentReportId,
    costs,
    filteredCosts,
    centers,
    items,
    budgets,
    branches,
    effectiveProducts,
    effectiveIngredients,
    employees,
    departments,
    suppliers,
    customers,
    fromDate,
    toDate,
    selectedBranch,
    selectedCenter,
    searchTerm
  ]);

  const { definition, rows, kpiValues, chartData } = reportOutput;

  // Available reports list filtered by category
  const availableReports = useMemo(() => {
    const all = Object.values(COST_REPORTS_REGISTRY);
    if (activeCategory === 'all') return all;
    return all.filter(r => r.category === activeCategory);
  }, [activeCategory]);

  // Format currency helper
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('ar-EG', {
      style: 'currency',
      currency: 'EGP',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  // Format percentage helper
  const formatPercent = (val: number) => {
    return `${Number(val || 0).toFixed(1)}%`;
  };

  // Dynamic icon selector
  const renderIcon = (name: string, className = 'w-5 h-5') => {
    switch (name) {
      case 'Layers': return <Layers className={className} />;
      case 'Tag': return <Tag className={className} />;
      case 'Package': return <Package className={className} />;
      case 'Briefcase': return <Briefcase className={className} />;
      case 'Building': return <Building className={className} />;
      case 'Building2': return <Building2 className={className} />;
      case 'Users': return <Users className={className} />;
      case 'User': return <Users className={className} />;
      case 'Percent': return <Percent className={className} />;
      case 'BarChart3': return <BarChart3 className={className} />;
      case 'PieChart': return <PieChart className={className} />;
      case 'LineChart': return <LineChart className={className} />;
      case 'AreaChart': return <AreaChart className={className} />;
      case 'TrendingUp': return <TrendingUp className={className} />;
      case 'TrendingDown': return <TrendingDown className={className} />;
      case 'DollarSign': return <DollarSign className={className} />;
      case 'Calendar': return <Calendar className={className} />;
      case 'CheckCircle2': return <CheckCircle2 className={className} />;
      case 'Clock': return <Clock className={className} />;
      case 'AlertTriangle': return <AlertTriangle className={className} />;
      case 'ArrowRightLeft': return <ArrowRightLeft className={className} />;
      case 'Wallet': return <Wallet className={className} />;
      case 'HelpCircle': return <HelpCircle className={className} />;
      case 'Activity': return <Activity className={className} />;
      case 'Hash': return <Hash className={className} />;
      default: return <FileText className={className} />;
    }
  };

  // Badge styler based on value
  const renderBadge = (val: any) => {
    const text = String(val || '');
    let bg = 'bg-slate-100 text-slate-700 border-slate-200';

    if (text.includes('معتمد') || text.includes('ممتاز') || text.includes('وفر') || text.includes('آمن') || text.includes('صحي') || text.includes('إيجابي') || text.includes('مكتمل')) {
      bg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    } else if (text.includes('معلق') || text.includes('تحذير') || text.includes('اقترب') || text.includes('متوسطة') || text.includes('جاري')) {
      bg = 'bg-amber-50 text-amber-700 border-amber-200';
    } else if (text.includes('تجاوز') || text.includes('عجز') || text.includes('خطر') || text.includes('ضعيف') || text.includes('عالية') || text.includes('قصوى') || text.includes('سلبي') || text.includes('غير ملائم')) {
      bg = 'bg-rose-50 text-rose-700 border-rose-200';
    } else if (text.includes('مباشرة') || text.includes('إنتاجي') || text.includes('عالي')) {
      bg = 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${bg}`}>
        {text}
      </span>
    );
  };

  // Export handlers
  const handleExportExcel = () => {
    const headers = definition.columns.map(c => c.label);
    const dataRows = rows.map(r => definition.columns.map(c => {
      const val = r[c.key];
      if (val === undefined || val === null) return '';
      return val;
    }));

    const sheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, definition.title.slice(0, 30));
    XLSX.writeFile(workbook, `${definition.id}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportCsv = () => {
    const headers = definition.columns.map(c => `"${c.label}"`);
    const lines = rows.map(r => definition.columns.map(c => {
      const val = r[c.key] ?? '';
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(','));

    const csvContent = '\ufeff' + [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${definition.id}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = async () => {
    const headers = definition.columns.map(c => c.label);
    const dataRows = rows.map(r => definition.columns.map(c => {
      const val = r[c.key];
      if (val === undefined || val === null) return '';
      if (c.isCurrency) return formatCurrency(Number(val));
      if (c.isPercent) return formatPercent(Number(val));
      return String(val);
    }));

    await downloadDataAsPdf(
      headers,
      dataRows,
      `${definition.id}_${new Date().toISOString().split('T')[0]}`,
      definition.title
    );
  };

  const handlePrint = () => {
    window.print();
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setFromDate('');
    setToDate('');
    setSelectedBranch('all');
    setSelectedCenter('all');
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 300);
  };

  // Render the tailored chart for this specific report
  const renderChart = () => {
    if (!chartData || chartData.length === 0) return null;

    if (definition.chartType === 'pie') {
      return (
        <div className="h-72 sm:h-80 w-full" id="report-pie-chart">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsPieChart>
              <Pie
                data={chartData.slice(0, 10)}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={110}
                paddingAngle={3}
              >
                {chartData.slice(0, 10).map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: any) => formatCurrency(Number(value || 0))}
                contentStyle={{ direction: 'rtl', borderRadius: '12px', border: '1px solid #e2e8f0' }}
              />
              <Legend layout="horizontal" verticalAlign="bottom" align="center" />
            </RechartsPieChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (definition.chartType === 'line') {
      return (
        <div className="h-72 sm:h-80 w-full" id="report-line-chart">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsLineChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(val: any) => formatCurrency(Number(val || 0))}
                contentStyle={{ direction: 'rtl', borderRadius: '12px', border: '1px solid #e2e8f0' }}
              />
              <Legend verticalAlign="top" height={36} />
              <Line type="monotone" dataKey="value" name="المصروف الفعلي" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              {chartData[0]?.previous !== undefined && (
                <Line type="monotone" dataKey="previous" name="الفترة السابقة" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" />
              )}
            </RechartsLineChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (definition.chartType === 'area') {
      return (
        <div className="h-72 sm:h-80 w-full" id="report-area-chart">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsAreaChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 20 }}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(val: any) => formatCurrency(Number(val || 0))}
                contentStyle={{ direction: 'rtl', borderRadius: '12px', border: '1px solid #e2e8f0' }}
              />
              <Area type="monotone" dataKey="value" name="التكلفة" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#areaGradient)" />
            </RechartsAreaChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (definition.chartType === 'horizontal_bar') {
      return (
        <div className="h-72 sm:h-80 w-full" id="report-hbar-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={chartData.slice(0, 8)} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#475569' }} />
              <Tooltip
                formatter={(val: any) => formatCurrency(Number(val || 0))}
                contentStyle={{ direction: 'rtl', borderRadius: '12px', border: '1px solid #e2e8f0' }}
              />
              <Bar dataKey="value" name="القيمة" fill="#4f46e5" radius={[0, 6, 6, 0]}>
                {chartData.slice(0, 8).map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (definition.chartType === 'table_only') {
      return null;
    }

    // Default Vertical BarChart
    return (
      <div className="h-72 sm:h-80 w-full" id="report-vbar-chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData.slice(0, 12)} margin={{ top: 10, right: 20, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(val: any) => formatCurrency(Number(val || 0))}
              contentStyle={{ direction: 'rtl', borderRadius: '12px', border: '1px solid #e2e8f0' }}
            />
            <Legend verticalAlign="top" height={36} />
            {chartData[0]?.budget !== undefined && (
              <Bar dataKey="budget" name="الموازنة المعتمدة" fill="#94a3b8" radius={[6, 6, 0, 0]} />
            )}
            <Bar dataKey={chartData[0]?.actual !== undefined ? 'actual' : 'value'} name="المنصرف الفعلي" fill="#4f46e5" radius={[6, 6, 0, 0]}>
              {chartData.slice(0, 12).map((_, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Bar>
            {chartData[0]?.profit !== undefined && (
              <Bar dataKey="profit" name="هامش الربح" fill="#10b981" radius={[6, 6, 0, 0]} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200" dir="rtl" id="costs-reports-details-container">
      {/* 1. Header & Navigation Ribbon */}
      <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200/80 shadow-sm space-y-5" id="reports-main-header">
        {/* Breadcrumb & Action Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span>مديول التكاليف المتقدم</span>
              <span className="text-slate-300">/</span>
              <span className="text-indigo-600 font-bold">{definition.categoryLabel}</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-800 font-black">{definition.title}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm">
                {renderIcon(definition.iconName, 'w-6 h-6')}
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                  <span>{definition.title}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
                    {rows.length} سجل
                  </span>
                </h1>
                <p className="text-xs md:text-sm text-slate-500 mt-0.5">{definition.subtitle}</p>
              </div>
            </div>
          </div>

          {/* Export and Print Buttons */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
            <button
              type="button"
              onClick={handleExportExcel}
              id="btn-export-excel"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/80 hover:bg-emerald-100/70 text-xs font-bold transition-colors shadow-sm"
              title="تصدير شيت إكسيل"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>تصدير Excel</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              id="btn-export-csv"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200/80 hover:bg-blue-100/70 text-xs font-bold transition-colors shadow-sm"
              title="تصدير ملف CSV"
            >
              <FileText className="w-4 h-4 text-blue-600" />
              <span>تصدير CSV</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              id="btn-export-pdf"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200/80 hover:bg-rose-100/70 text-xs font-bold transition-colors shadow-sm"
              title="تحميل كتقرير PDF"
            >
              <Download className="w-4 h-4 text-rose-600" />
              <span>تحميل PDF</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              id="btn-print-report"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200/70 text-xs font-bold transition-colors shadow-sm"
              title="طباعة التقرير"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>طباعة</span>
            </button>
          </div>
        </div>

        {/* Categories Navigation Bar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-600">تصنيفات ومجموعات تقارير التكاليف:</span>
            <span className="text-[11px] text-slate-400 font-medium">إجمالي {Object.keys(COST_REPORTS_REGISTRY).length} تقريراً متخصصاً</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none" id="categories-ribbon">
            {COST_REPORT_CATEGORIES.map(cat => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setActiveCategory(cat.id);
                    if (cat.id !== 'all') {
                      const firstInCat = Object.values(COST_REPORTS_REGISTRY).find(r => r.category === cat.id);
                      if (firstInCat && firstInCat.id !== currentReportId) {
                        handleSelectReport(firstInCat.id);
                      }
                    }
                  }}
                  id={`cat-pill-${cat.id}`}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border shrink-0 ${
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {renderIcon(cat.icon, 'w-3.5 h-3.5')}
                  <span>{cat.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    isActive ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-200/80 text-slate-600'
                  }`}>
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Report Switcher Selector */}
        <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-slate-700">اختر التقرير المراد عرضه:</span>
          </div>
          <div className="w-full md:w-auto flex-1 max-w-xl">
            <select
              value={currentReportId}
              onChange={(e) => handleSelectReport(e.target.value)}
              id="report-select-dropdown"
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-sm"
            >
              {availableReports.map(rep => (
                <option key={rep.id} value={rep.id}>
                  {rep.categoryLabel} &gt; {rep.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 self-end md:self-auto text-xs text-slate-500 font-semibold">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span>بيانات وخصائص مخصصة لهذا التقرير</span>
          </div>
        </div>
      </div>

      {/* 2. Tailored KPI Cards (Unique 4 KPIs for each report!) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="report-kpi-grid">
        {definition.kpis.map((kpi, idx) => {
          const rawVal = kpiValues[kpi.valueKey];
          let displayVal = rawVal;
          if (rawVal === undefined || rawVal === null) displayVal = '0';
          else if (kpi.isCurrency) displayVal = formatCurrency(Number(rawVal));
          else if (kpi.isPercent) displayVal = formatPercent(Number(rawVal));

          // Alternating subtle border & icon styling
          const colors = [
            'border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30 text-indigo-700',
            'border-emerald-100 bg-gradient-to-br from-white to-emerald-50/30 text-emerald-700',
            'border-amber-100 bg-gradient-to-br from-white to-amber-50/30 text-amber-700',
            'border-blue-100 bg-gradient-to-br from-white to-blue-50/30 text-blue-700'
          ];
          const colorClass = colors[idx % colors.length];

          return (
            <div
              key={kpi.valueKey + idx}
              id={`kpi-card-${kpi.valueKey}`}
              className={`p-5 rounded-3xl bg-white border shadow-sm flex flex-col justify-between gap-3 ${colorClass}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-600">{kpi.label}</span>
                <div className="w-7 h-7 rounded-xl bg-white shadow-xs flex items-center justify-center border border-slate-100">
                  {idx === 0 && <DollarSign className="w-4 h-4 text-indigo-600" />}
                  {idx === 1 && <TrendingUp className="w-4 h-4 text-emerald-600" />}
                  {idx === 2 && <Percent className="w-4 h-4 text-amber-600" />}
                  {idx === 3 && <Activity className="w-4 h-4 text-blue-600" />}
                </div>
              </div>
              <div>
                <span className="text-xl md:text-2xl font-black text-slate-900 tracking-tight block">
                  {displayVal}
                </span>
                <span className="text-[11px] font-semibold text-slate-400 mt-1 block">
                  {kpi.subtext || 'مؤشر أداء مباشر للتقرير'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Visual Chart Panel (When applicable) */}
      {definition.chartType !== 'table_only' && chartData.length > 0 && (
        <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200/80 shadow-sm space-y-4" id="report-chart-section">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-black text-slate-800">
                التمثيل البياني والإحصائي للتقرير
              </h3>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              {chartData.length} مؤشراً بيانياً
            </span>
          </div>
          {renderChart()}
        </div>
      )}

      {/* 4. Filter & Search Controls Bar */}
      <div className="bg-white rounded-3xl p-4 md:p-5 border border-slate-200/80 shadow-sm space-y-3" id="report-filters-bar">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-black text-slate-700">
            <Filter className="w-4 h-4 text-indigo-600" />
            <span>تصفية وتخصيص بيانات التقرير</span>
          </div>
          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-bold transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>إعادة ضبط الفلاتر</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Live Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث في سجلات التقرير..."
              id="filter-search-input"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
            />
          </div>

          {/* Branch Filter */}
          <div>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              id="filter-branch-select"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
            >
              <option value="all">كافة الفروع والمواقع</option>
              {branches && branches.length > 0 ? (
                branches.map((b: any, idx: number) => (
                  <option key={b.id || idx} value={b.name || b.id}>
                    {b.name || `فرع ${b.id}`}
                  </option>
                ))
              ) : (
                <>
                  <option value="الفرع الرئيسي">الفرع الرئيسي</option>
                  <option value="المطبخ المركزي">المطبخ المركزي</option>
                </>
              )}
            </select>
          </div>

          {/* Center Filter */}
          <div>
            <select
              value={selectedCenter}
              onChange={(e) => setSelectedCenter(e.target.value)}
              id="filter-center-select"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
            >
              <option value="all">كافة مراكز التكلفة</option>
              {centers && centers.length > 0 ? (
                centers.map((c: any, idx: number) => (
                  <option key={c.id || idx} value={c.name || c.cost_center_name || c.id}>
                    {c.name || c.cost_center_name || `مركز ${c.id}`}
                  </option>
                ))
              ) : (
                <>
                  <option value="المطبخ المركزي">المطبخ المركزي</option>
                  <option value="صالة المطعم">صالة المطعم والضيافة</option>
                </>
              )}
            </select>
          </div>

          {/* Date range picker */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              id="filter-date-from"
              className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              title="من تاريخ"
            />
            <span className="text-slate-300 text-xs">إلى</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              id="filter-date-to"
              className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              title="إلى تاريخ"
            />
          </div>
        </div>
      </div>

      {/* 5. Specialized Data Table (Unique Columns & Footers) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden" id="report-table-section">
        <div className="p-4 md:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span className="text-xs md:text-sm font-black text-slate-800">
              جدول البيانات التفصيلي: {definition.title}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {loadingLiveReport && (
              <span className="text-xs font-bold text-indigo-600 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>جاري تحديث البيانات...</span>
              </span>
            )}
            <span className="text-xs text-slate-500 font-semibold">
              عرض {rows.length} سجل
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs md:text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/90 text-slate-600 font-black">
                <th className="py-3.5 px-4 text-center w-12">#</th>
                {definition.columns.map((col, idx) => (
                  <th
                    key={col.key + idx}
                    className={`py-3.5 px-4 text-xs font-black text-slate-700 whitespace-nowrap ${
                      col.align === 'center' ? 'text-center' : col.align === 'left' ? 'text-left' : 'text-right'
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={definition.columns.length + 1} className="py-12 text-center text-slate-400 font-bold">
                    <div className="max-w-md mx-auto space-y-3 p-6 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
                      <Search className="w-10 h-10 text-slate-300 mx-auto" />
                      <h4 className="text-sm font-black text-slate-700">لا توجد بيانات مطابقة لمعايير البحث</h4>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed">
                        {definition.category === 'products'
                          ? 'لم يتم العثور على منتجات أو وصفات تكلفة (Recipe Costing / BOM) مسجلة مطابقة للفلاتر المحددة في قاعدة البيانات.'
                          : 'لا توجد حركات تكاليف أو قيود مطابقة للفترة أو المركز المحدد.'}
                      </p>
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-bold underline pt-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>إلغاء الفلاتر وإعادة التحميل</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (pageRows(rows, pgn1).map((row, rowIdx) => (
                  <tr
                    key={rowIdx}
                    className="hover:bg-indigo-50/30 transition-colors group"
                  >
                    <td className="py-3.5 px-4 text-center font-bold text-slate-400 text-xs">
                      {rowIdx + 1}
                    </td>
                    {definition.columns.map((col, colIdx) => {
                      const val = row[col.key];

                      let content: React.ReactNode = val;
                      if (val === undefined || val === null || val === '') {
                        content = <span className="text-slate-300">-</span>;
                      } else if (col.isBadge) {
                        content = renderBadge(val);
                      } else if (col.isCurrency) {
                        content = (
                          <span className="font-mono font-bold text-slate-900">
                            {formatCurrency(Number(val))}
                          </span>
                        );
                      } else if (col.isPercent) {
                        content = (
                          <span className="font-mono font-bold text-indigo-700 bg-indigo-50/60 px-2 py-0.5 rounded-md border border-indigo-100">
                            {formatPercent(Number(val))}
                          </span>
                        );
                      } else {
                        content = <span className="font-semibold text-slate-800">{String(val)}</span>;
                      }

                      return (
                        <td
                          key={col.key + colIdx}
                          className={`py-3.5 px-4 whitespace-nowrap ${
                            col.align === 'center' ? 'text-center' : col.align === 'left' ? 'text-left' : 'text-right'
                          }`}
                        >
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
            {/* Table Footer with Summaries when rows exist */}
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 font-black border-t-2 border-slate-200 text-slate-900">
                  <td className="py-3.5 px-4 text-center text-xs text-slate-500">
                    الإجمالي
                  </td>
                  {definition.columns.map((col, cIdx) => {
                    if (cIdx === 0) {
                      return (
                        <td key={cIdx} className="py-3.5 px-4 font-black text-slate-800">
                          الإجمالي العام ({rows.length} بند)
                        </td>
                      );
                    }
                    if (col.isCurrency) {
                      const sum = rows.reduce((s, r) => s + (Number(r[col.key]) || 0), 0);
                      return (
                        <td
                          key={cIdx}
                          className={`py-3.5 px-4 font-mono font-black text-indigo-900 ${
                            col.align === 'center' ? 'text-center' : col.align === 'left' ? 'text-left' : 'text-right'
                          }`}
                        >
                          {formatCurrency(sum)}
                        </td>
                      );
                    }
                    if (col.isPercent) {
                      const avg = rows.reduce((s, r) => s + (Number(r[col.key]) || 0), 0) / Math.max(1, rows.length);
                      return (
                        <td
                          key={cIdx}
                          className={`py-3.5 px-4 font-mono font-black text-indigo-700 ${
                            col.align === 'center' ? 'text-center' : col.align === 'left' ? 'text-left' : 'text-right'
                          }`}
                        >
                          {formatPercent(avg)} (متوسط)
                        </td>
                      );
                    }
                    return <td key={cIdx} className="py-3.5 px-4 text-slate-400 text-center">-</td>;
                  })}
                </tr>
              </tfoot>
            )}
          </table>
          <PaginationBar page={pgn1.page} pageSize={pgn1.pageSize} total={(rows).length} onPage={pgn1.setPage} onPageSize={pgn1.setPageSize} />
        </div>
      </div>
    </div>
  );
};

export default CostsReportsDetails;
