import React, { useEffect, useState } from "react";
import {
  ArrowLeft, Calendar, Check, ChevronDown, ChevronUp, FileText, Hash,
  Info, Layers, ListChecks, Loader2, Package, Plus, Save, Search,
  Send, SlidersHorizontal, Trash2, User, Warehouse, X,
} from "lucide-react";
import { apiFetch } from "../../utils/api";

interface CreateMaterialRequestPageProps {
  warehouses: any[];
  onBack: () => void;
  onCreated: () => void;
  onNotify: (msg: string, type: "success" | "error") => void;
}

interface RequestLine {
  ingredient_id: number;
  requested_qty: number;
  purpose: string;
  notes: string;
  // Snapshot of the master data, used for display only.
  name: string;
  code: string;
  unit: string;
  available_qty: number;
}

const DEPARTMENTS = [
  "قسم الإنتاج",
  "قسم التجهيز",
  "المطبخ المركزي",
  "قسم الصيانة",
  "إدارة المشتريات",
  "إدارة المستودعات",
  "الإدارة العامة",
];

const tomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
};

const fmtQty = (value: any) =>
  Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 3 });

const FieldLabel: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <label className="flex items-center justify-start gap-1.5 mb-1.5 text-xs font-bold text-slate-600">
    <span className="text-slate-400">{icon}</span>
    <span>{children}</span>
  </label>
);

const inputClass =
  "w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all";

export const CreateMaterialRequestPage: React.FC<CreateMaterialRequestPageProps> = ({
  warehouses = [],
  onBack,
  onCreated,
  onNotify,
}) => {
  const [form, setForm] = useState({
    warehouse_id: Number(warehouses[0]?.id) || 0,
    request_type: "operational",
    department: "قسم الإنتاج",
    cost_center: "CC-PROD-01",
    work_order_no: "",
    priority: "medium",
    needed_date: tomorrow(),
    notes: "",
  });

  const [lines, setLines] = useState<RequestLine[]>([]);
  const [itemQuery, setItemQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState<null | "send" | "draft">(null);

  const updateForm = (field: keyof typeof form, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // Search the selected warehouse's catalogue by name / code / barcode.
  // Results carry that warehouse's live balance so the requester never adds a
  // quantity blindly.
  useEffect(() => {
    const warehouseId = Number(form.warehouse_id);
    const term = itemQuery.trim();
    if (!warehouseId || !term) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      apiFetch(
        `/api/material-requests/items/search?warehouse_id=${warehouseId}&q=${encodeURIComponent(term)}&limit=8`
      )
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          setResults(data?.success && Array.isArray(data.items) ? data.items : []);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.warehouse_id, itemQuery]);

  const changeWarehouse = (warehouseId: number) => {
    if (lines.length && warehouseId !== Number(form.warehouse_id)) {
      setLines([]);
      setItemQuery("");
      setResults([]);
      onNotify("تم تغيير المستودع وإعادة ضبط الأصناف المضافة", "success");
    }
    updateForm("warehouse_id", warehouseId);
  };

  const isAdded = (ingredientId: number) =>
    lines.some((line) => Number(line.ingredient_id) === Number(ingredientId));

  const addItem = (item: any) => {
    if (isAdded(item.id)) {
      onNotify(`الصنف «${item.name}» مضاف بالفعل إلى الطلب`, "error");
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        ingredient_id: Number(item.id),
        requested_qty: 1,
        purpose: "",
        notes: "",
        name: item.name,
        code: item.code || "",
        unit: item.unit || "وحدة",
        available_qty: Number(item.available_qty ?? 0),
      },
    ]);
    onNotify(`تمت إضافة «${item.name}» إلى الطلب`, "success");
  };

  const changeQty = (index: number, value: number) =>
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, requested_qty: value } : line))
    );

  const stepQty = (index: number, delta: number) =>
    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;
        const next = Number((Number(line.requested_qty || 0) + delta).toFixed(3));
        return { ...line, requested_qty: Math.max(1, next) };
      })
    );

  const removeLine = (index: number) =>
    setLines((prev) => prev.filter((_, i) => i !== index));

  const submit = async (mode: "send" | "draft") => {
    if (!Number(form.warehouse_id)) {
      onNotify("اختر المستودع المطلوب الصرف منه", "error");
      return;
    }
    if (!lines.length) {
      onNotify("أضف صنفاً واحداً على الأقل إلى جدول الأصناف المطلوبة", "error");
      return;
    }
    if (lines.some((line) => !Number(line.requested_qty) || Number(line.requested_qty) <= 0)) {
      onNotify("يرجى إدخال كمية صحيحة أكبر من صفر لكل صنف", "error");
      return;
    }

    setSubmitting(mode);
    try {
      const res = await apiFetch("/api/material-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouse_id: Number(form.warehouse_id),
          request_type: form.request_type,
          department: form.department,
          cost_center: form.cost_center,
          work_order_no: form.work_order_no,
          priority: form.priority,
          needed_date: form.needed_date,
          notes: form.notes,
          status: mode === "draft" ? "draft" : undefined,
          items: lines.map((line) => ({
            ingredient_id: line.ingredient_id,
            requested_qty: Number(line.requested_qty),
            purpose: line.purpose,
            notes: line.notes,
          })),
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (data.success) {
        onNotify(
          mode === "draft"
            ? "تم حفظ الطلب كمسودة، ويمكنك اعتماده من قائمة الطلبات لاحقاً"
            : "تم إرسال الطلب للاعتماد بنجاح",
          "success"
        );
        onCreated();
      } else {
        onNotify(data.error || "تعذر إنشاء طلب الصرف", "error");
      }
    } catch {
      onNotify("خطأ في الاتصال بالخادم", "error");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="space-y-5" dir="rtl" id="material-request-create-page">
      {/* ── Page header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">إنشاء طلب صرف مواد وتشغيل جديد</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">بيانات الطلب والأصناف في شاشة واحدة</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-500 hover:text-blue-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> العودة إلى قائمة الطلبات
        </button>
      </div>

      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          submit("send");
        }}
      >
        {/* ── Request header fields ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-x-4 gap-y-5">
            <div>
              <FieldLabel icon={<Warehouse className="w-3.5 h-3.5" />}>المستودع</FieldLabel>
              <select
                required
                value={form.warehouse_id}
                onChange={(event) => changeWarehouse(Number(event.target.value))}
                className={inputClass}
              >
                {warehouses.length === 0 && <option value={0}>لا توجد مستودعات مسجلة</option>}
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel icon={<Layers className="w-3.5 h-3.5" />}>نوع الطلب / النشاط</FieldLabel>
              <select
                value={form.request_type}
                onChange={(event) => updateForm("request_type", event.target.value)}
                className={inputClass}
              >
                <option value="operational">صرف مواد تشغيل</option>
                <option value="production">تشغيل وإنتاج</option>
                <option value="maintenance">صيانة وإصلاحات</option>
                <option value="custody">صرف عهدة</option>
                <option value="project">مشروع / فرع جديد</option>
              </select>
            </div>

            <div>
              <FieldLabel icon={<User className="w-3.5 h-3.5" />}>القسم طالب الطلب</FieldLabel>
              <select
                required
                value={form.department}
                onChange={(event) => updateForm("department", event.target.value)}
                className={inputClass}
              >
                {!DEPARTMENTS.includes(form.department) && (
                  <option value={form.department}>{form.department}</option>
                )}
                {DEPARTMENTS.map((department) => (
                  <option key={department} value={department}>{department}</option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel icon={<SlidersHorizontal className="w-3.5 h-3.5" />}>مركز التكلفة</FieldLabel>
              <input
                type="text"
                value={form.cost_center}
                onChange={(event) => updateForm("cost_center", event.target.value)}
                className={`${inputClass} font-mono`}
                placeholder="مثال: CC-PROD-01"
              />
            </div>

            <div>
              <FieldLabel icon={<Hash className="w-3.5 h-3.5" />}>رقم أمر التشغيل</FieldLabel>
              <input
                type="text"
                value={form.work_order_no}
                onChange={(event) => updateForm("work_order_no", event.target.value)}
                className={`${inputClass} font-mono`}
                placeholder="مثال: WO-2026-001"
              />
            </div>

            <div>
              <FieldLabel icon={<ListChecks className="w-3.5 h-3.5" />}>الأولوية</FieldLabel>
              <select
                value={form.priority}
                onChange={(event) => updateForm("priority", event.target.value)}
                className={inputClass}
              >
                <option value="low">منخفضة</option>
                <option value="medium">متوسطة</option>
                <option value="high">مرتفعة</option>
                <option value="urgent">عاجلة</option>
              </select>
            </div>

            <div>
              <FieldLabel icon={<Calendar className="w-3.5 h-3.5" />}>تاريخ الاحتياج</FieldLabel>
              <input
                type="date"
                value={form.needed_date}
                onChange={(event) => updateForm("needed_date", event.target.value)}
                className={`${inputClass} font-mono`}
              />
            </div>

            <div>
              <FieldLabel icon={<FileText className="w-3.5 h-3.5" />}>ملاحظات / إضافة</FieldLabel>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(event) => updateForm("notes", event.target.value)}
                className="w-full min-h-[40px] px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-800 outline-none resize-y focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                placeholder="اكتب الغاية من الطلب أو أي ملاحظات إضافية..."
              />
            </div>
          </div>
        </div>

        {/* ── Item search ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
            <h3 className="flex items-center gap-2 text-sm font-black text-slate-800">
              <Search className="w-4 h-4 text-blue-600" /> بحث عن صنف بالاسم أو الكود
            </h3>
            <Search className="w-5 h-5 text-slate-300" />
          </div>

          <div className="px-5 pb-5 space-y-3">
            <div className="relative max-w-3xl mx-auto">
              <input
                type="text"
                value={itemQuery}
                onChange={(event) => setItemQuery(event.target.value)}
                placeholder="ابحث باسم الصنف أو كوده..."
                className="w-full h-11 pr-4 pl-11 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
              {itemQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setItemQuery("");
                    setResults([]);
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                  title="مسح البحث"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              )}
            </div>

            {itemQuery.trim() !== "" && (
              <div className="rounded-xl border border-slate-200 overflow-hidden max-w-3xl mx-auto">
                <div className="px-3 py-2 bg-slate-50 text-[11px] font-bold text-slate-500">
                  نتائج البحث ({searching ? "..." : results.length})
                </div>

                {searching ? (
                  <div className="flex items-center justify-center gap-2 px-4 py-5 text-xs font-bold text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" /> جاري البحث في أصناف المستودع...
                  </div>
                ) : results.length === 0 ? (
                  <div className="px-4 py-5 text-center text-xs text-slate-500">
                    لا توجد أصناف مطابقة في هذا المستودع
                  </div>
                ) : (
                  results.map((item) => {
                    const added = isAdded(item.id);
                    const available = Number(item.available_qty ?? 0);
                    return (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center gap-3 sm:gap-6 px-3 py-3 border-t border-slate-100 bg-blue-50/40"
                      >
                        <div className="w-9 h-9 rounded-lg bg-white border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                          <Package className="w-4 h-4" />
                        </div>

                        <div className="flex-1 min-w-[140px]">
                          <div className="text-sm font-bold text-slate-800">{item.name}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            كود الصنف: <span className="font-mono">{item.code || "—"}</span>
                          </div>
                        </div>

                        <div className="text-center px-2">
                          <div className="text-[10px] font-bold text-slate-400">الكمية المتاحة</div>
                          <div className="flex items-center justify-center gap-1.5 mt-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${available > 0 ? "bg-emerald-500" : "bg-rose-500"}`} />
                            <span className={`text-xs font-bold ${available > 0 ? "text-slate-800" : "text-rose-600"}`}>
                              {fmtQty(available)}
                            </span>
                            <span className="text-[11px] text-slate-500">{item.unit}</span>
                          </div>
                        </div>

                        <div className="text-center px-2">
                          <div className="text-[10px] font-bold text-slate-400">الوحدة</div>
                          <div className="text-xs font-bold text-slate-700 mt-1">{item.unit}</div>
                        </div>

                        <button
                          type="button"
                          onClick={() => addItem(item)}
                          disabled={added}
                          className={`h-9 px-5 inline-flex items-center gap-1.5 rounded-lg text-xs font-bold transition-colors ${
                            added
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20"
                          }`}
                        >
                          {added ? (
                            <>
                              <Check className="w-3.5 h-3.5" /> مضاف
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" /> إضافة
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-1.5 text-[11px] text-slate-400">
              <Info className="w-3.5 h-3.5" />
              سيتم إضافة الصنف إلى جدول الأصناف المطلوبة عند الضغط على إضافة
            </div>
          </div>
        </div>

        {/* ── Requested items table ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <h3 className="flex items-center gap-2 text-sm font-black text-slate-800">
              <Layers className="w-4 h-4 text-blue-600" /> جدول الأصناف المطلوبة
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-right">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500">
                <tr>
                  <th className="px-3 py-3 w-12 text-center border-l border-slate-100">#</th>
                  <th className="px-3 py-3 border-l border-slate-100">الصنف</th>
                  <th className="px-3 py-3 w-32 border-l border-slate-100">كود الصنف</th>
                  <th className="px-3 py-3 w-40 border-l border-slate-100 text-center">المتاح في المخزون</th>
                  <th className="px-3 py-3 w-36 border-l border-slate-100 text-center">الكمية المطلوبة</th>
                  <th className="px-3 py-3 w-24 border-l border-slate-100 text-center">الوحدة</th>
                  <th className="px-3 py-3 w-56 border-l border-slate-100">ملاحظات</th>
                  <th className="px-3 py-3 w-16 text-center">إجراء</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-xs text-slate-500">
                      لم تتم إضافة أي صنف بعد — استخدم البحث بالأعلى لإضافة الأصناف المطلوبة.
                    </td>
                  </tr>
                ) : (
                  lines.map((line, index) => {
                    const shortage = Number(line.requested_qty) > Number(line.available_qty);
                    return (
                      <tr key={line.ingredient_id} className="border-t border-slate-100 hover:bg-slate-50/50">
                        <td className="px-3 py-3 text-center text-xs font-bold text-slate-500 border-l border-slate-100">
                          {index + 1}
                        </td>

                        <td className="px-3 py-3 border-l border-slate-100">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                              <Package className="w-4 h-4" />
                            </div>
                            <div className="text-xs font-bold text-slate-800">
                              {line.name} <span className="text-slate-400 font-normal">({line.unit})</span>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-3 text-xs font-mono text-slate-600 border-l border-slate-100">
                          {line.code || "—"}
                        </td>

                        <td className="px-3 py-3 border-l border-slate-100">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${line.available_qty > 0 ? "bg-emerald-500" : "bg-rose-500"}`} />
                            <span className="text-[10px] text-slate-400">متاح</span>
                            <span className={`text-xs font-bold ${shortage ? "text-rose-600" : "text-slate-800"}`}>
                              {fmtQty(line.available_qty)}
                            </span>
                            <span className="text-[10px] text-slate-500">{line.unit}</span>
                          </div>
                          {shortage && (
                            <div className="text-center text-[10px] font-bold text-rose-500 mt-0.5">
                              الكمية المطلوبة أكبر من المتاح
                            </div>
                          )}
                        </td>

                        <td className="px-2 py-3 border-l border-slate-100">
                          <div
                            className={`flex items-center h-9 w-28 mx-auto border rounded-lg overflow-hidden bg-white ${
                              shortage ? "border-rose-300" : "border-slate-200"
                            }`}
                          >
                            <input
                              type="number"
                              min="1"
                              step="any"
                              value={line.requested_qty}
                              onChange={(event) => changeQty(index, Number(event.target.value))}
                              className="w-full h-full px-2 text-center text-sm font-bold text-slate-800 bg-transparent border-0 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                            <div className="flex flex-col h-full border-r border-slate-200">
                              <button
                                type="button"
                                onClick={() => stepQty(index, 1)}
                                className="flex-1 px-1.5 text-slate-500 hover:bg-slate-50 border-b border-slate-200"
                                title="زيادة"
                              >
                                <ChevronUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => stepQty(index, -1)}
                                className="flex-1 px-1.5 text-slate-500 hover:bg-slate-50"
                                title="تقليل"
                              >
                                <ChevronDown className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-3 border-l border-slate-100">
                          <div className="h-9 px-2 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700">
                            {line.unit}
                          </div>
                        </td>

                        <td className="px-3 py-3 border-l border-slate-100">
                          <input
                            type="text"
                            value={line.notes}
                            onChange={(event) =>
                              setLines((prev) =>
                                prev.map((row, i) => (i === index ? { ...row, notes: event.target.value } : row))
                              )
                            }
                            placeholder="ملاحظات على الصنف..."
                            className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          />
                        </td>

                        <td className="px-3 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(index)}
                            className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 transition-colors"
                            title="حذف الصنف من الطلب"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── Footer actions (inside the items card, as in the target screen) ── */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-slate-100 bg-white">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <ListChecks className="w-4 h-4 text-blue-600" />
              عدد الأصناف في الطلب:
              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-black">{lines.length}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onBack}
                className="h-10 px-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <X className="w-4 h-4" /> إلغاء
              </button>
              <button
                type="button"
                onClick={() => submit("draft")}
                disabled={submitting !== null}
                className="h-10 px-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors"
              >
                {submitting === "draft" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                حفظ كمسودة
              </button>
              <button
                type="submit"
                disabled={submitting !== null}
                className="h-10 px-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-sm shadow-blue-500/20 disabled:opacity-60 transition-colors"
              >
                {submitting === "send" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                إرسال الطلب للاعتماد
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
