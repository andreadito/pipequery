import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { watch } from 'chokidar';
import { parse as csvParse } from 'csv-parse/sync';
import type { FileSourceConfig } from '../../config/schema.js';
import type { SourceAdapter, SourceStatus } from './types.js';

export class FileSourceAdapter implements SourceAdapter {
  private data: unknown[] = [];
  private watcher: ReturnType<typeof watch> | null = null;
  private lastFetch: Date | null = null;
  private error?: string;
  private listeners = new Set<(data: unknown[]) => void>();
  private resolvedPath: string;

  constructor(private config: FileSourceConfig, private cwd: string) {
    this.resolvedPath = resolve(cwd, config.path);
  }

  async start(): Promise<void> {
    await this.load();
    if (this.config.watch) {
      this.watcher = watch(this.resolvedPath, { ignoreInitial: true });
      this.watcher.on('change', () => this.load());
    }
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
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

  private async load(): Promise<void> {
    try {
      const content = await readFile(this.resolvedPath, 'utf-8');
      const format = this.config.format ?? this.detectFormat();

      if (format === 'csv') {
        this.data = csvParse(content, { columns: true, skip_empty_lines: true, cast: true });
      } else {
        const parsed = JSON.parse(content);
        this.data = Array.isArray(parsed) ? parsed : [parsed];
      }

      this.lastFetch = new Date();
      this.error = undefined;
      this.notify();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  private detectFormat(): 'json' | 'csv' {
    const ext = extname(this.resolvedPath).toLowerCase();
    return ext === '.csv' || ext === '.tsv' ? 'csv' : 'json';
  }

  private notify(): void {
    for (const cb of this.listeners) cb(this.data);
  }
}
