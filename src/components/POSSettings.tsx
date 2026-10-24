import React, { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Save,
  Settings,
  MonitorCog,
  Store,
  Utensils,
  Shirt,
  ShoppingBasket,
  LayoutGrid,
  Barcode,
  CreditCard,
  Receipt,
  Printer,
  PieChart,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Plus,
  X,
  Link2,
  Unlink,
  Target,
  Table2,
  ChefHat,
  UserCircle,
  Truck,
  Users,
  Warehouse,
  FileText,
  Eye,
  Pencil,
  Trash2,
  ImagePlus,
  Copy,
  Palette,
  Clock
} from "lucide-react";
import { api } from "../utils/api";
import {
  createProfileConfiguration,
  createDefaultCustomTemplate,
  createDefaultCustomScreenDesign,
  DEFAULT_POS_CONFIGURATION,
  normalizePOSConfiguration,
  parsePOSConfiguration,
  POS_BUILT_IN_TEMPLATES,
  POS_BUILT_IN_SCREEN_DESIGNS,
  POS_SCREEN_DESIGN_STYLE_LABELS,
  POS_BUSINESS_PROFILES,
  POS_INVOICE_STYLE_LABELS,
  POS_LINKED_MODULES_LIST,
  POS_SETTINGS_KEY,
  type POSBusinessProfile,
  type POSConfiguration,
  type POSInvoiceTemplate,
  type POSInvoiceTemplateStyle,
  type POSLinkedModule,
  type POSOrderType,
  type POSPaymentMethod,
  type POSScreenDesignPreset,
  type POSScreenDesignStyle,
  type POSScreenLayoutPosition,
  type POSCategoriesPosition
} from "../utils/posSettings";

interface POSSettingsProps {
  onBack: () => void;
}

const profileIcons: Record<POSBusinessProfile, React.ReactNode> = {
  restaurant: <Utensils className="w-5 h-5" />,
  clothing: <Shirt className="w-5 h-5" />,
  supermarket: <ShoppingBasket className="w-5 h-5" />,
  general: <Store className="w-5 h-5" />
};

const orderTypeLabels: Record<POSOrderType, string> = {
  "WALK-IN": "بيع مباشر",
  "DELIVERY": "دليفري",
  "PICK UP": "استلام من الفرع",
  "MEMBERSHIP": "عضوية / عميل دائم",
  "DINE-IN": "صالة / طاولة",
  "TAKEAWAY": "تيك أواي",
  "EXCHANGE": "استبدال"
};

const paymentLabels: Record<POSPaymentMethod, string> = {
  cash: "كاش",
  visa: "فيزا",
  mastercard: "ماستر كارد",
  instapay: "إنستا باي",
  wallet: "محفظة",
  credit: "آجل / حساب عميل",
  mixed: "دفع مختلط"
};

const linkedModuleIcons: Record<string, React.ReactNode> = {
  Target: <Target className="w-5 h-5" />,
  Table2: <Table2 className="w-5 h-5" />,
  ChefHat: <ChefHat className="w-5 h-5" />,
  UserCircle: <UserCircle className="w-5 h-5" />,
  Truck: <Truck className="w-5 h-5" />,
  Users: <Users className="w-5 h-5" />,
  Warehouse: <Warehouse className="w-5 h-5" />,
};

const ToggleField = ({
  title,
  description,
  checked,
  onChange
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) => (
  <label className="flex items-start justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm hover:border-blue-200 transition-colors cursor-pointer">
    <div className="text-right">
      <span className="block font-black text-slate-800 text-sm">{title}</span>
      {description && <span className="block text-xs text-slate-500 leading-relaxed mt-1">{description}</span>}
    </div>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-1 h-5 w-5 accent-blue-600"
    />
  </label>
);

const Section = ({
  icon,
  title,
  description,
  children
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) => (
  <div className="bg-slate-50/70 rounded-3xl border border-slate-100 p-5">
    <div className="flex items-start gap-3 mb-5">
      <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
        {icon}
      </div>
      <div>
        <h2 className="font-black text-lg text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
      </div>
    </div>
    {children}
  </div>
);

/* ─── Template Full-Size Receipt Preview ─── */
const TemplateFullPreview = ({ template }: { template: POSInvoiceTemplate }) => {
  const t = template;
  const s = t.style;
  const border = t.borderColor;
  const hBg = t.headerBgColor;
  const hTxt = t.headerTextColor;
  const fz = t.fontSize;
  const fw = t.fontWeight;
  const cur = "ج.م";

  // Sample data
  const sampleItems = [
    { name: "سوبر لايت بوكس", qty: 1, price: 160, variant: "" },
    { name: "براد شاي بالليمون", qty: 2, price: 35, variant: "" },
    { name: "عصير برتقال طازج", qty: 3, price: 45, variant: "كبير" },
    { name: "فتة بالخل والتوم", qty: 1, price: 120, variant: "" },
  ];
  const itemsTotal = 560;
  const taxVal = 78.4;
  const discountVal = 30;
  const deliveryVal = 25;
  const serviceVal = 28;
  const grandTotal = 661.4;

  const borderStyle = (extra: React.CSSProperties = {}) => ({
    borderColor: border,
    ...extra
  });

  const headerBlock = (
    <div className={`text-center ${s === "modern" || s === "elegant" ? "p-6" : "pb-4 mb-3"}`}>
      {t.showLogo && (
        <div className="flex justify-center mb-3">
          {t.logoUrl ? (
            <img src={t.logoUrl} alt="Logo" className="w-16 h-16 object-contain" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-16 h-16 border-2 rounded-full flex items-center justify-center text-xs opacity-40" style={{ borderColor: border }}>
              LOGO
            </div>
          )}
        </div>
      )}
      {t.showCompanyName && (
        <h2 className={`font-black uppercase tracking-tight ${s === "modern" || s === "elegant" ? "text-2xl" : s === "classic" ? "text-3xl" : "text-xl"}`}
          style={{ color: (s === "modern" || s === "elegant") ? hTxt : undefined }}>
          {t.companyName || "مطعم الشرق الأوسط"}
        </h2>
      )}
      {t.headerText && <p className="text-sm opacity-70 mt-1">{t.headerText}</p>}
      {t.showOrderNumber && <p className="font-bold mt-2"><span className="opacity-60">رقم الطلب: </span>42</p>}
      {t.showOrderType && (
        <p className="text-3xl font-black mt-2" style={{ color: s === "modern" ? "#60a5fa" : s === "elegant" ? "#c084fc" : undefined }}>
          صالة / طاولة
        </p>
      )}
      {t.showDate && t.showTime && (
        <p className="text-sm opacity-70 mt-1">27 مارس 2026 — 3:28:45 م</p>
      )}
      {t.showDate && !t.showTime && <p className="text-sm opacity-70 mt-1">27 مارس 2026</p>}
      {!t.showDate && t.showTime && <p className="text-sm opacity-70 mt-1">3:28:45 م</p>}
    </div>
  );

  const infoRows = (
    <div className="mb-4 text-sm space-y-1">
      {t.showCashier && <div className="flex justify-between"><span className="font-bold opacity-70">الكاشير:</span><span>أحمد محمد</span></div>}
      {t.showTable && <div className="flex justify-between"><span className="font-bold opacity-70">الطاولة:</span><span>7</span></div>}
      {t.showCustomer && (
        <>
          <div className="flex justify-between"><span className="font-bold opacity-70">العميل:</span><span>فاروق السيد</span></div>
          <div className="flex justify-between"><span className="font-bold opacity-70">الهاتف:</span><span>01012345678</span></div>
        </>
      )}
      {t.showDeliveryAddress && <div className="flex justify-between"><span className="font-bold opacity-70">العنوان:</span><span className="text-left">15 شارع الثورة، المعادي</span></div>}
      {t.showPaymentMethod && <div className="flex justify-between"><span className="font-bold opacity-70">طريقة الدفع:</span><span className="font-bold text-orange-600">كاش (نقداً)</span></div>}
    </div>
  );

  const itemsBlockList = (
    <div className="space-y-2 mb-4">
      <div className="flex justify-between font-bold border-b pb-2 mb-2" style={borderStyle()}>
        <span className="opacity-60">الصنف</span>
        {t.showItemPrices && <span className="opacity-60">السعر</span>}
      </div>
      {sampleItems.map((item, i) => (
        <div key={i} className="flex justify-between text-sm">
          <span>{item.name}{item.variant ? ` (${item.variant})` : ""} x{item.qty}</span>
          {t.showItemPrices && <span>{Number(item.price * item.qty || 0).toLocaleString()} {cur}</span>}
        </div>
      ))}
      {t.showDeliveryFee && deliveryVal > 0 && (
        <div className="flex justify-between text-sm border-t pt-2" style={borderStyle({ borderTopStyle: "dashed" })}>
          <span>خدمة التوصيل</span>
          <span>{deliveryVal} {cur}</span>
        </div>
      )}
      {t.showDiscount && discountVal > 0 && (
        <div className="flex justify-between text-sm text-rose-600 font-bold">
          <span>قيمة الخصم</span>
          <span>-{discountVal} {cur}</span>
        </div>
      )}
    </div>
  );

  const totalsBlock = (
    <div className="space-y-1.5 mb-4">
      {t.showSubtotal && (
        <div className="flex justify-between text-sm"><span className="opacity-60">المجموع الفرعي</span><span>{itemsTotal} {cur}</span></div>
      )}
      {t.showTax && (
        <div className="flex justify-between text-sm"><span className="opacity-60">الضريبة (14%)</span><span>{taxVal} {cur}</span></div>
      )}
      {t.showServiceCharge && (
        <div className="flex justify-between text-sm"><span className="opacity-60">رسوم الخدمة</span><span>{serviceVal} {cur}</span></div>
      )}
      {t.showGrandTotal && (
        <div className="flex justify-between font-black text-xl border-t-2 pt-3 mt-2" style={borderStyle({ borderTopStyle: "dashed" })}>
          <span>الإجمالي النهائي</span>
          <span>{grandTotal} {cur}</span>
        </div>
      )}
    </div>
  );

  const footerBlock = (
    <div className="text-center text-sm italic opacity-50 mt-4 space-y-1">
      {t.footerText && <p>{t.footerText}</p>}
      {t.hotline && <p className="font-bold not-italic">الخط الساخن: {t.hotline}</p>}
      <p className="text-[10px] not-italic opacity-40">Powered by : Backend</p>
    </div>
  );

  /* ─── detailed-table style ─── */
  if (s === "detailed-table") {
    return (
      <div className="w-full max-w-[320px] mx-auto bg-white text-black font-mono" style={{ fontSize: `${fz}px`, fontWeight: fw }}>
        {/* Header */}
        <div className="text-center py-4 border-b-2" style={borderStyle()}>
          {t.showLogo && (
            <div className="flex justify-center mb-2">
              {t.logoUrl ? <img src={t.logoUrl} alt="" className="w-14 h-14 object-contain" referrerPolicy="no-referrer" />
                : <div className="w-14 h-14 border-2 rounded-full flex items-center justify-center text-[10px] opacity-40" style={borderStyle()}>LOGO</div>}
            </div>
          )}
          {t.showCompanyName && <p className="font-black text-lg">{t.companyName || "مطعم الشرق الأوسط"}</p>}
          {t.headerText && <p className="text-sm opacity-70">{t.headerText}</p>}
        </div>

        {/* Info Table */}
        <table className="w-full border-collapse border border-black text-center text-sm">
          <tbody>
            {t.showOrderNumber && (
              <tr className="border-b border-black">
                <td colSpan={2} className="p-2 font-black text-3xl">42</td>
              </tr>
            )}
            {t.showOrderType && (
              <tr className="border-b border-black">
                <td colSpan={2} className="p-2 font-black text-xl">صالة / طاولة</td>
              </tr>
            )}
            {t.showDate && t.showTime && (
              <tr className="border-b border-black">
                <td className="border-l border-black p-2 w-1/2">27 مارس 2026</td>
                <td className="p-2 w-1/2">3:28:45 م</td>
              </tr>
            )}
            {t.showCashier && (
              <tr className="border-b border-black text-right">
                <td className="border-l border-black p-2 font-bold w-1/3">الكاشير</td>
                <td className="p-2 w-2/3">أحمد محمد</td>
              </tr>
            )}
            {t.showTable && (
              <tr className="border-b border-black text-right">
                <td className="border-l border-black p-2 font-bold w-1/3">الطاولة</td>
                <td className="p-2 w-2/3">7</td>
              </tr>
            )}
            {t.showCustomer && (
              <>
                <tr className="border-b border-black text-right">
                  <td className="border-l border-black p-2 font-bold w-1/3">العميل</td>
                  <td className="p-2 w-2/3 font-bold">فاروق السيد</td>
                </tr>
                <tr className="border-b border-black text-right">
                  <td className="border-l border-black p-2 font-bold w-1/3">الهاتف</td>
                  <td className="p-2 w-2/3">01012345678</td>
                </tr>
              </>
            )}
            {t.showDeliveryAddress && (
              <tr className="border-b border-black text-right">
                <td className="border-l border-black p-2 font-bold w-1/3">العنوان</td>
                <td className="p-2 w-2/3">15 شارع الثورة، المعادي</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Items Table */}
        {t.showItemsTable && (
          <table className="w-full border-collapse border border-black text-center text-sm mt-0">
            <thead>
              <tr className="font-bold border-b border-black" style={{ background: hBg, color: hTxt }}>
                {t.showItemPrices && <th className="border-l border-black p-2">إجمالي</th>}
                {t.showItemPrices && <th className="border-l border-black p-2">سعر</th>}
                <th className="border-l border-black p-2">الصنف</th>
                <th className="p-2">كمية</th>
              </tr>
            </thead>
            <tbody>
              {sampleItems.map((item, i) => (
                <tr key={i} className="border-b border-black">
                  {t.showItemPrices && <td className="border-l border-black p-2">{Number(item.price * item.qty || 0).toLocaleString()}</td>}
                  {t.showItemPrices && <td className="border-l border-black p-2">{item.price}</td>}
                  <td className="border-l border-black p-2 text-right px-2">{item.name}{item.variant ? ` - ${item.variant}` : ""}</td>
                  <td className="p-2">{item.qty}</td>
                </tr>
              ))}
              {t.showDeliveryFee && deliveryVal > 0 && (
                <tr className="border-b border-black">
                  {t.showItemPrices && <td className="border-l border-black p-2">{deliveryVal}</td>}
                  {t.showItemPrices && <td className="border-l border-black p-2">{deliveryVal}</td>}
                  <td className="border-l border-black p-2 text-right px-2">خدمة التوصيل</td>
                  <td className="p-2">1</td>
                </tr>
              )}
              {t.showDiscount && discountVal > 0 && (
                <tr className="border-b border-black text-rose-600 font-bold">
                  {t.showItemPrices && <td className="border-l border-black p-2">-{discountVal}</td>}
                  <td colSpan={t.showItemPrices ? 3 : 2} className="border-l border-black p-2 text-right px-2" style={borderStyle()}>قيمة الخصم</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Totals Table */}
        <table className="w-full border-collapse border border-black text-center text-sm mt-0">
          <tbody>
            {t.showSubtotal && (
              <tr className="border-b border-black text-right">
                <td className="border-l border-black p-2 w-2/3">المجموع الفرعي</td>
                <td className="p-2 w-1/3">{itemsTotal} {cur}</td>
              </tr>
            )}
            {t.showTax && (
              <tr className="border-b border-black text-right">
                <td className="border-l border-black p-2">الضريبة (14%)</td>
                <td className="p-2">{taxVal} {cur}</td>
              </tr>
            )}
            {t.showServiceCharge && (
              <tr className="border-b border-black text-right">
                <td className="border-l border-black p-2">رسوم الخدمة</td>
                <td className="p-2">{serviceVal} {cur}</td>
              </tr>
            )}
            {t.showGrandTotal && (
              <tr className="font-black bg-slate-100 text-lg" style={{ background: hBg + "20" }}>
                <td className="border-l border-black p-2 text-right px-3">الإجمالي النهائي</td>
                <td className="p-2">{grandTotal} {cur}</td>
              </tr>
            )}
          </tbody>
        </table>

        {t.showNotes && (
          <div className="p-3 border-b-2 border-black text-right text-sm">
            <p className="font-bold mb-1">ملاحظات:</p>
            <p className="opacity-70">بدون بصل في الساندوتش — ثلج إضافي مع العصير</p>
          </div>
        )}

        {t.showPaymentMethod && (
          <p className="text-center font-bold py-3 text-lg">نقدي</p>
        )}

        <div className="p-3 border-t-2 border-black text-center opacity-60 space-y-1 text-sm">
          {t.footerText && <p className="font-bold">{t.footerText}</p>}
          {t.hotline && <p>لطلب الاوردرات الخط الساخن {t.hotline}</p>}
          <p className="text-[10px]">Powered by : Backend</p>
        </div>
      </div>
    );
  }

  /* ─── modern style ─── */
  if (s === "modern") {
    return (
      <div className="w-full max-w-[320px] mx-auto bg-white text-black rounded-3xl border-4 overflow-hidden shadow-2xl" style={{ borderColor: hBg, fontSize: `${fz}px`, fontWeight: fw }}>
        <div className="text-center p-6 text-white" style={{ background: hBg, color: hTxt }}>
          {t.showLogo && (
            <div className="flex justify-center mb-2">
              {t.logoUrl ? <img src={t.logoUrl} alt="" className="w-14 h-14 object-contain rounded-xl" referrerPolicy="no-referrer" />
                : <div className="w-14 h-14 border-2 border-white/30 rounded-full flex items-center justify-center text-[10px] opacity-50">LOGO</div>}
            </div>
          )}
          {t.showCompanyName && <h2 className="font-black text-2xl">{t.companyName || "مطعم الشرق الأوسط"}</h2>}
          {t.headerText && <p className="text-sm opacity-80">{t.headerText}</p>}
          <div className="flex justify-center gap-4 mt-3 text-sm opacity-80">
            {t.showOrderNumber && <span className="bg-white/20 px-3 py-1 rounded-full font-bold">#42</span>}
            {t.showOrderType && <span className="bg-white/20 px-3 py-1 rounded-full font-bold">صالة</span>}
          </div>
          {(t.showDate || t.showTime) && <p className="text-xs opacity-60 mt-2">{t.showDate && t.showTime ? "27 مارس 2026 — 3:28 م" : t.showDate ? "27 مارس 2026" : "3:28 م"}</p>}
        </div>
        <div className="p-6 space-y-4">
          {(t.showCashier || t.showCustomer || t.showTable || t.showDeliveryAddress || t.showPaymentMethod) && (
            <div className="bg-slate-50 p-4 rounded-xl space-y-1 text-sm">
              {t.showCashier && <div className="flex justify-between"><span className="opacity-50">الكاشير</span><span className="font-bold">أحمد محمد</span></div>}
              {t.showTable && <div className="flex justify-between"><span className="opacity-50">الطاولة</span><span className="font-bold">7</span></div>}
              {t.showCustomer && <><div className="flex justify-between"><span className="opacity-50">العميل</span><span className="font-bold">فاروق السيد</span></div>
                <div className="flex justify-between"><span className="opacity-50">الهاتف</span><span>01012345678</span></div></>}
              {t.showDeliveryAddress && <div className="flex justify-between"><span className="opacity-50">العنوان</span><span>15 شارع الثورة</span></div>}
              {t.showPaymentMethod && <div className="flex justify-between"><span className="opacity-50">الدفع</span><span className="font-bold text-orange-600">كاش</span></div>}
            </div>
          )}
          {t.showNotes && (
            <div className="bg-amber-50 p-3 rounded-xl text-sm"><span className="font-bold text-amber-700">ملاحظات: </span><span className="opacity-70">بدون بصل — ثلج إضافي</span></div>
          )}
          {t.showItemsTable && (
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-400 border-b border-slate-100 pb-2 mb-2">
                <span>الصنف</span>{t.showItemPrices && <span>السعر</span>}
              </div>
              <div className="space-y-2">
                {sampleItems.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="opacity-80">{item.name}{item.variant ? ` (${item.variant})` : ""} x{item.qty}</span>
                    {t.showItemPrices && <span className="font-medium">{Number(item.price * item.qty || 0).toLocaleString()} {cur}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {(t.showSubtotal || t.showTax || t.showDiscount || t.showDeliveryFee || t.showServiceCharge) && (
            <div className="space-y-1.5 border-t border-slate-100 pt-3">
              {t.showSubtotal && <div className="flex justify-between text-sm"><span className="opacity-50">المجموع الفرعي</span><span>{itemsTotal} {cur}</span></div>}
              {t.showTax && <div className="flex justify-between text-sm"><span className="opacity-50">الضريبة (14%)</span><span>{taxVal} {cur}</span></div>}
              {t.showServiceCharge && <div className="flex justify-between text-sm"><span className="opacity-50">رسوم الخدمة</span><span>{serviceVal} {cur}</span></div>}
              {t.showDiscount && <div className="flex justify-between text-sm text-rose-600"><span>الخصم</span><span>-{discountVal} {cur}</span></div>}
              {t.showDeliveryFee && <div className="flex justify-between text-sm"><span className="opacity-50">التوصيل</span><span>{deliveryVal} {cur}</span></div>}
            </div>
          )}
          {t.showGrandTotal && (
            <div className="flex justify-between font-black text-xl pt-3 border-t-2" style={borderStyle({ borderTopColor: hBg })}>
              <span>الإجمالي</span><span style={{ color: hBg === "#0f172a" ? "#4f46e5" : hBg }}>{grandTotal} {cur}</span>
            </div>
          )}
          <div className="text-center text-xs italic opacity-40 border-t border-slate-100 pt-4 space-y-1">
            {t.footerText && <p>{t.footerText}</p>}
            {t.hotline && <p className="font-bold not-italic">الخط الساخن: {t.hotline}</p>}
          </div>
        </div>
      </div>
    );
  }

  /* ─── classic style ─── */
  if (s === "classic") {
    return (
      <div className="w-full max-w-[320px] mx-auto bg-white text-black font-serif p-8 border-4 border-double" style={{ borderColor: border, fontSize: `${fz}px`, fontWeight: fw }}>
        <div className="text-center border-b-4 border-double pb-4 mb-4" style={borderStyle({ borderBottomWidth: "4px", borderBottomStyle: "double" })}>
          {t.showLogo && (
            <div className="flex justify-center mb-2">
              {t.logoUrl ? <img src={t.logoUrl} alt="" className="w-14 h-14 object-contain" referrerPolicy="no-referrer" />
                : <div className="w-14 h-14 border-2 rounded-full flex items-center justify-center text-[10px] opacity-40" style={borderStyle()}>LOGO</div>}
            </div>
          )}
          {t.showCompanyName && <h2 className="font-black text-2xl uppercase">{t.companyName || "مطعم الشرق الأوسط"}</h2>}
          {t.headerText && <p className="text-sm mt-1 opacity-70">{t.headerText}</p>}
          {t.showOrderNumber && <p className="font-bold mt-2">رقم الطلب: <span className="text-lg">42</span></p>}
          {t.showOrderType && <p className="text-2xl font-black mt-1">صالة / طاولة</p>}
          {(t.showDate || t.showTime) && <p className="text-sm opacity-60 mt-1">{t.showDate && t.showTime ? "27 مارس 2026 — 3:28 م" : t.showDate ? "27 مارس 2026" : "3:28 م"}</p>}
        </div>
        {infoRows}
        {t.showNotes && <div className="mb-4 text-sm border-b-2 border-double pb-3 space-y-1" style={borderStyle({ borderBottomWidth: "3px", borderBottomStyle: "double" })}><p className="font-bold">ملاحظات:</p><p className="opacity-70">بدون بصل — ثلج إضافي</p></div>}
        {t.showItemsTable && itemsBlockList}
        {totalsBlock}
        {footerBlock}
      </div>
    );
  }

  /* ─── compact style ─── */
  if (s === "compact") {
    return (
      <div className="w-full max-w-[320px] mx-auto bg-white text-black p-4" style={{ fontSize: `${Math.max(fz - 2, 8)}px`, fontWeight: fw }}>
        <div className="text-center border-b pb-2 mb-2" style={borderStyle()}>
          {t.showCompanyName && <p className="font-black">{t.companyName || "مطعم الشرق الأوسط"}</p>}
          {t.showOrderNumber && <p className="font-bold">#{42}</p>}
          {(t.showDate || t.showTime) && <p className="text-xs opacity-60">{t.showDate && t.showTime ? "27/3/2026 3:28م" : t.showDate ? "27/3/2026" : "3:28م"}</p>}
        </div>
        {t.showItemsTable && (
          <div className="space-y-1 mb-2">
            {sampleItems.map((item, i) => (
              <div key={i} className="flex justify-between">
                <span className="opacity-80">{item.name} x{item.qty}</span>
                {t.showItemPrices && <span>{Number(item.price * item.qty || 0).toLocaleString()}</span>}
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-between font-bold pt-1 border-t" style={borderStyle()}>
          <span>الإجمالي</span><span>{grandTotal} {cur}</span>
        </div>
        {t.showPaymentMethod && <p className="text-center text-xs mt-1 opacity-50">كاش</p>}
      </div>
    );
  }

  /* ─── elegant style ─── */
  if (s === "elegant") {
    return (
      <div className="w-full max-w-[320px] mx-auto bg-white text-black rounded-3xl overflow-hidden shadow-2xl" style={{ border: `2px solid ${border}`, fontSize: `${fz}px`, fontWeight: fw }}>
        <div className="text-center p-6 text-white" style={{ background: `linear-gradient(135deg, ${hBg}, ${hBg}dd)` }}>
          {t.showLogo && (
            <div className="flex justify-center mb-2">
              {t.logoUrl ? <img src={t.logoUrl} alt="" className="w-14 h-14 object-contain rounded-2xl" referrerPolicy="no-referrer" />
                : <div className="w-14 h-14 border-2 border-white/30 rounded-2xl flex items-center justify-center text-[10px] opacity-50">LOGO</div>}
            </div>
          )}
          {t.showCompanyName && <h2 className="font-black text-2xl">{t.companyName || "مطعم الشرق الأوسط"}</h2>}
          {t.showOrderNumber && <p className="mt-1 bg-white/20 inline-block px-4 py-1 rounded-full text-sm font-bold">#42</p>}
          {t.showOrderType && <p className="text-xl font-black mt-2">صالة</p>}
          {(t.showDate || t.showTime) && <p className="text-xs opacity-60 mt-1">{t.showDate && t.showTime ? "27 مارس 2026 — 3:28 م" : ""}</p>}
        </div>
        <div className="p-6 space-y-4">
          {(t.showCashier || t.showCustomer || t.showTable) && (
            <div className="space-y-1 text-sm border-b pb-3" style={borderStyle()}>
              {t.showCashier && <div className="flex justify-between"><span className="opacity-50">الكاشير</span><span>أحمد محمد</span></div>}
              {t.showTable && <div className="flex justify-between"><span className="opacity-50">الطاولة</span><span>7</span></div>}
              {t.showCustomer && <div className="flex justify-between"><span className="opacity-50">العميل</span><span className="font-bold">فاروق السيد</span></div>}
              {t.showDeliveryAddress && <div className="flex justify-between"><span className="opacity-50">العنوان</span><span>15 شارع الثورة</span></div>}
            </div>
          )}
          {t.showItemsTable && (
            <div>
              {sampleItems.map((item, i) => (
                <div key={i} className="flex justify-between text-sm py-1.5 border-b" style={borderStyle({ borderBottomStyle: "dotted" })}>
                  <span className="opacity-80">{item.name}{item.variant ? ` (${item.variant})` : ""} x{item.qty}</span>
                  {t.showItemPrices && <span className="font-medium">{Number(item.price * item.qty || 0).toLocaleString()} {cur}</span>}
                </div>
              ))}
            </div>
          )}
          {t.showNotes && <div className="text-sm italic opacity-50 border-b pb-3" style={borderStyle()}>ملاحظات: بدون بصل — ثلج إضافي</div>}
          {(t.showSubtotal || t.showTax || t.showServiceCharge || t.showDiscount || t.showDeliveryFee) && (
            <div className="space-y-1 text-sm opacity-70">
              {t.showSubtotal && <div className="flex justify-between"><span>المجموع</span><span>{itemsTotal} {cur}</span></div>}
              {t.showTax && <div className="flex justify-between"><span>الضريبة 14%</span><span>{taxVal} {cur}</span></div>}
              {t.showServiceCharge && <div className="flex justify-between"><span>الخدمة</span><span>{serviceVal} {cur}</span></div>}
              {t.showDiscount && <div className="flex justify-between text-rose-600"><span>الخصم</span><span>-{discountVal} {cur}</span></div>}
              {t.showDeliveryFee && <div className="flex justify-between"><span>التوصيل</span><span>{deliveryVal} {cur}</span></div>}
            </div>
          )}
          {t.showGrandTotal && (
            <div className="flex justify-between font-black text-xl pt-3 mt-2 border-t-2" style={borderStyle()}>
              <span>الإجمالي النهائي</span><span style={{ color: hBg }}>{grandTotal} {cur}</span>
            </div>
          )}
          {t.showPaymentMethod && <p className="text-center font-bold mt-2 opacity-70">نقدي</p>}
          <div className="text-center text-sm italic opacity-40 border-t pt-3 space-y-1" style={borderStyle()}>
            {t.footerText && <p>{t.footerText}</p>}
            {t.hotline && <p className="font-bold not-italic">الخط الساخن: {t.hotline}</p>}
          </div>
        </div>
      </div>
    );
  }

  /* ─── minimal + standard fallback ─── */
  return (
    <div className="w-full max-w-[320px] mx-auto bg-white text-black p-8" style={{ fontSize: `${fz}px`, fontWeight: fw }}>
      <div className="text-center border-b-2 border-dashed pb-4 mb-4" style={borderStyle()}>
        {t.showLogo && (
          <div className="flex justify-center mb-2">
            {t.logoUrl ? <img src={t.logoUrl} alt="" className="w-14 h-14 object-contain" referrerPolicy="no-referrer" />
              : <div className="w-14 h-14 border-2 rounded-full flex items-center justify-center text-[10px] opacity-40" style={borderStyle()}>LOGO</div>}
          </div>
        )}
        {t.showCompanyName && <h2 className="font-black text-xl uppercase">{t.companyName || "مطعم الشرق الأوسط"}</h2>}
        {t.headerText && <p className="text-sm mt-1 opacity-70">{t.headerText}</p>}
        {t.showOrderNumber && <p className="font-bold mt-2">رقم الطلب: 42</p>}
        {t.showOrderType && <p className="text-2xl font-black mt-1">صالة / طاولة</p>}
        {(t.showDate || t.showTime) && <p className="text-sm opacity-60 mt-1">{t.showDate && t.showTime ? "27 مارس 2026 — 3:28 م" : t.showDate ? "27 مارس 2026" : "3:28 م"}</p>}
      </div>
      {infoRows}
      {t.showNotes && <div className="mb-4 text-sm border-b border-dashed pb-2 space-y-1" style={borderStyle()}><p className="font-bold">ملاحظات:</p><p className="opacity-70">بدون بصل — ثلج إضافي</p></div>}
      {t.showItemsTable && itemsBlockList}
      {totalsBlock}
      {footerBlock}
    </div>
  );
};

/* ─── Template Mini-Preview ─── */
const TemplateMiniPreview = ({ template }: { template: POSInvoiceTemplate }) => {
  const s = template.style;
  const border = template.borderColor;
  const headerBg = template.headerBgColor;
  const headerTxt = template.headerTextColor;
  if (s === "detailed-table") {
    return (
      <div className="w-full bg-white flex flex-col text-[3.5px] font-mono text-black border border-slate-200 overflow-hidden">
        <div className="text-center py-1.5 border-b" style={{ borderColor: border }}>
          <p className="font-bold text-[5px]">{template.companyName || "اسم الشركة"}</p>
          {template.showLogo && <div className="w-3 h-3 mx-auto my-0.5 border rounded-full flex items-center justify-center text-[2px]">LOGO</div>}
          <p className="font-bold text-[4px]">فاتورة</p>
          <p className="font-black text-[6px]">42</p>
        </div>
        <table className="w-full border-collapse border text-center">
          <tbody>
            <tr className="border-b" style={{ borderColor: border }}><td className="border-l p-0.5" style={{ borderColor: border }}>3/27</td><td className="p-0.5">3:28</td></tr>
            <tr className="border-b" style={{ borderColor: border }}><td className="border-l p-0.5 font-bold" style={{ borderColor: border }}>الكاشير</td><td className="p-0.5">أحمد</td></tr>
          </tbody>
        </table>
        <table className="w-full border-collapse text-center">
          <thead><tr className="font-bold border-b" style={{ borderColor: border, background: headerBg, color: headerTxt }}>
            <th className="border-l p-0.5" style={{ borderColor: border }}>إجمالي</th>
            <th className="border-l p-0.5" style={{ borderColor: border }}>سعر</th>
            <th className="border-l p-0.5" style={{ borderColor: border }}>الصنف</th>
            <th className="p-0.5">كمية</th>
          </tr></thead>
          <tbody>
            <tr className="border-b" style={{ borderColor: border }}><td className="border-l p-0.5" style={{ borderColor: border }}>160</td><td className="border-l p-0.5" style={{ borderColor: border }}>160</td><td className="border-l p-0.5" style={{ borderColor: border }}>سوبر بوكس</td><td className="p-0.5">1</td></tr>
            <tr className="font-bold" style={{ borderColor: border, background: headerBg, color: headerTxt }}><td colSpan={3} className="border-l p-0.5 text-right px-1" style={{ borderColor: border }}>الإجمالي</td><td className="p-0.5">622</td></tr>
          </tbody>
        </table>
      </div>
    );
  }
  if (s === "modern") {
    return (
      <div className="w-full bg-white flex flex-col text-[3.5px] font-mono text-black overflow-hidden border border-slate-100">
        <div className="text-center p-1.5" style={{ background: headerBg, color: headerTxt }}>
          <p className="font-bold text-[5px]">{template.companyName || "اسم الشركة"}</p>
          {template.showLogo && <div className="w-3 h-3 mx-auto my-0.5 border border-white/30 rounded-full flex items-center justify-center text-[2px]">LOGO</div>}
        </div>
        <div className="p-1.5 flex-1 flex flex-col">
          <div className="space-y-0.5">
            <div className="flex justify-between text-slate-400 border-b border-slate-100 pb-0.5"><span>الصنف</span><span>السعر</span></div>
            <div className="flex justify-between"><span>بيتزا x1</span><span>150</span></div>
            <div className="flex justify-between"><span>شاي x2</span><span>40</span></div>
          </div>
          <div className="border-t border-slate-100 pt-1 mt-auto flex justify-between font-bold"><span>الإجمالي</span><span>190</span></div>
        </div>
      </div>
    );
  }
  if (s === "classic") {
    return (
      <div className="w-full bg-white flex flex-col text-[3.5px] font-mono text-black border-2 border-double border-slate-200 p-1.5">
        <div className="text-center border-b-2 border-double border-slate-900 pb-1 mb-1">
          <p className="font-bold text-[5px]">{template.companyName || "اسم الشركة"}</p>
          {template.showLogo && <div className="w-3 h-3 mx-auto my-0.5 border-2 border-slate-900 rounded-full flex items-center justify-center text-[2px]">LOGO</div>}
        </div>
        <div className="space-y-0.5">
          <div className="flex justify-between"><span>بيتزا x1</span><span>150</span></div>
          <div className="flex justify-between"><span>شاي x2</span><span>40</span></div>
        </div>
        <div className="border-t-2 border-double border-slate-900 pt-1 flex justify-between font-bold"><span>الإجمالي</span><span>190</span></div>
        <p className="mt-1 text-center italic opacity-60">{template.footerText || "شكراً!"}</p>
      </div>
    );
  }
  if (s === "compact") {
    return (
      <div className="w-full bg-white flex flex-col text-[3px] font-mono text-black p-1">
        <div className="text-center border-b border-slate-200 pb-0.5 mb-0.5"><p className="font-bold text-[4px]">{template.companyName || "اسم الشركة"}</p></div>
        <div className="space-y-0.5">
          <div className="flex justify-between"><span>بيتزا x1</span><span>150</span></div>
          <div className="flex justify-between"><span>شاي x2</span><span>40</span></div>
          <div className="flex justify-between font-bold pt-0.5 border-t border-slate-100"><span>الإجمالي</span><span>190</span></div>
        </div>
      </div>
    );
  }
  if (s === "elegant") {
    return (
      <div className="w-full bg-white flex flex-col text-[3.5px] font-mono text-black overflow-hidden border" style={{ borderColor: border }}>
        <div className="text-center p-1.5" style={{ background: headerBg, color: headerTxt }}>
          <p className="font-bold text-[5px]">{template.companyName || "اسم الشركة"}</p>
          {template.showLogo && <div className="w-3 h-3 mx-auto my-0.5 border border-white/30 rounded-full flex items-center justify-center text-[2px]">LOGO</div>}
        </div>
        <div className="p-1.5 space-y-0.5">
          <div className="flex justify-between"><span>بيتزا x1</span><span>150</span></div>
          <div className="flex justify-between"><span>شاي x2</span><span>40</span></div>
          <div className="flex justify-between font-bold pt-0.5 border-t" style={{ borderColor: border }}><span>الإجمالي</span><span>190</span></div>
          {template.footerText && <p className="text-center italic opacity-50 mt-0.5">{template.footerText}</p>}
        </div>
      </div>
    );
  }
  /* minimal + standard fallback */
  return (
    <div className="w-full bg-white flex flex-col text-[3.5px] font-mono text-black p-1.5">
      <div className="text-center border-b border-dashed pb-1 mb-1" style={{ borderColor: border }}>
        <p className="font-bold text-[5px]">{template.companyName || "اسم الشركة"}</p>
        {template.showLogo && <div className="w-3 h-3 mx-auto my-0.5 border rounded-full flex items-center justify-center text-[2px]">LOGO</div>}
        {template.headerText && <p className="opacity-70">{template.headerText}</p>}
      </div>
      <div className="space-y-0.5 mb-1">
        <div className="flex justify-between"><span>بيتزا x1</span><span>150</span></div>
        <div className="flex justify-between"><span>شاي x2</span><span>40</span></div>
      </div>
      <div className="border-t border-dashed pt-1 flex justify-between font-bold" style={{ borderColor: border }}><span>الإجمالي</span><span>190</span></div>
      {template.footerText && <p className="mt-1 text-center italic opacity-60">{template.footerText}</p>}
    </div>
  );
};

/* ─── Template Editor Modal ─── */
const InvoiceTemplateEditor = ({
  template,
  onSave,
  onDelete,
  onClose
}: {
  template: POSInvoiceTemplate;
  onSave: (t: POSInvoiceTemplate) => void;
  onDelete?: () => void;
  onClose: () => void;
}) => {
  const [draft, setDraft] = useState<POSInvoiceTemplate>({ ...template });

  const set = <K extends keyof POSInvoiceTemplate>(key: K, val: POSInvoiceTemplate[K]) => {
    setDraft((prev) => ({ ...prev, [key]: val }));
  };

  const toggleBool = (key: keyof POSInvoiceTemplate) => {
    setDraft((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { alert("حجم الصورة يجب ألا يتجاوز 2 ميجابايت"); return; }
      const reader = new FileReader();
      reader.onloadend = () => set("logoUrl", reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const elementGroups = [
    { title: "الرأس والترويسة", items: [
      { key: "showLogo" as const, label: "شعار الشركة" },
      { key: "showCompanyName" as const, label: "اسم الشركة" },
      { key: "showDate" as const, label: "التاريخ" },
      { key: "showTime" as const, label: "الوقت" },
      { key: "showOrderNumber" as const, label: "رقم الطلب" },
      { key: "showOrderType" as const, label: "نوع الطلب" },
    ]},
    { title: "بيانات الطلب", items: [
      { key: "showCashier" as const, label: "اسم الكاشير" },
      { key: "showCustomer" as const, label: "بيانات العميل" },
      { key: "showTable" as const, label: "رقم الطاولة" },
      { key: "showDeliveryAddress" as const, label: "عنوان التوصيل" },
    ]},
    { title: "الأصناف والأسعار", items: [
      { key: "showItemsTable" as const, label: "جدول الأصناف" },
      { key: "showItemPrices" as const, label: "أسعار الأصناف" },
      { key: "showNotes" as const, label: "ملاحظات الطلب" },
    ]},
    { title: "الإجماليات", items: [
      { key: "showSubtotal" as const, label: "المجموع الفرعي" },
      { key: "showTax" as const, label: "قيمة الضريبة" },
      { key: "showDiscount" as const, label: "قيمة الخصم" },
      { key: "showDeliveryFee" as const, label: "رسوم التوصيل" },
      { key: "showServiceCharge" as const, label: "رسوم الخدمة" },
      { key: "showGrandTotal" as const, label: "الإجمالي النهائي" },
      { key: "showPaymentMethod" as const, label: "طريقة الدفع" },
    ]},
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#f4f7fa] rounded-3xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col"
        dir="rtl"
      >
        {/* Header */}
        <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center"><Pencil className="w-5 h-5" /></div>
            <div>
              <h2 className="font-black text-lg text-slate-900">{template.isBuiltIn ? "تعديل القالب" : "محرر القالب"}</h2>
              <p className="text-xs text-slate-500">تحكم كامل في كل عنصر يظهر على الرسيبت</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Editor Controls */}
            <div className="lg:col-span-2 space-y-5">
              {/* Basic Info */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <h3 className="font-black text-sm text-slate-800 mb-4 flex items-center gap-2"><FileText className="w-4 h-4 text-blue-600" /> معلومات القالب</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="block text-xs font-black text-slate-500 mb-1.5">اسم القالب</span>
                    <input value={draft.name ?? ""} onChange={(e) => set("name", e.target.value)} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-bold" />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-black text-slate-500 mb-1.5">نمط التصميم</span>
                    <select value={draft.style ?? ""} onChange={(e) => set("style", e.target.value as POSInvoiceTemplateStyle)} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-bold">
                      {(Object.keys(POS_INVOICE_STYLE_LABELS) as POSInvoiceTemplateStyle[]).map((st) => (
                        <option key={st} value={st}>{POS_INVOICE_STYLE_LABELS[st].label} — {POS_INVOICE_STYLE_LABELS[st].description}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              {/* Branding */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <h3 className="font-black text-sm text-slate-800 mb-4 flex items-center gap-2"><ImagePlus className="w-4 h-4 text-blue-600" /> الهوية والعلامة التجارية</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50 shrink-0">
                      {draft.logoUrl ? <img src={draft.logoUrl} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" /> : <ImagePlus className="w-6 h-6 text-slate-300" />}
                    </div>
                    <div className="flex-1 space-y-3">
                      <label className="block">
                        <span className="block text-xs font-bold text-slate-500 mb-1">رفع الشعار (PNG/JPG)</span>
                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="w-full text-xs" />
                      </label>
                      {draft.logoUrl && (
                        <button onClick={() => set("logoUrl", "")} className="text-xs text-red-500 font-bold hover:underline">حذف الشعار</button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="block">
                      <span className="block text-xs font-black text-slate-500 mb-1.5">اسم الشركة / الفرع</span>
                      <input value={draft.companyName ?? ""} onChange={(e) => set("companyName", e.target.value)} placeholder="مثال: مطعم الشرق الأوسط" className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-bold" />
                    </label>
                    <label className="block">
                      <span className="block text-xs font-black text-slate-500 mb-1.5">الخط الساخن</span>
                      <input value={draft.hotline ?? ""} onChange={(e) => set("hotline", e.target.value)} placeholder="مثال: 17533" className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-bold" />
                    </label>
                  </div>
                  <label className="block">
                    <span className="block text-xs font-black text-slate-500 mb-1.5">نص الترويسة (يظهر تحت اسم الشركة)</span>
                    <input value={draft.headerText ?? ""} onChange={(e) => set("headerText", e.target.value)} placeholder="مثال: فاتورة ضريبية مبسطة" className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-bold" />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-black text-slate-500 mb-1.5">نص الذيل (يظهر أسفل الفاتورة)</span>
                    <textarea value={draft.footerText ?? ""} onChange={(e) => set("footerText", e.target.value)} placeholder="مثال: شكراً لزيارتكم!" rows={2} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-bold resize-none" />
                  </label>
                </div>
              </div>

              {/* Element Visibility */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <h3 className="font-black text-sm text-slate-800 mb-4 flex items-center gap-2"><Eye className="w-4 h-4 text-blue-600" /> عناصر الرسيبت — إظهار أو إخفاء</h3>
                <div className="space-y-5">
                  {elementGroups.map((group) => (
                    <div key={group.title}>
                      <p className="text-xs font-black text-slate-500 mb-2">{group.title}</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {group.items.map((item) => (
                          <label key={item.key} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/50 p-2.5 cursor-pointer hover:border-blue-200 transition-colors">
                            <input type="checkbox" checked={draft[item.key] as boolean} onChange={() => toggleBool(item.key)} className="h-4 w-4 accent-blue-600" />
                            <span className="text-xs font-bold text-slate-700">{item.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Typography & Colors */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <h3 className="font-black text-sm text-slate-800 mb-4 flex items-center gap-2"><Palette className="w-4 h-4 text-blue-600" /> الخط والألوان</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <label className="block">
                    <span className="block text-xs font-black text-slate-500 mb-1.5">حجم الخط</span>
                    <div className="flex items-center gap-2">
                      <input type="range" min={8} max={20} value={draft.fontSize ?? ""} onChange={(e) => set("fontSize", Number(e.target.value))} className="flex-1" />
                      <span className="text-xs font-black text-blue-600 w-6 text-center">{draft.fontSize}</span>
                    </div>
                  </label>
                  <label className="block">
                    <span className="block text-xs font-black text-slate-500 mb-1.5">سمك الخط</span>
                    <select value={draft.fontWeight ?? ""} onChange={(e) => set("fontWeight", Number(e.target.value))} className="w-full border border-slate-200 rounded-xl p-2 text-xs font-bold">
                      <option value={300}>خفيف (300)</option>
                      <option value={400}>عادي (400)</option>
                      <option value={600}>نصف ثقيل (600)</option>
                      <option value={700}>ثقيل (700)</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-xs font-black text-slate-500 mb-1.5">لون الرأس</span>
                    <div className="flex items-center gap-2">
                      <input type="color" value={draft.headerBgColor ?? ""} onChange={(e) => set("headerBgColor", e.target.value)} className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer" />
                      <span className="text-[10px] font-mono text-slate-400">{draft.headerBgColor}</span>
                    </div>
                  </label>
                  <label className="block">
                    <span className="block text-xs font-black text-slate-500 mb-1.5">لون الحدود</span>
                    <div className="flex items-center gap-2">
                      <input type="color" value={draft.borderColor ?? ""} onChange={(e) => set("borderColor", e.target.value)} className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer" />
                      <span className="text-[10px] font-mono text-slate-400">{draft.borderColor}</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Right: Live Preview */}
            <div className="space-y-4">
              <div className="sticky top-0">
                <div className="bg-white rounded-2xl border border-slate-100 p-4">
                  <h3 className="font-black text-sm text-slate-800 mb-3 flex items-center gap-2"><Eye className="w-4 h-4 text-emerald-600" /> معاينة حية</h3>
                  <div className="w-full mx-auto bg-white shadow-lg rounded-xl overflow-hidden" style={{ maxWidth: "260px" }}>
                    <TemplateMiniPreview template={draft} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-slate-100 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            {!template.isBuiltIn && onDelete && (
              <button onClick={onDelete} className="px-4 py-2.5 rounded-xl bg-red-50 text-red-600 font-bold text-sm hover:bg-red-100 flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> حذف القالب
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-300">إلغاء</button>
            <button onClick={() => onSave(draft)} className="px-6 py-2.5 rounded-xl bg-blue-700 text-white font-black text-sm hover:bg-blue-800 shadow-sm flex items-center gap-2">
              <Save className="w-4 h-4" /> حفظ القالب
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

/* ─── POS Screen Design Mini-Preview ─── */
const ScreenDesignMiniPreview = ({ design }: { design: POSScreenDesignPreset }) => {
  const isNeo = design.style === "neobrutalist";
  const isDark = design.style === "dark-emerald";
  const isRoyal = design.style === "royal-luxury";
  const isCafe = design.style === "cafe-warm";

  const bgMain = isDark ? "bg-slate-900" : isCafe ? "bg-[#fdf8f5]" : isRoyal ? "bg-[#faf7fc]" : "bg-slate-100";
  const cardBg = isDark ? "bg-slate-800 border-emerald-500/30 text-white" : isNeo ? "bg-white border-2 border-black shadow-[2px_2px_0px_#000]" : "bg-white border-slate-200";
  const radius = design.cardRadius === "sharp" || isNeo ? "rounded-none" : design.cardRadius === "pill" ? "rounded-2xl" : "rounded-lg";

  const cartPanel = (
    <div
      className={`w-[32%] h-full flex flex-col justify-between p-1.5 ${
        isDark ? "bg-slate-950 border-emerald-800/40 text-white" : isNeo ? "bg-white border-black border-2" : "bg-white border-slate-200 border"
      }`}
    >
      <div className="space-y-1">
        <div className="h-2 rounded-sm opacity-80" style={{ backgroundColor: design.primaryColor }} />
        <div className={`h-2 ${isDark ? "bg-slate-800" : "bg-slate-100"} rounded-sm`} />
        <div className={`h-2 ${isDark ? "bg-slate-800" : "bg-slate-100"} rounded-sm`} />
      </div>
      <div
        className={`h-3.5 w-full flex items-center justify-center text-[5px] font-black ${
          isNeo ? "border border-black text-black" : "text-white rounded-sm"
        }`}
        style={{ backgroundColor: isNeo ? design.accentColor : design.primaryColor }}
      >
        دفع 240.00
      </div>
    </div>
  );

  const sidebarCats = design.categoriesPosition === "sidebar" && (
    <div
      className="w-[20%] h-full p-1 flex flex-col gap-1"
      style={{ backgroundColor: design.primaryColor }}
    >
      <div className="h-2 bg-white/30 rounded-sm" />
      <div className="h-2 bg-white/15 rounded-sm" />
      <div className="h-2 bg-white/15 rounded-sm" />
      <div className="h-2 bg-white/15 rounded-sm" />
    </div>
  );

  return (
    <div className={`w-full h-32 ${bgMain} rounded-xl overflow-hidden border border-slate-200 flex flex-col select-none`}>
      {/* Top Header */}
      <div
        className={`h-4 px-2 flex items-center justify-between ${
          isNeo ? "bg-white border-b-2 border-black" : isDark ? "bg-slate-950 border-b border-emerald-900/50" : "bg-white border-b border-slate-200"
        }`}
      >
        <div className="flex items-center gap-1">
          <div className="w-4 h-2 rounded-xs" style={{ backgroundColor: design.primaryColor }} />
          <div className="w-6 h-1.5 bg-slate-300 rounded-xs" />
        </div>
        <div className="w-5 h-2 rounded-xs" style={{ backgroundColor: design.accentColor }} />
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {design.layoutPosition === "cart-right" && cartPanel}

        <div className="flex-1 p-1.5 flex flex-col gap-1 overflow-hidden">
          {design.categoriesPosition === "top-bar" && (
            <div className="flex gap-1 shrink-0">
              <div className="h-2.5 w-8 rounded-full" style={{ backgroundColor: design.primaryColor }} />
              <div className="h-2.5 w-8 bg-slate-300/70 rounded-full" />
              <div className="h-2.5 w-8 bg-slate-300/70 rounded-full" />
            </div>
          )}
          <div className={`grid ${design.productsPerRow >= 6 ? "grid-cols-4" : "grid-cols-3"} gap-1 flex-1`}>
            {Array.from({ length: design.productsPerRow >= 6 ? 8 : 6 }).map((_, idx) => (
              <div key={idx} className={`border p-1 flex flex-col justify-between ${cardBg} ${radius}`}>
                {design.showImages && (
                  <div className={`flex-1 rounded-xs mb-0.5 ${isDark ? "bg-slate-700" : "bg-slate-100"}`} />
                )}
                <div className="flex items-center justify-between gap-0.5">
                  <div className={`h-1 flex-1 rounded-xs ${isDark ? "bg-slate-500" : "bg-slate-300"}`} />
                  <div className="h-1.5 w-2.5 rounded-xs" style={{ backgroundColor: design.accentColor }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {design.layoutPosition === "cart-left" && cartPanel}
        {sidebarCats}
      </div>
    </div>
  );
};

/* ─── POS Screen Design Editor Modal ─── */
const ScreenDesignEditor = ({
  design,
  onSave,
  onDelete,
  onClose
}: {
  design: POSScreenDesignPreset;
  onSave: (d: POSScreenDesignPreset) => void;
  onDelete?: () => void;
  onClose: () => void;
}) => {
  const [draft, setDraft] = useState<POSScreenDesignPreset>({ ...design });

  const set = <K extends keyof POSScreenDesignPreset>(key: K, val: POSScreenDesignPreset[K]) => {
    setDraft((prev) => ({ ...prev, [key]: val }));
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#f4f7fa] rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col"
        dir="rtl"
      >
        <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-lg text-slate-900">تخصيص ديزاين شاشة نقطة البيع</h2>
              <p className="text-xs text-slate-500">تحكم في الألوان، تخطيط السلة، موقع الأقسام، وكثافة البطاقات</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <span className="block text-xs font-black text-slate-500 mb-2">معاينة تخطيط الشاشة</span>
            <ScreenDesignMiniPreview design={draft} />
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-xs font-black text-slate-500 mb-1.5">اسم الديزاين</span>
              <input
                value={draft.name ?? ""}
                onChange={(e) => set("name", e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-bold"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-black text-slate-500 mb-1.5">الشارة (Badge)</span>
              <input
                value={draft.badge ?? ""}
                onChange={(e) => set("badge", e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-bold"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="block text-xs font-black text-slate-500 mb-1.5">الوصف</span>
              <input
                value={draft.description ?? ""}
                onChange={(e) => set("description", e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-bold"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-black text-slate-500 mb-1.5">النمط البصري الأساسي</span>
              <select
                value={draft.style}
                onChange={(e) => set("style", e.target.value as POSScreenDesignStyle)}
                className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-bold"
              >
                {(Object.keys(POS_SCREEN_DESIGN_STYLE_LABELS) as POSScreenDesignStyle[]).map((st) => (
                  <option key={st} value={st}>{POS_SCREEN_DESIGN_STYLE_LABELS[st].label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-black text-slate-500 mb-1.5">موقع سلة المشتريات</span>
              <select
                value={draft.layoutPosition}
                onChange={(e) => set("layoutPosition", e.target.value as POSScreenLayoutPosition)}
                className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-bold"
              >
                <option value="cart-right">السلة يمين الشاشة</option>
                <option value="cart-left">السلة يسار الشاشة</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-black text-slate-500 mb-1.5">موقع شريط الأقسام</span>
              <select
                value={draft.categoriesPosition}
                onChange={(e) => set("categoriesPosition", e.target.value as POSCategoriesPosition)}
                className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-bold"
              >
                <option value="sidebar">قائمة جانبية</option>
                <option value="top-bar">شريط أفقي علوي</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-black text-slate-500 mb-1.5">حواف بطاقات الأصناف</span>
              <select
                value={draft.cardRadius}
                onChange={(e) => set("cardRadius", e.target.value as "rounded" | "sharp" | "pill")}
                className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-bold"
              >
                <option value="rounded">حواف ناعمة (Rounded)</option>
                <option value="sharp">حواف حادة (Sharp)</option>
                <option value="pill">حواف دائرية بارزة (Pill)</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-black text-slate-500 mb-1.5">اللون الرئيسي (Primary)</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={draft.primaryColor}
                  onChange={(e) => set("primaryColor", e.target.value)}
                  className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer"
                />
                <span className="text-xs font-mono text-slate-500">{draft.primaryColor}</span>
              </div>
            </label>
            <label className="block">
              <span className="block text-xs font-black text-slate-500 mb-1.5">لون التمييز والأزرار (Accent)</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={draft.accentColor}
                  onChange={(e) => set("accentColor", e.target.value)}
                  className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer"
                />
                <span className="text-xs font-mono text-slate-500">{draft.accentColor}</span>
              </div>
            </label>
            <label className="block">
              <span className="block text-xs font-black text-slate-500 mb-1.5">عدد المنتجات في الصف</span>
              <input
                type="number"
                min={2}
                max={8}
                value={draft.productsPerRow}
                onChange={(e) => set("productsPerRow", Number(e.target.value) || 5)}
                className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-bold"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-black text-slate-500 mb-1.5">طريقة العرض الافتراضية</span>
              <select
                value={draft.defaultView}
                onChange={(e) => set("defaultView", e.target.value as "grid" | "list")}
                className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-bold"
              >
                <option value="grid">شبكي (بطاقات)</option>
                <option value="list">قائمة جدولية سريعة</option>
              </select>
            </label>
          </div>
        </div>

        <div className="bg-white border-t border-slate-100 px-6 py-4 flex items-center justify-between">
          <div>
            {!design.isBuiltIn && onDelete && (
              <button onClick={onDelete} className="px-4 py-2.5 rounded-xl bg-red-50 text-red-600 font-bold text-sm hover:bg-red-100 flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> حذف الديزاين
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-300">إلغاء</button>
            <button onClick={() => onSave(draft)} className="px-6 py-2.5 rounded-xl bg-blue-700 text-white font-black text-sm hover:bg-blue-800 shadow-sm flex items-center gap-2">
              <Save className="w-4 h-4" /> حفظ وتطبيق الديزاين
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export const POSSettings: React.FC<POSSettingsProps> = ({ onBack }) => {
  const [config, setConfig] = useState<POSConfiguration>(DEFAULT_POS_CONFIGURATION);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [newCustomMethod, setNewCustomMethod] = useState({ key: "", label: "", en: "" });
  const [editingTemplate, setEditingTemplate] = useState<POSInvoiceTemplate | null>(null);
  const [editingScreenDesign, setEditingScreenDesign] = useState<POSScreenDesignPreset | null>(null);
  const [templateTab, setTemplateTab] = useState<"customer" | "internal">("customer");

  useEffect(() => {
    api.get(`/api/settings/${POS_SETTINGS_KEY}`)
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data) => {
        const parsed = parsePOSConfiguration(data?.value);
        setConfig(parsed);
      })
      .catch(() => {
        const cached = localStorage.getItem(POS_SETTINGS_KEY);
        setConfig(parsePOSConfiguration(cached));
      });
  }, []);

  const updateConfig = (patch: Partial<POSConfiguration>) => {
    setConfig((prev) => normalizePOSConfiguration({
      ...prev,
      ...patch,
      screen: { ...prev.screen, ...(patch.screen || {}) },
      salesFlow: { ...prev.salesFlow, ...(patch.salesFlow || {}) },
      pricing: { ...prev.pricing, ...(patch.pricing || {}) },
      payments: { ...prev.payments, ...(patch.payments || {}) },
      restaurant: { ...prev.restaurant, ...(patch.restaurant || {}) },
      supermarket: { ...prev.supermarket, ...(patch.supermarket || {}) },
      clothing: { ...prev.clothing, ...(patch.clothing || {}) },
      reports: { ...prev.reports, ...(patch.reports || {}) }
    }));
  };

  const toggleLinkedModule = (modId: POSLinkedModule) => {
    const current = config.linkedModules || [];
    const next = current.includes(modId)
      ? current.filter((m) => m !== modId)
      : [...current, modId];
    updateConfig({ linkedModules: next } as any);
  };

  const setProfile = (profile: POSBusinessProfile) => {
    setConfig(createProfileConfiguration(profile));
    setStatus("idle");
  };

  const toggleOrderType = (type: POSOrderType) => {
    const current = config.salesFlow.enabledOrderTypes;
    const next = current.includes(type)
      ? current.filter((item) => item !== type)
      : [...current, type];

    if (next.length === 0) return;

    updateConfig({
      salesFlow: {
        ...config.salesFlow,
        enabledOrderTypes: next,
        defaultOrderType: next.includes(config.salesFlow.defaultOrderType) ? config.salesFlow.defaultOrderType : next[0]
      }
    });
  };

  const togglePaymentMethod = (method: POSPaymentMethod) => {
    const current = config.payments.enabledMethods;
    const next = current.includes(method)
      ? current.filter((item) => item !== method)
      : [...current, method];

    if (next.length === 0) return;

    updateConfig({
      payments: {
        ...config.payments,
        enabledMethods: next,
        defaultMethod: next.includes(config.payments.defaultMethod) ? config.payments.defaultMethod : next[0]
      }
    });
  };

  const addCustomMethod = () => {
    if (!newCustomMethod.key || !newCustomMethod.label) return;
    const existing = (config.payments.customMethods || []).find(m => m.key === newCustomMethod.key);
    if (existing) { alert("هذا المفتاح موجود بالفعل"); return; }
    const customMethods = [...(config.payments.customMethods || []), { ...newCustomMethod }];
    const enabledMethods = [...config.payments.enabledMethods, newCustomMethod.key as POSPaymentMethod];
    updateConfig({ payments: { ...config.payments, customMethods, enabledMethods } });
    setNewCustomMethod({ key: "", label: "", en: "" });
  };

  const removeCustomMethod = (key: string) => {
    const customMethods = (config.payments.customMethods || []).filter(m => m.key !== key);
    const enabledMethods = config.payments.enabledMethods.filter(m => m !== key);
    updateConfig({ payments: { ...config.payments, customMethods, enabledMethods } });
  };

  const allTemplates = useMemo(() => [
    ...POS_BUILT_IN_TEMPLATES,
    ...config.invoiceTemplates.customTemplates
  ], [config.invoiceTemplates.customTemplates]);

  const activeCustomerId = config.invoiceTemplates.customerTemplateId;
  const activeInternalId = config.invoiceTemplates.internalTemplateId;

  const getTemplateById = (id: string) => allTemplates.find(t => t.id === id) || POS_BUILT_IN_TEMPLATES[0];

  const handleSelectTemplate = (templateId: string) => {
    if (templateTab === "customer") {
      updateConfig({ invoiceTemplates: { ...config.invoiceTemplates, customerTemplateId: templateId } } as any);
    } else {
      updateConfig({ invoiceTemplates: { ...config.invoiceTemplates, internalTemplateId: templateId } } as any);
    }
  };

  const handleCreateTemplate = () => {
    const newTpl = createDefaultCustomTemplate();
    setEditingTemplate(newTpl);
  };

  const handleDuplicateTemplate = (src: POSInvoiceTemplate) => {
    const dup: POSInvoiceTemplate = {
      ...createDefaultCustomTemplate(),
      ...src,
      id: `custom_${Date.now()}`,
      name: `${src.name} (نسخة)`,
      isBuiltIn: false
    };
    setEditingTemplate(dup);
  };

  const handleSaveTemplate = (updated: POSInvoiceTemplate) => {
    if (updated.isBuiltIn) {
      // Built-in templates are edited but stored as overrides in customTemplates
      const override: POSInvoiceTemplate = { ...updated, id: `override_${updated.id}_${Date.now()}`, isBuiltIn: false };
      const customs = [...config.invoiceTemplates.customTemplates, override];
      updateConfig({ invoiceTemplates: { ...config.invoiceTemplates, customTemplates: customs } } as any);
    } else {
      const customs = config.invoiceTemplates.customTemplates.map(t => t.id === updated.id ? updated : t);
      updateConfig({ invoiceTemplates: { ...config.invoiceTemplates, customTemplates: customs } } as any);
    }
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = (templateId: string) => {
    const customs = config.invoiceTemplates.customTemplates.filter(t => t.id !== templateId);
    const invoiceTemplates = { ...config.invoiceTemplates, customTemplates: customs };
    if (invoiceTemplates.customerTemplateId === templateId) invoiceTemplates.customerTemplateId = "standard";
    if (invoiceTemplates.internalTemplateId === templateId) invoiceTemplates.internalTemplateId = "detailed-table";
    updateConfig({ invoiceTemplates } as any);
    setEditingTemplate(null);
  };

  const activeTemplateId = templateTab === "customer" ? activeCustomerId : activeInternalId;

  const allScreenDesigns = useMemo(() => [
    ...POS_BUILT_IN_SCREEN_DESIGNS,
    ...(config.screen.customDesigns || [])
  ], [config.screen.customDesigns]);

  const activeScreenDesignId = config.screen.activeDesignId || "standard";
  const activeScreenDesign = useMemo(
    () => allScreenDesigns.find((d) => d.id === activeScreenDesignId) || POS_BUILT_IN_SCREEN_DESIGNS[0],
    [allScreenDesigns, activeScreenDesignId]
  );

  const handleSelectScreenDesign = (design: POSScreenDesignPreset) => {
    updateConfig({
      screen: {
        ...config.screen,
        activeDesignId: design.id,
        defaultView: design.defaultView,
        showImages: design.showImages,
        productsPerRow: design.productsPerRow,
        compactCart: design.compactCart,
        showCategorySidebar: design.categoriesPosition === "sidebar"
      }
    });
    localStorage.setItem("pos_theme", design.style);
    localStorage.setItem("pos_design_id", design.id);
    setStatus("idle");
  };

  const handleCreateScreenDesign = () => {
    setEditingScreenDesign(createDefaultCustomScreenDesign());
  };

  const handleDuplicateScreenDesign = (src: POSScreenDesignPreset) => {
    setEditingScreenDesign({
      ...src,
      id: `design_${Date.now()}`,
      name: `${src.name} (مخصص)`,
      isBuiltIn: false
    });
  };

  const handleSaveScreenDesign = (updated: POSScreenDesignPreset) => {
    const existingCustoms = config.screen.customDesigns || [];
    let nextCustoms: POSScreenDesignPreset[];
    let nextActiveId = updated.id;

    if (updated.isBuiltIn) {
      const customCopy: POSScreenDesignPreset = {
        ...updated,
        id: `design_${updated.id}_${Date.now()}`,
        name: `${updated.name} (معدل)`,
        isBuiltIn: false
      };
      nextCustoms = [...existingCustoms, customCopy];
      nextActiveId = customCopy.id;
    } else if (existingCustoms.some((d) => d.id === updated.id)) {
      nextCustoms = existingCustoms.map((d) => (d.id === updated.id ? updated : d));
    } else {
      nextCustoms = [...existingCustoms, updated];
    }

    updateConfig({
      screen: {
        ...config.screen,
        activeDesignId: nextActiveId,
        customDesigns: nextCustoms,
        defaultView: updated.defaultView,
        showImages: updated.showImages,
        productsPerRow: updated.productsPerRow,
        compactCart: updated.compactCart,
        showCategorySidebar: updated.categoriesPosition === "sidebar"
      }
    });
    localStorage.setItem("pos_theme", updated.style);
    localStorage.setItem("pos_design_id", nextActiveId);
    setEditingScreenDesign(null);
  };

  const handleDeleteScreenDesign = (designId: string) => {
    const nextCustoms = (config.screen.customDesigns || []).filter((d) => d.id !== designId);
    const nextActiveId = config.screen.activeDesignId === designId ? "standard" : (config.screen.activeDesignId || "standard");
    updateConfig({
      screen: {
        ...config.screen,
        activeDesignId: nextActiveId,
        customDesigns: nextCustoms
      }
    });
    setEditingScreenDesign(null);
  };

  const handleSave = async () => {
    setLoading(true);
    setStatus("idle");
    const cleanConfig = normalizePOSConfiguration(config);
    try {
      localStorage.setItem(POS_SETTINGS_KEY, JSON.stringify(cleanConfig));
      const chosenDesign = [
        ...POS_BUILT_IN_SCREEN_DESIGNS,
        ...(cleanConfig.screen.customDesigns || [])
      ].find((d) => d.id === cleanConfig.screen.activeDesignId);
      if (chosenDesign) {
        localStorage.setItem("pos_theme", chosenDesign.style);
        localStorage.setItem("pos_design_id", chosenDesign.id);
      }
      const res = await api.post("/api/settings", {
        key: POS_SETTINGS_KEY,
        value: JSON.stringify(cleanConfig)
      });
      if (!res.ok) throw new Error("Failed to save POS settings");
      setConfig(cleanConfig);
      setStatus("saved");
      window.dispatchEvent(new CustomEvent("pos-settings-updated", { detail: cleanConfig }));
    } catch {
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  const enabledFeatureCount = useMemo(() => {
    const values = [
      ...Object.values(config.screen),
      ...Object.values(config.salesFlow),
      ...Object.values(config.restaurant),
      ...Object.values(config.supermarket),
      ...Object.values(config.clothing),
      ...Object.values(config.reports)
    ];
    return values.filter((value) => value === true).length;
  }, [config]);

  return (
    <div className="p-6 w-full min-h-screen bg-[#f4f7fa]" dir="rtl">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <MonitorCog className="w-8 h-8 text-blue-700" />
            إعدادات نقطة البيع الاحترافية
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            تحكم كامل في شاشة المبيعات، طرق الدفع، الضرائب، الفلاتر، الطباعة، وتجهيزات المطاعم والملابس والسوبر ماركت.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setConfig(DEFAULT_POS_CONFIGURATION)}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            الافتراضي
          </button>
          <button
            onClick={onBack}
            className="px-4 py-2.5 rounded-xl bg-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-300"
          >
            رجوع
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-blue-700 text-white font-black text-sm hover:bg-blue-800 flex items-center gap-2 disabled:opacity-50 shadow-sm"
          >
            <Save className="w-4 h-4" />
            {loading ? "جاري الحفظ..." : "حفظ وتطبيق"}
          </button>
        </div>
      </div>

      {status === "saved" && (
        <div className="mb-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          تم حفظ إعدادات نقطة البيع. افتح شاشة المبيعات وستعمل بالإعدادات الجديدة مباشرة.
        </div>
      )}
      {status === "error" && (
        <div className="mb-5 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 font-bold text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          تم حفظ نسخة محلية، لكن لم يتم الحفظ في قاعدة البيانات. تأكد من الاتصال ثم حاول مرة أخرى.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5 mb-6">
        <div className="xl:col-span-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {(Object.keys(POS_BUSINESS_PROFILES) as POSBusinessProfile[]).map((profile) => {
            const item = POS_BUSINESS_PROFILES[profile];
            const active = config.profile === profile;
            return (
              <motion.button
                key={profile}
                whileTap={{ scale: 0.98 }}
                onClick={() => setProfile(profile)}
                className={`p-5 rounded-3xl border-2 text-right transition-all bg-white ${
                  active
                    ? "border-blue-700 shadow-lg shadow-blue-900/10 ring-4 ring-blue-100"
                    : "border-slate-100 hover:border-blue-200 shadow-sm"
                }`}
              >
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-4 ${
                  active ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"
                }`}>
                  {profileIcons[profile]}
                </div>
                <div className="font-black text-slate-900">{item.label}</div>
                <div className="text-[11px] text-blue-700 font-black mt-1">{item.badge}</div>
                <p className="text-xs text-slate-500 mt-3 leading-relaxed">{item.description}</p>
              </motion.button>
            );
          })}
        </div>

        <div className="bg-slate-900 rounded-3xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-2 text-blue-200 font-bold text-sm mb-3">
            <ShieldCheck className="w-5 h-5" />
            ملخص التهيئة
          </div>
          <div className="space-y-4">
            <div>
              <span className="text-xs text-slate-400">الوضع الحالي</span>
              <div className="text-xl font-black">{POS_BUSINESS_PROFILES[config.profile].label}</div>
            </div>
            <div>
              <span className="text-xs text-slate-400">ديزاين الشاشة النشط</span>
              <div className="text-sm font-black text-emerald-400 mt-0.5">{activeScreenDesign.name}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/10 rounded-2xl p-3">
                <span className="text-[10px] text-slate-400 block">الخصائص المفعلة</span>
                <span className="text-2xl font-black">{enabledFeatureCount}</span>
              </div>
              <div className="bg-white/10 rounded-2xl p-3">
                <span className="text-[10px] text-slate-400 block">طرق الدفع</span>
                <span className="text-2xl font-black">{config.payments.enabledMethods.length}</span>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              هذه الإعدادات تتحكم في شاشة المبيعات بدون تعديل الكود، ويمكن تخصيصها لكل نشاط قبل التشغيل.
            </p>
          </div>
        </div>
      </div>

      {/* ─── معرض ديزاينات شاشة نقطة البيع ─── */}
      <div className="mb-6">
        <Section
          icon={<Palette className="w-5 h-5" />}
          title="ديزاينات وتصاميم شاشة نقطة البيع (POS Screen Designs)"
          description="اختر وفعل الديزاين المناسب لنقطة البيع من بين التصاميم الجاهزة، أو أنشئ ديزاين مخصص بألوانك وتوزيع العناصر المفضل لديك."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-4">
            {allScreenDesigns.map((design) => {
              const isActive = activeScreenDesign.id === design.id;
              return (
                <motion.div
                  key={design.id}
                  whileHover={{ y: -2 }}
                  onClick={() => handleSelectScreenDesign(design)}
                  className={`relative rounded-3xl border-2 p-4 text-right transition-all cursor-pointer bg-white group flex flex-col justify-between ${
                    isActive
                      ? "border-blue-600 shadow-lg shadow-blue-600/10 ring-4 ring-blue-100"
                      : "border-slate-100 hover:border-blue-200 shadow-sm"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10"
                          style={{ backgroundColor: design.primaryColor }}
                        />
                        <h3 className="font-black text-sm text-slate-900 truncate">{design.name}</h3>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                          {design.badge}
                        </span>
                      </div>
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-black shrink-0 shadow-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          مُفعّل
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectScreenDesign(design);
                          }}
                          className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white text-[10px] font-black transition-colors shrink-0"
                        >
                          تفعيل الديزاين
                        </button>
                      )}
                    </div>

                    <ScreenDesignMiniPreview design={design} />

                    <p className="text-xs text-slate-500 mt-3 leading-relaxed line-clamp-2">
                      {design.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
                      <span>{design.layoutPosition === "cart-right" ? "السلة يمين" : "السلة يسار"}</span>
                      <span>•</span>
                      <span>{design.categoriesPosition === "sidebar" ? "أقسام جانبية" : "أقسام علوية"}</span>
                      <span>•</span>
                      <span>{design.productsPerRow} أصناف/صف</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingScreenDesign(design);
                        }}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-colors"
                        title="تخصيص الديزاين"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicateScreenDesign(design);
                        }}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 transition-colors"
                        title="نسخ الديزاين"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white rounded-2xl border border-slate-100 p-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: activeScreenDesign.primaryColor }}
              >
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-black text-slate-800">
                  الديزاين الفعّال حالياً: <span className="text-blue-700">{activeScreenDesign.name}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  اضغط على "حفظ وتطبيق" بالأعلى لاعتماد الديزاين المختار في شاشة الكاشير ونقطة البيع الكول سنتر.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCreateScreenDesign}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-2 shrink-0 transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              إضافة ديزاين شاشة جديد
            </button>
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-5">
        <Section
          icon={<LayoutGrid className="w-5 h-5" />}
          title="شكل شاشة المبيعات"
          description="إظهار أو إخفاء العناصر الأساسية في واجهة الكاشير حسب طبيعة النشاط."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ToggleField title="صور المنتجات" description="مناسبة للمطاعم والملابس، ويمكن إيقافها للسوبر ماركت السريع." checked={config.screen.showImages} onChange={(v) => updateConfig({ screen: { ...config.screen, showImages: v } })} />
            <ToggleField title="قارئ الباركود" description="إظهار زر البحث بالباركود وإضافة الأصناف سريعاً." checked={config.screen.showBarcode} onChange={(v) => updateConfig({ screen: { ...config.screen, showBarcode: v } })} />
            <ToggleField title="اختيار العميل" description="إظهار اختيار أو إضافة عميل على الفاتورة." checked={config.screen.showCustomer} onChange={(v) => updateConfig({ screen: { ...config.screen, showCustomer: v } })} />
            <ToggleField title="قائمة الأقسام الجانبية" description="لوحة أقسام يمين الشاشة لتصفح المنتجات." checked={config.screen.showCategorySidebar} onChange={(v) => updateConfig({ screen: { ...config.screen, showCategorySidebar: v } })} />
            <ToggleField title="أزرار التحكم السريع" description="تعليق، استرجاع، مرتجع، طباعة." checked={config.screen.showQuickActions} onChange={(v) => updateConfig({ screen: { ...config.screen, showQuickActions: v } })} />
            <ToggleField title="فلتر البراند" description="مفيد للملابس والسوبر ماركت." checked={config.screen.showBrandFilter} onChange={(v) => updateConfig({ screen: { ...config.screen, showBrandFilter: v } })} />
            <ToggleField title="فلتر الوحدة" description="مفيد للكيلو، القطعة، العبوة، المقاسات." checked={config.screen.showUnitFilter} onChange={(v) => updateConfig({ screen: { ...config.screen, showUnitFilter: v } })} />
            <ToggleField title="لوحة الأرقام" description="تعديل كمية أو مبلغ مدفوع بسرعة من الكاشير." checked={config.screen.showNumpad} onChange={(v) => updateConfig({ screen: { ...config.screen, showNumpad: v } })} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <label className="bg-white rounded-2xl border border-slate-100 p-4">
              <span className="block text-xs font-black text-slate-500 mb-2">العرض الافتراضي</span>
              <select
                value={config.screen.defaultView ?? ""}
                onChange={(e) => updateConfig({ screen: { ...config.screen, defaultView: e.target.value as "grid" | "list" } })}
                className="w-full border border-slate-200 rounded-xl p-2 text-sm font-bold"
              >
                <option value="grid">شبكي</option>
                <option value="list">قائمة سريعة</option>
              </select>
            </label>
            <label className="bg-white rounded-2xl border border-slate-100 p-4">
              <span className="block text-xs font-black text-slate-500 mb-2">عدد كروت المنتجات في الصف</span>
              <input
                type="number"
                min={2}
                max={8}
                value={config.screen.productsPerRow ?? ""}
                onChange={(e) => updateConfig({ screen: { ...config.screen, productsPerRow: Number(e.target.value) || 5 } })}
                className="w-full border border-slate-200 rounded-xl p-2 text-sm font-bold"
              />
            </label>
            <ToggleField title="سلة مدمجة" description="تقليل المسافات داخل السلة للشاشات الصغيرة." checked={config.screen.compactCart} onChange={(v) => updateConfig({ screen: { ...config.screen, compactCart: v } })} />
          </div>
        </Section>

        <Section
          icon={<Receipt className="w-5 h-5" />}
          title="تدفق البيع والفاتورة"
          description="التحكم في التعليق، المرتجع، ملاحظات الفاتورة، إلزام العميل، ونوع الطلب."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ToggleField title="تعليق الفواتير Hold" description="حفظ فاتورة مؤقتة واسترجاعها." checked={config.salesFlow.allowHoldInvoices} onChange={(v) => updateConfig({ salesFlow: { ...config.salesFlow, allowHoldInvoices: v } })} />
            <ToggleField title="المرتجعات والاستبدال" description="إظهار أدوات المرتجع أو الاستبدال." checked={config.salesFlow.allowReturns} onChange={(v) => updateConfig({ salesFlow: { ...config.salesFlow, allowReturns: v } })} />
            <ToggleField title="ملاحظات الفاتورة" description="إضافة ملاحظة عامة تظهر للفاتورة والمطبخ." checked={config.salesFlow.allowInvoiceNotes} onChange={(v) => updateConfig({ salesFlow: { ...config.salesFlow, allowInvoiceNotes: v } })} />
            <ToggleField title="ملاحظات الصنف" description="إضافة ملاحظات لكل صنف." checked={config.salesFlow.allowItemNotes} onChange={(v) => updateConfig({ salesFlow: { ...config.salesFlow, allowItemNotes: v } })} />
            <ToggleField title="إلزام اختيار عميل" description="منع الدفع قبل اختيار عميل." checked={config.salesFlow.requireCustomer} onChange={(v) => updateConfig({ salesFlow: { ...config.salesFlow, requireCustomer: v } })} />
            <ToggleField title="إلزام عميل للدليفري" description="الدليفري يحتاج اسم ورقم وعنوان." checked={config.salesFlow.requireCustomerForDelivery} onChange={(v) => updateConfig({ salesFlow: { ...config.salesFlow, requireCustomerForDelivery: v } })} />
          </div>
          <div className="mt-4 bg-white rounded-2xl border border-slate-100 p-4">
            <span className="block text-sm font-black text-slate-800 mb-3">أنواع الطلبات المسموحة</span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(Object.keys(orderTypeLabels) as POSOrderType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => toggleOrderType(type)}
                  className={`py-2 px-3 rounded-xl text-xs font-black border transition-all ${
                    config.salesFlow.enabledOrderTypes.includes(type)
                      ? "bg-blue-700 text-white border-blue-800"
                      : "bg-slate-50 text-slate-600 border-slate-200"
                  }`}
                >
                  {orderTypeLabels[type]}
                </button>
              ))}
            </div>
            <label className="block mt-4">
              <span className="block text-xs font-black text-slate-500 mb-2">نوع الطلب الافتراضي</span>
              <select
                value={config.salesFlow.defaultOrderType ?? ""}
                onChange={(e) => updateConfig({ salesFlow: { ...config.salesFlow, defaultOrderType: e.target.value as POSOrderType } })}
                className="w-full border border-slate-200 rounded-xl p-2 text-sm font-bold"
              >
                {config.salesFlow.enabledOrderTypes.map((type) => (
                  <option key={type} value={type}>{orderTypeLabels[type]}</option>
                ))}
              </select>
            </label>
          </div>
        </Section>

        <Section
          icon={<CreditCard className="w-5 h-5" />}
          title="الأسعار والضرائب والدفع"
          description="تحكم في الضريبة، الخصم، الخدمة، العملة، وطرق الدفع الظاهرة للكاشير."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <ToggleField title="تطبيق نسبة ضريبة الصنف" description="نسبة الضريبة تُقرأ من بطاقة كل صنف، والفراغ يأخذ النسبة العامة أدناه." checked={config.pricing.enableTax} onChange={(v) => updateConfig({ pricing: { ...config.pricing, enableTax: v } })} />
            <ToggleField title="الأسعار تشمل الضريبة" description="لو مفعّل: الضريبة تُستخرج من سعر الصنف ويقل إيراد المبيعات المسجل بنسبتها. لو مغلق: تُضاف الضريبة فوق السعر." checked={config.pricing.taxIncluded} onChange={(v) => updateConfig({ pricing: { ...config.pricing, taxIncluded: v } })} />
            <ToggleField title="السماح بالخصم" checked={config.pricing.enableDiscount} onChange={(v) => updateConfig({ pricing: { ...config.pricing, enableDiscount: v } })} />
            <ToggleField title="رسوم خدمة" description="مناسبة للمطاعم والكافيهات." checked={config.pricing.enableServiceCharge} onChange={(v) => updateConfig({ pricing: { ...config.pricing, enableServiceCharge: v } })} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <label className="bg-white rounded-2xl border border-slate-100 p-4">
              <span className="block text-xs font-black text-slate-500 mb-2">العملة</span>
              <input value={config.pricing.currency ?? ""} onChange={(e) => updateConfig({ pricing: { ...config.pricing, currency: e.target.value || "EGP" } })} className="w-full border border-slate-200 rounded-xl p-2 text-sm font-bold" />
            </label>
            <label className="bg-white rounded-2xl border border-slate-100 p-4">
              <span className="block text-xs font-black text-slate-500 mb-2">نسبة الضريبة %</span>
              <input type="number" min={0} max={100} value={config.pricing.taxPercent ?? ""} onChange={(e) => updateConfig({ pricing: { ...config.pricing, taxPercent: Number(e.target.value) || 0 } })} className="w-full border border-slate-200 rounded-xl p-2 text-sm font-bold" />
            </label>
            <label className="bg-white rounded-2xl border border-slate-100 p-4">
              <span className="block text-xs font-black text-slate-500 mb-2">أقصى خصم %</span>
              <input type="number" min={0} max={100} value={config.pricing.maxDiscountPercent ?? ""} onChange={(e) => updateConfig({ pricing: { ...config.pricing, maxDiscountPercent: Number(e.target.value) || 0 } })} className="w-full border border-slate-200 rounded-xl p-2 text-sm font-bold" />
            </label>
            <label className="bg-white rounded-2xl border border-slate-100 p-4">
              <span className="block text-xs font-black text-slate-500 mb-2">رسوم الخدمة %</span>
              <input type="number" min={0} max={100} value={config.pricing.serviceChargePercent ?? ""} onChange={(e) => updateConfig({ pricing: { ...config.pricing, serviceChargePercent: Number(e.target.value) || 0 } })} className="w-full border border-slate-200 rounded-xl p-2 text-sm font-bold" />
            </label>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <span className="block text-sm font-black text-slate-800 mb-3">طرق الدفع الظاهرة</span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(Object.keys(paymentLabels) as POSPaymentMethod[]).map((method) => (
                <button
                  key={method}
                  onClick={() => togglePaymentMethod(method)}
                  className={`py-2 px-3 rounded-xl text-xs font-black border transition-all ${
                    config.payments.enabledMethods.includes(method)
                      ? "bg-emerald-600 text-white border-emerald-700"
                      : "bg-slate-50 text-slate-600 border-slate-200"
                  }`}
                >
                  {paymentLabels[method]}
                </button>
              ))}
              {(config.payments.customMethods || []).map((cm) => (
                <button
                  key={cm.key}
                  onClick={() => togglePaymentMethod(cm.key as POSPaymentMethod)}
                  className={`py-2 px-3 rounded-xl text-xs font-black border transition-all relative group ${
                    config.payments.enabledMethods.includes(cm.key as POSPaymentMethod)
                      ? "bg-emerald-600 text-white border-emerald-700"
                      : "bg-slate-50 text-slate-600 border-slate-200"
                  }`}
                >
                  {cm.label}
                  <span
                    onClick={(e) => { e.stopPropagation(); removeCustomMethod(cm.key); }}
                    className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[8px] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <X className="w-2.5 h-2.5" />
                  </span>
                </button>
              ))}
            </div>
            {/* Add Custom Payment Method */}
            <div className="mt-3 pt-3 border-t border-slate-100">
              <span className="block text-xs font-bold text-slate-500 mb-2">إضافة طريقة دفع مخصصة</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="المفتاح (مثال: stc_pay)"
                  value={newCustomMethod.key ?? ""}
                  onChange={(e) => setNewCustomMethod({ ...newCustomMethod, key: e.target.value.replace(/\s/g, '_').toLowerCase() })}
                  className="flex-1 border border-slate-200 rounded-lg p-2 text-xs"
                  dir="ltr"
                />
                <input
                  type="text"
                  placeholder="الاسم بالعربي"
                  value={newCustomMethod.label ?? ""}
                  onChange={(e) => setNewCustomMethod({ ...newCustomMethod, label: e.target.value })}
                  className="flex-1 border border-slate-200 rounded-lg p-2 text-xs"
                />
                <input
                  type="text"
                  placeholder="English name"
                  value={newCustomMethod.en ?? ""}
                  onChange={(e) => setNewCustomMethod({ ...newCustomMethod, en: e.target.value })}
                  className="flex-1 border border-slate-200 rounded-lg p-2 text-xs"
                  dir="ltr"
                />
                <button
                  onClick={addCustomMethod}
                  disabled={!newCustomMethod.key || !newCustomMethod.label}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة</span>
                </button>
              </div>
            </div>
          </div>
        </Section>

        <Section
          icon={<Barcode className="w-5 h-5" />}
          title="تجهيزات حسب النشاط"
          description="خيارات متخصصة للمطاعم، السوبر ماركت، والملابس."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ToggleField title="طاولات المطاعم" checked={config.restaurant.enableTables} onChange={(v) => updateConfig({ restaurant: { ...config.restaurant, enableTables: v } })} />
            <ToggleField title="ملاحظات المطبخ" checked={config.restaurant.enableKitchenNotes} onChange={(v) => updateConfig({ restaurant: { ...config.restaurant, enableKitchenNotes: v } })} />
            <ToggleField title="إضافات و Modifiers" checked={config.restaurant.enableModifiers} onChange={(v) => updateConfig({ restaurant: { ...config.restaurant, enableModifiers: v } })} />
            <ToggleField title="وضع الويتر" checked={config.restaurant.enableWaiterMode} onChange={(v) => updateConfig({ restaurant: { ...config.restaurant, enableWaiterMode: v } })} />
            <ToggleField title="باركود الميزان" checked={config.supermarket.enableScaleBarcode} onChange={(v) => updateConfig({ supermarket: { ...config.supermarket, enableScaleBarcode: v } })} />
            <ToggleField title="إظهار مستوى المخزون" checked={config.supermarket.showStockLevel} onChange={(v) => updateConfig({ supermarket: { ...config.supermarket, showStockLevel: v } })} />
            <ToggleField title="مقاسات وألوان الملابس" checked={config.clothing.enableVariants} onChange={(v) => updateConfig({ clothing: { ...config.clothing, enableVariants: v } })} />
            <ToggleField title="استبدال الملابس" checked={config.clothing.enableExchanges} onChange={(v) => updateConfig({ clothing: { ...config.clothing, enableExchanges: v } })} />
          </div>
        </Section>

        <Section
          icon={<FileText className="w-5 h-5" />}
          title="قوالب الفواتير والرسيبتات"
          description="إنشاء وتخصيص قوالب فواتير لنقطة البيع. أضف شعار، اسم الشركة، نصوص، واختر العناصر اللي تظهر."
        >
          {/* Tabs: Customer / Internal */}
          <div className="flex gap-2 mb-5 bg-white rounded-xl p-1 border border-slate-100 w-fit">
            <button
              onClick={() => setTemplateTab("customer")}
              className={`px-5 py-2.5 rounded-lg font-black text-xs transition-all ${templateTab === "customer" ? "bg-blue-700 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              فاتورة العميل ({getTemplateById(activeCustomerId).name})
            </button>
            <button
              onClick={() => setTemplateTab("internal")}
              className={`px-5 py-2.5 rounded-lg font-black text-xs transition-all ${templateTab === "internal" ? "bg-blue-700 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              الإيصال الداخلي ({getTemplateById(activeInternalId).name})
            </button>
          </div>

          {/* Template Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 mb-4">
            {allTemplates.map((tpl) => {
              const isActive = activeTemplateId === tpl.id;
              return (
                <motion.button
                  key={tpl.id}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectTemplate(tpl.id)}
                  className={`relative rounded-2xl border-2 text-right transition-all overflow-hidden bg-white group ${
                    isActive ? "border-blue-600 shadow-lg shadow-blue-600/10 ring-2 ring-blue-100" : "border-slate-100 hover:border-slate-200 shadow-sm"
                  }`}
                >
                  {isActive && (
                    <div className="absolute top-2 left-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center z-10 shadow">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className={`aspect-[3/4] p-2 flex flex-col overflow-hidden ${tpl.style === "detailed-table" ? "" : ""}`}>
                    <TemplateMiniPreview template={tpl} />
                  </div>
                  <div className="px-3 py-2.5 border-t border-slate-50">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-xs text-slate-800 truncate">{tpl.name}</span>
                      {tpl.isBuiltIn && <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-bold shrink-0">مدمج</span>}
                      {!tpl.isBuiltIn && <span className="text-[9px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full font-bold shrink-0">مخصص</span>}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">{POS_INVOICE_STYLE_LABELS[tpl.style].description}</p>
                  </div>
                  {/* Hover Actions */}
                  <div className="absolute bottom-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingTemplate(tpl); }}
                      className="w-7 h-7 rounded-lg bg-white shadow-md border border-slate-200 flex items-center justify-center hover:bg-blue-50 transition-colors"
                      title="تعديل"
                    >
                      <Pencil className="w-3 h-3 text-blue-600" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDuplicateTemplate(tpl); }}
                      className="w-7 h-7 rounded-lg bg-white shadow-md border border-slate-200 flex items-center justify-center hover:bg-emerald-50 transition-colors"
                      title="نسخ"
                    >
                      <Copy className="w-3 h-3 text-emerald-600" />
                    </button>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* ─── Full-Size Receipt Preview ─── */}
          <div className="mt-5 bg-slate-900 rounded-3xl p-5 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-white">
                <Eye className="w-5 h-5 text-blue-400" />
                <span className="font-black text-sm">معاينة الرسيبت — {getTemplateById(activeTemplateId).name}</span>
              </div>
              <span className="text-[10px] text-slate-400 bg-slate-800 px-3 py-1 rounded-full font-bold">
                {getTemplateById(activeTemplateId).style === "detailed-table" ? "جدول تفصيلي" : POS_INVOICE_STYLE_LABELS[getTemplateById(activeTemplateId).style].label}
              </span>
            </div>
            <div className="overflow-y-auto max-h-[600px] rounded-2xl p-6 bg-[#d1d5db] flex justify-center">
              <div className="shadow-2xl">
                <TemplateFullPreview template={getTemplateById(activeTemplateId)} />
              </div>
            </div>
          </div>

          {/* Create New Template Button */}
          <button
            onClick={handleCreateTemplate}
            className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-200 hover:border-blue-300 bg-slate-50/50 hover:bg-blue-50/30 flex items-center justify-center gap-2 transition-all group"
          >
            <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
              <Plus className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </div>
            <span className="font-black text-sm text-slate-400 group-hover:text-blue-600 transition-colors">إنشاء قالب فاتورة جديد</span>
          </button>

          {/* Active Template Info */}
          <div className="mt-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
            <div className="text-right flex-1">
              <span className="block text-xs font-black text-emerald-800">
                القالب النشط لـ {templateTab === "customer" ? "فاتورة العميل" : "الإيصال الداخلي"}: {getTemplateById(activeTemplateId).name}
              </span>
              <span className="block text-[11px] text-emerald-600/80 mt-0.5">
                {POS_INVOICE_STYLE_LABELS[getTemplateById(activeTemplateId).style].description}
                {getTemplateById(activeTemplateId).companyName ? ` — ${getTemplateById(activeTemplateId).companyName}` : ""}
              </span>
            </div>
            <button
              onClick={() => setEditingTemplate(getTemplateById(activeTemplateId))}
              className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 flex items-center gap-1 transition-colors"
            >
              <Pencil className="w-3 h-3" /> تعديل
            </button>
          </div>
        </Section>

        <Section
          icon={<Clock className="w-5 h-5" />}
          title="إدارة الورديات"
          description="فتح وردية مستقلة لكل كاشير ونقطة بيع، وربط فواتير POS بالحركة النقدية والموظف."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ToggleField
              title="تفعيل نظام الورديات"
              description="عند التفعيل، يمنع إتمام البيع حتى يفتح المستخدم وردية خاصة به."
              checked={config.shiftManagement.enabled}
              onChange={(enabled) => updateConfig({ shiftManagement: { ...config.shiftManagement, enabled } })}
            />
            <ToggleField
              title="قصر المستخدم على ورديته"
              description="المستخدم يدير ورديته فقط؛ صلاحية الإدارة تتيح عرض وإغلاق ورديات الموظفين."
              checked={config.shiftManagement.employeeOwnShiftOnly}
              onChange={(employeeOwnShiftOnly) => updateConfig({ shiftManagement: { ...config.shiftManagement, employeeOwnShiftOnly } })}
            />
            <ToggleField
              title="السماح بورديات متزامنة"
              description="يسمح بتشغيل ورديات متعددة على نقاط بيع مختلفة في الوقت نفسه."
              checked={config.shiftManagement.allowMultipleOpenShifts}
              onChange={(allowMultipleOpenShifts) => updateConfig({ shiftManagement: { ...config.shiftManagement, allowMultipleOpenShifts } })}
            />
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">سياسة الرصيد الافتتاحي</label>
              <select
                value={config.shiftManagement.openingBalanceMode}
                onChange={(event) => updateConfig({ shiftManagement: { ...config.shiftManagement, openingBalanceMode: event.target.value as "required" | "optional" | "none" } })}
                className="w-full p-3 border rounded-xl bg-white"
                disabled={!config.shiftManagement.enabled}
              >
                <option value="required">إلزامي</option>
                <option value="optional">اختياري</option>
                <option value="none">بدون رصيد افتتاحي</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">معرّف نقطة البيع / Terminal</label>
              <input
                value={config.shiftManagement.terminalId}
                onChange={(event) => updateConfig({ shiftManagement: { ...config.shiftManagement, terminalId: event.target.value } })}
                className="w-full p-3 border rounded-xl bg-white"
                placeholder="POS-01"
                maxLength={64}
              />
            </div>
          </div>
        </Section>

        <Section
          icon={<Printer className="w-5 h-5" />}
          title="الطباعة والتقارير"
          description="تحكم في الطباعة التلقائية ومؤشرات التقارير داخل شاشة POS والداش بورد."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ToggleField title="طباعة فاتورة تلقائياً" checked={config.salesFlow.autoPrintReceipt} onChange={(v) => updateConfig({ salesFlow: { ...config.salesFlow, autoPrintReceipt: v } })} />
            <ToggleField title="طباعة المطبخ تلقائياً" checked={config.salesFlow.autoPrintKitchen} onChange={(v) => updateConfig({ salesFlow: { ...config.salesFlow, autoPrintKitchen: v } })} />
            <ToggleField title="إجمالي مبيعات اليوم" checked={config.reports.showTodaySales} onChange={(v) => updateConfig({ reports: { ...config.reports, showTodaySales: v } })} />
            <ToggleField title="عدد الفواتير" checked={config.reports.showInvoiceCount} onChange={(v) => updateConfig({ reports: { ...config.reports, showInvoiceCount: v } })} />
            <ToggleField title="متوسط الفاتورة" checked={config.reports.showAverageTicket} onChange={(v) => updateConfig({ reports: { ...config.reports, showAverageTicket: v } })} />
            <ToggleField title="تحليل طرق الدفع" checked={config.reports.showPaymentBreakdown} onChange={(v) => updateConfig({ reports: { ...config.reports, showPaymentBreakdown: v } })} />
          </div>
        </Section>

        <Section
          icon={<Link2 className="w-5 h-5" />}
          title="المديولات المتصلة بشاشة المبيعات"
          description="تحكم في المديولات اللي تظهر متصلة بشاشة نقطة البيع. اختيار البروفايل بيحدد الإعدادات الافتراضية ويمكنك تعديلها يدوياً."
        >
          <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-3 mb-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Settings className="w-4 h-4" />
            </div>
            <div className="text-right">
              <span className="block text-xs font-black text-blue-800">نوع النشاط الحالي: {POS_BUSINESS_PROFILES[config.profile].label}</span>
              <span className="block text-[11px] text-blue-600/80 mt-0.5">المديولات المفعلة تلقائياً عند تغيير البروفايل: {config.linkedModules.length} مديول</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {POS_LINKED_MODULES_LIST.map((mod) => {
              const isLinked = (config.linkedModules || []).includes(mod.id);
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => toggleLinkedModule(mod.id)}
                  className={`flex items-start gap-3 rounded-2xl border-2 p-4 text-right transition-all duration-200 ${
                    isLinked
                      ? "border-blue-500 bg-blue-50/50 shadow-sm shadow-blue-100"
                      : "border-slate-100 bg-white hover:border-slate-200"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    isLinked ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
                  }`}
                  >
                    {linkedModuleIcons[mod.icon] || <Settings className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-black text-sm ${isLinked ? "text-blue-800" : "text-slate-600"}`}>{mod.label}</span>
                      {isLinked ? (
                        <Link2 className="w-3.5 h-3.5 text-blue-500" />
                      ) : (
                        <Unlink className="w-3.5 h-3.5 text-slate-300" />
                      )}
                    </div>
                    <span className="block text-[11px] text-slate-500 leading-relaxed mt-1">{mod.description}</span>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                    isLinked ? "border-blue-500 bg-blue-500" : "border-slate-200 bg-white"
                  }`}>
                    {isLinked && <CheckCircle2 className="w-4 h-4 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
        </Section>

        <Section
          icon={<PieChart className="w-5 h-5" />}
          title="مؤشرات احترافية جاهزة للتوسع"
          description="تم تجهيز البنية لتقارير POS مثل Odoo: المبيعات، الكاشير، المنتجات، طرق الدفع، والربحية."
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              "تقرير مبيعات الوردية",
              "تقرير طرق الدفع",
              "أعلى المنتجات مبيعاً",
              "أداء الكاشير",
              "مرتجعات واستبدالات",
              "فروقات الخصم والضريبة"
            ].map((item) => (
              <div key={item} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-bold text-slate-700">{item}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* Invoice Template Editor Modal */}
      {editingTemplate && (
        <InvoiceTemplateEditor
          template={editingTemplate}
          onSave={handleSaveTemplate}
          onDelete={!editingTemplate.isBuiltIn ? () => handleDeleteTemplate(editingTemplate.id) : undefined}
          onClose={() => setEditingTemplate(null)}
        />
      )}

      {/* POS Screen Design Editor Modal */}
      {editingScreenDesign && (
        <ScreenDesignEditor
          design={editingScreenDesign}
          onSave={handleSaveScreenDesign}
          onDelete={!editingScreenDesign.isBuiltIn ? () => handleDeleteScreenDesign(editingScreenDesign.id) : undefined}
          onClose={() => setEditingScreenDesign(null)}
        />
      )}
    </div>
  );
};
