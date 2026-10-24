import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { NavItem, Branch } from "../types";
import {
  Search,
  ChevronLeft,
  ChevronDown,
  Activity,
  Sparkles,
  X,
  Settings,
  BarChart3,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { api } from "../utils/api";

interface DashboardProps {
  activeTab: "main" | "admin";
  setActiveTab: (tab: "main" | "admin") => void;
  mainItems: NavItem[];
  adminItems: NavItem[];
  selectedBranch: Branch | null;
  branches: Branch[];
  setSelectedBranch: (branch: Branch) => void;
  onItemClick: (id: string, subId?: string) => void;
  user: any;
  onLogout: () => void;
  systemName?: string;
  webOrderCount?: number;
}

export const Dashboard: React.FC<DashboardProps> = ({
  activeTab,
  mainItems,
  adminItems,
  onItemClick,
  user,
  webOrderCount = 0,
}) => {
  const { hasPermission, hasExplicitPermission } = useAuth();
  const { t, language, isRtl } = useLanguage();
  const items = activeTab === "main" ? mainItems : adminItems;

  const [activeSubTab, setActiveSubTab] = useState<
    "features" | "settings" | "reports"
  >(() => {
    try {
      const savedSub = localStorage.getItem(`dashboard_subtab_${activeTab}`);
      if (savedSub === "features" || savedSub === "settings" || savedSub === "reports") {
        return savedSub;
      }
    } catch (_) {}
    return "features";
  });

  const [selectedModule, setSelectedModule] = useState<NavItem | null>(() => {
    try {
      const savedModuleId = localStorage.getItem(`dashboard_module_${activeTab}`);
      if (savedModuleId) {
        const found = items.find((i) => i.id === savedModuleId);
        if (found) return found;
      }
    } catch (_) {}
    return null;
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [warehouseKpis, setWarehouseKpis] = useState<any>(null);

  // Fetch live warehouse badges when warehouses module is selected
  React.useEffect(() => {
    let isSubscribed = true;
    if (selectedModule?.id === "warehouses") {
      api.get("/api/inventory/reports/kpis")
        .then((r) => r.json())
        .then((data) => {
          if (isSubscribed) setWarehouseKpis(data);
        })
        .catch(() => {});
    }
    return () => {
      isSubscribed = false;
    };
  }, [selectedModule?.id]);

  const getLabel = (item: any, type: "module" | "sub" = "module") => {
    if (language === "ar") return item.label;
    if (type === "module") return t(`module.${item.id}`);
    return item.label; // Fallback for sub-items for now
  };

  // Visibility rule: only an explicitly granted screen permission (or full_access)
  // exposes that screen. A module-level grant by itself never exposes every child.
  const canSeeSubPermission = (moduleId: string, subId: string) => {
    const isItemSetting =
      (moduleId === "pos" || moduleId === "warehouses") &&
      ["products", "categories", "ingredients"].includes(subId);
    const permissionKey = isItemSetting ? `products.${subId}` : `${moduleId}.${subId}`;
    return hasExplicitPermission(permissionKey);
  };

  const hasSettings = selectedModule
    ? !!(selectedModule.settings && selectedModule.settings.some((s) =>
        canSeeSubPermission(selectedModule.id, s.id)
      ))
    : false;

  const hasReports = selectedModule
    ? !!(selectedModule.reports && selectedModule.reports.some((r) =>
        canSeeSubPermission(selectedModule.id, r.id)
      ))
    : false;

  // Only clear selections when user actually changes (different user logged in)
  const prevUserIdRef = React.useRef(user?.id);
  React.useEffect(() => {
    if (prevUserIdRef.current && prevUserIdRef.current !== user?.id) {
      try {
        localStorage.removeItem("dashboard_module_main");
        localStorage.removeItem("dashboard_module_admin");
        localStorage.removeItem("dashboard_subtab_main");
        localStorage.removeItem("dashboard_subtab_admin");
      } catch (_) {}
      setSelectedModule(null);
    }
    prevUserIdRef.current = user?.id;
  }, [user?.id]);

  // Sync selected module and sub-tab when switching main/admin tabs or when items load
  React.useEffect(() => {
    try {
      const savedModuleId = localStorage.getItem(`dashboard_module_${activeTab}`);
      if (savedModuleId) {
        const found = items.find((i) => i.id === savedModuleId);
        if (found) {
          setSelectedModule(found);
        }
      }
      const savedSub = localStorage.getItem(`dashboard_subtab_${activeTab}`);
      if (savedSub === "features" || savedSub === "settings" || savedSub === "reports") {
        setActiveSubTab(savedSub);
      }
    } catch (_) {}
  }, [activeTab, items]);

  // Persist selected module in current tab
  React.useEffect(() => {
    try {
      if (selectedModule) {
        localStorage.setItem(`dashboard_module_${activeTab}`, selectedModule.id);
      }
    } catch (_) {}
  }, [selectedModule, activeTab]);

  // Persist active sub-tab in current tab
  React.useEffect(() => {
    try {
      if (activeSubTab) {
        localStorage.setItem(`dashboard_subtab_${activeTab}`, activeSubTab);
      }
    } catch (_) {}
  }, [activeSubTab, activeTab]);

  // Auto-switch to reports/settings if active sub tab has no items
  React.useEffect(() => {
    if (selectedModule) {
      const hasFeatures =
        selectedModule.features &&
        selectedModule.features.some((f) =>
          canSeeSubPermission(selectedModule.id, f.id)
        );
      const hasReportsVal =
        selectedModule.reports &&
        selectedModule.reports.some((r) =>
          canSeeSubPermission(selectedModule.id, r.id)
        );
      const hasSettingsVal =
        selectedModule.settings &&
        selectedModule.settings.some((s) =>
          canSeeSubPermission(selectedModule.id, s.id)
        );

      if (activeSubTab === "features" && !hasFeatures) {
        if (hasReportsVal) setActiveSubTab("reports");
        else if (hasSettingsVal) setActiveSubTab("settings");
      } else if (activeSubTab === "reports" && !hasReportsVal) {
        if (hasFeatures) setActiveSubTab("features");
        else if (hasSettingsVal) setActiveSubTab("settings");
      } else if (activeSubTab === "settings" && !hasSettingsVal) {
        if (hasFeatures) setActiveSubTab("features");
        else if (hasReportsVal) setActiveSubTab("reports");
      }
    }
  }, [selectedModule, hasPermission, activeSubTab]);

  // Filter items based on simple query if typed
  const filteredItems = items.filter((item) =>
    getLabel(item).toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // A sub-item is visible only when its own permission is explicitly granted
  // (or the module has explicit full_access). A module-level permission alone
  // must NOT expose every screen underneath it.
  const canSeeSubItem = (sub: { id: string; label: string; icon?: any }) =>
    selectedModule ? canSeeSubPermission(selectedModule.id, sub.id) : false;

  const getSubItems = () => {
    if (!selectedModule) return [];
    let subItems: { id: string; label: string; icon?: any }[] = [];
    if (activeSubTab === "features") subItems = selectedModule.features || [];
    else if (activeSubTab === "settings") subItems = selectedModule.settings || [];
    else if (activeSubTab === "reports") subItems = selectedModule.reports || [];

    return subItems.filter((sub) => {
      // Keep role restrictions in addition to permission restrictions.
      if (selectedModule.id === "warehouses" && activeSubTab === "features") {
        const userRole = (user?.role || "").toLowerCase();
        if (userRole === "warehouse_keeper" || userRole === "keeper" || userRole === "أمين مخزن") {
          const keeperAllowed = ["stock", "transactions", "goods_receipts", "material_requests", "transfers", "barcode", "main", "locations"];
          if (!keeperAllowed.includes(sub.id)) return false;
        } else if (userRole === "inventory_auditor" || userRole === "auditor" || userRole === "مراجع مخزون" || userRole === "مراقب مخزون") {
          const auditorAllowed = ["stock", "count", "adjustments", "damaged", "reserved"];
          if (!auditorAllowed.includes(sub.id)) return false;
        }
      }

      return canSeeSubItem(sub);
    });
  };

  return (
    <div
      className={`w-full h-full p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-6 lg:gap-8 overflow-hidden select-none bg-[#f8fafc] font-cairo`}
    >
      {/* GRID OF MODULES */}
      <div className={`flex-1 flex flex-col overflow-y-auto custom-scrollbar ${selectedModule ? 'hidden lg:flex' : 'flex'}`}>
        {/* Section Header Title */}
        <div className="mb-6 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-6 bg-blue-600 rounded-full animate-pulse"></span>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-800 tracking-wide">
              {activeTab === "main" ? t("nav.main") : t("nav.admin")}
            </h2>
          </div>
          <span className="text-xs bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full text-slate-500 font-bold font-mono">
            {filteredItems.length}{" "}
            {language === "ar" ? "مديول متاح" : "Modules Available"}
          </span>
        </div>

        {/* COMPACT SQUARE MODULES GRID */}
        <div
          key={`dashboard-grid-${activeTab}`}
          className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-7 gap-x-3 gap-y-4 sm:gap-x-4 sm:gap-y-6 content-start pb-24 sm:pb-8"
        >
          {filteredItems.map((item, itemIdx) => {
            const colorInfo =
              (item.color || "").match(
                /(emerald|rose|blue|purple|orange|cyan|indigo|yellow|sky|fuchsia|violet|pink|red|green|teal)/,
              )?.[0] || "blue";

            // Map icon color to premium high-saturation solid backgrounds as in the user's photo
            const bgClass =
              {
                emerald: "bg-[#10b981]",
                rose: "bg-[#e11d48]",
                blue: "bg-[#2563eb]",
                purple: "bg-[#7c3aed]",
                orange: "bg-[#ea580c]",
                cyan: "bg-[#0891b2]",
                indigo: "bg-[#4f46e5]",
                yellow: "bg-[#ca8a04]",
                pink: "bg-[#db2777]",
                red: "bg-[#dc2626]",
                green: "bg-[#16a34a]",
                teal: "bg-[#0d9488]",
              }[colorInfo] || "bg-[#2563eb]";

            const isSelected = selectedModule?.id === item.id;

            return (
              <button
                key={`dash-mod-${activeTab}-${item.id || itemIdx}-${itemIdx}`}
                className="group flex flex-col items-center justify-start gap-2 focus:outline-none focus:ring-0 active:scale-95 transition-all"
                onClick={() => {
                  const hasSubContent =
                    (item.features && item.features.length > 0) ||
                    (item.settings && item.settings.length > 0) ||
                    (item.reports && item.reports.length > 0);
                  if (hasSubContent) {
                    setSelectedModule(item);
                  } else {
                    onItemClick(item.id);
                  }
                }}
              >
                {/* Image-Style Compact Rounded Icon Box with vibrant background */}
                <div
                  className={`w-[44px] h-[44px] sm:w-[54px] sm:h-[54px] md:w-[60px] md:h-[60px] ${bgClass} rounded-2xl flex items-center justify-center border-2 ${isSelected ? "border-blue-600 scale-105 ring-4 ring-blue-100 shadow-xl" : "border-white/20 group-hover:border-white/50"} shadow-md shadow-slate-200 overflow-hidden relative transition-all`}
                >
                  <div className="absolute inset-0 bg-white/0 group-hover:bg-white/15 transition-colors duration-250"></div>

                  {/* Styled central icon */}
                  <item.icon
                    className={`w-5 h-5 sm:w-6 sm:h-6 text-white group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)] ${isSelected ? "scale-110" : ""}`}
                    strokeWidth={1.8}
                  />

                  {/* Subtle highlight glare effect */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/15 pointer-events-none"></div>

                  {/* Web Orders notification badge */}
                  {item.id === "web-orders" && webOrderCount > 0 && (
                    <span className="absolute -top-1 -left-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md animate-pulse">
                      {webOrderCount}
                    </span>
                  )}
                </div>

                {/* Styled centered item text directly under square */}
                <span
                  className={`text-[9px] sm:text-[10px] font-bold text-center tracking-tight leading-relaxed max-w-[56px] sm:max-w-[70px] transition-colors px-1 ${isSelected ? "text-blue-600 font-extrabold" : "text-slate-700 group-hover:text-slate-950"}`}
                >
                  {getLabel(item)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* LEFT CONTAINER (THE DECORATIVE / SUB-MENU WHITE CARD WITH BLUE ACCENT OR SHADOW) */}
      <div className={`w-full lg:w-[500px] xl:w-[680px] relative border border-slate-200 rounded-3xl overflow-hidden bg-white flex-col h-full shrink-0 shadow-lg shadow-slate-100/80 ${selectedModule ? 'flex' : 'hidden lg:flex'}`}>
        {/* Scientific-styled subtle grid inside light block */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]">
          <div className="absolute top-1/4 left-1/4 w-44 h-44 rounded-full bg-blue-500 filter blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-44 h-44 rounded-full bg-emerald-500 filter blur-3xl"></div>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.1)_1px,transparent_1px)] bg-[size:16px_16px]"></div>
        </div>

        <div className="relative z-10 w-full flex flex-col h-full overflow-hidden">
          {/* PILL SEARCH BAR WITH LIGHT BG - Moved to top fixed part */}
          <div className="p-4 sm:p-6 pb-0 shrink-0">
            <div className="relative w-full flex items-center bg-slate-50 border border-slate-200 rounded-full py-2.5 px-4 shadow-inner mb-6 group focus-within:border-blue-500/50 transition-all">
              <Search className="w-4 h-4 text-slate-400 ml-3 shrink-0" />
              <input
                type="text"
                placeholder={t("dashboard.search")}
                value={searchQuery ?? ""}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-slate-800 w-full outline-none text-xs sm:text-sm font-bold placeholder:text-slate-400"
              />
              <button className="p-1 hover:bg-slate-200/55 rounded-full transition-colors shrink-0">
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-focus-within:text-slate-600" />
              </button>
            </div>
          </div>

          <div className="flex grow overflow-hidden">
            {/* CONTENT AREA: SHOW SUB-ITEMS IF MODULE SELECTED, OTHERWISE TECH LOGO */}
            <div className="flex-1 p-4 sm:p-6 pt-0 overflow-y-auto pr-1 pl-1 custom-scrollbar flex flex-col">
              <AnimatePresence mode="wait">
                {selectedModule ? (
                  <motion.div
                    key={`${selectedModule.id}-${activeSubTab}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.18 }}
                    className="flex flex-col gap-4"
                  >
                    {/* Header showing selected category */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-2 shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600">
                          <selectedModule.icon className="w-5.5 h-5.5" />
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="text-[10px] text-slate-400 font-bold">
                            {activeSubTab === "features"
                              ? t("dashboard.features")
                              : activeSubTab === "settings"
                                ? t("dashboard.settings")
                                : t("dashboard.reports")}
                          </span>
                          <h3 className="text-sm sm:text-md font-bold text-slate-800 tracking-wide">
                            {selectedModule.label}
                          </h3>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedModule(null);
                          try {
                            localStorage.removeItem(`dashboard_module_${activeTab}`);
                          } catch (_) {}
                        }}
                        className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold px-3 py-1.5 rounded-xl border border-slate-200/80 transition-colors flex items-center gap-1 shadow-sm"
                      >
                        <ChevronLeft className="w-4 h-4 rotate-180" />
                        <span>العودة للمديولات</span>
                      </button>
                    </div>

                    {/* Submenu Item Cards matching screenshot design perfectly */}
                    <div className="flex flex-col gap-2 pb-24 sm:pb-8">
                      {getSubItems().length > 0 ? (
                        getSubItems().map((sub, i) => {
                          const SubIcon = sub.icon || Activity;
                          let badgeValue: number | null = null;
                          let badgeBg = "bg-amber-100 text-amber-800 border-amber-200";

                          if (selectedModule.id === "warehouses" && warehouseKpis) {
                            if (sub.id === "goods_receipts" && warehouseKpis.pending_grn_count > 0) {
                              badgeValue = warehouseKpis.pending_grn_count;
                              badgeBg = "bg-amber-100 text-amber-800 border-amber-200";
                            } else if (sub.id === "stock" && warehouseKpis.low_stock_count > 0) {
                              badgeValue = warehouseKpis.low_stock_count;
                              badgeBg = "bg-rose-100 text-rose-800 border-rose-200";
                            } else if (sub.id === "transfers" && warehouseKpis.pending_transfers_count > 0) {
                              badgeValue = warehouseKpis.pending_transfers_count;
                              badgeBg = "bg-blue-100 text-blue-800 border-blue-200";
                            } else if (sub.id === "damaged" && warehouseKpis.draft_wastage_count > 0) {
                              badgeValue = warehouseKpis.draft_wastage_count;
                              badgeBg = "bg-orange-100 text-orange-800 border-orange-200";
                            }
                          }

                          return (
                            <motion.button
                              key={`dash-sub-${selectedModule?.id || 'mod'}-${activeSubTab}-${sub.id || i}-${i}`}
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.04 }}
                              onClick={() => {
                                onItemClick(selectedModule.id, sub.id);
                              }}
                              className="w-full flex items-center justify-between bg-slate-50 hover:bg-blue-600 text-slate-700 hover:text-white border border-slate-100 hover:border-blue-600 p-3 rounded-xl transition-all group/sub shrink-0 shadow-sm"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-white text-blue-600 border border-slate-200 group-hover/sub:border-transparent group-hover/sub:bg-white/15 group-hover/sub:text-white flex items-center justify-center transition-all shadow-sm">
                                  <SubIcon className="w-4.5 h-4.5" />
                                </div>
                                <span className="text-xs sm:text-sm font-bold font-cairo text-right leading-none">
                                  {sub.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {badgeValue !== null && (
                                  <span className={`px-2 py-0.5 text-[11px] font-extrabold rounded-full border shadow-xs transition-colors group-hover/sub:bg-white/20 group-hover/sub:text-white group-hover/sub:border-white/30 ${badgeBg}`}>
                                    {badgeValue}
                                  </span>
                                )}
                                <ChevronLeft className="w-4 h-4 opacity-40 group-hover/sub:opacity-100 group-hover/sub:-translate-x-1 transition-all" />
                              </div>
                            </motion.button>
                          );
                        })
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-300 gap-3">
                          <X className="w-8 h-8 opacity-20" />
                          <span className="text-xs font-bold">
                            {t("dashboard.no_content")}
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="science-graphics"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 flex flex-col items-center justify-center text-center py-8"
                  >
                    {/* 3D Animated REMO PRO Graphic */}
                    <div className="relative w-48 h-48 flex flex-col items-center justify-center mb-8 shrink-0 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-3xl shadow-2xl border-4 border-cyan-500/20 p-4 preserve-3d">
                      <div className="absolute inset-0 bg-cyan-500/10 rounded-3xl blur-xl -z-10 animate-pulse" />
                      <span className="text-3xl font-black tracking-wider text-white uppercase text-center font-montserrat select-none"
                            style={{
                              textShadow: "0 1px 0 #38bdf8, 0 2px 0 #0284c7, 0 3px 0 #0369a1, 0 4px 0 #075985, 0 5px 0 #0c4a6e, 0 10px 20px rgba(0,0,0,0.8)"
                            }}>
                        REMO <span className="text-cyan-400">PRO</span>
                      </span>
                    </div>
                    <span className="text-[10px] font-bold tracking-widest text-blue-700 bg-blue-50 border border-blue-100 px-4 py-1.5 rounded-full shadow-sm flex items-center gap-1.5 mb-3">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                      {t("dashboard.smart_system")}
                    </span>
                    <p className="text-[11px] font-bold text-slate-400 leading-relaxed font-cairo max-w-[220px]">
                      {t("dashboard.hint")}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Tab Navigation Rail */}
            <AnimatePresence>
              {selectedModule && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 84, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className={`border-r border-slate-100 flex flex-col items-center py-6 gap-8 bg-slate-50/50 backdrop-blur-sm shrink-0 overflow-hidden`}
                >
                  <button
                    onClick={() => setActiveSubTab("features")}
                    className={`flex flex-col items-center gap-2 transition-all outline-none group/tab ${activeSubTab === "features" ? "text-blue-600" : "text-slate-400 hover:text-slate-600"}`}
                  >
                    <div
                      className={`p-3 rounded-2xl border-2 transition-all duration-300 ${activeSubTab === "features" ? "bg-white border-blue-600 shadow-lg shadow-blue-500/10 scale-105" : "bg-white border-slate-200 hover:border-slate-300"}`}
                    >
                      <Activity className="w-5.5 h-5.5" />
                    </div>
                    <span className="text-[10px] font-bold">
                      {t("dashboard.features")}
                    </span>
                  </button>
                  {hasSettings && (
                    <button
                      onClick={() => setActiveSubTab("settings")}
                      className={`flex flex-col items-center gap-2 transition-all outline-none group/tab ${activeSubTab === "settings" ? "text-blue-600" : "text-slate-400 hover:text-slate-600"}`}
                    >
                      <div
                        className={`p-3 rounded-2xl border-2 transition-all duration-300 ${activeSubTab === "settings" ? "bg-white border-blue-600 shadow-lg shadow-blue-500/10 scale-105" : "bg-white border-slate-200 hover:border-slate-300"}`}
                      >
                        <Settings className="w-5.5 h-5.5" />
                      </div>
                      <span className="text-[10px] font-bold">
                        {t("dashboard.settings")}
                      </span>
                    </button>
                  )}
                  {hasReports && (
                    <button
                      onClick={() => setActiveSubTab("reports")}
                      className={`flex flex-col items-center gap-2 transition-all outline-none group/tab ${activeSubTab === "reports" ? "text-blue-600" : "text-slate-400 hover:text-slate-600"}`}
                    >
                      <div
                        className={`p-3 rounded-2xl border-2 transition-all duration-300 ${activeSubTab === "reports" ? "bg-white border-blue-600 shadow-lg shadow-blue-500/10 scale-105" : "bg-white border-slate-200 hover:border-slate-300"}`}
                      >
                        <BarChart3 className="w-5.5 h-5.5" />
                      </div>
                      <span className="text-[10px] font-bold">
                        {t("dashboard.reports")}
                      </span>
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
