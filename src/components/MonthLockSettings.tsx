import React, { useState, useEffect } from "react";
import { Lock, Unlock, Calendar, ShieldAlert } from "lucide-react";
import { motion } from "motion/react";
import { api } from "../utils/api";

interface LockedMonth {
  month: string;
  is_locked: boolean;
}

interface MonthLockSettingsProps {
  onBack: () => void;
}

export const MonthLockSettings: React.FC<MonthLockSettingsProps> = ({
  onBack,
}) => {
  const [lockedMonths, setLockedMonths] = useState<LockedMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchLockedMonths();
  }, [selectedYear]);

  const fetchLockedMonths = async () => {
    try {
      const res = await api.get(
        `/api/security/locked-months?year=${selectedYear}`,
      );
      if (res.ok) {
        const data = await res.json();
        setLockedMonths(data);
      }
    } catch (error) {
      console.error("Failed to fetch locked months", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleLock = async (month: string, currentStatus: boolean) => {
    try {
      const res = await api.post("/api/security/toggle-month-lock", {
        month,
        is_locked: !currentStatus,
      });
      if (res.ok) {
        fetchLockedMonths();
      } else {
        const data = await res.json();
        alert(data.error || "فشل تغيير حالة القفل");
      }
    } catch (error) {
      alert("حدث خطأ أثناء الاتصال بالسيرفر");
    }
  };

  const months = [
    { id: "01", name: "يناير" },
    { id: "02", name: "فبراير" },
    { id: "03", name: "مارس" },
    { id: "04", name: "أبريل" },
    { id: "05", name: "مايو" },
    { id: "06", name: "يونيو" },
    { id: "07", name: "يوليو" },
    { id: "08", name: "أغسطس" },
    { id: "09", name: "سبتمبر" },
    { id: "10", name: "أكتوبر" },
    { id: "11", name: "نوفمبر" },
    { id: "12", name: "ديسمبر" },
  ];

  return (
    <div className="p-6 w-full">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/20">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">قفل الشهور</h1>
            <p className="text-slate-500 text-sm">
              منع التلاعب في بيانات المرتبات والبصمات للشهور المغلقة
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <select
            value={selectedYear ?? ""}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-white border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-red-500 font-bold"
          >
            {[2024, 2025, 2026, 2027, 2028].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <button
            onClick={onBack}
            className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl transition-all"
          >
            رجوع
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {months.map((m) => {
          const monthStr = `${selectedYear}-${m.id}`;
          const isLocked =
            lockedMonths.find((lm) => lm.month === monthStr)?.is_locked ||
            false;

          return (
            <motion.div
              key={m.id}
              whileHover={{ scale: 1.02 }}
              className={`p-6 rounded-3xl border transition-all ${
                isLocked
                  ? "bg-red-50 border-red-200 shadow-lg shadow-red-500/5"
                  : "bg-white border-slate-100 hover:border-slate-200 shadow-sm"
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isLocked
                        ? "bg-red-100 text-red-600"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{m.name}</h3>
                    <p className="text-xs text-slate-500">{selectedYear}</p>
                  </div>
                </div>
                {isLocked && (
                  <ShieldAlert className="w-5 h-5 text-red-500 animate-pulse" />
                )}
              </div>

              <button
                onClick={() => toggleLock(monthStr, isLocked)}
                className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                  isLocked
                    ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20"
                    : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                }`}
              >
                {isLocked ? (
                  <>
                    <Unlock className="w-5 h-5" />
                    <span>فتح الشهر</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    <span>قفل الشهر</span>
                  </>
                )}
              </button>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-8 p-6 bg-amber-50 border border-amber-200 rounded-3xl flex items-start gap-4">
        <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-1" />
        <div>
          <h4 className="font-bold text-amber-800 mb-1">تنبيه هام</h4>
          <p className="text-sm text-amber-700 leading-relaxed">
            عند قفل الشهر، لن يتمكن أي مستخدم من إضافة أو تعديل أو حذف أي بيانات
            تتعلق بالبصمات، السلف، المكافآت، الخصومات، أو صرف المرتبات لهذا
            الشهر. يرجى التأكد من مراجعة كافة البيانات قبل القفل.
          </p>
          <p className="text-sm text-amber-800 leading-relaxed mt-3 pt-3 border-t border-amber-200">
            <strong>ملاحظة مهمة:</strong> قفل الشهر هنا <strong>لا يُنشئ أي قيود محاسبية</strong> —
            هو حاجز يمنع التسجيل والتعديل فقط. القيود تُرحَّل قبل القفل من:
            «المرتبات ← إقفال وصرف المسير» (قيد استحقاق المرتبات ثم سند الصرف)،
            وباقي الوحدات (مصروفات، فواتير، خزينة) ترحّل قيودها من شاشاتها.
            لو قفلت الشهر قبل الترحيل، سيُرفض أي قيد جديد على هذا الشهر.
          </p>
        </div>
      </div>
    </div>
  );
};
