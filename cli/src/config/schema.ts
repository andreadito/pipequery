export interface PipeQueryConfig {
  server: ServerConfig;
  remote?: RemoteConfig;
  sources: Record<string, SourceConfig>;
  endpoints: Record<string, EndpointConfig>;
  dashboards: Record<string, DashboardConfig>;
}

export interface ServerConfig {
  port: number;
  host: string;
}

export interface RemoteConfig {
  url: string;
}

// ─── Source configs ──────────────────────────────────────────────────────────

export type SourceConfig =
  | RestSourceConfig
  | WebSocketSourceConfig
  | FileSourceConfig
  | StaticSourceConfig
  | PostgresSourceConfig;

export interface RestSourceConfig {
  type: 'rest';
  url: string;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  dataPath?: string;
  interval?: string;
}

export interface WebSocketSourceConfig {
  type: 'websocket';
  url: string;
  maxBuffer?: number;
}

export interface FileSourceConfig {
  type: 'file';
  path: string;
  format?: 'json' | 'csv';
  watch?: boolean;
}

export interface StaticSourceConfig {
  type: 'static';
  data: unknown[];
}

export interface PostgresSourceConfig {
  type: 'postgres';
  /**
   * Postgres connection URL. Supports `${ENV_VAR}` interpolation so
   * credentials can live in the environment instead of the yaml.
   * Example: `postgres://${DB_USER}:${DB_PASS}@db.internal:5432/app`.
   */
  url: string;
  /**
   * The SELECT query to run on each poll. Must be a single statement.
   * It's the caller's responsibility to add LIMIT/WHERE clauses that
   * bound the result set; `maxRows` below is a hard safety cap.
   */
  query: string;
  /** Poll interval, e.g. "30s", "5m". Defaults to "30s". */
  interval?: string;
  /**
   * SSL policy. `"require"` verifies the cert (production default for
   * most hosted Postgres). `"no-verify"` skips verification (useful for
   * self-signed dev setups). `false` disables TLS entirely.
   */
  ssl?: 'require' | 'no-verify' | false;
  /** Safety cap. If the query returns more rows, the fetch errors. Default 10000. */
  maxRows?: number;
}

// ─── Endpoint config ─────────────────────────────────────────────────────────

export interface EndpointConfig {
  query: string;
  cache?: string;
  method?: string;
}

// ─── Dashboard config ────────────────────────────────────────────────────────

export interface DashboardConfig {
  refresh?: string;
  panels: PanelConfig[];
}

export interface PanelConfig {
  title: string;
  query: string;
  viz: 'table' | 'bar' | 'sparkline' | 'stat' | 'orderbook' | 'heatmap' | 'candle' | 'auto';
  size?: 'full' | 'half' | 'stat';
}
