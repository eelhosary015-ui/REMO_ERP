import React, { useState, useEffect } from "react";
import { 
  X, 
  PackageCheck, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Boxes, 
  Layers, 
  FileText, 
  ShieldCheck,
  Building2
} from "lucide-react";
import { WarehouseTransfer, TransferItem } from "./TransferTypes";

interface TransferReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  transfer: WarehouseTransfer | null;
  onReceive: (id: number, data: any) => Promise<void>;
  onNotify: (msg: string, type?: "success" | "error" | "info") => void;
}

export const TransferReceiveModal: React.FC<TransferReceiveModalProps> = ({
  isOpen,
  onClose,
  transfer,
  onReceive,
  onNotify,
}) => {
  const [qcStatus, setQcStatus] = useState<string>("passed");
  const [qcNotes, setQcNotes] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [items, setItems] = useState<TransferItem[]>([]);

  useEffect(() => {
    if (transfer) {
      try {
        const parsed = typeof transfer.items === "string" ? JSON.parse(transfer.items) : (transfer.items || []);
        setItems(parsed.map((it: any) => {
          const dispatched = Number(it.dispatched_qty || it.approved_qty || it.requested_qty || it.quantity || 0);
          return {
            ...it,
            dispatched_qty: dispatched,
            received_qty: it.received_qty !== undefined ? it.received_qty : dispatched,
            damaged_qty: it.damaged_qty || 0,
            variance_qty: it.variance_qty || 0,
            target_location_code: it.target_location_code || "",
            qc_item_status: it.qc_item_status || "passed"
          };
        }));
      } catch {
        setItems([]);
      }
      setQcStatus(transfer.qc_status || "passed");
      setQcNotes(transfer.qc_notes || "");
      setNotes("");
    }
  }, [transfer]);

  if (!isOpen || !transfer) return null;

  const handleItemFieldChange = (index: number, field: keyof TransferItem, val: any) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: val };

    if (field === "received_qty" || field === "damaged_qty") {
      const dispatched = Number(item.dispatched_qty || 0);
      const received = Number(field === "received_qty" ? val : item.received_qty || 0);
      const damaged = Number(field === "damaged_qty" ? val : item.damaged_qty || 0);
      item.variance_qty = Number((dispatched - received - damaged).toFixed(3));
      
      if (damaged > 0) {
        item.qc_item_status = "damaged";
      } else if (item.variance_qty !== 0) {
        item.qc_item_status = "variance";
      } else {
        item.qc_item_status = "passed";
      }
    }

    updated[index] = item;
    setItems(updated);
  };

  const handleAutoFillAll = () => {
    const updated = items.map((it) => ({
      ...it,
      received_qty: it.dispatched_qty || 0,
      damaged_qty: 0,
      variance_qty: 0,
      qc_item_status: "passed",
    }));
    setItems(updated);
    onNotify("تم مطابقة واستلام جميع الكميات المشحونة بالكامل", "success");
  };

  const handleSubmit = async () => {
    // Check if received quantities are valid
    const hasNegative = items.some((it) => Number(it.received_qty) < 0 || Number(it.damaged_qty) < 0);
    if (hasNegative) {
      onNotify("لا يمكن إدخال كميات مستلمة أو تالفة سالبة", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      await onReceive(transfer.id, {
        received_items: items,
        qc_status: qcStatus,
        qc_notes: qcNotes,
        notes,
      });
      onClose();
    } catch (err: any) {
      onNotify(err.message || "فشل في تسجيل الاستلام وفحص الجودة", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalDispatched = items.reduce((s, it) => s + Number(it.dispatched_qty || 0), 0);
  const totalReceived = items.reduce((s, it) => s + Number(it.received_qty || 0), 0);
  const totalDamaged = items.reduce((s, it) => s + Number(it.damaged_qty || 0), 0);
  const totalVariance = items.reduce((s, it) => s + Number(it.variance_qty || 0), 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-sm overflow-y-auto" id="transfer-receive-modal">
      <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden my-auto text-right" dir="rtl">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-teal-500/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/20 text-teal-600 dark:text-teal-400">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                استلام وفحص الجودة والإيداع (Receive & QC): {transfer.transfer_number}
              </h2>
              <p className="text-xs text-muted-foreground">
                مطابقة الأصناف المستلمة، تسجيل الفروقات أو التوالف، وإيداع الرصيد بالمخزن المستهدف
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Metadata & Quick Action */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 bg-muted/40 rounded-xl border border-border">
            <div className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">المخزن المستلم: <strong className="text-foreground">{transfer.to_warehouse_name}</strong></span>
              <span className="text-muted-foreground">من: <strong className="text-foreground">{transfer.from_warehouse_name}</strong></span>
              {transfer.waybill_no && (
                <span className="text-muted-foreground">بوليصة: <strong className="font-mono text-foreground">{transfer.waybill_no}</strong></span>
              )}
            </div>

            <button
              type="button"
              id="btn-match-all-qty"
              onClick={handleAutoFillAll}
              className="px-3 py-1.5 bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              ✓ استلام كامل الكميات المشحونة
            </button>
          </div>

          {/* Items Receiving & QC Table */}
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <div className="px-4 py-2.5 bg-muted/50 border-b border-border flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">مطابقة الكميات وفحص الجودة لكل صنف</span>
              <div className="flex items-center gap-3 text-xs font-medium">
                <span className="text-muted-foreground">مشحون: <strong>{totalDispatched}</strong></span>
                <span className="text-emerald-600">مستلم: <strong>{totalReceived}</strong></span>
                {totalDamaged > 0 && <span className="text-rose-600">تالف: <strong>{totalDamaged}</strong></span>}
                {totalVariance !== 0 && <span className="text-amber-600">فروقات: <strong>{totalVariance}</strong></span>}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead>
                  <tr className="bg-muted/30 text-muted-foreground border-b border-border font-semibold">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">الصنف</th>
                    <th className="py-2.5 px-3 w-20 text-center">المشحون</th>
                    <th className="py-2.5 px-3 w-24 text-center">المستلم المقبول</th>
                    <th className="py-2.5 px-3 w-20 text-center">التالف</th>
                    <th className="py-2.5 px-3 w-20 text-center">العجز / الفرق</th>
                    <th className="py-2.5 px-3 min-w-[120px]">موقع الإيداع (Bin)</th>
                    <th className="py-2.5 px-3 min-w-[120px]">حالة الفحص</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item, idx) => {
                    const hasVariance = Number(item.variance_qty || 0) !== 0;
                    const hasDamage = Number(item.damaged_qty || 0) > 0;

                    return (
                      <tr key={idx} className={`hover:bg-muted/30 transition-colors ${hasDamage ? "bg-rose-500/5" : hasVariance ? "bg-amber-500/5" : ""}`}>
                        <td className="py-2.5 px-3 text-center text-muted-foreground font-mono">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <strong className="text-foreground block">{item.name}</strong>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span>كود: {item.code}</span>
                            {item.batch_number && <span>باتش: {item.batch_number}</span>}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-muted-foreground">
                          {item.dispatched_qty} {item.unit}
                        </td>

                        {/* Received Accepted Qty */}
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.received_qty}
                            onChange={(e) => handleItemFieldChange(idx, "received_qty", parseFloat(e.target.value) || 0)}
                            className="w-full py-1 px-2 text-center bg-background border border-border rounded text-xs font-bold font-mono text-emerald-600 focus:ring-1 focus:ring-primary"
                          />
                        </td>

                        {/* Damaged Qty */}
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.damaged_qty}
                            onChange={(e) => handleItemFieldChange(idx, "damaged_qty", parseFloat(e.target.value) || 0)}
                            className={`w-full py-1 px-2 text-center bg-background border rounded text-xs font-mono focus:ring-1 focus:ring-primary ${
                              hasDamage ? "border-rose-500 text-rose-600 font-bold" : "border-border text-muted-foreground"
                            }`}
                          />
                        </td>

                        {/* Variance Qty */}
                        <td className="py-2.5 px-3 text-center font-mono font-bold">
                          <span className={`${
                            Number(item.variance_qty || 0) > 0
                              ? "text-amber-600"
                              : Number(item.variance_qty || 0) < 0
                              ? "text-blue-600"
                              : "text-muted-foreground"
                          }`}>
                            {item.variance_qty}
                          </span>
                        </td>

                        {/* Put-Away Location (Bin) */}
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            placeholder="مثال: Z1-R2-S3"
                            value={item.target_location_code || ""}
                            onChange={(e) => handleItemFieldChange(idx, "target_location_code", e.target.value)}
                            className="w-full py-1 px-2 bg-background border border-border rounded text-[11px] font-mono"
                          />
                        </td>

                        {/* QC Status */}
                        <td className="py-2.5 px-3">
                          <select
                            value={item.qc_item_status || "passed"}
                            onChange={(e) => handleItemFieldChange(idx, "qc_item_status", e.target.value)}
                            className="w-full py-1 px-2 bg-background border border-border rounded text-[11px]"
                          >
                            <option value="passed">سليم مطابق (Pass)</option>
                            <option value="damaged">تالف جزئي (Damaged)</option>
                            <option value="variance">يوجد عجز (Shortage)</option>
                            <option value="quarantine">حجر وفحص إضافي</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* QC Inspection Summary & Put-Away Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 border border-border rounded-xl">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>النتيجة العامة لفحص الجودة (Overall QC)</span>
              </label>
              <select
                value={qcStatus}
                onChange={(e) => setQcStatus(e.target.value)}
                className="w-full py-2 px-3 bg-background border border-border rounded-lg text-xs font-medium text-foreground focus:ring-1 focus:ring-primary"
              >
                <option value="passed">اجتاز الفحص بالكامل (Accepted 100%)</option>
                <option value="passed_with_variance">مقبول مع تسجيل فروقات أو عجز</option>
                <option value="quarantine">عزل في مستودع الحجر الصحي (Quarantine)</option>
                <option value="rejected">مرفوض بالكامل لعدم المطابقة</option>
              </select>

              <textarea
                rows={2}
                value={qcNotes}
                onChange={(e) => setQcNotes(e.target.value)}
                placeholder="تقرير أو ملاحظات مسؤول الجودة..."
                className="w-full mt-2 py-1.5 px-3 bg-background border border-border rounded-lg text-xs text-foreground focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-primary" />
                <span>ملاحظات الاستلام والتخزين النهائي</span>
              </label>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ملاحظات أمين المخزن المستلم، تعليمات الإيداع، أو تفاصيل محضر الاستلام..."
                className="w-full py-2 px-3 bg-background border border-border rounded-lg text-xs text-foreground focus:ring-1 focus:ring-primary resize-none"
              />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/40">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 border border-border hover:bg-muted text-foreground rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            إلغاء
          </button>

          <button
            type="button"
            id="btn-confirm-receive-putaway"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <PackageCheck className="w-4 h-4" />
            <span>{isSubmitting ? "جاري الحفظ والإيداع..." : "تأكيد الاستلام وفحص الجودة وإيداع المخزون"}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
