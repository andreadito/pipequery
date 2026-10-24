import type { Expression, Operation, Pipeline } from './types';
import { AGGREGATE_NAMES, TWO_ARG_AGGREGATES } from './types';

/**
 * AST -> canonical pipequery string.
 *
 * The output re-parses (with `parseQuery`) to an AST equal to the input, with one
 * accepted difference: a negative `NumberLiteral` prints as `-n`, which the parser
 * reads back as `UnaryExpr('-', NumberLiteral(n))`.
 *
 * Invalid ASTs (bad identifiers, reserved words, non-finite numbers, aliases where the
 * grammar forbids them, malformed operations) throw a descriptive `Error`.
 *
 * Note: the lexer currently tokenises `||` as two PIPE tokens, so a printed `||`
 * cannot be parsed back by `parseQuery`. The printer still emits it, because it is
 * a valid AST operator.
 */

// ─── Identifiers ────────────────────────────────────────────────────────────

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RESERVED_WORDS: ReadonlySet<string> = new Set(['as', 'asc', 'desc', 'true', 'false', 'null']);

function describe(name: unknown): string {
  return typeof name === 'string' ? JSON.stringify(name) : String(name);
}

function identifier(name: unknown, what: string): string {
  if (typeof name !== 'string' || !IDENTIFIER_RE.test(name)) {
    throw new Error(
      `printQuery: invalid ${what} ${describe(name)}: identifiers must match [A-Za-z_][A-Za-z0-9_]* ` +
      `(names with spaces, hyphens or other characters cannot be expressed in pipequery)`,
    );
  }
  if (RESERVED_WORDS.has(name)) {
    throw new Error(`printQuery: invalid ${what} "${name}": "${name}" is a reserved word`);
  }
  // The lexer looks keywords up on a plain object, so inherited names such as
  // `constructor` or `toString` are mis-tokenised and cannot be used as identifiers.
  if (name in Object.prototype) {
    throw new Error(
      `printQuery: invalid ${what} "${name}": "${name}" collides with a JavaScript built-in property and cannot be lexed`,
    );
  }
  return name;
}

/** Validate an identifier with the printer's rules. Used by the builder for early errors. */
export function assertIdentifier(name: unknown, what: string): string {
  return identifier(name, what);
}

// ─── Literals ───────────────────────────────────────────────────────────────

function expandExponent(text: string): string {
  const m = /^(\d+)(?:\.(\d+))?e([+-]\d+)$/.exec(text);
  if (!m) return text;
  const intPart = m[1];
  const fracPart = m[2] ?? '';
  const digits = intPart + fracPart;
  const point = intPart.length + Number(m[3]);
  if (point <= 0) return '0.' + '0'.repeat(-point) + digits;
  if (point >= digits.length) return digits + '0'.repeat(point - digits.length);
  return digits.slice(0, point) + '.' + digits.slice(point);
}

/** Prints a non-negative finite number as `digits[.digits]` (the only form the lexer accepts). */
function unsignedNumber(value: number): string {
  return expandExponent(String(value));
}

function isNegative(value: number): boolean {
  return value < 0 || Object.is(value, -0);
}

function numberLiteral(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`printQuery: number literal must be a finite number, got ${String(value)}`);
  }
  return isNegative(value) ? `-${unsignedNumber(-value)}` : unsignedNumber(value);
}

function stringLiteral(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error(`printQuery: string literal must be a string, got ${typeof value}`);
  }
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
  return `"${escaped}"`;
}

// ─── Expressions ────────────────────────────────────────────────────────────

const PREC_ALIAS = 0;
const PREC_UNARY = 7;
const PREC_PRIMARY = 8;

const BINARY_PRECEDENCE: Record<string, number> = {
  '||': 1,
  '&&': 2,
  '==': 3, '!=': 3,
  '<': 4, '<=': 4, '>': 4, '>=': 4,
  '+': 5, '-': 5,
  '*': 6, '/': 6, '%': 6,
};

interface Printed {
  text: string;
  prec: number;
}

function wrap(p: Printed, minPrec: number): string {
  return p.prec < minPrec ? `(${p.text})` : p.text;
}

function printNode(expr: Expression): Printed {
  if (expr === null || typeof expr !== 'object') {
    throw new Error(`printQuery: expected an expression node, got ${String(expr)}`);
  }
  switch (expr.kind) {
    case 'NumberLiteral': {
      const text = numberLiteral(expr.value);
      return { text, prec: text.startsWith('-') ? PREC_UNARY : PREC_PRIMARY };
    }
    case 'StringLiteral':
      return { text: stringLiteral(expr.value), prec: PREC_PRIMARY };
    case 'BooleanLiteral':
      if (typeof expr.value !== 'boolean') {
        throw new Error(`printQuery: boolean literal must be a boolean, got ${typeof (expr as { value: unknown }).value}`);
      }
      return { text: expr.value ? 'true' : 'false', prec: PREC_PRIMARY };
    case 'NullLiteral':
      return { text: 'null', prec: PREC_PRIMARY };
    case 'FieldAccess': {
      if (!Array.isArray(expr.path) || expr.path.length === 0) {
        throw new Error('printQuery: field access requires a non-empty path');
      }
      const text = expr.path.map((seg) => identifier(seg, 'field name')).join('.');
      return { text, prec: PREC_PRIMARY };
    }
    case 'UnaryExpr': {
      if (expr.operator !== '!' && expr.operator !== '-') {
        throw new Error(`printQuery: unknown unary operator ${describe(expr.operator)}`);
      }
      const operand = printNode(expr.operand);
      let inner = wrap(operand, PREC_UNARY);
      // Avoid emitting `--x`; keep the output unambiguous and readable.
      if (expr.operator === '-' && inner.startsWith('-')) inner = `(${inner})`;
      return { text: `${expr.operator}${inner}`, prec: PREC_UNARY };
    }
    case 'BinaryExpr': {
      const prec = BINARY_PRECEDENCE[expr.operator];
      if (prec === undefined || !Object.prototype.hasOwnProperty.call(BINARY_PRECEDENCE, expr.operator)) {
        throw new Error(`printQuery: unknown binary operator ${describe(expr.operator)}`);
      }
      // Left-associative: the right operand needs parentheses at equal precedence.
      const left = wrap(printNode(expr.left), prec);
      const right = wrap(printNode(expr.right), prec + 1);
      return { text: `${left} ${expr.operator} ${right}`, prec };
    }
    case 'FunctionCall': {
      const name = identifier(expr.name, 'function name');
      if (!Array.isArray(expr.args)) throw new Error(`printQuery: ${name}() requires an args array`);
      checkFunctionShape(name, expr.args);
      const args = expr.args.map((a) => printTop(a)).join(', ');
      return { text: `${name}(${args})`, prec: PREC_PRIMARY };
    }
    case 'AliasExpr': {
      const alias = identifier(expr.alias, 'alias');
      const inner = printNode(expr.expression);
      // An alias cannot directly wrap another alias; parenthesise the inner one.
      return { text: `${wrap(inner, PREC_ALIAS + 1)} as ${alias}`, prec: PREC_ALIAS };
    }
    default:
      throw new Error(`printQuery: unknown expression kind ${describe((expr as { kind?: unknown }).kind)}`);
  }
}

/**
 * Prints an expression in a position where the grammar calls `parseExpression`
 * (a trailing `as alias` is allowed). Nothing needs wrapping here.
 */
function printTop(expr: Expression): string {
  return printNode(expr).text;
}

/**
 * Prints an expression in a position where the grammar calls `parseOrExpr`
 * (no alias allowed). `where` is the operation, for error messages.
 */
function printNoAlias(expr: Expression, where: string): string {
  if (expr !== null && typeof expr === 'object' && expr.kind === 'AliasExpr') {
    throw new Error(`printQuery: aliases ("as ${describe(expr.alias)}") are not allowed in ${where}`);
  }
  return printNode(expr).text;
}

function checkFunctionShape(name: string, args: Expression[]): void {
  if (name === 'if' && (args.length < 2 || args.length > 3)) {
    throw new Error(`printQuery: if() expects 2 or 3 arguments, got ${args.length}`);
  }
  if (name === 'lag' || name === 'lead') {
    if (args.length < 1 || args.length > 2) {
      throw new Error(`printQuery: ${name}() expects 1 or 2 arguments, got ${args.length}`);
    }
    if (args.length === 2) {
      const offset = args[1];
      if (
        offset.kind !== 'NumberLiteral' ||
        !Number.isFinite(offset.value) ||
        offset.value < 0 ||
        Object.is(offset.value, -0)
      ) {
        throw new Error(`printQuery: ${name}() offset must be a non-negative numeric literal`);
      }
    }
  }
}

function isAggregateExpression(expr: Expression): boolean {
  if (expr.kind === 'AliasExpr') return isAggregateExpression(expr.expression);
  if (expr.kind === 'FunctionCall') return AGGREGATE_NAMES.has(expr.name);
  return false;
}

// ─── Operations ─────────────────────────────────────────────────────────────

function list<T>(items: T[] | undefined, what: string): T[] {
  if (!Array.isArray(items)) throw new Error(`printQuery: ${what} must be an array`);
  return items;
}

function countLiteral(count: unknown, op: string): string {
  if (typeof count !== 'number' || !Number.isFinite(count) || count < 0 || Object.is(count, -0)) {
    throw new Error(`printQuery: ${op}() count must be a non-negative finite number, got ${String(count)}`);
  }
  return unsignedNumber(count);
}

function printOperation(op: Operation): string {
  if (op === null || typeof op !== 'object') {
    throw new Error(`printQuery: expected an operation node, got ${String(op)}`);
  }
  switch (op.kind) {
    case 'WhereOp':
      return `where(${printTop(op.condition)})`;

    case 'SelectOp':
      return `select(${list(op.fields, 'select fields').map(printTop).join(', ')})`;

    case 'MapOp':
      return `map(${list(op.fields, 'map fields').map(printTop).join(', ')})`;

    case 'SortOp': {
      const parts = list(op.criteria, 'sort criteria').map((c) => {
        if (c.direction !== 'asc' && c.direction !== 'desc') {
          throw new Error(`printQuery: sort direction must be "asc" or "desc", got ${describe(c.direction)}`);
        }
        const text = printNoAlias(c.expression, 'sort');
        return c.direction === 'desc' ? `${text} desc` : text;
      });
      return `sort(${parts.join(', ')})`;
    }

    case 'GroupByOp':
      return `groupBy(${list(op.keys, 'groupBy keys').map((k) => printNoAlias(k, 'groupBy')).join(', ')})`;

    case 'JoinOp':
      return `join(${identifier(op.right, 'join source')}, ${printTop(op.condition)})`;

    case 'FirstOp':
      return `first(${countLiteral(op.count, 'first')})`;

    case 'LastOp':
      return `last(${countLiteral(op.count, 'last')})`;

    case 'DistinctOp': {
      const fields = op.fields === undefined ? [] : list(op.fields, 'distinct fields');
      return `distinct(${fields.map((f) => printNoAlias(f, 'distinct')).join(', ')})`;
    }

    case 'FlattenOp':
      return `flatten(${op.field === undefined ? '' : printNoAlias(op.field, 'flatten')})`;

    case 'TransposeOp':
      return `transpose(${op.headerField === undefined ? '' : printNoAlias(op.headerField, 'transpose')})`;

    case 'RollupOp': {
      const keys = list(op.keys, 'rollup keys');
      const aggregates = list(op.aggregates, 'rollup aggregates');
      if (aggregates.length === 0) {
        throw new Error('printQuery: rollup requires at least one aggregate expression');
      }
      keys.forEach((k) => {
        if (isAggregateExpression(k)) {
          throw new Error('printQuery: rollup keys must not be aggregate expressions (keys come before aggregates)');
        }
      });
      aggregates.forEach((a) => {
        if (!isAggregateExpression(a)) {
          throw new Error('printQuery: rollup aggregates must be aggregate function calls (optionally aliased)');
        }
      });
      return `rollup(${[...keys, ...aggregates].map(printTop).join(', ')})`;
    }

    case 'PivotOp': {
      const aggregates = list(op.aggregates, 'pivot aggregates');
      if (aggregates.length === 0) {
        throw new Error('printQuery: pivot requires at least one aggregate expression');
      }
      const field = printNoAlias(op.pivotField, 'the pivot field');
      return `pivot(${[field, ...aggregates.map(printTop)].join(', ')})`;
    }

    case 'ReduceOp':
      return `reduce(${printTop(op.initial)}, ${printTop(op.accumulator)})`;

    case 'AggregateOp': {
      const fn = op.function;
      if (!AGGREGATE_NAMES.has(fn)) {
        throw new Error(`printQuery: unknown aggregate function ${describe(fn)}`);
      }
      if (TWO_ARG_AGGREGATES.has(fn)) {
        if (op.field !== undefined || !Array.isArray(op.args) || op.args.length !== 2) {
          throw new Error(`printQuery: ${fn}() requires exactly 2 arguments (args)`);
        }
        return `${fn}(${op.args.map((a) => printNoAlias(a, `the ${fn} aggregate`)).join(', ')})`;
      }
      if (op.args !== undefined && op.args.length > 0) {
        throw new Error(`printQuery: ${fn}() takes a single optional field, not an args list`);
      }
      return `${fn}(${op.field === undefined ? '' : printNoAlias(op.field, `the ${fn} aggregate`)})`;
    }

    default:
      throw new Error(`printQuery: unknown operation kind ${describe((op as { kind?: unknown }).kind)}`);
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Prints a pipeline AST as a canonical pipequery string. */
export function printQuery(ast: Pipeline): string {
  if (ast === null || typeof ast !== 'object' || ast.kind !== 'Pipeline') {
    throw new Error('printQuery: expected a Pipeline node');
  }
  const source = identifier(ast.source, 'source name');
  const ops = list(ast.operations, 'pipeline operations').map(printOperation);
  return [source, ...ops].join(' | ');
}

/**
 * Prints a single expression (an alias is allowed at the top level) as a canonical
 * pipequery string. Useful for tooling that edits one clause at a time.
 */
export function printExpression(expr: Expression): string {
  return printTop(expr);
}
