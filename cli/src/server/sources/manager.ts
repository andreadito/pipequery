import type { SourceConfig } from '../../config/schema.js';
import type { PushdownResult, SourceAdapter, SourceStatus } from './types.js';
import { RestSourceAdapter } from './rest.js';
import { WebSocketSourceAdapter } from './websocket.js';
import { FileSourceAdapter } from './file.js';
import { StaticSourceAdapter } from './static.js';
import { PostgresSourceAdapter } from './postgres.js';
import { MysqlSourceAdapter } from './mysql.js';
import { SqliteSourceAdapter } from './sqlite.js';
import { KafkaSourceAdapter } from './kafka.js';
import { SnowflakeSourceAdapter } from './snowflake.js';
import { ClickhouseSourceAdapter } from './clickhouse.js';
import { MongoSourceAdapter } from './mongodb.js';
import { parseQuery, query } from '../../engine.js';

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

  /**
   * Run a pipe expression, preferring adapter-native push-down when the
   * source supports it.
   *
   * Decision tree:
   *   1. Parse the expression. If it can't parse, fall straight through to
   *      the in-process engine, which will throw the same parse error a
   *      caller would have seen before push-down existed (no behaviour
   *      change for malformed input).
   *   2. Look up the source named in the pipeline. If it exists and its
   *      adapter exposes `runPushdown`, try it. On `{ ok: true }` we're
   *      done — return the rows. On `{ ok: false }` (decline) or any
   *      thrown error, fall back to in-process.
   *   3. In-process: query(getContext(), expression) — the existing path.
   *
   * The push-down attempt is best-effort and *invisible to callers*: same
   * return type as `query()`, no new failure modes. Telemetry (which
   * branch ran, latency, source-engine SQL) belongs in the audit log when
   * Phase 5 lands; not threaded through here.
   */
  async runQuery(expression: string): Promise<unknown> {
    const pushed = await this.tryPushdown(expression);
    if (pushed && pushed.ok) return pushed.rows;
    return query(this.getContext(), expression);
  }

  /**
   * Inspect the pipeline AST and dispatch to an adapter's runPushdown when
   * eligible. Returns `null` when push-down isn't even attempted (no parse,
   * no source, no capability). Returns a PushdownResult when it was tried —
   * `{ ok: true }` for success, `{ ok: false, reason }` for decline.
   *
   * Exposed on the manager (rather than tucked inside runQuery) so the
   * future `event.audit` channel can record `pushed_down: bool` and the
   * `source_engine_query` SQL string for governance. Today only Postgres
   * implements runPushdown; MySQL / SQLite / ClickHouse will follow the
   * same interface.
   */
  async tryPushdown(expression: string): Promise<PushdownResult | null> {
    let pipeline;
    try {
      pipeline = parseQuery(expression);
    } catch {
      // Bad expression — let the in-process engine raise the canonical error.
      return null;
    }
    const entry = this.sources.get(pipeline.source);
    if (!entry) return null;
    if (!entry.adapter.runPushdown) return null;
    try {
      return await entry.adapter.runPushdown(expression);
    } catch (err) {
      // A throw from runPushdown is treated as a decline: same fallback
      // path as `{ ok: false }`. We don't surface the thrown error because
      // the in-process retry will produce a more useful one (or succeed).
      const reason = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: `pushdown threw: ${reason}` };
    }
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
      case 'kafka':
        return new KafkaSourceAdapter(config);
      case 'snowflake':
        return new SnowflakeSourceAdapter(config);
      case 'clickhouse':
        return new ClickhouseSourceAdapter(config);
      case 'mongodb':
        return new MongoSourceAdapter(config);
      default:
        throw new Error(`Unknown source type: ${(config as { type: string }).type}`);
    }
  }
}
