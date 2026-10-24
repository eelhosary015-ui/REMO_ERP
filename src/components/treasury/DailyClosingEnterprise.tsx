import React, { useState, useEffect, useCallback } from "react";
import { authHeaders } from "../../utils/api";
import {
  Calculator,
  Layers,
  ShieldCheck,
  Building2,
  Calendar,
  DollarSign,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  Printer,
  Sparkles,
  ArrowRightLeft
} from "lucide-react";
import { DenominationCalculator } from "./closings/DenominationCalculator";
import { ClosingArchiveTable } from "./closings/ClosingArchiveTable";
import { ClosingDetailModal } from "./closings/ClosingDetailModal";
import { ClosingPrintVoucher } from "./closings/ClosingPrintVoucher";
import { CashVarianceReportView } from "./closings/CashVarianceReportView";
import { TreasuryAccount, TreasuryClosing } from "../../types";

interface DailyClosingEnterpriseProps {
  treasuries: TreasuryAccount[];
  currentUser?: any;
  onRefreshTreasuries?: () => void;
}

export const DailyClosingEnterprise: React.FC<DailyClosingEnterpriseProps> = ({
  treasuries,
  currentUser,
  onRefreshTreasuries
}) => {
  const [activeTab, setActiveTab] = useState<'closing_workspace' | 'variance_report'>('closing_workspace');
  // Selected Treasury for Calculator
  const [selectedTreasuryId, setSelectedTreasuryId] = useState<number | null>(
    treasuries.length > 0 ? treasuries[0].id : null
  );

  // Archive & Filters State
  const [closings, setClosings] = useState<TreasuryClosing[]>([]);
  const [isLoadingArchive, setIsLoadingArchive] = useState(false);
  const [filterTreasuryId, setFilterTreasuryId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [summary, setSummary] = useState<any>({
    total_closings: 0,
    matched_count: 0,
    deficit_count: 0,
    surplus_count: 0,
    total_book_amount: 0,
    total_actual_amount: 0,
    total_variance_amount: 0
  });

  // Modals state
  const [selectedClosingForDetail, setSelectedClosingForDetail] = useState<TreasuryClosing | null>(null);
  const [selectedClosingForPrint, setSelectedClosingForPrint] = useState<TreasuryClosing | null>(null);

  // Fetch Archive records
  const fetchArchive = useCallback(async () => {
    setIsLoadingArchive(true);
    try {
      const params = new URLSearchParams();
      if (filterTreasuryId && filterTreasuryId !== "all") params.set("treasury_id", filterTreasuryId);
      if (filterStatus && filterStatus !== "all") params.set("status", filterStatus);
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      params.set("page", String(currentPage));
      params.set("limit", "8");

      const res = await fetch(`/api/treasury/closings-archive?${params.toString()}`, {
        headers: authHeaders()
      });

      if (!res.ok) throw new Error("فشل جلب سجلات الإقفال");

      const data = await res.json();
      setClosings(data.closings || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalRecords(data.pagination?.total || 0);
      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (err: any) {
      console.error("Error fetching closings archive:", err);
    } finally {
      setIsLoadingArchive(false);
    }
  }, [filterTreasuryId, filterStatus, startDate, endDate, searchQuery, currentPage]);

  useEffect(() => {
    fetchArchive();
  }, [fetchArchive]);

  // Handle successful closing creation
  const handleClosingSuccess = (newClosingData: any) => {
    fetchArchive();
    if (onRefreshTreasuries) {
      onRefreshTreasuries();
    }
  };

  return (
    <div id="daily-closing-enterprise-module" className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900">
                الإقفال اليومي والجرد الفعلي للنقدية
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Remo Enterprise Cash Verification
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              حاسبة فئات النقدية التفاعلية، تدقيق ومطابقة الرصيد الفعلي مع الدفتري، وتوثيق سجلات الأرشيف
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Subview Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('closing_workspace')}
              className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                activeTab === 'closing_workspace'
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              الجرد والإقفال اليومي
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('variance_report')}
              className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                activeTab === 'variance_report'
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              تقرير الفروقات والعجز
            </button>
          </div>

          <button
            type="button"
            onClick={() => fetchArchive()}
            className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingArchive ? "animate-spin text-indigo-600" : ""}`} />
            تحديث
          </button>
        </div>
      </div>

      {/* 2. Main Tab View Rendering */}
      {activeTab === 'variance_report' ? (
        <CashVarianceReportView treasuries={treasuries} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Right Panel: Interactive Denomination Calculator (5 cols on xl) */}
          <div className="xl:col-span-5 w-full">
            <DenominationCalculator
              treasuries={treasuries}
              selectedTreasuryId={selectedTreasuryId}
              onSelectTreasury={(id) => setSelectedTreasuryId(id)}
              onClosingSuccess={handleClosingSuccess}
              currentUser={currentUser}
            />
          </div>

          {/* Left Panel: Closing & Audit Archive Table (7 cols on xl) */}
          <div className="xl:col-span-7 w-full">
            <ClosingArchiveTable
              closings={closings}
              treasuries={treasuries}
              isLoading={isLoadingArchive}
              onRefresh={fetchArchive}
              onViewDetails={(closing) => setSelectedClosingForDetail(closing)}
              onPrintVoucher={(closing) => setSelectedClosingForPrint(closing)}
              filterTreasuryId={filterTreasuryId}
              onFilterTreasuryChange={(val) => { setFilterTreasuryId(val); setCurrentPage(1); }}
              startDate={startDate}
              onStartDateChange={(val) => { setStartDate(val); setCurrentPage(1); }}
              endDate={endDate}
              onEndDateChange={(val) => { setEndDate(val); setCurrentPage(1); }}
              filterStatus={filterStatus}
              onFilterStatusChange={(val) => { setFilterStatus(val); setCurrentPage(1); }}
              searchQuery={searchQuery}
              onSearchQueryChange={(val) => { setSearchQuery(val); setCurrentPage(1); }}
              currentPage={currentPage}
              totalPages={totalPages}
              totalRecords={totalRecords}
              onPageChange={(page) => setCurrentPage(page)}
              summary={summary}
            />
          </div>
        </div>
      )}

      {/* 3. Detail Modal */}
      {selectedClosingForDetail && (
        <ClosingDetailModal
          closing={selectedClosingForDetail}
          onClose={() => setSelectedClosingForDetail(null)}
          onPrint={(closing) => {
            setSelectedClosingForDetail(null);
            setSelectedClosingForPrint(closing);
          }}
          onReviewedSuccess={() => {
            fetchArchive();
            if (onRefreshTreasuries) onRefreshTreasuries();
          }}
        />
      )}

      {/* 4. Print Voucher Modal */}
      {selectedClosingForPrint && (
        <ClosingPrintVoucher
          closing={selectedClosingForPrint}
          onClose={() => setSelectedClosingForPrint(null)}
        />
      )}
    </div>
  );
};
export default DailyClosingEnterprise;
