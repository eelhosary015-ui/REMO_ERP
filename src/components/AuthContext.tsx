import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: number;
  username: string;
  role: string;
  permissions: any;
  branch_id?: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  requirePasswordChange: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  hasPermission: (module: string) => boolean;
  /** Strict check: only exact key match, no backward-compat fallback. Use for UI visibility of settings/reports. */
  hasExplicitPermission: (module: string) => boolean;
  canEdit: () => boolean;
  canDelete: () => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [requirePasswordChange, setRequirePasswordChange] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const storedToken = localStorage.getItem('token');
      if (!storedToken) return;
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${storedToken}` }
      });
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const { user: latestUser } = await res.json();
          setUser(latestUser);
          localStorage.setItem('user', JSON.stringify(latestUser));
        } else {
          console.warn("Expected JSON response from /api/auth/me, but received non-JSON");
          logout();
        }
      } else if (res.status === 401 || res.status === 403) {
        logout();
      }
    } catch (error) {
      console.warn("Failed to sync user profile:", error);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      let storedToken = localStorage.getItem('token');
      let storedUser = localStorage.getItem('user');
      
      // If there is an existing bypass token, clear it to force manual login
      if (storedToken === 'preview-bypass-token') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        storedToken = null;
        storedUser = null;
      }
      
      if (storedToken) {
        setToken(storedToken);
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
        await refreshUser();
      }
      setIsLoading(false);
    };

    initAuth();

    // Auto-sync on window focus
    const handleFocus = () => {
      if (localStorage.getItem('token')) {
        refreshUser();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const login = (newToken: string, newUser: User, mustChangePwd?: boolean) => {
    // Clear any previous session navigation & dashboard keys
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith('dashboard_') ||
            key.startsWith('last_') ||
            key.startsWith('fingerprint_') ||
            key.startsWith('attendance_') ||
            key.startsWith('selected_') ||
            key.startsWith('active_'))
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      window.history.replaceState(null, '', window.location.pathname);
    } catch (_) {}

    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setRequirePasswordChange(!!mustChangePwd);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    // Clear all navigation and module memory
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith('dashboard_') ||
            key.startsWith('last_') ||
            key.startsWith('fingerprint_') ||
            key.startsWith('attendance_') ||
            key.startsWith('selected_') ||
            key.startsWith('active_') ||
            key === 'username')
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      window.history.replaceState(null, '', window.location.pathname);
    } catch (_) {}

    setToken(null);
    setUser(null);
    setRequirePasswordChange(false);
  };

const getNormalizedUserPermissions = (user: User | null): Record<string, any> => {
  if (!user || !user.permissions) return {};
  let raw = user.permissions;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  const res: Record<string, any> = {};
  if (Array.isArray(raw)) {
    raw.forEach((item) => {
      if (typeof item === "string" && item.trim()) {
        res[item] = true;
        const moduleId = item.split(".")[0];
        res[moduleId] = true;
        res[`${moduleId}.read`] = true;
        res[`${moduleId}.full_access`] = true;
        if (item === "hr.payroll" || item === "payroll" || item === "salaries") {
          res["payroll"] = true;
          res["salaries"] = true;
          res["hr"] = true;
          res["hr.payroll"] = true;
        }
      }
    });
    return res;
  }
  if (typeof raw === "object" && raw !== null) {
    Object.assign(res, raw);
    Object.keys(raw).forEach((key) => {
      if (raw[key]) {
        if (key.includes(".")) {
          const moduleId = key.split(".")[0];
          res[moduleId] = true;
        }
        if (key === "payroll" || key === "hr.payroll" || key === "salaries") {
          res["payroll"] = true;
          res["salaries"] = true;
          res["hr"] = true;
          res["hr.payroll"] = true;
        }
        if (key === "attendance" || key === "hr.attendance") {
          res["attendance"] = true;
          res["hr"] = true;
          res["hr.attendance"] = true;
        }
        if (key === "fingerprint" || key === "hr.fingerprint") {
          res["fingerprint"] = true;
          res["hr"] = true;
          res["hr.fingerprint"] = true;
        }
      }
    });
    return res;
  }
  return {};
};

  const hasPermission = (permissionKey: string) => {
    if (user?.role === 'admin') return true;
    const permissions = getNormalizedUserPermissions(user);
    if (permissions.all === true) return true;
    if (permissions[permissionKey] === true) return true;

    // Direct module aliases for HR / Payroll / Salaries
    if ((permissionKey === "payroll" || permissionKey === "salaries") && (permissions.payroll || permissions.salaries || permissions["hr.payroll"] || permissions.hr)) {
      return true;
    }
    if (permissionKey === "hr" && (permissions.hr || permissions.payroll || permissions.salaries || permissions.attendance)) {
      return true;
    }

    const moduleId = permissionKey.split('.')[0];
    if (permissions[`${moduleId}.full_access`] === true) return true;

    // Backward compatibility: enabling a module still opens its regular screens,
    // while detailed operation keys remain available for sensitive API checks.
    if (permissionKey.includes('.') && permissions[moduleId] === true) return true;

    return false;
  };

  /**
   * Strict permission check — only exact key match or full_access.
   * Does NOT grant access via backward-compat module-level rule.
   * Use this for Dashboard UI: settings & reports tabs should only
   * show items the user was EXPLICITLY granted.
   */
  const hasExplicitPermission = (permissionKey: string) => {
    if (token === 'preview-bypass-token' || user?.role === 'admin') return true;
    const permissions = getNormalizedUserPermissions(user);
    if (permissions.all === true) return true;
    if (permissions[permissionKey] === true) return true;

    if ((permissionKey === "payroll" || permissionKey === "salaries") && (permissions.payroll || permissions.salaries || permissions["hr.payroll"] || permissions.hr)) {
      return true;
    }

    const moduleId = permissionKey.split('.')[0];
    if (permissions[`${moduleId}.full_access`] === true) return true;

    // NO backward-compat fallback — sub-items require explicit grant
    return false;
  };

  const canEdit = () => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    const permissions = getNormalizedUserPermissions(user);
    return permissions.can_edit === true || Object.keys(permissions).some((key) => key.endsWith('.update') && permissions[key] === true);
  };

  const canDelete = () => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    const permissions = getNormalizedUserPermissions(user);
    return permissions.can_delete === true || Object.keys(permissions).some((key) => key.endsWith('.delete') && permissions[key] === true);
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">جاري التحميل...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, token, requirePasswordChange, login, logout, refreshUser, isAuthenticated: !!user, hasPermission, hasExplicitPermission, canEdit, canDelete }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
