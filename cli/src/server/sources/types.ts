export interface SourceStatus {
  healthy: boolean;
  rowCount: number;
  lastFetch: Date | null;
  error?: string;
}

/**
 * Result of an adapter-native push-down attempt.
 *
 * `ok: true` means the adapter executed the pipe expression natively (e.g.
 * Postgres compiled it to SQL and ran it on the database) and returned rows
 * without materializing the source query in memory. `sql` / `params` are
 * optional telemetry — useful for audit logs and debugging, not required
 * for callers to act on.
 *
 * `ok: false` is the explicit decline channel: the adapter recognised the
 * shape but declined (unsupported op, multi-source pipeline, etc.). The
 * caller should fall back to in-process execution against `getContext()`.
 *
 * Any thrown error means *neither* path succeeded — let it propagate; the
 * caller has no useful fallback.
 */
export type PushdownResult =
  | { ok: true; rows: unknown[]; sql?: string; params?: unknown[] }
  | { ok: false; reason: string };

export interface SourceAdapter {
  start(): Promise<void>;
  stop(): void;
  getData(): unknown[];
  getStatus(): SourceStatus;
  onUpdate(callback: (data: unknown[]) => void): () => void;
  refresh?(): Promise<void>;
  /**
   * Optional: compile + execute the pipe expression natively against the
   * underlying engine instead of materializing into memory. When absent
   * (or when the adapter declines), SourceManager falls back to in-process
   * execution. Today only PostgresSourceAdapter implements this.
   */
  runPushdown?(expression: string): Promise<PushdownResult>;
}
