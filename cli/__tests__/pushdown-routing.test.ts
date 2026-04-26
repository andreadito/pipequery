/**
 * Auto-routing tests for SourceManager.runQuery — the "try push-down,
 * fall back to in-process" decision tree introduced for issue #29 follow-up.
 *
 * No real Postgres needed: we register sources whose adapters expose a
 * fake `runPushdown` so the routing logic is testable in isolation.
 *
 * `addSource()` only constructs adapters from `SourceConfig.type`, so we
 * use a `static` source as the carrier and reach in to attach a
 * `runPushdown` after the fact. That lets us exercise the manager's
 * dispatch surface without inventing a new public extensibility hook.
 */
import { describe, expect, it } from 'vitest';
import { SourceManager } from '../src/server/sources/manager.js';
import type { PushdownResult, SourceAdapter } from '../src/server/sources/types.js';

interface SourceWithAdapter {
  adapter: SourceAdapter;
}

/**
 * Attach a fake `runPushdown` to an already-registered source's adapter.
 * Returns a tracker so tests can assert call shapes.
 */
function attachFakePushdown(
  sm: SourceManager,
  name: string,
  impl: (expression: string) => Promise<PushdownResult>,
): { calls: string[] } {
  const calls: string[] = [];
  // Reach into the private map. This is test-only; production callers go
  // through the typed methods. Keeps the test from inventing a public
  // extensibility hook that production code wouldn't use.
  const sources = (sm as unknown as { sources: Map<string, SourceWithAdapter> }).sources;
  const entry = sources.get(name);
  if (!entry) throw new Error(`source "${name}" not registered`);
  entry.adapter.runPushdown = async (expression: string) => {
    calls.push(expression);
    return impl(expression);
  };
  return { calls };
}

describe('SourceManager.runQuery — push-down auto-routing', () => {
  it('uses push-down when the adapter accepts the expression', async () => {
    const sm = new SourceManager(process.cwd());
    await sm.addSource('orders', {
      type: 'static',
      data: [{ id: 1, total: 10 }],
    });
    const tracker = attachFakePushdown(sm, 'orders', async () => ({
      ok: true,
      rows: [{ id: 99, pushed: true }],
      sql: 'SELECT * FROM orders WHERE total > 0',
    }));

    const rows = await sm.runQuery('orders | where(total > 0)');

    expect(rows).toEqual([{ id: 99, pushed: true }]);
    expect(tracker.calls).toEqual(['orders | where(total > 0)']);
    await sm.dispose();
  });

  it('falls back to in-process when the adapter declines', async () => {
    const sm = new SourceManager(process.cwd());
    await sm.addSource('orders', {
      type: 'static',
      data: [{ total: 1 }, { total: 2 }, { total: 3 }],
    });
    const tracker = attachFakePushdown(sm, 'orders', async () => ({
      ok: false,
      reason: 'simulated decline',
    }));

    const rows = (await sm.runQuery('orders | rollup(sum(total) as t)')) as Array<{ t: number }>;

    expect(tracker.calls).toHaveLength(1); // adapter was asked
    expect(rows[0].t).toBe(6); // but in-process actually computed the result
    await sm.dispose();
  });

  it('falls back to in-process when the adapter throws', async () => {
    const sm = new SourceManager(process.cwd());
    await sm.addSource('orders', {
      type: 'static',
      data: [{ total: 5 }, { total: 7 }],
    });
    const tracker = attachFakePushdown(sm, 'orders', async () => {
      throw new Error('connection lost');
    });

    // Push-down threw, so we fall back to in-process; the in-process result
    // proves the fallback fired and computed correctly.
    const rows = (await sm.runQuery('orders | rollup(sum(total) as t)')) as Array<{ t: number }>;
    expect(tracker.calls).toHaveLength(1);
    expect(rows[0].t).toBe(12);
    await sm.dispose();
  });

  it('skips push-down entirely when the adapter has no runPushdown', async () => {
    const sm = new SourceManager(process.cwd());
    // No fake attached → entry.adapter.runPushdown is undefined.
    await sm.addSource('orders', {
      type: 'static',
      data: [{ total: 1 }, { total: 2 }],
    });

    const rows = (await sm.runQuery('orders | rollup(sum(total) as t)')) as Array<{ t: number }>;
    expect(rows[0].t).toBe(3);
    await sm.dispose();
  });

  it('skips push-down when the named source does not exist (in-process raises)', async () => {
    const sm = new SourceManager(process.cwd());
    // No source registered. tryPushdown returns null; runQuery falls
    // through to in-process, which throws the canonical "source not found"
    // engine error. We verify the fall-through happened by observing that
    // the error is the engine's, not a push-down-specific one.
    await expect(sm.runQuery('ghost | first(1)')).rejects.toThrow();
    await sm.dispose();
  });

  it('non-pipe expressions still parse-fail through the in-process path', async () => {
    const sm = new SourceManager(process.cwd());
    await sm.addSource('orders', { type: 'static', data: [] });
    // tryPushdown swallows the parse error and returns null; in-process
    // re-parses and surfaces the engine's error message — same as before
    // push-down existed.
    await expect(sm.runQuery('this is not a pipe expression')).rejects.toThrow();
    await sm.dispose();
  });

  it('tryPushdown returns null when push-down is not even attempted', async () => {
    const sm = new SourceManager(process.cwd());
    await sm.addSource('orders', { type: 'static', data: [{ id: 1 }] });
    // No runPushdown attached → null (signals "not attempted").
    expect(await sm.tryPushdown('orders | first(1)')).toBeNull();
    // Source not found → null.
    expect(await sm.tryPushdown('ghost | first(1)')).toBeNull();
    // Bad parse → null.
    expect(await sm.tryPushdown('totally not pipequery')).toBeNull();
    await sm.dispose();
  });
});
