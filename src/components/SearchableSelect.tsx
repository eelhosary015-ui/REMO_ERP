import React, { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { VoiceInputButton } from "./VoiceInputButton";

export interface SearchableSelectProps {
  options: any[]; // Array of objects
  value: number | string;
  onChange: (value: number | string) => void;
  placeholder: string;
  labelKey?: string; // which key to display as selected
  searchKeys?: string[]; // keys to search on
  columns?: {
    key: string;
    title: string;
    render?: (opt: any) => React.ReactNode;
  }[]; // display as table in dropdown
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  labelKey = "label",
  searchKeys = ["label", "barcode"],
  columns,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);

  // Robust Arabic & General Text Normalization
  const normalizeText = (text: string) => {
    if (!text) return "";
    return text
      .toString()
      .toLowerCase()
      .trim()
      // Remove Arabic diacritics / tashkeel
      .replace(/[\u064B-\u0652]/g, "")
      // Normalize Alef variants
      .replace(/[أإآٱ]/g, "ا")
      // Normalize Teh Marbouta & Alef Maksura
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/ؤ/g, "و")
      .replace(/ئ/g, "ي");
  };

  const filteredOptions = options.filter((opt) => {
    if (!opt) return false;
    const searchString = normalizeText(searchTerm);
    if (!searchString) return true;

    // Fuzzy Search: Check if any of the search keys contain the search string
    return searchKeys.some((key) => {
      const val = opt[key];
      if (val === undefined || val === null) return false;
      return normalizeText(val.toString()).includes(searchString);
    });
  });

  const isMatch = (optId: any, val: any) =>
    optId !== undefined &&
    optId !== null &&
    val !== undefined &&
    val !== null &&
    val !== "" &&
    (optId === val || String(optId) === String(val));

  const selectedOption = options.find((opt) => isMatch(opt.id, value));
  const dropdownWidth = columns ? Math.max(300, columns.length * 150) : "none"; // wider for tables

  // Display the selected item text if not open, otherwise show what the user is typing
  const displayValue = isOpen
    ? searchTerm
    : selectedOption
      ? selectedOption[labelKey]
      : "";

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
        setSearchTerm("");
      }
      return;
    }

    if (e.key === "Escape") {
      setIsOpen(false);
      setFocusedIndex(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
        const selected = filteredOptions[focusedIndex];
        onChange(selected.id);
        setIsOpen(false);
        setSearchTerm("");
        setFocusedIndex(-1);
      }
    }
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="relative w-full flex items-center gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            className="w-full p-3.5 pr-11 pl-20 bg-white border-2 border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-slate-800 text-base shadow-xs transition-all placeholder:text-slate-400 font-medium text-right"
            placeholder={placeholder}
            value={displayValue}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
              setFocusedIndex(0);
              if (value !== "") {
                onChange("");
              }
            }}
            onClick={() => {
              setIsOpen(true);
              setSearchTerm("");
              if (value !== "") {
                onChange("");
              }
            }}
            onKeyDown={handleKeyDown}
          />
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
            <svg
              className="h-5 w-5 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              ></path>
            </svg>
          </div>

          {/* Action buttons inside search box: Clear & Matches count badge */}
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center gap-1.5">
            {isOpen && searchTerm && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                {filteredOptions.length}
              </span>
            )}
            {(searchTerm || value) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                  setSearchTerm("");
                  setIsOpen(true);
                  if (inputRef.current) inputRef.current.focus();
                }}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors cursor-pointer"
                title="مسح النص والبحث"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Voice Input Integration */}
        <VoiceInputButton
          onTranscript={(text) => {
            setSearchTerm(text);
            setIsOpen(true);
            setFocusedIndex(0);
          }}
        />
      </div>

      {isOpen && (
        <div
          className="absolute z-50 mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-[28rem] overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-150"
          style={{
            width: columns
              ? Math.max(
                  wrapperRef.current?.offsetWidth || 0,
                  typeof dropdownWidth === "number" ? dropdownWidth : 0,
                )
              : "100%",
            minWidth: "100%",
            right: 0,
          }}
        >
          <div className="overflow-y-auto w-full max-h-[28rem]">
            {filteredOptions.length > 0 ? (
              columns ? (
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 sticky top-0 shadow-xs border-b border-slate-200">
                    <tr>
                      {columns.map((col, idx) => (
                        <th
                          key={idx}
                          className="p-3 text-slate-600 font-bold whitespace-nowrap"
                        >
                          {col.title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOptions.map((opt, optIndex) => (
                      <tr
                        key={opt.id}
                        onClick={() => {
                          onChange(opt.id);
                          setIsOpen(false);
                          setSearchTerm("");
                        }}
                        className={`cursor-pointer hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-0 ${isMatch(opt.id, value) || focusedIndex === optIndex ? "bg-indigo-50 text-indigo-700" : "text-slate-700"}`}
                      >
                        {columns.map((col, idx) => (
                          <td
                            key={idx}
                            className={`p-3.5 font-medium ${idx === 0 ? "text-slate-900 border-r-2 border-transparent" : ""} ${(isMatch(opt.id, value) || focusedIndex === optIndex) && idx === 0 ? "border-indigo-500" : ""}`}
                          >
                            {col.render ? col.render(opt) : opt[col.key]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                filteredOptions.map((opt, optIndex) => (
                  <div
                    key={opt.id}
                    className={`p-3.5 hover:bg-indigo-50 cursor-pointer text-sm font-medium transition-colors border-b border-slate-50 last:border-0 ${isMatch(opt.id, value) || focusedIndex === optIndex ? "bg-indigo-50 text-indigo-700 border-r-2 border-indigo-500 font-bold" : "text-slate-700 border-r-2 border-transparent"}`}
                    onClick={() => {
                      onChange(opt.id);
                      setIsOpen(false);
                      setSearchTerm("");
                    }}
                  >
                    {opt[labelKey]}
                  </div>
                ))
              )
            ) : (
              <div className="p-6 text-center text-slate-500 text-sm">
                <div className="text-2xl mb-2">🔍</div>
                <div className="font-bold text-base text-slate-700">
                  لا توجد نتائج للبحث
                </div>
                <div className="mt-1 text-xs text-slate-400">حاول الكلمات المفتاحية أو الكود بطريقة أخرى</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
