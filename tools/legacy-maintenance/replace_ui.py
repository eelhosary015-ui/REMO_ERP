import sys

with open("src/components/Products.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

start_idx = -1
for i, line in enumerate(lines):
    if "return (" in line and start_idx == -1:
        start_idx = i
        break

end_idx = -1
for i, line in enumerate(lines):
    if "<AnimatePresence>" in line and end_idx == -1:
        end_idx = i
        break

if start_idx != -1 and end_idx != -1:
    new_ui = """  return (
    <div className="h-full bg-slate-50 flex flex-col font-sans" dir="rtl">
      {/* Header */}
      <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              إدارة الأصناف والمنتجات
            </h1>
            <p className="text-sm text-slate-500">
              الإعدادات &gt; الأصناف والمنتجات
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-colors font-bold shadow-sm">
            <Download className="w-4 h-4 text-green-600" />
            <span>استيراد من إكسل</span>
          </button>
          {canEdit() && (
            <button
              onClick={() => {
                if (activeTab === "products") {
                  setEditingProduct({ ingredients: [] });
                  setShowProductModal(true);
                } else if (activeTab === "categories") {
                  setEditingCategory({});
                  setShowCategoryModal(true);
                } else {
                  setEditingIngredient({});
                  setShowIngredientModal(true);
                }
              }}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-bold shadow-md shadow-blue-600/20"
            >
              <Plus className="w-5 h-5" />
              <span>منتج جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold mb-1">إجمالي المنتجات</p>
            <h3 className="text-2xl font-black text-slate-800">{products.length}</h3>
            <span className="text-[10px] text-slate-400 font-bold">منتج</span>
          </div>
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold mb-1">إجمالي الأصناف</p>
            <h3 className="text-2xl font-black text-slate-800">{categories.length}</h3>
            <span className="text-[10px] text-slate-400 font-bold">صنف</span>
          </div>
          <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
            <Folder className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold mb-1">الأصناف الفرعية</p>
            <h3 className="text-2xl font-black text-slate-800">{categories.length}</h3>
            <span className="text-[10px] text-slate-400 font-bold">صنف فرعي</span>
          </div>
          <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold mb-1">منخفضة المخزون</p>
            <h3 className="text-2xl font-black text-slate-800">0</h3>
            <span className="text-[10px] text-slate-400 font-bold">منتج</span>
          </div>
          <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold mb-1">منتجات غير نشطة</p>
            <h3 className="text-2xl font-black text-slate-800">{products.filter(p => p.is_active === false).length}</h3>
            <span className="text-[10px] text-slate-400 font-bold">منتج</span>
          </div>
          <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center">
            <EyeOff className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold mb-1">إجمالي القيمة</p>
            <h3 className="text-2xl font-black text-slate-800">0.00</h3>
            <span className="text-[10px] text-slate-400 font-bold">ج.م</span>
          </div>
          <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Content Split */}
      <div className="flex-1 flex overflow-hidden px-6 pb-6 gap-6">
        
        {/* Categories Sidebar */}
        <div className="w-64 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-800">الأصناف الرئيسية</h3>
            <button onClick={() => setShowCategoryModal(true)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold">
              <Plus className="w-3 h-3" /> إضافة
            </button>
          </div>
          <div className="p-3">
            <div className="relative mb-3">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="ابحث عن صنف..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pr-9 pl-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div className="space-y-1 overflow-y-auto max-h-[500px]">
              <button 
                onClick={() => setSelectedCategoryId("all")}
                className={`w-full flex items-center justify-between p-2 rounded-lg text-sm font-bold transition-colors ${selectedCategoryId === 'all' ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'}`}
              >
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-blue-500" />
                  <span>جميع الأصناف</span>
                </div>
                <span className="bg-white text-slate-500 px-2 py-0.5 rounded-md text-xs border border-slate-200">{categories.length}</span>
              </button>
              {categories.map(cat => (
                <button 
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id!)}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-sm font-bold transition-colors ${selectedCategoryId === cat.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'}`}
                >
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-slate-400" />
                    <span>{cat.name}</span>
                  </div>
                  <span className="text-slate-400 text-xs">{products.filter(p => p.category_id === cat.id).length}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Products Table Area */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center gap-6 px-6 border-b border-slate-100">
            <button className="py-4 border-b-2 border-blue-600 text-blue-600 font-bold text-sm">
              المنتجات
            </button>
            <button onClick={() => setActiveTab("ingredients")} className="py-4 border-b-2 border-transparent text-slate-500 hover:text-slate-800 font-bold text-sm transition-colors">
              المقادير والمكونات
            </button>
          </div>

          {/* Table Toolbar */}
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <select className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none">
                <option>جميع الأصناف</option>
              </select>
              <select className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none">
                <option>جميع العلامات التجارية</option>
              </select>
              <select className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none">
                <option>جميع حالات المنتج</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="ابحث عن منتج..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 bg-slate-50 border border-slate-200 rounded-lg py-2 pr-9 pl-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-bold text-sm hover:bg-blue-100 transition-colors">
                <Filter className="w-4 h-4" />
                تصفية
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 font-bold">#</th>
                    <th className="px-6 py-4 font-bold">الصورة</th>
                    <th className="px-6 py-4 font-bold">اسم المنتج</th>
                    <th className="px-6 py-4 font-bold">الباركود / SKU</th>
                    <th className="px-6 py-4 font-bold">الصنف الرئيسي</th>
                    <th className="px-6 py-4 font-bold">الوحدة</th>
                    <th className="px-6 py-4 font-bold">السعر</th>
                    <th className="px-6 py-4 font-bold">المخزون</th>
                    <th className="px-6 py-4 font-bold">الحالة</th>
                    <th className="px-6 py-4 font-bold">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((product, idx) => (
                    <tr key={product.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4 text-slate-500">{idx + 1}</td>
                      <td className="px-6 py-4">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                          {product.image ? (
                            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-800">{product.name}</td>
                      <td className="px-6 py-4 text-slate-500 font-mono text-xs">{product.barcode || product.code || "-"}</td>
                      <td className="px-6 py-4 text-slate-600">{categories.find(c => c.id === product.category_id)?.name}</td>
                      <td className="px-6 py-4 text-slate-600">{product.unit || "قطعة"}</td>
                      <td className="px-6 py-4 font-bold text-slate-800">{product.price.toFixed(2)}</td>
                      <td className="px-6 py-4 font-bold text-slate-800">{product.stock || 0}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${product.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                          {product.is_active !== false ? 'نشط' : 'غير نشط'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {canEdit() && (
                            <button
                              onClick={() => {
                                setEditingProduct(product);
                                setShowProductModal(true);
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete() && (
                            <button
                              onClick={() => handleDeleteProduct(product.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          
          {/* Pagination (Mock) */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500 font-bold bg-slate-50/50">
            <div>عرض 1 - {filteredProducts.length} من {filteredProducts.length} منتج</div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">&lt;</button>
              <button className="px-3 py-1 bg-blue-600 text-white rounded-lg shadow-sm shadow-blue-600/20">1</button>
              <button className="px-3 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">&gt;</button>
            </div>
          </div>
        </div>

      </div>

"""

    lines = lines[:start_idx] + [new_ui] + lines[end_idx:]

    with open("src/components/Products.tsx", "w", encoding="utf-8") as f:
        f.writelines(lines)
    print("Replaced UI successfully!")
else:
    print(f"Could not find tags: {start_idx}, {end_idx}")

