import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Loader2, Printer, X } from "lucide-react";
import { api } from "../utils/api";
import {
  POS_BUILT_IN_TEMPLATES,
  type POSConfiguration,
  type POSInvoiceTemplate
} from "../utils/posSettings";

/**
 * POSReceiptModal
 * ---------------------------------------------------------------
 * يعرض إيصال الطلب الحقيقي بعد البيع مستخدماً القالب المختار من
 * إعدادات نقطة البيع (قوالب الفواتير والرسيبتات) — فاتورة العميل
 * أو الإيصال الداخلي — مع إمكانية الطباعة مباشرة.
 */

export interface POSReceiptModalProps {
  orderId: number;
  config: POSConfiguration;
  cashierName?: string;
  autoPrint?: boolean;
  initialMode?: "customer" | "internal";
  onClose: () => void;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: "كاش (نقداً)",
  visa: "فيزا / بطاقة",
  mastercard: "ماستر كارد",
  instapay: "إنستا باي",
  wallet: "محفظة إلكترونية",
  credit: "آجل",
  mixed: "مختلط"
};

const orderTypeLabel = (value?: string) => {
  switch (value) {
    case "dine_in":
      return "صالة";
    case "delivery":
      return "توصيل";
    case "takeaway":
      return "تيك أواي";
    case "membership":
      return "عضوية";
    case "exchange":
      return "استبدال";
    default:
      return value ? String(value) : "طلبات";
  }
};

const fmtMoney = (value: unknown) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString("en-EG", { maximumFractionDigits: 2 });
};

const resolveTemplates = (config: POSConfiguration): POSInvoiceTemplate[] => [
  ...POS_BUILT_IN_TEMPLATES,
  ...(config.invoiceTemplates?.customTemplates || [])
];

const resolveTemplate = (config: POSConfiguration, id: string): POSInvoiceTemplate => {
  const all = resolveTemplates(config);
  return all.find((tpl) => tpl.id === id) || POS_BUILT_IN_TEMPLATES[0];
};

/* ─────────────────────────── Receipt Renderer ─────────────────────────── */

interface ReceiptTemplateViewProps {
  template: POSInvoiceTemplate;
  order: any;
  items: any[];
  branchName: string;
  cashierName: string;
  currency: string;
}

export const ReceiptTemplateView: React.FC<ReceiptTemplateViewProps> = ({
  template: t,
  order,
  items,
  branchName,
  cashierName,
  currency
}) => {
  const s = t.style;
  const border = t.borderColor;
  const hBg = t.headerBgColor;
  const hTxt = t.headerTextColor;
  const cur = currency || "ج.م";

  const position = Number(order?.id) || 0;
  const orderNumber = order?.daily_number || order?.id || "-";
  const typeLabel = orderTypeLabel(order?.order_type);
  const paymentLabel = PAYMENT_LABELS[order?.payment_method] || order?.payment_method || "-";
  const createdAt = order?.timestamp || order?.created_at || order?.date || Date.now();
  const dateStr = new Date(createdAt).toLocaleDateString("ar-EG");
  const timeStr = new Date(createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
  const companyName = t.companyName || branchName || "فاتورة";
  const notesText = order?.notes || order?.invoice_note || "";
  const customerName = order?.customer_name || "";
  const customerPhone = order?.customer_phone || "";
  const customerAddress = order?.customer_address || "";
  const tableNumber = order?.table_number;

  const safeItems = Array.isArray(items) ? items : [];
  const itemsTotal = safeItems.reduce(
    (sum, item) => sum + Number(item?.price || 0) * Number(item?.quantity || 0),
    0
  );
  const taxVal = Number(order?.tax_amount || 0);
  const serviceVal = Number(order?.service_charge || 0);
  const discountVal = Number(order?.discount || 0);
  const deliveryVal = Number(order?.delivery_fee || 0);
  const grandTotal =
    order?.total !== undefined && order?.total !== null
      ? Number(order.total)
      : Math.max(0, itemsTotal + taxVal + serviceVal + deliveryVal - discountVal);

  const borderStyle = (extra: React.CSSProperties = {}) => ({ borderColor: border, ...extra });

  const itemsListBlock = (
    <div className="space-y-2 mb-4">
      <div className="flex justify-between font-bold border-b pb-2 mb-2" style={borderStyle()}>
        <span className="opacity-60">الصنف</span>
        {t.showItemPrices && <span className="opacity-60">السعر</span>}
      </div>
      {safeItems.map((item, i) => (
        <div key={i} className="flex justify-between text-sm">
          <span>
            {item?.name}
            {item?.size_name && String(item.size_name).trim() !== "" ? ` (${item.size_name})` : ""} x
            {Number(item?.quantity || 0)}
          </span>
          {t.showItemPrices && (
            <span>
              {fmtMoney(Number(item?.price || 0) * Number(item?.quantity || 0))} {cur}
            </span>
          )}
        </div>
      ))}
      {t.showDeliveryFee && deliveryVal > 0 && (
        <div className="flex justify-between text-sm border-t pt-2" style={borderStyle({ borderTopStyle: "dashed" })}>
          <span>خدمة التوصيل</span>
          <span>{fmtMoney(deliveryVal)} {cur}</span>
        </div>
      )}
      {t.showDiscount && discountVal > 0 && (
        <div className="flex justify-between text-sm text-rose-600 font-bold">
          <span>قيمة الخصم</span>
          <span>-{fmtMoney(discountVal)} {cur}</span>
        </div>
      )}
    </div>
  );

  const infoRows = (
    <div className="mb-4 text-sm space-y-1">
      {t.showCashier && (
        <div className="flex justify-between"><span className="font-bold opacity-70">الكاشير:</span><span>{cashierName}</span></div>
      )}
      {t.showTable && tableNumber && (
        <div className="flex justify-between"><span className="font-bold opacity-70">الطاولة:</span><span>{tableNumber}</span></div>
      )}
      {t.showCustomer && customerName && (
        <>
          <div className="flex justify-between"><span className="font-bold opacity-70">العميل:</span><span>{customerName}</span></div>
          {customerPhone && (
            <div className="flex justify-between"><span className="font-bold opacity-70">الهاتف:</span><span>{customerPhone}</span></div>
          )}
        </>
      )}
      {t.showDeliveryAddress && customerAddress && (
        <div className="flex justify-between"><span className="font-bold opacity-70">العنوان:</span><span className="text-left">{customerAddress}</span></div>
      )}
      {t.showPaymentMethod && (
        <div className="flex justify-between"><span className="font-bold opacity-70">طريقة الدفع:</span><span className="font-bold text-orange-600">{paymentLabel}</span></div>
      )}
    </div>
  );

  const totalsBlock = (
    <div className="space-y-1.5 mb-4">
      {t.showSubtotal && (
        <div className="flex justify-between text-sm"><span className="opacity-60">المجموع الفرعي</span><span>{fmtMoney(itemsTotal)} {cur}</span></div>
      )}
      {t.showTax && taxVal > 0 && (
        <div className="flex justify-between text-sm"><span className="opacity-60">الضريبة</span><span>{fmtMoney(taxVal)} {cur}</span></div>
      )}
      {t.showServiceCharge && serviceVal > 0 && (
        <div className="flex justify-between text-sm"><span className="opacity-60">رسوم الخدمة</span><span>{fmtMoney(serviceVal)} {cur}</span></div>
      )}
      {t.showDeliveryFee && deliveryVal > 0 && (
        <div className="flex justify-between text-sm"><span className="opacity-60">التوصيل</span><span>{fmtMoney(deliveryVal)} {cur}</span></div>
      )}
      {t.showDiscount && discountVal > 0 && (
        <div className="flex justify-between text-sm text-rose-600 font-bold"><span>الخصم</span><span>-{fmtMoney(discountVal)} {cur}</span></div>
      )}
      {t.showGrandTotal && (
        <div className="flex justify-between font-black text-xl border-t-2 pt-3 mt-2" style={borderStyle({ borderTopStyle: "dashed" })}>
          <span>الإجمالي النهائي</span>
          <span>{fmtMoney(grandTotal)} {cur}</span>
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

  const logoBlock = (
    <div className="flex justify-center mb-3">
      {t.logoUrl ? (
        <img src={t.logoUrl} alt="Logo" className="w-16 h-16 object-contain" referrerPolicy="no-referrer" />
      ) : (
        <div className="w-16 h-16 border-2 rounded-full flex items-center justify-center text-xs opacity-40" style={{ borderColor: border }}>
          LOGO
        </div>
      )}
    </div>
  );

  /* ─── detailed-table style ─── */
  if (s === "detailed-table") {
    return (
      <div className="w-full max-w-[320px] mx-auto bg-white text-black font-mono" style={{ fontSize: `${t.fontSize}px`, fontWeight: t.fontWeight }}>
        <div className="text-center py-4 border-b-2" style={borderStyle()}>
          {t.showLogo && logoBlock}
          {t.showCompanyName && <p className="font-black text-lg">{companyName}</p>}
          {t.headerText && <p className="text-sm opacity-70">{t.headerText}</p>}
        </div>

        <table className="w-full border-collapse border border-black text-center text-sm">
          <tbody>
            {t.showOrderNumber && (
              <tr className="border-b border-black"><td colSpan={2} className="p-2 font-black text-3xl">{orderNumber}</td></tr>
            )}
            {t.showOrderType && (
              <tr className="border-b border-black"><td colSpan={2} className="p-2 font-black text-xl">{typeLabel}</td></tr>
            )}
            {(t.showDate || t.showTime) && (
              <tr className="border-b border-black">
                {t.showDate && <td className="border-l border-black p-2 w-1/2">{dateStr}</td>}
                {t.showTime && <td className={`p-2 ${t.showDate ? "w-1/2" : ""}`}>{timeStr}</td>}
              </tr>
            )}
            {t.showCashier && (
              <tr className="border-b border-black text-right">
                <td className="border-l border-black p-2 font-bold w-1/3">الكاشير</td>
                <td className="p-2 w-2/3">{cashierName}</td>
              </tr>
            )}
            {t.showTable && tableNumber && (
              <tr className="border-b border-black text-right">
                <td className="border-l border-black p-2 font-bold w-1/3">الطاولة</td>
                <td className="p-2 w-2/3">{tableNumber}</td>
              </tr>
            )}
            {t.showCustomer && customerName && (
              <>
                <tr className="border-b border-black text-right">
                  <td className="border-l border-black p-2 font-bold w-1/3">العميل</td>
                  <td className="p-2 w-2/3 font-bold">{customerName}</td>
                </tr>
                {customerPhone && (
                  <tr className="border-b border-black text-right">
                    <td className="border-l border-black p-2 font-bold w-1/3">الهاتف</td>
                    <td className="p-2 w-2/3">{customerPhone}</td>
                  </tr>
                )}
              </>
            )}
            {t.showDeliveryAddress && customerAddress && (
              <tr className="border-b border-black text-right">
                <td className="border-l border-black p-2 font-bold w-1/3">العنوان</td>
                <td className="p-2 w-2/3">{customerAddress}</td>
              </tr>
            )}
          </tbody>
        </table>

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
              {safeItems.map((item, i) => (
                <tr key={i} className="border-b border-black">
                  {t.showItemPrices && <td className="border-l border-black p-2">{fmtMoney(Number(item?.price || 0) * Number(item?.quantity || 0))}</td>}
                  {t.showItemPrices && <td className="border-l border-black p-2">{fmtMoney(item?.price)}</td>}
                  <td className="border-l border-black p-2 text-right px-2">
                    {item?.name}
                    {item?.size_name && String(item.size_name).trim() !== "" ? ` - ${item.size_name}` : ""}
                  </td>
                  <td className="p-2">{Number(item?.quantity || 0)}</td>
                </tr>
              ))}
              {t.showDeliveryFee && deliveryVal > 0 && (
                <tr className="border-b border-black">
                  {t.showItemPrices && <td className="border-l border-black p-2">{fmtMoney(deliveryVal)}</td>}
                  {t.showItemPrices && <td className="border-l border-black p-2">{fmtMoney(deliveryVal)}</td>}
                  <td className="border-l border-black p-2 text-right px-2">خدمة التوصيل</td>
                  <td className="p-2">1</td>
                </tr>
              )}
              {t.showDiscount && discountVal > 0 && (
                <tr className="border-b border-black text-rose-600 font-bold">
                  {t.showItemPrices && <td className="border-l border-black p-2">-{fmtMoney(discountVal)}</td>}
                  <td colSpan={t.showItemPrices ? 3 : 2} className="border-l border-black p-2 text-right px-2">قيمة الخصم</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        <table className="w-full border-collapse border border-black text-center text-sm mt-0">
          <tbody>
            {t.showSubtotal && (
              <tr className="border-b border-black text-right">
                <td className="border-l border-black p-2 w-2/3">المجموع الفرعي</td>
                <td className="p-2 w-1/3">{fmtMoney(itemsTotal)} {cur}</td>
              </tr>
            )}
            {t.showTax && taxVal > 0 && (
              <tr className="border-b border-black text-right">
                <td className="border-l border-black p-2">الضريبة</td>
                <td className="p-2">{fmtMoney(taxVal)} {cur}</td>
              </tr>
            )}
            {t.showServiceCharge && serviceVal > 0 && (
              <tr className="border-b border-black text-right">
                <td className="border-l border-black p-2">رسوم الخدمة</td>
                <td className="p-2">{fmtMoney(serviceVal)} {cur}</td>
              </tr>
            )}
            {t.showGrandTotal && (
              <tr className="font-black text-lg" style={{ background: `${hBg}20` }}>
                <td className="border-l border-black p-2 text-right px-3">الإجمالي النهائي</td>
                <td className="p-2">{fmtMoney(grandTotal)} {cur}</td>
              </tr>
            )}
          </tbody>
        </table>

        {t.showNotes && notesText && (
          <div className="p-3 border-b-2 border-black text-right text-sm">
            <p className="font-bold mb-1">ملاحظات:</p>
            <p className="opacity-70">{notesText}</p>
          </div>
        )}

        {t.showPaymentMethod && <p className="text-center font-bold py-3 text-lg">{paymentLabel}</p>}

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
      <div className="w-full max-w-[320px] mx-auto bg-white text-black rounded-3xl border-4 overflow-hidden shadow-2xl" style={{ borderColor: hBg, fontSize: `${t.fontSize}px`, fontWeight: t.fontWeight }}>
        <div className="text-center p-6" style={{ background: hBg, color: hTxt }}>
          {t.showLogo && (
            <div className="flex justify-center mb-2">
              {t.logoUrl ? (
                <img src={t.logoUrl} alt="" className="w-14 h-14 object-contain rounded-xl" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-14 h-14 border-2 border-white/30 rounded-full flex items-center justify-center text-[10px] opacity-50">LOGO</div>
              )}
            </div>
          )}
          {t.showCompanyName && <h2 className="font-black text-2xl">{companyName}</h2>}
          {t.headerText && <p className="text-sm opacity-80">{t.headerText}</p>}
          <div className="flex justify-center gap-4 mt-3 text-sm opacity-80">
            {t.showOrderNumber && <span className="bg-white/20 px-3 py-1 rounded-full font-bold">#{orderNumber}</span>}
            {t.showOrderType && <span className="bg-white/20 px-3 py-1 rounded-full font-bold">{typeLabel}</span>}
          </div>
          {(t.showDate || t.showTime) && (
            <p className="text-xs opacity-60 mt-2">
              {t.showDate && t.showTime ? `${dateStr} — ${timeStr}` : t.showDate ? dateStr : timeStr}
            </p>
          )}
        </div>
        <div className="p-6 space-y-4">
          {(t.showCashier || t.showCustomer || t.showTable || t.showDeliveryAddress || t.showPaymentMethod) && (
            <div className="bg-slate-50 p-4 rounded-xl space-y-1 text-sm">
              {t.showCashier && <div className="flex justify-between"><span className="opacity-50">الكاشير</span><span className="font-bold">{cashierName}</span></div>}
              {t.showTable && tableNumber && <div className="flex justify-between"><span className="opacity-50">الطاولة</span><span className="font-bold">{tableNumber}</span></div>}
              {t.showCustomer && customerName && (
                <>
                  <div className="flex justify-between"><span className="opacity-50">العميل</span><span className="font-bold">{customerName}</span></div>
                  {customerPhone && <div className="flex justify-between"><span className="opacity-50">الهاتف</span><span>{customerPhone}</span></div>}
                </>
              )}
              {t.showDeliveryAddress && customerAddress && <div className="flex justify-between"><span className="opacity-50">العنوان</span><span>{customerAddress}</span></div>}
              {t.showPaymentMethod && <div className="flex justify-between"><span className="opacity-50">الدفع</span><span className="font-bold text-orange-600">{paymentLabel}</span></div>}
            </div>
          )}
          {t.showNotes && notesText && (
            <div className="bg-amber-50 p-3 rounded-xl text-sm"><span className="font-bold text-amber-700">ملاحظات: </span><span className="opacity-70">{notesText}</span></div>
          )}
          {t.showItemsTable && (
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-400 border-b border-slate-100 pb-2 mb-2">
                <span>الصنف</span>{t.showItemPrices && <span>السعر</span>}
              </div>
              <div className="space-y-2">
                {safeItems.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="opacity-80">
                      {item?.name}
                      {item?.size_name && String(item.size_name).trim() !== "" ? ` (${item.size_name})` : ""} x{Number(item?.quantity || 0)}
                    </span>
                    {t.showItemPrices && <span className="font-medium">{fmtMoney(Number(item?.price || 0) * Number(item?.quantity || 0))} {cur}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {(t.showSubtotal || t.showTax || t.showDiscount || t.showDeliveryFee || t.showServiceCharge) && (
            <div className="space-y-1.5 border-t border-slate-100 pt-3">
              {t.showSubtotal && <div className="flex justify-between text-sm"><span className="opacity-50">المجموع الفرعي</span><span>{fmtMoney(itemsTotal)} {cur}</span></div>}
              {t.showTax && taxVal > 0 && <div className="flex justify-between text-sm"><span className="opacity-50">الضريبة</span><span>{fmtMoney(taxVal)} {cur}</span></div>}
              {t.showServiceCharge && serviceVal > 0 && <div className="flex justify-between text-sm"><span className="opacity-50">رسوم الخدمة</span><span>{fmtMoney(serviceVal)} {cur}</span></div>}
              {t.showDiscount && discountVal > 0 && <div className="flex justify-between text-sm text-rose-600"><span>الخصم</span><span>-{fmtMoney(discountVal)} {cur}</span></div>}
              {t.showDeliveryFee && deliveryVal > 0 && <div className="flex justify-between text-sm"><span className="opacity-50">التوصيل</span><span>{fmtMoney(deliveryVal)} {cur}</span></div>}
            </div>
          )}
          {t.showGrandTotal && (
            <div className="flex justify-between font-black text-xl pt-3 border-t-2" style={{ borderTopColor: hBg }}>
              <span>الإجمالي</span>
              <span style={{ color: hBg === "#0f172a" ? "#4f46e5" : hBg }}>{fmtMoney(grandTotal)} {cur}</span>
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
      <div className="w-full max-w-[320px] mx-auto bg-white text-black font-serif p-8 border-4 border-double" style={{ borderColor: border, fontSize: `${t.fontSize}px`, fontWeight: t.fontWeight }}>
        <div className="text-center border-b-4 border-double pb-4 mb-4" style={borderStyle({ borderBottomWidth: "4px", borderBottomStyle: "double" })}>
          {t.showLogo && logoBlock}
          {t.showCompanyName && <h2 className="font-black text-2xl uppercase">{companyName}</h2>}
          {t.headerText && <p className="text-sm mt-1 opacity-70">{t.headerText}</p>}
          {t.showOrderNumber && <p className="font-bold mt-2">رقم الطلب: <span className="text-lg">{orderNumber}</span></p>}
          {t.showOrderType && <p className="text-2xl font-black mt-1">{typeLabel}</p>}
          {(t.showDate || t.showTime) && (
            <p className="text-sm opacity-60 mt-1">
              {t.showDate && t.showTime ? `${dateStr} — ${timeStr}` : t.showDate ? dateStr : timeStr}
            </p>
          )}
        </div>
        {infoRows}
        {t.showNotes && notesText && (
          <div className="mb-4 text-sm border-b-2 border-double pb-3 space-y-1" style={borderStyle({ borderBottomWidth: "3px", borderBottomStyle: "double" })}>
            <p className="font-bold">ملاحظات:</p>
            <p className="opacity-70">{notesText}</p>
          </div>
        )}
        {t.showItemsTable && itemsListBlock}
        {totalsBlock}
        {footerBlock}
      </div>
    );
  }

  /* ─── compact style ─── */
  if (s === "compact") {
    return (
      <div className="w-full max-w-[320px] mx-auto bg-white text-black p-4" style={{ fontSize: `${Math.max(t.fontSize - 2, 8)}px`, fontWeight: t.fontWeight }}>
        <div className="text-center border-b pb-2 mb-2" style={borderStyle()}>
          {t.showCompanyName && <p className="font-black">{companyName}</p>}
          {t.showOrderNumber && <p className="font-bold">#{orderNumber}</p>}
          {(t.showDate || t.showTime) && (
            <p className="text-xs opacity-60">
              {t.showDate && t.showTime ? `${dateStr} ${timeStr}` : t.showDate ? dateStr : timeStr}
            </p>
          )}
        </div>
        {t.showItemsTable && (
          <div className="space-y-1 mb-2">
            {safeItems.map((item, i) => (
              <div key={i} className="flex justify-between">
                <span className="opacity-80">{item?.name} x{Number(item?.quantity || 0)}</span>
                {t.showItemPrices && <span>{fmtMoney(Number(item?.price || 0) * Number(item?.quantity || 0))}</span>}
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-between font-bold pt-1 border-t" style={borderStyle()}>
          <span>الإجمالي</span><span>{fmtMoney(grandTotal)} {cur}</span>
        </div>
        {t.showPaymentMethod && <p className="text-center text-xs mt-1 opacity-50">{paymentLabel}</p>}
      </div>
    );
  }

  /* ─── elegant style ─── */
  if (s === "elegant") {
    return (
      <div className="w-full max-w-[320px] mx-auto bg-white text-black rounded-3xl overflow-hidden shadow-2xl" style={{ border: `2px solid ${border}`, fontSize: `${t.fontSize}px`, fontWeight: t.fontWeight }}>
        <div className="text-center p-6 text-white" style={{ background: `linear-gradient(135deg, ${hBg}, ${hBg}dd)` }}>
          {t.showLogo && (
            <div className="flex justify-center mb-2">
              {t.logoUrl ? (
                <img src={t.logoUrl} alt="" className="w-14 h-14 object-contain rounded-2xl" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-14 h-14 border-2 border-white/30 rounded-2xl flex items-center justify-center text-[10px] opacity-50">LOGO</div>
              )}
            </div>
          )}
          {t.showCompanyName && <h2 className="font-black text-2xl">{companyName}</h2>}
          {t.showOrderNumber && <p className="mt-1 bg-white/20 inline-block px-4 py-1 rounded-full text-sm font-bold">#{orderNumber}</p>}
          {t.showOrderType && <p className="text-xl font-black mt-2">{typeLabel}</p>}
          {(t.showDate || t.showTime) && (
            <p className="text-xs opacity-60 mt-1">
              {t.showDate && t.showTime ? `${dateStr} — ${timeStr}` : t.showDate ? dateStr : timeStr}
            </p>
          )}
        </div>
        <div className="p-6 space-y-4">
          {(t.showCashier || t.showCustomer || t.showTable) && (
            <div className="space-y-1 text-sm border-b pb-3" style={borderStyle()}>
              {t.showCashier && <div className="flex justify-between"><span className="opacity-50">الكاشير</span><span>{cashierName}</span></div>}
              {t.showTable && tableNumber && <div className="flex justify-between"><span className="opacity-50">الطاولة</span><span>{tableNumber}</span></div>}
              {t.showCustomer && customerName && <div className="flex justify-between"><span className="opacity-50">العميل</span><span className="font-bold">{customerName}</span></div>}
              {t.showDeliveryAddress && customerAddress && <div className="flex justify-between"><span className="opacity-50">العنوان</span><span>{customerAddress}</span></div>}
              {t.showPaymentMethod && <div className="flex justify-between"><span className="opacity-50">الدفع</span><span className="font-bold">{paymentLabel}</span></div>}
            </div>
          )}
          {t.showItemsTable && (
            <div>
              {safeItems.map((item, i) => (
                <div key={i} className="flex justify-between text-sm py-1.5 border-b" style={borderStyle({ borderBottomStyle: "dotted" })}>
                  <span className="opacity-80">
                    {item?.name}
                    {item?.size_name && String(item.size_name).trim() !== "" ? ` (${item.size_name})` : ""} x{Number(item?.quantity || 0)}
                  </span>
                  {t.showItemPrices && <span className="font-medium">{fmtMoney(Number(item?.price || 0) * Number(item?.quantity || 0))} {cur}</span>}
                </div>
              ))}
            </div>
          )}
          {t.showNotes && notesText && <div className="text-sm italic opacity-50 border-b pb-3" style={borderStyle()}>ملاحظات: {notesText}</div>}
          {(t.showSubtotal || t.showTax || t.showServiceCharge || t.showDiscount || t.showDeliveryFee) && (
            <div className="space-y-1 text-sm opacity-70">
              {t.showSubtotal && <div className="flex justify-between"><span>المجموع</span><span>{fmtMoney(itemsTotal)} {cur}</span></div>}
              {t.showTax && taxVal > 0 && <div className="flex justify-between"><span>الضريبة</span><span>{fmtMoney(taxVal)} {cur}</span></div>}
              {t.showServiceCharge && serviceVal > 0 && <div className="flex justify-between"><span>الخدمة</span><span>{fmtMoney(serviceVal)} {cur}</span></div>}
              {t.showDiscount && discountVal > 0 && <div className="flex justify-between text-rose-600"><span>الخصم</span><span>-{fmtMoney(discountVal)} {cur}</span></div>}
              {t.showDeliveryFee && deliveryVal > 0 && <div className="flex justify-between"><span>التوصيل</span><span>{fmtMoney(deliveryVal)} {cur}</span></div>}
            </div>
          )}
          {t.showGrandTotal && (
            <div className="flex justify-between font-black text-xl pt-3 mt-2 border-t-2" style={borderStyle()}>
              <span>الإجمالي النهائي</span><span style={{ color: hBg }}>{fmtMoney(grandTotal)} {cur}</span>
            </div>
          )}
          {t.showPaymentMethod && <p className="text-center font-bold mt-2 opacity-70">{paymentLabel}</p>}
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
    <div className="w-full max-w-[320px] mx-auto bg-white text-black p-8" style={{ fontSize: `${t.fontSize}px`, fontWeight: t.fontWeight }}>
      <div className="text-center border-b-2 border-dashed pb-4 mb-4" style={borderStyle()}>
        {t.showLogo && logoBlock}
        {t.showCompanyName && <h2 className="font-black text-xl uppercase">{companyName}</h2>}
        {t.headerText && <p className="text-sm mt-1 opacity-70">{t.headerText}</p>}
        {t.showOrderNumber && <p className="font-bold mt-2">رقم الطلب: {orderNumber}</p>}
        {t.showOrderType && <p className="text-2xl font-black mt-1">{typeLabel}</p>}
        {(t.showDate || t.showTime) && (
          <p className="text-sm opacity-60 mt-1">
            {t.showDate && t.showTime ? `${dateStr} — ${timeStr}` : t.showDate ? dateStr : timeStr}
          </p>
        )}
      </div>
      {infoRows}
      {t.showNotes && notesText && (
        <div className="mb-4 text-sm border-b border-dashed pb-2 space-y-1" style={borderStyle()}>
          <p className="font-bold">ملاحظات:</p>
          <p className="opacity-70">{notesText}</p>
        </div>
      )}
      {t.showItemsTable && itemsListBlock}
      {totalsBlock}
      {footerBlock}
    </div>
  );
};

/* ─────────────────────────── Modal Shell ─────────────────────────── */

export const POSReceiptModal: React.FC<POSReceiptModalProps> = ({
  orderId,
  config,
  cashierName = "كاشير",
  autoPrint = false,
  initialMode = "customer",
  onClose
}) => {
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [mode, setMode] = useState<"customer" | "internal">(initialMode);
  const autoPrintDone = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [orderRes, itemsRes, branchesRes] = await Promise.all([
          api.get(`/api/orders/${orderId}`),
          api.get(`/api/orders/${orderId}/items`),
          api.get(`/api/branches`)
        ]);

        if (cancelled) return;
        if (orderRes.ok) setOrder(await orderRes.json());
        if (itemsRes.ok) setItems((await itemsRes.json()) || []);
        if (branchesRes.ok) setBranches((await branchesRes.json()) || []);
      } catch (error) {
        console.error("Failed to load receipt data", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const activeTemplate = useMemo(() => {
    const id = mode === "internal"
      ? config.invoiceTemplates?.internalTemplateId
      : config.invoiceTemplates?.customerTemplateId;
    return resolveTemplate(config, id || "standard");
  }, [config, mode]);

  const branchName = useMemo(() => {
    if (!order?.branch_id) return "";
    const branch = branches.find((b) => Number(b.id) === Number(order.branch_id));
    return branch?.name || "";
  }, [branches, order]);

  useEffect(() => {
    if (loading || !order || autoPrintDone.current) return;
    autoPrintDone.current = true;
    if (autoPrint) {
      const timer = window.setTimeout(() => window.print(), 400);
      return () => window.clearTimeout(timer);
    }
  }, [loading, order, autoPrint]);

  return (
    <div
      role="dialog"
      className="fixed inset-0 z-[160] flex flex-col items-center overflow-y-auto bg-black/80 backdrop-blur-md p-4 printable-modal"
      dir="rtl"
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center text-white gap-3 mt-32">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
          <p className="font-bold text-sm">جاري تجهيز الإيصال...</p>
        </div>
      ) : !order ? (
        <div className="bg-white p-6 rounded-2xl max-w-sm w-full text-center mt-32">
          <p className="text-red-500 font-bold mb-4">عذراً، لم نتمكن من العثور على هذا الطلب.</p>
          <button onClick={onClose} className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition">
            إغلاق
          </button>
        </div>
      ) : (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-md flex flex-col gap-4 py-8"
        >
          {/* Screen-only controls */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 no-print shadow-xl">
            <div className="flex items-center gap-2 min-w-0">
              <Printer className="w-5 h-5 text-indigo-400 shrink-0" />
              <div className="min-w-0">
                <span className="font-bold block">طباعة الفاتورة #{orderId}</span>
                <span className="text-[10px] text-slate-400 block truncate">القالب: {activeTemplate.name}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex rounded-lg bg-slate-800 p-1 text-xs font-bold w-full sm:w-auto">
                <button
                  onClick={() => setMode("customer")}
                  className={`px-3 py-1.5 rounded-md transition-all flex-1 text-center whitespace-nowrap ${mode === "customer" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
                >
                  إيصال العميل
                </button>
                <button
                  onClick={() => setMode("internal")}
                  className={`px-3 py-1.5 rounded-md transition-all flex-1 text-center whitespace-nowrap ${mode === "internal" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
                >
                  إيصال داخلي
                </button>
              </div>

              <button
                onClick={() => window.print()}
                className="bg-indigo-600 hover:bg-indigo-500 p-2 text-white rounded-lg transition"
                title="طباعة"
              >
                <Printer className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="bg-slate-800 hover:bg-slate-700 p-2 text-white rounded-lg transition"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Real receipt rendered with the selected template */}
          <div className="receipt-content">
            <ReceiptTemplateView
              template={activeTemplate}
              order={order}
              items={items}
              branchName={branchName}
              cashierName={cashierName}
              currency={config.pricing?.currency || "ج.م"}
            />
          </div>
        </motion.div>
      )}
    </div>
  );
};
