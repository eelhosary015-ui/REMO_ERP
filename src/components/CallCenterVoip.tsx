import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  Clock,
  Copy,
  Delete,
  Phone,
  PhoneCall,
  PhoneOutgoing,
  RefreshCw,
  Search,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import { api } from "../utils/api";
import type { Branch } from "../types";

interface CallCenterVoipProps {
  branch: Branch | null;
  cashierName?: string;
  onBack: () => void;
}

interface CallEntry {
  id: string;
  number: string;
  name: string;
  at: string;
}

const digitsOnly = (value: string) => String(value || "").replace(/\D/g, "");

const normalizePhone = (value: string) => digitsOnly(value).replace(/^0+/, "");

export const CallCenterVoip: React.FC<CallCenterVoipProps> = ({ branch, cashierName, onBack }) => {
  const storageKey = `cc.voip.log.${branch?.id ?? "all"}`;

  const [number, setNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [log, setLog] = useState<CallEntry[]>(() => {
    try {
      const raw = localStorage.getItem(`cc.voip.log.${branch?.id ?? "all"}`);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const persist = (next: CallEntry[]) => {
    setLog(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch (_) {}
  };

  const loadCustomers = async () => {
    setCustomersLoading(true);
    try {
      const res = await api.get("/api/customers");
      if (res.ok) {
        const data = await res.json().catch(() => []);
        setCustomers(Array.isArray(data) ? data : []);
      }
    } catch (_) {
      // silent — the screen still works as a dialer
    } finally {
      setCustomersLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (!info) return;
    const timer = setTimeout(() => setInfo(null), 2500);
    return () => clearTimeout(timer);
  }, [info]);

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers.slice(0, 20);
    return customers
      .filter((c) => {
        const name = String(c?.name || "").toLowerCase();
        const phone = String(c?.phone || "");
        const phone2 = String(c?.phone_2 || "");
        return name.includes(term) || phone.includes(term) || phone2.includes(term);
      })
      .slice(0, 30);
  }, [customers, search]);

  const resolveName = (value: string) => {
    const target = normalizePhone(value);
    if (!target) return "";
    const match = customers.find(
      (c) => normalizePhone(c?.phone) === target || normalizePhone(c?.phone_2) === target
    );
    return match?.name ? String(match.name) : "";
  };

  const placeCall = (rawNumber: string, name?: string) => {
    const cleaned = String(rawNumber || "").replace(/[^\d+*#]/g, "").trim();
    if (digitsOnly(cleaned).length < 4) {
      setError("أدخل رقمًا صحيحًا (4 أرقام على الأقل) قبل الاتصال.");
      return;
    }
    setError(null);
    const entry: CallEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      number: cleaned,
      name: name || resolveName(cleaned),
      at: new Date().toISOString(),
    };
    persist([entry, ...log].slice(0, 50));
    setInfo(`جاري فتح تطبيق الاتصال على الرقم ${cleaned}`);
    try {
      const link = document.createElement("a");
      link.href = `tel:${cleaned}`;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (_) {
      setError("المتصفح منع فتح تطبيق الاتصال. استخدم زر نسخ الرقم واتصل يدويًا.");
    }
  };

  const pressKey = (key: string) => {
    setError(null);
    setNumber((prev) => `${prev}${key}`);
  };

  const removeLogEntry = (id: string) => persist(log.filter((item) => item.id !== id));
  const clearLog = () => persist([]);

  const copyNumber = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setInfo(`تم نسخ الرقم ${value}`);
    } catch (_) {
      setError("تعذر نسخ الرقم على هذا المتصفح.");
    }
  };

  const selectedCustomer = useMemo(() => {
    const target = normalizePhone(number);
    if (!target) return null;
    return (
      customers.find(
        (c) => normalizePhone(c?.phone) === target || normalizePhone(c?.phone_2) === target
      ) || null
    );
  }, [customers, number]);

  return (
    <div className="min-h-screen h-full bg-slate-50 flex flex-col overflow-hidden text-right font-cairo" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-xs">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
            title="رجوع"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div className="w-11 h-11 rounded-2xl bg-cyan-600 text-white flex items-center justify-center shadow-md shadow-cyan-600/20">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">VOIP — اتصال عملاء الكول سنتر</h1>
            <p className="text-xs text-slate-500 font-bold mt-0.5">
              لوحة اتصال سريعة بأرقام العملاء مع سجل آخر المكالمات
            </p>
          </div>
          <span className="px-3 py-1 rounded-lg text-[11px] font-black bg-cyan-50 text-cyan-800 border border-cyan-200 flex items-center gap-1">
            <Building2 className="w-3 h-3" />
            {branch?.name || "كل الفروع"}
          </span>
          {cashierName && (
            <span className="px-3 py-1 rounded-lg text-[11px] font-black bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
              <User className="w-3 h-3" />
              {cashierName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 max-w-[260px] leading-4">
            الاتصال يتم عبر تطبيق الهاتف / السوفت فون المثبت على الجهاز.
          </span>
          <button
            type="button"
            onClick={loadCustomers}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${customersLoading ? "animate-spin" : ""}`} />
            تحديث العملاء
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {(error || info) && (
          <div
            className={`rounded-xl border px-4 py-3 text-xs font-black ${
              error
                ? "bg-rose-50 border-rose-200 text-rose-700"
                : "bg-emerald-50 border-emerald-200 text-emerald-700"
            }`}
          >
            {error || info}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Dialer */}
          <div className="xl:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <PhoneOutgoing className="w-4 h-4 text-cyan-600" />
                لوحة الاتصال
              </h2>
              <span className="text-[10px] font-bold text-slate-400">Dial Pad</span>
            </div>

            <div className="bg-slate-900 rounded-2xl px-4 py-4 mb-4">
              <input
                value={number}
                onChange={(e) => {
                  setError(null);
                  setNumber(e.target.value.replace(/[^\d+*#]/g, ""));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") placeCall(number);
                }}
                placeholder="أدخل رقم الهاتف..."
                dir="ltr"
                className="w-full bg-transparent text-white text-2xl font-black font-mono text-center tracking-wider focus:outline-none placeholder:text-slate-500 placeholder:text-sm placeholder:font-bold"
              />
              <div className="mt-2 text-center text-[10px] font-bold text-slate-400 h-4 truncate">
                {selectedCustomer
                  ? `عميل مسجل: ${selectedCustomer.name}`
                  : number
                    ? "رقم غير مسجل في قاعدة العملاء"
                    : "اكتب الرقم أو اختر عميلًا من القائمة"}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => pressKey(key)}
                  className="h-12 rounded-xl bg-slate-50 hover:bg-cyan-50 hover:text-cyan-700 border border-slate-200 text-lg font-black text-slate-700 transition-colors cursor-pointer"
                >
                  {key}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 mt-2">
              <button
                type="button"
                onClick={() => setNumber((prev) => prev.slice(0, -1))}
                className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                title="حذف رقم"
              >
                <Delete className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => placeCall(number)}
                className="col-span-2 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Phone className="w-4 h-4" />
                اتصال
              </button>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => copyNumber(number)}
                disabled={!number}
                className="flex-1 h-9 rounded-lg bg-slate-50 hover:bg-slate-100 disabled:opacity-40 border border-slate-200 text-slate-600 text-[11px] font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                نسخ الرقم
              </button>
              <button
                type="button"
                onClick={() => {
                  setNumber("");
                  setError(null);
                }}
                className="flex-1 h-9 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                مسح
              </button>
            </div>

            <p className="mt-4 text-[10px] leading-5 text-slate-400 font-bold bg-slate-50 border border-slate-100 rounded-xl p-3">
              لربط مزود VoIP داخلي (SIP / WebRTC) بشكل مباشر من النظام نحتاج بيانات المزود
              (السيرفر والامتداد وكلمة المرور). حاليًا يتم الاتصال عبر تطبيق الاتصال الافتراضي
              على الجهاز باستخدام رابط <span dir="ltr" className="font-mono">tel:</span>.
            </p>
          </div>

          {/* Customers */}
          <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-600" />
                عملاء الكول سنتر
                <span className="text-[10px] font-bold text-slate-400">
                  ({customers.length.toLocaleString("ar-EG")} عميل)
                </span>
              </h2>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث بالاسم أو رقم الهاتف..."
                  className="bg-slate-50 border border-slate-200 rounded-xl py-2 pr-9 pl-3 text-xs font-bold w-64 focus:bg-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {customersLoading ? (
                <div className="p-10 text-center">
                  <div className="w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-xs font-bold text-slate-500">جاري تحميل العملاء...</p>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-xs font-bold">
                  لا يوجد عملاء مطابقون للبحث
                </div>
              ) : (
                filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-800 truncate">
                        {customer.name || "بدون اسم"}
                      </p>
                      <p className="text-[11px] font-bold text-slate-500 font-mono" dir="ltr">
                        {customer.phone || customer.phone_2 || "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setNumber(String(customer.phone || customer.phone_2 || ""));
                          setError(null);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-black transition-colors cursor-pointer"
                      >
                        اختيار
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          placeCall(
                            String(customer.phone || customer.phone_2 || ""),
                            customer.name
                          )
                        }
                        disabled={!customer.phone && !customer.phone_2}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-[11px] font-black flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Phone className="w-3 h-3" />
                        اتصال
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Call log */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-600" />
              سجل المكالمات
              <span className="text-[10px] font-bold text-slate-400">
                ({log.length.toLocaleString("ar-EG")})
              </span>
            </h2>
            {log.length > 0 && (
              <button
                type="button"
                onClick={clearLog}
                className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-black flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                مسح السجل
              </button>
            )}
          </div>

          {log.length === 0 ? (
            <div className="p-10 text-center">
              <PhoneCall className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-400">
                لا توجد مكالمات مسجلة بعد — اضغط "اتصال" ليتم تسجيل المكالمة هنا.
              </p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-right p-3 font-black">العميل / الرقم</th>
                  <th className="text-center p-3 font-black">وقت الاتصال</th>
                  <th className="text-center p-3 font-black">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {log.map((entry) => (
                  <tr key={entry.id} className="border-t border-slate-100">
                    <td className="p-3">
                      <p className="font-black text-slate-800">
                        {entry.name || "رقم غير مسجل"}
                      </p>
                      <p className="text-[11px] font-bold text-slate-500 font-mono" dir="ltr">
                        {entry.number}
                      </p>
                    </td>
                    <td className="p-3 text-center text-[11px] font-bold text-slate-500">
                      {new Date(entry.at).toLocaleString("ar-EG")}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => placeCall(entry.number, entry.name)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Phone className="w-3 h-3" />
                          اتصال
                        </button>
                        <button
                          type="button"
                          onClick={() => copyNumber(entry.number)}
                          className="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                          title="نسخ الرقم"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeLogEntry(entry.id)}
                          className="px-2 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                          title="حذف من السجل"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallCenterVoip;
