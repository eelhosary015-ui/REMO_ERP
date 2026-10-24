import React, { useEffect, useMemo, useState } from "react";
import { X, Printer, Loader2 } from "lucide-react";
import { api } from "../utils/api";

interface SalesInvoicePrintModalProps {
  invoice: any;
  onClose: () => void;
}

const money = (value: any) =>
  Number(value || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const SalesInvoicePrintModal: React.FC<SalesInvoicePrintModalProps> = ({ invoice, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState({ name: "اسم الشركة", address: "", phone: "", taxNumber: "", logo: "" });
  const [customer, setCustomer] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const keys = ["company_name", "company_address", "company_phone", "company_tax_number", "receipt_logo"];
        const responses = await Promise.all(keys.map((key) => api.get(`/api/settings/${key}`)));
        const values: Record<string, string> = {};
        for (let i = 0; i < responses.length; i++) {
          if (responses[i].ok) {
            const data = await responses[i].json();
            values[keys[i]] = data?.value || "";
          }
        }
        if (!cancelled) {
          setCompany({
            name: values.company_name || invoice.companyName || "اسم الشركة",
            address: values.company_address || invoice.companyAddress || "",
            phone: values.company_phone || invoice.companyPhone || "",
            taxNumber: values.company_tax_number || invoice.companyTaxNumber || "",
            logo: values.receipt_logo || invoice.companyLogo || "",
          });
        }

        const customerId = invoice.customer_id || invoice.customerId;
        if (customerId) {
          const res = await api.get(`/api/customers/${customerId}`);
          if (res.ok && !cancelled) setCustomer(await res.json());
        }
      } catch (error) {
        console.error("Failed to load sales invoice print details", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [invoice]);

  const rows = useMemo(() => (Array.isArray(invoice.items) ? invoice.items : []), [invoice.items]);
  const subtotal = Number(invoice.total || invoice.subtotal || 0);
  const discount = Number(invoice.discount || invoice.discountAmount || 0);
  const taxable = Math.max(0, subtotal - discount);
  const tax = Number(invoice.tax || invoice.taxAmount || 0);
  const grandTotal = Number(invoice.netAmount ?? invoice.grandTotal ?? taxable + tax);
  // رقم المستند هو رقم الفاتورة الحقيقي؛ المعرّف الداخلي لا يُعرض كرقم فاتورة.
  const invoiceNumber =
    invoice.invoiceNo || invoice.invoice_number || invoice.invoiceNumber || `INV-${String(invoice.id).padStart(6, "0")}`;
  const date = invoice.date ? new Date(invoice.date).toLocaleDateString("ar-EG") : new Date().toLocaleDateString("ar-EG");

  const print = () => window.print();

  return (
    <div className="fixed inset-0 z-[180] bg-slate-900/80 backdrop-blur-sm overflow-y-auto p-4" dir="rtl">
      <div className="no-print mx-auto max-w-6xl mb-4 bg-slate-900 text-white rounded-2xl px-4 py-3 flex items-center justify-between gap-3 shadow-xl">
        <div className="font-black">معاينة فاتورة المبيعات — {invoiceNumber}</div>
        <div className="flex items-center gap-2">
          <button onClick={print} className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2"><Printer className="w-4 h-4" /> طباعة</button>
          <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 p-2 rounded-xl"><X className="w-5 h-5" /></button>
        </div>
      </div>

      {loading ? (
        <div className="text-white flex justify-center items-center gap-3 py-20"><Loader2 className="animate-spin" /> جاري تجهيز الفاتورة...</div>
      ) : (
        <div className="printable-report sales-invoice-report mx-auto max-w-6xl bg-white text-slate-900 rounded-xl shadow-2xl p-6 md:p-8" style={{ fontFamily: "Cairo, Arial, sans-serif" }}>
          <style>{`
            .sales-invoice-report { direction: rtl; }
            .sales-invoice-report * { box-sizing: border-box; }
            .sales-invoice-report .title { color:#17365d; font-size:38px; font-weight:900; letter-spacing:.5px; }
            .sales-invoice-report .section-title { background:#17365d; color:white; border-radius:7px; padding:6px 18px; display:inline-block; font-weight:900; }
            .sales-invoice-report .field { border-bottom:1px dotted #777; min-height:28px; display:flex; align-items:center; gap:8px; }
            .sales-invoice-report .field b { white-space:nowrap; }
            .sales-invoice-report .invoice-table th { background:#17365d !important; color:white !important; border:1px solid #17365d !important; text-align:center !important; padding:8px 5px !important; font-size:12px !important; }
            .sales-invoice-report .invoice-table td { border:1px solid #9ca3af !important; padding:7px 5px !important; font-size:11px !important; text-align:center !important; }
            .sales-invoice-report .total-table td { border:1px solid #9ca3af !important; padding:7px 10px !important; }
            @media print {
              @page { size: A4 portrait; margin: 7mm; }
              .sales-invoice-report { width:100% !important; max-width:none !important; margin:0 !important; padding:0 !important; border-radius:0 !important; box-shadow:none !important; }
              .sales-invoice-report .title { font-size:30px; }
              .sales-invoice-report .invoice-table th, .sales-invoice-report .invoice-table td { font-size:9px !important; padding:5px 3px !important; }
              .sales-invoice-report .field { min-height:23px; font-size:10px; }
              .sales-invoice-report .section-title { font-size:11px; }
              .sales-invoice-report .notes { min-height:80px !important; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
          `}</style>

          <div className="grid grid-cols-3 gap-5 items-start border-b-2 border-slate-300 pb-4">
            <div className="space-y-1 text-sm">
              <div className="field"><b>اسم الشركة:</b><span>{company.name}</span></div>
              <div className="field"><b>العنوان:</b><span>{company.address || invoice.companyAddress || ""}</span></div>
              <div className="field"><b>التليفون:</b><span>{company.phone || invoice.companyPhone || ""}</span></div>
              <div className="field"><b>الرقم الضريبي:</b><span>{company.taxNumber || invoice.companyTaxNumber || ""}</span></div>
            </div>
            <div className="text-center pt-2">
              <div className="title">فاتورة مبيعات</div>
              {company.logo && <img src={company.logo} alt="Company Logo" className="h-12 max-w-36 object-contain mx-auto mt-1" />}
            </div>
            <div className="space-y-1 text-sm">
              <div className="field"><b>رقم الفاتورة:</b><span>{invoiceNumber}</span></div>
              <div className="field"><b>التاريخ:</b><span>{date}</span></div>
              <div className="field"><b>رقم الطلب / المرجع:</b><span>{invoice.order_number || invoice.orderId || invoice.reference || ""}</span></div>
              <div className="field"><b>طريقة الدفع:</b><span>{invoice.paymentMethod || invoice.payment_method || ""}</span></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mt-4">
            <section>
              <div className="section-title mb-2">بيانات العميل</div>
              <div className="space-y-1 text-sm">
                <div className="field"><b>اسم العميل:</b><span>{customer?.name || invoice.customerName || ""}</span></div>
                <div className="field"><b>العنوان:</b><span>{customer?.address || invoice.customerAddress || ""}</span></div>
                <div className="field"><b>التليفون:</b><span>{customer?.phone || invoice.customerPhone || ""}</span></div>
                <div className="field"><b>الرقم الضريبي:</b><span>{customer?.tax_number || customer?.taxNumber || invoice.customerTaxNumber || ""}</span></div>
              </div>
            </section>
            <section>
              <div className="section-title mb-2">بيانات الشحن</div>
              <div className="space-y-1 text-sm">
                <div className="field"><b>جهة الاستلام:</b><span>{invoice.shippingParty || invoice.shipping_party || invoice.customerName || ""}</span></div>
                <div className="field"><b>العنوان:</b><span>{invoice.shippingAddress || invoice.shipping_address || ""}</span></div>
                <div className="field"><b>التليفون:</b><span>{invoice.shippingPhone || invoice.shipping_phone || ""}</span></div>
              </div>
            </section>
          </div>

          <table className="invoice-table w-full mt-5 border-collapse">
            <thead><tr>
              <th>م</th><th>كود الصنف</th><th>اسم الصنف</th><th>البيان / المواصفات</th><th>الوحدة</th><th>الكمية</th><th>سعر الوحدة (جنيه)</th><th>الإجمالي (جنيه)</th>
            </tr></thead>
            <tbody>
              {Array.from({ length: Math.max(10, rows.length) }).map((_, idx) => {
                const item = rows[idx];
                const qty = Number(item?.quantity ?? item?.qty ?? 0);
                const price = Number(item?.price ?? item?.unitPrice ?? 0);
                const total = Number(item?.total ?? qty * price);
                return <tr key={idx} style={{ height: rows.length > 10 ? 30 : 25 }}>
                  <td>{idx + 1}</td><td>{item?.code || item?.itemCode || ""}</td><td className="text-right">{item?.name || item?.itemName || ""}</td><td className="text-right">{item?.description || item?.specifications || ""}</td><td>{item?.unit || "قطعة"}</td><td>{qty || ""}</td><td>{price ? money(price) : ""}</td><td>{total ? money(total) : ""}</td>
                </tr>;
              })}
            </tbody>
          </table>

          <div className="grid grid-cols-12 gap-5 mt-2">
            <div className="col-span-4">
              <table className="total-table w-full border-collapse text-sm">
                <tbody>
                  <tr><td className="font-black bg-slate-100">إجمالي الفاتورة قبل الخصم</td><td className="text-center font-bold">{money(subtotal)}</td></tr>
                  <tr><td className="font-black bg-slate-100">الخصم</td><td className="text-center">{money(discount)}</td></tr>
                  <tr><td className="font-black bg-slate-100">الصافي قبل الضريبة</td><td className="text-center">{money(taxable)}</td></tr>
                  <tr><td className="font-black bg-slate-100">قيمة الضريبة {invoice.taxRate ? `(${invoice.taxRate}%)` : ""}</td><td className="text-center">{money(tax)}</td></tr>
                  <tr><td className="font-black bg-slate-100">إجمالي الفاتورة</td><td className="text-center font-black text-lg">{money(grandTotal)}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="col-span-8 border border-slate-400 rounded-xl p-3 notes min-h-[120px]">
              <div className="font-black mb-2">ملاحظات:</div>
              <div className="text-sm leading-7 whitespace-pre-wrap">{invoice.notes || ""}</div>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-3 mt-5">
            {["إعداد", "مراجعة", "مدير المبيعات", "المدير المالي", "استلام العميل"].map((role) => (
              <div key={role} className="border border-slate-400 rounded-xl p-3 min-h-[82px] text-sm">
                <div className="font-black mb-3">{role}</div>
                <div className="field"><b>الاسم:</b><span></span></div>
                <div className="field"><b>التوقيع:</b><span></span></div>
              </div>
            ))}
          </div>
          <div className="text-center mt-4 text-sm font-black text-slate-700">البضاعة المباعة لا ترد ولا تستبدل إلا في حالة وجود عيب مصنعي خلال 7 أيام من تاريخ الفاتورة</div>
          <div className="text-center mt-2 text-xs text-slate-500">شكراً لتعاملكم معنا</div>
        </div>
      )}
    </div>
  );
};
