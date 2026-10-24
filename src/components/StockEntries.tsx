import React, { useState, useEffect } from "react";
import { Plus, Search, XCircle, ArrowRightLeft } from "lucide-react";
import { api } from "../utils/api";
import { SearchableSelect } from "./SearchableSelect";

export function StockEntries() {
  const [entries, setEntries] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);

  const [formData, setFormData] = useState({
    type: "Material Transfer",
    from_warehouse_id: "",
    to_warehouse_id: "",
    notes: "",
  });

  const [items, setItems] = useState<any[]>([]);

  // Source documents list for Material Receipt
  const [purchases, setPurchases] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [transferRequests, setTransferRequests] = useState<any[]>([]);
  const [sourceType, setSourceType] = useState<string>(""); // "", "purchase", "purchase_order", "transfer_request"
  const [sourceId, setSourceId] = useState<string>("");

  const entryTypes = [
    { id: "Material Receipt", name: "استلام مواد" },
    { id: "Material Issue", name: "صرف مواد" },
    { id: "Material Transfer", name: "نقل مواد" },
    { id: "Repack", name: "إعادة حزم / تجميع" },
    { id: "Manufacture", name: "صناعة" },
  ];

  useEffect(() => {
    fetchEntries();
    fetchWarehouses();
    fetchIngredients();
  }, []);

  const fetchPurchases = async () => {
    try {
      const res = await api.get("/api/purchases");
      if (res.ok) setPurchases(await res.json());
    } catch (e) {}
  };

  const fetchPurchaseOrders = async () => {
    try {
      const res = await api.get("/api/purchase-orders");
      if (res.ok) setPurchaseOrders(await res.json());
    } catch (e) {}
  };

  const fetchTransferRequests = async () => {
    try {
      const res = await api.get("/api/inventory/requests");
      if (res.ok) setTransferRequests(await res.json());
    } catch (e) {}
  };

  useEffect(() => {
    if (showModal) {
      fetchPurchases();
      fetchPurchaseOrders();
      fetchTransferRequests();
    }
  }, [showModal]);

  const handleSourceSelect = async (type: string, id: string) => {
    if (!id) return;
    try {
      if (type === "purchase") {
        const res = await api.get(`/api/purchases/${id}`);
        if (res.ok) {
          const data = await res.json();
          setFormData((prev) => ({
            ...prev,
            to_warehouse_id: data.warehouse_id ? data.warehouse_id.toString() : prev.to_warehouse_id,
            notes: `استلام مواد بناءً على فاتورة المشتريات رقم #${data.id} (فاتورة: ${data.invoice_number || "-"}) - المورد: ${data.supplier_name}`,
          }));
          
          if (data.items && Array.isArray(data.items)) {
            const mappedItems = data.items.map((it: any) => ({
              ingredient_id: it.ingredient_id,
              name: it.ingredient_name,
              unit: it.unit,
              quantity: parseFloat(it.quantity) || 0,
              unit_price: parseFloat(it.unit_price) || 0,
              from_warehouse_id: "",
              to_warehouse_id: data.warehouse_id ? data.warehouse_id.toString() : formData.to_warehouse_id,
            }));
            setItems(mappedItems);
          }
        }
      } else if (type === "purchase_order") {
        const res = await api.get(`/api/purchase-orders/${id}`);
        if (res.ok) {
          const data = await res.json();
          setFormData((prev) => ({
            ...prev,
            notes: `استلام مواد بناءً على أمر الشراء رقم #${data.id} - المورد: ${data.supplier_name || "-"}`,
          }));
          
          if (data.items && Array.isArray(data.items)) {
            const mappedItems = data.items.map((it: any) => ({
              ingredient_id: it.ingredient_id,
              name: it.ingredient_name,
              unit: it.unit,
              quantity: parseFloat(it.quantity) || 0,
              unit_price: parseFloat(it.price || it.unit_price) || 0,
              from_warehouse_id: "",
              to_warehouse_id: formData.to_warehouse_id,
            }));
            setItems(mappedItems);
          }
        }
      } else if (type === "transfer_request") {
        const res = await api.get(`/api/inventory/requests/${id}`);
        if (res.ok) {
          const data = await res.json();
          setFormData((prev) => ({
            ...prev,
            from_warehouse_id: data.from_warehouse_id ? data.from_warehouse_id.toString() : prev.from_warehouse_id,
            to_warehouse_id: data.to_warehouse_id ? data.to_warehouse_id.toString() : prev.to_warehouse_id,
            notes: `استلام مواد بناءً على طلب التحويل رقم #${data.id} - من مستودع: ${data.from_warehouse_name} إلى: ${data.to_warehouse_name}`,
          }));
          
          if (data.items && Array.isArray(data.items)) {
            const mappedItems = data.items.map((it: any) => ({
              ingredient_id: it.ingredient_id,
              name: it.ingredient_name,
              unit: it.unit,
              quantity: parseFloat(it.quantity) || 0,
              unit_price: parseFloat(it.cost || it.unit_price) || 0,
              from_warehouse_id: data.from_warehouse_id ? data.from_warehouse_id.toString() : "",
              to_warehouse_id: data.to_warehouse_id ? data.to_warehouse_id.toString() : "",
            }));
            setItems(mappedItems);
          }
        }
      }
    } catch (error) {
      console.error("Error loading source document details:", error);
    }
  };

  const fetchEntries = async () => {
    try {
      const res = await api.get("/api/inventory/stock-entries");
      if (res.ok) setEntries(await res.json());
    } catch (e) {}
  };

  const fetchEntryDetails = async (id: number) => {
    try {
      const res = await api.get(`/api/inventory/stock-entries/${id}`);
      if (res.ok) setSelectedEntry(await res.json());
    } catch (e) {}
  };

  const fetchWarehouses = async () => {
    try {
      const res = await api.get("/api/inventory/warehouses");
      if (res.ok) setWarehouses(await res.json());
    } catch (e) {}
  };

  const fetchIngredients = async () => {
    try {
      const res = await api.get("/api/ingredients");
      if (res.ok) setIngredients(await res.json());
    } catch (e) {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      alert("الرجاء إضافة صنف واحد على الأقل للجدول.");
      return;
    }
    try {
      const res = await api.post("/api/inventory/stock-entries", {
        ...formData,
        items,
      });
      if (res.ok) {
        setShowModal(false);
        fetchEntries();
        setFormData({
          type: "Material Transfer",
          from_warehouse_id: "",
          to_warehouse_id: "",
          notes: "",
        });
        setSourceType("");
        setSourceId("");
        setItems([]);
        alert("تم إنشاء قيد المخزون بنجاح!");
      } else {
        const errorData = await res.json();
        alert("فشل إنشاء القيد: " + (errorData.error || "خطأ غير معروف"));
      }
    } catch (err: any) {
      console.error(err);
      alert("حدث خطأ أثناء الاتصال بالخادم وحفظ القيد: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ArrowRightLeft className="w-6 h-6 text-amber-500" />
            قيود المخزون (Stock Entries)
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            تتبع وتسجيل جميع حركات النقل والاستلام والصرف وإعادة الحزم
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          إضافة قيد مخزون
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-4 font-bold text-slate-600">رقم القيد</th>
              <th className="p-4 font-bold text-slate-600">النوع</th>
              <th className="p-4 font-bold text-slate-600">التاريخ</th>
              <th className="p-4 font-bold text-slate-600">من مستودع</th>
              <th className="p-4 font-bold text-slate-600">إلى مستودع</th>
              <th className="p-4 font-bold text-slate-600">الإجمالي</th>
              <th className="p-4 font-bold text-slate-600">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-slate-50">
                <td className="p-4 font-mono font-bold text-slate-700">
                  STE-{entry.id.toString().padStart(4, "0")}
                </td>
                <td className="p-4">
                  <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg font-bold text-xs">
                    {entryTypes.find((t) => t.id === entry.type)?.name ||
                      entry.type}
                  </span>
                </td>
                <td className="p-4 text-slate-600">
                  {new Date((entry.date) || 0).toLocaleString("ar-EG")}
                </td>
                <td className="p-4 font-bold text-slate-800">
                  {entry.from_warehouse_name || "-"}
                </td>
                <td className="p-4 font-bold text-slate-800">
                  {entry.to_warehouse_name || "-"}
                </td>
                <td className="p-4 text-emerald-600 font-bold">
                  {Number(entry.total_value || 0 || 0).toLocaleString()} ج.م
                </td>
                <td className="p-4">
                  <button
                    onClick={() => fetchEntryDetails(entry.id)}
                    className="text-blue-600 hover:text-blue-800 font-bold text-xs"
                  >
                    التفاصيل
                  </button>
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  لا توجد قيود مخزون.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-8">
          <div className="bg-white rounded-2xl w-full h-full max-w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-6rem)] xl:max-w-7xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 sm:rounded-t-2xl">
              <h2 className="text-xl font-bold text-slate-800">
                قيد مخزون جديد
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setSourceType("");
                  setSourceId("");
                  setItems([]);
                  setFormData({
                    type: "Material Transfer",
                    from_warehouse_id: "",
                    to_warehouse_id: "",
                    notes: "",
                  });
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    نوع إدخال الأسهم
                  </label>
                  <select
                    className="w-full p-3 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
                    value={formData.type}
                    onChange={(e) => {
                      const newType = e.target.value;
                      setFormData({
                        type: newType,
                        from_warehouse_id: "",
                        to_warehouse_id: "",
                        notes: "",
                      });
                      setSourceType("");
                      setSourceId("");
                      setItems([]);
                    }}
                  >
                    {entryTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.id})
                      </option>
                    ))}
                  </select>
                </div>

                {[
                  "Material Transfer",
                  "Material Issue",
                  "Repack",
                  "Manufacture",
                ].includes(formData.type) && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      المستودع المصدر الافتراضي
                    </label>
                    <select
                      className="w-full p-3 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
                      value={formData.from_warehouse_id}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          from_warehouse_id: e.target.value,
                        })
                      }
                    >
                      <option value="">اختر...</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {[
                  "Material Transfer",
                  "Material Receipt",
                  "Repack",
                  "Manufacture",
                ].includes(formData.type) && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      المخزن الوجهة الافتراضي
                    </label>
                    <select
                      className="w-full p-3 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
                      value={formData.to_warehouse_id}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          to_warehouse_id: e.target.value,
                        })
                      }
                    >
                      <option value="">اختر...</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {formData.type === "Material Receipt" && (
                <div className="col-span-full border-2 border-dashed border-amber-200 bg-amber-50/40 p-5 rounded-2xl space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <h4 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                        ربط استلام المواد بمستند مصدر (مشتريات أو تحويل)
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        قم باختيار المستند المصدر ليتم تحميل الأصناف والكميات والأسعار تلقائياً دون إدخالها يدوياً
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">
                        نوع المستند المصدر
                      </label>
                      <select
                        value={sourceType}
                        onChange={(e) => {
                          setSourceType(e.target.value);
                          setSourceId("");
                        }}
                        className="w-full p-3 bg-white border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="">-- استلام يدوي مباشر (بدون ربط بمستند) --</option>
                        <option value="purchase">فاتورة مشتريات (Purchase Invoice)</option>
                        <option value="purchase_order">أمر شراء معتمد (Purchase Order)</option>
                        <option value="transfer_request">طلب تحويل مخزني (Transfer Order)</option>
                      </select>
                    </div>
                    
                    {sourceType && (
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">
                          اختر المستند المحدد لتعبئة الأصناف
                        </label>
                        {sourceType === "purchase" && (
                          <SearchableSelect
                            options={purchases.map(p => ({
                              id: p.id,
                              label: `شراء #${p.id} - ${p.supplier_name} - فاتورة: ${p.invoice_number || "-"} - ${new Date(p.date).toLocaleDateString("ar-EG")}`,
                              id_str: p.id.toString(),
                              supplier_name: p.supplier_name,
                              invoice_number: p.invoice_number || "-",
                            }))}
                            value={sourceId}
                            onChange={(val) => {
                              setSourceId(val.toString());
                              handleSourceSelect("purchase", val.toString());
                            }}
                            placeholder="ابحث برقم الفاتورة أو اسم المورد..."
                            searchKeys={["id_str", "supplier_name", "invoice_number"]}
                            labelKey="label"
                          />
                        )}
                        {sourceType === "purchase_order" && (
                          <SearchableSelect
                            options={purchaseOrders.map(po => ({
                              id: po.id,
                              label: `أمر شراء #${po.id} - ${po.supplier_name} - ${new Date(po.date).toLocaleDateString("ar-EG")}`,
                              id_str: po.id.toString(),
                              supplier_name: po.supplier_name || "",
                            }))}
                            value={sourceId}
                            onChange={(val) => {
                              setSourceId(val.toString());
                              handleSourceSelect("purchase_order", val.toString());
                            }}
                            placeholder="ابحث برقم أمر الشراء أو المورد..."
                            searchKeys={["id_str", "supplier_name"]}
                            labelKey="label"
                          />
                        )}
                        {sourceType === "transfer_request" && (
                          <SearchableSelect
                            options={transferRequests.map(tr => ({
                              id: tr.id,
                              label: `تحويل #${tr.id} - من: ${tr.from_warehouse_name} إلى: ${tr.to_warehouse_name} (${tr.status})`,
                              id_str: tr.id.toString(),
                              from_warehouse_name: tr.from_warehouse_name,
                              to_warehouse_name: tr.to_warehouse_name,
                            }))}
                            value={sourceId}
                            onChange={(val) => {
                              setSourceId(val.toString());
                              handleSourceSelect("transfer_request", val.toString());
                            }}
                            placeholder="ابحث برقم طلب التحويل أو اسم المستودع..."
                            searchKeys={["id_str", "from_warehouse_name", "to_warehouse_name"]}
                            labelKey="label"
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-4">
                <label className="block text-sm font-bold text-slate-700 mb-3 text-lg flex items-center gap-2">
                  <Search className="w-5 h-5 text-emerald-500" />
                  إضافة صنف للجدول
                </label>
                <SearchableSelect
                  options={ingredients.map((i) => ({
                    id: i.id,
                    label: i.name,
                    item_code: i.item_code || "-",
                    unit: i.unit,
                    cost: i.cost,
                  }))}
                  value=""
                  onChange={(val) => {
                    if (val) {
                      const ing = ingredients.find((i) => i.id === Number(val));
                      if (ing) {
                        setItems([
                          ...items,
                          {
                            ingredient_id: ing.id,
                            name: ing.name,
                            unit: ing.unit,
                            quantity: 1,
                            unit_price: ing.cost || 0,
                            from_warehouse_id: formData.from_warehouse_id,
                            to_warehouse_id: formData.to_warehouse_id,
                          },
                        ]);
                      }
                    }
                  }}
                  placeholder="ابحث بالاسم أو الباركود..."
                  searchKeys={["label", "item_code"]}
                  labelKey="label"
                  columns={[
                    { key: "item_code", title: "كود / باركود" },
                    { key: "label", title: "الاسم" },
                    { key: "unit", title: "الوحدة" },
                  ]}
                />
              </div>

              {items.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="p-3">الصنف</th>
                        <th className="p-3">الكمية</th>
                        {formData.type === "Repack" && (
                          <th className="p-3">المصدر</th>
                        )}
                        {formData.type === "Repack" && (
                          <th className="p-3">الوجهة</th>
                        )}
                        <th className="p-3">التكلفة</th>
                        <th className="p-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="p-3 font-bold">
                            {item.name}{" "}
                            <span className="text-xs text-slate-400">
                              ({item.unit})
                            </span>
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              value={item.quantity}
                              onChange={(e) => {
                                const newItems = [...items];
                                newItems[idx].quantity =
                                  parseFloat(e.target.value) || 0;
                                setItems(newItems);
                              }}
                              className="w-24 p-2 border border-slate-200 rounded-lg text-center"
                            />
                          </td>
                          {formData.type === "Repack" && (
                            <td className="p-3">
                              <select
                                value={item.from_warehouse_id}
                                onChange={(e) => {
                                  const newItems = [...items];
                                  newItems[idx].from_warehouse_id =
                                    e.target.value;
                                  setItems(newItems);
                                }}
                                className="w-28 p-1 text-xs border border-slate-200 rounded-lg"
                              >
                                <option value="">-</option>
                                {warehouses.map((w) => (
                                  <option key={w.id} value={w.id}>
                                    {w.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                          )}
                          {formData.type === "Repack" && (
                            <td className="p-3">
                              <select
                                value={item.to_warehouse_id}
                                onChange={(e) => {
                                  const newItems = [...items];
                                  newItems[idx].to_warehouse_id =
                                    e.target.value;
                                  setItems(newItems);
                                }}
                                className="w-28 p-1 text-xs border border-slate-200 rounded-lg"
                              >
                                <option value="">-</option>
                                {warehouses.map((w) => (
                                  <option key={w.id} value={w.id}>
                                    {w.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                          )}
                          <td className="p-3 text-emerald-600 font-bold">
                            {Number(item.quantity * item.unit_price || 0).toLocaleString()}{" "}
                            ج.م
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() =>
                                setItems(items.filter((_, i) => i !== idx))
                              }
                              className="text-rose-500"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="pt-2">
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  ملاحظات ومرجع القيد (Notes & Remarks)
                </label>
                <textarea
                  className="w-full p-3.5 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-sm font-medium"
                  rows={2}
                  placeholder="اكتب تفاصيل القيد، سبب التعديل، أو أي مرجع يدوي..."
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-4 rounded-b-2xl bg-white">
              <button
                onClick={() => {
                  setShowModal(false);
                  setSourceType("");
                  setSourceId("");
                  setItems([]);
                  setFormData({
                    type: "Material Transfer",
                    from_warehouse_id: "",
                    to_warehouse_id: "",
                    notes: "",
                  });
                }}
                className="px-6 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
              >
                إلغاء
              </button>
              <button
                onClick={handleSubmit}
                disabled={items.length === 0}
                className="px-6 py-2 bg-amber-500 text-white font-bold rounded-xl disabled:opacity-50"
              >
                إنشاء قيد
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedEntry && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">
                تفاصيل القيد #{selectedEntry.id}
              </h2>
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-sm text-slate-500">النوع</span>
                  <span className="font-bold text-slate-800">
                    {entryTypes.find((t) => t.id === selectedEntry.type)
                      ?.name || selectedEntry.type}
                  </span>
                </div>
                <div>
                  <span className="block text-sm text-slate-500">التاريخ</span>
                  <span className="font-bold text-slate-800">
                    {new Date((selectedEntry.date) || 0).toLocaleString("ar-EG")}
                  </span>
                </div>
                <div>
                  <span className="block text-sm text-slate-500">
                    من مستودع
                  </span>
                  <span className="font-bold text-slate-800">
                    {selectedEntry.from_warehouse_name || "-"}
                  </span>
                </div>
                <div>
                  <span className="block text-sm text-slate-500">
                    إلى مستودع
                  </span>
                  <span className="font-bold text-slate-800">
                    {selectedEntry.to_warehouse_name || "-"}
                  </span>
                </div>
              </div>

              {selectedEntry.notes && (
                <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/60 col-span-2">
                  <span className="block text-xs font-bold text-amber-800 mb-1">ملاحظات ومرجع قيد المخزون</span>
                  <p className="text-sm font-medium text-slate-700">{selectedEntry.notes}</p>
                </div>
              )}

              <div>
                <h3 className="font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">
                  الأصناف المشمولة
                </h3>
                <table className="w-full text-right text-sm">
                  <thead>
                    <tr className="text-slate-500">
                      <th className="pb-2">الصنف</th>
                      <th className="pb-2 text-center">الكمية</th>
                      <th className="pb-2 text-left">التكلفة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(selectedEntry?.items) ? selectedEntry.items : (typeof selectedEntry?.items === 'string' ? JSON.parse(selectedEntry.items || '[]') : [])).map((item: any) => (
                      <tr key={item.id}>
                        <td className="py-2 font-bold">
                          {item.ingredient_name}
                        </td>
                        <td className="py-2 text-center">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="py-2 text-left text-emerald-600 font-bold">
                          {item.total_price} ج.م
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
