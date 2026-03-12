import { compile as compileQuery } from './index';
import { RuntimeError } from './types';
import type { CompiledQuery, DataContext, RowData } from './types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LiveQueryOptions {
  /** Field name(s) used as the unique key for delta merges */
  key: string | string[];
  /** Which source in a DataContext receives patches (defaults to '_data' for raw arrays) */
  source?: string;
  /** Minimum ms between executions. 0 = next microtask (default: 0) */
  throttle?: number;
}

export interface LiveQueryStats {
  patchMs: number;
  executionMs: number;
  totalMs: number;
  rowCount: number;
  resultCount: number;
  patchCount: number;
  tick: number;
}

export type LiveQuerySubscriber = (result: unknown, stats: LiveQueryStats) => void;

export type RemovalKey = string | string[];

// ─── Expression normalization (mirrors index.ts logic) ──────────────────────

const OPERATION_KEYWORDS = new Set([
  'where', 'select', 'sort', 'groupBy', 'join',
  'first', 'last', 'distinct', 'map', 'reduce',
  'rollup', 'pivot', 'flatten', 'transpose',
]);

function normalizeExpression(expression: string): string {
  const trimmed = expression.trimStart();
  const match = trimmed.match(/^(\w+)\s*\(/);
  if (match && OPERATION_KEYWORDS.has(match[1])) {
    return `_data | ${trimmed}`;
  }
  return expression;
}

// ─── LiveQuery Class ────────────────────────────────────────────────────────

export class LiveQuery {
  private _index: Map<string, RowData>;
  private _keyFields: string[];
  private _sourceName: string;
  private _context: DataContext;
  private _compiled: CompiledQuery;
  private _throttle: number;
  private _pendingTimer: ReturnType<typeof setTimeout> | null;
  private _executing: boolean;
  private _dirtyDuringExec: boolean;
  private _result: unknown;
  private _stats: LiveQueryStats;
  private _subscribers: Set<LiveQuerySubscriber>;
  private _batchDepth: number;
  private _batchDirty: boolean;
  private _disposed: boolean;

  constructor(
    data: RowData[] | DataContext,
    expression: string,
    options: LiveQueryOptions,
  ) {
    this._keyFields = Array.isArray(options.key) ? options.key : [options.key];
    this._throttle = options.throttle ?? 0;
    this._pendingTimer = null;
    this._executing = false;
    this._dirtyDuringExec = false;
    this._subscribers = new Set();
    this._batchDepth = 0;
    this._batchDirty = false;
    this._disposed = false;
    this._result = undefined;
    this._stats = {
      patchMs: 0, executionMs: 0, totalMs: 0,
      rowCount: 0, resultCount: 0, patchCount: 0, tick: 0,
    };

    if (Array.isArray(data)) {
      this._sourceName = '_data';
      this._compiled = compileQuery(normalizeExpression(expression));
      this._context = { _data: [] };
      this._index = new Map();
      this._buildIndex(data);
    } else {
      this._sourceName = options.source ?? Object.keys(data)[0];
      this._compiled = compileQuery(expression);
      this._context = { ...data };
      this._index = new Map();
      const sourceData = data[this._sourceName];
      if (Array.isArray(sourceData)) {
        this._buildIndex(sourceData as RowData[]);
      }
    }

    // Synchronous initial execution (no stream yet)
    this._executeSync();
  }

  // ── Public getters ─────────────────────────────────────────────

  get result(): unknown {
    return this._result;
  }

  get stats(): LiveQueryStats {
    return { ...this._stats };
  }

  get size(): number {
    return this._index.size;
  }

  // ── Subscription ───────────────────────────────────────────────

  subscribe(fn: LiveQuerySubscriber): () => void {
    this._guardDisposed();
    this._subscribers.add(fn);
    return () => { this._subscribers.delete(fn); };
  }

  // ── Patching ───────────────────────────────────────────────────

  patch(changed: RowData[], removals?: RemovalKey[]): void {
    this._guardDisposed();

    const patchStart = performance.now();

    for (const row of changed) {
      const mapKey = this._rowKey(row);
      this._index.set(mapKey, row);
    }

    if (removals) {
      for (const removal of removals) {
        const mapKey = this._removalKey(removal);
        this._index.delete(mapKey);
      }
    }

    this._stats.patchMs = performance.now() - patchStart;
    this._stats.patchCount++;

    if (this._batchDepth > 0) {
      this._batchDirty = true;
      return;
    }

    if (this._executing) {
      this._dirtyDuringExec = true;
      return;
    }

    this._scheduleExecution();
  }

  // ── Reset ──────────────────────────────────────────────────────

  reset(data: RowData[]): void {
    this._guardDisposed();
    this._index.clear();
    this._buildIndex(data);
    this._stats.patchMs = 0;
    this._scheduleExecution();
  }

  // ── Query change ───────────────────────────────────────────────

  setQuery(expression: string): void {
    this._guardDisposed();
    const normalized = this._sourceName === '_data'
      ? normalizeExpression(expression)
      : expression;
    this._compiled = compileQuery(normalized);
    this._stats.patchMs = 0;
    this._scheduleExecution();
  }

  // ── Batching ───────────────────────────────────────────────────

  beginBatch(): void {
    this._guardDisposed();
    this._batchDepth++;
  }

  endBatch(): void {
    this._guardDisposed();
    if (this._batchDepth <= 0) {
      throw new RuntimeError('LiveQuery: endBatch() called without matching beginBatch()');
    }
    this._batchDepth--;
    if (this._batchDepth === 0 && this._batchDirty) {
      this._batchDirty = false;
      this._scheduleExecution();
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────

  dispose(): void {
    if (this._pendingTimer !== null) {
      clearTimeout(this._pendingTimer);
      this._pendingTimer = null;
    }
    this._subscribers.clear();
    this._index.clear();
    this._result = undefined;
    this._disposed = true;
  }

  // ── Private: key helpers ───────────────────────────────────────

  private _rowKey(row: RowData): string {
    if (this._keyFields.length === 1) {
      const val = row[this._keyFields[0]];
      if (val == null) {
        throw new RuntimeError(
          `LiveQuery: row is missing key field "${this._keyFields[0]}"`,
        );
      }
      return String(val);
    }
    let key = '';
    for (let i = 0; i < this._keyFields.length; i++) {
      const val = row[this._keyFields[i]];
      if (val == null) {
        throw new RuntimeError(
          `LiveQuery: row is missing key field "${this._keyFields[i]}"`,
        );
      }
      if (i > 0) key += '\x00';
      key += String(val);
    }
    return key;
  }

  private _removalKey(removal: RemovalKey): string {
    if (typeof removal === 'string') {
      return removal;
    }
    return removal.map(String).join('\x00');
  }

  // ── Private: index ─────────────────────────────────────────────

  private _buildIndex(rows: RowData[]): void {
    for (const row of rows) {
      const key = this._rowKey(row);
      this._index.set(key, row);
    }
  }

  // ── Private: execution scheduling ──────────────────────────────

  private _scheduleExecution(): void {
    if (this._pendingTimer !== null) return; // already scheduled

    if (this._throttle === 0) {
      // Use queueMicrotask for zero-delay scheduling
      this._pendingTimer = setTimeout(() => this._onTimer(), 0);
    } else {
      this._pendingTimer = setTimeout(() => this._onTimer(), this._throttle);
    }
  }

  private _onTimer(): void {
    this._pendingTimer = null;
    if (this._disposed) return;
    this._executeSync();

    // If patches arrived during execution, schedule another round
    if (this._dirtyDuringExec) {
      this._dirtyDuringExec = false;
      this._scheduleExecution();
    }
  }

  private _executeSync(): void {
    this._executing = true;
    this._dirtyDuringExec = false;

    const rows = Array.from(this._index.values());
    this._context[this._sourceName] = rows;

    const execStart = performance.now();
    this._result = this._compiled(this._context);
    const executionMs = performance.now() - execStart;

    this._stats.executionMs = executionMs;
    this._stats.totalMs = this._stats.patchMs + executionMs;
    this._stats.rowCount = rows.length;
    this._stats.resultCount = Array.isArray(this._result)
      ? this._result.length
      : (this._result != null ? 1 : 0);
    this._stats.tick++;

    this._executing = false;
    this._notify();
  }

  private _notify(): void {
    const result = this._result;
    const stats = { ...this._stats };
    for (const fn of this._subscribers) {
      try {
        fn(result, stats);
      } catch (err) {
        console.error('LiveQuery subscriber error:', err);
      }
    }
  }

  private _guardDisposed(): void {
    if (this._disposed) {
      throw new RuntimeError('LiveQuery: instance has been disposed');
    }
  }
}

// ─── Factory Function ───────────────────────────────────────────────────────

export function liveQuery(
  data: RowData[] | DataContext,
  expression: string,
  options: LiveQueryOptions,
): LiveQuery {
  return new LiveQuery(data, expression, options);
}
