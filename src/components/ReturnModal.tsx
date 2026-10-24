import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Search,
  ArrowRightLeft,
  CheckCircle,
  Printer,
  Save,
  ShieldCheck,
  User,
  Building2,
  FileText,
  CalendarDays,
  Hash,
  Package,
  DollarSign,
  AlertTriangle,
  Clock,
  RotateCcw,
  Loader2,
  Sparkles,
  ChevronLeft,
  Ban,
  Eye,
} from "lucide-react";
import { api } from "../utils/api";

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */
interface ReturnItem {
  id: number;
  ingredient_id?: number;
  ingredient_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  return_quantity: number;
  current_warehouse_stock?: number;
  available_warehouse_stock?: number;
  reason: string;
  notes: string;
}

interface RejectionDetails {
  title: string;
  message: string;
  items: Array<{
    ingredient_id?: number;
    name: string;
    unit: string;
    requested_quantity: number;
    available_quantity: number;
    deficit: number;
    reason: string;
  }>;
}

interface ReturnModalProps {
  onClose: () => void;
  onConfirm: (returnData: any) => void;
  editMode?: boolean;
  initialData?: any;
}

const RETURN_REASONS = [
  { value: "manufacturing_defect", label: "عيب مصنعي", color: "text-red-600" },
  { value: "excess_quantity", label: "كمية زائدة", color: "text-blue-600" },
  { value: "wrong_spec", label: "غير مطابق للمواصفات", color: "text-purple-600" },
  { value: "expired", label: "منتهي الصلاحية", color: "text-orange-600" },
  { value: "damaged_transport", label: "تلف أثناء النقل", color: "text-amber-600" },
  { value: "price_dispute", label: "خلاف على السعر", color: "text-cyan-600" },
  { value: "duplicate_delivery", label: "تكرار التسليم", color: "text-indigo-600" },
  { value: "other", label: "أخرى", color: "text-slate-600" },
];

/* ─────────────────────────────────────────────
   Component
   ───────────────────────────────────────────── */
export function ReturnModal({ onClose, onConfirm, initialData, editMode = false }: ReturnModalProps) {
  /* ── state ── */
  const [invoices, setInvoices] = useState<any[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<any[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [filterText, setFilterText] = useState("");
  const [activeStep, setActiveStep] = useState<"search" | "form">("search");
  const [returnNumber, setReturnNumber] = useState("");
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split("T")[0]);
  const [status, setStatus] = useState<"draft" | "pending" | "approved">("draft");
  const [notes, setNotes] = useState("");
  const [itemsToReturn, setItemsToReturn] = useState<Record<number, ReturnItem>>({});
  const [removedItemIds, setRemovedItemIds] = useState<Set<number>>(new Set());
  const [rejectionData, setRejectionData] = useState<RejectionDetails | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [fadeIn, setFadeIn] = useState(false);
  const [savedReturnId, setSavedReturnId] = useState<number | null>(null);
  const saveKeyRef = useRef<string>("");
  const overlayRef = useRef<HTMLDivElement>(null);

  if (!saveKeyRef.current) {
    saveKeyRef.current = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : `RET-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  /* ── animations ── */
  useEffect(() => {
    requestAnimationFrame(() => setFadeIn(true));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving && !rejectionData) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isSaving, rejectionData, onClose]);

  /* ── data ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      await fetchInvoices();
      if (cancelled) return;
      await generateReturnNumber();
      if (editMode && initialData) {
        await loadInitialData(initialData);
      }
      if (!cancelled) setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [editMode, initialData]);

  const fetchInvoices = async () => {
    try {
      const res = await api.get("/api/purchases");
      if (res.ok) {
        const data = await res.json();
        setInvoices(data);
        setFilteredInvoices(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const generateReturnNumber = async () => {
    try {
      const res = await api.get("/api/returns/next-number");
      if (res.ok) {
        const data = await res.json();
        setReturnNumber(data.next_number || data.number);
        return;
      }
    } catch { /* fallback */ }
    setReturnNumber(`RET-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`);
  };

  const loadInitialData = async (data: any) => {
    try {
      // The returns list endpoint intentionally returns a flat row and does not
      // include a nested `invoice` object. The old viewer passed undefined to
      // selectedInvoice, then the form rendered selectedInvoice.supplier_name
      // and React crashed to a white screen. Resolve the full return + invoice
      // before switching to the form view.
      let fullReturn = data;
      const returnId = Number(data?.id);
      if (returnId > 0 && (!Array.isArray(data?.items) || !data?.items?.length)) {
        const returnRes = await api.get(`/api/returns/${returnId}`);
        if (returnRes.ok) fullReturn = await returnRes.json();
      }

      let invoice: any = fullReturn?.invoice || null;
      const purchaseId = Number(fullReturn?.purchase_id || data?.purchase_id || 0);
      if (purchaseId > 0) {
        const purchaseRes = await api.get(`/api/purchases/${purchaseId}`);
        if (purchaseRes.ok) invoice = await purchaseRes.json();
      }

      // Safe fallback for old records if the linked purchase was deleted.
      if (!invoice) {
        invoice = {
          id: purchaseId || undefined,
          invoice_number: fullReturn?.invoice_number || data?.invoice_number || "-",
          supplier_id: fullReturn?.supplier_id || data?.supplier_id,
          supplier_name: fullReturn?.supplier_name || data?.supplier_name || "غير محدد",
          warehouse_id: fullReturn?.warehouse_id || data?.warehouse_id,
          warehouse_name: fullReturn?.warehouse_name || data?.warehouse_name || "غير محدد",
          purchase_order_number: fullReturn?.purchase_order_number || data?.purchase_order_number,
          total: Number(fullReturn?.invoice_total || fullReturn?.total || 0),
          items: [],
        };
      }

      const returnRows = Array.isArray(fullReturn?.items) ? fullReturn.items : [];
      const invoiceRows = Array.isArray(invoice?.items) ? invoice.items : [];

      // Merge return quantities onto the original invoice item ids. This keeps
      // the form stable even though purchase_return_items have their own ids.
      const mergedItems = invoiceRows.map((invItem: any) => {
        const returned = returnRows.find((r: any) =>
          Number(r.ingredient_id || r.id || 0) === Number(invItem.ingredient_id || invItem.id || 0)
        );
        return {
          ...invItem,
          return_quantity: Number(returned?.return_quantity ?? returned?.quantity ?? 0),
          reason: returned?.reason || "",
          notes: returned?.notes || "",
        };
      });

      // If the invoice has no items, still show the saved return items.
      const finalItems = mergedItems.length > 0
        ? mergedItems
        : returnRows.map((item: any, index: number) => ({
            ...item,
            id: Number(item.id || item.ingredient_id || index + 1),
            ingredient_id: item.ingredient_id || item.id,
            ingredient_name: item.ingredient_name || item.name || "صنف",
            unit: item.unit || "قطعة",
            quantity: Number(item.original_quantity ?? item.quantity ?? item.return_quantity ?? 0),
            unit_price: Number(item.unit_price || 0),
            return_quantity: Number(item.return_quantity ?? item.quantity ?? 0),
          }));

      invoice = { ...invoice, items: finalItems };

      setSelectedInvoice(invoice);
      setReturnNumber(fullReturn?.return_number || data?.return_number || "");
      setReturnDate(fullReturn?.date || fullReturn?.return_date || data?.date || new Date().toISOString().split("T")[0]);
      setStatus(fullReturn?.status || data?.status || "draft");
      setSavedReturnId(Number(fullReturn?.id || data?.id) || null);
      setNotes(fullReturn?.notes || data?.notes || "");
      setActiveStep("form");

      const map: Record<number, ReturnItem> = {};
      finalItems.forEach((item: any) => {
        const qty = Number(item.return_quantity || 0);
        if (qty > 0) {
          map[Number(item.id)] = {
            ...item,
            id: Number(item.id),
            ingredient_id: Number(item.ingredient_id || item.id),
            return_quantity: qty,
            quantity: Number(item.quantity || 0),
            unit_price: Number(item.unit_price || 0),
          };
        }
      });
      setItemsToReturn(map);
      setRemovedItemIds(new Set());
      setRejectionData(null);
    } catch (error) {
      console.error("Failed to load purchase return details", error);
      // Never leave the modal in a crash state. Show the saved row with a
      // minimal invoice shell so the user can at least inspect it.
      const fallbackInvoice = {
        id: Number(data?.purchase_id) || undefined,
        invoice_number: data?.invoice_number || "-",
        supplier_id: data?.supplier_id,
        supplier_name: data?.supplier_name || "غير محدد",
        warehouse_id: data?.warehouse_id,
        warehouse_name: data?.warehouse_name || "غير محدد",
        total: Number(data?.total_amount || 0),
        items: Array.isArray(data?.items) ? data.items : [],
      };
      setSelectedInvoice(fallbackInvoice);
      setReturnNumber(data?.return_number || "");
      setReturnDate(data?.date || data?.return_date || new Date().toISOString().split("T")[0]);
      setStatus(data?.status || "draft");
      setSavedReturnId(Number(data?.id) || null);
      setNotes(data?.notes || "");
      setActiveStep("form");
    }
  };

  /* ── handlers ── */
  const handleFilter = useCallback((text: string) => {
    setFilterText(text);
    setFilteredInvoices(
      invoices.filter(
        (inv) =>
          inv.invoice_number?.includes(text) ||
          inv.supplier_name?.includes(text) ||
          inv.purchase_order_number?.includes(text)
      )
    );
  }, [invoices]);

  const handleSelectInvoice = async (invoice: any) => {
    setFadeIn(false);
    setIsLoading(true);
    try {
      let invoiceWithItems = invoice;
      // Always fetch full details to get current warehouse stock per item
      const res = await api.get(`/api/purchases/${invoice.id}`);
      if (res.ok) {
        invoiceWithItems = await res.json();
      }
      setSelectedInvoice(invoiceWithItems);
      setItemsToReturn({});
      setRemovedItemIds(new Set());
      setRejectionData(null);
      setTimeout(() => {
        setActiveStep("form");
        requestAnimationFrame(() => setFadeIn(true));
      }, 150);
    } catch (error) {
      console.error("Failed to load purchase invoice details", error);
      setSelectedInvoice(invoice);
      setActiveStep("form");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToSearch = () => {
    setItemsToReturn({});
    setRemovedItemIds(new Set());
    setRejectionData(null);
    setFadeIn(false);
    setTimeout(() => {
      setActiveStep("search");
      requestAnimationFrame(() => setFadeIn(true));
    }, 150);
  };

  const handleItemChange = (
    itemId: number,
    field: "return_quantity" | "reason" | "notes",
    value: string | number
  ) => {
    setItemsToReturn((prev) => {
      const existing = prev[itemId];
      const item = selectedInvoice?.items?.find((i: any) => i.id === itemId);

      if (field === "return_quantity") {
        const qty = Number(value);
        if (qty <= 0 && !existing) return prev;
        if (qty <= 0) {
          const next = { ...prev };
          delete next[itemId];
          return next;
        }
        return {
          ...prev,
          [itemId]: {
            ...existing,
            ...item,
            id: itemId,
            ingredient_id: item?.ingredient_id || item?.id,
            ingredient_name: item?.ingredient_name || item?.name || existing?.ingredient_name,
            unit: item?.unit || existing?.unit || "قطعة",
            unit_price: Number(item?.unit_price || existing?.unit_price || 0),
            quantity: Number(item?.quantity || existing?.quantity || 0),
            return_quantity: Math.min(qty, item?.quantity || 0),
            current_warehouse_stock: item?.current_warehouse_stock ?? existing?.current_warehouse_stock,
            available_warehouse_stock: item?.available_warehouse_stock ?? existing?.available_warehouse_stock,
            reason: existing?.reason || "",
            notes: existing?.notes || "",
          },
        };
      }

      if (!existing) return prev;
      return { ...prev, [itemId]: { ...existing, [field]: value } };
    });
  };

  // Automatically adjust return quantities to match available warehouse stock
  const handleAutoAdjustQuantities = () => {
    setItemsToReturn((prev) => {
      const next: Record<number, ReturnItem> = {};
      Object.entries(prev).forEach(([key, it]) => {
        const id = Number(key);
        const originalItem = selectedInvoice?.items?.find((i: any) => i.id === id);
        const available = Number(originalItem?.available_warehouse_stock ?? it.available_warehouse_stock ?? 0);
        if (available > 0) {
          next[id] = {
            ...it,
            return_quantity: Math.min(it.return_quantity, available),
          };
        }
      });
      return next;
    });
    setRejectionData(null);
  };

  /* ── computed ── */
  const returnItemsList = (Object.values(itemsToReturn) as ReturnItem[]).filter(i => i.return_quantity > 0);
  const totalQuantity = returnItemsList.reduce((s: number, i: ReturnItem) => s + i.return_quantity, 0);
  const subtotalAmount = returnItemsList.reduce((s: number, i: ReturnItem) => s + i.return_quantity * i.unit_price, 0);

  // Derive tax rate from selected invoice
  const invoiceSubtotal = Number(selectedInvoice?.subtotal || (Number(selectedInvoice?.total_amount || selectedInvoice?.total || 0) - Number(selectedInvoice?.tax_amount || 0)));
  const invoiceTaxAmount = Number(selectedInvoice?.tax_amount || 0);
  const invoiceTaxRate = Number(selectedInvoice?.tax_rate || 0) > 0
    ? Number(selectedInvoice.tax_rate)
    : (invoiceTaxAmount > 0 && invoiceSubtotal > 0
        ? Math.round((invoiceTaxAmount / invoiceSubtotal) * 10000) / 100
        : 0);

  const taxAmount = invoiceTaxRate > 0
    ? Math.round((subtotalAmount * (invoiceTaxRate / 100)) * 100) / 100
    : 0;
  const totalAmount = Math.round((subtotalAmount + taxAmount) * 100) / 100;
  const itemsCount = returnItemsList.length;
  const invoiceTotal = Number(selectedInvoice?.total_amount || selectedInvoice?.total || 0);
  const returnPct = invoiceTotal > 0 ? (totalAmount / invoiceTotal) * 100 : 0;

  const getStatusMeta = (s: string) => {
    const map: Record<string, { label: string; cls: string; icon: any; dot: string }> = {
      approved: { label: "معتمد", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200", icon: ShieldCheck, dot: "bg-emerald-500" },
      pending:  { label: "قيد المراجعة", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200", icon: Clock, dot: "bg-amber-500" },
      draft:    { label: "مسودة", cls: "bg-slate-100 text-slate-600 ring-1 ring-slate-200", icon: FileText, dot: "bg-slate-400" },
    };
    return map[s] || map.draft;
  };

  const statusMeta = getStatusMeta(status);
  const StatusIcon = statusMeta.icon;

  /* ── save / approve ── */
  const handleSave = async (saveStatus: "draft" | "pending" | "approved") => {
    if (itemsCount === 0 || isSaving) return;

    // ═══ CLIENT-SIDE PRE-VALIDATION ON APPROVAL ═══
    if (saveStatus === "approved") {
      const rejectedOnClient: Array<{
        ingredient_id?: number;
        name: string;
        unit: string;
        requested_quantity: number;
        available_quantity: number;
        deficit: number;
        reason: string;
      }> = [];

      for (const it of returnItemsList) {
        const originalItem = selectedInvoice?.items?.find((i: any) => i.id === it.id);
        const available = originalItem?.available_warehouse_stock !== undefined
          ? Number(originalItem.available_warehouse_stock)
          : (it.available_warehouse_stock !== undefined ? Number(it.available_warehouse_stock) : null);

        if (available !== null) {
          if (available <= 0) {
            rejectedOnClient.push({
              ingredient_id: it.ingredient_id || it.id,
              name: it.ingredient_name || "صنف",
              unit: it.unit || "قطعة",
              requested_quantity: it.return_quantity,
              available_quantity: 0,
              deficit: it.return_quantity,
              reason: "تم استهلاك أو بيع كامل كمية الصنف من المخزن (الرصيد المتاح: 0)"
            });
          } else if (available < it.return_quantity) {
            rejectedOnClient.push({
              ingredient_id: it.ingredient_id || it.id,
              name: it.ingredient_name || "صنف",
              unit: it.unit || "قطعة",
              requested_quantity: it.return_quantity,
              available_quantity: available,
              deficit: it.return_quantity - available,
              reason: `الرصيد المتاح بالمخزن (${available} ${it.unit || "قطعة"}) غير كافٍ لإرجاع الكمية (${it.return_quantity} ${it.unit || "قطعة"}) نظراً لاستهلاك أو بيع جزء منه`
            });
          }
        }
      }

      if (rejectedOnClient.length > 0) {
        setRejectionData({
          title: "تم رفض اعتماد وحفظ المرتجع",
          message: "لا يمكن اعتماد وحفظ المرتجع لأن بعض الأصناف تم استهلاكها أو بيعها أو غير متوفرة في المخزن بالكمية المطلوبة:",
          items: rejectedOnClient,
        });
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        idempotency_key: saveKeyRef.current,
        return_number: returnNumber,
        date: returnDate,
        return_date: returnDate,
        status: saveStatus,
        notes,
        purchase_id: selectedInvoice?.id,
        purchase_invoice_id: selectedInvoice?.id,
        supplier_id: selectedInvoice?.supplier_id,
        supplier_name: selectedInvoice?.supplier_name,
        warehouse_id: selectedInvoice?.warehouse_id,
        warehouse_name: selectedInvoice?.warehouse_name,
        subtotal: subtotalAmount,
        tax_rate: invoiceTaxRate,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        items: returnItemsList.map(item => {
          const lineSub = Math.round(item.return_quantity * item.unit_price * 100) / 100;
          const lineTax = invoiceTaxRate > 0 ? Math.round((lineSub * (invoiceTaxRate / 100)) * 100) / 100 : 0;
          return {
            ...item,
            ingredient_id: item.ingredient_id || item.id,
            warehouse_id: selectedInvoice?.warehouse_id,
            quantity: item.return_quantity,
            return_quantity: item.return_quantity,
            unit_price: item.unit_price,
            subtotal: lineSub,
            tax_rate: invoiceTaxRate,
            tax_amount: lineTax,
            total_price: Math.round((lineSub + lineTax) * 100) / 100
          };
        }),
        totals: {
          quantity: totalQuantity,
          subtotal: subtotalAmount,
          tax_rate: invoiceTaxRate,
          tax_amount: taxAmount,
          amount: totalAmount,
          total_amount: totalAmount,
          items_count: itemsCount
        },
      };

      const existingId = savedReturnId || (editMode ? Number(initialData?.id) : null);
      const usePut = !!existingId;
      const url = usePut ? `/api/returns/${existingId}` : "/api/returns";
      const res = await (usePut ? api.put(url, payload) : api.post(url, payload));
      const data = await res.json().catch(() => ({}));

      if (res.ok && !data.rejected) {
        if (data.id) setSavedReturnId(Number(data.id));
        setStatus(saveStatus);
        setShowSuccess(true);
        setTimeout(() => onConfirm(payload), 1800);
      } else {
        // SERVER-SIDE REJECTION
        if (data.rejected || res.status === 400) {
          const rejectedItems = Array.isArray(data.rejected_items) && data.rejected_items.length > 0
            ? data.rejected_items
            : returnItemsList.map(it => ({
                ingredient_id: it.ingredient_id || it.id,
                name: it.ingredient_name,
                unit: it.unit || "قطعة",
                requested_quantity: it.return_quantity,
                available_quantity: it.available_warehouse_stock ?? 0,
                deficit: Math.max(0, it.return_quantity - (it.available_warehouse_stock ?? 0)),
                reason: data.error || data.message || "الرصيد غير متوفر بالمخزن"
              }));

          setRejectionData({
            title: "تم رفض اعتماد المرتجع من النظام",
            message: data.message || data.error || "تم رفض اعتماد وحفظ المرتجع لعدم كفاية رصيد الأصناف في المخزن (تم استهلاكها أو بيعها)",
            items: rejectedItems,
          });
        } else {
          alert(data.error || "حدث خطأ أثناء حفظ المرتجع");
        }
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message || "حدث خطأ غير متوقع");
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async () => {
    if (isSaving || isApproving || itemsCount === 0) return;
    setIsApproving(true);
    try {
      await handleSave("approved");
    } finally {
      setIsApproving(false);
    }
  };

  /* ── print ── */
  const handlePrint = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>مرتجع ${returnNumber}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
      <style>
        *{font-family:'Cairo',sans-serif;margin:0;padding:0;box-sizing:border-box}
        body{padding:48px;color:#1e293b;font-size:13px}
        .hdr{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #059669;padding-bottom:20px;margin-bottom:24px}
        .hdr h1{font-size:26px;color:#059669;margin-bottom:4px}
        .hdr .sub{color:#64748b;font-size:13px}
        .hdr .num{text-align:left}.hdr .num .l{color:#64748b;font-size:12px}.hdr .num .v{font-size:22px;font-weight:800}
        .grid4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:24px}
        .infobox{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px}
        .infobox .l{color:#94a3b8;font-size:11px;margin-bottom:4px}.infobox .v{font-weight:700}
        table{width:100%;border-collapse:collapse;margin-bottom:20px}
        th{background:#1e293b;color:#fff;padding:10px 12px;text-align:right;font-size:12px}
        td{border:1px solid #e2e8f0;padding:10px 12px}
        .ttl{background:#f8fafc;padding:16px;border-radius:10px;margin-top:20px}
        .ttl-r{display:flex;justify-content:space-between;margin-bottom:6px}
        .ttl-r.g{font-size:18px;font-weight:800;color:#059669;border-top:2px solid #059669;padding-top:10px;margin-top:10px}
      </style></head><body>
      <div class="hdr"><div><h1>مرتجع مشتريات</h1><div class="sub">إيصال مرتجع بضاعة لشركة ${selectedInvoice?.supplier_name}</div></div><div class="num"><div class="l">رقم المرتجع</div><div class="v">${returnNumber}</div></div></div>
      <div class="grid4">
        <div class="infobox"><div class="l">التاريخ</div><div class="v">${returnDate}</div></div>
        <div class="infobox"><div class="l">رقم الفاتورة الأصلية</div><div class="v">${selectedInvoice?.invoice_number}</div></div>
        <div class="infobox"><div class="l">أمر الشراء</div><div class="v">${selectedInvoice?.purchase_order_number || "—"}</div></div>
        <div class="infobox"><div class="l">المخزن</div><div class="v">${selectedInvoice?.warehouse_name || "المخزن الرئيسي"}</div></div>
      </div>
      <table><thead><tr><th>اسم الصنف</th><th>الوحدة</th><th>الكمية الأصلية</th><th>الكمية المرتجعة</th><th>السبب</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>
        ${(returnItemsList as ReturnItem[]).map((i: ReturnItem) => `<tr><td>${i.ingredient_name}</td><td>${i.unit || "قطعة"}</td><td>${i.quantity}</td><td>${i.return_quantity}</td><td>${RETURN_REASONS.find(r => r.value === i.reason)?.label || i.reason}</td><td>${i.unit_price.toFixed(2)}</td><td>${(i.return_quantity * i.unit_price).toFixed(2)}</td></tr>`).join("")}
      </tbody></table>
      <div class="ttl">
        <div class="ttl-r"><span>إجمالي الأصناف المرتجعة</span><span>${itemsCount}</span></div>
        <div class="ttl-r"><span>إجمالي الكمية المرتجعة</span><span>${totalQuantity}</span></div>
        <div class="ttl-r"><span>صافي المرتجع (قبل الضريبة)</span><span>${subtotalAmount.toFixed(2)} ج.م</span></div>
        ${invoiceTaxRate > 0 ? `<div class="ttl-r"><span>ضريبة القيمة المضافة (${invoiceTaxRate}%)</span><span>${taxAmount.toFixed(2)} ج.م</span></div>` : ""}
        <div class="ttl-r g"><span>إجمالي القيمة المستردة للمورد (شامل الضريبة)</span><span>${totalAmount.toFixed(2)} ج.م</span></div>
      </div>
      <div style="margin-top:40px;display:flex;justify-content:space-between;text-align:center">
        <div style="width:200px;border-top:1px solid #94a3b8;padding-top:8px">توقيع المستلم</div>
        <div style="width:200px;border-top:1px solid #94a3b8;padding-top:8px">توقيع أمين المخزن</div>
        <div style="width:200px;border-top:1px solid #94a3b8;padding-top:8px">مدير المشتريات</div>
      </div>
      </body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <div 
      className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-all duration-300 ${fadeIn ? "opacity-100" : "opacity-0"}`}
      dir="rtl"
      ref={overlayRef}
    >
      <div className={`bg-white rounded-[32px] w-full max-w-7xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden transition-all duration-500 transform ${fadeIn ? "scale-100 translate-y-0" : "scale-95 translate-y-8"}`}>
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-500 p-6 text-white relative">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                <ArrowRightLeft className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight">إنشاء مرتجع مشتريات</h2>
                <p className="text-emerald-100/80 text-sm font-medium mt-0.5">سجل المرتجعات وإدارة المخزون بدقة</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold shadow-inner ${statusMeta.cls}`}>
                <div className={`w-2 h-2 rounded-full ${statusMeta.dot} animate-pulse`} />
                <StatusIcon className="w-4 h-4" />
                {statusMeta.label}
              </div>
              <button 
                onClick={onClose}
                className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl transition-all active:scale-90"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
          
          {/* Decorative wave */}
          <div className="absolute -bottom-px left-0 right-0 h-4 bg-white rounded-t-full" />
        </div>

        {/* Steps */}
        <div className="px-8 py-4 bg-white flex items-center gap-3 border-b border-slate-100">
          <button 
            onClick={handleBackToSearch}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-sm font-black transition-all ${
              activeStep === "search" 
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200" 
                : "bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <Search className="w-4 h-4" />
            1. اختيار الفاتورة
          </button>
          <ChevronLeft className="w-5 h-5 text-slate-300" />
          <button 
            disabled={!selectedInvoice}
            onClick={() => setActiveStep("form")}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-sm font-black transition-all ${
              activeStep === "form" 
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200" 
                : !selectedInvoice 
                  ? "bg-slate-50 text-slate-300 cursor-not-allowed opacity-60" 
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <Package className="w-4 h-4" />
            2. تحديد الأصناف المرتجعة
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto bg-slate-50/50">
          {/* Workflow */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 md:gap-4 text-xs font-black">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${activeStep === "search" ? "bg-emerald-600 text-white shadow-md" : "bg-white text-slate-500 border border-slate-200"}`}>
              <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">1</span> اختيار الفاتورة
            </div>
            <div className="w-8 h-px bg-slate-300" />
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${activeStep === "form" ? "bg-emerald-600 text-white shadow-md" : "bg-white text-slate-500 border border-slate-200"}`}>
              <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">2</span> تحديد الكميات
            </div>
            <div className="w-8 h-px bg-slate-300" />
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${status === "approved" ? "bg-emerald-600 text-white shadow-md" : "bg-white text-slate-500 border border-slate-200"}`}>
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">3</span> الاعتماد والخصم من المخزن
            </div>
          </div>
        </div>

        {activeStep === "search" ? (
            <div className="p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="max-w-2xl mx-auto mb-8">
                <div className="relative group">
                  <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                  <input 
                    type="text" 
                    placeholder="ابحث برقم الفاتورة، اسم المورد، أو رقم أمر الشراء..."
                    className="w-full pr-14 pl-6 py-5 bg-white rounded-[24px] border-2 border-slate-200 focus:border-emerald-500 outline-none shadow-sm text-lg font-bold text-slate-700 transition-all placeholder:text-slate-400"
                    value={filterText}
                    onChange={(e) => handleFilter(e.target.value)}
                  />
                  {filterText && (
                    <button 
                      onClick={() => handleFilter("")}
                      className="absolute left-5 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl overflow-hidden">
                <table className="w-full text-right text-sm">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="p-5 font-black">رقم الفاتورة</th>
                      <th className="p-5 font-black">التاريخ</th>
                      <th className="p-5 font-black">المورد</th>
                      <th className="p-5 font-black">أمر الشراء</th>
                      <th className="p-5 font-black">الإجمالي</th>
                      <th className="p-5 font-black">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.length > 0 ? filteredInvoices.map((inv) => (
                      <tr key={inv.id} className="border-t border-slate-100 hover:bg-emerald-50/50 transition-colors group">
                        <td className="p-5">
                          <span className="font-black text-slate-800 bg-slate-100 px-3 py-1 rounded-lg group-hover:bg-white transition-colors uppercase">
                            {inv.invoice_number}
                          </span>
                        </td>
                        <td className="p-5 text-slate-600 font-bold">
                          {new Date(inv.date).toLocaleDateString("ar-EG")}
                        </td>
                        <td className="p-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                              <Building2 className="w-5 h-5" />
                            </div>
                            <span className="font-black text-slate-700">{inv.supplier_name}</span>
                          </div>
                        </td>
                        <td className="p-5 text-slate-500 font-bold">{inv.purchase_order_number || "—"}</td>
                        <td className="p-5">
                          <div className="font-black text-slate-900">{Number(inv.total || 0 || 0).toLocaleString()} <span className="text-[11px] text-slate-400">ج.م</span></div>
                        </td>
                        <td className="p-5">
                          <button 
                            onClick={() => handleSelectInvoice(inv)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-2xl font-black text-sm shadow-lg shadow-emerald-200 transition-all active:scale-95 flex items-center gap-2"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                            اختيار
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={6} className="p-20 text-center text-slate-400">
                          <Search className="w-16 h-16 mx-auto mb-4 opacity-10" />
                          <p className="text-xl font-bold">لم نجد أي فواتير مطابقة لهذا البحث</p>
                          <p className="text-sm mt-1">تأكد من كتابة رقم الفاتورة أو اسم المورد بشكل صحيح</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col h-full">
              {/* Summary Cards */}
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-4">
                <div className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 text-emerald-100 transform translate-x-2 -translate-y-2 group-hover:scale-110 transition-transform">
                    <Hash className="w-16 h-16" />
                  </div>
                  <div className="text-slate-400 text-xs font-black mb-1 text-right">رقم المرتجع</div>
                  <div className="text-xl font-black text-slate-900 uppercase tracking-tight text-right">{returnNumber}</div>
                </div>
                
                <div className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm">
                  <div className="text-slate-400 text-xs font-black mb-1 text-right">تاريخ المرتجع</div>
                  <input 
                    type="date" 
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full text-lg font-black text-slate-800 outline-none bg-emerald-50/50 p-1.5 rounded-lg border border-emerald-100 text-right"
                  />
                </div>

                <div className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm">
                  <div className="text-slate-400 text-xs font-black mb-1 text-right">المورد المستهدف</div>
                  <div className="text-lg font-black text-slate-900 truncate text-right">{selectedInvoice.supplier_name}</div>
                  <div className="text-[10px] text-slate-400 font-bold mt-0.5 text-right">فاتورة مرجعية: {selectedInvoice.invoice_number}</div>
                </div>

                <div className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-amber-600 font-black text-lg">{returnPct.toFixed(1)}%</div>
                    <div className="text-slate-400 text-xs font-black">نسبة الإرجاع</div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner">
                    <div 
                      className={`h-full transition-all duration-1000 ease-out rounded-full ${returnPct > 50 ? "bg-red-500" : "bg-amber-500"}`}
                      style={{ width: `${Math.min(returnPct, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Items Section */}
              <div className="px-8 flex-1 flex flex-col min-h-0">
                <div className="bg-white rounded-[28px] border border-slate-200 shadow-xl flex-1 flex flex-col overflow-hidden">
                  <div className="p-5 flex justify-between items-center border-b border-slate-100 bg-slate-50/50">
                    <div className="flex gap-2">
                       <span className="bg-white px-4 py-1.5 rounded-xl border border-slate-200 text-xs font-black text-slate-500">
                         {selectedInvoice.items?.length || 0} صنف متاح
                       </span>
                       <span className="bg-emerald-600 px-4 py-1.5 rounded-xl text-xs font-black text-white shadow-lg shadow-emerald-200">
                         {itemsCount} صنف تم إرجاعه
                       </span>
                    </div>
                    <h3 className="font-black text-slate-800 flex items-center gap-2">
                       قائمة الأصناف بالفاتورة
                       <Sparkles className="w-5 h-5 text-amber-500" />
                    </h3>
                  </div>

                  <div className="flex-1 overflow-auto">
                    <table className="w-full text-right table-fixed text-sm">
                      <thead className="bg-slate-900 text-white sticky top-0 z-20">
                        <tr>
                          <th className="p-4 font-black w-10 text-center">#</th>
                          <th className="p-4 font-black w-1/4">اسم الصنف</th>
                          <th className="p-4 font-black text-center w-24">الكمية بالفاتورة</th>
                          <th className="p-4 font-black text-center w-36">رصيد المخزن المتاح</th>
                          <th className="p-4 font-black text-center w-32">كمية المرتجع</th>
                          <th className="p-4 font-black w-48">سبب الإرجاع</th>
                          <th className="p-4 font-black text-center w-24">السعر</th>
                          <th className="p-4 font-black text-center w-28">الإجمالي</th>
                          <th className="p-4 font-black w-10 text-center">إزالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedInvoice.items?.filter((item: any) => !removedItemIds.has(item.id)).map((item: any, idx: number) => {
                          const data = itemsToReturn[item.id] || { return_quantity: 0, reason: "", notes: "" };
                          const isActive = data.return_quantity > 0;
                          const availableStock = item.available_warehouse_stock !== undefined ? Number(item.available_warehouse_stock) : null;
                          const isOutOfStock = availableStock !== null && availableStock <= 0;
                          const isPartiallyConsumed = availableStock !== null && availableStock > 0 && availableStock < Number(item.quantity);
                          const hasDeficit = availableStock !== null && data.return_quantity > availableStock;

                          return (
                            <tr key={item.id} className={`transition-colors h-24 ${hasDeficit ? "bg-rose-50/50" : isActive ? "bg-emerald-50/40" : "hover:bg-slate-50"}`}>
                              <td className="p-4 text-slate-400 font-bold text-center text-xs">{idx + 1}</td>
                              <td className="p-4">
                                <div className="font-black text-slate-800 text-sm leading-tight text-right">{item.ingredient_name}</div>
                                <div className="text-[10px] text-slate-400 font-bold mt-0.5 text-right">الوحدة: {item.unit || "قطعة"}</div>
                              </td>
                              <td className="p-4 text-center">
                                <span className="bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-black text-slate-700">
                                  {item.quantity} {item.unit || ""}
                                </span>
                              </td>
                              <td className="p-4 text-center">
                                {availableStock === null ? (
                                  <span className="text-xs text-slate-400 font-bold">جاري الفحص...</span>
                                ) : isOutOfStock ? (
                                  <div className="inline-flex flex-col items-center">
                                    <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 ring-1 ring-red-300 px-2.5 py-1 rounded-lg text-xs font-black">
                                      <Ban className="w-3.5 h-3.5 text-red-600" />
                                      رصيد 0 (مستهلك أو مباع)
                                    </span>
                                  </div>
                                ) : isPartiallyConsumed ? (
                                  <div className="inline-flex flex-col items-center">
                                    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 ring-1 ring-amber-300 px-2.5 py-1 rounded-lg text-xs font-black">
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                      متاح: {availableStock} {item.unit || ""}
                                    </span>
                                    <span className="text-[10px] text-amber-600 font-bold mt-0.5">تم استهلاك جزء</span>
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-2.5 py-1 rounded-lg text-xs font-black">
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                    متاح: {availableStock} {item.unit || ""}
                                  </span>
                                )}
                              </td>
                              <td className="p-4 text-center">
                                <div className="relative w-28 mx-auto">
                                  <input 
                                    type="number" 
                                    min="0"
                                    max={item.quantity}
                                    value={data.return_quantity || ""}
                                    placeholder="0"
                                    onChange={(e) => handleItemChange(item.id, "return_quantity", e.target.value)}
                                    className={`w-full p-2.5 rounded-xl border-2 text-center font-black outline-none transition-all ${
                                      hasDeficit 
                                        ? "bg-red-50 border-red-500 text-red-700 shadow-md shadow-red-100" 
                                        : isActive 
                                          ? "bg-white border-emerald-500 shadow-md shadow-emerald-100" 
                                          : "bg-white border-slate-200 focus:border-emerald-400"
                                    }`}
                                  />
                                  {hasDeficit && (
                                    <div className="text-[10px] font-black text-red-600 mt-1 flex items-center justify-center gap-0.5 whitespace-nowrap">
                                      <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
                                      يتجاوز رصيد المخزن ({availableStock})
                                    </div>
                                  )}
                                  {isOutOfStock && !hasDeficit && (
                                    <div className="text-[10px] font-black text-slate-400 mt-1">غير متوفر بالمخزن</div>
                                  )}
                                </div>
                              </td>
                              <td className="p-4">
                                <select 
                                  disabled={!isActive}
                                  value={data.reason}
                                  onChange={(e) => handleItemChange(item.id, "reason", e.target.value)}
                                  className={`w-full p-2.5 rounded-xl border-2 text-xs font-black outline-none transition-all ${isActive ? "bg-white border-emerald-500" : "bg-slate-50 border-slate-100 text-slate-300 opacity-50"}`}
                                  dir="rtl"
                                >
                                  <option value="">-- اختر السبب --</option>
                                  {RETURN_REASONS.map(r => (
                                    <option key={r.value} value={r.value} className={r.color}>{r.label}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="p-4 text-slate-600 font-bold text-center">
                                {Number(item.unit_price || 0).toLocaleString()}
                              </td>
                              <td className="p-4 text-center">
                                {isActive ? (
                                  <span className="font-black text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200">
                                    {Number(data.return_quantity * item.unit_price || 0).toLocaleString()} <span className="text-[10px]">ج.م</span>
                                  </span>
                                ) : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="p-4 text-center">
                                <button
                                  onClick={() => {
                                    setRemovedItemIds(prev => {
                                      const newSet = new Set(prev);
                                      newSet.add(item.id);
                                      return newSet;
                                    });
                                    const newItems = { ...itemsToReturn };
                                    delete newItems[item.id];
                                    setItemsToReturn(newItems);
                                  }}
                                  className="text-slate-300 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors"
                                  title="إزالة من القائمة"
                                >
                                  <X className="w-5 h-5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-6 bg-slate-900 text-white flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex flex-wrap items-center gap-6 text-right w-full md:w-auto">
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">صافي المرتجع (قبل الضريبة)</div>
                        <div className="text-2xl font-black text-slate-200">
                          {Number(subtotalAmount || 0).toLocaleString()} <span className="text-xs font-normal text-slate-400">ج.م</span>
                        </div>
                      </div>

                      {invoiceTaxRate > 0 && (
                        <div className="border-r border-slate-700 pr-6">
                          <div className="text-[10px] text-amber-400 font-bold uppercase tracking-widest mb-0.5">
                            ضريبة القيمة المضافة ({invoiceTaxRate}%)
                          </div>
                          <div className="text-2xl font-black text-amber-400">
                            +{Number(taxAmount || 0).toLocaleString()} <span className="text-xs font-normal text-amber-300">ج.م</span>
                          </div>
                        </div>
                      )}

                      <div className="border-r border-slate-700 pr-6">
                        <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-0.5">
                          إجمالي الخصم على المورد (شامل الضريبة)
                        </div>
                        <div className="text-3xl font-black text-emerald-400 tracking-tighter">
                          {Number(totalAmount || 0).toLocaleString()} <span className="text-xs font-normal text-emerald-300">ج.م</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-8 border-t md:border-t-0 md:border-r border-slate-800 pt-4 md:pt-0 md:pr-6 shrink-0 w-full md:w-auto justify-end">
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-0.5 text-right">إجمالي الأصناف</div>
                        <div className="text-xl font-black text-right">{itemsCount} <span className="text-xs text-slate-500 font-medium">صنف</span></div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-0.5 text-right">إجمالي الكميات</div>
                        <div className="text-xl font-black text-right">{totalQuantity} <span className="text-xs text-slate-500 font-medium">وحدة</span></div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Notes box */}
                <div className="my-6 bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm text-right">
                  <div className="flex items-center justify-end gap-2 mb-3">
                    <label className="font-black text-slate-700 text-sm">ملاحظات إضافية حول المرتجع</label>
                    <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
                      <FileText className="w-5 h-5" />
                    </div>
                  </div>
                  <textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="اكتب هنا أي تفاصيل إضافية متعلقة بحالة البضاعة أو سبب الإرجاع..."
                    className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold border border-slate-100 outline-none focus:bg-white focus:border-emerald-300 transition-all placeholder:text-slate-400 text-right"
                    rows={2}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-white border-t border-slate-100 flex justify-between items-center shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-3">
            {activeStep === "form" && (
              <button 
                onClick={handleApprove}
                disabled={itemsCount === 0 || isSaving || isApproving}
                className="flex items-center gap-3 px-10 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black shadow-xl shadow-emerald-200 transition-all active:scale-95 transform translate-y-0 hover:-translate-y-1 text-sm disabled:opacity-40 disabled:hover:translate-y-0"
              >
                {isApproving ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-6 h-6" />}
                {isApproving ? "جاري اعتماد المرتجع..." : "اعتماد وحفظ المرتجع"}
              </button>
            )}

            <button 
              onClick={onClose}
              className="px-8 py-4 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-2xl font-black transition-all active:scale-95 text-sm"
            >
              إلغاء الإجراء
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            {activeStep === "form" && (
              <>
                <button 
                  onClick={() => handleSave("draft")}
                  disabled={itemsCount === 0 || isSaving}
                  className="flex items-center gap-2 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black transition-all active:scale-95 text-sm disabled:opacity-40"
                >
                  <Save className="w-5 h-5" />
                  حفظ مسودة
                </button>
                <button 
                  onClick={handlePrint}
                  disabled={itemsCount === 0}
                  className="flex items-center gap-2 px-6 py-4 bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-600 rounded-2xl font-black transition-all active:scale-95 text-sm disabled:opacity-40"
                >
                  <Printer className="w-5 h-5" />
                  طباعة
                </button>
                <div className="w-px h-8 bg-slate-200 mx-2" />
                <button 
                  onClick={handleBackToSearch}
                  className="flex items-center gap-2 px-6 py-4 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl font-black transition-all active:scale-95 text-sm shadow-inner"
                >
                  تغيير الفاتورة
                  <ChevronLeft className="w-5 h-5 rotate-180" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Success Feedback Overlay */}
        {showSuccess && (
          <div className="absolute inset-0 bg-emerald-700/95 backdrop-blur-md flex items-center justify-center z-[100] animate-in fade-in duration-500">
            <div className="text-center animate-in zoom-in-50 duration-700">
              <div className="w-32 h-32 bg-white rounded-[44px] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-emerald-900/40">
                <CheckCircle className="w-16 h-16 text-emerald-600" />
              </div>
              <h3 className="text-4xl font-black text-white mb-2 tracking-tight">تمت العملية بنجاح!</h3>
              <p className="text-emerald-100 text-xl font-bold opacity-80">تم تسجيل المرتجع رقم <span className="text-white uppercase tracking-wider">{returnNumber}</span></p>
              
              <div className="mt-12 flex flex-col items-center gap-4">
                 <div className="w-full max-w-xs h-1 bg-white/20 rounded-full overflow-hidden">
                   <div className="h-full bg-white animate-progress-fast" />
                 </div>
                 <span className="text-emerald-200 text-sm font-bold uppercase tracking-[0.2em]">جارٍ تحويلك للرئيسية...</span>
              </div>
            </div>
          </div>
        )}

        {/* Rejection Alert Modal Overlay */}
        {rejectionData && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[150] p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[28px] border-2 border-red-200 shadow-2xl max-w-2xl w-full p-6 text-right animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between pb-4 border-b border-red-100">
                <button
                  onClick={() => setRejectionData(null)}
                  className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <h3 className="text-xl font-black text-red-600">{rejectionData.title}</h3>
                    <p className="text-xs text-slate-500 font-bold mt-0.5">تعذر إتمام الإرجاع لعدم توفر رصيد الأصناف في المخزن</p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 shadow-inner">
                    <Ban className="w-7 h-7" />
                  </div>
                </div>
              </div>

              <div className="py-4 flex-1 overflow-auto">
                <div className="bg-red-50/90 border border-red-200 rounded-2xl p-4 mb-4 text-xs font-bold text-red-800 leading-relaxed text-right flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>{rejectionData.message}</div>
                </div>

                <div className="text-xs font-black text-slate-700 mb-2 text-right">الأصناف المرفوضة وتفاصيل رصيد المخزن:</div>
                <div className="overflow-auto max-h-60 rounded-2xl border border-slate-200">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 sticky top-0">
                      <tr>
                        <th className="p-3 font-black">الصنف</th>
                        <th className="p-3 font-black text-center">المطلوب إرجاعه</th>
                        <th className="p-3 font-black text-center">المتاح بالمخزن</th>
                        <th className="p-3 font-black text-center">الحالة والسبب</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rejectionData.items.map((it, idx) => (
                        <tr key={idx} className="bg-white hover:bg-red-50/40">
                          <td className="p-3 font-black text-slate-800">{it.name}</td>
                          <td className="p-3 font-black text-center text-slate-900">{it.requested_quantity} {it.unit}</td>
                          <td className="p-3 font-black text-center">
                            <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black inline-block ${it.available_quantity <= 0 ? "bg-red-100 text-red-700 border border-red-200" : "bg-amber-100 text-amber-800 border border-amber-200"}`}>
                              {it.available_quantity} {it.unit}
                            </span>
                          </td>
                          <td className="p-3 text-red-600 font-bold text-center">
                            {it.available_quantity <= 0 ? "مستهلك أو مباع بالكامل (0)" : `عجز بمقدار ${it.deficit} ${it.unit}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3 mt-auto">
                <button
                  onClick={() => setRejectionData(null)}
                  className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-xs transition-colors"
                >
                  إغلاق وتعديل الكميات يدوياً
                </button>
                <button
                  onClick={handleAutoAdjustQuantities}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow-lg shadow-emerald-200 transition-colors flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  تعديل الكميات تلقائياً حسب الرصيد المتاح
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
