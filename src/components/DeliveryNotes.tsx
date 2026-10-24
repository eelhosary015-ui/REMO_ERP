import React, { useState, useEffect } from "react";
import { Plus, Search, XCircle, Truck, FileText } from "lucide-react";
import { api } from "../utils/api";

export function DeliveryNotes() {
  const [notes, setNotes] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedNote, setSelectedNote] = useState<any>(null);

  const [formData, setFormData] = useState({
    sales_order_id: "",
    customer_name: "",
    warehouse_id: "",
    notes: "",
  });
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    fetchDeliveryNotes();
    fetchSalesOrders();
    fetchWarehouses();
  }, []);

  const fetchDeliveryNotes = async () => {
    try {
      const res = await api.get("/api/inventory/delivery-notes");
      if (res.ok) setNotes(await res.json());
    } catch (e) {}
  };

  const fetchNoteDetails = async (id: number) => {
    try {
      const res = await api.get(`/api/inventory/delivery-notes/${id}`);
      if (res.ok) setSelectedNote(await res.json());
    } catch (e) {}
  };

  const fetchSalesOrders = async () => {
    // Only get orders that are confirmed and need delivery
    try {
      const res = await api.get("/api/inventory/sales-orders");
      if (res.ok) {
        const data = await res.json();
        // Return only orders not fully delivered
        setOrders(data.filter((o: any) => o.status !== "delivered"));
      }
    } catch (e) {}
  };

  const fetchWarehouses = async () => {
    try {
      const res = await api.get("/api/inventory/warehouses");
      if (res.ok) setWarehouses(await res.json());
    } catch (e) {}
  };

  const fetchOrderDetails = async (id: number) => {
    try {
      const res = await api.get(`/api/inventory/sales-orders/${id}`);
      if (res.ok) {
        const orderData = await res.json();
        setFormData({
          ...formData,
          sales_order_id: id.toString(),
          customer_name: orderData.customer_name || "عميل نقدي",
        });
        setItems(
          orderData.items
            .map((i: any) => ({
              ingredient_id: i.ingredient_id,
              name: i.ingredient_name,
              quantity: i.quantity - (i.delivered_quantity || 0), // available to deliver
              price: i.unit_price || 0,
              unit: i.unit || "وحدة",
            }))
            .filter((i: any) => i.quantity > 0),
        ); // Only items that still need delivery
      }
    } catch (e) {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0 || !formData.warehouse_id) return;
    try {
      const res = await api.post("/api/inventory/delivery-notes", {
        ...formData,
        items,
      });
      if (res.ok) {
        setShowModal(false);
        fetchDeliveryNotes();
        setFormData({
          sales_order_id: "",
          customer_name: "",
          warehouse_id: "",
          notes: "",
        });
        setItems([]);
      }
    } catch (e) {}
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Truck className="w-6 h-6 text-emerald-500" />
            إشعارات التسليم (Delivery Notes)
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            تتبع تسليم البضائع للعملاء وخصمها من المستودع
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          إضافة إشعار تسليم
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-4 font-bold text-slate-600">رقم الإشعار</th>
              <th className="p-4 font-bold text-slate-600">التاريخ</th>
              <th className="p-4 font-bold text-slate-600">العميل</th>
              <th className="p-4 font-bold text-slate-600">المستودع</th>
              <th className="p-4 font-bold text-slate-600">الحالة</th>
              <th className="p-4 font-bold text-slate-600">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {notes.map((note) => (
              <tr key={note.id} className="hover:bg-slate-50">
                <td className="p-4 font-mono font-bold text-slate-700">
                  {note.delivery_note_no}
                </td>
                <td className="p-4 text-slate-600">
                  {new Date((note.created_at) || 0).toLocaleString("ar-EG")}
                </td>
                <td className="p-4 font-bold text-slate-800">
                  {note.customer_name}
                </td>
                <td className="p-4 text-slate-600">{note.warehouse_name}</td>
                <td className="p-4">
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold">
                    مكتمل
                  </span>
                </td>
                <td className="p-4">
                  <button
                    onClick={() => fetchNoteDetails(note.id)}
                    className="text-blue-600 font-bold hover:text-blue-800 text-xs"
                  >
                    التفاصيل
                  </button>
                </td>
              </tr>
            ))}
            {notes.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  لا توجد إشعارات تسليم.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-500" />
                إشعار تسليم جديد
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      الحصول على البنود من (طلب مبيعات)
                    </label>
                    <select
                      className="w-full p-3 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                      onChange={(e) => {
                        if (e.target.value) {
                          fetchOrderDetails(parseInt(e.target.value));
                        }
                      }}
                    >
                      <option value="">اختر طلب المبيعات...</option>
                      {orders.map((o) => (
                        <option key={o.id} value={o.id}>
                          طلب #{o.order_no} ({o.customer_name})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      العميل
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.customer_name ?? ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          customer_name: e.target.value,
                        })
                      }
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                      placeholder="اسم العميل"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      تعيين المخزن المصدر
                    </label>
                    <select
                      required
                      value={formData.warehouse_id ?? ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          warehouse_id: e.target.value,
                        })
                      }
                      className="w-full p-3 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">اختر المخزن...</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 p-4 border-b border-slate-200">
                    <h3 className="font-bold text-slate-800">
                      ملاحظة تسليم السلعة
                    </h3>
                  </div>
                  {items.length > 0 && (
                    <table className="w-full text-right text-sm">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="p-3">رمز السلعة</th>
                          <th className="p-3">الكمية</th>
                          <th className="p-3">وحدة القياس</th>
                          <th className="p-3">السعر</th>
                          <th className="p-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="p-3 font-bold">{item.name}</td>
                            <td className="p-3">
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                value={item.quantity ?? ""}
                                onChange={(e) => {
                                  const newItems = [...items];
                                  newItems[idx].quantity =
                                    parseFloat(e.target.value) || 0;
                                  setItems(newItems);
                                }}
                                className="w-24 p-2 border border-slate-200 rounded-lg text-center outline-none"
                              />
                            </td>
                            <td className="p-3 text-slate-500">{item.unit}</td>
                            <td className="p-3 font-bold text-slate-700">
                              {Number(item.price || 0 || 0).toLocaleString()} ج.م
                            </td>
                            <td className="p-3">
                              <button
                                type="button"
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
                  )}
                  {items.length === 0 && (
                    <div className="p-6 text-center text-slate-500">
                      لم يتم سحب أي منتجات. الرجاء اختيار طلب مبيعات.
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 flex justify-end gap-3 rounded-b-2xl bg-white mt-auto">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={items.length === 0 || !formData.warehouse_id}
                  className="px-6 py-2 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 disabled:opacity-50"
                >
                  حفظ وتسليم
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedNote && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                <FileText className="w-5 h-5 text-emerald-500" />
                تفاصيل إشعار التسليم {selectedNote.delivery_note_no}
              </h2>
              <button
                onClick={() => setSelectedNote(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-sm text-slate-500">
                    اسم العميل
                  </span>
                  <span className="font-bold text-slate-800">
                    {selectedNote.customer_name}
                  </span>
                </div>
                <div>
                  <span className="block text-sm text-slate-500">التاريخ</span>
                  <span className="font-bold text-slate-800">
                    {new Date((selectedNote.created_at) || 0).toLocaleString("ar-EG")}
                  </span>
                </div>
                <div>
                  <span className="block text-sm text-slate-500">المستودع</span>
                  <span className="font-bold text-slate-800">
                    {selectedNote.warehouse_name}
                  </span>
                </div>
                {selectedNote.sales_order_id && (
                  <div>
                    <span className="block text-sm text-slate-500">
                      رقم طلب المبيعات
                    </span>
                    <span className="font-bold text-slate-800">
                      #{selectedNote.sales_order_id}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">
                  تفاصيل הסلع
                </h3>
                <table className="w-full text-right text-sm">
                  <thead className="text-slate-500 font-bold">
                    <tr>
                      <th className="pb-2">الصنف</th>
                      <th className="pb-2 text-center">الكمية</th>
                      <th className="pb-2">السعر</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(selectedNote.items) ? selectedNote.items : (typeof selectedNote.items === 'string' ? JSON.parse(selectedNote.items || '[]') : [])).map((item: any, idx: number) => (
                      <tr key={idx} className="border-t border-slate-50">
                        <td className="py-2 text-slate-800 font-bold">
                          {item.ingredient_name}
                        </td>
                        <td className="py-2 text-center text-slate-600">
                          {item.quantity}
                        </td>
                        <td className="py-2 text-slate-800">
                          {Number(item.price || 0 || 0).toLocaleString()} ج.م
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
