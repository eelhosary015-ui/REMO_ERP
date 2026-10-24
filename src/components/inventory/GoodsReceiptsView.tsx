import React, { useState, useEffect, useMemo } from "react";
import {
  FileCheck, ShieldCheck, Truck, Package, Plus, Search,
  RefreshCw, Eye, CheckCircle2, AlertTriangle, XCircle,
  Clock, DollarSign, Download, Filter, MapPin, Printer,
  Layers, ArrowUpDown, ChevronDown, ChevronRight, X
} from "lucide-react";
import { GRNKpiCards } from "./grn/GRNKpiCards";
import { GRNFilterBar } from "./grn/GRNFilterBar";
import { GRNCreateModal } from "./grn/GRNCreateModal";
import { GRNQCModal } from "./grn/GRNQCModal";
import { GRNPutawayModal } from "./grn/GRNPutawayModal";
import { GRNDetailsModal } from "./grn/GRNDetailsModal";
import { apiFetch } from "../../utils/api";

export const GoodsReceiptsView: React.FC<{
  warehouses: any[];
  ingredients: any[];
  suppliers: any[];
  onNotify: (msg: string, type: "success" | "error" | "info") => void;
}> = ({ warehouses, ingredients, suppliers, onNotify }) => {
  // State
  const [receipts, setReceipts] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>({});
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedWh, setSelectedWh] = useState<string>("all");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("all");
  const [qcFilter, setQcFilter] = useState<string>("all");
  const [postingFilter, setPostingFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");
  const [activeQuickTab, setActiveQuickTab] = useState<string>("all");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<any | null>(null);
  const [qcModalData, setQcModalData] = useState<any | null>(null);
  const [putawayModalData, setPutawayModalData] = useState<any | null>(null);

  // Fetch Receipts from API
  const fetchReceipts = async () => {
    setLoading(true);
    try {
      let url = `/api/goods-receipts?`;
      if (selectedWh !== "all") url += `warehouse_id=${selectedWh}&`;
      if (selectedSupplier !== "all") url += `supplier_id=${selectedSupplier}&`;
      if (qcFilter !== "all") url += `qc_status=${qcFilter}&`;
      if (postingFilter !== "all") url += `status=${postingFilter}&`;
      if (search.trim()) url += `search=${encodeURIComponent(search.trim())}&`;

      const res = await apiFetch(url);
      const data = await res.json();
      if (data.success) {
        setReceipts(data.goods_receipts || []);
        setKpis(data.kpis || {});
      } else {
        onNotify(data.error || "فشل تحميل سندات الاستلام", "error");
      }
    } catch (err: any) {
      onNotify("خطأ أثناء الاتصال بالخادم", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [selectedWh, selectedSupplier, qcFilter, postingFilter]);

  // Automatic trigger check for direct receipt from Purchases Module
  useEffect(() => {
    const poId = localStorage.getItem("initialPurchaseOrderId");
    if (poId) {
      setShowCreateModal(true);
    }
  }, []);

  // Handle Quick Tabs
  const handleSelectQuickTab = (tab: string) => {
    setActiveQuickTab(tab);
    if (tab === "all") {
      setQcFilter("all");
      setPostingFilter("all");
    } else if (tab === "pending_qc") {
      setQcFilter("pending");
      setPostingFilter("all");
    } else if (tab === "quarantine") {
      setQcFilter("quarantine");
      setPostingFilter("all");
    } else if (tab === "ready_to_post") {
      setQcFilter("passed");
      setPostingFilter("draft");
    } else if (tab === "posted") {
      setQcFilter("all");
      setPostingFilter("posted");
    } else if (tab === "returns") {
      setQcFilter("failed");
      setPostingFilter("all");
    }
  };

  // View Details Handler
  const handleOpenDetails = async (id: number) => {
    try {
      const res = await apiFetch(`/api/goods-receipts/${id}`);
      const data = await res.json();
      if (data.success) {
        setViewingReceipt(data);
      } else {
        onNotify("فشل تحميل تفاصيل السند", "error");
      }
    } catch (err) {
      onNotify("خطأ أثناء تحميل تفاصيل السند", "error");
    }
  };

  // QC Modal Opener
  const handleOpenQcModal = async (receiptItem: any) => {
    try {
      const id = receiptItem.goods_receipt?.id || receiptItem.id;
      const res = await apiFetch(`/api/goods-receipts/${id}`);
      const data = await res.json();
      if (data.success) {
        setQcModalData(data);
      }
    } catch (err) {
      onNotify("فشل تحميل بيانات الفحص", "error");
    }
  };

  // Putaway Modal Opener
  const handleOpenPutawayModal = async (receiptItem: any) => {
    try {
      const id = receiptItem.goods_receipt?.id || receiptItem.id;
      const res = await apiFetch(`/api/goods-receipts/${id}`);
      const data = await res.json();
      if (data.success) {
        setPutawayModalData(data);
      }
    } catch (err) {
      onNotify("فشل تحميل بيانات التسكين", "error");
    }
  };

  // Post Handler
  const handlePostReceipt = async (id: number) => {
    try {
      const res = await apiFetch(`/api/goods-receipts/${id}/post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: localStorage.getItem("userName") || "admin" })
      });
      const data = await res.json();
      if (data.success) {
        onNotify(data.message || "تم اعتماد وترحيل السند بنجاح", "success");
        if (viewingReceipt?.goods_receipt?.id === id) {
          handleOpenDetails(id);
        }
        fetchReceipts();
      } else {
        onNotify(data.error || "فشل ترحيل السند", "error");
      }
    } catch (err) {
      onNotify("خطأ أثناء ترحيل السند", "error");
    }
  };

  // Reverse Handler
  const handleReverseReceipt = async (id: number, reason: string = "عكس السند") => {
    try {
      const res = await apiFetch(`/api/goods-receipts/${id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, user: localStorage.getItem("userName") || "admin" })
      });
      const data = await res.json();
      if (data.success) {
        onNotify(data.message || "تم عكس السند بنجاح", "success");
        if (viewingReceipt?.goods_receipt?.id === id) {
          handleOpenDetails(id);
        }
        fetchReceipts();
      } else {
        onNotify(data.error || "فشل عكس السند", "error");
      }
    } catch (err) {
      onNotify("خطأ أثناء عكس السند", "error");
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    if (receipts.length === 0) {
      onNotify("لا توجد بيانات لتصديرها", "error");
      return;
    }
    const headers = ["رقم السند", "التاريخ", "المخزن", "المورد", "عدد الأصناف", "إجمالي الكمية", "القيمة الإجمالية", "حالة الفحص", "حالة الترحيل"];
    const rows = receipts.map(r => [
      r.receipt_no,
      new Date(r.date || r.created_at).toLocaleDateString("ar-EG"),
      r.warehouse_name,
      r.supplier_name || "مورد عام",
      r.items_count,
      r.total_qty,
      r.total_landed_cost || r.net_amount || r.total_amount,
      r.qc_status,
      r.status
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `GRN_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onNotify("تم تصدير ملف سندات الاستلام بنجاح", "success");
  };

  // Filtered Receipts
  const filteredReceipts = useMemo(() => {
    return receipts.filter(r => {
      if (!r || (r.id === undefined && !r.receipt_no)) return false;
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return (
        r.receipt_no?.toLowerCase().includes(term) ||
        r.supplier_name?.toLowerCase().includes(term) ||
        r.supplier_invoice_no?.toLowerCase().includes(term) ||
        r.delivery_note_no?.toLowerCase().includes(term) ||
        r.reference?.toLowerCase().includes(term)
      );
    });
  }, [receipts, search]);

  return (
    <div className="space-y-6" dir="rtl">
      {/* 1. Header & Filter Bar */}
      <GRNFilterBar
        search={search}
        onSearchChange={setSearch}
        warehouses={warehouses}
        suppliers={suppliers}
        selectedWh={selectedWh}
        onWhChange={setSelectedWh}
        selectedSupplier={selectedSupplier}
        onSupplierChange={setSelectedSupplier}
        qcFilter={qcFilter}
        onQcFilterChange={setQcFilter}
        postingFilter={postingFilter}
        onPostingFilterChange={setPostingFilter}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        loading={loading}
        onRefresh={fetchReceipts}
        onOpenCreate={() => setShowCreateModal(true)}
        onExportCsv={handleExportCsv}
        activeQuickTab={activeQuickTab}
        onSelectQuickTab={handleSelectQuickTab}
      />

      {/* 2. KPI Cards */}
      <GRNKpiCards
        kpis={kpis}
        activeTab={activeQuickTab}
        onSelectTab={handleSelectQuickTab}
      />

      {/* 3. Goods Receipts Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <th className="p-4">رقم السند</th>
                <th className="p-4">التاريخ</th>
                <th className="p-4">المخزن المستلم</th>
                <th className="p-4">المورد / الفاتورة</th>
                <th className="p-4 text-center">الأصناف / الكمية</th>
                <th className="p-4 text-center">التكلفة الإجمالية</th>
                <th className="p-4 text-center">فحص الجودة (QC)</th>
                <th className="p-4 text-center">حالة الترحيل</th>
                <th className="p-4 text-center">الإجراءات والعمليات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    جاري تحميل سندات الاستلام وفحص الجودة...
                  </td>
                </tr>
              ) : filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    لا توجد سندات استلام مطابقة للبحث أو الفلتر المحدد.
                  </td>
                </tr>
              ) : (
                filteredReceipts.map((r, idx) => {
                  const isPosted = r.status === "posted";
                  const isReversed = r.status === "reversed";
                  const isQcApproved = r.qc_status === "passed" || r.qc_status === "partial";

                  return (
                    <tr key={r.id ? `grn-${r.id}` : `grn-row-${idx}-${r.receipt_no || ""}`} className="hover:bg-slate-50/80 transition-colors">
                      {/* Receipt No */}
                      <td className="p-4 font-mono font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{r.receipt_no}</span>
                        </div>
                        {r.purchase_order_id && (
                          <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono block w-fit mt-0.5">
                            PO #{r.purchase_order_id}
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="p-4 text-slate-600 font-mono">
                        {new Date(r.date || r.created_at).toLocaleDateString("ar-EG")}
                      </td>

                      {/* Warehouse */}
                      <td className="p-4">
                        <span className="font-bold text-slate-900 block">{r.warehouse_name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">ID: {r.warehouse_id}</span>
                      </td>

                      {/* Supplier */}
                      <td className="p-4">
                        <span className="font-bold text-slate-800 block">{r.supplier_name || "مورد عام / نقدي"}</span>
                        {r.supplier_invoice_no && (
                          <span className="text-[10px] text-slate-500 font-mono">فاتورة: {r.supplier_invoice_no}</span>
                        )}
                      </td>

                      {/* Items & Qty */}
                      <td className="p-4 text-center font-mono">
                        <span className="font-bold text-slate-900 block">{r.items_count} أصناف</span>
                        <span className="text-[10px] text-slate-500 font-bold">
                          ({Number(r.total_qty || 0).toLocaleString()} وحدة)
                        </span>
                      </td>

                      {/* Total Amount & Landed */}
                      <td className="p-4 text-center font-mono">
                        <span className="font-bold text-emerald-700 text-sm block">
                          {Number(r.total_landed_cost || r.net_amount || r.total_amount || 0).toLocaleString()} ج.م
                        </span>
                        {(r.freight_charges > 0 || r.customs_charges > 0) && (
                          <span className="text-[10px] text-emerald-600 block">
                            + مصاريف محملة
                          </span>
                        )}
                      </td>

                      {/* QC Status */}
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold ${
                          r.qc_status === 'passed' ? 'bg-emerald-100 text-emerald-800' :
                          r.qc_status === 'quarantine' ? 'bg-amber-100 text-amber-800' :
                          r.qc_status === 'partial' ? 'bg-blue-100 text-blue-800' :
                          r.qc_status === 'failed' ? 'bg-rose-100 text-rose-800' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {r.qc_status === 'passed' && <ShieldCheck className="w-3.5 h-3.5" />}
                          {r.qc_status === 'quarantine' && <AlertTriangle className="w-3.5 h-3.5" />}
                          {r.qc_status === 'failed' && <XCircle className="w-3.5 h-3.5" />}
                          {r.qc_status === 'passed' ? 'مطابق ومعتمد' :
                           r.qc_status === 'quarantine' ? 'حجر صحي' :
                           r.qc_status === 'partial' ? 'فحص جزئي' :
                           r.qc_status === 'failed' ? 'مرفوض' : 'بانتظار الفحص'}
                        </span>
                      </td>

                      {/* Posting Status */}
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-1 rounded-xl text-xs font-bold ${
                          r.status === 'posted' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          r.status === 'reversed' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          r.status === 'qc_approved' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {r.status === 'posted' ? '🔒 مرحل للأرصدة' :
                           r.status === 'reversed' ? '↩️ معكوس' :
                           r.status === 'qc_approved' ? 'جاهز للترحيل' : 'مسودة'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* View Details */}
                          <button
                            onClick={() => handleOpenDetails(r.id)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
                            title="عرض التفاصيل العميقة والسند"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Execute QC */}
                          {!isPosted && !isReversed && (
                            <button
                              onClick={() => handleOpenQcModal(r)}
                              className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-all"
                              title="إجراء فحص الجودة (QC)"
                            >
                              <ShieldCheck className="w-4 h-4" />
                            </button>
                          )}

                          {/* Put Away */}
                          {!isPosted && !isReversed && (
                            <button
                              onClick={() => handleOpenPutawayModal(r)}
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all"
                              title="تسكين المواقع (Put-Away)"
                            >
                              <MapPin className="w-4 h-4" />
                            </button>
                          )}

                          {/* Direct Post */}
                          {!isPosted && !isReversed && (
                            <button
                              onClick={() => handlePostReceipt(r.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] shadow-sm transition-all"
                              title="اعتماد وترحيل للأرصدة والقيد المحاسبي"
                            >
                              ترحيل
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODALS */}
      {/* 1. Create Modal */}
      {showCreateModal && (
        <GRNCreateModal
          warehouses={warehouses}
          ingredients={ingredients}
          suppliers={suppliers}
          initialPurchaseOrderId={
            localStorage.getItem("initialPurchaseOrderId")
              ? Number(localStorage.getItem("initialPurchaseOrderId"))
              : undefined
          }
          onClose={() => {
            setShowCreateModal(false);
            localStorage.removeItem("initialPurchaseOrderId");
          }}
          onSuccess={() => {
            fetchReceipts();
            localStorage.removeItem("initialPurchaseOrderId");
          }}
          onNotify={onNotify}
        />
      )}

      {/* 2. Details Modal */}
      {viewingReceipt && (
        <GRNDetailsModal
          data={viewingReceipt}
          onClose={() => setViewingReceipt(null)}
          onPost={(id) => handlePostReceipt(id)}
          onReverse={(id) => handleReverseReceipt(id)}
          onOpenQc={(rec) => { setViewingReceipt(null); handleOpenQcModal(rec); }}
          onOpenPutaway={(rec) => { setViewingReceipt(null); handleOpenPutawayModal(rec); }}
          onNotify={onNotify}
        />
      )}

      {/* 3. QC Modal */}
      {qcModalData && (
        <GRNQCModal
          receipt={qcModalData}
          onClose={() => setQcModalData(null)}
          onSuccess={() => { setQcModalData(null); fetchReceipts(); }}
          onNotify={onNotify}
        />
      )}

      {/* 4. Putaway Modal */}
      {putawayModalData && (
        <GRNPutawayModal
          receipt={putawayModalData}
          onClose={() => setPutawayModalData(null)}
          onSuccess={() => { setPutawayModalData(null); fetchReceipts(); }}
          onNotify={onNotify}
        />
      )}
    </div>
  );
};
