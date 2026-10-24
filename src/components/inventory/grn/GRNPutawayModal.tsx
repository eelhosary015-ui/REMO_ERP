import React, { useState, useEffect } from "react";
import {
  MapPin, CheckCircle2, Layers, Plus, Trash2, X,
  Building2, Box, ArrowRight
} from "lucide-react";
import { apiFetch } from "../../../utils/api";

interface GRNPutawayModalProps {
  receipt: any;
  onClose: () => void;
  onSuccess: () => void;
  onNotify: (msg: string, type: "success" | "error" | "info") => void;
}

export const GRNPutawayModal: React.FC<GRNPutawayModalProps> = ({
  receipt,
  onClose,
  onSuccess,
  onNotify
}) => {
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Put-away allocation rows
  const [allocations, setAllocations] = useState<any[]>([]);

  useEffect(() => {
    const fetchLocations = async () => {
      setLoading(true);
      try {
        const whId = receipt.goods_receipt.warehouse_id;
        const res = await apiFetch(`/api/warehouse-locations?warehouse_id=${whId}`);
        const data = await res.json();
        if (data.success) {
          setLocations(data.locations || []);
        }
      } catch (err) {
        console.error("Failed to load locations:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLocations();
  }, [receipt]);

  // Initialize allocations from receipt items
  useEffect(() => {
    if (receipt && receipt.items) {
      const initial: any[] = [];
      receipt.items.forEach((it: any) => {
        const accQty = Number(it.accepted_qty > 0 ? it.accepted_qty : it.received_qty);
        if (accQty > 0) {
          initial.push({
            goods_receipt_item_id: it.id,
            ingredient_id: it.ingredient_id,
            item_name: it.item_name,
            item_code: it.item_code,
            batch_number: it.batch_number,
            max_qty: accQty,
            quantity: accQty,
            location_id: it.location_id || (locations[0]?.id || "")
          });
        }
      });
      setAllocations(initial);
    }
  }, [receipt, locations]);

  const handleAddSplitRow = (index: number) => {
    const parent = allocations[index];
    setAllocations(prev => [
      ...prev,
      {
        ...parent,
        quantity: 0,
        location_id: locations[0]?.id || ""
      }
    ]);
  };

  const handleRemoveRow = (index: number) => {
    setAllocations(prev => prev.filter((_, i) => i !== index));
  };

  const handleRowChange = (index: number, field: string, value: any) => {
    setAllocations(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        locations: allocations.map(a => ({
          goods_receipt_item_id: a.goods_receipt_item_id,
          ingredient_id: a.ingredient_id,
          location_id: Number(a.location_id),
          quantity: Number(a.quantity || 0),
          batch_number: a.batch_number
        }))
      };

      const res = await apiFetch(`/api/goods-receipts/${receipt.goods_receipt.id}/putaway`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        onNotify("تم حفظ توزيع مواقع التخزين (Put-Away) بنجاح", "success");
        onSuccess();
        onClose();
      } else {
        onNotify(data.error || "فشل حفظ مواقع التخزين", "error");
      }
    } catch (err: any) {
      onNotify("خطأ أثناء الاتصال بالخادم", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-100 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-blue-950 via-slate-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/30">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">تسكين وتوزيع الأصناف بالمواقع (Put-Away Allocation)</h2>
              <p className="text-xs text-slate-300">
                سند استلام #{receipt.goods_receipt.receipt_no} | المخزن: {receipt.goods_receipt.warehouse_name}
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          <div className="bg-blue-50/60 p-3.5 rounded-2xl border border-blue-200 text-blue-900 flex items-center justify-between">
            <span>حدد الرف والموقع التفصيلي (Zone/Rack/Shelf/Bin) لكل صنف لتسهيل عمليات الجرد والصرف الآلي</span>
            <span className="font-mono font-bold bg-white px-2.5 py-1 rounded-lg border border-blue-200">
              {allocations.length} موقع تخزين
            </span>
          </div>

          <div className="space-y-3">
            {allocations.map((row, idx) => (
              <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
                <div className="sm:col-span-2">
                  <span className="font-bold text-slate-900 block">{row.item_name}</span>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                    <span>الكود: {row.item_code}</span>
                    {row.batch_number && <span>| تشغيلة: {row.batch_number}</span>}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">الكمية المسكنة</label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    value={row.quantity}
                    onChange={(e) => handleRowChange(idx, "quantity", parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-mono font-bold text-slate-800"
                  />
                </div>

                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">الموقع / الرف</label>
                    <select
                      value={row.location_id}
                      onChange={(e) => handleRowChange(idx, "location_id", e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                      required
                    >
                      <option value="">-- اختر موقع التخزين --</option>
                      {locations.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.code} - {l.name} {l.zone ? `(Zone ${l.zone})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddSplitRow(idx)}
                    className="p-2 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors"
                    title="توزيع الكمية على موقع إضافي (Split Location)"
                  >
                    <Plus className="w-4 h-4" />
                  </button>

                  {allocations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(idx)}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl">
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md"
            >
              <CheckCircle2 className="w-4 h-4" />
              {submitting ? "جاري الحفظ..." : "تأكيد التسكين في المواقع"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
