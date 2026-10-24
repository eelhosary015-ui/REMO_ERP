import React, { useState } from "react";
import {
  ShieldCheck, AlertTriangle, XCircle, CheckCircle2,
  Thermometer, Award, Package, Clock, Check, X, FileText,
  UserCheck, HelpCircle, ArrowRight
} from "lucide-react";
import { apiFetch } from "../../../utils/api";

interface GRNQCModalProps {
  receipt: any;
  onClose: () => void;
  onSuccess: () => void;
  onNotify: (msg: string, type: "success" | "error" | "info") => void;
}

export const GRNQCModal: React.FC<GRNQCModalProps> = ({
  receipt,
  onClose,
  onSuccess,
  onNotify
}) => {
  const [templateType, setTemplateType] = useState<string>("food_temperature");
  const [inspectorName, setInspectorName] = useState(localStorage.getItem("userName") || "فاحص الجودة المعتمد");
  const [overallResult, setOverallResult] = useState<string>("passed");
  const [temperature, setTemperature] = useState<number>(4.0);
  const [hygieneScore, setHygieneScore] = useState<number>(95);
  const [packagingCondition, setPackagingCondition] = useState<string>("good");
  const [physicalCondition, setPhysicalCondition] = useState<string>("intact");
  const [qcNotes, setQcNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Item results state
  const [itemResults, setItemResults] = useState<any[]>(
    (receipt.items || []).map((it: any) => ({
      item_id: it.id,
      item_name: it.item_name,
      item_code: it.item_code,
      received_qty: Number(it.received_qty || 0),
      accepted_qty: Number(it.received_qty || 0),
      rejected_qty: 0,
      quarantine_qty: 0,
      qc_status: "passed",
      sample_size: Math.min(5, Number(it.received_qty || 1)),
      defects_count: 0,
      rejection_reason: "",
      notes: ""
    }))
  );

  const handleItemQtyChange = (index: number, field: "accepted_qty" | "rejected_qty" | "quarantine_qty", val: number) => {
    setItemResults(prev => {
      const updated = [...prev];
      const target = { ...updated[index] };
      const received = target.received_qty;

      target[field] = Math.max(0, val);

      // Auto balance
      if (field === "accepted_qty") {
        const remainder = Math.max(0, received - target.accepted_qty);
        target.rejected_qty = remainder;
        target.quarantine_qty = 0;
      } else if (field === "rejected_qty") {
        const remainder = Math.max(0, received - target.rejected_qty);
        target.accepted_qty = remainder;
        target.quarantine_qty = 0;
      } else if (field === "quarantine_qty") {
        const remainder = Math.max(0, received - target.quarantine_qty);
        target.accepted_qty = remainder;
        target.rejected_qty = 0;
      }

      // Determine item status
      if (target.accepted_qty === received) target.qc_status = "passed";
      else if (target.rejected_qty === received) target.qc_status = "failed";
      else if (target.quarantine_qty === received) target.qc_status = "quarantine";
      else target.qc_status = "partial";

      updated[index] = target;
      return updated;
    });
  };

  const handleSubmitQC = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        template_type: templateType,
        inspector_name: inspectorName,
        overall_result: overallResult,
        temperature: Number(temperature),
        hygiene_score: Number(hygieneScore),
        packaging_condition: packagingCondition,
        physical_condition: physicalCondition,
        qc_notes: qcNotes,
        items_results: itemResults
      };

      const res = await apiFetch(`/api/goods-receipts/${receipt.goods_receipt.id}/qc-inspect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        onNotify(`تم تسجيل نتيجة فحص الجودة (${data.qc_status}) بنجاح`, "success");
        onSuccess();
        onClose();
      } else {
        onNotify(data.error || "فشل تسجيل فحص الجودة", "error");
      }
    } catch (err: any) {
      onNotify("خطأ أثناء حفظ تقرير فحص الجودة", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Accept All
  const handleAcceptAll = () => {
    setItemResults(prev =>
      prev.map(it => ({
        ...it,
        accepted_qty: it.received_qty,
        rejected_qty: 0,
        quarantine_qty: 0,
        qc_status: "passed",
        rejection_reason: ""
      }))
    );
    setOverallResult("passed");
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-100 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">إجراء فحص الجودة والاستلام الفني (QC Inspection)</h2>
              <p className="text-xs text-slate-300">
                سند استلام #{receipt.goods_receipt.receipt_no} | المورد: {receipt.goods_receipt.supplier_name || "مورد عام"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmitQC} className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* General Inspection Parameters */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-600" />
                المعايير البيئية والظاهرية للشحنة
              </h3>

              <button
                type="button"
                onClick={handleAcceptAll}
                className="flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-bold hover:bg-emerald-200 transition-colors"
              >
                <Check className="w-3.5 h-3.5" /> قبول ومطابقة كافة الأصناف
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">فئة الفحص والنموذج</label>
                <select
                  value={templateType}
                  onChange={(e) => setTemplateType(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                >
                  <option value="food_temperature">أغذية ومشروبات (سلسلة التبريد)</option>
                  <option value="raw_materials">خامات وتعبئة وتغليف</option>
                  <option value="electronics">أجهزة ومعدات إلكترونية</option>
                  <option value="general">فحص عام وكميات</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">درجة الحرارة المقاسة (°C)</label>
                <div className="relative">
                  <Thermometer className="w-3.5 h-3.5 text-blue-500 absolute left-2.5 top-2.5" />
                  <input
                    type="number"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-mono font-bold text-slate-800"
                    placeholder="4.0"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">تقييم النظافة والسلامة (1-100)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={hygieneScore}
                  onChange={(e) => setHygieneScore(parseInt(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-mono font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم مسؤول فحص الجودة *</label>
                <input
                  type="text"
                  value={inspectorName}
                  onChange={(e) => setInspectorName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">حالة التغليف والعبوات</label>
                <select
                  value={packagingCondition}
                  onChange={(e) => setPackagingCondition(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-medium"
                >
                  <option value="good">سليمة ومغلقة بإحكام (Good)</option>
                  <option value="minor_damage">تمزق سطحي طفيف (Minor)</option>
                  <option value="severely_damaged">تلف شديد في الكراتين (Damaged)</option>
                  <option value="broken_seal">أختام مكسورة (Broken Seal)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الحالة الفيزيائية والمظهر</label>
                <select
                  value={physicalCondition}
                  onChange={(e) => setPhysicalCondition(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-medium"
                >
                  <option value="intact">مطابق وسليم 100% (Intact)</option>
                  <option value="crushed">مهشم أو مضغوط (Crushed)</option>
                  <option value="leaking">تسريب سوائل (Leaking)</option>
                  <option value="color_change">تغير باللون أو الرائحة</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">القرار الكلي للفحص (Overall Result)</label>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setOverallResult("passed")}
                    className={`py-1.5 rounded-xl font-bold text-center border transition-all ${
                      overallResult === "passed" ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" : "bg-white text-slate-700 border-slate-200"
                    }`}
                  >
                    مطابق (Passed)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverallResult("quarantine")}
                    className={`py-1.5 rounded-xl font-bold text-center border transition-all ${
                      overallResult === "quarantine" ? "bg-amber-600 text-white border-amber-600 shadow-sm" : "bg-white text-slate-700 border-slate-200"
                    }`}
                  >
                    حجر صحي
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverallResult("partial")}
                    className={`py-1.5 rounded-xl font-bold text-center border transition-all ${
                      overallResult === "partial" ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-white text-slate-700 border-slate-200"
                    }`}
                  >
                    قبول جزئي
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverallResult("failed")}
                    className={`py-1.5 rounded-xl font-bold text-center border transition-all ${
                      overallResult === "failed" ? "bg-rose-600 text-white border-rose-600 shadow-sm" : "bg-white text-slate-700 border-slate-200"
                    }`}
                  >
                    مرفوض (Failed)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Item-by-item inspection Table */}
          <div className="space-y-3">
            <h3 className="font-black text-slate-900 flex items-center justify-between">
              <span>فحص ومطابقة الأصناف المستلمة وتوزيع الكميات</span>
              <span className="text-[11px] text-slate-500 font-normal">
                حدد الكميات المقبولة للمخزن والكميات المرفوعة للحجر أو المرفوضة
              </span>
            </h3>

            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                    <th className="p-3">الصنف والكود</th>
                    <th className="p-3 text-center">الكمية المستلمة</th>
                    <th className="p-3 text-center">المقبول (Pass)</th>
                    <th className="p-3 text-center">حجر صحي (Quarantine)</th>
                    <th className="p-3 text-center">المرفوض (Reject)</th>
                    <th className="p-3">سبب الرفض / الملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {itemResults.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3">
                        <span className="font-bold text-slate-900 block">{item.item_name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{item.item_code}</span>
                      </td>

                      <td className="p-3 text-center font-mono font-bold text-slate-700">
                        {item.received_qty}
                      </td>

                      <td className="p-3 text-center">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max={item.received_qty}
                          value={item.accepted_qty}
                          onChange={(e) => handleItemQtyChange(idx, "accepted_qty", parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 bg-emerald-50 border border-emerald-300 rounded-lg text-center font-mono font-bold text-emerald-800"
                        />
                      </td>

                      <td className="p-3 text-center">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max={item.received_qty}
                          value={item.quarantine_qty}
                          onChange={(e) => handleItemQtyChange(idx, "quarantine_qty", parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 bg-amber-50 border border-amber-300 rounded-lg text-center font-mono font-bold text-amber-800"
                        />
                      </td>

                      <td className="p-3 text-center">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max={item.received_qty}
                          value={item.rejected_qty}
                          onChange={(e) => handleItemQtyChange(idx, "rejected_qty", parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 bg-rose-50 border border-rose-300 rounded-lg text-center font-mono font-bold text-rose-800"
                        />
                      </td>

                      <td className="p-3">
                        {item.rejected_qty > 0 || item.quarantine_qty > 0 ? (
                          <select
                            value={item.rejection_reason}
                            onChange={(e) => {
                              const updated = [...itemResults];
                              updated[idx].rejection_reason = e.target.value;
                              setItemResults(updated);
                            }}
                            className="w-full px-2 py-1 bg-rose-50 border border-rose-200 rounded-lg text-[11px] font-bold text-rose-900"
                          >
                            <option value="">-- اختر سبب عدم المطابقة --</option>
                            <option value="تالف / كسر بالعبوات">تالف / كسر بالعبوات</option>
                            <option value="انتهاء أو قرب الصلاحية">انتهاء أو قرب الصلاحية</option>
                            <option value="مخالف للمواصفات القياسية">مخالف للمواصفات القياسية</option>
                            <option value="عدم مطابقة درجة الحرارة المطلوبة">عدم مطابقة درجة الحرارة</option>
                            <option value="تلوث أو رطوبة زائدة">تلوث أو رطوبة زائدة</option>
                            <option value="عجز في الأوزان الفعلية">عجز في الأوزان الفعلية</option>
                          </select>
                        ) : (
                          <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> مطابق بالكامل
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">ملاحظات وتوصيات الفحص الفني</label>
            <textarea
              rows={2}
              value={qcNotes}
              onChange={(e) => setQcNotes(e.target.value)}
              placeholder="توصيات الاستخدام، تعليمات الحجر الصحي، أو ملاحظات للمورد..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-[0.98]"
            >
              <ShieldCheck className="w-4 h-4" />
              {submitting ? "جاري الحفظ..." : "اعتماد وتسجيل نتائج الفحص"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
