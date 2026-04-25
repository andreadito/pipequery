// Pipe-AST → Postgres SQL compiler (push-down prototype).
//
// Translates a Pipeline AST whose source is a single Postgres-backed source
// into a parameterized Postgres query. The compiler is intentionally
// conservative — it returns `{ ok: false, reason }` for anything it doesn't
// understand, and the caller is expected to fall back to the in-process
// engine in that case.
//
// Supported operators (v1 prototype):
//   - WhereOp with BinaryExpr / UnaryExpr / FieldAccess / literals
//   - SortOp where each criterion's expression is a FieldAccess
//   - FirstOp (becomes LIMIT N)
//
// Not yet supported (forces fallback): SelectOp, GroupByOp, RollupOp, MapOp,
// JoinOp, FlattenOp, TransposeOp, DistinctOp, PivotOp, ReduceOp, FunctionCall
// expressions, multi-segment FieldAccess (JSON path), AliasExpr.

import type {
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
 * Compile a Pipeline targeting a Postgres source into a single SELECT.
 *
 * `baseQuery` is the SQL the user configured in their source (e.g.
 * `SELECT * FROM orders`); we wrap it in a subquery and apply WHERE / ORDER BY
 * / LIMIT around it. This means we don't need to parse the user's SQL — we
 * just push the pipe operators against its result set, which a competent
 * Postgres planner will fold back into the underlying scan in most cases.
 */
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

  for (const op of pipeline.operations) {
    switch (op.kind) {
      case 'WhereOp': {
        const compiled = compileExpr(op.condition, ctx);
        if (compiled === null) {
          return { ok: false, reason: `where(): unsupported expression node` };
        }
        where = where ? `(${where}) AND (${compiled})` : compiled;
        break;
      }
      case 'SortOp': {
        const parts: string[] = [];
        for (const c of op.criteria) {
          if (c.expression.kind !== 'FieldAccess' || c.expression.path.length !== 1) {
            return { ok: false, reason: `sort(): only single-field paths supported in pushdown v1` };
          }
          const ident = quoteIdent(c.expression.path[0]);
          parts.push(`${ident} ${c.direction === 'desc' ? 'DESC' : 'ASC'}`);
        }
        orderBy = parts.join(', ');
        break;
      }
      case 'FirstOp': {
        limit = op.count;
        break;
      }
      default:
        return { ok: false, reason: `${op.kind}: not yet pushable; falls back to in-process engine` };
    }
  }

  let sql = `SELECT * FROM (${ctx.baseSelect}) AS pq_src`;
  if (where) sql += ` WHERE ${where}`;
  if (orderBy) sql += ` ORDER BY ${orderBy}`;
  if (limit !== null) sql += ` LIMIT ${limit}`;

  return { ok: true, compiled: { sql, params: ctx.params } };
}

// ─── Expression compiler ────────────────────────────────────────────────────

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
      // Single-segment field becomes a quoted identifier. Multi-segment paths
      // (JSON descent) aren't supported in v1 — fall back to in-process.
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
      // Future work — would require per-function translation tables and
      // alias-aware projection. Fall back to in-process for now.
      return null;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function quoteIdent(name: string): string {
  // Postgres double-quoted identifier; embedded quotes are doubled.
  return `"${name.replace(/"/g, '""')}"`;
}

function stripTrailingSemicolon(sql: string): string {
  return sql.trim().replace(/;+\s*$/, '');
}

/** Convenience helper used by tests / the adapter to skip work when the AST
 *  contains nothing pushable. */
export function isPushableShape(pipeline: Pipeline): boolean {
  return pipeline.operations.every(
    (op: Operation) => op.kind === 'WhereOp' || op.kind === 'SortOp' || op.kind === 'FirstOp',
  );
}
