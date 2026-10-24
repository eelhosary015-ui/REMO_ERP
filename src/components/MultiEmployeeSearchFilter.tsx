import React, { useState, useRef, useEffect } from "react";
import { Search, X, Users, Check, Plus, Filter, UserCheck, Trash2 } from "lucide-react";
import { Employee } from "../types";

export interface MultiEmployeeSearchFilterProps {
  employees: Employee[];
  selectedEmployeeIds: string[]; // Array of selected employee IDs (as strings). Empty array or ["all"] means all.
  onSelectionChange: (selectedIds: string[], queryText?: string) => void;
  searchQuery?: string;
  onSearchQueryChange?: (queryText: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  showQuickAllToggle?: boolean;
}

export const MultiEmployeeSearchFilter: React.FC<MultiEmployeeSearchFilterProps> = ({
  employees = [],
  selectedEmployeeIds = [],
  onSelectionChange,
  searchQuery,
  onSearchQueryChange,
  placeholder = "ابحث عن موظف بالاسم أو الكود... (يمكنك إدخال أكثر من اسم بفاصلة ,)",
  className = "",
  label = "تحديد الموظفين للتقرير",
  showQuickAllToggle = true,
}) => {
  const [internalText, setInternalText] = useState("");
  const inputText = searchQuery !== undefined ? searchQuery : internalText;
  const setInputText = (val: string) => {
    setInternalText(val);
    if (onSearchQueryChange) {
      onSearchQueryChange(val);
    }
  };

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isAllSelected = selectedEmployeeIds.length === 0 || selectedEmployeeIds.includes("all");

  // Helper to trigger parent update
  const updateParent = (newIds: string[], newQuery: string = inputText) => {
    onSelectionChange(newIds, newQuery);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);
    setIsOpen(true);

    // If input contains comma, plus, or newline, auto-add parsed items
    if (val.includes(",") || val.includes("+") || val.includes(";") || val.includes("\n")) {
      const parts = val.split(/[,+\n;]+/).map((s) => s.trim()).filter(Boolean);
      if (parts.length > 0) {
        // Find employee IDs matching any of these parts
        const matchedIds: string[] = [];
        parts.forEach((part) => {
          const lowerPart = part.toLowerCase();
          const matches = employees.filter(
            (emp) =>
              emp.name.toLowerCase().includes(lowerPart) ||
              String(emp.id).toLowerCase().includes(lowerPart) ||
              (emp.fingerprint_code && String(emp.fingerprint_code).toLowerCase().includes(lowerPart))
          );
          matches.forEach((m) => {
            if (!matchedIds.includes(String(m.id))) {
              matchedIds.push(String(m.id));
            }
          });
        });

        if (matchedIds.length > 0) {
          const currentWithoutAll = isAllSelected ? [] : selectedEmployeeIds;
          const combined = Array.from(new Set([...currentWithoutAll, ...matchedIds]));
          updateParent(combined, "");
          setInputText("");
          return;
        }
      }
    }

    updateParent(selectedEmployeeIds, val);
  };

  const toggleEmployee = (empId: string) => {
    const stringId = String(empId);
    let nextIds: string[];

    if (isAllSelected) {
      nextIds = [stringId];
    } else if (selectedEmployeeIds.includes(stringId)) {
      nextIds = selectedEmployeeIds.filter((id) => id !== stringId);
    } else {
      nextIds = [...selectedEmployeeIds, stringId];
    }

    updateParent(nextIds, inputText);
  };

  const removeEmployee = (empId: string) => {
    const stringId = String(empId);
    const nextIds = selectedEmployeeIds.filter((id) => id !== stringId);
    updateParent(nextIds.length === 0 ? ["all"] : nextIds, inputText);
  };

  const handleSelectAll = () => {
    updateParent(["all"], "");
    setInputText("");
    setIsOpen(false);
  };

  const handleClearAll = () => {
    updateParent([], "");
    setInputText("");
  };

  // Filter employees for dropdown list
  const filteredEmployeesList = employees.filter((emp) => {
    if (!inputText.trim()) return true;
    const q = inputText.toLowerCase().trim();
    return (
      emp.name.toLowerCase().includes(q) ||
      String(emp.id).toLowerCase().includes(q) ||
      (emp.fingerprint_code && String(emp.fingerprint_code).toLowerCase().includes(q)) ||
      (emp.job_title && emp.job_title.toLowerCase().includes(q))
    );
  });

  // Selected employee objects for rendering chips
  const selectedEmpObjects = employees.filter((emp) =>
    selectedEmployeeIds.includes(String(emp.id))
  );

  return (
    <div className={`space-y-2 dir-rtl ${className}`} ref={containerRef}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>{label}</span>
          </label>
          {showQuickAllToggle && (
            <div className="flex items-center gap-2 text-[11px]">
              <button
                type="button"
                onClick={handleSelectAll}
                className={`font-semibold px-2 py-0.5 rounded-md transition ${
                  isAllSelected
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 font-bold"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                جميع الموظفين
              </button>
              {!isAllSelected && selectedEmployeeIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-rose-600 hover:text-rose-700 dark:text-rose-400 font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  مسح ({selectedEmployeeIds.length})
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Search Input & Selected Badges Container */}
      <div className="relative">
        <div
          onClick={() => setIsOpen(true)}
          className={`w-full bg-slate-50 dark:bg-slate-900 border ${
            isOpen ? "border-blue-600 ring-4 ring-blue-500/15 shadow-md" : "border-slate-300 dark:border-slate-700 hover:border-slate-400"
          } rounded-2xl p-2.5 min-h-[52px] transition-all flex flex-wrap items-center gap-2 cursor-text shadow-2xs`}
        >
          {/* Selected Chips */}
          {!isAllSelected &&
            selectedEmpObjects.map((emp) => (
              <span
                key={emp.id}
                className="inline-flex items-center gap-1.5 bg-blue-100/90 text-blue-900 border border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800 px-3 py-1.5 rounded-xl text-xs font-bold shadow-2xs animate-fadeIn"
              >
                <span>{emp.name}</span>
                <span className="text-[10px] opacity-75 font-mono">(#{emp.id})</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeEmployee(String(emp.id));
                  }}
                  className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5 transition"
                >
                  <X className="w-3.5 h-3.5 text-blue-700 dark:text-blue-300" />
                </button>
              </span>
            ))}

          {isAllSelected && (
            <span className="inline-flex items-center gap-1.5 bg-slate-200/90 text-slate-800 dark:bg-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0">
              <UserCheck className="w-4 h-4 text-blue-600" />
              <span>جميع الموظفين ({employees.length})</span>
            </span>
          )}

          {/* Input Element */}
          <div className="flex-1 min-w-[200px] flex items-center gap-2 px-1">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={inputText ?? ""}
              onChange={handleInputChange}
              onFocus={() => setIsOpen(true)}
              placeholder={isAllSelected ? placeholder : "أضف موظف آخر..."}
              className="w-full bg-transparent text-xs md:text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none"
            />
          </div>
        </div>

        {/* Dropdown Options */}
        {isOpen && (
          <div className="absolute top-full right-0 left-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 animate-fadeIn">
            <div className="p-2 bg-slate-50 dark:bg-slate-950 flex items-center justify-between text-[11px] font-bold text-slate-500">
              <span>انقر لاختيار وإضافة موظفين للبحث</span>
              <span>عدد الموظفين: {filteredEmployeesList.length}</span>
            </div>

            {/* Select All Option */}
            <div
              onClick={handleSelectAll}
              className={`p-2.5 flex items-center justify-between text-xs font-bold cursor-pointer transition ${
                isAllSelected
                  ? "bg-blue-50/80 text-blue-900 dark:bg-blue-950/50 dark:text-blue-200"
                  : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>جميع الموظفين (عرض كافة التقارير)</span>
              </div>
              {isAllSelected && <Check className="w-4 h-4 text-blue-600" />}
            </div>

            {/* Employee List Items */}
            {filteredEmployeesList.map((emp) => {
              const empIdStr = String(emp.id);
              const isSelected = !isAllSelected && selectedEmployeeIds.includes(empIdStr);

              return (
                <div
                  key={emp.id}
                  onClick={() => toggleEmployee(empIdStr)}
                  className={`p-2.5 flex items-center justify-between text-xs font-medium cursor-pointer transition ${
                    isSelected
                      ? "bg-blue-50/90 text-blue-900 font-bold dark:bg-blue-950/60 dark:text-blue-200"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                        isSelected
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      }`}
                    >
                      {isSelected ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3 h-3 text-slate-400" />}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">{emp.name}</div>
                      <div className="text-[10px] text-slate-500">
                        كود: #{emp.id} {emp.job_title ? `• ${emp.job_title}` : ""}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="text-[10px] bg-blue-200/80 text-blue-900 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded-md font-bold">
                      محدد
                    </span>
                  )}
                </div>
              );
            })}

            {filteredEmployeesList.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-400 font-medium">
                لم يتم العثور على موظف بهذا الاسم أو الكود
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
