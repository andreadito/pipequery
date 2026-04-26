// Pipe-AST → SQL compiler (dialect-parametric).
//
// Translates a Pipeline AST whose source is a single SQL-backed source into
// a parameterized SQL query. Every emission goes through a SqlDialect, so
// adding a new engine reduces to writing a dialect (see dialect.ts).
//
// Supported operators:
//   - WhereOp        with BinaryExpr / UnaryExpr / FieldAccess / literals
//   - SortOp         with FieldAccess criteria
//   - FirstOp        → LIMIT N
//   - SelectOp       projection (FieldAccess / arithmetic / AliasExpr)
//   - DistinctOp     full-row dedup (no DISTINCT ON; portable across dialects)
//   - RollupOp       → GROUP BY + aggregates in projection
//   - AggregateOp    pipeline-terminal aggregate (e.g. `orders | sum(total)`)
//
// Supported aggregate functions: sum, avg, min, max, count, distinct_count.
// Anything else (median, stddev, percentile, vwap, sharpe, …) declines so
// the in-process engine handles them — those have no clean portable SQL
// translation across the dialects we care about.
//
// Operator-order rules:
//   - WhereOp must precede grouping (RollupOp / AggregateOp). After
//     grouping, "where" is HAVING — declined for now.
//   - SortOp / FirstOp accepted at any position; the SQL clauses are always
//     emitted at the end so they apply post-grouping when grouping exists.
//   - SelectOp / DistinctOp must come before grouping; grouping owns its
//     own projection.
//   - At most one grouping op (RollupOp xor AggregateOp).

import type {
  AggregateFnName,
  Expression,
  Operation,
  Pipeline,
} from '../../../../../src/engine/types.js';
import type { SqlDialect } from './dialect.js';

export interface CompiledPushdown {
  /** Parameterized SQL using the dialect's placeholder syntax. */
  sql: string;
  /** Values to bind, in order. */
  params: unknown[];
}

export type CompileResult =
  | { ok: true; compiled: CompiledPushdown }
  | { ok: false; reason: string };

interface CompilerCtx {
  /** Subquery wrapping the user-provided source query. */
  baseSelect: string;
  /** Running parameter array; mutated as we walk. */
  params: unknown[];
  /** Dialect for quoting + placeholder rendering. */
  dialect: SqlDialect;
}

const BINARY_OP_SQL: Record<string, string | undefined> = {
  '>': '>',
  '>=': '>=',
  '<': '<',
  '<=': '<=',
  '==': '=',
  '!=': '<>',
  '&&': 'AND',
  '||': 'OR',
  '+': '+',
  '-': '-',
  '*': '*',
  '/': '/',
  '%': '%',
};

/**
 * Aggregate functions we know how to translate to portable SQL. Both
 * Postgres and MySQL accept these identically — no per-dialect overrides
 * needed yet. The function takes the rendered argument SQL (or `null` for
 * the no-arg `count()` shape) and produces the call site.
 */
const SQL_AGGREGATE_FN: Partial<Record<AggregateFnName, (arg: string | null) => string>> = {
  sum: (arg) => `SUM(${arg ?? '*'})`,
  avg: (arg) => `AVG(${arg ?? '*'})`,
  min: (arg) => `MIN(${arg ?? '*'})`,
  max: (arg) => `MAX(${arg ?? '*'})`,
  count: (arg) => `COUNT(${arg ?? '*'})`,
  distinct_count: (arg) => `COUNT(DISTINCT ${arg ?? '*'})`,
};

export function compileForDialect(
  pipeline: Pipeline,
  baseQuery: string,
  dialect: SqlDialect,
): CompileResult {
  const ctx: CompilerCtx = {
    baseSelect: stripTrailingSemicolon(baseQuery),
    params: [],
    dialect,
  };

  let where: string | null = null;
  let orderBy: string | null = null;
  let limit: number | null = null;
  let selectClause: string | null = null;
  let distinctClause = false;
  let groupByClause: string | null = null;
  let grouped = false;

  for (const op of pipeline.operations) {
    switch (op.kind) {
      case 'WhereOp': {
        if (grouped) {
          return { ok: false, reason: 'where after grouping (HAVING) is not yet pushable' };
        }
        const compiled = compileExpr(op.condition, ctx);
        if (compiled === null) {
          return { ok: false, reason: 'where(): unsupported expression node' };
        }
        where = where ? `(${where}) AND (${compiled})` : compiled;
        break;
      }

      case 'SortOp': {
        const parts: string[] = [];
        for (const c of op.criteria) {
          if (c.expression.kind !== 'FieldAccess' || c.expression.path.length !== 1) {
            return { ok: false, reason: 'sort(): only single-field paths supported' };
          }
          const ident = ctx.dialect.quoteIdent(c.expression.path[0]);
          parts.push(`${ident} ${c.direction === 'desc' ? 'DESC' : 'ASC'}`);
        }
        orderBy = parts.join(', ');
        break;
      }

      case 'FirstOp': {
        limit = op.count;
        break;
      }

      case 'SelectOp': {
        if (grouped) {
          return { ok: false, reason: 'select after rollup is not yet pushable' };
        }
        if (selectClause !== null) {
          return { ok: false, reason: 'multiple select() ops in one pipeline' };
        }
        const parts: string[] = [];
        for (const f of op.fields) {
          const compiled = compileSelectField(f, ctx, false);
          if (compiled === null) {
            return { ok: false, reason: 'select(): unsupported field expression' };
          }
          parts.push(compiled);
        }
        selectClause = parts.join(', ');
        break;
      }

      case 'DistinctOp': {
        if (op.fields !== undefined && op.fields.length > 0) {
          return { ok: false, reason: 'distinct(field) is not yet pushable; full-row distinct works' };
        }
        if (grouped) {
          return { ok: false, reason: 'distinct after grouping is not yet pushable' };
        }
        distinctClause = true;
        break;
      }

      case 'RollupOp': {
        if (grouped) {
          return { ok: false, reason: 'multiple grouping ops (rollup/aggregate) in one pipeline' };
        }
        if (selectClause !== null) {
          return { ok: false, reason: 'rollup after select is not yet pushable' };
        }
        const keyParts: string[] = [];
        const groupByParts: string[] = [];
        for (const k of op.keys) {
          if (k.kind !== 'FieldAccess' || k.path.length !== 1) {
            return { ok: false, reason: 'rollup(): keys must be single-field paths' };
          }
          const ident = ctx.dialect.quoteIdent(k.path[0]);
          keyParts.push(ident);
          groupByParts.push(ident);
        }
        const aggParts: string[] = [];
        for (const a of op.aggregates) {
          const compiled = compileSelectField(a, ctx, true);
          if (compiled === null) {
            return { ok: false, reason: 'rollup(): unsupported aggregate expression' };
          }
          aggParts.push(compiled);
        }
        selectClause = [...keyParts, ...aggParts].join(', ');
        groupByClause = groupByParts.length > 0 ? groupByParts.join(', ') : null;
        grouped = true;
        break;
      }

      case 'AggregateOp': {
        if (grouped) {
          return { ok: false, reason: 'multiple grouping ops (rollup/aggregate) in one pipeline' };
        }
        if (selectClause !== null) {
          return { ok: false, reason: 'aggregate after select is not yet pushable' };
        }
        const fn = SQL_AGGREGATE_FN[op.function];
        if (!fn) {
          return { ok: false, reason: `aggregate "${op.function}" has no SQL push-down` };
        }
        if (op.args && op.args.length > 0) {
          return { ok: false, reason: `aggregate "${op.function}" with extra args is not yet pushable` };
        }
        const argSql = op.field === undefined ? null : compileExpr(op.field, ctx);
        if (op.field !== undefined && argSql === null) {
          return { ok: false, reason: `aggregate "${op.function}": unsupported argument expression` };
        }
        selectClause = `${fn(argSql)} AS ${ctx.dialect.quoteIdent(op.function)}`;
        grouped = true;
        break;
      }

      default:
        return { ok: false, reason: `${(op as Operation).kind}: not yet pushable` };
    }
  }

  let sql = `SELECT ${distinctClause ? 'DISTINCT ' : ''}${selectClause ?? '*'} FROM (${ctx.baseSelect}) AS pq_src`;
  if (where) sql += ` WHERE ${where}`;
  if (groupByClause) sql += ` GROUP BY ${groupByClause}`;
  if (orderBy) sql += ` ORDER BY ${orderBy}`;
  if (limit !== null) sql += ` LIMIT ${limit}`;

  return { ok: true, compiled: { sql, params: ctx.params } };
}

// ─── Expression compilers ───────────────────────────────────────────────────

function compileSelectField(expr: Expression, ctx: CompilerCtx, aggregateContext: boolean): string | null {
  if (expr.kind === 'AliasExpr') {
    const inner = compileSelectField(expr.expression, ctx, aggregateContext);
    if (inner === null) return null;
    return `${inner} AS ${ctx.dialect.quoteIdent(expr.alias)}`;
  }
  if (expr.kind === 'FunctionCall') {
    if (!aggregateContext) return null;
    return compileAggregateCall(expr.name, expr.args, ctx);
  }
  return compileExpr(expr, ctx);
}

function compileAggregateCall(name: string, args: Expression[], ctx: CompilerCtx): string | null {
  const fn = SQL_AGGREGATE_FN[name as AggregateFnName];
  if (!fn) return null;
  if (args.length === 0) return fn(null);
  if (args.length > 1) return null;
  const argSql = compileExpr(args[0], ctx);
  if (argSql === null) return null;
  return fn(argSql);
}

function compileExpr(expr: Expression, ctx: CompilerCtx): string | null {
  switch (expr.kind) {
    case 'NumberLiteral':
    case 'StringLiteral':
    case 'BooleanLiteral':
      return ctx.dialect.bindLiteral(expr.value, ctx.params);
    case 'NullLiteral':
      return 'NULL';
    case 'FieldAccess': {
      if (expr.path.length !== 1) return null;
      return ctx.dialect.quoteIdent(expr.path[0]);
    }
    case 'BinaryExpr': {
      const opSql = BINARY_OP_SQL[expr.operator];
      if (!opSql) return null;
      const left = compileExpr(expr.left, ctx);
      const right = compileExpr(expr.right, ctx);
      if (left === null || right === null) return null;

      // x = NULL never matches in either Postgres or MySQL; need
      // IS NULL / IS NOT NULL.
      if (expr.right.kind === 'NullLiteral') {
        if (expr.operator === '==') return `${left} IS NULL`;
        if (expr.operator === '!=') return `${left} IS NOT NULL`;
      }
      if (expr.left.kind === 'NullLiteral') {
        if (expr.operator === '==') return `${right} IS NULL`;
        if (expr.operator === '!=') return `${right} IS NOT NULL`;
      }

      return `(${left} ${opSql} ${right})`;
    }
    case 'UnaryExpr': {
      const operand = compileExpr(expr.operand, ctx);
      if (operand === null) return null;
      if (expr.operator === '!') return `(NOT ${operand})`;
      if (expr.operator === '-') return `(-${operand})`;
      return null;
    }
    case 'FunctionCall':
    case 'AliasExpr':
      return null;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function stripTrailingSemicolon(sql: string): string {
  return sql.trim().replace(/;+\s*$/, '');
}

const PUSHABLE_OPS: ReadonlySet<Operation['kind']> = new Set([
  'WhereOp',
  'SortOp',
  'FirstOp',
  'SelectOp',
  'DistinctOp',
  'RollupOp',
  'AggregateOp',
]);

/** Convenience helper: does the pipeline only contain operators we *might*
 *  push down? Doesn't validate expression nodes. */
export function isPushableShape(pipeline: Pipeline): boolean {
  return pipeline.operations.every((op) => PUSHABLE_OPS.has(op.kind));
}
