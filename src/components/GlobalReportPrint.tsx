import React from "react";
import { authHeaders } from "../utils/api";
import { useLanguage } from "../contexts/LanguageContext";

export interface ReportTemplate {
  headerTitle: string;
  headerSubTitle: string;
  logoUrl?: string;
  footerText: string;
  borderStyle: "none" | "thin" | "double" | "classic";
  accentColor: string;
  signatureText: string;
  showDate: boolean;
  showPageNumbers: boolean;
  fontSize: "small" | "medium" | "large";
  fontFamily: "cairo" | "traditional" | "modern";
}

interface GlobalReportPrintProps {
  title: string;
  children: React.ReactNode;
}

export const GlobalReportPrint: React.FC<GlobalReportPrintProps> = ({
  title,
  children,
}) => {
  const { isRtl } = useLanguage();
  const [template, setTemplate] = React.useState<ReportTemplate>({
    headerTitle: "اسم المؤسسة",
    headerSubTitle: "تقرير إداري معتمد",
    footerText: "جميع الحقوق محفوظة © 2026",
    borderStyle: "thin",
    accentColor: "#2563eb",
    signatureText: "توقيع المدير المسؤول",
    showDate: true,
    showPageNumbers: true,
    fontSize: "medium",
    fontFamily: "cairo",
  });

  React.useEffect(() => {
    const fetchTemplate = async () => {
      try {
        const response = await fetch("/api/system/settings/report_template", {
          headers: {
            ...authHeaders(),
          },
        });
        if (response.ok) {
          const data = await response.json();
          setTemplate(data);
        }
      } catch (error) {
        console.error("Failed to fetch template for print:", error);
      }
    };
    fetchTemplate();
  }, []);

  return (
    <div
      className={`print-template text-right ${
        template.borderStyle === "thin"
          ? "border-2 border-slate-900"
          : template.borderStyle === "double"
            ? "border-4 border-double border-slate-900"
            : template.borderStyle === "classic"
              ? "border-[12px] border-double border-slate-800 outline outline-4 outline-slate-800 outline-offset-[-20px]"
              : "border-0"
      }`}
      style={{
        borderColor: template.accentColor,
        fontFamily:
          template.fontFamily === "traditional"
            ? "serif"
            : template.fontFamily === "modern"
              ? "monospace"
              : "inherit",
        fontSize:
          template.fontSize === "small"
            ? "12px"
            : template.fontSize === "large"
              ? "18px"
              : "14px",
      }}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Header */}
      <div
        className="flex justify-between items-start mb-10 border-b-2 pb-6"
        style={{ borderColor: template.accentColor }}
      >
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-slate-900">
            {template.headerTitle}
          </h1>
          <p className="text-xs font-bold text-slate-500">
            {template.headerSubTitle}
          </p>
        </div>
        <div className="text-left space-y-1">
          <p className="text-[10px] font-bold text-slate-400">
            التاريخ: {new Date().toLocaleDateString(isRtl ? "ar-EG" : "en-US")}
          </p>
          <p className="text-[10px] font-bold text-slate-400">
            الوقت: {new Date().toLocaleTimeString(isRtl ? "ar-EG" : "en-US")}
          </p>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-bold text-center mb-8 underline decoration-slate-300 underline-offset-8">
          {title}
        </h2>

        <div className="global-report-content">{children}</div>
      </div>

      {/* Signature Area */}
      <div className="absolute bottom-32 left-12 text-center w-64">
        <div className="border-t-2 border-slate-400 mb-2"></div>
        <p className="text-xs font-bold text-slate-800">
          {template.signatureText}
        </p>
      </div>

      {/* Footer */}
      <div className="absolute bottom-12 left-12 right-12 border-t pt-4 flex justify-between text-[9px] font-bold text-slate-400">
        <p>{template.footerText}</p>
        <p>
          {isRtl
            ? "طبع بواسطة: نظام ريستو ماستر"
            : "Printed by: REMO System"}
        </p>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; padding: 0; }
          @page { size: A4; margin: 10mm; }
          .print-template {
            display: block !important;
            width: 190mm; /* A4 width 210mm - margins */
            min-height: 277mm;
            padding: 10mm;
            margin: 0 auto;
            background: white;
            position: relative;
          }
          .global-report-content table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 11px !important;
          }
          .global-report-content th, 
          .global-report-content td {
            border: 1px solid #e2e8f0 !important;
            padding: 6px !important;
          }
          .global-report-content th {
            background-color: #f8fafc !important;
            font-weight: bold !important;
          }
        }
        .print-template { display: none; }
      `}</style>
    </div>
  );
};
