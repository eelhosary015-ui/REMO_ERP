import React, { useState } from 'react';
import { Search, X, Check, Building2, Package, Tag, ArrowRight } from 'lucide-react';
import { ProductCatalogItem } from './types';

interface ProductSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductCatalogItem[];
  selectedProductId: number;
  onSelectProduct: (productId: number) => void;
  branches: string[];
  warehouses: string[];
}

export const ProductSelectorModal: React.FC<ProductSelectorModalProps> = ({
  isOpen,
  onClose,
  products,
  selectedProductId,
  onSelectProduct,
  branches,
  warehouses
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBranch, setSelectedBranch] = useState('all');

  if (!isOpen) return null;

  const categories = Array.from(new Set(products.map(p => p.category_name).filter(Boolean)));

  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.item_code.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category_name === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4" dir="rtl">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-lg font-black text-slate-900">اختيار منتج لحساب وتحليل التكلفة</h3>
            <p className="text-xs font-bold text-slate-500 mt-0.5">
              تصفح وتحديد المنتجات من شجرة الأصناف وقوائم المواد الخام والمبيعات
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters and Search Bar */}
        <div className="p-4 border-b border-slate-100 bg-white grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="relative md:col-span-6">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="البحث بالاسم، كود الصنف (SKU)، أو الباركود..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-2 text-xs font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
            >
              <option value="all">كل الفئات والتصنيفات</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
            >
              <option value="all">كل الفروع التشغيلية</option>
              {branches.map(br => (
                <option key={br} value={br}>{br}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Product Cards List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-slate-50">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="font-bold text-sm">لم يتم العثور على منتجات مطابقة لمعايير البحث</p>
            </div>
          ) : (
            filteredProducts.map((p) => {
              const isSelected = p.id === selectedProductId;
              const isHealthy = p.margin_pct >= 20;

              return (
                <div
                  key={p.id}
                  onClick={() => {
                    onSelectProduct(p.id);
                    onClose();
                  }}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isSelected 
                      ? 'border-indigo-500 bg-indigo-50/40 ring-1 ring-indigo-500' 
                      : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                      {p.image ? (
                        <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-6 h-6 text-slate-400" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-black text-slate-900">{p.name}</h4>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          {p.item_code}
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                          {p.category_name}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs font-medium text-slate-500 mt-1">
                        <span>الوحدة: <strong className="text-slate-700">{p.unit}</strong></span>
                        <span>الباركود: <strong className="text-slate-700">{p.barcode}</strong></span>
                        <span>آخر تحديث: <strong className="text-slate-700">{p.last_updated}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Financial & Status Metrics */}
                  <div className="flex items-center gap-6 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0">
                    <div className="text-left">
                      <div className="text-xs text-slate-400 font-bold">التكلفة / السعر</div>
                      <div className="text-sm font-black text-slate-800">
                        {p.unit_cost.toFixed(2)} / <span className="text-emerald-600">{p.selling_price.toFixed(2)}</span> <span className="text-[10px] text-slate-400">ج.م.</span>
                      </div>
                    </div>

                    <div className="text-left">
                      <div className="text-xs text-slate-400 font-bold">هامش الربح</div>
                      <div className={`text-sm font-black ${isHealthy ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {p.margin_pct.toFixed(1)}%
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isSelected ? (
                        <span className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                          <Check className="w-4 h-4" />
                        </span>
                      ) : (
                        <button className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 transition flex items-center gap-1">
                          <span>اختيار</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500 font-bold">
          <span>إجمالي المنتجات المتاحة: {products.length} منتج</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
