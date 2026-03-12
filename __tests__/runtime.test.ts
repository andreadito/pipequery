import { describe, it, expect } from 'vitest';
import {
  getFieldAccessor,
  compareValues,
  groupByFn,
  nestedLoopJoin,
  hashJoin,
  distinctFn,
  transposeFn,
  rollupFn,
  computeWindowValues,
} from '../src/engine/runtime';

describe('getFieldAccessor', () => {
  it('accesses single-level field', () => {
    const fn = getFieldAccessor(['name']);
    expect(fn({ name: 'Alice' })).toBe('Alice');
  });

  it('accesses nested field', () => {
    const fn = getFieldAccessor(['user', 'address', 'city']);
    expect(fn({ user: { address: { city: 'NYC' } } })).toBe('NYC');
  });

  it('returns undefined for missing nested path', () => {
    const fn = getFieldAccessor(['user', 'address', 'city']);
    expect(fn({ user: null })).toBeUndefined();
    expect(fn({})).toBeUndefined();
  });

  it('caches accessor functions', () => {
    const fn1 = getFieldAccessor(['x']);
    const fn2 = getFieldAccessor(['x']);
    expect(fn1).toBe(fn2);
  });
});

describe('compareValues', () => {
  it('equal values return 0', () => {
    expect(compareValues(5, 5)).toBe(0);
    expect(compareValues('a', 'a')).toBe(0);
    expect(compareValues(null, null)).toBe(0);
  });

  it('null sorts before non-null', () => {
    expect(compareValues(null, 5)).toBe(-1);
    expect(compareValues(5, null)).toBe(1);
  });

  it('compares numbers numerically', () => {
    expect(compareValues(1, 2)).toBeLessThan(0);
    expect(compareValues(10, 3)).toBeGreaterThan(0);
  });

  it('compares strings lexicographically', () => {
    expect(compareValues('apple', 'banana')).toBeLessThan(0);
  });
});

describe('groupByFn', () => {
  const data = [
    { cat: 'A', val: 1 },
    { cat: 'B', val: 2 },
    { cat: 'A', val: 3 },
  ];

  it('groups by single key', () => {
    const groups = groupByFn(data, [{ fn: r => r.cat, name: 'cat' }]);
    expect(groups).toHaveLength(2);
    const a = groups.find(g => g.keys.cat === 'A');
    expect(a!.rows).toHaveLength(2);
  });

  it('groups by multiple keys', () => {
    const multiData = [
      { a: 1, b: 'x', v: 10 },
      { a: 1, b: 'y', v: 20 },
      { a: 1, b: 'x', v: 30 },
    ];
    const groups = groupByFn(multiData, [
      { fn: r => r.a, name: 'a' },
      { fn: r => r.b, name: 'b' },
    ]);
    expect(groups).toHaveLength(2);
  });
});

describe('nestedLoopJoin', () => {
  it('joins matching rows', () => {
    const left = [{ id: 1, a: 10 }, { id: 2, a: 20 }];
    const right = [{ id: 1, b: 100 }, { id: 3, b: 300 }];
    const result = nestedLoopJoin(left, right, (row) => row.id === row.id);
    // condition: combined.id === combined.id — always true since right overwrites left id
    // Actually with spread, right.id overwrites left.id, so condition is always true
    // Let's test with distinct field names
    const l = [{ lid: 1 }, { lid: 2 }];
    const r = [{ rid: 1 }, { rid: 3 }];
    const res = nestedLoopJoin(l, r, (row) => row.lid === row.rid);
    expect(res).toHaveLength(1);
    expect(res[0]).toEqual({ lid: 1, rid: 1 });
  });
});

describe('hashJoin', () => {
  it('joins on matching keys', () => {
    const left = [{ id: 1, a: 10 }, { id: 2, a: 20 }];
    const right = [{ id: 1, b: 100 }, { id: 2, b: 200 }, { id: 3, b: 300 }];
    const result = hashJoin(left, right, r => r.id, r => r.id);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 1, a: 10, b: 100 });
  });

  it('handles one-to-many', () => {
    const left = [{ id: 1 }];
    const right = [{ id: 1, v: 'a' }, { id: 1, v: 'b' }];
    const result = hashJoin(left, right, r => r.id, r => r.id);
    expect(result).toHaveLength(2);
  });

  it('handles no matches', () => {
    const left = [{ id: 1 }];
    const right = [{ id: 2 }];
    const result = hashJoin(left, right, r => r.id, r => r.id);
    expect(result).toHaveLength(0);
  });
});

describe('distinctFn', () => {
  it('removes duplicates by full row', () => {
    const data = [{ a: 1 }, { a: 2 }, { a: 1 }];
    expect(distinctFn(data)).toHaveLength(2);
  });

  it('removes duplicates by custom key', () => {
    const data = [{ a: 1, b: 10 }, { a: 1, b: 20 }, { a: 2, b: 30 }];
    const result = distinctFn(data, (r) => String(r.a));
    expect(result).toHaveLength(2);
    expect(result[0].b).toBe(10); // keeps first occurrence
  });
});

describe('transposeFn', () => {
  it('transposes without header', () => {
    const data = [{ a: 1, b: 2 }, { a: 3, b: 4 }];
    const result = transposeFn(data);
    expect(result).toHaveLength(2);
    expect(result.find(r => r._field === 'a')).toMatchObject({ col_0: 1, col_1: 3 });
  });

  it('transposes with header function', () => {
    const data = [
      { name: 'X', val: 10 },
      { name: 'Y', val: 20 },
    ];
    const result = transposeFn(data, r => r.name, 'name');
    expect(result).toEqual([{ _field: 'val', X: 10, Y: 20 }]);
  });

  it('returns empty for empty input', () => {
    expect(transposeFn([])).toEqual([]);
  });
});

describe('rollupFn', () => {
  const data = [
    { cat: 'A', val: 10, _group: [] },
    { cat: 'A', val: 20, _group: [] },
    { cat: 'B', val: 30, _group: [] },
  ];

  it('produces subtotals and grand total', () => {
    const result = rollupFn(
      data,
      [{ fn: r => r.cat, name: 'cat' }],
      [{ fn: (r: any) => r._group.reduce((s: number, row: any) => s + row.val, 0), name: 'total' }],
    );
    // Level 0: per category, Level 1: grand total
    const grandTotal = result.find(r => r._rollupLevel === 1);
    expect(grandTotal!.cat).toBeNull();
    const catA = result.find(r => r.cat === 'A' && r._rollupLevel === 0);
    expect(catA).toBeDefined();
  });
});

describe('computeWindowValues', () => {
  const data = [{ v: 10 }, { v: 20 }, { v: 30 }];

  it('computes row_number', () => {
    const results = computeWindowValues(data, [
      { id: 'w1', name: 'row_number', offset: 1 },
    ]);
    expect(results.map(r => r.w1)).toEqual([1, 2, 3]);
  });

  it('computes running_sum', () => {
    const results = computeWindowValues(data, [
      { id: 'w1', name: 'running_sum', fieldFn: r => r.v, offset: 1 },
    ]);
    expect(results.map(r => r.w1)).toEqual([10, 30, 60]);
  });

  it('computes running_avg', () => {
    const results = computeWindowValues(data, [
      { id: 'w1', name: 'running_avg', fieldFn: r => r.v, offset: 1 },
    ]);
    expect(results.map(r => r.w1)).toEqual([10, 15, 20]);
  });

  it('computes lag', () => {
    const results = computeWindowValues(data, [
      { id: 'w1', name: 'lag', fieldFn: r => r.v, offset: 1 },
    ]);
    expect(results.map(r => r.w1)).toEqual([null, 10, 20]);
  });

  it('computes lead', () => {
    const results = computeWindowValues(data, [
      { id: 'w1', name: 'lead', fieldFn: r => r.v, offset: 1 },
    ]);
    expect(results.map(r => r.w1)).toEqual([20, 30, null]);
  });

  it('computes running_min / running_max', () => {
    const unsorted = [{ v: 5 }, { v: 2 }, { v: 8 }, { v: 1 }];
    const mins = computeWindowValues(unsorted, [
      { id: 'w1', name: 'running_min', fieldFn: r => r.v, offset: 1 },
    ]);
    expect(mins.map(r => r.w1)).toEqual([5, 2, 2, 1]);

    const maxs = computeWindowValues(unsorted, [
      { id: 'w1', name: 'running_max', fieldFn: r => r.v, offset: 1 },
    ]);
    expect(maxs.map(r => r.w1)).toEqual([5, 5, 8, 8]);
  });
});
