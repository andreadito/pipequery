import WebSocket from 'ws';
import type { WebSocketSourceConfig } from '../../config/schema.js';
import type { SourceAdapter, SourceStatus } from './types.js';
import { parseDuration } from '../../utils/parseDuration.js';

export class WebSocketSourceAdapter implements SourceAdapter {
  private data: unknown[] = [];
  private ws: WebSocket | null = null;
  private lastFetch: Date | null = null;
  private error?: string;
  private listeners = new Set<(data: unknown[]) => void>();
  private maxBuffer: number;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  /** Tracks whether stop() was called so reconnect respects intent. */
  private stopped = false;

  constructor(private config: WebSocketSourceConfig) {
    this.maxBuffer = config.maxBuffer ?? 1000;
  }

  async start(): Promise<void> {
    this.stopped = false;
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.config.url);
      this.ws = ws;
      let settled = false;

      ws.on('open', () => {
        this.error = undefined;
        try {
          this.sendSubscribePayloads(ws);
          this.startHeartbeat(ws);
        } catch (err) {
          // A failure to send the subscribe frame leaves the socket open
          // but useless; record it and reject the start() promise.
          this.error = err instanceof Error ? err.message : String(err);
          ws.close();
          if (!settled) {
            settled = true;
            reject(err instanceof Error ? err : new Error(this.error));
          }
          return;
        }
        if (!settled) {
          settled = true;
          resolve();
        }
      });

      ws.on('message', (raw) => {
        try {
          const parsed = JSON.parse(raw.toString());
          if (Array.isArray(parsed)) {
            this.data = parsed;
          } else {
            this.data.push(parsed);
            if (this.data.length > this.maxBuffer) {
              this.data = this.data.slice(-this.maxBuffer);
            }
          }
          this.lastFetch = new Date();
          this.error = undefined;
          this.notify();
        } catch {
          // ignore non-JSON messages
        }
      });

      ws.on('error', (err) => {
        this.error = err.message;
        if (!settled) {
          settled = true;
          reject(err);
        }
      });

      ws.on('close', () => {
        this.stopHeartbeat();
        // Auto-reconnect after 5s unless stop() was explicitly called.
        // Re-running start() also re-sends the subscribe payloads, which
        // is exactly what every exchange expects after a connection drop.
        if (this.stopped) return;
        setTimeout(() => {
          if (!this.stopped) this.start().catch(() => {});
        }, 5000);
      });
    });
  }

  stop(): void {
    this.stopped = true;
    this.stopHeartbeat();
    const ws = this.ws;
    this.ws = null;
    ws?.close();
  }

  getData(): unknown[] {
    return this.data;
  }

  getStatus(): SourceStatus {
    return {
      healthy: this.ws?.readyState === WebSocket.OPEN,
      rowCount: this.data.length,
      lastFetch: this.lastFetch,
      error: this.error,
    };
  }

  onUpdate(callback: (data: unknown[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify(): void {
    for (const cb of this.listeners) cb(this.data);
  }

  private sendSubscribePayloads(ws: WebSocket): void {
    const subscribe = this.config.subscribe;
    if (subscribe === undefined || subscribe === null) return;
    const list = Array.isArray(subscribe) ? subscribe : [subscribe];
    for (const payload of list) {
      ws.send(JSON.stringify(payload));
    }
  }

  private startHeartbeat(ws: WebSocket): void {
    this.stopHeartbeat();
    const hb = this.config.heartbeat;
    if (!hb) return;
    const intervalMs = parseDuration(hb.interval);
    this.heartbeatTimer = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return;
      try {
        ws.send(JSON.stringify(hb.payload));
      } catch {
        // Ignore — next 'close' / 'error' will surface anything fatal.
      }
    }, intervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
