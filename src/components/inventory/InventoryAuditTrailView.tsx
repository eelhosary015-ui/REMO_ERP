import React, { useState, useEffect } from "react";
import {
  History, Search, RefreshCw, Filter, ShieldCheck, User, Calendar
} from "lucide-react";

export const InventoryAuditTrailView: React.FC<{
  onNotify: (msg: string, type: "success" | "error") => void;
}> = ({ onNotify }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let url = `/api/inventory/audit-trail?`;
      if (entityFilter !== "all") url += `entity_type=${entityFilter}&`;
      if (actionFilter !== "all") url += `action=${actionFilter}&`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setLogs(data.audit_logs || []);
      }
    } catch (err) {
      onNotify("فشل تحميل سجل التدقيق", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [entityFilter, actionFilter]);

  const filteredLogs = logs.filter(l =>
    (l.details && l.details.toLowerCase().includes(search.toLowerCase())) ||
    (l.user_name && l.user_name.toLowerCase().includes(search.toLowerCase())) ||
    (l.entity_type && l.entity_type.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-100 rounded-xl text-slate-700">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">سجل التدقيق والمراقبة الشامل (Inventory Audit Trail)</h2>
            <p className="text-xs text-slate-500">تتبع غير قابل للتعديل لجميع العمليات، المستخدمين، التعديلات، والأوقات (Who, What, When)</p>
          </div>
        </div>

        <button
          onClick={fetchLogs}
          className="p-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              placeholder="بحث في تفاصيل السجل، اسم المستخدم..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>

          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700"
          >
            <option value="all">جميع الكيانات</option>
            <option value="warehouse">المخازن</option>
            <option value="warehouse_location">مواقع التخزين والأرفف</option>
            <option value="goods_receipt">سندات الاستلام (GRN)</option>
            <option value="material_request">طلبات وصرف المواد</option>
            <option value="stock_reservation">حجوزات المخزون</option>
            <option value="serial_numbers">الأرقام التسلسلية</option>
          </select>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700"
          >
            <option value="all">جميع الإجراءات</option>
            <option value="create">إنشاء (Create)</option>
            <option value="update">تعديل (Update)</option>
            <option value="post">ترحيل واعتماد (Post)</option>
            <option value="delete">حذف (Delete)</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-xs font-bold border-b border-slate-200">
                <th className="p-4">التاريخ والوقت</th>
                <th className="p-4">المستخدم</th>
                <th className="p-4">الكيان</th>
                <th className="p-4">نوع الإجراء</th>
                <th className="p-4">تفاصيل العملية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    لا توجد سجلات تدقيق مطابقة.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 font-mono text-xs text-slate-600">
                      {new Date(l.created_at).toLocaleString("ar-EG")}
                    </td>
                    <td className="p-4 font-bold text-slate-800 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" /> {l.user_name || "النظام"}
                    </td>
                    <td className="p-4">
                      <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                        {l.entity_type}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        l.action === 'create' ? 'bg-emerald-100 text-emerald-800' :
                        l.action === 'update' ? 'bg-blue-100 text-blue-800' :
                        l.action === 'post' ? 'bg-purple-100 text-purple-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {l.action}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-slate-700 leading-relaxed font-medium">
                      {l.details || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
