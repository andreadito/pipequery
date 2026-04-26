import mysql from 'mysql2/promise';
import type { MysqlSourceConfig } from '../../config/schema.js';
import { parseDuration } from '../../utils/parseDuration.js';
import { expandEnv } from '../../utils/expandEnv.js';
import type { SourceAdapter, SourceStatus } from './types.js';

const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_MAX_ROWS = 10_000;

function resolveSsl(ssl: MysqlSourceConfig['ssl']): mysql.PoolOptions['ssl'] {
  if (ssl === false) return undefined;
  if (ssl === 'no-verify') return { rejectUnauthorized: false };
  return { rejectUnauthorized: true };
}

export class MysqlSourceAdapter implements SourceAdapter {
  private pool: mysql.Pool | null = null;
  private data: unknown[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastFetch: Date | null = null;
  private error?: string;
  private listeners = new Set<(data: unknown[]) => void>();
  private readonly intervalMs: number;
  private readonly maxRows: number;

  constructor(private config: MysqlSourceConfig) {
    this.intervalMs = config.interval ? parseDuration(config.interval) : DEFAULT_INTERVAL_MS;
    this.maxRows = config.maxRows ?? DEFAULT_MAX_ROWS;
  }

  async start(): Promise<void> {
    const uri = expandEnv(this.config.url, 'mysql source URL');
    this.pool = mysql.createPool({
      uri,
      ssl: resolveSsl(this.config.ssl),
      connectionLimit: 2,
      waitForConnections: true,
      // mysql2 returns BigInt for large integers by default — stringify so the
      // data serializes cleanly to JSON (which can't encode BigInt).
      supportBigNumbers: true,
      bigNumberStrings: true,
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

  private async fetch(): Promise<void> {
    if (!this.pool) {
      this.error = 'MySQL pool not initialized';
      return;
    }
    try {
      // Same safety-cap pattern as Postgres: wrap the user's query and LIMIT
      // to maxRows+1 so we can detect overflow without reading unbounded rows.
      const capQuery = `SELECT * FROM (${stripTrailingSemicolon(this.config.query)}) AS pq_src LIMIT ${this.maxRows + 1}`;
      const [rows] = await this.pool.query(capQuery);
      const asArray = Array.isArray(rows) ? (rows as unknown[]) : [];
      if (asArray.length > this.maxRows) {
        throw new Error(
          `Query returned more than maxRows=${this.maxRows}. ` +
            `Add LIMIT/WHERE to bound the result set, or raise maxRows in the source config.`,
        );
      }
      this.data = asArray;
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
