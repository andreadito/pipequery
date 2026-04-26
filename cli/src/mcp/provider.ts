import type { DataContext } from '../engine.js';
import type { EndpointConfig, PipeQueryConfig } from '../config/schema.js';
import type { SourceStatus } from '../server/sources/types.js';
import { SourceManager } from '../server/sources/manager.js';

export interface ProviderSourceInfo {
  name: string;
  status: SourceStatus;
}

export interface ProviderSourceDescription {
  name: string;
  status: SourceStatus;
  sample: unknown[];
  fields: string[];
}

export interface Provider {
  listSources(): Promise<ProviderSourceInfo[]>;
  describeSource(name: string, sampleSize?: number): Promise<ProviderSourceDescription | undefined>;
  listEndpoints(): Promise<Array<{ path: string; config: EndpointConfig }>>;
  callEndpoint(path: string): Promise<unknown>;
  runQuery(expression: string): Promise<unknown>;
  dispose(): Promise<void>;
}

// ─── LocalProvider ──────────────────────────────────────────────────────────
// Boots its own SourceManager from a loaded config. Used when `pq mcp serve`
// runs standalone (no attached `pq serve` daemon).

export class LocalProvider implements Provider {
  private sourceManager: SourceManager;
  private endpoints: Map<string, EndpointConfig>;
  private ready: Promise<void>;

  constructor(private config: PipeQueryConfig, cwd: string) {
    this.sourceManager = new SourceManager(cwd);
    this.endpoints = new Map(Object.entries(config.endpoints));
    this.ready = this.bootSources();
  }

  private async bootSources(): Promise<void> {
    for (const [name, src] of Object.entries(this.config.sources)) {
      try {
        await this.sourceManager.addSource(name, src);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Print to stderr; stdout is reserved for the MCP JSON-RPC stream in stdio mode.
        process.stderr.write(`[pipequery-mcp] Source "${name}" failed to start: ${msg}\n`);
      }
    }
  }

  async listSources(): Promise<ProviderSourceInfo[]> {
    await this.ready;
    const statuses = this.sourceManager.getAllStatuses();
    return Object.entries(statuses).map(([name, status]) => ({ name, status }));
  }

  async describeSource(name: string, sampleSize = 5): Promise<ProviderSourceDescription | undefined> {
    await this.ready;
    const status = this.sourceManager.getSourceStatus(name);
    const data = this.sourceManager.getSourceData(name);
    if (!status || !data) return undefined;

    const sample = data.slice(0, sampleSize);
    const fields = inferFields(data);
    return { name, status, sample, fields };
  }

  async listEndpoints(): Promise<Array<{ path: string; config: EndpointConfig }>> {
    await this.ready;
    return [...this.endpoints].map(([path, config]) => ({ path, config }));
  }

  async callEndpoint(path: string): Promise<unknown> {
    await this.ready;
    const endpoint = this.endpoints.get(path);
    if (!endpoint) {
      throw new Error(`Endpoint "${path}" not found`);
    }
    return this.sourceManager.runQuery(endpoint.query);
  }

  async runQuery(expression: string): Promise<unknown> {
    await this.ready;
    return this.sourceManager.runQuery(expression);
  }

  async dispose(): Promise<void> {
    await this.sourceManager.dispose();
  }

  // Exposed for the HTTP plugin that wants to mount the MCP server into an
  // existing `createServer` instance; the caller passes in their own manager.
  static withSourceManager(sourceManager: SourceManager, endpoints: Map<string, EndpointConfig>): Provider {
    return new AttachedLocalProvider(sourceManager, endpoints);
  }
}

class AttachedLocalProvider implements Provider {
  constructor(private sourceManager: SourceManager, private endpoints: Map<string, EndpointConfig>) {}

  async listSources(): Promise<ProviderSourceInfo[]> {
    const statuses = this.sourceManager.getAllStatuses();
    return Object.entries(statuses).map(([name, status]) => ({ name, status }));
  }

  async describeSource(name: string, sampleSize = 5): Promise<ProviderSourceDescription | undefined> {
    const status = this.sourceManager.getSourceStatus(name);
    const data = this.sourceManager.getSourceData(name);
    if (!status || !data) return undefined;
    return { name, status, sample: data.slice(0, sampleSize), fields: inferFields(data) };
  }

  async listEndpoints() {
    return [...this.endpoints].map(([path, config]) => ({ path, config }));
  }

  async callEndpoint(path: string): Promise<unknown> {
    const endpoint = this.endpoints.get(path);
    if (!endpoint) throw new Error(`Endpoint "${path}" not found`);
    return this.sourceManager.runQuery(endpoint.query);
  }

  async runQuery(expression: string): Promise<unknown> {
    return this.sourceManager.runQuery(expression);
  }

  async dispose(): Promise<void> {
    // Intentionally noop: the owning server disposes the SourceManager.
  }
}

// ─── AttachedProvider ───────────────────────────────────────────────────────
// Talks to a running `pq serve` via its existing /api/_control/* endpoints.

export class AttachedProvider implements Provider {
  constructor(private baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) throw new Error(`GET ${path} failed: HTTP ${res.status}`);
    return res.json() as Promise<T>;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${path} failed: HTTP ${res.status}`);
    return res.json() as Promise<T>;
  }

  async listSources(): Promise<ProviderSourceInfo[]> {
    const statuses = await this.get<Record<string, SourceStatus>>('/api/_control/sources');
    return Object.entries(statuses).map(([name, status]) => ({ name, status }));
  }

  async describeSource(name: string, sampleSize = 5): Promise<ProviderSourceDescription | undefined> {
    const res = await this.post<{
      ok: boolean;
      error?: string;
      rowCount?: number;
      sample?: unknown[];
      status?: SourceStatus;
    }>(`/api/_control/sources/${encodeURIComponent(name)}/test`, {});
    if (!res.ok || !res.status || !res.sample) return undefined;
    return {
      name,
      status: res.status,
      sample: res.sample.slice(0, sampleSize),
      fields: inferFields(res.sample),
    };
  }

  async listEndpoints() {
    const endpoints = await this.get<Record<string, EndpointConfig>>('/api/_control/endpoints');
    return Object.entries(endpoints).map(([path, config]) => ({ path, config }));
  }

  async callEndpoint(path: string): Promise<unknown> {
    // Just hit the actual public endpoint on the running server.
    const normalized = path.startsWith('/') ? path : `/${path}`;
    const res = await fetch(`${this.baseUrl}${normalized}`);
    if (!res.ok) throw new Error(`GET ${normalized} failed: HTTP ${res.status}`);
    return res.json();
  }

  async runQuery(expression: string): Promise<unknown> {
    const res = await this.post<{ ok: boolean; result?: unknown; error?: string }>(
      '/api/_control/query',
      { query: expression },
    );
    if (!res.ok) throw new Error(res.error ?? 'Query failed');
    return res.result;
  }

  async dispose(): Promise<void> {
    // Stateless — nothing to clean up.
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function inferFields(rows: unknown[]): string[] {
  const fields = new Set<string>();
  for (const row of rows.slice(0, 20)) {
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      for (const k of Object.keys(row)) fields.add(k);
    }
  }
  return [...fields];
}

export type { DataContext };
