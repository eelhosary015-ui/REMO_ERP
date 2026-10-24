import React from "react";

interface SalesPageShellProps {
  children: React.ReactNode;
  /** Extra utility classes on the same container (grid, spacing, ...). */
  className?: string;
}

/**
 * الحاوية المشتركة لكل شاشات مديول المبيعات.
 *
 * تستبدل الحاويات المقيدة بعرض ثابت (`max-w-[1850px] mx-auto`) التي كانت
 * تحصر المحتوى في منتصف الشاشات العريضة وتترك فراغات كبيرة على الجانبين.
 * تتمدّد الحاوية على كامل العرض المتاح مع هوامش جانبية صغيرة ومتجاوبة،
 * وmin-w-0 يمنع الجداول من كسر عرض الحاوية داخل flex/grid.
 */
export function SalesPageShell({ children, className = "" }: SalesPageShellProps) {
  return (
    <div className={`w-full min-w-0 px-4 sm:px-5 lg:px-6 2xl:px-8 ${className}`}>
      {children}
    </div>
  );
}
