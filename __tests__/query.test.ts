import { describe, it, expect } from 'vitest';
import { query, compile, clearCache } from '../src/engine/index';
import { RuntimeError, LexerError } from '../src/engine/types';

// Helper: standalone aggregates need _data | prefix since they aren't operation keywords
const q = (data: any[], expr: string) => query(data, expr);
const qp = (data: any[], expr: string) => query(data, `_data | ${expr}`);

const sales = [
  { id: 1, product: 'Widget', category: 'A', price: 10, qty: 5, region: 'East' },
  { id: 2, product: 'Gadget', category: 'B', price: 25, qty: 3, region: 'West' },
  { id: 3, product: 'Doohickey', category: 'A', price: 15, qty: 8, region: 'East' },
  { id: 4, product: 'Thingamajig', category: 'B', price: 30, qty: 2, region: 'West' },
  { id: 5, product: 'Whatchamacallit', category: 'A', price: 20, qty: 4, region: 'North' },
];

describe('query() - Core Operations', () => {
  describe('where', () => {
    it('filters rows by condition', () => {
      const result = q(sales, 'where(price > 15)') as any[];
      expect(result).toHaveLength(3);
      expect(result.every(r => r.price > 15)).toBe(true);
    });

    it('filters with equality', () => {
      const result = q(sales, 'where(category == "A")') as any[];
      expect(result).toHaveLength(3);
    });

    it('filters with logical AND', () => {
      const result = q(sales, 'where(price > 10 && region == "East")') as any[];
      expect(result).toHaveLength(1);
      expect(result[0].product).toBe('Doohickey');
    });

    it('filters with NOT', () => {
      const result = q(sales, 'where(!(category == "A"))') as any[];
      expect(result).toHaveLength(2);
    });

    it('filters with inequality !=', () => {
      const result = q(sales, 'where(category != "A")') as any[];
      expect(result).toHaveLength(2);
    });

    it('filters with <= and >=', () => {
      const result = q(sales, 'where(price >= 15 && price <= 25)') as any[];
      expect(result).toHaveLength(3); // 15, 25, 20
    });
  });

  describe('select', () => {
    it('selects specific fields', () => {
      const result = q(sales, 'select(id, product)') as any[];
      expect(result).toHaveLength(5);
      expect(Object.keys(result[0])).toEqual(['id', 'product']);
    });

    it('selects with alias', () => {
      const result = q(sales, 'select(price as cost)') as any[];
      expect(result[0]).toHaveProperty('cost', 10);
    });

    it('selects with computed expression', () => {
      const result = q(sales, 'select(id, price * qty as total)') as any[];
      expect(result[0].total).toBe(50);
      expect(result[1].total).toBe(75);
    });
  });

  describe('sort', () => {
    it('sorts ascending by default', () => {
      const result = q(sales, 'sort(price)') as any[];
      expect(result.map(r => r.price)).toEqual([10, 15, 20, 25, 30]);
    });

    it('sorts descending', () => {
      const result = q(sales, 'sort(price desc)') as any[];
      expect(result.map(r => r.price)).toEqual([30, 25, 20, 15, 10]);
    });

    it('sorts by multiple criteria', () => {
      const result = q(sales, 'sort(category asc, price desc)') as any[];
      expect(result[0]).toMatchObject({ category: 'A', price: 20 });
      expect(result[1]).toMatchObject({ category: 'A', price: 15 });
      expect(result[2]).toMatchObject({ category: 'A', price: 10 });
    });
  });

  describe('first / last', () => {
    it('takes first N rows', () => {
      const result = q(sales, 'first(2)') as any[];
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
    });

    it('takes last N rows', () => {
      const result = q(sales, 'last(2)') as any[];
      expect(result).toHaveLength(2);
      expect(result[1].id).toBe(5);
    });
  });

  describe('distinct', () => {
    it('deduplicates by all fields', () => {
      const data = [{ a: 1, b: 2 }, { a: 1, b: 2 }, { a: 1, b: 3 }];
      const result = q(data, 'distinct()') as any[];
      expect(result).toHaveLength(2);
    });

    it('deduplicates by specific fields', () => {
      const result = q(sales, 'distinct(category)') as any[];
      const categories = result.map(r => r.category);
      expect(new Set(categories).size).toBe(categories.length);
    });
  });

  describe('map', () => {
    it('adds computed columns without removing existing ones', () => {
      const result = q(sales, 'map(price * qty as total)') as any[];
      expect(result[0].total).toBe(50);
      expect(result[0].id).toBe(1); // original fields preserved
    });
  });

  describe('flatten', () => {
    it('flattens array field', () => {
      const data = [
        { id: 1, tags: ['a', 'b'] },
        { id: 2, tags: ['c'] },
      ];
      const result = q(data, 'flatten(tags)') as any[];
      expect(result).toEqual(['a', 'b', 'c']);
    });
  });

  describe('transpose', () => {
    it('transposes rows to columns', () => {
      const data = [
        { name: 'Alice', score: 90 },
        { name: 'Bob', score: 85 },
      ];
      const result = q(data, 'transpose(name)') as any[];
      expect(result).toEqual([{ _field: 'score', Alice: 90, Bob: 85 }]);
    });
  });

  describe('reduce', () => {
    it('accumulates a scalar result', () => {
      const result = q(sales, 'reduce(0, _acc + price)');
      expect(result).toBe(100); // 10+25+15+30+20
    });
  });
});

describe('query() - GroupBy + Aggregates', () => {
  it('groups and counts', () => {
    const result = q(sales, 'groupBy(category) | select(category, count() as n)') as any[];
    const a = result.find(r => r.category === 'A');
    const b = result.find(r => r.category === 'B');
    expect(a!.n).toBe(3);
    expect(b!.n).toBe(2);
  });

  it('groups and sums', () => {
    const result = q(sales, 'groupBy(category) | select(category, sum(price) as total)') as any[];
    const a = result.find(r => r.category === 'A');
    expect(a!.total).toBe(45); // 10+15+20
  });

  it('groups and averages', () => {
    const result = q(sales, 'groupBy(category) | select(category, avg(price) as mean)') as any[];
    const a = result.find(r => r.category === 'A');
    expect(a!.mean).toBe(15); // (10+15+20)/3
  });

  it('groups and finds min/max', () => {
    const result = q(sales, 'groupBy(category) | select(category, min(price) as lo, max(price) as hi)') as any[];
    const a = result.find(r => r.category === 'A');
    expect(a!.lo).toBe(10);
    expect(a!.hi).toBe(20);
  });

  it('groups with multiple keys', () => {
    const result = q(sales, 'groupBy(category, region) | select(category, region, count() as n)') as any[];
    const ae = result.find(r => r.category === 'A' && r.region === 'East');
    expect(ae!.n).toBe(2);
  });

  it('grouped distinct_count', () => {
    const result = q(sales, 'groupBy(category) | select(category, distinct_count(region) as regions)') as any[];
    const a = result.find(r => r.category === 'A');
    expect(a!.regions).toBe(2); // East, North
  });

  it('grouped first_value / last_value', () => {
    const result = q(sales, 'groupBy(category) | select(category, first_value(product) as first, last_value(product) as last)') as any[];
    const a = result.find(r => r.category === 'A');
    expect(a!.first).toBe('Widget');
    expect(a!.last).toBe('Whatchamacallit');
  });
});

describe('query() - Standalone Aggregates (pipeline-level)', () => {
  it('sum', () => {
    expect(qp(sales, 'sum(price)')).toBe(100);
  });

  it('avg', () => {
    expect(qp(sales, 'avg(price)')).toBe(20);
  });

  it('count', () => {
    expect(qp(sales, 'count()')).toBe(5);
  });

  it('min / max', () => {
    expect(qp(sales, 'min(price)')).toBe(10);
    expect(qp(sales, 'max(price)')).toBe(30);
  });

  it('median', () => {
    expect(qp(sales, 'median(price)')).toBe(20);
  });

  it('median of even count', () => {
    const data = [{ v: 1 }, { v: 2 }, { v: 3 }, { v: 4 }];
    expect(qp(data, 'median(v)')).toBe(2.5);
  });

  it('stddev', () => {
    const data = [{ v: 2 }, { v: 4 }, { v: 4 }, { v: 4 }, { v: 5 }, { v: 5 }, { v: 7 }, { v: 9 }];
    const result = qp(data, 'stddev(v)') as number;
    expect(result).toBeCloseTo(2.0, 1);
  });

  it('variance', () => {
    const data = [{ v: 2 }, { v: 4 }, { v: 4 }, { v: 4 }, { v: 5 }, { v: 5 }, { v: 7 }, { v: 9 }];
    const result = qp(data, 'var(v)') as number;
    expect(result).toBeCloseTo(4.0, 1);
  });

  it('percentile', () => {
    const data = Array.from({ length: 100 }, (_, i) => ({ v: i + 1 }));
    const result = qp(data, 'percentile(v, 50)') as number;
    expect(result).toBeCloseTo(50.5, 0);
  });

  it('distinct_count', () => {
    expect(qp(sales, 'distinct_count(category)')).toBe(2);
  });

  it('sum_abs', () => {
    const data = [{ v: -3 }, { v: 4 }, { v: -2 }];
    expect(qp(data, 'sum_abs(v)')).toBe(9);
  });

  it('abs_sum', () => {
    const data = [{ v: -3 }, { v: 4 }, { v: -2 }];
    expect(qp(data, 'abs_sum(v)')).toBe(1); // |(-3+4-2)| = |-1| = 1
  });

  it('first_value / last_value', () => {
    expect(qp(sales, 'first_value(product)')).toBe('Widget');
    expect(qp(sales, 'last_value(product)')).toBe('Whatchamacallit');
  });
});

describe('query() - Finance Aggregates', () => {
  const trades = [
    { symbol: 'AAPL', price: 150, volume: 1000, ret: 0.05 },
    { symbol: 'AAPL', price: 155, volume: 2000, ret: -0.02 },
    { symbol: 'GOOG', price: 2800, volume: 500, ret: 0.03 },
    { symbol: 'GOOG', price: 2750, volume: 800, ret: -0.01 },
  ];

  it('vwap (volume-weighted average price)', () => {
    const result = qp(trades, 'vwap(price, volume)') as number;
    const expected = (150000 + 310000 + 1400000 + 2200000) / 4300;
    expect(result).toBeCloseTo(expected, 4);
  });

  it('wavg (weighted average)', () => {
    const data = [{ val: 10, w: 1 }, { val: 20, w: 3 }];
    const result = qp(data, 'wavg(val, w)') as number;
    expect(result).toBeCloseTo(17.5, 4);
  });

  it('drawdown', () => {
    const data = [{ v: 100 }, { v: 120 }, { v: 90 }, { v: 110 }];
    const result = qp(data, 'drawdown(v)') as number;
    expect(result).toBeCloseTo(-0.25, 4);
  });

  it('sharpe ratio', () => {
    const data = [{ r: 0.1 }, { r: 0.2 }, { r: 0.15 }];
    const result = qp(data, 'sharpe(r)') as number;
    expect(result).toBeGreaterThan(0);
  });

  it('sortino ratio', () => {
    const data = [{ r: 0.1 }, { r: -0.05 }, { r: 0.15 }, { r: -0.02 }];
    const result = qp(data, 'sortino(r)') as number;
    expect(typeof result).toBe('number');
  });

  it('calmar ratio', () => {
    const data = [{ v: 100 }, { v: 110 }, { v: 95 }, { v: 120 }];
    const result = qp(data, 'calmar(v)') as number;
    expect(typeof result).toBe('number');
  });

  it('info_ratio', () => {
    const data = [
      { port: 0.10, bench: 0.08 },
      { port: 0.12, bench: 0.11 },
      { port: 0.09, bench: 0.10 },
    ];
    const result = qp(data, 'info_ratio(port, bench)') as number;
    expect(typeof result).toBe('number');
  });

  it('grouped vwap', () => {
    const result = q(trades,
      'groupBy(symbol) | select(symbol, vwap(price, volume) as vwap)') as any[];
    const aapl = result.find(r => r.symbol === 'AAPL');
    expect(aapl!.vwap).toBeCloseTo(153.333, 2);
  });
});

describe('query() - Statistical Aggregates in Groups', () => {
  const data = [
    { g: 'X', v: 2 },
    { g: 'X', v: 4 },
    { g: 'X', v: 4 },
    { g: 'X', v: 4 },
    { g: 'X', v: 5 },
    { g: 'X', v: 5 },
    { g: 'X', v: 7 },
    { g: 'X', v: 9 },
  ];

  it('grouped median', () => {
    const result = q(data, 'groupBy(g) | select(g, median(v) as med)') as any[];
    expect(result[0].med).toBe(4.5);
  });

  it('grouped stddev', () => {
    const result = q(data, 'groupBy(g) | select(g, stddev(v) as sd)') as any[];
    expect(result[0].sd).toBeCloseTo(2.0, 1);
  });

  it('grouped variance', () => {
    const result = q(data, 'groupBy(g) | select(g, var(v) as variance)') as any[];
    expect(result[0].variance).toBeCloseTo(4.0, 1);
  });
});

describe('query() - Join', () => {
  const orders = [
    { orderId: 1, customerId: 'C1', amount: 100 },
    { orderId: 2, customerId: 'C2', amount: 200 },
    { orderId: 3, customerId: 'C1', amount: 150 },
  ];
  const customers = [
    { customerId: 'C1', name: 'Alice' },
    { customerId: 'C2', name: 'Bob' },
  ];

  it('equi-join (hash join path)', () => {
    const ctx = { orders, customers };
    const result = query(ctx, 'orders | join(customers, customerId == customerId)') as any[];
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('Alice');
    expect(result[1].name).toBe('Bob');
  });

  it('join with complex condition (nested loop path)', () => {
    // When both tables have `customerId`, the spread merge means the right overwrites left.
    // So customerId == customerId is always true on the combined row.
    // The && with amount > 100 then filters: orders with amount > 100 are orderId 2 (200) and 3 (150).
    // Each matches both customers = 4 results.
    const ctx = { orders, customers };
    const result = query(ctx, 'orders | join(customers, customerId == customerId && amount > 100)') as any[];
    expect(result).toHaveLength(4);
  });

  it('throws on missing join source', () => {
    expect(() => query({ orders }, 'orders | join(missing, orderId == orderId)')).toThrow(RuntimeError);
  });
});

describe('query() - Rollup', () => {
  it('produces hierarchical subtotals', () => {
    const result = q(sales, 'rollup(category, sum(price) as total)') as any[];
    const grandTotal = result.find(r => r.category === null);
    expect(grandTotal!.total).toBe(100);
    const catA = result.find(r => r.category === 'A' && r._rollupLevel === 0);
    expect(catA!.total).toBe(45);
  });
});

describe('query() - Pivot', () => {
  it('pivots flat data', () => {
    const data = [
      { cat: 'A', val: 10 },
      { cat: 'A', val: 20 },
      { cat: 'B', val: 30 },
    ];
    const result = q(data, 'pivot(cat, sum(val))') as any[];
    expect(result).toHaveLength(1);
    expect(result[0].A).toBe(30);
    expect(result[0].B).toBe(30);
  });

  it('pivots grouped data', () => {
    const data = [
      { region: 'East', cat: 'A', val: 10 },
      { region: 'East', cat: 'B', val: 20 },
      { region: 'West', cat: 'A', val: 30 },
      { region: 'West', cat: 'B', val: 40 },
    ];
    const result = q(data, 'groupBy(region) | pivot(cat, sum(val))') as any[];
    expect(result).toHaveLength(2);
    const east = result.find(r => r.region === 'East');
    expect(east!.A).toBe(10);
    expect(east!.B).toBe(20);
  });
});

describe('query() - Window Functions', () => {
  const data = [
    { id: 1, val: 10 },
    { id: 2, val: 20 },
    { id: 3, val: 30 },
    { id: 4, val: 40 },
  ];

  it('row_number', () => {
    const result = q(data, 'select(id, row_number() as rn)') as any[];
    expect(result.map(r => r.rn)).toEqual([1, 2, 3, 4]);
  });

  it('running_sum', () => {
    const result = q(data, 'select(id, running_sum(val) as rs)') as any[];
    expect(result.map(r => r.rs)).toEqual([10, 30, 60, 100]);
  });

  it('running_avg', () => {
    const result = q(data, 'select(id, running_avg(val) as ra)') as any[];
    expect(result[0].ra).toBe(10);
    expect(result[1].ra).toBe(15);
    expect(result[2].ra).toBe(20);
    expect(result[3].ra).toBe(25);
  });

  it('running_min / running_max', () => {
    const unsorted = [{ v: 3 }, { v: 1 }, { v: 4 }, { v: 2 }];
    const mins = q(unsorted, 'select(running_min(v) as m)') as any[];
    expect(mins.map(r => r.m)).toEqual([3, 1, 1, 1]);
    const maxs = q(unsorted, 'select(running_max(v) as m)') as any[];
    expect(maxs.map(r => r.m)).toEqual([3, 3, 4, 4]);
  });

  it('lag and lead', () => {
    const result = q(data, 'select(id, lag(val, 1) as prev, lead(val, 1) as next)') as any[];
    expect(result[0].prev).toBe(null);
    expect(result[1].prev).toBe(10);
    expect(result[2].next).toBe(40);
    expect(result[3].next).toBe(null);
  });
});

describe('query() - Built-in Functions', () => {
  const data = [{ name: 'Alice', age: 30, score: null as number | null }];

  it('if()', () => {
    const result = q(data, 'select(if(age > 25, "senior", "junior") as label)') as any[];
    expect(result[0].label).toBe('senior');
  });

  it('coalesce()', () => {
    const result = q(data, 'select(coalesce(score, 0) as s)') as any[];
    expect(result[0].s).toBe(0);
  });

  it('lower() / upper()', () => {
    const result = q(data, 'select(lower(name) as lo, upper(name) as up)') as any[];
    expect(result[0].lo).toBe('alice');
    expect(result[0].up).toBe('ALICE');
  });

  it('len()', () => {
    const result = q(data, 'select(len(name) as n)') as any[];
    expect(result[0].n).toBe(5);
  });

  it('abs()', () => {
    const d = [{ v: -5 }];
    const result = q(d, 'select(abs(v) as a)') as any[];
    expect(result[0].a).toBe(5);
  });

  it('round()', () => {
    const d = [{ v: 3.14159 }];
    const result = q(d, 'select(round(v, 2) as r)') as any[];
    expect(result[0].r).toBe(3.14);
  });

  it('concat()', () => {
    const result = q(data, 'select(concat(name, " age:", age) as label)') as any[];
    expect(result[0].label).toBe('Alice age:30');
  });
});

describe('query() - Chained Pipelines', () => {
  it('filter -> sort -> select -> first', () => {
    const result = q(sales,
      'where(category == "A") | sort(price desc) | select(product, price) | first(2)') as any[];
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ product: 'Whatchamacallit', price: 20 });
    expect(result[1]).toEqual({ product: 'Doohickey', price: 15 });
  });

  it('groupBy -> select -> sort', () => {
    const result = q(sales,
      'groupBy(category) | select(category, sum(price) as total) | sort(total desc)') as any[];
    expect(result[0].category).toBe('B'); // 55
    expect(result[1].category).toBe('A'); // 45
  });
});

describe('query() - DataContext', () => {
  it('works with named source in DataContext', () => {
    const ctx = { products: sales };
    const result = query(ctx, 'products | where(price > 20)') as any[];
    expect(result).toHaveLength(2);
  });

  it('throws on missing source', () => {
    expect(() => query({ foo: [] }, 'bar | first(1)')).toThrow(RuntimeError);
  });
});

describe('query() - Edge Cases', () => {
  it('empty dataset with pipeline aggregate', () => {
    expect(qp([], 'count()')).toBe(0);
    expect(qp([], 'sum(x)')).toBe(0);
    expect(qp([], 'avg(x)')).toBe(0);
  });

  it('single row', () => {
    expect(qp([{ v: 42 }], 'sum(v)')).toBe(42);
    expect(qp([{ v: 42 }], 'avg(v)')).toBe(42);
    expect(qp([{ v: 42 }], 'count()')).toBe(1);
  });

  it('null handling in fields', () => {
    const data = [{ a: null }, { a: 5 }, { a: null }];
    const result = q(data, 'where(a != null)') as any[];
    expect(result).toHaveLength(1);
  });

  it('deep field access', () => {
    const data = [{ user: { address: { city: 'NYC' } } }];
    const result = q(data, 'select(user.address.city as city)') as any[];
    expect(result[0].city).toBe('NYC');
  });

  it('arithmetic expressions in where', () => {
    const result = q(sales, 'where(price * qty > 100)') as any[];
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(r => r.price * r.qty > 100)).toBe(true);
  });
});

describe('compile() and caching', () => {
  it('returns a callable function with metadata', () => {
    clearCache();
    const fn = compile('_data | where(x > 1)');
    expect(typeof fn).toBe('function');
    expect(fn.source).toBe('_data | where(x > 1)');
    expect(fn.ast.kind).toBe('Pipeline');
  });

  it('cache hit returns same function', () => {
    clearCache();
    const fn1 = compile('_data | first(1)');
    const fn2 = compile('_data | first(1)');
    expect(fn1).toBe(fn2);
  });

  it('cache can be bypassed', () => {
    clearCache();
    const fn1 = compile('_data | first(1)', false);
    const fn2 = compile('_data | first(1)', false);
    expect(fn1).not.toBe(fn2);
  });
});

describe('Error handling', () => {
  it('LexerError on invalid characters', () => {
    expect(() => query([], '$invalid')).toThrow(LexerError);
  });

  it('ParseError on invalid syntax', () => {
    expect(() => compile('_data | where(')).toThrow();
  });

  it('RuntimeError on unknown function', () => {
    expect(() => q([{ x: 1 }], 'select(bogus(x))')).toThrow(RuntimeError);
  });

  it('RuntimeError on non-array source', () => {
    expect(() => query({ data: 'not_array' as any }, 'data | first(1)')).toThrow(RuntimeError);
  });
});
