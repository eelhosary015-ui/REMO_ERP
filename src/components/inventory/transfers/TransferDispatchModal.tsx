import React, { useState, useEffect } from "react";
import { 
  X, 
  Truck, 
  Barcode, 
  CheckCircle2, 
  AlertTriangle, 
  Boxes, 
  DollarSign, 
  Phone, 
  FileText,
  Calendar,
  Layers
} from "lucide-react";
import { WarehouseTransfer, TransferItem } from "./TransferTypes";

interface TransferDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  transfer: WarehouseTransfer | null;
  onDispatch: (id: number, data: any) => Promise<void>;
  onNotify: (msg: string, type?: "success" | "error" | "info") => void;
}

export const TransferDispatchModal: React.FC<TransferDispatchModalProps> = ({
  isOpen,
  onClose,
  transfer,
  onDispatch,
  onNotify,
}) => {
  const [driverName, setDriverName] = useState<string>("");
  const [driverPhone, setDriverPhone] = useState<string>("");
  const [vehicleNo, setVehicleNo] = useState<string>("");
  const [waybillNo, setWaybillNo] = useState<string>("");
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const [barcodeInput, setBarcodeInput] = useState<string>("");
  const [scannedMap, setScannedMap] = useState<Record<number, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [items, setItems] = useState<TransferItem[]>([]);

  useEffect(() => {
    if (transfer) {
      try {
        const parsed = typeof transfer.items === "string" ? JSON.parse(transfer.items) : (transfer.items || []);
        setItems(parsed.map((it: any) => ({
          ...it,
          dispatched_qty: it.dispatched_qty || it.approved_qty || it.requested_qty || it.quantity || 0,
        })));
      } catch {
        setItems([]);
      }
      setDriverName(transfer.driver_name || "");
      setDriverPhone(transfer.driver_phone || "");
      setVehicleNo(transfer.vehicle_no || "");
      setWaybillNo(transfer.waybill_no || `WB-${transfer.id}-${Math.floor(1000 + Math.random() * 9000)}`);
      setShippingCost(Number(transfer.shipping_cost || 0));
      setNotes("");
      setScannedMap({});
      setBarcodeInput("");
    }
  }, [transfer]);

  if (!isOpen || !transfer) return null;

  const handleQtyChange = (index: number, val: number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], dispatched_qty: val };
    setItems(updated);
  };

  const handleBatchChange = (index: number, field: "batch_number" | "expiry_date" | "serial_number", val: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: val };
    setItems(updated);
  };

  const handleBarcodeScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const query = barcodeInput.trim().toLowerCase();
    const foundIndex = items.findIndex(
      (it) => (it.barcode && String(it.barcode).toLowerCase() === query) || (it.code && String(it.code).toLowerCase() === query)
    );

    if (foundIndex !== -1) {
      setScannedMap({ ...scannedMap, [foundIndex]: true });
      onNotify(`تم التحقق من الصنف بنجاح: ${items[foundIndex].name}`, "success");
      setBarcodeInput("");
    } else {
      onNotify("الباركود غير مطابق لأي صنف في هذا التحويل", "error");
    }
  };

  const handleSubmit = async () => {
    if (!driverName.trim()) {
      onNotify("يرجى إدخال اسم السائق / الناقل", "info");
    }

    // Validate quantities
    const invalidQty = items.some((it) => Number(it.dispatched_qty) <= 0);
    if (invalidQty) {
      onNotify("يجب أن تكون الكميات المصروفة أكبر من الصفر", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      await onDispatch(transfer.id, {
        driver_name: driverName,
        driver_phone: driverPhone,
        vehicle_no: vehicleNo,
        waybill_no: waybillNo,
        shipping_cost: Number(shippingCost || 0),
        notes,
        items,
      });
      onClose();
    } catch (err: any) {
      onNotify(err.message || "فشل في صرف وتحويل الشحنة", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalDispatched = items.reduce((s, it) => s + Number(it.dispatched_qty || 0), 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-sm overflow-y-auto" id="transfer-dispatch-modal">
      <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto text-right" dir="rtl">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-purple-50 dark:bg-purple-950/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                تجهيز وصرف الشحنة (Picking & Dispatch): {transfer.transfer_number}
              </h2>
              <p className="text-xs text-muted-foreground">
                تأكيد الأصناف المحملة، بيانات السائق، ورقم بوليصة الشحن وبدء النقل (In-Transit)
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
          
          {/* Barcode Quick Verification */}
          <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-primary font-medium">
              <Barcode className="w-4 h-4" />
              <span>التحقق السريع بمسح الباركود أثناء التحميل:</span>
            </div>
            <form onSubmit={handleBarcodeScan} className="flex items-center gap-2">
              <input
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="امسح باركود الصنف..."
                className="py-1 px-3 bg-background border border-border rounded-lg text-xs text-foreground focus:ring-1 focus:ring-primary w-48 font-mono"
              />
              <button
                type="submit"
                className="px-3 py-1 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
              >
                تأكيد
              </button>
            </form>
          </div>

          {/* Logistics & Driver Details Form */}
          <div className="bg-muted/30 p-4 rounded-xl border border-border">
            <h3 className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-primary" />
              <span>بيانات السائق والشحن والناقل</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  اسم السائق / شركة النقل <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="اسم السائق..."
                  className="w-full py-1.5 px-3 bg-background border border-border rounded-lg text-xs text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  رقم هاتف السائق
                </label>
                <input
                  type="text"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  placeholder="05XXXXXXXX"
                  className="w-full py-1.5 px-3 bg-background border border-border rounded-lg text-xs text-foreground font-mono focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  رقم لوحة المركبة / الشاحنة
                </label>
                <input
                  type="text"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                  placeholder="أ ب ج 1234"
                  className="w-full py-1.5 px-3 bg-background border border-border rounded-lg text-xs text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  رقم بوليصة الشحن (Waybill)
                </label>
                <input
                  type="text"
                  value={waybillNo}
                  onChange={(e) => setWaybillNo(e.target.value)}
                  className="w-full py-1.5 px-3 bg-background border border-border rounded-lg text-xs text-foreground font-mono focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  تكلفة الشحن والنقل (ر.س)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                  className="w-full py-1.5 px-3 bg-background border border-border rounded-lg text-xs font-mono text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  ملاحظات الصرف والتحميل
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات الشاحنة أو تعليمات التسليم..."
                  className="w-full py-1.5 px-3 bg-background border border-border rounded-lg text-xs text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Items Picking Table */}
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <div className="px-4 py-2.5 bg-muted/50 border-b border-border flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">تجهيز كميات الأصناف المشحونة والباتشات</span>
              <span className="text-xs text-muted-foreground">
                إجمالي المشحون: <strong className="text-purple-600 dark:text-purple-400">{totalDispatched}</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead>
                  <tr className="bg-muted/30 text-muted-foreground border-b border-border font-semibold">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">الصنف</th>
                    <th className="py-2.5 px-3 w-24 text-center">المعتمد</th>
                    <th className="py-2.5 px-3 w-28 text-center">الكمية المشحونة</th>
                    <th className="py-2.5 px-3 w-20 text-center">الوحدة</th>
                    <th className="py-2.5 px-3 min-w-[140px]">رقم الباتش / الصلاحية</th>
                    <th className="py-2.5 px-3 w-16 text-center">الباركود</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item, idx) => {
                    const isScanned = scannedMap[idx];

                    return (
                      <tr key={idx} className={`hover:bg-muted/30 transition-colors ${isScanned ? "bg-emerald-500/5" : ""}`}>
                        <td className="py-2.5 px-3 text-center text-muted-foreground font-mono">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <strong className="text-foreground block">{item.name}</strong>
                          <span className="text-[10px] text-muted-foreground font-mono">{item.code}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-medium">
                          {item.approved_qty || item.requested_qty}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={item.dispatched_qty}
                            onChange={(e) => handleQtyChange(idx, parseFloat(e.target.value) || 0)}
                            className="w-full py-1 px-2 text-center bg-background border border-border rounded text-xs font-bold font-mono focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center text-muted-foreground">
                          {item.unit}
                        </td>
                        <td className="py-2.5 px-3 space-y-1">
                          <input
                            type="text"
                            placeholder="رقم التشغيلة / Batch"
                            value={item.batch_number || ""}
                            onChange={(e) => handleBatchChange(idx, "batch_number", e.target.value)}
                            className="w-full py-1 px-2 bg-background border border-border rounded text-[11px]"
                          />
                          <input
                            type="date"
                            value={item.expiry_date || ""}
                            onChange={(e) => handleBatchChange(idx, "expiry_date", e.target.value || null)}
                            className="w-full py-0.5 px-2 bg-background border border-border rounded text-[10px] text-muted-foreground"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {isScanned ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              تم
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setScannedMap({ ...scannedMap, [idx]: true })}
                              className="text-[10px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                            >
                              تأكيد
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
            id="btn-confirm-dispatch"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Truck className="w-4 h-4" />
            <span>{isSubmitting ? "جاري الصرف والتحويل..." : "تأكيد الصرف وبدء النقل (In-Transit)"}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
