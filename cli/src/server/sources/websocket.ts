import WebSocket from 'ws';
import type { WebSocketSourceConfig } from '../../config/schema.js';
import type { SourceAdapter, SourceStatus } from './types.js';

export class WebSocketSourceAdapter implements SourceAdapter {
  private data: unknown[] = [];
  private ws: WebSocket | null = null;
  private lastFetch: Date | null = null;
  private error?: string;
  private listeners = new Set<(data: unknown[]) => void>();
  private maxBuffer: number;

  constructor(private config: WebSocketSourceConfig) {
    this.maxBuffer = config.maxBuffer ?? 1000;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.config.url);

      this.ws.on('open', () => {
        this.error = undefined;
        resolve();
      });

      this.ws.on('message', (raw) => {
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

      this.ws.on('error', (err) => {
        this.error = err.message;
        reject(err);
      });

      this.ws.on('close', () => {
        // Auto-reconnect after 5s
        setTimeout(() => {
          if (this.ws) this.start().catch(() => {});
        }, 5000);
      });
    });
  }

  stop(): void {
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
}
