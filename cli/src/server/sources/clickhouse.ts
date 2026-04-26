import { createClient, type ClickHouseClient } from '@clickhouse/client';
import type { ClickhouseSourceConfig } from '../../config/schema.js';
import { parseDuration } from '../../utils/parseDuration.js';
import { expandEnv } from '../../utils/expandEnv.js';
import { parseQuery } from '../../engine.js';
import { compileClickhousePushdown } from './pushdown/clickhouse.js';
import type { SourceAdapter, SourceStatus } from './types.js';

const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_MAX_ROWS = 10_000;

export class ClickhouseSourceAdapter implements SourceAdapter {
  private client: ClickHouseClient | null = null;
  private data: unknown[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastFetch: Date | null = null;
  private error?: string;
  private listeners = new Set<(data: unknown[]) => void>();
  private readonly intervalMs: number;
  private readonly maxRows: number;

  constructor(private config: ClickhouseSourceConfig) {
    this.intervalMs = config.interval ? parseDuration(config.interval) : DEFAULT_INTERVAL_MS;
    this.maxRows = config.maxRows ?? DEFAULT_MAX_ROWS;
  }

  async start(): Promise<void> {
    this.client = createClient({
      url: expandEnv(this.config.url, 'clickhouse source URL'),
      ...(this.config.username
        ? { username: expandEnv(this.config.username, 'clickhouse source username') }
        : {}),
      ...(this.config.password
        ? { password: expandEnv(this.config.password, 'clickhouse source password') }
        : {}),
      ...(this.config.database ? { database: this.config.database } : {}),
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
    if (this.client) {
      void this.client.close();
      this.client = null;
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
   * Adapter-native push-down. ClickHouse dialect inlines literals (vs.
   * Postgres / MySQL / Snowflake which bind via placeholders) so the
   * `params` array returned in the success result is always empty;
   * the SQL is fully self-contained.
   */
  async runPushdown(expression: string): Promise<
    | { ok: true; rows: unknown[]; sql: string; params: unknown[] }
    | { ok: false; reason: string }
  > {
    if (!this.client) {
      return { ok: false, reason: 'ClickHouse client not initialized — call start() first' };
    }
    let pipeline;
    try {
      pipeline = parseQuery(expression);
    } catch (err) {
      return { ok: false, reason: `parse error: ${err instanceof Error ? err.message : String(err)}` };
    }
    const compiled = compileClickhousePushdown(pipeline, this.config.query);
    if (!compiled.ok) {
      return { ok: false, reason: compiled.reason };
    }
    try {
      const rows = await this.executeSql(compiled.compiled.sql);
      return {
        ok: true,
        rows,
        sql: compiled.compiled.sql,
        params: compiled.compiled.params,
      };
    } catch (err) {
      return { ok: false, reason: `clickhouse error: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  private async fetch(): Promise<void> {
    if (!this.client) {
      this.error = 'ClickHouse client not initialized';
      return;
    }
    try {
      const capQuery = `SELECT * FROM (${stripTrailingSemicolon(this.config.query)}) AS pq_src LIMIT ${this.maxRows + 1}`;
      const rows = await this.executeSql(capQuery);
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

  private async executeSql(sql: string): Promise<unknown[]> {
    const result = await this.client!.query({
      query: sql,
      format: 'JSONEachRow',
    });
    const rows = await result.json();
    return Array.isArray(rows) ? rows : [];
  }

  private notify(): void {
    for (const cb of this.listeners) cb(this.data);
  }
}

function stripTrailingSemicolon(sql: string): string {
  return sql.trim().replace(/;+\s*$/, '');
}
