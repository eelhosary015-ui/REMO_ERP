import React, { useState, useEffect } from "react";
import {
  Sparkles, AlertTriangle, TrendingDown, Clock, ShieldAlert,
  ArrowRight, RefreshCw, Zap, Lightbulb, CheckCircle2
} from "lucide-react";

export const AIInventoryAdvisorView: React.FC<{
  onNotify: (msg: string, type: "success" | "error") => void;
}> = ({ onNotify }) => {
  const [data, setData] = useState<any>({ insights: [], stockout_risk: [], dead_stock: [], expiry_risk: [] });
  const [loading, setLoading] = useState(false);

  const fetchAIAnalysis = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inventory-ai/analysis");
      const result = await res.json();
      if (result.success) {
        setData(result);
      }
    } catch (err) {
      onNotify("فشل استدعاء تحليلات الذكاء الاصطناعي", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAIAnalysis();
  }, []);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
              <Sparkles className="w-8 h-8 text-yellow-300 animate-pulse" />
            </div>
            <div>
              <h2 className="text-2xl font-black">المستشار الذكي للمخزون (REMO AI Advisor)</h2>
              <p className="text-sm text-purple-100 mt-0.5">تحليل أنماط الاستهلاك، التنبؤ بنفاد المخزون، كشف الركود، وحماية رأس المال العامل</p>
            </div>
          </div>

          <button
            onClick={fetchAIAnalysis}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-purple-900 rounded-xl font-black text-sm shadow-md hover:bg-purple-50 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            تحديث التحليل الذكي
          </button>
        </div>
      </div>

      {/* AI Insights Feed */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.insights?.length === 0 ? (
          <div className="col-span-2 bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
            <h3 className="font-bold text-slate-800 text-base">المخزون في حالة صحية ممتازة!</h3>
            <p className="text-xs text-slate-400 mt-1">لم يتم رصد أي مخاطر نفاد وشيكة أو تشغيلات منتهية أو ركود غير طبيعي حالياً.</p>
          </div>
        ) : (
          data.insights.map((insight: any, idx: number) => (
            <div
              key={idx}
              className={`p-5 rounded-2xl border shadow-sm flex items-start gap-4 transition-all ${
                insight.severity === 'critical'
                  ? 'bg-red-50/70 border-red-200 text-red-950'
                  : insight.severity === 'warning'
                  ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                  : 'bg-indigo-50/70 border-indigo-200 text-indigo-950'
              }`}
            >
              <div className={`p-2.5 rounded-xl shrink-0 ${
                insight.severity === 'critical' ? 'bg-red-100 text-red-600' :
                insight.severity === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'
              }`}>
                {insight.severity === 'critical' ? <ShieldAlert className="w-5 h-5" /> :
                 insight.severity === 'warning' ? <AlertTriangle className="w-5 h-5" /> : <Lightbulb className="w-5 h-5" />}
              </div>
              <div className="flex-1 space-y-1">
                <h4 className="font-bold text-sm">{insight.title}</h4>
                <p className="text-xs leading-relaxed opacity-90">{insight.description}</p>
                {insight.recommended_action && (
                  <div className="mt-2 pt-2 border-t border-black/5 flex items-center gap-1.5 text-xs font-bold text-purple-900">
                    <Zap className="w-3.5 h-3.5 text-amber-600" />
                    <span>التوصية: {insight.recommended_action}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Deep Analytics Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stockout Risk */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-red-500" /> توقعات النفاد الوشيك
          </h3>
          <div className="space-y-2">
            {data.stockout_risk?.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">لا توجد أصناف معرضة للنفاد</p>
            ) : (
              data.stockout_risk.map((item: any, i: number) => (
                <div key={i} className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800 block">{item.item_name}</span>
                    <span className="text-slate-400">{item.warehouse_name}</span>
                  </div>
                  <span className="font-mono font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg">
                    {Number(item.quantity).toLocaleString()} متبقي
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Dead Stock */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
            <TrendingDown className="w-4 h-4 text-amber-500" /> رأس المال المعطل (مخزون راكد)
          </h3>
          <div className="space-y-2">
            {data.dead_stock?.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">لا يوجد مخزون راكد</p>
            ) : (
              data.dead_stock.map((item: any, i: number) => (
                <div key={i} className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800 block">{item.item_name}</span>
                    <span className="text-slate-400">{Number(item.quantity).toLocaleString()} وحدة</span>
                  </div>
                  <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg">
                    {Number(item.tied_capital).toLocaleString()} ج.م
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Expiry Risk */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-purple-500" /> مخاطر انتهاء الصلاحية
          </h3>
          <div className="space-y-2">
            {data.expiry_risk?.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">لا توجد تشغيلات مهددة</p>
            ) : (
              data.expiry_risk.map((item: any, i: number) => (
                <div key={i} className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800 block">{item.item_name}</span>
                    <span className="text-slate-400 font-mono">تشغيلة #{item.batch_number}</span>
                  </div>
                  <span className="font-mono font-bold text-purple-700 bg-purple-50 px-2 py-1 rounded-lg">
                    {item.days_to_expiry < 0 ? "منتهية!" : `${item.days_to_expiry} يوم`}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
