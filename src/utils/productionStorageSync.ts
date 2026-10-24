import { api } from "./api";

export const PRODUCTION_DB_KEYS = [
  "remo_production_products",
  "remo_production_boms",
  "remo_production_orders",
  "remo_production_workcenters",
  "remo_production_shopfloor",
  "remo_production_mrp",
  "remo_production_maintenance",
  "remo_pro_quality_control_points",
  "remo_pro_quality_checks",
  "remo_pro_quality_alerts",
  "remo_pro_quality_teams",
  "remo_pro_quality_final_certs",
  "remo_pro_inventory_capitalized_posts"
];

const productionKeySet = new Set(PRODUCTION_DB_KEYS);

async function loadDbValue(key: string) {
  try {
    const res = await api.get(`/api/system/settings/${key}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (_e) {
    return null;
  }
}

async function saveDbValue(key: string, value: string | null) {
  if (value === null) return;
  let parsed: any = value;
  try {
    parsed = JSON.parse(value);
  } catch {
    parsed = value;
  }
  await api.post("/api/system/settings", { key, value: parsed });
}

/**
 * Hydrates production/MRP/quality data from PostgreSQL-backed system_settings
 * into localStorage so legacy production screens continue to work while data
 * is shared between devices and users.
 */
export async function syncProductionStorageFromDatabase() {
  if (!localStorage.getItem('token')) return;
  const originalSetItem = (window as any).__remo_proOriginalSetItem || localStorage.setItem.bind(localStorage);
  await Promise.all(PRODUCTION_DB_KEYS.map(async (key) => {
    try {
      if (!localStorage.getItem('token')) return;
      const dbValue = await loadDbValue(key);
      if (dbValue !== null && dbValue !== undefined) {
        originalSetItem(key, JSON.stringify(dbValue));
      }
    } catch (_error) {
      // Ignore background sync errors when unauthorized
    }
  }));
}

/**
 * Automatically mirrors legacy localStorage writes into PostgreSQL for all
 * production-related keys.
 */
export function installProductionStorageSync() {
  if (typeof window === "undefined") return;
  if ((window as any).__remo_proProductionStorageSyncInstalled) return;

  const originalSetItem = localStorage.setItem.bind(localStorage);
  const originalRemoveItem = localStorage.removeItem.bind(localStorage);
  (window as any).__remo_proOriginalSetItem = originalSetItem;

  localStorage.setItem = (key: string, value: string) => {
    originalSetItem(key, value);
    if (productionKeySet.has(key)) {
      saveDbValue(key, value).catch((error) => {
        console.warn(`Failed to mirror production storage key ${key} to database`, error);
      });
    }
  };

  localStorage.removeItem = (key: string) => {
    originalRemoveItem(key);
    if (productionKeySet.has(key)) {
      api.post("/api/system/settings", { key, value: [] }).catch((error) => {
        console.warn(`Failed to clear production storage key ${key} in database`, error);
      });
    }
  };

  (window as any).__remo_proProductionStorageSyncInstalled = true;
}
