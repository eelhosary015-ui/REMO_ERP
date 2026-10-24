import fs from "node:fs";

const file = "src/components/Costs.tsx";
let s = fs.readFileSync(file, "utf8");
const once = (needle, replacement, label) => {
  const i = s.indexOf(needle);
  if (i === -1) throw new Error("missing: " + label);
  s = s.slice(0, i) + replacement + s.slice(i + needle.length);
};

// 1) حالة الترقيم + إعادة التصفير عند تغيير الفلاتر
once(
`  const [ocToDate, setOcToDate] = useState('');`,
`  const [ocToDate, setOcToDate] = useState('');
  // ترقيم صفحات جدول التكاليف التشغيلية: 25 / 50 / 100
  const [ocPage, setOcPage] = useState(1);
  const [ocPageSize, setOcPageSize] = useState(25);
  useEffect(() => {
    setOcPage(1);
  }, [ocSearch, ocStatus, ocCenter, ocFromDate, ocToDate, ocPageSize]);`,
"state",
);

// 2) قائمة مفلترة موحّدة + صفحات
once(
`  // Calculate dynamic stats`,
`  // قائمة التكاليف التشغيلية بعد فلاتر التاب (مصدر واحد للجدول والإجمالي والترقيم)
  const ocFiltered = costs.filter((c: any) => {
    const q = ocSearch.toLowerCase();
    const matchesSearch = ocSearch === '' ||
      (c.notes && String(c.notes).toLowerCase().includes(q)) ||
      (c.voucher_no && String(c.voucher_no).toLowerCase().includes(q));
    const matchesStatus = ocStatus === 'all' || c.status === ocStatus;
    const matchesCenter = ocCenter === 'all' || Number(c.cost_center_id) === Number(ocCenter);
    const matchesDate = (!ocFromDate || new Date(c.date) >= new Date(ocFromDate + 'T00:00:00')) &&
                        (!ocToDate || new Date(c.date) <= new Date(ocToDate + 'T23:59:59'));
    return matchesSearch && matchesStatus && matchesCenter && matchesDate;
  });
  const ocTotalPages = Math.max(1, Math.ceil(ocFiltered.length / ocPageSize));
  const ocSafePage = Math.min(Math.max(1, ocPage), ocTotalPages);
  const ocStart = (ocSafePage - 1) * ocPageSize;
  const ocPageRows = ocFiltered.slice(ocStart, ocStart + ocPageSize);
  const ocPageNumbers = (() => {
    const pages: number[] = [];
    const from = Math.max(1, ocSafePage - 2);
    const to = Math.min(ocTotalPages, from + 4);
    for (let p = from; p <= to; p += 1) pages.push(p);
    return pages;
  })();

  // Calculate dynamic stats`,
"filtered",
);

// 3) استبدال الفلاتر المكرّرة داخل الجدول بالقائمة الموحّدة
const filterRe = /costs\.filter\(c => \{[\s\S]*?return matchesSearch && matchesStatus && matchesCenter && matchesDate;\s*\}\)/g;
const tabStart = s.indexOf("{activeTab === 'operating_costs' && (");
const tabEnd = s.indexOf("{/* TAB 1C: ESTIMATED BUDGET CONTROL", tabStart);
if (tabStart === -1 || tabEnd === -1) throw new Error("operating tab bounds not found");
let tab = s.slice(tabStart, tabEnd);
const matches = tab.match(filterRe) || [];
if (matches.length < 3) throw new Error("expected inline filters in tab, found " + matches.length);
console.log("inline filters replaced:", matches.length);
tab = tab.replace(filterRe, "ocFiltered");
s = s.slice(0, tabStart) + tab + s.slice(tabEnd);

// 4) الجدول يعرض صفحة واحدة فقط
once("ocFiltered.map((cost) => (", "ocPageRows.map((cost) => (", "map");

// 5) شريط الترقيم قبل سطر الإجمالي
once(
`              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs font-black text-slate-800">`,
`              {ocFiltered.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-white">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                    <span>عرض</span>
                    <select
                      value={ocPageSize}
                      onChange={(e) => setOcPageSize(Number(e.target.value))}
                      className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
                      aria-label="عدد الصفوف في الصفحة"
                    >
                      {[25, 50, 100].map((size) => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                    <span>صف</span>
                    <span className="text-slate-400">•</span>
                    <span className="tabular-nums">
                      {ocStart + 1}–{Math.min(ocStart + ocPageSize, ocFiltered.length)} من {ocFiltered.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setOcPage(1)} disabled={ocSafePage === 1}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed">
                      الأولى
                    </button>
                    <button type="button" onClick={() => setOcPage(ocSafePage - 1)} disabled={ocSafePage === 1}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed">
                      السابق
                    </button>
                    {ocPageNumbers.map((pageNumber) => (
                      <button key={pageNumber} type="button" onClick={() => setOcPage(pageNumber)}
                        aria-current={pageNumber === ocSafePage ? "page" : undefined}
                        className={pageNumber === ocSafePage
                          ? "min-w-[32px] px-2 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-black shadow-sm"
                          : "min-w-[32px] px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-100"}>
                        {pageNumber}
                      </button>
                    ))}
                    <button type="button" onClick={() => setOcPage(ocSafePage + 1)} disabled={ocSafePage === ocTotalPages}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed">
                      التالي
                    </button>
                    <button type="button" onClick={() => setOcPage(ocTotalPages)} disabled={ocSafePage === ocTotalPages}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed">
                      الأخيرة
                    </button>
                  </div>
                </div>
              )}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs font-black text-slate-800">`,
"pagination",
);

fs.writeFileSync(file, s, "utf8");
console.log("costs pagination applied");
