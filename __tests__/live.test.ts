import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LiveQuery, liveQuery } from '../src/engine/live';
import { RuntimeError } from '../src/engine/types';

describe('LiveQuery', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  const makeData = () => [
    { id: 1, val: 10 },
    { id: 2, val: 20 },
    { id: 3, val: 30 },
  ];

  it('executes initial query on construction', () => {
    const lq = liveQuery(makeData(), 'where(val > 15)', { key: 'id' });
    const result = lq.result as any[];
    expect(result).toHaveLength(2);
    expect(lq.stats.tick).toBe(1);
    lq.dispose();
  });

  it('size reflects the number of indexed rows', () => {
    const lq = liveQuery(makeData(), '_data | first(3)', { key: 'id' });
    expect(lq.size).toBe(3);
    lq.dispose();
  });

  it('patch adds and updates rows', () => {
    const lq = liveQuery(makeData(), 'where(val > 0)', { key: 'id' });
    expect((lq.result as any[]).length).toBe(3);

    lq.patch([{ id: 4, val: 40 }]); // add
    vi.advanceTimersByTime(10);
    expect((lq.result as any[]).length).toBe(4);

    lq.patch([{ id: 2, val: 25 }]); // update
    vi.advanceTimersByTime(10);
    expect(lq.size).toBe(4);
    lq.dispose();
  });

  it('patch removes rows', () => {
    const lq = liveQuery(makeData(), 'where(val > 0)', { key: 'id' });
    lq.patch([], ['1']); // remove id=1
    vi.advanceTimersByTime(10);
    expect((lq.result as any[]).length).toBe(2);
    lq.dispose();
  });

  it('subscribe receives updates', () => {
    const lq = liveQuery(makeData(), 'where(val > 0)', { key: 'id' });
    const calls: unknown[] = [];
    lq.subscribe((result) => calls.push(result));

    lq.patch([{ id: 4, val: 40 }]);
    vi.advanceTimersByTime(10);

    expect(calls.length).toBeGreaterThan(0);
    lq.dispose();
  });

  it('unsubscribe stops notifications', () => {
    const lq = liveQuery(makeData(), 'where(val > 0)', { key: 'id' });
    const calls: unknown[] = [];
    const unsub = lq.subscribe((result) => calls.push(result));
    unsub();

    lq.patch([{ id: 4, val: 40 }]);
    vi.advanceTimersByTime(10);

    expect(calls).toHaveLength(0);
    lq.dispose();
  });

  it('reset replaces all data', () => {
    const lq = liveQuery(makeData(), 'where(val > 0)', { key: 'id' });
    lq.reset([{ id: 10, val: 100 }]);
    vi.advanceTimersByTime(10);
    expect((lq.result as any[]).length).toBe(1);
    expect(lq.size).toBe(1);
    lq.dispose();
  });

  it('setQuery changes the active query', () => {
    const lq = liveQuery(makeData(), 'where(val > 15)', { key: 'id' });
    expect((lq.result as any[]).length).toBe(2);

    lq.setQuery('where(val > 25)');
    vi.advanceTimersByTime(10);
    expect((lq.result as any[]).length).toBe(1);
    lq.dispose();
  });

  it('batching coalesces multiple patches', () => {
    const lq = liveQuery(makeData(), 'where(val > 0)', { key: 'id' });
    const calls: unknown[] = [];
    lq.subscribe((result) => calls.push(result));

    lq.beginBatch();
    lq.patch([{ id: 4, val: 40 }]);
    lq.patch([{ id: 5, val: 50 }]);
    vi.advanceTimersByTime(10);
    expect(calls).toHaveLength(0); // no execution during batch

    lq.endBatch();
    vi.advanceTimersByTime(10);
    expect((lq.result as any[]).length).toBe(5);
    lq.dispose();
  });

  it('endBatch without beginBatch throws', () => {
    const lq = liveQuery(makeData(), 'where(val > 0)', { key: 'id' });
    expect(() => lq.endBatch()).toThrow(RuntimeError);
    lq.dispose();
  });

  it('dispose prevents further operations', () => {
    const lq = liveQuery(makeData(), 'where(val > 0)', { key: 'id' });
    lq.dispose();
    expect(() => lq.patch([{ id: 4, val: 40 }])).toThrow(RuntimeError);
    expect(() => lq.subscribe(() => {})).toThrow(RuntimeError);
    expect(() => lq.reset([])).toThrow(RuntimeError);
    expect(() => lq.setQuery('where(val > 0)')).toThrow(RuntimeError);
    expect(() => lq.beginBatch()).toThrow(RuntimeError);
  });

  it('works with DataContext input', () => {
    const ctx = { trades: makeData() };
    const lq = new LiveQuery(ctx, 'trades | where(val > 15)', { key: 'id', source: 'trades' });
    expect((lq.result as any[]).length).toBe(2);
    lq.dispose();
  });

  it('composite key (multiple fields)', () => {
    const data = [
      { a: 1, b: 'x', val: 10 },
      { a: 1, b: 'y', val: 20 },
    ];
    const lq = liveQuery(data, 'where(val > 0)', { key: ['a', 'b'] });
    expect((lq.result as any[]).length).toBe(2);

    lq.patch([{ a: 1, b: 'x', val: 15 }]); // update
    vi.advanceTimersByTime(10);
    expect(lq.size).toBe(2); // still 2, not 3

    lq.patch([], [['1', 'x']]); // remove composite key
    vi.advanceTimersByTime(10);
    expect(lq.size).toBe(1);
    lq.dispose();
  });

  it('throws when row is missing key field', () => {
    expect(() => {
      liveQuery([{ notId: 1 }], 'where(notId > 0)', { key: 'id' });
    }).toThrow(RuntimeError);
  });

  it('throttle delays execution', () => {
    const lq = liveQuery(makeData(), 'where(val > 0)', { key: 'id', throttle: 100 });
    const calls: unknown[] = [];
    lq.subscribe((result) => calls.push(result));

    lq.patch([{ id: 4, val: 40 }]);
    vi.advanceTimersByTime(50);
    expect(calls).toHaveLength(0); // not yet

    vi.advanceTimersByTime(60);
    expect(calls.length).toBeGreaterThan(0);
    lq.dispose();
  });

  it('stats are updated correctly', () => {
    const lq = liveQuery(makeData(), 'where(val > 10)', { key: 'id' });
    expect(lq.stats.tick).toBe(1);
    expect(lq.stats.rowCount).toBe(3);
    expect(lq.stats.resultCount).toBe(2);

    lq.patch([{ id: 4, val: 40 }]);
    vi.advanceTimersByTime(10);
    expect(lq.stats.tick).toBe(2);
    expect(lq.stats.patchCount).toBe(1);
    lq.dispose();
  });
});
