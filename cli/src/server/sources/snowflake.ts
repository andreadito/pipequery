import snowflake, { type Connection } from 'snowflake-sdk';
import type { SnowflakeSourceConfig } from '../../config/schema.js';
import { parseDuration } from '../../utils/parseDuration.js';
import { expandEnv } from '../../utils/expandEnv.js';
import { parseQuery } from '../../engine.js';
import { compileSnowflakePushdown } from './pushdown/snowflake.js';
import type { SourceAdapter, SourceStatus } from './types.js';

const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_MAX_ROWS = 10_000;

export class SnowflakeSourceAdapter implements SourceAdapter {
  private conn: Connection | null = null;
  private data: unknown[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastFetch: Date | null = null;
  private error?: string;
  private listeners = new Set<(data: unknown[]) => void>();
  private readonly intervalMs: number;
  private readonly maxRows: number;

  constructor(private config: SnowflakeSourceConfig) {
    this.intervalMs = config.interval ? parseDuration(config.interval) : DEFAULT_INTERVAL_MS;
    this.maxRows = config.maxRows ?? DEFAULT_MAX_ROWS;
  }

  async start(): Promise<void> {
    this.conn = snowflake.createConnection({
      account: expandEnv(this.config.account, 'snowflake source account'),
      username: expandEnv(this.config.username, 'snowflake source username'),
      password: expandEnv(this.config.password, 'snowflake source password'),
      ...(this.config.database ? { database: expandEnv(this.config.database, 'snowflake source database') } : {}),
      ...(this.config.schema ? { schema: expandEnv(this.config.schema, 'snowflake source schema') } : {}),
      ...(this.config.warehouse ? { warehouse: expandEnv(this.config.warehouse, 'snowflake source warehouse') } : {}),
      ...(this.config.role ? { role: expandEnv(this.config.role, 'snowflake source role') } : {}),
    });

    await new Promise<void>((resolve, reject) => {
      this.conn!.connect((err) => (err ? reject(err) : resolve()));
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
    if (this.conn) {
      this.conn.destroy(() => undefined);
      this.conn = null;
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
   * Adapter-native push-down. SourceManager.runQuery dispatches here when a
   * pipeline targets a Snowflake source; declines fall back to in-process.
   */
  async runPushdown(expression: string): Promise<
    | { ok: true; rows: unknown[]; sql: string; params: unknown[] }
    | { ok: false; reason: string }
  > {
    if (!this.conn) {
      return { ok: false, reason: 'Snowflake connection not initialized — call start() first' };
    }
    let pipeline;
    try {
      pipeline = parseQuery(expression);
    } catch (err) {
      return { ok: false, reason: `parse error: ${err instanceof Error ? err.message : String(err)}` };
    }
    const compiled = compileSnowflakePushdown(pipeline, this.config.query);
    if (!compiled.ok) {
      return { ok: false, reason: compiled.reason };
    }
    try {
      const rows = await this.executeSql(compiled.compiled.sql, compiled.compiled.params);
      return {
        ok: true,
        rows,
        sql: compiled.compiled.sql,
        params: compiled.compiled.params,
      };
    } catch (err) {
      return { ok: false, reason: `snowflake error: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  private async fetch(): Promise<void> {
    if (!this.conn) {
      this.error = 'Snowflake connection not initialized';
      return;
    }
    try {
      const capQuery = `SELECT * FROM (${stripTrailingSemicolon(this.config.query)}) AS pq_src LIMIT ${this.maxRows + 1}`;
      const rows = await this.executeSql(capQuery, []);
      if (rows.length > this.maxRows) {
        throw new Error(
          `Query returned more than maxRows=${this.maxRows}. ` +
            `Add LIMIT/WHERE to bound the result set, or raise maxRows in the source config.`,
        );
      }
      this.data = rows;
      this.lastFetch = new Date();
      this.error = undefined;
      this.notify();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  private executeSql(sqlText: string, params: unknown[]): Promise<unknown[]> {
    return new Promise((resolve, reject) => {
      this.conn!.execute({
        sqlText,
        binds: params as snowflake.Binds,
        complete: (err, _stmt, rows) => {
          if (err) reject(err);
          else resolve(rows ?? []);
        },
      });
    });
  }

  private notify(): void {
    for (const cb of this.listeners) cb(this.data);
  }
}

function stripTrailingSemicolon(sql: string): string {
  return sql.trim().replace(/;+\s*$/, '');
}
