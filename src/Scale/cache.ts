export interface CacheStore {
  get(key: string): unknown | null;
  set(key: string, value: unknown, ttlMs: number): void;
  delete(key: string): void;
  clear(): void;
}

interface Entry {
  value: unknown;
  expiresAt: number;
}

export interface MemoryCacheOptions {
  maxEntries?: number;
}

export function createMemoryCache(options?: MemoryCacheOptions): CacheStore {
  const maxEntries =
    options && typeof options.maxEntries === "number"
      ? options.maxEntries
      : 1000;
  const store = new Map<string, Entry>();
  return {
    get(key: string): unknown | null {
      const entry = store.get(key);
      if (entry === undefined) {
        return null;
      }
      if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    set(key: string, value: unknown, ttlMs: number): void {
      if (store.has(key)) {
        store.delete(key);
      }
      store.set(key, { value: value, expiresAt: Date.now() + ttlMs });
      while (store.size > maxEntries) {
        const oldest = store.keys().next().value;
        if (oldest === undefined) {
          break;
        }
        store.delete(oldest);
      }
    },
    delete(key: string): void {
      store.delete(key);
    },
    clear(): void {
      store.clear();
    },
  };
}
