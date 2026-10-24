import React, { useState } from "react";
import { 
  X, 
  Printer, 
  FileSpreadsheet, 
  ArrowRightLeft, 
  CheckCircle2, 
  Clock, 
  Truck, 
  PackageCheck, 
  AlertCircle, 
  XCircle, 
  Calendar, 
  User, 
  Building2, 
  Tag, 
  ShieldCheck, 
  History, 
  Layers, 
  Boxes,
  DollarSign,
  Phone,
  FileText,
  BadgeAlert,
  ArrowRight
} from "lucide-react";
import { WarehouseTransfer, TransferItem, StatusHistoryEntry } from "./TransferTypes";

interface TransferDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transfer: WarehouseTransfer | null;
  onPrint: (transfer: WarehouseTransfer) => void;
  onOpenApproveModal?: (transfer: WarehouseTransfer) => void;
  onOpenDispatchModal?: (transfer: WarehouseTransfer) => void;
  onOpenReceiveModal?: (transfer: WarehouseTransfer) => void;
  onCancelTransfer?: (id: number, reason: string) => Promise<void>;
  onNotify: (msg: string, type?: "success" | "error" | "info") => void;
}

export const TransferDetailsModal: React.FC<TransferDetailsModalProps> = ({
  isOpen,
  onClose,
  transfer,
  onPrint,
  onOpenApproveModal,
  onOpenDispatchModal,
  onOpenReceiveModal,
  onCancelTransfer,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<"overview" | "items" | "logistics" | "ledger" | "audit">("overview");
  const [cancelReason, setCancelReason] = useState<string>("");
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [isSubmittingCancel, setIsSubmittingCancel] = useState<boolean>(false);

  if (!isOpen || !transfer) return null;

  const items: TransferItem[] = (() => {
    try {
      return typeof transfer.items === "string" ? JSON.parse(transfer.items) : (transfer.items || []);
    } catch {
      return [];
    }
  })();

  const history: StatusHistoryEntry[] = (() => {
    try {
      return typeof transfer.status_history === "string" ? JSON.parse(transfer.status_history) : (transfer.status_history || []);
    } catch {
      return [];
    }
  })();

  const handleCancelSubmit = async () => {
    if (!cancelReason.trim()) {
      onNotify("يرجى ذكر سبب إلغاء التحويل", "error");
      return;
    }

    if (!onCancelTransfer) return;

    setIsSubmittingCancel(true);
    try {
      await onCancelTransfer(transfer.id, cancelReason);
      setIsCancelling(false);
      onClose();
    } catch (err: any) {
      onNotify(err.message || "فشل في إلغاء التحويل", "error");
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  // Workflow step determination
  const workflowSteps = [
    {
      id: "requested",
      label: "طلب التحويل",
      status: "done",
      date: transfer.date || transfer.created_at,
      user: transfer.user,
    },
    {
      id: "approved",
      label: "اعتماد الإدارة",
      status: ["approved", "picking", "dispatched", "in_transit", "receiving", "qc_inspection", "received_partially", "received", "completed"].includes(transfer.status)
        ? "done"
        : transfer.status === "rejected"
        ? "rejected"
        : "pending",
      date: transfer.approved_at,
      user: transfer.approved_by,
    },
    {
      id: "dispatched",
      label: "الصرف وبدء النقل",
      status: ["dispatched", "in_transit", "receiving", "qc_inspection", "received_partially", "received", "completed"].includes(transfer.status)
        ? "done"
        : transfer.status === "cancelled"
        ? "cancelled"
        : "pending",
      date: transfer.dispatched_at,
      user: transfer.dispatched_by,
    },
    {
      id: "received",
      label: "الاستلام وفحص الجودة",
      status: ["received", "completed"].includes(transfer.status)
        ? "done"
        : ["receiving", "qc_inspection", "received_partially"].includes(transfer.status)
        ? "current"
        : "pending",
      date: transfer.received_at,
      user: transfer.received_by,
    },
    {
      id: "completed",
      label: "الإيداع والاكتمال",
      status: ["received", "completed"].includes(transfer.status) ? "done" : "pending",
      date: transfer.received_at,
      user: transfer.received_by,
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground">مسودة</span>;
      case "requested":
      case "pending":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300">قيد المراجعة والاعتماد</span>;
      case "approved":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">معتمد - جاهز للتجهيز</span>;
      case "picking":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-300">قيد التجهيز والصرف</span>;
      case "dispatched":
      case "in_transit":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-700 dark:text-purple-300 animate-pulse">في الطريق (In-Transit)</span>;
      case "receiving":
      case "qc_inspection":
      case "received_partially":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-500/15 text-teal-700 dark:text-teal-300">قيد الاستلام وفحص QC</span>;
      case "received":
      case "completed":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">مكتمل ومودع بالمخزن</span>;
      case "rejected":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-700 dark:text-rose-300">مرفوض</span>;
      case "cancelled":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-destructive/15 text-destructive">ملغي ومسترد</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground">{status}</span>;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "standard": return "تحويل قياسي روتيني";
      case "urgent": return "تحويل طارئ فوري";
      case "replenishment": return "إعادة تموين دوري";
      case "inter_branch": return "تحويل بين الفروع";
      case "department_issue": return "صرف لقسم تشغيلي";
      case "return_to_hub": return "إرجاع للمستودع المركزي";
      case "damaged_transfer": return "نقل أصناف تالفة / عزل";
      default: return type || "قياسي";
    }
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case "urgent": return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-700 dark:text-rose-300">طارئة وعاجلة</span>;
      case "high": return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">عالية</span>;
      case "low": return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-muted text-muted-foreground">منخفضة</span>;
      default: return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300">عادية</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-sm overflow-y-auto" id="transfer-details-modal">
      <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden my-auto text-right" dir="rtl">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground font-mono">
                  {transfer.transfer_number || transfer.transfer_no}
                </h2>
                {getStatusBadge(transfer.status)}
                {getPriorityBadge(transfer.priority)}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                من: <strong className="text-foreground">{transfer.from_warehouse_name}</strong> إلى: <strong className="text-foreground">{transfer.to_warehouse_name}</strong> | التاريخ: {transfer.date}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-print-transfer-voucher"
              onClick={() => onPrint(transfer)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-background border border-border hover:bg-muted text-foreground rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-primary" />
              <span>طباعة السند والبوليصة</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-border bg-muted/20 overflow-x-auto">
          {[
            { id: "overview", label: "نظرة عامة ومسار التنفيذ", icon: ArrowRightLeft },
            { id: "items", label: `الأصناف والفروقات (${items.length})`, icon: Boxes },
            { id: "logistics", label: "اللوجستيات والشحن", icon: Truck },
            { id: "ledger", label: "حركات المخزون والقيود", icon: Layers },
            { id: "audit", label: `سجل التدقيق (${history.length})`, icon: History },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Stepper Workflow Visualization */}
              <div className="bg-muted/30 p-5 rounded-2xl border border-border">
                <h3 className="text-xs font-bold text-foreground mb-4">مسار دورة حياة التحويل المخزني</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 relative">
                  {workflowSteps.map((step, idx) => {
                    const isDone = step.status === "done";
                    const isCurrent = step.status === "current";
                    const isRejected = step.status === "rejected";
                    const isCancelled = step.status === "cancelled";

                    return (
                      <div
                        key={step.id}
                        className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                          isDone
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200"
                            : isCurrent
                            ? "bg-primary/10 border-primary ring-2 ring-primary/20 text-foreground"
                            : isRejected || isCancelled
                            ? "bg-destructive/10 border-destructive/30 text-destructive"
                            : "bg-background border-border text-muted-foreground"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-muted/60">
                            {idx + 1}
                          </span>
                          {isDone ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          ) : isRejected || isCancelled ? (
                            <XCircle className="w-4 h-4 text-destructive" />
                          ) : isCurrent ? (
                            <span className="flex h-2.5 w-2.5 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                            </span>
                          ) : (
                            <Clock className="w-4 h-4 text-muted-foreground/50" />
                          )}
                        </div>

                        <div>
                          <strong className="text-xs block font-bold mb-0.5">{step.label}</strong>
                          {step.user && (
                            <span className="text-[10px] text-muted-foreground block truncate">
                              بواسطة: {step.user}
                            </span>
                          )}
                          {step.date && (
                            <span className="text-[10px] text-muted-foreground/80 block font-mono mt-0.5">
                              {step.date}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Core Information Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Source & Destination Details */}
                <div className="p-4 bg-muted/20 border border-border rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 border-b border-border pb-2">
                    <Building2 className="w-4 h-4 text-primary" />
                    <span>تفاصيل مسار الشحن والمخازن</span>
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">المخزن المصدر (الصرف)</span>
                      <strong className="text-foreground block">{transfer.from_warehouse_name}</strong>
                      <span className="text-[10px] text-muted-foreground font-mono">كود: {transfer.from_warehouse_code}</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block text-[11px]">المخزن المستهدف (الاستلام)</span>
                      <strong className="text-foreground block">{transfer.to_warehouse_name}</strong>
                      <span className="text-[10px] text-muted-foreground font-mono">كود: {transfer.to_warehouse_code}</span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block text-[11px]">نوع التحويل</span>
                      <strong className="text-foreground block">{getTypeLabel(transfer.type)}</strong>
                    </div>

                    <div>
                      <span className="text-muted-foreground block text-[11px]">القسم / الغرض</span>
                      <strong className="text-foreground block">{transfer.department || transfer.purpose || "تشغيل عام"}</strong>
                    </div>
                  </div>
                </div>

                {/* Logistics & Values */}
                <div className="p-4 bg-muted/20 border border-border rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 border-b border-border pb-2">
                    <Truck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>البيانات اللوجستية والتكاليف</span>
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">السائق / الناقل</span>
                      <strong className="text-foreground block">{transfer.driver_name || "لم يحدد"}</strong>
                      {transfer.driver_phone && (
                        <span className="text-[10px] text-muted-foreground font-mono">{transfer.driver_phone}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-muted-foreground block text-[11px]">رقم بوليصة الشحن</span>
                      <strong className="text-foreground block font-mono">{transfer.waybill_no || "—"}</strong>
                    </div>

                    <div>
                      <span className="text-muted-foreground block text-[11px]">رقم لوحة المركبة</span>
                      <strong className="text-foreground block font-mono">{transfer.vehicle_no || "—"}</strong>
                    </div>

                    <div>
                      <span className="text-muted-foreground block text-[11px]">تكلفة الشحن والنقل</span>
                      <strong className="text-primary block font-mono">
                        {Number(transfer.shipping_cost || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 })} ر.س
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes or Rejection Reason */}
              {transfer.rejected_reason && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl">
                  <span className="text-xs font-bold text-rose-700 dark:text-rose-300 block mb-1">سبب الرفض:</span>
                  <p className="text-xs text-rose-900 dark:text-rose-200">{transfer.rejected_reason}</p>
                </div>
              )}

              {transfer.notes && (
                <div className="p-4 bg-muted/30 border border-border rounded-xl">
                  <span className="text-xs font-bold text-foreground block mb-1">ملاحظات التحويل:</span>
                  <p className="text-xs text-muted-foreground">{transfer.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ITEMS & VARIANCE TABLE */}
          {activeTab === "items" && (
            <div className="border border-border rounded-xl overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead>
                    <tr className="bg-muted/40 text-muted-foreground border-b border-border font-semibold">
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3 min-w-[180px]">الصنف</th>
                      <th className="py-2.5 px-3 text-center">المطلوب</th>
                      <th className="py-2.5 px-3 text-center">المعتمد</th>
                      <th className="py-2.5 px-3 text-center">المشحون</th>
                      <th className="py-2.5 px-3 text-center">المستلم</th>
                      <th className="py-2.5 px-3 text-center">التالف</th>
                      <th className="py-2.5 px-3 text-center">الفروقات</th>
                      <th className="py-2.5 px-3 text-center">التكلفة</th>
                      <th className="py-2.5 px-3 text-center">الإجمالي</th>
                      <th className="py-2.5 px-3 min-w-[120px]">الباتش / الصلاحية</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map((item, idx) => {
                      const req = Number(item.requested_qty || 0);
                      const app = Number(item.approved_qty !== undefined ? item.approved_qty : req);
                      const disp = Number(item.dispatched_qty !== undefined ? item.dispatched_qty : app);
                      const rec = Number(item.received_qty !== undefined ? item.received_qty : disp);
                      const dam = Number(item.damaged_qty || 0);
                      const vari = Number(item.variance_qty || 0);
                      const cost = Number(item.unit_cost || 0);
                      const totalVal = disp * cost;

                      return (
                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 px-3 text-center text-muted-foreground font-mono">{idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <strong className="text-foreground block">{item.name}</strong>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <span>كود: {item.code}</span>
                              {item.barcode && <span>باركود: {item.barcode}</span>}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">{req} {item.unit}</td>
                          <td className="py-2.5 px-3 text-center font-mono font-medium">{app}</td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-purple-600 dark:text-purple-400">{disp}</td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">{rec}</td>
                          <td className="py-2.5 px-3 text-center font-mono text-rose-600">{dam > 0 ? dam : "—"}</td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold">
                            {vari !== 0 ? (
                              <span className={vari > 0 ? "text-amber-600" : "text-blue-600"}>{vari}</span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">{cost.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-foreground">{totalVal.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-muted-foreground text-[11px]">
                            {item.batch_number && <div>باتش: {item.batch_number}</div>}
                            {item.expiry_date && <div>صلاحية: {item.expiry_date}</div>}
                            {!item.batch_number && !item.expiry_date && <div>—</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: LOGISTICS & SHIPPING */}
          {activeTab === "logistics" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-muted/20 border border-border rounded-xl space-y-2">
                  <span className="text-xs font-bold text-foreground block">بيانات الناقل والسائق</span>
                  <div className="text-xs space-y-1.5 pt-2">
                    <div>السائق: <strong className="text-foreground">{transfer.driver_name || "لم يحدد"}</strong></div>
                    <div>الهاتف: <strong className="text-foreground font-mono">{transfer.driver_phone || "—"}</strong></div>
                    <div>المركبة: <strong className="text-foreground font-mono">{transfer.vehicle_no || "—"}</strong></div>
                  </div>
                </div>

                <div className="p-4 bg-muted/20 border border-border rounded-xl space-y-2">
                  <span className="text-xs font-bold text-foreground block">وثائق الشحن</span>
                  <div className="text-xs space-y-1.5 pt-2">
                    <div>رقم البوليصة: <strong className="text-foreground font-mono">{transfer.waybill_no || "—"}</strong></div>
                    <div>تكلفة الشحن: <strong className="text-primary font-mono">{transfer.shipping_cost || 0} ر.س</strong></div>
                  </div>
                </div>

                <div className="p-4 bg-muted/20 border border-border rounded-xl space-y-2">
                  <span className="text-xs font-bold text-foreground block">التوقيتات اللوجستية</span>
                  <div className="text-xs space-y-1.5 pt-2">
                    <div>وقت الصرف: <strong className="text-foreground font-mono">{transfer.dispatched_at || "—"}</strong></div>
                    <div>وقت الاستلام: <strong className="text-foreground font-mono">{transfer.received_at || "—"}</strong></div>
                  </div>
                </div>
              </div>

              {transfer.qc_status && (
                <div className="p-4 bg-teal-500/10 border border-teal-500/30 rounded-xl space-y-2">
                  <span className="text-xs font-bold text-teal-800 dark:text-teal-200 block">تقرير فحص الجودة (QC Inspection Report)</span>
                  <div className="text-xs text-teal-900 dark:text-teal-100">
                    <div>حالة الفحص: <strong>{transfer.qc_status}</strong></div>
                    {transfer.qc_notes && <div className="mt-1">ملاحظات الجودة: {transfer.qc_notes}</div>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: STOCK LEDGER & JOURNAL */}
          {activeTab === "ledger" && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/20 border border-border rounded-xl">
                <h4 className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-primary" />
                  <span>تأثير التحويل على دفتر أستاذ المخزون (Stock Movements)</span>
                </h4>
                
                {Array.isArray(transfer.related_transactions) && transfer.related_transactions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right">
                      <thead>
                        <tr className="bg-muted/40 text-muted-foreground border-b border-border">
                          <th className="py-2 px-3">رقم الحركة</th>
                          <th className="py-2 px-3">نوع القيد</th>
                          <th className="py-2 px-3">المخزن</th>
                          <th className="py-2 px-3">التاريخ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {transfer.related_transactions.map((tx: any, idx: number) => (
                          <tr key={idx}>
                            <td className="py-2 px-3 font-mono">{tx.reference_no || `#${tx.id}`}</td>
                            <td className="py-2 px-3">{tx.transaction_type}</td>
                            <td className="py-2 px-3">{tx.warehouse_id}</td>
                            <td className="py-2 px-3 font-mono">{tx.created_at}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 bg-background border border-border rounded-lg text-center text-xs text-muted-foreground">
                    يتم تسجيل الحركات التفصيلية آليًا في دفتر حركة المخزون العام عند الصرف والاستلام.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: AUDIT TRAIL */}
          {activeTab === "audit" && (
            <div className="space-y-3">
              {history.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs">
                  لا توجد حركات تدقيق مسجلة حتى الآن
                </div>
              ) : (
                <div className="divide-y divide-border border border-border rounded-xl bg-card">
                  {history.map((log, idx) => (
                    <div key={idx} className="p-3.5 flex items-start justify-between text-xs hover:bg-muted/20 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <strong className="text-foreground">{log.action || log.status}</strong>
                          <span className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                            {log.status}
                          </span>
                        </div>
                        {log.notes && (
                          <p className="text-xs text-muted-foreground">{log.notes}</p>
                        )}
                      </div>

                      <div className="text-left text-muted-foreground space-y-0.5">
                        <div className="font-medium text-foreground">{log.user || "المستخدم"}</div>
                        <div className="font-mono text-[10px]">{log.timestamp}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Cancellation Form */}
          {isCancelling && (
            <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-xl space-y-3">
              <span className="text-xs font-bold text-destructive flex items-center gap-1.5">
                <BadgeAlert className="w-4 h-4" />
                <span>إلغاء وعكس التحويل المخزني</span>
              </span>
              <p className="text-xs text-destructive/80">
                تحذير: سيتم إلغاء التحويل واسترجاع أي أرصدة معلقة أو محجوزة وإضافة قيد إلغاء بالدفتر.
              </p>
              <textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="اذكر سبب الإلغاء بالتفصيل..."
                className="w-full py-1.5 px-3 bg-background border border-destructive/40 rounded-lg text-xs text-foreground focus:ring-1 focus:ring-destructive resize-none"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCancelling(false)}
                  className="px-3 py-1.5 border border-border rounded-lg text-xs font-semibold hover:bg-muted cursor-pointer"
                >
                  تراجع
                </button>
                <button
                  type="button"
                  onClick={handleCancelSubmit}
                  disabled={isSubmittingCancel}
                  className="px-4 py-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingCancel ? "جاري الإلغاء..." : "تأكيد الإلغاء والعكس"}
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/40">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border hover:bg-muted text-foreground rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              إغلاق
            </button>

            {/* Cancel Button if not already completed or cancelled */}
            {!["completed", "received", "cancelled", "rejected"].includes(transfer.status) && !isCancelling && (
              <button
                type="button"
                onClick={() => setIsCancelling(true)}
                className="px-3 py-2 text-destructive hover:bg-destructive/10 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                إلغاء التحويل
              </button>
            )}
          </div>

          {/* Workflow Next-Step Buttons */}
          <div className="flex items-center gap-2">
            {["draft", "requested", "pending"].includes(transfer.status) && onOpenApproveModal && (
              <button
                type="button"
                id="btn-drawer-approve"
                onClick={() => {
                  onClose();
                  onOpenApproveModal(transfer);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>مراجعة واعتماد التحويل</span>
              </button>
            )}

            {["approved", "picking"].includes(transfer.status) && onOpenDispatchModal && (
              <button
                type="button"
                id="btn-drawer-dispatch"
                onClick={() => {
                  onClose();
                  onOpenDispatchModal(transfer);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Truck className="w-4 h-4" />
                <span>تجهيز وصرف الشحنة (Dispatch)</span>
              </button>
            )}

            {["dispatched", "in_transit", "receiving", "qc_inspection", "received_partially"].includes(transfer.status) && onOpenReceiveModal && (
              <button
                type="button"
                id="btn-drawer-receive"
                onClick={() => {
                  onClose();
                  onOpenReceiveModal(transfer);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <PackageCheck className="w-4 h-4" />
                <span>استلام وفحص الجودة (Receive & QC)</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
