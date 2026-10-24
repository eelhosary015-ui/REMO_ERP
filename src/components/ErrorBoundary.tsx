import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw, Trash2, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught application error in ErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleResetCache = () => {
    try {
      localStorage.removeItem("last_costs_tab");
      localStorage.removeItem("dashboard_selected_branch");
      window.location.href = window.location.origin;
    } catch (_) {
      window.location.reload();
    }
  };

  private handleFullReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = window.location.origin;
    } catch (_) {
      window.location.reload();
    }
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 font-cairo" dir="rtl">
          <div className="max-w-lg w-full bg-slate-800 border border-slate-700 rounded-3xl p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 bg-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto border border-rose-500/30">
              <AlertCircle className="w-8 h-8 animate-pulse" />
            </div>

            <div>
              <h1 className="text-xl font-black text-white mb-2">
                {this.props.fallbackTitle || "حدث خطأ غير متوقع أثناء عرض هذه الشاشة"}
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                تم التقاط الخطأ وحماية بيانات النظام بنجاح. يمكنك إعادة المحاولة أو الرجوع للشاشة الرئيسية.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-right text-xs font-mono text-rose-300 max-h-32 overflow-y-auto" dir="ltr">
                {this.state.error.toString()}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/30"
              >
                <RefreshCw className="w-4 h-4" />
                <span>إعادة تحميل الصفحة</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetCache}
                className="w-full py-3 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all border border-slate-600"
              >
                <Home className="w-4 h-4" />
                <span>العودة للرئيسية</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-700/60">
              <button
                type="button"
                onClick={this.handleFullReset}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center gap-1.5 mx-auto"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>مسح الذاكرة المؤقتة التالفة وإعادة التهيئة</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
