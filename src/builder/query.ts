import type {
  CompiledQuery,
  DataContext,
  Expression,
  Operation,
  Pipeline,
  RowData,
  SortOp,
} from '../engine/types';
import { AGGREGATE_NAMES, TWO_ARG_AGGREGATES } from '../engine/types';
import { printQuery } from '../engine/print';
import { compileAst } from '../engine/index';
import {
  BuilderError,
  checkIdentifier,
  parseExprList,
  parseOperations,
  parseOrExprList,
  parseSingleOp,
  parseSortCriteria,
  validateOperation,
  validateSource,
} from './raw';
import {
  Expr,
  SortKey,
  WINDOW_NAMES,
  aggregateArgs,
  fieldPath,
  findCall,
  hasFieldAccess,
  isAggregateCall,
  rowProxy,
  toAst,
  unalias,
} from './expr';
import type {
  AnyField,
  BoolExpr,
  ExprBase,
  ExprFor,
  Fields,
  Merge,
  NumField,
  Plain,
  GroupedShape,
  Scope,
  Shape,
  ValueOf,
} from './typed';
import type { FieldInput, Operand } from './expr';

// ─── Input types ────────────────────────────────────────────────────────────
//
// `Row` is the row type the callbacks see. `X` is the kind of expression the position
// accepts: `Plain<any, 'row'>` for positions that forbid aliases and aggregates,
// `ExprBase<any, S>` where `as` is allowed. Raw pipequery strings are always accepted.

/** Row-scope expression without alias: the position of where/sort/groupBy keys and join conditions. */
type RowExpr = Plain<any, 'row'> | Expr;

/** A single expression: raw pipequery string, expression, or a callback receiving the row. */
export type ExprInput<Row = any, X = ExprBase> = string | X | Expr | ((o: Fields<Row>) => X | Expr);

/** One or more expressions. */
export type ExprListInput<Row = any, X = ExprBase> = string | X | Expr | ((o: Fields<Row>) => X | X[] | Expr | Expr[]);

/** Values of an object literal passed to `select`/`map`. */
export type SelectValue<S extends Scope = Scope> = string | number | boolean | null | ExprBase<any, S>;

/** `select`/`map` item: also accepts `{ alias: expression }` objects. */
export type SelectInput<Row = any, S extends Scope = Scope> =
  | string
  | ExprBase<any, S>
  | Record<string, SelectValue<S>>
  | ((o: Fields<Row>) => ExprBase<any, S> | ExprBase<any, S>[] | Record<string, SelectValue<S>>);

export type SortInput<Row = any> =
  | string
  | RowExpr
  | SortKey
  | ((o: Fields<Row>) => RowExpr | SortKey | Array<RowExpr | SortKey>);

/** A join condition: raw string, expression, `(left, right) => expression`, or `{ on: [left, right] }`. */
export type JoinInput<Row = any, Right = any> =
  | string
  | BoolExpr<'row'>
  | Expr
  | ((left: Fields<Row>, right: Fields<Right>) => BoolExpr<'row'> | Expr)
  | { on: [string | RowExpr, string | RowExpr] };

/** Rows seen by operations that follow `groupBy`: `{ ...keys, _group }`, so untyped. */
type Cur<Row, G extends boolean> = G extends true ? any : Row;

/** Scopes `select` accepts: aggregates after `groupBy`, window functions otherwise. */
type SelectScope<G extends boolean> = G extends true ? 'row' | 'agg' : 'row' | 'win';

/** Scopes `map` accepts: aggregates after `groupBy`, plain row expressions otherwise. */
type MapScope<G extends boolean> = G extends true ? 'row' | 'agg' : 'row';

type NumArg<Row> = NumField | ((o: Fields<Row>) => Plain<number, 'row'>);
type AnyArg<Row> = AnyField | ((o: Fields<Row>) => Plain<any, 'row'>);
type ScalarOf<E> = Scalar<ValueOf<E> | null>;

/** Terminal aggregates exist only before `groupBy` (after it they are `never`). */
type Ungrouped<G extends boolean, F> = G extends true ? never : F;

type NumericAggregate =
  | 'sum' | 'avg' | 'median' | 'stddev' | 'var' | 'skew' | 'kurt' | 'drawdown'
  | 'pct' | 'sharpe' | 'calmar' | 'sortino' | 'sum_abs' | 'abs_sum';
type AnyAggregate = 'min' | 'max' | 'first_value' | 'last_value';

/**
 * Terminal aggregate methods. They end the pipeline and return a `Scalar`.
 * After `groupBy` they are `never`: use `select`, `map`, `rollup` or `pivot` there.
 */
export type TerminalAggregates<Row = any, G extends boolean = false> =
  { [K in NumericAggregate]: Ungrouped<G, (field: NumArg<Row>) => Scalar<number>> } &
  {
    [K in AnyAggregate]: Ungrouped<G, <E extends Plain<any, 'row'>>(
      field: E | string | ((o: Fields<Row>) => E),
    ) => ScalarOf<E>>;
  } & {
    distinct_count: Ungrouped<G, (field: AnyArg<Row>) => Scalar<number>>;
    count: Ungrouped<G, (field?: AnyArg<Row>) => Scalar<number>>;
    percentile: Ungrouped<G, (field: NumArg<Row>, p: number | Plain<number, 'row'>) => Scalar<number>>;
    vwap: Ungrouped<G, (price: NumArg<Row>, volume: NumArg<Row>) => Scalar<number>>;
    wavg: Ungrouped<G, (value: NumArg<Row>, weight: NumArg<Row>) => Scalar<number>>;
    info_ratio: Ungrouped<G, (returns: NumArg<Row>, benchmark: NumArg<Row>) => Scalar<number>>;
  };

// ─── Argument resolution ────────────────────────────────────────────────────

/** Call callbacks with row proxies and flatten array results one level. */
function collect(args: readonly unknown[], proxies: () => unknown[] = () => [rowProxy()]): unknown[] {
  const out: unknown[] = [];
  for (const arg of args) {
    const fromCallback = typeof arg === 'function';
    const value = fromCallback ? (arg as (...p: unknown[]) => unknown)(...proxies()) : arg;
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) {
      if (fromCallback && typeof item === 'string') {
        throw new BuilderError(
          'callbacks must return expressions, not strings (a string is a raw pipequery fragment only when passed directly)',
        );
      }
      out.push(item);
    }
  }
  return out;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function aliasEntries(obj: Record<string, unknown>): Expression[] {
  return Object.entries(obj).map(([name, value]) => {
    checkIdentifier(name, 'alias');
    const node = unalias(toAst(value, `value of "${name}"`));
    if (node.kind === 'FieldAccess' && node.path[node.path.length - 1] === name) return node;
    return { kind: 'AliasExpr', expression: node, alias: name } as Expression;
  });
}

/** Resolve items to expressions. Strings are raw fragments parsed by `parseRaw`. */
function toExprs(
  items: unknown[],
  parseRaw: (raw: string) => Expression[],
  allowObjects = false,
): Expression[] {
  const out: Expression[] = [];
  for (const item of items) {
    if (typeof item === 'string') {
      const parsed = parseRaw(item);
      if (parsed.length === 0) throw new BuilderError('empty expression string');
      out.push(...parsed);
    } else if (allowObjects && isPlainObject(item)) {
      out.push(...aliasEntries(item));
    } else {
      out.push(toAst(item, 'expression'));
    }
  }
  return out;
}

/** Raw-string parsers that report errors under the user-facing method name. */
const keysParser = (label: string) => (raw: string) => parseOrExprList(raw, label);
const exprsParser = (label: string) => (raw: string) => parseExprList(raw, label);

function one(arg: unknown, parseRaw: (raw: string) => Expression[], what: string): Expression {
  const exprs = toExprs(collect([arg]), parseRaw);
  if (exprs.length !== 1) {
    throw new BuilderError(`${what} expects exactly one expression, got ${exprs.length}`);
  }
  return exprs[0];
}

function toCriteria(items: unknown[]): SortOp['criteria'] {
  const out: SortOp['criteria'] = [];
  for (const item of items) {
    if (typeof item === 'string') {
      out.push(...parseSortCriteria(item));
    } else if (item instanceof SortKey) {
      out.push({ expression: item.expression, direction: item.direction });
    } else {
      out.push({ expression: toAst(item, 'sort key'), direction: 'asc' });
    }
  }
  return out;
}

export function nonNegativeInteger(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new BuilderError(`${what} must be a non-negative integer, got ${String(value)}`);
  }
  return value;
}

function fieldRef(value: string | Expr, what: string): Expression {
  if (typeof value === 'string') return { kind: 'FieldAccess', path: fieldPath(value) };
  const node = toAst(value, what);
  if (node.kind !== 'FieldAccess') {
    throw new BuilderError(`${what} must be a field reference`);
  }
  return node;
}

// ─── Context validation ─────────────────────────────────────────────────────

/** Whether the engine compiles the operation following `op` in grouped mode. */
function producesGrouped(op: Operation, wasGrouped: boolean): boolean {
  if (op.kind === 'GroupByOp') return true;
  if (op.kind === 'MapOp') return wasGrouped;
  return false;
}

function noAggregate(exprs: Expression[], where: string): void {
  for (const e of exprs) {
    const hit = findCall(e, (n) => AGGREGATE_NAMES.has(n));
    if (hit) {
      throw new BuilderError(
        `${where}: aggregate ${hit}() is not allowed here (aggregates belong in rollup(), pivot(), select()/map() after groupBy(), or a terminal aggregate)`,
      );
    }
  }
}

/** The engine reads `offset || 1`, so a 0 offset would silently become 1 (shared by win.* and raw ops). */
function windowOffsets(expr: Expression): void {
  const e = unalias(expr);
  if (e.kind !== 'FunctionCall' || (e.name !== 'lag' && e.name !== 'lead') || e.args.length < 2) return;
  const offset = e.args[1];
  if (offset.kind !== 'NumberLiteral' || !Number.isInteger(offset.value) || offset.value < 1) {
    throw new BuilderError(`${e.name}(): offset must be an integer >= 1`);
  }
}

function noWindow(exprs: Expression[], where: string): void {
  for (const e of exprs) {
    const hit = findCall(e, (n) => WINDOW_NAMES.has(n));
    if (hit) {
      throw new BuilderError(`${where}: window function ${hit}() is only supported as a top-level field of select()`);
    }
  }
}

/** Static checks the printer cannot do: where aggregates and window functions may appear. */
function validateContext(op: Operation, grouped: boolean): void {
  switch (op.kind) {
    case 'WhereOp':
      noAggregate([op.condition], 'where');
      noWindow([op.condition], 'where');
      break;
    case 'SortOp': {
      const exprs = op.criteria.map((c) => c.expression);
      noAggregate(exprs, 'sort');
      noWindow(exprs, 'sort');
      break;
    }
    case 'GroupByOp':
      noAggregate(op.keys, 'groupBy');
      noWindow(op.keys, 'groupBy');
      break;
    case 'JoinOp':
      noAggregate([op.condition], 'join');
      noWindow([op.condition], 'join');
      break;
    case 'FirstOp':
      nonNegativeInteger(op.count, 'first() count');
      break;
    case 'LastOp':
      nonNegativeInteger(op.count, 'last() count');
      break;
    case 'DistinctOp':
      noAggregate(op.fields ?? [], 'distinct');
      noWindow(op.fields ?? [], 'distinct');
      break;
    case 'FlattenOp':
      noAggregate(op.field ? [op.field] : [], 'flatten');
      noWindow(op.field ? [op.field] : [], 'flatten');
      break;
    case 'TransposeOp':
      noAggregate(op.headerField ? [op.headerField] : [], 'transpose');
      noWindow(op.headerField ? [op.headerField] : [], 'transpose');
      break;
    case 'SelectOp':
    case 'MapOp': {
      const label = op.kind === 'SelectOp' ? 'select' : 'map';
      if (!grouped) noAggregate(op.fields, `${label} (outside groupBy)`);
      for (const f of op.fields) windowOffsets(f);
      if (op.kind === 'MapOp') {
        noWindow(op.fields, 'map');
      } else {
        // windows are fine at the top level (possibly aliased), not nested
        for (const f of op.fields) {
          const e = unalias(f);
          noWindow(e.kind === 'FunctionCall' && WINDOW_NAMES.has(e.name) ? e.args : [f], 'select');
        }
      }
      break;
    }
    case 'RollupOp':
      noAggregate(op.keys, 'rollup keys');
      noWindow([...op.keys, ...op.aggregates], 'rollup');
      break;
    case 'PivotOp':
      noAggregate([op.pivotField], 'pivot field');
      noWindow([op.pivotField, ...op.aggregates], 'pivot');
      for (const a of op.aggregates) {
        if (!findCall(a, (n) => AGGREGATE_NAMES.has(n))) {
          throw new BuilderError('pivot: every value must be an aggregate expression such as sum(amount)');
        }
      }
      break;
    case 'ReduceOp':
      if (hasFieldAccess(op.initial)) {
        throw new BuilderError('reduce: the initial value is evaluated before any row and cannot reference fields');
      }
      noAggregate([op.initial, op.accumulator], 'reduce');
      noWindow([op.initial, op.accumulator], 'reduce');
      break;
    case 'AggregateOp': {
      const exprs = [...(op.args ?? []), ...(op.field ? [op.field] : [])];
      noAggregate(exprs, op.function);
      noWindow(exprs, op.function);
      break;
    }
    default:
      break;
  }
}

// ─── Pipelines ──────────────────────────────────────────────────────────────

abstract class Built {
  protected constructor(
    protected readonly sourceName: string,
    protected readonly ops: readonly Operation[],
  ) {}

  private compiled?: CompiledQuery;

  /** The pipeline AST (a fresh object each time; expression nodes are shared). */
  get ast(): Pipeline {
    return { kind: 'Pipeline', source: this.sourceName, operations: [...this.ops] };
  }

  /** Canonical pipequery text, via `printQuery`. */
  toString(): string {
    return printQuery(this.ast);
  }

  /** Compile the AST directly (no print + re-parse). */
  compile(): CompiledQuery {
    return (this.compiled ??= compileAst(this.ast));
  }

  protected execute(context: DataContext | readonly unknown[]): unknown {
    const ctx: DataContext = Array.isArray(context)
      ? { [this.sourceName]: context as unknown[] }
      : (context as DataContext);
    return this.compile()(ctx);
  }
}

/** The result of a terminal operation (`sum`, `count`, `reduce`, ...): one value, no further ops. */
export class Scalar<T = unknown> extends Built {
  /** @internal */
  constructor(source: string, ops: readonly Operation[]) {
    super(source, ops);
  }

  /** Run against `{ source: rows, ... }` or, for plain arrays, the rows of this query's source. */
  run(context: DataContext | readonly unknown[]): T {
    return this.execute(context) as T;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface Query<Row = any, G extends boolean = false> extends TerminalAggregates<Row, G> {}

/**
 * Immutable fluent pipeline. Every method returns a new `Query` (or a `Scalar` for
 * terminal operations), validated as it is added.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class Query<Row = any, G extends boolean = false> extends Built {
  /** @internal use `from()` */
  constructor(source: string, ops: readonly Operation[] = []) {
    super(source, ops);
  }

  private isGrouped(): boolean {
    let grouped = false;
    for (const op of this.ops) grouped = producesGrouped(op, grouped);
    return grouped;
  }

  /** Validate and append operations. */
  private extend(added: readonly Operation[]): Query<any, any> {
    let grouped = this.isGrouped();
    for (const op of added) {
      validateOperation(op);
      validateContext(op, grouped);
      grouped = producesGrouped(op, grouped);
    }
    return new Query(this.sourceName, [...this.ops, ...added]);
  }

  private terminal(op: Operation): Scalar<any> {
    validateOperation(op);
    validateContext(op, this.isGrouped());
    return new Scalar(this.sourceName, [...this.ops, op]);
  }

  /** Run against `{ source: rows, ... }` or, for plain arrays, the rows of this query's source. */
  run<T = Cur<Row, G>[]>(context: DataContext | readonly unknown[]): T {
    return this.execute(context) as T;
  }

  // ── pipe ops ──────────────────────────────────────────────────────────

  /** Rows matching the condition. Aggregates and window functions are not allowed here. */
  where(condition: ExprInput<Cur<Row, G>, BoolExpr<'row'>>): Query<Cur<Row, G>, false> {
    const expr = one(condition, (raw) => [parseSingleOp('where', raw, 'WhereOp').condition], 'where()');
    return this.extend([{ kind: 'WhereOp', condition: expr }]);
  }

  /**
   * Pick fields. An object literal gives a typed output row:
   * `select((o) => ({ id: o.id, name: o.customer.name }))`. Aggregates are allowed after
   * `groupBy`, window functions (`win.*`) before it. Other forms give untyped rows.
   */
  select<R extends Record<string, SelectValue<SelectScope<G>>>>(
    fields: R | ((o: Fields<Row>) => R),
  ): Query<G extends true ? GroupedShape<R> : Shape<R>, false>;
  select(...fields: SelectInput<Row, SelectScope<G>>[]): Query<any, false>;
  select(...fields: unknown[]): Query<any, false> {
    const exprs = toExprs(collect(fields), parseExprList, true);
    if (exprs.length === 0) throw new BuilderError('select() requires at least one field');
    return this.extend([{ kind: 'SelectOp', fields: exprs }]);
  }

  /** Sort keys must be row expressions: no aliases, no aggregates. */
  sort(...keys: SortInput<Cur<Row, G>>[]): Query<Cur<Row, G>, false> {
    const criteria = toCriteria(collect(keys));
    if (criteria.length === 0) throw new BuilderError('sort() requires at least one key');
    return this.extend([{ kind: 'SortOp', criteria }]);
  }

  /**
   * Group rows. Follow with `select`/`map` (aggregates allowed), `rollup` or `pivot`.
   * A bare `groupBy` yields `{ ...keys, _group }` rows and is rarely what you want to run.
   * No keys groups everything into one group.
   */
  groupBy(...keys: ExprListInput<Row, RowExpr>[]): Query<Row, true> {
    const exprs = toExprs(collect(keys), parseOrExprList);
    return this.extend([{ kind: 'GroupByOp', keys: exprs }]);
  }

  /**
   * Join with another source from the run context. The engine merges rows as
   * `{ ...left, ...right }`, so on a name collision the right value wins.
   * `FieldAccess == FieldAccess` conditions (also `{ on: [left, right] }`) use the hash join.
   * In callbacks both arguments are plain row proxies; for non-equi conditions the
   * condition sees the merged row, so qualify nothing and avoid colliding names.
   */
  join<Right = any>(right: string, on: JoinInput<Cur<Row, G>, Right>): Query<Merge<Cur<Row, G>, Right>, false> {
    validateSource(right);
    let condition: Expression;
    if (typeof on === 'string') {
      condition = parseSingleOp('join', on, 'JoinOp', `${right}, `).condition;
    } else if (typeof on === 'function') {
      const result = (on as (l: unknown, r: unknown) => unknown)(rowProxy(), rowProxy());
      if (typeof result === 'string') {
        throw new BuilderError('join callbacks must return an expression, not a string');
      }
      condition = toAst(result, 'join condition');
    } else if (on instanceof Expr) {
      condition = toAst(on, 'join condition');
    } else if (isPlainObject(on) && Array.isArray((on as { on?: unknown }).on)) {
      const pair = (on as { on: unknown[] }).on;
      if (pair.length !== 2) throw new BuilderError('join({ on }) expects [leftField, rightField]');
      condition = {
        kind: 'BinaryExpr',
        operator: '==',
        left: fieldRef(pair[0] as string | Expr, 'left join key'),
        right: fieldRef(pair[1] as string | Expr, 'right join key'),
      };
    } else {
      throw new BuilderError('join() condition must be a string, expression, callback or { on: [left, right] }');
    }
    return this.extend([{ kind: 'JoinOp', right, condition }]);
  }

  first(count: number): Query<Cur<Row, G>, false> {
    return this.extend([{ kind: 'FirstOp', count: nonNegativeInteger(count, 'first() count') }]);
  }

  /**
   * The last `count` rows. Engine quirk, passed through unchanged: `last(0)` returns
   * every row (the engine does `slice(-0)`), unlike `first(0)` which returns none.
   */
  last(count: number): Query<Cur<Row, G>, false> {
    return this.extend([{ kind: 'LastOp', count: nonNegativeInteger(count, 'last() count') }]);
  }

  /** Distinct rows, or distinct by the given fields. */
  distinct(...fields: ExprListInput<Cur<Row, G>, RowExpr>[]): Query<Cur<Row, G>, false> {
    const exprs = toExprs(collect(fields), keysParser('distinct()'));
    return this.extend([{ kind: 'DistinctOp', fields: exprs.length > 0 ? exprs : undefined }]);
  }

  /** Flatten nested arrays, or the array held in `field`. */
  flatten(field?: ExprInput<Cur<Row, G>, RowExpr>): Query<any, false> {
    const expr = field === undefined ? undefined : one(field, keysParser('flatten()'), 'flatten()');
    return this.extend([{ kind: 'FlattenOp', field: expr }]);
  }

  transpose(headerField?: ExprInput<Cur<Row, G>, RowExpr>): Query<any, false> {
    const expr = headerField === undefined ? undefined : one(headerField, keysParser('transpose()'), 'transpose()');
    return this.extend([{ kind: 'TransposeOp', headerField: expr }]);
  }

  /**
   * Group keys first, then at least one aggregate:
   * `rollup('region', agg.sum(o.total).as('total'))`.
   */
  rollup(...items: ExprListInput<Cur<Row, G>, ExprBase<any, 'row' | 'agg'>>[]): Query<any, false> {
    const exprs = toExprs(collect(items), exprsParser('rollup()'));
    const keys: Expression[] = [];
    const aggregates: Expression[] = [];
    for (const e of exprs) {
      if (isAggregateCall(e)) {
        aggregates.push(e);
      } else if (aggregates.length > 0) {
        throw new BuilderError('rollup(): group keys must come before aggregate expressions');
      } else {
        keys.push(e);
      }
    }
    if (aggregates.length === 0) {
      throw new BuilderError('rollup(): at least one aggregate expression is required');
    }
    return this.extend([{ kind: 'RollupOp', keys, aggregates }]);
  }

  /** Pivot on `field`, computing the given aggregates for each pivot value. */
  pivot(
    field: ExprInput<Cur<Row, G>, RowExpr>,
    ...aggregates: ExprListInput<Cur<Row, G>, ExprBase<any, 'agg'>>[]
  ): Query<any, false> {
    const pivotField = one(field, keysParser('pivot() field'), 'pivot() field');
    const exprs = toExprs(collect(aggregates), exprsParser('pivot()'));
    if (exprs.length === 0) throw new BuilderError('pivot(): at least one aggregate expression is required');
    return this.extend([{ kind: 'PivotOp', pivotField, aggregates: exprs }]);
  }

  /** Add or overwrite fields, keeping the others (unlike `select`). */
  /**
   * With an object literal the output row is typed: the input row with the new fields on top.
   * After `groupBy` rows are untyped and aggregates are allowed (the query stays grouped).
   */
  map<R extends Record<string, SelectValue<MapScope<G>>>>(
    fields: R | ((o: Fields<Row>) => R),
  ): Query<Merge<Cur<Row, G>, Shape<R>>, G>;
  map(...fields: SelectInput<Row, MapScope<G>>[]): Query<any, G>;
  map(...fields: unknown[]): Query<any, G> {
    const exprs = toExprs(collect(fields), exprsParser('map()'), true);
    if (exprs.length === 0) throw new BuilderError('map() requires at least one field');
    return this.extend([{ kind: 'MapOp', fields: exprs }]);
  }

  /**
   * Fold rows into one value. `initial` cannot reference fields; the accumulator sees the
   * row's fields plus `_acc`: `reduce(0, (o) => o._acc.plus(o.total))`.
   * Strings are raw pipequery fragments; use `lit()` for string literals.
   */
  reduce<T = any>(
    initial: Operand | ExprInput<Row, RowExpr>,
    accumulator: ExprInput<Row & { _acc: T }, RowExpr>,
  ): Scalar<T> {
    const initialExpr = typeof initial === 'string'
      ? one(initial, exprsParser('reduce() initial value'), 'reduce() initial value')
      : typeof initial === 'function'
        ? one(initial, exprsParser('reduce() initial value'), 'reduce() initial value')
        : toAst(initial, 'reduce() initial value');
    const accumulatorExpr = one(accumulator, exprsParser('reduce() accumulator'), 'reduce() accumulator');
    return this.terminal({ kind: 'ReduceOp', initial: initialExpr, accumulator: accumulatorExpr });
  }

  /**
   * Escape hatch: splice raw pipequery operations, parsed with the real parser.
   * Accepts `'where(x > 1)'`, `'where(x > 1) | first(3)'` (optional leading `|`), or an AST operation.
   */
  pipe(raw: string | Operation): Query<any, boolean> {
    if (typeof raw === 'string') {
      const text = raw.replace(/^\s*\|/, '');
      const ops = parseOperations(text, 0, 'pipe()');
      if (ops.length === 0) throw new BuilderError('pipe() requires at least one operation');
      return this.extend(ops);
    }
    if (typeof raw !== 'object' || raw === null || typeof (raw as { kind?: unknown }).kind !== 'string') {
      throw new BuilderError('pipe() expects a pipequery string or an operation node');
    }
    return this.extend([raw]);
  }

  /** @internal used by the terminal aggregate methods installed below. */
  protected aggregate(name: string, args: unknown[]): Scalar<any> {
    const resolved = collect(args);
    const asts = aggregateArgs(name, resolved);
    const op: Operation = TWO_ARG_AGGREGATES.has(name)
      ? { kind: 'AggregateOp', function: name as never, args: asts }
      : { kind: 'AggregateOp', function: name as never, field: asts[0] };
    return this.terminal(op);
  }
}

for (const name of AGGREGATE_NAMES) {
  Object.defineProperty(Query.prototype, name, {
    configurable: true,
    writable: true,
    value: function (this: { aggregate(n: string, a: unknown[]): unknown }, ...args: unknown[]) {
      return this.aggregate(name, args);
    },
  });
}

/**
 * Start a query. `from<Order>('orders')` reads from the `orders` source; with no name the
 * query reads from `_data`, the source the engine uses for plain row arrays.
 */
export function from<Row = any>(source?: string): Query<Row, false> {
  const name = source === undefined ? '_data' : validateSource(source);
  return new Query<Row, false>(name);
}
