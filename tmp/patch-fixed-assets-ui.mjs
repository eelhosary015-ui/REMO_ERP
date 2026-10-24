import fs from "node:fs";

const file = "src/components/FixedAssetsView.tsx";
let s = fs.readFileSync(file, "utf8");
const replaceOnce = (needle, replacement, label) => {
  const i = s.indexOf(needle);
  if (i === -1) throw new Error("missing: " + label);
  s = s.slice(0, i) + replacement + s.slice(i + needle.length);
};

// 1) توسيع الواجهة بحقول الربط
replaceOnce(
`  accumulatedDepreciation?: number;
  netValue?: number;
  status?: string;
}`,
`  accumulatedDepreciation?: number;
  netValue?: number;
  status?: string;
  branchId?: number | null;
  branchName?: string;
  employeeId?: number | null;
  employeeName?: string;
  costCenterId?: number | null;
  glAssetAccountId?: number | null;
  glAccumulatedId?: number | null;
  glDepreciationExpenseId?: number | null;
  acquisitionEntryId?: number | null;
  lastDepreciationDate?: string;
}`,
"interface");

// 2) الحالة: فروع/موظفين/حسابات
replaceOnce(
`  const [formState, setFormState] = useState<FixedAsset>({ ...emptyForm });`,
`  const [formState, setFormState] = useState<FixedAsset>({ ...emptyForm });
  const [branches, setBranches] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [glAccounts, setGlAccounts] = useState<any[]>([]);
  const [depBusy, setDepBusy] = useState(false);`,
"formState state");

// 3) جلب الفروع والموظفين والحسابات
replaceOnce(
`  // Initial fetch
  useEffect(() => { fetchAssets(); }, []);`,
`  // Initial fetch
  useEffect(() => { fetchAssets(); }, []);

  useEffect(() => {
    api.get("/api/hr/branches-status").then(r => r.json()).then(d => setBranches(Array.isArray(d) ? d : (d?.branches || []))).catch(() => {});
    api.get("/api/hr/employees").then(r => r.json()).then(d => setEmployees(Array.isArray(d) ? d : (d?.data || []))).catch(() => {});
    api.get("/api/accounts").then(r => r.json()).then(d => setGlAccounts(Array.isArray(d) ? d.filter((a: any) => a.allow_posting !== false) : [])).catch(() => {});
  }, []);`,
"initial fetch");

// 4) URLs
s = s.split("'/api/v2/enterprise/assets'").join("'/api/v2/fixed-assets'");
s = s.split("`/api/v2/enterprise/assets/").join("`/api/v2/fixed-assets/");

// 5) حفظ: إنشاء أو تحديث
replaceOnce(
`  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put(\`/api/v2/fixed-assets/\${formState.id}\`, formState);
      showFeedback("تم حفظ بيانات الأصل الثابت وتحديث الإهلاك بنجاح!");
      setSubTab("list");
      fetchAssets();
    } catch (e) {
      console.error('Failed to save asset:', e);
      showFeedback('فشل في حفظ الأصل', 'error');
    }
  };`,
`  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const isNew = !formState.id;
    try {
      const res = isNew
        ? await api.post('/api/v2/fixed-assets', formState)
        : await api.put(\`/api/v2/fixed-assets/\${formState.id}\`, formState);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showFeedback(data.error || 'فشل في حفظ الأصل', 'error');
        return;
      }
      setSelectedAssetId(data.id ?? formState.id);
      showFeedback(isNew ? "تم إنشاء الأصل وربطه بالحسابات" : "تم حفظ بيانات الأصل الثابت بنجاح!");
      setSubTab("list");
      fetchAssets();
    } catch (e) {
      console.error('Failed to save asset:', e);
      showFeedback('فشل في حفظ الأصل', 'error');
    }
  };

  const handleDepreciate = async () => {
    if (!formState.id) { showFeedback('احفظ الأصل أولاً قبل ترحيل الإهلاك', 'error'); return; }
    setDepBusy(true);
    try {
      const res = await api.post(\`/api/v2/fixed-assets/\${formState.id}/depreciate\`, { months: 1 });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { showFeedback(data.error || 'فشل ترحيل الإهلاك', 'error'); return; }
      if (data.asset) setFormState({ ...data.asset });
      showFeedback(\`تم ترحيل إهلاك \${Number(data.amount).toLocaleString()} ج.م وقيد رقم \${data.journalEntryId}\`);
      fetchAssets();
    } catch (e) {
      showFeedback('فشل ترحيل الإهلاك', 'error');
    } finally {
      setDepBusy(false);
    }
  };`,
"handleSave");

// 6) إنشاء أصل جديد: نموذج فقط بدون طلب API
replaceOnce(
`  // New item flow
  const handleAddNew = async () => {
    const newAsset: FixedAsset = {
      id: 0,
      code: \`FA-\${new Date().getFullYear()}-\${String(Date.now()).slice(-4)}\`,
      name: "",
      serialNumber: "",
      category: "أجهزة كمبيوتر",
      location: "المقر الرئيسي",
      custodian: "أحمد علي",
      notes: "",
      purchaseDate: getTodayFormatted(0),
      operationDate: getTodayFormatted(10),
      purchaseValue: 0,
      salvageValue: 0,
      depreciableCost: 0,
      depreciationMethod: "قسط ثابت",
      usefulLife: 5,
      depreciationRate: 20,
    };
    try {
      const res = await api.post('/api/v2/fixed-assets', newAsset);
      const data = await res.json();
      const created = data;
      const createdId = created?.id || created;
      setSelectedAssetId(typeof createdId === 'number' ? createdId : assets.length + 1);
      showFeedback("تم إنشاء نموذج أصل ثابت جديد. يرجى ملء البيانات.");
      setSubTab("form");
      fetchAssets();
    } catch (e) {
      console.error('Failed to add asset:', e);
      showFeedback('فشل في إضافة الأصل', 'error');
    }
  };`,
`  // New item flow — نموذج جديد بدون إنشاء سجل فارغ في قاعدة البيانات
  const handleAddNew = async () => {
    setFormState({
      id: 0,
      code: \`FA-\${new Date().getFullYear()}-\${String(Date.now()).slice(-4)}\`,
      name: "",
      serialNumber: "",
      category: "أجهزة كمبيوتر",
      location: "المقر الرئيسي",
      custodian: "",
      notes: "",
      purchaseDate: getTodayFormatted(0),
      operationDate: getTodayFormatted(10),
      purchaseValue: 0,
      salvageValue: 0,
      depreciableCost: 0,
      depreciationMethod: "قسط ثابت",
      usefulLife: 5,
      depreciationRate: 20,
      branchId: null,
      employeeId: null,
    });
    setSelectedAssetId(null);
    setSubTab("form");
  };`,
"handleAddNew");

// 7) استبدال اختيار أمين العهدة باختيار الفرع والموظف
const custodianStart = s.indexOf("                  {/* Custodian */}");
const custodianEnd = s.indexOf("                  {/* Notes */}", custodianStart);
if (custodianStart === -1 || custodianEnd === -1) throw new Error("custodian block not found");
const newBlock = `                  {/* Branch */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-700 font-bold text-xs w-28 text-right">
                      الفرع
                    </span>
                    <select
                      value={formState.branchId ?? ""}
                      onChange={(e) =>
                        setFormState({ ...formState, branchId: e.target.value ? Number(e.target.value) : null })
                      }
                      className="flex-1 bg-white border border-slate-200 text-slate-700 font-bold text-xs py-2.5 px-3 rounded-xl focus:border-blue-500 outline-none text-right"
                    >
                      <option value="">— بدون فرع —</option>
                      {branches.map((b: any) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    <span className="text-slate-500 font-bold text-[11px] w-28 text-left uppercase tracking-wider">
                      Branch
                    </span>
                  </div>

                  {/* Custodian Employee */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-700 font-bold text-xs w-28 text-right">
                      الموظف المسؤول
                    </span>
                    <select
                      value={formState.employeeId ?? ""}
                      onChange={(e) => setFormState({ ...formState, employeeId: e.target.value ? Number(e.target.value) : null })}
                      className="flex-1 bg-white border border-slate-200 text-slate-700 font-bold text-xs py-2.5 px-3 rounded-xl focus:border-blue-500 outline-none text-right"
                    >
                      <option value="">— بدون موظف —</option>
                      {employees.map((emp: any) => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                      ))}
                    </select>
                    <span className="text-slate-500 font-bold text-[11px] w-28 text-left uppercase tracking-wider">
                      Custodian
                    </span>
                  </div>

`;
s = s.slice(0, custodianStart) + newBlock + s.slice(custodianEnd);

// 8) لوحة الربط المحاسبي قبل أزرار الحفظ
replaceOnce(
`            {/* Save / Cancel buttons */}`,
`            {/* Section 4: Accounting link */}
            <div className="border border-slate-200 rounded-[2rem] overflow-hidden bg-slate-50/50 shadow-sm">
              <div className="flex items-center justify-between px-6 py-4 bg-emerald-100/70 border-b border-emerald-100">
                <span className="text-slate-800 font-black text-sm">الربط المحاسبي</span>
                <span className="text-slate-700 font-extrabold text-xs tracking-wide uppercase">General Ledger</span>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 bg-white">
                <div>
                  <label className="block text-[11px] font-black text-slate-500 mb-1">حساب الأصل الثابت</label>
                  <select
                    value={formState.glAssetAccountId ?? ""}
                    onChange={(e) => setFormState({ ...formState, glAssetAccountId: e.target.value ? Number(e.target.value) : null })}
                    className="w-full bg-white border border-slate-200 text-slate-700 font-bold text-xs py-2.5 px-3 rounded-xl focus:border-emerald-500 outline-none"
                  >
                    <option value="">— غير محدد —</option>
                    {glAccounts.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.code} — {a.name_ar || a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-500 mb-1">مجمع الإهلاك</label>
                  <select
                    value={formState.glAccumulatedId ?? ""}
                    onChange={(e) => setFormState({ ...formState, glAccumulatedId: e.target.value ? Number(e.target.value) : null })}
                    className="w-full bg-white border border-slate-200 text-slate-700 font-bold text-xs py-2.5 px-3 rounded-xl focus:border-emerald-500 outline-none"
                  >
                    <option value="">— غير محدد —</option>
                    {glAccounts.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.code} — {a.name_ar || a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-500 mb-1">مصروف الإهلاك</label>
                  <select
                    value={formState.glDepreciationExpenseId ?? ""}
                    onChange={(e) => setFormState({ ...formState, glDepreciationExpenseId: e.target.value ? Number(e.target.value) : null })}
                    className="w-full bg-white border border-slate-200 text-slate-700 font-bold text-xs py-2.5 px-3 rounded-xl focus:border-emerald-500 outline-none"
                  >
                    <option value="">— غير محدد —</option>
                    {glAccounts.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.code} — {a.name_ar || a.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="px-6 pb-5 bg-white flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] font-bold text-slate-500">
                  {formState.acquisitionEntryId
                    ? \`مرتبط بقيد شراء رقم \${formState.acquisitionEntryId}\`
                    : "سيُنشأ قيد الشراء عند الحفظ إذا حُدد حساب الأصل"}
                  {formState.lastDepreciationDate ? \` · آخر إهلاك: \${formState.lastDepreciationDate}\` : ""}
                </p>
                <button
                  type="button"
                  onClick={handleDepreciate}
                  disabled={depBusy || !formState.id}
                  className="px-5 py-2.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl transition-all"
                >
                  {depBusy ? "جارٍ الترحيل..." : "ترحيل إهلاك شهر"}
                </button>
              </div>
            </div>

            {/* Save / Cancel buttons */}`,
"accounting panel");

fs.writeFileSync(file, s, "utf8");
console.log("FixedAssetsView patched");
