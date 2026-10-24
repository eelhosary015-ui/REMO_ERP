import React from "react";

interface SkeletonProps {
  rows?: number;
  cols?: number;
  type?: "table" | "cards" | "text";
}

// تمت الاضافة: مكون Skeleton Loader احترافي لعرض حالات التحميل بسلاسة
export const HotelSkeletonLoader: React.FC<SkeletonProps> = ({
  rows = 5,
  cols = 6,
  type = "table"
}) => {
  if (type === "cards") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <div className="h-4 bg-slate-200 rounded w-1/3"></div>
              <div className="w-10 h-10 bg-slate-200 rounded-xl"></div>
            </div>
            <div className="h-8 bg-slate-300 rounded w-1/2"></div>
            <div className="h-3 bg-slate-100 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm animate-pulse">
      <div className="p-4 bg-slate-100/70 border-b border-slate-200 flex justify-between gap-4">
        <div className="h-5 bg-slate-300 rounded w-48"></div>
        <div className="h-5 bg-slate-200 rounded w-32"></div>
      </div>
      <div className="p-4 space-y-3">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={`skel-row-${rIdx}`} className="flex items-center gap-4 py-2 border-b border-slate-100 last:border-0">
            {Array.from({ length: cols }).map((_, cIdx) => (
              <div
                key={`skel-col-${rIdx}-${cIdx}`}
                className="h-4 bg-slate-200 rounded"
                style={{ width: `${Math.max(12, 100 / cols)}%` }}
              ></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
