import React, { useState, useEffect, useCallback } from "react";
import { 
  ArrowRightLeft, 
  RefreshCw, 
  Plus, 
  TrendingUp, 
  Settings, 
  Layers, 
  CheckCircle2, 
  AlertCircle 
} from "lucide-react";
import { 
  TreasuryTransfer, 
  TreasuryAccount, 
  TreasuryTransferType, 
  TreasuryTransferKPI 
} from "../../types";
import { TransferDashboardView } from "./transfers/TransferDashboardView";
import { TransferListView } from "./transfers/TransferListView";
import { TransferFormModal } from "./transfers/TransferFormModal";
import { TransferDetailModal } from "./transfers/TransferDetailModal";
import { TransferReceiptModal } from "./transfers/TransferReceiptModal";
import { TransferReverseModal } from "./transfers/TransferReverseModal";
import { TransferRejectModal } from "./transfers/TransferRejectModal";
import { TransferPrintVoucher } from "./transfers/TransferPrintVoucher";
import { TransferReportsView } from "./transfers/TransferReportsView";

export const TransferManagementEnterprise: React.FC = () => {
  // Main Data States
  const [transfers, setTransfers] = useState<TreasuryTransfer[]>([]);
  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [transferTypes, setTransferTypes] = useState<TreasuryTransferType[]>([]);
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [costCenters, setCostCenters] = useState<{ id: number; name: string }[]>([]);
  const [kpi, setKpi] = useState<TreasuryTransferKPI | null>(null);

  // Loading & Pagination States
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sourceAccountFilter, setSourceAccountFilter] = useState("all");
  const [destAccountFilter, setDestAccountFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");

  // Views & Modals
  const [activeView, setActiveView] = useState<"list" | "reports">("list");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<TreasuryTransfer | null>(null);
  const [selectedDetailId, setSelectedDetailId] = useState<number | null>(null);
  
  // Specific Action Modals
  const [receiptModalTransfer, setReceiptModalTransfer] = useState<TreasuryTransfer | null>(null);
  const [reverseModalTransfer, setReverseModalTransfer] = useState<TreasuryTransfer | null>(null);
  const [rejectModalTransfer, setRejectModalTransfer] = useState<TreasuryTransfer | null>(null);
  const [printModalTransfer, setPrintModalTransfer] = useState<TreasuryTransfer | null>(null);

  const [submittingAction, setSubmittingAction] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch Accounts, Branches, Types, Cost Centers once
  const fetchMetadata = async () => {
    try {
      const [accRes, typesRes, brRes, ccRes] = await Promise.all([
        fetch("/api/treasury/accounts"),
        fetch("/api/treasury/transfers/types"),
        fetch("/api/branches"),
        fetch("/api/cost-centers")
      ]);

      if (accRes.ok) {
        const d = await accRes.json();
        setAccounts(d.accounts || d || []);
      }
      if (typesRes.ok) {
        const d = await typesRes.json();
        setTransferTypes(d.types || []);
      }
      if (brRes.ok) {
        const d = await brRes.json();
        setBranches(d.branches || d || []);
      }
      if (ccRes.ok) {
        const d = await ccRes.json();
        setCostCenters(d.cost_centers || d.costCenters || d || []);
      }
    } catch (err) {
      console.error("Failed to fetch transfer metadata", err);
    }
  };

  // Fetch KPI statistics
  const fetchKPI = async () => {
    try {
      const res = await fetch("/api/treasury/transfers/kpi");
      if (res.ok) {
        const data = await res.json();
        setKpi(data.kpi);
      }
    } catch (err) {
      console.error("Failed to fetch transfers KPI", err);
    }
  };

  // Fetch Transfers List
  const fetchTransfers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", limit.toString());
      if (searchQuery.trim()) params.append("search", searchQuery.trim());
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (typeFilter !== "all") params.append("transfer_type", typeFilter);
      if (sourceAccountFilter !== "all") params.append("source_account_id", sourceAccountFilter);
      if (destAccountFilter !== "all") params.append("destination_account_id", destAccountFilter);
      if (branchFilter !== "all") params.append("branch_id", branchFilter);
      if (startDateFilter) params.append("start_date", startDateFilter);
      if (endDateFilter) params.append("end_date", endDateFilter);

      const res = await fetch(`/api/treasury/transfers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTransfers(data.transfers || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to load transfers", err);
      showToast("فشل في تحميل قائمة التحويلات المالية", "error");
    } finally {
      setLoading(false);
    }
  }, [
    page, 
    limit, 
    searchQuery, 
    statusFilter, 
    typeFilter, 
    sourceAccountFilter, 
    destAccountFilter, 
    branchFilter, 
    startDateFilter, 
    endDateFilter
  ]);

  useEffect(() => {
    fetchMetadata();
    fetchKPI();
  }, []);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
    setSourceAccountFilter("all");
    setDestAccountFilter("all");
    setBranchFilter("all");
    setStartDateFilter("");
    setEndDateFilter("");
    setPage(1);
  };

  // 1. Create or Update Transfer
  const handleSaveTransfer = async (formData: any, submitImmediately: boolean) => {
    try {
      setSubmittingAction(true);
      const isEditing = !!editingTransfer;
      const url = isEditing 
        ? `/api/treasury/transfers/${editingTransfer.id}` 
        : "/api/treasury/transfers";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const resData = await res.json();

      if (!res.ok) {
        throw new Error(resData.error || "فشل في حفظ طلب التحويل");
      }

      const createdTransfer = resData.transfer || resData;

      // If user chose to submit immediately
      if (submitImmediately && createdTransfer?.id && createdTransfer.status === "draft") {
        const submitRes = await fetch(`/api/treasury/transfers/${createdTransfer.id}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });
        const submitData = await submitRes.json();
        if (!submitRes.ok) {
          throw new Error(submitData.error || "تم حفظ التحويل لكن تعذر إرساله للاعتماد");
        }
      }

      showToast(
        submitImmediately 
          ? "تم إنشاء طلب التحويل وإرساله للاعتماد المالي بنجاح!" 
          : "تم حفظ مسودة التحويل المالي بنجاح!"
      );

      setIsFormOpen(false);
      setEditingTransfer(null);
      fetchTransfers();
      fetchKPI();
      fetchMetadata(); // update balances
    } catch (err: any) {
      showToast(err.message || "حدث خطأ أثناء حفظ التحويل", "error");
    } finally {
      setSubmittingAction(false);
    }
  };

  // 2. Submit for Approval
  const handleSubmitForApproval = async (trf: TreasuryTransfer) => {
    try {
      const res = await fetch(`/api/treasury/transfers/${trf.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل في إرسال التحويل للاعتماد");

      showToast(`تم إرسال التحويل ${trf.transfer_number} للاعتماد بنجاح`);
      fetchTransfers();
      fetchKPI();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  // 3. Approve Transfer
  const handleApprove = async (trf: TreasuryTransfer) => {
    try {
      const res = await fetch(`/api/treasury/transfers/${trf.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approval_notes: "تمت المراجعة والاعتماد المالي" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل في اعتماد التحويل");

      showToast(`تم اعتماد التحويل ${trf.transfer_number} وتحريك الرصيد بين الخزينتين بنجاح`);
      fetchTransfers();
      fetchKPI();
      fetchMetadata();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  // 4. Reject Transfer (Confirmed via RejectModal)
  const handleConfirmReject = async (transferId: number, reason: string) => {
    try {
      setSubmittingAction(true);
      const res = await fetch(`/api/treasury/transfers/${transferId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejection_reason: reason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل في رفض التحويل");

      showToast("تم رفض طلب التحويل المالي بنجاح");
      setRejectModalTransfer(null);
      fetchTransfers();
      fetchKPI();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSubmittingAction(false);
    }
  };

  // 5. Execute Transfer (Dispatch Cash from Source)
  const handleExecute = async (trf: TreasuryTransfer) => {
    try {
      const res = await fetch(`/api/treasury/transfers/${trf.id}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل في تنفيذ وصرف التحويل");

      showToast(`تم صرف النقدية وتحديث رصيد الخزينة المصدر، السند الآن في مرحلة النقل`);
      fetchTransfers();
      fetchKPI();
      fetchMetadata();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  // 6. Confirm Receipt (Confirmed via ReceiptModal)
  const handleConfirmReceipt = async (transferId: number, receiptData: any) => {
    try {
      setSubmittingAction(true);
      const res = await fetch(`/api/treasury/transfers/${transferId}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(receiptData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل في تأكيد استلام التحويل");

      showToast("تم تأكيد الاستلام بنجاح، وترحيل القيد المحاسبي بالكامل في اليومية العامة!");
      setReceiptModalTransfer(null);
      fetchTransfers();
      fetchKPI();
      fetchMetadata();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSubmittingAction(false);
    }
  };

  // 7. Reverse Transfer (Confirmed via ReverseModal)
  const handleConfirmReverse = async (transferId: number, reason: string) => {
    try {
      setSubmittingAction(true);
      const res = await fetch(`/api/treasury/transfers/${transferId}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reversal_reason: reason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل في عكس التحويل");

      showToast("تم عكس التحويل المالي وإعادة الأرصدة وإنشاء القيد العكسي بنجاح!");
      setReverseModalTransfer(null);
      fetchTransfers();
      fetchKPI();
      fetchMetadata();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSubmittingAction(false);
    }
  };

  // 8. Cancel Transfer
  const handleCancel = async (trf: TreasuryTransfer) => {
    try {
      const res = await fetch(`/api/treasury/transfers/${trf.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancellation_reason: "إلغاء بناءً على طلب المستخدم" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل في إلغاء التحويل");

      showToast(`تم إلغاء التحويل ${trf.transfer_number} بنجاح`);
      fetchTransfers();
      fetchKPI();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl border flex items-center gap-3 text-xs font-bold transition-all animate-bounce ${
          toastMessage.type === "success"
            ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/30"
            : "bg-rose-600 text-white border-rose-500 shadow-rose-600/30"
        }`}>
          {toastMessage.type === "success" ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Main Top Dashboard View */}
      <TransferDashboardView
        kpi={kpi}
        loading={loading}
        onNewTransfer={() => {
          setEditingTransfer(null);
          setIsFormOpen(true);
        }}
        onFilterStatus={(status) => {
          setStatusFilter(status);
          setActiveView("list");
          setPage(1);
        }}
        onOpenReports={() => setActiveView(activeView === "reports" ? "list" : "reports")}
      />

      {/* Main Content Area (List vs Reports) */}
      {activeView === "reports" ? (
        <TransferReportsView
          transfers={transfers}
          accounts={accounts}
          kpi={kpi}
          onBackToTransfers={() => setActiveView("list")}
        />
      ) : (
        <TransferListView
          transfers={transfers}
          accounts={accounts}
          transferTypes={transferTypes}
          branches={branches}
          costCenters={costCenters}
          loading={loading}
          total={total}
          page={page}
          limit={limit}
          onPageChange={setPage}
          searchQuery={searchQuery}
          setSearchQuery={(q) => {
            setSearchQuery(q);
            setPage(1);
          }}
          statusFilter={statusFilter}
          setStatusFilter={(s) => {
            setStatusFilter(s);
            setPage(1);
          }}
          typeFilter={typeFilter}
          setTypeFilter={(t) => {
            setTypeFilter(t);
            setPage(1);
          }}
          sourceAccountFilter={sourceAccountFilter}
          setSourceAccountFilter={(a) => {
            setSourceAccountFilter(a);
            setPage(1);
          }}
          destAccountFilter={destAccountFilter}
          setDestAccountFilter={(a) => {
            setDestAccountFilter(a);
            setPage(1);
          }}
          branchFilter={branchFilter}
          setBranchFilter={(b) => {
            setBranchFilter(b);
            setPage(1);
          }}
          startDateFilter={startDateFilter}
          setStartDateFilter={(d) => {
            setStartDateFilter(d);
            setPage(1);
          }}
          endDateFilter={endDateFilter}
          setEndDateFilter={(d) => {
            setEndDateFilter(d);
            setPage(1);
          }}
          onResetFilters={handleResetFilters}
          onViewDetails={(trf) => setSelectedDetailId(trf.id)}
          onEdit={(trf) => {
            setEditingTransfer(trf);
            setIsFormOpen(true);
          }}
          onSubmitForApproval={handleSubmitForApproval}
          onApprove={handleApprove}
          onReject={(trf) => setRejectModalTransfer(trf)}
          onExecute={handleExecute}
          onReceive={(trf) => setReceiptModalTransfer(trf)}
          onReverse={(trf) => setReverseModalTransfer(trf)}
          onCancel={handleCancel}
          onPrint={(trf) => setPrintModalTransfer(trf)}
          onNewTransfer={() => {
            setEditingTransfer(null);
            setIsFormOpen(true);
          }}
        />
      )}

      {/* CREATE / EDIT TRANSFER MODAL */}
      <TransferFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingTransfer(null);
        }}
        onSave={handleSaveTransfer}
        editTransfer={editingTransfer}
        accounts={accounts}
        transferTypes={transferTypes}
        branches={branches}
        costCenters={costCenters}
        submitting={submittingAction}
      />

      {/* TRANSFER DETAIL DRAWER / MODAL */}
      <TransferDetailModal
        isOpen={!!selectedDetailId}
        transferId={selectedDetailId}
        onClose={() => setSelectedDetailId(null)}
        onSubmitForApproval={handleSubmitForApproval}
        onApprove={handleApprove}
        onReject={(trf) => {
          setSelectedDetailId(null);
          setRejectModalTransfer(trf);
        }}
        onExecute={handleExecute}
        onReceive={(trf) => {
          setSelectedDetailId(null);
          setReceiptModalTransfer(trf);
        }}
        onReverse={(trf) => {
          setSelectedDetailId(null);
          setReverseModalTransfer(trf);
        }}
        onCancel={handleCancel}
        onPrint={(trf) => {
          setSelectedDetailId(null);
          setPrintModalTransfer(trf);
        }}
      />

      {/* RECEIPT CONFIRMATION MODAL */}
      <TransferReceiptModal
        isOpen={!!receiptModalTransfer}
        transfer={receiptModalTransfer}
        onClose={() => setReceiptModalTransfer(null)}
        onConfirm={handleConfirmReceipt}
        submitting={submittingAction}
      />

      {/* REVERSAL MODAL */}
      <TransferReverseModal
        isOpen={!!reverseModalTransfer}
        transfer={reverseModalTransfer}
        onClose={() => setReverseModalTransfer(null)}
        onConfirm={handleConfirmReverse}
        submitting={submittingAction}
      />

      {/* REJECT MODAL */}
      <TransferRejectModal
        isOpen={!!rejectModalTransfer}
        transfer={rejectModalTransfer}
        onClose={() => setRejectModalTransfer(null)}
        onConfirm={handleConfirmReject}
        submitting={submittingAction}
      />

      {/* PRINT OFFICIAL VOUCHER MODAL */}
      <TransferPrintVoucher
        isOpen={!!printModalTransfer}
        transfer={printModalTransfer}
        onClose={() => setPrintModalTransfer(null)}
      />

    </div>
  );
};
