import React, { useState } from "react";
import { 
  X, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Building2, 
  Boxes, 
  Calendar, 
  FileText,
  Clock
} from "lucide-react";
import { WarehouseTransfer, TransferItem } from "./TransferTypes";

interface TransferApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  transfer: WarehouseTransfer | null;
  onApprove: (id: number, data: { notes: string; items: TransferItem[] }) => Promise<void>;
  onReject: (id: number, reason: string) => Promise<void>;
  onNotify: (msg: string, type?: "success" | "error" | "info") => void;
}

export const TransferApprovalModal: React.FC<TransferApprovalModalProps> = ({
  isOpen,
  onClose,
  transfer,
  onApprove,
  onReject,
  onNotify,
}) => {
  const [notes, setNotes] = useState<string>("");
  const [rejectReason, setRejectReason] = useState<string>("");
  const [isRejecting, setIsRejecting] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [items, setItems] = useState<TransferItem[]>(() => {
    if (!transfer) return [];
    try {
      const parsed = typeof transfer.items === "string" ? JSON.parse(transfer.items) : (transfer.items || []);
      return parsed.map((it: any) => ({
        ...it,
        approved_qty: it.approved_qty !== undefined ? it.approved_qty : (it.requested_qty || it.quantity || 0)
      }));
    } catch {
      return [];
    }
  });

  // Re-sync items when transfer changes
  React.useEffect(() => {
    if (transfer) {
      try {
        const parsed = typeof transfer.items === "string" ? JSON.parse(transfer.items) : (transfer.items || []);
        setItems(parsed.map((it: any) => ({
          ...it,
          approved_qty: it.approved_qty !== undefined ? it.approved_qty : (it.requested_qty || it.quantity || 0)
        })));
      } catch {
        setItems([]);
      }
      setNotes("");
      setRejectReason("");
      setIsRejecting(false);
    }
  }, [transfer]);

  if (!isOpen || !transfer) return null;

  const handleQtyChange = (index: number, val: number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], approved_qty: val };
    setItems(updated);
  };

  const handleApproveSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onApprove(transfer.id, {
        notes,
        items,
      });
      onClose();
    } catch (err: any) {
      onNotify(err.message || "فشل في اعتماد التحويل", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim()) {
      onNotify("يرجى كتابة سبب رفض التحويل", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      await onReject(transfer.id, rejectReason);
      onClose();
    } catch (err: any) {
      onNotify(err.message || "فشل في رفض التحويل", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalRequested = items.reduce((s, it) => s + Number(it.requested_qty || 0), 0);
  const totalApproved = items.reduce((s, it) => s + Number(it.approved_qty || 0), 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-sm overflow-y-auto" id="transfer-approval-modal">
      <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto text-right" dir="rtl">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-amber-50 dark:bg-amber-950/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                مراجعة واعتماد طلب التحويل: {transfer.transfer_number}
              </h2>
              <p className="text-xs text-muted-foreground">
                يرجى مراجعة الكميات والأرصدة قبل الاعتماد النهائي وتجهيز البضاعة للصرف
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
          
          {/* Transfer Metadata Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-muted/40 rounded-xl border border-border">
            <div>
              <span className="text-[11px] text-muted-foreground block">المخزن المصدر</span>
              <strong className="text-xs text-foreground block mt-0.5">
                {transfer.from_warehouse_name || `مخزن #${transfer.from_warehouse_id}`}
              </strong>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground block">المخزن المستهدف</span>
              <strong className="text-xs text-foreground block mt-0.5">
                {transfer.to_warehouse_name || `مخزن #${transfer.to_warehouse_id}`}
              </strong>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground block">طالب التحويل</span>
              <strong className="text-xs text-foreground block mt-0.5 font-mono">
                {transfer.user || "admin"}
              </strong>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground block">تاريخ الطلب</span>
              <strong className="text-xs text-foreground block mt-0.5 font-mono">
                {transfer.date}
              </strong>
            </div>
          </div>

          {/* Items Review Table */}
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <div className="px-4 py-2.5 bg-muted/50 border-b border-border flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">مراجعة الكميات المعتمدة للأصناف</span>
              <span className="text-xs text-muted-foreground">
                المطلوب: <strong>{totalRequested}</strong> | المعتمد: <strong className="text-emerald-600">{totalApproved}</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead>
                  <tr className="bg-muted/30 text-muted-foreground border-b border-border font-semibold">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">الصنف</th>
                    <th className="py-2.5 px-3 w-24 text-center">الرصيد المتاح</th>
                    <th className="py-2.5 px-3 w-24 text-center">الكمية المطلوبة</th>
                    <th className="py-2.5 px-3 w-28 text-center">الكمية المعتمدة</th>
                    <th className="py-2.5 px-3 w-20 text-center">الوحدة</th>
                    <th className="py-2.5 px-3 min-w-[120px]">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item, idx) => {
                    const avail = item.source_available_qty ?? 0;
                    const isExceeding = Number(item.approved_qty) > avail;

                    return (
                      <tr key={idx} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 text-center text-muted-foreground font-mono">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <strong className="text-foreground block">{item.name}</strong>
                          <span className="text-[10px] text-muted-foreground font-mono">{item.code}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          <span className={`px-2 py-0.5 rounded-full font-bold ${
                            avail <= 0 ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          }`}>
                            {avail}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-medium">
                          {item.requested_qty}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.approved_qty}
                            onChange={(e) => handleQtyChange(idx, parseFloat(e.target.value) || 0)}
                            className="w-full py-1 px-2 text-center bg-background border border-border rounded text-xs font-bold font-mono focus:ring-1 focus:ring-primary"
                          />
                          {isExceeding && (
                            <span className="text-[10px] text-amber-600 block mt-0.5">
                              يتجاوز المتاح ({avail})
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center text-muted-foreground">
                          {item.unit}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {item.notes || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Conditional Reject Form or Approval Notes */}
          {isRejecting ? (
            <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-xl space-y-2">
              <label className="block text-xs font-bold text-destructive flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>سبب رفض التحويل (إلزامي) <span className="text-destructive">*</span></span>
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="وضح سبب رفض التحويل المخزني بالتفصيل..."
                className="w-full py-2 px-3 bg-background border border-destructive/40 rounded-lg text-xs text-foreground focus:ring-2 focus:ring-destructive/30 resize-none"
              />
            </div>
          ) : (
            <div className="p-4 bg-muted/30 border border-border rounded-xl">
              <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                <span>ملاحظات الاعتماد والتوجيه للصرف</span>
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أضف أي ملاحظات خاصة بالاعتماد أو توجيهات لفريق التجهيز..."
                className="w-full py-1.5 px-3 bg-background border border-border rounded-lg text-xs text-foreground focus:ring-1 focus:ring-primary resize-none"
              />
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/40">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 border border-border hover:bg-muted text-foreground rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            إغلاق
          </button>

          <div className="flex items-center gap-2">
            {!isRejecting ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsRejecting(true)}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  <span>رفض التحويل</span>
                </button>

                <button
                  type="button"
                  onClick={handleApproveSubmit}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmitting ? "جاري الاعتماد..." : "اعتماد وتجهيز للصرف"}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsRejecting(false)}
                  className="px-4 py-2 border border-border hover:bg-muted text-foreground rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  تراجع عن الرفض
                </button>

                <button
                  type="button"
                  onClick={handleRejectSubmit}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  <span>{isSubmitting ? "جاري الرفض..." : "تأكيد رفض الطلب"}</span>
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
