import type { AggregateFnName, Expression } from '../engine/types';
import { AGGREGATE_NAMES, TWO_ARG_AGGREGATES } from '../engine/types';
import { printQuery } from '../engine/print';
import { BuilderError, checkIdentifier, parseFieldExpr } from './raw';
import { ALIAS, SCOPE, TYPE } from './typed';
import type {
  AggregateHelpers,
  AnyField,
  AliasedExpr,
  BoolExpr,
  Fields,
  FieldOf,
  FnHelpers,
  GenericExpr,
  NumExpr,
  Scope,
  StrExpr,
  WindowHelpers,
} from './typed';

const NODE: unique symbol = Symbol.for('pipequery.builder.node');

export type { Fields };

/** Values accepted as operands: expressions or JS literals (strings are always string literals). */
export type Operand = Expr | string | number | boolean | null;

/** Field positions of aggregates / window functions: an expression, or a raw pipequery expression string. */
export type FieldInput = Expr | string;

/** A sort key from `asc()`/`desc()`. The scope is a compile-time tag: `sort` accepts `'row'` keys only. */
export class SortKey<S extends Scope = 'row'> {
  declare readonly __scope?: S;

  constructor(
    readonly expression: Expression,
    readonly direction: 'asc' | 'desc',
  ) {}
}

// ─── Conversion ─────────────────────────────────────────────────────────────

/** The AST node behind an expression. */
export function toAst(value: unknown, what = 'operand'): Expression {
  if (value instanceof Expr) return value[NODE];
  switch (typeof value) {
    case 'string':
      return { kind: 'StringLiteral', value };
    case 'boolean':
      return { kind: 'BooleanLiteral', value };
    case 'number':
      if (!Number.isFinite(value)) {
        throw new BuilderError(`invalid ${what}: ${String(value)} is not a finite number`);
      }
      // The grammar has no negative literals: `-5` is unary minus applied to `5`.
      if (value < 0 || Object.is(value, -0)) {
        return {
          kind: 'UnaryExpr',
          operator: '-',
          operand: { kind: 'NumberLiteral', value: -value },
        };
      }
      return { kind: 'NumberLiteral', value };
  }
  if (value === null) return { kind: 'NullLiteral' };
  if (value instanceof SortKey) {
    throw new BuilderError(`invalid ${what}: asc()/desc() keys are only valid in sort()`);
  }
  throw new BuilderError(
    `invalid ${what}: expected an expression, string, number, boolean or null but got ${value === undefined ? 'undefined' : typeof value}`,
  );
}

/** Field position: expression, raw expression string, or a number/boolean/null literal. */
function toFieldAst(value: unknown, what: string): Expression {
  if (typeof value === 'string') return parseFieldExpr(value, what);
  return toAst(value, what);
}

function fieldPath(path: string): string[] {
  if (typeof path !== 'string' || path === '') {
    throw new BuilderError('invalid field path: expected a non-empty string');
  }
  return path.split('.').map((seg) => checkIdentifier(seg, 'field name'));
}

// ─── Expr ───────────────────────────────────────────────────────────────────

function bin(operator: Extract<Expression, { kind: 'BinaryExpr' }>['operator'], left: unknown, right: unknown): Expr {
  return new Expr({ kind: 'BinaryExpr', operator, left: toAst(left), right: toAst(right) });
}

const ARITY: Record<string, [number, number]> = {
  if: [2, 3],
  coalesce: [1, Infinity],
  lower: [1, 1],
  upper: [1, 1],
  len: [1, 1],
  abs: [1, 1],
  round: [1, 2],
  concat: [1, Infinity],
  contains: [2, 2],
  startsWith: [2, 2],
  endsWith: [2, 2],
  trim: [1, 1],
  substring: [2, 3],
  replace: [3, 3],
};

function scalarCall(name: string, args: unknown[]): Expr {
  const [min, max] = ARITY[name];
  if (args.length < min || args.length > max) {
    const expected = min === max ? `${min}` : max === Infinity ? `at least ${min}` : `${min} or ${max}`;
    throw new BuilderError(`${name}() expects ${expected} argument(s), got ${args.length}`);
  }
  return new Expr({
    kind: 'FunctionCall',
    name,
    args: args.map((a, i) => toAst(a, `argument ${i + 1} of ${name}()`)),
  });
}

/** Drop trailing `undefined` arguments (optional parameters that were not passed). */
function trimArgs(args: unknown[]): unknown[] {
  let n = args.length;
  while (n > 0 && args[n - 1] === undefined) n--;
  return args.slice(0, n);
}

/** Whether the engine always returns a boolean for this expression (not just a truthy value). */
function isBooleanNode(node: Expression): boolean {
  switch (node.kind) {
    case 'BooleanLiteral':
      return true;
    case 'UnaryExpr':
      return node.operator === '!';
    case 'BinaryExpr':
      if (['==', '!=', '<', '<=', '>', '>='].includes(node.operator)) return true;
      return (node.operator === '&&' || node.operator === '||')
        && isBooleanNode(node.left) && isBooleanNode(node.right);
    case 'FunctionCall':
      if (['contains', 'startsWith', 'endsWith'].includes(node.name)) return true;
      return node.name === 'if' && node.args.length === 3 && isBooleanNode(node.args[0])
        && isBooleanNode(node.args[1]) && isBooleanNode(node.args[2]);
    default:
      return false;
  }
}

/** Builder-made unknown-valued `a || b`: the same node is used for condition and then branch. */
function isOrNode(n: Expression): n is Extract<Expression, { kind: 'FunctionCall' }> {
  return n.kind === 'FunctionCall' && n.name === 'if' && n.args.length === 3 && n.args[0] === n.args[1];
}

/** `left || right`, re-associated to the right so that chains grow linearly. */
function orNode(left: Expression, right: Expression): Expression {
  if (isBooleanNode(left)) {
    return { kind: 'FunctionCall', name: 'if', args: [left, { kind: 'BooleanLiteral', value: true }, right] };
  }
  if (isOrNode(left)) {
    const [cond, , rest] = left.args;
    return { kind: 'FunctionCall', name: 'if', args: [cond, cond, orNode(rest, right)] };
  }
  return { kind: 'FunctionCall', name: 'if', args: [left, left, right] };
}

/**
 * A pipequery expression. Immutable: every method returns a new expression.
 *
 * Inside builder callbacks, `o.total` is an `Expr` (a field access) whose unknown
 * property names extend the path: `o.customer.name`. Names that collide with an
 * `Expr` method (`len`, `round`, `replace`, ...) are reached with `.$('len')` or `col()`.
 */
export class Expr {
  readonly [NODE]: Expression;
  // Untyped expressions are plain row expressions; typed helper APIs provide narrower views.
  declare readonly [TYPE]?: any;
  declare readonly [SCOPE]?: 'row';
  declare readonly [ALIAS]?: false;

  constructor(node: Expression) {
    this[NODE] = node;
  }

  // comparison
  gt(other: Operand): Expr { return bin('>', this, other); }
  gte(other: Operand): Expr { return bin('>=', this, other); }
  lt(other: Operand): Expr { return bin('<', this, other); }
  lte(other: Operand): Expr { return bin('<=', this, other); }
  eq(other: Operand): Expr { return bin('==', this, other); }
  ne(other: Operand): Expr { return bin('!=', this, other); }

  // logical
  and(other: Operand): Expr { return bin('&&', this, other); }
  /**
   * Logical or. The AST uses `if(a, true, b)` for proven boolean `a`, and
   * `if(a, a, b)` otherwise: the lexer cannot parse `||` (it reads two PIPE tokens).
   * Both forms have the engine's `a || b` value semantics and round-trip through
   * `parseQuery`. In the latter, `a` is evaluated twice; expressions are pure.
   *
   * Unknown-valued chains stay linear by associating right: `a.or(b).or(c)`
   * becomes `if(a, a, if(b, b, c))`.
   */
  or(other: Operand): Expr {
    return new Expr(orNode(this[NODE], toAst(other)));
  }
  not(): Expr { return new Expr({ kind: 'UnaryExpr', operator: '!', operand: this[NODE] }); }

  // arithmetic
  plus(other: Operand): Expr { return bin('+', this, other); }
  minus(other: Operand): Expr { return bin('-', this, other); }
  times(other: Operand): Expr { return bin('*', this, other); }
  div(other: Operand): Expr { return bin('/', this, other); }
  mod(other: Operand): Expr { return bin('%', this, other); }
  neg(): Expr { return new Expr({ kind: 'UnaryExpr', operator: '-', operand: this[NODE] }); }

  // scalar functions
  lower(): Expr { return scalarCall('lower', [this]); }
  upper(): Expr { return scalarCall('upper', [this]); }
  len(): Expr { return scalarCall('len', [this]); }
  abs(): Expr { return scalarCall('abs', [this]); }
  round(precision?: Operand): Expr { return scalarCall('round', trimArgs([this, precision])); }
  trim(): Expr { return scalarCall('trim', [this]); }
  concat(...rest: Operand[]): Expr { return scalarCall('concat', [this, ...rest]); }
  coalesce(...rest: Operand[]): Expr { return scalarCall('coalesce', [this, ...rest]); }
  contains(search: Operand): Expr { return scalarCall('contains', [this, search]); }
  startsWith(prefix: Operand): Expr { return scalarCall('startsWith', [this, prefix]); }
  endsWith(suffix: Operand): Expr { return scalarCall('endsWith', [this, suffix]); }
  substring(start: Operand, length?: Operand): Expr {
    return scalarCall('substring', trimArgs([this, start, length]));
  }
  replace(search: Operand, replacement: Operand): Expr {
    return scalarCall('replace', [this, search, replacement]);
  }

  // naming and ordering
  /** `expr as name`. Re-aliasing replaces the previous alias. */
  as<N extends string>(name: N): AliasedExpr<N, any, 'row'> {
    checkIdentifier(name, 'alias');
    const node = this[NODE];
    return new Expr({
      kind: 'AliasExpr',
      expression: node.kind === 'AliasExpr' ? node.expression : node,
      alias: name,
    }) as unknown as AliasedExpr<N, any, 'row'>;
  }
  asc(): SortKey { return new SortKey(this[NODE], 'asc'); }
  desc(): SortKey { return new SortKey(this[NODE], 'desc'); }

  /** Extend a field path with names that collide with `Expr` methods: `o.customer.$('len')`. */
  $(...segments: string[]): Expr {
    const node = this[NODE];
    if (node.kind !== 'FieldAccess') {
      throw new BuilderError('$() can only extend a field access');
    }
    return fieldProxy([...node.path, ...segments.map((s) => checkIdentifier(s, 'field name'))]);
  }

  /** The pipequery text of this expression. */
  toString(): string {
    const text = printQuery({
      kind: 'Pipeline',
      source: '_data',
      operations: [{ kind: 'SelectOp', fields: [this[NODE]] }],
    });
    const prefix = '_data | select(';
    return text.slice(prefix.length, -1);
  }
}

function fieldProxy(path: string[]): Expr {
  const target = new Expr({ kind: 'FieldAccess', path });
  return new Proxy(target, {
    get(t, prop, receiver) {
      if (typeof prop === 'symbol' || prop in t) return Reflect.get(t, prop, receiver);
      return fieldProxy([...path, prop]);
    },
  });
}

/** The row object handed to builder callbacks: every property is a field access. */
export function rowProxy(): Fields {
  return new Proxy({}, {
    get(_t, prop) {
      return typeof prop === 'symbol' ? undefined : fieldProxy([prop]);
    },
  });
}

/**
 * Field access from a dotted path: `col('customer.name')` or `col('customer', 'name')`.
 * Give the field's type to get typed operators: `col<number>('total').gt(1)`.
 */
export function col<V = any>(...path: string[]): FieldOf<V> {
  if (path.length === 0) throw new BuilderError('col() requires a field name');
  return fieldProxy(path.flatMap(fieldPath)) as unknown as FieldOf<V>;
}

/** A literal value (strings are string literals, never field names). */
export function lit(value: number): NumExpr;
export function lit(value: string): StrExpr;
export function lit(value: boolean): BoolExpr;
export function lit(value: null): GenericExpr<null>;
export function lit(value: string | number | boolean | null): any {
  return new Expr(toAst(value, 'literal'));
}

// ─── Aggregates ─────────────────────────────────────────────────────────────

export type { AggregateHelpers, AnyField };

/** Check the arity of an aggregate and convert its field arguments. */
export function aggregateArgs(name: string, args: unknown[]): Expression[] {
  if (!AGGREGATE_NAMES.has(name)) throw new BuilderError(`unknown aggregate "${name}"`);
  const defined = trimArgs(args);
  if (defined.length !== args.length) {
    throw new BuilderError(`${name}(): undefined argument`);
  }
  if (TWO_ARG_AGGREGATES.has(name)) {
    if (args.length !== 2) throw new BuilderError(`${name}() expects exactly 2 arguments, got ${args.length}`);
  } else if (name === 'count') {
    if (args.length > 1) throw new BuilderError(`count() expects at most 1 argument, got ${args.length}`);
  } else if (args.length !== 1) {
    throw new BuilderError(`${name}() expects exactly 1 field argument, got ${args.length}`);
  }
  return args.map((a, i) => toFieldAst(a, `argument ${i + 1} of ${name}()`));
}

function makeAggregates(): AggregateHelpers {
  const helpers: Record<string, (...args: unknown[]) => Expr> = {};
  for (const name of AGGREGATE_NAMES) {
    helpers[name] = (...args: unknown[]) =>
      new Expr({ kind: 'FunctionCall', name, args: aggregateArgs(name, args) });
  }
  return helpers as unknown as AggregateHelpers;
}

export const agg: AggregateHelpers = makeAggregates();

// ─── Scalar functions ───────────────────────────────────────────────────────

/** Scalar functions as free functions. Arguments are expressions or literals. */
const fnImpl = {
  if: (cond: Operand, then: Operand, otherwise?: Operand): Expr =>
    scalarCall('if', trimArgs([cond, then, otherwise])),
  coalesce: (...args: Operand[]): Expr => scalarCall('coalesce', args),
  lower: (value: Operand): Expr => scalarCall('lower', [value]),
  upper: (value: Operand): Expr => scalarCall('upper', [value]),
  len: (value: Operand): Expr => scalarCall('len', [value]),
  abs: (value: Operand): Expr => scalarCall('abs', [value]),
  round: (value: Operand, precision?: Operand): Expr => scalarCall('round', trimArgs([value, precision])),
  concat: (...args: Operand[]): Expr => scalarCall('concat', args),
  contains: (value: Operand, search: Operand): Expr => scalarCall('contains', [value, search]),
  startsWith: (value: Operand, prefix: Operand): Expr => scalarCall('startsWith', [value, prefix]),
  endsWith: (value: Operand, suffix: Operand): Expr => scalarCall('endsWith', [value, suffix]),
  trim: (value: Operand): Expr => scalarCall('trim', [value]),
  substring: (value: Operand, start: Operand, length?: Operand): Expr =>
    scalarCall('substring', trimArgs([value, start, length])),
  replace: (value: Operand, search: Operand, replacement: Operand): Expr =>
    scalarCall('replace', [value, search, replacement]),
};

export const fn: FnHelpers = fnImpl as unknown as FnHelpers;

// ─── Window functions ───────────────────────────────────────────────────────

function windowCall(name: string, field: FieldInput | undefined, offset?: number): Expr {
  const args: Expression[] = [];
  if (field !== undefined) args.push(toFieldAst(field, `field of ${name}()`));
  if (offset !== undefined) {
    // The engine reads `offset || 1`, so 0 would silently become 1.
    if (!Number.isInteger(offset) || offset < 1) {
      throw new BuilderError(`${name}(): offset must be an integer >= 1, got ${String(offset)}`);
    }
    args.push({ kind: 'NumberLiteral', value: offset });
  }
  return new Expr({ kind: 'FunctionCall', name, args });
}

/**
 * Window functions. Only meaningful as a top-level (optionally aliased) field of `select`.
 */
const winImpl = {
  running_sum: (field: FieldInput): Expr => windowCall('running_sum', field),
  running_avg: (field: FieldInput): Expr => windowCall('running_avg', field),
  running_min: (field: FieldInput): Expr => windowCall('running_min', field),
  running_max: (field: FieldInput): Expr => windowCall('running_max', field),
  running_count: (field?: FieldInput): Expr => windowCall('running_count', field),
  row_number: (): Expr => windowCall('row_number', undefined),
  lag: (field: FieldInput, offset?: number): Expr => windowCall('lag', field, offset),
  lead: (field: FieldInput, offset?: number): Expr => windowCall('lead', field, offset),
};

export const win: WindowHelpers = winImpl as unknown as WindowHelpers;

export const WINDOW_NAMES: ReadonlySet<string> = new Set([
  'running_sum', 'running_avg', 'running_count', 'running_min', 'running_max',
  'row_number', 'lag', 'lead',
]);

// ─── AST inspection helpers ─────────────────────────────────────────────────

export function unalias(expr: Expression): Expression {
  return expr.kind === 'AliasExpr' ? expr.expression : expr;
}

/** First function call in the tree satisfying `pred`, searching depth first. */
export function findCall(expr: Expression, pred: (name: string) => boolean): string | undefined {
  switch (expr.kind) {
    case 'FunctionCall': {
      if (pred(expr.name)) return expr.name;
      for (const a of expr.args) {
        const hit = findCall(a, pred);
        if (hit) return hit;
      }
      return undefined;
    }
    case 'BinaryExpr':
      return findCall(expr.left, pred) ?? findCall(expr.right, pred);
    case 'UnaryExpr':
      return findCall(expr.operand, pred);
    case 'AliasExpr':
      return findCall(expr.expression, pred);
    default:
      return undefined;
  }
}

export function hasFieldAccess(expr: Expression): boolean {
  switch (expr.kind) {
    case 'FieldAccess':
      return true;
    case 'FunctionCall':
      return expr.args.some(hasFieldAccess);
    case 'BinaryExpr':
      return hasFieldAccess(expr.left) || hasFieldAccess(expr.right);
    case 'UnaryExpr':
      return hasFieldAccess(expr.operand);
    case 'AliasExpr':
      return hasFieldAccess(expr.expression);
    default:
      return false;
  }
}

export function isAggregateCall(expr: Expression): boolean {
  const e = unalias(expr);
  return e.kind === 'FunctionCall' && AGGREGATE_NAMES.has(e.name);
}

export type { AggregateFnName };
export { fieldPath };
