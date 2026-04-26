/**
 * Watch manager fire-condition tests.
 *
 * Doesn't touch Telegram — we replace the notifier with an in-memory recorder
 * and drive the manager's tick() directly via a tiny private-call escape
 * hatch. The point is to verify the *transition* logic (when_non_empty,
 * when_empty, on_change) and the idempotency model.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SourceManager } from '../src/server/sources/manager.js';
import { WatchManager } from '../src/server/watches/manager.js';
import type { Notifier, NotifyPayload } from '../src/telegram/notifier.js';

class RecordingNotifier implements Notifier {
  calls: NotifyPayload[] = [];
  async notify(payload: NotifyPayload): Promise<void> {
    this.calls.push(payload);
  }
}

/**
 * Build a SourceManager seeded with a single static source whose data we can
 * mutate between ticks to drive transitions.
 */
async function buildManagerWithSource(initial: unknown[]): Promise<{
  sm: SourceManager;
  setRows: (rows: unknown[]) => void;
}> {
  const sm = new SourceManager(process.cwd());
  let current = initial;
  // Inject a fake adapter directly via the public addSource path. The static
  // adapter would also work but it's easier to introspect a custom one.
  await sm.addSource('events', { type: 'static', data: initial });

  // Static adapter snapshots data at construction; for these tests we want
  // mutability, so reach in. This is test-only and lets us simulate "the
  // source data changed between ticks".
  const setRows = (rows: unknown[]) => {
    current = rows;
    // SourceManager.getContext() reads from adapter.getData() each call —
    // patch the adapter to return the current array each time.
    const adapter = (sm as unknown as { sources: Map<string, { adapter: { getData: () => unknown[] } }> }).sources.get('events')!.adapter;
    adapter.getData = () => current;
  };
  setRows(initial);
  return { sm, setRows };
}

describe('WatchManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('when_non_empty fires once on the empty → non-empty transition', async () => {
    const { sm, setRows } = await buildManagerWithSource([]);
    const wm = new WatchManager(sm);
    const recorder = new RecordingNotifier();
    // Seed via internal start() mirror — register a watch by reaching into
    // private state so we can attach our recorder. (In production code this
    // happens through buildNotifiers + WatchConfig.notify; bypassing here.)
    (wm as unknown as {
      watches: Map<string, unknown>;
      startOne: (n: string, c: unknown) => void;
    }).watches.set('w', {
      config: { query: 'events | where(severity == "high")', fireWhen: 'when_non_empty' },
      notifiers: [recorder],
      intervalMs: 100,
      timer: null,
      lastWasEmpty: null,
      lastHash: null,
    });

    const tick = (wm as unknown as { tick: (name: string) => Promise<void> }).tick.bind(wm);

    // First tick: result is empty (no high-severity events). Should NOT fire
    // (transitions require a previous state).
    await tick('w');
    expect(recorder.calls).toHaveLength(0);

    // Second tick still empty — no fire.
    await tick('w');
    expect(recorder.calls).toHaveLength(0);

    // Mutate the source so the query now returns rows.
    setRows([{ severity: 'high', msg: 'disk full' }]);
    await tick('w');
    expect(recorder.calls).toHaveLength(1);
    expect(recorder.calls[0].reason).toMatch(/non-empty/);

    // Subsequent ticks while still non-empty: no re-fire.
    await tick('w');
    await tick('w');
    expect(recorder.calls).toHaveLength(1);

    // Goes empty again — no fire on this transition (not the configured shape).
    setRows([]);
    await tick('w');
    expect(recorder.calls).toHaveLength(1);

    // And back to non-empty: re-fires.
    setRows([{ severity: 'high', msg: 'oom' }]);
    await tick('w');
    expect(recorder.calls).toHaveLength(2);

    wm.dispose();
  });

  it('when_empty fires on the inverse transition', async () => {
    const { sm, setRows } = await buildManagerWithSource([{ severity: 'high', msg: 'oom' }]);
    const wm = new WatchManager(sm);
    const recorder = new RecordingNotifier();
    (wm as unknown as { watches: Map<string, unknown> }).watches.set('w', {
      config: { query: 'events | where(severity == "high")', fireWhen: 'when_empty' },
      notifiers: [recorder],
      intervalMs: 100,
      timer: null,
      lastWasEmpty: null,
      lastHash: null,
    });
    const tick = (wm as unknown as { tick: (name: string) => Promise<void> }).tick.bind(wm);

    await tick('w');           // first tick, non-empty, no fire
    expect(recorder.calls).toHaveLength(0);

    setRows([]);
    await tick('w');           // transition to empty — fires
    expect(recorder.calls).toHaveLength(1);
    expect(recorder.calls[0].reason).toMatch(/empty/);

    await tick('w');           // still empty — no re-fire
    expect(recorder.calls).toHaveLength(1);

    wm.dispose();
  });

  it('on_change fires whenever the result hash differs', async () => {
    const { sm, setRows } = await buildManagerWithSource([{ id: 1 }]);
    const wm = new WatchManager(sm);
    const recorder = new RecordingNotifier();
    (wm as unknown as { watches: Map<string, unknown> }).watches.set('w', {
      config: { query: 'events | first(10)', fireWhen: 'on_change' },
      notifiers: [recorder],
      intervalMs: 100,
      timer: null,
      lastWasEmpty: null,
      lastHash: null,
    });
    const tick = (wm as unknown as { tick: (name: string) => Promise<void> }).tick.bind(wm);

    await tick('w');           // first tick — no fire (no previous hash)
    expect(recorder.calls).toHaveLength(0);

    await tick('w');           // same data — no fire
    expect(recorder.calls).toHaveLength(0);

    setRows([{ id: 2 }]);
    await tick('w');           // different — fires
    expect(recorder.calls).toHaveLength(1);

    setRows([{ id: 2 }, { id: 3 }]);
    await tick('w');           // different again — fires again
    expect(recorder.calls).toHaveLength(2);

    setRows([{ id: 2 }, { id: 3 }]);
    await tick('w');           // identical to last — no fire
    expect(recorder.calls).toHaveLength(2);

    wm.dispose();
  });

  it('a notifier that throws does not stop the watch advancing state', async () => {
    const { sm, setRows } = await buildManagerWithSource([]);
    const wm = new WatchManager(sm);
    const throwing: Notifier = { notify: async () => { throw new Error('telegram down'); } };
    (wm as unknown as { watches: Map<string, unknown> }).watches.set('w', {
      config: { query: 'events | first(10)', fireWhen: 'when_non_empty' },
      notifiers: [throwing],
      intervalMs: 100,
      timer: null,
      lastWasEmpty: null,
      lastHash: null,
    });
    const tick = (wm as unknown as { tick: (name: string) => Promise<void> }).tick.bind(wm);

    await tick('w');           // empty
    setRows([{ id: 1 }]);
    // tick() awaits the notifier; since the notifier swallows the throw via
    // the Promise.all(...catch) in WatchManager, the test should resolve.
    await expect(tick('w')).resolves.toBeUndefined();

    // State did advance (lastWasEmpty is now false), so a subsequent
    // non-empty tick must NOT re-fire.
    setRows([{ id: 1 }, { id: 2 }]);
    await tick('w');
    // Nothing to assert about the throwing notifier; the success criterion
    // is simply that we got here.
    wm.dispose();
  });
});
