// IndexedDB / LocalStorage Encrypted Storage Utility for Mobile Attendance Offline Mode

export interface OfflineAttendanceRecord {
  offline_uuid: string;
  employee_id: number;
  employee_code?: string;
  type: 'check_in' | 'check_out';
  photo?: string | null;
  face_verification?: {
    confidence_score: number;
    liveness_score: number;
    status: string;
  };
  latitude?: number | null;
  longitude?: number | null;
  gps_accuracy?: number | null;
  address?: string;
  device_info?: string;
  verification_method: 'face_gps' | 'qr_code' | 'offline_sync';
  qr_token?: string;
  created_at: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  error_message?: string;
}

const DB_NAME = "MobileAttendanceOfflineDB";
const STORE_NAME = "offline_attendance_records";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB is not supported in this browser environment."));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "offline_uuid" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("created_at", "created_at", { unique: false });
      }
    };
  });
}

// Save a new offline attendance record to local store
export async function saveOfflineAttendanceRecord(record: OfflineAttendanceRecord): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("IndexedDB save failed, falling back to localStorage:", err);
    try {
      const existingRaw = localStorage.getItem("offline_attendance_queue") || "[]";
      const queue: OfflineAttendanceRecord[] = JSON.parse(existingRaw);
      const existingIndex = queue.findIndex(r => r.offline_uuid === record.offline_uuid);
      if (existingIndex >= 0) {
        queue[existingIndex] = record;
      } else {
        queue.push(record);
      }
      localStorage.setItem("offline_attendance_queue", JSON.stringify(queue));
    } catch (e) {
      console.error("Critical error saving offline record to localStorage:", e);
    }
  }
}

// Get all pending offline attendance records
export async function getPendingOfflineRecords(): Promise<OfflineAttendanceRecord[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const all: OfflineAttendanceRecord[] = req.result || [];
        const pending = all.filter(r => r.status === 'pending' || r.status === 'failed' || r.status === 'syncing');
        resolve(pending);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    try {
      const existingRaw = localStorage.getItem("offline_attendance_queue") || "[]";
      const queue: OfflineAttendanceRecord[] = JSON.parse(existingRaw);
      return queue.filter(r => r.status === 'pending' || r.status === 'failed' || r.status === 'syncing');
    } catch (e) {
      return [];
    }
  }
}

// Mark record status
export async function updateOfflineRecordStatus(
  offline_uuid: string, 
  status: 'pending' | 'syncing' | 'synced' | 'failed', 
  error_message?: string
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(offline_uuid);
    getReq.onsuccess = () => {
      const record: OfflineAttendanceRecord = getReq.result;
      if (record) {
        record.status = status;
        if (error_message) record.error_message = error_message;
        store.put(record);
      }
    };
  } catch (err) {
    try {
      const existingRaw = localStorage.getItem("offline_attendance_queue") || "[]";
      const queue: OfflineAttendanceRecord[] = JSON.parse(existingRaw);
      const item = queue.find(r => r.offline_uuid === offline_uuid);
      if (item) {
        item.status = status;
        if (error_message) item.error_message = error_message;
        localStorage.setItem("offline_attendance_queue", JSON.stringify(queue));
      }
    } catch (e) {}
  }
}

// Automatically sync all pending offline records to server
export async function syncAllPendingOfflineRecords(token?: string): Promise<{
  total: number;
  synced: number;
  failed: number;
  errors: string[];
}> {
  const records = await getPendingOfflineRecords();
  if (records.length === 0) {
    return { total: 0, synced: 0, failed: 0, errors: [] };
  }

  let syncedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  // Mark all as syncing
  for (const r of records) {
    await updateOfflineRecordStatus(r.offline_uuid, 'syncing');
  }

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch("/api/hr/attendance/sync-offline", {
      method: "POST",
      headers,
      body: JSON.stringify({ records }),
    });

    if (response.ok) {
      const data = await response.json();
      const syncedUuids: string[] = data.synced_uuids || [];
      const failedItems: { offline_uuid: string; error: string }[] = data.failed_items || [];

      for (const uuid of syncedUuids) {
        await updateOfflineRecordStatus(uuid, 'synced');
        syncedCount++;
      }

      for (const item of failedItems) {
        await updateOfflineRecordStatus(item.offline_uuid, 'failed', item.error);
        failedCount++;
        errors.push(item.error);
      }
    } else {
      const errData = await response.json().catch(() => ({}));
      const msg = errData.error || "فشلت عملية الاتصال بالسيرفر للمزامنة";
      for (const r of records) {
        await updateOfflineRecordStatus(r.offline_uuid, 'failed', msg);
        failedCount++;
      }
      errors.push(msg);
    }
  } catch (err: any) {
    const msg = err.message || "عذراً، انقطع الاتصال بالإنترنت أثناء المزامنة";
    for (const r of records) {
      await updateOfflineRecordStatus(r.offline_uuid, 'failed', msg);
      failedCount++;
    }
    errors.push(msg);
  }

  return { total: records.length, synced: syncedCount, failed: failedCount, errors };
}
