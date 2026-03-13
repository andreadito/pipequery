interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

export class ResponseCache {
  private entries = new Map<string, CacheEntry>();

  get(key: string): unknown | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.data;
  }

  set(key: string, data: unknown, ttlMs: number): void {
    this.entries.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  invalidate(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}
