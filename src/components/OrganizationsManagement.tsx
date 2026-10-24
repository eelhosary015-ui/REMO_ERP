import React, { useState, useEffect } from "react";
import { 
  Building2, 
  Plus, 
  Search, 
  Edit, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  AlertCircle,
  Hash,
  MapPin,
  FileText,
  Sparkles,
  RefreshCw,
  Building
} from "lucide-react";
import { Organization } from "../types";
import { authFetch } from "../utils/api";

interface OrganizationsManagementProps {
  onSelectOrg?: (org: Organization) => void;
  isQuickModal?: boolean;
  onCloseQuickModal?: () => void;
}

export const OrganizationsManagement: React.FC<OrganizationsManagementProps> = ({
  onSelectOrg,
  isQuickModal = false,
  onCloseQuickModal
}) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  
  // Modal states
  const [showModal, setShowModal] = useState<boolean>(isQuickModal);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    org_code: "",
    org_name_ar: "",
    org_name_en: "",
    tax_number: "",
    address: "",
    logo: "",
    is_active: true
  });

  const fetchOrganizations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/organizations");
      if (!res.ok) throw new Error("فشل جلب قائمة المؤسسات");
      const data = await res.json();
      setOrganizations(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || "حدث خطأ أثناء تحميل المؤسسات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const resetForm = () => {
    setFormData({
      org_code: "",
      org_name_ar: "",
      org_name_en: "",
      tax_number: "",
      address: "",
      logo: "",
      is_active: true
    });
    setEditingOrg(null);
    setFormError(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleOpenEditModal = (org: Organization) => {
    setEditingOrg(org);
    setFormData({
      org_code: org.org_code || "",
      org_name_ar: org.org_name_ar || "",
      org_name_en: org.org_name_en || "",
      tax_number: org.tax_number || "",
      address: org.address || "",
      logo: org.logo || "",
      is_active: org.is_active ?? true
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.org_code.trim()) {
      setFormError("يرجى إدخال كود المؤسسة");
      return;
    }
    if (!formData.org_name_ar.trim()) {
      setFormError("يرجى إدخال اسم المؤسسة باللغة العربية");
      return;
    }

    setSubmitting(true);
    try {
      const url = editingOrg ? `/api/organizations/${editingOrg.id}` : "/api/organizations";
      const method = editingOrg ? "PUT" : "POST";

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "حدث خطأ أثناء حفظ المؤسسة");
      }

      setSuccessMessage(editingOrg ? "تم تعديل بيانات المؤسسة بنجاح" : "تم إضافة المؤسسة بنجاح");
      setTimeout(() => setSuccessMessage(null), 3000);

      await fetchOrganizations();
      
      if (onSelectOrg && data) {
        onSelectOrg(data);
      }

      setShowModal(false);
      if (onCloseQuickModal) onCloseQuickModal();
      resetForm();
    } catch (err: any) {
      setFormError(err.message || "فشل حفظ بيانات المؤسسة");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredOrgs = organizations.filter(org => {
    const search = searchTerm.toLowerCase();
    return (
      (org.org_code && org.org_code.toLowerCase().includes(search)) ||
      (org.org_name_ar && org.org_name_ar.toLowerCase().includes(search)) ||
      (org.org_name_en && org.org_name_en.toLowerCase().includes(search))
    );
  });

  return (
    <div className={`space-y-4 ${isQuickModal ? 'p-2' : 'p-4 bg-white rounded-lg border border-slate-200 shadow-sm'}`}>
      {/* Header */}
      {!isQuickModal && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">إدارة المؤسسات والشركات</h2>
              <p className="text-xs text-slate-500">تعريف وتعديل المؤسسات والمنشآت المسجلة بالنظام</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={fetchOrganizations}
              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded border border-slate-200 text-xs flex items-center gap-1"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>تحديث</span>
            </button>

            <button
              onClick={handleOpenAddModal}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مؤسسة جديدة</span>
            </button>
          </div>
        </div>
      )}

      {/* Success Alert */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Search & Stats */}
      {!isQuickModal && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 bg-slate-50 p-2.5 rounded border border-slate-200 text-xs">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={searchTerm ?? ""}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث بكود أو اسم المؤسسة..."
              className="w-full pr-8 pl-3 py-1.5 bg-white border border-slate-300 rounded text-xs focus:outline-none focus:border-blue-500 text-right"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
          </div>

          <div className="flex items-center gap-3 text-slate-600">
            <span>إجمالي المؤسسات: <strong className="text-slate-800">{organizations.length}</strong></span>
            <span>النشطة: <strong className="text-emerald-700">{organizations.filter(o => o.is_active).length}</strong></span>
          </div>
        </div>
      )}

      {/* Table List */}
      {!isQuickModal && (
        <div className="overflow-x-auto border border-slate-200 rounded">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">كود المؤسسة</th>
                <th className="py-2.5 px-3">اسم المؤسسة (عربي)</th>
                <th className="py-2.5 px-3">اسم المؤسسة (إنجليزي)</th>
                <th className="py-2.5 px-3">الرقم الضريبي</th>
                <th className="py-2.5 px-3">العنوان</th>
                <th className="py-2.5 px-3 text-center">الحالة</th>
                <th className="py-2.5 px-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span>جاري تحميل المؤسسات...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredOrgs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    <Building className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-medium text-slate-600">لا توجد مؤسسات مسجلة</p>
                    <button
                      onClick={handleOpenAddModal}
                      className="mt-2 text-blue-600 hover:underline font-medium inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة مؤسسة جديدة الآن</span>
                    </button>
                  </td>
                </tr>
              ) : (
                filteredOrgs.map((org) => (
                  <tr key={org.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{org.org_code}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">{org.org_name_ar}</td>
                    <td className="py-2.5 px-3 text-slate-600 dir-ltr text-right">{org.org_name_en || "-"}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{org.tax_number || "-"}</td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">{org.address || "-"}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        org.is_active 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}>
                        {org.is_active ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-slate-400" />}
                        {org.is_active ? "نشط" : "غير نشط"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => handleOpenEditModal(org)}
                        className="p-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors inline-flex items-center gap-1"
                        title="تعديل البيانات"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>تعديل</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal / Form */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-800">
                  {editingOrg ? "تعديل بيانات المؤسسة" : "إضافة مؤسسة جديدة"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  if (onCloseQuickModal) onCloseQuickModal();
                }}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none px-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              {formError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* org_code */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    كود المؤسسة <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.org_code ?? ""}
                      onChange={(e) => setFormData({ ...formData, org_code: e.target.value.toUpperCase() })}
                      placeholder="مثال: ORG-TG"
                      required
                      className="w-full h-8 px-2 pl-7 bg-white border border-slate-300 rounded text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500 dir-ltr text-right"
                    />
                    <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">كود فريد مخصص للمؤسسة</p>
                </div>

                {/* is_active */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">الحالة</label>
                  <select
                    value={formData.is_active ? "true" : "false"}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.value === "true" })}
                    className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  >
                    <option value="true">نشط (متاح بالنظام)</option>
                    <option value="false">غير نشط (معطل)</option>
                  </select>
                </div>
              </div>

              {/* org_name_ar */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  اسم المؤسسة (بالعربية) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.org_name_ar ?? ""}
                  onChange={(e) => setFormData({ ...formData, org_name_ar: e.target.value })}
                  placeholder="مثال: مؤسسة تراستس جانكو"
                  required
                  className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500 text-right"
                />
              </div>

              {/* org_name_en */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  اسم المؤسسة (بالإنجليزية)
                </label>
                <input
                  type="text"
                  value={formData.org_name_en ?? ""}
                  onChange={(e) => setFormData({ ...formData, org_name_en: e.target.value })}
                  placeholder="e.g. Trusts Janco Organization"
                  className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-blue-500 dir-ltr text-left"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* tax_number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">الرقم الضريبي</label>
                  <input
                    type="text"
                    value={formData.tax_number ?? ""}
                    onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                    placeholder="مثال: 300-123-456"
                    className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500 text-right"
                  />
                </div>

                {/* logo */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">رابط الشعار (Logo URL)</label>
                  <input
                    type="text"
                    value={formData.logo ?? ""}
                    onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                    placeholder="https://..."
                    className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-blue-500 dir-ltr text-left"
                  />
                </div>
              </div>

              {/* address */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">العنوان</label>
                <textarea
                  rows={2}
                  value={formData.address ?? ""}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="العنوان التفصيلي للمقر الرئيسي..."
                  className="w-full p-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-blue-500 text-right resize-none"
                />
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    if (onCloseQuickModal) onCloseQuickModal();
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium transition-colors"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingOrg ? "حفظ التغييرات" : "إضافة المؤسسة"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
