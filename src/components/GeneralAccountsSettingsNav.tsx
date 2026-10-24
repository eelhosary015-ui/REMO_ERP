import React from "react";
import {
  CalendarRange,
  GitBranch,
  BadgeDollarSign,
  FileSearch,
  Settings,
} from "lucide-react";

export interface SettingsNavTab {
  id: "fiscal_years" | "account_config" | "budgets" | "audit_logs";
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  tag: string;
}

export const GENERAL_ACCOUNTS_SETTINGS_TABS: SettingsNavTab[] = [
  {
    id: "fiscal_years",
    label: "السنوات المالية والفترات",
    desc: "إقفال الفترات، ترحيل الأرصدة، وسنة مالية جديدة",
    icon: CalendarRange,
    tag: "إقفال وترحيل",
  },
  {
    id: "account_config",
    label: "ربط الحسابات التلقائي",
    desc: "ربط مفاتيح المبيعات والمشتريات والمخازن بشجرة الحسابات",
    icon: GitBranch,
    tag: "توجيه آلي",
  },
  {
    id: "budgets",
    label: "إدارة الموازنات والاعتمادات",
    desc: "اعتمادات الميزانية التقديرية ومقارنة الفعلي مع الانحراف",
    icon: BadgeDollarSign,
    tag: "رقابة وسقوف",
  },
  {
    id: "audit_logs",
    label: "سجل المراجعة والتدقيق المالي",
    desc: "تتبع تحركات القيود، التعديلات والإلغاءات (Audit Trail)",
    icon: FileSearch,
    tag: "أمان ورقابة",
  },
];

interface GeneralAccountsSettingsNavProps {
  activeTab: string;
  onSelectTab: (tab: "fiscal_years" | "account_config" | "budgets" | "audit_logs") => void;
}

export const GeneralAccountsSettingsNav: React.FC<GeneralAccountsSettingsNavProps> = ({
  activeTab,
  onSelectTab,
}) => {
  const normalizedTab =
    activeTab === "erp_fiscal_years"
      ? "fiscal_years"
      : activeTab === "erp_account_config"
      ? "account_config"
      : activeTab === "erp_budgets"
      ? "budgets"
      : activeTab === "erp_audit_logs"
      ? "audit_logs"
      : activeTab;

  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center justify-center">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">
              إعدادات وضوابط موديول الحسابات العامة (ERP Settings)
            </h2>
            <p className="text-xs text-slate-400 font-medium">
              السنوات المالية، ربط الحسابات التلقائي، سقوف الموازنات، وسجل التدقيق والمراجعة
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-[11px] font-bold px-3 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-200/60">
            4 أقسام إعدادات متكاملة
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-4">
        {GENERAL_ACCOUNTS_SETTINGS_TABS.map((tab) => {
          const isActive = normalizedTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-start gap-3 p-3.5 rounded-2xl border text-right transition-all group relative overflow-hidden ${
                isActive
                  ? "bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-amber-500/20"
                  : "bg-slate-50/70 hover:bg-slate-100/90 text-slate-700 border-slate-200/80 hover:border-slate-300"
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center transition-colors ${
                  isActive
                    ? "bg-amber-500 text-white shadow-xs"
                    : "bg-white text-slate-600 border border-slate-200 group-hover:border-amber-400 group-hover:text-amber-600"
                }`}
              >
                <Icon className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span
                    className={`block text-xs font-bold truncate ${
                      isActive ? "text-white font-extrabold" : "text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                      isActive
                        ? "bg-white/15 text-amber-300"
                        : "bg-slate-200/60 text-slate-500"
                    }`}
                  >
                    {tab.tag}
                  </span>
                </div>
                <span
                  className={`block text-[10px] leading-relaxed line-clamp-1 ${
                    isActive ? "text-slate-300" : "text-slate-400"
                  }`}
                >
                  {tab.desc}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
