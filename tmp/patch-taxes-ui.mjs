import fs from "node:fs";

const file = "src/components/TaxesView.tsx";
let s = fs.readFileSync(file, "utf8");
const once = (needle, replacement, label) => {
  const i = s.indexOf(needle);
  if (i === -1) throw new Error("missing: " + label);
  s = s.slice(0, i) + replacement + s.slice(i + needle.length);
};

// 1) useEffect
once(`import React, { useState } from "react";`, `import React, { useEffect, useState } from "react";`, "react import");

// 2) حالة مركز الضرائب
once(
`  const [vatRecords, setVatRecords] = useState<VATRecord[]>([]);`,
`  const [vatRecords, setVatRecords] = useState<VATRecord[]>([]);
  const [taxCenter, setTaxCenter] = useState<any | null>(null);
  const [taxLoading, setTaxLoading] = useState(false);`,
"vat state");

// 3) تحميل البيانات الحقيقية وبناء سجل الفترات
once(
`  const [showAddVatModal, setShowAddVatModal] = useState(false);`,
`  // تحميل مركز الضرائب من المستندات الفعلية (فواتير بيع/شراء/مرتجعات) + مطابقة الأستاذ
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setTaxLoading(true);
      try {
        const from = \`\${selectedYear}-01-01\`;
        const to = \`\${selectedYear}-12-31\`;
        const res = await fetch(\`/api/reports/tax-center?from=\${from}&to=\${to}\`, {
          headers: { Authorization: \`Bearer \${localStorage.getItem("token") || "preview-bypass-token"}\` },
        });
        const data = await res.json();
        if (cancelled || !res.ok) return;
        setTaxCenter(data);
        const months: Record<string, any> = {};
        for (const m of data.movements || []) {
          const key = String(m.doc_date).slice(0, 7);
          if (!months[key]) months[key] = { sales: 0, purchases: 0, outTax: 0, inTax: 0 };
          const base = Number(m.base_amount) || 0;
          const tax = Number(m.tax_amount) || 0;
          if (m.doc_type === "sale") { months[key].sales += base; months[key].outTax += tax; }
          else if (m.doc_type === "sale_return") { months[key].sales -= base; months[key].outTax -= tax; }
          else if (m.doc_type === "purchase") { months[key].purchases += base; months[key].inTax += tax; }
          else if (m.doc_type === "purchase_return") { months[key].purchases -= base; months[key].inTax -= tax; }
        }
        const monthNames = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
        const records = Object.keys(months).sort().reverse().map((key, idx) => {
          const [y, mm] = key.split("-");
          const v = months[key];
          const lastDay = new Date(Number(y), Number(mm), 0).getDate();
          return {
            id: idx + 1,
            period: \`\${monthNames[Number(mm) - 1]} - \${y}\`,
            startDate: \`01/\${mm}/\${y}\`,
            endDate: \`\${String(lastDay).padStart(2, "0")}/\${mm}/\${y}\`,
            salesAmount: Math.round(v.sales * 100) / 100,
            purchasesAmount: Math.round(v.purchases * 100) / 100,
            netTax: Math.round((v.outTax - v.inTax) * 100) / 100,
            status: "not_submitted" as const,
          };
        });
        setVatRecords(records);
      } catch (e) {
        console.error("Tax center load failed", e);
      } finally {
        if (!cancelled) setTaxLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [selectedYear]);

  const [showAddVatModal, setShowAddVatModal] = useState(false);`,
"load effect");

// 4) بانر المطابقة أعلى الصفحة
once(
`    <div className="space-y-6 dir-rtl" style={{ direction: "rtl" }}>`,
`    <div className="space-y-6 dir-rtl" style={{ direction: "rtl" }}>
      {/* ملخص الضرائب الفعلي + مطابقة الأستاذ */}
      {taxCenter?.summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-[11px] font-black text-emerald-700">ضريبة المخرجات (مبيعات)</div>
            <div className="text-xl font-black text-emerald-800 mt-1 tabular-nums">
              {Number(taxCenter.summary.output_tax_net).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] font-bold text-emerald-600 mt-1">
              مرحّل: {Number(taxCenter.summary.output_tax_posted).toLocaleString("en-US")} / الأستاذ: {Number(taxCenter.summary.gl_output).toLocaleString("en-US")}
            </div>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <div className="text-[11px] font-black text-sky-700">ضريبة المدخلات (مشتريات)</div>
            <div className="text-xl font-black text-sky-800 mt-1 tabular-nums">
              {Number(taxCenter.summary.input_tax_net).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] font-bold text-sky-600 mt-1">
              مرحّل: {Number(taxCenter.summary.input_tax_posted).toLocaleString("en-US")} / الأستاذ: {Number(taxCenter.summary.gl_input).toLocaleString("en-US")}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-black text-slate-500">صافي المركز الضريبي</div>
            <div className={"text-xl font-black mt-1 tabular-nums " + (Number(taxCenter.summary.net_position) >= 0 ? "text-rose-700" : "text-emerald-700")}>
              {Number(taxCenter.summary.net_position).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] font-bold text-slate-500 mt-1">
              {Number(taxCenter.summary.net_position) >= 0 ? "مستحق للمصلحة" : "رصيد دائن لصالح الشركة"}
            </div>
          </div>
          <div className={"rounded-2xl border p-4 " + (Math.abs(Number(taxCenter.summary.difference)) < 0.01 ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50")}>
            <div className="text-[11px] font-black text-slate-600">فرق المطابقة مع الأستاذ</div>
            <div className={"text-xl font-black mt-1 tabular-nums " + (Math.abs(Number(taxCenter.summary.difference)) < 0.01 ? "text-emerald-700" : "text-amber-700")}>
              {Number(taxCenter.summary.difference).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] font-bold text-slate-500 mt-1">
              {Math.abs(Number(taxCenter.summary.difference)) < 0.01 ? "مطابق" : "راجع المستندات غير المرحّلة"}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-black text-slate-500">المستندات الضريبية</div>
            <div className="text-xl font-black text-slate-800 mt-1 tabular-nums">{Number(taxCenter.summary.documents)}</div>
            <div className="text-[10px] font-bold text-amber-700 mt-1">
              غير مرحّلة: {Number(taxCenter.summary.unposted_documents)}
            </div>
          </div>
        </div>
      )}
`,
"banner");

fs.writeFileSync(file, s, "utf8");
console.log("TaxesView patched");
