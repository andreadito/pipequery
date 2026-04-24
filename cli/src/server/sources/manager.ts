import type { SourceConfig } from '../../config/schema.js';
import type { SourceAdapter, SourceStatus } from './types.js';
import { RestSourceAdapter } from './rest.js';
import { WebSocketSourceAdapter } from './websocket.js';
import { FileSourceAdapter } from './file.js';
import { StaticSourceAdapter } from './static.js';
import { PostgresSourceAdapter } from './postgres.js';
import { MysqlSourceAdapter } from './mysql.js';
import { SqliteSourceAdapter } from './sqlite.js';

export type DataContext = Record<string, unknown[]>;

type UpdateListener = (sourceName: string, data: unknown[]) => void;

interface ManagedSource {
  config: SourceConfig;
  adapter: SourceAdapter;
  unsubscribe?: () => void;
}

export class SourceManager {
  private sources = new Map<string, ManagedSource>();
  private globalListeners = new Set<UpdateListener>();

  constructor(private cwd: string) {}

  async addSource(name: string, config: SourceConfig): Promise<void> {
    // Stop existing source with same name if present
    if (this.sources.has(name)) {
      this.removeSource(name);
    }

    const adapter = this.createAdapter(config);
    const entry: ManagedSource = { config, adapter };

    // Subscribe to updates and notify global listeners
    entry.unsubscribe = adapter.onUpdate((data) => {
      for (const listener of this.globalListeners) {
        listener(name, data);
      }
    });

    this.sources.set(name, entry);
    await adapter.start();
  }

  removeSource(name: string): boolean {
    const entry = this.sources.get(name);
    if (!entry) return false;
    entry.unsubscribe?.();
    entry.adapter.stop();
    this.sources.delete(name);
    return true;
  }

  getContext(): DataContext {
    const ctx: DataContext = {};
    for (const [name, { adapter }] of this.sources) {
      ctx[name] = adapter.getData();
    }
    return ctx;
  }

  getSourceData(name: string): unknown[] | undefined {
    return this.sources.get(name)?.adapter.getData();
  }

  getSourceStatus(name: string): SourceStatus | undefined {
    return this.sources.get(name)?.adapter.getStatus();
  }

  getAllStatuses(): Record<string, SourceStatus> {
    const result: Record<string, SourceStatus> = {};
    for (const [name, { adapter }] of this.sources) {
      result[name] = adapter.getStatus();
    }
    return result;
  }

  getSourceNames(): string[] {
    return [...this.sources.keys()];
  }

  /**
   * Subscribe to data updates from any source.
   * Used by SSE endpoint for real-time push to TUI clients.
   * Returns unsubscribe function.
   */
  onSourceUpdate(callback: UpdateListener): () => void {
    this.globalListeners.add(callback);
    return () => this.globalListeners.delete(callback);
  }

  async refreshAll(): Promise<void> {
    await Promise.all(
      [...this.sources.values()].map(({ adapter }) => adapter.refresh?.() ?? Promise.resolve()),
    );
  }

  async dispose(): Promise<void> {
    this.globalListeners.clear();
    for (const entry of this.sources.values()) {
      entry.unsubscribe?.();
      entry.adapter.stop();
    }
    this.sources.clear();
  }

  private createAdapter(config: SourceConfig): SourceAdapter {
    switch (config.type) {
      case 'rest':
        return new RestSourceAdapter(config);
      case 'websocket':
        return new WebSocketSourceAdapter(config);
      case 'file':
        return new FileSourceAdapter(config, this.cwd);
      case 'static':
        return new StaticSourceAdapter(config);
      case 'postgres':
        return new PostgresSourceAdapter(config);
      case 'mysql':
        return new MysqlSourceAdapter(config);
      case 'sqlite':
        return new SqliteSourceAdapter(config, this.cwd);
      default:
        throw new Error(`Unknown source type: ${(config as { type: string }).type}`);
    }
  }
}
