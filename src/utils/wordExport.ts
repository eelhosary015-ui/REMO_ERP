import { api, authHeaders } from "./api";

export interface ReportTemplate {
  headerTitle: string;
  headerSubTitle: string;
  logoUrl?: string;
  logoWidth?: number;
  logoPosition?: "right" | "left" | "center";
  footerText: string;
  borderStyle: "none" | "thin" | "double" | "classic";
  accentColor: string;
  signatureText: string;
  showDate: boolean;
  showPageNumbers: boolean;
  fontSize: "small" | "medium" | "large";
  fontFamily: "cairo" | "traditional" | "modern";
  
  // Word-like additions
  lineSpacing?: "1.0" | "1.15" | "1.5" | "2.0";
  pageMargins?: "normal" | "narrow" | "wide";
  paperOrientation?: "portrait" | "landscape";
  watermarkText?: string;
  watermarkColor?: string;
  showHeaderLine?: boolean;
  headerLayout?: "classic" | "modern" | "centered";
  tableHeaderBg?: string;
  tableHeaderTextColor?: string;
  tableStriped?: boolean;
}

const defaultTemplate: ReportTemplate = {
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
  
  // Word-like defaults
  lineSpacing: "1.15",
  pageMargins: "normal",
  paperOrientation: "portrait",
  watermarkText: "",
  watermarkColor: "#f1f5f9",
  showHeaderLine: true,
  headerLayout: "classic",
  tableHeaderBg: "#2563eb",
  tableHeaderTextColor: "#ffffff",
  tableStriped: true,
};

export async function fetchReportTemplate(): Promise<ReportTemplate> {
  try {
    const response = await fetch("/api/system/settings/report_template", {
      headers: {
        ...authHeaders(),
      },
    });
    if (response.ok) {
      const data = await response.json();
      return { ...defaultTemplate, ...data };
    }
  } catch (error) {
    console.error("Failed to fetch report template for Word export:", error);
  }
  return defaultTemplate;
}

export function generateWordHtml(template: ReportTemplate, title: string, contentHtml: string): string {
  const isRtl = true;
  
  // Font Family style mapping
  let fontStyle = "font-family: 'Cairo', 'Segoe UI', Arial, sans-serif;";
  if (template.fontFamily === "traditional") {
    fontStyle = "font-family: 'Traditional Arabic', 'Simplified Arabic', 'Times New Roman', serif;";
  } else if (template.fontFamily === "modern") {
    fontStyle = "font-family: 'Segoe UI', Tahoma, Arial, sans-serif;";
  }

  // Font Size mapping
  let sizeStyle = "font-size: 14px;";
  let tableSizeStyle = "font-size: 11px;";
  if (template.fontSize === "small") {
    sizeStyle = "font-size: 11px;";
    tableSizeStyle = "font-size: 9px;";
  } else if (template.fontSize === "large") {
    sizeStyle = "font-size: 18px;";
    tableSizeStyle = "font-size: 13px;";
  }

  // Border Style mapping
  let borderCss = "border: none;";
  if (template.borderStyle === "thin") {
    borderCss = `border: 2px solid ${template.accentColor};`;
  } else if (template.borderStyle === "double") {
    borderCss = `border: 5px double ${template.accentColor};`;
  } else if (template.borderStyle === "classic") {
    borderCss = `border: 10px double ${template.accentColor}; padding: 30px; margin: 10px;`;
  }

  // Line spacing mapping
  const lineSpacingCss = `line-height: ${template.lineSpacing || "1.15"};`;

  // Page Margins mapping
  let marginPadding = "padding: 2.54cm;"; // normal
  if (template.pageMargins === "narrow") {
    marginPadding = "padding: 1.27cm;";
  } else if (template.pageMargins === "wide") {
    marginPadding = "padding: 5.08cm;";
  }

  const todayDate = new Date().toLocaleDateString("ar-EG");
  const todayTime = new Date().toLocaleTimeString("ar-EG");

  // Logo rendering
  const logoWidthValue = template.logoWidth || 80;
  const logoHtml = template.logoUrl ? `
    <img src="${template.logoUrl}" width="${logoWidthValue}" style="max-height: ${logoWidthValue}px; object-fit: contain; margin: 5px;" alt="Logo" />
  ` : "";

  // Header alignment and arrangement
  const isHeaderCentered = template.headerLayout === "centered";
  const isHeaderModern = template.headerLayout === "modern";

  let headerContentHtml = "";
  if (isHeaderCentered) {
    headerContentHtml = `
      <div style="text-align: center; width: 100%;">
        ${logoHtml ? `<div style="margin-bottom: 12px;">${logoHtml}</div>` : ""}
        <h1 class="org-title" style="text-align: center;">${template.headerTitle}</h1>
        <p class="org-subtitle" style="text-align: center;">${template.headerSubTitle}</p>
        ${template.showDate ? `
          <p style="font-size: 10px; color: #64748b; margin-top: 8px;">التاريخ: ${todayDate} | الوقت: ${todayTime}</p>
        ` : ""}
      </div>
    `;
  } else if (isHeaderModern) {
    headerContentHtml = `
      <div style="display: table; width: 100%; background-color: #f8fafc; padding: 15px; border-radius: 8px; border-right: 5px solid ${template.accentColor};">
        <div style="display: table-cell; vertical-align: middle; text-align: right;">
          <h1 class="org-title" style="font-size: 20px;">${template.headerTitle}</h1>
          <p class="org-subtitle">${template.headerSubTitle}</p>
        </div>
        <div style="display: table-cell; vertical-align: middle; text-align: left; width: ${logoWidthValue + 20}px;">
          ${logoHtml || `<span style="font-size: 10px; color: #cbd5e1;">Logo</span>`}
        </div>
      </div>
    `;
  } else {
    // Classic Left/Right layout
    const showLogoOnRight = template.logoPosition === "right";
    headerContentHtml = `
      <div style="display: table; width: 100%;">
        <div style="display: table-cell; text-align: right; vertical-align: top;">
          ${showLogoOnRight && logoHtml ? `<div style="margin-bottom: 8px;">${logoHtml}</div>` : ""}
          <h1 class="org-title">${template.headerTitle}</h1>
          <p class="org-subtitle">${template.headerSubTitle}</p>
        </div>
        <div style="display: table-cell; text-align: left; vertical-align: top;">
          ${!showLogoOnRight && logoHtml ? `<div style="margin-bottom: 8px; text-align: left;">${logoHtml}</div>` : ""}
          ${template.showDate ? `
            <p style="margin: 0; font-size: 10px; color: #64748b;">التاريخ: ${todayDate}</p>
            <p style="margin: 4px 0 0 0; font-size: 10px; color: #64748b;">الوقت: ${todayTime}</p>
          ` : ""}
        </div>
      </div>
    `;
  }

  // Watermark styling
  const watermarkHtml = template.watermarkText ? `
    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 60px; font-weight: bold; color: ${template.watermarkColor || "#f1f5f9"}; opacity: 0.25; z-index: -1000; text-align: center; width: 100%; pointer-events: none; user-select: none;">
      ${template.watermarkText}
    </div>
  ` : "";

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
        @page {
          size: A4 ${template.paperOrientation || "portrait"};
          margin: 1.5cm;
        }
        body { 
          ${fontStyle} 
          ${sizeStyle}
          ${lineSpacingCss}
          direction: rtl; 
          text-align: right; 
          background-color: #ffffff;
          color: #1e293b;
        }
        .report-wrapper {
          ${marginPadding}
          ${borderCss}
          border-color: ${template.accentColor};
          background-color: #ffffff;
          position: relative;
          min-height: 270mm;
        }
        .header-section { 
          border-bottom: ${template.showHeaderLine ? `2px solid ${template.accentColor}` : "none"}; 
          padding-bottom: 20px; 
          margin-bottom: 30px; 
        }
        .org-title { 
          font-size: 24px; 
          font-weight: 900; 
          color: ${template.accentColor}; 
          margin: 0;
        }
        .org-subtitle { 
          font-size: 12px; 
          font-weight: bold; 
          color: #64748b; 
          margin: 4px 0 0 0;
        }
        .report-title { 
          text-align: center; 
          font-size: 20px; 
          font-weight: bold; 
          margin: 30px 0; 
          color: #1e1b4b;
          text-decoration: underline;
          text-underline-offset: 8px;
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-top: 20px; 
          margin-bottom: 30px;
          direction: rtl; 
          ${tableSizeStyle}
        }
        th, td { 
          border: 1px solid #cbd5e1; 
          padding: 10px; 
          text-align: right; 
        }
        th { 
          background-color: ${template.tableHeaderBg || template.accentColor}; 
          color: ${template.tableHeaderTextColor || "#ffffff"}; 
          font-weight: bold; 
          border-bottom: 3px solid ${template.accentColor};
        }
        ${template.tableStriped ? `
        tr:nth-child(even) {
          background-color: #f8fafc;
        }
        ` : ""}
        .signature-section {
          margin-top: 80px;
          width: 100%;
          display: table;
        }
        .signature-block {
          display: table-cell;
          width: 50%;
          text-align: center;
        }
        .signature-line {
          width: 180px;
          border-top: 1px solid #94a3b8;
          margin: 0 auto 8px auto;
        }
        .signature-text {
          font-size: 12px;
          font-weight: bold;
          color: #334155;
        }
        .footer-section { 
          margin-top: 60px; 
          border-top: 1px solid #e2e8f0; 
          padding-top: 12px; 
          display: table;
          width: 100%;
        }
        .footer-right {
          display: table-cell;
          text-align: right;
          font-size: 10px;
          color: #64748b;
        }
        .footer-left {
          display: table-cell;
          text-align: left;
          font-size: 10px;
          color: #64748b;
        }
      </style>
    </head>
    <body dir="rtl">
      <div class="report-wrapper">
        <!-- Watermark -->
        ${watermarkHtml}

        <!-- Header -->
        <div class="header-section">
          ${headerContentHtml}
        </div>

        <!-- Title -->
        <h2 class="report-title">${title}</h2>

        <!-- Content -->
        <div class="report-content">
          ${contentHtml}
        </div>

        <!-- Signature -->
        <div class="signature-section">
          <div class="signature-block" style="float: left; text-align: left; padding-left: 50px;">
            <div class="signature-line"></div>
            <p class="signature-text">${template.signatureText}</p>
          </div>
        </div>

        <!-- Footer -->
        <div class="footer-section">
          <div class="footer-right">
            <p>${template.footerText}</p>
          </div>
          <div class="footer-left">
            <p>طبع بواسطة: نظام ريستو ماستر برو</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function downloadElementAsWord(elementId: string, fileName: string, customTitle?: string) {
  const contentElement = document.getElementById(elementId);
  if (!contentElement) {
    console.error(`Element with id "${elementId}" not found for Word export.`);
    return;
  }
  const contentHtml = contentElement.innerHTML;
  const template = await fetchReportTemplate();
  const title = customTitle || fileName.replace(/_/g, ' ');
  const fullHtml = generateWordHtml(template, title, contentHtml);

  const blob = new Blob(["\ufeff", fullHtml], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function downloadDataAsWord(
  headers: string[],
  rows: any[][],
  fileName: string,
  customTitle?: string
) {
  const tableHeaders = headers.map(h => `<th>${h}</th>`).join("");
  const tableRows = rows.map(row => `
    <tr>
      ${row.map(cell => `<td>${cell !== null && cell !== undefined ? String(cell) : "-"}</td>`).join("")}
    </tr>
  `).join("");

  const contentHtml = `
    <table>
      <thead>
        <tr>${tableHeaders}</tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  `;

  const template = await fetchReportTemplate();
  const title = customTitle || fileName.replace(/_/g, ' ');
  const fullHtml = generateWordHtml(template, title, contentHtml);

  const blob = new Blob(["\ufeff", fullHtml], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
