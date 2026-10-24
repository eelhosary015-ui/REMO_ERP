import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { OPERATIONAL_ITEMS, ADMIN_ITEMS } from "../constants";
import {
  ADVANCED_PERMISSION_GROUPS,
  CORE_ACTION_PERMISSIONS,
  PERMISSION_TEMPLATES,
  getAdvancedPermissionsForModule,
} from "../utils/advancedPermissions";
import {
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  Search,
  ShieldCheck,
  ShieldAlert,
  SlidersHorizontal,
  Copy,
  Lock,
  Unlock,
  RotateCcw,
} from "lucide-react";

interface User {
  id: number;
  username: string;
  role: string;
  permissions: Record<string, any>;
  created_at: string;
  branch_id?: number;
  branch_name?: string;
  is_trial?: boolean;
  trial_ends_at?: string;
}

const riskClasses: Record<string, string> = {
  critical: "bg-red-50 border-red-200 text-red-700",
  sensitive: "bg-amber-50 border-amber-200 text-amber-700",
  normal: "bg-slate-50 border-slate-200 text-slate-700",
};

const riskLabel: Record<string, string> = {
  critical: "حرجة",
  sensitive: "حساسة",
  normal: "عادية",
};

const SCREEN_ACTIONS = [
  { id: "read", label: "عرض" },
  { id: "create", label: "إضافة" },
  { id: "update", label: "تعديل" },
  { id: "delete", label: "حذف" },
  { id: "approve", label: "اعتماد" },
  { id: "print", label: "طباعة" },
  { id: "export", label: "تصدير" },
] as const;

const normalizePermissions = (permissions: any): Record<string, any> => {
  if (!permissions) return {};
  let parsed = permissions;
  if (typeof permissions === "string") {
    try {
      parsed = JSON.parse(permissions);
    } catch {
      return {};
    }
  }
  if (Array.isArray(parsed)) {
    const result: Record<string, any> = {};
    parsed.forEach((item) => {
      if (typeof item === "string" && item.trim()) {
        result[item] = true;
        const moduleId = item.split(".")[0];
        result[moduleId] = true;
        result[`${moduleId}.read`] = true;
        result[`${moduleId}.full_access`] = true;
      }
    });
    return result;
  }
  if (typeof parsed === "object" && parsed !== null) {
    return { ...parsed };
  }
  return {};
};

const EXTRA_PERMISSION_MODULES = [
  { id: "products", label: "الأصناف والمنتجات", icon: SlidersHorizontal, color: "bg-blue-600", features: [], settings: [], reports: [] },
  { id: "reports", label: "التقارير العامة", icon: ShieldCheck, color: "bg-indigo-600", features: [], settings: [], reports: [] },
  { id: "restaurant", label: "تشغيل المطاعم والفروع", icon: ShieldCheck, color: "bg-emerald-600", features: [], settings: [], reports: [] },
  { id: "system", label: "النظام والأمان", icon: ShieldAlert, color: "bg-red-600", features: [], settings: [], reports: [] },
];

export const UserManagement: React.FC<{ onBack: () => void }> = ({
  onBack,
}) => {
  const { token, user: loggedInUser, refreshUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [currentUser, setCurrentUser] = useState<Partial<User>>({});
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeModuleId, setActiveModuleId] = useState("pos");
  const [permissionSearch, setPermissionSearch] = useState("");
  const [templateMode, setTemplateMode] = useState<"replace" | "merge">("replace");

  // نطاق إدارة المستخدمين: المدير الرئيسي يملك كل الموديولات، والمدير المفوض
  // يرى ويمنح فقط الموديولات التي فتحها له المدير الرئيسي.
  const normalizedLoggedInPermissions = useMemo(() => normalizePermissions(loggedInUser?.permissions), [loggedInUser?.permissions]);
  const isRootAdmin = loggedInUser?.role === "admin" || normalizedLoggedInPermissions.all === true || normalizedLoggedInPermissions.system_admin === true;
  const managedModuleScope = useMemo<string[] | null>(() => {
    if (isRootAdmin) return null;
    const scope = normalizedLoggedInPermissions["security.user_management.modules"];
    return Array.isArray(scope) ? scope.filter((id) => typeof id === "string" && id.trim()) : [];
  }, [isRootAdmin, normalizedLoggedInPermissions]);

  const allModules = useMemo(
    () =>
      [...OPERATIONAL_ITEMS, ...ADMIN_ITEMS, ...EXTRA_PERMISSION_MODULES]
        .filter((module, index, self) => index === self.findIndex((m) => m.id === module.id))
        .filter((module) => managedModuleScope === null || managedModuleScope.includes(module.id)),
    [managedModuleScope],
  );

  const dynamicModuleSubPermissions = useMemo(() => {
    const dynamic: Record<string, { id: string; label: string }[]> = {};
    allModules.forEach((module) => {
      const subs = [
        ...(module.features || []),
        ...(module.settings || []),
        ...(module.reports || []),
      ];
      if (subs.length > 0) {
        dynamic[module.id] = subs.map((sub) => ({
          id: `${module.id}.${sub.id}`,
          label: sub.label,
        }));
      }
    });
    return dynamic;
  }, [allModules]);

  const moduleHasAdvancedGroups = (moduleId: string) =>
    ADVANCED_PERMISSION_GROUPS.some((group) => group.moduleId === moduleId);

  const getModulePermissionKeys = (moduleId: string) => {
    const keys = new Set<string>([
      moduleId,
      `${moduleId}.full_access`,
      ...CORE_ACTION_PERMISSIONS.map((action) => `${moduleId}.${action.id}`),
      ...(dynamicModuleSubPermissions[moduleId] || []).flatMap((sub) => [
        sub.id,
        ...SCREEN_ACTIONS.map((action) => `${sub.id}.${action.id}`),
      ]),
      ...getAdvancedPermissionsForModule(moduleId).flatMap((group) =>
        group.permissions.map((permission) => permission.id),
      ),
    ]);
    return Array.from(keys);
  };

  const setScreenAction = (screenKey: string, actionId: string, enabled: boolean) => {
    updatePermissions((permissions) => {
      const output = { ...permissions, [screenKey]: true, [`${activeModuleId}.read`]: true, [activeModuleId]: true };
      output[`${screenKey}.${actionId}`] = enabled;
      return output;
    });
  };

  const grantedCount = (moduleId: string) => {
    const permissions = normalizePermissions(currentUser.permissions);
    return getModulePermissionKeys(moduleId).filter((key) => permissions[key] === true).length;
  };

  const activeModule = allModules.find((module) => module.id === activeModuleId) || allModules[0];

  useEffect(() => {
    if (activeModule && activeModule.id !== activeModuleId) setActiveModuleId(activeModule.id);
  }, [activeModule?.id]);
  const ActiveModuleIcon = activeModule?.icon;
  const activeAdvancedGroups = getAdvancedPermissionsForModule(activeModuleId);

  useEffect(() => {
    fetchUsers();
    fetchBranches();
  }, []);

  const fetchBranches = async (retries = 3) => {
    try {
      const res = await fetch("/api/branches", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBranches(data);
      } else {
        throw new Error("Failed to fetch");
      }
    } catch (error) {
      if (retries > 0) {
        setTimeout(() => fetchBranches(retries - 1), 1000);
      } else {
        console.error("Failed to fetch branches", error);
      }
    }
  };

  const fetchUsers = async (retries = 3) => {
    try {
      const res = await fetch("/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(
          data.map((user: User) => ({
            ...user,
            permissions: normalizePermissions(user.permissions),
          })),
        );
        setLoading(false);
      } else {
        throw new Error("Failed to fetch");
      }
    } catch (error) {
      if (retries > 0) {
        setTimeout(() => fetchUsers(retries - 1), 1000);
      } else {
        console.error("Failed to fetch users", error);
        setLoading(false);
      }
    }
  };

  const updatePermissions = (updater: (permissions: Record<string, any>) => Record<string, any>) => {
    const permissions = normalizePermissions(currentUser.permissions);
    setCurrentUser({
      ...currentUser,
      permissions: updater(permissions),
    });
  };

  const setPermissionKey = (key: string, value: boolean) => {
    updatePermissions((permissions) => ({
      ...permissions,
      [key]: value,
    }));
  };

  const togglePermissionKey = (key: string) => {
    updatePermissions((permissions) => ({
      ...permissions,
      [key]: !permissions[key],
    }));
  };

  const toggleModule = (moduleId: string) => {
    updatePermissions((permissions) => {
      const enabled = !permissions[moduleId];
      const output = { ...permissions, [moduleId]: enabled };
      output[`${moduleId}.read`] = enabled;
      if (!enabled) {
        getModulePermissionKeys(moduleId).forEach((key) => {
          output[key] = false;
        });
      } else {
        (dynamicModuleSubPermissions[moduleId] || []).forEach((sub) => {
          output[sub.id] = true;
        });
      }
      return output;
    });
  };

  const setModuleFullAccess = (moduleId: string, enabled: boolean) => {
    updatePermissions((permissions) => {
      const output = { ...permissions };
      getModulePermissionKeys(moduleId).forEach((key) => {
        output[key] = enabled;
      });
      output[moduleId] = enabled;
      output[`${moduleId}.full_access`] = enabled;
      return output;
    });
  };

  const setModuleReadOnly = (moduleId: string) => {
    updatePermissions((permissions) => {
      const output = { ...permissions };
      getModulePermissionKeys(moduleId).forEach((key) => {
        output[key] = false;
      });
      output[moduleId] = true;
      output[`${moduleId}.read`] = true;
      (dynamicModuleSubPermissions[moduleId] || []).forEach((sub) => {
        output[sub.id] = true;
      });
      activeAdvancedGroups.forEach((group) => {
        group.permissions.forEach((permission) => {
          if (permission.id.endsWith(".list") || permission.id.includes("report") || permission.id.includes("dashboard")) {
            output[permission.id] = true;
          }
        });
      });
      return output;
    });
  };

  const applyTemplate = (templateId: string) => {
    const template = PERMISSION_TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;

    updatePermissions((permissions) => {
      const base = templateMode === "merge" ? { ...permissions } : {};
      return {
        ...base,
        ...template.permissions,
      };
    });
  };

  const clearSensitivePermissions = () => {
    updatePermissions((permissions) => {
      const output = { ...permissions };
      ADVANCED_PERMISSION_GROUPS.forEach((group) => {
        group.permissions.forEach((permission) => {
          if (permission.risk === "critical" || permission.risk === "sensitive") {
            output[permission.id] = false;
          }
        });
      });
      return output;
    });
  };

  const updateLimit = (key: string, value: string | number | boolean) => {
    updatePermissions((permissions) => ({
      ...permissions,
      limits: {
        ...(permissions.limits || {}),
        [key]: value,
      },
    }));
  };

  const handleSave = async () => {
    if (!currentUser.username?.trim()) {
      alert("اسم المستخدم مطلوب");
      return;
    }
    if (!currentUser.id && !password) {
      alert("كلمة المرور مطلوبة للمستخدم الجديد");
      return;
    }

    try {
      const url = currentUser.id
        ? `/api/users/${currentUser.id}`
        : "/api/users";
      const method = currentUser.id ? "PUT" : "POST";
      const permissions = normalizePermissions(currentUser.permissions);

      const body: any = {
        username: currentUser.username,
        role: currentUser.role || "user",
        permissions,
        branch_id: currentUser.branch_id || null,
        is_trial: currentUser.is_trial || false,
        trial_ends_at: currentUser.is_trial ? currentUser.trial_ends_at : null,
      };

      if (password) {
        body.password = password;
      }

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setIsEditing(false);
        setCurrentUser({});
        setPassword("");
        fetchUsers();

        if (currentUser.id === loggedInUser?.id) {
          await refreshUser();
        }
      } else {
        const error = await res.json().catch(() => ({}));
        alert(error.message || error.error || "Failed to save user");
      }
    } catch (error) {
      console.error("Failed to save user", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل تريد حذف هذا المستخدم؟")) return;

    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchUsers();
      } else {
        const error = await res.json().catch(() => ({}));
        alert(error.message || error.error || "Failed to delete user");
      }
    } catch (error) {
      console.error("Failed to delete user", error);
    }
  };

  const filteredGroups = activeAdvancedGroups
    .map((group) => ({
      ...group,
      permissions: group.permissions.filter((permission) => {
        const search = permissionSearch.trim().toLowerCase();
        if (!search) return true;
        return (
          permission.label.toLowerCase().includes(search) ||
          permission.id.toLowerCase().includes(search) ||
          group.section.toLowerCase().includes(search)
        );
      }),
    }))
    .filter((group) => group.permissions.length > 0);

  if (loading) return <div>جاري التحميل...</div>;

  const permissions = normalizePermissions(currentUser.permissions);
  const limits = permissions.limits || {};

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            إدارة المستخدمين والصلاحيات الاحترافية
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            تحكم تفصيلي في كل موديول، العمليات الحساسة، التقارير، الطباعة، التصدير، وحدود الكاشير.
          </p>
        </div>
        <button
          onClick={onBack}
          className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300"
        >
          رجوع
        </button>
      </div>

      {!isEditing ? (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <h2 className="font-semibold text-slate-700">قائمة المستخدمين</h2>
            <button
              onClick={() => {
                setCurrentUser({ role: "user", permissions: {} });
                setPassword("");
                setActiveModuleId(allModules[0]?.id || "pos");
                setIsEditing(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              إضافة مستخدم
            </button>
          </div>

          <table className="w-full text-right min-w-[800px]">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-4">اسم المستخدم</th>
                <th className="p-4">الدور</th>
                <th className="p-4">الفرع</th>
                <th className="p-4">الصلاحيات المفعلة</th>
                <th className="p-4">تاريخ الإنشاء</th>
                <th className="p-4">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const enabledPermissions = Object.values(normalizePermissions(user.permissions)).filter((value) => value === true).length;
                return (
                  <tr
                    key={user.id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="p-4 font-medium">
                      <div className="flex items-center gap-2">
                        <span>{user.username}</span>
                        {user.is_trial && (() => {
                          try {
                            const today = new Date().toISOString().split("T")[0];
                            const endDay = user.trial_ends_at ? new Date(user.trial_ends_at).toISOString().split("T")[0] : "";
                            const isExpired = endDay && today > endDay;
                            const formattedDate = user.trial_ends_at ? new Date(user.trial_ends_at).toLocaleDateString("ar-EG") : "";
                            return (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isExpired ? "bg-red-100 text-red-700 border border-red-200" : "bg-amber-100 text-amber-700 border border-amber-200"
                              }`}>
                                {isExpired ? `تجريبي منتهي (${formattedDate})` : `تجريبي نشط (ينتهي ${formattedDate})`}
                              </span>
                            );
                          } catch (e) {
                            return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">تجريبي</span>;
                          }
                        })()}
                      </div>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${user.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}
                      >
                        {user.role === "admin" ? "مدير النظام" : "مستخدم"}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600">
                      {user.branch_name || "جميع الفروع"}
                    </td>
                    <td className="p-4">
                      <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full text-xs font-bold">
                        {user.role === "admin" || user.permissions?.all ? "كل الصلاحيات" : `${enabledPermissions} صلاحية`}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500">
                      {new Date(user.created_at).toLocaleDateString("ar-EG")}
                    </td>
                    <td className="p-4 flex gap-2">
                      <button
                        onClick={() => {
                          setCurrentUser({
                            ...user,
                            permissions: normalizePermissions(user.permissions),
                          });
                          setPassword("");
                          setActiveModuleId(allModules[0]?.id || "pos");
                          setIsEditing(true);
                        }}
                        className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {user.username !== "admin" && (
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="text-red-600 hover:bg-red-50 p-2 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6 w-full">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  {currentUser.id ? "تعديل مستخدم" : "إضافة مستخدم جديد"}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  المدير Admin يتخطى كل القيود. المستخدم العادي يخضع لكل الصلاحيات التفصيلية وحدود التشغيل.
                </p>
              </div>
              <button
                onClick={() => setIsEditing(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  اسم المستخدم
                </label>
                <input
                  type="text"
                  value={currentUser.username || ""}
                  onChange={(e) =>
                    setCurrentUser({ ...currentUser, username: e.target.value })
                  }
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  disabled={currentUser.username === "admin"}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {currentUser.id
                    ? "كلمة المرور (اتركها فارغة للإبقاء على الحالية)"
                    : "كلمة المرور"}
                </label>
                <input
                  type="password"
                  value={password ?? ""}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  الدور
                </label>
                <select
                  value={currentUser.role || "user"}
                  onChange={(e) =>
                    setCurrentUser({ ...currentUser, role: e.target.value })
                  }
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  disabled={currentUser.username === "admin" || !isRootAdmin}
                >
                  <option value="user">مستخدم بصلاحيات مخصصة</option>
                  {isRootAdmin && <option value="admin">مدير النظام - كل الصلاحيات</option>}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  نطاق الفرع
                </label>
                <select
                  value={currentUser.branch_id || ""}
                  onChange={(e) =>
                    setCurrentUser({
                      ...currentUser,
                      branch_id: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    })
                  }
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">-- جميع الفروع --</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  نوع الحساب
                </label>
                <select
                  value={currentUser.is_trial ? "trial" : "permanent"}
                  onChange={(e) =>
                    setCurrentUser({
                      ...currentUser,
                      is_trial: e.target.value === "trial",
                      trial_ends_at: e.target.value === "trial"
                        ? (currentUser.trial_ends_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
                        : undefined,
                    })
                  }
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  disabled={currentUser.username === "admin"}
                >
                  <option value="permanent">حساب دائم</option>
                  <option value="trial">حساب تجريبي</option>
                </select>
              </div>
              {currentUser.is_trial && (
                <div>
                  <label className="block text-sm font-medium text-amber-700 mb-2 font-bold">
                    تاريخ انتهاء الحساب التجريبي
                  </label>
                  <input
                    type="date"
                    value={currentUser.trial_ends_at ? currentUser.trial_ends_at.split("T")[0] : ""}
                    onChange={(e) =>
                      setCurrentUser({
                        ...currentUser,
                        trial_ends_at: e.target.value,
                      })
                    }
                    className="w-full p-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-amber-50"
                    required
                  />
                </div>
              )}
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 w-full">
                  <input
                    type="checkbox"
                    checked={permissions.all === true}
                    onChange={() => setPermissionKey("all", !permissions.all)}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    disabled={currentUser.username === "admin" || !isRootAdmin}
                  />
                  <span className="font-semibold text-slate-700">كل الصلاحيات بدون قيود</span>
                </label>
              </div>
            </div>
          </div>

          {isRootAdmin && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-bold text-orange-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5" />
                    إدارة المستخدمين ونطاق الموديولات
                  </h3>
                  <p className="text-xs text-orange-800 mt-1">
                    فعّل للمستخدم إمكانية إنشاء وإدارة المستخدمين، ثم اختر الموديولات التي يُسمح له بإنشاء المستخدمين عليها فقط.
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer bg-white border border-orange-200 rounded-xl px-3 py-2">
                  <input
                    type="checkbox"
                    checked={permissions["security.user_management"] === true}
                    onChange={(e) => updatePermissions((prev) => ({
                      ...prev,
                      "security.users": e.target.checked,
                      "security.user_management": e.target.checked,
                      "security.permissions": e.target.checked,
                      ...(e.target.checked ? {} : { "security.user_management.modules": [] }),
                    }))}
                    className="w-4 h-4 accent-orange-500"
                  />
                  <span className="text-sm font-bold text-orange-900">السماح بإدارة المستخدمين</span>
                </label>
              </div>
              {permissions["security.user_management"] === true && (
                <div className="bg-white rounded-xl border border-orange-100 p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <h4 className="font-bold text-slate-800">الموديولات المسموح له بإدارة مستخدمين عليها</h4>
                      <p className="text-xs text-slate-500 mt-1">المستخدم المفوض لن يرى داخل شاشة إنشاء المستخدم إلا هذه الموديولات، ولن يستطيع السيرفر قبول صلاحيات من خارجها.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updatePermissions((prev) => ({ ...prev, "security.user_management.modules": [...new Set([...OPERATIONAL_ITEMS, ...ADMIN_ITEMS, ...EXTRA_PERMISSION_MODULES].map((m) => m.id))] }))}
                      className="text-xs px-3 py-2 rounded-lg bg-orange-100 text-orange-800 hover:bg-orange-200"
                    >
                      تحديد الكل
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2 max-h-72 overflow-y-auto pr-1">
                    {[...OPERATIONAL_ITEMS, ...ADMIN_ITEMS, ...EXTRA_PERMISSION_MODULES].filter((module, index, self) => index === self.findIndex((m) => m.id === module.id)).map((module) => {
                      const scope = Array.isArray(permissions["security.user_management.modules"]) ? permissions["security.user_management.modules"] : [];
                      const checked = scope.includes(module.id);
                      return (
                        <button
                          key={`managed-${module.id}`}
                          type="button"
                          onClick={() => updatePermissions((prev) => {
                            const current = Array.isArray(prev["security.user_management.modules"]) ? prev["security.user_management.modules"] : [];
                            const next = checked ? current.filter((id: string) => id !== module.id) : [...current, module.id];
                            return { ...prev, "security.user_management.modules": next };
                          })}
                          className={`text-right p-2 rounded-lg border text-xs font-semibold transition-colors ${checked ? "bg-orange-100 border-orange-300 text-orange-900" : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"}`}
                        >
                          {checked ? "✓ " : "□ "}{module.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {!isRootAdmin && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-900">
              <strong>نطاقك الإداري:</strong> يمكنك إنشاء وتعديل المستخدمين فقط داخل الموديولات التي حددها لك المدير الرئيسي. الموديولات خارج النطاق مخفية هنا ويتم منعها أيضًا من السيرفر.
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Copy className="w-5 h-5 text-blue-600" />
                  قوالب صلاحيات جاهزة
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  اختار قالب سريع ثم عدّل التفاصيل حسب احتياجك.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    checked={templateMode === "replace"}
                    onChange={() => setTemplateMode("replace")}
                  />
                  استبدال الحالي
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    checked={templateMode === "merge"}
                    onChange={() => setTemplateMode("merge")}
                  />
                  دمج مع الحالي
                </label>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {PERMISSION_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => applyTemplate(template.id)}
                  className="text-right border border-slate-200 rounded-xl p-3 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <div className="font-bold text-slate-800">{template.label}</div>
                  <div className="text-xs text-slate-500 mt-1 leading-5">{template.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-4 xl:col-span-1">
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                الموديولات
              </h3>
              <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
                {allModules.map((module) => {
                  const Icon = module.icon;
                  const isActive = activeModuleId === module.id;
                  const isEnabled = permissions[module.id] === true;
                  const count = grantedCount(module.id);
                  return (
                    <button
                      key={module.id}
                      onClick={() => setActiveModuleId(module.id)}
                      className={`w-full text-right flex items-center justify-between gap-2 rounded-xl border p-3 transition-colors ${
                        isActive ? "border-blue-300 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${isEnabled ? "text-blue-600" : "text-slate-400"}`} />
                        <div>
                          <div className={`text-sm font-semibold ${isEnabled ? "text-slate-800" : "text-slate-500"}`}>{module.label}</div>
                          <div className="text-[11px] text-slate-400">
                            {moduleHasAdvancedGroups(module.id) ? `${count} مفعلة` : "صلاحيات أساسية"}
                          </div>
                        </div>
                      </div>
                      {isEnabled ? <Unlock className="w-4 h-4 text-emerald-500" /> : <Lock className="w-4 h-4 text-slate-300" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 xl:col-span-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-5">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                    {ActiveModuleIcon && <ActiveModuleIcon className="w-5 h-5 text-blue-600" />}
                    صلاحيات {activeModule?.label}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    فعّل الموديول، ثم حدد العمليات الأساسية والتفصيلية الحساسة بدقة.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => toggleModule(activeModuleId)}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                      permissions[activeModuleId] ? "bg-red-50 text-red-700 hover:bg-red-100" : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {permissions[activeModuleId] ? "إيقاف الموديول" : "تشغيل الموديول"}
                  </button>
                  <button
                    onClick={() => setModuleReadOnly(activeModuleId)}
                    className="px-3 py-2 rounded-lg text-sm bg-slate-100 text-slate-700 hover:bg-slate-200"
                  >
                    قراءة فقط
                  </button>
                  <button
                    onClick={() => setModuleFullAccess(activeModuleId, true)}
                    className="px-3 py-2 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    تحكم كامل
                  </button>
                  <button
                    onClick={() => setModuleFullAccess(activeModuleId, false)}
                    className="px-3 py-2 rounded-lg text-sm bg-slate-100 text-slate-700 hover:bg-slate-200"
                  >
                    مسح الموديول
                  </button>
                </div>
              </div>

              <div className="mb-5 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
                {CORE_ACTION_PERMISSIONS.map((action) => (
                  <label
                    key={`${activeModuleId}.${action.id}`}
                    className={`cursor-pointer rounded-xl border p-3 text-center ${
                      permissions[`${activeModuleId}.${action.id}`]
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-slate-50 border-slate-200 text-slate-600"
                    }`}
                    title={action.description}
                  >
                    <input
                      type="checkbox"
                      checked={permissions[`${activeModuleId}.${action.id}`] === true}
                      onChange={() => togglePermissionKey(`${activeModuleId}.${action.id}`)}
                      className="hidden"
                    />
                    <div className="text-xs font-bold">{action.label}</div>
                  </label>
                ))}
              </div>

              {(dynamicModuleSubPermissions[activeModuleId] || []).length > 0 && (
                <div className="mb-5 border border-blue-100 bg-blue-50 rounded-xl p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <h4 className="font-semibold text-blue-900">كل شاشات ومحتويات الموديول</h4>
                      <p className="text-xs text-blue-700 mt-1">لكل شاشة يمكنك فتحها أو إغلاقها، ثم التحكم في أزرار العرض والإضافة والتعديل والحذف والاعتماد والطباعة والتصدير بشكل مستقل.</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {(dynamicModuleSubPermissions[activeModuleId] || []).map((sub) => (
                      <div key={sub.id} className={`bg-white rounded-xl border p-3 ${permissions[sub.id] === true ? "border-blue-200" : "border-slate-200"}`}>
                        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                          <label className="flex items-center gap-2 cursor-pointer min-w-[230px]">
                            <input
                              type="checkbox"
                              checked={permissions[sub.id] === true}
                              onChange={() => togglePermissionKey(sub.id)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="font-semibold text-slate-800">{sub.label}</span>
                          </label>
                          <div className="flex flex-wrap gap-1.5 flex-1">
                            {SCREEN_ACTIONS.map((action) => {
                              const key = `${sub.id}.${action.id}`;
                              const checked = permissions[key] === true;
                              return (
                                <label key={key} className={`cursor-pointer px-2.5 py-1.5 rounded-lg border text-[11px] font-bold ${checked ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-500"}`} title={`${sub.label} - ${action.label}`}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => setScreenAction(sub.id, action.id, !checked)}
                                    className="hidden"
                                  />
                                  {action.label}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  <input
                    value={permissionSearch ?? ""}
                    onChange={(e) => setPermissionSearch(e.target.value)}
                    placeholder="ابحث باسم الصلاحية أو الكود..."
                    className="w-full pr-9 p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <button
                  onClick={clearSensitivePermissions}
                  className="px-3 py-2 rounded-lg text-sm bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 flex items-center gap-1"
                >
                  <ShieldAlert className="w-4 h-4" />
                  إيقاف الحساسة
                </button>
              </div>

              {filteredGroups.length === 0 ? (
                <div className="text-center text-slate-500 py-12 border border-dashed border-slate-200 rounded-xl">
                  لا توجد صلاحيات تفصيلية مطابقة لهذا البحث.
                </div>
              ) : (
                <div className="space-y-5">
                  {filteredGroups.map((group) => (
                    <div key={`${group.moduleId}-${group.section}`} className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 px-4 py-3 flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-slate-800">{group.section}</h4>
                          {group.description && <p className="text-xs text-slate-500 mt-1">{group.description}</p>}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              updatePermissions((prev) => {
                                const output = { ...prev, [activeModuleId]: true, [`${activeModuleId}.read`]: true };
                                group.permissions.forEach((permission) => {
                                  output[permission.id] = true;
                                });
                                return output;
                              });
                            }}
                            className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-100"
                          >
                            تفعيل المجموعة
                          </button>
                          <button
                            onClick={() => {
                              updatePermissions((prev) => {
                                const output = { ...prev };
                                group.permissions.forEach((permission) => {
                                  output[permission.id] = false;
                                });
                                return output;
                              });
                            }}
                            className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200"
                          >
                            إيقاف المجموعة
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
                        {group.permissions.map((permission) => {
                          const risk = permission.risk || "normal";
                          const checked = permissions[permission.id] === true;
                          return (
                            <label
                              key={permission.id}
                              className={`cursor-pointer rounded-xl border p-3 transition-colors ${
                                checked ? riskClasses[risk] : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    updatePermissions((prev) => ({
                                      ...prev,
                                      [activeModuleId]: true,
                                      [`${activeModuleId}.read`]: true,
                                      [permission.id]: !prev[permission.id],
                                    }));
                                  }}
                                  className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <div className="flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-sm">{permission.label}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${riskClasses[risk]}`}>
                                      {riskLabel[risk]}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-400 mt-1 dir-ltr text-left">{permission.id}</div>
                                  {permission.description && (
                                    <div className="text-xs text-slate-500 mt-1">{permission.description}</div>
                                  )}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-purple-600" />
              حدود تشغيل متقدمة
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">أقصى خصم %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={limits.max_discount_percent ?? ""}
                  onChange={(e) => updateLimit("max_discount_percent", e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="مثال: 10"
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">أقصى مبلغ مرتجع</label>
                <input
                  type="number"
                  min="0"
                  value={limits.max_refund_amount ?? ""}
                  onChange={(e) => updateLimit("max_refund_amount", e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="مثال: 500"
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">أقصى قيمة فاتورة</label>
                <input
                  type="number"
                  min="0"
                  value={limits.max_order_amount ?? ""}
                  onChange={(e) => updateLimit("max_order_amount", e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="اتركه فارغ بدون حد"
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">طرق الدفع المسموحة</label>
                <input
                  type="text"
                  value={limits.allowed_payment_methods ?? ""}
                  onChange={(e) => updateLimit("allowed_payment_methods", e.target.value)}
                  placeholder="cash,visa,wallet"
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <input
                  type="checkbox"
                  checked={limits.require_manager_for_discount === true}
                  onChange={() => updateLimit("require_manager_for_discount", !limits.require_manager_for_discount)}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <span className="text-sm font-medium text-slate-700">أي خصم يحتاج موافقة مدير</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <input
                  type="checkbox"
                  checked={permissions.can_edit === true}
                  onChange={() => setPermissionKey("can_edit", !permissions.can_edit)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700">توافق قديم: السماح بالتعديل العام</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <input
                  type="checkbox"
                  checked={permissions.can_delete === true}
                  onChange={() => setPermissionKey("can_delete", !permissions.can_delete)}
                  className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                />
                <span className="text-sm font-medium text-slate-700">توافق قديم: السماح بالحذف العام</span>
              </label>
              <button
                onClick={() => updatePermissions((prev) => ({ ...prev, limits: {} }))}
                className="bg-slate-100 text-slate-700 rounded-lg px-3 py-2 flex items-center justify-center gap-2 hover:bg-slate-200"
              >
                <RotateCcw className="w-4 h-4" />
                تصفير الحدود
              </button>
            </div>
          </div>

          <div className="sticky bottom-0 bg-white rounded-xl shadow-lg p-4 flex justify-between items-center border border-slate-200">
            <div className="text-sm text-slate-500">
              الصلاحيات المفعلة حاليًا:{" "}
              <span className="font-bold text-emerald-700">
                {Object.values(permissions).filter((value) => value === true).length}
              </span>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsEditing(false)}
                className="px-6 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                حفظ الصلاحيات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
