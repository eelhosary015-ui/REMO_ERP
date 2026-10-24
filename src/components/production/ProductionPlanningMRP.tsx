import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, Plus, AlertTriangle, ArrowRight, CheckCircle, X, Sparkles, AlertCircle, RefreshCw, BarChart2, CheckSquare } from 'lucide-react';

interface MRPRequest {
  id: string;
  productName: string;
  requiredQty: number;
  availableQty: number;
  deficit: number;
  dueDate: string;
  status: 'planned' | 'ordered' | 'fulfilled';
}

const MOCK_MRP: MRPRequest[] = [];

export function ProductionPlanningMRP() {
  const [requests, setRequests] = useState<MRPRequest[]>(() => {
    const saved = localStorage.getItem('remo_production_mrp');
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(r => r && !['لوح خشب زان 2م', 'مسامير صلب 5سم'].includes(r.productName));
        }
      } catch (e) { 
        console.error('Failed to parse from local storage'); 
      }
    }
    return [];
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRequest, setNewRequest] = useState<Partial<MRPRequest>>({
    productName: '', requiredQty: 1, availableQty: 0, dueDate: '', status: 'planned'
  });

  // Forecasting temporary variables
  const [forecastHistSales, setForecastHistSales] = useState(0); 
  const [forecastGrowth, setForecastGrowth] = useState(0); // percentage
  const [forecastSeason, setForecastSeason] = useState(1.0); // High peak factor
  const [forecastProductCode, setForecastProductCode] = useState('');

  // Load products for dropdown
  const [productsList] = useState<any[]>(() => {
    const saved = localStorage.getItem('remo_production_products');
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(p => p && !['FIN-500', 'SFP-102', 'RAW-001'].includes(p.code));
        }
      } catch (e) {}
    }
    return [];
  });

  // Load workcenters for capacity loading
  const [workCenters, setWorkCenters] = useState<any[]>(() => {
    const saved = localStorage.getItem('remo_production_workcenters');
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(c => c && !['MC-101', 'LN-001'].includes(c.code));
        }
      } catch (e) {}
    }
    return [];
  });

  // Trigger Master schedule order generation
  const handleGenerateOrdersFromForecast = () => {
    const calculatedTarget = Math.round(forecastHistSales * (1 + forecastGrowth / 100) * forecastSeason);
    const matchedProduct = productsList.find(p => p.code === forecastProductCode) || productsList[0];
    
    // Save to orders list
    const savedOrdersString = localStorage.getItem('remo_production_orders');
    let existingOrdersCount = 4;
    let existingOrders: any[] = [];
    if (savedOrdersString) {
      try {
        const parsed = JSON.parse(savedOrdersString);
        if (Array.isArray(parsed)) {
          existingOrders = parsed;
          existingOrdersCount = parsed.length;
        }
      } catch (e) {}
    }

    const todayStr = new Date().toISOString().substring(0, 10);
    const futureDateStr = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().substring(0, 10);
    
    const countOffset = existingOrdersCount + 1;
    const generatedOrder = {
      id: `ord-gen-${Date.now()}`,
      orderNumber: `PRD-2026-0${countOffset > 9 ? countOffset : '0' + countOffset}`,
      productId: matchedProduct.code,
      quantity: calculatedTarget,
      bomId: 'b1',
      startDate: todayStr,
      endDate: futureDateStr,
      priority: calculatedTarget > 2000 ? 'high' : 'normal',
      status: 'planned', // generated as planned stage automatically
      progress: 0,
       lotNumber: `LOT-2026-0${countOffset}`,
      notes: `أمر إنتاج مولد آلياً بناء على خوارزمية التنبؤ بالطلب (Demand Forecast Auto-Plan). نسبة نمو متوقعة ${forecastGrowth}%.`,
      supervisor: 'عامل الذكاء الاصطناعي للتنبؤ'
    };

    const newOrders = [...existingOrders, generatedOrder];
    localStorage.setItem('remo_production_orders', JSON.stringify(newOrders));
    alert(`💡 تم بنجاح تشغيل خوارزمية التنبؤ وإنشاء أمر الإنتاج المجدول رقم: ${generatedOrder.orderNumber} بكمية مستهدفة ${calculatedTarget} ${matchedProduct.name}. يرجى التوجه لعلامة "أوامر الإنتاج" لتأكيده وإرساله للتشغيل!`);
  };

  const handleAddRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRequest.productName) return;

    const deficit = Math.max(0, (newRequest.requiredQty || 0) - (newRequest.availableQty || 0));

    const added: MRPRequest = {
      ...(newRequest as MRPRequest),
      id: Date.now().toString(),
      deficit
    };

    const updated = [...requests, added];
    setRequests(updated);
    localStorage.setItem('remo_production_mrp', JSON.stringify(updated));
    
    setIsModalOpen(false);
    setNewRequest({ productName: '', requiredQty: 1, availableQty: 0, dueDate: '', status: 'planned' });
  };


  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800">معدل تخطيط الطاقة</h3>
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-bold mt-4 text-slate-800">85%</p>
          <p className="text-sm text-slate-500 mt-1">تفريغ السعة الفعلية (Finite Capacity)</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800">طلبات الشراء المقترحة</h3>
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-bold mt-4 text-slate-800">{requests.filter(r => r.status === 'planned').length}</p>
          <p className="text-sm text-slate-500 mt-1">المواد التي تعاني من عجز بالمخزون</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800">الجدول الزمني العام</h3>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-bold mt-4 text-slate-800">12</p>
          <p className="text-sm text-slate-500 mt-1">أمر إنتاج مجدول هذا الأسبوع</p>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-800">تخطيط الاحتياجات (MRP)</h2>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"
        >
          <Plus className="w-5 h-5" />
          تشغيل خطة الاحتياجات (Run MRP)
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-4 font-bold text-slate-600">المادة الخام / المكون</th>
              <th className="p-4 font-bold text-slate-600">الاحتياج الكلي</th>
              <th className="p-4 font-bold text-slate-600">المتاح بالمخزن</th>
              <th className="p-4 font-bold text-slate-600">العجز (Deficit)</th>
              <th className="p-4 font-bold text-slate-600">تاريخ الاحتياج</th>
              <th className="p-4 font-bold text-slate-600">الحالة</th>
              <th className="p-4 font-bold text-slate-600 text-center">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {requests.map(req => (
              <tr key={req.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="p-4 font-medium text-slate-800">{req.productName}</td>
                <td className="p-4 font-bold text-slate-700">{req.requiredQty}</td>
                <td className="p-4 text-emerald-600 font-bold">{req.availableQty}</td>
                <td className="p-4 text-rose-600 font-bold">{req.deficit}</td>
                <td className="p-4 text-slate-600">{req.dueDate}</td>
                <td className="p-4">
                  {req.status === 'planned' && <span className="bg-amber-100 text-amber-600 px-2 py-1 rounded text-xs font-bold">عجز - مقترح شراء</span>}
                  {req.status === 'ordered' && <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded text-xs font-bold">تم طلب الشراء</span>}
                </td>
                <td className="p-4 text-center">
                  {req.status === 'planned' && (
                    <button className="text-indigo-600 hover:text-indigo-800 font-bold text-xs bg-indigo-50 px-3 py-1.5 rounded-lg flex items-center justify-center gap-1 mx-auto">
                      إنشاء أمر شراء <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                  {req.status === 'ordered' && (
                    <button className="text-slate-400 cursor-not-allowed font-bold text-xs bg-slate-50 px-3 py-1.5 rounded-lg flex items-center justify-center mx-auto">
                      <CheckCircle className="w-3 h-3 ml-1" /> جاري التوريد
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Advanced planning suites row: Forecasting & Capacity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        {/* Module 13: Demand Forecasting */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">التنبؤ المتقدم بالطلب الذكي (Smart Demand Forecasting)</h3>
              <p className="text-[11px] text-slate-500">يتنبأ بالاحتياجات المستقبلية ويعاير المبيعات السابقة لتوليد خطط إنتاج مسبقة تلقائياً</p>
            </div>
          </div>

          <div className="space-y-4 text-right">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">المنتج المراد برمجته</label>
                <select 
                  value={forecastProductCode}
                  onChange={e => setForecastProductCode(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-xs text-slate-700"
                >
                  {productsList.map(p => (
                    <option key={p.id} value={p.code}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">معدل حجم المبيعات السابقة (Baseline)</label>
                <input 
                  type="number"
                  value={forecastHistSales}
                  onChange={e => setForecastHistSales(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-xs font-bold font-mono text-center"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">النمو السنوي المتوقع (%)</label>
                <input 
                  type="number"
                  value={forecastGrowth}
                  onChange={e => setForecastGrowth(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-xs font-bold font-mono text-center text-indigo-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">معامل الموسمية والطلب الحالي</label>
                <select 
                  value={forecastSeason}
                  onChange={e => setForecastSeason(parseFloat(e.target.value) || 1.0)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-xs"
                >
                  <option value="0.7">موسم منخفض (Low: 0.7x)</option>
                  <option value="1.0">اعتيادي متزن (Normal: 1.0x)</option>
                  <option value="1.3">ذروة الطلب (High Peak: 1.3x)</option>
                  <option value="1.6">ذروة استثنائية (Exceptional: 1.6x)</option>
                </select>
              </div>
            </div>

            {/* Calculations simulator */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center text-sm">
              <span className="text-slate-500 text-xs">الحجم التنبؤي المتوقع (Forecasted Units):</span>
              <span className="font-mono font-bold text-lg text-emerald-600">
                {Math.round(forecastHistSales * (1 + forecastGrowth / 100) * forecastSeason)} وحدة
              </span>
            </div>

            <button 
              onClick={handleGenerateOrdersFromForecast}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              توليد أمر إنتاج مسبق تلقائي (Auto-Generate Plan)
            </button>
          </div>
        </div>

        {/* Module 2: Capacity Planning */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <BarChart2 className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">مراقبة ومعايرة الطاقة الاستيعابية للمصنع (Finite Capacity Monitor)</h3>
              <p className="text-[11px] text-slate-500">يقيس التوافق الحقيقي بين جدول الماكينات والعمال وضغط العمل الفعلي بالورشة</p>
            </div>
          </div>

          <div className="space-y-4 text-right">
            {workCenters.map(wc => {
              const cap = Number(wc.capacity) || 160;
              const load = Number(wc.currentAllocatedLoad) || 0;
              const ratio = cap > 0 ? Math.round((load / cap) * 100) : 0;
              const isOverloaded = ratio > 100;
              return (
                <div key={wc.id} className="space-y-1.5 p-3 rounded-xl border border-slate-150/60 bg-slate-50/50">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800">{wc.name} ({wc.code})</span>
                    <span className="font-mono text-slate-500">
                      محمل: <span className="font-bold text-slate-700">{load}</span> من {cap} ساعة ({ratio}%)
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${isOverloaded ? 'bg-rose-500' : ratio > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, Math.max(0, ratio))}%` }}
                    />
                  </div>
                  {/* Warning advice */}
                  <div className="flex justify-between items-center text-[10px] mt-1">
                    {isOverloaded ? (
                      <span className="text-rose-600 font-bold flex items-center gap-0.5">
                        <AlertCircle className="w-3 h-3 animate-bounce" />
                        عنق زجاجة! تحميل زائد ({Math.max(0, ratio - 100)}%). اقترح عمل إضافي أو فرز المكونات.
                      </span>
                    ) : (
                      <span className="text-slate-400 font-medium">سعة تشغيلية متوفرة وآمنة</span>
                    )}
                    <span className="text-slate-500">{ratio > 100 ? 'يحتاج إعادة توجيه' : 'حالة ممتازة'}</span>
                  </div>
                </div>
              );
            })}

            <div className="flex items-center gap-2 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-[10px] text-indigo-700 leading-tight">
              <AlertCircle className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>يقوم محاكي الطاقة الاستيعابية باعتراض أي أمر إنتاج جديد يضغط على الورديات فوق طاقتها بنسبة تزيد عن 110% كإجراء حماية صناعي قياسي (Finite Capacity Block).</span>
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">تشغيل خطة احتياجات لمنتج محدد</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddRequest} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">اسم المنتج / المادة خام</label>
                <input 
                  required
                  type="text" 
                  value={newRequest.productName}
                  onChange={e => setNewRequest({...newRequest, productName: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">الاحتياج الكلي المطلوب</label>
                  <input 
                    required
                    type="number" 
                    min="1"
                    value={newRequest.requiredQty}
                    onChange={e => setNewRequest({...newRequest, requiredQty: parseInt(e.target.value) || 0})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-left" dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">المتاح حالياً بالمخزن</label>
                  <input 
                    required
                    type="number" 
                    min="0"
                    value={newRequest.availableQty}
                    onChange={e => setNewRequest({...newRequest, availableQty: parseInt(e.target.value) || 0})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-left" dir="ltr"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">تاريخ الاحتياج (Due Date)</label>
                <input 
                  required
                  type="date" 
                  value={newRequest.dueDate}
                  onChange={e => setNewRequest({...newRequest, dueDate: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold">
                  تشغيل وإضافة للخطة
                </button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 font-bold">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
