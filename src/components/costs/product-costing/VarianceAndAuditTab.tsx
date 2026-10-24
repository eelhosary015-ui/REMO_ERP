import React from 'react';
import { 
  GitBranch, 
  CheckCircle2, 
  History, 
  FileText, 
  ShieldCheck, 
  Clock, 
  ArrowUpDown, 
  AlertCircle,
  Eye
} from 'lucide-react';
import { CostVersion, VarianceAnalysis, AuditLogItem } from './types';
import { pageRows, PaginationBar, usePaginationState } from "../../PaginationBar";

interface VarianceAndAuditTabProps {
  versions: CostVersion[];
  variance: VarianceAnalysis;
  auditTrail: AuditLogItem[];
  onSelectVersion: (version: CostVersion) => void;
}

export const VarianceAndAuditTab: React.FC<VarianceAndAuditTabProps> = ({
  versions,
  variance,
  auditTrail,
  onSelectVersion
}) => {  const pgn1 = usePaginationState();
  const pgn2 = usePaginationState();

  return (
    <div className="space-y-6">
      
      {/* 1. Cost Versions History */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">سجل إصدارات التكلفة (Cost Versions & History)</h3>
              <p className="text-xs font-bold text-slate-400">إدارة ومراجعة الإصدارات المعتمدة والمسودات السابقة لبطاقة التكلفة</p>
            </div>
          </div>
          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
            {versions.length} إصدارات مسجلة
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-y border-slate-200 font-bold">
                <th className="py-2.5 px-3">رقم الإصدار</th>
                <th className="py-2.5 px-3">عنوان الإصدار والتعديل</th>
                <th className="py-2.5 px-2">الحالة</th>
                <th className="py-2.5 px-3">تكلفة الوحدة</th>
                <th className="py-2.5 px-3">سعر البيع</th>
                <th className="py-2.5 px-2">الهامش %</th>
                <th className="py-2.5 px-3">تاريخ التفعيل</th>
                <th className="py-2.5 px-3">أنشئ بواسطة</th>
                <th className="py-2.5 px-3">معتمد من</th>
                <th className="py-2.5 px-2 text-center">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {pageRows(versions, pgn1).map((ver) => (
                <tr key={ver.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-3 font-mono font-black text-indigo-700">{ver.version}</td>
                  <td className="py-3 px-3 font-bold text-slate-900">
                    {ver.version_name}
                    {ver.notes && <span className="block text-[10px] text-slate-400 font-normal mt-0.5">{ver.notes}</span>}
                  </td>
                  <td className="py-3 px-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      ver.status === 'approved' 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {ver.status_label}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-900">{ver.unit_cost.toFixed(2)} ج.م.</td>
                  <td className="py-3 px-3 font-bold text-emerald-600">{ver.selling_price.toFixed(2)} ج.م.</td>
                  <td className="py-3 px-2 font-bold">{ver.margin_pct}%</td>
                  <td className="py-3 px-3 text-slate-500">{ver.effective_date}</td>
                  <td className="py-3 px-3 text-slate-600">{ver.created_by}</td>
                  <td className="py-3 px-3 text-slate-600">
                    {ver.approved_by ? (
                      <span className="flex items-center gap-1 text-emerald-700 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {ver.approved_by}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <button
                      onClick={() => onSelectVersion(ver)}
                      className="px-2 py-1 text-[11px] font-bold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition"
                    >
                      عرض
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationBar page={pgn1.page} pageSize={pgn1.pageSize} total={(versions).length} onPage={pgn1.setPage} onPageSize={pgn1.setPageSize} />
        </div>
      </div>

      {/* 2. Standard vs Actual Variance Analysis */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <ArrowUpDown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">تحليل الانحرافات (Standard vs Actual Variance)</h3>
              <p className="text-xs font-bold text-slate-400">مقارنة التكلفة المعيارية المخططة بالتكلفة الفعلية وتحديد أسباب الفروق</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 block">صافي الانحراف</span>
              <span className={`text-sm font-black ${variance.variance_amount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {variance.variance_amount > 0 ? `+${variance.variance_amount.toFixed(2)}` : variance.variance_amount.toFixed(2)} ج.م. ({variance.variance_pct}%)
              </span>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
              variance.variance_amount > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
            }`}>
              {variance.variance_type}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-y border-slate-200 font-bold">
                <th className="py-2.5 px-3">بند التكلفة</th>
                <th className="py-2.5 px-3">التكلفة المعيارية (Standard)</th>
                <th className="py-2.5 px-3">التكلفة الفعلية (Actual)</th>
                <th className="py-2.5 px-3">قيمة الانحراف</th>
                <th className="py-2.5 px-4">السبب والتحليل المالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {pageRows(variance.breakdown, pgn2).map((item, idx) => {
                const diff = Number((item.actual - item.standard).toFixed(2));
                return (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-bold text-slate-900">{item.category}</td>
                    <td className="py-2.5 px-3 font-mono">{item.standard.toFixed(2)} ج.م.</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{item.actual.toFixed(2)} ج.م.</td>
                    <td className="py-2.5 px-3">
                      <span className={`font-mono font-bold ${diff > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {diff > 0 ? `+${diff}` : diff} ج.م.
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 font-medium">{item.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <PaginationBar page={pgn2.page} pageSize={pgn2.pageSize} total={(variance.breakdown).length} onPage={pgn2.setPage} onPageSize={pgn2.setPageSize} />
        </div>
      </div>

      {/* 3. Audit Trail & Activity Logs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <div className="p-2 bg-slate-100 text-slate-600 rounded-xl">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">سجل الرقابة والتتبع المالي (Audit Trail)</h3>
            <p className="text-xs font-bold text-slate-400">توثيق جميع التغييرات، تعديلات الأسعار، واعتمادات التكاليف بالوقت والمستخدم</p>
          </div>
        </div>

        <div className="space-y-2.5">
          {auditTrail.map((log) => (
            <div key={log.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <strong className="text-slate-900">{log.action}</strong>
                  <span className="text-slate-400">بواسطة: <strong className="text-slate-700">{log.user}</strong></span>
                  <span className="text-[10px] text-slate-400 bg-slate-200/60 px-1.5 py-0.5 rounded">{log.date}</span>
                </div>
                <div className="text-slate-600">
                  <span>تم تعديل <strong className="text-slate-800">{log.field}</strong> من <span className="line-through text-slate-400">{log.old_value}</span> إلى <span className="font-bold text-indigo-700">{log.new_value}</span></span>
                </div>
                <div className="text-[11px] text-slate-500 italic">
                  السبب: {log.reason}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
