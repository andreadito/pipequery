export interface PipeQueryConfig {
  server: ServerConfig;
  remote?: RemoteConfig;
  sources: Record<string, SourceConfig>;
  endpoints: Record<string, EndpointConfig>;
  dashboards: Record<string, DashboardConfig>;
  watches?: Record<string, WatchConfig>;
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
  | PostgresSourceConfig
  | MysqlSourceConfig
  | SqliteSourceConfig
  | KafkaSourceConfig
  | SnowflakeSourceConfig
  | ClickhouseSourceConfig
  | MongoSourceConfig;

export interface RestSourceConfig {
  type: 'rest';
  url: string;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  dataPath?: string;
  interval?: string;
  /** Optional auth helper. Currently supports `bearer`; more kinds (basic,
   *  apiKeyHeader, hmac-*) tracked in issue #37. The token is interpolated
   *  through ${ENV_VAR} like every other string field. */
  auth?: BearerAuth;
}

export interface BearerAuth {
  kind: 'bearer';
  token: string;
}

export interface WebSocketSourceConfig {
  type: 'websocket';
  url: string;
  maxBuffer?: number;
  /** Payload(s) to send to the server immediately after the WebSocket
   *  opens. Most exchange feeds (Binance, Coinbase, Kraken, OKX, Bybit, …)
   *  require this — without it, no data is delivered. Each payload is
   *  JSON-stringified and sent in order. Re-sent on every reconnect. */
  subscribe?: unknown | unknown[];
  /** Optional keepalive: sends `payload` to the server every `interval`
   *  while the socket is open. Most exchanges close idle sockets within
   *  a few minutes; a periodic ping keeps the stream alive. */
  heartbeat?: {
    payload: unknown;
    /** Duration like "30s", "1m". */
    interval: string;
  };
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

export interface MysqlSourceConfig {
  type: 'mysql';
  /**
   * MySQL connection URL. Supports `${ENV_VAR}` interpolation so
   * credentials can live in the environment instead of the yaml.
   * Example: `mysql://${DB_USER}:${DB_PASS}@db.internal:3306/app`.
   */
  url: string;
  /** The SELECT query to run on each poll. */
  query: string;
  /** Poll interval, e.g. "30s", "5m". Defaults to "30s". */
  interval?: string;
  /**
   * SSL policy. `"require"` verifies the cert (production default).
   * `"no-verify"` skips verification. `false` disables TLS.
   */
  ssl?: 'require' | 'no-verify' | false;
  /** Safety cap. Default 10000. */
  maxRows?: number;
}

export interface KafkaSourceConfig {
  type: 'kafka';
  /**
   * Comma-separated list of Kafka bootstrap brokers, or an array. Supports
   * `${ENV_VAR}` interpolation. Example: `"broker1:9092,broker2:9092"`.
   */
  brokers: string | string[];
  /** Topic to subscribe to. Only one topic per source; use multiple sources for multiple topics. */
  topic: string;
  /**
   * Consumer group ID. If omitted, an ephemeral per-process group is generated
   * so this pipequery instance sees the full firehose. Set explicitly to share
   * a partitioned subscription across pipequery replicas.
   */
  groupId?: string;
  /** Start reading from the topic's beginning on first connect. Default false (latest). */
  fromBeginning?: boolean;
  /** Ring buffer size. Oldest messages are evicted. Default 1000. */
  maxBuffer?: number;
  /**
   * How to decode the message value.
   *   - `"json"` (default): `JSON.parse(buffer.toString())`; non-JSON messages are skipped.
   *   - `"string"`: UTF-8 string, stored as `{ value }`.
   *   - `"raw"`: base64-encoded bytes, stored as `{ value }`.
   */
  valueFormat?: 'json' | 'string' | 'raw';
  /** SSL / TLS toggle. Default false (plaintext). */
  ssl?: boolean;
  /**
   * SASL authentication. Supports `${ENV_VAR}` interpolation in username/password.
   */
  sasl?: {
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
    username: string;
    password: string;
  };
}

export interface SqliteSourceConfig {
  type: 'sqlite';
  /**
   * Path to the SQLite database file, relative to the directory
   * containing pipequery.yaml. Use `:memory:` for an in-memory database
   * (useful for tests; data will not persist across restarts).
   */
  path: string;
  /** The SELECT query to run on each poll. */
  query: string;
  /** Poll interval, e.g. "30s", "5m". Defaults to "30s". */
  interval?: string;
  /** Open the database read-only. Recommended for query-only sources. Default true. */
  readonly?: boolean;
  /** Safety cap. Default 10000. */
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

// ─── Watches (alerts triggered by a query result) ────────────────────────────

export interface WatchConfig {
  /** PipeQuery expression to evaluate on each tick. */
  query: string;
  /** Poll interval, e.g. "30s", "5m". Defaults to "60s". */
  interval?: string;
  /**
   * When to fire a notification:
   *   - `when_non_empty` (default): fires on the transition from empty/null
   *     to non-empty. Doesn't re-fire while still non-empty; re-fires after
   *     going empty and then non-empty again. Standard alerting shape.
   *   - `when_empty`: inverse — fires when transitioning to empty (e.g., a
   *     liveness check that fails when no rows match).
   *   - `on_change`: fires on any change in the result content. Useful for
   *     "tell me when this number moves" but can be chatty.
   */
  fireWhen?: 'when_non_empty' | 'when_empty' | 'on_change';
  /** Notification channels. At least one must be configured. */
  notify: WatchNotify;
}

export interface WatchNotify {
  telegram?: TelegramNotifyConfig;
}

export interface TelegramNotifyConfig {
  /**
   * Bot token; supports `${ENV_VAR}` interpolation. If omitted, defaults
   * to the `PIPEQUERY_TG_BOT_TOKEN` environment variable.
   */
  botToken?: string;
  /** Chat / channel / group ID to post to. */
  chatId: string | number;
  /**
   * Optional message template. `{{ .field }}` expands to the named field
   * of the FIRST row of the result (most alerts care about a single
   * triggering row). `{{ .count }}` is special and yields the total row
   * count. If omitted, the bot posts a default summary line plus the
   * full result rendered as a Markdown table.
   */
  message?: string;
}

// ─── Snowflake / ClickHouse / MongoDB ───────────────────────────────────────

export interface SnowflakeSourceConfig {
  type: 'snowflake';
  /** Snowflake account locator, e.g. `myorg-myaccount`. Supports `${ENV_VAR}`. */
  account: string;
  /** Username. Supports `${ENV_VAR}`. */
  username: string;
  /** Password. Supports `${ENV_VAR}`. (Key-pair / OAuth out of scope for v1.) */
  password: string;
  /** Database to USE. Supports `${ENV_VAR}`. */
  database?: string;
  /** Schema to USE. Supports `${ENV_VAR}`. */
  schema?: string;
  /** Compute warehouse to USE. Supports `${ENV_VAR}`. */
  warehouse?: string;
  /** Optional role. Supports `${ENV_VAR}`. */
  role?: string;
  /** SELECT query polled on every interval. */
  query: string;
  /** Poll interval, e.g. "60s". Default: 60s. */
  interval?: string;
  /** Hard cap on rows per fetch (default 10000). */
  maxRows?: number;
}

export interface ClickhouseSourceConfig {
  type: 'clickhouse';
  /** ClickHouse HTTP/HTTPS endpoint, e.g. `https://host:8443`. Supports `${ENV_VAR}`. */
  url: string;
  /** Username. Supports `${ENV_VAR}`. */
  username?: string;
  /** Password. Supports `${ENV_VAR}`. */
  password?: string;
  /** Database to query. Defaults to `default`. */
  database?: string;
  /** SELECT query polled on every interval. */
  query: string;
  /** Poll interval, e.g. "30s". Default: 30s. */
  interval?: string;
  /** Hard cap on rows per fetch (default 10000). */
  maxRows?: number;
}

export interface MongoSourceConfig {
  type: 'mongodb';
  /** MongoDB connection URI. Supports `${ENV_VAR}`. */
  url: string;
  /** Database name. Supports `${ENV_VAR}`. */
  database: string;
  /** Collection to read from. */
  collection: string;
  /**
   * Optional default filter applied on every poll (Mongo `$match` stage).
   * Plain JSON object — `{ active: true }` etc. The filter is `AND`-merged
   * with any push-down `where()` predicates the engine compiles in.
   */
  filter?: Record<string, unknown>;
  /** Poll interval, e.g. "30s". Default: 30s. */
  interval?: string;
  /** Hard cap on documents per fetch (default 10000). */
  maxRows?: number;
}
