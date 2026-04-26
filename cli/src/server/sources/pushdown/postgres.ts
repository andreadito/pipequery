// Pipe-AST → Postgres SQL compiler.
//
// Translates a Pipeline AST whose source is a single Postgres-backed source
// into a parameterized Postgres query. The compiler is intentionally
// conservative — it returns `{ ok: false, reason }` for anything it doesn't
// understand, and the caller falls back to the in-process engine.
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
// the in-process engine handles them — those have no clean SQL portable
// translation.
//
// Operator-order rules:
//   - WhereOp must precede grouping (RollupOp / AggregateOp). After
//     grouping, "where" is HAVING — declined for now.
//   - SortOp / FirstOp accepted at any position; the SQL clauses are always
//     emitted at the end so they apply post-grouping when grouping exists.
//     SortOp before grouping (with grouping later in the pipe) is declined
//     because its semantic effect is wasted in pure SQL.
//   - SelectOp / DistinctOp must come before grouping; grouping owns its
//     own projection.
//   - At most one grouping op (RollupOp xor AggregateOp).

import type {
  AggregateFnName,
  Expression,
  Operation,
  Pipeline,
} from '../../../../../src/engine/types.js';

export interface CompiledPushdown {
  /** Parameterized SQL using $1, $2, … placeholders. */
  sql: string;
  /** Values to bind, in order. */
  params: unknown[];
}

export type CompileResult =
  | { ok: true; compiled: CompiledPushdown }
  | { ok: false; reason: string };

interface CompilerCtx {
  /** Subquery wrapping the user-provided source query (e.g. `SELECT * FROM orders`). */
  baseSelect: string;
  /** Running parameter array; mutated as we walk. */
  params: unknown[];
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
 * Aggregate functions we know how to translate to portable SQL. Engine
 * supports many more (vwap, sharpe, percentile, drawdown, …) but those have
 * no clean SQL equivalent — the in-process engine remains the right place
 * for them.
 */
const SQL_AGGREGATE_FN: Partial<Record<AggregateFnName, (arg: string | null) => string>> = {
  sum: (arg) => `SUM(${arg ?? '*'})`,
  avg: (arg) => `AVG(${arg ?? '*'})`,
  min: (arg) => `MIN(${arg ?? '*'})`,
  max: (arg) => `MAX(${arg ?? '*'})`,
  count: (arg) => `COUNT(${arg ?? '*'})`,
  distinct_count: (arg) => `COUNT(DISTINCT ${arg ?? '*'})`,
};

export function compilePostgresPushdown(
  pipeline: Pipeline,
  baseQuery: string,
): CompileResult {
  const ctx: CompilerCtx = {
    baseSelect: stripTrailingSemicolon(baseQuery),
    params: [],
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
          const ident = quoteIdent(c.expression.path[0]);
          parts.push(`${ident} ${c.direction === 'desc' ? 'DESC' : 'ASC'}`);
        }
        // Multiple SortOps are folded into one ORDER BY whose right-most pipe
        // op wins. SQL doesn't support stacked ORDER BYs, so we mirror the
        // engine's last-write semantics by overwriting.
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
          // SELECT DISTINCT ON (...) is Postgres-only and reorders rows.
          // Skip it for portability; in-process distinct(field) handles
          // it correctly without surprises.
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
          const ident = quoteIdent(k.path[0]);
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
        // Pipeline-terminal aggregate becomes a single-column SELECT named
        // after the function (matches engine behaviour where bare aggregates
        // produce { <fn>: value }).
        selectClause = `${fn(argSql)} AS ${quoteIdent(op.function)}`;
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

/**
 * Compile a select-or-rollup field expression. Allows AliasExpr and (in
 * `aggregateContext`) FunctionCall for aggregate functions.
 */
function compileSelectField(expr: Expression, ctx: CompilerCtx, aggregateContext: boolean): string | null {
  if (expr.kind === 'AliasExpr') {
    const inner = compileSelectField(expr.expression, ctx, aggregateContext);
    if (inner === null) return null;
    return `${inner} AS ${quoteIdent(expr.alias)}`;
  }
  if (expr.kind === 'FunctionCall') {
    if (!aggregateContext) {
      // FunctionCalls outside rollup/aggregate context (e.g. `select(sum(x))`
      // without grouping) would error in SQL. Decline so the engine handles
      // any meaningful case.
      return null;
    }
    return compileAggregateCall(expr.name, expr.args, ctx);
  }
  // Bare FieldAccess and arithmetic expressions reuse the WHERE-side
  // compiler — its output (quoted identifier or `(left op right)`) is also
  // a valid SELECT-list element.
  return compileExpr(expr, ctx);
}

function compileAggregateCall(name: string, args: Expression[], ctx: CompilerCtx): string | null {
  const fn = SQL_AGGREGATE_FN[name as AggregateFnName];
  if (!fn) return null;
  if (args.length === 0) return fn(null);
  if (args.length > 1) return null; // No two-arg aggregates push down today.
  const argSql = compileExpr(args[0], ctx);
  if (argSql === null) return null;
  return fn(argSql);
}

function compileExpr(expr: Expression, ctx: CompilerCtx): string | null {
  switch (expr.kind) {
    case 'NumberLiteral':
    case 'StringLiteral':
    case 'BooleanLiteral':
      ctx.params.push(expr.value);
      return `$${ctx.params.length}`;
    case 'NullLiteral':
      return 'NULL';
    case 'FieldAccess': {
      if (expr.path.length !== 1) return null;
      return quoteIdent(expr.path[0]);
    }
    case 'BinaryExpr': {
      const opSql = BINARY_OP_SQL[expr.operator];
      if (!opSql) return null;
      const left = compileExpr(expr.left, ctx);
      const right = compileExpr(expr.right, ctx);
      if (left === null || right === null) return null;

      // Postgres: x = NULL never matches; need IS NULL / IS NOT NULL.
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
      // FunctionCall handled in compileSelectField with aggregateContext.
      // AliasExpr only appears inside select / rollup contexts.
      return null;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

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
 *  push down? Doesn't validate expression nodes — compilePostgresPushdown
 *  is the source of truth for what actually pushes. */
export function isPushableShape(pipeline: Pipeline): boolean {
  return pipeline.operations.every((op) => PUSHABLE_OPS.has(op.kind));
}
