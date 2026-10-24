/**
 * Compile-time tests of the typed builder. `npm run typecheck` (tsc) is what checks them:
 * `expectTypeOf` assertions fail to compile when a type is wrong, and every
 * `@ts-expect-error` line fails to compile when the code on the next line is accepted.
 * The negative cases live in functions that are never called, so they cost nothing at runtime.
 */
import { describe, it, expect, expectTypeOf } from 'vitest';
import { query } from '../src/engine/index';
import { from, col, lit, agg, fn, win, Expr, Query, Scalar } from '../src/builder/index';
import type {
  AliasedExpr,
  BoolExpr,
  Fields,
  GenericExpr,
  NumExpr,
  StrExpr,
  ValueOf,
} from '../src/builder/index';

interface Customer {
  id: number;
  name: string;
  vip?: boolean;
}

interface Order {
  id: number;
  customerId: number;
  region: string;
  total: number;
  paid: boolean;
  tags: string[];
  note: string | null;
  meta: { tier: string; len: number; score?: number };
}

type RowOf<Q> = Q extends Query<infer R, any> ? R : never;
type ScalarValue<S> = S extends Scalar<infer T> ? T : never;

/** A real row proxy (what callbacks receive), for checking the types of expressions built from it. */
function rowOf<Row>(): Fields<Row> {
  let captured: Fields<Row> | undefined;
  from<Row>('x').where((o) => {
    captured = o;
    return col<boolean>('x');
  });
  return captured as Fields<Row>;
}

const orders: Order[] = [
  { id: 1, customerId: 10, region: 'EU', total: 120, paid: true, tags: ['a'], note: null, meta: { tier: 'gold', len: 5 } },
  { id: 2, customerId: 11, region: 'US', total: 80, paid: false, tags: [], note: 'x', meta: { tier: 'silver', len: 7 } },
  { id: 3, customerId: 10, region: 'EU', total: 200, paid: true, tags: ['b'], note: null, meta: { tier: 'gold', len: 9 } },
];
const customers: Customer[] = [{ id: 10, name: 'Ann' }, { id: 11, name: 'Bob', vip: true }];

describe('builder types: fields', () => {
  it('maps number, string and boolean fields to NumExpr, StrExpr and BoolExpr', () => {
    type F = Fields<Order>;
    expectTypeOf<F['total']>().toEqualTypeOf<NumExpr>();
    expectTypeOf<F['region']>().toEqualTypeOf<StrExpr>();
    expectTypeOf<F['paid']>().toEqualTypeOf<BoolExpr>();
    // nullable fields keep the operators of their non-null type, and remember they may be null
    expectTypeOf<F['note']>().toMatchTypeOf<StrExpr>();
    expectTypeOf<ValueOf<F['note']>>().toEqualTypeOf<string | null>();
    expectTypeOf<ValueOf<F['total']>>().toEqualTypeOf<number>();
    // arrays have no dedicated operators
    expectTypeOf<F['tags']>().toEqualTypeOf<GenericExpr<string[]>>();
  });

  it('maps nested objects to nested field proxies, with optional fields made addressable', () => {
    type F = Fields<Order>;
    expectTypeOf<F['meta']['tier']>().toEqualTypeOf<StrExpr>();
    expectTypeOf<F['meta']['score']>().toMatchTypeOf<NumExpr>();
    expectTypeOf<ValueOf<F['meta']['score']>>().toEqualTypeOf<number | undefined>();
    const q = from<Order>('orders').where((o) => o.meta.tier.eq('gold').and(o.meta.score.gt(1)));
    expect(q.toString()).toBe('orders | where(meta.tier == "gold" && meta.score > 1)');
  });

  it('keeps `any` rows fully dynamic', () => {
    expectTypeOf<Fields<any>>().toEqualTypeOf<Record<string, any>>();
    const q = from('orders').where((o) => o.whatever.gt(1).and(o.other.deeper.eq('x')));
    expect(q.toString()).toBe('orders | where(whatever > 1 && other.deeper == "x")');
  });

  it('types operator results', () => {
    const f = rowOf<Order>();
    expectTypeOf(f.total.gt(1)).toEqualTypeOf<BoolExpr>();
    expectTypeOf(f.total.plus(f.id).times(2)).toEqualTypeOf<NumExpr>();
    expectTypeOf(f.region.len()).toEqualTypeOf<NumExpr>();
    expectTypeOf(f.region.lower().concat('-', f.id)).toEqualTypeOf<StrExpr>();
    expectTypeOf(f.region.contains('E')).toEqualTypeOf<BoolExpr>();
    expectTypeOf(f.paid.not().or(f.total.gt(1))).toEqualTypeOf<BoolExpr>();
    expectTypeOf(f.total.as('t')).toEqualTypeOf<AliasedExpr<'t', number, 'row'>>();
    expectTypeOf(fn.if(f.paid, f.total, 0)).toEqualTypeOf<NumExpr>();
    expectTypeOf(fn.if(f.paid, 'yes', 'no')).toEqualTypeOf<StrExpr>();
    expectTypeOf(fn.coalesce(f.note, 'n/a')).toEqualTypeOf<StrExpr>();
    expectTypeOf(fn.round(f.total, 2)).toEqualTypeOf<NumExpr>();
    expectTypeOf(lit(1)).toEqualTypeOf<NumExpr>();
    expectTypeOf(lit('a')).toEqualTypeOf<StrExpr>();
    expectTypeOf(lit(true)).toEqualTypeOf<BoolExpr>();
    expectTypeOf(col<number>('total')).toEqualTypeOf<NumExpr>();
    expectTypeOf(col<Order['meta']>('meta').tier).toEqualTypeOf<StrExpr>();
  });

  it('reaches nested fields that clash with expression method names with $()', () => {
    const q = from<Order>('orders').where((o) => o.meta.$('len').gt(6));
    expect(q.toString()).toBe('orders | where(meta.len > 6)');
    expect(q.run(orders).map((r) => r.id)).toEqual([2, 3]);
  });
});

describe('builder types: select and map output rows', () => {
  it('infers the row of an object-literal select', () => {
    const q = from<Order>('orders').select((o) => ({
      id: o.id,
      region: o.region.upper(),
      big: o.total.gt(100),
      tier: o.meta.tier,
      label: fn.if(o.paid, 'paid', 'open'),
      fixed: 1,
    }));
    expectTypeOf<RowOf<typeof q>>().toEqualTypeOf<{
      id: number;
      region: string;
      big: boolean;
      tier: string;
      label: string;
      fixed: number;
    }>();
    const rows = q.run(orders);
    expectTypeOf(rows).toEqualTypeOf<Array<RowOf<typeof q>>>();
    expect(rows[0]).toEqual({ id: 1, region: 'EU', big: true, tier: 'gold', label: 'paid', fixed: 1 });
    expect(rows).toEqual(query({ orders }, q.toString()));
  });

  it('infers the row of a select that takes the object directly', () => {
    const q = from<Order>('orders').select({ id: col<number>('id'), t: col<number>('total').times(2) });
    expectTypeOf<RowOf<typeof q>>().toEqualTypeOf<{ id: number; t: number }>();
  });

  it('keeps the row type through where, sort, first, last and distinct', () => {
    const q = from<Order>('orders')
      .where((o) => o.total.gt(1))
      .sort((o) => o.total.desc(), 'id')
      .distinct((o) => o.region)
      .first(2)
      .last(1);
    expectTypeOf<RowOf<typeof q>>().toEqualTypeOf<Order>();
    expectTypeOf(q.run(orders)).toEqualTypeOf<Order[]>();
  });

  it('accepts direct typed and untyped row expressions in where and sort', () => {
    const dynamic: any = 100;
    const untypedCondition = new Expr({ kind: 'FieldAccess', path: ['total'] }).gt(dynamic);
    const typed = from<Order>('orders')
      .where(col<boolean>('paid').eq(true))
      .where((o) => o.total.eq(dynamic));
    const untyped = from<Order>('orders')
      .where(untypedCondition)
      .sort(new Expr({ kind: 'FieldAccess', path: ['total'] }).desc());
    expect(typed.toString()).toBe('orders | where(paid == true) | where(total == 100)');
    expect(untyped.toString()).toBe('orders | where(total > 100) | sort(total desc)');
    expectTypeOf<RowOf<typeof typed>>().toEqualTypeOf<Order>();
    expectTypeOf<RowOf<typeof untyped>>().toEqualTypeOf<Order>();
  });

  it('chains typed ops on the selected row', () => {
    const q = from<Order>('orders')
      .select((o) => ({ region: o.region, total: o.total }))
      .where((o) => o.total.gt(100))
      .sort((o) => o.region.asc());
    expectTypeOf<RowOf<typeof q>>().toEqualTypeOf<{ region: string; total: number }>();
    expect(q.toString()).toBe('orders | select(region, total) | where(total > 100) | sort(region)');
  });

  it('merges new fields over the input row in map', () => {
    const q = from<Order>('orders').map((o) => ({ total: o.total.times(2), tag: o.region.lower() }));
    expectTypeOf<RowOf<typeof q>>().toEqualTypeOf<{
      id: number;
      customerId: number;
      region: string;
      total: number;
      paid: boolean;
      tags: string[];
      note: string | null;
      meta: { tier: string; len: number; score?: number };
      tag: string;
    }>();
  });

  it('feeds the typed output row of map and select into later ops', () => {
    const m = from<Order>('orders')
      .map((o) => ({ doubled: o.total.times(2) }))
      .where((o) => o.doubled.gt(200))
      .sort((o) => o.doubled.desc());
    expectTypeOf<RowOf<typeof m>['doubled']>().toEqualTypeOf<number>();
    expect(m.run(orders).map((r) => r.doubled)).toEqual([400, 240]);

    const g = from<Order>('orders')
      .select((o) => ({ r: o.region, t: o.total }))
      .groupBy((o) => o.r)
      .select((o) => ({ top: agg.max(o.t), n: agg.count() }));
    expectTypeOf<RowOf<typeof g>>().toEqualTypeOf<{ top: number; n: number }>();
    expect(g.run(orders)).toEqual([{ top: 200, n: 2 }, { top: 80, n: 1 }]);
  });

  it('gives untyped rows for the raw and list forms instead of guessing', () => {
    const q = from<Order>('orders').select('id', 'total');
    expectTypeOf<RowOf<typeof q>>().toBeAny();
    const aliased = from<Order>('orders').select((o) => [o.id, o.total.as('t')]);
    expectTypeOf<RowOf<typeof aliased>>().toBeAny();
  });

  it('types joins as the merge of both rows', () => {
    const q = from<Order>('orders').join<Customer>('customers', (o, c) => o.customerId.eq(c.id));
    expectTypeOf<RowOf<typeof q>['name']>().toEqualTypeOf<string>();
    expectTypeOf<RowOf<typeof q>['total']>().toEqualTypeOf<number>();
    // the right side wins on collisions, as in the engine
    expectTypeOf<RowOf<typeof q>['id']>().toEqualTypeOf<number>();
    expect(q.toString()).toBe('orders | join(customers, customerId == id)');
    expect(q.run({ orders, customers }).map((r) => r.name)).toEqual(['Ann', 'Bob', 'Ann']);

    const untyped = from<Order>('orders').join('customers', { on: ['customerId', 'id'] });
    expectTypeOf<RowOf<typeof untyped>>().toBeAny();
  });
});

describe('builder types: grouped context and aggregates', () => {
  it('allows aggregates in a select after groupBy and types the result', () => {
    const q = from<Order>('orders')
      .groupBy((o) => o.region)
      .select((o) => ({ region: o.region, total: agg.sum(o.total), n: agg.count(), top: agg.max(o.total) }));
    expectTypeOf<RowOf<typeof q>>().toEqualTypeOf<{ region: string | undefined; total: number; n: number; top: number }>();
    expect(q.toString()).toBe(
      'orders | groupBy(region) | select(region, sum(total) as total, count() as n, max(total) as top)',
    );
    expect(q.run(orders)).toEqual([
      { region: 'EU', total: 320, n: 2, top: 200 },
      { region: 'US', total: 80, n: 1, top: 80 },
    ]);
  });

  it('allows aggregates in rollup and pivot, and aliased results there', () => {
    const r = from<Order>('orders').rollup((o) => [o.region, agg.sum(o.total).as('total'), agg.count().as('n')]);
    // rollup adds subtotal rows (`_rollupLevel`); the detail rows come first
    expect(r.run(orders).slice(0, 2)).toMatchObject([
      { region: 'EU', total: 320, n: 2 },
      { region: 'US', total: 80, n: 1 },
    ]);
    const p = from<Order>('orders').pivot((o) => o.region, (o) => agg.sum(o.total).as('total'));
    expect(p.toString()).toBe('orders | pivot(region, sum(total) as total)');
  });

  it('types aggregate results by the aggregated field', () => {
    const f = rowOf<Order>();
    expectTypeOf(agg.sum(f.total)).toEqualTypeOf<NumExpr<'agg'>>();
    expectTypeOf(agg.count()).toEqualTypeOf<NumExpr<'agg'>>();
    expectTypeOf(agg.max(f.total)).toEqualTypeOf<NumExpr<'agg'>>();
    expectTypeOf(agg.min(f.region)).toEqualTypeOf<StrExpr<'agg'>>();
    expectTypeOf(agg.sum(f.total).div(agg.count())).toEqualTypeOf<NumExpr<'agg'>>();
    expectTypeOf(agg.sum(f.total).plus(f.id)).toEqualTypeOf<NumExpr<'row' | 'agg'>>();
    expectTypeOf(agg.sum('price * qty')).toEqualTypeOf<NumExpr<'agg'>>();
    expectTypeOf(agg.percentile(f.total, 90)).toEqualTypeOf<NumExpr<'agg'>>();
    expectTypeOf(agg.vwap(f.total, f.id)).toEqualTypeOf<NumExpr<'agg'>>();
  });

  it('types terminal aggregates as Scalar<T>', () => {
    const q = from<Order>('orders');
    const total = q.sum((o) => o.total);
    expectTypeOf(total).toEqualTypeOf<Scalar<number>>();
    expectTypeOf(total.run(orders)).toEqualTypeOf<number>();
    expect(total.run(orders)).toBe(400);
    expectTypeOf(q.count()).toEqualTypeOf<Scalar<number>>();
    expectTypeOf(q.distinct_count('region')).toEqualTypeOf<Scalar<number>>();
    expectTypeOf(q.percentile((o) => o.total, 50)).toEqualTypeOf<Scalar<number>>();
    expectTypeOf(q.max((o) => o.total)).toEqualTypeOf<Scalar<number | null>>();
    expectTypeOf(q.first_value((o) => o.region)).toEqualTypeOf<Scalar<string | null>>();
    expectTypeOf(ScalarValueProbe(q.avg('total'))).toEqualTypeOf<number>();
    expect(q.count().run(orders)).toBe(3);
  });

  it('types reduce with its accumulator', () => {
    const r = from<Order>('orders').reduce<number>(0, (o) => o._acc.plus(o.total));
    expectTypeOf(r).toEqualTypeOf<Scalar<number>>();
    expect(r.run(orders)).toBe(400);
  });

  it('passes window functions in a non-grouped select', () => {
    const q = from<Order>('orders').select((o) => ({ id: o.id, n: win.row_number(), prev: win.lag(o.total, 1) }));
    expectTypeOf<RowOf<typeof q>>().toEqualTypeOf<{ id: number; n: number; prev: number | null }>();
    expect(q.run(orders).map((r) => r.n)).toEqual([1, 2, 3]);
  });
});

interface Loose {
  id: number;
  note: string | null;
  disc?: number;
  meta?: { tier: string };
}

const loose: Loose[] = [{ id: 1, note: null }, { id: 2, note: 'x', disc: 3, meta: { tier: 'g' } }];

describe('builder types: nullability is kept in output rows', () => {
  it('keeps null and undefined of nullable and optional fields', () => {
    const q = from<Loose>('rows').select((o) => ({ note: o.note, disc: o.disc, meta: o.meta, tier: o.meta.tier, id: o.id }));
    expectTypeOf<RowOf<typeof q>>().toEqualTypeOf<{
      note: string | null;
      disc: number | undefined;
      meta: { tier: string } | undefined;
      tier: string | undefined;
      id: number;
    }>();
    const rows = q.run(loose);
    expect(rows[0].note).toBeNull();
    expect(rows[0].disc).toBeUndefined();
    expect(rows[1]).toMatchObject({ note: 'x', disc: 3, meta: { tier: 'g' } });
  });

  it('still allows operators on nullable fields and mixing them with plain ones', () => {
    const q = from<Loose>('rows').where((o) => o.note.eq('x').and(o.disc.gt(o.id)));
    expect(q.toString()).toBe('rows | where(note == "x" && disc > id)');
    const c = from<Loose>('rows').select((o) => ({ n: fn.coalesce(o.note, 'none'), d: o.disc.coalesce(0) }));
    expectTypeOf<RowOf<typeof c>>().toEqualTypeOf<{ n: string; d: number }>();
    expect(c.run(loose)).toEqual([{ n: 'none', d: 0 }, { n: 'x', d: 3 }]);
  });

  it('types fn.if without an else branch as nullable', () => {
    const q = from<Loose>('rows').select((o) => ({ big: fn.if(o.id.gt(1), 'big'), size: fn.if(o.id.gt(1), 'big', 'small') }));
    expectTypeOf<RowOf<typeof q>>().toEqualTypeOf<{ big: string | null; size: string }>();
  });

  it('types win.lag and win.lead as nullable (null at the window edges)', () => {
    const q = from<Order>('orders').select((o) => ({ prev: win.lag(o.total), next: win.lead(o.note) }));
    expectTypeOf<RowOf<typeof q>>().toEqualTypeOf<{ prev: number | null; next: string | null }>();
    expect(q.run(orders).map((r) => r.prev)).toEqual([null, 120, 80]);
  });
});

describe('builder types: grouped select does not promise row-scope fields', () => {
  it('types key and other row-scope fields as possibly undefined, aggregates precisely', () => {
    const q = from<Order>('orders')
      .groupBy((o) => o.region)
      .select((o) => ({ region: o.region, t: o.total, s: agg.sum(o.total), mixed: agg.sum(o.total).plus(o.id), k: 'x' }));
    expectTypeOf<RowOf<typeof q>>().toEqualTypeOf<{
      region: string | undefined;
      t: number | undefined;
      s: number;
      mixed: number | undefined;
      k: string;
    }>();
    const rows = q.run(orders);
    expect(rows.map((r) => r.s)).toEqual([320, 80]);
    expect(rows[0].t).toBeUndefined();
  });

  it('does not promise a nested key column (the engine names it after the last path segment)', () => {
    const q = from<Order>('orders')
      .groupBy((o) => o.meta.tier)
      .select((o) => ({ tier: o.meta.tier, n: agg.count() }));
    expectTypeOf<RowOf<typeof q>>().toEqualTypeOf<{ tier: string | undefined; n: number }>();
    expect(q.run(orders).map((r) => r.n)).toEqual([2, 1]);
    expect(q.run(orders)[0].tier).toBeUndefined();
  });

  it('leaves a non-grouped select precise', () => {
    const q = from<Order>('orders').select((o) => ({ region: o.region, t: o.total }));
    expectTypeOf<RowOf<typeof q>>().toEqualTypeOf<{ region: string; t: number }>();
  });
});

describe('builder types: nested objects are expressions', () => {
  it('can be selected whole and typed as the nested object', () => {
    const q = from<Order>('orders').select((o) => ({ meta: o.meta, id: o.id }));
    expectTypeOf<RowOf<typeof q>>().toEqualTypeOf<{ meta: Order['meta']; id: number }>();
    expect(q.toString()).toBe('orders | select(meta, id)');
    expect(q.run(orders)[0].meta).toEqual({ tier: 'gold', len: 5 });
  });

  it('can be a groupBy key or a distinct field', () => {
    const q = from<Order>('orders').groupBy((o) => o.meta).select((o) => ({ n: agg.count() }));
    expect(q.toString()).toBe('orders | groupBy(meta) | select(count() as n)');
    expect(from<Order>('orders').distinct((o) => o.meta).toString()).toBe('orders | distinct(meta)');
    const m = from<Order>('orders').map((o) => ({ m: o.meta }));
    expectTypeOf<RowOf<typeof m>['m']>().toEqualTypeOf<Order['meta']>();
  });
});

describe('builder types: escape hatches stay open', () => {
  it('accepts raw strings in every position and returns untyped rows from pipe()', () => {
    const q = from<Order>('orders')
      .where('total > 100 && region == "EU"')
      .sort('total desc')
      .groupBy('region')
      .select('region', 'sum(total) as total');
    expect(q.run(orders)).toEqual([{ region: 'EU', total: 320 }]);
    const piped = from<Order>('orders').pipe('where(total > 100)');
    expectTypeOf<RowOf<typeof piped>>().toBeAny();
    expect(piped.run(orders)).toHaveLength(2);
  });

  it('keeps the old untyped usage compiling and running', () => {
    const q = from('orders')
      .where((o) => o.total.gt(100))
      .groupBy((o) => o.region)
      .select((o) => [o.region, agg.sum(o.total).as('total')]);
    expect(q.run({ orders })).toEqual([{ region: 'EU', total: 320 }]);
  });
});

function ScalarValueProbe<S extends Scalar<any>>(_s: S): ScalarValue<S> {
  return undefined as ScalarValue<S>;
}

/**
 * Everything below must NOT compile; each `@ts-expect-error` is itself the test.
 * The function is never called.
 */
export function _compileTimeNegatives(): void {
  const q = from<Order>('orders');
  const grouped = q.groupBy((o) => o.region);

  // unknown fields and wrong kinds of operators
  // @ts-expect-error `nope` is not a field of Order
  q.where((o) => o.nope.gt(1));
  // @ts-expect-error numbers have no string functions
  q.where((o) => o.total.lower().eq('x'));
  // @ts-expect-error strings have no arithmetic
  q.select((o) => ({ x: o.region.plus(1) }));
  // @ts-expect-error booleans have no ordering
  q.where((o) => o.paid.gt(1));
  // @ts-expect-error a number is not a boolean operand
  q.where((o) => o.paid.and(o.total));
  // @ts-expect-error comparing a number field with a string
  q.where((o) => o.total.eq('100'));
  // @ts-expect-error comparing a string field with a number
  q.where((o) => o.region.eq(1));
  // @ts-expect-error substring takes a numeric start
  q.where((o) => o.region.substring('1').eq('x'));
  // @ts-expect-error nested number has no string functions
  q.where((o) => o.meta.len.upper().eq('x'));
  // @ts-expect-error unknown nested fields are rejected; the real `meta.len` field uses $('len') because of the method-name collision
  q.where((o) => o.meta.missing.gt(1));

  // where needs a boolean
  // @ts-expect-error a number is not a condition
  q.where((o) => o.total);
  // @ts-expect-error a string is not a condition
  q.where((o) => o.region.lower());

  // aggregates stay out of where / sort / groupBy / join and out of a non-grouped select
  // @ts-expect-error aggregates are not allowed in where
  q.where((o) => agg.sum(o.total).gt(1));
  // @ts-expect-error aggregates are not allowed in where, also nested in a condition
  q.where((o) => o.paid.and(agg.count().gt(1)));
  // @ts-expect-error aggregates are not allowed in sort
  q.sort((o) => agg.sum(o.total).desc());
  // @ts-expect-error aggregates are not allowed in groupBy keys
  q.groupBy((o) => agg.max(o.total));
  // @ts-expect-error aggregates are not allowed in select outside groupBy
  q.select((o) => ({ total: agg.sum(o.total) }));
  // @ts-expect-error aggregates are not allowed in map outside groupBy
  q.map((o) => ({ total: agg.sum(o.total) }));
  // @ts-expect-error aggregates cannot be nested
  agg.sum(agg.sum(col<number>('x')));
  // @ts-expect-error aggregates need a numeric field
  q.select((o) => ({ total: agg.sum(o.region) }));
  // @ts-expect-error a pivot value must be an aggregate
  q.pivot((o) => o.region, (o) => o.total);
  // mixed row/aggregate expressions and the non-callback forms are rejected too
  // @ts-expect-error an aggregate operand makes the condition an aggregate
  q.where((o) => o.total.gt(agg.sum(o.total)));
  // @ts-expect-error an aggregate inside fn.if makes the condition an aggregate
  q.where(() => fn.if(agg.count().gt(1), true, false));
  // @ts-expect-error an aggregate condition passed directly
  q.where(agg.sum(col<number>('x')).gt(1));
  // @ts-expect-error an aggregate sort key passed directly
  q.sort(agg.sum(col<number>('x')).desc());
  // @ts-expect-error an aggregate in arithmetic under a sort key
  q.sort((o) => o.total.plus(agg.count()).asc());
  // @ts-expect-error one aggregate in a list of sort keys
  q.sort((o) => [o.total, agg.sum(o.total)]);
  // @ts-expect-error aggregates are not allowed in sort, even after groupBy
  grouped.sort((o) => agg.sum(o.total).desc());
  // @ts-expect-error aggregates are not allowed in join conditions
  q.join('customers', () => agg.count().gt(1));
  // @ts-expect-error aggregates are not allowed in distinct fields
  q.distinct((o) => agg.sum(o.total));
  // @ts-expect-error terminal aggregates cannot nest aggregates
  q.sum((o) => agg.sum(o.total));
  // @ts-expect-error the reduce accumulator is a row expression
  q.reduce(0, (o) => agg.sum(o.total));
  // @ts-expect-error select values are expressions or literals, not nested objects
  q.select((o) => ({ a: { b: o.id } }));

  // aliases are not allowed where the grammar forbids `as`
  // @ts-expect-error sort keys cannot be aliased
  q.sort((o) => o.total.as('t'));
  // @ts-expect-error untyped expressions are unaliased, but as() produces an alias and is still forbidden in sort
  q.sort(new Expr({ kind: 'FieldAccess', path: ['total'] }).as('t'));
  // @ts-expect-error groupBy keys cannot be aliased
  q.groupBy((o) => o.region.as('r'));
  // @ts-expect-error distinct fields cannot be aliased
  q.distinct((o) => o.region.as('r'));
  // @ts-expect-error flatten fields cannot be aliased
  q.flatten((o) => o.tags.as('t'));
  // @ts-expect-error transpose header fields cannot be aliased
  q.transpose((o) => o.region.as('r'));
  // @ts-expect-error the pivot field cannot be aliased
  q.pivot((o) => o.region.as('r'), (o) => agg.sum(o.total));
  // @ts-expect-error an aliased expression has no operators left
  q.select((o) => ({ x: o.total.as('t').plus(1) }));
  // @ts-expect-error terminal aggregate fields cannot be aliased
  q.sum((o) => o.total.as('t'));

  // terminal aggregates need the right kind of field, and end the pipeline
  // @ts-expect-error sum needs a number field
  q.sum((o) => o.region);
  // @ts-expect-error percentile needs a numeric p
  q.percentile((o) => o.total, 'high');
  // @ts-expect-error a Scalar has no further operations
  q.sum((o) => o.total).where((o: any) => o.x);

  // grouped state: aggregates are for select/map/rollup/pivot, not where, sort or terminals
  // @ts-expect-error aggregates are not allowed in where, even after groupBy
  grouped.where((o) => agg.sum(o.total).gt(1));
  // @ts-expect-error terminal aggregates do not apply to grouped rows
  grouped.sum((o) => o.total);
  // @ts-expect-error terminal count does not apply to grouped rows
  grouped.count();

  // window functions: allowed top-level in a non-grouped select only
  // @ts-expect-error window functions are not allowed in where
  q.where((o) => win.row_number().gt(1));
  // @ts-expect-error window functions are not allowed in sort
  q.sort((o) => win.row_number().asc());
  // @ts-expect-error window functions are not allowed in a grouped select
  grouped.select((o) => ({ n: win.row_number() }));
  // @ts-expect-error window functions are not allowed in map
  q.map((o) => ({ n: win.row_number() }));

  // output rows are typed after select
  const picked = q.select((o) => ({ id: o.id }));
  // @ts-expect-error `total` is not in the selected row
  picked.where((o) => o.total.gt(1));
  // @ts-expect-error `id` is a number after select
  picked.where((o) => o.id.lower().eq('x'));

  // joins
  // @ts-expect-error a join condition must be a boolean expression
  q.join<Customer>('customers', (o, c) => o.customerId.plus(c.id));
  // @ts-expect-error `nope` is not a field of Customer
  q.join<Customer>('customers', (o, c) => o.customerId.eq(c.nope));
  // @ts-expect-error numbers and strings do not compare
  q.join<Customer>('customers', (o, c) => o.customerId.eq(c.name));

  // nullability is not dropped from output rows
  const nl = from<Loose>('rows');
  // @ts-expect-error a nullable field can be null in the output row
  const n1: string = nl.select((o) => ({ note: o.note })).run([])[0].note;
  // @ts-expect-error an optional field can be undefined in the output row
  const n2: number = nl.select((o) => ({ disc: o.disc })).run([])[0].disc;
  // @ts-expect-error lag is null at the first row
  const n3: number = from<Order>('orders').select((o) => ({ p: win.lag(o.total) })).run([])[0].p;
  // @ts-expect-error a nullable field is still a string, not a number
  nl.where((o) => o.note.gt(1));

  // grouped rows do not promise row-scope fields
  // @ts-expect-error the key column may be missing from a grouped row
  const g1: string = q.groupBy((o) => o.region).select((o) => ({ region: o.region })).run([])[0].region;
  // @ts-expect-error a non-key field is missing from a grouped row
  const g2: number = q.groupBy((o) => o.region).select((o) => ({ t: o.total })).run([])[0].t;
  // @ts-expect-error a mixed aggregate/row expression may be missing
  const g3: number = q.groupBy((o) => o.region).select((o) => ({ t: agg.sum(o.total).plus(o.id) })).run([])[0].t;

  // nested objects are values, not numbers/strings/conditions
  // @ts-expect-error a nested object has no arithmetic
  q.select((o) => ({ x: o.meta.plus(1) }));
  // @ts-expect-error a nested object is not a condition
  q.where((o) => o.meta);
  // @ts-expect-error a nested object cannot be aliased in sort
  q.sort((o) => o.meta.as('m'));
  void [n1, n2, n3, g1, g2, g3];
}
