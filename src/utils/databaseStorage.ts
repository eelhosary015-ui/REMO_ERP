import { api } from './api';

/**
 * Utility to persist data in the database instead of localStorage
 * Uses the system_settings table as a key-value store
 */
export const databaseStorage = {
  async getItem<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const res = await api.get(`/api/system/settings/${key}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error(`Failed to fetch ${key} from database`, e);
    }
    
    // Fallback to localStorage if database fails or entry doesn't exist
    const local = localStorage.getItem(key);
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {}
    }
    
    return defaultValue;
  },

  async setItem(key: string, value: any): Promise<void> {
    // Sync with database
    try {
      await api.post('/api/system/settings', { key, value });
    } catch (e) {
      console.error(`Failed to save ${key} to database`, e);
    }
    
    // Also sync with localStorage for immediate availability/fallback
    localStorage.setItem(key, JSON.stringify(value));
  }
};
