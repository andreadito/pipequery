import pg from 'pg';
import type { PostgresSourceConfig } from '../../config/schema.js';
import { parseDuration } from '../../utils/parseDuration.js';
import { expandEnv } from '../../utils/expandEnv.js';
import type { SourceAdapter, SourceStatus } from './types.js';
import { parseQuery } from '../../engine.js';
import { compilePostgresPushdown } from './pushdown/postgres.js';

const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_MAX_ROWS = 10_000;

function resolveSsl(ssl: PostgresSourceConfig['ssl']): pg.ClientConfig['ssl'] {
  if (ssl === false) return false;
  if (ssl === 'no-verify') return { rejectUnauthorized: false };
  // 'require' (default) — verify certificates.
  return { rejectUnauthorized: true };
}

export class PostgresSourceAdapter implements SourceAdapter {
  private pool: pg.Pool | null = null;
  private data: unknown[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastFetch: Date | null = null;
  private error?: string;
  private listeners = new Set<(data: unknown[]) => void>();
  private readonly intervalMs: number;
  private readonly maxRows: number;

  constructor(private config: PostgresSourceConfig) {
    this.intervalMs = config.interval ? parseDuration(config.interval) : DEFAULT_INTERVAL_MS;
    this.maxRows = config.maxRows ?? DEFAULT_MAX_ROWS;
  }

  async start(): Promise<void> {
    const connectionString = expandEnv(this.config.url, 'postgres source URL');
    this.pool = new pg.Pool({
      connectionString,
      ssl: resolveSsl(this.config.ssl),
      // Small pool — we're read-only polling, not a transactional app.
      min: 0,
      max: 2,
      idleTimeoutMillis: 10_000,
    });

    // Proactively surface connection errors (e.g. bad creds) on stderr
    // so the user doesn't hit silent `healthy: false` with no explanation.
    this.pool.on('error', (err) => {
      this.error = err.message;
    });

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
    // Fire-and-forget pool shutdown; callers don't await stop().
    if (this.pool) {
      void this.pool.end();
      this.pool = null;
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
   * Push-down execution prototype. Compiles a pipequery expression rooted at
   * this source into a single Postgres query (where / sort / first only in
   * v1) and runs it directly against the database — no in-memory
   * materialization of the user's source query, no polling, no ring buffer.
   *
   * Returns:
   *   - `{ ok: true, rows, sql, params, fullyPushed: true }` on a clean push-down
   *   - `{ ok: false, reason }` when the AST contains operators we don't yet
   *     translate. Caller should fall back to the in-process engine on the
   *     ring-buffered data instead.
   *
   * This is an opt-in API; the default getData() / fetch() polling loop is
   * unchanged so existing users see no behaviour change.
   */
  async runPushdown(expression: string): Promise<
    | { ok: true; rows: unknown[]; sql: string; params: unknown[]; fullyPushed: true }
    | { ok: false; reason: string }
  > {
    if (!this.pool) {
      return { ok: false, reason: 'Postgres pool not initialized — call start() first' };
    }
    let pipeline;
    try {
      pipeline = parseQuery(expression);
    } catch (err) {
      return { ok: false, reason: `parse error: ${err instanceof Error ? err.message : String(err)}` };
    }

    const compiled = compilePostgresPushdown(pipeline, this.config.query);
    if (!compiled.ok) {
      return { ok: false, reason: compiled.reason };
    }

    try {
      const res = await this.pool.query(compiled.compiled.sql, compiled.compiled.params);
      return {
        ok: true,
        rows: res.rows,
        sql: compiled.compiled.sql,
        params: compiled.compiled.params,
        fullyPushed: true,
      };
    } catch (err) {
      return { ok: false, reason: `postgres error: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  private async fetch(): Promise<void> {
    if (!this.pool) {
      this.error = 'Postgres pool not initialized';
      return;
    }
    try {
      // Safety cap: wrap the user's query so a runaway SELECT doesn't
      // eat the process. We add LIMIT maxRows+1 to detect overflow.
      const capQuery = `SELECT * FROM (${stripTrailingSemicolon(this.config.query)}) AS pq_src LIMIT ${this.maxRows + 1}`;
      const res = await this.pool.query(capQuery);
      if (res.rows.length > this.maxRows) {
        throw new Error(
          `Query returned more than maxRows=${this.maxRows}. ` +
            `Add LIMIT/WHERE to bound the result set, or raise maxRows in the source config.`,
        );
      }
      this.data = res.rows;
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
