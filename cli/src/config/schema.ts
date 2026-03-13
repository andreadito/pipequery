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
  | StaticSourceConfig;

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
  viz: 'table' | 'bar' | 'sparkline' | 'stat' | 'auto';
  size?: 'full' | 'half' | 'stat';
}
