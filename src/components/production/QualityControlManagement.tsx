import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Plus, Search, AlertCircle, Ban, RefreshCcw, X, 
  Layers, Package, Wrench, BarChart2, CheckCircle2, ClipboardList,
  AlertOctagon, Check, TrendingDown, Users, FileText, ArrowLeftRight,
  Settings, CheckSquare, Sparkles, Filter, ChevronRight, UserCheck, Calendar, Info
} from 'lucide-react';
import { ProductionOrder, QualityCheck } from './types';

// Storage keys
const STORAGE_KEYS = {
  ORDERS: 'remo_production_orders',
  PRODUCTS: 'remo_production_products',
  QCP: 'remo_pro_quality_control_points',
  CHECKS: 'remo_pro_quality_checks',
  ALERTS: 'remo_pro_quality_alerts',
  TEAMS: 'remo_pro_quality_teams'
};

// Initial data representing standard elite Quality Control parameters
const INITIAL_TEAMS: any[] = [];
const INITIAL_QCP: any[] = [];
const INITIAL_CHECKS: any[] = [];
const INITIAL_ALERTS: any[] = [];

type ActiveTab = 'dashboard' | 'qcp' | 'checks' | 'alerts' | 'teams';

export function QualityControlManagement() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  // Load state or fallback to seeded data
  const [teams, setTeams] = useState<any[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.TEAMS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter((t: any) => t && !['TEAM-1', 'TEAM-2', 'TEAM-3'].includes(t.id));
      } catch (e) {}
    }
    return [];
  });

  const [qcps, setQcps] = useState<any[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.QCP);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter((q: any) => q && !['QCP-001', 'QCP-002', 'QCP-003'].includes(q.id));
      } catch (e) {}
    }
    return [];
  });

  const [checks, setChecks] = useState<any[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CHECKS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter((c: any) => c && !['QC-1001', 'QC-1002'].includes(c.id));
      } catch (e) {}
    }
    return [];
  });

  const [alerts, setAlerts] = useState<any[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ALERTS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter((a: any) => a && !['QA-501', 'QA-502'].includes(a.id));
      } catch (e) {}
    }
    return [];
  });

  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    const savedOrders = localStorage.getItem(STORAGE_KEYS.ORDERS);
    if (savedOrders) {
      try { setOrders(JSON.parse(savedOrders)); } catch (e) {}
    }
    const savedProducts = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (savedProducts) {
      try { setProducts(JSON.parse(savedProducts)); } catch (e) {}
    }
  }, []);

  // Save to localStorage helpers
  const saveTeams = (data: any[]) => {
    setTeams(data);
    localStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(data));
  };
  const saveQcps = (data: any[]) => {
    setQcps(data);
    localStorage.setItem(STORAGE_KEYS.QCP, JSON.stringify(data));
  };
  const saveChecks = (data: any[]) => {
    setChecks(data);
    localStorage.setItem(STORAGE_KEYS.CHECKS, JSON.stringify(data));
  };
  const saveAlerts = (data: any[]) => {
    setAlerts(data);
    localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(data));
  };

  // Modals visibility States
  const [isQcpModalOpen, setIsQcpModalOpen] = useState(false);
  const [isCheckWizardOpen, setIsCheckWizardOpen] = useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [newQcp, setNewQcp] = useState({
    title: '',
    productId: 'all_finished',
    operationType: 'manufacturing',
    testType: 'pass_fail',
    targetValue: 0.0,
    toleranceMin: 0.0,
    toleranceMax: 0.0,
    unit: '',
    teamId: 'TEAM-2',
    instructions: ''
  });

  const [newCheck, setNewCheck] = useState({
    qcpId: '',
    orderNumber: '',
    testType: 'pass_fail',
    measuredValue: 0.0,
    status: 'pending',
    lotNumber: '',
    inspector: 'م. يوسف القاضي',
    notes: ''
  });

  const [newAlert, setNewAlert] = useState({
    title: '',
    checkId: 'manual',
    referenceCode: '',
    severity: 'medium',
    rootCause: 'material',
    disposition: 'rework',
    assignedTo: 'م. أحمد الشربيني',
    description: '',
    capaAction: ''
  });

  const [newTeam, setNewTeam] = useState({
    name: '',
    leader: '',
    inspectorsInput: '',
    department: 'قسم الجودة والفرز الكلي'
  });

  // Calculate ERP metrics
  const totalChecksCount = checks.length;
  const passedChecksCount = checks.filter(c => c.status === 'accepted').length;
  const passRate = totalChecksCount > 0 ? ((passedChecksCount / totalChecksCount) * 100).toFixed(1) : '100';
  
  const activeAlertsCount = alerts.filter(a => a.status !== 'resolved').length;
  const criticalAlertsCount = alerts.filter(a => a.severity === 'high' && a.status !== 'resolved').length;

  // Form Submissions
  const handleCreateQcp = (e: React.FormEvent) => {
    e.preventDefault();
    const id = `QCP-00${qcps.length + 1}`;
    
    // Find target product name for friendly text
    let targetProductName = 'جميع المنتجات التامة';
    if (newQcp.productId === 'all_raw') targetProductName = 'المواد المعدنية الخام';
    else if (newQcp.productId === 'all_semi') targetProductName = 'الهياكل الخارجية';
    else {
      const p = products.find(prod => prod.id === newQcp.productId);
      if (p) targetProductName = p.name;
    }

    const added = {
      id,
      ...newQcp,
      productName: targetProductName,
      targetValue: Number(newQcp.targetValue),
      toleranceMin: Number(newQcp.toleranceMin),
      toleranceMax: Number(newQcp.toleranceMax)
    };

    saveQcps([...qcps, added]);
    setIsQcpModalOpen(false);
    // Reset form
    setNewQcp({
      title: '',
      productId: 'all_finished',
      operationType: 'manufacturing',
      testType: 'pass_fail',
      targetValue: 0.0,
      toleranceMin: 0.0,
      toleranceMax: 0.0,
      unit: '',
      teamId: 'TEAM-2',
      instructions: ''
    });
  };

  const handleCreateCheck = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedQcp = qcps.find(q => q.id === newCheck.qcpId);
    if (!selectedQcp) return;

    const id = `QC-${Math.floor(1000 + Math.random() * 9000)}`;
    const measuredVal = Number(newCheck.measuredValue);
    
    // Auto status evaluation if measurement type
    let finalStatus = newCheck.status;
    if (selectedQcp.testType === 'measure') {
      if (measuredVal >= selectedQcp.toleranceMin && measuredVal <= selectedQcp.toleranceMax) {
        finalStatus = 'accepted';
      } else {
        finalStatus = 'rejected';
      }
    }

    const added = {
      id,
      qcpId: selectedQcp.id,
      qcpTitle: selectedQcp.title,
      orderNumber: newCheck.orderNumber || 'غير مرتبط بأمر',
      productName: selectedQcp.productName,
      testType: selectedQcp.testType,
      measuredValue: measuredVal,
      targetValue: selectedQcp.targetValue,
      toleranceMin: selectedQcp.toleranceMin,
      toleranceMax: selectedQcp.toleranceMax,
      unit: selectedQcp.unit,
      status: finalStatus,
      inspector: newCheck.inspector,
      lotNumber: newCheck.lotNumber || `LOT-${new Date().toISOString().substring(2, 7).replace('-', '')}`,
      checkedDate: new Date().toISOString().split('T')[0],
      notes: newCheck.notes
    };

    const newChecksList = [added, ...checks];
    saveChecks(newChecksList);

    // If check failed, automatically trigger a non-conformance quality alert (standard ERP/Odoo CAPA workflow)
    if (finalStatus === 'rejected') {
      const alertId = `QA-${Math.floor(500 + Math.random() * 500)}`;
      const autoAlert = {
        id: alertId,
        title: `إنذار تلقائي: فشل اختبار الـ ${selectedQcp.title}`,
        checkId: id,
        referenceCode: added.orderNumber,
        severity: 'high',
        rootCause: 'machine', 
        disposition: 'rework',
        status: 'new',
        assignedTo: added.inspector,
        description: `فشل الفحص الكمي بمركز العمل. القيمة المقاسة كانت ${measuredVal} ${added.unit} والمسموح به من ${added.toleranceMin} إلى ${added.toleranceMax}. ملاحظات المفتش: ${added.notes}`,
        capaAction: 'عزل الشحنة/اللوت فوراً في مربع الحجر الصحي، وإدخال الماكينة في نظام المعايرة الدورية.',
        loggedDate: added.checkedDate
      };
      saveAlerts([autoAlert, ...alerts]);
    }

    // Sync status change of production order if connected and approved/rejected
    if (newCheck.orderNumber) {
      const updatedOrders = orders.map(o => {
        if (o.orderNumber === newCheck.orderNumber) {
          if (finalStatus === 'accepted') {
            return {
              ...o,
              status: 'completed' as const,
              progress: 100,
              notes: `بوابة الجودة والفرز: اجتياز فحص المطابقة الفنية بنتيجة ممتازة بنجاح في ${added.checkedDate}.`
            };
          } else {
            return {
              ...o,
              status: 'in_progress' as const,
              notes: `إخفاق الجودة وسند عزل صحي: الدفعة مرفوضة لوجود عيوب فنية قياسية وجارٍ التحقيق.`
            };
          }
        }
        return o;
      });
      setOrders(updatedOrders);
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(updatedOrders));
    }

    setIsCheckWizardOpen(false);
    setNewCheck({
      qcpId: '',
      orderNumber: '',
      testType: 'pass_fail',
      measuredValue: 0.0,
      status: 'pending',
      lotNumber: '',
      inspector: 'م. يوسف القاضي',
      notes: ''
    });
  };

  const handleCreateAlert = (e: React.FormEvent) => {
    e.preventDefault();
    const id = `QA-${Math.floor(500 + Math.random() * 500)}`;
    const added = {
      id,
      ...newAlert,
      status: 'new',
      loggedDate: new Date().toISOString().split('T')[0]
    };
    saveAlerts([added, ...alerts]);
    setIsAlertModalOpen(false);
    setNewAlert({
      title: '',
      checkId: 'manual',
      referenceCode: '',
      severity: 'medium',
      rootCause: 'material',
      disposition: 'rework',
      assignedTo: 'م. أحمد الشربيني',
      description: '',
      capaAction: ''
    });
  };

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    const id = `TEAM-${teams.length + 1}`;
    const added = {
      id,
      name: newTeam.name,
      leader: newTeam.leader,
      inspectors: newTeam.inspectorsInput.split(',').map(s => s.trim()).filter(Boolean),
      department: newTeam.department
    };
    saveTeams([...teams, added]);
    setIsTeamModalOpen(false);
    setNewTeam({ name: '', leader: '', inspectorsInput: '', department: 'قسم الجودة والفرز الكلي' });
  };

  const updateAlertStatus = (alertId: string, nextStatus: 'new' | 'investigating' | 'corrective_action' | 'resolved') => {
    const updated = alerts.map(a => a.id === alertId ? { ...a, status: nextStatus } : a);
    saveAlerts(updated);
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'high': return 'bg-rose-50 text-rose-700 border-rose-100 font-bold';
      case 'medium': return 'bg-amber-50 text-amber-700 border-amber-100 font-bold';
      default: return 'bg-slate-50 text-slate-705 border-slate-150 font-bold';
    }
  };

  const getAlertStatusBadge = (st: string) => {
    switch (st) {
      case 'new': return 'bg-rose-100 text-rose-800 font-black';
      case 'investigating': return 'bg-indigo-100 text-indigo-800 font-black';
      case 'corrective_action': return 'bg-amber-100 text-amber-800 font-black';
      case 'resolved': return 'bg-emerald-100 text-emerald-800 font-black';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getRootCauseLabel = (rc: string) => {
    switch(rc) {
      case 'machine': return '⚙ عطل/معايرة الماكينة';
      case 'material': return '📦 الخامات ومعيب المورد';
      case 'human': return '👤 خطأ بشري / قلة التدريب';
      case 'method': return '📐 خلل بالتصميم/خطة الصنع';
      default: return 'غير معروف';
    }
  };

  const getDispositionLabel = (dp: string) => {
    switch(dp) {
      case 'rework': return 'إعادة تشغيل (Rework)';
      case 'scrap': return 'تخريد نهائي (Scrap)';
      case 'vendor_return': return 'مرتجع للمورد مع تعويض المالي';
      case 'as_is': return 'مسموح به بالحالة الراهنة (Use As-is)';
      default: return dp;
    }
  };

  return (
    <div className="space-y-6 w-full px-2 text-right" id="odoo_quality_hub" dir="rtl">
      
      {/* Dynamic Odoo-ERP Style Quality Module Header - Styled in elegant pristine white */}
      <div className="bg-white text-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200/85 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
              <Sparkles className="w-3" />
              ERP Elite Quality Management
            </span>
          </div>
          <h1 className="text-xl lg:text-2xl font-extrabold tracking-tight text-slate-900">نظام مراقبة وضمان الجودة الشامل</h1>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            التحكم الذكي بمقاييس الانحراف ومطابقة السلع طبقاً لأحدث المعايير القياسية العالمية. يدير النظام نقاط الفحص الفنية (QCP)، الفحوصات الاستباقية (QC Checks)، الإفراج النهائي عن الإنتاج التام، وسجل حوادث عدم المطابقة (CAPA).
          </p>
        </div>

        {/* Tab Selection in Pristine Matching Light Colors */}
        <div className="flex flex-wrap gap-1.5 bg-slate-50 p-1.5 rounded-2xl border border-slate-200/60 self-start lg:self-center">
          {(['dashboard', 'qcp', 'checks', 'alerts', 'teams'] as ActiveTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setSearchQuery(''); }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === tab 
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/15' 
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab === 'dashboard' && 'لوحة التحكم والمؤشرات'}
              {tab === 'qcp' && 'نقاط المراقبة (QCP)'}
              {tab === 'checks' && 'فحوصات الجودة (QC Checks)'}
              {tab === 'alerts' && 'تقارير عدم المطابقة (CAPA)'}
              {tab === 'teams' && 'فرق التفتيش'}
            </button>
          ))}
        </div>
      </div>

      {/* SEARCH / ACTION QUICK RAIL FOR TABS */}
      {activeTab !== 'dashboard' && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full sm:max-w-md">
            <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="البحث بالرمز، الكود الفني، أو المفتش المسؤول..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-bold text-slate-800"
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
            {activeTab === 'qcp' && (
              <button 
                onClick={() => setIsQcpModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm shadow-emerald-700/20"
              >
                <Plus className="w-4 h-4" />
                إنشاء نقطة مراقبة جودة QCP جديد
              </button>
            )}
            {activeTab === 'checks' && (
              <button 
                onClick={() => setIsCheckWizardOpen(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm shadow-emerald-700/20"
              >
                <Plus className="w-4 h-4" />
                سجل عملية فحص جودة استباقية
              </button>
            )}
            {activeTab === 'alerts' && (
              <button 
                onClick={() => setIsAlertModalOpen(true)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm shadow-rose-700/20"
              >
                <AlertOctagon className="w-4 h-4" />
                تثبيت تذكرة عدم مطابقة يدوية (NCR)
              </button>
            )}
            {activeTab === 'teams' && (
              <button 
                onClick={() => setIsTeamModalOpen(true)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm"
              >
                <Users className="w-4 h-4" />
                إضافة فريق تفتيش ومعاينة جديد
              </button>
            )}
          </div>
        </div>
      )}

      {/* Active Tab Views */}
      {/* 1. DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Main ERP Dashboard Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border rounded-2xl p-5 shadow-xs flex items-center justify-between">
              <div className="space-y-1">
                <span className="block text-xs font-bold text-slate-400">معدل العوازل وقبول القطع</span>
                <span className="text-2xl font-black text-emerald-600 font-mono block">{passRate}%</span>
                <span className="text-[9px] text-slate-500 font-bold block">✔ تم فحص واجتياز {passedChecksCount} قطعة</span>
              </div>
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white border rounded-2xl p-5 shadow-xs flex items-center justify-between">
              <div className="space-y-1">
                <span className="block text-xs font-bold text-slate-400">نقاط المراقبة الفنية النشطة (QCP)</span>
                <span className="text-2xl font-black text-slate-800 font-mono block">{qcps.length} نقاط</span>
                <span className="text-[9px] text-emerald-700 font-bold block">تتحكم بكافة خطوط التصنيع</span>
              </div>
              <div className="w-12 h-12 bg-slate-50 text-slate-700 rounded-xl flex items-center justify-center">
                <CheckSquare className="w-6 h-6 text-indigo-500" />
              </div>
            </div>

            <div className="bg-white border rounded-2xl p-5 shadow-xs flex items-center justify-between">
              <div className="space-y-1">
                <span className="block text-xs font-bold text-slate-400">إجمالي عينات الفحص المستوفاة</span>
                <span className="text-2xl font-black text-indigo-600 font-mono block">{totalChecksCount} عينة</span>
                <span className="text-[9px] text-slate-500 font-bold block">موزعة بالتناسب على فرق الفرز</span>
              </div>
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <ClipboardList className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white border rounded-2xl p-5 shadow-xs flex items-center justify-between">
              <div className="space-y-1">
                <span className="block text-xs font-bold text-slate-400">إنذارات عدم المطابقة النشطة (CAPA)</span>
                <span className="text-2xl font-black text-rose-600 font-mono block">{activeAlertsCount} إنذارات</span>
                <span className="text-[9px] text-rose-500 font-bold block">🚨 منها {criticalAlertsCount} عيوب حرجة بالمخرطة</span>
              </div>
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                <AlertOctagon className="w-6 h-6 animate-pulse" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Trend Graph */}
            <div className="lg:col-span-8 bg-white p-6 rounded-2xl border flex flex-col justify-between shadow-xs min-h-[350px]">
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <TrendingDown className="w-4.5 h-4.5 text-emerald-500" />
                    مؤشر خفض العيوب والانحرافات السداسي (Six Sigma Metric)
                  </h3>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-bold">خفض العيب الفني لنموذج FQC</span>
                </div>

                <div className="relative w-full h-52 flex items-end pt-4">
                  <div className="absolute inset-0 flex flex-col justify-between text-[9px] text-slate-350 pointer-events-none select-none font-mono">
                    <div className="border-b w-full h-0 pb-1">مستوى الأمان (أقل من 3%)</div>
                    <div className="border-b w-full h-0 pb-1">العتبة المنخفضة</div>
                    <div className="border-b w-full h-0 pb-1">المربع الحرج للتشغيل</div>
                  </div>

                  <svg className="w-full h-full overflow-visible z-10" viewBox="0 0 600 160">
                    <defs>
                      <linearGradient id="cool-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#059669" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path 
                      d="M 50,140 Q 150,110 250,90 T 450,55 T 550,25 L 550,150 L 50,150 Z" 
                      fill="url(#cool-grad)" 
                    />
                    <path 
                      d="M 50,140 Q 150,110 250,90 T 450,55 T 550,25" 
                      fill="none" 
                      stroke="#059669" 
                      strokeWidth="3.5" 
                      strokeLinecap="round"
                    />

                    <circle cx="50" cy="140" r="5" fill="#059669" stroke="#ffffff" strokeWidth="2" />
                    <circle cx="150" cy="115" r="5" fill="#059669" stroke="#ffffff" strokeWidth="2" />
                    <circle cx="250" cy="90" r="5" fill="#059669" stroke="#ffffff" strokeWidth="2" />
                    <circle cx="350" cy="73" r="5" fill="#059669" stroke="#ffffff" strokeWidth="2" />
                    <circle cx="450" cy="55" r="5" fill="#059669" stroke="#ffffff" strokeWidth="2" />
                    <circle cx="550" cy="25" r="5" fill="#059669" stroke="#ffffff" strokeWidth="2" />
                    
                    <text x="50" y="125" className="text-[10px] font-mono fill-slate-500 font-bold">5.8%</text>
                    <text x="150" y="100" className="text-[10px] font-mono fill-slate-500 font-bold">4.2%</text>
                    <text x="250" y="75" className="text-[10px] font-mono fill-slate-500 font-bold">3.1%</text>
                    <text x="350" y="58" className="text-[10px] font-mono fill-slate-500 font-bold">2.4%</text>
                    <text x="450" y="38" className="text-[10px] font-mono fill-slate-500 font-bold">1.7%</text>
                    <text x="532" y="15" className="text-[10px] font-mono fill-emerald-600 font-black">1.1%</text>
                  </svg>
                </div>

                <div className="flex justify-between text-[10px] text-slate-400 font-bold mt-4 px-6 border-t pt-3">
                  <span>الربع الأول</span>
                  <span>الربع الثاني</span>
                  <span>الربع الثالث</span>
                  <span>الربع الرابع</span>
                  <span className="text-emerald-600 font-extrabold">الوضع الحالي (معدل عيوب طفيف جداً)</span>
                </div>
              </div>
            </div>

            {/* Root Cause Analysis (Odoo Style RCA) */}
            <div className="lg:col-span-4 bg-white p-6 rounded-2xl border flex flex-col justify-between shadow-xs">
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <BarChart2 className="w-4.5 h-4.5 text-indigo-500" />
                  حصر الأسباب الجذرية لأعطال الجودة (RCA)
                </h3>
                
                <div className="space-y-4 pt-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold text-slate-600">
                      <span>⚙ عيوب الماكينة والمعايرة</span>
                      <span className="text-indigo-600 font-mono">45%</span>
                    </div>
                    <div className="w-full bg-slate-150 h-2 rounded-full overflow-hidden">
                      <div className="bg-indigo-600 h-full rounded-full" style={{ width: '45%' }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold text-slate-600">
                      <span>📦 رداءة المواد المستلمة</span>
                      <span className="text-amber-600 font-mono">35%</span>
                    </div>
                    <div className="w-full bg-slate-150 h-2 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full rounded-full" style={{ width: '35%' }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold text-slate-600">
                      <span>👤 أخطاء بشرية وتكاسل التدريب</span>
                      <span className="text-rose-600 font-mono">12%</span>
                    </div>
                    <div className="w-full bg-slate-150 h-2 rounded-full overflow-hidden">
                      <div className="bg-rose-500 h-full rounded-full" style={{ width: '12%' }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold text-slate-600">
                      <span>📐 خلل بالتوجيه وسير العمل</span>
                      <span className="text-slate-600 font-mono">8%</span>
                    </div>
                    <div className="w-full bg-slate-150 h-2 rounded-full overflow-hidden">
                      <div className="bg-slate-550 h-full rounded-full" style={{ width: '8%' }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 border rounded-xl text-xs text-slate-600 space-y-1 mt-4">
                <p className="font-extrabold text-indigo-900 flex items-center gap-1 text-[11px]">
                  <Info className="w-3.5 h-3.5" />
                  قواعد الالتزام الفني بالمنشأة:
                </p>
                <p>● يتم قفل وإقرار أمر الإنتاج كلياً FQC بمجرد انتهاء فحص الجودة المعتمد.</p>
                <p>● فشل أي فحص قياسي ينبثق عنه آلياً كارت CAPA للتحقيق الفوري لضمان السلامة والاستجابة.</p>
              </div>
            </div>
          </div>

          {/* Prompting action */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-md border border-slate-800">
            <div className="space-y-2">
              <span className="px-3 py-1 bg-amber-400 text-slate-900 font-black rounded-lg text-[9px] uppercase tracking-wider inline-block">تحديث دورة الفحوص المعيارية</span>
              <h3 className="text-base font-bold">ابدأ الآن بتسجيل فحوص لخط الإنتاج الجاري</h3>
              <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                بإمكانك ربط الفحوص بأوامر الإنتاج النشطة للتحقق من الأبعاد والأوزان وصلاحية المنتج للتوريد أو ترحيله لساحة الحجر الصحي وعزلة لإلغاء الهدر الضار.
              </p>
            </div>
            <button 
              onClick={() => setActiveTab('checks')}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-emerald-950/50"
            >
              بداية فحص عينة 🔍
            </button>
          </div>
        </div>
      )}

      {/* 2. QUALITY CONTROL POINTS (QCP) */}
      {activeTab === 'qcp' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white rounded-2xl border overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-150 text-slate-600 font-bold h-12">
                  <tr>
                    <th className="p-4 w-28">كود النقطة QCP</th>
                    <th className="p-4">عنوان وموضوع الاختبار الفني</th>
                    <th className="p-4">المنتج / فئة السلع المستهدفة</th>
                    <th className="p-4">مكان/مركز الفحص</th>
                    <th className="p-4">نوع وسيلة الاختبار</th>
                    <th className="p-4">المعيار المطلوب والحدود المقبولة</th>
                    <th className="p-4">فريق التفتيش المسؤول</th>
                    <th className="p-4">تعليمات الاختبار التفصيلية للمفتش</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {qcps.filter(q => 
                    q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    q.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    q.instructions.toLowerCase().includes(searchQuery.toLowerCase())
                  ).map(row => (
                    <tr key={row.id} className="hover:bg-slate-50/50">
                      <td className="p-4 font-mono font-bold text-indigo-700 text-sm">{row.id}</td>
                      <td className="p-4">
                        <strong className="text-slate-900 block text-xs">{row.title}</strong>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[10px]">
                          {row.productName}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="font-bold text-indigo-850">
                          {row.operationType === 'incoming' && '📥 استلام المواد ووارد المعمل'}
                          {row.operationType === 'manufacturing' && '⚙ ورش التشغيل وخطوط الصنع'}
                          {row.operationType === 'delivery' && '📦 قبل الفرز والشحن النهائي'}
                        </span>
                      </td>
                      <td className="p-4 text-slate-650">
                        {row.testType === 'measure' && <span className="text-indigo-600">📊 فحص كمي بالقياس</span>}
                        {row.testType === 'pass_fail' && <span className="text-amber-600">⚖ نجاح / رسوب مباشر</span>}
                        {row.testType === 'instructions' && <span className="text-emerald-600">✍ قائمة مراجعة مظهرية</span>}
                      </td>
                      <td className="p-4 font-mono text-xs">
                        {row.testType === 'measure' ? (
                          <div className="bg-slate-50 px-2 py-1 border rounded-lg text-slate-800">
                            الهدف: <span className="font-extrabold text-slate-900">{row.targetValue} {row.unit}</span>
                            <div className="text-[10px] text-slate-500 mt-0.5">التفاوت: ({row.toleranceMin} - {row.toleranceMax})</div>
                          </div>
                        ) : (
                          <span className="text-slate-400">لا قياسات عددية كافية</span>
                        )}
                      </td>
                      <td className="p-4 text-slate-600">
                        {teams.find(t => t.id === row.teamId)?.name || 'كل مفتشين المصنع'}
                      </td>
                      <td className="p-4 max-w-sm text-slate-500 text-[11px] truncate leading-relaxed" title={row.instructions}>
                        {row.instructions}
                      </td>
                    </tr>
                  ))}
                  {qcps.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-450 italic">لا توجد نقاط مراقبة جودة مسجلة حالياً بالمنشأة.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. QUALITY CHECKS (QC CHECKS) */}
      {activeTab === 'checks' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white rounded-2xl border overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-150 text-slate-600 font-bold h-12">
                  <tr>
                    <th className="p-4 w-28">السند QC</th>
                    <th className="p-4">أمر الإنتاج المرتبط</th>
                    <th className="p-4">نقطة المراقبة المنبثق عنها</th>
                    <th className="p-4">المنتج المفحوص</th>
                    <th className="p-4">وسيلة القياس</th>
                    <th className="p-4 text-center">القياس المسجل</th>
                    <th className="p-4 text-center">المدى المسموح والمطابق</th>
                    <th className="p-4 text-center">الوضعية والنتيجة</th>
                    <th className="p-4">مفتش المعاينة الجودة</th>
                    <th className="p-4">اللوت/الدفعة</th>
                    <th className="p-4">تاريخ الفحص</th>
                    <th className="p-4">ملاحظات الفاحص</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {checks.filter(c => 
                    c.qcpTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    c.inspector.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    c.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    c.id.toLowerCase().includes(searchQuery.toLowerCase())
                  ).map(row => (
                    <tr key={row.id} className="hover:bg-slate-50/50">
                      <td className="p-4 font-mono font-bold text-indigo-700 text-sm">{row.id}</td>
                      <td className="p-4 font-mono font-bold text-slate-900">{row.orderNumber}</td>
                      <td className="p-4 text-slate-600 font-bold text-xs">{row.qcpTitle}</td>
                      <td className="p-4 text-slate-900 font-bold">{row.productName}</td>
                      <td className="p-4 text-slate-500 font-mono">
                        {row.testType === 'measure' ? '📊 فحص القياس والأبعاد' : '⚖ نجاح وفشل مادي'}
                      </td>
                      <td className="p-4 text-center font-mono font-extrabold text-slate-800">
                        {row.testType === 'measure' ? (
                          <span className={`${row.status === 'accepted' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {row.measuredValue} {row.unit}
                          </span>
                        ) : (
                          '--'
                        )}
                      </td>
                      <td className="p-4 text-center font-mono text-slate-500">
                        {row.testType === 'measure' ? (
                          <span>({row.toleranceMin} - {row.toleranceMax}) {row.unit}</span>
                        ) : (
                          'ناجحة كليا'
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {row.status === 'accepted' ? (
                          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-150 rounded-full text-[10px] font-black inline-block">
                            مطابق ومقبول كلياً ✔
                          </span>
                        ) : row.status === 'rejected' ? (
                          <span className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-150 rounded-full text-[10px] font-black inline-block animate-pulse">
                            مرفوض لوجود عيب ✖
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-amber-50 text-amber-750 border border-amber-150 rounded-full text-[10px] font-black inline-block">
                            معلق قيد الفحص الموقعي
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-slate-700">{row.inspector}</td>
                      <td className="p-4 font-mono bg-slate-50 text-slate-700 text-center rounded">{row.lotNumber}</td>
                      <td className="p-4 font-mono text-slate-400 text-xs">{row.checkedDate}</td>
                      <td className="p-4 max-w-xs text-slate-550 truncate" title={row.notes}>{row.notes}</td>
                    </tr>
                  ))}
                  {checks.length === 0 && (
                    <tr>
                      <td colSpan={12} className="p-8 text-center text-slate-450 italic">لا نتائج فحص جادت بالمنشأة حتى اللحظة.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. QUALITY ALERTS & CAPA TAB (NCRs) */}
      {activeTab === 'alerts' && (
        <div className="space-y-6 animate-fadeIn">
          {/* ERP Odoo Style Kanban Columns */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* New Stage */}
            <div className="bg-slate-100 border p-4 rounded-2xl flex flex-col min-h-[450px]">
              <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border mb-3">
                <span className="text-xs font-black text-rose-600 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-rose-600 rounded-full animate-ping" />
                  تسجيل الارتداد (جديد/New)
                </span>
                <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded-md text-[10px] font-mono font-bold">
                  {alerts.filter(a => a.status === 'new').length}
                </span>
              </div>
              
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[460px]">
                {alerts.filter(a => a.status === 'new').map(item => (
                  <div key={item.id} className="bg-white border rounded-xl p-4 shadow-xs space-y-3 text-right hover:border-slate-350 transition-all">
                    <div className="flex justify-between items-start gap-1">
                      <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded text-[9px] font-mono font-bold">{item.id}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] ${getSeverityBadge(item.severity)}`}>
                        {item.severity === 'high' ? 'عالي الخطورة' : item.severity === 'medium' ? 'متوسط' : 'طبيعي'}
                      </span>
                    </div>
                    <h4 className="text-[11px] font-extrabold text-slate-800 leading-normal">{item.title}</h4>
                    <p className="text-[10px] text-slate-500 leading-relaxed max-w-full font-medium line-clamp-3">{item.description}</p>
                    
                    <div className="text-[10px] text-slate-400 border-t pt-2 space-y-1">
                      <div>المسؤول: <strong className="text-slate-650">{item.assignedTo}</strong></div>
                      <div>السبب: <span className="font-extrabold text-indigo-700">{getRootCauseLabel(item.rootCause)}</span></div>
                    </div>
                    
                    <div className="flex gap-1.5 pt-1 border-t border-slate-100 justify-end">
                      <button 
                        onClick={() => updateAlertStatus(item.id, 'investigating')}
                        className="px-2.5 py-1 text-[9px] font-bold bg-slate-900 text-white rounded hover:bg-slate-700 cursor-pointer"
                      >
                        بدء تحقيق فني ←
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Under Investigation Stage */}
            <div className="bg-indigo-50/40 border p-4 rounded-2xl flex flex-col min-h-[450px]">
              <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border mb-3">
                <span className="text-xs font-black text-indigo-600 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-indigo-600 rounded-full" />
                  التحقيق والتشخيص الفني
                </span>
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[10px] font-mono font-bold">
                  {alerts.filter(a => a.status === 'investigating').length}
                </span>
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto max-h-[460px]">
                {alerts.filter(a => a.status === 'investigating').map(item => (
                  <div key={item.id} className="bg-white border rounded-xl p-4 shadow-xs space-y-3 text-right hover:border-slate-350 transition-all">
                    <div className="flex justify-between items-start gap-1">
                      <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded text-[9px] font-mono font-bold">{item.id}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] ${getSeverityBadge(item.severity)}`}>
                        {item.severity === 'high' ? 'عالي الخطورة' : item.severity === 'medium' ? 'متوسط' : 'طبيعي'}
                      </span>
                    </div>
                    <h4 className="text-[11px] font-extrabold text-slate-800 leading-normal">{item.title}</h4>
                    <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-3">{item.description}</p>
                    
                    <div className="text-[10px] text-slate-400 border-t pt-2 space-y-1">
                      <div>المسؤول: <strong className="text-slate-650">{item.assignedTo}</strong></div>
                      <div>السبب: <span className="font-extrabold text-indigo-700">{getRootCauseLabel(item.rootCause)}</span></div>
                    </div>

                    <div className="flex gap-1 pt-1 border-t border-slate-100 justify-end flex-wrap">
                      <button 
                        onClick={() => updateAlertStatus(item.id, 'corrective_action')}
                        className="px-2 py-1 text-[9px] font-bold bg-amber-500 text-white rounded hover:bg-amber-600 cursor-pointer"
                      >
                        صياغة CAPA ←
                      </button>
                      <button 
                        onClick={() => updateAlertStatus(item.id, 'new')}
                        className="px-2 py-1 text-[9px] font-bold bg-slate-100 text-slate-700 rounded hover:bg-slate-200 cursor-pointer"
                      >
                        ارجاع للخلف
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Corrective Action Stage */}
            <div className="bg-amber-50/20 border p-4 rounded-2xl flex flex-col min-h-[450px]">
              <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border mb-3">
                <span className="text-xs font-black text-amber-750 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-amber-550 rounded-full" />
                  تنفيذ الإجراء الوقائي الوقائي CAPA
                </span>
                <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md text-[10px] font-mono font-bold">
                  {alerts.filter(a => a.status === 'corrective_action').length}
                </span>
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto max-h-[460px]">
                {alerts.filter(a => a.status === 'corrective_action').map(item => (
                  <div key={item.id} className="bg-white border rounded-xl p-4 shadow-xs space-y-3 text-right hover:border-slate-350 transition-all">
                    <div className="flex justify-between items-start gap-1">
                      <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded text-[9px] font-mono font-bold">{item.id}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] ${getSeverityBadge(item.severity)}`}>
                        {item.severity === 'high' ? 'عالي الخطورة' : item.severity === 'medium' ? 'متوسط' : 'طبيعي'}
                      </span>
                    </div>
                    <h4 className="text-[11px] font-extrabold text-slate-800 leading-normal">{item.title}</h4>
                    <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2">{item.description}</p>
                    
                    <div className="p-2.5 bg-amber-50 rounded-lg space-y-0.5 border border-amber-100">
                      <strong className="text-[9px] text-amber-850 block">الإجراء الوقائي التصحيحي:</strong>
                      <p className="text-[10px] text-slate-700 italic font-medium">{item.capaAction}</p>
                    </div>

                    <div className="text-[10px] text-slate-400 border-t pt-2 space-y-0.5">
                      <div>المسؤول: <strong className="text-slate-650">{item.assignedTo}</strong></div>
                      <div>التصرف: <span className="font-extrabold text-indigo-900">{getDispositionLabel(item.disposition)}</span></div>
                    </div>

                    <div className="flex gap-1 pt-1 border-t border-slate-100 justify-end flex-wrap">
                      <button 
                        onClick={() => updateAlertStatus(item.id, 'resolved')}
                        className="px-2.5 py-1 text-[9px] font-bold bg-emerald-600 text-white rounded hover:bg-emerald-700 cursor-pointer"
                      >
                        إغلاق وحل المشكلة ✔
                      </button>
                      <button 
                        onClick={() => updateAlertStatus(item.id, 'investigating')}
                        className="px-2 py-1 text-[9px] font-bold bg-slate-100 text-slate-700 rounded hover:bg-slate-200 cursor-pointer"
                      >
                        ارجاع للتحقيق
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Resolved/Solved Stage */}
            <div className="bg-emerald-50/20 border p-4 rounded-2xl flex flex-col min-h-[450px]">
              <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border mb-3">
                <span className="text-xs font-black text-emerald-600 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                  مغلق ومستوفى (Resolved)
                </span>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-[10px] font-mono font-bold">
                  {alerts.filter(a => a.status === 'resolved').length}
                </span>
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto max-h-[460px]">
                {alerts.filter(a => a.status === 'resolved').map(item => (
                  <div key={item.id} className="bg-white border rounded-xl p-4 shadow-xs space-y-3 text-right hover:border-slate-350 transition-all opacity-75">
                    <div className="flex justify-between items-start gap-1">
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-mono font-bold">{item.id}</span>
                      <strong className="text-[9px] text-emerald-700">تم الحل وحفظه</strong>
                    </div>
                    <h4 className="text-[11px] font-extrabold text-slate-800 leading-normal line-through">{item.title}</h4>
                    <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2">{item.description}</p>
                    
                    <div className="p-2.5 bg-slate-50 rounded-lg space-y-0.5">
                      <strong className="text-[9px] text-slate-700 block">الإجراء المطبّق:</strong>
                      <p className="text-[10px] text-slate-600 font-medium">{item.capaAction}</p>
                    </div>

                    <div className="text-[10px] text-slate-400 border-t pt-2">
                      تم غلق المشكلة بالكامل وضمان ترحيل أوامر الإنتاج بنجاح مالي وعملي.
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 5. QUALITY TEAMS TAB */}
      {activeTab === 'teams' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {teams.map(team => (
              <div key={team.id} className="bg-white border p-5 rounded-2xl shadow-xs space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <div>
                    <span className="text-[10px] bg-slate-150 text-slate-650 px-2.5 py-0.5 rounded font-mono font-bold">
                      مجموعة: {team.id}
                    </span>
                    <h3 className="font-extrabold text-slate-800 text-sm mt-1.5">{team.name}</h3>
                  </div>
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">قائد ومسؤول القسم:</span>
                    <strong className="text-slate-850">{team.leader}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">القسم الإداري بالشركة:</span>
                    <span className="text-slate-600 font-bold">{team.department}</span>
                  </div>
                  <div className="space-y-1 pt-2">
                    <span className="text-slate-400 font-bold block text-[10px]">المفتشون والمفوضون بالضبط الفني والفرز:</span>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {team.inspectors.map((ins: string, idx: number) => (
                        <span key={idx} className="px-2 py-1 bg-indigo-50 text-indigo-805 rounded-lg text-[10px] font-bold">
                          👤 {ins}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-dashed flex justify-between items-center text-xs">
                  <span className="text-slate-550 font-bold">نقاط فحص نشطة مكلفين بها:</span>
                  <span className="font-mono font-extrabold text-indigo-700 bg-white border px-2 py-0.5 rounded">
                    {qcps.filter(q => q.teamId === team.id).length} نقاط (QCP)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* POPUP MODALS IN GERMAN/ARABIC/OODO STYLE PARAMETERS */}
      {/* 1. QCP MODAL */}
      {isQcpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg border overflow-hidden text-right">
            <div className="p-5 border-b bg-slate-50 flex justify-between items-center">
              <h2 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                <CheckSquare className="w-5 h-5 text-emerald-600 font-black animate-pulse" />
                تعريف نقطة مراقبة جودة منهجية (Add Quality Control Point)
              </h2>
              <button onClick={() => setIsQcpModalOpen(false)} className="bg-white text-slate-450 p-1.5 border hover:text-slate-750 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateQcp} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-black text-slate-750 mb-1">اسم/عنوان نقطة المراقبة التوعوية</label>
                <input 
                  required 
                  type="text" 
                  placeholder="مثال: فحص خشونة الأواني من فئة أ" 
                  value={newQcp.title} 
                  onChange={e => setNewQcp({...newQcp, title: e.target.value})} 
                  className="w-full px-3.5 py-2 border rounded-xl text-xs font-bold" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-slate-750 mb-1">السلعة/المنتج المستهدف</label>
                  <select 
                    value={newQcp.productId} 
                    onChange={e => setNewQcp({...newQcp, productId: e.target.value})} 
                    className="w-full px-3 py-2 border rounded-xl text-xs font-bold"
                  >
                    <option value="all_finished">جميع المنتجات التامة الصنع</option>
                    <option value="all_semi">جميع المنتجات الهيكلية (نصف المصنعة)</option>
                    <option value="all_raw">المواد المعدنية الخام والمستلمة</option>
                    {products.map((p, pIdx) => (
                      <option key={`qc-prod-${p.id ?? pIdx}-${pIdx}`} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-750 mb-1">مكان المراقبة (Process Operation)</label>
                  <select 
                    value={newQcp.operationType} 
                    onChange={e => setNewQcp({...newQcp, operationType: e.target.value})} 
                    className="w-full px-3 py-2 border rounded-xl text-xs font-bold"
                  >
                    <option value="incoming">📥 الاستيراد وفحص الواردات بالجمارك</option>
                    <option value="manufacturing">⚙ التحقق أثناء التصنيع في الورشة</option>
                    <option value="delivery">📦 الاعتماد النهائي للإنتاج التام FQC</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border">
                <div>
                  <label className="block text-[11px] font-black text-slate-750 mb-1">طبيعة الاختبار الرصدي</label>
                  <select 
                    value={newQcp.testType} 
                    onChange={e => setNewQcp({...newQcp, testType: e.target.value})} 
                    className="w-full px-3 py-2 border rounded-xl text-xs font-bold"
                  >
                    <option value="pass_fail">نجاح وفشل مباشر (Pass/Fail)</option>
                    <option value="measure">التحليل القياسي والعدد التقريبي (Measure)</option>
                    <option value="instructions">كشف مظهر وإدخال صور وملاحظات</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-750 mb-1">مسؤولية فريق الفحص</label>
                  <select 
                    value={newQcp.teamId} 
                    onChange={e => setNewQcp({...newQcp, teamId: e.target.value})} 
                    className="w-full px-3 py-2 border rounded-xl text-xs font-bold"
                  >
                    {teams.map((t, tIdx) => (
                      <option key={`qc-team-${t.id ?? tIdx}-${tIdx}`} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {newQcp.testType === 'measure' && (
                <div className="p-4 bg-slate-900 text-white rounded-xl space-y-3">
                  <span className="block text-[10px] font-black text-amber-300">حدود المعالجة والتحمل الفني للماكينة:</span>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="col-span-2">
                      <label className="block text-[9px] text-slate-350 font-bold mb-1">القيمة القياسية المستهدفة</label>
                      <input required type="number" step="0.01" value={newQcp.targetValue ?? ""} onChange={e => setNewQcp({...newQcp, targetValue: Number(e.target.value) || 0})} className="w-full bg-slate-800 text-white px-2.5 py-1.5 rounded border border-slate-700 text-xs font-bold" />
                    </div>
                    <div>
                      <label className="block text-[9px] text-slate-350 font-bold mb-1">الحد الأدنى للقبول</label>
                      <input required type="number" step="0.01" value={newQcp.toleranceMin ?? ""} onChange={e => setNewQcp({...newQcp, toleranceMin: Number(e.target.value) || 0})} className="w-full bg-slate-800 text-white px-2.5 py-1.5 rounded border border-slate-700 text-xs text-rose-300 font-bold" />
                    </div>
                    <div>
                      <label className="block text-[9px] text-slate-350 font-bold mb-1">الحد الأقصى للقبول</label>
                      <input required type="number" step="0.01" value={newQcp.toleranceMax ?? ""} onChange={e => setNewQcp({...newQcp, toleranceMax: Number(e.target.value) || 0})} className="w-full bg-slate-800 text-white px-2.5 py-1.5 rounded border border-slate-700 text-xs text-emerald-300 font-bold" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-350 font-bold mb-1">وحدة القياس</label>
                    <input required type="text" placeholder="مثال: مم، كجم، لتر، نانومتر" value={newQcp.unit ?? ""} onChange={e => setNewQcp({...newQcp, unit: e.target.value})} className="w-full bg-slate-805 text-white px-3 py-1.5 rounded border border-slate-702 text-xs" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-black text-slate-750 mb-1">توجيهات وإرشادات الاختبار الدقيقة للراصد</label>
                <textarea 
                  required 
                  rows={2} 
                  placeholder="كيف يفحص المفتش؟ ما الخطوات العملية بدقة؟ لتلافي تضارب التقارير والاستلامات مظهرية." 
                  value={newQcp.instructions} 
                  onChange={e => setNewQcp({...newQcp, instructions: e.target.value})} 
                  className="w-full px-4 py-2 border rounded-xl text-xs font-bold" 
                />
              </div>

              <div className="pt-4 border-t flex gap-2">
                <button type="submit" className="flex-1 px-4 py-2.5 bg-emerald-600 text-white font-black text-xs rounded-xl hover:bg-emerald-700 cursor-pointer">
                  تفعيل وحل النقطة بالدورة المعيارية ✔
                </button>
                <button type="button" onClick={() => setIsQcpModalOpen(false)} className="px-5 py-2.5 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer">
                  تراجع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. QUALITY WIZARD CHECK MODAL (LIVE METALS TOLERANCE CALCRULE) */}
      {isCheckWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-xl border overflow-hidden text-right">
            <div className="p-5 border-b bg-slate-50 flex justify-between items-center bg-indigo-50/20">
              <h2 className="text-sm font-black text-slate-905 flex items-center gap-1.5 text-indigo-900">
                <ShieldCheck className="w-5 h-5 text-emerald-600 font-bold" />
                معاينة عينة وإجراء فحص جودة مباشر (Live Quality Check)
              </h2>
              <button onClick={() => setIsCheckWizardOpen(false)} className="bg-white text-slate-450 p-1.5 border hover:text-slate-750 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCheck} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-slate-750 mb-1">اختر نقطة المراقبة الفنية المفعلة</label>
                  <select 
                    required 
                    value={newCheck.qcpId} 
                    onChange={e => {
                      const found = qcps.find(q => q.id === e.target.value);
                      setNewCheck({
                        ...newCheck,
                        qcpId: e.target.value,
                        testType: found ? found.testType : 'pass_fail'
                      });
                    }} 
                    className="w-full px-3 py-2 border rounded-xl text-xs font-bold"
                  >
                    <option value="">-- اختر QCP للامتثال لشروطها --</option>
                    {qcps.map((q, qIdx) => (
                      <option key={`qc-qcp-opt-${q.id ?? qIdx}-${qIdx}`} value={q.id}>[{q.id}] {q.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-750 mb-1">اربط بفترة الإنتاج / أمر التشغيل</label>
                  <select 
                    value={newCheck.orderNumber} 
                    onChange={e => setNewCheck({...newCheck, orderNumber: e.target.value})} 
                    className="w-full px-3 py-2 border rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="">لا يوجد ارتباط، فحص مخزني عشوائي</option>
                    {orders.map((o, oIdx) => (
                      <option key={`qc-ord-opt-${o.id ?? oIdx}-${oIdx}`} value={o.orderNumber}>{o.orderNumber} ({(() => {
                        const hasC = checks.find(cf => cf.orderNumber === o.orderNumber);
                        return hasC ? 'تم فحصه مسبقا' : 'معلق في الانتظار 🔍';
                      })()})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Show instructions after choosing QCP */}
              {(() => {
                const activeQcp = qcps.find(q => q.id === newCheck.qcpId);
                if (!activeQcp) return null;
                return (
                  <div className="bg-indigo-50/30 p-4 rounded-xl border border-indigo-150 space-y-1.5 text-xs">
                    <p className="font-extrabold text-indigo-900 flex items-center gap-1">
                      <FileText className="w-4 h-4 text-indigo-700" />
                      إرشادات هامة للمفتش:
                    </p>
                    <p className="text-slate-700 leading-relaxed font-semibold text-[11px]">{activeQcp.instructions}</p>
                    {activeQcp.testType === 'measure' && (
                      <div className="pt-2 border-t font-mono text-[10px] text-indigo-805 font-bold flex gap-4">
                        <span>الهدف: {activeQcp.targetValue} {activeQcp.unit}</span>
                        <span>الحدود المسموحة: ({activeQcp.toleranceMin} - {activeQcp.toleranceMax}) {activeQcp.unit}</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Input for check values */}
              {(() => {
                const activeQcp = qcps.find(q => q.id === newCheck.qcpId);
                if (!activeQcp) return null;
                
                if (activeQcp.testType === 'measure') {
                  const val = Number(newCheck.measuredValue);
                  const isMatching = val >= activeQcp.toleranceMin && val <= activeQcp.toleranceMax;
                  
                  return (
                    <div className="p-4 bg-slate-900 text-white rounded-xl space-y-3 border border-slate-700">
                      <span className="block text-xs font-extrabold text-amber-300">أدخل القراءة المقاسة ميكرومترياً:</span>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <input 
                            required 
                            type="number" 
                            step="0.01" 
                            value={newCheck.measuredValue} 
                            onChange={e => setNewCheck({...newCheck, measuredValue: Number(e.target.value) || 0})}
                            className="w-full bg-slate-800 text-white px-4 py-2 border rounded-xl text-sm font-extrabold font-mono" 
                          />
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-300">{activeQcp.unit}</span>
                        
                        <div className="px-4 py-2 rounded-xl text-xs font-black min-w-28 text-center shrink-0">
                          {isMatching ? (
                            <span className="text-emerald-400 block tracking-normal">✔ نسبة مقبولة</span>
                          ) : (
                            <span className="text-rose-400 block animate-pulse">✖ خارج المواصفة</span>
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-none">يقيم النظام بنسب التفاوت المحددة تلقائياً لتقليل الخشونة والأخطاء.</p>
                    </div>
                  );
                }

                // Else Pass/Fail
                return (
                  <div className="bg-slate-50 p-4 rounded-xl border grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">بصمة المفتش والمسؤول</label>
                      <input required type="text" value={newCheck.inspector ?? ""} onChange={e => setNewCheck({...newCheck, inspector: e.target.value})} className="w-full px-3 py-2 border rounded-xl text-xs bg-white" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">القرار والحكم الميداني</label>
                      <select 
                        value={newCheck.status} 
                        onChange={e => setNewCheck({...newCheck, status: e.target.value})} 
                        className="w-full px-3 py-2 border rounded-xl text-xs font-bold bg-white"
                      >
                        <option value="accepted">نجاح واجتياز العجلة كلياً (Pass)</option>
                        <option value="rejected">فشل وبناء حجر صحي للدفعة (Fail)</option>
                      </select>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-705 mb-1">كود اللوت / الباركود للدفعة</label>
                  <input type="text" placeholder="مثال: LOT-2606A" value={newCheck.lotNumber ?? ""} onChange={e => setNewCheck({...newCheck, lotNumber: e.target.value})} className="w-full px-3.5 py-2 border rounded-xl text-xs font-mono text-left" dir="ltr" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">ملاحظة: فشل الاختبار يحجر على الدفعة لتقليص الخردة.</label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-705 mb-1">ملاحظات وشهادة الفحص والتفريغ</label>
                <textarea 
                  rows={2} 
                  placeholder="اكتب أي ملاحظة عن المادة المفحوصة، سلامة الطلاء الشفاف، إلخ..." 
                  value={newCheck.notes} 
                  onChange={e => setNewCheck({...newCheck, notes: e.target.value})} 
                  className="w-full px-4 py-2 border rounded-xl text-xs font-bold" 
                />
              </div>

              <div className="pt-4 border-t flex gap-2">
                <button type="submit" className="flex-1 px-4 py-2.5 bg-indigo-600 text-white font-black text-xs rounded-xl hover:bg-slate-905 cursor-pointer">
                  تسجيل الاختبار المعملي وإغلاقه ✔
                </button>
                <button type="button" onClick={() => setIsCheckWizardOpen(false)} className="px-5 py-2.5 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer">
                  تراجع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. ALERTS / NCR MODAL */}
      {isAlertModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg border overflow-hidden text-right">
            <div className="p-5 border-b bg-rose-50 flex justify-between items-center text-rose-950">
              <h2 className="text-sm font-black flex items-center gap-1.5">
                <AlertOctagon className="w-5 h-5 text-rose-600" />
                إصدار تقرير عدم مطابقة وقفل جودة فوري (Non-Conformance NCR)
              </h2>
              <button onClick={() => setIsAlertModalOpen(false)} className="bg-white text-slate-450 p-1.5 border hover:text-slate-750 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAlert} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-705 mb-1">عنوان العطل والخلل المشهود</label>
                <input required type="text" placeholder="مثال: التواء بالهيكل الخلفي للألواح الصلبة بخلية MC-101" value={newAlert.title ?? ""} onChange={e => setNewAlert({...newAlert, title: e.target.value})} className="w-full px-4 py-2 border rounded-xl text-xs font-bold text-slate-800" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-705 mb-1">مستوى الخطورة / شدة الحادث</label>
                  <select value={newAlert.severity ?? ""} onChange={e => setNewAlert({...newAlert, severity: e.target.value})} className="w-full px-3 py-2 border rounded-xl text-xs font-bold">
                    <option value="low">بسيط ومتحمل (تجاوز فني دقيق)</option>
                    <option value="medium">متوسط (يحتاج تعديل خفيف)</option>
                    <option value="high">حرج وجوهري (عوازل صحية وتخريد)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-705 mb-1">السبب الإحصائي المبدئي (RCA)</label>
                  <select value={newAlert.rootCause ?? ""} onChange={e => setNewAlert({...newAlert, rootCause: e.target.value})} className="w-full px-3 py-2 border rounded-xl text-xs font-bold">
                    <option value="machine">⚙ انحراف/خلل في الماكينة ولحامها</option>
                    <option value="material">📦 خامات ومواد معيبة قادمة من مورد</option>
                    <option value="human">👤 خطأ طاقم العمل أو عدم الالتزام بالتوجيه</option>
                    <option value="method">📐 خلل باللوجستية والتوجيه التصميمي</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-705 mb-1">رمز المرجع الميداني (رقم الأمر/لوت)</label>
                  <input required type="text" placeholder="مثال: PRD-2026-001 أو RI-102" value={newAlert.referenceCode ?? ""} onChange={e => setNewAlert({...newAlert, referenceCode: e.target.value})} className="w-full px-4 py-2 border rounded-xl text-xs text-left font-mono" dir="ltr" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-705 mb-1">التصرف المقترح بالمواد الموصاة</label>
                  <select value={newAlert.disposition ?? ""} onChange={e => setNewAlert({...newAlert, disposition: e.target.value})} className="w-full px-3 py-2 border rounded-xl text-xs font-bold">
                    <option value="rework">إعادة التشغيل والتعديل (Rework)</option>
                    <option value="scrap">إتلاف ورمي في الخردة (Scrap)</option>
                    <option value="vendor_return">إرجاع للمورد ومباشرة مطالبة ائتمانية</option>
                    <option value="as_is">مقبول كما هو بمسؤولية مدير التكلفة</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-705 mb-1">الإجراء الوقائي التصحيحي الإسعافي (CAPA Action Planner)</label>
                  <input required type="text" placeholder="تعديل ومعايرة ضغط آلة الحفر، قفل تصنيع اللوت" value={newAlert.capaAction ?? ""} onChange={e => setNewAlert({...newAlert, capaAction: e.target.value})} className="w-full px-3.5 py-2 border rounded-xl text-xs text-indigo-900 font-extrabold bg-white" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">وصف المفتش التفصيلي الموثق للعيب الفني</label>
                <textarea rows={2} placeholder="صف بدقة الأجزاء التالفة، كمية الهدر التراكمي ونسبة الخشونة..." value={newAlert.description ?? ""} onChange={e => setNewAlert({...newAlert, description: e.target.value})} className="w-full px-4 py-2 border rounded-xl text-xs font-bold" />
              </div>

              <div className="pt-4 border-t flex gap-2">
                <button type="submit" className="flex-1 px-4 py-2.5 bg-rose-600 text-white font-black text-xs rounded-xl hover:bg-rose-700 cursor-pointer">
                  تنشيط تقرير الـ NCR ولإلحاق CAPA 🚨
                </button>
                <button type="button" onClick={() => setIsAlertModalOpen(false)} className="px-5 py-2.5 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer">
                  تراجع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. TEAM MODAL */}
      {isTeamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg border overflow-hidden text-right">
            <div className="p-5 border-b bg-slate-50 flex justify-between items-center bg-slate-100">
              <h2 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                <Users className="w-5 h-5 text-indigo-650" />
                تعريف فريق تفتيش ومعمل جودة (Add Quality Team)
              </h2>
              <button onClick={() => setIsTeamModalOpen(false)} className="bg-white text-slate-450 p-1.5 border hover:text-slate-750 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-705 mb-1">اسم الفريق ومهمة المعاينة</label>
                <input required type="text" placeholder="مثال: فريق الفحص النهائي للتشطيبات وصالة ج" value={newTeam.name ?? ""} onChange={e => setNewTeam({...newTeam, name: e.target.value})} className="w-full px-4 py-2 border rounded-xl text-xs font-bold" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-705 mb-1">قائد ورئيس لجنة الفرز</label>
                  <input required type="text" placeholder="اسم المهندس المسؤول" value={newTeam.leader ?? ""} onChange={e => setNewTeam({...newTeam, leader: e.target.value})} className="w-full px-4 py-2 border rounded-xl text-xs" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-705 mb-1">القسم التشغيلي المرتبط</label>
                  <select value={newTeam.department ?? ""} onChange={e => setNewTeam({...newTeam, department: e.target.value})} className="w-full px-3 py-2 border rounded-xl text-xs font-bold">
                    <option value="الورش الإنتاجية وطباعة الهياكل">الورش الإنتاجية وطباعة الهياكل</option>
                    <option value="المخازن المركزية واللوجستية">المخازن المركزية واللوجستية</option>
                    <option value="معامل الحجر الفني والاختبار الميكانيكي">معامل الحجر الفني والاختبار الميكانيكي</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-705 mb-1">أعضاء الفريق ومفتشي الجودة الصالة (مفصول بفاصلة)</label>
                <input required type="text" placeholder="مثال: م. علي طاهر, م. سامح زكريا, أ. رامي عادل" value={newTeam.inspectorsInput ?? ""} onChange={e => setNewTeam({...newTeam, inspectorsInput: e.target.value})} className="w-full px-4 py-2 border rounded-xl text-xs font-bold" />
                <span className="text-[10px] text-slate-400 block mt-1">يساعد كتابتهم على سهولة إدراجهم كمشرفين على فحوص الـ QCP.</span>
              </div>

              <div className="pt-4 border-t flex gap-2">
                <button type="submit" className="flex-1 px-4 py-2.5 bg-slate-900 text-white font-black text-xs rounded-xl hover:bg-slate-800 cursor-pointer">
                  تثبيت فرقة الجودة الكلية ✔
                </button>
                <button type="button" onClick={() => setIsTeamModalOpen(false)} className="px-5 py-2.5 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer">
                  تراجع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
