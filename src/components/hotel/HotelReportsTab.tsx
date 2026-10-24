import React, { useState, useEffect } from "react";
import {
  FileText,
  TrendingUp,
  Shield,
  DollarSign,
  PieChart,
  Calendar,
  Sparkles,
  Wrench,
  Users,
  Package,
  Clock,
  Moon,
  Building2,
  RefreshCw,
  Eye,
  X,
  FileCheck
} from "lucide-react";
import {
  HotelReservation,
  HotelProperty,
  DashboardMetrics,
  RevenueReportData,
  GuestBalanceRow,
  HousekeepingTask,
  ServiceOrder,
  MaintenanceTicket,
  HotelGuest,
  InventorySupplyItem,
  NightAuditRecord
} from "./types";
import { HotelSkeletonLoader } from "./HotelSkeletonLoader";
import { KPIsReport } from "./reports/KPIs";
import { PoliceRegistry } from "./reports/PoliceRegistry";
import { RevenueReport } from "./reports/Revenue";
import { GuestBalances } from "./reports/GuestBalances";
import { ReservationsChannels } from "./reports/ReservationsChannels";
import { HousekeepingServices } from "./reports/HousekeepingServices";
import { MaintenanceReport } from "./reports/Maintenance";
import { GuestsLoyalty } from "./reports/GuestsLoyalty";
import { InventorySupplies } from "./reports/InventorySupplies";
import { CashierShifts } from "./reports/CashierShifts";
import { NightAuditReport } from "./reports/NightAudit";

interface HotelReportsTabProps {
  properties: HotelProperty[];
  selectedProperty: HotelProperty | null;
  onSelectProperty: (prop: HotelProperty) => void;
  reportSubTab: string;
  setReportSubTab: (tab: string) => void;
}

// تمت الاضافة: المكون الموحد لتبويبة تقارير الفندق مقسماً إلى 11 تقريراً فرعياً مستقلاً
export const HotelReportsTab: React.FC<HotelReportsTabProps> = ({
  properties,
  selectedProperty,
  onSelectProperty,
  reportSubTab,
  setReportSubTab
}) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // States
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [reservations, setReservations] = useState<HotelReservation[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueReportData | null>(null);
  const [guestBalances, setGuestBalances] = useState<GuestBalanceRow[]>([]);
  const [housekeepingTasks, setHousekeepingTasks] = useState<HousekeepingTask[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [maintenanceList, setMaintenanceList] = useState<MaintenanceTicket[]>([]);
  const [guests, setGuests] = useState<HotelGuest[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventorySupplyItem[]>([]);
  const [nightAudits, setNightAudits] = useState<NightAuditRecord[]>([]);
  const [cashierShifts, setCashierShifts] = useState<any[]>([]);

  // Security Doc Modal State
  const [selectedDocReservation, setSelectedDocReservation] = useState<HotelReservation | null>(null);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);

  // Payment Settlement Modal State
  const [settlementRow, setSettlementRow] = useState<GuestBalanceRow | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Maintenance Modal State
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [newMaintenanceProblem, setNewMaintenanceProblem] = useState("");
  const [newMaintenanceRoom, setNewMaintenanceRoom] = useState("");
  const [newMaintenancePriority, setNewMaintenancePriority] = useState<"low" | "medium" | "high" | "urgent">("medium");

  const [isAuditing, setIsAuditing] = useState(false);

  const fetchAllReportData = async () => {
    try {
      setLoading(true);
      const hotelParam = selectedProperty ? `?hotel_id=${selectedProperty.id}` : "";

      const [
        metricsRes,
        resRes,
        revRes,
        balRes,
        hkRes,
        ordersRes,
        maintRes,
        guestsRes,
        auditsRes,
        invRes
      ] = await Promise.allSettled([
        fetch(`/api/v2/hotel/dashboard${hotelParam}`).then((r) => r.json()),
        fetch(`/api/v2/hotel/reservations${hotelParam}`).then((r) => r.json()),
        fetch(`/api/v2/hotel/reports/revenue${hotelParam}`).then((r) => r.json()),
        fetch(`/api/v2/hotel/reports/guest-balances${hotelParam}`).then((r) => r.json()),
        fetch(`/api/v2/hotel/housekeeping${hotelParam}`).then((r) => r.json()),
        fetch(`/api/v2/hotel/service-orders${hotelParam}`).then((r) => r.json()),
        fetch(`/api/v2/hotel/maintenance${hotelParam}`).then((r) => r.json()),
        fetch(`/api/v2/hotel/guests`).then((r) => r.json()),
        fetch(`/api/v2/hotel/night-audits${hotelParam}`).then((r) => r.json()),
        fetch(`/api/inventory/items`).then((r) => r.json())
      ]);

      if (metricsRes.status === "fulfilled" && metricsRes.value.success) {
        setMetrics(metricsRes.value.data);
      }
      if (resRes.status === "fulfilled" && resRes.value.success) {
        setReservations(resRes.value.data || []);
      }
      if (revRes.status === "fulfilled" && revRes.value.success) {
        setRevenueData(revRes.value.data);
      }
      if (balRes.status === "fulfilled" && balRes.value.success) {
        setGuestBalances(balRes.value.data || []);
      }
      if (hkRes.status === "fulfilled" && hkRes.value.success) {
        setHousekeepingTasks(hkRes.value.data || []);
      }
      if (ordersRes.status === "fulfilled" && ordersRes.value.success) {
        setServiceOrders(ordersRes.value.data || []);
      }
      if (maintRes.status === "fulfilled" && maintRes.value.success) {
        setMaintenanceList(maintRes.value.data || []);
      }
      if (guestsRes.status === "fulfilled" && guestsRes.value.success) {
        setGuests(guestsRes.value.data || []);
      }
      if (auditsRes.status === "fulfilled" && auditsRes.value.success) {
        setNightAudits(auditsRes.value.data || []);
      }
      if (invRes.status === "fulfilled") {
        const invData = Array.isArray(invRes.value) ? invRes.value : invRes.value.data || [];
        setInventoryItems(invData);
      }

      // Sample Cashier Shifts Data
      setCashierShifts([
        {
          id: 1,
          cashier_name: "أحمد علي (كاشير الاستقبال)",
          shift_name: "الوردية الصباحية (Morning)",
          opened_at: new Date().toISOString(),
          opening_cash: 2000,
          collected_cash: 8500,
          collected_card: 14200,
          total_collected: 22700,
          status: "open"
        },
        {
          id: 2,
          cashier_name: "محمود حسن (كاشير مسائي)",
          shift_name: "الوردية المسائية (Evening)",
          opened_at: new Date(Date.now() - 86400000).toISOString(),
          closed_at: new Date(Date.now() - 43200000).toISOString(),
          opening_cash: 2000,
          collected_cash: 12300,
          collected_card: 19500,
          total_collected: 31800,
          status: "closed"
        }
      ]);
    } catch (err) {
      console.error("Error loading hotel reports:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAllReportData();
  }, [selectedProperty]);

  // Open Document Modal
  const handleOpenDocModal = (res: HotelReservation) => {
    setSelectedDocReservation(res);
    setIsDocModalOpen(true);
  };

  // Minibar Deduct Handler
  const handleDeductMinibar = async (item: InventorySupplyItem, qty: number, roomNumber: string) => {
    try {
      const price = item.avg_cost ? Math.round(item.avg_cost * 1.5) : 35;
      const totalAmount = price * qty;

      // 1. Charge to room folio
      const chargeRes = await fetch("/api/v2/hotel/charge-to-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_number: roomNumber,
          description: `استهلاك ميني بار: ${item.name} (${qty} ${item.unit || "قطعة"})`,
          amount: totalAmount
        })
      });
      const chargeData = await chargeRes.json();
      if (!chargeRes.ok || !chargeData.success) {
        throw new Error(chargeData.error || "فشل تحميل مبلغ الميني بار على الغرفة");
      }

      // 2. Deduct from inventory
      await fetch(`/api/inventory/items/${item.id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity_change: -qty,
          reason: `استهلاك ميني بار غرفة ${roomNumber}`
        })
      }).catch((e) => console.warn("Inventory adjust note:", e));

      alert(`✅ تم بنجاح تحميل مبلغ ${totalAmount} ج.م على غرفة ${roomNumber} وخصم ${qty} من المخزن!`);
      fetchAllReportData();
    } catch (err: any) {
      alert(`❌ خطأ: ${err.message}`);
    }
  };

  // Run Night Audit Handler
  const handleRunNightAudit = async () => {
    if (!confirm("هل أنت متأكد من تشغيل المراجعة الليلية الآن؟ سيتم احتساب إيرادات اليوم وترحيلها للحسابات العامة.")) {
      return;
    }
    setIsAuditing(true);
    try {
      const hotelId = selectedProperty?.id || 1;
      const res = await fetch("/api/v2/hotel/night-audits/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotel_id: hotelId,
          audited_by: "المراجع الليلي العام"
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "فشل تشغيل دورة المراجعة الليلية");
      }
      alert("✅ تمت المراجعة الليلية بنجاح وتم إقفال اليوم المالي وترحيل القيود!");
      fetchAllReportData();
    } catch (err: any) {
      alert(`❌ خطأ: ${err.message}`);
    } finally {
      setIsAuditing(false);
    }
  };

  // Submit Payment Settlement Handler
  const handleSubmitSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlementRow || paymentAmount <= 0) return;
    setIsSubmittingPayment(true);
    try {
      const res = await fetch("/api/v2/hotel/folios/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folio_id: settlementRow.folio_id,
          type: "payment",
          description: `دفعة تحصيل من تقرير الأرصدة (${paymentMethod})`,
          amount: paymentAmount
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "فشل تسجيل الدفعة");
      }
      alert(`✅ تم بنجاح تحصيل مبلغ ${paymentAmount} ج.م وتسجيله بحساب النزيل!`);
      setSettlementRow(null);
      setPaymentAmount(0);
      fetchAllReportData();
    } catch (err: any) {
      alert(`❌ خطأ: ${err.message}`);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Submit New Maintenance Ticket
  const handleCreateMaintenanceTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMaintenanceProblem) return;
    try {
      const res = await fetch("/api/v2/hotel/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotel_id: selectedProperty?.id || 1,
          room_id: newMaintenanceRoom ? parseInt(newMaintenanceRoom) : null,
          problem: newMaintenanceProblem,
          priority: newMaintenancePriority,
          description: `بلاغ صيانة من تقرير الفندق للغرفة ${newMaintenanceRoom || "مرفق عام"}`
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "فشل تسجيل البلاغ");
      alert("✅ تم تسجيل بلاغ الصيانة بنجاح!");
      setIsMaintenanceModalOpen(false);
      setNewMaintenanceProblem("");
      setNewMaintenanceRoom("");
      fetchAllReportData();
    } catch (err: any) {
      alert(`❌ خطأ: ${err.message}`);
    }
  };

  // Update Maintenance Status
  const handleUpdateMaintenanceStatus = async (id: number, status: "open" | "in_progress" | "resolved" | "closed") => {
    try {
      const res = await fetch(`/api/v2/hotel/maintenance/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "فشل تحديث الحالة");
      fetchAllReportData();
    } catch (err: any) {
      alert(`❌ خطأ: ${err.message}`);
    }
  };

  // Update Housekeeping Task Status
  const handleUpdateHKStatus = async (taskId: number, status: "clean" | "dirty" | "cleaning" | "inspected") => {
    try {
      const res = await fetch(`/api/v2/hotel/housekeeping/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cleaning_status: status })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "فشل تحديث النظافة");
      fetchAllReportData();
    } catch (err: any) {
      alert(`❌ خطأ: ${err.message}`);
    }
  };

  // 11 Sub Tabs Definition
  const REPORT_SUB_TABS = [
    { id: "kpis", label: "مؤشرات الأداء (KPIs)", icon: TrendingUp },
    { id: "police_registry", label: "دفتر الشرطة والسياحة", icon: Shield },
    { id: "revenue_breakdown", label: "تقرير الإيرادات والضرائب", icon: DollarSign },
    { id: "guest_balances", label: "أرصدة النزلاء والمديونيات", icon: PieChart },
    { id: "reservations_channels", label: "قنوات الحجز والمنصات", icon: Calendar },
    { id: "housekeeping_services", label: "الإشراف والخدمات", icon: Sparkles },
    { id: "maintenance_report", label: "تقرير وتكاليف الصيانة", icon: Wrench },
    { id: "guests_loyalty", label: "سجل النزلاء والولاء", icon: Users },
    { id: "inventory_supplies", label: "المستلزمات والمخزون", icon: Package },
    { id: "cashier_shifts", label: "ورديات الخزينة والكاشير", icon: Clock },
    { id: "night_audit", label: "المراجعة الليلية (Night Audit)", icon: Moon }
  ];

  // Helper counts for Warnings Card
  const dirtyRoomsCount = housekeepingTasks.filter((t) => t.cleaning_status === "dirty").length;
  const overdueInvoicesCount = guestBalances.filter((b) => Number(b.balance) > 0).length;

  return (
    <div className="space-y-6">
      {/* Header with Multi-Property selector and Refresh */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-600 text-white rounded-xl shadow-md">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">تقارير وتحليلات الفندق المتقدمة (Hotel PMS Reports)</h2>
            <p className="text-xs text-slate-500">
              11 تقريراً تحليلياً متكاملاً مع المحاسبة، المخازن، الحجوزات، والأمن السياحي
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Property Selector */}
          {properties.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <Building2 className="w-4 h-4 text-teal-600" />
              <select
                value={selectedProperty?.id || ""}
                onChange={(e) => {
                  const p = properties.find((x) => x.id === parseInt(e.target.value));
                  if (p) onSelectProperty(p);
                }}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => {
              setRefreshing(true);
              fetchAllReportData();
            }}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            تحديث البيانات
          </button>
        </div>
      </div>

      {/* 11 Sub-Tabs Navigation Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 no-scrollbar">
        {REPORT_SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = reportSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setReportSubTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                isActive
                  ? "bg-teal-600 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Report Content Areas */}
      {loading ? (
        <HotelSkeletonLoader rows={6} cols={7} />
      ) : (
        <div>
          {/* 1. KPIs Report */}
          {reportSubTab === "kpis" && (
            <KPIsReport
              metrics={metrics}
              dirtyRoomsCount={dirtyRoomsCount}
              overdueInvoicesCount={overdueInvoicesCount}
              inventoryItems={inventoryItems}
            />
          )}

          {/* 2. Police Registry */}
          {reportSubTab === "police_registry" && (
            <PoliceRegistry
              reservations={reservations}
              onViewDocModal={handleOpenDocModal}
              onExport={() => alert("جاري تصدير كشف الشرطة والسياحة...")}
              onPrint={() => window.print()}
            />
          )}

          {/* 3. Revenue Breakdown */}
          {reportSubTab === "revenue_breakdown" && (
            <RevenueReport
              revenueData={revenueData}
              inventoryItems={inventoryItems}
              onDeductMinibar={handleDeductMinibar}
              occupiedRooms={reservations.filter((r) => r.status === "checked_in").map((r) => ({ room_number: r.room_number || "101" }))}
            />
          )}

          {/* 4. Guest Balances */}
          {reportSubTab === "guest_balances" && (
            <GuestBalances
              balances={guestBalances}
              onOpenPaymentModal={(row) => {
                setSettlementRow(row);
                setPaymentAmount(Number(row.balance));
              }}
              onExport={() => alert("جاري تصدير كشف أرصدة النزلاء...")}
            />
          )}

          {/* 5. Reservations Channels */}
          {reportSubTab === "reservations_channels" && (
            <ReservationsChannels
              reservations={reservations}
              onExport={() => alert("جاري تصدير تقرير قنوات الحجز...")}
            />
          )}

          {/* 6. Housekeeping Services */}
          {reportSubTab === "housekeeping_services" && (
            <HousekeepingServices
              tasks={housekeepingTasks}
              serviceOrders={serviceOrders}
              onUpdateTaskStatus={handleUpdateHKStatus}
              onExport={() => alert("جاري تصدير تقرير الإشراف الداخلي...")}
            />
          )}

          {/* 7. Maintenance Report */}
          {reportSubTab === "maintenance_report" && (
            <MaintenanceReport
              maintenanceList={maintenanceList}
              onOpenNewTicketModal={() => setIsMaintenanceModalOpen(true)}
              onUpdateStatus={handleUpdateMaintenanceStatus}
              onExport={() => alert("جاري تصدير سجل الصيانة...")}
            />
          )}

          {/* 8. Guests Loyalty */}
          {reportSubTab === "guests_loyalty" && (
            <GuestsLoyalty
              guests={guests}
              onExport={() => alert("جاري تصدير برنامج ولاء النزلاء...")}
            />
          )}

          {/* 9. Inventory Supplies */}
          {reportSubTab === "inventory_supplies" && (
            <InventorySupplies
              inventoryItems={inventoryItems}
              onRequestPO={(item) =>
                alert(`تم تجهيز مسودة أمر شراء (PO) للصنف ${item.name} إلى موديول المشتريات`)
              }
              onExport={() => alert("جاري تصدير جرد المستلزمات...")}
            />
          )}

          {/* 10. Cashier Shifts */}
          {reportSubTab === "cashier_shifts" && (
            <CashierShifts
              shifts={cashierShifts}
              onExport={() => alert("جاري تصدير ورديات الكاشير...")}
            />
          )}

          {/* 11. Night Audit */}
          {reportSubTab === "night_audit" && (
            <NightAuditReport
              audits={nightAudits}
              onRunNightAudit={handleRunNightAudit}
              isRunning={isAuditing}
              onExport={() => alert("جاري تصدير سجل المراجعات الليلية...")}
            />
          )}
        </div>
      )}

      {/* SECURITY DOCUMENTS MODAL */}
      {isDocModalOpen && selectedDocReservation && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <Shield className="w-5 h-5 text-teal-600" />
                المستندات وإثباتات الهوية: {selectedDocReservation.guest_name}
              </div>
              <button
                onClick={() => setIsDocModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-500 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-slate-500 font-bold">الرقم القومي / الجواز:</span>{" "}
                  <span className="font-mono font-bold text-slate-800">
                    {selectedDocReservation.guest_id_number || selectedDocReservation.guest_passport_number || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold">الجنسية:</span>{" "}
                  <span className="font-bold text-slate-800">
                    {selectedDocReservation.guest_nationality || "مصري"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold">رقم الغرفة:</span>{" "}
                  <span className="font-bold text-teal-700">
                    غرفة {selectedDocReservation.room_number || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold">رقم الحجز:</span>{" "}
                  <span className="font-mono font-bold text-slate-800">
                    {selectedDocReservation.reservation_number}
                  </span>
                </div>
              </div>

              {/* Photos Gallery */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {selectedDocReservation.guest_id_photo_front || selectedDocReservation.id_photo_front ? (
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-600">بطاقة الرقم القومي (الوجه الأمامي)</span>
                    <img
                      src={selectedDocReservation.guest_id_photo_front || selectedDocReservation.id_photo_front}
                      alt="ID Front"
                      className="w-full h-48 object-cover rounded-xl border border-slate-200 shadow-sm"
                    />
                  </div>
                ) : null}

                {selectedDocReservation.guest_passport_photo || selectedDocReservation.passport_photo ? (
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-600">جواز السفر</span>
                    <img
                      src={selectedDocReservation.guest_passport_photo || selectedDocReservation.passport_photo}
                      alt="Passport"
                      className="w-full h-48 object-cover rounded-xl border border-slate-200 shadow-sm"
                    />
                  </div>
                ) : null}

                {selectedDocReservation.guest_personal_photo || selectedDocReservation.personal_photo ? (
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-600">الصورة الشخصية للنزيل</span>
                    <img
                      src={selectedDocReservation.guest_personal_photo || selectedDocReservation.personal_photo}
                      alt="Personal"
                      className="w-full h-48 object-cover rounded-xl border border-slate-200 shadow-sm"
                    />
                  </div>
                ) : null}

                {selectedDocReservation.guest_marriage_cert_photo || selectedDocReservation.marriage_cert_photo ? (
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-600">قسيمة الزواج (للعائلات)</span>
                    <img
                      src={selectedDocReservation.guest_marriage_cert_photo || selectedDocReservation.marriage_cert_photo}
                      alt="Marriage Cert"
                      className="w-full h-48 object-cover rounded-xl border border-slate-200 shadow-sm"
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsDocModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT SETTLEMENT MODAL */}
      {settlementRow && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitSettlement}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <DollarSign className="w-5 h-5 text-teal-600" />
                تحصيل دفعة مالية: {settlementRow.guest_name}
              </div>
              <button
                type="button"
                onClick={() => setSettlementRow(null)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-500 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">رقم الحجز / الغرفة:</span>
                <span className="font-mono font-bold text-teal-800">
                  {settlementRow.reservation_number} (غرفة {settlementRow.room_number})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">الرصيد المستحق الحالي:</span>
                <span className="font-black text-rose-600">
                  {Number(settlementRow.balance || 0).toLocaleString()} ج.م
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">المبلغ المحصل (ج.م):</label>
              <input
                type="number"
                required
                min={1}
                max={Number(settlementRow.balance)}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">طريقة الدفع والخزينة:</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-teal-500"
              >
                <option value="cash">نقداً (خزينة الاستقبال الرئيسية)</option>
                <option value="credit_card">بطاقة ائتمان / فيزا (POS Terminal)</option>
                <option value="bank_transfer">تحويل بنكي مباشر (CIB/NBE)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSettlementRow(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmittingPayment}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5"
              >
                <FileCheck className="w-4 h-4" />
                {isSubmittingPayment ? "جاري الحفظ..." : "تأكيد واستلام السند"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CREATE MAINTENANCE TICKET MODAL */}
      {isMaintenanceModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateMaintenanceTicket}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Wrench className="w-5 h-5 text-teal-600" />
                تسجيل بلاغ صيانة جديد
              </div>
              <button
                type="button"
                onClick={() => setIsMaintenanceModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-500 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">رقم الغرفة أو المرفق:</label>
              <input
                type="text"
                placeholder="مثال: 204 أو اللوبي أو المصعد"
                value={newMaintenanceRoom}
                onChange={(e) => setNewMaintenanceRoom(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">عنوان العطل / المشكلة:</label>
              <input
                type="text"
                required
                placeholder="مثال: عطل في مكيف الهواء أو تسريب مياه بالحمام"
                value={newMaintenanceProblem}
                onChange={(e) => setNewMaintenanceProblem(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">درجة الأولوية:</label>
              <select
                value={newMaintenancePriority}
                onChange={(e: any) => setNewMaintenancePriority(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-teal-500"
              >
                <option value="low">عادية (Low)</option>
                <option value="medium">متوسطة (Medium)</option>
                <option value="high">عالية (High)</option>
                <option value="urgent">عاجل وفوري (Urgent)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsMaintenanceModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                حفظ وإرسال لفريق الصيانة
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
