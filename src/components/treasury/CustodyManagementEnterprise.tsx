import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  Plus,
  Clock,
  Send,
  X
} from "lucide-react";
import { api } from "../../utils/api";
import { TreasuryCustody, TreasuryCustodyType, TreasuryAccount } from "../../types";
import { CustodyDashboardView } from "./custody/CustodyDashboardView";
import { CustodyListView } from "./custody/CustodyListView";
import { CustodyFormModal } from "./custody/CustodyFormModal";
import { CustodyDetailModal } from "./custody/CustodyDetailModal";
import { CustodySettlementModal } from "./custody/CustodySettlementModal";
import { CustodyPrintVoucher } from "./custody/CustodyPrintVoucher";

interface CustodyManagementProps {
  accounts: TreasuryAccount[];
  employees: any[];
  branches: any[];
  costCenters: any[];
  onRefreshTreasury?: () => void;
}

export const CustodyManagementEnterprise: React.FC<CustodyManagementProps> = ({
  accounts,
  employees,
  branches,
  costCenters,
  onRefreshTreasury
}) => {
  const [subTab, setSubTab] = useState<'dashboard' | 'list'>('dashboard');

  // Core Custody Data
  const [custodies, setCustodies] = useState<TreasuryCustody[]>([]);
  const [custodyTypes, setCustodyTypes] = useState<TreasuryCustodyType[]>([]);
  const [dashboardData, setDashboardData] = useState<{
    summary: any;
    byCategory: any[];
    overdueList: any[];
    pendingList: any[];
  } | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [filterAccount, setFilterAccount] = useState("all");
  const [filterOverdueOnly, setFilterOverdueOnly] = useState(false);

  // Modals & Drawers
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedCustodyForDetails, setSelectedCustodyForDetails] = useState<number | null>(null);
  const [selectedCustodyForSettlement, setSelectedCustodyForSettlement] = useState<TreasuryCustody | null>(null);
  const [selectedCustodyForPrint, setSelectedCustodyForPrint] = useState<TreasuryCustody | null>(null);

  // Extend Due Date Dialog State
  const [extendModalCustody, setExtendModalCustody] = useState<TreasuryCustody | null>(null);
  const [newDueDate, setNewDueDate] = useState("");
  const [extendReason, setExtendReason] = useState("");

  // Reminder Dialog State
  const [reminderModalCustody, setReminderModalCustody] = useState<TreasuryCustody | null>(null);
  const [reminderMessage, setReminderMessage] = useState("");
  const cashCustodyTypes = custodyTypes.filter((type) =>
    type.requires_treasury &&
    !type.requires_asset &&
    !type.requires_inventory &&
    ["cash", "temporary", "permanent"].includes(type.category)
  );

  const fetchCustodies = async () => {
    try {
      let url = `/api/treasury/custodies?search=${encodeURIComponent(searchQuery)}&status=${filterStatus}&category=${filterCategory}&employee_id=${filterEmployee}&account_id=${filterAccount}`;
      if (filterOverdueOnly) url += `&is_overdue=true`;
      const res = await api.get(url);
      if (res.ok) {
        setCustodies(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCustodyTypes = async () => {
    try {
      const res = await api.get("/api/treasury/custody-types");
      if (res.ok) {
        setCustodyTypes(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const res = await api.get("/api/treasury/custodies/dashboard");
      if (res.ok) {
        setDashboardData(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const refreshAll = () => {
    fetchCustodies();
    fetchCustodyTypes();
    fetchDashboardStats();
    if (onRefreshTreasury) onRefreshTreasury();
  };

  useEffect(() => {
    fetchCustodyTypes();
    fetchDashboardStats();
  }, []);

  useEffect(() => {
    fetchCustodies();
  }, [searchQuery, filterStatus, filterCategory, filterEmployee, filterAccount, filterOverdueOnly]);

  // Actions
  const handleCreateSubmit = async (formData: any, actionType: string) => {
    const res = await api.post("/api/treasury/custodies", formData);
    if (res.ok) {
      setShowNewModal(false);
      refreshAll();
      alert(
        actionType === 'draft'
          ? "تم حفظ مسودة العهدة بنجاح"
          : actionType === 'direct_issue'
          ? "تم اعتماد وصرف العهدة النقدية بنجاح"
          : "تم تقديم طلب العهدة للاعتماد بنجاح"
      );
    } else {
      const err = await res.json();
      throw new Error(err.error || "فشل تسجيل العهدة");
    }
  };

  const handleApprove = async (id: number) => {
    if (!window.confirm("هل أنت متأكد من اعتماد وموافقة طلب العهدة؟")) return;
    try {
      const res = await api.post(`/api/treasury/custodies/${id}/approve`, {});
      if (res.ok) {
        alert("تم اعتماد طلب العهدة بنجاح");
        refreshAll();
      } else {
        const err = await res.json();
        alert(`فشل الاعتماد: ${err.error}`);
      }
    } catch (e) {}
  };

  const handleReject = async (id: number) => {
    const reason = window.prompt("سبب رفض طلب العهدة:");
    if (reason === null) return;
    try {
      const res = await api.post(`/api/treasury/custodies/${id}/reject`, { reason });
      if (res.ok) {
        alert("تم رفض طلب العهدة");
        refreshAll();
      } else {
        const err = await res.json();
        alert(`فشل الرفض: ${err.error}`);
      }
    } catch (e) {}
  };

  const handleIssue = async (custody: TreasuryCustody) => {
    if (!window.confirm(`هل تم صرف وتسليم مبلغ ${Number(custody.amount).toLocaleString()} ج.م فعلياً للموظف (${custody.employee_name})؟`)) return;
    try {
      const res = await api.post(`/api/treasury/custodies/${custody.id}/issue`, {});
      if (res.ok) {
        alert("تم صرف وتسليم العهدة وتسجيل سند الصرف بالخزينة");
        refreshAll();
      } else {
        const err = await res.json();
        alert(`فشل الصرف: ${err.error}`);
      }
    } catch (e) {}
  };

  const handleSettlementSubmit = async (settlementData: any) => {
    const res = await api.post(`/api/treasury/custodies/${settlementData.custody_id}/settle`, settlementData);
    if (res.ok) {
      setSelectedCustodyForSettlement(null);
      refreshAll();
      alert("تمت تسوية وتصفية العهدة وترحيل القيود وسندات الخزينة بنجاح");
    } else {
      const err = await res.json();
      throw new Error(err.error || "فشل إتمام التسوية");
    }
  };

  const handleExtendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendModalCustody || !newDueDate) return;
    try {
      const res = await api.post(`/api/treasury/custodies/${extendModalCustody.id}/extend`, {
        new_due_date: newDueDate,
        reason: extendReason
      });
      if (res.ok) {
        alert("تم تمديد تاريخ استحقاق العهدة بنجاح");
        setExtendModalCustody(null);
        setNewDueDate("");
        setExtendReason("");
        refreshAll();
      } else {
        const err = await res.json();
        alert(`فشل التمديد: ${err.error}`);
      }
    } catch (e) {}
  };

  const handleReminderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderModalCustody) return;
    try {
      const res = await api.post(`/api/treasury/custodies/${reminderModalCustody.id}/send-reminder`, {
        custom_message: reminderMessage
      });
      if (res.ok) {
        alert("تم إرسال إشعار التنبيه بنجاح للموظف وتوثيق الإجراء");
        setReminderModalCustody(null);
        setReminderMessage("");
        refreshAll();
      } else {
        const err = await res.json();
        alert(`فشل إرسال التنبيه: ${err.error}`);
      }
    } catch (e) {}
  };

  return (
    <div className="space-y-6 flex-1 text-right">
      {/* Top Header & Sub-Tabs Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            إدارة العهد والأمانات للموظفين (Enterprise Custody Management)
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            دورة متكاملة: طلب العهدة • الاعتمادات • الصرف • إثبات الفواتير • الاسترجاع العيني • التسوية والترحيل العام
          </p>
        </div>

        {/* Sub Tabs Toggle Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80">
          <button
            onClick={() => setSubTab('dashboard')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
              subTab === 'dashboard'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>المؤشرات</span>
          </button>

          <button
            onClick={() => setSubTab('list')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
              subTab === 'list'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>سجل العهد</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: DASHBOARD */}
      {subTab === 'dashboard' && (
        <CustodyDashboardView
          summary={dashboardData?.summary || null}
          byCategory={dashboardData?.byCategory || []}
          overdueList={dashboardData?.overdueList || []}
          pendingList={dashboardData?.pendingList || []}
          onViewCustody={(c) => setSelectedCustodyForDetails(c.id)}
          onNewCustody={() => setShowNewModal(true)}
          onFilterOverdue={() => {
            setFilterOverdueOnly(true);
            setSubTab('list');
          }}
          onFilterPending={() => {
            setFilterStatus('pending_approval');
            setSubTab('list');
          }}
        />
      )}

      {/* SUB-TAB 2: LIST / REGISTER */}
      {subTab === 'list' && (
        <CustodyListView
          custodies={custodies}
          custodyTypes={custodyTypes}
          accounts={accounts}
          employees={employees}
          branches={branches}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          filterCategory={filterCategory}
          setFilterCategory={setFilterCategory}
          filterEmployee={filterEmployee}
          setFilterEmployee={setFilterEmployee}
          filterAccount={filterAccount}
          setFilterAccount={setFilterAccount}
          filterOverdueOnly={filterOverdueOnly}
          setFilterOverdueOnly={setFilterOverdueOnly}
          onNewCustody={() => setShowNewModal(true)}
          onViewDetails={(c) => setSelectedCustodyForDetails(c.id)}
          onApprove={handleApprove}
          onReject={handleReject}
          onIssueCustody={handleIssue}
          onOpenSettlement={(c) => setSelectedCustodyForSettlement(c)}
          onPrintVoucher={(c) => setSelectedCustodyForPrint(c)}
          onExtendDueDate={(c) => {
            setExtendModalCustody(c);
            setNewDueDate(c.due_date ? c.due_date.split('T')[0] : "");
          }}
          onSendReminder={(c) => {
            setReminderModalCustody(c);
            setReminderMessage(`عناية الزميل ${c.employee_name}، نود تذكيركم بموعد تصفية العهدة رقم ${c.custody_number || c.id} المستحقة.`);
          }}
        />
      )}

      {/* ── MODALS ── */}

      {/* 1. New Custody Modal */}
      <CustodyFormModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        onSubmit={handleCreateSubmit}
        custodyTypes={cashCustodyTypes}
        cashOnly
        accounts={accounts}
        employees={employees}
        branches={branches}
        costCenters={costCenters}
      />

      {/* 2. 360° Detail Modal */}
      <CustodyDetailModal
        isOpen={Boolean(selectedCustodyForDetails)}
        custodyId={selectedCustodyForDetails}
        onClose={() => setSelectedCustodyForDetails(null)}
        onRefresh={refreshAll}
        onOpenSettlement={(c) => {
          setSelectedCustodyForDetails(null);
          setSelectedCustodyForSettlement(c);
        }}
        onPrintVoucher={(c) => {
          setSelectedCustodyForPrint(c);
        }}
        onExtendDueDate={(c) => {
          setExtendModalCustody(c);
          setNewDueDate(c.due_date ? c.due_date.split('T')[0] : "");
        }}
        onSendReminder={(c) => {
          setReminderModalCustody(c);
          setReminderMessage(`عناية الزميل ${c.employee_name}، نود تذكيركم بموعد تصفية العهدة رقم ${c.custody_number || c.id} المستحقة.`);
        }}
        accounts={accounts}
        costCenters={costCenters}
      />

      {/* 3. Settlement Modal */}
      <CustodySettlementModal
        isOpen={Boolean(selectedCustodyForSettlement)}
        custody={selectedCustodyForSettlement}
        accounts={accounts}
        onClose={() => setSelectedCustodyForSettlement(null)}
        onSubmit={handleSettlementSubmit}
      />

      {/* 4. Print Voucher Modal */}
      <CustodyPrintVoucher
        isOpen={Boolean(selectedCustodyForPrint)}
        custody={selectedCustodyForPrint}
        onClose={() => setSelectedCustodyForPrint(null)}
      />

      {/* 5. Extend Due Date Dialog */}
      {extendModalCustody && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                تمديد تاريخ استحقاق العهدة
              </h4>
              <button
                onClick={() => setExtendModalCustody(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExtendSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">تاريخ الاستحقاق الجديد</label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">مبرر وسبب التمديد</label>
                <textarea
                  placeholder="اكتب سبب طلب أو موافقة التمديد..."
                  value={extendReason}
                  onChange={(e) => setExtendReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs min-h-[70px]"
                  required
                ></textarea>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setExtendModalCustody(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 text-xs rounded-xl font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-sm"
                >
                  حفظ التمديد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Send Reminder Dialog */}
      {reminderModalCustody && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-600" />
                إرسال تنبيه بالمطالبة والتسوية للموظف
              </h4>
              <button
                onClick={() => setReminderModalCustody(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReminderSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">نص رسالة التنبيه</label>
                <textarea
                  value={reminderMessage}
                  onChange={(e) => setReminderMessage(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs min-h-[90px]"
                  required
                ></textarea>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReminderModalCustody(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 text-xs rounded-xl font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-sm"
                >
                  إرسال التنبيه الآن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
