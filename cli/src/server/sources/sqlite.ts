import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import type { SqliteSourceConfig } from '../../config/schema.js';
import { parseDuration } from '../../utils/parseDuration.js';
import type { SourceAdapter, SourceStatus } from './types.js';

const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_MAX_ROWS = 10_000;
const IN_MEMORY = ':memory:';

export class SqliteSourceAdapter implements SourceAdapter {
  private db: Database.Database | null = null;
  private data: unknown[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastFetch: Date | null = null;
  private error?: string;
  private listeners = new Set<(data: unknown[]) => void>();
  private readonly intervalMs: number;
  private readonly maxRows: number;
  private readonly resolvedPath: string;
  private readonly readonly: boolean;

  constructor(private config: SqliteSourceConfig, cwd: string) {
    this.intervalMs = config.interval ? parseDuration(config.interval) : DEFAULT_INTERVAL_MS;
    this.maxRows = config.maxRows ?? DEFAULT_MAX_ROWS;
    this.readonly = config.readonly ?? true;
    this.resolvedPath = config.path === IN_MEMORY ? IN_MEMORY : resolve(cwd, config.path);
  }

  async start(): Promise<void> {
    // In-memory databases can't be read-only and don't share state across
    // connections, so the readonly flag is silently ignored for :memory:.
    const opts: Database.Options =
      this.resolvedPath === IN_MEMORY ? {} : { readonly: this.readonly, fileMustExist: this.readonly };
    this.db = new Database(this.resolvedPath, opts);
    // WAL makes concurrent readers/writers safer when the DB is another
    // process's production file — no effect for :memory:.
    if (this.resolvedPath !== IN_MEMORY && !this.readonly) {
      this.db.pragma('journal_mode = WAL');
    }

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
    if (this.db) {
      this.db.close();
      this.db = null;
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
    if (!this.db) {
      this.error = 'SQLite database not initialized';
      return;
    }
    try {
      // Same safety-cap pattern as the other DB adapters.
      const capQuery = `SELECT * FROM (${stripTrailingSemicolon(this.config.query)}) AS pq_src LIMIT ${this.maxRows + 1}`;
      const rows = this.db.prepare(capQuery).all();
      if (rows.length > this.maxRows) {
        throw new Error(
          `Query returned more than maxRows=${this.maxRows}. ` +
            `Add LIMIT/WHERE to bound the result set, or raise maxRows in the source config.`,
        );
      }
      // better-sqlite3 returns bigints only if defaultSafeIntegers is on;
      // default mapping is already JSON-serializable (numbers, strings, Buffer).
      this.data = rows;
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

function stripTrailingSemicolon(sql: string): string {
  return sql.trim().replace(/;+\s*$/, '');
}
