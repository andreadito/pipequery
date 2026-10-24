/**
 * Compile-time types of the builder. Nothing here exists at runtime except three
 * phantom symbols: every expression is an `Expr` instance, these interfaces are
 * only views that decide which methods and positions type-check.
 *
 * An expression carries:
 *  - a value type (`NumExpr`, `StrExpr`, `BoolExpr`, `GenericExpr<T>`)
 *  - a scope: `'row'` (plain fields and operators), `'agg'` (contains an aggregate) or
 *    `'win'` (contains a window function). Scopes are unioned when expressions combine,
 *    so `where` and `sort`, which accept `'row'` only, reject both.
 *  - whether it is aliased (`.as(name)`). Aliased expressions cannot go where the
 *    grammar forbids `as` (sort, groupBy, distinct, ...).
 */
import type { Expr, SortKey } from './expr';

export const TYPE: unique symbol = Symbol.for('pipequery.builder.type');
export const SCOPE: unique symbol = Symbol.for('pipequery.builder.scope');
export const ALIAS: unique symbol = Symbol.for('pipequery.builder.alias');
export const NULLISH: unique symbol = Symbol.for('pipequery.builder.nullish');

export type Scope = 'row' | 'agg' | 'win';
type IsAny<T> = 0 extends 1 & T ? true : false;

/** What every expression looks like to positions that take any of them (aliased or not). */
export interface ExprBase<T = any, S extends Scope = Scope> {
  readonly [TYPE]?: T;
  readonly [SCOPE]?: S;
  readonly [ALIAS]?: boolean;
}

/** An expression that is not aliased. */
export type Plain<T = any, S extends Scope = Scope> = ExprBase<T, S> & { readonly [ALIAS]?: false };

/** `expr.as('name')`: usable in `select`, `map`, `rollup` and `pivot`, and nowhere that forbids `as`. */
export interface AliasedExpr<N extends string = string, T = any, S extends Scope = Scope> extends ExprBase<T, S> {
  readonly [ALIAS]: true;
  /** Phantom: the output column name. */
  readonly __name?: N;
}

export type Nullish = null | undefined;

/** Operands also accept nullable expressions (a nullable field is still a number/string/boolean field). */
export type NumOperand<B extends Scope = 'row'> = number | Plain<number | Nullish, B>;
export type StrOperand<B extends Scope = 'row'> = string | Plain<string | Nullish, B>;
export type BoolOperand<B extends Scope = 'row'> = boolean | Plain<boolean | Nullish, B>;

/**
 * Phantom marker for expressions that may be `null`/`undefined` (nullable or optional fields,
 * `win.lag`, ...). The kind interfaces (`NumExpr`, ...) stay the same so operators and positions
 * are unaffected; only `ValueOf`, and so the output row types, see it.
 */
export type WithNull<E, N> = [N] extends [never] ? E : E & { readonly [NULLISH]: N };
type NullOf<X> = X extends { readonly [NULLISH]: infer N } ? N : never;
type Undef<N> = [N] extends [never] ? never : undefined;

interface Common<T, S extends Scope> extends ExprBase<T, S> {
  readonly [ALIAS]?: false;
  eq<O extends T | Nullish | Plain<T | Nullish, Scope>>(other: O): BoolExpr<S | ScopeOf<O>>;
  ne<O extends T | Nullish | Plain<T | Nullish, Scope>>(other: O): BoolExpr<S | ScopeOf<O>>;
  /** First non-null value of this expression and the fallbacks. */
  coalesce<O extends T | Plain<T | Nullish, Scope>>(...rest: O[]): ExprFor<T, S | ScopeOf<O>>;
  as<N extends string>(name: N): AliasedExpr<N, T, S>;
  asc(): SortKey<S>;
  desc(): SortKey<S>;
}

/** An expression of a type with no dedicated operators (arrays, `unknown`, mixed unions). */
export interface GenericExpr<T = unknown, S extends Scope = 'row'> extends Common<T, S> {}

export interface NumExpr<S extends Scope = 'row'> extends Common<number, S> {
  gt<O extends NumOperand<Scope>>(other: O): BoolExpr<S | ScopeOf<O>>;
  gte<O extends NumOperand<Scope>>(other: O): BoolExpr<S | ScopeOf<O>>;
  lt<O extends NumOperand<Scope>>(other: O): BoolExpr<S | ScopeOf<O>>;
  lte<O extends NumOperand<Scope>>(other: O): BoolExpr<S | ScopeOf<O>>;
  plus<O extends NumOperand<Scope>>(other: O): NumExpr<S | ScopeOf<O>>;
  minus<O extends NumOperand<Scope>>(other: O): NumExpr<S | ScopeOf<O>>;
  times<O extends NumOperand<Scope>>(other: O): NumExpr<S | ScopeOf<O>>;
  div<O extends NumOperand<Scope>>(other: O): NumExpr<S | ScopeOf<O>>;
  mod<O extends NumOperand<Scope>>(other: O): NumExpr<S | ScopeOf<O>>;
  neg(): NumExpr<S>;
  abs(): NumExpr<S>;
  round<O extends NumOperand<Scope> = number>(precision?: O): NumExpr<S | ScopeOf<O>>;
}

export interface StrExpr<S extends Scope = 'row'> extends Common<string, S> {
  gt<O extends StrOperand<Scope>>(other: O): BoolExpr<S | ScopeOf<O>>;
  gte<O extends StrOperand<Scope>>(other: O): BoolExpr<S | ScopeOf<O>>;
  lt<O extends StrOperand<Scope>>(other: O): BoolExpr<S | ScopeOf<O>>;
  lte<O extends StrOperand<Scope>>(other: O): BoolExpr<S | ScopeOf<O>>;
  lower(): StrExpr<S>;
  upper(): StrExpr<S>;
  trim(): StrExpr<S>;
  len(): NumExpr<S>;
  concat<A extends Array<string | number | boolean | Plain<any, Scope>>>(...rest: A): StrExpr<S | ScopeOf<A[number]>>;
  contains<O extends StrOperand<Scope>>(search: O): BoolExpr<S | ScopeOf<O>>;
  startsWith<O extends StrOperand<Scope>>(prefix: O): BoolExpr<S | ScopeOf<O>>;
  endsWith<O extends StrOperand<Scope>>(suffix: O): BoolExpr<S | ScopeOf<O>>;
  substring<N1 extends NumOperand<Scope>, N2 extends NumOperand<Scope> = number>(start: N1, length?: N2): StrExpr<S | ScopeOf<N1 | N2>>;
  replace<A extends StrOperand<Scope>, B extends StrOperand<Scope>>(search: A, replacement: B): StrExpr<S | ScopeOf<A | B>>;
}

export interface BoolExpr<S extends Scope = 'row'> extends Common<boolean, S> {
  and<O extends BoolOperand<Scope>>(other: O): BoolExpr<S | ScopeOf<O>>;
  /** Logical or. Printed as `if(a, true, b)`, because the lexer cannot read `||`. */
  or<O extends BoolOperand<Scope>>(other: O): BoolExpr<S | ScopeOf<O>>;
  not(): BoolExpr<S>;
}

/** The expression type for a value type `T` in scope `S`. `any` stays `any`. */
export type ExprFor<T, S extends Scope = 'row'> =
  0 extends 1 & T ? any
  : [T] extends [number] ? NumExpr<S>
  : [T] extends [string] ? StrExpr<S>
  : [T] extends [boolean] ? BoolExpr<S>
  : GenericExpr<T, S>;

/** Like `ExprFor`, but `null`/`undefined` in `V` become the nullish marker instead of being dropped. */
export type ExprOf<V, S extends Scope = 'row'> =
  0 extends 1 & V ? any
  : [NonNullable<V>] extends [never] ? GenericExpr<V, S>
  : WithNull<ExprFor<NonNullable<V>, S>, Extract<V, Nullish>>;

/** The value type of an expression (or of a JS literal used as an operand). */
export type ValueOf<X> =
  0 extends 1 & X ? any
  : X extends number ? number
  : X extends string ? string
  : X extends boolean ? boolean
  : X extends null ? null
  : X extends ExprBase<infer T, any> ? T | NullOf<X>
  : unknown;

/** The scope of an expression (`'row'` for literals). */
export type ScopeOf<X> =
  IsAny<X> extends true ? 'row'
  : X extends number | string | boolean | null ? 'row'
  : X extends ExprBase<any, infer S> ? IsAny<S> extends true ? 'row' : S
  : 'row';

// ─── Rows ───────────────────────────────────────────────────────────────────

/** Names that exist on `Expr` at runtime, so a nested field of that name is not addressable as `o.a.name`. */
type Clashes = keyof Expr | 'constructor' | 'valueOf' | 'toLocaleString' | 'hasOwnProperty'
  | 'isPrototypeOf' | 'propertyIsEnumerable';

/** A nested object is itself an expression of type `V`, so it can be selected, grouped or compared as a whole. */
type NestedFields<V, N = never> = Plain<V, 'row'> & {
  readonly [K in keyof V & string as K extends Clashes ? never : K]-?: FieldOf<V[K], N>;
} & {
  /** Reach a nested field whose name clashes with an expression method: `o.meta.$('len')`. */
  $(...segments: string[]): any;
};

/** The expression (or nested proxy) for a field of type `V`. */
export type FieldOf<V, P = never> =
  0 extends 1 & V ? any
  : unknown extends V ? GenericExpr<unknown, 'row'>
  : [NonNullable<V>] extends [never] ? GenericExpr<V, 'row'>
  : WithNull<
      [NonNullable<V>] extends [number | string | boolean] ? ExprFor<NonNullable<V>, 'row'>
      : [NonNullable<V>] extends [readonly unknown[] | Date] ? GenericExpr<NonNullable<V>, 'row'>
      : [NonNullable<V>] extends [object] ? NestedFields<NonNullable<V>, Undef<Extract<V, Nullish> | P>>
      : GenericExpr<NonNullable<V>, 'row'>,
      Extract<V, Nullish> | Undef<P>
    >;

/**
 * The row object handed to builder callbacks: `o.total` is a `NumExpr` when the row's
 * `total` is a number, `o.customer.name` follows nested objects. For `Row = any` every field is `any`.
 */
export type Fields<Row = any> = 0 extends 1 & Row
  ? Record<string, any>
  : { readonly [K in keyof Row & string]-?: FieldOf<Row[K]> };

// ─── Helpers ────────────────────────────────────────────────────────────────

/** A field argument of an aggregate or window function: a row expression or a raw pipequery expression. */
export type NumField = string | Plain<number | Nullish, 'row'>;
export type AnyField = string | Plain<any, 'row'>;

/** A branch/fallback value: expression or JS literal. */
export type Branch = ExprBase<any, Scope> | string | number | boolean | null;

type Def<T> = NonNullable<T>;

/** The 24 aggregates as expression builders: `agg.sum(o.total)`, `agg.count()`. */
export interface AggregateHelpers {
  sum(field: NumField): NumExpr<'agg'>;
  avg(field: NumField): NumExpr<'agg'>;
  median(field: NumField): NumExpr<'agg'>;
  stddev(field: NumField): NumExpr<'agg'>;
  var(field: NumField): NumExpr<'agg'>;
  skew(field: NumField): NumExpr<'agg'>;
  kurt(field: NumField): NumExpr<'agg'>;
  drawdown(field: NumField): NumExpr<'agg'>;
  pct(field: NumField): NumExpr<'agg'>;
  sharpe(field: NumField): NumExpr<'agg'>;
  calmar(field: NumField): NumExpr<'agg'>;
  sortino(field: NumField): NumExpr<'agg'>;
  sum_abs(field: NumField): NumExpr<'agg'>;
  abs_sum(field: NumField): NumExpr<'agg'>;
  distinct_count(field: AnyField): NumExpr<'agg'>;
  count(field?: AnyField): NumExpr<'agg'>;
  min<E extends Plain<any, 'row'>>(field: E | string): ExprFor<Def<ValueOf<E>>, 'agg'>;
  max<E extends Plain<any, 'row'>>(field: E | string): ExprFor<Def<ValueOf<E>>, 'agg'>;
  first_value<E extends Plain<any, 'row'>>(field: E | string): ExprFor<Def<ValueOf<E>>, 'agg'>;
  last_value<E extends Plain<any, 'row'>>(field: E | string): ExprFor<Def<ValueOf<E>>, 'agg'>;
  percentile(field: NumField, p: number | Plain<number, 'row'>): NumExpr<'agg'>;
  vwap(price: NumField, volume: NumField): NumExpr<'agg'>;
  wavg(value: NumField, weight: NumField): NumExpr<'agg'>;
  info_ratio(returns: NumField, benchmark: NumField): NumExpr<'agg'>;
}

/** Window functions. Valid as a top-level (optionally aliased) field of `select` outside `groupBy`. */
export interface WindowHelpers {
  running_sum(field: NumField): NumExpr<'win'>;
  running_avg(field: NumField): NumExpr<'win'>;
  running_min(field: NumField): NumExpr<'win'>;
  running_max(field: NumField): NumExpr<'win'>;
  running_count(field?: AnyField): NumExpr<'win'>;
  row_number(): NumExpr<'win'>;
  /** `null` at the edges of the window, so the value is typed `T | null`. */
  lag<E extends Plain<any, 'row'>>(field: E | string, offset?: number): ExprOf<ValueOf<E> | null, 'win'>;
  lead<E extends Plain<any, 'row'>>(field: E | string, offset?: number): ExprOf<ValueOf<E> | null, 'win'>;
}

/** Scalar functions as free functions. A string argument is a string literal. */
export interface FnHelpers {
  if<C extends BoolOperand<Scope>, X extends Branch = Branch, Y extends Branch = null>(
    cond: C,
    then: X,
    otherwise?: Y,
  ): ExprOf<ValueOf<X> | ValueOf<Y>, ScopeOf<C> | ScopeOf<X> | ScopeOf<Y>>;
  coalesce<A extends Branch[]>(...args: A): ExprFor<Def<ValueOf<A[number]>>, ScopeOf<A[number]>>;
  lower<O extends StrOperand<Scope>>(value: O): StrExpr<ScopeOf<O>>;
  upper<O extends StrOperand<Scope>>(value: O): StrExpr<ScopeOf<O>>;
  trim<O extends StrOperand<Scope>>(value: O): StrExpr<ScopeOf<O>>;
  len<O extends StrOperand<Scope>>(value: O): NumExpr<ScopeOf<O>>;
  abs<O extends NumOperand<Scope>>(value: O): NumExpr<ScopeOf<O>>;
  round<V extends NumOperand<Scope>, P extends NumOperand<Scope> = number>(value: V, precision?: P): NumExpr<ScopeOf<V | P>>;
  concat<A extends Array<string | number | boolean | Plain<any, Scope>>>(...args: A): StrExpr<ScopeOf<A[number]>>;
  contains<V extends StrOperand<Scope>, A extends StrOperand<Scope>>(value: V, search: A): BoolExpr<ScopeOf<V | A>>;
  startsWith<V extends StrOperand<Scope>, A extends StrOperand<Scope>>(value: V, prefix: A): BoolExpr<ScopeOf<V | A>>;
  endsWith<V extends StrOperand<Scope>, A extends StrOperand<Scope>>(value: V, suffix: A): BoolExpr<ScopeOf<V | A>>;
  substring<V extends StrOperand<Scope>, N1 extends NumOperand<Scope>, N2 extends NumOperand<Scope> = number>(value: V, start: N1, length?: N2): StrExpr<ScopeOf<V | N1 | N2>>;
  replace<V extends StrOperand<Scope>, A extends StrOperand<Scope>, B extends StrOperand<Scope>>(value: V, search: A, replacement: B): StrExpr<ScopeOf<V | A | B>>;
}

// ─── Output rows ────────────────────────────────────────────────────────────

type Simplify<T> = { [K in keyof T]: T[K] } & {};

/** The row type of `select({ a: expr, ... })`. */
export type Shape<R> = Simplify<{ [K in keyof R]: ValueOf<R[K]> }>;

/**
 * The row type of a `select`/`map` object literal after `groupBy`. The engine evaluates fields
 * against `{ ...keyColumns, _group }`: key columns are named after the last path segment (or `key`),
 * so any row-scope field may be missing. Aggregate-only values stay precise; JS literals too.
 */
export type GroupedShape<R> = Simplify<{
  [K in keyof R]: R[K] extends number | string | boolean | null
    ? ValueOf<R[K]>
    : 'row' extends ScopeOf<R[K]> ? ValueOf<R[K]> | undefined : ValueOf<R[K]>;
}>;

/** Row type after `map`/`join`: the right keys win. `any` on either side gives `any`. */
export type Merge<A, B> = 0 extends 1 & A ? any : 0 extends 1 & B ? any : Simplify<Omit<A, keyof B> & B>;
