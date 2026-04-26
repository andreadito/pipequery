import { MongoClient, type Db, type Collection } from 'mongodb';
import type { MongoSourceConfig } from '../../config/schema.js';
import { parseDuration } from '../../utils/parseDuration.js';
import { expandEnv } from '../../utils/expandEnv.js';
import { parseQuery } from '../../engine.js';
import { compileMongoPushdown, type MongoPlan } from './pushdown/mongodb.js';
import type { SourceAdapter, SourceStatus } from './types.js';

const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_MAX_ROWS = 10_000;

export class MongoSourceAdapter implements SourceAdapter {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private collection: Collection | null = null;
  private data: unknown[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastFetch: Date | null = null;
  private error?: string;
  private listeners = new Set<(data: unknown[]) => void>();
  private readonly intervalMs: number;
  private readonly maxRows: number;

  constructor(private config: MongoSourceConfig) {
    this.intervalMs = config.interval ? parseDuration(config.interval) : DEFAULT_INTERVAL_MS;
    this.maxRows = config.maxRows ?? DEFAULT_MAX_ROWS;
  }

  async start(): Promise<void> {
    const uri = expandEnv(this.config.url, 'mongodb source URL');
    this.client = new MongoClient(uri);
    await this.client.connect();
    this.db = this.client.db(expandEnv(this.config.database, 'mongodb source database'));
    this.collection = this.db.collection(this.config.collection);

    await this.fetch();
    this.timer = setInterval(() => {
      void this.fetch();
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.client) {
      void this.client.close();
      this.client = null;
      this.db = null;
      this.collection = null;
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

  /**
   * Adapter-native push-down to MongoDB. The compiler emits either a
   * `find()` plan (when the pipeline only uses where/sort/first/select)
   * or an `aggregate()` pipeline (when grouping is involved).
   *
   * The success result's `sql` field carries a JSON serialization of the
   * compiled plan (Mongo doesn't have SQL); `params` is empty since
   * Mongo plans bind values inline as part of the BSON document.
   */
  async runPushdown(expression: string): Promise<
    | { ok: true; rows: unknown[]; sql: string; params: unknown[] }
    | { ok: false; reason: string }
  > {
    if (!this.collection) {
      return { ok: false, reason: 'Mongo collection not initialized — call start() first' };
    }
    let pipeline;
    try {
      pipeline = parseQuery(expression);
    } catch (err) {
      return { ok: false, reason: `parse error: ${err instanceof Error ? err.message : String(err)}` };
    }
    const compiled = compileMongoPushdown(pipeline, this.config.filter);
    if (!compiled.ok) {
      return { ok: false, reason: compiled.reason };
    }
    try {
      const rows = await this.runPlan(compiled.compiled);
      return {
        ok: true,
        rows,
        sql: JSON.stringify(compiled.compiled),
        params: [],
      };
    } catch (err) {
      return { ok: false, reason: `mongo error: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  private async runPlan(plan: MongoPlan): Promise<unknown[]> {
    const coll = this.collection!;
    if (plan.kind === 'find') {
      let cursor = coll.find(plan.filter);
      if (plan.projection) cursor = cursor.project(plan.projection);
      if (plan.sort) cursor = cursor.sort(plan.sort);
      if (plan.limit !== undefined) cursor = cursor.limit(plan.limit);
      return cursor.toArray();
    }
    // aggregate
    return coll.aggregate(plan.pipeline).toArray();
  }

  private async fetch(): Promise<void> {
    if (!this.collection) {
      this.error = 'Mongo collection not initialized';
      return;
    }
    try {
      // Apply the optional default filter (yaml-level) plus the maxRows cap.
      const filter = this.config.filter ?? {};
      const docs = await this.collection
        .find(filter)
        .limit(this.maxRows + 1)
        .toArray();
      if (docs.length > this.maxRows) {
        throw new Error(
          `Query returned more than maxRows=${this.maxRows}. ` +
            `Tighten the filter, or raise maxRows in the source config.`,
        );
      }
      // Strip Mongo's BSON _id by default — most pipequery users don't want it
      // surfacing in result rows. The original is still queryable in source
      // queries that explicitly project it.
      this.data = docs.map((d) => {
        const { _id, ...rest } = d as Record<string, unknown>;
        return rest;
      });
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
}
