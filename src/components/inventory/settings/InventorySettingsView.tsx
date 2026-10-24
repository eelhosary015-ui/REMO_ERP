import React, { useState, useEffect } from "react";
import {
  Settings,
  Building2,
  ArrowRightLeft,
  FileText,
  Layers,
  Save,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  RefreshCw,
  HelpCircle,
  Percent,
  Calendar,
  ShieldCheck,
  Zap,
  Info,
  X,
} from "lucide-react";

interface Props {
  initialSubTab?: string;
  warehouses: any[];
  onNotify: (msg: string, type?: "success" | "error" | "info") => void;
  onRefreshData?: () => void;
}

export function InventorySettingsView({ initialSubTab = "general", warehouses, onNotify, onRefreshData }: Props) {
  const [activeTab, setActiveTab] = useState<string>(
    ["settings", "general"].includes(initialSubTab)
      ? "general"
      : initialSubTab
  );

  const [loading, setLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // General Settings state
  const [generalSettings, setGeneralSettings] = useState({
    costing_method: "weighted_average",
    allow_negative_stock: false,
    require_approval_for_transactions: true,
    require_qc_for_receipts: false,
    auto_post_receipts: false,
    expiry_warning_days: 30,
    inventory_policy: "periodic",
    default_reorder_point: 10,
    allowed_wastage_percentage: 2.5,
    lock_stock_during_count: true,
    auto_link_accounts: true,
  });

  // Types & Reasons data
  const [warehouseTypes, setWarehouseTypes] = useState<any[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<any[]>([]);
  const [transactionReasons, setTransactionReasons] = useState<any[]>([]);

  // Modals for CRUD
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [typeModalForm, setTypeModalForm] = useState<any>({ id: null, name: "", code: "", description: "", is_active: true });

  const [showTxTypeModal, setShowTxTypeModal] = useState(false);
  const [txTypeModalForm, setTxTypeModalForm] = useState<any>({ id: null, name: "", code: "", effect: "in", requires_approval: true, is_active: true, description: "" });

  const [showReasonModal, setShowReasonModal] = useState(false);
  const [reasonModalForm, setReasonModalForm] = useState<any>({ id: null, name: "", code: "", transaction_type: "all", description: "", is_active: true });

  // Fetch all settings
  const fetchAllSettings = async () => {
    setLoading(true);
    try {
      const [sRes, wtRes, ttRes, trRes] = await Promise.all([
        fetch("/api/inventory-settings"),
        fetch("/api/warehouse-types"),
        fetch("/api/transaction-types"),
        fetch("/api/transaction-reasons"),
      ]);

      if (sRes.ok) {
        const sData = await sRes.json();
        if (sData) {
          setGeneralSettings({
            costing_method: sData.costing_method || "weighted_average",
            allow_negative_stock: Boolean(sData.allow_negative_stock),
            require_approval_for_transactions: Boolean(sData.require_approval_for_transactions ?? true),
            require_qc_for_receipts: Boolean(sData.require_qc_for_receipts),
            auto_post_receipts: Boolean(sData.auto_post_receipts),
            expiry_warning_days: Number(sData.expiry_warning_days || 30),
            inventory_policy: sData.inventory_policy || "periodic",
            default_reorder_point: Number(sData.default_reorder_point || 10),
            allowed_wastage_percentage: Number(sData.allowed_wastage_percentage || 2.5),
            lock_stock_during_count: Boolean(sData.lock_stock_during_count ?? true),
            auto_link_accounts: Boolean(sData.auto_link_accounts ?? true),
          });
        }
      }

      if (wtRes.ok) setWarehouseTypes(await wtRes.json());
      if (ttRes.ok) setTransactionTypes(await ttRes.json());
      if (trRes.ok) setTransactionReasons(await trRes.json());
    } catch (e) {
      console.error("Failed to load settings:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllSettings();
  }, []);

  // Save General Settings
  const handleSaveGeneralSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/inventory-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(generalSettings),
      });
      if (res.ok) {
        onNotify("تم حفظ إعدادات وسياسات المخزون بنجاح", "success");
        if (onRefreshData) onRefreshData();
      } else {
        const err = await res.json();
        onNotify(err.error || "فشل حفظ الإعدادات", "error");
      }
    } catch (e) {
      onNotify("حدث خطأ أثناء حفظ الإعدادات", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  // CRUD Warehouse Types
  const handleSaveWarehouseType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typeModalForm.name.trim() || !typeModalForm.code.trim()) {
      onNotify("يرجى ملء الاسم والكود", "error");
      return;
    }
    try {
      const url = typeModalForm.id ? `/api/warehouse-types/${typeModalForm.id}` : "/api/warehouse-types";
      const method = typeModalForm.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(typeModalForm),
      });
      if (res.ok) {
        onNotify(typeModalForm.id ? "تم تعديل نوع المخزن" : "تمت إضافة نوع المخزن بنجاح");
        setShowTypeModal(false);
        fetchAllSettings();
      } else {
        const err = await res.json();
        onNotify(err.error || "حدث خطأ", "error");
      }
    } catch (e) {
      onNotify("فشلت العملية", "error");
    }
  };

  const handleDeleteWarehouseType = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف نوع المخزن هذا؟")) return;
    try {
      const res = await fetch(`/api/warehouse-types/${id}`, { method: "DELETE" });
      if (res.ok) {
        onNotify("تم حذف نوع المخزن بنجاح");
        fetchAllSettings();
      } else {
        const err = await res.json();
        onNotify(err.error || "لا يمكن حذف هذا النوع", "error");
      }
    } catch (e) {
      onNotify("فشل الحذف", "error");
    }
  };

  // CRUD Transaction Types
  const handleSaveTransactionType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txTypeModalForm.name.trim() || !txTypeModalForm.code.trim()) {
      onNotify("يرجى ملء الاسم والكود", "error");
      return;
    }
    try {
      const url = txTypeModalForm.id ? `/api/transaction-types/${txTypeModalForm.id}` : "/api/transaction-types";
      const method = txTypeModalForm.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(txTypeModalForm),
      });
      if (res.ok) {
        onNotify(txTypeModalForm.id ? "تم تعديل نوع الحركة" : "تمت إضافة نوع الحركة بنجاح");
        setShowTxTypeModal(false);
        fetchAllSettings();
      } else {
        const err = await res.json();
        onNotify(err.error || "حدث خطأ", "error");
      }
    } catch (e) {
      onNotify("فشلت العملية", "error");
    }
  };

  const handleDeleteTransactionType = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف نوع الحركة؟")) return;
    try {
      const res = await fetch(`/api/transaction-types/${id}`, { method: "DELETE" });
      if (res.ok) {
        onNotify("تم حذف نوع الحركة");
        fetchAllSettings();
      } else {
        const err = await res.json();
        onNotify(err.error || "لا يمكن حذف هذا النوع", "error");
      }
    } catch (e) {
      onNotify("فشل الحذف", "error");
    }
  };

  // CRUD Transaction Reasons
  const handleSaveTransactionReason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonModalForm.name.trim() || !reasonModalForm.code.trim()) {
      onNotify("يرجى ملء الاسم والكود", "error");
      return;
    }
    try {
      const url = reasonModalForm.id ? `/api/transaction-reasons/${reasonModalForm.id}` : "/api/transaction-reasons";
      const method = reasonModalForm.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reasonModalForm),
      });
      if (res.ok) {
        onNotify(reasonModalForm.id ? "تم تعديل سبب الحركة" : "تمت إضافة سبب الحركة بنجاح");
        setShowReasonModal(false);
        fetchAllSettings();
      } else {
        const err = await res.json();
        onNotify(err.error || "حدث خطأ", "error");
      }
    } catch (e) {
      onNotify("فشلت العملية", "error");
    }
  };

  const handleDeleteTransactionReason = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف سبب الحركة؟")) return;
    try {
      const res = await fetch(`/api/transaction-reasons/${id}`, { method: "DELETE" });
      if (res.ok) {
        onNotify("تم حذف سبب الحركة");
        fetchAllSettings();
      } else {
        const err = await res.json();
        onNotify(err.error || "لا يمكن حذف هذا السبب", "error");
      }
    } catch (e) {
      onNotify("فشل الحذف", "error");
    }
  };

  const tabs = [
    { id: "general", label: "الإعدادات العامة", icon: Settings },
    { id: "warehouse_types", label: "أنواع المخازن", icon: Building2 },
    { id: "transaction_types", label: "أنواع الحركات", icon: ArrowRightLeft },
    { id: "transaction_reasons", label: "أسباب الحركات", icon: FileText },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Sub-Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-orange-50 text-orange-600 border border-orange-200 flex items-center justify-center shadow-xs">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">إعدادات وسياسات المخزون</h2>
              <p className="text-xs text-slate-500">إدارة طريقة التقييم المالي، أنواع المخازن، الحركات وضوابط الرقابة</p>
            </div>
          </div>
          <button
            onClick={fetchAllSettings}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-orange-600" : ""}`} />
            تحديث البيانات
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 pt-4 overflow-x-auto custom-scrollbar">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  active
                    ? "bg-orange-600 text-white shadow-md shadow-orange-600/20"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/70"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? "text-white" : "text-slate-500"}`} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: GENERAL SETTINGS
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "general" && (
        <div className="space-y-6">
          {/* Card 1: Costing Method */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <Zap className="w-5 h-5 text-orange-600" />
              <h3 className="font-bold text-slate-900">طريقة تقييم المخزون المالي (Costing Method)</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              تحدد طريقة احتساب تكلفة البضاعة المباعة (COGS) وقيمة المخزون المتبقي في نهاية الفترة المحاسبية.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  id: "weighted_average",
                  title: "المتوسط المرجح (Weighted Average)",
                  badge: "موصى به للمطاعم والتصنيع",
                  badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
                  desc: "يتم تحديث متوسط تكلفة الوحدة تلقائياً مع كل سند استلام وارد جديد بناء على التكلفة والكمية.",
                },
                {
                  id: "fifo",
                  title: "الوارد أولاً صادر أولاً (FIFO)",
                  badge: "مناسب للبضائع ذات الصلاحية",
                  badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
                  desc: "يتم صرف البضاعة بأقدم تكلفة شراء مسجلة في سجل الدفعات والمخزن.",
                },
                {
                  id: "lifo",
                  title: "الوارد أخيراً صادر أولاً (LIFO)",
                  badge: "حالات استثنائية",
                  badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
                  desc: "يتم صرف البضاعة بأحدث تكلفة شراء وردت للمخازن.",
                },
              ].map((m) => {
                const selected = generalSettings.costing_method === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => setGeneralSettings({ ...generalSettings, costing_method: m.id })}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      selected
                        ? "border-orange-500 bg-orange-50/40 shadow-sm"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-bold text-slate-900 text-sm">{m.title}</span>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            selected ? "border-orange-600 bg-orange-600" : "border-slate-300 bg-white"
                          }`}
                        >
                          {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border mb-2.5 ${m.badgeColor}`}>
                        {m.badge}
                      </span>
                      <p className="text-xs text-slate-500 leading-relaxed">{m.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card 2: Inventory Policy & Controls */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <ShieldCheck className="w-5 h-5 text-orange-600" />
              <h3 className="font-bold text-slate-900">سياسات الجرد والرقابة التشغيلية</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Policy */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-orange-600" /> سياسة الجرد المعتمدة
                </label>
                <select
                  value={generalSettings.inventory_policy}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, inventory_policy: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500"
                >
                  <option value="periodic">جرد دوري (شهري / ربع سنوي مع قيود تسوية)</option>
                  <option value="perpetual">جرد مستمر (تحديث مباشر وتتبع دائم للكميات)</option>
                  <option value="surprise">جرد مفاجئ وعشوائي دوري للتدقيق</option>
                </select>
                <p className="text-[10px] text-slate-400">تحدد كيفية تنظيم عمليات الجرد واعتماد الفروقات</p>
              </div>

              {/* Default Reorder Point */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> حد إعادة الطلب الافتراضي (وحدة)
                </label>
                <input
                  type="number"
                  min="0"
                  value={generalSettings.default_reorder_point}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, default_reorder_point: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500"
                />
                <p className="text-[10px] text-slate-400">الحد الأدنى الافتراضي لتنبيه انخفاض المخزون للأصناف الجديدة</p>
              </div>

              {/* Expiry Warning Days */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-rose-500" /> التنبيه قبل انتهاء الصلاحية (أيام)
                </label>
                <input
                  type="number"
                  min="1"
                  value={generalSettings.expiry_warning_days}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, expiry_warning_days: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500"
                />
                <p className="text-[10px] text-slate-400">إشعار فرق العمل بالأصناف القريبة من الانتهاء قبل هذه المدة</p>
              </div>

              {/* Allowed Wastage Percentage */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-purple-600" /> نسبة الهالك المقبولة المسموح بها %
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={generalSettings.allowed_wastage_percentage}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, allowed_wastage_percentage: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500"
                />
                <p className="text-[10px] text-slate-400">النسبة المسموح بها للهالك الطبيعي دون طلب تحقيق إداري</p>
              </div>
            </div>

            {/* Toggles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
              {/* Negative Stock Toggle */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm">السماح بالرصيد السالب</span>
                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-100 text-amber-800 border border-amber-200">تحذير رقابي</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    السماح بصرف مواد من المخزن حتى لو كان الرصيد الدفتري صفراً. (لا يوصى به لتجنب تشوه تكلفة الوجبات والأصناف).
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={generalSettings.allow_negative_stock}
                    onChange={(e) => setGeneralSettings({ ...generalSettings, allow_negative_stock: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                </label>
              </div>

              {/* Lock Stock During Count */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm">قفل المخزون أثناء الجرد</span>
                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-100 text-blue-800 border border-blue-200">أمان دقة الأرصدة</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    تجميد حركات الصرف والاستلام على الأصناف قيد الجرد حتى اعتماد الجلسة لضمان مطابقة دقيقة.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={generalSettings.lock_stock_during_count}
                    onChange={(e) => setGeneralSettings({ ...generalSettings, lock_stock_during_count: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                </label>
              </div>

              {/* Auto Link Accounts */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm">ربط القيود المحاسبية تلقائياً</span>
                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-100 text-emerald-800 border border-emerald-200">ERP تكاملي</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    إنشاء قيود اليومية آلياً في شجرة الحسابات عند اعتماد أذونات الاستلام، الصرف، والهالك والتسويات.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={generalSettings.auto_link_accounts}
                    onChange={(e) => setGeneralSettings({ ...generalSettings, auto_link_accounts: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                </label>
              </div>

              {/* Transaction Approvals */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm">طلب اعتماد إداري للحركات الحساسة</span>
                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-purple-100 text-purple-800 border border-purple-200">موافقات</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    إلزام المشرفين باعتماد سندات التسوية والهالك والتحويلات قبل تأثيرها على الرصيد الفعلي.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={generalSettings.require_approval_for_transactions}
                    onChange={(e) => setGeneralSettings({ ...generalSettings, require_approval_for_transactions: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                </label>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                onClick={handleSaveGeneralSettings}
                disabled={savingSettings}
                className="flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-orange-600/20 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {savingSettings ? "جاري حفظ الإعدادات..." : "حفظ الإعدادات والسياسات"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: WAREHOUSE TYPES (أنواع المخازن)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "warehouse_types" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-orange-600" /> دليل وتصنيفات أنواع المخازن
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">تصنيف المخازن الرئيسية والفرعية ومخازن الإنتاج والهالك</p>
            </div>
            <button
              onClick={() => {
                setTypeModalForm({ id: null, name: "", code: "", description: "", is_active: true });
                setShowTypeModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" /> إضافة نوع مخزن
            </button>
          </div>

          {/* Types Table */}
          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                <tr>
                  <th className="p-3">الكود</th>
                  <th className="p-3">اسم نوع المخزن</th>
                  <th className="p-3">الوصف</th>
                  <th className="p-3 text-center">النوع</th>
                  <th className="p-3 text-center">الحالة</th>
                  <th className="p-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {warehouseTypes.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-mono font-bold text-slate-700">{t.code}</td>
                    <td className="p-3 font-bold text-slate-900">{t.name}</td>
                    <td className="p-3 text-slate-500 max-w-xs truncate">{t.description || "—"}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.is_system ? "bg-slate-100 text-slate-700 border border-slate-200" : "bg-purple-50 text-purple-700 border border-purple-200"
                        }`}
                      >
                        {t.is_system ? "نظامي" : "مخصص"}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.is_active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {t.is_active ? "نشط" : "معطل"}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setTypeModalForm(t);
                            setShowTypeModal(true);
                          }}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-blue-600 transition-colors"
                          title="تعديل"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {!t.is_system && (
                          <button
                            onClick={() => handleDeleteWarehouseType(t.id)}
                            className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: TRANSACTION TYPES (أنواع الحركات)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "transaction_types" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-orange-600" /> أنواع الحركات المخزنية
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">تعريف حركات الوارد، الصرف، التسويات، الجرد والهالك</p>
            </div>
            <button
              onClick={() => {
                setTxTypeModalForm({ id: null, name: "", code: "", effect: "in", requires_approval: true, is_active: true, description: "" });
                setShowTxTypeModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" /> إضافة نوع حركة
            </button>
          </div>

          {/* Transactions Table */}
          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                <tr>
                  <th className="p-3">الكود</th>
                  <th className="p-3">اسم الحركة</th>
                  <th className="p-3 text-center">التأثير على الرصيد</th>
                  <th className="p-3 text-center">يتطلب اعتماد</th>
                  <th className="p-3 text-center">النوع</th>
                  <th className="p-3 text-center">الحالة</th>
                  <th className="p-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactionTypes.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-mono font-bold text-slate-700">{t.code}</td>
                    <td className="p-3 font-bold text-slate-900">{t.name}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          t.effect === "in"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : t.effect === "out"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}
                      >
                        {t.effect === "in" ? "+ وارد (إضافة)" : t.effect === "out" ? "- صادر (خصم)" : "~ تسوية / نقل"}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.requires_approval ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                        {t.requires_approval ? "نعم" : "تلقائي"}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.is_system ? "bg-slate-100 text-slate-700" : "bg-purple-50 text-purple-700"}`}>
                        {t.is_system ? "نظامي" : "مخصص"}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.is_active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                        {t.is_active ? "نشط" : "معطل"}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setTxTypeModalForm(t);
                            setShowTxTypeModal(true);
                          }}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-blue-600 transition-colors"
                          title="تعديل"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {!t.is_system && (
                          <button
                            onClick={() => handleDeleteTransactionType(t.id)}
                            className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: TRANSACTION REASONS (أسباب الحركات)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "transaction_reasons" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-orange-600" /> أسباب ومبررات الحركات المخزنية
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">تحديد أسباب التسويات، الهالك، والصرف المباشر للتوثيق المحاسبي</p>
            </div>
            <button
              onClick={() => {
                setReasonModalForm({ id: null, name: "", code: "", transaction_type: "all", description: "", is_active: true });
                setShowReasonModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" /> إضافة سبب حركة
            </button>
          </div>

          {/* Reasons Table */}
          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                <tr>
                  <th className="p-3">الكود</th>
                  <th className="p-3">السبب / المبرر</th>
                  <th className="p-3">نوع الحركة المرتبطة</th>
                  <th className="p-3">الوصف</th>
                  <th className="p-3 text-center">النوع</th>
                  <th className="p-3 text-center">الحالة</th>
                  <th className="p-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactionReasons.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-mono font-bold text-slate-700">{r.code}</td>
                    <td className="p-3 font-bold text-slate-900">{r.name}</td>
                    <td className="p-3 text-slate-600">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[11px]">{r.transaction_type || "عام"}</span>
                    </td>
                    <td className="p-3 text-slate-500 max-w-xs truncate">{r.description || "—"}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.is_system ? "bg-slate-100 text-slate-700" : "bg-purple-50 text-purple-700"}`}>
                        {r.is_system ? "نظامي" : "مخصص"}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.is_active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                        {r.is_active ? "نشط" : "معطل"}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setReasonModalForm(r);
                            setShowReasonModal(true);
                          }}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-blue-600 transition-colors"
                          title="تعديل"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {!r.is_system && (
                          <button
                            onClick={() => handleDeleteTransactionReason(r.id)}
                            className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: WAREHOUSE TYPE
      ───────────────────────────────────────────────────────────── */}
      {showTypeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">
                {typeModalForm.id ? "تعديل نوع المخزن" : "إضافة نوع مخزن جديد"}
              </h3>
              <button onClick={() => setShowTypeModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveWarehouseType} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">اسم نوع المخزن *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: مخزن المواد الكيميائية"
                  value={typeModalForm.name}
                  onChange={(e) => setTypeModalForm({ ...typeModalForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">الكود التعريفي *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: chemical_wh"
                  value={typeModalForm.code}
                  onChange={(e) => setTypeModalForm({ ...typeModalForm, code: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">الوصف</label>
                <textarea
                  rows={2}
                  value={typeModalForm.description}
                  onChange={(e) => setTypeModalForm({ ...typeModalForm, description: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="wh_active_chk"
                  checked={typeModalForm.is_active}
                  onChange={(e) => setTypeModalForm({ ...typeModalForm, is_active: e.target.checked })}
                  className="w-4 h-4 rounded text-orange-600"
                />
                <label htmlFor="wh_active_chk" className="text-xs font-bold text-slate-700 cursor-pointer">
                  حالة النوع نشطة
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTypeModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  حفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: TRANSACTION TYPE
      ───────────────────────────────────────────────────────────── */}
      {showTxTypeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">
                {txTypeModalForm.id ? "تعديل نوع الحركة" : "إضافة نوع حركة جديد"}
              </h3>
              <button onClick={() => setShowTxTypeModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveTransactionType} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">اسم الحركة *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: صرف عينات ترويجية"
                  value={txTypeModalForm.name}
                  onChange={(e) => setTxTypeModalForm({ ...txTypeModalForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">الكود التعريفي *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: sample_out"
                  value={txTypeModalForm.code}
                  onChange={(e) => setTxTypeModalForm({ ...txTypeModalForm, code: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">التأثير على الرصيد *</label>
                <select
                  value={txTypeModalForm.effect}
                  onChange={(e) => setTxTypeModalForm({ ...txTypeModalForm, effect: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                >
                  <option value="in">وارد (+ إضافة للرصيد)</option>
                  <option value="out">صادر (- خصم من الرصيد)</option>
                  <option value="adjust">تسوية / جرد (~ تعديل الرصيد)</option>
                </select>
              </div>
              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={txTypeModalForm.requires_approval}
                    onChange={(e) => setTxTypeModalForm({ ...txTypeModalForm, requires_approval: e.target.checked })}
                    className="w-4 h-4 rounded text-orange-600"
                  />
                  يتطلب اعتماد
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={txTypeModalForm.is_active}
                    onChange={(e) => setTxTypeModalForm({ ...txTypeModalForm, is_active: e.target.checked })}
                    className="w-4 h-4 rounded text-orange-600"
                  />
                  نشط
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTxTypeModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  حفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: TRANSACTION REASON
      ───────────────────────────────────────────────────────────── */}
      {showReasonModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">
                {reasonModalForm.id ? "تعديل سبب الحركة" : "إضافة سبب حركة جديد"}
              </h3>
              <button onClick={() => setShowReasonModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveTransactionReason} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">السبب / المبرر *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: تلف أثناء النقل والتفريغ"
                  value={reasonModalForm.name}
                  onChange={(e) => setReasonModalForm({ ...reasonModalForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">الكود التعريفي *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: transit_damage"
                  value={reasonModalForm.code}
                  onChange={(e) => setReasonModalForm({ ...reasonModalForm, code: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">نوع الحركة المرتبطة</label>
                <select
                  value={reasonModalForm.transaction_type}
                  onChange={(e) => setReasonModalForm({ ...reasonModalForm, transaction_type: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                >
                  <option value="all">عام لجميع الحركات</option>
                  <option value="damaged">هالك وتالف</option>
                  <option value="adjustment">تسويات مخزنية</option>
                  <option value="issue">صرف مواد</option>
                  <option value="receive">استلام وتوريد</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="reason_active_chk"
                  checked={reasonModalForm.is_active}
                  onChange={(e) => setReasonModalForm({ ...reasonModalForm, is_active: e.target.checked })}
                  className="w-4 h-4 rounded text-orange-600"
                />
                <label htmlFor="reason_active_chk" className="text-xs font-bold text-slate-700 cursor-pointer">
                  نشط ومتاح للاستخدام
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReasonModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  حفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
