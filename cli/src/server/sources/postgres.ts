import pg from 'pg';
import type { PostgresSourceConfig } from '../../config/schema.js';
import { parseDuration } from '../../utils/parseDuration.js';
import type { SourceAdapter, SourceStatus } from './types.js';

const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_MAX_ROWS = 10_000;

/**
 * Resolve ${ENV_VAR} placeholders in a string from process.env.
 * Missing vars expand to empty string (with a stderr warning) so a
 * mis-typed env doesn't silently embed literal "${FOO}" into a
 * Postgres connection string.
 */
function expandEnv(input: string): string {
  return input.replace(/\$\{([A-Z0-9_]+)\}/gi, (_, name: string) => {
    const value = process.env[name];
    if (value === undefined) {
      process.stderr.write(
        `[pipequery] env var "${name}" referenced in postgres source URL is not set\n`,
      );
      return '';
    }
    return value;
  });
}

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
    const connectionString = expandEnv(this.config.url);
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
