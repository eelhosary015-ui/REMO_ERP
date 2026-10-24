import React, { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft,
  Users,
  Search,
  Phone,
  MapPin,
  ShoppingBag,
  DollarSign,
  Calendar,
  User,
  Filter,
  MoreVertical,
  ExternalLink,
  Download,
  Printer,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../utils/api";

interface Customer {
  id: number;
  name: string;
  phone: string;
  phone_2: string;
  address: string;
  last_order_date: string;
  total_orders: number;
  total_spent: number;
}

interface CustomersProps {
  onBack: () => void;
  onViewAccount: () => void;
  subView?: string;
}

export const Customers: React.FC<CustomersProps> = ({
  onBack,
  onViewAccount,
  subView,
}) => {
  if (subView === "customers_report") {
    return <CustomersReportView onBack={onBack} />;
  }

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await api.get("/api/customers");
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch customers");
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter(
      (c) =>
        (c.name || "")
          .toLowerCase()
          .includes((searchQuery || "").toLowerCase()) ||
        (c.phone || "").includes(searchQuery) ||
        (c.phone_2 && c.phone_2.includes(searchQuery)),
    );
  }, [customers, searchQuery]);

  const stats = useMemo(() => {
    const totalOrders = customers.reduce(
      (acc, c) => acc + (Number(c.total_orders) || 0),
      0,
    );
    const totalSpent = customers.reduce(
      (acc, c) => acc + (Number(c.total_spent) || 0),
      0,
    );
    const activeToday = customers.filter((c) => {
      if (!c.last_order_date) return false;
      const lastDate = new Date(c.last_order_date);
      const today = new Date();
      return lastDate.toDateString() === today.toDateString();
    }).length;

    return {
      totalCustomers: customers.length,
      totalOrders,
      totalSpent,
      activeToday,
    };
  }, [customers]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen flex flex-col bg-slate-50 text-slate-900"
    >
      {/* Header */}
      <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-white shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              قاعدة العملاء
            </h1>
            <p className="text-sm text-slate-500">
              إدارة بيانات العملاء وسجل الطلبات
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="بحث بالاسم أو رقم الهاتف..."
              value={searchQuery ?? ""}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-100 border border-slate-200 rounded-xl py-2 pr-10 pl-4 w-80 focus:outline-none focus:border-blue-500 transition-colors text-slate-900"
            />
          </div>
          <button className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-slate-500">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500">إجمالي العملاء</p>
              <p className="text-2xl font-bold text-slate-900">
                {stats.totalCustomers}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500">إجمالي الطلبات</p>
              <p className="text-2xl font-bold text-slate-900">
                {stats.totalOrders}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500">إجمالي المبيعات</p>
              <p className="text-2xl font-bold text-slate-900">
                {Number(stats.totalSpent || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                ج.م
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500">نشط اليوم</p>
              <p className="text-2xl font-bold text-slate-900">
                {stats.activeToday}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 pt-0">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="bg-white border border-slate-200 rounded-2xl p-4 animate-pulse flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100"></div>
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-slate-100 rounded"></div>
                    <div className="h-3 w-16 bg-slate-100 rounded"></div>
                  </div>
                </div>
                <div className="h-4 w-24 bg-slate-100 rounded"></div>
                <div className="h-4 w-24 bg-slate-100 rounded"></div>
                <div className="h-8 w-8 bg-slate-100 rounded-lg"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <table className="w-full text-right min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="p-4 text-sm font-bold text-slate-500">
                    العميل
                  </th>
                  <th className="p-4 text-sm font-bold text-slate-500">
                    بيانات الاتصال
                  </th>
                  <th className="p-4 text-sm font-bold text-slate-500">
                    العنوان
                  </th>
                  <th className="p-4 text-sm font-bold text-slate-500 text-center">
                    الطلبات
                  </th>
                  <th className="p-4 text-sm font-bold text-slate-500 text-center">
                    إجمالي الإنفاق
                  </th>
                  <th className="p-4 text-sm font-bold text-slate-500">
                    آخر طلب
                  </th>
                  <th className="p-4 text-sm font-bold text-slate-500"></th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors group"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                          {(customer.name || "ع").charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">
                            {customer.name || "عميل بدون اسم"}
                          </p>
                          <p className="text-xs text-slate-500">
                            ID: #{customer.id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{customer.phone}</span>
                        </div>
                        {customer.phone_2 && (
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Phone className="w-3 h-3" />
                            <span>{customer.phone_2}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-start gap-2 text-sm max-w-xs text-slate-600">
                        <MapPin className="w-3 h-3 text-slate-400 mt-1 flex-shrink-0" />
                        <span className="line-clamp-2">
                          {customer.address || "غير محدد"}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-sm font-bold border border-blue-100">
                        {customer.total_orders}
                      </span>
                    </td>
                    <td className="p-4 text-center font-bold text-emerald-600">
                      {Number(customer.total_spent || 0 || 0).toLocaleString(
                        undefined,
                        { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                      )}{" "}
                      ج.م
                    </td>
                    <td className="p-4 text-sm text-slate-500">
                      {customer.last_order_date
                        ? new Date(customer.last_order_date).toLocaleDateString(
                            "ar-EG",
                          )
                        : "-"}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={onViewAccount}
                          className="p-2 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors"
                          title="عرض الحساب المالي"
                        >
                          <DollarSign className="w-4 h-4" />
                        </button>
                        <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-900 transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredCustomers.length === 0 && (
              <div className="p-12 text-center text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>لا يوجد عملاء مطابقين للبحث</p>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

import * as XLSX from "xlsx";

const CustomersReportView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        let endpoint = "/api/customers";
        // Or if there is a specific customer report, but standard customers API will do to list with stats
        // In real case, maybe we need '/api/reports/customers' but for now '/api/customers' provides basic customer list.
        // Actually, we'll try `/api/reports/customers` first, if it 404s we just use what we have, but since we define the backend, we can just hit /api/customers or /api/reports/customers if we create it.
        // I will use /api/reports/customers to be consistent. Let me create it in backend later if needed, or just let's see. Let's try /api/customers for now since it returns the list.
        const params = new URLSearchParams();
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);

        const res = await api.get(`/api/customers?${params.toString()}`);
        if (res.ok) {
          const result = await res.json();
          const parsedData = Array.isArray(result)
            ? result.map((c) => ({
                "الرقم التعريفي": c.id,
                "اسم العميل": c.name,
                "رقم الهاتف": c.phone,
                العنوان: c.address || "-",
                "تاريخ آخر طلب": c.last_order_date || "-",
                "إجمالي الطلبات": c.total_orders,
                "إجمالي المشتريات": c.total_spent,
              }))
            : [];
          setData(parsedData);
          setFilteredData(parsedData);
        }
      } catch (error) {
        console.error("Failed to fetch report", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [startDate, endDate]);

  useEffect(() => {
    if (!searchQuery) {
      setFilteredData(data);
    } else {
      const lowerQuery = searchQuery.toLowerCase();
      setFilteredData(
        data.filter((row) => {
          return Object.values(row).some((val) =>
            String(val).toLowerCase().includes(lowerQuery),
          );
        }),
      );
    }
  }, [searchQuery, data]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadExcel = () => {
    if (filteredData.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(filteredData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Customers_Report");
    XLSX.writeFile(
      workbook,
      `Customers_Report_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
  };

  return (
    <div
      className="flex flex-col h-screen bg-slate-50 p-6 overflow-y-auto"
      dir="rtl"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 bg-white rounded-xl shadow-sm border border-slate-200 hover:bg-slate-50"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-slate-900">تقارير العملاء</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm font-medium"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة</span>
          </button>
          <button
            onClick={handleDownloadExcel}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm tracking-wide font-medium"
          >
            <Download className="w-4 h-4" />
            <span>تنزيل Excel</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 mb-6 print:hidden">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            بحث باسم العميل / التفاصيل
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery ?? ""}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث..."
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
            />
          </div>
        </div>
        <div className="w-full md:w-auto">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            من تاريخ (تسجيل/آخر طلب)
          </label>
          <input
            type="date"
            value={startDate ?? ""}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
          />
        </div>
        <div className="w-full md:w-auto">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            إلى تاريخ
          </label>
          <input
            type="date"
            value={endDate ?? ""}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-500">جاري التحميل...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm printable-area">
          <div className="print:block hidden mb-6 text-center">
            <h2 className="text-2xl font-bold mb-2">تقارير العملاء</h2>
            {(startDate || endDate) && (
              <p className="text-sm text-gray-500">
                من: {startDate || "-"} إلى: {endDate || "-"}
              </p>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-50 text-slate-600 font-medium">
                <tr>
                  {filteredData.length > 0 &&
                    Object.keys(filteredData[0]).map((key, i) => (
                      <th
                        key={i}
                        className="p-4 border-b border-slate-200 whitespace-nowrap"
                      >
                        {key}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    {Object.values(row).map((val: any, j) => (
                      <td key={j} className="p-4 whitespace-nowrap">
                        {typeof val === "object"
                          ? JSON.stringify(val)
                          : String(val || "-")}
                      </td>
                    ))}
                  </tr>
                ))}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-500">
                      لا توجد بيانات تطابق بحثك
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
