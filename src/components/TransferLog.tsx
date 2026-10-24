import React, { useState, useEffect } from "react";
import { ArrowRightLeft, Printer, FileDown, X } from "lucide-react";
import { api } from "../utils/api";
import { downloadDataAsPdf } from "../utils/pdfExport";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function TransferLog({ onBack }: { onBack: () => void }) {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransfers();
  }, []);

  const fetchTransfers = async () => {
    try {
      const res = await api.get("/api/inventory/stock-entries");
      if (res.ok) {
        const data = await res.json();
        // Filter for "Material Transfer"
        setTransfers(data.filter((e: any) => e.type === "Material Transfer"));
      }
    } catch (e) {
      console.error("Failed to fetch transfers", e);
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = async () => {
    const headers = ["التاريخ", "رقم الحركة", "المستخدم", "المصدر", "المستقبل", "الحالة", "ملاحظات"];
    const rows = transfers.map((t) => [
      new Date(t.date).toLocaleDateString("ar-EG"),
      `STE-${t.id.toString().padStart(4, "0")}`,
      t.user_name || "غير محدد",
      t.from_warehouse_name || "-",
      t.to_warehouse_name || "-",
      t.status || "ناجح",
      t.notes || "-",
    ]);
    await downloadDataAsPdf(headers, rows, "سجل_ترحيل_الموارد", "سجل ترحيل الموارد");
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100 print:hidden">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-50 rounded-2xl">
            <ArrowRightLeft className="w-8 h-8 text-amber-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">سجل ترحيل الموارد</h2>
            <p className="text-slate-500">عرض ومتابعة كافة تحويلات المخزون الداخلي</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportPDF}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-semibold hover:bg-blue-700 transition-all shadow-sm"
          >
            <FileDown className="w-5 h-5" />
            تصدير PDF
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-700 rounded-2xl font-semibold hover:bg-slate-200 transition-all"
          >
            <Printer className="w-5 h-5" />
            طباعة
          </button>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-semibold hover:bg-slate-50 transition-all"
          >
            إغلاق
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-6 font-bold text-slate-600">التاريخ</th>
              <th className="p-6 font-bold text-slate-600">رقم الحركة</th>
              <th className="p-6 font-bold text-slate-600">المستخدم</th>
              <th className="p-6 font-bold text-slate-600">المصدر</th>
              <th className="p-6 font-bold text-slate-600">المستقبل</th>
              <th className="p-6 font-bold text-slate-600">الحالة</th>
              <th className="p-6 font-bold text-slate-600">ملاحظات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transfers.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-6 text-slate-600">
                  {new Date(t.date).toLocaleDateString("ar-EG")}
                </td>
                <td className="p-6 font-mono font-bold text-slate-700">
                  STE-{t.id.toString().padStart(4, "0")}
                </td>
                <td className="p-6 text-slate-800">{t.user_name || "غير محدد"}</td>
                <td className="p-6 font-bold text-slate-800">
                  {t.from_warehouse_name || "-"}
                </td>
                <td className="p-6 font-bold text-slate-800">
                  {t.to_warehouse_name || "-"}
                </td>
                <td className="p-6">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    (t.status || "ناجح") === "ناجح" 
                      ? "bg-emerald-100 text-emerald-700" 
                      : "bg-amber-100 text-amber-700"
                  }`}>
                    {t.status || "ناجح"}
                  </span>
                </td>
                <td className="p-6 text-slate-600">{t.notes || "-"}</td>
              </tr>
            ))}
            {transfers.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="p-12 text-center text-slate-500">
                  لا توجد حركات ترحيل مسجلة حالياً.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

