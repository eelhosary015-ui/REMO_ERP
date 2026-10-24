import React, { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Loader2,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { api } from "../utils/api";

interface SchemaColumn {
  table: string;
  column: string;
  type: string;
  reason: string;
}

interface SchemaReport {
  generatedAt: string;
  mode: string;
  ok: boolean;
  totals: {
    tables: number;
    columns: number;
    ok: number;
    added: number;
    missing: number;
    missingTables: number;
  };
  added: { table: string; column: string; type: string }[];
  missing: SchemaColumn[];
  missingTables: { table: string; purpose: string }[];
  tables: { table: string; purpose: string; required: number; present: number }[];
}

interface SettingsReport {
  generatedAt: string;
  totals: { dbKeys: number; codeKeys: number; healthy: number; unused: number; missing: number };
  unusedKeys: { key: string; valuePreview: string; note: string }[];
  missingKeys: { key: string; usedIn: string[]; important: boolean; note: string }[];
  catalog: { key: string; label: string; exists: boolean; readByCode: boolean; consumers: string[] }[];
  warnings: string[];
}

const Stat: React.FC<{ label: string; value: string | number; tone?: "ok" | "warn" | "bad" | "muted" }> = ({
  label,
  value,
  tone = "muted",
}) => {
  const tones: Record<string, string> = {
    ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warn: "bg-amber-50 text-amber-700 border-amber-200",
    bad: "bg-rose-50 text-rose-700 border-rose-200",
    muted: "bg-slate-50 text-slate-700 border-slate-200",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone]}`}>
      <p className="text-[11px] font-bold opacity-70">{label}</p>
      <p className="text-lg font-black font-mono">{value}</p>
    </div>
  );
};

export const SystemHealthView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [schema, setSchema] = useState<SchemaReport | null>(null);
  const [settings, setSettings] = useState<SettingsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"schema" | "settings" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [schemaRes, settingsRes] = await Promise.all([
        api.get("/api/system/health/schema-guard"),
        api.get("/api/system/health/settings"),
      ]);
      const schemaData = await schemaRes.json().catch(() => ({}));
      const settingsData = await settingsRes.json().catch(() => ({}));
      if (schemaData?.report) setSchema(schemaData.report);
      if (settingsData?.report) setSettings(settingsData.report);
    } catch (err: any) {
      setError(err?.message || "تعذر تحميل تقرير الصحة");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const runSchemaFix = async () => {
    setBusy("schema");
    setError(null);
    try {
      const res = await api.post("/api/system/health/schema-guard/run", { fix: true });
      const data = await res.json().catch(() => ({}));
      if (data?.report) setSchema(data.report);
      else setError(data?.error || "فشل تشغيل حارس المخطط");
    } catch (err: any) {
      setError(err?.message || "فشل تشغيل حارس المخطط");
    } finally {
      setBusy(null);
    }
  };

  const rescanSettings = async () => {
    setBusy("settings");
    setError(null);
    try {
      const res = await api.get("/api/system/health/settings?rerun=1");
      const data = await res.json().catch(() => ({}));
      if (data?.report) setSettings(data.report);
    } catch (err: any) {
      setError(err?.message || "فشل إعادة فحص الإعدادات");
    } finally {
      setBusy(null);
    }
  };

  const schemaOk = schema?.ok ?? false;
  const settingsOk = settings ? settings.totals.unused === 0 && settings.totals.missing === 0 : false;

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-600" />
            صحة النظام
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            فحص مخطط قاعدة البيانات مقابل استعلامات الكود، ومطابقة إعدادات النظام مع الكود الفعلي.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadAll}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-xs font-bold flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            تحديث
          </button>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-xs font-bold"
          >
            رجوع
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
          {error}
        </div>
      )}

      {loading && !schema && !settings ? (
        <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm font-bold">جاري فحص صحة النظام...</span>
        </div>
      ) : (
        <>
          {/* ── Schema guard ── */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    schemaOk ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                  }`}
                >
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-black text-slate-800">حارس المخططات</h2>
                  <p className="text-[11px] text-slate-500">
                    كل عمود بتستعمله الاستعلامات لازم يكون موجود — وإلا أخطاء 500 في الشاشات.
                  </p>
                </div>
              </div>
              <button
                onClick={runSchemaFix}
                disabled={busy === "schema"}
                className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {busy === "schema" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
                إصلاح الأعمدة الناقصة
              </button>
            </header>

            {schema && (
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Stat
                    label="الأعمدة المتحققة"
                    value={`${schema.totals.ok}/${schema.totals.columns}`}
                    tone={schemaOk ? "ok" : "bad"}
                  />
                  <Stat label="الجداول" value={schema.totals.tables} />
                  <Stat label="تمت إضافتها الآن" value={schema.totals.added} tone={schema.totals.added > 0 ? "warn" : "muted"} />
                  <Stat label="متبقّي ناقص" value={schema.totals.missing + schema.totals.missingTables} tone={schema.totals.missing + schema.totals.missingTables > 0 ? "bad" : "ok"} />
                </div>

                {schema.totals.added > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <p className="font-bold mb-1">أعمدة تمت إضافتها تلقائيًا:</p>
                    {schema.added.map((col) => (
                      <p key={`${col.table}.${col.column}`} className="font-mono">
                        + {col.table}.{col.column} ({col.type})
                      </p>
                    ))}
                  </div>
                )}

                {schema.missingTables.length > 0 && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                    <p className="font-bold mb-1">جداول ناقصة بالكامل:</p>
                    {schema.missingTables.map((t) => (
                      <p key={t.table}>
                        • {t.table} — {t.purpose}
                      </p>
                    ))}
                  </div>
                )}

                {schema.missing.length > 0 && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 max-h-48 overflow-y-auto">
                    <p className="font-bold mb-1">أعمدة ناقصة ({schema.missing.length}):</p>
                    {schema.missing.map((col) => (
                      <p key={`${col.table}.${col.column}`}>
                        • {col.table}.{col.column} ({col.type}) — {col.reason}
                      </p>
                    ))}
                  </div>
                )}

                <details className="border border-slate-200 rounded-xl">
                  <summary className="cursor-pointer text-xs font-bold text-slate-600 px-4 py-3">
                    تفاصيل كل جدول ({schema.tables.length})
                  </summary>
                  <div className="max-h-64 overflow-y-auto px-4 pb-4">
                    <table className="w-full text-right text-[11px]">
                      <tbody className="divide-y divide-slate-100">
                        {schema.tables.map((table) => {
                          const complete = table.present >= table.required;
                          return (
                            <tr key={table.table}>
                              <td className="py-2 font-mono font-bold text-slate-700 w-40">{table.table}</td>
                              <td className="py-2 text-slate-500">{table.purpose}</td>
                              <td className={`py-2 font-mono w-24 text-left ${complete ? "text-emerald-600" : "text-rose-600"}`}>
                                {complete ? <CheckCircle2 className="w-4 h-4 inline" /> : <AlertTriangle className="w-4 h-4 inline" />}{" "}
                                {table.present}/{table.required}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
              </div>
            )}
          </section>

          {/* ── Settings health ── */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    settingsOk ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                  }`}
                >
                  <Settings2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-black text-slate-800">صحة الإعدادات</h2>
                  <p className="text-[11px] text-slate-500">
                    إعدادات موجودة في الداتابيز ومحدش بيقرأها، وإعدادات الكود بيقرأها وهي مش موجودة.
                  </p>
                </div>
              </div>
              <button
                onClick={rescanSettings}
                disabled={busy === "settings"}
                className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 disabled:opacity-50 flex items-center gap-1.5"
              >
                {busy === "settings" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                إعادة فحص الكود
              </button>
            </header>

            {settings && (
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Stat label="إعدادات في الداتابيز" value={settings.totals.dbKeys} />
                  <Stat label="مقروءة فعليًا" value={settings.totals.healthy} tone="ok" />
                  <Stat label="غير مستخدمة" value={settings.totals.unused} tone={settings.totals.unused > 0 ? "warn" : "ok"} />
                  <Stat label="مطلوبة ومش موجودة" value={settings.totals.missing} tone={settings.totals.missing > 0 ? "warn" : "ok"} />
                </div>

                {settings.warnings.map((warning) => (
                  <div key={warning} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                    {warning}
                  </div>
                ))}

                {settings.unusedKeys.length > 0 && (
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <p className="px-4 py-2 bg-slate-50 text-xs font-black text-slate-700">
                      إعدادات في الداتابيز لا يقرأها أي كود ({settings.unusedKeys.length})
                    </p>
                    <ul className="divide-y divide-slate-100 max-h-52 overflow-y-auto">
                      {settings.unusedKeys.map((entry) => (
                        <li key={entry.key} className="px-4 py-2 text-[11px]">
                          <span className="font-mono font-bold text-slate-700">{entry.key}</span>
                          {entry.valuePreview && (
                            <span className="text-slate-400 font-mono mr-2">= {entry.valuePreview}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {settings.missingKeys.length > 0 && (
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <p className="px-4 py-2 bg-slate-50 text-xs font-black text-slate-700">
                      إعدادات يقرأها الكود وغير موجودة في الداتابيز ({settings.missingKeys.length})
                    </p>
                    <ul className="divide-y divide-slate-100 max-h-52 overflow-y-auto">
                      {settings.missingKeys.map((entry) => (
                        <li key={entry.key} className="px-4 py-2 text-[11px]">
                          <span className={`font-mono font-bold ${entry.important ? "text-rose-600" : "text-slate-700"}`}>
                            {entry.key}
                          </span>
                          <span className="text-slate-400 mr-2">← {entry.usedIn.slice(0, 2).join("، ")}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <details className="border border-slate-200 rounded-xl">
                  <summary className="cursor-pointer text-xs font-bold text-slate-600 px-4 py-3">
                    catalogue الإعدادات المهمة ({settings.catalog.length})
                  </summary>
                  <div className="max-h-64 overflow-y-auto px-4 pb-4">
                    <table className="w-full text-right text-[11px]">
                      <tbody className="divide-y divide-slate-100">
                        {settings.catalog.map((entry) => (
                          <tr key={entry.key}>
                            <td className="py-2 font-mono font-bold text-slate-700 w-52">{entry.key}</td>
                            <td className="py-2 text-slate-500">{entry.label}</td>
                            <td className="py-2 w-32 text-left">
                              {entry.exists ? (
                                <span className="text-emerald-600 font-bold">موجود</span>
                              ) : (
                                <span className="text-rose-600 font-bold">غير موجود</span>
                              )}
                            </td>
                            <td className="py-2 w-24 text-left">
                              {entry.readByCode ? (
                                <span className="text-emerald-600 font-bold">يُقرأ</span>
                              ) : (
                                <span className="text-amber-600 font-bold">لا يُقرأ</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
