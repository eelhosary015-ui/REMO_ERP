import React, { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import {
  ChevronLeft,
  Search,
  FileText,
  Download,
  Printer,
  BarChart3,
  PhoneCall,
  Warehouse,
  Truck,
  DollarSign,
  ChefHat,
  Edit,
  X,
  Eye,
  MessageSquareWarning,
  Globe,
} from "lucide-react";
import * as XLSX from "xlsx";
import { OrderEditorModal } from "./OrderEditorModal";
import { ReceiptPrintModal } from "./ReceiptPrintModal";
import { api } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { GlobalReportPrint } from "./GlobalReportPrint";
import { downloadElementAsWord } from "../utils/wordExport";
import { POSDetailedReports } from "./POSDetailedReports";

interface BranchReportsProps {
  onBack: () => void;
  hideHeader?: boolean;
  initialTab?: string;
}

export const BranchReports: React.FC<BranchReportsProps> = ({
  onBack,
  hideHeader = false,
  initialTab,
}) => {
  const { user, canEdit, canDelete, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<
    | "sales"
    | "cancelled_orders"
    | "pos_dashboard"
    | "call_center"
    | "warehouse"
    | "delivery"
    | "delivery_drivers"
    | "kitchen"
    | "web_orders"
    | "modifications"
    | "complaints"
    | "pos_detailed_reports"
  >(
    (initialTab as any) ||
      (localStorage.getItem("reports_activeTab") as any) ||
      "sales",
  );

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab as any);
    }
  }, [initialTab]);
  const [startDate, setStartDate] = useState(
    localStorage.getItem("reports_startDate") ||
      new Date(new Date().setDate(1)).toISOString().split("T")[0],
  );
  const [endDate, setEndDate] = useState(
    localStorage.getItem("reports_endDate") ||
      new Date().toISOString().split("T")[0],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const [orderTypeFilter, setOrderTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedBranch, setSelectedBranch] = useState(
    localStorage.getItem("reports_selectedBranch") ||
      (user?.branch_id ? user.branch_id.toString() : "all"),
  );
  const [selectedUser, setSelectedUser] = useState(
    localStorage.getItem("reports_selectedUser") ||
      (user?.role === "admin" || hasPermission("branch_reports.all_users")
        ? "all"
        : user?.id?.toString() || "all"),
  );

  useEffect(() => {
    localStorage.setItem("reports_activeTab", activeTab);
    localStorage.setItem("reports_startDate", startDate);
    localStorage.setItem("reports_endDate", endDate);
    localStorage.setItem("reports_selectedBranch", selectedBranch);
    localStorage.setItem("reports_selectedUser", selectedUser);
  }, [activeTab, startDate, endDate, selectedBranch, selectedUser]);

  useEffect(() => {
    if (user && user.role !== "admin") {
      // Only set defaults if not already set or if user changed
      if (user.branch_id && selectedBranch === "all") {
        setSelectedBranch(user.branch_id.toString());
      }
      if (
        !hasPermission("branch_reports.all_users") &&
        selectedUser === "all" &&
        user.id
      ) {
        setSelectedUser(user.id.toString());
      }

      // Smart default tab selection (only on first load)
      if (
        activeTab === "sales" &&
        user.permissions?.["branch_reports.call_center"] === true &&
        user.permissions?.["branch_reports.sales"] !== true
      ) {
        setActiveTab("call_center");
      }
    }
  }, [user]);
  const [branches, setBranches] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [printingReceiptOrderId, setPrintingReceiptOrderId] = useState<
    number | null
  >(null);
  const [viewingModification, setViewingModification] = useState<any | null>(
    null,
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    fetchBranches();
    if (user?.role === "admin" || hasPermission("branch_reports.all_users")) {
      fetchUsers();
    }
  }, [user]);

  useEffect(() => {
    setData([]); // Clear data when tab changes to avoid stale data
    setCurrentPage(1); // Reset page on filter change
    fetchData();
  }, [
    activeTab,
    startDate,
    endDate,
    selectedBranch,
    selectedUser,
    orderTypeFilter,
    statusFilter,
  ]);

  const fetchBranches = async () => {
    try {
      const res = await api.get("/api/branches");
      if (res.ok) {
        const data = await res.json();
        setBranches(data);
      }
    } catch (error) {
      console.error("Failed to fetch branches", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
      }
    } catch (error) {
      console.error("Failed to fetch users", error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      let endpoint = "";
      switch (activeTab) {
        case "sales":
        case "pos_dashboard":
          endpoint = `/api/reports/branch/sales?startDate=${startDate}&endDate=${endDate}&branchId=${selectedBranch}&userId=${selectedUser}&orderType=${orderTypeFilter}&status=${statusFilter}`;
          break;
        case "cancelled_orders":
          endpoint = `/api/reports/branch/sales?startDate=${startDate}&endDate=${endDate}&branchId=${selectedBranch}&userId=${selectedUser}&orderType=${orderTypeFilter}&status=cancelled`;
          break;
        case "call_center":
          endpoint = `/api/reports/branch/call-center?startDate=${startDate}&endDate=${endDate}&branchId=${selectedBranch}&userId=${selectedUser}`;
          break;
        case "warehouse":
          endpoint = `/api/reports/branch/warehouse?startDate=${startDate}&endDate=${endDate}&branchId=${selectedBranch}`;
          break;
        case "delivery":
          endpoint = `/api/reports/branch/delivery?startDate=${startDate}&endDate=${endDate}&branchId=${selectedBranch}`;
          break;
        case "delivery_drivers":
          endpoint = `/api/reports/branch/delivery-drivers?startDate=${startDate}&endDate=${endDate}&branchId=${selectedBranch}`;
          break;
        case "kitchen":
          endpoint = `/api/reports/branch/kitchen?startDate=${startDate}&endDate=${endDate}&branchId=${selectedBranch}`;
          break;
        case "web_orders":
          endpoint = `/api/reports/branch/web-orders?startDate=${startDate}&endDate=${endDate}&branchId=${selectedBranch}`;
          break;
        case "modifications":
          endpoint = `/api/reports/orders/modifications?startDate=${startDate}&endDate=${endDate}&branchId=${selectedBranch}`;
          break;
        case "complaints":
          endpoint = `/api/reports/branch/complaints?startDate=${startDate}&endDate=${endDate}&branchId=${selectedBranch}`;
          break;
      }

      const res = await api.get(endpoint);
      if (res.ok) {
        const result = await res.json();
        setData(Array.isArray(result) ? result : []);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error("Failed to fetch report data", error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `report_${activeTab}_${startDate}_${endDate}.xlsx`);
  };

  const exportToWord = () => {
    downloadElementAsWord("report-content", `report_${activeTab}_${startDate}_${endDate}`, tabTitles[activeTab] || "تقرير الفروع");
  };

  const parseReportAmount = (value: any) => {
    const amount =
      typeof value === "string"
        ? parseFloat(value.replace(/[^0-9.-]+/g, ""))
        : Number(value);
    return isNaN(amount) ? 0 : amount;
  };

  const filteredData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    const paymentMethodMap: Record<string, string> = {
      cash: 'كاش',
      visa: 'فيزا',
      mastercard: 'ماستر كارد',
      instapay: 'إنستا باي',
      wallet: 'محفظة موبايل',
      credit: 'آجل',
      mixed: 'دفع مختلط'
    };
    return data.filter((item) => {
      // Payment Method Filter
      if (paymentMethodFilter !== "all") {
        const itemPaymentMethod = item["طريقة الدفع"];
        if (!itemPaymentMethod) return false;
        const expectedArabic = paymentMethodMap[paymentMethodFilter];
        if (expectedArabic && itemPaymentMethod !== expectedArabic)
          return false;
      }

      if (!searchQuery) return true;
      const searchString = Object.values(item).join(" ").toLowerCase();
      return searchString.includes(searchQuery.toLowerCase());
    });
  }, [data, searchQuery, paymentMethodFilter]);

  const paginatedData = useMemo(() => {
    if (pageSize === -1) return filteredData;
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const salesBreakdown = useMemo(() => {
    if (
      activeTab !== "sales" &&
      activeTab !== "cancelled_orders" &&
      activeTab !== "pos_dashboard" &&
      activeTab !== "call_center"
    )
      return { total: 0, cash: 0, wallet: 0, visa: 0, instapay: 0, mastercard: 0, credit: 0, mixed: 0, subtotal: 0, discount: 0, tax: 0, serviceCharge: 0, itemCount: 0 };
    const paymentBreakdownMap: Record<string, string> = {
      'كاش': 'cash',
      'محفظة': 'wallet',
      'محفظة موبايل': 'wallet',
      'فيزا': 'visa',
      'ماستر كارد': 'mastercard',
      'إنستا باي': 'instapay',
      'آجل': 'credit',
      'دفع مختلط': 'mixed'
    };
    return filteredData.reduce(
      (acc, row) => {
        const val = parseReportAmount(row["الصافي"] || row["الإجمالي (ج.م)"] || "0");
        acc.total += val;
        const pm = row["طريقة الدفع"];
        const pmKey = paymentBreakdownMap[pm] || 'cash';
        if (acc[pmKey] !== undefined) acc[pmKey] += val;
        else acc.cash += val;
        acc.subtotal += parseReportAmount(row["المبلغ قبل الخصم"] || "0");
        acc.discount += parseReportAmount(row["الخصم"] || "0");
        acc.tax += parseReportAmount(row["الضريبة"] || "0");
        acc.serviceCharge += parseReportAmount(row["رسوم الخدمة"] || "0");
        acc.itemCount += Number(row["عدد الأصناف"]) || 0;
        return acc;
      },
      { total: 0, cash: 0, wallet: 0, visa: 0, instapay: 0, mastercard: 0, credit: 0, mixed: 0, subtotal: 0, discount: 0, tax: 0, serviceCharge: 0, itemCount: 0 },
    );
  }, [filteredData, activeTab]);

  const totalSales = useMemo(() => {
    if (
      activeTab !== "call_center" &&
      activeTab !== "sales" &&
      activeTab !== "cancelled_orders" &&
      activeTab !== "pos_dashboard" &&
      activeTab !== "web_orders"
    )
      return 0;
    return filteredData.reduce(
      (acc, row) => acc + parseReportAmount(row["الإجمالي (ج.م)"] || "0"),
      0,
    );
  }, [filteredData, activeTab]);

  const posDashboardStats = useMemo(() => {
    const groupByAmount = (
      key: string,
    ): Record<string, { count: number; total: number }> =>
      filteredData.reduce<Record<string, { count: number; total: number }>>((acc, row) => {
        const label = row[key] || "غير محدد";
        if (!acc[label]) acc[label] = { count: 0, total: 0 };
        acc[label].count += 1;
        acc[label].total += parseReportAmount(row["الإجمالي (ج.م)"] || "0");
        return acc;
      }, {});

    const paymentMix = groupByAmount("طريقة الدفع");
    const orderTypeMix = groupByAmount("نوع الطلب");
    const cashierPerformance = Object.entries(groupByAmount("الكاشير"))
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, 5);

    const topProducts = Object.entries(
      filteredData.reduce<Record<string, { count: number; total: number }>>((acc, row) => {
        const items = Number(row["عدد الأصناف"]) || 1;
        const source = row["مصدر الطلب"] || "غير محدد";
        if (!acc[source]) acc[source] = { count: 0, total: 0 };
        acc[source].count += 1;
        acc[source].total += parseReportAmount(row["الصافي"] || row["الإجمالي (ج.م)"] || "0");
        return acc;
      }, {})
    ).sort(([, a], [, b]) => b.total - a.total);

    return {
      invoices: filteredData.length,
      averageTicket:
        filteredData.length > 0 ? salesBreakdown.total / filteredData.length : 0,
      paymentMix,
      orderTypeMix,
      cashierPerformance,
      totalItems: salesBreakdown.itemCount,
      sourceMix: Object.fromEntries(topProducts),
    };
  }, [filteredData, salesBreakdown.total, salesBreakdown.itemCount]);

  const cancelOrder = async (orderId: number) => {
    if (!confirm(`هل أنت متأكد من إلغاء الطلب رقم ${orderId}؟`)) return;

    try {
      const res = await api.post(`/api/orders/${orderId}/cancel`, {
        notes: "تم الإلغاء من تقارير الفروع",
      });
      if (res.ok) {
        fetchData();
        alert("تم إلغاء الطلب بنجاح");
      } else {
        alert("فشل إلغاء الطلب");
      }
    } catch (error) {
      console.error("Failed to cancel order", error);
    }
  };

  const reprintOrder = async (orderId: number) => {
    try {
      const res = await api.post(`/api/orders/${orderId}/print`, {});
      if (res.ok) {
        alert("تم إرسال أمر الطباعة بنجاح");
      } else {
        alert("فشل طباعة الإيصال");
      }
    } catch (error) {
      console.error("Failed to print order", error);
      alert("حدث خطأ أثناء الطباعة");
    }
  };

  const renderCallCenterSummary = () => {
    if (activeTab !== "call_center" || filteredData.length === 0) return null;

    const summary: Record<string, { count: number; total: number }> = {};
    filteredData.forEach((row: any) => {
      const employee = row["الموظف"] || "غير معروف";
      const totalStr =
        row["الإجمالي (ج.م)"]?.toString().replace(/,/g, "") || "0";
      const total = parseFloat(totalStr) || 0;
      if (!summary[employee]) {
        summary[employee] = { count: 0, total: 0 };
      }
      summary[employee].count += 1;
      summary[employee].total += total;
    });

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Object.entries(summary).map(([employee, data]) => (
          <div
            key={employee}
            className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200"
          >
            <h3 className="text-slate-500 font-bold mb-2 text-sm">
              {employee}
            </h3>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs text-slate-400">عدد الأوردرات</p>
                <p className="text-xl font-bold text-slate-900">{data.count}</p>
              </div>
              <div className="text-left">
                <p className="text-xs text-slate-400 text-left">
                  إجمالي المبيعات
                </p>
                <p className="text-xl font-bold text-emerald-600">
                  {Number(data.total || 0 || 0).toLocaleString()} ج.م
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const formatDetails = (details: any) => {
    if (!details) return "";
    let parsed = details;
    if (typeof details === "string" && details.startsWith("{")) {
      try {
        parsed = JSON.parse(details);
      } catch (e) {
        return details;
      }
    }

    if (typeof parsed !== "object") return details;

    const translations: { [key: string]: string } = {
      id: "رقم الطلب",
      branch_id: "رقم الفرع",
      table_number: "رقم الطاولة",
      customer_name: "اسم العميل",
      customer_phone: "رقم الهاتف",
      customer_phone_2: "رقم الهاتف 2",
      customer_address: "العنوان",
      delivery_time: "وقت التوصيل",
      notes: "ملاحظات",
      order_type: "نوع الطلب",
      timestamp: "تاريخ الطلب",
      total: "الإجمالي",
      status: "الحالة",
      is_paid: "تم الدفع",
      action: "نوع العملية",
      user: "المستخدم المنفذ",
      old_total: "الإجمالي القديم",
      new_total: "الإجمالي الجديد",
      payment_method: "طريقة الدفع",
    };

    const formatValue = (key: string, value: any) => {
      if (value === null || value === undefined) return "---";
      if (key === "action") {
        if (value === "pos_void_edit") return "تعديل أوردر من نقطة البيع (Void Edit)";
        if (value === "pos_void_cancel") return "إلغاء / استرجاع أوردر من نقطة البيع (Void)";
        return value;
      }
      if (key === "order_type") {
        const types: any = {
          dine_in: "داخل المطعم",
          takeaway: "سفري",
          delivery: "توصيل",
        };
        return types[value] || value;
      }
      if (key === "status") {
        const statuses: any = {
          pending: "قيد الانتظار",
          preparing: "جاري التحضير",
          ready: "جاهز",
          delivered: "تم التوصيل",
          cancelled: "ملغي",
        };
        return statuses[value] || value;
      }
      if (key === "is_paid") return value === 1 ? "نعم" : "لا";
      return value.toString();
    };

    return (
      <div className="space-y-1 text-right">
        {Object.entries(parsed).map(([key, value]) => {
          if (key === "changes" && Array.isArray(value) && value.length > 0) {
            return (
              <div
                key={key}
                className="mt-4 border-t border-slate-200 pt-2 bg-blue-50/30 p-3 rounded-xl"
              >
                <p className="text-xs text-blue-600 mb-2 font-bold">
                  التعديلات التي تمت:
                </p>
                <div className="space-y-2">
                  {value.map((change: any, i: number) => (
                    <div
                      key={i}
                      className="text-xs border-b border-blue-100 pb-1 last:border-0"
                    >
                      <p className="font-bold text-slate-900">
                        {change.product_name}
                      </p>
                      <p className="text-slate-500">
                        {change.type === "added" &&
                          `تمت إضافة ${change.new_quantity} قطعة`}
                        {change.type === "removed" &&
                          `تم حذف الصنف (كان ${change.old_quantity} قطعة)`}
                        {change.type === "modified" &&
                          `تغيير الكمية من ${change.old_quantity} إلى ${change.new_quantity}`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          if ((key === "items" || key === "old_items") && Array.isArray(value)) {
            return (
              <div key={key} className="mt-4 border-t border-slate-200 pt-2">
                <p className="text-xs text-slate-400 mb-2 font-bold">
                  {key === "old_items" ? "الأصناف قبل التعديل:" : "أصناف الطلب الملغي:"}
                </p>
                <div className="space-y-1">
                  {value.map((item: any, i: number) => (
                    <div
                      key={i}
                      className="flex justify-between text-xs bg-slate-50 p-2 rounded"
                    >
                      <span className="font-bold text-slate-900">
                        {Number(item.price || 0) * Number(item.quantity || 1)} ج.م
                      </span>
                      <span className="text-slate-700">
                        {item.product_name} (x{item.quantity})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          if (key === "new_items" && Array.isArray(value)) {
            return (
              <div key={key} className="mt-4 border-t border-slate-200 pt-2">
                <p className="text-xs text-emerald-600 mb-2 font-bold">
                  الأصناف بعد التعديل:
                </p>
                <div className="space-y-1">
                  {value.map((item: any, i: number) => (
                    <div
                      key={i}
                      className="flex justify-between text-xs bg-emerald-50/60 p-2 rounded"
                    >
                      <span className="font-bold text-emerald-900">
                        {Number(item.price || 0) * Number(item.quantity || 1)} ج.م
                      </span>
                      <span className="text-slate-700">
                        {item.product_name} (x{item.quantity})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          if (key === "changes") return null; // Skip empty changes
          return (
            <div
              key={key}
              className="flex justify-between gap-4 border-b border-slate-50 py-1 last:border-0"
            >
              <span className="text-slate-900 font-bold">
                {formatValue(key, value)}
              </span>
              <span className="text-slate-400 text-xs">
                {translations[key] || key}:
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderSummary = () => {
    if (
      activeTab !== "call_center" &&
      activeTab !== "sales" &&
      activeTab !== "cancelled_orders" &&
      activeTab !== "pos_dashboard" &&
      activeTab !== "web_orders"
    )
      return null;

    if (loading) {
      return (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 animate-pulse"
            >
              <div className="h-3 bg-slate-100 rounded w-3/4 mb-3"></div>
              <div className="h-5 bg-slate-100 rounded w-1/2 mb-1"></div>
              <div className="h-2 bg-slate-50 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-200 flex flex-col justify-between"
        >
          <p className="text-[10px] text-slate-500 font-bold">إجمالي المبيعات الصافي</p>
          <p className="text-lg font-black text-emerald-600 mt-1">
            {Number(salesBreakdown.total || 0 || 0).toLocaleString()} ج.م
          </p>
          <p className="text-[9px] text-slate-400">{filteredData.length} فاتورة</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between"
        >
          <p className="text-[10px] text-slate-500 font-bold">المبلغ قبل الخصم</p>
          <p className="text-lg font-black text-slate-900 mt-1">
            {Number(salesBreakdown.subtotal || 0 || 0).toLocaleString()} ج.م
          </p>
          <p className="text-[9px] text-slate-400">الإجمالي الخام</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-4 rounded-2xl shadow-sm border border-rose-200 flex flex-col justify-between"
        >
          <p className="text-[10px] text-slate-500 font-bold">إجمالي الخصومات</p>
          <p className="text-lg font-black text-rose-600 mt-1">
            -{Number(salesBreakdown.discount || 0 || 0).toLocaleString()} ج.م
          </p>
          <p className="text-[9px] text-slate-400">خصومات على الفواتير</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white p-4 rounded-2xl shadow-sm border border-blue-200 flex flex-col justify-between"
        >
          <p className="text-[10px] text-slate-500 font-bold">إجمالي الضريبة</p>
          <p className="text-lg font-black text-blue-600 mt-1">
            {Number(salesBreakdown.tax || 0 || 0).toLocaleString()} ج.م
          </p>
          <p className="text-[9px] text-slate-400">ضريبة القيمة المضافة</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-4 rounded-2xl shadow-sm border border-orange-200 flex flex-col justify-between"
        >
          <p className="text-[10px] text-slate-500 font-bold">كاش</p>
          <p className="text-lg font-black text-orange-600 mt-1">
            {Number(salesBreakdown.cash || 0 || 0).toLocaleString()} ج.م
          </p>
          <p className="text-[9px] text-slate-400">{salesBreakdown.total > 0 ? Math.round((salesBreakdown.cash / salesBreakdown.total) * 100) : 0}%</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white p-4 rounded-2xl shadow-sm border border-purple-200 flex flex-col justify-between"
        >
          <p className="text-[10px] text-slate-500 font-bold">بطاقات / إنستا</p>
          <p className="text-lg font-black text-purple-600 mt-1">
            {(
              (salesBreakdown.visa || 0) + (salesBreakdown.mastercard || 0) + (salesBreakdown.instapay || 0)
            ).toLocaleString()}{" "}
            ج.م
          </p>
          <p className="text-[9px] text-slate-400">فيزا + ماستر + إنستا</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-4 rounded-2xl shadow-sm border border-cyan-200 flex flex-col justify-between"
        >
          <p className="text-[10px] text-slate-500 font-bold">محفظة موبايل</p>
          <p className="text-lg font-black text-cyan-600 mt-1">
            {Number(salesBreakdown.wallet || 0 || 0).toLocaleString()} ج.م
          </p>
          <p className="text-[9px] text-slate-400">إنستا باي / فودافون كاش</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-white p-4 rounded-2xl shadow-sm border border-amber-200 flex flex-col justify-between"
        >
          <p className="text-[10px] text-slate-500 font-bold">آجل / دفع مختلط</p>
          <p className="text-lg font-black text-amber-600 mt-1">
            {((salesBreakdown.credit || 0) + (salesBreakdown.mixed || 0)).toLocaleString()} ج.م
          </p>
          <p className="text-[9px] text-slate-400">حسابات آجلة ومدفوعات مختلطة</p>
        </motion.div>
      </div>
    );
  };

  const renderPOSDashboard = () => {
    if (activeTab !== "pos_dashboard") return null;

    const renderMix = (
      title: string,
      items: Record<string, { count: number; total: number }>,
    ) => {
      const total = Object.values(items).reduce((acc, item) => acc + item.total, 0);
      return (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-600" />
            {title}
          </h3>
          <div className="space-y-3">
            {Object.entries(items).length === 0 && (
              <p className="text-sm text-slate-400">لا توجد بيانات كافية</p>
            )}
            {Object.entries(items).map(([label, item]) => {
              const percent = total > 0 ? Math.round((item.total / total) * 100) : 0;
              return (
                <div key={label}>
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span className="text-slate-700">{label}</span>
                    <span className="text-slate-500">
                      {item.count} فاتورة · {Number(item.total || 0).toLocaleString()} ج.م
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-6 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-sm">
            <p className="text-[10px] text-slate-300 font-bold mb-1">مبيعات POS (الصافي)</p>
            <p className="text-xl font-black">{Number(salesBreakdown.total || 0).toLocaleString()} ج.م</p>
            <p className="text-[9px] text-slate-400 mt-1">إجمالي الفترة المختارة</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-[10px] text-slate-500 font-bold mb-1">عدد الفواتير</p>
            <p className="text-xl font-black text-slate-900">{posDashboardStats.invoices}</p>
            <p className="text-[9px] text-slate-400 mt-1">فواتير في الفترة</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-[10px] text-slate-500 font-bold mb-1">متوسط الفاتورة</p>
            <p className="text-xl font-black text-emerald-600">
              {Number(posDashboardStats.averageTicket || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ج.م
            </p>
            <p className="text-[9px] text-slate-400 mt-1">Average Ticket</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-rose-200">
            <p className="text-[10px] text-slate-500 font-bold mb-1">إجمالي الخصومات</p>
            <p className="text-xl font-black text-rose-600">
              -{Number(salesBreakdown.discount || 0).toLocaleString()} ج.م
            </p>
            <p className="text-[9px] text-slate-400 mt-1">خصومات وإعفاءات</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-blue-200">
            <p className="text-[10px] text-slate-500 font-bold mb-1">الضريبة المضافة</p>
            <p className="text-xl font-black text-blue-600">
              {Number(salesBreakdown.tax || 0).toLocaleString()} ج.م
            </p>
            <p className="text-[9px] text-slate-400 mt-1">ضريبة القيمة المضافة</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-orange-200">
            <p className="text-[10px] text-slate-500 font-bold mb-1">نسبة الكاش</p>
            <p className="text-xl font-black text-orange-600">
              {salesBreakdown.total > 0
                ? Math.round((salesBreakdown.cash / salesBreakdown.total) * 100)
                : 0}
              %
            </p>
            <p className="text-[9px] text-slate-400 mt-1">{Number(salesBreakdown.cash || 0).toLocaleString()} ج.م</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          {renderMix("توزيع طرق الدفع", posDashboardStats.paymentMix)}
          {renderMix("توزيع أنواع الطلب", posDashboardStats.orderTypeMix)}
          {renderMix("توزيع مصدر الطلب", posDashboardStats.sourceMix)}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              أداء الكاشير
            </h3>
            <div className="space-y-3">
              {posDashboardStats.cashierPerformance.length === 0 && (
                <p className="text-sm text-slate-400">لا توجد بيانات كافية</p>
              )}
              {posDashboardStats.cashierPerformance.map(([cashier, item], index) => (
                <div
                  key={cashier}
                  className="flex items-center justify-between bg-slate-50 rounded-xl p-3 border border-slate-100"
                >
                  <div>
                    <p className="font-black text-slate-800 text-sm">
                      #{index + 1} {cashier}
                    </p>
                    <p className="text-[11px] text-slate-400">{item.count} فاتورة</p>
                  </div>
                  <p className="font-black text-emerald-600">
                    {Number(item.total || 0).toLocaleString()} ج.م
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTable = () => {
    if (loading) {
      return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-4 bg-slate-200 rounded w-24 animate-pulse"
              ></div>
            ))}
          </div>
          <div className="divide-y divide-slate-100">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="p-4 flex gap-4 animate-pulse">
                {[1, 2, 3, 4, 5].map((j) => (
                  <div key={j} className="h-4 bg-slate-100 rounded w-24"></div>
                ))}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (filteredData.length === 0)
      return (
        <div className="p-8 text-center text-slate-500">
          لا توجد بيانات لهذه الفترة
        </div>
      );

    const columns = Object.keys(filteredData[0]).filter(
      (col) => col !== "التفاصيل",
    );

    return (
      <div
        id="report-content"
        className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto"
      >
        <table className="w-full text-right min-w-[800px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} className="p-4 font-bold text-slate-600">
                  {col}
                </th>
              ))}
              {activeTab !== "complaints" && (
                <th className="p-4 font-bold text-slate-600 text-center">
                  {activeTab === "modifications" ? "تفاصيل التعديل" : "إجراءات"}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedData.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className="p-4 text-slate-800">
                    {col === "التفاصيل" ? (
                      <div className="max-w-xs max-h-24 overflow-y-auto text-xs">
                        {formatDetails(row[col])}
                      </div>
                    ) : (
                      row[col]
                    )}
                  </td>
                ))}
                {activeTab !== "complaints" && (
                  <td className="p-4 text-center flex gap-2 justify-center">
                    {row["رقم الطلب"] &&
                      activeTab !== "warehouse" &&
                      activeTab !== "modifications" && (
                        <>
                          {canEdit() && (
                            <button
                              onClick={() =>
                                setEditingOrderId(row["رقم الطلب"])
                              }
                              className="p-2 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors inline-flex items-center gap-2"
                              title="تعديل الطلب"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete() && (
                            <button
                              onClick={() => cancelOrder(row["رقم الطلب"])}
                              className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors inline-flex items-center gap-2"
                              title="إلغاء الطلب"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() =>
                              setPrintingReceiptOrderId(row["رقم الطلب"])
                            }
                            className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors inline-flex items-center gap-2"
                            title="عرض وطباعة الإيصال"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    {activeTab === "modifications" && (
                      <button
                        onClick={() => setViewingModification(row)}
                        className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors inline-flex items-center gap-2"
                        title="عرض التفاصيل"
                      >
                        <Eye className="w-4 h-4" />
                        <span className="text-xs font-bold">التفاصيل</span>
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {filteredData.length > 0 && (
          <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50" dir="rtl">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 font-medium">عدد السجلات في الصفحة:</span>
              <select
                value={pageSize ?? ""}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={30}>30</option>
                <option value={40}>40</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={-1}>الكل</option>
              </select>
              <span className="text-slate-300">|</span>
              <span className="text-xs text-slate-500">
                عرض {pageSize === -1 ? 1 : (currentPage - 1) * pageSize + 1} إلى{" "}
                {pageSize === -1 ? filteredData.length : Math.min(currentPage * pageSize, filteredData.length)} من{" "}
                {filteredData.length} سجل
              </span>
            </div>

            {pageSize !== -1 && filteredData.length > pageSize && (
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs disabled:opacity-50 hover:bg-white bg-white font-bold"
                >
                  السابق
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((p) =>
                      Math.min(
                        Math.ceil(filteredData.length / pageSize),
                        p + 1,
                      ),
                    )
                  }
                  disabled={
                    currentPage >= Math.ceil(filteredData.length / pageSize)
                  }
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs disabled:opacity-50 hover:bg-white bg-white font-bold"
                >
                  التالي
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const tabTitles: Record<string, string> = {
    sales: "تقارير عمليات البيع",
    cancelled_orders: "تقرير الأوردرات الملغاة والمرتجعة (Void)",
    pos_dashboard: "لوحة مؤشرات POS والكاشير",
    call_center: "تقرير نقطة البيع الكول سنتر",
    warehouse: "تقارير المخازن والتحويلات",
    delivery: "تقرير خدمات التوصيل",
    delivery_drivers: "تقرير أداء الطيارين",
    kitchen: "تقرير طلبات المطبخ",
    web_orders: "تقرير طلبات السايت",
    modifications: "تقرير التعديلات والإلغاءات للنظام والسرية",
    complaints: "تقرير الشكاوي",
  };

  const tabDescriptions: Record<string, string> = {
    sales: "عرض تفصيلي لعمليات البيع، طرق الدفع وعينات الأوردرات بالفروع",
    cancelled_orders: "عرض كافة الأوردرات الملغاة والمسترجعة (Void) من نقطة البيع والفروع مع أسباب الإلغاء والمستخدم المنفذ",
    pos_dashboard: "تحليل احترافي لمبيعات نقطة البيع، طرق الدفع، أنواع الطلب، وأداء الكاشير",
    call_center: "أداء وإحصائيات نقطة البيع الكول سنتر واستلام المكالمات والطلبات",
    warehouse: "تقرير حركات وتحويلات المواد والفاقد بين المخازن بالفروع",
    delivery: "متابعة الشحنات، الدليفري، وحالة التوصيل الفعالة بالفروع",
    delivery_drivers:
      "تقييم أداء الطيارين، عدد الطلبات الموصلة، وعوائد التوصيل",
    kitchen: "تقرير جودة المطبخ وتوقيتات تجهيز وتحضير وطهي الطلبات بمعدلاتها",
    web_orders:
      "متابعة وتقرير الطلبات القادمة من المتجر الإلكتروني أو الموقع المباشر",
    modifications:
      "سجل عمليات تعديل وإلغاء وحذف الطلبات وتصاريح المشرفين للأمان والسرية",
    complaints: "شكاوى وملاحظات العملاء الواردة ومعدل الاستجابة والحلول",
    pos_detailed_reports: "تحليل تفصيلي لمبيعات الأصناف والأقسام وأداء الموظفين",
  };

  if (activeTab === "pos_detailed_reports") {
    return <POSDetailedReports onBack={onBack} />;
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900">
      {!hideHeader && (
        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-white shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {initialTab
                  ? tabTitles[activeTab] || "تقارير الفروع"
                  : "تقارير الفروع"}
              </h1>
              <p className="text-sm text-slate-500">
                {initialTab
                  ? tabDescriptions[activeTab] || "تقارير شاملة للفروع"
                  : "تقارير شاملة للمبيعات، الكول سنتر، المخازن، والتوصيل"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3"></div>
        </div>
      )}

      {!initialTab && (
        <div className="px-6 py-4 flex gap-4 border-b border-slate-200 bg-white overflow-x-auto">
          {[
            {
              id: "sales",
              label: "عمليات البيع",
              icon: DollarSign,
              perm: "branch_reports.sales",
            },
            {
              id: "cancelled_orders",
              label: "الأوردرات الملغاة (Void)",
              icon: X,
              perm: "branch_reports.sales",
            },
            {
              id: "pos_dashboard",
              label: "لوحة POS والكاشير",
              icon: BarChart3,
              perm: "branch_reports.sales",
            },
            {
              id: "call_center",
              label: "نقطة البيع الكول سنتر",
              icon: PhoneCall,
              perm: "branch_reports.call_center",
            },
            {
              id: "warehouse",
              label: "المخازن والتحويلات",
              icon: Warehouse,
              perm: "branch_reports.warehouse",
            },
            {
              id: "delivery",
              label: "خدمات التوصيل",
              icon: Truck,
              perm: "branch_reports.delivery",
            },
            {
              id: "delivery_drivers",
              label: "أداء الطيارين",
              icon: Truck,
              perm: "branch_reports.delivery",
            },
            {
              id: "kitchen",
              label: "طلبات المطبخ",
              icon: ChefHat,
              perm: "branch_reports.kitchen",
            },
            {
              id: "web_orders",
              label: "طلبات السايت",
              icon: Globe,
              perm: "branch_reports.sales",
            },
            {
              id: "modifications",
              label: "تعديلات/إلغاءات",
              icon: Edit,
              perm: "branch_reports.modifications",
            },
            {
              id: "complaints",
              label: "الشكاوي",
              icon: MessageSquareWarning,
              perm: "branch_reports.complaints",
            },
          ]
            .filter(
              (tab) =>
                user?.role === "admin" ||
                user?.permissions?.[tab.perm] !== false,
            )
            .map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-2 rounded-xl transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-purple-50 text-purple-600 border border-purple-200 font-bold"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
        </div>
      )}

      <div className="p-6 flex-1 overflow-y-auto">
        {renderSummary()}
        <div className="flex flex-wrap gap-4 mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2">
            <label className="text-sm font-bold text-slate-700">من:</label>
            <input
              type="date"
              value={startDate ?? ""}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-purple-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-bold text-slate-700">إلى:</label>
            <input
              type="date"
              value={endDate ?? ""}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-purple-500"
            />
          </div>
          {(user?.role === "admin" || !user?.branch_id) && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-slate-700">الفرع:</label>
              <select
                value={selectedBranch ?? ""}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-purple-500"
              >
                <option value="all">كل الفروع</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {(user?.role === "admin" ||
            hasPermission("branch_reports.all_users")) && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-slate-700">
                المستخدم:
              </label>
              <select
                value={selectedUser ?? ""}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-purple-500"
              >
                <option value="all">كل المستخدمين</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(activeTab === "sales" || activeTab === "pos_dashboard" || activeTab === "call_center") && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-slate-700">
                طريقة الدفع:
              </label>
              <select
                value={paymentMethodFilter ?? ""}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-purple-500"
              >
                <option value="all">الكل</option>
                <option value="cash">كاش</option>
                <option value="visa">فيزا</option>
                <option value="mastercard">ماستر كارد</option>
                <option value="wallet">محفظة</option>
                <option value="instapay">إنستا باي</option>
                <option value="credit">آجل</option>
                <option value="mixed">دفع مختلط</option>
              </select>
            </div>
          )}

          {(activeTab === "sales" || activeTab === "pos_dashboard") && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-slate-700">
                نوع الطلب:
              </label>
              <select
                value={orderTypeFilter ?? ""}
                onChange={(e) => setOrderTypeFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-purple-500"
              >
                <option value="all">الكل</option>
                <option value="dine_in">صالة / طاولة</option>
                <option value="takeaway">تيك أواي</option>
                <option value="delivery">دليفري</option>
                <option value="walk_in">بيع مباشر</option>
                <option value="pick_up">استلام من الفرع</option>
                <option value="membership">عضوية</option>
                <option value="exchange">استبدال</option>
              </select>
            </div>
          )}

          {(activeTab === "sales" || activeTab === "pos_dashboard") && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-slate-700">
                الحالة:
              </label>
              <select
                value={statusFilter ?? ""}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-purple-500"
              >
                <option value="all">الكل (بدون ملغي)</option>
                <option value="completed">مكتمل</option>
                <option value="delivered">تم التوصيل</option>
                <option value="pending">قيد الانتظار</option>
                <option value="preparing">جاري التحضير</option>
                <option value="ready">جاهز</option>
                <option value="hold">معلق</option>
                <option value="cancelled">ملغي</option>
              </select>
            </div>
          )}

          <div className="flex-1 relative min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="بحث في التقرير..."
              value={searchQuery ?? ""}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pr-10 pl-4 focus:outline-none focus:border-purple-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportToExcel}
              className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-colors"
              title="Excel"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={exportToWord}
              className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors"
              title="Word"
            >
              <FileText className="w-5 h-5" />
            </button>
            <button
              onClick={() => window.print()}
              className="p-2 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              title="Print"
            >
              <Printer className="w-5 h-5" />
            </button>
          </div>
        </div>

        {renderCallCenterSummary()}
        {renderPOSDashboard()}
        {renderTable()}
      </div>

      {editingOrderId && (
        <OrderEditorModal
          orderId={editingOrderId}
          onClose={() => setEditingOrderId(null)}
          onSave={() => {
            setEditingOrderId(null);
            fetchData();
          }}
        />
      )}

      {printingReceiptOrderId && (
        <ReceiptPrintModal
          orderId={printingReceiptOrderId}
          onClose={() => setPrintingReceiptOrderId(null)}
        />
      )}

      {viewingModification && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-600" />
                تفاصيل العملية #{viewingModification["رقم الطلب"]}
              </h3>
              <button
                onClick={() => setViewingModification(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-xs text-slate-400 mb-1">نوع العملية</p>
                  <p className="font-bold text-slate-900">
                    {viewingModification["نوع العملية"]}
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-xs text-slate-400 mb-1">التاريخ</p>
                  <p className="font-bold text-slate-900">
                    {viewingModification["التاريخ"]}
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-xs text-slate-400 mb-1">الإجمالي القديم</p>
                  <p className="font-bold text-slate-900">
                    {viewingModification["الإجمالي القديم"]} ج.م
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-xs text-slate-400 mb-1">الإجمالي الجديد</p>
                  <p className="font-bold text-pink-600">
                    {viewingModification["الإجمالي الجديد"]} ج.م
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <p className="text-sm text-slate-400 mb-4 font-bold border-b border-slate-200 pb-2">
                  تفاصيل الطلب
                </p>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  {formatDetails(viewingModification["التفاصيل"])}
                </div>
              </div>

              {viewingModification["ملاحظات"] && (
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                  <p className="text-xs text-amber-600 mb-1 font-bold">
                    ملاحظات
                  </p>
                  <p className="text-amber-900 italic">
                    {viewingModification["ملاحظات"]}
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                onClick={() => setViewingModification(null)}
                className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Global Print Template Wrapper */}
      <GlobalReportPrint title={tabTitles[activeTab] || "تقرير الفروع"}>
        <div className="mb-4 flex justify-between items-center border-b pb-2">
          <span className="text-xs font-bold text-slate-600">
            الفترة من: {startDate} إلى: {endDate}
          </span>
          <span className="text-xs font-bold text-slate-600">
            الفرع: {selectedBranch === "all" ? "كل الفروع" : selectedBranch}
          </span>
        </div>
        <table className="w-full border-collapse border border-slate-300 text-[10px] text-right">
          <thead>
            <tr className="bg-slate-50">
              {data.length > 0 &&
                Object.keys(data[0])
                  .filter((k) => k !== "التفاصيل")
                  .map((key, i) => (
                    <th
                      key={i}
                      className="border border-slate-300 p-2 text-right"
                    >
                      {key}
                    </th>
                  ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.slice(0, 500).map((row, i) => (
              <tr key={i}>
                {Object.keys(row)
                  .filter((k) => k !== "التفاصيل")
                  .map((key, j) => (
                    <td key={j} className="border border-slate-300 p-2">
                      {typeof row[key] === "object"
                        ? JSON.stringify(row[key])
                        : String(row[key] || "-")}
                    </td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
        {(activeTab === "sales" || activeTab === "call_center" || activeTab === "pos_dashboard") && (
          <div className="mt-8 border-t pt-4 flex flex-wrap justify-end gap-8">
            <div className="text-left">
              <p className="text-xs font-bold text-slate-500">
                المبلغ قبل الخصم
              </p>
              <p className="text-lg font-black text-slate-900">
                {Number(salesBreakdown.subtotal || 0 || 0).toLocaleString()} ج.م
              </p>
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-rose-500">
                الخصومات
              </p>
              <p className="text-lg font-black text-rose-600">
                -{Number(salesBreakdown.discount || 0 || 0).toLocaleString()} ج.م
              </p>
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-slate-500">
                الضريبة
              </p>
              <p className="text-lg font-black text-blue-600">
                {Number(salesBreakdown.tax || 0 || 0).toLocaleString()} ج.م
              </p>
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-emerald-500">
                الصافي
              </p>
              <p className="text-lg font-black text-emerald-600">
                {Number(salesBreakdown.total || 0 || 0).toLocaleString()} ج.م
              </p>
            </div>
          </div>
        )}
      </GlobalReportPrint>
    </div>
  );
};
