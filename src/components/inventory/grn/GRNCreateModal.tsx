import React, { useState, useEffect, useMemo } from "react";
import {
  Truck, Plus, Trash2, ShieldCheck, AlertCircle, FileText,
  DollarSign, Package, Calendar, Hash, Tag, Layers, X,
  CheckCircle2, Sparkles, ArrowRight, ArrowLeft, Paperclip,
  Barcode, Search, Calculator, Check, AlertTriangle, Lock,
  ChevronDown, RefreshCw, Info, CheckCircle, Clock
} from "lucide-react";
import { apiFetch } from "../../../utils/api";

interface GRNCreateModalProps {
  warehouses: any[];
  ingredients: any[];
  suppliers: any[];
  initialPurchaseOrderId?: number;
  onClose: () => void;
  onSuccess: () => void;
  onNotify: (msg: string, type: "success" | "error" | "info") => void;
}

export const GRNCreateModal: React.FC<GRNCreateModalProps> = ({
  warehouses,
  ingredients,
  suppliers,
  initialPurchaseOrderId,
  onClose,
  onSuccess,
  onNotify
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [loadingPo, setLoadingPo] = useState(false);
  const [warehouseLocations, setWarehouseLocations] = useState<any[]>([]);
  const [poSearchTerm, setPoSearchTerm] = useState("");
  const [isPoDropdownOpen, setIsPoDropdownOpen] = useState(false);

  // Barcode scanner quick add
  const [scannedBarcode, setScannedBarcode] = useState("");

  // Invoice uniqueness check state
  const [invoiceChecking, setInvoiceChecking] = useState(false);
  const [invoiceStatus, setInvoiceStatus] = useState<{
    checked: boolean;
    isUnique: boolean;
    existingGrn?: string;
  }>({ checked: false, isUnique: true });

  const todayStr = new Date().toISOString().split("T")[0];

  const getPoStatusLabel = (status: string) => {
    switch (status) {
      case "approved": return "معتمد";
      case "partially_received": return "استلام جزئي";
      case "pending": return "قيد الانتظار";
      case "pending_approval": return "بانتظار الموافقة";
      case "received": return "مستلم بالكامل";
      case "cancelled": return "ملغي";
      case "draft": return "مسودة";
      default: return status || "معتمد";
    }
  };

  // Form State
  const defaultWarehouse = warehouses.find(w => w.type === 'main' || w.is_main === 1) || warehouses[0];
  const [header, setHeader] = useState({
    receipt_type: "po", // Default to 'po' (From Purchase Order) as requested
    purchase_order_id: "",
    warehouse_id: defaultWarehouse?.id || "",
    supplier_id: suppliers[0]?.id || "",
    supplier_invoice_no: "",
    delivery_note_no: "",
    date: todayStr,
    posting_date: todayStr,
    receiver_name: localStorage.getItem("userName") || "مدير الاستلام",
    reference: `GRN-REF-${todayStr.replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`,
    currency: "EGP",
    exchange_rate: 1.0,
    // Landed Costs
    freight_charges: 0,
    customs_charges: 0,
    other_charges: 0,
    landed_cost_allocation: "value", // 'value', 'quantity', 'weight', 'equal'
    notes: "",
    auto_post: false,
    needs_qc: false // Send to QC Quarantine
  });

  const [items, setItems] = useState<any[]>([
    {
      ingredient_id: ingredients[0]?.id || "",
      po_item_id: null,
      ordered_qty: 0,
      previously_received_qty: 0,
      expected_qty: 10,
      received_qty: 10,
      rejected_qty: 0,
      rejection_reason: "",
      free_qty: 0,
      unit_price: Number(ingredients[0]?.cost || 0),
      po_unit_price: Number(ingredients[0]?.cost || 0),
      discount_rate: 0,
      tax_rate: 14,
      batch_number: `BAT-${todayStr.slice(2).replace(/-/g, "")}-${Math.floor(100 + Math.random() * 900)}`,
      lot_number: "",
      expiry_date: "",
      manufacturing_date: todayStr,
      supplier_batch: "",
      serial_numbers: "",
      location_id: "",
      notes: ""
    }
  ]);

  const [attachments, setAttachments] = useState<any[]>([]);
  const [newAttachmentName, setNewAttachmentName] = useState("");
  const [newAttachmentUrl, setNewAttachmentUrl] = useState("");
  const [newAttachmentType, setNewAttachmentType] = useState("invoice");

  // Fetch approved/pending Purchase Orders on mount
  useEffect(() => {
    const fetchPOs = async () => {
      setLoadingPo(true);
      try {
        const res = await apiFetch("/api/purchase-orders");
        let data = await res.json();
        if (Array.isArray(data)) {
          // Keep all non-cancelled purchase orders so the user has the full list available
          const validPOs = data.filter(po => po.status !== "cancelled");
          setPurchaseOrders(validPOs);
        } else {
          // Fallback to general pending PO endpoint
          const fallbackRes = await apiFetch("/api/goods-receipts-po/pending");
          const fallbackData = await fallbackRes.json();
          if (fallbackData.purchase_orders) {
            setPurchaseOrders(fallbackData.purchase_orders);
          }
        }
      } catch (err) {
        console.error("Failed to load POs:", err);
      } finally {
        setLoadingPo(false);
      }
    };
    fetchPOs();
  }, []);

  // Auto-sync warehouse_id when warehouses load or change
  useEffect(() => {
    if (Array.isArray(warehouses) && warehouses.length > 0 && !header.warehouse_id) {
      const defaultWh = warehouses.find(w => w.type === 'main' || w.is_main === 1) || warehouses[0];
      if (defaultWh) {
        setHeader(prev => ({ ...prev, warehouse_id: prev.warehouse_id || defaultWh.id }));
      }
    }
  }, [warehouses, header.warehouse_id]);

  // Fetch Warehouse Locations for the selected warehouse
  useEffect(() => {
    if (!header.warehouse_id) return;
    const fetchLocations = async () => {
      try {
        const res = await apiFetch(`/api/warehouse-locations?warehouse_id=${header.warehouse_id}`);
        const data = await res.json();
        if (data.success) {
          setWarehouseLocations(data.locations || []);
        }
      } catch (err) {
        console.error("Failed to load locations:", err);
      }
    };
    fetchLocations();
  }, [header.warehouse_id]);

  // Check Invoice Uniqueness per Supplier
  useEffect(() => {
    if (!header.supplier_id || !header.supplier_invoice_no.trim()) {
      setInvoiceStatus({ checked: false, isUnique: true });
      return;
    }

    const timer = setTimeout(async () => {
      setInvoiceChecking(true);
      try {
        const res = await apiFetch(
          `/api/grn/check-invoice-unique?supplier_id=${header.supplier_id}&invoice_no=${encodeURIComponent(header.supplier_invoice_no.trim())}`
        );
        const data = await res.json();
        if (data.success) {
          setInvoiceStatus({
            checked: true,
            isUnique: data.is_unique,
            existingGrn: data.existing_grn
          });
        }
      } catch (err) {
        console.error("Invoice check error:", err);
      } finally {
        setInvoiceChecking(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [header.supplier_id, header.supplier_invoice_no]);

  // Handle PO selection and auto-populate items & header
  const handleSelectPo = async (po: any) => {
    if (!po) {
      setHeader(prev => ({ ...prev, purchase_order_id: "" }));
      setIsPoDropdownOpen(false);
      return;
    }
    setLoadingPo(true);
    setIsPoDropdownOpen(false);
    try {
      // 1. Try fetching detailed PO items
      const res = await apiFetch(`/api/goods-receipts-po/${po.id}/items`);
      let poData = await res.json();

      let poItemsList: any[] = [];
      let supplierId = po.supplier_id || (header.supplier_id);
      const defaultWh = warehouses.find(w => w.type === 'main' || w.is_main === 1) || warehouses[0];
      let targetWarehouseId = header.warehouse_id || defaultWh?.id;

      if (poData.success && Array.isArray(poData.items) && poData.items.length > 0) {
        poItemsList = poData.items;
        if (poData.purchase_order) {
          supplierId = poData.purchase_order.supplier_id || supplierId;
          if (poData.purchase_order.warehouse_id) {
            targetWarehouseId = poData.purchase_order.warehouse_id;
          }
        }
      } else {
        // Fallback to standard PO endpoint
        const poStandardRes = await apiFetch(`/api/purchase-orders/${po.id}`);
        const standardData = await poStandardRes.json();
        if (standardData && Array.isArray(standardData.items)) {
          poItemsList = standardData.items;
          supplierId = standardData.supplier_id || supplierId;
          if (standardData.warehouse_id) {
            targetWarehouseId = standardData.warehouse_id;
          }
        }
      }

      setHeader(prev => ({
        ...prev,
        purchase_order_id: String(po.id),
        supplier_id: supplierId || prev.supplier_id,
        warehouse_id: targetWarehouseId || prev.warehouse_id || defaultWh?.id,
        reference: `أمر شراء #${po.id}`
      }));

      const poTaxRate = poData?.purchase_order?.tax_rate !== undefined && poData?.purchase_order?.tax_rate !== null
        ? Number(poData.purchase_order.tax_rate)
        : (po.tax_rate !== undefined && po.tax_rate !== null ? Number(po.tax_rate) : 0);

      if (poItemsList.length > 0) {
        const mappedItems = poItemsList.map((pi: any) => {
          const ordered = Number(pi.quantity || pi.ordered_qty || 0);
          const alreadyReceived = Number(pi.received_quantity || pi.previously_received_qty || 0);
          const remaining = Math.max(0, ordered - alreadyReceived);
          const defaultRecv = remaining > 0 ? remaining : ordered;
          const itemTaxRate = pi.tax_rate !== undefined && pi.tax_rate !== null && Number(pi.tax_rate) >= 0
            ? Number(pi.tax_rate)
            : poTaxRate;

          return {
            ingredient_id: pi.ingredient_id,
            po_item_id: pi.id || pi.po_item_id || null,
            item_name: pi.ingredient_name || pi.item_name || "",
            unit: pi.unit || pi.base_unit || "",
            ordered_qty: ordered,
            previously_received_qty: alreadyReceived,
            expected_qty: remaining,
            received_qty: defaultRecv,
            rejected_qty: 0,
            rejection_reason: "",
            free_qty: 0,
            unit_price: Number(pi.unit_price || 0),
            po_unit_price: Number(pi.unit_price || 0),
            discount_rate: 0,
            tax_rate: itemTaxRate,
            batch_number: pi.batch_number || pi.batch_no || `BAT-${todayStr.slice(2).replace(/-/g, "")}-${Math.floor(100 + Math.random() * 900)}`,
            lot_number: pi.lot_number || "",
            expiry_date: pi.expiry_date ? String(pi.expiry_date).split("T")[0] : (pi.expiration_date ? String(pi.expiration_date).split("T")[0] : ""),
            manufacturing_date: todayStr,
            supplier_batch: "",
            serial_numbers: "",
            location_id: pi.location_id || "",
            notes: ""
          };
        });

        setItems(mappedItems);
        onNotify(`تم استيراد ${mappedItems.length} صنف من أمر الشراء #${po.id} بنجاح`, "success");
      } else {
        onNotify(`تم ربط أمر الشراء #${po.id}`, "info");
      }
    } catch (err) {
      console.error("Failed to load PO details:", err);
      onNotify("فشل جلب تفاصيل أمر الشراء المحدد", "error");
    } finally {
      setLoadingPo(false);
    }
  };

  // Auto-select initial purchase order on mount
  useEffect(() => {
    const autoSelectPo = async () => {
      if (!initialPurchaseOrderId) return;
      try {
        let foundPo = purchaseOrders.find(p => Number(p.id) === Number(initialPurchaseOrderId));
        if (!foundPo) {
          const fallbackRes = await apiFetch("/api/goods-receipts-po/pending");
          const fallbackData = await fallbackRes.json();
          if (fallbackData.success && Array.isArray(fallbackData.purchase_orders)) {
            foundPo = fallbackData.purchase_orders.find((p: any) => Number(p.id) === Number(initialPurchaseOrderId));
          }
          if (!foundPo) {
            const poRes = await apiFetch(`/api/purchase-orders/${initialPurchaseOrderId}`);
            const poData = await poRes.json();
            if (poData && poData.id) {
              foundPo = poData;
            }
          }
          if (foundPo) {
            setPurchaseOrders(prev => {
              if (prev.some(p => Number(p.id) === Number(foundPo.id))) return prev;
              return [foundPo, ...prev];
            });
          }
        }
        if (foundPo) {
          await handleSelectPo(foundPo);
        }
      } catch (err) {
        console.error("Failed to auto-select PO in modal:", err);
      }
    };
    autoSelectPo();
  }, [initialPurchaseOrderId, purchaseOrders.length > 0]);

  // Auto-generate reference code
  const handleRegenerateReference = () => {
    const newRef = `GRN-REF-${todayStr.replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
    setHeader(prev => ({ ...prev, reference: newRef }));
  };

  // Add Item Row
  const handleAddItem = () => {
    const firstIng = ingredients[0];
    setItems(prev => [
      ...prev,
      {
        ingredient_id: firstIng?.id || "",
        po_item_id: null,
        ordered_qty: 0,
        previously_received_qty: 0,
        expected_qty: 1,
        received_qty: 1,
        rejected_qty: 0,
        rejection_reason: "",
        free_qty: 0,
        unit_price: Number(firstIng?.cost || 0),
        po_unit_price: Number(firstIng?.cost || 0),
        discount_rate: 0,
        tax_rate: 14,
        batch_number: `BAT-${todayStr.slice(2).replace(/-/g, "")}-${Math.floor(100 + Math.random() * 900)}`,
        lot_number: "",
        expiry_date: "",
        manufacturing_date: todayStr,
        supplier_batch: "",
        serial_numbers: "",
        location_id: "",
        notes: ""
      }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      onNotify("يجب أن يحتوي سند الاستلام على صنف واحد على الأقل", "error");
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === "ingredient_id") {
        const found = ingredients.find(ing => ing.id === Number(value));
        if (found) {
          updated[index].unit_price = Number(found.cost || 0);
        }
      }
      return updated;
    });
  };

  // Quick scan barcode handler
  const handleScanBarcode = () => {
    if (!scannedBarcode.trim()) return;
    const searchVal = scannedBarcode.trim().toLowerCase();
    const match = ingredients.find(ing =>
      (ing.barcode && ing.barcode.toLowerCase() === searchVal) ||
      (ing.item_code && ing.item_code.toLowerCase() === searchVal) ||
      (ing.sku && ing.sku.toLowerCase() === searchVal)
    );

    if (match) {
      const existingIdx = items.findIndex(it => it.ingredient_id === match.id);
      if (existingIdx >= 0) {
        handleItemChange(existingIdx, "received_qty", Number(items[existingIdx].received_qty || 0) + 1);
        onNotify(`تمت زيادة كمية الصنف: ${match.name}`, "success");
      } else {
        setItems(prev => [
          ...prev,
          {
            ingredient_id: match.id,
            po_item_id: null,
            ordered_qty: 0,
            previously_received_qty: 0,
            expected_qty: 1,
            received_qty: 1,
            rejected_qty: 0,
            rejection_reason: "",
            free_qty: 0,
            unit_price: Number(match.cost || 0),
            po_unit_price: Number(match.cost || 0),
            discount_rate: 0,
            tax_rate: 14,
            batch_number: `BAT-${todayStr.slice(2).replace(/-/g, "")}-${Math.floor(100 + Math.random() * 900)}`,
            lot_number: "",
            expiry_date: "",
            manufacturing_date: todayStr,
            supplier_batch: "",
            serial_numbers: "",
            location_id: "",
            notes: ""
          }
        ]);
        onNotify(`تمت إضافة الصنف بالمسح: ${match.name}`, "success");
      }
      setScannedBarcode("");
    } else {
      onNotify("لم يتم العثور على صنف مطابق لهذا الباركود أو الكود", "error");
    }
  };

  // Add Attachment
  const handleAddAttachment = () => {
    if (!newAttachmentName.trim() || !newAttachmentUrl.trim()) {
      onNotify("يرجى إدخال اسم المستند ورابط أو مسار الملف", "error");
      return;
    }
    setAttachments(prev => [
      ...prev,
      {
        file_name: newAttachmentName.trim(),
        file_url: newAttachmentUrl.trim(),
        doc_type: newAttachmentType
      }
    ]);
    setNewAttachmentName("");
    setNewAttachmentUrl("");
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Real-time Landed Cost & Total Calculations
  const calculations = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let totalQty = 0;
    let totalWeight = 0;

    items.forEach(it => {
      const qty = Number(it.received_qty || 0);
      const price = Number(it.unit_price || 0);
      const disc = Number(it.discount_rate || 0);
      const tax = Number(it.tax_rate || 0);
      const ing = ingredients.find(i => i.id === Number(it.ingredient_id));
      const unitWeight = Number(ing?.weight || 1);

      const gross = qty * price;
      const discVal = gross * (disc / 100);
      const taxable = gross - discVal;
      const taxVal = taxable * (tax / 100);

      subtotal += gross;
      totalDiscount += discVal;
      totalTax += taxVal;
      totalQty += qty;
      totalWeight += qty * unitWeight;
    });

    const netAmount = subtotal - totalDiscount;
    const extraLandedCosts =
      Number(header.freight_charges || 0) +
      Number(header.customs_charges || 0) +
      Number(header.other_charges || 0);
    const totalLandedCost = netAmount + extraLandedCosts;
    const totalPayableWithTax = totalLandedCost + totalTax;

    // Per item landed cost breakdown (Recoverable VAT excluded from inventory cost)
    const itemLandedList = items.map(it => {
      const qty = Number(it.received_qty || 0);
      const price = Number(it.unit_price || 0);
      const disc = Number(it.discount_rate || 0);
      const tax = Number(it.tax_rate || 0);
      const ing = ingredients.find(i => i.id === Number(it.ingredient_id));
      const unitWeight = Number(ing?.weight || 1);

      const gross = qty * price;
      const discVal = gross * (disc / 100);
      const lineNet = gross - discVal; // Net inventory value before tax
      const lineTax = lineNet * (tax / 100);

      let allocatedExtra = 0;
      if (extraLandedCosts > 0 && items.length > 0) {
        if (header.landed_cost_allocation === "quantity" && totalQty > 0) {
          allocatedExtra = (qty / totalQty) * extraLandedCosts;
        } else if (header.landed_cost_allocation === "weight" && totalWeight > 0) {
          allocatedExtra = ((qty * unitWeight) / totalWeight) * extraLandedCosts;
        } else if (header.landed_cost_allocation === "equal") {
          allocatedExtra = extraLandedCosts / items.length;
        } else {
          // Default: by value
          allocatedExtra = netAmount > 0 ? (lineNet / netAmount) * extraLandedCosts : 0;
        }
      }

      const totalItemLanded = lineNet + allocatedExtra;
      const unitLanded = qty > 0 ? totalItemLanded / qty : price;
      const extraPerUnit = qty > 0 ? allocatedExtra / qty : 0;

      return {
        lineNet,
        lineTax,
        lineTotalWithTax: lineNet + lineTax + allocatedExtra,
        allocatedExtra,
        totalItemLanded,
        unitLanded,
        extraPerUnit
      };
    });

    return {
      subtotal,
      totalDiscount,
      totalTax,
      totalQty,
      netAmount,
      extraLandedCosts,
      totalLandedCost,
      totalPayableWithTax,
      itemLandedList
    };
  }, [items, header.freight_charges, header.customs_charges, header.other_charges, header.landed_cost_allocation, ingredients]);

  // Filtered PO list for search
  const filteredPurchaseOrders = useMemo(() => {
    if (!poSearchTerm.trim()) return purchaseOrders;
    const term = poSearchTerm.trim().toLowerCase();
    return purchaseOrders.filter(po =>
      String(po.id).includes(term) ||
      (po.supplier_name && po.supplier_name.toLowerCase().includes(term)) ||
      (po.po_number && po.po_number.toLowerCase().includes(term))
    );
  }, [purchaseOrders, poSearchTerm]);

  const selectedPo = useMemo(() => {
    return purchaseOrders.find(po => String(po.id) === String(header.purchase_order_id));
  }, [purchaseOrders, header.purchase_order_id]);

  // Selected supplier details
  const selectedSupplierObj = useMemo(() => {
    return suppliers.find(s => String(s.id) === String(header.supplier_id));
  }, [suppliers, header.supplier_id]);

  // Three-Way Matching Comparison
  const threeWayMatch = useMemo(() => {
    const poTotal = selectedPo ? Number(selectedPo.total_amount || 0) : 0;
    const receivedNet = calculations.netAmount;
    const diff = Math.abs(poTotal - receivedNet);
    const isMatching = poTotal > 0 && diff < 1;

    return {
      poTotal,
      receivedNet,
      diff,
      isMatching,
      hasPo: Boolean(selectedPo)
    };
  }, [selectedPo, calculations.netAmount]);

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const defaultWh = warehouses.find(w => w.type === 'main' || w.is_main === 1) || warehouses[0];
    const resolvedWarehouseId = header.warehouse_id || defaultWh?.id;
    if (!resolvedWarehouseId) {
      onNotify("يرجى تحديد المخزن المستلم", "error");
      setStep(1);
      return;
    }
    if (header.receipt_type === "po" && !header.purchase_order_id) {
      onNotify("يرجى اختيار أمر الشراء المطلوب استلامه", "error");
      setStep(1);
      return;
    }
    if (items.length === 0) {
      onNotify("يرجى إضافة صنف واحد على الأقل", "error");
      setStep(2);
      return;
    }

    // Validate quantities & batch numbers
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (Number(it.received_qty) <= 0) {
        onNotify(`الصنف رقم ${i + 1}: الكمية المستلمة يجب أن تكون أكبر من صفر`, "error");
        setStep(2);
        return;
      }
      if (!it.batch_number || !it.batch_number.trim()) {
        onNotify(`الصنف رقم ${i + 1}: رقم التشغيلة (Batch #) إجباري لتتبع المخزون`, "error");
        setStep(2);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        warehouse_id: Number(resolvedWarehouseId),
        supplier_id: header.supplier_id ? Number(header.supplier_id) : null,
        purchase_order_id: header.purchase_order_id ? Number(header.purchase_order_id) : null,
        supplier_invoice_no: header.supplier_invoice_no.trim() || null,
        delivery_note_no: header.delivery_note_no.trim() || null,
        date: header.date,
        posting_date: header.posting_date,
        currency: header.currency,
        exchange_rate: Number(header.exchange_rate || 1),
        receiver_name: header.receiver_name,
        reference: header.reference,
        freight_charges: Number(header.freight_charges || 0),
        customs_charges: Number(header.customs_charges || 0),
        other_charges: Number(header.other_charges || 0),
        landed_cost_allocation: header.landed_cost_allocation,
        notes: header.notes,
        auto_post: header.auto_post,
        qc_status: header.needs_qc ? "pending" : (header.auto_post ? "passed" : "pending"),
        status: header.auto_post ? "posted" : "draft",
        attachments,
        items: items.map((it, idx) => ({
          ...it,
          landed_unit_cost: calculations.itemLandedList[idx]?.unitLanded || it.unit_price,
          total_landed_cost: calculations.itemLandedList[idx]?.totalItemLanded || (Number(it.received_qty) * Number(it.unit_price)),
          accepted_qty: header.auto_post ? Number(it.received_qty) : (Number(it.received_qty) - Number(it.rejected_qty || 0)),
          quarantine_qty: header.needs_qc ? Number(it.received_qty) : 0
        }))
      };

      const res = await apiFetch("/api/goods-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        onNotify(data.message || "تم إنشاء سند الاستلام بنجاح", "success");
        onSuccess();
        onClose();
      } else {
        onNotify(data.error || "فشل تسجيل سند الاستلام", "error");
      }
    } catch (err: any) {
      console.error("Submit GRN error:", err);
      onNotify("حدث خطأ أثناء حفظ سند الاستلام", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-3xl max-w-[99vw] 2xl:max-w-[1900px] w-full shadow-2xl border border-slate-100 overflow-hidden my-auto flex flex-col max-h-[97vh]">
        
        {/* Wizard Header */}
        <div className="p-6 lg:p-7 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">معالج تسجيل سند استلام وارد وفحص جودة (GRN)</h2>
              <p className="text-xs text-slate-300">استلام بضاعة، مطابقة أوامر الشراء، تسجيل أرقام التشغيلات، وحساب التكاليف الإضافية</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Stepper Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-6 sm:gap-8">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`flex items-center gap-2 pb-1 border-b-2 transition-all ${
                step === 1 ? "border-emerald-600 text-emerald-700 font-black" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                step === 1 ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
              }`}>1</span>
              بيانات الاستلام والمورد والتكاليف
            </button>

            <button
              type="button"
              onClick={() => setStep(2)}
              className={`flex items-center gap-2 pb-1 border-b-2 transition-all ${
                step === 2 ? "border-emerald-600 text-emerald-700 font-black" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                step === 2 ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
              }`}>2</span>
              الأصناف والكميات ({items.length})
            </button>

            <button
              type="button"
              onClick={() => setStep(3)}
              className={`flex items-center gap-2 pb-1 border-b-2 transition-all ${
                step === 3 ? "border-emerald-600 text-emerald-700 font-black" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                step === 3 ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
              }`}>3</span>
              المرفقات والمراجعة
            </button>
          </div>

          <div className="text-emerald-800 bg-emerald-100/90 px-3 py-1 rounded-xl font-mono font-bold text-xs shadow-sm border border-emerald-200">
            الإجمالي المحمل: {calculations.totalLandedCost.toLocaleString()} ج.م
          </div>
        </div>

        {/* Wizard Form Content */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-7 lg:p-9 overflow-y-auto space-y-6 flex-1 min-h-0">
          {/* STEP 1: RECEIPT SOURCE, PO, SUPPLIER & LANDED COSTS */}
          {step === 1 && (
            <div className="space-y-5">
              {/* Row 1 - Inbound Source Radio Options */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                <label className="block text-xs font-black text-slate-800">مصدر سند الاستلام (Inbound Source)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    header.receipt_type === "po"
                      ? "bg-white border-emerald-500 shadow-sm ring-2 ring-emerald-500/20"
                      : "bg-slate-100/60 border-slate-200 hover:bg-white"
                  }`}>
                    <input
                      type="radio"
                      name="receipt_type"
                      checked={header.receipt_type === "po"}
                      onChange={() => setHeader({ ...header, receipt_type: "po" })}
                      className="text-emerald-600 w-4 h-4"
                    />
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">استلام بناءً على أمر شراء (From Purchase Order)</span>
                      <span className="text-[11px] text-slate-500 block">مطابقة الكميات المتبقية وتحديث حالة أمر الشراء تلقائياً</span>
                    </div>
                  </label>

                  <label className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    header.receipt_type === "direct"
                      ? "bg-white border-emerald-500 shadow-sm ring-2 ring-emerald-500/20"
                      : "bg-slate-100/60 border-slate-200 hover:bg-white"
                  }`}>
                    <input
                      type="radio"
                      name="receipt_type"
                      checked={header.receipt_type === "direct"}
                      onChange={() => setHeader({ ...header, receipt_type: "direct", purchase_order_id: "" })}
                      className="text-emerald-600 w-4 h-4"
                    />
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">استلام مباشر (Direct Receipt)</span>
                      <span className="text-[11px] text-slate-500 block">توريد بدون أمر شراء مسبق أو استلام بضاعة نقدية فورية</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Row 2 - Searchable Select2 Style PO Selector (if PO selected) */}
              {header.receipt_type === "po" && (
                <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black text-emerald-950 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      اختر أمر الشراء المعتمد * (Select Purchase Order)
                    </label>
                    <span className="text-[11px] text-emerald-700 font-bold">
                      {loadingPo ? "جاري تحميل أوامر الشراء..." : `${purchaseOrders.length} أوامر شراء جاهزة للاستلام`}
                    </span>
                  </div>

                  {/* Searchable Select Dropdown Container */}
                  <div className="relative">
                    <div
                      onClick={() => setIsPoDropdownOpen(!isPoDropdownOpen)}
                      className="w-full px-3.5 py-2.5 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-slate-800 flex items-center justify-between cursor-pointer shadow-sm hover:border-emerald-500 transition-all"
                    >
                      {selectedPo ? (
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="bg-emerald-600 text-white px-2 py-0.5 rounded font-mono text-[11px]">
                            PO #{selectedPo.id}
                          </span>
                          <span className="font-bold text-slate-900 truncate">
                            المورد: {selectedPo.supplier_name || "مورد"}
                          </span>
                          <span className="text-slate-500 text-[11px]">
                            ({Number(selectedPo.total_amount || 0).toLocaleString()} ج.م)
                          </span>
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                            {getPoStatusLabel(selectedPo.status)}
                          </span>
                          {selectedPo.remaining_items_count !== undefined && (
                            <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] px-2 py-0.5 rounded font-bold">
                              {selectedPo.remaining_items_count} أصناف متبقية
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">
                          -- اضغط للبحث واختيار أمر شراء لتحميل الأصناف تلقائياً --
                        </span>
                      )}
                      <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isPoDropdownOpen ? "rotate-180" : ""}`} />
                    </div>

                    {/* PO Dropdown Menu */}
                    {isPoDropdownOpen && (
                      <div className="absolute top-full right-0 left-0 mt-1 bg-white rounded-2xl shadow-xl border border-slate-200 z-30 p-2 space-y-2 max-h-64 overflow-y-auto">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                          <input
                            type="text"
                            placeholder="ابحث برقم أمر الشراء أو اسم المورد..."
                            value={poSearchTerm}
                            onChange={(e) => setPoSearchTerm(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full pl-3 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                            autoFocus
                          />
                        </div>

                        <div className="space-y-1">
                          {filteredPurchaseOrders.length === 0 ? (
                            <div className="p-3 text-center text-xs text-slate-500">
                              لا توجد أوامر شراء مطابقة للبحث أو معتمدة
                            </div>
                          ) : (
                            filteredPurchaseOrders.map(po => (
                              <button
                                key={po.id}
                                type="button"
                                onClick={() => handleSelectPo(po)}
                                className={`w-full p-2.5 rounded-xl text-right flex items-center justify-between text-xs transition-all hover:bg-emerald-50 ${
                                  String(header.purchase_order_id) === String(po.id) ? "bg-emerald-100/70 border border-emerald-300" : ""
                                }`}
                              >
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-emerald-700">أمر شراء #{po.id}</span>
                                    <span className="font-bold text-slate-800">{po.supplier_name || "مورد"}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                    <span>المبلغ: {Number(po.total_amount || 0).toLocaleString()} ج.م</span>
                                    <span>•</span>
                                    <span>التاريخ: {po.date ? new Date(po.date).toLocaleDateString("ar-EG") : "-"}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                                    {getPoStatusLabel(po.status)}
                                  </span>
                                  {po.remaining_items_count !== undefined && (
                                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                                      {po.remaining_items_count} أصناف متبقية
                                    </span>
                                  )}
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Row 3 - 3 Fields: Warehouse, Supplier, Receiver Name */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. Receiving Warehouse */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">المخزن المستلم *</label>
                    {header.receipt_type === "po" && selectedPo && (
                      <span className="text-[10px] text-emerald-700 font-bold">
                        مخزن أمر الشراء
                      </span>
                    )}
                  </div>
                  <select
                    value={header.warehouse_id || (warehouses.find(w => w.type === 'main' || w.is_main === 1) || warehouses[0])?.id || ''}
                    onChange={(e) => setHeader({ ...header, warehouse_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.code || w.id})</option>
                    ))}
                  </select>
                </div>

                {/* 2. Supplier (Locked if PO, Free Select if Direct) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">المورد *</label>
                    {header.receipt_type === "po" && (
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> مقفل بأمر الشراء
                      </span>
                    )}
                  </div>
                  {header.receipt_type === "po" ? (
                    <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span className="truncate">
                        {selectedSupplierObj ? `${selectedSupplierObj.name} (${selectedSupplierObj.tax_number || selectedSupplierObj.phone || "مورد"})` : (selectedPo?.supplier_name || "مورد أمر الشراء")}
                      </span>
                      <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </div>
                  ) : (
                    <select
                      value={header.supplier_id}
                      onChange={(e) => setHeader({ ...header, supplier_id: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">-- مورد عام / نقدي --</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.tax_number || s.phone || "مورد"})</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* 3. Receiver Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم المستلم / أمين المخزن</label>
                  <input
                    type="text"
                    value={header.receiver_name}
                    onChange={(e) => setHeader({ ...header, receiver_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="اسم أمين المخزن المسؤول"
                  />
                </div>
              </div>

              {/* Row 4 - 3 Fields: Supplier Invoice # (with unique check), Delivery Note, Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 4. Supplier Invoice # with Uniqueness Checker */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">رقم فاتورة المورد</label>
                    {invoiceChecking && (
                      <span className="text-[10px] text-slate-400 animate-pulse">جاري التحقق...</span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={header.supplier_invoice_no}
                      onChange={(e) => setHeader({ ...header, supplier_invoice_no: e.target.value })}
                      className={`w-full pl-8 pr-3 py-2 bg-slate-50 border rounded-xl text-xs font-mono font-bold outline-none transition-all ${
                        invoiceStatus.checked && !invoiceStatus.isUnique
                          ? "border-rose-400 ring-2 ring-rose-200 bg-rose-50/50"
                          : invoiceStatus.checked && invoiceStatus.isUnique && header.supplier_invoice_no
                          ? "border-emerald-400 ring-2 ring-emerald-200"
                          : "border-slate-200 focus:ring-2 focus:ring-emerald-500"
                      }`}
                      placeholder="مثال: INV-2026-8941"
                    />
                    <div className="absolute left-2.5 top-2.5">
                      {header.supplier_invoice_no && invoiceStatus.checked && (
                        invoiceStatus.isUnique ? (
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                        )
                      )}
                    </div>
                  </div>
                  {invoiceStatus.checked && !invoiceStatus.isUnique && (
                    <span className="text-[10px] text-rose-600 font-bold block mt-1">
                      ⚠️ هذا الرقم مسجل مسبقاً في سند الاستلام {invoiceStatus.existingGrn}
                    </span>
                  )}
                </div>

                {/* 5. Delivery Note # */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم إذن التسليم / البوليصة (Delivery Note)</label>
                  <input
                    type="text"
                    value={header.delivery_note_no}
                    onChange={(e) => setHeader({ ...header, delivery_note_no: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="مثال: DN-99410"
                  />
                </div>

                {/* 6. Reference / Shipment Code with Regenerate Button */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">المرجع / كود الشحنة</label>
                    <button
                      type="button"
                      onClick={handleRegenerateReference}
                      className="text-[10px] text-emerald-600 hover:text-emerald-700 flex items-center gap-1 font-bold"
                    >
                      <RefreshCw className="w-2.5 h-2.5" /> توليد جديد
                    </button>
                  </div>
                  <input
                    type="text"
                    value={header.reference}
                    onChange={(e) => setHeader({ ...header, reference: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="كود مرجعي فريد للشحنة"
                  />
                </div>
              </div>

              {/* Row 5 - 3 Fields: Dates & Currency */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 7. Actual Receipt Date (Max today) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ الاستلام الفعلي *</label>
                  <input
                    type="date"
                    max={todayStr}
                    value={header.date}
                    onChange={(e) => setHeader({ ...header, date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                {/* 8. Posting Date with Open Period Info */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">تاريخ الترحيل المحاسبي *</label>
                    <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> الفترة مفتوحة
                    </span>
                  </div>
                  <input
                    type="date"
                    value={header.posting_date}
                    onChange={(e) => setHeader({ ...header, posting_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                {/* 9. Currency & Exchange Rate */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">العملة وسعر الصرف</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={header.currency}
                      onChange={(e) => {
                        const newCurr = e.target.value;
                        setHeader({
                          ...header,
                          currency: newCurr,
                          exchange_rate: newCurr === "EGP" ? 1.0 : (header.exchange_rate === 1.0 ? 50.5 : header.exchange_rate)
                        });
                      }}
                      className="px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                    >
                      <option value="EGP">EGP (ج.م)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="SAR">SAR (ر.س)</option>
                      <option value="AED">AED (د.إ)</option>
                    </select>
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      disabled={header.currency === "EGP"}
                      value={header.exchange_rate}
                      onChange={(e) => setHeader({ ...header, exchange_rate: parseFloat(e.target.value) || 1 })}
                      className={`px-2 py-2 border rounded-xl text-xs font-mono text-center font-bold ${
                        header.currency === "EGP" ? "bg-slate-100 border-slate-200 text-slate-500" : "bg-white border-slate-300 text-slate-900"
                      }`}
                      placeholder="سعر الصرف"
                    />
                  </div>
                </div>
              </div>

              {/* Row 6 - Landed Cost Breakdown & Allocation Card */}
              <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-emerald-700" />
                    <h4 className="font-black text-xs text-emerald-950">التكاليف الإضافية والشحن والجمارك (Landed Costs Allocation)</h4>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <span>طريقة التوزيع على الأصناف:</span>
                    <select
                      value={header.landed_cost_allocation}
                      onChange={(e) => setHeader({ ...header, landed_cost_allocation: e.target.value })}
                      className="px-2.5 py-1 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-emerald-900 shadow-sm"
                    >
                      <option value="value">حسب القيمة المالية (By Item Value) - افتراضي</option>
                      <option value="quantity">حسب الكميات المستلمة (By Quantity)</option>
                      <option value="weight">حسب الوزن الإجمالي (By Weight)</option>
                      <option value="equal">بالتساوي بين الأصناف (Evenly Distributed)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">مصاريف الشحن والنقل (Freight)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={header.freight_charges}
                      onChange={(e) => setHeader({ ...header, freight_charges: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 bg-white border border-emerald-200 rounded-xl text-xs font-mono font-bold text-slate-800"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">الرسوم الجمركية والضرائب الخاصة (Customs)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={header.customs_charges}
                      onChange={(e) => setHeader({ ...header, customs_charges: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 bg-white border border-emerald-200 rounded-xl text-xs font-mono font-bold text-slate-800"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">مصاريف تفريغ وتخزين أخرى (Other Fees)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={header.other_charges}
                      onChange={(e) => setHeader({ ...header, other_charges: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 bg-white border border-emerald-200 rounded-xl text-xs font-mono font-bold text-slate-800"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between text-xs font-bold pt-2 border-t border-emerald-200/70 text-emerald-950">
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-lg font-mono">
                      إجمالي المصاريف المحملة: {calculations.extraLandedCosts.toLocaleString()} ج.م
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-800">
                    سيتم توزيع {calculations.extraLandedCosts.toLocaleString()} ج.م على الأصناف لزيادة تكلفة الوحدة المخزنية (Landed Unit Cost)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: ITEMS, QUANTITIES, BATCHES & LANDED UNIT COSTS */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Top Quick Bar: Barcode Scanner & Add Item Button */}
              <div className="p-3.5 bg-slate-900 text-white rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-2 flex-1 min-w-[280px]">
                  <Barcode className="w-5 h-5 text-emerald-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="امسح الباركود أو كود الصنف بالماسح الضوئي لإضافته أو زيادة الكمية..."
                    value={scannedBarcode}
                    onChange={(e) => setScannedBarcode(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleScanBarcode(); } }}
                    className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-400 outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleScanBarcode}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all"
                  >
                    إضافة
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  <Plus className="w-4 h-4" /> إضافة صنف جديد
                </button>
              </div>

              {/* Items Table - Wide ERP Layout */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-6 py-5 bg-gradient-to-r from-slate-50 to-emerald-50/40 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <Package className="w-5 h-5 text-emerald-600" />
                      الأصناف المستلمة
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1">الكمية المطلوبة وسعر وحدتها وإجماليها ظاهرون للمقارنة، مع حساب إجمالي كل صنف مستلم لحظياً.</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-800 border border-blue-200">آخر سعر شراء = للمقارنة</span>
                    <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">السعر الفعلي = يدخل في الفاتورة</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1850px] text-right border-collapse text-[13px]">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-black border-b border-slate-200 whitespace-nowrap">
                        <th className="p-3">#</th>
                        <th className="p-3 min-w-[240px]">الصنف / الكود</th>
                        <th className="p-3 text-center min-w-[125px]">الكمية المطلوبة</th>
                        <th className="p-3 text-center min-w-[130px]">سعر الوحدة المطلوب</th>
                        <th className="p-3 text-center min-w-[145px]">إجمالي المطلوب</th>
                        <th className="p-3 text-center min-w-[125px]">الكمية المستلمة</th>
                        <th className="p-3 text-center">آخر سعر شراء</th>
                        <th className="p-3 text-center min-w-[150px]">سعر الشراء الفعلي</th>
                        <th className="p-3 text-center">الخصم %</th>
                        <th className="p-3 text-center">الضريبة %</th>
                        <th className="p-3 text-center min-w-[150px]">إجمالي البند</th>
                        <th className="p-3 text-center">المرفوض</th>
                        <th className="p-3 min-w-[170px]">Batch / التشغيلة</th>
                        <th className="p-3 min-w-[145px]">الصلاحية</th>
                        <th className="p-3 min-w-[180px]">موقع التخزين</th>
                        <th className="p-3 text-center">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((it, idx) => {
                        const selectedIngredient = ingredients.find(ing => ing.id === Number(it.ingredient_id));
                        const lastPurchasePrice = Number(selectedIngredient?.last_purchase_price ?? selectedIngredient?.last_purchase_cost ?? 0);
                        const qty = Number(it.received_qty || 0);
                        const price = Number(it.unit_price || 0);
                        const requiredQty = Number(it.ordered_qty || it.expected_qty || 0);
                        const requiredUnitPrice = Number(it.po_unit_price ?? it.unit_price ?? selectedIngredient?.cost ?? 0);
                        const requiredTotal = requiredQty * requiredUnitPrice;
                        const disc = Number(it.discount_rate || 0);
                        const tax = Number(it.tax_rate || 0);
                        const gross = qty * price;
                        const discountValue = gross * disc / 100;
                        const taxValue = (gross - discountValue) * tax / 100;
                        const lineTotal = gross - discountValue + taxValue;
                        const remQty = Number(it.expected_qty || 0);
                        const isOverReceived = Boolean(it.po_item_id) && Number(it.ordered_qty || 0) > 0 && qty > remQty;
                        const isNearExpiry = it.expiry_date && (new Date(it.expiry_date).getTime() - Date.now()) < (30 * 24 * 60 * 60 * 1000);

                        return (
                          <tr key={idx} className="align-middle hover:bg-slate-50/80 transition-colors">
                            <td className="p-3 font-black text-slate-500">{idx + 1}</td>
                            <td className="p-3">
                              <div className="font-black text-slate-900">{selectedIngredient?.name || it.item_name || "صنف استلام"}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="font-mono text-[10px] text-slate-500">{selectedIngredient?.item_code || selectedIngredient?.code || selectedIngredient?.id || "-"}</span>
                                {selectedIngredient?.category && <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] text-slate-600">{selectedIngredient.category}</span>}
                              </div>
                              {it.po_item_id && <div className="mt-1 text-[9px] text-blue-700 font-bold">سابقاً: {Number(it.previously_received_qty || 0)} • متبقي: {remQty} {isOverReceived ? "• ⚠ تجاوز" : ""}</div>}
                            </td>
                            <td className="p-3 text-center">
                              <div className="inline-flex flex-col items-center min-w-[105px] px-3 py-2 rounded-xl bg-blue-50 border border-blue-200">
                                <span className="font-mono font-black text-blue-900">{requiredQty.toLocaleString(undefined,{maximumFractionDigits:3})}</span>
                                <span className="text-[9px] text-blue-600 font-bold mt-0.5">{selectedIngredient?.unit || it.unit || "وحدة"}</span>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <div className="inline-flex flex-col items-center min-w-[115px] px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-200">
                                <span className="font-mono font-black text-indigo-900">{requiredUnitPrice.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                                <span className="text-[9px] text-indigo-600 font-bold">ج.م / وحدة</span>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <div className="inline-flex flex-col items-center min-w-[125px] px-3 py-2 rounded-xl bg-blue-100/70 border border-blue-200">
                                <span className="font-mono font-black text-blue-950">{requiredTotal.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                                <span className="text-[9px] text-blue-700 font-bold">إجمالي المطلوب</span>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <input type="number" step="any" min="0.001" value={it.received_qty}
                                onChange={(e) => handleItemChange(idx, "received_qty", e.target.value)}
                                className="w-24 mx-auto px-2.5 py-2 bg-white border border-emerald-300 rounded-xl text-center font-mono font-black text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500" />
                              <div className="text-[9px] text-slate-400 mt-1">{selectedIngredient?.unit || it.unit || "وحدة"}</div>
                            </td>
                            <td className="p-3 text-center">
                              <div className="inline-flex flex-col items-center px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 min-w-[115px]">
                                <span className="text-[9px] text-blue-600 font-bold">آخر شراء</span>
                                <span className="font-mono font-black text-blue-800">{lastPurchasePrice > 0 ? lastPurchasePrice.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) : "—"}</span>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <div className="relative">
                                <input type="number" step="any" min="0" value={it.unit_price}
                                  onChange={(e) => handleItemChange(idx, "unit_price", e.target.value)}
                                  className="w-32 px-3 py-2 bg-emerald-50 border-2 border-emerald-400 rounded-xl text-center font-mono font-black text-emerald-900 outline-none focus:ring-2 focus:ring-emerald-500" />
                                <span className="block text-[9px] text-emerald-700 font-bold mt-1">يدخل في الحساب</span>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <input type="number" step="0.01" min="0" max="100" value={it.discount_rate}
                                onChange={(e) => handleItemChange(idx, "discount_rate", e.target.value)}
                                className="w-20 mx-auto px-2 py-2 bg-white border border-slate-200 rounded-xl text-center font-mono font-bold" />
                            </td>
                            <td className="p-3 text-center">
                              <input type="number" step="0.01" min="0" max="100" value={it.tax_rate}
                                onChange={(e) => handleItemChange(idx, "tax_rate", e.target.value)}
                                className="w-20 mx-auto px-2 py-2 bg-white border border-slate-200 rounded-xl text-center font-mono font-bold" />
                            </td>
                            <td className="p-3 text-center">
                              <div className="px-3 py-2 rounded-xl bg-violet-50 border border-violet-200 min-w-[130px]">
                                <span className="font-mono font-black text-violet-800 text-sm">{lineTotal.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                                <span className="block text-[9px] text-violet-600 font-bold">ج.م • الكمية × السعر</span>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <input type="number" step="any" min="0" value={it.rejected_qty}
                                onChange={(e) => handleItemChange(idx, "rejected_qty", e.target.value)}
                                className="w-20 mx-auto px-2 py-2 bg-rose-50 border border-rose-200 rounded-xl text-center font-mono font-bold text-rose-700" />
                            </td>
                            <td className="p-3">
                              <input type="text" value={it.batch_number}
                                onChange={(e) => handleItemChange(idx, "batch_number", e.target.value)}
                                className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-mono text-[11px] font-bold" placeholder="BAT-YYYYMMDD" required />
                              <div className="mt-1 flex items-center gap-2 text-[9px] text-slate-400">
                                <span>إنتاج:</span>
                                <input type="date" max={todayStr} value={it.manufacturing_date}
                                  onChange={(e) => handleItemChange(idx, "manufacturing_date", e.target.value)} className="border-0 bg-transparent p-0 text-[9px]" />
                              </div>
                            </td>
                            <td className="p-3">
                              <input type="date" value={it.expiry_date}
                                onChange={(e) => handleItemChange(idx, "expiry_date", e.target.value)}
                                className={`w-full px-2.5 py-2 border rounded-xl text-[11px] ${isNearExpiry ? "bg-amber-50 border-amber-300 text-amber-900" : "bg-white border-slate-200"}`} />
                              {isNearExpiry && <div className="text-[9px] text-amber-600 font-bold mt-1">⚠ أقل من 30 يوم</div>}
                            </td>
                            <td className="p-3">
                              <select value={it.location_id} onChange={(e) => handleItemChange(idx, "location_id", e.target.value)}
                                className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-medium">
                                <option value="">المخزن الرئيسي</option>
                                {warehouseLocations.map(loc => <option key={loc.id} value={loc.id}>{loc.code} - {loc.name}</option>)}
                              </select>
                            </td>
                            <td className="p-3 text-center">
                              <button type="button" onClick={() => handleRemoveItem(idx)} disabled={items.length <= 1}
                                className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed" title="حذف الصنف">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <button type="button" onClick={handleAddItem} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm">
                    <Plus className="w-4 h-4" /> إضافة صنف
                  </button>
                  <div className="flex flex-wrap gap-2 text-xs font-bold">
                    <span className="px-3 py-2 bg-white border rounded-xl">عدد الأصناف: <b>{items.length}</b></span>
                    <span className="px-3 py-2 bg-white border rounded-xl">إجمالي الكمية المستلمة: <b>{calculations.totalQty.toLocaleString()}</b></span>
                    <span className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-blue-800">قيمة الكميات المطلوبة: <b>{items.reduce((sum, it) => sum + Number(it.ordered_qty || it.expected_qty || 0) * Number(it.po_unit_price ?? it.unit_price ?? 0), 0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} ج.م</b></span>
                    <span className="px-3 py-2 bg-white border border-violet-200 rounded-xl text-violet-800">قيمة الأصناف المستلمة: <b>{calculations.netAmount.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} ج.م</b></span>
                  </div>
                </div>
              </div>

              {/* Invoice Total Summary */}
              <div className="sticky bottom-0 z-10 bg-slate-900 text-white rounded-2xl border border-slate-700 shadow-xl p-4 lg:p-5">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Calculator className="w-5 h-5 text-emerald-400" />
                      <span className="text-sm font-black">إجمالي الفاتورة</span>
                    </div>
                    <span className="text-[11px] text-slate-400">محسوب من الكميات × أسعار الشراء + الضرائب والخصومات والمصاريف الإضافية</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 min-w-0 lg:min-w-[620px]">
                    <div className="bg-slate-800 rounded-xl px-3 py-2">
                      <span className="block text-[10px] text-slate-400">صافي المشتريات (مخزون)</span>
                      <span className="font-mono font-black text-sm">{calculations.netAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م</span>
                    </div>
                    <div className="bg-slate-800 rounded-xl px-3 py-2">
                      <span className="block text-[10px] text-amber-300">ضريبة مدخلات مستردة (VAT)</span>
                      <span className="font-mono font-black text-sm text-amber-400">{calculations.totalTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م</span>
                    </div>
                    <div className="bg-slate-800 rounded-xl px-3 py-2">
                      <span className="block text-[10px] text-slate-400">مصاريف شحن/جمارك</span>
                      <span className="font-mono font-black text-sm">{calculations.extraLandedCosts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م</span>
                    </div>
                    <div className="bg-emerald-600 rounded-xl px-3 py-2 ring-2 ring-emerald-400/30">
                      <span className="block text-[10px] text-emerald-100">إجمالي مستحق المورد</span>
                      <span className="font-mono font-black text-base">{(calculations.totalPayableWithTax ?? (calculations.totalLandedCost + calculations.totalTax)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: 3-WAY MATCHING, ATTACHMENTS, QC SETTINGS & SUMMARY */}
          {step === 3 && (
            <div className="space-y-5">
              {/* 3-Way Matching Summary Box */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-4 shadow-lg border border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-xs text-slate-200 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    المطابقة الثلاثية (Three-Way Matching) وملخص التكاليف
                  </h4>
                  {threeWayMatch.hasPo ? (
                    threeWayMatch.isMatching ? (
                      <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[11px] px-3 py-1 rounded-full font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> مطابقة تامة مع أمر الشراء 100%
                      </span>
                    ) : (
                      <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] px-3 py-1 rounded-full font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> يوجد فرق بقيمة {threeWayMatch.diff.toFixed(2)} ج.م عن أمر الشراء
                      </span>
                    )
                  ) : (
                    <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[11px] px-3 py-1 rounded-full font-bold">
                      استلام مباشر بدون أمر شراء
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700">
                    <span className="text-slate-400 block mb-1">عدد الأصناف المستلمة</span>
                    <span className="text-lg font-black font-mono text-emerald-400">{items.length} صنف</span>
                  </div>

                  <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700">
                    <span className="text-slate-400 block mb-1">إجمالي الوحدات المستلمة</span>
                    <span className="text-lg font-black font-mono text-blue-400">{calculations.totalQty.toLocaleString()}</span>
                  </div>

                  <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700">
                    <span className="text-slate-400 block mb-1">صافي قيمة البضاعة</span>
                    <span className="text-lg font-black font-mono text-white">{calculations.netAmount.toLocaleString()} ج.م</span>
                  </div>

                  <div className="p-3 bg-emerald-950/90 rounded-xl border border-emerald-600/50">
                    <span className="text-emerald-300 block mb-1">الإجمالي الشامل المحمل (Landed)</span>
                    <span className="text-lg font-black font-mono text-emerald-400">{calculations.totalLandedCost.toLocaleString()} ج.م</span>
                  </div>
                </div>
              </div>

              {/* Attachments Section */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-xs text-slate-800 flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-slate-600" />
                  المرفقات والمستندات الورقية (فاتورة المورد، بوليصة الشحن، شهادة الفحص)
                </h4>

                {/* Add Attachment Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    placeholder="اسم الملف (مثال: صورة الفاتورة الورقية)"
                    value={newAttachmentName}
                    onChange={(e) => setNewAttachmentName(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <input
                    type="text"
                    placeholder="رابط أو مسار المستند URL / File Path"
                    value={newAttachmentUrl}
                    onChange={(e) => setNewAttachmentUrl(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs sm:col-span-2 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="flex gap-2">
                    <select
                      value={newAttachmentType}
                      onChange={(e) => setNewAttachmentType(e.target.value)}
                      className="px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold flex-1"
                    >
                      <option value="invoice">فاتورة مورد</option>
                      <option value="delivery_note">إذن تسليم</option>
                      <option value="qc_report">تقرير فحص جودة</option>
                      <option value="other">مستند آخر</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleAddAttachment}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all"
                    >
                      إرفاق
                    </button>
                  </div>
                </div>

                {/* Attachment List */}
                {attachments.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {attachments.map((att, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl text-xs">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-emerald-600" />
                          <span className="font-bold text-slate-800">{att.file_name}</span>
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                            {att.doc_type}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(i)}
                          className="text-rose-500 hover:text-rose-700 p-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quality Inspection & Posting Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option 1: Send to QC Quarantine */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  header.needs_qc ? "bg-amber-50/70 border-amber-300 shadow-sm ring-2 ring-amber-400/20" : "bg-slate-50 border-slate-200"
                }`}>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={header.needs_qc}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setHeader({
                          ...header,
                          needs_qc: checked,
                          auto_post: checked ? false : header.auto_post
                        });
                      }}
                      className="w-4 h-4 mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <span className="font-black text-xs text-slate-900 block flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                        يحتاج فحص جودة وحجر صحي قبل الصرف (Send to QC Quarantine)
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        سيتم حجز الكميات المستلمة في رصيد الحجر الصحي (Quarantine) ولن تتاح للصرف إلا بعد اعتماد فريق الجودة
                      </span>
                    </div>
                  </label>
                </div>

                {/* Option 2: Direct Instant Post */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  header.auto_post ? "bg-emerald-50/80 border-emerald-400 shadow-sm ring-2 ring-emerald-500/20" : "bg-slate-50 border-slate-200"
                }`}>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={header.auto_post}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setHeader({
                          ...header,
                          auto_post: checked,
                          needs_qc: checked ? false : header.needs_qc
                        });
                      }}
                      className="w-4 h-4 mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="font-black text-xs text-slate-900 block flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        اعتماد وفحص فوري وترحيل محاسبي ومخزني مباشر (Instant Post)
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        اعتبار جميع الأصناف مقبولة وترحيل الأرصدة المخزنية وتوليد القيد المحاسبي فور الحفظ
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* General Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات الاستلام والفحص الأولي</label>
                <textarea
                  rows={2}
                  value={header.notes}
                  onChange={(e) => setHeader({ ...header, notes: e.target.value })}
                  placeholder="ملاحظات حول حالة الشاحنة، السائق، درجات الحرارة، أو أي تلفيات ظاهرية..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Wizard Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <div>
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep((step - 1) as any)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
                >
                  <ArrowRight className="w-4 h-4" /> السابق
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
              >
                إلغاء
              </button>

              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => setStep((step + 1) as any)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-[0.98]"
                >
                  التالي <ArrowLeft className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {submitting ? "جاري الحفظ والتسجيل..." : "حفظ وتسجيل سند الاستلام"}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
