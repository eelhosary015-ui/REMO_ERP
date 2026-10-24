import React from "react";
import { useAuth } from "../contexts/AuthContext";

interface PrintableReportProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export const PrintableReport: React.FC<PrintableReportProps> = ({
  title,
  subtitle,
  children,
}) => {
  const { user } = useAuth();
  const date = new Date().toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const time = new Date().toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="printable-report hidden print:block">
      <div className="report-header">
        <div className="report-logo-placeholder">LOGO</div>
        <div className="report-title">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="report-meta">
          <p>التاريخ: {date}</p>
          <p>الوقت: {time}</p>
          <p>المسؤول: {user?.username}</p>
        </div>
      </div>

      <div className="report-content">{children}</div>

      <div className="report-footer">
        <div className="signature-block">
          <div className="signature-line"></div>
          <div className="signature-label">توقيع المسؤول المباشر</div>
        </div>
        <div className="signature-block">
          <div className="signature-line"></div>
          <div className="signature-label">توقيع الموظف المعني</div>
        </div>
        <div className="signature-block">
          <div className="signature-line"></div>
          <div className="signature-label">اعتماد المدير العام</div>
        </div>
      </div>
    </div>
  );
};
