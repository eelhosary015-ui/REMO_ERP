import React, { useState, useEffect, useRef } from "react";
import { Globe, Check, Search, ChevronDown, Sparkles } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";

interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇸🇦" },
  { code: "en", name: "English", nativeName: "English", flag: "🇺🇸" },
];

export const SystemTranslator: React.FC = () => {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeLang, setActiveLang] = useState("ar");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // The previous implementation reloaded the entire application and used a
    // hash/cookie polling loop. With a React SPA this could create a reload /
    // Google-Translate race and make the application appear to hang.
    const savedLang = localStorage.getItem("app_lang") || "ar";
    setActiveLang(savedLang === "en" ? "en" : "ar");

    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);

    // Load Google Translate once. It translates the rendered application DOM,
    // while LanguageContext controls the app language and document direction.
    (window as any).googleTranslateElementInit = () => {
      const google = (window as any).google;
      if (!google?.translate?.TranslateElement) return;
      if (document.querySelector("#google_translate_element .goog-te-combo")) return;
      new google.translate.TranslateElement(
        { pageLanguage: "ar", autoDisplay: false },
        "google_translate_element"
      );
      if (savedLang === "en") {
        window.setTimeout(() => {
          const combo = document.querySelector(".goog-te-combo") as HTMLSelectElement | null;
          if (combo) {
            combo.value = "en";
            combo.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }, 300);
      }
    };

    if (!document.getElementById("google-translate-script")) {
      const script = document.createElement("script");
      script.id = "google-translate-script";
      script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      script.async = true;
      document.body.appendChild(script);
    } else if ((window as any).google?.translate?.TranslateElement) {
      (window as any).googleTranslateElementInit?.();
    }

    if (!document.getElementById("google-translate-overrides")) {
      const style = document.createElement("style");
      style.id = "google-translate-overrides";
      style.textContent = `
        .goog-te-banner-frame, .goog-te-balloon-frame, #goog-gt-tt { display:none !important; }
        body { top:0 !important; }
        #google_translate_element { display:none !important; }
      `;
      document.head.appendChild(style);
    }

    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);


  const changeLanguage = (langCode: string) => {
    const next = langCode === "en" ? "en" : "ar";
    setActiveLang(next);
    setIsOpen(false);
    setLanguage(next);
    localStorage.setItem("app_lang", next);

    // Do not reload or modify the URL hash. Trigger Google Translate after
    // React has rendered the new language state. This is intentionally bounded
    // (no permanent interval) so the UI can never hang waiting for the widget.
    const trigger = (attempt = 0) => {
      const selectEl = document.querySelector(".goog-te-combo") as HTMLSelectElement | null;
      if (selectEl) {
        selectEl.value = next;
        selectEl.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }
      if (attempt < 20) window.setTimeout(() => trigger(attempt + 1), 250);
    };
    window.setTimeout(() => trigger(), 50);
  };

  const filteredLanguages = LANGUAGES.filter(
    (lang) =>
      lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lang.nativeName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedLanguage = LANGUAGES.find((l) => l.code === activeLang) || LANGUAGES[0];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Hidden container for google translate widget to mount */}
      <div id="google_translate_element" className="hidden" />

      {/* Modern custom select trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:border-teal-300 transition-all text-xs font-semibold shadow-sm cursor-pointer select-none"
        title="ترجمة النظام لأي لغة / Translate System Language"
      >
        <Globe className="w-4 h-4 text-teal-600 animate-spin-slow" />
        <span className="hidden sm:inline-block font-medium">
          {selectedLanguage.flag} {selectedLanguage.nativeName}
        </span>
        <span className="sm:hidden font-medium">{selectedLanguage.flag}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Language dropdown card */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="p-3 bg-slate-50 border-b border-slate-100">
            <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs mb-2">
              <Sparkles className="w-4 h-4 text-teal-500" />
              <span>ترجمة فورية ذكية لكامل النظام</span>
            </div>
            
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="ابحث عن لغة... Search language"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-8 pl-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                autoFocus
              />
            </div>
          </div>

          {/* Languages List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-50">
            {filteredLanguages.length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-400">لا توجد نتائج مطابقة</p>
            ) : (
              filteredLanguages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => changeLanguage(lang.code)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 text-right text-xs hover:bg-teal-50/50 transition-colors cursor-pointer ${
                    activeLang === lang.code ? "bg-teal-50 text-teal-800 font-bold" : "text-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{lang.flag}</span>
                    <div className="text-right">
                      <p className="font-semibold">{lang.nativeName}</p>
                      <p className="text-[10px] text-slate-400 font-normal">{lang.name}</p>
                    </div>
                  </div>
                  {activeLang === lang.code && <Check className="w-3.5 h-3.5 text-teal-600" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
