import type { StaticSourceConfig } from '../../config/schema.js';
import type { SourceAdapter, SourceStatus } from './types.js';

export class StaticSourceAdapter implements SourceAdapter {
  private listeners = new Set<(data: unknown[]) => void>();

  constructor(private config: StaticSourceConfig) {}

  async start(): Promise<void> {
    // Static data is immediately available
  }

  stop(): void {}

  getData(): unknown[] {
    return this.config.data;
  }

  getStatus(): SourceStatus {
    return {
      healthy: true,
      rowCount: this.config.data.length,
      lastFetch: new Date(),
    };
  }

  onUpdate(callback: (data: unknown[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
}
