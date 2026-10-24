/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import { parseQuery, query, printQuery, compileAst, ParseError } from '../src/engine/index';
import type { DataContext, Expression } from '../src/engine/index';
import { from, col, lit, agg, fn, win, BuilderError, Query, Scalar } from '../src/builder/index';
import type { Pipeline } from '../src/builder/index';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const orders = [
  { id: 1, customerId: 10, region: 'EU', product: 'apple', total: 120, qty: 2, price: 60, ret: 0.02, ts: 1, tags: ['a', 'b'], meta: { len: 5, tier: 'gold' } },
  { id: 2, customerId: 11, region: 'US', product: 'pear', total: 80, qty: 1, price: 80, ret: -0.01, ts: 2, tags: ['c'], meta: { len: 7, tier: 'silver' } },
  { id: 3, customerId: 10, region: 'EU', product: 'apple', total: 200, qty: 4, price: 50, ret: 0.05, ts: 3, tags: [], meta: { len: 9, tier: 'gold' } },
  { id: 4, customerId: 12, region: 'US', product: 'fig', total: 50, qty: 5, price: 10, ret: 0.03, ts: 4, tags: ['d', 'e'], meta: { len: 1, tier: 'bronze' } },
  { id: 5, customerId: 11, region: 'EU', product: 'fig', total: 300, qty: 3, price: 100, ret: -0.02, ts: 5, tags: ['f'], meta: { len: 2, tier: 'silver' } },
];
const customers = [
  { id: 10, name: 'Ann' },
  { id: 11, name: 'Bob' },
  { id: 12, name: 'Cy' },
];
const ctx: DataContext = { orders, customers };

/**
 * The three guarantees of the builder for one query:
 *  1. `parseQuery(toString())` deep-equals `.ast`
 *  2. the hand-written string parses to the same AST
 *  3. `query(ctx, handWritten)` equals `.run(ctx)`
 */
function parity(b: Query | Scalar, handWritten: string, context: DataContext = ctx): unknown {
  expect(b.toString()).toBe(printQuery(parseQuery(handWritten)));
  expect(parseQuery(b.toString())).toEqual(b.ast);
  expect(parseQuery(handWritten)).toEqual(b.ast);
  const expected = query(context, handWritten);
  expect(b.run(context)).toEqual(expected);
  return expected;
}

// ─── Pipe ops ───────────────────────────────────────────────────────────────

describe('builder: pipe operations', () => {
  it('from() with no name emits _data and works with plain arrays', () => {
    const b = from();
    expect(b.toString()).toBe('_data');
    expect(b.ast).toEqual({ kind: 'Pipeline', source: '_data', operations: [] });
    expect(from().where((o) => o.total.gt(100)).toString()).toBe('_data | where(total > 100)');
    expect(from().where((o) => o.total.gt(100)).run(orders)).toEqual(
      query(orders, 'where(total > 100)'),
    );
  });

  it('where: callback, raw string and expression forms agree', () => {
    const hand = 'orders | where(total > 100)';
    parity(from('orders').where((o) => o.total.gt(100)), hand);
    parity(from('orders').where('total > 100'), hand);
    parity(from('orders').where(col('total').gt(100)), hand);
  });

  it('where: nested paths, booleans, null and logic', () => {
    parity(
      from('orders').where((o) => o.meta.tier.eq('gold').and(o.total.gte(100))),
      `orders | where(meta.tier == "gold" && total >= 100)`,
    );
    parity(
      from('orders').where((o) => o.total.gt(1).and(o.qty.lt(5)).and(o.id.ne(3))),
      'orders | where(total > 1 && qty < 5 && id != 3)',
    );
    parity(from('orders').where((o) => o.total.gt(100).not()), 'orders | where(!(total > 100))');
  });

  it('select: fields, aliases, object form and arrays', () => {
    const hand = 'orders | select(id, total * 2 as double)';
    parity(from('orders').select((o) => [o.id, o.total.times(2).as('double')]), hand);
    parity(from('orders').select('id', 'total * 2 as double'), hand);
    parity(from('orders').select('id, total * 2 as double'), hand);
    parity(from('orders').select((o) => ({ id: o.id, double: o.total.times(2) })), hand);
    parity(from('orders').select({ id: col('id'), double: col('total').times(2) }), hand);
    parity(from('orders').select(col('id'), col('total').times(2).as('double')), hand);
  });

  it('sort: asc, desc, mixed, raw', () => {
    parity(
      from('orders').sort((o) => [o.region.asc(), o.total.desc()]),
      'orders | sort(region, total desc)',
    );
    parity(from('orders').sort('region', 'total desc'), 'orders | sort(region, total desc)');
    parity(from('orders').sort(col('total').desc()), 'orders | sort(total desc)');
    parity(from('orders').sort((o) => o.total), 'orders | sort(total)');
    parity(from('orders').sort('region asc, total desc'), 'orders | sort(region, total desc)');
  });

  it('groupBy + select with aggregates', () => {
    parity(
      from('orders')
        .groupBy((o) => o.region)
        .select((o) => [o.region, agg.sum(o.total).as('total'), agg.count().as('n')]),
      'orders | groupBy(region) | select(region, sum(total) as total, count() as n)',
    );
    parity(
      from('orders').groupBy('region', 'product').select('region', 'product', 'avg(total) as avg'),
      'orders | groupBy(region, product) | select(region, product, avg(total) as avg)',
    );
  });

  it('groupBy with no keys groups everything', () => {
    parity(
      from('orders').groupBy().select(agg.sum('total').as('t')),
      'orders | groupBy() | select(sum(total) as t)',
    );
  });

  it('join: callback, equi-join option, raw string, expression', () => {
    const hand = 'orders | join(customers, customerId == id)';
    parity(from('orders').join('customers', (o, c) => o.customerId.eq(c.id)), hand);
    parity(from('orders').join('customers', { on: ['customerId', 'id'] }), hand);
    parity(from('orders').join('customers', { on: [col('customerId'), col('id')] }), hand);
    parity(from('orders').join('customers', 'customerId == id'), hand);
    parity(from('orders').join('customers', col('customerId').eq(col('id'))), hand);
  });

  it('join: non-equi conditions use the nested loop path', () => {
    parity(
      from('orders').join('customers', (o, c) => o.customerId.eq(c.id).and(o.total.gt(100))),
      'orders | join(customers, customerId == id && total > 100)',
    );
  });

  it('join: dotted paths in { on }', () => {
    const b = from('orders').join('customers', { on: ['meta.tier', 'id'] });
    expect(b.toString()).toBe('orders | join(customers, meta.tier == id)');
  });

  it('first and last', () => {
    parity(from('orders').first(2), 'orders | first(2)');
    parity(from('orders').last(2), 'orders | last(2)');
    parity(from('orders').first(0), 'orders | first(0)');
  });

  it('distinct: all fields and by fields', () => {
    parity(from('orders').distinct(), 'orders | distinct()');
    parity(from('orders').distinct((o) => o.region), 'orders | distinct(region)');
    parity(from('orders').distinct('region', 'product'), 'orders | distinct(region, product)');
    parity(from('orders').distinct((o) => [o.region, o.product]), 'orders | distinct(region, product)');
  });

  it('flatten', () => {
    parity(from('orders').flatten((o) => o.tags), 'orders | flatten(tags)');
    parity(from('orders').flatten('tags'), 'orders | flatten(tags)');
    parity(from('orders').select((o) => o.tags).flatten(), 'orders | select(tags) | flatten()');
  });

  it('transpose', () => {
    parity(
      from('orders').select('region', 'total').transpose((o) => o.region),
      'orders | select(region, total) | transpose(region)',
    );
    parity(from('orders').first(2).transpose(), 'orders | first(2) | transpose()');
  });

  it('rollup', () => {
    const hand = 'orders | rollup(region, sum(total) as total, count() as n)';
    parity(
      from('orders').rollup((o) => [o.region, agg.sum(o.total).as('total'), agg.count().as('n')]),
      hand,
    );
    parity(from('orders').rollup('region', 'sum(total) as total', 'count() as n'), hand);
    parity(
      from('orders').rollup('region', 'product', agg.sum('total').as('total')),
      'orders | rollup(region, product, sum(total) as total)',
    );
    parity(
      from('orders').rollup(agg.sum('total').as('total')),
      'orders | rollup(sum(total) as total)',
    );
  });

  it('pivot: flat and grouped', () => {
    parity(
      from('orders').pivot((o) => o.region, agg.sum('total').as('total')),
      'orders | pivot(region, sum(total) as total)',
    );
    parity(
      from('orders').pivot('region', 'sum(total) as total', 'count() as n'),
      'orders | pivot(region, sum(total) as total, count() as n)',
    );
    parity(
      from('orders')
        .groupBy((o) => o.product)
        .pivot((o) => o.region, agg.sum('total').as('total')),
      'orders | groupBy(product) | pivot(region, sum(total) as total)',
    );
  });

  it('map keeps existing fields', () => {
    parity(
      from('orders').map((o) => ({ double: o.total.times(2) })),
      'orders | map(total * 2 as double)',
    );
    parity(from('orders').map('total * 2 as double'), 'orders | map(total * 2 as double)');
  });

  it('map after groupBy keeps the grouped context', () => {
    parity(
      from('orders').groupBy('region').map(agg.sum('total').as('t')).select('region', 't'),
      'orders | groupBy(region) | map(sum(total) as t) | select(region, t)',
    );
  });

  it('reduce returns a Scalar', () => {
    const b = from('orders').reduce(0, (o) => o._acc.plus(o.total));
    expect(b).toBeInstanceOf(Scalar);
    expect(parity(b, 'orders | reduce(0, _acc + total)')).toBe(750);
    parity(from('orders').reduce('0', '_acc + total'), 'orders | reduce(0, _acc + total)');
    parity(
      from('orders').reduce(lit(0), (o) => o._acc.plus(o.total)),
      'orders | reduce(0, _acc + total)',
    );
  });

  it('chains the full pipeline', () => {
    parity(
      from('orders')
        .where((o) => o.total.gt(50))
        .join('customers', (o, c) => o.customerId.eq(c.id))
        .sort((o) => o.total.desc())
        .select((o) => ({ name: o.name, total: o.total }))
        .first(3),
      'orders | where(total > 50) | join(customers, customerId == id) | sort(total desc) | select(name, total) | first(3)',
    );
  });

  it('is immutable', () => {
    const base = from('orders').where((o) => o.total.gt(1));
    const a = base.first(1);
    const b = base.first(2);
    expect(base.toString()).toBe('orders | where(total > 1)');
    expect(a.toString()).toBe('orders | where(total > 1) | first(1)');
    expect(b.toString()).toBe('orders | where(total > 1) | first(2)');
  });
});

// ─── Operators and functions ────────────────────────────────────────────────

describe('builder: operators', () => {
  const whereOf = (e: (o: any) => any, hand: string) =>
    parity(from('orders').where(e), `orders | where(${hand})`);

  it('comparison', () => {
    whereOf((o) => o.total.gt(100), 'total > 100');
    whereOf((o) => o.total.gte(100), 'total >= 100');
    whereOf((o) => o.total.lt(100), 'total < 100');
    whereOf((o) => o.total.lte(100), 'total <= 100');
    whereOf((o) => o.region.eq('EU'), 'region == "EU"');
    whereOf((o) => o.region.ne('EU'), 'region != "EU"');
    whereOf((o) => o.id.eq(col('customerId')), 'id == customerId');
  });

  it('arithmetic with precedence', () => {
    whereOf((o) => o.total.plus(o.qty).times(2).gt(100), '(total + qty) * 2 > 100');
    whereOf((o) => o.total.plus(o.qty.times(2)).gt(100), 'total + qty * 2 > 100');
    whereOf((o) => o.total.minus(o.qty.minus(1)).gt(0), 'total - (qty - 1) > 0');
    whereOf((o) => o.total.minus(o.qty).minus(1).gt(0), 'total - qty - 1 > 0');
    whereOf((o) => o.total.div(o.qty).gt(10), 'total / qty > 10');
    whereOf((o) => o.id.mod(2).eq(1), 'id % 2 == 1');
    whereOf((o) => o.total.neg().lt(-100), '-total < -100');
    whereOf((o) => o.total.plus(-5).gt(0), 'total + -5 > 0');
  });

  it('logic with precedence', () => {
    whereOf((o) => o.total.gt(1).and(o.qty.gt(1).and(o.id.gt(1))), 'total > 1 && (qty > 1 && id > 1)');
    whereOf((o) => o.total.gt(1).and(o.qty.gt(1)).not(), '!(total > 1 && qty > 1)');
  });

  it('not() and neg() keep the operand grouped', () => {
    expect(col('a').plus(col('b')).neg().toString()).toBe('-(a + b)');
    expect(col('a').and(col('b')).not().toString()).toBe('!(a && b)');
  });

  it('or: uses parseable if() forms in where, value and grouped positions', () => {
    // The lexer cannot tokenise `||`, so `or` uses if() with the same value semantics.
    const inWhere = from('orders').where((o) => o.region.eq('US').or(o.total.gt(250)));
    expect(inWhere.ast.operations[0]).toMatchObject({
      kind: 'WhereOp',
      condition: { kind: 'FunctionCall', name: 'if' },
    });
    expect(inWhere.toString()).not.toContain('||');
    const rows = parity(
      inWhere,
      'orders | where(if(region == "US", true, total > 250))',
    ) as any[];
    expect(rows.map((r) => r.id)).toEqual([2, 4, 5]);

    parity(
      from('orders').select((o) => [o.id, o.missing.or('d').as('v'), o.region.eq('EU').or(false).as('eu')]),
      'orders | select(id, if(missing, missing, "d") as v, if(region == "EU", true, false) as eu)',
    );

    parity(
      from('orders')
        .groupBy('region')
        .select((o) => [o.region, agg.sum(o.total).gt(300).or(agg.count().gt(2)).as('flag')]),
      'orders | groupBy(region) | select(region, if(sum(total) > 300, true, count() > 2) as flag)',
    );
  });

  it('or: has the engine semantics of a || b, including non-boolean operands', () => {
    const rows = [{ a: 0, b: 'x' }, { a: 5, b: 'y' }, { a: null, b: 'z' }, { a: '', b: 'w' }];
    const built = from().select(col('a').or(col('b')).as('v'));
    const viaOr: Pipeline = {
      kind: 'Pipeline',
      source: '_data',
      operations: [{
        kind: 'SelectOp',
        fields: [{
          kind: 'AliasExpr',
          alias: 'v',
          expression: { kind: 'BinaryExpr', operator: '||', left: { kind: 'FieldAccess', path: ['a'] }, right: { kind: 'FieldAccess', path: ['b'] } },
        }],
      }],
    };
    expect(built.run(rows)).toEqual(compileAst(viaOr)({ _data: rows }));
    expect(built.run(rows)).toEqual([{ v: 'x' }, { v: 5 }, { v: 'z' }, { v: 'w' }]);
    expect(parseQuery(built.toString())).toEqual(built.ast);
  });

  it('or: a 20+ term left fold stays linear in size and runs at parity with right folds', () => {
    const values = Array.from({ length: 24 }, (_, i) => i * 3);
    const rows = Array.from({ length: 80 }, (_, i) => ({ id: i, n: i % 2 ? i : 0, s: i % 5 ? 'v' + i : '' }));
    const leftFold = (k: number) =>
      from().where((o) => values.slice(0, k).map((v) => o.id.eq(v)).reduce((a, b) => a.or(b)));
    const rightFold = from().where((o) =>
      values.map((v) => o.id.eq(v)).reduceRight((acc, e) => e.or(acc)),
    );
    const one = leftFold(1).toString().length;
    const big = leftFold(24);
    expect(big.toString().length).toBeLessThan(one * 24 * 3);
    expect(leftFold(12).toString().length).toBeLessThan(leftFold(24).toString().length);
    // each additional term adds a constant amount
    const delta = leftFold(21).toString().length - leftFold(20).toString().length;
    expect(leftFold(24).toString().length - leftFold(23).toString().length).toBe(delta);

    expect(parseQuery(big.toString())).toEqual(big.ast);
    const expected = rows.filter((r) => values.includes(r.id));
    expect(big.run(rows)).toEqual(expected);
    expect(rightFold.run(rows)).toEqual(expected);
    expect(query({ _data: rows }, big.toString())).toEqual(expected);
  });

  it('or: alternating boolean wrappers do not duplicate the prior tree', () => {
    const rows = [
      { a: false, b: 0, c: false, d: 'fallback' },
      { a: true, b: 1, c: true, d: 'value' },
      { a: false, b: 5, c: true, d: '' },
    ];
    const build = (count: number, wrapper: 'not' | 'and') => from().select((o) => {
      let e = o.a.eq(true);
      for (let i = 0; i < count; i++) {
        e = wrapper === 'not' ? e.or(o.b.gt(i)).not() : e.or(o.b.gt(i)).and(o.c.eq(true));
      }
      return e.or(o.d).as('v');
    });
    for (const wrapper of ['not', 'and'] as const) {
      const built = build(24, wrapper);
      expect(built.toString().length).toBeLessThan(24 * 150);
      expect(built.toString().length).toBeLessThan(build(12, wrapper).toString().length * 3);
      expect(parseQuery(built.toString())).toEqual(built.ast);
      expect(built.run(rows)).toEqual(query({ _data: rows }, built.toString()));
      expect(built.run(rows)).toEqual(rows.map((row) => {
        let value = row.a === true;
        for (let i = 0; i < 24; i++) {
          value = wrapper === 'not'
            ? !(value || row.b > i)
            : (value || row.b > i) && row.c === true;
        }
        return { v: value || row.d };
      }));
    }
  });

  it('or: only proven boolean left operands use true, preserving nonboolean defaults', () => {
    const rows = [
      { a: 0, b: '', flag: false },
      { a: 9, b: 'b', flag: true },
      { a: '', b: 'yes', flag: false },
      { a: null, b: 'v', flag: true },
    ];
    const built = from().select((o) => [
      o.a.or(o.b).or('fallback').as('field'),
      fn.if(o.flag, o.a, o.b).or('fallback').as('conditional'),
      o.a.as('renamed').or('fallback').as('aliased'),
      o.flag.eq(true).or('fallback').as('boolean'),
      o.a.and(o.flag.eq(true)).or('fallback').as('mixedAnd'),
      o.b.contains('v').or('fallback').as('contains'),
    ]);
    expect(parseQuery(built.toString())).toEqual(built.ast);
    expect(built.toString()).toContain('if(if(flag, a, b), if(flag, a, b), "fallback")');
    expect(built.toString()).toContain('if(a as renamed, a as renamed, "fallback")');
    expect(built.toString()).toContain('if(a && flag == true, a && flag == true, "fallback")');
    expect(built.toString()).toContain('if(contains(b, "v"), true, "fallback")');
    expect(built.run(rows)).toEqual(rows.map((r) => ({
      field: r.a || r.b || 'fallback',
      conditional: (r.flag ? r.a : r.b) || 'fallback',
      aliased: r.a || 'fallback',
      boolean: (r.flag === true) || 'fallback',
      mixedAnd: (r.a && r.flag === true) || 'fallback',
      contains: r.b.includes('v') || 'fallback',
    })));
    expect(built.run(rows)).toEqual(query({ _data: rows }, built.toString()));
  });

  it('or: chains of truthy/falsy values match a real || chain, also with not, and, aliases', () => {
    const rows = [
      { a: 0, b: '', c: null, d: 'x' },
      { a: 0, b: '', c: null, d: 0 },
      { a: 7, b: 'y', c: 1, d: 2 },
      { a: 0, b: 'q', c: 0, d: 0 },
      { a: false, b: null, c: 0, d: 'z' },
    ];
    const orChain = (...names: string[]): Pipeline => ({
      kind: 'Pipeline',
      source: '_data',
      operations: [{
        kind: 'SelectOp',
        fields: [{
          kind: 'AliasExpr',
          alias: 'v',
          expression: names
            .map((n): Expression => ({ kind: 'FieldAccess', path: [n] }))
            .reduce((l, r): Expression => ({ kind: 'BinaryExpr', operator: '||', left: l, right: r })),
        }],
      }],
    });
    const built = from().select((o) => [o.a.or(o.b).or(o.c).or(o.d).as('v')]);
    expect(built.run(rows)).toEqual(compileAst(orChain('a', 'b', 'c', 'd'))({ _data: rows }));
    expect(parseQuery(built.toString())).toEqual(built.ast);

    // right-nested operand, and mixing with .and / .not / literals
    const nested = from().select((o) => [o.a.or(o.b.or(o.c)).or('dflt').as('v')]);
    expect((nested.run(rows) as any[]).map((r) => r.v)).toEqual(['dflt', 'dflt', 7, 'q', 'dflt']);
    expect(nested.toString().match(/if\(/g)!.length).toBe(3);
    expect(parseQuery(nested.toString())).toEqual(nested.ast);

    const mixed = from().where((o) => o.a.or(o.b).or(o.c).not().and(o.d.or(o.a)));
    parity(mixed, mixed.toString(), { _data: rows });
    expect(mixed.run(rows)).toEqual(rows.filter((r) => !(r.a || r.b || r.c) && (r.d || r.a)));

    // an aliased left operand is not an or-node and is left untouched
    const aliased = from().select((o) => [o.a.as('x').or(o.b).or(o.c).as('v')]);
    expect(parseQuery(aliased.toString())).toEqual(aliased.ast);
    expect(aliased.run(rows)).toEqual(rows.map((r) => ({ v: r.a || r.b || r.c })));
  });

  it('literals: negatives become unary minus, strings stay literals', () => {
    expect(col('a').gt(-5).toString()).toBe('a > -5');
    expect(parseQuery(`_data | where(${col('a').gt(-5)})`)).toEqual(
      from().where(col('a').gt(-5)).ast,
    );
    expect(col('a').gt(0.5).toString()).toBe('a > 0.5');
    expect(col('a').eq(true).toString()).toBe('a == true');
    expect(col('a').eq(null).toString()).toBe('a == null');
    expect(col('a').eq('b').toString()).toBe('a == "b"');
    expect(col('a').gt(1e21).toString()).toBe('a > 1000000000000000000000');
  });

  it('as() replaces a previous alias and asc()/desc() make sort keys', () => {
    expect(col('a').as('x').as('y').toString()).toBe('a as y');
    expect(col('a').desc().direction).toBe('desc');
  });
});

describe('builder: scalar functions', () => {
  const sel = (e: any, hand: string) =>
    parity(from('orders').select(e), `orders | select(${hand})`);

  it('methods', () => {
    sel((o: any) => o.product.upper().as('x'), 'upper(product) as x');
    sel((o: any) => o.product.lower().as('x'), 'lower(product) as x');
    sel((o: any) => o.product.len().as('x'), 'len(product) as x');
    sel((o: any) => o.ret.abs().as('x'), 'abs(ret) as x');
    sel((o: any) => o.price.round().as('x'), 'round(price) as x');
    sel((o: any) => o.ret.round(1).as('x'), 'round(ret, 1) as x');
    sel((o: any) => o.product.trim().as('x'), 'trim(product) as x');
    sel((o: any) => o.product.concat('-', o.region).as('x'), 'concat(product, "-", region) as x');
    sel((o: any) => o.product.contains('p').as('x'), 'contains(product, "p") as x');
    sel((o: any) => o.product.startsWith('a').as('x'), 'startsWith(product, "a") as x');
    sel((o: any) => o.product.endsWith('e').as('x'), 'endsWith(product, "e") as x');
    sel((o: any) => o.product.substring(1).as('x'), 'substring(product, 1) as x');
    sel((o: any) => o.product.substring(1, 2).as('x'), 'substring(product, 1, 2) as x');
    sel((o: any) => o.product.replace('p', 'b').as('x'), 'replace(product, "p", "b") as x');
    sel((o: any) => o.missing.coalesce('none').as('x'), 'coalesce(missing, "none") as x');
  });

  it('free functions: if, coalesce and friends', () => {
    sel((o: any) => fn.if(o.total.gt(100), 'big', 'small').as('size'), 'if(total > 100, "big", "small") as size');
    sel((o: any) => fn.if(o.total.gt(100), 1).as('x'), 'if(total > 100, 1) as x');
    sel((o: any) => fn.coalesce(o.missing, o.region, 'x').as('c'), 'coalesce(missing, region, "x") as c');
    sel((o: any) => fn.lower(o.product).as('x'), 'lower(product) as x');
    sel((o: any) => fn.round(o.ret, 2).as('x'), 'round(ret, 2) as x');
    sel((o: any) => fn.substring(o.product, 0, 2).as('x'), 'substring(product, 0, 2) as x');
    sel((o: any) => fn.replace(o.product, 'a', 'b').as('x'), 'replace(product, "a", "b") as x');
    sel((o: any) => fn.concat(o.product, '!').as('x'), 'concat(product, "!") as x');
  });

  it('field names that collide with methods use $() or col()', () => {
    const viaDollar = from('orders').select((o) => o.meta.$('len').as('l'));
    expect(viaDollar.toString()).toBe('orders | select(meta.len as l)');
    expect(from('orders').select(col('meta.len').as('l')).toString()).toBe('orders | select(meta.len as l)');
    parity(viaDollar, 'orders | select(meta.len as l)');
  });

  it('enforces arities', () => {
    expect(() => (fn.if as any)(col('a'))).toThrow(/if\(\) expects 2 or 3/);
    expect(() => (fn.concat as any)()).toThrow(/concat\(\) expects at least 1/);
    expect(() => (fn.lower as any)()).toThrow(/undefined/);
    expect(() => (col('a') as any).lower(1)).not.toThrow();
    expect(() => (fn.replace as any)(col('a'), 'x')).toThrow(/argument 3 of replace\(\).*undefined/);
    expect(() => (col('a') as any).replace('x')).toThrow(/argument 3 of replace\(\)/);
    expect(() => (fn.coalesce as any)()).toThrow(/coalesce\(\) expects at least 1/);
    expect(() => fn.round(col('a'), 1)).not.toThrow();
    expect(() => (col('a') as any).substring()).toThrow(/substring\(\) expects 2 or 3/);
  });
});

describe('builder: window functions', () => {
  const sel = (e: any, hand: string) =>
    parity(from('orders').select(e), `orders | select(${hand})`);

  it('all eight', () => {
    sel((o: any) => [o.id, win.running_sum(o.total).as('rs')], 'id, running_sum(total) as rs');
    sel(() => win.running_avg('total').as('ra'), 'running_avg(total) as ra');
    sel(() => win.running_min('total').as('rmin'), 'running_min(total) as rmin');
    sel(() => win.running_max('total').as('rmax'), 'running_max(total) as rmax');
    sel(() => win.running_count().as('rc'), 'running_count() as rc');
    sel(() => win.row_number().as('n'), 'row_number() as n');
    sel(() => win.lag('total').as('p'), 'lag(total) as p');
    sel(() => win.lag('total', 2).as('p'), 'lag(total, 2) as p');
    sel(() => win.lead('total').as('p'), 'lead(total) as p');
    sel(() => win.lead('total', 2).as('p'), 'lead(total, 2) as p');
  });

  it('rejects offsets the engine would silently change, and misplaced windows', () => {
    expect(() => win.lag('total', 0)).toThrow(/offset must be an integer >= 1/);
    expect(() => win.lead('total', 1.5)).toThrow(/offset/);
    expect(() => (from('orders') as any).where(win.row_number().gt(1))).toThrow(/top-level field of select/);
    expect(() => (from('orders') as any).map(win.row_number().as('n'))).toThrow(/top-level field of select/);
    expect(() => (from('orders') as any).select(win.row_number().plus(1).as('n'))).toThrow(/top-level field of select/);
  });
});

// ─── Aggregates ─────────────────────────────────────────────────────────────

describe('builder: aggregates', () => {
  const oneField = [
    'sum', 'avg', 'min', 'max', 'median', 'stddev', 'var', 'skew', 'kurt', 'drawdown', 'pct',
    'sharpe', 'calmar', 'sortino', 'distinct_count', 'sum_abs', 'abs_sum', 'first_value', 'last_value',
  ] as const;

  it.each(oneField)('terminal %s(field) matches the hand-written query', (name) => {
    const b = (from('orders') as any)[name]((o: any) => o.total);
    expect(b).toBeInstanceOf(Scalar);
    parity(b, `orders | ${name}(total)`);
    parity((from('orders') as any)[name]('total'), `orders | ${name}(total)`);
  });

  it.each(oneField)('%s() inside rollup and grouped select', (name) => {
    parity(
      from('orders').rollup('region', (agg as any)[name]('total').as('v')),
      `orders | rollup(region, ${name}(total) as v)`,
    );
    parity(
      from('orders').groupBy('region').select('region', (agg as any)[name](col('total')).as('v')),
      `orders | groupBy(region) | select(region, ${name}(total) as v)`,
    );
  });

  it('count takes no field', () => {
    parity(from('orders').count(), 'orders | count()');
    parity(from('orders').where('total > 50').count(), 'orders | where(total > 50) | count()');
  });

  it('two-argument aggregates', () => {
    parity(from('orders').percentile('total', 90), 'orders | percentile(total, 90)');
    parity(from('orders').percentile((o) => o.total, 50), 'orders | percentile(total, 50)');
    parity(from('orders').vwap('price', 'qty'), 'orders | vwap(price, qty)');
    parity(from('orders').wavg((o) => o.price, (o) => o.qty), 'orders | wavg(price, qty)');
    parity(from('orders').info_ratio('ret', 'ts'), 'orders | info_ratio(ret, ts)');
    parity(
      from('orders').rollup('region', agg.percentile('total', 50).as('p'), agg.vwap('price', 'qty').as('v')),
      'orders | rollup(region, percentile(total, 50) as p, vwap(price, qty) as v)',
    );
    parity(
      from('orders').groupBy('region').select('region', agg.wavg('price', 'qty').as('w')),
      'orders | groupBy(region) | select(region, wavg(price, qty) as w)',
    );
  });

  it('terminal aggregates over expressions', () => {
    parity(from('orders').sum('price * qty'), 'orders | sum(price * qty)');
    parity(from('orders').sum((o) => o.price.times(o.qty)), 'orders | sum(price * qty)');
  });

  it('pct normalises inside rollup', () => {
    parity(
      from('orders').rollup('region', agg.pct('total').as('share')),
      'orders | rollup(region, pct(total) as share)',
    );
  });

  it('enforces aggregate arities', () => {
    expect(() => (agg as any).sum()).toThrow(/sum\(\) expects exactly 1/);
    expect(() => (agg as any).sum('a', 'b')).toThrow(/sum\(\) expects exactly 1/);
    expect(() => (agg as any).percentile('a')).toThrow(/percentile\(\) expects exactly 2/);
    expect(() => (agg as any).vwap('a', 'b', 'c')).toThrow(/vwap\(\) expects exactly 2/);
    expect(() => (agg as any).count('a', 'b')).toThrow(/count\(\) expects at most 1/);
    expect(() => (from('orders') as any).sum()).toThrow(/sum\(\) expects exactly 1/);
    expect(() => (from('orders') as any).info_ratio('a')).toThrow(/info_ratio\(\) expects exactly 2/);
  });

  it('covers every aggregate the engine knows', () => {
    const covered = new Set<string>([...oneField, 'count', 'percentile', 'vwap', 'wavg', 'info_ratio']);
    expect(covered.size).toBe(24);
    for (const name of covered) {
      expect(typeof (from('orders') as any)[name]).toBe('function');
      expect(typeof (agg as any)[name]).toBe('function');
    }
  });

  it('keeps aggregates out of non-grouped contexts', () => {
    expect(() => (from('orders') as any).where(agg.sum('total').gt(1))).toThrow(/where: aggregate sum\(\)/);
    expect(() => (from('orders') as any).sort(agg.sum('total').desc())).toThrow(/sort: aggregate sum\(\)/);
    expect(() => (from('orders') as any).select(agg.sum('total'))).toThrow(/outside groupBy/);
    expect(() => (from('orders') as any).map(agg.sum('total').as('t'))).toThrow(/outside groupBy/);
    expect(() => (from('orders') as any).groupBy(agg.sum('total'))).toThrow(/groupBy: aggregate/);
    expect(() => (from('orders') as any).groupBy('region').where(agg.sum('total').gt(1))).toThrow(/where: aggregate/);
    // select right after groupBy is fine; a sort in between ends the grouped context (engine behaviour)
    expect(() => (from('orders') as any).groupBy('region').sort('region').select(agg.sum('total'))).toThrow(/outside groupBy/);
  });
});

// ─── Raw escape hatch ───────────────────────────────────────────────────────

describe('builder: pipe() escape hatch', () => {
  it('splices one or several raw operations', () => {
    parity(from('orders').pipe('where(total > 100)'), 'orders | where(total > 100)');
    parity(from('orders').pipe('| where(total > 100)'), 'orders | where(total > 100)');
    parity(
      from('orders').pipe('where(total > 50) | sort(total desc) | first(2)'),
      'orders | where(total > 50) | sort(total desc) | first(2)',
    );
    parity(
      from('orders').where('total > 50').pipe('reduce(0, _acc + total)'),
      'orders | where(total > 50) | reduce(0, _acc + total)',
    );
    parity(from('orders').pipe('sum(total)'), 'orders | sum(total)');
  });

  it('accepts operation nodes', () => {
    const op = parseQuery('x | where(total > 100)').operations[0];
    parity(from('orders').pipe(op), 'orders | where(total > 100)');
  });

  it('throws ParseError for malformed raw strings', () => {
    expect(() => from('orders').pipe('where(')).toThrow(ParseError);
    expect(() => from('orders').pipe('nonsense(1)')).toThrow(ParseError);
    expect(() => from('orders').pipe('where(a > )')).toThrow(ParseError);
    expect(() => from('orders').pipe('')).toThrow();
  });

  it('validates raw operations like typed ones', () => {
    expect(() => from('orders').pipe('sort(a as b)')).toThrow(ParseError);
    expect(() => from('orders').pipe('where(sum(total) > 1)')).toThrow(/aggregate sum\(\)/);
  });

  it('raw first/last counts and lag/lead offsets get the same checks as the typed methods', () => {
    expect(() => from('orders').first(1.5)).toThrow(/non-negative integer/);
    expect(() => from('orders').pipe('first(1.5)')).toThrow(/first\(\) count must be a non-negative integer/);
    expect(() => from('orders').pipe('last(2.5)')).toThrow(/last\(\) count must be a non-negative integer/);
    expect(() => from('orders').pipe('where(a > 1) | first(0.5)')).toThrow(/non-negative integer/);
    expect(() => from('orders').pipe('first(3)')).not.toThrow();
    expect(() => from('orders').pipe('first(0)')).not.toThrow();

    expect(() => win.lag('a', 0)).toThrow(/offset must be an integer >= 1/);
    expect(() => from('orders').pipe('select(lag(a, 0) as p)')).toThrow(/lag\(\): offset must be an integer >= 1/);
    expect(() => from('orders').pipe('select(lead(a, 1.5) as p)')).toThrow(/lead\(\): offset/);
    expect(() => from('orders').select('lag(total, 0) as p')).toThrow(/offset/);
    expect(() => from('orders').pipe('select(lag(a, 2) as p, lead(a) as q)')).not.toThrow();

    // AST operation nodes take the same path
    expect(() => from('orders').pipe({ kind: 'FirstOp', count: -1 })).toThrow(/non-negative/);
  });

  it('raw fragment errors name the method the user called and keep ParseError details', () => {
    const cases: [() => unknown, RegExp][] = [
      [() => from('orders').distinct('a as b'), /^distinct\(\): /],
      [() => from('orders').flatten('a as b'), /^flatten\(\): /],
      [() => from('orders').transpose('a as b'), /^transpose\(\): /],
      [() => from('orders').pivot('a as b', agg.sum('c')), /^pivot\(\) field: /],
      [() => from('orders').groupBy('a as b'), /^groupBy\(\): /],
      [() => from('orders').rollup('a as', 'sum(b)'), /^rollup\(\): /],
      [() => from('orders').pivot('a', 'sum(b'), /^pivot\(\): /],
      [() => from('orders').map('a +'), /^map\(\): /],
      [() => from('orders').select('a +'), /^select\(\): /],
      [() => from('orders').reduce('0', 'acc +'), /^reduce\(\) accumulator: /],
      [() => from('orders').where('a >'), /^where\(\): /],
      [() => from('orders').sort('a as b'), /^sort\(\): /],
      [() => from('orders').join('customers', 'a =='), /^join\(\): /],
      [() => from('orders').pipe('where('), /^pipe\(\): /],
      [() => agg.sum('a as b'), /^argument 1 of sum\(\): /],
      [() => win.lag('a as b'), /^field of lag\(\): /],
    ];
    for (const [run, pattern] of cases) {
      let err: unknown;
      try { run(); } catch (e) { err = e; }
      expect(err, String(pattern)).toBeInstanceOf(ParseError);
      expect((err as ParseError).message).toMatch(pattern);
      expect((err as ParseError).name).toBe('ParseError');
      expect(typeof (err as ParseError).position).toBe('number');
    }
    // the wrapper op never leaks into the message
    expect(() => from('orders').distinct('a as b')).toThrow(/after distinct arguments/);
    expect(() => from('orders').distinct('a as b')).not.toThrow(/groupBy/);
    expect(() => agg.sum('a as b')).not.toThrow(/groupBy/);
    expect(() => from('orders').flatten('a as b')).not.toThrow(/groupBy/);
    expect(() => from('orders').rollup('a as', 'sum(b)')).not.toThrow(/select/);
  });

  it('raw fragments cannot smuggle extra operations', () => {
    expect(() => from('orders').where('total > 1) | first(1')).toThrow(ParseError);
    expect(() => from('orders').select('id) | where(1')).toThrow(ParseError);
    expect(() => from('orders').sort('id) | first(1')).toThrow(ParseError);
    expect(() => from('orders').where('a, b')).toThrow(ParseError);
    expect(() => from('orders').join('customers', 'a == b) | first(1')).toThrow(ParseError);
    expect(() => agg.sum('a) | first(1')).toThrow(ParseError);
  });

  it('shifts parse error positions into the raw string', () => {
    try {
      from('orders').where('total > ');
      throw new Error('expected a parse error');
    } catch (e) {
      expect(e).toBeInstanceOf(ParseError);
      expect((e as ParseError).position).toBeLessThanOrEqual('total > '.length);
    }
  });
});

// ─── Validation ─────────────────────────────────────────────────────────────

describe('builder: validation', () => {
  it('rejects invalid source names', () => {
    for (const bad of ['', 'my orders', 'a-b', '1abc', 'as', 'null', 'constructor', 'a.b', 'x"y']) {
      expect(() => from(bad), bad).toThrow(BuilderError);
    }
    expect(() => from('orders').join('bad name', 'a == b')).toThrow(/invalid source name/);
    expect(() => from('orders').join('desc', 'a == b')).toThrow(/reserved word/);
  });

  it('rejects invalid field names and aliases', () => {
    expect(() => from('orders').where(col('a b').gt(1))).toThrow(BuilderError);
    expect(() => col('a-b')).toThrow(/invalid field name/);
    expect(() => col('')).toThrow(BuilderError);
    expect(() => col()).toThrow(BuilderError);
    expect(() => from('orders').where((o) => o['total price'].gt(1))).toThrow(/invalid field name/);
    expect(() => from('orders').where((o) => o.null.gt(1))).toThrow(/reserved word/);
    expect(() => col('a').as('b c')).toThrow(/invalid alias/);
    expect(() => col('a').as('as')).toThrow(/reserved word/);
    expect(() => from('orders').select({ 'a b': col('a') })).toThrow(/invalid alias/);
  });

  it('rejects non-finite numbers and unsupported values', () => {
    expect(() => col('a').gt(NaN)).toThrow(/not a finite number/);
    expect(() => col('a').gt(Infinity)).toThrow(/not a finite number/);
    expect(() => col('a').gt(undefined as any)).toThrow(/undefined/);
    expect(() => col('a').gt({} as any)).toThrow(BuilderError);
    expect(() => col('a').gt(10n as any)).toThrow(BuilderError);
    expect(() => col('a').gt(col('b').asc() as any)).toThrow(/only valid in sort/);
  });

  it('rejects aliases where the grammar forbids them', () => {
    expect(() => from('orders').sort(col('a').as('b'))).toThrow(/alias/);
    expect(() => from('orders').groupBy(col('a').as('b'))).toThrow(/alias/);
    expect(() => from('orders').distinct(col('a').as('b'))).toThrow(/alias/);
    expect(() => from('orders').flatten(col('a').as('b'))).toThrow(/alias/);
    expect(() => from('orders').transpose(col('a').as('b'))).toThrow(/alias/);
    expect(() => from('orders').pivot(col('a').as('b'), agg.sum('c'))).toThrow(/alias/);
    expect(() => from('orders').sum(col('a').as('b'))).toThrow(/alias/);
    expect(() => from('orders').sort('a as b')).toThrow(ParseError);
    // ...and accepts them where it allows them
    expect(() => from('orders').select(col('a').as('b'))).not.toThrow();
    expect(() => from('orders').where(col('a').as('b'))).not.toThrow();
  });

  it('validates op arguments', () => {
    expect(() => from('orders').first(-1)).toThrow(/non-negative integer/);
    expect(() => from('orders').last(1.5)).toThrow(/non-negative integer/);
    expect(() => from('orders').first(NaN)).toThrow(/non-negative integer/);
    expect(() => from('orders').first('3' as any)).toThrow(/non-negative integer/);
    expect(() => from('orders').select()).toThrow(/at least one field/);
    expect(() => from('orders').map()).toThrow(/at least one field/);
    expect(() => from('orders').sort()).toThrow(/at least one key/);
    expect(() => from('orders').rollup('region')).toThrow(/at least one aggregate/);
    expect(() => from('orders').rollup()).toThrow(/at least one aggregate/);
    expect(() => from('orders').rollup(agg.sum('a'), 'region')).toThrow(/keys must come before/);
    expect(() => from('orders').rollup(col('a').plus(agg.sum('b')), agg.sum('c'))).toThrow(/rollup keys/);
    expect(() => from('orders').pivot('region')).toThrow(/at least one aggregate/);
    expect(() => from('orders').pivot('region', col('a').as('x'))).toThrow(/every value must be an aggregate/);
    expect(() => from('orders').reduce(col('a'), col('b'))).toThrow(/cannot reference fields/);
    expect(() => from('orders').join('customers', 42 as any)).toThrow(/join\(\) condition/);
    expect(() => from('orders').join('customers', { on: ['a'] } as any)).toThrow(/expects \[leftField, rightField\]/);
    expect(() => from('orders').join('customers', { on: [col('a').plus(1), 'b'] })).toThrow(/field reference/);
    expect(() => from('orders').flatten((o) => [o.a, o.b] as any)).toThrow(/exactly one expression/);
  });

  it('callbacks must not return strings', () => {
    expect(() => from('orders').where((() => 'total > 1') as any)).toThrow(/not strings/);
    expect(() => from('orders').select((() => ['a']) as any)).toThrow(/not strings/);
    expect(() => from('orders').join('customers', (() => 'a == b') as any)).toThrow(/not a string|not strings/);
  });
});

// ─── Escaping and injection ─────────────────────────────────────────────────

describe('builder: escaping', () => {
  it('string operands survive the round trip', () => {
    const value = 'say "hi" \\ back\nline\ttab \' quote';
    const b = from('orders').where((o) => o.product.eq(value));
    const parsed = parseQuery(b.toString());
    expect(parsed).toEqual(b.ast);
    const cond = (parsed.operations[0] as any).condition;
    expect(cond.right).toEqual({ kind: 'StringLiteral', value });
  });

  it('user input cannot break out of a string literal', () => {
    const payload = '" || 1 == 1 | first(0) | where("';
    const b = from('orders').where((o) => o.product.eq(payload));
    expect(b.ast.operations).toHaveLength(1);
    expect(parseQuery(b.toString())).toEqual(b.ast);
    expect(b.run(ctx)).toEqual([]);
  });

  it('matching string values filter rows', () => {
    const rows = [{ name: 'a"b' }, { name: 'plain' }, { name: 'back\\slash' }];
    for (const name of ['a"b', 'back\\slash', 'plain']) {
      const b = from().where((o) => o.name.eq(name));
      expect(b.run(rows)).toEqual(rows.filter((r) => r.name === name));
      expect(query(rows, b.toString())).toEqual(rows.filter((r) => r.name === name));
    }
  });
});

// ─── Outputs ────────────────────────────────────────────────────────────────

describe('builder: outputs', () => {
  it('.ast is a Pipeline and .compile() returns a compiled query', () => {
    const b = from('orders').where((o) => o.total.gt(100)).first(1);
    const ast: Pipeline = b.ast;
    expect(ast.kind).toBe('Pipeline');
    expect(ast.source).toBe('orders');
    expect(ast.operations.map((o) => o.kind)).toEqual(['WhereOp', 'FirstOp']);
    const compiled = b.compile();
    expect(compiled(ctx)).toEqual(query(ctx, 'orders | where(total > 100) | first(1)'));
    expect(compiled.ast).toEqual(ast);
    expect(compiled.source).toBe(b.toString());
    expect(b.compile()).toBe(compiled);
  });

  it('.run() accepts a plain array for the builder source, or a full context', () => {
    expect(from('orders').first(2).run(orders)).toEqual(orders.slice(0, 2));
    expect(from('orders').join('customers', { on: ['customerId', 'id'] }).run(ctx)).toHaveLength(5);
    expect(() => from('orders').join('customers', { on: ['customerId', 'id'] }).run(orders)).toThrow(
      /customers/,
    );
    expect(() => from('orders').run({ other: [] })).toThrow(/orders/);
  });

  it('String(builder) and template literals use toString()', () => {
    const b = from('orders').first(1);
    expect(`${b}`).toBe('orders | first(1)');
    expect(String(col('a').plus(1))).toBe('a + 1');
  });

  it('expression toString prints aliases and nested calls', () => {
    expect(agg.sum(col('a')).as('x').toString()).toBe('sum(a) as x');
    expect(fn.if(col('a').gt(1), 'y', 'n').toString()).toBe('if(a > 1, "y", "n")');
  });
});

// ─── Drift ──────────────────────────────────────────────────────────────────

describe('builder: engine drift', () => {
  it('has a method for every operation the parser knows', () => {
    const sources = import.meta.glob('../src/engine/parser.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;
    const parserSource = Object.values(sources)[0];
    const start = parserSource.indexOf('function parseOperation');
    const end = parserSource.indexOf('function parsePipeline');
    expect(start).toBeGreaterThan(-1);
    const body = parserSource.slice(start, end);
    const ops = [...body.matchAll(/case '(\w+)':/g)].map((m) => m[1]);
    expect(ops.sort()).toEqual([
      'distinct', 'first', 'flatten', 'groupBy', 'join', 'last', 'map', 'pivot', 'reduce',
      'rollup', 'select', 'sort', 'transpose', 'where',
    ]);
    const b = from('x') as any;
    for (const op of ops) expect(typeof b[op], op).toBe('function');
    expect(typeof b.pipe).toBe('function');
  });

  it('exposes every function the compiler implements', () => {
    const sources = import.meta.glob('../src/engine/compiler.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;
    const src = Object.values(sources)[0];
    const start = src.indexOf('function compileFunctionCall');
    const end = src.indexOf('function compileGroupAggregate');
    const names = [...src.slice(start, end).matchAll(/^    case '(\w+)': \{/gm)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(10);
    for (const name of names) expect(typeof (fn as any)[name], name).toBe('function');
    const windows = src.match(/WINDOW_FUNCTION_NAMES = new Set\(\[([\s\S]*?)\]\)/)![1];
    for (const name of [...windows.matchAll(/'(\w+)'/g)].map((m) => m[1])) {
      expect(typeof (win as any)[name], name).toBe('function');
    }
  });
});
