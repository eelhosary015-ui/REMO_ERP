import React, { useState, useEffect } from "react";
import {
  Printer,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  RotateCw,
  Send,
  FileText,
} from "lucide-react";
import { api } from "../utils/api";

interface PrinterData {
  id: number;
  name: string;
  ip_address: string;
  port: number;
  is_active: number;
  branch_id?: number | null;
  category_ids?: number[];
  connection_type?: string;
  system_printer_name?: string;
}

interface SystemPrinter {
  name: string;
  isDefault: boolean;
  status: string;
}

const KIND_LABELS: Record<string, string> = {
  receipt: "فاتورة عميل",
  kitchen: "تذكرة مطبخ",
  test: "اختبار",
};

const PrintLogPanel: React.FC = () => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [summary, setSummary] = useState<{ total: number; sent: number; pending: number; failed: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/api/system/health/print-logs?limit=100");
      const data = await res.json().catch(() => ({}));
      if (data?.jobs) setJobs(data.jobs);
      if (data?.summary) setSummary(data.summary);
    } catch (err: any) {
      setError(err?.message || "تعذر تحميل سجل الطباعة");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const retryAll = async () => {
    setRetrying(true);
    setError(null);
    try {
      const res = await api.post("/api/system/health/print-logs/retry", {});
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data?.error || "فشلت إعادة المحاولة");
      await load();
    } catch (err: any) {
      setError(err?.message || "فشلت إعادة المحاولة");
    } finally {
      setRetrying(false);
    }
  };

  const badge = (status: string) => {
    if (status === "sent") return "bg-emerald-100 text-emerald-700";
    if (status === "pending") return "bg-amber-100 text-amber-700";
    return "bg-rose-100 text-rose-700";
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
          <p className="text-[11px] font-bold text-slate-500">آخر 24 ساعة</p>
          <p className="text-lg font-black text-slate-800 font-mono">{summary?.total ?? 0}</p>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 px-4 py-3">
          <p className="text-[11px] font-bold text-emerald-700">تمت بنجاح</p>
          <p className="text-lg font-black text-emerald-700 font-mono">{summary?.sent ?? 0}</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 px-4 py-3">
          <p className="text-[11px] font-bold text-amber-700">في انتظار إعادة المحاولة</p>
          <p className="text-lg font-black text-amber-700 font-mono">{summary?.pending ?? 0}</p>
        </div>
        <div className="bg-rose-50 rounded-xl border border-rose-200 px-4 py-3">
          <p className="text-[11px] font-bold text-rose-700">فشلت</p>
          <p className="text-lg font-black text-rose-700 font-mono">{summary?.failed ?? 0}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          الطباعة الفاشلة بتتحاول تتعاد تلقائيًا كل دقيقة لحد 3 محاولات.
        </p>
        <div className="flex gap-2">
          <button
            onClick={retryAll}
            disabled={retrying}
            className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            <Send className={`w-4 h-4 ${retrying ? "animate-pulse" : ""}`} />
            إعادة طباعة الفاشل
          </button>
          <button
            onClick={load}
            className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 flex items-center gap-1.5"
          >
            <RotateCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            تحديث
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-right text-xs min-w-[720px]">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
            <tr>
              <th className="p-3 font-semibold">الوقت</th>
              <th className="p-3 font-semibold">أوردر</th>
              <th className="p-3 font-semibold">النوع</th>
              <th className="p-3 font-semibold">الطابعة</th>
              <th className="p-3 font-semibold">الحالة</th>
              <th className="p-3 font-semibold">محاولات</th>
              <th className="p-3 font-semibold">تفاصيل</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-slate-50">
                <td className="p-3 text-slate-500 font-mono text-[11px]">
                  {job.created_at ? new Date(job.created_at).toLocaleString("ar-EG") : "-"}
                </td>
                <td className="p-3 font-mono text-slate-700">#{job.order_id ?? "-"}</td>
                <td className="p-3 text-slate-700">{KIND_LABELS[job.kind] || job.kind}</td>
                <td className="p-3 text-slate-700">
                  {job.printer_name}
                  <span className="text-slate-400 text-[10px] mr-1">
                    ({job.connection_type === "local" ? "محلية" : "شبكة"})
                  </span>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${badge(job.status)}`}>
                    {job.status === "sent" ? "تمت" : job.status === "pending" ? "معلّقة" : "فشلت"}
                  </span>
                </td>
                <td className="p-3 font-mono text-slate-600">{job.attempt}</td>
                <td className="p-3 text-slate-500 text-[11px] max-w-[220px] truncate" title={job.message || ""}>
                  {job.message || "-"}
                </td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  لا توجد عمليات طباعة مسجلة بعد — اطبع أوردر أو استخدم اختبار الطباعة
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface PrintersProps {
  onBack: () => void;
  selectedBranch: any;
}

export const Printers: React.FC<PrintersProps> = ({
  onBack,
  selectedBranch,
}) => {
  const [printers, setPrinters] = useState<PrinterData[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [systemPrinters, setSystemPrinters] = useState<SystemPrinter[]>([]);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [tab, setTab] = useState<"printers" | "logs">("printers");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<PrinterData | null>(
    null,
  );
  const [formData, setFormData] = useState({
    name: "",
    ip_address: "",
    port: 9100,
    is_active: 1,
    branch_id: selectedBranch?.id || "",
    category_ids: [] as number[],
    connection_type: "local",
    system_printer_name: "",
  });

  const fetchPrinters = async () => {
    if (!selectedBranch?.id) return;
    try {
      const res = await api.get(`/api/printers?branch_id=${selectedBranch.id}`);
      const data = await res.json();
      setPrinters(data);
    } catch (error) {
      console.error("Failed to fetch printers", error);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get("/api/pos/data");
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error("Failed to fetch categories", error);
    }
  };

  const fetchSystemPrinters = async () => {
    try {
      const res = await api.get("/api/system-printers");
      const data = await res.json();
      // Accept both the new object shape and a plain list of names
      const list: SystemPrinter[] = Array.isArray(data)
        ? data.map((p: any) =>
            typeof p === "string"
              ? { name: p, isDefault: false, status: "ready" }
              : { name: p.name, isDefault: !!p.isDefault, status: p.status || "ready" },
          )
        : [];
      setSystemPrinters(list.filter((p) => !!p.name));
    } catch (e) {
      console.error("Failed to fetch system printers", e);
    }
  };

  const testPrint = async (printer: PrinterData) => {
    setTestingId(printer.id);
    setNotice(null);
    try {
      const res = await api.post(`/api/printers/${printer.id}/test`, {});
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setNotice({ ok: true, text: data.message || "تم إرسال اختبار الطباعة" });
      } else {
        setNotice({ ok: false, text: data?.error || "فشل اختبار الطباعة" });
      }
    } catch (error: any) {
      setNotice({ ok: false, text: error?.message || "فشل اختبار الطباعة" });
    } finally {
      setTestingId(null);
    }
  };

  useEffect(() => {
    fetchPrinters();
    fetchCategories();
    fetchSystemPrinters();
  }, [selectedBranch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    try {
      const res = editingPrinter
        ? await api.put(`/api/printers/${editingPrinter.id}`, formData)
        : await api.post("/api/printers", formData);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setNotice({ ok: false, text: data?.error || "تعذر حفظ الطابعة" });
        return;
      }
      setIsModalOpen(false);
      setEditingPrinter(null);
      setFormData({
        name: "",
        ip_address: "",
        port: 9100,
        is_active: 1,
        branch_id: selectedBranch?.id || "",
        category_ids: [],
        connection_type: "local",
        system_printer_name: "",
      });
      fetchPrinters();
    } catch (error) {
      console.error("Failed to save printer", error);
      setNotice({ ok: false, text: "تعذر حفظ الطابعة" });
    }
  };

  const handleDelete = async (id: number) => {
    if (
      !confirm(
        "هل أنت متأكد من حذف هذه الطابعة؟ سيتم إزالتها من جميع الأقسام المرتبطة بها.",
      )
    )
      return;
    try {
      await api.delete(`/api/printers/${id}`);
      fetchPrinters();
    } catch (error) {
      console.error("Failed to delete printer", error);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300"
          >
            رجوع
          </button>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Printer className="w-6 h-6 text-indigo-600" />
            إدارة الطابعات
          </h2>
        </div>
        <button
          onClick={() => {
            setEditingPrinter(null);
            setFormData({
              name: "",
              ip_address: "",
              port: 9100,
              is_active: 1,
              branch_id: selectedBranch?.id || "",
              category_ids: [],
              connection_type: "local",
              system_printer_name: "",
            });
            setIsModalOpen(true);
          }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          إضافة طابعة
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab("printers")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            tab === "printers"
              ? "bg-indigo-600 text-white"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Printer className="w-4 h-4" />
            الطابعات
          </span>
        </button>
        <button
          onClick={() => setTab("logs")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            tab === "logs"
              ? "bg-indigo-600 text-white"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <FileText className="w-4 h-4" />
            سجل الطباعة
          </span>
        </button>
      </div>

      {tab === "printers" && (
        <>
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-sm text-indigo-900">
        <p className="font-bold mb-1">إزاي بيشتغل الربط التلقائي؟</p>
        <ul className="list-disc pr-5 space-y-1 text-indigo-800/80 text-xs leading-relaxed">
          <li>
            طابعة <strong>بدون أقسام</strong> = طابعة الفواتير: بتستقبل فاتورة العميل تلقائياً مع كل
            أوردر من نقطة البيع، من غير ما تضغط زرار طباعة.
          </li>
          <li>
            طابعة <strong>مرتبطة بأقسام</strong> = طابعة تذاكر المطبخ: بتستقبل أصناف الأوردر الخاصة
            بتلك الأقسام فقط.
          </li>
          <li>
            اربط الطابعة <strong>محلية على الجهاز</strong> إذا كانت مثبتة على نفس جهاز الخادم، أو
            <strong> شبكة IP </strong> لو موجودة على الشبكة.
          </li>
        </ul>
      </div>

      {notice && (
        <div
          className={`rounded-2xl border p-3 text-xs font-bold ${
            notice.ok
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : "bg-rose-50 border-rose-200 text-rose-700"
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-right min-w-[800px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-4 font-semibold text-slate-600">اسم الطابعة</th>
              <th className="p-4 font-semibold text-slate-600">
                الأقسام (التصنيفات)
              </th>
              <th className="p-4 font-semibold text-slate-600">الربط</th>
              <th className="p-4 font-semibold text-slate-600">الحالة</th>
              <th className="p-4 font-semibold text-slate-600">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {printers.map((printer) => (
              <tr
                key={printer.id}
                className="hover:bg-slate-50 transition-colors"
              >
                <td className="p-4 font-medium text-slate-800">
                  {printer.name}
                </td>
                <td className="p-4 text-slate-600">
                  {printer.category_ids && printer.category_ids.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {printer.category_ids.map((id) => {
                        const cat = categories.find((c) => c.id === id);
                        return cat ? (
                          <span
                            key={id}
                            className="inline-block bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md text-xs"
                          >
                            {cat.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  ) : (
                    <span className="text-emerald-600 text-xs font-bold">
                      طابعة الفواتير الرئيسية — طباعة تلقائية لكل أوردر
                    </span>
                  )}
                </td>
                <td className="p-4 text-slate-600">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-block px-2 py-1 rounded-md text-[11px] font-bold ${
                        printer.connection_type === "local"
                          ? "bg-violet-50 text-violet-700"
                          : "bg-sky-50 text-sky-700"
                      }`}
                    >
                      {printer.connection_type === "local"
                        ? "محلية على الجهاز"
                        : "شبكة IP"}
                    </span>
                    <span className="dir-ltr text-xs text-slate-500">
                      {printer.connection_type === "local"
                        ? printer.system_printer_name || "غير محددة"
                        : `${printer.ip_address || "غير محدد"}:${printer.port || 9100}`}
                    </span>
                  </div>
                </td>
                <td className="p-4">
                  {printer.is_active ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="w-3 h-3" /> نشط
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
                      <XCircle className="w-3 h-3" /> غير نشط
                    </span>
                  )}
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => testPrint(printer)}
                      disabled={testingId === printer.id}
                      className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                      title="اختبار الطباعة"
                    >
                      {testingId === printer.id ? (
                        <RotateCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setEditingPrinter(printer);
                        setFormData({
                          name: printer.name,
                          ip_address: printer.ip_address,
                          port: printer.port,
                          is_active: printer.is_active,
                          branch_id: selectedBranch?.id || "",
                          category_ids: printer.category_ids || [],
                          connection_type: printer.connection_type || "local",
                          system_printer_name:
                            printer.system_printer_name || "",
                        });
                        setIsModalOpen(true);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(printer.id)}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {printers.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  لا توجد طابعات مضافة بعد
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
        </>
      )}

      {tab === "logs" && <PrintLogPanel />}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">
              {editingPrinter ? "تعديل طابعة" : "إضافة طابعة جديدة"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  اسم الطابعة
                </label>
                <input
                  type="text"
                  required
                  value={formData.name ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  placeholder="مثال: طابعة المشروبات"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  الأقسام (التصنيفات)
                </label>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 max-h-48 overflow-y-auto space-y-2">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200 mb-2">
                    <input
                      type="checkbox"
                      id="cat_none"
                      checked={formData.category_ids.length === 0}
                      onChange={() =>
                        setFormData({ ...formData, category_ids: [] })
                      }
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <label
                      htmlFor="cat_none"
                      className="text-sm font-medium text-slate-700"
                    >
                      طابعة رئيسية (بدون أقسام محددة)
                    </label>
                  </div>
                  {categories.map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`cat_${c.id}`}
                        checked={formData.category_ids.includes(c.id)}
                        onChange={(e) => {
                          const newIds = e.target.checked
                            ? [...formData.category_ids, c.id]
                            : formData.category_ids.filter((id) => id !== c.id);
                          setFormData({ ...formData, category_ids: newIds });
                        }}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      />
                      <label
                        htmlFor={`cat_${c.id}`}
                        className="text-sm text-slate-700"
                      >
                        {c.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  نوع ربط الطابعة
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, connection_type: "local" })
                    }
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-colors ${
                      formData.connection_type === "local"
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    طابعة على هذا الجهاز
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, connection_type: "ip" })
                    }
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-colors ${
                      formData.connection_type === "ip"
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    طابعة شبكة (IP)
                  </button>
                </div>
              </div>

              {formData.connection_type === "local" ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    طابعة الجهاز
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={formData.system_printer_name || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          system_printer_name: e.target.value,
                        })
                      }
                      className="w-full p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white text-sm"
                    >
                      <option value="">— اختر طابعة من جهازك —</option>
                      {systemPrinters.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name}
                          {p.isDefault ? " (الافتراضية)" : ""}
                          {p.status === "offline" ? " — غير متصلة" : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={fetchSystemPrinters}
                      className="px-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                      title="تحديث طابعات الجهاز"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    list="printersList"
                    placeholder="أو اكتب اسم الطابعة / المسار \\PC-NAME\\Kitchen"
                    value={formData.system_printer_name || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        system_printer_name: e.target.value,
                      })
                    }
                    className="w-full mt-2 p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white dir-ltr text-right text-sm"
                  />
                  <datalist id="printersList">
                    {systemPrinters.map((p) => (
                      <option key={p.name} value={p.name} />
                    ))}
                  </datalist>
                  {systemPrinters.length === 0 && (
                    <p className="text-xs text-amber-600 mt-2">
                      لم يتم العثور على طابعات على الخادم. تأكد إن الخادم يعمل على
                      نفس جهاز الطابعة، أو اكتب اسمها بالأسفل.
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      عنوان IP للطابعة
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="192.168.1.50"
                      value={formData.ip_address || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, ip_address: e.target.value })
                      }
                      className="w-full p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      المنفذ
                    </label>
                    <input
                      type="number"
                      dir="ltr"
                      value={formData.port ?? 9100}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          port: Number(e.target.value) || 9100,
                        })
                      }
                      className="w-full p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white text-sm"
                    />
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active === 1}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      is_active: e.target.checked ? 1 : 0,
                    })
                  }
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <label
                  htmlFor="is_active"
                  className="text-sm font-medium text-slate-700"
                >
                  طابعة نشطة
                </label>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
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
};
