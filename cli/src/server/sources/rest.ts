import type { RestSourceConfig } from '../../config/schema.js';
import { parseDuration } from '../../utils/parseDuration.js';
import { expandEnv } from '../../utils/expandEnv.js';
import type { SourceAdapter, SourceStatus } from './types.js';

function extractPath(obj: unknown, path: string): unknown[] {
  let current: unknown = obj;
  for (const key of path.split('.')) {
    if (current == null || typeof current !== 'object') return [];
    current = (current as Record<string, unknown>)[key];
  }
  return Array.isArray(current) ? current : [];
}

export class RestSourceAdapter implements SourceAdapter {
  private data: unknown[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastFetch: Date | null = null;
  private error?: string;
  private listeners = new Set<(data: unknown[]) => void>();

  constructor(private config: RestSourceConfig) {}

  async start(): Promise<void> {
    await this.fetch();
    const interval = this.config.interval ? parseDuration(this.config.interval) : 30_000;
    this.timer = setInterval(() => this.fetch(), interval);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getData(): unknown[] {
    return this.data;
  }

  getStatus(): SourceStatus {
    return {
      healthy: !this.error,
      rowCount: this.data.length,
      lastFetch: this.lastFetch,
      error: this.error,
    };
  }

  onUpdate(callback: (data: unknown[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  async refresh(): Promise<void> {
    await this.fetch();
  }

  private async fetch(): Promise<void> {
    try {
      let url = expandEnv(this.config.url, 'rest source URL');
      if (this.config.params) {
        const expanded: Record<string, string> = {};
        for (const [k, v] of Object.entries(this.config.params)) {
          expanded[k] = expandEnv(v, `rest source param "${k}"`);
        }
        const params = new URLSearchParams(expanded);
        url += (url.includes('?') ? '&' : '?') + params.toString();
      }

      const headers = this.buildHeaders();

      const res = await globalThis.fetch(url, { headers });

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

      const json = await res.json();
      this.data = this.config.dataPath ? extractPath(json, this.config.dataPath) : (Array.isArray(json) ? json : [json]);
      this.lastFetch = new Date();
      this.error = undefined;
      this.notify();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  private notify(): void {
    for (const cb of this.listeners) cb(this.data);
  }

  /**
   * Build the final HTTP headers for one fetch.
   *
   * Two sources contribute, in order: any user-declared `headers` (with
   * env-var interpolation applied per value), then the `auth` helper
   * (currently just `bearer`). Auth wins on collision — if a user sets
   * both `headers.Authorization` and `auth.kind === 'bearer'`, the bearer
   * helper is what they actually meant.
   */
  private buildHeaders(): Record<string, string> | undefined {
    const headers: Record<string, string> = {};
    if (this.config.headers) {
      for (const [k, v] of Object.entries(this.config.headers)) {
        headers[k] = expandEnv(v, `rest source header "${k}"`);
      }
    }
    if (this.config.auth?.kind === 'bearer') {
      const token = expandEnv(this.config.auth.token, 'rest source bearer token');
      headers['Authorization'] = `Bearer ${token}`;
    }
    return Object.keys(headers).length > 0 ? headers : undefined;
  }
}
