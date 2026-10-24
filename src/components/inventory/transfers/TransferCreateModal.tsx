import React, { useState, useEffect, useMemo } from "react";
import { 
  X, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  Check, 
  Boxes, 
  Truck, 
  ArrowRightLeft, 
  ArrowRight,
  Calendar, 
  Search, 
  Barcode, 
  DollarSign, 
  HelpCircle,
  FileText,
  Building2,
  Tag,
  Clock,
  ShieldCheck,
  ChevronDown,
  Info,
  Layers,
  Sparkles
} from "lucide-react";
import { api } from "../../../utils/api";
import { TransferItem, TransferType, TransferPriority } from "./TransferTypes";

interface WarehouseOption {
  id: number;
  name: string;
  code: string;
  manager?: string;
  is_transit?: boolean;
}

interface IngredientOption {
  id: number;
  name: string;
  code: string;
  unit: string;
  barcode?: string;
  category?: string;
  avg_cost?: number;
  last_purchase_price?: number;
}

interface TransferCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  warehouses: WarehouseOption[];
  ingredients: IngredientOption[];
  onNotify: (msg: string, type?: "success" | "error" | "info") => void;
}

export const TransferCreateModal: React.FC<TransferCreateModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  warehouses,
  ingredients,
  onNotify,
}) => {
  const [fromWarehouseId, setFromWarehouseId] = useState<string>("");
  const [toWarehouseId, setToWarehouseId] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [type, setType] = useState<TransferType>("standard");
  const [priority, setPriority] = useState<TransferPriority>("normal");
  const [department, setDepartment] = useState<string>("");
  const [purpose, setPurpose] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [driverName, setDriverName] = useState<string>("");
  const [vehicleNo, setVehicleNo] = useState<string>("");
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [items, setItems] = useState<TransferItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string>("");
  const [sourceStock, setSourceStock] = useState<Record<number, { available: number; quantity: number }>>({});
  const [loadingStock, setLoadingStock] = useState<boolean>(false);
  const [itemSearchTerm, setItemSearchTerm] = useState<string>("");

  // Reset form state when modal opens
  useEffect(() => {
    if (isOpen) {
      setDate(new Date().toISOString().split("T")[0]);
      setType("standard");
      setPriority("normal");
      setDepartment("");
      setPurpose("");
      setNotes("");
      setDriverName("");
      setVehicleNo("");
      setShippingCost(0);
      setItems([]);
      setSubmitError("");
      setItemSearchTerm("");
      setSourceStock({});
      if (warehouses.length >= 2) {
        setFromWarehouseId(String(warehouses[0].id));
        setToWarehouseId(String(warehouses[1].id));
      } else if (warehouses.length === 1) {
        setFromWarehouseId(String(warehouses[0].id));
        setToWarehouseId("");
      } else {
        setFromWarehouseId("");
        setToWarehouseId("");
      }
    }
  }, [isOpen]);

  // Fetch live stock for selected source warehouse
  useEffect(() => {
    if (!fromWarehouseId) return;

    const fetchStock = async () => {
      setLoadingStock(true);
      try {
        const res = await api.get(`/api/enterprise/warehouse-transfers/source-stock/${fromWarehouseId}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.items)) {
          const map: Record<number, { available: number; quantity: number }> = {};
          data.items.forEach((it: any) => {
            map[Number(it.ingredient_id)] = {
              available: Number(it.available || it.quantity || 0),
              quantity: Number(it.quantity || 0),
            };
          });
          setSourceStock(map);
        }
      } catch (err) {
        console.error("Failed to load source warehouse stock:", err);
      } finally {
        setLoadingStock(false);
      }
    };

    fetchStock();
  }, [fromWarehouseId]);

  // Filtered ingredients for quick search adding
  const filteredIngredients = useMemo(() => {
    if (!itemSearchTerm || !itemSearchTerm.trim()) return [];
    const q = itemSearchTerm.trim().toLowerCase();
    return (ingredients || []).filter(
      (ing) =>
        (ing?.name && String(ing.name).toLowerCase().includes(q)) ||
        (ing?.code && String(ing.code).toLowerCase().includes(q)) ||
        (ing?.barcode && String(ing.barcode).toLowerCase().includes(q))
    ).slice(0, 8);
  }, [ingredients, itemSearchTerm]);

  const handleAddItem = (ingredientId?: number) => {
    let ing = ingredients[0];
    if (ingredientId) {
      const found = ingredients.find((i) => i.id === ingredientId);
      if (found) ing = found;
    }

    if (!ing) {
      onNotify("لا توجد أصناف مسجلة بالنظام", "info");
      return;
    }

    const avail = sourceStock[ing.id]?.available ?? 0;
    const total = sourceStock[ing.id]?.quantity ?? 0;

    const newItem: TransferItem = {
      ingredient_id: ing.id,
      name: ing.name,
      code: ing.code,
      unit: ing.unit || "قطعة",
      barcode: ing.barcode || "",
      requested_qty: 1,
      approved_qty: 1,
      unit_cost: ing.avg_cost || ing.last_purchase_price || 0,
      source_available_qty: avail,
      source_total_qty: total,
      batch_number: "",
      expiry_date: null,
      serial_number: "",
      source_location_code: "",
      target_location_code: "",
      notes: "",
    };

    setItems([...items, newItem]);
  };

  const handleItemChange = (index: number, field: keyof TransferItem, value: any) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: value };

    if (field === "ingredient_id") {
      const ing = ingredients.find((i) => i.id === Number(value));
      if (ing) {
        item.name = ing.name;
        item.code = ing.code;
        item.unit = ing.unit || "قطعة";
        item.barcode = ing.barcode || "";
        item.unit_cost = ing.avg_cost || ing.last_purchase_price || 0;
        item.source_available_qty = sourceStock[ing.id]?.available ?? 0;
        item.source_total_qty = sourceStock[ing.id]?.quantity ?? 0;
      }
    }

    updated[index] = item;
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const totalQty = items.reduce((s, it) => s + Number(it.requested_qty || 0), 0);
    const totalValue = items.reduce((s, it) => s + (Number(it.requested_qty || 0) * Number(it.unit_cost || 0)), 0);
    return { totalQty, totalValue };
  };

  const { totalQty, totalValue } = calculateTotals();

  const handleSave = async (status: "draft" | "requested" | "approved") => {
    setSubmitError("");

    if (!fromWarehouseId || !toWarehouseId) {
      const message = "يرجى اختيار المخزن المصدر والمخزن المستهدف";
      setSubmitError(message);
      onNotify(message, "error");
      return;
    }

    if (Number(fromWarehouseId) === Number(toWarehouseId)) {
      const message = "لا يمكن التحويل لنفس المخزن، يرجى تحديد مخزن مستهدف مختلف";
      setSubmitError(message);
      onNotify(message, "error");
      return;
    }

    if (items.length === 0) {
      const message = "يرجى إضافة صنف واحد على الأقل للتحويل";
      setSubmitError(message);
      onNotify(message, "error");
      return;
    }

    // Check for 0 or negative quantities
    const invalidQty = items.some((it) => !Number.isFinite(Number(it.requested_qty)) || Number(it.requested_qty) <= 0);
    if (invalidQty) {
      const message = "يجب أن تكون جميع الكميات المطلوبة أكبر من الصفر";
      setSubmitError(message);
      onNotify(message, "error");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        from_warehouse_id: Number(fromWarehouseId),
        to_warehouse_id: Number(toWarehouseId),
        date,
        type,
        priority,
        department,
        purpose,
        notes,
        driver_name: driverName,
        vehicle_no: vehicleNo,
        shipping_cost: Number(shippingCost || 0),
        items,
        status,
        auto_post: status === "approved",
      });
      onClose();
    } catch (err: any) {
      const message = err.message || "فشل في حفظ التحويل";
      setSubmitError(message);
      onNotify(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const selectedFromWarehouse = warehouses.find((w) => String(w.id) === fromWarehouseId);
  const selectedToWarehouse = warehouses.find((w) => String(w.id) === toWarehouseId);

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-sm overflow-y-auto" 
      id="transfer-create-modal"
      dir="rtl"
    >
      <div className="relative w-[96vw] max-w-[1500px] min-h-[82vh] max-h-[96vh] flex flex-col bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl md:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <ArrowRightLeft className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  إنشاء طلب تحويل مخزني جديد
                </h2>
                <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  تحويل بضائع
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                تسجيل أمر نقل ومناقلة أصناف بين المستودعات مع تدقيق الأرصدة الحية
              </p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700/60 rounded-xl transition-colors cursor-pointer"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-7 lg:p-8 overflow-y-auto space-y-7 flex-1 text-right bg-white dark:bg-slate-900">
          
          {/* Warehouse Selection & Route Card */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/70 shadow-xs">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
              <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">مسار التحويل والمستودعات</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Source Warehouse */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  المخزن المصدر (الصرف) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="create-from-warehouse"
                    value={fromWarehouseId}
                    onChange={(e) => setFromWarehouseId(e.target.value)}
                    className="w-full h-10 px-3 pr-9 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition-all appearance-none"
                  >
                    <option value="">-- اختر المخزن المصدر --</option>
                    {warehouses.map((w, wIdx) => (
                      <option key={`src-wh-${w.id ?? wIdx}-${wIdx}`} value={String(w.id)}>
                        {w.name} ({w.code}) {w.manager ? `- مسؤول: ${w.manager}` : ""}
                      </option>
                    ))}
                  </select>
                  <Building2 className="w-4 h-4 text-blue-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-80" />
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                {selectedFromWarehouse && (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    كود: <span className="font-mono text-blue-600 dark:text-blue-400">{selectedFromWarehouse.code}</span>
                    {selectedFromWarehouse.manager && ` | المسؤول: ${selectedFromWarehouse.manager}`}
                  </p>
                )}
              </div>

              {/* Destination Warehouse */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  المخزن المستهدف (الاستلام) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="create-to-warehouse"
                    value={toWarehouseId}
                    onChange={(e) => setToWarehouseId(e.target.value)}
                    className="w-full h-10 px-3 pr-9 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition-all appearance-none"
                  >
                    <option value="">-- اختر المخزن المستهدف --</option>
                    {warehouses.map((w, wIdx) => (
                      <option 
                        key={`dst-wh-${w.id ?? wIdx}-${wIdx}`} 
                        value={String(w.id)}
                        disabled={String(w.id) === fromWarehouseId}
                      >
                        {w.name} ({w.code}) {w.is_transit ? " [مخزن ترانزيت]" : ""}
                      </option>
                    ))}
                  </select>
                  <Building2 className="w-4 h-4 text-emerald-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-80" />
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                {selectedToWarehouse && (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    كود: <span className="font-mono text-emerald-600 dark:text-emerald-400">{selectedToWarehouse.code}</span>
                    {selectedToWarehouse.is_transit && " | مخزن نقل وسيط"}
                  </p>
                )}
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  تاريخ التحويل
                </label>
                <div className="relative">
                  <input
                    type="date"
                    id="create-date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full h-10 px-3 pr-9 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition-all font-mono"
                  />
                  <Calendar className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-80" />
                </div>
              </div>

              {/* Transfer Type */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  نوع التحويل
                </label>
                <div className="relative">
                  <select
                    id="create-type"
                    value={type}
                    onChange={(e) => setType(e.target.value as TransferType)}
                    className="w-full h-10 px-3 pr-9 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition-all appearance-none"
                  >
                    <option value="standard">تحويل قياسي روتيني</option>
                    <option value="urgent">تحويل طارئ فوري</option>
                    <option value="replenishment">إعادة تموين دوري</option>
                    <option value="inter_branch">تحويل بين الفروع</option>
                    <option value="department_issue">صرف لقسم تشغيلي</option>
                    <option value="return_to_hub">إرجاع للمستودع المركزي</option>
                    <option value="damaged_transfer">نقل أصناف تالفة / عزل</option>
                  </select>
                  <Tag className="w-4 h-4 text-purple-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-80" />
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Sub Row: Priority, Department, Purpose */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  درجة الأولوية
                </label>
                <div className="relative">
                  <select
                    id="create-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TransferPriority)}
                    className="w-full h-9 px-3 pr-8 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                  >
                    <option value="low">منخفضة (Low)</option>
                    <option value="normal">عادية (Normal)</option>
                    <option value="high">عالية (High)</option>
                    <option value="urgent">عاجلة وفورية (Urgent)</option>
                  </select>
                  <Clock className="w-3.5 h-3.5 text-amber-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  القسم / الجهة الطالبة
                </label>
                <input
                  type="text"
                  id="create-department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="مثال: قسم الصيانة، المطبخ المركزي، الإنتاج..."
                  className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  الغرض من التحويل
                </label>
                <input
                  type="text"
                  id="create-purpose"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="مثال: تغطية عجز مخزني، تشغيل وردية..."
                  className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            {/* Items Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">الأصناف والكميات المحولة</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">حدد الأصناف وتحقق من مطابقة الأرصدة بالمخزن المصدر</p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-black">
                  {items.length} صنف
                </span>
              </div>

              <div className="flex items-center gap-3">
                {loadingStock && (
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 animate-pulse flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                    <Clock className="w-3.5 h-3.5" />
                    <span>جاري فحص رصيد المستودع...</span>
                  </span>
                )}

                {/* Quick search input to add item */}
                <div className="relative hidden md:block">
                  <input
                    type="text"
                    placeholder="بحث سريع وإضافة صنف..."
                    value={itemSearchTerm}
                    onChange={(e) => setItemSearchTerm(e.target.value)}
                    className="h-9 w-56 px-3 pr-8 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  
                  {filteredIngredients.length > 0 && (
                    <div className="absolute z-20 top-full mt-1 right-0 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-700">
                      {filteredIngredients.map((ing, ingIdx) => (
                        <button
                          key={`search-item-${ing.id ?? ingIdx}-${ingIdx}`}
                          type="button"
                          onClick={() => {
                            handleAddItem(ing.id);
                            setItemSearchTerm("");
                          }}
                          className="w-full px-3 py-2 text-right hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center justify-between text-xs transition-colors cursor-pointer"
                        >
                          <div>
                            <p className="font-bold text-slate-800 dark:text-slate-200">{ing.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{ing.code} | {ing.unit}</p>
                          </div>
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100/60 dark:bg-blue-900/60 px-2 py-0.5 rounded">
                            + إضافة
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  id="btn-add-item-row"
                  onClick={() => handleAddItem()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة صنف جديد</span>
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="p-12 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center bg-slate-50/50 dark:bg-slate-900/50">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-3.5 shadow-inner">
                  <Boxes className="w-8 h-8" />
                </div>
                <h4 className="text-sm font-black text-slate-800 dark:text-slate-200">لم يتم إضافة أي أصناف بعد</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                  اضغط على زر "إضافة صنف جديد" بالأسفل أو بالأعلى لتحديد الأصناف والكميات المراد نقلها.
                </p>
                <button
                  type="button"
                  onClick={() => handleAddItem()}
                  className="mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة أول صنف للتحويل</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1250px] text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-bold">
                      <th className="py-3 px-3 w-10 text-center">#</th>
                      <th className="py-3 px-4 min-w-[220px]">تحديد الصنف</th>
                      <th className="py-3 px-3 w-28 text-center">الرصيد المتاح</th>
                      <th className="py-3 px-3 w-32 text-center">الكمية المطلوبة</th>
                      <th className="py-3 px-3 w-20 text-center">الوحدة</th>
                      <th className="py-3 px-3 w-28 text-center">التكلفة (ر.س)</th>
                      <th className="py-3 px-3 w-28 text-center">الإجمالي</th>
                      <th className="py-3 px-3 min-w-[140px]">التشغيلة / الصلاحية</th>
                      <th className="py-3 px-3 min-w-[120px]">ملاحظات الصنف</th>
                      <th className="py-3 px-3 w-12 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {items.map((item, idx) => {
                      const avail = item.source_available_qty ?? (sourceStock[item.ingredient_id]?.available ?? 0);
                      const isOverStock = Number(item.requested_qty) > avail;
                      const lineTotal = Number(item.requested_qty || 0) * Number(item.unit_cost || 0);

                      return (
                        <tr 
                          key={`item-row-${item.ingredient_id ?? idx}-${idx}`} 
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                            isOverStock ? "bg-amber-500/10 dark:bg-amber-500/15" : ""
                          }`}
                        >
                          {/* Index */}
                          <td className="py-3 px-3 text-center text-slate-400 font-mono font-bold">
                            {idx + 1}
                          </td>

                          {/* Ingredient Select */}
                          <td className="py-3 px-4">
                            <div className="relative">
                              <select
                                value={item.ingredient_id}
                                onChange={(e) => handleItemChange(idx, "ingredient_id", Number(e.target.value))}
                                className="w-full h-9 px-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              >
                                {ingredients.map((ing, ingIdx) => (
                                  <option key={`ing-opt-${idx}-${ing.id ?? ingIdx}-${ingIdx}`} value={ing.id}>
                                    {ing.name} ({ing.code})
                                  </option>
                                ))}
                              </select>
                            </div>
                            {item.barcode && (
                              <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400 font-mono">
                                <Barcode className="w-3 h-3 opacity-80" />
                                <span>{item.barcode}</span>
                              </div>
                            )}
                          </td>

                          {/* Available in Source */}
                          <td className="py-3 px-3 text-center">
                            <span className={`inline-flex items-center justify-center min-w-[3.5rem] px-2.5 py-1 rounded-lg font-mono font-bold text-xs ${
                              avail <= 0
                                ? "bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-400 border border-red-200 dark:border-red-800"
                                : avail < 10
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                            }`}>
                              {avail.toLocaleString("ar-EG")}
                            </span>
                          </td>

                          {/* Requested Qty */}
                          <td className="py-3 px-3 text-center">
                            <div className="space-y-1">
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                value={item.requested_qty}
                                onChange={(e) => handleItemChange(idx, "requested_qty", parseFloat(e.target.value) || 0)}
                                className={`w-full h-9 px-2 text-center bg-white dark:bg-slate-900 border rounded-lg text-sm font-black font-mono transition-all focus:outline-none focus:ring-2 ${
                                  isOverStock 
                                    ? "border-amber-500 text-amber-700 dark:text-amber-400 focus:ring-amber-500/30 bg-amber-50 dark:bg-amber-950/30" 
                                    : "border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-blue-500/20 focus:border-blue-500"
                                }`}
                              />
                              {isOverStock && (
                                <p className="text-[9px] text-amber-600 dark:text-amber-400 font-bold whitespace-nowrap">
                                  تجاوز المتاح ({avail})
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Unit */}
                          <td className="py-3 px-3 text-center text-slate-600 dark:text-slate-400 font-medium">
                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md text-[11px] font-bold">
                              {item.unit || "قطعة"}
                            </span>
                          </td>

                          {/* Unit Cost */}
                          <td className="py-3 px-3 text-center">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unit_cost}
                              onChange={(e) => handleItemChange(idx, "unit_cost", parseFloat(e.target.value) || 0)}
                              className="w-full h-8 px-2 text-center bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                            />
                          </td>

                          {/* Line Total */}
                          <td className="py-3 px-3 text-center">
                            <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                              {lineTotal.toLocaleString("ar-EG", { minimumFractionDigits: 2 })}
                            </span>
                          </td>

                          {/* Batch / Expiry */}
                          <td className="py-3 px-3">
                            <div className="flex flex-col gap-1">
                              <input
                                type="text"
                                placeholder="رقم التشغيلة / الباتش"
                                value={item.batch_number || ""}
                                onChange={(e) => handleItemChange(idx, "batch_number", e.target.value)}
                                className="w-full h-7 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-[10px] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <input
                                type="date"
                                value={item.expiry_date || ""}
                                onChange={(e) => handleItemChange(idx, "expiry_date", e.target.value || null)}
                                className="w-full h-7 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-[10px] text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                              />
                            </div>
                          </td>

                          {/* Notes */}
                          <td className="py-3 px-3">
                            <textarea
                              placeholder="ملاحظات الصنف..."
                              value={item.notes || ""}
                              onChange={(e) => handleItemChange(idx, "notes", e.target.value)}
                              rows={2}
                              className="w-full py-1 px-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-[10px] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none leading-tight"
                            />
                          </td>

                          {/* Delete Action */}
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="w-8 h-8 flex items-center justify-center mx-auto text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                              title="إزالة هذا الصنف من التحويل"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Table Summary Footer */}
            <div className="flex flex-wrap items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 gap-3">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs font-bold text-slate-600 dark:text-slate-300">
                  <span>إجمالي الأصناف:</span>
                  <span className="text-slate-900 dark:text-white font-black">{items.length}</span>
                </div>
                
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs font-bold text-slate-600 dark:text-slate-300">
                  <span>إجمالي الكميات:</span>
                  <span className="text-blue-600 dark:text-blue-400 font-mono font-black text-sm">{totalQty.toLocaleString("ar-EG")}</span>
                </div>

                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs font-bold text-slate-600 dark:text-slate-300">
                  <span>القيمة التقديرية:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono font-black text-sm">
                    {totalValue.toLocaleString("ar-EG", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-slate-400">ر.س</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleAddItem()}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold cursor-pointer transition-colors"
              >
                + إضافة صنف إضافي
              </button>
            </div>
          </div>

          {/* Logistics & Shipping Section */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/70 shadow-xs">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
              <Truck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">بيانات الشحن والنقل الأولية والملاحظات</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  اسم السائق / الناقل
                </label>
                <input
                  type="text"
                  id="create-driver"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="مثال: أحمد محمود"
                  className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  رقم لوحة الشاحنة / المركبة
                </label>
                <input
                  type="text"
                  id="create-vehicle"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                  placeholder="مثال: أ ب ج 1234"
                  className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  تكلفة الشحن التقديرية (ر.س)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  id="create-shipping-cost"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                  className="w-full h-9 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            {/* General Notes */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                ملاحظات عامة وتوجيهات خاصة
              </label>
              <textarea
                rows={2}
                id="create-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أضف أي تعليمات للنقل أو شروط خاصة بالتفريغ والتخزين..."
                className="w-full py-2.5 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex flex-col items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 gap-3 shrink-0">
          {submitError && (
            <div role="alert" className="w-full basis-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-right text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {submitError}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 w-full">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-5 py-2.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              إلغاء
            </button>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                id="btn-save-draft"
                onClick={() => handleSave("draft")}
                disabled={isSubmitting}
                className="flex-1 sm:flex-none px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 hover:border-blue-400"
              >
                حفظ كمسودة
              </button>

              <button
                type="button"
                id="btn-submit-request"
                onClick={() => handleSave("approved")}
                disabled={isSubmitting}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50 hover:scale-[1.02] active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>{isSubmitting ? "جاري الترحيل..." : "تقديم وتحويل معتمد"}</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
