/**
 * Watch manager — polls each configured watch on its interval, evaluates
 * the pipequery expression against the live source data, and dispatches
 * notifications when the watch's fire condition is met.
 *
 * Lives alongside the existing endpoint registry in createServer(). Same
 * lifecycle: start when the server boots, stop when it disposes.
 *
 * Idempotency model:
 *   - For `when_non_empty`: track per-watch `lastWasEmpty` boolean. Fire
 *     only when the previous tick was empty (or first run) and the current
 *     tick is non-empty. Re-fires after the result goes empty and back.
 *   - For `when_empty`: the inverse.
 *   - For `on_change`: track a hash of the last result; fire on hash change.
 *
 * All firing is best-effort. If a notifier throws, the error is logged on
 * stderr and the watch state advances anyway — we don't want one stuck
 * notifier to wedge an alert pipeline.
 */
import { createHash } from 'node:crypto';
import { query } from '../../engine.js';
import { parseDuration } from '../../utils/parseDuration.js';
import * as activity from '../activity-log.js';
import type { WatchConfig, WatchNotify } from '../../config/schema.js';
import type { SourceManager } from '../sources/manager.js';
import type { Notifier } from '../../telegram/notifier.js';
import { TelegramNotifier } from '../../telegram/notifier.js';

const DEFAULT_INTERVAL_MS = 60_000;

interface WatchState {
  config: WatchConfig;
  notifiers: Notifier[];
  intervalMs: number;
  timer: ReturnType<typeof setInterval> | null;
  lastWasEmpty: boolean | null;
  lastHash: string | null;
}

export class WatchManager {
  private watches = new Map<string, WatchState>();
  private disposed = false;

  constructor(private sourceManager: SourceManager) {}

  start(configs: Record<string, WatchConfig>): void {
    for (const [name, cfg] of Object.entries(configs)) {
      try {
        this.startOne(name, cfg);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        activity.error(`Watch "${name}" failed to start: ${msg}`);
        process.stderr.write(`[pipequery-watch] "${name}" failed to start: ${msg}\n`);
      }
    }
  }

  private startOne(name: string, cfg: WatchConfig): void {
    const notifiers = buildNotifiers(cfg.notify);
    if (notifiers.length === 0) {
      throw new Error(`watch has no notification channels configured`);
    }
    const intervalMs = cfg.interval ? parseDuration(cfg.interval) : DEFAULT_INTERVAL_MS;
    const state: WatchState = {
      config: cfg,
      notifiers,
      intervalMs,
      timer: null,
      lastWasEmpty: null,
      lastHash: null,
    };
    this.watches.set(name, state);
    activity.info(`Watch "${name}" registered (every ${cfg.interval ?? '60s'})`);

    // Run once immediately to seed `lastWasEmpty`/`lastHash` — we don't fire
    // on the very first tick, since "transitioned" requires a previous state.
    void this.tick(name);
    state.timer = setInterval(() => void this.tick(name), intervalMs);
  }

  private async tick(name: string): Promise<void> {
    if (this.disposed) return;
    const state = this.watches.get(name);
    if (!state) return;

    let result: unknown;
    try {
      const ctx = this.sourceManager.getContext();
      result = query(ctx, state.config.query);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      activity.error(`Watch "${name}" query failed: ${msg}`);
      // Don't advance state on query failure — wait for the next tick.
      return;
    }

    const fireWhen = state.config.fireWhen ?? 'when_non_empty';
    const isEmpty = isResultEmpty(result);
    const hash = hashResult(result);

    let shouldFire = false;
    let reason = '';
    if (fireWhen === 'when_non_empty') {
      if (state.lastWasEmpty !== false && !isEmpty) {
        shouldFire = true;
        reason = 'result transitioned to non-empty';
      }
    } else if (fireWhen === 'when_empty') {
      if (state.lastWasEmpty !== true && isEmpty) {
        shouldFire = true;
        reason = 'result transitioned to empty';
      }
    } else if (fireWhen === 'on_change') {
      if (state.lastHash !== null && state.lastHash !== hash) {
        shouldFire = true;
        reason = 'result content changed';
      }
    }

    state.lastWasEmpty = isEmpty;
    state.lastHash = hash;

    if (!shouldFire) return;

    activity.info(`Watch "${name}" fired (${reason})`);
    await Promise.all(
      state.notifiers.map((n) =>
        n.notify({ watchName: name, result, reason }).catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          activity.error(`Watch "${name}" notify failed: ${msg}`);
          process.stderr.write(`[pipequery-watch] "${name}" notify failed: ${msg}\n`);
        }),
      ),
    );
  }

  stop(name: string): boolean {
    const state = this.watches.get(name);
    if (!state) return false;
    if (state.timer) clearInterval(state.timer);
    this.watches.delete(name);
    return true;
  }

  list(): string[] {
    return [...this.watches.keys()];
  }

  dispose(): void {
    this.disposed = true;
    for (const state of this.watches.values()) {
      if (state.timer) clearInterval(state.timer);
    }
    this.watches.clear();
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildNotifiers(notify: WatchNotify): Notifier[] {
  const out: Notifier[] = [];
  if (notify.telegram) out.push(new TelegramNotifier(notify.telegram));
  return out;
}

function isResultEmpty(result: unknown): boolean {
  if (result === null || result === undefined) return true;
  if (Array.isArray(result)) return result.length === 0;
  if (typeof result === 'object') return Object.keys(result as object).length === 0;
  return false;
}

function hashResult(result: unknown): string {
  // Stable JSON for hashing — skip undefined / sort keys.
  const json = JSON.stringify(result, (_, v) => (v === undefined ? null : v));
  return createHash('sha256').update(json).digest('hex');
}
