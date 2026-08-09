type BrowserCacheEntry<T> = { value: T; expiresAt: number };

export function readBrowserCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const entry = JSON.parse(window.localStorage.getItem(key) || "null") as BrowserCacheEntry<T> | null;
    if (!entry || entry.expiresAt <= Date.now()) {
      window.localStorage.removeItem(key);
      return null;
    }
    return entry.value;
  } catch {
    return null;
  }
}

export function writeBrowserCache<T>(key: string, value: T, ttlMs: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify({ value, expiresAt: Date.now() + ttlMs } satisfies BrowserCacheEntry<T>));
  } catch {
    // Storage can be unavailable in private browsing; HTTP caching still applies.
  }
}
