import { Injectable } from "@angular/core";

const STORAGE_KEY_PREFIX = "zenithdb_";

@Injectable({ providedIn: "root" })
export class LocalStorageService {
  get<T>(key: string): T | null {
    const item = localStorage.getItem(STORAGE_KEY_PREFIX + key);
    if (!item) return null;
    try {
      return JSON.parse(item) as T;
    } catch {
      return null;
    }
  }

  set<T>(key: string, value: T): void {
    localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value));
  }

  remove(key: string): void {
    localStorage.removeItem(STORAGE_KEY_PREFIX + key);
  }

  clear(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  }
}