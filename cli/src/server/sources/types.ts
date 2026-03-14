export interface SourceStatus {
  healthy: boolean;
  rowCount: number;
  lastFetch: Date | null;
  error?: string;
}

export interface SourceAdapter {
  start(): Promise<void>;
  stop(): void;
  getData(): unknown[];
  getStatus(): SourceStatus;
  onUpdate(callback: (data: unknown[]) => void): () => void;
  refresh?(): Promise<void>;
}
