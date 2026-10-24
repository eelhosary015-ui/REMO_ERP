import html2pdf from "html2pdf.js";
import { fetchReportTemplate } from "./wordExport";

export async function downloadDataAsPdf(
  headers: string[],
  rows: any[][],
  fileName: string,
  customTitle?: string
) {
  const tableHeaders = headers.map(h => `<th style="padding: 10px; border: 1px solid #cbd5e1; text-align: right; background-color: #2563eb; color: #fff; font-weight: bold;">${h}</th>`).join("");
  const tableRows = rows.map((row, idx) => `
    <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
      ${row.map(cell => `<td style="padding: 10px; border: 1px solid #cbd5e1; text-align: right; font-size: 12px;">${cell !== null && cell !== undefined ? String(cell) : "-"}</td>`).join("")}
    </tr>
  `).join("");

  const contentHtml = `
    <table style="width: 100%; border-collapse: collapse; direction: rtl; font-family: 'Cairo', sans-serif;">
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
  const todayDate = new Date().toLocaleDateString("ar-EG");
  const todayTime = new Date().toLocaleTimeString("ar-EG");

  const fullHtml = `
    <div style="direction: rtl; font-family: 'Cairo', sans-serif; padding: 20px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 15px;">
        <h1 style="font-size: 24px; font-weight: 900; color: #2563eb; margin: 0;">${template.headerTitle}</h1>
        <p style="font-size: 14px; font-weight: bold; color: #64748b; margin: 5px 0;">${template.headerSubTitle}</p>
        <p style="font-size: 11px; color: #64748b; margin-top: 5px;">التاريخ: ${todayDate} | الوقت: ${todayTime}</p>
      </div>
      <h2 style="text-align: center; font-size: 20px; font-weight: bold; margin: 20px 0; color: #1e1b4b; text-decoration: underline;">${title}</h2>
      ${contentHtml}
      <div style="margin-top: 40px; display: flex; justify-content: space-between;">
        <div style="text-align: center; width: 40%;">
          <div style="border-top: 1px solid #94a3b8; width: 80%; margin: 0 auto 10px auto;"></div>
          <p style="font-size: 12px; font-weight: bold;">${template.signatureText}</p>
        </div>
      </div>
    </div>
  `;

  // Create a temporary container
  const container = document.createElement("div");
  container.innerHTML = fullHtml;
  container.style.position = "absolute";
  container.style.left = "-9999px";
  // We must append to document body for html2canvas to render
  document.body.appendChild(container);

  const opt = {
    margin:       10,
    filename:     `${fileName}.pdf`,
    image:        { type: 'jpeg' as const, quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' } as const
  };

  try {
    await html2pdf().set(opt).from(container).save();
  } finally {
    document.body.removeChild(container);
  }
}

