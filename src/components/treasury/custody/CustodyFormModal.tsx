import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  X,
  Save,
  Send,
  Plus,
  Trash2,
  AlertCircle,
  Calendar,
  Building2,
  User,
  Wallet,
  FileText,
  ShieldCheck,
  Layers,
  PackageCheck,
  Search,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Hash,
  Briefcase
} from "lucide-react";
import { TreasuryCustodyType, TreasuryAccount } from "../../../types";

// Searchable Employee Select Component
interface SearchableEmployeePickerProps {
  employees: any[];
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
}

const normalizeArabicText = (text: string) => {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u064B-\u065F]/g, ""); // strip tashkeel
};

const SearchableEmployeePicker: React.FC<SearchableEmployeePickerProps> = ({
  employees,
  value,
  onChange,
  required
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close when clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const selectedEmployee = useMemo(() => {
    return employees.find((e) => String(e.id) === String(value));
  }, [employees, value]);

  const filteredEmployees = useMemo(() => {
    if (!search.trim()) return employees;
    const query = normalizeArabicText(search);

    return employees.filter((emp) => {
      const name = normalizeArabicText(emp.name || "");
      const code = String(emp.employee_code || emp.code || emp.id || "").toLowerCase();
      const dept = normalizeArabicText(emp.department || emp.department_name || "");
      const phone = String(emp.phone || "").toLowerCase();
      const job = normalizeArabicText(emp.job_title || emp.position || "");

      return (
        name.includes(query) ||
        code.includes(query) ||
        dept.includes(query) ||
        phone.includes(query) ||
        job.includes(query)
      );
    });
  }, [employees, search]);

  const handleSelect = (empId: string) => {
    onChange(empId);
    setIsOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearch("");
    setIsOpen(true);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Trigger Button / Display */}
      {!isOpen && selectedEmployee ? (
        <div
          onClick={() => setIsOpen(true)}
          className="w-full bg-indigo-50/50 border border-indigo-200 hover:border-indigo-400 rounded-2xl p-2.5 flex items-center justify-between cursor-pointer transition-all shadow-sm group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0 text-right">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-800 truncate">
                  {selectedEmployee.name}
                </span>
                <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-black shrink-0 border border-indigo-200">
                  كود: #{selectedEmployee.employee_code || selectedEmployee.id}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium truncate">
                {selectedEmployee.department || selectedEmployee.department_name || "الموظف المعتمد"}
                {selectedEmployee.job_title ? ` • ${selectedEmployee.job_title}` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="إلغاء وتغيير الموظف"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-bold text-indigo-600 group-hover:underline px-1">
              تغيير
            </span>
          </div>
        </div>
      ) : (
        <div
          onClick={() => !isOpen && setIsOpen(true)}
          className={`w-full bg-slate-50 border ${
            isOpen ? "border-indigo-500 ring-2 ring-indigo-500/10 bg-white" : "border-slate-200"
          } rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 flex items-center justify-between cursor-pointer transition-all`}
        >
          <div className="flex items-center gap-2 text-slate-400 w-full">
            <Search className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="ابحث بكود الموظف (مثال: 101) أو الاسم..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (!isOpen) setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              className="w-full bg-transparent border-none outline-none text-xs font-bold text-slate-800 placeholder:text-slate-400 placeholder:font-normal"
            />
          </div>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
              isOpen ? "rotate-180 text-indigo-600" : ""
            }`}
          />
        </div>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full bg-white border border-slate-200 rounded-2xl shadow-xl max-h-64 overflow-hidden flex flex-col right-0 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Live Search Input inside dropdown if already an employee is selected */}
          {selectedEmployee && (
            <div className="p-2 border-b border-slate-100 bg-slate-50/70">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="بحث بالكود (مثال: 105) أو الاسم أو القسم..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pr-8 pl-3 py-1.5 text-xs font-bold text-slate-800 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* Results List */}
          <div className="overflow-y-auto p-1.5 space-y-1 flex-1 max-h-52">
            {filteredEmployees.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs font-medium flex flex-col items-center gap-1.5">
                <User className="w-5 h-5 text-slate-300" />
                <span>لا يوجد موظف مطابق للبحث "{search}"</span>
                <span className="text-[10px] text-slate-400">تأكد من كتابة الكود الوظيفي أو الاسم بشكل صحيح</span>
              </div>
            ) : (
              filteredEmployees.map((emp) => {
                const isSelected = String(emp.id) === String(value);
                const code = emp.employee_code || emp.code || emp.id;
                return (
                  <div
                    key={emp.id}
                    onClick={() => handleSelect(String(emp.id))}
                    className={`p-2 rounded-xl flex items-center justify-between cursor-pointer transition-all text-right ${
                      isSelected
                        ? "bg-indigo-600 text-white font-black shadow-sm"
                        : "hover:bg-indigo-50/70 text-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                          isSelected
                            ? "bg-white/20 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs truncate ${isSelected ? "text-white" : "font-bold text-slate-800"}`}>
                            {emp.name}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-black shrink-0 ${
                              isSelected
                                ? "bg-white/30 text-white"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}
                          >
                            كود: #{code}
                          </span>
                        </div>
                        {(emp.department || emp.department_name || emp.job_title) && (
                          <p
                            className={`text-[10px] truncate ${
                              isSelected ? "text-indigo-100" : "text-slate-400"
                            }`}
                          >
                            {emp.department || emp.department_name || ""}
                            {emp.job_title ? ` • ${emp.job_title}` : ""}
                          </p>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-white shrink-0 ml-1" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: any, actionType: 'draft' | 'submit' | 'direct_issue') => Promise<void>;
  custodyTypes: TreasuryCustodyType[];
  accounts: TreasuryAccount[];
  employees: any[];
  branches: any[];
  costCenters: any[];
  cashOnly?: boolean;
}

export const CustodyFormModal: React.FC<FormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  custodyTypes,
  accounts,
  employees,
  branches,
  costCenters,
  cashOnly = false
}) => {
  const [employeeId, setEmployeeId] = useState("");
  const [custodyTypeId, setCustodyTypeId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EGP");
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");
  const [durationDays, setDurationDays] = useState("30");
  const [dueDate, setDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic Item/Asset rows
  const [items, setItems] = useState<Array<{
    item_name: string;
    item_type: string;
    serial_number: string;
    quantity: number;
    unit_cost: number;
    total_value: number;
    condition_on_issue: string;
  }>>([]);

  // Auto set due date when duration changes
  useEffect(() => {
    if (durationDays) {
      const days = parseInt(durationDays) || 30;
      const target = new Date();
      target.setDate(target.getDate() + days);
      setDueDate(target.toISOString().split('T')[0]);
    }
  }, [durationDays]);

  // When custody type changes, auto set default duration and category behavior
  const handleTypeChange = (typeId: string) => {
    setCustodyTypeId(typeId);
    const selectedType = custodyTypes.find(t => t.id.toString() === typeId);
    if (selectedType) {
      if (selectedType.default_duration_days) {
        setDurationDays(selectedType.default_duration_days.toString());
      }
      if (selectedType.requires_asset && items.length === 0) {
        // Add an initial empty item row for convenience
        setItems([{
          item_name: "",
          item_type: selectedType.category === 'asset' ? 'asset' : 'equipment',
          serial_number: "",
          quantity: 1,
          unit_cost: 0,
          total_value: 0,
          condition_on_issue: "ممتازة / جديدة"
        }]);
      }
    }
  };

  const handleAddItemRow = () => {
    setItems(prev => [
      ...prev,
      {
        item_name: "",
        item_type: "equipment",
        serial_number: "",
        quantity: 1,
        unit_cost: 0,
        total_value: 0,
        condition_on_issue: "ممتازة / جديدة"
      }
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, val: any) => {
    setItems(prev => {
      const copy = [...prev];
      const row = { ...copy[index], [field]: val };
      if (field === 'quantity' || field === 'unit_cost') {
        row.total_value = (parseFloat(row.quantity as any) || 0) * (parseFloat(row.unit_cost as any) || 0);
      }
      copy[index] = row;
      return copy;
    });
  };

  const handleFormSubmit = async (actionType: 'draft' | 'submit' | 'direct_issue') => {
    if (!employeeId) {
      alert("يرجى اختيار الموظف المستلم للعهدة");
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      if (items.length === 0) {
        alert("يرجى إدخال قيمة العهدة النقدية أو إضافة أصول ومعدات عينية");
        return;
      }
    }
    if (!purpose.trim()) {
      alert("يرجى تحديد الغرض والبيان من صرف العهدة");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        employee_id: parseInt(employeeId),
        custody_type_id: custodyTypeId ? parseInt(custodyTypeId) : null,
        account_id: accountId ? parseInt(accountId) : null,
        branch_id: branchId ? parseInt(branchId) : null,
        cost_center_id: costCenterId ? parseInt(costCenterId) : null,
        project_name: projectName,
        amount: parseFloat(amount) || 0,
        currency,
        purpose,
        notes,
        duration_days: parseInt(durationDays) || 30,
        due_date: dueDate || null,
        status: actionType === 'draft' ? 'draft' : actionType === 'direct_issue' ? 'active' : 'pending_approval',
        items: items.filter(it => it.item_name.trim() !== '')
      };

      await onSubmit(payload, actionType);
    } catch (err: any) {
      console.error(err);
      alert(`حدث خطأ أثناء حفظ العهدة: ${err.message || "خطأ غير متوقع"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const selectedAccount = accounts.find(a => a.id.toString() === accountId);
  const selectedType = custodyTypes.find(t => t.id.toString() === custodyTypeId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-100 my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/60 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-600/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">طلب وإصدار عهدة / أمانة جديدة لموظف</h3>
              <p className="text-xs text-slate-500 font-medium">تسجيل وتوثيق بيانات العهد النقدية والعينية مع تحديد المسؤوليات والرقابة</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-right">
          {/* Main Info Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Searchable Employee Selector */}
            <div className="space-y-1.5 md:col-span-1">
              <label className="text-xs font-black text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                  الموظف المستلم <span className="text-rose-500">*</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">
                  بحث بالكود أو الاسم
                </span>
              </label>
              <SearchableEmployeePicker
                employees={employees}
                value={employeeId}
                onChange={(id) => setEmployeeId(id)}
                required
              />
            </div>

            {/* Custody Type */}
            <div className="space-y-1.5 md:col-span-1">
              <label className="text-xs font-black text-slate-700 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                نوع العهدة والتصنيف
              </label>
              <select
                value={custodyTypeId}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:bg-white outline-none"
              >
                <option value="">-- عهدة نقدية عامة --</option>
                {custodyTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name_ar} {t.max_limit ? `(حد أقصى: ${t.max_limit.toLocaleString()} ج.م)` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Safe / Account */}
            <div className="space-y-1.5 md:col-span-1">
              <label className="text-xs font-black text-slate-700 flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5 text-indigo-600" />
                الخزينة المانحة للسيولة
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:bg-white outline-none"
              >
                <option value="">-- حدد الخزينة عند الصرف الفعلي --</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} (رصيد: {Number(acc.current_balance || 0).toLocaleString()} ج.م)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Financials & Duration Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
            {/* Amount */}
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-700">قيمة العهدة النقدية</label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-black text-indigo-700 focus:border-indigo-500 outline-none"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">ج.م</span>
              </div>
            </div>

            {/* Duration Days */}
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-700">مدة العهدة (بالأيام)</label>
              <input
                type="number"
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:border-indigo-500 outline-none"
                placeholder="30"
              />
            </div>

            {/* Due Date */}
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-700 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-500" />
                تاريخ الاستحقاق والتسوية
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:border-indigo-500 outline-none"
              />
            </div>

            {/* Branch */}
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-700">الفرع / الموقع</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:border-indigo-500 outline-none"
              >
                <option value="">-- الفرع الرئيسي --</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Purpose & Cost Center */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700">
                الغرض والبيان من العهدة <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="مثال: شراء مستلزمات تشغيل طارئة، أو عهدة نقدية لفريق المشتريات..."
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:bg-white outline-none"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700">مركز التكلفة / المشروع</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={costCenterId}
                  onChange={(e) => setCostCenterId(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:bg-white outline-none"
                >
                  <option value="">-- مركز التكلفة --</option>
                  {costCenters.map(cc => (
                    <option key={cc.id} value={cc.id}>{cc.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="اسم المشروع / العملية..."
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:bg-white outline-none"
                />
              </div>
            </div>
          </div>

          {/* Optional Items / Assets Section */}
          {!cashOnly && <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-black text-slate-800">الأصول والمعدات العينية المسلمة مع العهدة (اختياري)</h4>
              </div>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-black rounded-xl transition-all flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                إضافة صنف / أصل
              </button>
            </div>

            {items.length > 0 && (
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-400 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">اسم الصنف / الأصل</th>
                      <th className="p-2.5">النوع</th>
                      <th className="p-2.5">الرقم التسلسلي / الباركود</th>
                      <th className="p-2.5">الكمية</th>
                      <th className="p-2.5">القيمة التقديرية</th>
                      <th className="p-2.5">حالة التسليم</th>
                      <th className="p-2.5 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder="مثال: لابتوب Dell / جهاز POS..."
                            value={it.item_name}
                            onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={it.item_type}
                            onChange={(e) => handleItemChange(idx, 'item_type', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs"
                          >
                            <option value="equipment">معدات تشغيل</option>
                            <option value="asset">أصل ثابت</option>
                            <option value="tool">أداة / جهاز</option>
                            <option value="inventory">بضاعة / مخزون</option>
                            <option value="vehicle">مركبة / سيارة</option>
                            <option value="other">أخرى</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder="S/N: 123456..."
                            value={it.serial_number}
                            onChange={(e) => handleItemChange(idx, 'serial_number', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono"
                          />
                        </td>
                        <td className="p-2 w-16">
                          <input
                            type="number"
                            value={it.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-center"
                          />
                        </td>
                        <td className="p-2 w-24">
                          <input
                            type="number"
                            placeholder="0.00"
                            value={it.unit_cost || ""}
                            onChange={(e) => handleItemChange(idx, 'unit_cost', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-indigo-700"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={it.condition_on_issue}
                            onChange={(e) => handleItemChange(idx, 'condition_on_issue', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-600"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(idx)}
                            className="p-1 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>}

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700">شروط أو ملاحظات إضافية</label>
            <textarea
              placeholder="اكتب أي شروط خاصة بالتسليم أو مواعيد المطابقة..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2 text-xs font-medium focus:border-indigo-500 focus:bg-white outline-none min-h-[60px]"
            ></textarea>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-2xl text-xs font-bold transition-all"
          >
            إلغاء
          </button>

          <div className="flex items-center gap-2">
            {/* Save as Draft */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleFormSubmit('draft')}
              className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>حفظ كمسودة</span>
            </button>

            {/* Submit for approval */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleFormSubmit('submit')}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Send className="w-4 h-4" />
              <span>تقديم للاعتماد والموافقة</span>
            </button>

            {/* Direct Issue / Disbursement */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleFormSubmit('direct_issue')}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
            >
              <Wallet className="w-4 h-4" />
              <span>اعتماد وصرف مباشر</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
