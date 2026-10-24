import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  UserPlus,
  Trash2,
  Edit2,
  Save,
  X,
  Key,
  LayoutGrid,
  CheckSquare,
  Square,
  Fingerprint,
  History,
  Lock,
  Database,
  Image as ImageIcon,
  Settings,
  FileText,
  Users,
  MapPin,
  Truck,
  Wallet,
  Clock,
  Calendar,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { motion } from "motion/react";
import { Branch } from "../types";
import { ADVANCED_PERMISSION_GROUPS } from "../utils/advancedPermissions";
import { api } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";

interface User {
  id: number;
  username: string;
  role: string;
  branch_id: number | null;
  branch_name?: string;
  permissions: any;
  can_edit?: boolean;
  can_delete?: boolean;
  is_trial?: boolean;
  trial_ends_at?: string;
}

interface SecurityProps {
  onBack: () => void;
  branches: Branch[];
  allModules: { id: string; label: string }[];
  onNavigate: (view: string) => void;
}

const buildPermissionsObject = (
  modules: string[],
  canEdit: boolean,
  canDelete: boolean,
  canManageUsers = false,
  managedModules: string[] = []
): Record<string, any> => {
  const obj: Record<string, any> = { can_edit: canEdit, can_delete: canDelete };
  modules.forEach((mod) => {
    if (mod === "all") obj.all = true;
    else {
      obj[mod] = true;
      obj[`${mod}.read`] = true;
      obj[`${mod}.full_access`] = true;
    }
  });
  if (canManageUsers) {
    obj["security.users"] = true;
    obj["security.user_management"] = true;
    obj["security.user_management.modules"] = managedModules;
  }
  return obj;
};

const getActiveModuleKeys = (perms: any): string[] => {
  if (!perms) return [];
  if (Array.isArray(perms)) return perms;
  if (typeof perms === "object") {
    if (perms.all === true) return ["all"];
    return Object.keys(perms).filter(
      (k) =>
        perms[k] === true &&
        !k.includes(".") &&
        k !== "can_edit" &&
        k !== "can_delete" &&
        k !== "limits"
    );
  }
  return [];
};

export const Security: React.FC<SecurityProps> = ({
  onBack,
  branches,
  allModules,
  onNavigate,
}) => {
  const { user: loggedInUser, refreshUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<{
    id: number;
    username: string;
    password?: string;
    role: string;
    branch_id: string | number;
    permissions: string[];
    can_edit: boolean;
    can_delete: boolean;
    is_trial: boolean;
    trial_ends_at: string;
    can_manage_users: boolean;
    managed_modules: string[];
  } | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    role: "user",
    branch_id: "" as string | number,
    permissions: [] as string[],
    can_edit: false,
    can_delete: false,
    is_trial: false,
    trial_ends_at: "",
    can_manage_users: false,
    managed_modules: [] as string[],
  });

  const isRootAdmin = loggedInUser?.role === "admin" || loggedInUser?.permissions?.all === true;
  const normalizedOwnPermissions = (() => {
    const raw = loggedInUser?.permissions;
    if (!raw) return {} as Record<string, any>;
    if (typeof raw === "string") { try { return JSON.parse(raw) || {}; } catch { return {}; } }
    return typeof raw === "object" ? raw : {};
  })();
  const managedModuleScope: string[] | null = isRootAdmin
    ? null
    : (Array.isArray(normalizedOwnPermissions["security.user_management.modules"])
      ? normalizedOwnPermissions["security.user_management.modules"]
      : []);
  const selectableModules = allModules.filter((m) => managedModuleScope === null || managedModuleScope.includes(m.id));
  const detailedGroups = ADVANCED_PERMISSION_GROUPS.filter((g) => managedModuleScope === null || managedModuleScope.includes(g.moduleId));

  const [sysDateTime, setSysDateTime] = useState<{
    server_date: string;
    server_time: string;
    timezone: string;
    override_enabled: boolean;
    custom_date: string;
    custom_time: string;
    effective_date: string;
    effective_time: string;
  }>({
    server_date: "",
    server_time: "",
    timezone: "Africa/Cairo",
    override_enabled: false,
    custom_date: "",
    custom_time: "",
    effective_date: "",
    effective_time: "",
  });
  const [loadingDateTime, setLoadingDateTime] = useState(false);
  const [savingDateTime, setSavingDateTime] = useState(false);
  const [dateTimeMsg, setDateTimeMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchSystemDateTime();
  }, []);

  const fetchSystemDateTime = async () => {
    setLoadingDateTime(true);
    try {
      const res = await api.get("/api/system/datetime");
      if (res.ok) {
        const data = await res.json();
        setSysDateTime({
          server_date: data.server_date || "",
          server_time: data.server_time || "",
          timezone: data.timezone || "Africa/Cairo",
          override_enabled: Boolean(data.override_enabled),
          custom_date: data.custom_date || data.server_date || "",
          custom_time: data.custom_time || data.server_time || "",
          effective_date: data.effective_date || "",
          effective_time: data.effective_time || "",
        });
      }
    } catch (e) {
      console.error("Failed to fetch system datetime settings", e);
    } finally {
      setLoadingDateTime(false);
    }
  };

  const handleSaveSystemDateTime = async (overrideStatus?: boolean) => {
    setSavingDateTime(true);
    setDateTimeMsg(null);
    try {
      const payload = {
        override_enabled: overrideStatus !== undefined ? overrideStatus : sysDateTime.override_enabled,
        custom_date: sysDateTime.custom_date,
        custom_time: sysDateTime.custom_time,
      };
      const res = await api.post("/api/system/datetime", payload);
      if (res.ok) {
        setDateTimeMsg({ type: "success", text: "تم حفظ إعدادات تاريخ ووقت النظام بنجاح" });
        fetchSystemDateTime();
      } else {
        const data = await res.json();
        setDateTimeMsg({ type: "error", text: data.error || "فشل حفظ التغييرات" });
      }
    } catch (e) {
      setDateTimeMsg({ type: "error", text: "حدث خطأ أثناء الاتصال بالسيرفر" });
    } finally {
      setSavingDateTime(false);
    }
  };

  const handleResetToRealDateTime = async () => {
    setSavingDateTime(true);
    setDateTimeMsg(null);
    try {
      const payload = {
        override_enabled: false,
        custom_date: sysDateTime.server_date,
        custom_time: sysDateTime.server_time,
      };
      const res = await api.post("/api/system/datetime", payload);
      if (res.ok) {
        setDateTimeMsg({ type: "success", text: "تم إعادة تاريخ ووقت النظام إلى الوضع التلقائي" });
        fetchSystemDateTime();
      } else {
        const data = await res.json();
        setDateTimeMsg({ type: "error", text: data.error || "فشل إعادة الضبط" });
      }
    } catch (e) {
      setDateTimeMsg({ type: "error", text: "حدث خطأ أثناء الاتصال بالسيرفر" });
    } finally {
      setSavingDateTime(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get("/api/users");
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch users", error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const permissionsObj = buildPermissionsObject(
        formData.permissions,
        formData.can_edit,
        formData.can_delete,
        isRootAdmin && formData.can_manage_users,
        formData.managed_modules
      );
      const res = await api.post("/api/users", {
        username: formData.username,
        password: formData.password,
        role: formData.role || "user",
        permissions: permissionsObj,
        branch_id:
          formData.branch_id === "" ? null : Number(formData.branch_id),
        is_trial: formData.is_trial,
        trial_ends_at: formData.is_trial ? formData.trial_ends_at : null,
      });
      if (res.ok) {
        setShowAddForm(false);
        setFormData({
          username: "",
          password: "",
          role: "user",
          branch_id: "",
          permissions: [],
          can_edit: false,
          can_delete: false,
          is_trial: false,
          trial_ends_at: "",
          can_manage_users: false,
          managed_modules: [],
        });
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || "فشل إضافة المستخدم");
      }
    } catch (error) {
      alert("حدث خطأ أثناء الاتصال بالسيرفر");
    }
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const permissionsObj = buildPermissionsObject(
        editingUser.permissions,
        editingUser.can_edit,
        editingUser.can_delete,
        isRootAdmin && editingUser.can_manage_users,
        editingUser.managed_modules
      );
      const payload: any = {
        username: editingUser.username,
        role: editingUser.role || "user",
        permissions: permissionsObj,
        branch_id:
          editingUser.branch_id === "" || editingUser.branch_id === null
            ? null
            : Number(editingUser.branch_id),
        is_trial: editingUser.is_trial,
        trial_ends_at: editingUser.is_trial ? editingUser.trial_ends_at : null,
      };
      if (editingUser.password && editingUser.password.trim().length > 0) {
        payload.password = editingUser.password;
      }

      const res = await api.put(`/api/users/${editingUser.id}`, payload);
      if (res.ok) {
        setEditingUser(null);
        fetchUsers();
        if (loggedInUser && loggedInUser.id === editingUser.id) {
          await refreshUser();
        }
      } else {
        const data = await res.json();
        alert(data.error || "فشل تحديث بيانات المستخدم");
      }
    } catch (error) {
      alert("فشل تحديث بيانات المستخدم");
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا المستخدم؟")) return;
    try {
      const res = await api.delete(`/api/users/${id}`);
      if (res.ok) fetchUsers();
    } catch (error) {
      alert("فشل حذف المستخدم");
    }
  };

  const togglePermission = (
    moduleId: string,
    currentPermissions: string[]
  ) => {
    if (currentPermissions.includes("all")) {
      return [moduleId];
    }
    if (currentPermissions.includes(moduleId)) {
      return currentPermissions.filter((p) => p !== moduleId);
    } else {
      return [...currentPermissions, moduleId];
    }
  };

  const startEditUser = (user: User) => {
    const activeMods = getActiveModuleKeys(user.permissions);
    const permsObj =
      typeof user.permissions === "object" && user.permissions !== null
        ? user.permissions
        : {};
    setEditingUser({
      id: user.id,
      username: user.username,
      password: "",
      role: user.role || "user",
      branch_id: user.branch_id ?? "",
      permissions: activeMods,
      can_edit: permsObj.can_edit ?? user.can_edit ?? false,
      can_delete: permsObj.can_delete ?? user.can_delete ?? false,
      is_trial: !!user.is_trial,
      trial_ends_at: user.trial_ends_at
        ? new Date(user.trial_ends_at).toISOString().split("T")[0]
        : "",
      can_manage_users: permsObj["security.user_management"] === true,
      managed_modules: Array.isArray(permsObj["security.user_management.modules"])
        ? permsObj["security.user_management.modules"]
        : [],
    });
  };

  return (
    <div className="p-6 w-full">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              السرية والتحكم
            </h1>
            <p className="text-slate-500 text-sm">
              إدارة المستخدمين والصلاحيات
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-orange-500/20"
          >
            <UserPlus className="w-5 h-5" />
            <span>إضافة مستخدم</span>
          </button>
          <button
            onClick={onBack}
            className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl transition-all"
          >
            رجوع
          </button>
        </div>
      </div>

      {/* System Date & Time Control Section */}
      <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-200 mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-600 font-bold">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                تعديل وقت وتاريخ السيستم
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${sysDateTime.override_enabled ? "bg-amber-100 text-amber-800 border border-amber-300" : "bg-emerald-100 text-emerald-800 border border-emerald-300"}`}>
                  {sysDateTime.override_enabled ? "مُعدّل يدوياً" : "تلقائي (توقيت السيرفر)"}
                </span>
              </h2>
              <p className="text-slate-500 text-xs mt-0.5">
                التحكم التام في تاريخ ووقت النظام المستخدم لجميع العمليات وبصمات الحضور والانصراف
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchSystemDateTime()}
              disabled={loadingDateTime}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${loadingDateTime ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => {
                const nextState = !sysDateTime.override_enabled;
                setSysDateTime({ ...sysDateTime, override_enabled: nextState });
                handleSaveSystemDateTime(nextState);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                sysDateTime.override_enabled
                  ? "bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20"
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>{sysDateTime.override_enabled ? "إلغاء التعديل اليدوي (الرجوع للتلقائي)" : "تفعيل التعديل اليدوي"}</span>
            </button>
          </div>
        </div>

        {dateTimeMsg && (
          <div className={`mb-4 p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${dateTimeMsg.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
            {dateTimeMsg.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span>{dateTimeMsg.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
            <span className="text-xs font-bold text-slate-500 block mb-1">الوقت والتاريخ الحقيقي للسيرفر</span>
            <div className="flex items-center justify-between mt-2">
              <div>
                <div className="text-base font-extrabold text-slate-800">{sysDateTime.server_date || "---"}</div>
                <div className="text-xs font-medium text-slate-500">{sysDateTime.server_time || "--:--"} (مصر UTC+3)</div>
              </div>
              <Clock className="w-8 h-8 text-slate-300" />
            </div>
          </div>

          <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 flex flex-col justify-between">
            <span className="text-xs font-bold text-indigo-700 block mb-1">تاريخ ووقت النظام الفعّال حالياً</span>
            <div className="flex items-center justify-between mt-2">
              <div>
                <div className="text-base font-extrabold text-indigo-900">{sysDateTime.effective_date || "---"}</div>
                <div className="text-xs font-bold text-indigo-600">{sysDateTime.effective_time || "--:--"}</div>
              </div>
              <ShieldCheck className="w-8 h-8 text-indigo-400" />
            </div>
          </div>

          <div className="md:col-span-1 bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ السيستم</label>
                <input
                  type="date"
                  value={sysDateTime.custom_date || ""}
                  disabled={!sysDateTime.override_enabled}
                  onChange={(e) => setSysDateTime({ ...sysDateTime, custom_date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">وقت السيستم</label>
                <input
                  type="time"
                  value={sysDateTime.custom_time || ""}
                  disabled={!sysDateTime.override_enabled}
                  onChange={(e) => setSysDateTime({ ...sysDateTime, custom_time: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:bg-slate-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleResetToRealDateTime}
                disabled={savingDateTime || !sysDateTime.override_enabled}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all disabled:opacity-40"
              >
                إعادة ضبط للتلقائي
              </button>
              <button
                type="button"
                onClick={() => handleSaveSystemDateTime()}
                disabled={savingDateTime || !sysDateTime.override_enabled}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-40 flex items-center gap-1.5"
              >
                {savingDateTime ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>حفظ التعديل</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {showAddForm && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-3xl shadow-xl border border-slate-200 mb-8"
        >
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-orange-500" />
            مستخدم جديد
          </h2>
          <form
            onSubmit={handleAddUser}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <input
              type="text"
              placeholder="اسم المستخدم"
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-orange-500"
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
              required
            />
            <input
              type="password"
              placeholder="كلمة المرور"
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-orange-500"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              required
            />
            <select
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-orange-500"
              value={formData.branch_id}
              onChange={(e) =>
                setFormData({ ...formData, branch_id: e.target.value })
              }
            >
              <option value="">الإدارة المركزية (جميع الفروع)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            <div className="md:col-span-3">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                الصلاحيات المتاحة:
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {selectableModules.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        permissions: togglePermission(
                          m.id,
                          formData.permissions,
                        ),
                      })
                    }
                    className={`flex items-center gap-2 p-2 rounded-lg text-xs transition-all border ${
                      formData.permissions.includes(m.id)
                        ? "bg-orange-50 border-orange-200 text-orange-700"
                        : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {formData.permissions.includes(m.id) ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {isRootAdmin && (
              <div className="md:col-span-3 border-t pt-4 mt-2 p-4 rounded-2xl bg-orange-50/60 border-orange-100">
                <label className="flex items-center gap-2 cursor-pointer mb-3">
                  <input type="checkbox" checked={formData.can_manage_users}
                    onChange={(e) => setFormData({ ...formData, can_manage_users: e.target.checked, managed_modules: e.target.checked ? formData.managed_modules : [] })}
                    className="w-4 h-4 accent-orange-500" />
                  <span className="text-sm font-bold text-orange-800">السماح لهذا المستخدم بإنشاء وإدارة مستخدمين</span>
                </label>
                {formData.can_manage_users && (
                  <div>
                    <p className="text-xs font-bold text-slate-600 mb-2">حدد الموديولات التي يستطيع مدير المستخدمين إدارتها:</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                      {allModules.map((m) => {
                        const checked = formData.managed_modules.includes(m.id);
                        return <button key={`manage-${m.id}`} type="button"
                          onClick={() => setFormData({ ...formData, managed_modules: checked ? formData.managed_modules.filter(x => x !== m.id) : [...formData.managed_modules, m.id] })}
                          className={`p-2 rounded-lg text-xs border ${checked ? "bg-orange-100 border-orange-300 text-orange-800" : "bg-white border-slate-200 text-slate-500"}`}>
                          {checked ? "✓ " : "□ "}{m.label}
                        </button>;
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="md:col-span-3 border-t pt-4 mt-2 flex flex-col md:flex-row gap-6 items-start md:items-center">
              <div className="flex gap-4 items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.can_edit}
                    onChange={(e) =>
                      setFormData({ ...formData, can_edit: e.target.checked })
                    }
                    className="w-4 h-4 accent-orange-500"
                  />
                  <span className="text-sm font-bold">صلاحية التعديل</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.can_delete}
                    onChange={(e) =>
                      setFormData({ ...formData, can_delete: e.target.checked })
                    }
                    className="w-4 h-4 accent-orange-500"
                  />
                  <span className="text-sm font-bold">صلاحية الحذف</span>
                </label>
              </div>

              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center flex-1 w-full md:w-auto">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_trial}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        is_trial: e.target.checked,
                        trial_ends_at: e.target.checked 
                          ? (formData.trial_ends_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
                          : ""
                      })
                    }
                    className="w-4 h-4 accent-orange-500"
                  />
                  <span className="text-sm font-bold text-amber-700">تفعيل كحساب تجريبي مؤقت</span>
                </label>

                {formData.is_trial && (
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <span className="text-xs font-bold text-slate-500">تاريخ الانتهاء:</span>
                    <input
                      type="date"
                      value={formData.trial_ends_at}
                      onChange={(e) =>
                        setFormData({ ...formData, trial_ends_at: e.target.value })
                      }
                      className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-1 text-sm focus:outline-none focus:border-orange-500"
                      required
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-3 flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-slate-500 hover:text-slate-700"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="bg-orange-500 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-orange-500/20"
              >
                حفظ المستخدم
              </button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div
          onClick={() => onNavigate("users")}
          className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-slate-100 flex flex-col items-center text-center gap-4"
        >
          <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">إدارة المستخدمين</h3>
        </div>

        <div
          onClick={() => onNavigate("backup")}
          className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-slate-100 flex flex-col items-center text-center gap-4"
        >
          <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
            <Database className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">النسخ الاحتياطي</h3>
        </div>

        <div
          onClick={() => onNavigate("appearance")}
          className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-slate-100 flex flex-col items-center text-center gap-4"
        >
          <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center text-purple-600">
            <ImageIcon className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">تخصيص المظهر</h3>
        </div>

        <div
          onClick={() => onNavigate("system-settings")}
          className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-slate-100 flex flex-col items-center text-center gap-4"
        >
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
            <Settings className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">إعدادات النظام</h3>
        </div>

        <div
          onClick={() => onNavigate("delivery-settings")}
          className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-slate-100 flex flex-col items-center text-center gap-4"
        >
          <div className="w-14 h-14 bg-pink-100 rounded-full flex items-center justify-center text-pink-600">
            <Truck className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">إعدادات الدليفري</h3>
        </div>

        <div
          onClick={() => onNavigate("receipt-settings")}
          className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-slate-100 flex flex-col items-center text-center gap-4"
        >
          <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">تخصيص الفاتورة</h3>
        </div>

        <div
          onClick={() => onNavigate("user-logs")}
          className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-slate-100 flex flex-col items-center text-center gap-4"
        >
          <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
            <History className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">
            سجل حركات المستخدمين
          </h3>
        </div>

      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-right min-w-[800px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-bold text-slate-700">المستخدم</th>
              <th className="px-6 py-4 font-bold text-slate-700">الفرع</th>
              <th className="px-6 py-4 font-bold text-slate-700">الصلاحيات</th>
              <th className="px-6 py-4 font-bold text-slate-700">تعديل/حذف</th>
              <th className="px-6 py-4 font-bold text-slate-700">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                      <Key className="w-5 h-5 text-slate-500" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold">{user.username}</span>
                      {user.is_trial && (() => {
                        try {
                          const today = new Date().toISOString().split('T')[0];
                          const endDay = user.trial_ends_at ? new Date(user.trial_ends_at).toISOString().split('T')[0] : "";
                          const isExpired = endDay && today > endDay;
                          const formattedDate = user.trial_ends_at ? new Date(user.trial_ends_at).toLocaleDateString("ar-EG") : "";
                          return (
                            <span className={`px-2 py-0.5 mt-1 rounded text-[10px] font-bold inline-block w-fit ${
                              isExpired ? "bg-red-100 text-red-700 border border-red-200" : "bg-amber-100 text-amber-700 border border-amber-200"
                            }`}>
                              {isExpired ? `تجريبي منتهي (${formattedDate})` : `تجريبي (ينتهي ${formattedDate})`}
                            </span>
                          );
                        } catch (e) {
                          return <span className="px-2 py-0.5 mt-1 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 inline-block w-fit">تجريبي</span>;
                        }
                      })()}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-600">
                  {user.branch_name || "الإدارة المركزية"}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {getActiveModuleKeys(user.permissions).includes("all") ? (
                      <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold border border-blue-100">
                        كامل الصلاحيات
                      </span>
                    ) : getActiveModuleKeys(user.permissions).length === 0 ? (
                      <span className="px-2 py-1 bg-slate-50 text-slate-400 rounded-lg text-xs">
                        بدون صلاحيات
                      </span>
                    ) : (
                      getActiveModuleKeys(user.permissions).map((p) => (
                        <span
                          key={p}
                          className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs border border-slate-200"
                        >
                          {allModules.find((m) => m.id === p)?.label || p}
                        </span>
                      ))
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    {(() => {
                      const canE = user.can_edit ?? user.permissions?.can_edit ?? false;
                      const canD = user.can_delete ?? user.permissions?.can_delete ?? false;
                      return (
                        <>
                          <span
                            className={`px-2 py-1 rounded-lg text-xs font-bold ${canE ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}
                          >
                            {canE ? "تعديل" : "لا تعديل"}
                          </span>
                          <span
                            className={`px-2 py-1 rounded-lg text-xs font-bold ${canD ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}
                          >
                            {canD ? "حذف" : "لا حذف"}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEditUser(user)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="تعديل بيانات وصلاحيات المستخدم"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      disabled={user.username === "elhosary"}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30"
                      title="حذف المستخدم"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6"
          >
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Edit2 className="w-6 h-6 text-orange-500" />
                تعديل صلاحيات وتفاصيل المستخدم: {editingUser.username}
              </h2>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    اسم المستخدم
                  </label>
                  <input
                    type="text"
                    value={editingUser.username}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, username: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-orange-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    كلمة المرور جديدة (اختياري)
                  </label>
                  <input
                    type="password"
                    placeholder="اتركها فارغة بدون تغيير"
                    value={editingUser.password || ""}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, password: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    الفرع المخصص
                  </label>
                  <select
                    value={editingUser.branch_id}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, branch_id: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-orange-500"
                  >
                    <option value="">الإدارة المركزية (جميع الفروع)</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  الصلاحيات المفعلة لهذا المستخدم:
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {selectableModules.map((m) => {
                    const isChecked = editingUser.permissions.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          setEditingUser({
                            ...editingUser,
                            permissions: togglePermission(
                              m.id,
                              editingUser.permissions
                            ),
                          })
                        }
                        className={`flex items-center gap-2 p-2 rounded-lg text-xs transition-all border ${
                          isChecked
                            ? "bg-orange-50 border-orange-200 text-orange-700 font-bold"
                            : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-orange-500" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isRootAdmin && (
                <div className="p-4 rounded-2xl bg-orange-50/60 border border-orange-100">
                  <label className="flex items-center gap-2 cursor-pointer mb-3">
                    <input type="checkbox" checked={editingUser.can_manage_users}
                      onChange={(e) => setEditingUser({ ...editingUser, can_manage_users: e.target.checked, managed_modules: e.target.checked ? editingUser.managed_modules : [] })}
                      className="w-4 h-4 accent-orange-500" />
                    <span className="text-sm font-bold text-orange-800">السماح لهذا المستخدم بإنشاء وإدارة مستخدمين</span>
                  </label>
                  {editingUser.can_manage_users && (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                      {allModules.map((m) => {
                        const checked = editingUser.managed_modules.includes(m.id);
                        return <button key={`edit-manage-${m.id}`} type="button"
                          onClick={() => setEditingUser({ ...editingUser, managed_modules: checked ? editingUser.managed_modules.filter(x => x !== m.id) : [...editingUser.managed_modules, m.id] })}
                          className={`p-2 rounded-lg text-xs border ${checked ? "bg-orange-100 border-orange-300 text-orange-800" : "bg-white border-slate-200 text-slate-500"}`}>
                          {checked ? "✓ " : "□ "}{m.label}
                        </button>;
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="border-t pt-4 flex flex-col md:flex-row gap-6 items-start md:items-center">
                <div className="flex gap-4 items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingUser.can_edit}
                      onChange={(e) =>
                        setEditingUser({
                          ...editingUser,
                          can_edit: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-orange-500"
                    />
                    <span className="text-sm font-bold">صلاحية التعديل العامة</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingUser.can_delete}
                      onChange={(e) =>
                        setEditingUser({
                          ...editingUser,
                          can_delete: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-orange-500"
                    />
                    <span className="text-sm font-bold">صلاحية الحذف العامة</span>
                  </label>
                </div>

                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center flex-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingUser.is_trial}
                      onChange={(e) =>
                        setEditingUser({
                          ...editingUser,
                          is_trial: e.target.checked,
                          trial_ends_at: e.target.checked
                            ? editingUser.trial_ends_at ||
                              new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                                .toISOString()
                                .split("T")[0]
                            : "",
                        })
                      }
                      className="w-4 h-4 accent-orange-500"
                    />
                    <span className="text-sm font-bold text-amber-700">
                      حساب تجريبي مؤقت
                    </span>
                  </label>

                  {editingUser.is_trial && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500">
                        ينتهي في:
                      </span>
                      <input
                        type="date"
                        value={editingUser.trial_ends_at}
                        onChange={(e) =>
                          setEditingUser({
                            ...editingUser,
                            trial_ends_at: e.target.value,
                          })
                        }
                        className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-1 text-sm focus:outline-none focus:border-orange-500"
                        required
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setEditingUser(null);
                    onNavigate("users");
                  }}
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  اللانتقال لوحة التحكم والتخصيص التفصيلي جداً للعملاء والكاشير
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 text-slate-500 hover:text-slate-700"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="bg-orange-500 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-orange-500/20"
                  >
                    حفظ التعديلات
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};
