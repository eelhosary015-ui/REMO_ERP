import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { Employee } from "../types";
import { VoiceInputButton } from "./VoiceInputButton";

export interface EmployeeSearchSelectProps {
  employees?: Employee[];
  value: string | number | null | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  inputClassName?: string;
  dark?: boolean;
}

/**
 * Unified employee picker used throughout HR.
 * Search supports employee name, employee code, fingerprint code and numeric ID.
 */
export const EmployeeSearchSelect: React.FC<EmployeeSearchSelectProps> = ({
  employees = [],
  value,
  onChange,
  placeholder = "ابحث باسم الموظف أو الكود...",
  required = false,
  className = "",
  inputClassName = "",
  dark = false,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => employees.find((e: any) => String(e?.id ?? "") === String(value ?? "")),
    [employees, value],
  );

  const normalized = (v: unknown) =>
    String(v ?? "")
      .toLowerCase()
      .trim()
      // Remove Arabic diacritics / tashkeel
      .replace(/[\u064B-\u0652]/g, "")
      // Normalize Alef variants
      .replace(/[أإآٱ]/g, "ا")
      // Normalize Teh Marbouta & Alef Maksura & Waw/Yeh hamza
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/ؤ/g, "و")
      .replace(/ئ/g, "ي");

  const filtered = useMemo(() => {
    const q = normalized(query);
    if (!q) return employees.filter(Boolean);
    return employees.filter((emp: any) => {
      const values = [emp?.name, emp?.employee_code, emp?.fingerprint_code, emp?.id];
      return values.some((v) => normalized(v).includes(q));
    });
  }, [employees, query]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const selectEmployee = (emp: any) => {
    onChange(String(emp.id));
    setOpen(false);
    setQuery("");
  };

  const clear = () => {
    onChange("");
    setQuery("");
    setOpen(true);
  };

  const baseInput = dark
    ? "w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2.5 pr-10 pl-16 outline-none focus:border-purple-500"
    : "w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2.5 pr-10 pl-16 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10";

  return (
    <div ref={rootRef} className={`relative w-full ${className}`}>
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <Search className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${dark ? "text-slate-500" : "text-slate-400"}`} />
          <input
            type="text"
            value={open ? query : selected ? `${selected.name} — ${selected.employee_code || selected.fingerprint_code || `#${selected.id}`}` : ""}
            placeholder={placeholder}
            required={required && !value}
            onFocus={() => {
              setOpen(true);
              setQuery("");
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              if (value) onChange("");
            }}
            className={`${baseInput} ${inputClassName}`}
            autoComplete="off"
          />
          {value && (
            <button type="button" onClick={clear} className={`absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-lg ${dark ? "text-slate-400 hover:bg-slate-800" : "text-slate-400 hover:bg-slate-200"}`} aria-label="مسح الموظف">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <VoiceInputButton
          onTranscript={(text) => {
            setQuery(text);
            setOpen(true);
            if (value) onChange("");
          }}
        />
      </div>

      {open && (
        <div className={`absolute z-[100] top-full mt-2 left-0 right-0 rounded-xl border shadow-2xl overflow-hidden ${dark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"}`}>
          <div className="max-h-72 overflow-y-auto">
            {filtered.length ? (
              filtered.map((emp: any) => {
                const isSelected = String(emp.id) === String(value);
                const code = emp.employee_code || emp.fingerprint_code || `#${emp.id}`;
                return (
                  <button
                    type="button"
                    key={emp.id}
                    onClick={() => selectEmployee(emp)}
                    className={`w-full text-right px-4 py-3 border-b last:border-b-0 transition-colors ${dark ? "border-slate-800 hover:bg-slate-800 text-white" : "border-slate-100 hover:bg-emerald-50 text-slate-800"} ${isSelected ? (dark ? "bg-slate-800" : "bg-emerald-50") : ""}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold truncate">{emp.name}</div>
                        <div className={`text-[11px] mt-0.5 ${dark ? "text-slate-400" : "text-slate-500"}`}>الكود: {code}{emp.fingerprint_code && emp.employee_code ? ` • البصمة: ${emp.fingerprint_code}` : ""}</div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-emerald-500 shrink-0" />}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className={`p-6 text-center text-sm ${dark ? "text-slate-400" : "text-slate-500"}`}>لا توجد نتائج. ابحث بالاسم أو كود الموظف.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeSearchSelect;
