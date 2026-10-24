import React, { useState, useEffect, useRef } from "react";
import {
  ShoppingCart,
  Plus,
  XCircle,
  FileText,
  Search,
  Printer,
  DollarSign,
  Settings,
  Trash2,
  Sparkles,
  Check,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Filter,
  Download,
  Calendar,
  Users,
  Wallet,
  Receipt,
  Package,
  CheckCircle2,
  GitBranch,
  ShieldCheck,
  Eye,
  Building2,
  Warehouse,
  Save,
  X,
  RotateCcw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { api, authFetch } from "../utils/api";
import { SearchableSelect } from "./SearchableSelect";
import { ReturnModal } from "./ReturnModal";
import { downloadDataAsWord } from "../utils/wordExport";
import { InvoiceOCRModal } from "./InvoiceOCRModal";

interface Purchase {
  id: number;
  supplier_id: number;
  warehouse_id: number;
  supplier_name: string;
  warehouse_name: string;
  invoice_number: string;
  supplier_invoice_number?: string;
  subtotal?: number;
  tax_amount?: number;
  discount_amount?: number;
  shipping_amount?: number;
  total_amount: number;
  paid_amount: number;
  status: string;
  notes: string;
  date: string;
  item_names?: string;
  items?: PurchaseItem[];
}

interface PurchaseItem {
  id: number;
  ingredient_id: number;
  ingredient_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

type PurchaseTab =
  | "receipts"
  | "orders"
  | "requests"
  | "invoices"
  | "returns"
  | "expenses"
  | "quotations"
  | "settings"
  | "reports";

interface PurchasesProps {
  onBack: () => void;
  initialTab?: PurchaseTab;
  initialReport?: string;
  onNavigateToGRN?: (poId: number) => void;
}

export function Purchases({ onBack, initialTab, initialReport, onNavigateToGRN }: PurchasesProps) {
  const [activeTab, setActiveTab] = useState<PurchaseTab>(
    initialTab || "receipts",
  );

  const tabNames: Record<string, string> = {
    orders: "أوامر الشراء (Purchase Orders)",
    receipts: "استلام المشتريات (Purchase Receipts)",
    requests: "طلبات الشراء",
    invoices: "فواتير المشتريات",
    returns: "مرتجعات المشتريات",
    expenses: "مصاريف إضافية",
    quotations: "عروض أسعار",
    settings: "إعدادات الفاتورة الإلكترونية",
    reports: "التحليلات والتقارير 📊",
  };

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  // Receipts State
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedReturnData, setSelectedReturnData] = useState<any | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);
  const isCreatingRequestRef = useRef(false);
  const createRequestKeyRef = useRef<string>("");
  // Prevent duplicate purchase receipts/invoices when Save is clicked repeatedly.
  // The same key is reused for retries so a lost response cannot create a second document.
  const receivingSaveKeyRef = useRef<string>("");
  const isSavingReceivingRef = useRef(false);
  const [isSavingReceiving, setIsSavingReceiving] = useState(false);
  const [editingRequestId, setEditingRequestId] = useState<number | null>(null);
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [linkedRequestId, setLinkedRequestId] = useState<string>("");
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [requestSupplierId, setRequestSupplierId] = useState<string>("");
  const [requestDeliveryDate, setRequestDeliveryDate] = useState<string>("");
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const toEnglishDigits = (value: any) =>
    String(value ?? "").replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const formatNumberEN = (value: any, decimals?: number) =>
    Number(value || 0).toLocaleString("en-US", decimals === undefined ? undefined : { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const formatDateEN = (value: any) => value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-";
  const [eInvoiceSettings, setEInvoiceSettings] = useState({
    enabled: false,
    environment: "test",
    taxpayer_number: "",
    branch_code: "0",
    activity_code: "",
    client_id: "",
    client_secret: "",
    auto_submit: false,
    auto_retry: true,
    include_qr: true,
    invoice_type: "purchase",
    notes: ""
  });
  const [eInvoiceSaving, setEInvoiceSaving] = useState(false);
  const [eInvoiceLoaded, setEInvoiceLoaded] = useState(false);

  useEffect(() => {
    const handleVoiceSearch = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setSearchQuery(customEvent.detail);
      }
    };
    window.addEventListener("voice_search", handleVoiceSearch);
    return () => window.removeEventListener("voice_search", handleVoiceSearch);
  }, []);

  useEffect(() => {
    if (activeTab !== "settings" || eInvoiceLoaded) return;
    (async () => {
      try {
        const r = await api.get("/api/settings/purchases_einvoice");
        if (r.ok) {
          const d = await r.json();
          const value = d?.value;
          if (value) {
            const parsed = typeof value === "string" ? JSON.parse(value) : value;
            if (parsed && typeof parsed === "object") setEInvoiceSettings((prev) => ({ ...prev, ...parsed }));
          }
        }
      } catch (e) { console.error("Failed to load purchase e-invoice settings", e); }
      finally { setEInvoiceLoaded(true); }
    })();
  }, [activeTab, eInvoiceLoaded]);

  const [eInvoicePreviewInvoice, setEInvoicePreviewInvoice] = useState<any | null>(null);
  const [eInvoiceToast, setEInvoiceToast] = useState<string | null>(null);

  const showPurchaseToast = (msg: string) => {
    setEInvoiceToast(msg);
    setTimeout(() => setEInvoiceToast(null), 3500);
  };

  const saveEInvoiceSettings = async () => {
    setEInvoiceSaving(true);
    try {
      const r = await api.post("/api/settings", { key: "purchases_einvoice", value: JSON.stringify(eInvoiceSettings) });
      if (!r.ok) throw new Error("save failed");
      showPurchaseToast("تم حفظ إعدادات الفاتورة الإلكترونية بنجاح");
    } catch (e) {
      console.error(e);
      showPurchaseToast("تعذر حفظ إعدادات الفاتورة الإلكترونية");
    } finally { setEInvoiceSaving(false); }
  };

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [requestAttachments, setRequestAttachments] = useState<File[]>([]);

  const [formData, setFormData] = useState({
    supplier_id: "",
    warehouse_id: "",
    invoice_number: "",
    tax_rate: "0",
    tax_amount: "",
    paid_amount: "",
    notes: "",
    order_id: "",
  });

  const [purchaseItems, setPurchaseItems] = useState<
    {
      ingredient_id: number | string;
      product_id?: number;
      item_type?: string;
      item_code?: string;
      name: string;
      unit: string;
      quantity: number;
      unit_price: number;
      stock_on_hand?: number;
      min_stock?: number;
      max_stock?: number;
      suggested_quantity?: number;
      accepted_quantity?: number;
      rejected_quantity?: number;
      purchase_order_item_id?: number;
      previously_received_quantity?: number;
      expiry_date?: string;
      batch_number?: string;
      batch_no?: string;
      lot_number?: string;
      location?: string;
      location_name?: string;
      warehouse_id?: string | number;
      warehouse_name?: string;
      description?: string;
      total_price?: number;
    }[]
  >([]);

  // Generic purchase lists based on current state
  const [requests, setRequests] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [procurementKpis, setProcurementKpis] = useState<any | null>(null);
  const [returns, setReturns] = useState<any[]>([]);
  const [purchaseReceipts, setPurchaseReceipts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [costItems, setCostItems] = useState<any[]>([]);
  const [expenseFormData, setExpenseFormData] = useState({
    voucher_no: "",
    amount: "",
    supplier_id: "",
    cost_center_id: "",
    cost_item_id: "",
    payment_method: "نقدي",
    safe: "خزينة فرع القاهرة",
    notes: "",
    branch: "القاهرة",
    department: "المشتريات",
    purchase_id: "",
    purchase_order_id: "",
  });

  // Orders State
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [orderFormData, setOrderFormData] = useState({
    supplier_id: "",
    delivery_date: "",
    tax_rate: "0",
    tax_amount: "",
    notes: "",
  });
  const [requestTaxRate, setRequestTaxRate] = useState("0");
  const [requestTaxAmount, setRequestTaxAmount] = useState("");

  const [requestFormData, setRequestFormData] = useState({
    requested_by: "",
    branch_id: "",
    warehouse_id: "",
    department: "",
    required_date: "",
    priority: "normal",
    reason: "",
    justification: "",
    cost_center_id: "",
    cost_item_id: "",
    currency: "EGP",
    notes: "",
  });

  // Quotations State
  const [quotationFormData, setQuotationFormData] = useState({
    quotation_number: "", request_id: "", supplier_id: "", quotation_date: "", delivery_date: "", valid_until: "",
    payment_terms: "", delivery_terms: "", currency: "EGP", discount_amount: "0", tax_amount: "0",
    contact_person: "", contact_phone: "", reference_number: "", notes: "",
  });
  const [selectedQuotation, setSelectedQuotation] = useState<any | null>(null);
  const [quotationItems, setQuotationItems] = useState<any[]>([]);
  const [quotationItemInput, setQuotationItemInput] = useState({
    ingredient_id: "",
    name: "",
    unit: "كيلو",
    quantity: "1",
    unit_price: "0",
  });

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    // Hard guard against double-clicks / repeated submit events. The same idempotency
    // key is also sent to the server so retries cannot create a second request.
    // Use a ref as the synchronous lock. React state updates are asynchronous, so a
    // very fast double-click can otherwise enter this handler twice before
    // isCreatingRequest is re-rendered.
    if (isCreatingRequestRef.current || isCreatingRequest) return;
    isCreatingRequestRef.current = true;
    if (!createRequestKeyRef.current) {
      createRequestKeyRef.current = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    if (purchaseItems.length === 0) { isCreatingRequestRef.current = false; alert("أضف صنفًا واحدًا على الأقل"); return; }
    if (!requestFormData.requested_by.trim()) { isCreatingRequestRef.current = false; alert("أدخل الجهة/الشخص الطالب"); return; }
    setIsCreatingRequest(true);
    try {
      const username = localStorage.getItem("username") || requestFormData.requested_by;
      const requestPayload = {
        requested_by: requestFormData.requested_by.trim(),
        branch_id: requestFormData.branch_id ? Number(requestFormData.branch_id) : null,
        warehouse_id: requestFormData.warehouse_id ? Number(requestFormData.warehouse_id) : null,
        department: requestFormData.department || null,
        required_date: requestFormData.required_date || null,
        priority: requestFormData.priority || "normal",
        reason: requestFormData.reason || null,
        justification: requestFormData.justification || null,
        cost_center_id: requestFormData.cost_center_id ? Number(requestFormData.cost_center_id) : null,
        cost_item_id: requestFormData.cost_item_id ? Number(requestFormData.cost_item_id) : null,
        currency: requestFormData.currency || "EGP",
        notes: requestFormData.notes || null,
        created_by: username,
        source_type: "manual",
        items: purchaseItems.map((item:any) => ({
          ...item,
          item_type: item.item_type || (item.product_id ? "product" : "ingredient"),
          product_id: item.product_id || null,
          item_code: item.item_code || null,
          suggested_quantity: item.suggested_quantity || 0,
        })),
      };
      const res = editingRequestId
        ? await api.put(`/api/purchase-requests/${editingRequestId}`, requestPayload)
        : await authFetch("/api/purchase-requests", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": createRequestKeyRef.current,
            },
            body: JSON.stringify(requestPayload),
          });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "فشل حفظ طلب الشراء");
      if (requestAttachments.length) {
        const fd = new FormData();
        requestAttachments.forEach((file) => fd.append("files", file));
        fd.append("created_by", username);
        const upload = await authFetch(`/api/purchase-requests/${data.id}/attachments`, { method: "POST", body: fd });
        if (!upload.ok) alert("تم إنشاء الطلب، لكن تعذر رفع بعض المرفقات");
      }
      setShowRequestModal(false);
      setEditingRequestId(null);
      setRequestFormData({ requested_by: "", branch_id: "", warehouse_id: "", department: "", required_date: "", priority: "normal", reason: "", justification: "", cost_center_id: "", cost_item_id: "", currency: "EGP", notes: "" });
      setRequestAttachments([]);
      setPurchaseItems([]);
      createRequestKeyRef.current = "";
      await fetchRequests();
    } catch (e:any) {
      console.error(e);
      alert(e.message || "حدث خطأ أثناء إنشاء طلب الشراء");
    } finally {
      isCreatingRequestRef.current = false;
      setIsCreatingRequest(false);
    }
  };

  const openEditRequest = async (request:any) => {
    const details = await fetchRequestDetails(Number(request.id));
    if (!details) return;
    setEditingRequestId(Number(request.id));
    setRequestFormData({
      requested_by: details.requested_by || "", branch_id: String(details.branch_id || ""), warehouse_id: String(details.warehouse_id || ""),
      department: details.department || "", required_date: details.required_date ? String(details.required_date).slice(0,10) : "", priority: details.priority || "normal",
      reason: details.reason || "", justification: details.justification || "", cost_center_id: String(details.cost_center_id || ""), cost_item_id: String(details.cost_item_id || ""),
      currency: details.currency || "EGP", notes: details.notes || ""
    });
    setPurchaseItems((details.items || []).map((i:any)=>({ ingredient_id:i.ingredient_id || 0, product_id:i.product_id || undefined, item_type:i.item_type || "ingredient", item_code:i.item_code || i.resolved_code || "", name:i.name || i.resolved_name || i.ingredient_name || "", unit:i.unit || i.resolved_unit || "قطعة", quantity:Number(i.quantity||0), unit_price:Number(i.unit_price||0), stock_on_hand:Number(i.stock_on_hand||0), min_stock:Number(i.min_stock||0), max_stock:Number(i.max_stock||0), suggested_quantity:Number(i.suggested_quantity||0) })));
    setShowRequestModal(true);
  };

  const duplicateRequest = async (request:any) => {
    const details = await fetchRequestDetails(Number(request.id));
    if (!details) return;
    setEditingRequestId(null);
    setRequestFormData({ requested_by: details.requested_by || "", branch_id: String(details.branch_id || ""), warehouse_id: String(details.warehouse_id || ""), department: details.department || "", required_date: details.required_date ? String(details.required_date).slice(0,10) : "", priority: details.priority || "normal", reason: details.reason || "", justification: details.justification || "", cost_center_id: String(details.cost_center_id || ""), cost_item_id: String(details.cost_item_id || ""), currency: details.currency || "EGP", notes: details.notes || "" });
    setPurchaseItems((details.items || []).map((i:any)=>({ ingredient_id:i.ingredient_id || 0, product_id:i.product_id || undefined, item_type:i.item_type || "ingredient", item_code:i.item_code || i.resolved_code || "", name:i.name || i.resolved_name || i.ingredient_name || "", unit:i.unit || i.resolved_unit || "قطعة", quantity:Number(i.quantity||0), unit_price:Number(i.unit_price||0), stock_on_hand:Number(i.stock_on_hand||0), min_stock:Number(i.min_stock||0), max_stock:Number(i.max_stock||0), suggested_quantity:Number(i.suggested_quantity||0) })));
    setShowRequestModal(true);
  };

  const deleteRequest = async (request:any) => {
    if (!confirm(`هل تريد حذف طلب الشراء ${request.request_number || `#${request.id}`} نهائيًا؟\nسيتم حذف بنود الطلب والمرفقات المرتبطة به أيضًا إذا كانت مرتبطة به.`)) return;
    try {
      const res=await api.delete(`/api/purchase-requests/${request.id}`);
      const data=await res.json().catch(()=>null);
      if(!res.ok) throw new Error(data?.error || "فشل حذف الطلب");
      await fetchRequests();
    } catch(e:any){ alert(e.message || "تعذر حذف الطلب"); }
  };

  const handleApproveRequestToOrder = async (request: any) => {
    try {
      const details = await fetchRequestDetails(request.id);
      if (!details) return;
      setSelectedRequest(details);
      setRequestSupplierId("");
      setRequestDeliveryDate("");
      setRequestTaxRate("0");
      setRequestTaxAmount("");
    } catch (e) { console.error(e); }
  };

  const confirmApproveRequestToOrder = async () => {
    if (!selectedRequest || !requestSupplierId) { alert("اختر المورد أولاً"); return; }
    try {
      const reqSubtotal = (selectedRequest.items || []).reduce((a: any, i: any) => a + Number(i.quantity || 0) * Number(i.unit_price || 0), 0);
      const tRate = Math.max(0, Number(requestTaxRate) || 0);
      const tAmt = requestTaxAmount !== "" ? Math.max(0, Number(requestTaxAmount) || 0) : Math.round((reqSubtotal * (tRate / 100)) * 100) / 100;
      const res = await api.post(`/api/purchase-requests/${selectedRequest.id}/approve`, {
        supplier_id: Number(requestSupplierId),
        delivery_date: requestDeliveryDate || null,
        tax_rate: tRate,
        tax_amount: tAmt,
        approved_by: localStorage.getItem("username") || "admin",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "فشل تحويل طلب الشراء إلى أمر شراء");
      setSelectedRequest(null);
      setRequestSupplierId("");
      setRequestDeliveryDate("");
      setRequestTaxRate("0");
      setRequestTaxAmount("");
      await Promise.all([fetchRequests(), fetchOrders(), fetchProcurementDashboard()]);
      setActiveTab("orders");
      alert(`تم تحويل طلب الشراء إلى أمر شراء ${data?.purchase_order?.order_number || `#${data?.purchase_order_id || data?.purchase_order?.id || ""}`}`);
    } catch (e:any) { alert(e.message || "حدث خطأ أثناء الاعتماد"); }
  };

  const fetchRequests = async () => {
    try {
      const res = await api.get("/api/purchase-requests");
      if (res.ok) {
        const data = await res.json();
        setRequests(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchRequestDetails = async (id: number) => {
    try {
      const res = await api.get(`/api/purchase-requests/${id}`);
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  };

  useEffect(() => {
    fetchProcurementDashboard();
    fetchPurchases();
    fetchReturns();
    fetchPurchaseReceipts();
    fetchOrders();
    fetchRequests();
    fetchQuotations();
    fetchSuppliers();
    fetchBranches();
    fetchWarehouses();
    fetchIngredients();
    fetchExpenses();
    fetchCostCenters();
    fetchCostItems();
  }, []);

  const fetchQuotations = async () => {
    try {
      const res = await api.get("/api/purchase-quotations");
      if (res.ok) {
        const data = await res.json();
        setQuotations(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Failed to fetch purchase quotations", e);
      setQuotations([]);
    }
  };

  const handleCreateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const selectedSup = suppliers.find(
        (s) => String(s.id) === String(quotationFormData.supplier_id)
      );
      const estimated_value = quotationItems.reduce(
        (acc, item) => acc + (Number(item.quantity) * Number(item.unit_price) || 0),
        0
      );
      const payload = {
        quotation_number: quotationFormData.quotation_number || `RFQ-${Date.now().toString().slice(-6)}`,
        request_id: quotationFormData.request_id ? Number(quotationFormData.request_id) : null,
        supplier_id: quotationFormData.supplier_id ? Number(quotationFormData.supplier_id) : null,
        supplier: selectedSup ? selectedSup.name : "مورد عام",
        quotation_date: quotationFormData.quotation_date || null, delivery_date: quotationFormData.delivery_date || null, valid_until: quotationFormData.valid_until || null,
        subtotal: estimated_value, discount_amount: Number(quotationFormData.discount_amount || 0), tax_amount: Number(quotationFormData.tax_amount || 0),
        total_amount: estimated_value - Number(quotationFormData.discount_amount || 0) + Number(quotationFormData.tax_amount || 0),
        estimated_value: estimated_value - Number(quotationFormData.discount_amount || 0) + Number(quotationFormData.tax_amount || 0),
        payment_terms: quotationFormData.payment_terms, delivery_terms: quotationFormData.delivery_terms, currency: quotationFormData.currency,
        contact_person: quotationFormData.contact_person, contact_phone: quotationFormData.contact_phone, reference_number: quotationFormData.reference_number,
        status: "جديد", notes: quotationFormData.notes, items: quotationItems,
      };
      const res = await api.post("/api/purchase-quotations", payload);
      if (res.ok) {
        setShowQuotationModal(false);
        setQuotationFormData({ quotation_number: "", request_id: "", supplier_id: "", quotation_date: "", delivery_date: "", valid_until: "", payment_terms: "", delivery_terms: "", currency: "EGP", discount_amount: "0", tax_amount: "0", contact_person: "", contact_phone: "", reference_number: "", notes: "" });
        setQuotationItems([]);
        fetchQuotations();
      }
    } catch (err) {
      console.error("Error creating purchase quotation:", err);
    }
  };

  const handleDeleteQuotation = async (id: number) => {
    if (!confirm("هل أنت تأكد من حذف عرض السعر؟")) return;
    try {
      const res = await api.delete(`/api/purchase-quotations/${id}`);
      if (res.ok) {
        fetchQuotations();
      }
    } catch (err) {
      console.error("Error deleting quotation:", err);
    }
  };

  const handleApproveQuotationToOrder = async (quot: any) => {
    try {
      const username = localStorage.getItem("username") || "أدمن";
      const quotItems = (quot.items && quot.items.length > 0) ? quot.items : [
        {
          ingredient_id: 1,
          quantity: 1,
          unit_price: quot.subtotal || quot.estimated_value || 0,
          total_price: quot.subtotal || quot.estimated_value || 0
        }
      ];
      const quotSub = Number(quot.subtotal || quotItems.reduce((s: number, it: any) => s + Number(it.quantity || 0) * Number(it.unit_price || 0), 0));
      const quotTaxAmt = Number(quot.tax_amount || 0);
      const quotTaxRate = quotSub > 0 && quotTaxAmt > 0 ? Math.round(((quotTaxAmt / quotSub) * 100) * 100) / 100 : 0;
      const orderPayload = {
        supplier_id: quot.supplier_id || null,
        delivery_date: quot.delivery_date || null,
        subtotal: quotSub,
        tax_rate: quotTaxRate,
        tax_amount: quotTaxAmt,
        discount_amount: Number(quot.discount_amount || 0),
        notes: `اعتماد بناءً على عرض السعر #${quot.quotation_number || quot.id}. ${quot.notes || ""}`,
        items: quotItems,
        requested_by: username,
        purchase_request_id: quot.request_id ? Number(quot.request_id) : null,
      };
      const res = await api.post("/api/purchase-orders", orderPayload);
      if (res.ok) {
        await api.put(`/api/purchase-quotations/${quot.id}`, { status: "معتمد" });
        alert("تم اعتماد عرض السعر وتحويله إلى أمر شراء بنجاح!");
        fetchQuotations();
        fetchOrders();
        setActiveTab("orders");
      }
    } catch (err) {
      console.error("Error converting quotation to order:", err);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await api.get("/api/purchase-orders");
      if (res.ok) setOrders(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchOrderDetails = async (id: number) => {
    try {
      const res = await api.get(`/api/purchase-orders/${id}`);
      if (res.ok) setSelectedOrder(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (purchaseItems.length === 0) return;
    try {
      const username = localStorage.getItem("username") || "admin";
      const subtotal = calculateSubtotal();
      const tax_amount = calculateTaxAmount();
      const tax_rate = Number(orderFormData.tax_rate) || 0;
      const total_amount = Math.round((subtotal + tax_amount) * 100) / 100;
      const res = await api.post("/api/purchase-orders", {
        ...orderFormData,
        subtotal,
        tax_rate,
        tax_amount,
        total_amount,
        purchase_request_id: linkedRequestId ? Number(linkedRequestId) : null,
        items: purchaseItems.map((it) => ({
          ...it,
          tax_rate,
          tax_amount: Math.round(((Number(it.quantity || 0) * Number(it.unit_price || 0)) * (tax_rate / 100)) * 100) / 100,
        })),
        requested_by: username,
      });
      if (res.ok) {
        const data = await res.json();
        setShowOrderModal(false);
        setOrderFormData({ supplier_id: "", delivery_date: "", tax_rate: "0", tax_amount: "", notes: "" });
        setPurchaseItems([]);
        setLinkedRequestId("");
        fetchOrders();
        // Show notification if approval is required
        if (data.requires_approval) {
          alert("تم إنشاء أمر الشراء بنجاح وهو بانتظار الموافقة");
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateInvoiceFromOrder = async () => {
    if (!formData.order_id) { alert("اختر أمر شراء أولاً"); return; }
    const defaultWh = warehouses.find((w: any) => w.type === "main" || w.is_main === 1) || warehouses[0];
    const resolvedWarehouseId = formData.warehouse_id || purchaseItems.find((i: any) => i.warehouse_id)?.warehouse_id || (defaultWh ? String(defaultWh.id) : "");
    if (!formData.supplier_id || !resolvedWarehouseId) { alert("اختر المورد والمخزن أولاً"); return; }
    if (!purchaseItems.length) { alert("أمر الشراء لا يحتوي على بنود"); return; }
    const idempotencyKey = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const subtotal = purchaseItems.reduce((sum:any, i:any) => sum + Number(i.quantity||0) * Number(i.unit_price||0), 0);
      const taxRate = Number(formData.tax_rate || 0);
      const taxAmount = formData.tax_amount !== "" && formData.tax_amount !== undefined
        ? Number(formData.tax_amount)
        : Math.round((subtotal * (taxRate / 100)) * 100) / 100;
      const total = Math.round((subtotal + taxAmount) * 100) / 100;
      const res = await api.post("/api/purchases", {
        idempotency_key: idempotencyKey,
        supplier_id: Number(formData.supplier_id), warehouse_id: Number(resolvedWarehouseId),
        purchase_order_id: Number(formData.order_id), order_id: Number(formData.order_id),
        invoice_number: formData.invoice_number || `INV-${new Date().getTime().toString().slice(-8)}`,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total_amount: total,
        paid_amount: Number(formData.paid_amount||0),
        notes: formData.notes || "",
        items: purchaseItems.map((i:any)=>({ingredient_id:i.ingredient_id, quantity:Number(i.quantity||0), unit_price:Number(i.unit_price||0), total_price:Number(i.quantity||0)*Number(i.unit_price||0)}))
      });
      const data = await res.json().catch(()=>null);
      if (!res.ok) throw new Error(data?.error || "فشل إنشاء فاتورة المشتريات");
      setShowInvoiceModal(false); setPurchaseItems([]);
      setFormData({supplier_id:"",warehouse_id:"",invoice_number:"",tax_rate:"0",tax_amount:"",paid_amount:"",notes:"",order_id:""});
      await Promise.all([fetchPurchases(), fetchOrders(), fetchProcurementDashboard(), fetchSuppliers()]);
      alert("تم إنشاء فاتورة المشتريات وربطها بأمر الشراء وتسميعها على حساب المورد بنجاح");
    } catch(e:any) { alert(e.message || "حدث خطأ أثناء إنشاء الفاتورة"); }
  };

  const fetchProcurementDashboard = async () => {
    try {
      const res = await api.get("/api/purchases/dashboard");
      if (res.ok) {
        const data = await res.json();
        setProcurementKpis(data.kpis || null);
      }
    } catch (e) {
      console.error("Failed to fetch procurement dashboard", e);
    }
  };

  const fetchPurchases = async () => {
    try {
      const res = await api.get("/api/purchases");
      const data = await res.json();
      const rows = Array.isArray(data) ? data : [];
      setPurchases(rows);
      setInvoices(rows.map((p:any) => ({
        ...p, supplier: p.supplier_name, order_id: p.purchase_order_id,
        status: p.payment_status === "paid" ? "Paid" : p.payment_status === "partially_paid" || p.payment_status === "partial" ? "Partially Paid" : "Unpaid"
      })));
      setProcurementKpis((prev:any) => prev);
    } catch (error) {
      console.error("Failed to fetch purchases", error);
      setPurchases([]);
    }
  };

  const fetchReturns = async () => {
    try {
      const res = await api.get("/api/returns");
      if (!res.ok) {
        setReturns([]);
        return;
      }
      const data = await res.json();
      setReturns(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch purchase returns", error);
      setReturns([]);
    }
  };

  const handleApproveReturn = async (returnId: number) => {
    try {
      const res = await api.put(`/api/returns/${returnId}`, { status: "approved" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && !data.rejected) {
        alert("✅ تم اعتماد المرتجع بنجاح وخصم الأصناف من المخزن");
        await Promise.all([fetchPurchases(), fetchReturns()]);
      } else {
        const errorMsg = data.message || data.error || "تم رفض اعتماد المرتجع لعدم كفاية رصيد الأصناف بالمخزن (تم استهلاكها أو بيعها)";
        alert(`❌ تم رفض اعتماد المرتجع:\n\n${errorMsg}`);
      }
    } catch (err: any) {
      alert(err.message || "حدث خطأ أثناء اعتماد المرتجع");
    }
  };

  const fetchPurchaseReceipts = async () => {
    try {
      const res = await api.get("/api/purchase-receipts");
      if (res.ok) {
        const data = await res.json();
        setPurchaseReceipts(Array.isArray(data) ? data : []);
      } else setPurchaseReceipts([]);
    } catch (error) {
      console.error("Failed to fetch purchase receipts", error);
      setPurchaseReceipts([]);
    }
  };

  const fetchExpenses = async () => {
    try {
      const res = await api.get("/api/costs");
      if (res.ok) {
        const payload = await res.json();
        setExpenses(payload.data || (Array.isArray(payload) ? payload : []));
      }
    } catch (error) {
      console.error("Failed to fetch expenses", error);
      setExpenses([]);
    }
  };

  const fetchCostCenters = async () => {
    try {
      const res = await api.get("/api/costs/centers");
      if (res.ok) {
        const payload = await res.json();
        setCostCenters(payload.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCostItems = async () => {
    try {
      const res = await api.get("/api/costs/items");
      if (res.ok) {
        const payload = await res.json();
        setCostItems(payload.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const selectedSup = suppliers.find(
        (s) => String(s.id) === String(expenseFormData.supplier_id)
      );
      const username = localStorage.getItem("username") || "أدمن";
      const payload = {
        voucher_no: expenseFormData.voucher_no || `EXP-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString(),
        branch: expenseFormData.branch || "القاهرة",
        department: expenseFormData.department || "المشتريات",
        cost_center_id: expenseFormData.cost_center_id ? Number(expenseFormData.cost_center_id) : null,
        cost_item_id: expenseFormData.cost_item_id ? Number(expenseFormData.cost_item_id) : null,
        payment_method: expenseFormData.payment_method,
        safe: expenseFormData.safe,
        notes: expenseFormData.notes,
        amount: Number(expenseFormData.amount) || 0,
        status: "معتمد",
        created_by: username,
        link_ledger: true,
        supplier: selectedSup ? selectedSup.name : "",
        supplier_id: expenseFormData.supplier_id ? Number(expenseFormData.supplier_id) : null,
        category: "مشتريات",
        purchase_id: expenseFormData.purchase_id ? Number(expenseFormData.purchase_id) : null,
        purchase_order_id: expenseFormData.purchase_order_id ? Number(expenseFormData.purchase_order_id) : null,
      };
      const res = await api.post("/api/costs", payload);
      if (res.ok) {
        setShowExpenseModal(false);
        setExpenseFormData({
          voucher_no: "",
          amount: "",
          supplier_id: "",
          cost_center_id: "",
          cost_item_id: "",
          payment_method: "نقدي",
          safe: "خزينة فرع القاهرة",
          notes: "",
          branch: "القاهرة",
          department: "المشتريات",
          purchase_id: "",
          purchase_order_id: "",
        });
        fetchExpenses();
      }
    } catch (err) {
      console.error("Error creating expense:", err);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!confirm("هل أنت تأكد من حذف هذا المصروف؟")) return;
    try {
      const res = await api.delete(`/api/costs/${id}`);
      if (res.ok) {
        fetchExpenses();
      }
    } catch (err) {
      console.error("Error deleting expense:", err);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await api.get("/api/suppliers");
      const data = await res.json();
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch suppliers", error);
      setSuppliers([]);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await api.get("/api/branches");
      if (res.ok) {
        const data = await res.json();
        setBranches(Array.isArray(data) ? data : []);
      }
    } catch (e) { console.error("Failed to fetch branches", e); setBranches([]); }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await api.get("/api/inventory/warehouses");
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setWarehouses(list);
      if (list.length > 0) {
        const defaultWh = list.find((w: any) => w.type === "main" || w.is_main === 1) || list[0];
        if (defaultWh) {
          setFormData((prev) => ({
            ...prev,
            warehouse_id: prev.warehouse_id || String(defaultWh.id),
          }));
        }
      }
    } catch (error) {
      console.error("Failed to fetch warehouses", error);
      setWarehouses([]);
    }
  };

  const fetchIngredients = async () => {
    try {
      const [ingRes, prodRes] = await Promise.all([
        api.get("/api/ingredients").catch(() => ({ ok: false })),
        api.get("/api/products").catch(() => ({ ok: false })),
      ]);

      let ingData = [];
      let prodData = [];

      try {
        if (ingRes.ok) ingData = await (ingRes as any).json();
      } catch (e) {}
      try {
        if (prodRes.ok) prodData = await (prodRes as any).json();
      } catch (e) {}

      const combined = [
        ...(Array.isArray(ingData) ? ingData : []),
        ...(Array.isArray(prodData)
          ? prodData.map((p: any) => ({
              id: `p_${p.id}`,
              name: p.name,
              item_code: p.barcode || "-",
              unit: "قطعة",
              cost: p.cost || p.price || 0,
              is_product: true,
            }))
          : []),
      ];

      setIngredients(combined);
    } catch (error) {
      console.error("Failed to fetch items", error);
      setIngredients([]);
    }
  };

  const fetchPurchaseDetails = async (id: number, autoPrint = false) => {
    try {
      const res = await api.get(`/api/purchases/${id}`);
      const data = await res.json();
      setSelectedPurchase(data);
      if (autoPrint) {
        setTimeout(() => window.print(), 350);
      }
    } catch (error) {
      console.error("Failed to fetch purchase details", error);
    }
  };

  const calculateSubtotal = () => {
    if (activeTab === "orders") {
      return purchaseItems.reduce(
        (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
        0,
      );
    } else {
      return purchaseItems.reduce(
        (sum, item) =>
          sum +
          (Number(item.accepted_quantity !== undefined ? item.accepted_quantity : item.quantity) || 0) *
            (Number(item.unit_price) || 0),
        0,
      );
    }
  };

  const calculateTaxAmount = () => {
    const subtotal = calculateSubtotal();
    if (activeTab === "orders" || showOrderModal) {
      if (orderFormData.tax_amount !== "" && orderFormData.tax_amount !== undefined) {
        return Math.max(0, Number(orderFormData.tax_amount) || 0);
      }
      const rate = Math.max(0, Number(orderFormData.tax_rate) || 0);
      return Math.round((subtotal * (rate / 100)) * 100) / 100;
    }
    if (formData.tax_amount !== "" && formData.tax_amount !== undefined) {
      return Math.max(0, Number(formData.tax_amount) || 0);
    }
    const rate = Math.max(0, Number(formData.tax_rate) || 0);
    return Math.round((subtotal * (rate / 100)) * 100) / 100;
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    return Math.round((subtotal + calculateTaxAmount()) * 100) / 100;
  };

  const exportInvoiceToWord = (inv: any) => {
    const headers = ["البيان", "القيمة / التفاصيل"];
    const rows = [
      ["رقم الفاتورة", inv.invoice_number || `INV-${inv.id}`],
      ["المورد", inv.supplier || inv.supplier_name],
      ["تاريخ الفاتورة", formatDateEN(inv.date)],
      [
        "استحقاق الدفع",
        inv.due_date ? formatDateEN(inv.due_date) : "-",
      ],
      [
        "الحالة",
        inv.status === "Paid"
          ? "تم دفعها"
          : inv.status === "Draft"
            ? "مسودة"
            : "متأخرة",
      ],
      ["مرتبط بأمر شراء", inv.order_id ? `PO-${inv.order_id}` : "-"],
      [
        "إجمالي الفاتورة المطلوب",
        `${formatNumberEN(inv.total_amount || 0 || 0)} ج.م`,
      ],
    ];

    downloadDataAsWord(
      headers,
      rows,
      `فاتورة_مشتريات_${inv.invoice_number || inv.id}`,
      `فاتورة مشتريات رقم ${inv.invoice_number || inv.id}`,
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Synchronous UI guard: React state alone is not enough for an ultra-fast
    // double-click because the second event can arrive before the re-render.
    if (isSavingReceivingRef.current || isSavingReceiving) return;
    isSavingReceivingRef.current = true;
    if (purchaseItems.length === 0) return;
    const defaultWh = warehouses.find((w: any) => w.type === "main" || w.is_main === 1) || warehouses[0];
    const resolvedWarehouseId = formData.warehouse_id || purchaseItems.find((i: any) => i.warehouse_id)?.warehouse_id || (defaultWh ? String(defaultWh.id) : "");
    if (!resolvedWarehouseId) {
      isSavingReceivingRef.current = false;
      alert("الرجاء اختيار المخزن المستلم");
      return;
    }
    if (!formData.supplier_id) {
      isSavingReceivingRef.current = false;
      alert("الرجاء اختيار المورد");
      return;
    }

    const subtotal = calculateSubtotal();
    const tax_amount = calculateTaxAmount();
    const tax_rate = Number(formData.tax_rate) || 0;
    const total_amount = Math.round((subtotal + tax_amount) * 100) / 100;
    const paid_amount = Number(formData.paid_amount) || 0;
    if (!receivingSaveKeyRef.current) {
      receivingSaveKeyRef.current = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    const idempotencyKey = receivingSaveKeyRef.current;

    setIsSavingReceiving(true);

    try {
      let receiptId: number | null = null;

      // Enterprise flow: post the GRN first. Stock is updated only by the GRN, never twice.
      if (formData.order_id) {
        const receiptRes = await api.post("/api/purchase-receipts", {
          idempotency_key: idempotencyKey,
          purchase_order_id: Number(formData.order_id),
          supplier_id: Number(formData.supplier_id),
          warehouse_id: Number(resolvedWarehouseId),
          tax_amount,
          tax_rate,
          notes: formData.notes,
          created_by: localStorage.getItem("username") || "admin",
          items: purchaseItems.map((item:any) => ({
            purchase_order_item_id: item.purchase_order_item_id,
            ingredient_id: item.ingredient_id,
            received_quantity: Number(item.accepted_quantity || 0) + Number(item.rejected_quantity || 0),
            accepted_quantity: Number(item.accepted_quantity || 0),
            rejected_quantity: Number(item.rejected_quantity || 0),
            unit_price: item.unit_price,
            expiry_date: item.expiry_date || null,
            batch_number: item.batch_number || null,
            location: item.location || null,
          })).filter((i:any) => i.received_quantity > 0)
        });
        if (!receiptRes.ok) {
          const er = await receiptRes.json().catch(() => null);
          throw new Error(er?.error || "فشل إنشاء محضر الاستلام");
        }
        const receipt = await receiptRes.json();
        receiptId = Number(receipt.id);
      }

      const res = await api.post("/api/purchases", {
        idempotency_key: idempotencyKey,
        supplier_id: Number(formData.supplier_id),
        warehouse_id: Number(resolvedWarehouseId),
        order_id: formData.order_id ? Number(formData.order_id) : undefined,
        purchase_order_id: formData.order_id ? Number(formData.order_id) : undefined,
        receipt_id: receiptId,
        invoice_number: formData.invoice_number,
        subtotal,
        tax_rate,
        tax_amount,
        total_amount,
        paid_amount,
        notes: formData.notes,
        items: purchaseItems.map((item) => ({
          ingredient_id: item.ingredient_id,
          quantity: item.accepted_quantity ?? item.quantity,
          unit_price: item.unit_price,
          total_price: (item.accepted_quantity ?? item.quantity) * item.unit_price,
          expiry_date: item.expiry_date || null,
          batch_number: item.batch_number || null,
        })),
      });

      if (res.ok) {
        setShowModal(false);
        setFormData({
          supplier_id: "",
          warehouse_id: "",
          invoice_number: "",
          tax_rate: "0",
          tax_amount: "",
          paid_amount: "",
          notes: "",
          order_id: "",
        });
        setPurchaseItems([]);
        receivingSaveKeyRef.current = "";
        isSavingReceivingRef.current = false;
        setIsSavingReceiving(false);
        await Promise.all([fetchPurchases(), fetchPurchaseReceipts(), fetchOrders(), fetchProcurementDashboard(), fetchSuppliers()]);
      } else {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || `فشل الحفظ. كود الخطأ: ${res.status}`);
      }
    } catch (error: any) {
      console.error(error);
      // Keep the same idempotency key on failure so a retry is safe even if the
      // server committed the receipt but the network response was lost.
      isSavingReceivingRef.current = false;
      setIsSavingReceiving(false);
      alert(`فشل الحفظ: ${error.message || "تأكد من اختيار المورد والمخزن وتعبئة كافة البيانات بشكل صحيح"}`);
    }
  };

  const filteredPurchases = purchases.filter(
    (p) =>
      (p.supplier_name && p.supplier_name.includes(searchQuery)) ||
      (p.invoice_number && p.invoice_number.includes(searchQuery)),
  );

  const filteredOrders = orders.filter(
    (o) =>
      (o.supplier_name && o.supplier_name.includes(searchQuery)) ||
      (o.id && o.id.toString().includes(searchQuery)) ||
      (o.items &&
        o.items.some(
          (item: any) =>
            item.ingredient_name && item.ingredient_name.includes(searchQuery),
        )),
  );

  const filteredRequests = requests.filter(
    (r) => r.requested_by && r.requested_by.includes(searchQuery),
  );

  const filteredQuotations = quotations.filter(
    (q) =>
      !searchQuery ||
      (q.supplier && q.supplier.includes(searchQuery)) ||
      (q.quotation_number && q.quotation_number.includes(searchQuery)) ||
      (q.notes && q.notes.includes(searchQuery))
  );

  const filteredInvoices = invoices.filter(
    (i) => i.supplier && i.supplier.includes(searchQuery),
  );

  const filteredReturns = returns.filter((r) => {
    if (!searchQuery?.trim()) return true;
    const q = String(searchQuery).trim().toLowerCase();
    return [
      r.supplier_name,
      r.supplier,
      r.return_number,
      r.invoice_number,
      r.purchase_id,
      r.warehouse_name,
      r.status,
    ].some((value) => String(value ?? "").toLowerCase().includes(q));
  });

  const filteredExpenses = expenses.filter(
    (e) =>
      !searchQuery ||
      (e.supplier && e.supplier.includes(searchQuery)) ||
      (e.voucher_no && e.voucher_no.includes(searchQuery)) ||
      (e.notes && e.notes.includes(searchQuery)) ||
      (e.cost_center_name && e.cost_center_name.includes(searchQuery)) ||
      (e.cost_item_name && e.cost_item_name.includes(searchQuery))
  );

  useEffect(() => {
    setPage(1);
  }, [activeTab, searchQuery, pageSize]);

  const currentRows =
    activeTab === "receipts" ? filteredPurchases :
    activeTab === "orders" ? filteredOrders :
    activeTab === "requests" ? filteredRequests :
    activeTab === "quotations" ? filteredQuotations :
    activeTab === "invoices" ? filteredInvoices :
    activeTab === "returns" ? filteredReturns :
    activeTab === "expenses" ? filteredExpenses : [];
  const totalPages = Math.max(1, Math.ceil(currentRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = currentRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pageStart = currentRows.length ? (safePage - 1) * pageSize + 1 : 0;
  const pageEnd = Math.min(safePage * pageSize, currentRows.length);
  const paginatedPurchases = activeTab === "receipts" ? paginatedRows : [];
  const paginatedOrders = activeTab === "orders" ? paginatedRows : [];
  const paginatedRequests = activeTab === "requests" ? paginatedRows : [];
  const paginatedQuotations = activeTab === "quotations" ? paginatedRows : [];
  const paginatedInvoices = activeTab === "invoices" ? paginatedRows : [];
  const paginatedReturns = activeTab === "returns" ? paginatedRows : [];
  const paginatedExpenses = activeTab === "expenses" ? paginatedRows : [];

  const renderPurchasePagination = () => currentRows.length > 0 ? (
    <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-3 text-sm font-bold text-slate-700" dir="ltr">
      <div className="flex items-center gap-2">
        <span className="text-slate-500" dir="rtl">عرض</span>
        <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-center font-bold outline-none focus:ring-2 focus:ring-blue-200">
          <option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
        </select>
        <span className="text-slate-500" dir="rtl">صف في الصفحة</span>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => setPage(1)} disabled={safePage === 1} className="h-9 min-w-9 px-2 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed">«</button>
        <button onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage === 1} className="h-9 min-w-9 px-2 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed">‹</button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const start = Math.min(Math.max(1, safePage - 2), Math.max(1, totalPages - 4));
          return start + i;
        }).filter((n) => n <= totalPages).map((n) => (
          <button key={n} onClick={() => setPage(n)} className={`h-9 min-w-9 px-2 rounded-lg border font-black ${n === safePage ? "bg-[#2F5F9F] text-white border-[#2F5F9F]" : "bg-white text-slate-700 border-slate-200 hover:bg-blue-50"}`}>{toEnglishDigits(n)}</button>
        ))}
        <button onClick={() => setPage(Math.min(totalPages, safePage + 1))} disabled={safePage === totalPages} className="h-9 min-w-9 px-2 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed">›</button>
        <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages} className="h-9 min-w-9 px-2 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed">»</button>
      </div>
      <div className="text-slate-500" dir="rtl">{toEnglishDigits(pageStart)} - {toEnglishDigits(pageEnd)} من {toEnglishDigits(currentRows.length)}</div>
    </div>
  ) : null;

  // Reports States
  const [reportSupplierId, setReportSupplierId] = useState<string>("");
  const [reportStartDate, setReportStartDate] = useState<string>("");
  const [reportEndDate, setReportEndDate] = useState<string>("");
  const [reportWarehouseId, setReportWarehouseId] = useState<string>("");
  const [reportStatus, setReportStatus] = useState<string>("");
  const reportIds = [
    "purchase_summary", "purchase_orders_report", "purchase_requests_report",
    "purchase_quotations_report", "purchase_receipts_report", "purchase_invoices_report",
    "purchase_returns_report", "purchase_expenses_report", "purchase_suppliers_report",
    "purchase_items_report", "purchase_prices_report", "purchase_payments_report",
    "purchase_outstanding_report", "purchase_taxes_report", "purchase_matching_report",
    "purchase_warehouse_report", "purchase_cost_centers_report", "purchase_monthly_report",
    "purchase_workflow_report"
  ] as const;
  type PurchaseReportId = typeof reportIds[number];
  const [reportSubTab, setReportSubTab] = useState<PurchaseReportId>(
    (initialReport && (reportIds as readonly string[]).includes(initialReport) ? initialReport : "purchase_summary") as PurchaseReportId
  );

  useEffect(() => {
    if (initialReport && (reportIds as readonly string[]).includes(initialReport)) {
      setReportSubTab(initialReport as PurchaseReportId);
    }
  }, [initialReport]);

  const renderReports = () => {
    const money = (value: any) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const qty = (value: any) => Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 3 });
    const dateValue = (row: any) => row?.date || row?.created_at || row?.order_date || row?.request_date || row?.quotation_date || row?.receipt_date || row?.return_date || "";
    const inRange = (value: any) => {
      if (!value) return true;
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return true;
      if (reportStartDate && d < new Date(`${reportStartDate}T00:00:00`)) return false;
      if (reportEndDate && d > new Date(`${reportEndDate}T23:59:59.999`)) return false;
      return true;
    };
    const supplierOk = (row: any) => !reportSupplierId || String(row?.supplier_id || "") === reportSupplierId;
    const warehouseOk = (row: any) => !reportWarehouseId || String(row?.warehouse_id || "") === reportWarehouseId;
    const statusOk = (row: any) => !reportStatus || String(row?.status || row?.payment_status || "") === reportStatus;
    const filterRows = (rows: any[]) => rows.filter(row => supplierOk(row) && warehouseOk(row) && statusOk(row) && inRange(dateValue(row)));

    const fp = filterRows(purchases);
    const fo = filterRows(orders);
    const fr = filterRows(requests);
    const fq = filterRows(quotations);
    const fg = filterRows(purchaseReceipts);
    const fret = filterRows(returns);
    const fe = filterRows(expenses);

    const totalSpend = fp.reduce((s, p) => s + Number(p.total_amount || 0), 0);
    const totalPaid = fp.reduce((s, p) => s + Number(p.paid_amount || 0), 0);
    const totalUnpaid = Math.max(0, totalSpend - totalPaid);
    const totalReturns = fret.reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const totalExpenses = fe.reduce((s, e) => s + Number(e.amount || 0), 0);
    const totalTax = fp.reduce((s, p) => s + Number(p.tax_amount || p.tax || 0), 0);
    const netSpend = totalSpend + totalExpenses - totalReturns;
    const totalOrdered = fo.reduce((s, o) => s + Number(o.total_amount || 0), 0);
    const openOrders = fo.filter(o => !["closed", "cancelled", "completed", "received"].includes(String(o.status || "").toLowerCase())).length;
    const acceptedQty = fg.reduce((s, r) => s + Number(r.accepted_quantity || 0), 0);
    const rejectedQty = fg.reduce((s, r) => s + Number(r.rejected_quantity || 0), 0);

    const supplierMap: Record<string, any> = {};
    fp.forEach(p => {
      const key = String(p.supplier_id || p.supplier_name || "unknown");
      if (!supplierMap[key]) supplierMap[key] = { supplier: p.supplier_name || "مورد غير محدد", invoices: 0, purchases: 0, paid: 0, balance: 0, returns: 0 };
      supplierMap[key].invoices++;
      supplierMap[key].purchases += Number(p.total_amount || 0);
      supplierMap[key].paid += Number(p.paid_amount || 0);
      supplierMap[key].balance += Math.max(0, Number(p.total_amount || 0) - Number(p.paid_amount || 0));
    });
    fret.forEach(r => {
      const key = String(r.supplier_id || r.supplier_name || "unknown");
      if (!supplierMap[key]) supplierMap[key] = { supplier: r.supplier_name || "مورد غير محدد", invoices: 0, purchases: 0, paid: 0, balance: 0, returns: 0 };
      supplierMap[key].returns += Number(r.total_amount || 0);
    });
    const supplierRows = Object.values(supplierMap).sort((a,b) => b.purchases - a.purchases);

    const itemMap: Record<string, any> = {};
    fp.forEach(p => (p.items || []).forEach((it: any) => {
      const key = String(it.ingredient_id || it.ingredient_name || it.id);
      if (!itemMap[key]) itemMap[key] = { item: it.ingredient_name || "صنف غير محدد", unit: it.unit || "", quantity: 0, total: 0, lastPrice: 0, minPrice: Number.POSITIVE_INFINITY, maxPrice: 0 };
      const price = Number(it.unit_price || 0);
      itemMap[key].quantity += Number(it.quantity || 0);
      itemMap[key].total += Number(it.total_price || (Number(it.quantity || 0) * price));
      itemMap[key].lastPrice = price;
      itemMap[key].minPrice = Math.min(itemMap[key].minPrice, price);
      itemMap[key].maxPrice = Math.max(itemMap[key].maxPrice, price);
    }));
    const itemRows = Object.values(itemMap).map(x => ({ ...x, avgPrice: x.quantity ? x.total / x.quantity : 0, minPrice: Number.isFinite(x.minPrice) ? x.minPrice : 0 })).sort((a,b) => b.total - a.total);

    const warehouseMap: Record<string, any> = {};
    fp.forEach(p => {
      const key = String(p.warehouse_id || p.warehouse_name || "unknown");
      if (!warehouseMap[key]) warehouseMap[key] = { warehouse: p.warehouse_name || "مخزن غير محدد", invoices: 0, amount: 0, paid: 0, balance: 0 };
      warehouseMap[key].invoices++;
      warehouseMap[key].amount += Number(p.total_amount || 0);
      warehouseMap[key].paid += Number(p.paid_amount || 0);
      warehouseMap[key].balance += Math.max(0, Number(p.total_amount || 0) - Number(p.paid_amount || 0));
    });
    const warehouseRows = Object.values(warehouseMap).sort((a,b) => b.amount - a.amount);

    const costMap: Record<string, any> = {};
    fe.forEach(e => {
      const key = String(e.cost_center_id || e.cost_center_name || e.category || "unknown");
      if (!costMap[key]) costMap[key] = { center: e.cost_center_name || e.category || "غير مصنف", count: 0, amount: 0 };
      costMap[key].count++;
      costMap[key].amount += Number(e.amount || 0);
    });
    const costRows = Object.values(costMap).sort((a,b) => b.amount - a.amount);

    const monthlyMap: Record<string, any> = {};
    fp.forEach(p => { const m = String(dateValue(p)).slice(0,7) || "غير محدد"; if (!monthlyMap[m]) monthlyMap[m] = { month:m, purchases:0, paid:0, invoices:0, returns:0, expenses:0 }; monthlyMap[m].purchases += Number(p.total_amount||0); monthlyMap[m].paid += Number(p.paid_amount||0); monthlyMap[m].invoices++; });
    fret.forEach(r => { const m = String(dateValue(r)).slice(0,7) || "غير محدد"; if (!monthlyMap[m]) monthlyMap[m] = { month:m, purchases:0, paid:0, invoices:0, returns:0, expenses:0 }; monthlyMap[m].returns += Number(r.total_amount||0); });
    fe.forEach(e => { const m = String(dateValue(e)).slice(0,7) || "غير محدد"; if (!monthlyMap[m]) monthlyMap[m] = { month:m, purchases:0, paid:0, invoices:0, returns:0, expenses:0 }; monthlyMap[m].expenses += Number(e.amount||0); });
    const monthlyRows = Object.values(monthlyMap).sort((a,b) => String(a.month).localeCompare(String(b.month)));

    const workflowRows = [
      { stage:"طلبات الشراء", count:fr.length, value:fr.reduce((s,r)=>s+Number(r.total_amount||r.estimated_value||0),0) },
      { stage:"عروض الأسعار", count:fq.length, value:fq.reduce((s,r)=>s+Number(r.estimated_value||r.total_amount||0),0) },
      { stage:"أوامر الشراء", count:fo.length, value:totalOrdered },
      { stage:"سندات الاستلام GRN", count:fg.length, value:acceptedQty },
      { stage:"فواتير المشتريات", count:fp.length, value:totalSpend },
      { stage:"المرتجعات", count:fret.length, value:totalReturns },
    ];
    const matchingRows = fp.map(p => ({
      invoice: p.invoice_number || `#${p.id}`, supplier: p.supplier_name || "-", order: p.purchase_order_id || "-",
      match: p.matching_status || "pending", invoiceAmount: Number(p.total_amount||0), paid: Number(p.paid_amount||0), balance: Math.max(0,Number(p.total_amount||0)-Number(p.paid_amount||0))
    }));
    const paymentRows = fp.reduce((acc: any[], p) => {
      const method = p.payment_method || (Number(p.paid_amount||0) > 0 ? "سداد مرتبط بالفاتورة" : "آجل");
      let row = acc.find(x => x.method === method); if (!row) { row={method,count:0,amount:0}; acc.push(row); } row.count++; row.amount += Number(p.paid_amount||0); return acc;
    }, []);
    const statusRows = (rows: any[]) => Object.entries(rows.reduce((m:any,r:any)=>{const k=String(r.status||r.payment_status||"غير محدد");m[k]=(m[k]||0)+1;return m;},{})).map(([status,count])=>({status,count}));

    const reportDefinitions: Record<string,{title:string, description:string}> = {
      purchase_summary:{title:"ملخص المشتريات الشامل",description:"ملخص مالي وتشغيلي يغطي المشتريات والمدفوعات والمرتجعات والمصاريف والضرائب."},
      purchase_orders_report:{title:"تقرير أوامر الشراء",description:"الأوامر والقيم والحالات والموردين ومواعيد التوريد."},
      purchase_requests_report:{title:"تقرير طلبات الشراء",description:"دورة طلبات الشراء وحالاتها وقيمها."},
      purchase_quotations_report:{title:"تقرير عروض الأسعار والمقارنة",description:"العروض الواردة وقيمها وحالاتها وربطها بطلبات الشراء."},
      purchase_receipts_report:{title:"تقرير الاستلام والفحص GRN",description:"سندات الاستلام والكميات المقبولة والمرفوضة وربطها بالمخازن وأوامر الشراء."},
      purchase_invoices_report:{title:"تقرير فواتير المشتريات",description:"الفواتير والقيم والمدفوعات والأرصدة وحالة السداد."},
      purchase_returns_report:{title:"تقرير مرتجعات المشتريات",description:"المرتجعات وقيمتها وموردها والفاتورة المرتبطة."},
      purchase_expenses_report:{title:"تقرير المصاريف والتكاليف الإضافية",description:"المصاريف المرتبطة بالمشتريات ومراكز التكلفة وبنود المصروف."},
      purchase_suppliers_report:{title:"تقرير مشتريات الموردين",description:"حجم الشراء والسداد والرصيد والمرتجعات لكل مورد."},
      purchase_items_report:{title:"تقرير الأصناف والكميات المشتراة",description:"الكميات والقيم ومتوسط وأدنى وأعلى سعر شراء لكل صنف."},
      purchase_prices_report:{title:"تقرير أسعار الشراء",description:"تحليل أسعار شراء الأصناف ومقارنتها داخل الفترة المحددة."},
      purchase_payments_report:{title:"تقرير مدفوعات الموردين",description:"المدفوعات المسجلة ونسبتها من إجمالي المشتريات."},
      purchase_outstanding_report:{title:"تقرير مستحقات الموردين وأعمار الديون",description:"الأرصدة غير المسددة وتصنيفها حسب حالة السداد."},
      purchase_taxes_report:{title:"تقرير ضرائب المشتريات",description:"ضريبة المشتريات المسجلة وإجمالي الفواتير الخاضعة لها."},
      purchase_matching_report:{title:"تقرير المطابقة الثلاثية 3-Way Match",description:"مطابقة أمر الشراء والاستلام وفاتورة المورد وإظهار الاستثناءات."},
      purchase_warehouse_report:{title:"تقرير المشتريات حسب المخزن",description:"قيمة المشتريات والمدفوعات والأرصدة حسب المخزن."},
      purchase_cost_centers_report:{title:"تقرير المشتريات حسب مراكز التكلفة",description:"تحليل المصاريف والتكاليف الإضافية حسب مركز التكلفة."},
      purchase_monthly_report:{title:"التقرير الشهري والاتجاهات",description:"الاتجاه الشهري للمشتريات والمدفوعات والمرتجعات والمصاريف."},
      purchase_workflow_report:{title:"تقرير دورة المشتريات ومراحلها",description:"حجم المعاملات وقيمتها في كل مرحلة من الطلب حتى الفاتورة والمرتجع."},
    };
    const def = reportDefinitions[reportSubTab] || reportDefinitions.purchase_summary;

    const columnsByReport: Record<string,string[]> = {
      purchase_orders_report:["رقم الأمر","المورد","التاريخ","موعد التوريد","الحالة","القيمة"],
      purchase_requests_report:["رقم الطلب","التاريخ","الطالب","الحالة","القيمة"],
      purchase_quotations_report:["رقم العرض","المورد","طلب الشراء","التاريخ","الحالة","القيمة"],
      purchase_receipts_report:["رقم GRN","المورد","المخزن","التاريخ","إجمالي الكمية","المقبول","المرفوض"],
      purchase_invoices_report:["رقم الفاتورة","المورد","التاريخ","الإجمالي","المدفوع","المتبقي","الحالة"],
      purchase_returns_report:["رقم المرتجع","المورد","الفاتورة","التاريخ","القيمة","الحالة"],
      purchase_expenses_report:["السند","مركز التكلفة","البند","التاريخ","طريقة الدفع","المبلغ"],
      purchase_suppliers_report:["المورد","الفواتير","المشتريات","المدفوع","المستحق","المرتجعات"],
      purchase_items_report:["الصنف","الوحدة","الكمية","القيمة","متوسط السعر","أدنى سعر","أعلى سعر"],
      purchase_prices_report:["الصنف","الكمية","متوسط السعر","أدنى سعر","أعلى سعر","آخر سعر"],
      purchase_payments_report:["طريقة/مصدر السداد","عدد الفواتير","إجمالي المدفوع"],
      purchase_outstanding_report:["المورد","عدد الفواتير","المشتريات","المدفوع","المستحق","حالة السداد"],
      purchase_taxes_report:["رقم الفاتورة","المورد","التاريخ","الإجمالي","الضريبة","بعد الضريبة"],
      purchase_matching_report:["الفاتورة","المورد","أمر الشراء","حالة المطابقة","قيمة الفاتورة","المدفوع","الرصيد"],
      purchase_warehouse_report:["المخزن","الفواتير","المشتريات","المدفوع","المستحق"],
      purchase_cost_centers_report:["مركز التكلفة","عدد السندات","إجمالي التكلفة"],
      purchase_monthly_report:["الشهر","الفواتير","المشتريات","المدفوع","المرتجعات","المصاريف"],
      purchase_workflow_report:["المرحلة","عدد المعاملات","القيمة/الكمية"],
    };

    const rowsForReport = (): any[] => {
      switch(reportSubTab) {
        case "purchase_orders_report": return fo.map(o=>({"رقم الأمر":o.order_number||`#${o.id}`,"المورد":o.supplier_name||"-","التاريخ":String(dateValue(o)).slice(0,10),"موعد التوريد":o.delivery_date||"-","الحالة":o.status||"-","القيمة":Number(o.total_amount||0)}));
        case "purchase_requests_report": return fr.map(r=>({"رقم الطلب":r.request_number||`#${r.id}`,"التاريخ":String(dateValue(r)).slice(0,10),"الطالب":r.requested_by||"-","الحالة":r.status||"-","القيمة":Number(r.total_amount||r.estimated_value||0)}));
        case "purchase_quotations_report": return fq.map(q=>({"رقم العرض":q.quotation_number||`#${q.id}`,"المورد":q.supplier||q.supplier_name||"-","طلب الشراء":q.request_id||"-","التاريخ":String(dateValue(q)).slice(0,10),"الحالة":q.status||"-","القيمة":Number(q.estimated_value||q.total_amount||0)}));
        case "purchase_receipts_report": return fg.map(g=>({"رقم GRN":g.receipt_number||g.receipt_no||`#${g.id}`,"المورد":g.supplier_name||"-","المخزن":g.warehouse_name||"-","التاريخ":String(dateValue(g)).slice(0,10),"إجمالي الكمية":Number(g.total_quantity||0),"المقبول":Number(g.accepted_quantity||0),"المرفوض":Number(g.rejected_quantity||0)}));
        case "purchase_invoices_report": return fp.map(p=>({"رقم الفاتورة":p.invoice_number||`#${p.id}`,"المورد":p.supplier_name||"-","التاريخ":String(dateValue(p)).slice(0,10),"الإجمالي":Number(p.total_amount||0),"المدفوع":Number(p.paid_amount||0),"المتبقي":Math.max(0,Number(p.total_amount||0)-Number(p.paid_amount||0)),"الحالة":p.payment_status||p.status||"-"}));
        case "purchase_returns_report": return fret.map(r=>({"رقم المرتجع":r.return_number||`#${r.id}`,"المورد":r.supplier_name||"-","الفاتورة":r.invoice_number||"-","التاريخ":String(dateValue(r)).slice(0,10),"القيمة":Number(r.total_amount||0),"الحالة":r.status||"-"}));
        case "purchase_expenses_report": return fe.map(e=>({"السند":e.voucher_no||`#${e.id}`,"مركز التكلفة":e.cost_center_name||"-","البند":e.cost_item_name||e.category||"-","التاريخ":String(dateValue(e)).slice(0,10),"طريقة الدفع":e.payment_method||"-","المبلغ":Number(e.amount||0)}));
        case "purchase_suppliers_report": return supplierRows.map(x=>({"المورد":x.supplier,"الفواتير":x.invoices,"المشتريات":x.purchases,"المدفوع":x.paid,"المستحق":x.balance,"المرتجعات":x.returns}));
        case "purchase_items_report": return itemRows.map(x=>({"الصنف":x.item,"الوحدة":x.unit,"الكمية":x.quantity,"القيمة":x.total,"متوسط السعر":x.avgPrice,"أدنى سعر":x.minPrice,"أعلى سعر":x.maxPrice}));
        case "purchase_prices_report": return itemRows.map(x=>({"الصنف":x.item,"الكمية":x.quantity,"متوسط السعر":x.avgPrice,"أدنى سعر":x.minPrice,"أعلى سعر":x.maxPrice,"آخر سعر":x.lastPrice}));
        case "purchase_payments_report": return paymentRows.map(x=>({"طريقة/مصدر السداد":x.method,"عدد الفواتير":x.count,"إجمالي المدفوع":x.amount}));
        case "purchase_outstanding_report": return supplierRows.map(x=>({"المورد":x.supplier,"عدد الفواتير":x.invoices,"المشتريات":x.purchases,"المدفوع":x.paid,"المستحق":x.balance,"حالة السداد":x.balance<=0?"مسدد":"مستحق"}));
        case "purchase_taxes_report": return fp.map(p=>({"رقم الفاتورة":p.invoice_number||`#${p.id}`,"المورد":p.supplier_name||"-","التاريخ":String(dateValue(p)).slice(0,10),"الإجمالي":Number(p.total_amount||0),"الضريبة":Number(p.tax_amount||p.tax||0),"بعد الضريبة":Number(p.total_amount||0)+Number(p.tax_amount||p.tax||0)}));
        case "purchase_matching_report": return matchingRows.map(x=>({"الفاتورة":x.invoice,"المورد":x.supplier,"أمر الشراء":x.order,"حالة المطابقة":x.match,"قيمة الفاتورة":x.invoiceAmount,"المدفوع":x.paid,"الرصيد":x.balance}));
        case "purchase_warehouse_report": return warehouseRows.map(x=>({"المخزن":x.warehouse,"الفواتير":x.invoices,"المشتريات":x.amount,"المدفوع":x.paid,"المستحق":x.balance}));
        case "purchase_cost_centers_report": return costRows.map(x=>({"مركز التكلفة":x.center,"عدد السندات":x.count,"إجمالي التكلفة":x.amount}));
        case "purchase_monthly_report": return monthlyRows.map(x=>({"الشهر":x.month,"الفواتير":x.invoices,"المشتريات":x.purchases,"المدفوع":x.paid,"المرتجعات":x.returns,"المصاريف":x.expenses}));
        case "purchase_workflow_report": return workflowRows.map(x=>({"المرحلة":x.stage,"عدد المعاملات":x.count,"القيمة/الكمية":x.value}));
        default: return [];
      }
    };

    const exportReport = () => {
      const rows = rowsForReport();
      const headers = rows.length ? Object.keys(rows[0]) : (columnsByReport[reportSubTab] || ["البيان","القيمة"]);
      const csv = [headers, ...rows.map(r=>headers.map(h=>String(r[h] ?? "").replaceAll('"','""')))]
        .map(row=>row.map(v=>`"${v}"`).join(",")).join("\n");
      const blob = new Blob(["\uFEFF" + csv], {type:"text/csv;charset=utf-8;"});
      const url = URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`purchase-report-${reportSubTab}-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
    };

    const reportTabs = Object.entries(reportDefinitions) as [PurchaseReportId,{title:string,description:string}][];
    const tableRows = rowsForReport();
    const summaryCards = [
      ["إجمالي المشتريات", totalSpend, "ج.م"], ["إجمالي المدفوع", totalPaid, "ج.م"], ["إجمالي المستحق", totalUnpaid, "ج.م"],
      ["صافي الإنفاق", netSpend, "ج.م"], ["قيمة أوامر الشراء", totalOrdered, "ج.م"], ["قيمة المرتجعات", totalReturns, "ج.م"],
      ["المصاريف الإضافية", totalExpenses, "ج.م"], ["ضريبة المشتريات", totalTax, "ج.م"], ["الاستلام المقبول", acceptedQty, "وحدة"], ["الاستلام المرفوض", rejectedQty, "وحدة"],
    ];

    return <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 print:hidden">
        <div className="flex flex-wrap gap-2 mb-4 max-h-64 overflow-y-auto">
          {reportTabs.map(([id,d]) => <button key={id} onClick={()=>setReportSubTab(id)} className={`px-3 py-2 rounded-xl text-[11px] font-black border transition-all ${reportSubTab===id?"bg-emerald-600 text-white border-emerald-600 shadow":"bg-slate-50 text-slate-600 border-slate-200 hover:border-emerald-300"}`}>{d.title}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select value={reportSupplierId} onChange={e=>setReportSupplierId(e.target.value)} className="p-2.5 bg-slate-50 border rounded-xl text-xs font-bold"><option value="">كل الموردين</option>{suppliers.map(s=><option key={s.id} value={String(s.id)}>{s.name}</option>)}</select>
          <select value={reportWarehouseId} onChange={e=>setReportWarehouseId(e.target.value)} className="p-2.5 bg-slate-50 border rounded-xl text-xs font-bold"><option value="">كل المخازن</option>{warehouses.map(w=><option key={w.id} value={String(w.id)}>{w.name}</option>)}</select>
          <select value={reportStatus} onChange={e=>setReportStatus(e.target.value)} className="p-2.5 bg-slate-50 border rounded-xl text-xs font-bold"><option value="">كل الحالات</option><option value="paid">Paid / مسدد</option><option value="partially_paid">Partially Paid / جزئي</option><option value="unpaid">Unpaid / غير مسدد</option><option value="approved">Approved / معتمد</option><option value="pending">Pending / معلق</option><option value="received">Received / مستلم</option></select>
          <div className="flex items-center gap-2 bg-slate-50 border rounded-xl px-3 py-2"><Calendar className="w-4 h-4 text-slate-400"/><input type="date" value={reportStartDate} onChange={e=>setReportStartDate(e.target.value)} className="bg-transparent text-xs font-bold outline-none"/><span className="text-slate-400">→</span><input type="date" value={reportEndDate} onChange={e=>setReportEndDate(e.target.value)} className="bg-transparent text-xs font-bold outline-none"/></div>
          <button onClick={()=>{setReportSupplierId("");setReportWarehouseId("");setReportStatus("");setReportStartDate("");setReportEndDate("");}} className="px-3 py-2 rounded-xl bg-rose-50 text-rose-600 text-xs font-black">مسح الفلاتر</button>
          <button onClick={()=>window.print()} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-black flex items-center gap-1"><Printer className="w-4 h-4"/> طباعة</button>
          <button onClick={exportReport} className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-black flex items-center gap-1"><Download className="w-4 h-4"/> تصدير CSV</button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4 mb-5"><div><h2 className="text-xl font-black text-slate-900">{def.title}</h2><p className="text-xs text-slate-500 mt-1">{def.description}</p></div><FileText className="w-7 h-7 text-emerald-600"/></div>
        {reportSubTab === "purchase_summary" ? <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">{summaryCards.map(([label,value,unit])=><div key={String(label)} className="border rounded-2xl p-4 bg-slate-50"><div className="text-[10px] font-bold text-slate-500">{label}</div><div className="text-lg font-black text-slate-900 mt-1">{money(value)} <span className="text-[9px] text-slate-400">{unit}</span></div></div>)}</div>
          <div className="grid lg:grid-cols-3 gap-4"><div className="border rounded-2xl p-4"><h3 className="font-black text-sm mb-3">أعلى الموردين</h3>{supplierRows.slice(0,8).map((x,i)=><div key={i} className="flex justify-between border-b last:border-0 py-2 text-xs"><span className="font-bold">{x.supplier}</span><span className="font-mono font-black">{money(x.purchases)}</span></div>)}</div><div className="border rounded-2xl p-4"><h3 className="font-black text-sm mb-3">دورة المشتريات</h3>{workflowRows.map((x,i)=><div key={i} className="flex justify-between border-b last:border-0 py-2 text-xs"><span>{x.stage}</span><b>{qty(x.count)}</b></div>)}</div><div className="border rounded-2xl p-4"><h3 className="font-black text-sm mb-3">حالات الفواتير</h3>{statusRows(fp).map((x:any,i)=><div key={i} className="flex justify-between border-b last:border-0 py-2 text-xs"><span>{x.status}</span><b>{x.count}</b></div>)}</div></div>
        </> : <div className="overflow-x-auto"><table className="w-full text-center text-sm border-collapse"><thead className="bg-[#2F5F9F] text-white"><tr>{(tableRows.length?Object.keys(tableRows[0]):(columnsByReport[reportSubTab]||["البيان","القيمة"])).map(h=><th key={h} className="p-3 text-center font-black text-white whitespace-nowrap">{h}</th>)}</tr></thead><tbody className="divide-y">{tableRows.length?tableRows.map((row,i)=><tr key={i} className="hover:bg-blue-50/50">{Object.keys(row).map(k=><td key={k} className="p-3 font-bold text-slate-700 whitespace-nowrap">{typeof row[k] === "number" ? money(row[k]) : String(row[k] ?? "-")}</td>)}</tr>):<tr><td colSpan={(columnsByReport[reportSubTab]||["البيان"]).length} className="p-12 text-center text-slate-400 font-bold">لا توجد بيانات مطابقة للفلاتر الحالية</td></tr>}</tbody></table></div>}
      </div>
    </div>;
  };

  return (
    <div className="p-7 space-y-7">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <XCircle className="w-6 h-6 text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <ShoppingCart className="w-8 h-8 text-emerald-500" />
              {initialTab
                ? tabNames[activeTab] || "أوامر واستلام المشتريات"
                : "أوامر واستلام المشتريات"}
            </h1>
            <p className="text-slate-500 mt-1">
              {initialTab
                ? `القسم الفرعي: ${tabNames[activeTab] || ""}`
                : "إدارة أوامر الشراء واستلام المخزون"}
            </p>
          </div>
        </div>

        {!initialTab && (
          <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl gap-1">
            {(Object.keys(tabNames) as PurchaseTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === tab ? "bg-[#2F5F9F] text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                {tabNames[tab]}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsOcrModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 text-white rounded-xl hover:from-blue-800 hover:to-purple-800 transition-colors font-bold shadow-sm"
          >
            <Sparkles className="w-5 h-5 text-blue-300 animate-pulse" />
            مسح فاتورة 📸 OCR
          </button>
          <button
            onClick={() => {
              if (activeTab === "requests") {
                createRequestKeyRef.current = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
                setIsCreatingRequest(false);
                setEditingRequestId(null);
                setShowRequestModal(true);
              }
              else if (activeTab === "quotations") setShowQuotationModal(true);
              else if (activeTab === "orders") {
                setPurchaseItems([]);
                setLinkedRequestId("");
                setShowOrderModal(true);
              }
              else if (activeTab === "receipts") {
                receivingSaveKeyRef.current = (typeof crypto !== "undefined" && crypto.randomUUID)
                  ? crypto.randomUUID()
                  : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
                isSavingReceivingRef.current = false;
                setIsSavingReceiving(false);
                setShowModal(true);
              }
              else if (activeTab === "invoices") {
                setSelectedInvoice(null);
                setShowInvoiceModal(true);
              } else if (activeTab === "returns") setShowReturnModal(true);
              else if (activeTab === "expenses") setShowExpenseModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#2F5F9F] text-white rounded-xl hover:bg-[#244D80] transition-colors font-bold shadow-sm"
          >
            <Plus className="w-5 h-5" />
            {activeTab === "requests"
              ? "إنشاء طلب شراء"
              : activeTab === "quotations"
                ? "إضافة عرض سعر"
                : activeTab === "orders"
                  ? "إنشاء أمر شراء"
                  : activeTab === "receipts"
                    ? "إستلام مشتريات جديد"
                    : activeTab === "invoices"
                      ? "إنشاء فاتورة مشتريات"
                      : activeTab === "returns"
                        ? "إنشاء مرتجع مشتريات"
                        : activeTab === "expenses"
                          ? "إضافة مروف إضافي"
                          : "جديد"}
          </button>
        </div>
      </div>

      {procurementKpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 print:hidden">
          {[
            ["مشتريات الشهر", procurementKpis.month_purchases, "ج.م"],
            ["أوامر مفتوحة", procurementKpis.open_orders, "أمر"],
            ["قيمة الأوامر المفتوحة", procurementKpis.open_order_value, "ج.م"],
            ["مستحقات الموردين", procurementKpis.outstanding, "ج.م"],
            ["فواتير غير مسددة", procurementKpis.unpaid_invoices, "فاتورة"],
            ["فواتير متأخرة", procurementKpis.overdue_invoices, "فاتورة"],
            ["استثناءات المطابقة", procurementKpis.matching_exceptions, "حالة"],
          ].map(([label,value,unit]) => (
            <div key={String(label)} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="text-[11px] font-bold text-slate-500 mb-2">{label}</div>
              <div className="text-lg font-black text-slate-900">{formatNumberEN(value || 0)} <span className="text-[10px] text-slate-400">{unit}</span></div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 print:hidden">
        <div className="relative max-w-xl text-right">
          <Search className="w-5 h-5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="بحث بالاسم، الرقم، أو المورد..."
            value={searchQuery ?? ""}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
          />
        </div>
      </div>

      {activeTab === "receipts" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-auto max-h-[calc(100vh-270px)] print:hidden relative">
          <table className="w-full min-w-[1200px] text-center text-sm border-collapse">
            <thead className="bg-[#2F5F9F] border-b border-[#244D80] sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">رقم الفاتورة</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">التاريخ</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">المورد</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">المخزن المستلم</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">الأصناف</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">الإجمالي</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">المدفوع</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">المتبقي</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedPurchases.map((purchase) => (
                <tr key={purchase.id} className="border-b border-slate-200 hover:bg-blue-50/50">
                  <td className="p-3 font-mono font-bold text-slate-700 text-center align-middle">
                    {purchase.invoice_number || `#${purchase.id}`}
                  </td>
                  <td className="p-3 text-slate-700 text-center align-middle">
                    {formatDateEN(purchase.date)}
                  </td>
                  <td className="p-3 font-bold text-slate-800 text-center align-middle">
                    {purchase.supplier_name}
                  </td>
                  <td className="p-3 text-slate-700 text-center align-middle">
                    {purchase.warehouse_name}
                  </td>
                  <td className="p-3 text-center align-middle text-slate-600 truncate max-w-[200px]" title={purchase.item_names || "لا يوجد أصناف مسجلة"}>
                    {purchase.item_names || "لا يوجد أصناف مسجلة"}
                  </td>
                  <td className="p-3 font-bold text-slate-800 text-center align-middle">
                    {formatNumberEN(purchase.total_amount || 0 || 0)} ج.م
                  </td>
                  <td className="p-3 text-center align-middle text-emerald-600 font-bold">
                    {formatNumberEN(purchase.paid_amount || 0 || 0)} ج.م
                  </td>
                  <td className="p-3 text-center align-middle text-rose-600 font-bold">
                    {formatNumberEN(
                      (purchase.total_amount || 0) - (purchase.paid_amount || 0)
                    )}{" "}
                    ج.م
                  </td>
                  <td className="p-3 text-center align-middle">
                    <button
                      onClick={() => fetchPurchaseDetails(purchase.id)}
                      className="text-blue-600 hover:text-blue-800 font-bold text-sm bg-blue-50 px-2 py-1 rounded-lg"
                    >
                      التفاصيل
                    </button>
                    {(purchase.total_amount || 0) >
                      (purchase.paid_amount || 0) && (
                      <button
                        onClick={() => {
                          setActiveTab("invoices");
                          alert("إنشاء فاتورة مشتريات أو تسجيل الدفعة...");
                        }}
                        className="text-emerald-600 hover:text-emerald-800 font-bold text-sm bg-emerald-50 px-2 py-1 rounded-lg"
                      >
                        إصدار فاتورة
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setActiveTab("returns");
                        setShowReturnModal(true);
                      }}
                      className="text-rose-600 hover:text-rose-800 font-bold text-sm bg-rose-50 px-2 py-1 rounded-lg"
                    >
                      مرتجع
                    </button>
                  </td>
                </tr>
              ))}
              {filteredPurchases.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    لا توجد فواتير مشتريات
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {renderPurchasePagination()}
        </div>
      )}

      {activeTab === "orders" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-auto max-h-[calc(100vh-270px)] print:hidden relative">
          <table className="w-full min-w-[900px] text-center text-sm border-collapse">
            <thead className="bg-[#2F5F9F] border-b border-[#244D80] sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">رقم الأمر</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">التاريخ</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">
                  تاريخ الاستلام المتوقع
                </th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">المورد</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">الصافي</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">الضريبة</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">الإجمالي (شامل الضريبة)</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">الحالة</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedOrders.map((order) => {
                const ordTotal = Number(order.total_amount || 0);
                const ordTax = Number(order.tax_amount || 0);
                const ordSubtotal = Number(order.subtotal || (ordTotal - ordTax));
                return (
                <tr key={order.id} className="border-b border-slate-200 hover:bg-blue-50/50">
                  <td className="p-3 font-mono font-bold text-slate-700 text-center align-middle">
                    {order.order_number || `ORD-${order.id.toString().padStart(4, "0")}`}
                  </td>
                  <td className="p-3 text-slate-700 text-center align-middle">
                    {formatDateEN(order.date)}
                  </td>
                  <td className="p-3 text-slate-700 text-center align-middle">
                    {order.delivery_date
                      ? formatDateEN(order.delivery_date)
                      : "-"}
                  </td>
                  <td className="p-3 font-bold text-slate-800 text-center align-middle">
                    {order.supplier_name}
                  </td>
                  <td className="p-3 font-mono font-semibold text-slate-700 text-center align-middle">
                    {formatNumberEN(ordSubtotal)} ج.م
                  </td>
                  <td className="p-3 font-mono font-bold text-amber-700 text-center align-middle">
                    {ordTax > 0 ? `${formatNumberEN(ordTax)} ج.م${Number(order.tax_rate) > 0 ? ` (${Number(order.tax_rate)}%)` : ""}` : "0 ج.م"}
                  </td>
                  <td className="p-3 font-bold text-emerald-700 font-mono text-center align-middle">
                    {formatNumberEN(ordTotal)} ج.م
                  </td>
                  <td className="p-3 text-center align-middle">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold ${
                        order.status === "completed" || order.status === "approved"
                          ? "bg-emerald-100 text-emerald-800"
                          : order.status === "pending_approval"
                            ? "bg-violet-100 text-violet-800"
                            : order.status === "rejected"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {order.status === "completed" || order.status === "approved"
                        ? "معتمد"
                        : order.status === "pending_approval"
                          ? "بانتظار الموافقة"
                          : order.status === "rejected"
                            ? "مرفوض"
                            : "قيد الانتظار"}
                    </span>
                  </td>
                  <td className="p-3 text-center align-middle">
                    <button
                      onClick={() => fetchOrderDetails(order.id)}
                      className="text-blue-600 hover:text-blue-800 font-bold text-sm bg-blue-50 px-3 py-1 rounded-lg"
                    >
                      التفاصيل
                    </button>
                    {(order.status === "approved" || order.status === "partially_received" || order.status === "completed") && onNavigateToGRN && (
                      <button
                        onClick={() => onNavigateToGRN(order.id)}
                        className="mr-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-bold text-sm px-3 py-1 rounded-lg border border-emerald-200 transition-colors"
                      >
                        استلام المنتجات (GRN)
                      </button>
                    )}
                    {(order.status !== "completed" && order.status !== "pending_approval" && order.status !== "rejected") && (
                      <button
                        onClick={async () => {
                          setActiveTab("receipts");
                          receivingSaveKeyRef.current = (typeof crypto !== "undefined" && crypto.randomUUID)
                            ? crypto.randomUUID()
                            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
                          isSavingReceivingRef.current = false;
                          setIsSavingReceiving(false);
                          setShowModal(true);
                          setFormData((prev) => ({
                            ...prev,
                            supplier_id: String(order.supplier_id || prev.supplier_id || ""),
                            order_id: String(order.id),
                            tax_rate: String(order.tax_rate ?? "0"),
                            tax_amount: Number(order.tax_amount) > 0 ? String(order.tax_amount) : "",
                            warehouse_id: String(order.warehouse_id || prev.warehouse_id || ""),
                          }));
                          try {
                            const res = await api.get(`/api/purchase-orders/${order.id}`);
                            if (res.ok) {
                              const orderData = await res.json();
                              setFormData((prev) => {
                                const defaultWh = warehouses.find((w: any) => w.type === "main" || w.is_main === 1) || warehouses[0];
                                const targetWh = orderData.warehouse_id
                                  ? String(orderData.warehouse_id)
                                  : (orderData.items?.[0]?.warehouse_id
                                      ? String(orderData.items[0].warehouse_id)
                                      : (order.warehouse_id ? String(order.warehouse_id) : (prev.warehouse_id || (defaultWh ? String(defaultWh.id) : ""))));
                                return {
                                  ...prev,
                                  supplier_id: String(orderData.supplier_id || prev.supplier_id || ""),
                                  order_id: String(order.id),
                                  tax_rate: String(orderData.tax_rate ?? order.tax_rate ?? "0"),
                                  tax_amount: Number(orderData.tax_amount ?? order.tax_amount) > 0 ? String(orderData.tax_amount ?? order.tax_amount) : "",
                                  warehouse_id: targetWh,
                                };
                              });
                              setPurchaseItems(
                                (orderData.items || []).map((i: any) => ({
                                  ingredient_id: i.ingredient_id,
                                  name: i.ingredient_name,
                                  unit: i.unit,
                                  quantity: i.quantity,
                                  unit_price: i.unit_price,
                                  total_price: i.quantity * i.unit_price,
                                  purchase_order_item_id: i.id,
                                  previously_received_quantity: Number(i.received_quantity || 0),
                                  accepted_quantity: Math.max(0, Number(i.quantity || 0) - Number(i.received_quantity || 0)),
                                  rejected_quantity: 0,
                                  batch_number: i.batch_number || i.batch_no || i.lot_number || "",
                                  expiry_date: i.expiry_date
                                    ? (String(i.expiry_date).includes("T") ? String(i.expiry_date).split("T")[0] : String(i.expiry_date))
                                    : (i.expiration_date
                                        ? (String(i.expiration_date).includes("T") ? String(i.expiration_date).split("T")[0] : String(i.expiration_date))
                                        : ""),
                                  location: i.location || i.location_name || "",
                                  warehouse_id: i.warehouse_id || orderData.warehouse_id || "",
                                  warehouse_name: i.warehouse_name || orderData.warehouse_name || "",
                                  item_code: i.item_code || i.ingredient_code || i.resolved_item_code || "",
                                  description: i.description || "",
                                }))
                              );
                            }
                          } catch (e) {
                            console.error("Failed to load PO details for receiving:", e);
                          }
                        }}
                        className="text-emerald-600 hover:text-emerald-800 font-bold text-sm bg-emerald-50 px-3 py-1 rounded-lg"
                      >
                        إستلام
                      </button>
                    )}
                  </td>
                </tr>
              );
              })}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    لا يوجد أوامر شراء
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {renderPurchasePagination()}
        </div>
      )}

      {activeTab === "requests" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-auto max-h-[calc(100vh-270px)] print:hidden relative">
          <table className="w-full min-w-[800px] text-center text-sm border-collapse">
            <thead className="bg-[#2F5F9F] border-b border-[#244D80] sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">رقم الطلب</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">التاريخ</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">الفرع</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">المخزن</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">الجهة الطالبة</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">الأولوية</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">عدد الأصناف</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">القيمة التقديرية</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">الحالة</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRequests.map((req) => (
                <tr
                  key={req.id}
                  className="border-b border-slate-200 hover:bg-blue-50/50"
                >
                  <td className="p-3 text-center align-middle font-bold text-emerald-600">{req.request_number || `#${req.id}`}</td>
                  <td className="p-3 text-slate-700 text-center align-middle">{formatDateEN(req.date)}</td>
                  <td className="p-3 text-slate-700 text-center align-middle">{req.branch_name || "-"}</td>
                  <td className="p-3 text-slate-700 text-center align-middle">{req.warehouse_name || "-"}</td>
                  <td className="p-3 text-slate-700 text-center align-middle">{req.requested_by || "-"}</td>
                  <td className="p-3 text-slate-700 text-center align-middle">{({urgent:"عاجلة",high:"عالية",normal:"عادية",low:"منخفضة"} as any)[req.priority] || req.priority || "عادية"}</td>
                  <td className="p-3 text-slate-700 text-center align-middle">{formatNumberEN(req.items_count || 0)}</td>
                  <td className="p-3 text-center align-middle font-bold">{formatNumberEN(req.estimated_total || req.calculated_total || 0)} {req.currency || "EGP"}</td>
                  <td className="p-3 text-center align-middle">
                    <span className="px-3 py-1 rounded-full text-sm font-bold bg-amber-100 text-amber-700">
                      {({Draft:"مسودة",Pending:"قيد التنفيذ",Approved:"مكتمل",Cancelled:"ملغى",Rejected:"مرفوض"} as any)[req.status] || req.status}
                    </span>
                  </td>
                  <td className="p-3 text-center align-middle">
                    <div className="flex flex-wrap gap-2">
                      {req.purchase_order_id ? (
                        <button onClick={() => { setActiveTab("orders"); fetchOrderDetails(Number(req.purchase_order_id)); }} className="text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg font-bold text-xs">عرض أمر الشراء</button>
                      ) : (
                        <>
                          <button onClick={()=>openEditRequest(req)} disabled={String(req.status).toLowerCase() !== "draft" && String(req.status).toLowerCase() !== "pending"} className="text-slate-700 bg-[#2F5F9F] px-3 py-1.5 rounded-lg font-bold text-xs disabled:opacity-40">تعديل</button>
                          <button onClick={()=>duplicateRequest(req)} className="text-violet-700 bg-violet-50 px-3 py-1.5 rounded-lg font-bold text-xs">نسخ</button>
                          {!req.purchase_order_id && String(req.status).toLowerCase() !== "approved" && <button onClick={()=>deleteRequest(req)} className="text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors flex items-center gap-1" title="حذف طلب الشراء"><Trash2 className="w-3.5 h-3.5" /> حذف الطلب</button>}
                          <button
                            onClick={() => handleApproveRequestToOrder(req)}
                            className="text-emerald-700 hover:text-emerald-900 font-bold text-xs bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-4 h-4" /> تحويل لأمر شراء
                          </button>
                          <button
                            onClick={() => { setActiveTab("quotations"); setQuotationFormData({ ...quotationFormData, request_id: String(req.id) }); setShowQuotationModal(true); }}
                            className="text-sky-700 hover:text-sky-900 font-bold text-xs bg-sky-50 px-3 py-1.5 rounded-lg"
                          >
                            إنشاء عرض سعر
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    لا يوجد طلبات شراء
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {renderPurchasePagination()}
        </div>
      )}

      {activeTab === "quotations" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-auto max-h-[calc(100vh-270px)] print:hidden relative">
          <table className="w-full min-w-[800px] text-center text-sm border-collapse">
            <thead className="bg-[#2F5F9F] border-b border-[#244D80] sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">رقم العرض</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">التاريخ</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">مرتبط بطلب</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">المورد</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">القيمة المقدرة</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">الحالة</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedQuotations.map((quot) => (
                <tr
                  key={quot.id}
                  className="border-b border-slate-200 border-b border-slate-200 hover:bg-blue-50/50 transition-colors"
                >
                  <td className="p-3 text-center align-middle font-bold text-emerald-600 font-mono">
                    {quot.quotation_number || `#${quot.id}`}
                  </td>
                  <td className="p-3 text-center align-middle text-slate-600 text-sm">
                    {quot.date ? formatDateEN(quot.date) : "-"}
                  </td>
                  <td className="p-3 text-center align-middle text-slate-600 text-sm font-medium">
                    {quot.request_id ? `#${quot.request_id}` : "غير مرتبط"}
                  </td>
                  <td className="p-3 text-center align-middle font-semibold text-slate-800">
                    {quot.supplier || "غير محدد"}
                  </td>
                  <td className="p-3 text-center align-middle text-slate-800 font-bold">
                    {formatNumberEN(quot.estimated_value || 0 || 0)} ج.م
                  </td>
                  <td className="p-3 text-center align-middle">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      quot.status === "معتمد"
                        ? "bg-emerald-100 text-emerald-700"
                        : quot.status === "Draft" || quot.status === "مسودة"
                        ? "bg-[#2F5F9F] text-slate-700"
                        : "bg-blue-100 text-blue-700"
                    }`}>
                      {quot.status === "Draft" ? "مسودة" : quot.status || "جديد"}
                    </span>
                  </td>
                  <td className="p-3 text-center align-middle">
                    <button onClick={async () => { try { const r = await api.get(`/api/purchase-quotations/${quot.id}`); if (r.ok) setSelectedQuotation(await r.json()); } catch(e) { console.error(e); } }} className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold">تفاصيل</button>
                    {quot.status !== "معتمد" && (
                      <button
                        onClick={() => handleApproveQuotationToOrder(quot)}
                        className="text-emerald-700 hover:text-emerald-900 font-bold text-xs bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        اعتماد كأمر شراء
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteQuotation(quot.id)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                      title="حذف عرض السعر"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredQuotations.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    لا يوجد عروض أسعار مسجلة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {renderPurchasePagination()}
        </div>
      )}

      {activeTab === "invoices" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:hidden flex flex-col">
          <div className="overflow-auto w-full max-h-[calc(100vh-320px)] relative">
            <table className="w-full min-w-max text-center text-sm border-collapse">
              <thead className="bg-[#2F5F9F] border-b border-[#244D80] sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">#</th>
                  <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">رقم الفاتورة الداخلي</th>
                  <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">رقم فاتورة المورد</th>
                  <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">
                    تاريخ الفاتورة
                  </th>
                  <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">المورد</th>
                  <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">
                    أمر الشراء المرتبط
                  </th>
                  <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">
                    إجمالي المبلغ
                  </th>
                  <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">
                    حالة الفاتورة
                  </th>
                  <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">
                    تاريخ الاستحقاق
                  </th>
                  <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedInvoices.map((inv, idx) => (
                  <tr
                    key={inv.id}
                    className="border-b border-slate-200 hover:bg-blue-50/50"
                  >
                    <td className="p-3 text-center align-middle text-slate-500">{toEnglishDigits(Number(pageStart) + idx)}</td>
                    <td
                      className="p-3 text-center align-middle font-bold text-emerald-600"
                      dir="ltr"
                    >
                      {(() => {
                        const raw = inv.invoice_number || inv.internal_invoice_number;
                        if (typeof raw === "string" && !raw.includes("CONCAT(") && !raw.includes("LPAD(") && !raw.includes("TO_CHAR(") && raw.trim()) {
                          return raw;
                        }
                        const dStr = inv.date ? new Date(inv.date).toISOString().slice(0,10).replace(/-/g,"") : "20260920";
                        return `PINV-${dStr}-${String(inv.id || 1).padStart(6,"0")}`;
                      })()}
                    </td>
                    <td className="p-3 text-center align-middle font-mono text-slate-600" dir="ltr">
                      {(() => {
                        const raw = inv.supplier_invoice_number;
                        if (typeof raw === "string" && !raw.includes("CONCAT(") && !raw.includes("LPAD(") && !raw.includes("TO_CHAR(") && raw.trim()) {
                          return raw;
                        }
                        return "-";
                      })()}
                    </td>
                    <td className="p-3 text-slate-700 text-center align-middle">
                      {formatDateEN(inv.date)}
                    </td>
                    <td className="p-3 font-bold text-slate-800 text-center align-middle">
                      {inv.supplier}
                    </td>
                    <td className="p-3 text-slate-700 text-center align-middle" dir="ltr">
                      {inv.purchase_order_number || (inv.order_id ? `PO-${inv.order_id}` : "-")}
                    </td>
                    <td className="p-3 font-bold text-slate-800 text-center align-middle">
                      {formatNumberEN(inv.total_amount || 0 || 0)} ج.م
                    </td>
                    <td className="p-3 text-center align-middle">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-bold ${
                          inv.status === "Paid"
                            ? "bg-emerald-100 text-emerald-700"
                            : inv.status === "Partially Paid"
                              ? "bg-amber-100 text-amber-700"
                              : inv.status === "Draft"
                                ? "bg-[#2F5F9F] text-slate-700"
                                : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {inv.status === "Paid"
                          ? "مدفوعة"
                          : inv.status === "Partially Paid"
                            ? "مدفوعة جزئياً"
                            : inv.status === "Draft"
                              ? "مسودة"
                              : "غير مدفوعة"}
                      </span>
                    </td>
                    <td className="p-3 text-slate-700 text-center align-middle">
                      {inv.due_date
                        ? formatDateEN(inv.due_date)
                        : "-"}
                    </td>
                    <td className="p-3 text-center align-middle">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => fetchPurchaseDetails(inv.id)}
                          className="p-2 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 text-blue-600"
                          title="عرض التفاصيل"
                        >
                          <Search className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const r = await api.get(`/api/purchases/${inv.id}/three-way-match`);
                              const d = await r.json();
                              alert(`حالة المطابقة: ${d.status === "matched" ? "مطابقة" : "استثناء"}`);
                            } catch (e) { alert("تعذر تنفيذ المطابقة"); }
                          }}
                          className="p-2 bg-white border border-violet-200 rounded-lg hover:bg-violet-50 text-violet-600"
                          title="المطابقة الثلاثية"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => fetchPurchaseDetails(inv.id, true)}
                          className="p-2 bg-white border border-slate-200 rounded-lg border-b border-slate-200 hover:bg-blue-50/50 text-slate-600"
                          title="طباعة الفاتورة منسقة"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => exportInvoiceToWord(inv)}
                          className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-blue-50 text-blue-600"
                          title="تصدير وورد"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500">
                      لا يوجد فواتير مشتريات (يمكن إنشاؤها من الاستلامات)
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 text-center align-middle border-t border-slate-100 bg-slate-50 flex justify-between items-center text-sm font-bold text-slate-700">
            <div className="flex gap-8">
              <span>إجمالي الفواتير: {filteredInvoices.length}</span>
              <span>
                إجمالي المبلغ المستحق:{" "}
                {filteredInvoices
                  .filter((i) => String(i.payment_status || i.status || "").toLowerCase() !== "paid")
                  .reduce((sum, i) => sum + (Number(i.total_amount) || 0), 0)
                  .toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                ج.م
              </span>
              <span>
                إجمالي المبلغ المدفوع:{" "}
                {filteredInvoices
                  .filter((i) => String(i.payment_status || i.status || "").toLowerCase() === "paid")
                  .reduce((sum, i) => sum + (Number(i.paid_amount) || 0), 0)
                  .toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                ج.م
              </span>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 border border-slate-200 bg-white rounded-lg border-b border-slate-200 hover:bg-blue-50/50">
                تصدير إلى Excel
              </button>
              <button
                onClick={() => {
                  setSelectedInvoice(null);
                  setShowInvoiceModal(true);
                }}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700"
              >
                إنشاء فاتورة جديدة
              </button>
            </div>
          </div>
          {renderPurchasePagination()}
        </div>
      )}

      {activeTab === "returns" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-auto max-h-[calc(100vh-270px)] print:hidden relative">
          <table className="w-full min-w-[800px] text-center text-sm border-collapse">
            <thead className="bg-[#2F5F9F] border-b border-[#244D80] sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">رقم المرتجع</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">رقم الفاتورة</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">المورد</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">قيمة المرتجع</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">الحالة</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredReturns.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-500">
                    <div className="font-black text-base">لا توجد عمليات مرتجع مطابقة</div>
                    <div className="mt-1 text-xs">تأكد من الفلاتر أو أنشئ مرتجع مشتريات جديدًا.</div>
                  </td>
                </tr>
              )}
              {paginatedReturns.map((ret) => (
                <tr key={ret.id} className="border-t border-slate-200 hover:bg-blue-50/50">
                  <td className="p-3 font-mono font-bold text-slate-700 text-center align-middle">
                    {ret.return_number}
                  </td>
                  <td className="p-3 text-slate-700 text-center align-middle">
                    {ret.invoice_number || `#${ret.purchase_id || "-"}`}
                  </td>
                  <td className="p-3 font-bold text-slate-800 text-center align-middle">
                    {ret.supplier_name || "غير محدد"}
                  </td>
                  <td className="p-3 text-center align-middle font-bold text-rose-600">
                    {formatNumberEN(ret.total_amount || 0 || 0)} ج.م
                  </td>
                  <td className="p-3 text-center align-middle">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      ret.status === "approved"
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                        : ret.status === "pending" || ret.status === "pending_approval"
                          ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                          : ret.status === "rejected"
                            ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                            : ret.status === "cancelled"
                              ? "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                              : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                    }`}>
                      {ret.status === "approved"
                        ? "معتمد"
                        : ret.status === "pending" || ret.status === "pending_approval"
                          ? "قيد المراجعة"
                          : ret.status === "rejected"
                            ? "مرفوض"
                            : ret.status === "cancelled"
                              ? "ملغي"
                              : "مسودة"}
                    </span>
                  </td>
                  <td className="p-3 text-center align-middle">
                    <div className="flex items-center justify-center gap-1.5">
                      {ret.status !== "approved" && (
                        <button
                          onClick={() => handleApproveReturn(ret.id)}
                          className="px-2.5 py-1 text-xs font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200 shadow-sm flex items-center gap-1"
                          title="اعتماد المرتجع وفحص وخصم رصيد المخزن"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          اعتماد
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setSelectedReturnData(ret);
                          setShowReturnModal(true);
                        }}
                        className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1"
                        title="عرض تفاصيل المرتجع"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-600" />
                        عرض
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {renderPurchasePagination()}
        </div>
      )}

      {activeTab === "expenses" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-auto max-h-[calc(100vh-270px)] print:hidden relative">
          <table className="w-full min-w-[800px] text-center text-sm border-collapse">
            <thead className="bg-[#2F5F9F] border-b border-[#244D80] sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">رقم السند</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">التاريخ</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">مركز الكلفة / البند</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">الجهة / المورد</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">طريقة الدفع</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">المبلغ</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">ملاحظات</th>
                <th className="p-3 font-black text-white text-center align-middle whitespace-nowrap">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    لا يوجد مصاريف إضافية مسجلة
                  </td>
                </tr>
              ) : (
                paginatedExpenses.map((exp: any) => (
                  <tr key={exp.id} className="border-b border-slate-200 hover:bg-blue-50/50 transition-colors">
                    <td className="p-3 font-mono font-bold text-slate-700 text-center align-middle">
                      {exp.voucher_no || `#${exp.id}`}
                    </td>
                    <td className="p-3 text-center align-middle text-slate-600 text-sm">
                      {exp.date ? formatDateEN(exp.date) : "-"}
                    </td>
                    <td className="p-3 text-center align-middle">
                      <div className="font-bold text-slate-800 text-sm">
                        {exp.cost_center_name || "مركز عام"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {exp.cost_item_name || exp.category || "مصروف عام"}
                      </div>
                    </td>
                    <td className="p-3 text-center align-middle font-medium text-slate-700 text-sm">
                      {exp.supplier || exp.department || "غير محدد"}
                    </td>
                    <td className="p-3 text-center align-middle text-sm">
                      <span className="px-2.5 py-1 bg-[#2F5F9F] text-slate-700 rounded-lg text-xs font-bold">
                        {exp.payment_method || "نقدي"}
                      </span>
                    </td>
                    <td className="p-3 text-center align-middle font-bold text-emerald-600">
                      {formatNumberEN(exp.amount || 0 || 0)} ج.م
                    </td>
                    <td className="p-3 text-center align-middle text-xs text-slate-500 max-w-[200px] truncate">
                      {exp.notes || "-"}
                    </td>
                    <td className="p-3 text-center align-middle">
                      <button
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                        title="حذف المصروف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {renderPurchasePagination()}
        </div>
      )}

      {activeTab === "settings" && (
        <div className="space-y-6">
          {eInvoiceToast && (
            <div className="fixed top-5 left-5 z-[200] bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl font-black text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>{eInvoiceToast}</span>
            </div>
          )}

          {/* Top Configuration Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden no-print">
            <div className="p-5 border-b bg-gradient-to-l from-emerald-50 to-white flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <Receipt className="w-6 h-6 text-emerald-600" /> منظومة الفاتورة الإلكترونية والضريبية
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  إعدادات الربط الضريبي ومعاينة وإصدار الفواتير الإلكترونية بتصميم قياسي منظم ومنسق جاهز للطباعة (A4).
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white border border-slate-200 font-bold text-sm cursor-pointer shadow-xs">
                  <span className={eInvoiceSettings.enabled ? "text-emerald-700 font-black" : "text-slate-500"}>
                    {eInvoiceSettings.enabled ? "المنظومة مفعلة" : "المنظومة غير مفعلة"}
                  </span>
                  <input
                    type="checkbox"
                    checked={eInvoiceSettings.enabled}
                    onChange={(e) => setEInvoiceSettings({ ...eInvoiceSettings, enabled: e.target.checked })}
                    className="w-5 h-5 accent-emerald-600"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const sampleInv = invoices[0] || purchases[0] || {
                      id: 1001,
                      invoice_number: "EIN-2026-001001",
                      supplier_name: "شركة التوريدات الغذائية المعتمدة",
                      warehouse_name: "المخزن الرئيسي",
                      date: new Date().toISOString(),
                      total_amount: 17100,
                      paid_amount: 17100,
                      notes: "فاتورة إلكترونية ضريبية مطابقة للمواصفات القياسية",
                      items: [
                        { id: 1, ingredient_name: "خامات ومستلزمات تشغيل قياسية", quantity: 10, unit: "كرتونة", unit_price: 1500, total_price: 15000 }
                      ]
                    };
                    if (sampleInv.id && (!sampleInv.items || sampleInv.items.length === 0)) {
                      fetchPurchaseDetails(sampleInv.id);
                    } else {
                      setSelectedPurchase(sampleInv as any);
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> معاينة وطباعة نموذج الفاتورة الإلكترونية
                </button>
              </div>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">بيئة التشغيل</label>
                <select
                  value={eInvoiceSettings.environment}
                  onChange={(e) => setEInvoiceSettings({ ...eInvoiceSettings, environment: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="test">بيئة اختبار تجريبية (Pre-Production / Test)</option>
                  <option value="production">بيئة الإنتاج الفعلية (Production Live)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">رقم التسجيل الضريبي للمنشأة</label>
                <input
                  value={eInvoiceSettings.taxpayer_number}
                  onChange={(e) => setEInvoiceSettings({ ...eInvoiceSettings, taxpayer_number: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-mono font-bold text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="مثال: 310-492-819"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">كود الفرع الضريبي</label>
                <input
                  value={eInvoiceSettings.branch_code}
                  onChange={(e) => setEInvoiceSettings({ ...eInvoiceSettings, branch_code: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-mono font-bold text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">كود النشاط الضريبي (Activity Code)</label>
                <input
                  value={eInvoiceSettings.activity_code}
                  onChange={(e) => setEInvoiceSettings({ ...eInvoiceSettings, activity_code: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-mono font-bold text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="مثال: 5610"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">معرف الربط (Client ID)</label>
                <input
                  value={eInvoiceSettings.client_id}
                  onChange={(e) => setEInvoiceSettings({ ...eInvoiceSettings, client_id: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-mono text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="ERP-CLIENT-ID"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">المفتاح السري (Client Secret)</label>
                <input
                  type="password"
                  value={eInvoiceSettings.client_secret}
                  onChange={(e) => setEInvoiceSettings({ ...eInvoiceSettings, client_secret: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-mono text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="••••••••••••"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">نوع المستند الافتراضي</label>
                <select
                  value={eInvoiceSettings.invoice_type}
                  onChange={(e) => setEInvoiceSettings({ ...eInvoiceSettings, invoice_type: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="purchase">فاتورة ضريبية (Invoice - I)</option>
                  <option value="credit_note">إشعار دائن (Credit Note - C)</option>
                  <option value="debit_note">إشعار مدين (Debit Note - D)</option>
                </select>
              </div>
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={eInvoiceSettings.auto_submit}
                    onChange={(e) => setEInvoiceSettings({ ...eInvoiceSettings, auto_submit: e.target.checked })}
                    className="w-4 h-4 accent-emerald-600"
                  />
                  <span>إرسال تلقائي عند الاعتماد</span>
                </label>
                <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={eInvoiceSettings.auto_retry}
                    onChange={(e) => setEInvoiceSettings({ ...eInvoiceSettings, auto_retry: e.target.checked })}
                    className="w-4 h-4 accent-emerald-600"
                  />
                  <span>إعادة المحاولة عند الفشل</span>
                </label>
                <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl bg-slate-50 font-bold text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={eInvoiceSettings.include_qr}
                    onChange={(e) => setEInvoiceSettings({ ...eInvoiceSettings, include_qr: e.target.checked })}
                    className="w-4 h-4 accent-emerald-600"
                  />
                  <span>إظهار رمز QR الضريبي بالطباعة</span>
                </label>
              </div>
              <div className="md:col-span-2 xl:col-span-3">
                <label className="block text-xs font-bold text-slate-600 mb-1.5">ملاحظات وشروط الفاتورة الإلكترونية المطبوعة</label>
                <textarea
                  value={eInvoiceSettings.notes}
                  onChange={(e) => setEInvoiceSettings({ ...eInvoiceSettings, notes: e.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 min-h-20 text-sm font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="تظهر هذه الملاحظات في تذييل الفاتورة الإلكترونية عند المعاينة والطباعة..."
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500 font-bold">
                يتم تطبيق هذه البيانات والرقم الضريبي ورمز QR مباشرة على كافة الفواتير المطبوعة والإلكترونية.
              </div>
              <button
                onClick={saveEInvoiceSettings}
                disabled={eInvoiceSaving}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-xs hover:bg-emerald-700 disabled:opacity-50 shadow-sm cursor-pointer"
              >
                {eInvoiceSaving ? "جاري الحفظ..." : "حفظ إعدادات الفاتورة الإلكترونية"}
              </button>
            </div>
          </div>

          {/* Electronic Invoices Register & Formatted Print Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden no-print">
            <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  <span>سجل الفواتير الإلكترونية والضريبية الجاهزة للطباعة</span>
                </h3>
                <p className="text-xs text-slate-500 font-bold mt-0.5">
                  معاينة وطباعة أي فاتورة بتصميم الفاتورة الإلكترونية المنسق (A4) مع الرقم المرجعي UUID ورمز الاستجابة السريعة
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-black text-xs">
                إجمالي المستندات: {invoices.length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs border-collapse">
                <thead className="bg-[#2F5F9F] text-white font-black">
                  <tr>
                    <th className="p-3">رقم الفاتورة</th>
                    <th className="p-3">المعرف الإلكتروني (UUID)</th>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">المورد / الجهة</th>
                    <th className="p-3">نوع المستند</th>
                    <th className="p-3">إجمالي الفاتورة</th>
                    <th className="p-3">الحالة الضريبية</th>
                    <th className="p-3">معاينة وطباعة منسقة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-bold">
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        لا توجد فواتير مسجلة حالياً — يمكنك الضغط على زر "معاينة وطباعة نموذج الفاتورة الإلكترونية" أعلاه لتجربة الطباعة المنسقة.
                      </td>
                    </tr>
                  ) : (
                    invoices.slice(0, 20).map((inv) => {
                      const docNo = inv.invoice_number || `PINV-${String(inv.id).padStart(6, "0")}`;
                      const uuid = `ETA-${new Date(inv.date || Date.now()).getFullYear()}-${String(inv.id).padStart(6, "0")}-TX`;
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50">
                          <td className="p-3 font-mono text-indigo-700 font-black" dir="ltr">{docNo}</td>
                          <td className="p-3 font-mono text-slate-500 text-[11px]" dir="ltr">{uuid}</td>
                          <td className="p-3 text-slate-600">{formatDateEN(inv.date)}</td>
                          <td className="p-3 text-slate-800 font-black">{inv.supplier || inv.supplier_name || "مورد عام"}</td>
                          <td className="p-3">
                            <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
                              {eInvoiceSettings.invoice_type === "credit_note" ? "إشعار دائن" : eInvoiceSettings.invoice_type === "debit_note" ? "إشعار مدين" : "فاتورة ضريبية"}
                            </span>
                          </td>
                          <td className="p-3 text-emerald-700 font-black">{formatNumberEN(inv.total_amount || 0, 2)} ج.م</td>
                          <td className="p-3">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px]">
                              <ShieldCheck className="w-3.5 h-3.5" /> معتمدة إلكترونياً
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => fetchPurchaseDetails(inv.id, false)}
                                className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-black flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" /> معاينة
                              </button>
                              <button
                                onClick={() => fetchPurchaseDetails(inv.id, true)}
                                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5" /> طباعة
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "reports" && renderReports()}

      {showReturnModal && (
        <ReturnModal
          editMode={!!selectedReturnData}
          initialData={selectedReturnData}
          onClose={() => {
            setShowReturnModal(false);
            setSelectedReturnData(null);
          }}
          onConfirm={async () => {
            setShowReturnModal(false);
            setSelectedReturnData(null);
            await Promise.all([fetchPurchases(), fetchReturns()]);
          }}
        />
      )}

      {/* Purchase & Electronic Invoice Formatted Print Modal (A4) */}
      {selectedPurchase && (
        <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm z-[180] flex items-center justify-center p-3 sm:p-6 overflow-y-auto printable-modal" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-4xl my-auto flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Top Action Bar (Screen Only) */}
            <div className="no-print p-4 bg-slate-900 text-white flex justify-between items-center gap-3">
              <div className="flex items-center gap-2.5">
                <Printer className="w-5 h-5 text-emerald-400" />
                <div>
                  <h2 className="text-sm font-black">
                    معاينة وطباعة الفاتورة الضريبية / الإلكترونية
                  </h2>
                  <p className="text-slate-400 text-[11px] font-bold">
                    رقم المستند: {selectedPurchase.invoice_number || `PINV-${String(selectedPurchase.id).padStart(6, "0")}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  title="طباعة الفاتورة A4"
                >
                  <Printer className="w-4 h-4" /> طباعة الفاتورة (A4)
                </button>
                <button
                  onClick={() => exportInvoiceToWord(selectedPurchase)}
                  className="px-3.5 py-2 text-blue-200 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="تصدير وورد"
                >
                  <FileText className="w-4 h-4" /> Word
                </button>
                <button
                  onClick={() => setSelectedPurchase(null)}
                  className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-rose-600 rounded-xl transition-colors cursor-pointer"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable A4 Invoice Sheet */}
            <div className="printable-report p-8 sm:p-10 bg-white text-slate-900 space-y-5 text-xs">
              {/* Header */}
              <div className="grid grid-cols-3 items-start border-b-2 border-slate-900 pb-5 gap-4">
                <div className="space-y-1 text-right">
                  <h1 className="text-lg font-black text-slate-900">منظومة الفواتير والمشتريات</h1>
                  <p className="text-[11px] font-bold text-slate-600">
                    الرقم الضريبي: <span className="font-mono text-slate-900">{eInvoiceSettings.taxpayer_number || "310-492-819"}</span>
                  </p>
                  <p className="text-[11px] font-bold text-slate-600">
                    كود الفرع: <span className="font-mono">{eInvoiceSettings.branch_code || "0"}</span> | كود النشاط: <span className="font-mono">{eInvoiceSettings.activity_code || "5610"}</span>
                  </p>
                  <p className="text-[11px] font-bold text-slate-600">
                    البيئة الضريبية: {eInvoiceSettings.environment === "production" ? "إنتاج فعلي (Production)" : "قياسي معتمد"}
                  </p>
                </div>

                <div className="text-center flex flex-col items-center justify-center pt-1">
                  <div className="px-5 py-2 bg-[#17365d] text-white rounded-xl font-black text-base tracking-wide">
                    {eInvoiceSettings.invoice_type === "credit_note"
                      ? "إشعار دائن إلكتروني"
                      : eInvoiceSettings.invoice_type === "debit_note"
                        ? "إشعار مدين إلكتروني"
                        : "فاتورة مشتريات ضريبية"}
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 mt-1">
                    مستند رسمي منسق ومعتمد للطباعة والأرشفة
                  </span>
                </div>

                <div className="space-y-1 text-left flex flex-col items-end">
                  <div className="bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-right w-full max-w-[235px] space-y-1">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500 font-bold text-[10px]">رقم الفاتورة:</span>
                      <span className="font-mono font-black text-xs text-[#17365d]">
                        {selectedPurchase.invoice_number || `PINV-${String(selectedPurchase.id).padStart(6, "0")}`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500 font-bold text-[10px]">التاريخ:</span>
                      <span className="font-mono font-bold text-[11px] text-slate-800">
                        {selectedPurchase.date ? new Date(selectedPurchase.date).toLocaleDateString("ar-EG") : new Date().toLocaleDateString("ar-EG")}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500 font-bold text-[10px]">المعرف الضريبي:</span>
                      <span className="font-mono font-bold text-[10px] text-emerald-700">
                        ETA-{String(selectedPurchase.id || 1).padStart(6, "0")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Supplier & Warehouse Info Box */}
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-slate-300 rounded-xl p-3.5 bg-slate-50/60 space-y-1.5">
                  <div className="text-[11px] font-black text-white bg-[#17365d] px-3 py-1 rounded-lg inline-block mb-1">
                    بيانات المورد (Supplier Info)
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <div><span className="text-slate-500 font-bold">اسم المورد: </span><strong className="text-slate-900 font-black">{selectedPurchase.supplier_name || (selectedPurchase as any).supplier || "مورد عام"}</strong></div>
                    <div><span className="text-slate-500 font-bold">رقم فاتورة المورد: </span><strong className="font-mono text-slate-800">{(selectedPurchase as any).supplier_invoice_number || selectedPurchase.invoice_number || "—"}</strong></div>
                  </div>
                </div>

                <div className="border border-slate-300 rounded-xl p-3.5 bg-slate-50/60 space-y-1.5">
                  <div className="text-[11px] font-black text-white bg-[#17365d] px-3 py-1 rounded-lg inline-block mb-1">
                    بيانات الاستلام والمخزن
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <div><span className="text-slate-500 font-bold">المخزن المستلم: </span><strong className="text-slate-900 font-black">{selectedPurchase.warehouse_name || "المخزن الرئيسي"}</strong></div>
                    <div><span className="text-slate-500 font-bold">حالة السداد: </span><strong className="text-emerald-700">{(Number(selectedPurchase.paid_amount || 0) >= Number(selectedPurchase.total_amount || 0)) ? "مدفوعة بالكامل" : Number(selectedPurchase.paid_amount || 0) > 0 ? "مدفوعة جزئياً" : "آجل / مستحقة"}</strong></div>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-300 rounded-xl overflow-hidden">
                <table className="w-full text-center border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#17365d] text-white font-black text-[11px]">
                      <th className="p-2.5 border border-[#17365d] text-center w-12">م</th>
                      <th className="p-2.5 border border-[#17365d] text-right">اسم الصنف / البيان</th>
                      <th className="p-2.5 border border-[#17365d] text-center w-24">الوحدة</th>
                      <th className="p-2.5 border border-[#17365d] text-center w-24">الكمية</th>
                      <th className="p-2.5 border border-[#17365d] text-center w-32">سعر الوحدة (ج.م)</th>
                      <th className="p-2.5 border border-[#17365d] text-center w-36">الإجمالي (ج.م)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-bold">
                    {(() => {
                      const rawItems = Array.isArray(selectedPurchase.items)
                        ? selectedPurchase.items
                        : typeof selectedPurchase.items === "string"
                          ? JSON.parse(selectedPurchase.items || "[]")
                          : [];
                      if (rawItems.length === 0) {
                        return (
                          <tr>
                            <td colSpan={6} className="p-4 text-center text-slate-400">لا توجد أصناف مسجلة في هذه الفاتورة</td>
                          </tr>
                        );
                      }
                      return rawItems.map((item: any, idx: number) => {
                        const qty = Number(item.quantity || 0);
                        const unitPrice = Number(item.unit_price || item.price || 0);
                        const lineTotal = Number(item.total_price || qty * unitPrice);
                        return (
                          <tr key={item.id || idx} className="even:bg-slate-50/60">
                            <td className="p-2.5 border border-slate-200 text-center text-slate-500">{idx + 1}</td>
                            <td className="p-2.5 border border-slate-200 text-right font-black text-slate-800">
                              {item.ingredient_name || item.name || "صنف مشتريات"}
                            </td>
                            <td className="p-2.5 border border-slate-200 text-center text-slate-600">
                              {item.unit || "وحدة"}
                            </td>
                            <td className="p-2.5 border border-slate-200 text-center font-black text-slate-900">
                              {qty.toLocaleString("en-US")}
                            </td>
                            <td className="p-2.5 border border-slate-200 text-center font-mono text-slate-700">
                              {unitPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-2.5 border border-slate-200 text-center font-mono font-black text-slate-900">
                              {lineTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Totals & Electronic Invoice QR Block */}
              <div className="grid grid-cols-12 gap-5 items-start pt-1">
                <div className="col-span-7 space-y-3">
                  <div className="border border-slate-300 rounded-xl p-3 bg-slate-50/40 min-h-[72px]">
                    <div className="font-black text-[11px] text-slate-700 mb-1">ملاحظات الفاتورة:</div>
                    <p className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {selectedPurchase.notes || eInvoiceSettings.notes || "تم فحص واستلام الأصناف المذكورة أعلاه بحالة جيدة ومطابقة للمواصفات."}
                    </p>
                  </div>

                  {eInvoiceSettings.include_qr && (
                    <div className="flex items-center gap-3.5 border border-slate-300 rounded-xl p-3 bg-white">
                      <div className="w-16 h-16 border-2 border-slate-900 rounded-xl grid grid-cols-4 grid-rows-4 gap-0.5 p-1.5 bg-white shrink-0">
                        <div className="bg-slate-900 col-span-2 row-span-2"></div>
                        <div className="bg-slate-900"></div>
                        <div className="bg-slate-900"></div>
                        <div className="bg-slate-900"></div>
                        <div className="bg-white"></div>
                        <div className="bg-slate-900 col-span-2"></div>
                        <div className="bg-slate-900"></div>
                        <div className="bg-slate-900"></div>
                        <div className="bg-slate-900 col-span-2"></div>
                      </div>
                      <div className="space-y-0.5 text-[10px] text-slate-600 font-bold">
                        <div className="text-emerald-800 font-black text-[11px] flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> مستند إلكتروني ضريبي موثق
                        </div>
                        <p>الرقم الضريبي: <span className="font-mono text-slate-900">{eInvoiceSettings.taxpayer_number || "310-492-819"}</span></p>
                        <p>معرف المستند: <span className="font-mono text-slate-900">ETA-UUID-{selectedPurchase.id || 1001}-2026</span></p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="col-span-5 border border-slate-300 rounded-xl overflow-hidden bg-slate-50 text-xs">
                  <div className="p-2.5 flex justify-between border-b border-slate-200 font-bold text-slate-700">
                    <span>صافي الأصناف (قبل الضريبة):</span>
                    <span className="font-mono font-black text-slate-900">
                      {Number(selectedPurchase.subtotal || (Number(selectedPurchase.total_amount || 0) - Number(selectedPurchase.tax_amount || 0))).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م
                    </span>
                  </div>
                  <div className="p-2.5 flex justify-between border-b border-slate-200 font-bold text-amber-700">
                    <span>ضريبة القيمة المضافة (VAT):</span>
                    <span className="font-mono font-black">
                      {Number(selectedPurchase.tax_amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م
                    </span>
                  </div>
                  <div className="p-2.5 flex justify-between border-b border-slate-200 font-bold text-slate-800 bg-slate-100/70">
                    <span>إجمالي قيمة الفاتورة (شامل الضريبة):</span>
                    <span className="font-mono font-black text-slate-900">
                      {Number(selectedPurchase.total_amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م
                    </span>
                  </div>
                  <div className="p-2.5 flex justify-between border-b border-slate-200 font-bold text-emerald-700">
                    <span>المبلغ المسدد:</span>
                    <span className="font-mono font-black">
                      {Number(selectedPurchase.paid_amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م
                    </span>
                  </div>
                  <div className="p-3 flex justify-between bg-[#17365d] text-white font-black text-sm">
                    <span>المتبقي للمورد:</span>
                    <span className="font-mono">
                      {Math.max(0, Number(selectedPurchase.total_amount || 0) - Number(selectedPurchase.paid_amount || 0)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م
                    </span>
                  </div>
                </div>
              </div>

              {/* مرتجعات هذه الفاتورة — تظهر عند وجود مرتجع مرتبط بالفاتورة */}
              {Array.isArray((selectedPurchase as any).returns) && (selectedPurchase as any).returns.length > 0 && (
                <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-300">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5" />
                      مرتجعات مرتبطة بهذه الفاتورة ({(selectedPurchase as any).returns.length})
                    </h4>
                  </div>
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-amber-100/60 text-amber-950">
                        <th className="text-right p-1.5 font-bold">رقم المرتجع</th>
                        <th className="text-right p-1.5 font-bold">التاريخ</th>
                        <th className="text-center p-1.5 font-bold">الكمية</th>
                        <th className="text-left p-1.5 font-bold">القيمة</th>
                        <th className="text-center p-1.5 font-bold">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {((selectedPurchase as any).returns as any[]).map((ret: any) => (
                        <tr key={ret.id} className="border-t border-amber-200">
                          <td className="p-1.5 font-bold text-slate-800">{ret.return_number || `#${ret.id}`}</td>
                          <td className="p-1.5 text-slate-600">{String(ret.return_date || ret.created_at || "").slice(0, 10)}</td>
                          <td className="p-1.5 text-center font-bold text-slate-700">{Number(ret.total_quantity || 0).toLocaleString()}</td>
                          <td className="p-1.5 text-left font-bold text-rose-700">{Number(ret.total_amount || 0).toLocaleString()} ج.م</td>
                          <td className="p-1.5 text-center font-bold">{ret.status === "approved" ? "معتمد" : ret.status === "pending" ? "قيد المراجعة" : "مسودة"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Signatures */}
              <div className="grid grid-cols-4 gap-3 pt-3">
                {["أمين المخزن المستلم", "مسؤول المشتريات", "المراجعة والحسابات", "اعتماد الإدارة"].map((role) => (
                  <div key={role} className="border border-slate-300 rounded-xl p-2.5 text-center space-y-5 bg-slate-50/30">
                    <span className="text-[11px] font-black text-slate-700 block">{role}</span>
                    <div className="border-b border-dashed border-slate-400 w-4/5 mx-auto"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Purchase Order Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">
                أمر شراء جديد
              </h2>
              <button
                onClick={() => setShowOrderModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form
              onSubmit={handleCreateOrder}
              className="flex-1 overflow-y-auto"
            >
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      المورد
                    </label>
                    <SearchableSelect
                      options={suppliers.map((s) => ({
                        id: s.id,
                        label: s.name,
                      }))}
                      value={orderFormData.supplier_id}
                      onChange={(value) =>
                        setOrderFormData({
                          ...orderFormData,
                          supplier_id: value as string,
                        })
                      }
                      placeholder="اختر المورد..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      تاريخ الاستلام المتوقع
                    </label>
                    <input
                      type="date"
                      value={orderFormData.delivery_date ?? ""}
                      onChange={(e) =>
                        setOrderFormData({
                          ...orderFormData,
                          delivery_date: e.target.value,
                        })
                      }
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-emerald-700 mb-2">
                      ربط بطلب شراء (اختياري)
                    </label>
                    <SearchableSelect
                      options={requests.map((r) => ({
                        id: r.id.toString(),
                        label: `طلب #${r.id} - ${r.requested_by} (${formatDateEN(r.date)})`,
                      }))}
                      value={linkedRequestId}
                      onChange={(value) => {
                        setLinkedRequestId(value as string);
                        if (value) {
                          const req = requests.find((r) => r.id.toString() === value.toString());
                          if (req) {
                            if (req.items) {
                              setPurchaseItems(
                                req.items.map((item: any) => ({
                                  ingredient_id: item.ingredient_id,
                                  name: item.name,
                                  unit: item.unit,
                                  quantity: item.quantity,
                                  unit_price: item.unit_price || 0,
                                }))
                              );
                            }
                          }
                        } else {
                          setPurchaseItems([]);
                        }
                      }}
                      placeholder="اختر طلب الشراء لربطه..."
                    />
                  </div>
                </div>

                {/* Items Selection */}
                <div className="border border-slate-200 rounded-xl">
                  <div className="bg-slate-50 p-4 border-b border-slate-200">
                    <h3 className="font-bold text-slate-800">الأصناف</h3>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-4">
                        <SearchableSelect
                          options={ingredients.map((ing) => ({
                            id: ing.id,
                            label: ing.name,
                            item_code: ing.item_code || "-",
                            unit: ing.unit,
                            cost: ing.cost,
                          }))}
                          value=""
                          onChange={(value) => {
                            if (value) {
                              const ing = ingredients.find(
                                (i) => i.id.toString() === value.toString(),
                              );
                              if (
                                ing &&
                                !purchaseItems.find(
                                  (i) =>
                                    i.ingredient_id?.toString() ===
                                    ing.id.toString(),
                                )
                              ) {
                                setPurchaseItems([
                                  ...purchaseItems,
                                  {
                                    ingredient_id: ing.id,
                                    name: ing.name,
                                    unit: ing.unit,
                                    quantity: 1,
                                    unit_price: ing.cost || 0,
                                  },
                                ]);
                              }
                            }
                          }}
                          placeholder="إضافة صنف (ابحث بالاسم أو الباركود)..."
                          searchKeys={["label", "item_code"]}
                          labelKey="label"
                          columns={[
                            { key: "item_code", title: "كود / باركود" },
                            { key: "label", title: "الاسم" },
                            { key: "unit", title: "الوحدة" },
                          ]}
                        />
                      </div>
                    </div>

                    {purchaseItems.length > 0 && (
                      <table className="w-full text-center text-sm">
                        <thead className="text-slate-500 border-b border-slate-200">
                          <tr>
                            <th className="pb-2 font-bold">الصنف</th>
                            <th className="pb-2 font-bold">الكمية</th>
                            <th className="pb-2 font-bold">الوحدة</th>
                            <th className="pb-2 font-bold">سعر الوحدة</th>
                            <th className="pb-2 font-bold">تاريخ الانتهاء</th>
                            <th className="pb-2 font-bold">الإجمالي</th>
                            <th className="pb-2 font-bold"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {purchaseItems.map((item, idx) => (
                            <tr key={idx}>
                              <td className="py-2 text-slate-800 font-bold w-1/4">
                                {item.name}
                              </td>
                              <td className="py-2 w-20">
                                <input
                                  type="number"
                                  min="1"
                                  step="any"
                                  value={item.quantity || ""}
                                  onChange={(e) => {
                                    const newItems = [...purchaseItems];
                                    newItems[idx].quantity =
                                      parseFloat(e.target.value) || 0;
                                    setPurchaseItems(newItems);
                                  }}
                                  className="w-20 p-2 bg-slate-50 border border-slate-200 rounded-lg text-center outline-none"
                                />
                              </td>
                              <td className="py-2 text-slate-500">
                                {item.unit}
                              </td>
                              <td className="py-2 w-24">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={item.unit_price || ""}
                                  onChange={(e) => {
                                    const newItems = [...purchaseItems];
                                    newItems[idx].unit_price =
                                      parseFloat(e.target.value) || 0;
                                    setPurchaseItems(newItems);
                                  }}
                                  className="w-24 p-2 bg-slate-50 border border-slate-200 rounded-lg text-center outline-none"
                                />
                              </td>
                              <td className="py-2 w-32">
                                <input
                                  type="date"
                                  value={item.expiry_date || ""}
                                  onChange={(e) => {
                                    const newItems = [...purchaseItems];
                                    newItems[idx].expiry_date = e.target.value;
                                    setPurchaseItems(newItems);
                                  }}
                                  className="w-32 p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-center outline-none"
                                />
                              </td>
                              <td className="py-2 text-emerald-600 font-bold">
                                {(
                                  item.quantity * item.unit_price
                                )}{" "}
                                ج.م
                              </td>
                              <td className="py-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPurchaseItems(
                                      purchaseItems.filter((_, i) => i !== idx),
                                    )
                                  }
                                  className="p-1 hover:bg-rose-50 text-rose-500 rounded"
                                >
                                  <XCircle className="w-5 h-5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">
                      صافي الأصناف (قبل الضريبة)
                    </label>
                    <div className="p-2.5 bg-white border border-slate-200 text-slate-800 font-bold font-mono rounded-xl text-base">
                      {Number(calculateSubtotal() || 0).toLocaleString()} ج.م
                    </div>
                  </div>

                  <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-amber-900">
                        ضريبة أمر الشراء:
                      </label>
                      <div className="flex items-center gap-1">
                        {[0, 5, 14].map((presetRate) => (
                          <button
                            key={presetRate}
                            type="button"
                            onClick={() => {
                              const sub = calculateSubtotal();
                              const calcTax = Math.round((sub * (presetRate / 100)) * 100) / 100;
                              setOrderFormData({
                                ...orderFormData,
                                tax_rate: String(presetRate),
                                tax_amount: presetRate > 0 ? String(calcTax) : "",
                              });
                            }}
                            className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                              Number(orderFormData.tax_rate) === presetRate && (presetRate === 0 ? !Number(orderFormData.tax_amount) : true)
                                ? "bg-amber-600 text-white"
                                : "bg-white text-amber-800 border border-amber-300 hover:bg-amber-100"
                            }`}
                          >
                            {presetRate}%
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="block text-[10px] text-amber-800 mb-0.5 font-semibold">النسبة (%)</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="any"
                          value={orderFormData.tax_rate ?? "0"}
                          onChange={(e) => {
                            const rate = e.target.value;
                            const sub = calculateSubtotal();
                            const calcTax = Math.round((sub * ((Number(rate) || 0) / 100)) * 100) / 100;
                            setOrderFormData({
                              ...orderFormData,
                              tax_rate: rate,
                              tax_amount: Number(rate) > 0 ? String(calcTax) : "",
                            });
                          }}
                          className="w-full h-8 px-2 bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold text-slate-800 outline-none"
                        />
                      </div>
                      <div>
                        <span className="block text-[10px] text-amber-800 mb-0.5 font-semibold">القيمة (ج.م)</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={orderFormData.tax_amount !== "" ? orderFormData.tax_amount : (calculateTaxAmount() || "")}
                          onChange={(e) =>
                            setOrderFormData({
                              ...orderFormData,
                              tax_amount: e.target.value,
                            })
                          }
                          placeholder="0.00"
                          className="w-full h-8 px-2 bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold text-amber-900 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-emerald-800 mb-1.5">
                      الإجمالي الكلي لأمر الشراء (شامل الضريبة)
                    </label>
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold font-mono rounded-xl text-lg">
                      {Number(calculateTotal() || 0).toLocaleString()} ج.م
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    ملاحظات والتوجيهات التشغيلية
                  </label>
                  <textarea
                    value={orderFormData.notes ?? ""}
                    onChange={(e) =>
                      setOrderFormData({
                        ...orderFormData,
                        notes: e.target.value,
                      })
                    }
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 flex justify-end gap-3 sticky bottom-0 bg-white rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="px-6 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold rounded-xl transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={
                    purchaseItems.length === 0 || !orderFormData.supplier_id
                  }
                  className="flex items-center gap-2 px-8 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                  حفظ الأمر
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Purchase Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-black text-slate-800">
                  تفاصيل أمر الشراء {selectedOrder.order_number || `#${selectedOrder.id}`}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  المورد: <strong className="text-slate-800">{selectedOrder.supplier_name || "-"}</strong> | التاريخ: {formatDateEN(selectedOrder.date)}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 text-slate-400 hover:text-slate-700"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <div className="text-[11px] text-slate-500 font-bold">صافي الأصناف (قبل الضريبة)</div>
                <div className="font-mono font-black text-slate-800 text-base mt-1">
                  {Number(selectedOrder.subtotal || (Number(selectedOrder.total_amount || 0) - Number(selectedOrder.tax_amount || 0))).toLocaleString()} ج.م
                </div>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                <div className="text-[11px] text-amber-800 font-bold">
                  ضريبة أمر الشراء {Number(selectedOrder.tax_rate) > 0 ? `(${Number(selectedOrder.tax_rate)}%)` : ""}
                </div>
                <div className="font-mono font-black text-amber-700 text-base mt-1">
                  {Number(selectedOrder.tax_amount || 0).toLocaleString()} ج.م
                </div>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200">
                <div className="text-[11px] text-emerald-800 font-bold">إجمالي أمر الشراء (شامل الضريبة)</div>
                <div className="font-mono font-black text-emerald-700 text-base mt-1">
                  {Number(selectedOrder.total_amount || 0).toLocaleString()} ج.م
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <div className="text-[11px] text-slate-500 font-bold">تاريخ التوريد المتوقع</div>
                <div className="font-bold text-slate-800 text-sm mt-1">
                  {selectedOrder.delivery_date ? formatDateEN(selectedOrder.delivery_date) : "-"}
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-center text-sm">
                <thead className="bg-[#2F5F9F] text-white">
                  <tr>
                    <th className="p-3">الصنف</th>
                    <th className="p-3">الوحدة</th>
                    <th className="p-3">الكمية المطلوبة</th>
                    <th className="p-3">الكمية المستلمة</th>
                    <th className="p-3">سعر الوحدة</th>
                    <th className="p-3">الإجمالي (صافي)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(selectedOrder.items || []).map((it: any, idx: number) => (
                    <tr key={it.id || idx} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-800">{it.ingredient_name || it.name || "-"}</td>
                      <td className="p-3 text-slate-600">{it.unit || "-"}</td>
                      <td className="p-3 font-mono font-bold">{Number(it.quantity || 0)}</td>
                      <td className="p-3 font-mono text-emerald-700 font-bold">{Number(it.received_quantity || 0)}</td>
                      <td className="p-3 font-mono">{Number(it.unit_price || 0).toLocaleString()} ج.م</td>
                      <td className="p-3 font-mono font-bold text-slate-800">
                        {(Number(it.quantity || 0) * Number(it.unit_price || 0)).toLocaleString()} ج.م
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedOrder.notes && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm">
                <div className="font-bold text-slate-700 mb-1">ملاحظات أمر الشراء:</div>
                <p className="text-slate-600 whitespace-pre-wrap">{selectedOrder.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Purchase Invoice / Goods Receipt Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 overflow-hidden">
          <div className="bg-white rounded-2xl w-[92vw] lg:w-[85vw] max-w-7xl h-[92vh] max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* 1. Modal Header & Top Information */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold shadow-sm">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                      صفحة استلام المشتريات (Goods Receipt)
                    </h2>
                    <span className="text-xs px-2.5 py-0.5 font-semibold bg-emerald-100 text-emerald-800 rounded-full">
                      إذن استلام وفاتورة
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                    <span>تفاصيل إيصال الاستلام:</span>
                    <span
                      className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60"
                      dir="ltr"
                    >
                      #GR-{new Date().getFullYear()}
                      {String(new Date().getMonth() + 1).padStart(2, "0")}
                      {String(new Date().getDate()).padStart(2, "0")}-001
                    </span>
                    {formData.order_id && (
                      <span className="text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200 font-semibold text-xs flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>مرتبط بأمر شراء #{formData.order_id}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-72 sm:w-80">
                  <SearchableSelect
                    options={orders
                      .filter((o) => o.status !== "completed")
                      .map((o) => ({
                        id: o.id,
                        label: `أمر شراء #${o.id} - ${o.supplier_name}`,
                        items_str:
                          o.items
                            ?.map((i: any) => i.ingredient_name)
                            .join(" ") || "",
                      }))}
                    searchKeys={["label", "items_str"]}
                    value=""
                    onChange={async (value) => {
                      if (value) {
                        try {
                          const res = await api.get(
                            `/api/purchase-orders/${value}`,
                          );
                          if (res.ok) {
                            const orderData = await res.json();
                            const defaultWh = warehouses.find((w: any) => w.type === "main" || w.is_main === 1) || warehouses[0];
                            const targetWh = orderData.warehouse_id
                              ? orderData.warehouse_id.toString()
                              : (orderData.items?.[0]?.warehouse_id
                                  ? orderData.items[0].warehouse_id.toString()
                                  : (formData.warehouse_id || (defaultWh ? String(defaultWh.id) : "")));
                            setFormData({
                              ...formData,
                              supplier_id: orderData.supplier_id ? orderData.supplier_id.toString() : formData.supplier_id,
                              warehouse_id: targetWh,
                              tax_rate: String(orderData.tax_rate ?? "0"),
                              tax_amount: Number(orderData.tax_amount) > 0 ? String(orderData.tax_amount) : "",
                              order_id: value.toString(),
                            });
                            setPurchaseItems(
                              (orderData.items || []).map((i: any) => ({
                                ingredient_id: i.ingredient_id,
                                name: i.ingredient_name,
                                unit: i.unit,
                                quantity: Number(i.quantity) || 0,
                                unit_price: Number(i.unit_price) || 0,
                                total_price: (Number(i.quantity) || 0) * (Number(i.unit_price) || 0),
                                purchase_order_item_id: i.id,
                                previously_received_quantity: Number(i.received_quantity || 0),
                                accepted_quantity: Math.max(0, (Number(i.quantity) || 0) - Number(i.received_quantity || 0)),
                                rejected_quantity: 0,
                                batch_number: i.batch_number || i.batch_no || i.lot_number || "",
                                expiry_date: i.expiry_date
                                  ? (String(i.expiry_date).includes("T") ? String(i.expiry_date).split("T")[0] : String(i.expiry_date))
                                  : (i.expiration_date
                                      ? (String(i.expiration_date).includes("T") ? String(i.expiration_date).split("T")[0] : String(i.expiration_date))
                                      : ""),
                                location: i.location || i.location_name || "",
                                warehouse_id: i.warehouse_id || orderData.warehouse_id || "",
                                warehouse_name: i.warehouse_name || orderData.warehouse_name || "",
                                item_code: i.item_code || i.ingredient_code || i.resolved_item_code || "",
                                description: i.description || "",
                              })),
                            );
                          }
                        } catch (e) {}
                      }
                    }}
                    placeholder="استيراد البنود من أمر شراء..."
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors"
                  title="إغلاق النافذة"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6 bg-slate-50/50">
                {/* 2. Supplier, Receiving Warehouse & Supplier Invoice */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      <span>بيانات المورد وجهة الاستلام وفاتورة الشراء</span>
                    </div>
                    {formData.order_id && (
                      <span className="text-xs text-slate-500 font-medium">
                        رقم أمر الشراء: <strong className="text-slate-800 font-mono">#{formData.order_id}</strong>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        المورد <span className="text-rose-500">*</span>
                      </label>
                      <SearchableSelect
                        options={suppliers.map((s) => ({
                          id: s.id,
                          label: s.name,
                        }))}
                        value={Number(formData.supplier_id)}
                        onChange={(value) =>
                          setFormData({
                            ...formData,
                            supplier_id: value.toString(),
                          })
                        }
                        placeholder="اختر المورد..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        المخزن المستلم <span className="text-rose-500">*</span>
                      </label>
                      <SearchableSelect
                        options={warehouses.map((w) => ({
                          id: w.id,
                          label:
                            w.type === "main"
                              ? "المخزن الرئيسي (Central Warehouse)"
                              : w.is_kitchen
                                ? `${w.name} (Kitchen Store)`
                                : `${w.name} (Branch Store)`,
                        }))}
                        value={Number(formData.warehouse_id)}
                        onChange={(value) =>
                          setFormData({
                            ...formData,
                            warehouse_id: value.toString(),
                          })
                        }
                        placeholder="اختر المخزن المستلم..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        رقم فاتورة المورد
                      </label>
                      <input
                        type="text"
                        value={formData.invoice_number ?? ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            invoice_number: e.target.value,
                          })
                        }
                        className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-800 placeholder-slate-400 transition-colors"
                        placeholder="أدخل رقم الفاتورة الورقية أو الإلكترونية..."
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Invoice & Receiving Items */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-emerald-600" />
                      <h3 className="font-bold text-slate-800 text-sm">
                        أصناف الفاتورة وبنود الاستلام المخزني
                      </h3>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {purchaseItems.length} صنف
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      يمكنك تحديد الكميات المقبولة والمرفوضة وتاريخ الصلاحية ورقم التشغيلة لكل صنف
                    </span>
                  </div>

                  {/* Search / Add Item Bar */}
                  <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/80">
                    <SearchableSelect
                      options={ingredients.map((ing) => ({
                        id: ing.id,
                        label: ing.name,
                        item_code: ing.item_code || "-",
                        unit: ing.unit,
                        cost: ing.cost,
                      }))}
                      value=""
                      onChange={(value) => {
                        if (value) {
                          const ing = ingredients.find(
                            (i) => i.id.toString() === value.toString(),
                          );
                          if (
                            ing &&
                            !purchaseItems.find(
                              (i) =>
                                i.ingredient_id?.toString() ===
                                ing.id.toString(),
                            )
                          ) {
                            setPurchaseItems([
                              ...purchaseItems,
                              {
                                ingredient_id: ing.id,
                                name: ing.name,
                                unit: ing.unit,
                                quantity: 1,
                                unit_price: ing.cost || 0,
                              },
                            ]);
                          }
                        }
                      }}
                      placeholder="إضافة صنف للفاتورة (ابحث بالاسم، كود الصنف، أو الباركود)..."
                      searchKeys={["label", "item_code"]}
                      labelKey="label"
                      columns={[
                        { key: "item_code", title: "كود / باركود" },
                        { key: "label", title: "الاسم" },
                        { key: "unit", title: "الوحدة" },
                      ]}
                    />
                  </div>

                  {/* Items Table */}
                  {purchaseItems.length > 0 ? (
                    <div className="border border-slate-200 rounded-xl overflow-x-auto">
                      <table className="w-full text-center min-w-[1150px] text-xs">
                        <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-700">
                          <tr>
                            <th className="py-3 px-2 font-bold w-8">#</th>
                            <th className="py-3 px-2 font-bold text-right">كود الصنف</th>
                            <th className="py-3 px-3 font-bold text-right min-w-[140px]">اسم الصنف</th>
                            <th className="py-3 px-2 font-bold text-right">الوحدة / الوصف</th>
                            <th className="py-3 px-2 font-bold text-center">الكمية المطلوبة</th>
                            <th className="py-3 px-2 font-bold text-center">المستلم سابقاً</th>
                            <th className="py-3 px-2 font-bold text-center text-emerald-700 bg-emerald-50/50">الكمية المقبولة</th>
                            <th className="py-3 px-2 font-bold text-center text-rose-700 bg-rose-50/50">الكمية المرفوضة</th>
                            <th className="py-3 px-2 font-bold text-center">سعر الوحدة</th>
                            <th className="py-3 px-2 font-bold text-center">الإجمالي (صافي)</th>
                            <th className="py-3 px-2 font-bold text-center">فحص الجودة</th>
                            <th className="py-3 px-3 font-bold text-center min-w-[110px]">المخزن / الموقع</th>
                            <th className="py-3 px-2 font-bold text-center min-w-[120px]">رقم التشغيلة / Batch</th>
                            <th className="py-3 px-2 font-bold text-center min-w-[120px]">تاريخ الانتهاء</th>
                            <th className="py-3 px-2 font-bold w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {purchaseItems.map((item, idx) => (
                            <tr
                              key={`pi-${item.ingredient_id || idx}-${idx}`}
                              className="hover:bg-blue-50/40 transition-colors"
                            >
                              <td className="py-2.5 px-2 text-slate-400 font-mono">{idx + 1}</td>
                              <td className="py-2.5 px-2 font-mono font-bold text-slate-700 text-right">
                                {item.item_code || (item.ingredient_id ? `ING-${item.ingredient_id}` : `PRD-0${idx + 1}`)}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-800 text-right">
                                {item.name}
                              </td>
                              <td className="py-2.5 px-2 text-slate-500 text-right truncate max-w-[130px]">
                                {item.description || item.unit || "-"}
                              </td>
                              <td className="py-2.5 px-2 text-center font-bold text-slate-700 font-mono">
                                {item.quantity}
                              </td>
                              <td className="py-2.5 px-2 text-center text-slate-500 font-mono">
                                {Number(item.previously_received_quantity || 0)}
                              </td>
                              <td className="py-2 px-2 bg-emerald-50/20">
                                <div className="flex justify-center">
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={
                                      item.accepted_quantity ?? item.quantity
                                    }
                                    onChange={(e) => {
                                      const newItems = [...purchaseItems];
                                      const val = Math.max(0, Number(e.target.value) || 0);
                                      if (formData.order_id && item.previously_received_quantity !== undefined) {
                                        const remaining = Math.max(0, Number(item.quantity || 0) - Number(item.previously_received_quantity || 0));
                                        newItems[idx].accepted_quantity = remaining > 0 ? Math.min(val, remaining) : val;
                                        const rejected = Number(newItems[idx].rejected_quantity || 0);
                                        newItems[idx].rejected_quantity = Math.min(rejected, Math.max(0, remaining - newItems[idx].accepted_quantity));
                                      } else {
                                        newItems[idx].accepted_quantity = val;
                                        newItems[idx].quantity = val;
                                      }
                                      setPurchaseItems(newItems);
                                    }}
                                    className="w-20 h-8 text-center font-bold text-emerald-800 bg-white border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm font-mono"
                                  />
                                </div>
                              </td>
                              <td className="py-2 px-2 bg-rose-50/20">
                                <div className="flex justify-center">
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={item.rejected_quantity ?? 0}
                                    onChange={(e) => {
                                      const newItems = [...purchaseItems];
                                      const rejected = Number(e.target.value) || 0;
                                      const accepted = Number(newItems[idx].accepted_quantity || 0);
                                      const remaining = Math.max(0, Number(item.quantity || 0) - Number(item.previously_received_quantity || 0));
                                      newItems[idx].rejected_quantity = remaining > 0 ? Math.min(rejected, Math.max(0, remaining - accepted)) : rejected;
                                      setPurchaseItems(newItems);
                                    }}
                                    className="w-20 h-8 text-center font-bold text-rose-800 bg-white border border-rose-300 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none shadow-sm font-mono"
                                  />
                                </div>
                              </td>
                              <td className="py-2 px-2">
                                <div className="flex justify-center">
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={item.unit_price ?? 0}
                                    onChange={(e) => {
                                      const newItems = [...purchaseItems];
                                      newItems[idx].unit_price = Math.max(0, Number(e.target.value) || 0);
                                      setPurchaseItems(newItems);
                                    }}
                                    className="w-24 h-8 text-center font-bold text-slate-800 bg-slate-50 hover:bg-white border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                  />
                                </div>
                              </td>
                              <td className="py-2.5 px-2 text-center font-bold text-emerald-700 font-mono">
                                {(
                                  (Number(item.accepted_quantity !== undefined ? item.accepted_quantity : item.quantity) || 0) *
                                  (Number(item.unit_price) || 0)
                                ).toLocaleString()}
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                {Number(item.rejected_quantity || 0) > 0 ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                                    قبول جزئي
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                                    مطابق
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 text-center">
                                {(() => {
                                  const currentWh = warehouses.find(
                                    (w) => String(w.id) === String(formData.warehouse_id)
                                  );
                                  const whName = item.warehouse_name || currentWh?.name || "";
                                  const whLoc = (item.location || item.location_name || currentWh?.location || "").trim();
                                  if (!whName && !whLoc) return <span className="text-slate-300">-</span>;
                                  return (
                                    <div className="text-xs">
                                      {whName ? <div className="font-semibold text-slate-700">{whName}</div> : null}
                                      {whLoc ? (
                                        <span className="text-[11px] text-slate-400">({whLoc})</span>
                                      ) : null}
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="py-2 px-2 text-center">
                                <input
                                  type="text"
                                  value={item.batch_number || item.batch_no || item.lot_number || ""}
                                  placeholder="رقم التشغيلة..."
                                  onChange={(e) => {
                                    const newItems = [...purchaseItems];
                                    newItems[idx].batch_number = e.target.value;
                                    setPurchaseItems(newItems);
                                  }}
                                  className="w-28 h-8 px-2 text-center text-xs font-mono text-slate-700 bg-slate-50 hover:bg-white border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                              </td>
                              <td className="py-2 px-2 text-center">
                                <input
                                  type={item.expiry_date ? "date" : "text"}
                                  value={item.expiry_date ? (String(item.expiry_date).includes("T") ? String(item.expiry_date).split("T")[0] : String(item.expiry_date)) : ""}
                                  placeholder="بدون تاريخ"
                                  onFocus={(e) => { e.target.type = "date"; }}
                                  onBlur={(e) => { if (!e.target.value) e.target.type = "text"; }}
                                  onChange={(e) => {
                                    const newItems = [...purchaseItems];
                                    newItems[idx].expiry_date = e.target.value;
                                    setPurchaseItems(newItems);
                                  }}
                                  className="w-28 h-8 px-2 text-center text-xs font-mono text-slate-700 bg-slate-50 hover:bg-white border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                                  title={item.expiry_date ? "تاريخ الانتهاء" : "فاضي بدون تاريخ"}
                                />
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPurchaseItems(
                                      purchaseItems.filter((_, i) => i !== idx),
                                    )
                                  }
                                  className="w-7 h-7 inline-flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="حذف البند"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-700 text-xs">
                          <tr>
                            <td colSpan={4} className="py-3 px-4 text-right">
                              الإجماليات:
                            </td>
                            <td className="py-3 px-2 text-center font-mono text-slate-800">
                              {purchaseItems.reduce(
                                (acc, curr) => acc + (Number(curr.quantity) || 0),
                                0,
                              )}
                            </td>
                            <td className="py-3 px-2 text-center font-mono text-slate-500">
                              {purchaseItems.reduce(
                                (acc, curr) => acc + (Number(curr.previously_received_quantity) || 0),
                                0,
                              )}
                            </td>
                            <td className="py-3 px-2 text-center font-mono text-emerald-700">
                              {purchaseItems.reduce(
                                (acc, curr) => acc + (Number(curr.accepted_quantity !== undefined ? curr.accepted_quantity : curr.quantity) || 0),
                                0,
                              )}
                            </td>
                            <td className="py-3 px-2 text-center font-mono text-rose-700">
                              {purchaseItems.reduce(
                                (acc, curr) => acc + (Number(curr.rejected_quantity) || 0),
                                0,
                              )}
                            </td>
                            <td colSpan={7} className="py-3 px-4 text-left font-mono text-slate-800">
                              صافي الأصناف: {(calculateSubtotal() || 0).toLocaleString()} ج.م | ضريبة: {(calculateTaxAmount() || 0).toLocaleString()} ج.م | الإجمالي شامل الضريبة: {(calculateTotal() || 0).toLocaleString()} ج.م
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
                        <Package className="w-6 h-6" />
                      </div>
                      <p className="font-bold text-slate-700 text-sm">لم يتم إضافة أي أصناف بعد</p>
                      <p className="text-xs text-slate-400 mt-1">
                        استخدم حقل البحث أعلاه لإضافة صنف، أو اختر أمر شراء من الأعلى لتحميل جميع بنوده مباشرة
                      </p>
                    </div>
                  )}
                </div>

                {/* 4 & 5. Invoice Notes and Financial Summary */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Notes Card */}
                  <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-center gap-2 font-bold text-slate-800 text-sm pb-2 border-b border-slate-100">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span>ملاحظات الفاتورة ومحضر الاستلام</span>
                    </div>
                    <textarea
                      value={formData.notes ?? ""}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      placeholder="أدخل أي ملاحظات تخص الفحص المخزني، حالة البضاعة، أو شروط الدفع والتسليم..."
                      className="w-full h-36 p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-800 placeholder-slate-400 resize-none transition-colors"
                    />
                  </div>

                  {/* Financial Summary Card */}
                  <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                        <span>الملخص المالي للفاتورة والضريبة</span>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        العملة: EGP
                      </span>
                    </div>

                    <div className="space-y-3">
                      {/* Subtotal before tax */}
                      <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-xs font-bold text-slate-600">
                          صافي قيمة الأصناف (قبل الضريبة):
                        </span>
                        <span className="text-base font-bold text-slate-800 font-mono">
                          {(calculateSubtotal() || 0).toLocaleString()} <span className="text-xs font-sans text-slate-500 font-normal">ج.م</span>
                        </span>
                      </div>

                      {/* Tax Input (Rate % or Fixed Amount) */}
                      <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-amber-900">
                            ضريبة المشتريات (تُسمّع في حساب المورد):
                          </label>
                          <div className="flex items-center gap-1">
                            {[0, 5, 14].map((presetRate) => (
                              <button
                                key={presetRate}
                                type="button"
                                onClick={() => {
                                  const sub = calculateSubtotal();
                                  const calcTax = Math.round((sub * (presetRate / 100)) * 100) / 100;
                                  setFormData({
                                    ...formData,
                                    tax_rate: String(presetRate),
                                    tax_amount: presetRate > 0 ? String(calcTax) : "",
                                  });
                                }}
                                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                                  Number(formData.tax_rate) === presetRate && (presetRate === 0 ? !Number(formData.tax_amount) : true)
                                    ? "bg-amber-600 text-white"
                                    : "bg-white text-amber-800 border border-amber-300 hover:bg-amber-100"
                                }`}
                              >
                                {presetRate}%
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="block text-[11px] text-amber-800 mb-1 font-semibold">نسبة الضريبة (%)</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="any"
                              value={formData.tax_rate ?? "0"}
                              onChange={(e) => {
                                const rate = e.target.value;
                                const sub = calculateSubtotal();
                                const calcTax = Math.round((sub * ((Number(rate) || 0) / 100)) * 100) / 100;
                                setFormData({
                                  ...formData,
                                  tax_rate: rate,
                                  tax_amount: Number(rate) > 0 ? String(calcTax) : "",
                                });
                              }}
                              placeholder="0%"
                              className="w-full h-9 px-2.5 bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-xs font-mono font-bold text-slate-800"
                            />
                          </div>
                          <div>
                            <span className="block text-[11px] text-amber-800 mb-1 font-semibold">قيمة الضريبة (ج.م)</span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={formData.tax_amount !== "" ? formData.tax_amount : (calculateTaxAmount() || "")}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  tax_amount: e.target.value,
                                })
                              }
                              placeholder="0.00"
                              className="w-full h-9 px-2.5 bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-xs font-mono font-bold text-amber-900"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Total Invoice Including Tax */}
                      <div className="flex justify-between items-center bg-emerald-50/70 p-3 rounded-xl border border-emerald-200">
                        <span className="text-xs font-bold text-emerald-900">
                          إجمالي الفاتورة (شامل الضريبة):
                        </span>
                        <span className="text-lg font-bold text-emerald-800 font-mono">
                          {(calculateTotal() || 0).toLocaleString()} <span className="text-xs font-sans text-emerald-600 font-normal">ج.م</span>
                        </span>
                      </div>

                      {/* Paid Amount */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700">
                          المبلغ المدفوع الآن نقدياً / بنكياً:
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max={calculateTotal()}
                            value={formData.paid_amount ?? ""}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                paid_amount: e.target.value,
                              })
                            }
                            placeholder="0"
                            className="w-full h-10 px-3 pl-12 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono font-bold text-slate-800"
                          />
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-bold">
                            ج.م
                          </span>
                        </div>
                      </div>

                      {/* Remaining Amount */}
                      <div className="flex justify-between items-center p-3 rounded-xl bg-rose-50 border border-rose-200/80">
                        <span className="text-xs font-bold text-rose-800">
                          المتبقي (يُسمّع في رصيد المورد شامل الضريبة):
                        </span>
                        <span className="text-base font-bold text-rose-700 font-mono">
                          {(
                            (calculateTotal() || 0) -
                            (Number(formData.paid_amount) || 0)
                          ).toLocaleString()}{" "}
                          <span className="text-xs font-sans font-normal">ج.م</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fixed Bottom Action Bar */}
              <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
                <div className="flex items-center gap-4 text-xs text-slate-600 font-medium">
                  <span>
                    عدد الأصناف: <strong className="text-slate-800 font-bold">{purchaseItems.length}</strong>
                  </span>
                  <span className="text-slate-300">|</span>
                  <span>
                    الضريبة: <strong className="text-amber-700 font-bold font-mono">{(calculateTaxAmount() || 0).toLocaleString()} ج.م</strong>
                  </span>
                  <span className="text-slate-300">|</span>
                  <span>
                    الإجمالي شامل الضريبة: <strong className="text-emerald-700 font-bold font-mono">{(calculateTotal() || 0).toLocaleString()} ج.م</strong>
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={
                      isSavingReceiving ||
                      purchaseItems.length === 0 ||
                      !formData.supplier_id ||
                      !formData.warehouse_id
                    }
                    className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md shadow-emerald-600/20 hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingReceiving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>جاري حفظ الفاتورة والاستلام...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>حفظ الفاتورة واستلام المخزون</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}



      {showInvoiceModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
                  {selectedInvoice
                    ? "تعديل فاتورة مشتريات"
                    : "إنشاء فاتورة مشتريات جديدة"}
                </h2>
                <p className="text-slate-500 mt-1">
                  رقم الفاتورة:{" "}
                  <span
                    className="font-mono font-bold text-slate-800"
                    dir="ltr"
                  >
                    {selectedInvoice?.invoice_number || "سيتم إنشاء الرقم تلقائياً عند الحفظ"}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-6 text-right">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    المورد
                  </label>
                  <SearchableSelect
                    options={suppliers.map((s) => ({
                      id: s.id.toString(),
                      label: s.name,
                    }))}
                    value={formData.supplier_id ? Number(formData.supplier_id) : ""}
                    onChange={(val) => setFormData({...formData, supplier_id:String(val)})}
                    placeholder="اختر المورد..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    أمر الشراء المرتبط
                  </label>
                  <select
                    className="flex-1 p-2 w-full border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.order_id || selectedInvoice?.order_id || ""}
                    onChange={async (e) => {
                      const value = e.target.value;
                      setFormData({...formData, order_id:value});
                      if (!value) { setPurchaseItems([]); return; }
                      try {
                        const r = await api.get(`/api/purchase-orders/${value}`);
                        if (r.ok) {
                          const od = await r.json();
                          const wh = warehouses[0]?.id;
                          setFormData({
                            ...formData,
                            order_id: value,
                            supplier_id: String(od.supplier_id || ""),
                            warehouse_id: String(wh || ""),
                            tax_rate: String(od.tax_rate ?? "0"),
                            tax_amount: Number(od.tax_amount) > 0 ? String(od.tax_amount) : "",
                          });
                          setPurchaseItems((od.items || []).map((i:any)=>({ingredient_id:i.ingredient_id,name:i.ingredient_name,unit:i.unit,quantity:Number(i.quantity||0),unit_price:Number(i.unit_price||0),total_price:Number(i.quantity||0)*Number(i.unit_price||0)})));
                        }
                      } catch(err) { console.error(err); }
                    }}
                  >
                    <option value="">اختر أمر شراء معتمد...</option>
                    {orders.filter((o:any)=>["approved","partially_received","received","completed"].includes(String(o.status))).map((o:any)=>(
                      <option key={o.id} value={o.id}>{o.order_number || `PO-${o.id}`} — {o.supplier_name || "مورد"} — {Number(o.total_amount||0).toLocaleString()} ج.م</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">المخزن</label>
                  <SearchableSelect options={warehouses.map((w:any)=>({id:w.id,label:w.name}))} value={formData.warehouse_id ? Number(formData.warehouse_id) : ""} onChange={(v)=>setFormData({...formData,warehouse_id:String(v)})} placeholder="اختر المخزن..." />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">رقم فاتورة المورد</label>
                  <input value={formData.invoice_number || ""} onChange={e=>setFormData({...formData,invoice_number:e.target.value})} placeholder="أدخل رقم فاتورة المورد" className="w-full p-2 border border-slate-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    تاريخ الفاتورة
                  </label>
                  <input
                    type="date"
                    className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    defaultValue={
                      selectedInvoice
                        ? new Date(selectedInvoice.date)
                            .toISOString()
                            .split("T")[0]
                        : new Date().toISOString().split("T")[0]
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    تاريخ الاستحقاق
                  </label>
                  <input
                    type="date"
                    className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    defaultValue={
                      selectedInvoice?.due_date
                        ? new Date(selectedInvoice.due_date)
                            .toISOString()
                            .split("T")[0]
                        : ""
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    نسبة الضريبة (%)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      value={formData.tax_rate ?? "0"}
                      onChange={(e) => {
                        const rate = e.target.value;
                        const sub = calculateSubtotal();
                        const calcTax = Math.round((sub * ((Number(rate) || 0) / 100)) * 100) / 100;
                        setFormData({
                          ...formData,
                          tax_rate: rate,
                          tax_amount: Number(rate) > 0 ? String(calcTax) : "",
                        });
                      }}
                      className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const sub = calculateSubtotal();
                        const calcTax = Math.round((sub * 0.14) * 100) / 100;
                        setFormData({ ...formData, tax_rate: "14", tax_amount: String(calcTax) });
                      }}
                      className="px-3 py-2 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold whitespace-nowrap hover:bg-amber-100"
                    >
                      14% VAT
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    قيمة الضريبة (ج.م)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formData.tax_amount !== "" ? formData.tax_amount : (calculateTaxAmount() || 0)}
                    onChange={(e) => setFormData({ ...formData, tax_amount: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    إجمالي الفاتورة شامل الضريبة (يُسمّع للمورد)
                  </label>
                  <input
                    type="number"
                    readOnly
                    className="w-full p-2 border border-emerald-200 bg-emerald-50 font-bold text-emerald-800 rounded-lg outline-none font-mono"
                    value={calculateTotal() || selectedInvoice?.total_amount || 0}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    ما تم دفعه
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formData.paid_amount ?? (selectedInvoice?.paid_amount || "")}
                    onChange={(e) => setFormData({ ...formData, paid_amount: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  ملاحظات / شروط الدفع
                </label>
                <textarea
                  value={formData.notes ?? ""}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24"
                  placeholder="إضافة ملاحظات..."
                ></textarea>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-x-auto mb-6">
                <table className="w-full text-center min-w-max text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-3 font-bold text-slate-600">
                        كود الصنف
                      </th>
                      <th className="p-3 font-bold text-slate-600">
                        اسم الصنف
                      </th>
                      <th className="p-3 font-bold text-slate-600 text-center">
                        الكمية
                      </th>
                      <th className="p-3 font-bold text-slate-600 text-center">
                        سعر الوحدة
                      </th>
                      <th className="p-3 font-bold text-slate-600">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {purchaseItems.map((item:any, idx:number) => (
                      <tr key={`${item.ingredient_id}-${idx}`} className="hover:bg-blue-50/50">
                        <td className="p-3 font-mono font-bold text-slate-700">{item.ingredient_id || "-"}</td>
                        <td className="p-3 font-bold text-slate-800">{item.name || item.ingredient_name || "-"}</td>
                        <td className="p-3 text-center text-slate-700">{Number(item.quantity||0)}</td>
                        <td className="p-3 text-center">{Number(item.unit_price||0)}</td>
                        <td className="p-3 text-emerald-600 font-bold">{(Number(item.quantity||0)*Number(item.unit_price||0))} ج.م</td>
                      </tr>
                    ))}
                    {purchaseItems.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">اختر أمر شراء معتمد لعرض بنوده</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex items-center justify-between">
              <div className="flex gap-4 items-center">
                <div className="flex flex-col justify-center text-right ml-2">
                  <span className="font-bold text-sm text-slate-700">
                    إرفاق صورة الفاتورة الأصلية
                  </span>
                  <span className="text-xs text-slate-500">(اختياري)</span>
                </div>
                <div className="flex gap-2">
                  <button className="flex flex-col items-center justify-center w-12 h-14 border border-blue-200 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
                    <span className="text-[10px] font-bold mt-1">PDF</span>
                  </button>
                  <button className="flex flex-col items-center justify-center w-12 h-14 border border-emerald-200 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors">
                    <span className="text-[10px] font-bold mt-1">صورة</span>
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(false)}
                  className="px-6 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold transition-all bg-white"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(false)}
                  className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-bold transition-all shadow-sm"
                >
                  حفظ كمسودة
                </button>
                <button
                  type="button"
                  onClick={handleCreateInvoiceFromOrder}
                  className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-bold shadow-lg shadow-emerald-200 transition-all"
                >
                  {selectedInvoice ? "تحديث الفاتورة" : "إنشاء وتأكيد الفاتورة"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedRequest && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
              <div>
                <div className="text-xs opacity-80 font-bold">تحويل طلب الشراء إلى أمر شراء</div>
                <h2 className="text-2xl font-black mt-1">طلب شراء #{selectedRequest.id}</h2>
              </div>
              <button onClick={() => setSelectedRequest(null)} className="text-white/80 hover:text-white"><XCircle className="w-7 h-7" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-50 rounded-2xl p-4"><div className="text-xs text-slate-500">الطالب</div><div className="font-black text-slate-800 mt-1">{selectedRequest.requested_by || "-"}</div></div>
                <div className="bg-slate-50 rounded-2xl p-4"><div className="text-xs text-slate-500">الأصناف</div><div className="font-black text-slate-800 mt-1">{selectedRequest.items?.length || 0}</div></div>
                <div className="bg-slate-50 rounded-2xl p-4"><div className="text-xs text-slate-500">القيمة التقديرية</div><div className="font-black text-slate-800 mt-1">{(selectedRequest.items || []).reduce((a:any,i:any)=>a+Number(i.quantity||0)*Number(i.unit_price||0),0).toLocaleString()} ج.م</div></div>
                <div className="bg-emerald-50 rounded-2xl p-4"><div className="text-xs text-emerald-600">الحالة</div><div className="font-black text-emerald-700 mt-1">جاهز للاعتماد</div></div>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div><label className="block text-sm font-bold text-slate-700 mb-2">المورد <span className="text-red-500">*</span></label><SearchableSelect options={suppliers.map((x:any)=>({id:x.id,label:x.name}))} value={requestSupplierId ? Number(requestSupplierId) : ""} onChange={(v)=>setRequestSupplierId(String(v))} placeholder="اختر المورد لأمر الشراء..." /></div>
                <div><label className="block text-sm font-bold text-slate-700 mb-2">تاريخ الاستلام المتوقع</label><input type="date" value={requestDeliveryDate} onChange={e=>setRequestDeliveryDate(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" /></div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">نسبة الضريبة (%)</label>
                  <div className="flex items-center gap-1.5">
                    <input type="number" min="0" max="100" step="0.01" value={requestTaxRate} onChange={e=>setRequestTaxRate(e.target.value)} placeholder="0" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
                    {[0, 5, 14].map((r) => (
                      <button key={r} type="button" onClick={() => setRequestTaxRate(String(r))} className={`px-2.5 py-2 rounded-lg text-xs font-bold border transition-colors ${Number(requestTaxRate || 0) === r ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"}`}>{r}%</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 font-black text-slate-700">بنود الطلب التي ستنتقل لأمر الشراء</div>
                <div className="max-h-56 overflow-auto"><table className="w-full text-center"><thead><tr className="text-xs text-slate-500 border-b"><th className="p-3">الصنف</th><th className="p-3">الوحدة</th><th className="p-3">الكمية</th><th className="p-3">سعر الوحدة</th></tr></thead><tbody>{(selectedRequest.items || []).map((i:any)=><tr key={i.id} className="border-b last:border-0"><td className="p-3 font-bold">{i.name || i.ingredient_name || `صنف #${i.ingredient_id}`}</td><td className="p-3">{i.unit || "-"}</td><td className="p-3 font-bold">{formatNumberEN(i.quantity||0)}</td><td className="p-3">{formatNumberEN(i.unit_price||0)} ج.م</td></tr>)}</tbody></table></div>
              </div>
            </div>
            <div className="p-5 bg-slate-50 border-t flex justify-end gap-3"><button onClick={()=>setSelectedRequest(null)} className="px-5 py-2.5 bg-white border rounded-xl font-bold">إلغاء</button><button onClick={confirmApproveRequestToOrder} className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-black flex items-center gap-2"><Check className="w-5 h-5" /> اعتماد وإنشاء أمر شراء</button></div>
          </div>
        </div>
      )}

      {/* New Purchase Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-7xl max-h-[95vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">
                إنشاء طلب شراء
              </h2>
              <button
                onClick={() => setShowRequestModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form
              onSubmit={handleCreateRequest}
              className="flex-1 overflow-y-auto"
            >
              <div className="p-7 space-y-7">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">الجهة / الشخص الطالب *</label>
                    <input type="text" value={requestFormData.requested_by} onChange={e=>setRequestFormData({...requestFormData,requested_by:e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="مثال: مدير المطبخ" required />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">الفرع</label>
                    <select value={requestFormData.branch_id} onChange={e=>setRequestFormData({...requestFormData,branch_id:e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <option value="">-- اختر الفرع --</option>
                      {branches.map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">المخزن المطلوب</label>
                    <select value={requestFormData.warehouse_id} onChange={e=>setRequestFormData({...requestFormData,warehouse_id:e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <option value="">-- اختر المخزن --</option>
                      {warehouses.map((w:any)=><option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">الإدارة / القسم</label>
                    <input type="text" value={requestFormData.department} onChange={e=>setRequestFormData({...requestFormData,department:e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" placeholder="مثال: المطبخ" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">مطلوب قبل</label>
                    <input type="date" value={requestFormData.required_date} onChange={e=>setRequestFormData({...requestFormData,required_date:e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">الأولوية</label>
                    <select value={requestFormData.priority} onChange={e=>setRequestFormData({...requestFormData,priority:e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <option value="low">منخفضة</option><option value="normal">عادية</option><option value="high">عالية</option><option value="urgent">عاجلة</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">مركز التكلفة</label>
                    <select value={requestFormData.cost_center_id} onChange={e=>setRequestFormData({...requestFormData,cost_center_id:e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <option value="">-- اختر مركز التكلفة --</option>
                      {costCenters.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">بند التكلفة</label>
                    <select value={requestFormData.cost_item_id} onChange={e=>setRequestFormData({...requestFormData,cost_item_id:e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <option value="">-- اختر بند التكلفة --</option>
                      {costItems.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">سبب الطلب *</label>
                    <select value={requestFormData.reason} onChange={e=>setRequestFormData({...requestFormData,reason:e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" required>
                      <option value="">-- اختر السبب --</option><option value="نقص مخزون">نقص مخزون</option><option value="استهلاك تشغيلي">استهلاك تشغيلي</option><option value="طلب قسم">طلب قسم</option><option value="إعادة طلب">إعادة طلب</option><option value="مشروع جديد">مشروع جديد</option><option value="صيانة">صيانة</option><option value="طوارئ">طوارئ</option><option value="أخرى">أخرى</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">العملة</label>
                    <select value={requestFormData.currency} onChange={e=>setRequestFormData({...requestFormData,currency:e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl"><option value="EGP">EGP - جنيه مصري</option><option value="USD">USD - دولار</option><option value="EUR">EUR - يورو</option><option value="SAR">SAR - ريال</option><option value="AED">AED - درهم</option></select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-bold text-slate-700 mb-2">مبررات الطلب</label><textarea value={requestFormData.justification} onChange={e=>setRequestFormData({...requestFormData,justification:e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl min-h-[90px]" placeholder="اشرح سبب الاحتياج والكمية المطلوبة..." /></div>
                  <div><label className="block text-sm font-bold text-slate-700 mb-2">ملاحظات</label><textarea value={requestFormData.notes} onChange={e=>setRequestFormData({...requestFormData,notes:e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl min-h-[90px]" placeholder="أي ملاحظات تشغيلية إضافية..." /></div>
                </div>
                <div className="p-4 border border-dashed border-slate-300 rounded-xl bg-slate-50">
                  <label className="block text-sm font-bold text-slate-700 mb-2">المرفقات</label>
                  <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.xls,.xlsx,.doc,.docx,.txt" onChange={e=>setRequestAttachments(Array.from(e.target.files || []).slice(0,10))} className="w-full text-sm" />
                  {requestAttachments.length>0 && <div className="mt-2 text-xs text-slate-500">تم اختيار {requestAttachments.length} ملف: {requestAttachments.map(f=>f.name).join("، ")}</div>}
                </div>

                {/* Items Selection */}
                <div className="border border-slate-200 rounded-2xl overflow-visible shadow-sm">
                  <div className="bg-slate-50 p-5 border-b border-slate-200 rounded-t-2xl flex justify-between items-center">
                    <div><h3 className="font-bold text-slate-800">الأصناف المطلوبة</h3><p className="text-xs text-slate-500 mt-1">يتم حفظ بيانات الصنف والرصيد وحدود المخزون كسجل Snapshot داخل الطلب.</p></div>
                    <div className="text-sm font-black text-emerald-700">التقديري: {purchaseItems.reduce((s:any,i:any)=>s+Number(i.quantity||0)*Number(i.unit_price||0),0).toLocaleString()} {requestFormData.currency}</div>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="relative z-[70]">
                      <SearchableSelect
                        options={ingredients.filter((ing:any)=>!ing.is_product).map((ing:any)=>({
                          id: ing.id,
                          label: ing.name,
                          item_code: ing.item_code || ing.code || "-",
                          barcode: ing.barcode || ing.item_code || ing.code || "-",
                          unit: ing.unit || "قطعة",
                          cost: Number(ing.avg_cost || ing.cost || 0),
                          last_purchase_price: Number(ing.last_purchase_price || 0),
                          stock: Number(ing.total_stock || ing.current_stock || 0),
                          min_stock: Number(ing.min_stock || 0),
                          max_stock: Number(ing.max_stock || 0),
                          supplier: ing.supplier || ing.supplier_name || "-",
                          description: ing.description || "-",
                          is_product: false
                        }))}
                        value=""
                        onChange={(value) => {
                          if (!value) return;
                          const ing:any = ingredients.find((i:any)=>String(i.id)===String(value));
                          if (!ing || purchaseItems.some((i:any)=>String(i.ingredient_id)===String(ing.id))) return;
                          const isProduct=!!ing.is_product;
                          const stock=Number(ing.total_stock||ing.current_stock||0);
                          const min=Number(ing.min_stock||0); const max=Number(ing.max_stock||0);
                          const lastPurchasePrice=Number(ing.last_purchase_price||0);
                          const avgCost=Number(ing.avg_cost||ing.cost||0);
                          const suggested=max>stock ? Math.max(max-stock,0) : Math.max(min-stock,1);
                          setPurchaseItems([...purchaseItems,{ ingredient_id:isProduct?0:Number(ing.id), product_id:isProduct?Number(String(ing.id).replace(/^p_/,'')):undefined, item_type:isProduct?"product":"ingredient", item_code:ing.item_code||ing.code||"", barcode:ing.barcode||"", name:ing.name, unit:ing.unit||"قطعة", quantity:suggested||1, unit_price:lastPurchasePrice||avgCost, avg_cost:avgCost, last_purchase_price:lastPurchasePrice, stock_on_hand:stock, min_stock:min, max_stock:max, suggested_quantity:suggested||1, supplier:ing.supplier||ing.supplier_name||"-", description:ing.description||"" } as any]);
                        }}
                        placeholder="ابحث عن الصنف بالاسم أو الكود أو الباركود..."
                        searchKeys={["label","item_code","barcode"]}
                        labelKey="label"
                        columns={[
                          {key:"item_code",title:"الكود"},
                          {key:"label",title:"الصنف"},
                          {key:"unit",title:"الوحدة"},
                          {key:"stock",title:"الرصيد"},
                          {key:"cost",title:"متوسط التكلفة",render:(o:any)=>`${Number(o.cost||0).toLocaleString()} ج.م`},
                          {key:"last_purchase_price",title:"آخر سعر شراء",render:(o:any)=>o.last_purchase_price ? `${Number(o.last_purchase_price).toLocaleString()} ج.م` : "لا يوجد"}
                        ]}
                      />
                    </div>
                    {purchaseItems.length>0 && <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-center text-sm min-w-[1150px]"><thead className="bg-slate-50 text-slate-600 border-b"><tr><th className="p-3">الصنف</th><th className="p-3">الكود</th><th className="p-3">الرصيد</th><th className="p-3">الحد الأدنى</th><th className="p-3">المقترح</th><th className="p-3">الكمية</th><th className="p-3">الوحدة</th><th className="p-3">آخر سعر شراء</th><th className="p-3">السعر التقديري</th><th className="p-3">الإجمالي</th><th></th></tr></thead><tbody className="divide-y">
                      {purchaseItems.map((item:any,idx:number)=><tr key={idx} className="hover:bg-blue-50/50"><td className="p-3 font-bold text-slate-800"><div>{item.name}</div>{item.description && <div className="text-[11px] text-slate-400 mt-1 max-w-[220px] truncate">{item.description}</div>}</td><td className="p-3 text-slate-500">{item.item_code||item.barcode||"-"}</td><td className="p-3 font-semibold">{Number(item.stock_on_hand||0)}</td><td className="p-3">{Number(item.min_stock||0)}</td><td className="p-3 text-emerald-700 font-bold">{Number(item.suggested_quantity||0)}</td><td className="p-3"><input type="number" min="0.001" step="any" value={item.quantity||""} onChange={e=>{const n=[...purchaseItems];n[idx]={...n[idx],quantity:Number(e.target.value)||0};setPurchaseItems(n)}} className="w-28 p-2.5 bg-white border border-slate-200 rounded-lg text-center font-bold" /></td><td className="p-3">{item.unit}</td><td className="p-3 font-bold text-amber-700">{Number(item.last_purchase_price||0)>0 ? `${Number(item.last_purchase_price)} ج.م` : "-"}</td><td className="p-3"><input type="number" min="0" step="any" value={item.unit_price??0} onChange={e=>{const n=[...purchaseItems];n[idx]={...n[idx],unit_price:Number(e.target.value)||0};setPurchaseItems(n)}} className="w-32 p-2.5 bg-white border border-slate-200 rounded-lg text-center font-bold" /></td><td className="p-3 font-black">{(Number(item.quantity||0)*Number(item.unit_price||0))} {requestFormData.currency}</td><td className="p-3"><button type="button" onClick={()=>setPurchaseItems(purchaseItems.filter((_,i)=>i!==idx))} className="p-2.5 text-red-500 hover:bg-red-50 rounded-lg" title="حذف الصنف"><Trash2 className="w-4 h-4" /></button></td></tr>)}
                    </tbody></table></div>}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setShowRequestModal(false); setIsCreatingRequest(false); isCreatingRequestRef.current = false; createRequestKeyRef.current = ""; }}
                  className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={purchaseItems.length === 0 || isCreatingRequest}
                  className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-200 transition-all"
                >
                  {isCreatingRequest ? "جاري إنشاء الطلب..." : "إنشاء طلب الشراء"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedQuotation && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl p-6">
            <div className="flex justify-between items-center border-b pb-4 mb-5"><div><h2 className="text-xl font-black text-slate-800">تفاصيل عرض السعر</h2><p className="text-sm text-slate-500 font-mono">{selectedQuotation.quotation_number || `#${selectedQuotation.id}`}</p></div><button onClick={()=>setSelectedQuotation(null)} className="p-2 text-slate-400"><XCircle className="w-6 h-6"/></button></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">{[['المورد',selectedQuotation.supplier||'-'],['التاريخ',selectedQuotation.quotation_date||selectedQuotation.date?.slice(0,10)||'-'],['صالح حتى',selectedQuotation.valid_until||'-'],['التوريد',selectedQuotation.delivery_date||'-'],['المرجع',selectedQuotation.reference_number||'-'],['مسؤول التواصل',selectedQuotation.contact_person||'-'],['الهاتف',selectedQuotation.contact_phone||'-'],['العملة',selectedQuotation.currency||'EGP']].map(([k,v])=><div key={k} className="bg-slate-50 rounded-xl p-3"><div className="text-[11px] text-slate-500 font-bold">{k}</div><div className="font-bold text-slate-800 mt-1">{v}</div></div>)}</div>
            <div className="border rounded-xl overflow-hidden mb-5"><table className="w-full text-center text-sm"><thead className="bg-[#2F5F9F]"><tr><th className="p-3">الصنف</th><th className="p-3">الوحدة</th><th className="p-3">الكمية</th><th className="p-3">سعر الوحدة</th><th className="p-3">الإجمالي</th></tr></thead><tbody className="divide-y">{(Array.isArray(selectedQuotation.items)?selectedQuotation.items:[]).map((it:any,i:number)=><tr key={i}><td className="p-3 font-bold">{it.name||'-'}</td><td className="p-3">{it.unit||'-'}</td><td className="p-3">{Number(it.quantity||0)}</td><td className="p-3">{Number(it.unit_price||0)}</td><td className="p-3 font-bold">{(Number(it.quantity||0)*Number(it.unit_price||0))}</td></tr>)}</tbody></table></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">{[['قبل الخصم',selectedQuotation.subtotal||selectedQuotation.estimated_value||0],['الخصم',selectedQuotation.discount_amount||0],['الضريبة',selectedQuotation.tax_amount||0],['الإجمالي',selectedQuotation.total_amount||selectedQuotation.estimated_value||0]].map(([k,v])=><div key={k} className="p-3 bg-slate-50 rounded-xl"><b>{k}</b><div className="mt-1 font-black">{Number(v).toLocaleString()} {selectedQuotation.currency||'EGP'}</div></div>)}</div>
            <div className="grid md:grid-cols-2 gap-3"><div className="p-4 bg-slate-50 rounded-xl"><b>شروط الدفع</b><p className="mt-2 text-sm whitespace-pre-wrap">{selectedQuotation.payment_terms||'لا توجد شروط محددة'}</p></div><div className="p-4 bg-slate-50 rounded-xl"><b>شروط التوريد</b><p className="mt-2 text-sm whitespace-pre-wrap">{selectedQuotation.delivery_terms||'لا توجد شروط محددة'}</p></div></div>
            {selectedQuotation.notes && <div className="mt-3 p-4 bg-amber-50 rounded-xl"><b>ملاحظات</b><p className="mt-2 text-sm whitespace-pre-wrap">{selectedQuotation.notes}</p></div>}
          </div>
        </div>
      )}

      {/* Quotation Modal */}
      {showQuotationModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-xl font-bold text-slate-800">
                تسجيل عرض سعر جديد (RFQ)
              </h2>
              <button
                onClick={() => setShowQuotationModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateQuotation} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    رقم عرض السعر
                  </label>
                  <input
                    type="text"
                    value={quotationFormData.quotation_number ?? ""}
                    onChange={(e) =>
                      setQuotationFormData({
                        ...quotationFormData,
                        quotation_number: e.target.value,
                      })
                    }
                    placeholder="تلقائي (مثال: RFQ-12345)"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    المورد *
                  </label>
                  <select
                    required
                    value={quotationFormData.supplier_id ?? ""}
                    onChange={(e) =>
                      setQuotationFormData({
                        ...quotationFormData,
                        supplier_id: e.target.value,
                      })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-sm font-medium"
                  >
                    <option value="">-- اختر المورد --</option>
                    {suppliers.map((sup: any) => (
                      <option key={sup.id} value={sup.id}>
                        {sup.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    مرتبط بطلب شراء (اختياري)
                  </label>
                  <select
                    value={quotationFormData.request_id ?? ""}
                    onChange={(e) =>
                      setQuotationFormData({
                        ...quotationFormData,
                        request_id: e.target.value,
                      })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-sm font-medium"
                  >
                    <option value="">-- غير مرتبط بطلب --</option>
                    {requests.map((req: any) => (
                      <option key={req.id} value={req.id}>
                        طلب رقم #{req.id} ({req.requested_by || "مستخدم"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">تاريخ عرض السعر</label>
                  <input type="date" value={quotationFormData.quotation_date ?? ""} onChange={e => setQuotationFormData({...quotationFormData, quotation_date:e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">صالح حتى</label>
                  <input type="date" value={quotationFormData.valid_until ?? ""} onChange={e => setQuotationFormData({...quotationFormData, valid_until:e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">تاريخ التوريد المتوقع
                  </label>
                  <input
                    type="date"
                    value={quotationFormData.delivery_date ?? ""}
                    onChange={(e) =>
                      setQuotationFormData({
                        ...quotationFormData,
                        delivery_date: e.target.value,
                      })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input value={quotationFormData.contact_person} onChange={e=>setQuotationFormData({...quotationFormData,contact_person:e.target.value})} placeholder="مسؤول التواصل" className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                <input value={quotationFormData.contact_phone} onChange={e=>setQuotationFormData({...quotationFormData,contact_phone:e.target.value})} placeholder="هاتف التواصل" className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                <input value={quotationFormData.reference_number} onChange={e=>setQuotationFormData({...quotationFormData,reference_number:e.target.value})} placeholder="رقم مرجعي" className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                <select value={quotationFormData.currency} onChange={e=>setQuotationFormData({...quotationFormData,currency:e.target.value})} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"><option value="EGP">جنيه مصري EGP</option><option value="USD">دولار USD</option><option value="EUR">يورو EUR</option></select>
                <input type="number" min="0" step="any" value={quotationFormData.discount_amount} onChange={e=>setQuotationFormData({...quotationFormData,discount_amount:e.target.value})} placeholder="الخصم" className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                <input type="number" min="0" step="any" value={quotationFormData.tax_amount} onChange={e=>setQuotationFormData({...quotationFormData,tax_amount:e.target.value})} placeholder="الضريبة" className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                <input value={quotationFormData.payment_terms} onChange={e=>setQuotationFormData({...quotationFormData,payment_terms:e.target.value})} placeholder="شروط الدفع" className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                <input value={quotationFormData.delivery_terms} onChange={e=>setQuotationFormData({...quotationFormData,delivery_terms:e.target.value})} placeholder="شروط التوريد" className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
              </div>

              {/* Items Section */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                <h3 className="font-bold text-slate-800 text-sm flex items-center justify-between">
                  <span>جدول أصناف عرض السعر</span>
                  <span className="text-xs text-slate-500 font-normal">
                    إجمالي الاصناف: {quotationItems.length}
                  </span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      اختيار الصنف
                    </label>
                    <select
                      value={quotationItemInput.ingredient_id ?? ""}
                      onChange={(e) => {
                        const ing = ingredients.find((i: any) => String(i.id) === e.target.value);
                        setQuotationItemInput({
                          ...quotationItemInput,
                          ingredient_id: e.target.value,
                          name: ing ? ing.name : "",
                          unit: ing ? ing.unit || "كيلو" : "كيلو",
                          unit_price: ing ? String(ing.cost || ing.price || 0) : "0",
                        });
                      }}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none"
                    >
                      <option value="">-- اختر صنف/مكون --</option>
                      {ingredients.map((ing: any) => (
                        <option key={ing.id} value={ing.id}>
                          {ing.name} ({ing.unit || "وحدة"})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      الكمية
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      value={quotationItemInput.quantity ?? ""}
                      onChange={(e) =>
                        setQuotationItemInput({
                          ...quotationItemInput,
                          quantity: e.target.value,
                        })
                      }
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-center"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      السعر (ج.م)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={quotationItemInput.unit_price ?? ""}
                      onChange={(e) =>
                        setQuotationItemInput({
                          ...quotationItemInput,
                          unit_price: e.target.value,
                        })
                      }
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-center"
                    />
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!quotationItemInput.name) return;
                        setQuotationItems([
                          ...quotationItems,
                          {
                            ingredient_id: quotationItemInput.ingredient_id,
                            name: quotationItemInput.name,
                            unit: quotationItemInput.unit,
                            quantity: Number(quotationItemInput.quantity) || 1,
                            unit_price: Number(quotationItemInput.unit_price) || 0,
                            total_price: (Number(quotationItemInput.quantity) || 1) * (Number(quotationItemInput.unit_price) || 0),
                          },
                        ]);
                        setQuotationItemInput({
                          ingredient_id: "",
                          name: "",
                          unit: "كيلو",
                          quantity: "1",
                          unit_price: "0",
                        });
                      }}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors"
                    >
                      + إضافة
                    </button>
                  </div>
                </div>

                {quotationItems.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mt-3">
                    <table className="w-full text-center text-xs">
                      <thead className="bg-[#2F5F9F] text-slate-700">
                        <tr>
                          <th className="p-2 font-bold">الصنف</th>
                          <th className="p-2 font-bold">الكمية</th>
                          <th className="p-2 font-bold">السعر</th>
                          <th className="p-2 font-bold">الإجمالي</th>
                          <th className="p-2 font-bold text-center">حذف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {quotationItems.map((item, idx) => (
                          <tr key={idx}>
                            <td className="p-2 font-semibold text-slate-800">
                              {item.name}
                            </td>
                            <td className="p-2 text-slate-600">
                              {item.quantity} {item.unit}
                            </td>
                            <td className="p-2 text-slate-600 font-mono">
                              {Number(item.unit_price || 0)} ج.م
                            </td>
                            <td className="p-2 font-bold text-emerald-600 font-mono">
                              {(Number(item.quantity) * Number(item.unit_price))} ج.م
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  setQuotationItems(
                                    quotationItems.filter((_, i) => i !== idx)
                                  )
                                }
                                className="text-rose-500 hover:text-rose-700 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 font-bold text-sm text-slate-800">
                  <span>إجمالي قيمة عرض السعر:</span>
                  <span className="text-emerald-600 font-mono text-base">
                    {quotationItems
                      .reduce(
                        (acc, item) =>
                          acc + (Number(item.quantity) * Number(item.unit_price) || 0),
                        0
                      )
                      .toLocaleString()}{" "}
                    ج.م
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  ملاحظات وشروط التوريد
                </label>
                <textarea
                  rows={2}
                  value={quotationFormData.notes ?? ""}
                  onChange={(e) =>
                    setQuotationFormData({
                      ...quotationFormData,
                      notes: e.target.value,
                    })
                  }
                  placeholder="شروط الدفع والتسليم، مدة صلاحية العرض، أية ملاحظات إضافية..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowQuotationModal(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-colors text-sm"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-colors text-sm shadow-sm"
                >
                  حفظ عرض السعر
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl p-6 shadow-xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-xl font-bold text-slate-800">
                تسجيل مصروف مشتريات جديد
              </h2>
              <button
                onClick={() => setShowExpenseModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    رقم السند / الفاتورة
                  </label>
                  <input
                    type="text"
                    value={expenseFormData.voucher_no ?? ""}
                    onChange={(e) =>
                      setExpenseFormData({
                        ...expenseFormData,
                        voucher_no: e.target.value,
                      })
                    }
                    placeholder="تلقائي إن تُرك فارغاً"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    المبلغ (ج.م) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={expenseFormData.amount ?? ""}
                    onChange={(e) =>
                      setExpenseFormData({
                        ...expenseFormData,
                        amount: e.target.value,
                      })
                    }
                    placeholder="0.00"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    المورد / الجهة
                  </label>
                  <select
                    value={expenseFormData.supplier_id ?? ""}
                    onChange={(e) =>
                      setExpenseFormData({
                        ...expenseFormData,
                        supplier_id: e.target.value,
                      })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-sm font-medium"
                  >
                    <option value="">-- اختر المورد (اختياري) --</option>
                    {suppliers.map((sup: any) => (
                      <option key={sup.id} value={sup.id}>
                        {sup.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">مرتبط بفاتورة مشتريات</label>
                  <select value={expenseFormData.purchase_id} onChange={e=>setExpenseFormData({...expenseFormData,purchase_id:e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                    <option value="">-- بدون ربط --</option>
                    {purchases.map((p:any)=><option key={p.id} value={p.id}>{p.invoice_number || `PINV-${p.id}`} - {p.supplier_name || "مورد"}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">مرتبط بأمر شراء</label>
                  <select value={expenseFormData.purchase_order_id} onChange={e=>setExpenseFormData({...expenseFormData,purchase_order_id:e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                    <option value="">-- بدون ربط --</option>
                    {orders.map((o:any)=><option key={o.id} value={o.id}>{o.order_number || `PO-${o.id}`} - {o.supplier_name || "مورد"}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    مركز التكلفة
                  </label>
                  <select
                    value={expenseFormData.cost_center_id ?? ""}
                    onChange={(e) =>
                      setExpenseFormData({
                        ...expenseFormData,
                        cost_center_id: e.target.value,
                      })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-sm font-medium"
                  >
                    <option value="">-- اختر مركز التكلفة --</option>
                    {costCenters.map((cc: any) => (
                      <option key={cc.id} value={cc.id}>
                        {cc.name} ({cc.branch || "عام"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    بند المصروف
                  </label>
                  <select
                    value={expenseFormData.cost_item_id ?? ""}
                    onChange={(e) =>
                      setExpenseFormData({
                        ...expenseFormData,
                        cost_item_id: e.target.value,
                      })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-sm font-medium"
                  >
                    <option value="">-- اختر بند المصروف --</option>
                    {costItems.map((ci: any) => (
                      <option key={ci.id} value={ci.id}>
                        {ci.name} ({ci.cost_type || "تشغيل"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    طريقة الدفع
                  </label>
                  <select
                    value={expenseFormData.payment_method ?? ""}
                    onChange={(e) =>
                      setExpenseFormData({
                        ...expenseFormData,
                        payment_method: e.target.value,
                      })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-sm font-medium"
                  >
                    <option value="نقدي">نقدي (كاش)</option>
                    <option value="تحويل بنكي">تحويل بنكي</option>
                    <option value="شيك">شيك بنكي</option>
                    <option value="آجل">آجل / على الحساب</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  الخزينة / الحساب البنكي
                </label>
                <input
                  type="text"
                  value={expenseFormData.safe ?? ""}
                  onChange={(e) =>
                    setExpenseFormData({
                      ...expenseFormData,
                      safe: e.target.value,
                    })
                  }
                  placeholder="اسم الخزينة أو البنك"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  ملاحظات / وصف المصروف
                </label>
                <textarea
                  rows={2}
                  value={expenseFormData.notes ?? ""}
                  onChange={(e) =>
                    setExpenseFormData({
                      ...expenseFormData,
                      notes: e.target.value,
                    })
                  }
                  placeholder="أدخل أي تفاصيل إضافية عن المصروف..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-colors text-sm"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-colors text-sm shadow-sm"
                >
                  حفظ المصروف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <InvoiceOCRModal
        isOpen={isOcrModalOpen}
        onClose={() => setIsOcrModalOpen(false)}
        onJournalPosted={() => {
          fetchPurchases();
        }}
      />
    </div>
  );
}
