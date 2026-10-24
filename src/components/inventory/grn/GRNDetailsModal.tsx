import React, { useState } from "react";
import {
  FileCheck, ShieldCheck, MapPin, Printer, DollarSign,
  Truck, Clock, CheckCircle2, AlertTriangle, XCircle,
  Package, X, Download, FileText, Layers, Hash, Calendar,
  ArrowUpRight, Building2, User, ChevronRight, RotateCcw
} from "lucide-react";

interface GRNDetailsModalProps {
  data: any;
  onClose: () => void;
  onPost: (id: number) => void;
  onReverse: (id: number) => void;
  onOpenQc: (receipt: any) => void;
  onOpenPutaway: (receipt: any) => void;
  onNotify: (msg: string, type: "success" | "error" | "info") => void;
}

export const GRNDetailsModal: React.FC<GRNDetailsModalProps> = ({
  data,
  onClose,
  onPost,
  onReverse,
  onOpenQc,
  onOpenPutaway,
  onNotify
}) => {
  const [activeTab, setActiveTab] = useState<"overview" | "items" | "qc" | "accounting" | "putaway" | "audit">("overview");
  const [showReversePrompt, setShowReversePrompt] = useState(false);
  const [reverseReason, setReverseReason] = useState("");

  const gr = data?.goods_receipt || {};
  const items = data?.items || [];
  const qcRecords = data?.qc_records || [];
  const attachments = data?.attachments || [];
  const putawayLocations = data?.putaway_locations || [];
  const journalEntry = data?.journal_entry || null;
  const stockTransactions = data?.stock_transactions || [];
  const auditLogs = data?.audit_logs || [];

  const isPosted = Boolean(gr.is_posted);
  const isReversed = gr.status === "reversed";

  const handlePrint = () => {
    window.print();
  };

  const handleExecuteReverse = () => {
    if (!reverseReason.trim()) {
      onNotify("يرجى إدخال سبب عكس السند", "error");
      return;
    }
    onReverse(gr.id);
    setShowReversePrompt(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-100 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight">{gr.receipt_no}</h2>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                  gr.status === 'posted' ? 'bg-emerald-500 text-white' :
                  gr.status === 'reversed' ? 'bg-rose-500 text-white' :
                  gr.status === 'qc_approved' ? 'bg-blue-500 text-white' :
                  'bg-slate-700 text-slate-200'
                }`}>
                  {gr.status === 'posted' ? 'مرحل ومكتمل (Posted)' :
                   gr.status === 'reversed' ? 'معكوس وملغي (Reversed)' :
                   gr.status === 'qc_approved' ? 'معتمد جودة (QC Approved)' :
                   'مسودة / قيد المراجعة'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {gr.warehouse_name} | المورد: {gr.supplier_name || "مورد عام"} | {new Date(gr.date || gr.created_at).toLocaleDateString("ar-EG")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all"
            >
              <Printer className="w-4 h-4" /> طباعة السند
            </button>

            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2 overflow-x-auto">
            {[
              { id: "overview", label: "نظرة عامة والملخص" },
              { id: "items", label: `الأصناف والتشغيلات (${items.length})` },
              { id: "qc", label: `تقرير فحص الجودة (${qcRecords.length})` },
              { id: "putaway", label: `مواقع التخزين (${putawayLocations.length})` },
              { id: "accounting", label: "القيد المحاسبي والأثر المالي" },
              { id: "audit", label: "سجل التدقيق (Audit Log)" }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-xl transition-all ${
                  activeTab === tab.id
                    ? "bg-white text-emerald-700 shadow-sm border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            {!isPosted && !isReversed && (
              <>
                <button
                  onClick={() => onOpenQc(data)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-xl text-xs font-bold transition-all"
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> فحص الجودة
                </button>
                <button
                  onClick={() => onOpenPutaway(data)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-900 rounded-xl text-xs font-bold transition-all"
                >
                  <MapPin className="w-3.5 h-3.5" /> تسكين المواقع
                </button>
                <button
                  onClick={() => onPost(gr.id)}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> اعتماد وترحيل
                </button>
              </>
            )}

            {isPosted && !isReversed && (
              <button
                onClick={() => setShowReversePrompt(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" /> عكس السند (Reverse)
              </button>
            )}
          </div>
        </div>

        {/* Reverse Prompt Modal */}
        {showReversePrompt && (
          <div className="bg-rose-50 p-4 border-b border-rose-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-rose-900 font-bold">
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>تأكيد عكس السند: سيتم خصم الكميات من المخزون وإلغاء القيد المحاسبي بالكامل</span>
            </div>
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <input
                type="text"
                placeholder="سبب الإلغاء أو العكس..."
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-rose-300 rounded-xl text-xs"
              />
              <button
                onClick={handleExecuteReverse}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl whitespace-nowrap"
              >
                تأكيد العكس
              </button>
              <button
                onClick={() => setShowReversePrompt(false)}
                className="px-2.5 py-1.5 bg-slate-200 text-slate-700 font-bold rounded-xl"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Stepper Timeline */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                      ✓
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">إنشاء السند</span>
                      <span className="text-[10px] text-slate-500">{new Date(gr.created_at).toLocaleString("ar-EG")}</span>
                    </div>
                  </div>

                  <div className="flex-1 h-0.5 bg-slate-200 mx-3"></div>

                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      gr.qc_status === 'passed' || gr.qc_status === 'partial' ? 'bg-emerald-600 text-white' :
                      gr.qc_status === 'failed' ? 'bg-rose-600 text-white' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {gr.qc_status === 'passed' ? '✓' : '!'}
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">فحص الجودة (QC)</span>
                      <span className="text-[10px] text-slate-500">{gr.qc_status || "بانتظار الفحص"}</span>
                    </div>
                  </div>

                  <div className="flex-1 h-0.5 bg-slate-200 mx-3"></div>

                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      isPosted ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {isPosted ? '✓' : '3'}
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">الترحيل للأرصدة والقيود</span>
                      <span className="text-[10px] text-slate-500">{isPosted ? "مرحل ومثبت" : "بانتظار الاعتماد"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Header Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-slate-500 block mb-1">المخزن المستلم</span>
                  <span className="font-bold text-slate-900 text-sm block">{gr.warehouse_name}</span>
                  <span className="text-[10px] text-slate-500">كود: {gr.warehouse_code || gr.warehouse_id}</span>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-slate-500 block mb-1">المورد</span>
                  <span className="font-bold text-slate-900 text-sm block">{gr.supplier_name || "مورد نقدي"}</span>
                  <span className="text-[10px] text-slate-500">فاتورة: {gr.supplier_invoice_no || "غير محددة"}</span>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-slate-500 block mb-1">صافي قيمة البضاعة</span>
                  <span className="font-mono font-bold text-emerald-600 text-sm block">
                    {Number(gr.net_amount || gr.total_amount || 0).toLocaleString()} ج.م
                  </span>
                  <span className="text-[10px] text-slate-500">ضريبة: {Number(gr.tax_amount || 0).toLocaleString()} ج.م</span>
                </div>

                <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200">
                  <span className="text-emerald-800 block mb-1 font-bold">التكلفة الإجمالية المحملة (Landed)</span>
                  <span className="font-mono font-black text-emerald-700 text-sm block">
                    {Number(gr.total_landed_cost || gr.net_amount || gr.total_amount || 0).toLocaleString()} ج.م
                  </span>
                  <span className="text-[10px] text-emerald-600">مصاريف: {Number(gr.freight_charges || 0) + Number(gr.customs_charges || 0)} ج.م</span>
                </div>
              </div>

              {/* Landed Cost Breakdown */}
              {(gr.freight_charges > 0 || gr.customs_charges > 0 || gr.other_charges > 0) && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    تفاصيل التكاليف الإضافية (Landed Cost Elements)
                  </h4>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-2 bg-white rounded-xl border border-slate-200">
                      <span className="text-slate-500 text-[10px] block">مصاريف الشحن</span>
                      <span className="font-mono font-bold text-slate-800">{Number(gr.freight_charges || 0).toLocaleString()} ج.م</span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-slate-200">
                      <span className="text-slate-500 text-[10px] block">الرسوم الجمركية</span>
                      <span className="font-mono font-bold text-slate-800">{Number(gr.customs_charges || 0).toLocaleString()} ج.م</span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-slate-200">
                      <span className="text-slate-500 text-[10px] block">مصاريف أخرى</span>
                      <span className="font-mono font-bold text-slate-800">{Number(gr.other_charges || 0).toLocaleString()} ج.م</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {gr.notes && (
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-slate-700">
                  <span className="font-bold text-slate-900 block mb-1">ملاحظات السند:</span>
                  <p className="whitespace-pre-wrap">{gr.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ITEMS */}
          {activeTab === "items" && (
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-3">الصنف والكود</th>
                    <th className="p-3 text-center">المستلم</th>
                    <th className="p-3 text-center">المقبول (QC)</th>
                    <th className="p-3 text-center">سعر الشراء</th>
                    <th className="p-3 text-center">التكلفة المحملة</th>
                    <th className="p-3">التشغيلة والصلاحية</th>
                    <th className="p-3">الموقع</th>
                    <th className="p-3 text-center">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {items.map((it: any) => (
                    <tr key={it.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3">
                        <span className="font-bold text-slate-900 block">{it.item_name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{it.item_code}</span>
                      </td>
                      <td className="p-3 text-center font-mono font-bold">{it.received_qty} {it.base_unit || ""}</td>
                      <td className="p-3 text-center font-mono font-bold text-emerald-700">{it.accepted_qty}</td>
                      <td className="p-3 text-center font-mono">{Number(it.unit_price || it.unit_cost || 0).toLocaleString()} ج.م</td>
                      <td className="p-3 text-center font-mono font-bold text-emerald-700">
                        {Number(it.landed_unit_cost || it.unit_cost || 0).toFixed(2)} ج.م
                      </td>
                      <td className="p-3 font-mono text-[11px]">
                        <div>{it.batch_number || "-"}</div>
                        {it.expiry_date && <div className="text-slate-500 text-[10px]">صلاحية: {new Date(it.expiry_date).toLocaleDateString("ar-EG")}</div>}
                      </td>
                      <td className="p-3 text-slate-700 font-medium">{it.location_name || it.location_code || "رئيسي"}</td>
                      <td className="p-3 text-center font-mono font-bold text-slate-900">
                        {Number(it.total_cost || it.total_landed_cost || 0).toLocaleString()} ج.م
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: QC REPORT */}
          {activeTab === "qc" && (
            <div className="space-y-4">
              {qcRecords.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400">
                  لم يتم تسجيل نتائج فحص جودة تفصيلية لهذا السند بعد.
                </div>
              ) : (
                qcRecords.map((qc: any, idx: number) => (
                  <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-600" />
                        <span className="font-bold text-slate-900">فحص فني #{qc.id} | المفتش: {qc.inspector_name || "فاحص الجودة"}</span>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        qc.result === 'passed' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {qc.result === 'passed' ? 'مطابق ومعتمد' : 'مرفوض / غير مطابق'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 block">درجة الحرارة:</span>
                        <span className="font-bold text-slate-800 font-mono">{qc.temperature ? `${qc.temperature} °C` : "-"}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">تقييم النظافة:</span>
                        <span className="font-bold text-slate-800 font-mono">{qc.hygiene_score || "-"} / 100</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">حالة التغليف:</span>
                        <span className="font-bold text-slate-800">{qc.packaging_condition || "سليمة"}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">المظهر الخارجي:</span>
                        <span className="font-bold text-slate-800">{qc.physical_condition || "سليم"}</span>
                      </div>
                    </div>

                    {qc.notes && (
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-slate-700">
                        <span className="font-bold text-slate-800 block text-[11px] mb-0.5">ملاحظات الفاحص:</span>
                        <p>{qc.notes}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 4: PUTAWAY */}
          {activeTab === "putaway" && (
            <div className="space-y-3">
              {putawayLocations.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400">
                  تم تخزين الأصناف في الموقع الافتراضي للمخزن.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="p-3">الصنف</th>
                        <th className="p-3">كود الموقع / الرف</th>
                        <th className="p-3">اسم الموقع</th>
                        <th className="p-3 text-center">الكمية المسكنة</th>
                        <th className="p-3">رقم التشغيلة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {putawayLocations.map((p: any, idx: number) => (
                        <tr key={idx}>
                          <td className="p-3 font-bold text-slate-900">{p.item_name}</td>
                          <td className="p-3 font-mono font-bold text-blue-700">{p.location_code}</td>
                          <td className="p-3 text-slate-700">{p.location_name}</td>
                          <td className="p-3 text-center font-mono font-bold">{p.quantity}</td>
                          <td className="p-3 font-mono">{p.batch_number || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: ACCOUNTING */}
          {activeTab === "accounting" && (
            <div className="space-y-4">
              {journalEntry ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div>
                      <span className="font-bold text-slate-900 block">قيد اليومية المحاسبي الآلي #{journalEntry.id}</span>
                      <span className="text-[10px] text-slate-500">مرجع: {journalEntry.reference} | التاريخ: {journalEntry.date}</span>
                    </div>
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-xs">
                      مرحل بالدفاتر (Posted)
                    </span>
                  </div>

                  <table className="w-full text-right border-collapse text-xs bg-white rounded-xl overflow-hidden border border-slate-200">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="p-2.5">رقم الحساب</th>
                        <th className="p-2.5">اسم الحساب الدفتري</th>
                        <th className="p-2.5 text-center">مدين (Debit)</th>
                        <th className="p-2.5 text-center">دائن (Credit)</th>
                        <th className="p-2.5">البيان والشرح</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {journalEntry.lines?.map((line: any, lIdx: number) => (
                        <tr key={lIdx}>
                          <td className="p-2.5 text-slate-600">{line.account_code || line.account_id}</td>
                          <td className="p-2.5 font-bold font-sans text-slate-900">{line.account_name || "حساب المخزون"}</td>
                          <td className="p-2.5 text-center font-bold text-emerald-700">
                            {Number(line.debit) > 0 ? Number(line.debit).toLocaleString() + " ج.م" : "-"}
                          </td>
                          <td className="p-2.5 text-center font-bold text-slate-800">
                            {Number(line.credit) > 0 ? Number(line.credit).toLocaleString() + " ج.م" : "-"}
                          </td>
                          <td className="p-2.5 font-sans text-slate-600 text-[11px]">{line.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400">
                  لم يتم ترحيل السند محاسبياً بعد. اضغط "اعتماد وترحيل" لإنشاء القيد وتحديث شجرة الحسابات.
                </div>
              )}
            </div>
          )}

          {/* TAB 6: AUDIT TRAIL */}
          {activeTab === "audit" && (
            <div className="space-y-2">
              {auditLogs.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400">
                  لا توجد سجلات تدقيق سابقة.
                </div>
              ) : (
                auditLogs.map((log: any, idx: number) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <div>
                        <span className="font-bold text-slate-800 block">{log.details || log.action}</span>
                        <span className="text-[10px] text-slate-500">المستخدم: {log.user_name} | {log.ip_address}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(log.created_at).toLocaleString("ar-EG")}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
