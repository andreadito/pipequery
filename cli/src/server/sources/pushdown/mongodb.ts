// Pipe-AST → MongoDB query/aggregation compiler.
//
// Mongo isn't SQL, so this lives outside the dialect-parametric
// compileForDialect. The translator emits one of two shapes:
//
//   1. A simple `find()` plan when the pipeline has only WhereOp / SortOp /
//      FirstOp / SelectOp. This is the cheap path — Mongo's find indexes
//      can be used directly.
//
//   2. An `aggregate()` pipeline when grouping (RollupOp / AggregateOp) is
//      present. We fall back to aggregate even for small adjustments like
//      `select` ahead of grouping because the projection-then-group flow
//      maps cleanly to `$project` + `$group`.
//
// Operator set (parity with the SQL compilers where it makes sense):
//   - WhereOp        → $match (BinaryExpr, UnaryExpr, FieldAccess, literals)
//   - SortOp         → $sort  (single-field paths)
//   - FirstOp        → $limit / find().limit()
//   - SelectOp       → $project / find() projection
//   - DistinctOp     no DISTINCT keyword in mongo — full-row dedup is
//                    expressed via $group on $$ROOT and $first; declined
//                    for v1, in-process handles it
//   - RollupOp       → $group + projection
//   - AggregateOp    pipeline-terminal aggregate → $group with one accumulator
//
// Aggregate functions translated: sum, avg, min, max, count, distinct_count.
// (Same set as the SQL compilers; everything exotic falls back to in-process.)

import type {
  AggregateFnName,
  Expression,
  Operation,
  Pipeline,
} from '../../../../../src/engine/types.js';

export type MongoPlan =
  | { kind: 'find'; filter: Record<string, unknown>; sort?: Record<string, 1 | -1>; limit?: number; projection?: Record<string, 0 | 1 | string | { $expr?: unknown }> }
  | { kind: 'aggregate'; pipeline: Record<string, unknown>[] };

export type CompileResult =
  | { ok: true; compiled: MongoPlan }
  | { ok: false; reason: string };

// MongoDB comparison operators keyed by pipequery operator.
const CMP_TO_MONGO: Record<string, string | undefined> = {
  '>': '$gt',
  '>=': '$gte',
  '<': '$lt',
  '<=': '$lte',
  '==': '$eq',
  '!=': '$ne',
};

// Aggregate-function → Mongo $group accumulator.
const MONGO_AGGREGATE_FN: Partial<Record<AggregateFnName, (arg: string | null) => Record<string, unknown>>> = {
  sum: (arg) => ({ $sum: arg ?? 1 }),                      // sum(*) → $sum: 1 (count rows)
  avg: (arg) => ({ $avg: arg ?? null }),
  min: (arg) => ({ $min: arg ?? null }),
  max: (arg) => ({ $max: arg ?? null }),
  count: () => ({ $sum: 1 }),                              // count(*) — Mongo idiom
  distinct_count: (arg) => ({ $addToSet: arg ?? null }),   // size taken in $project
};

export function compileMongoPushdown(
  pipeline: Pipeline,
  defaultFilter: Record<string, unknown> | undefined,
): CompileResult {
  // Two-pass: first decide whether we need find() or aggregate(), then emit.
  let needsAggregate = false;
  for (const op of pipeline.operations) {
    if (op.kind === 'RollupOp' || op.kind === 'AggregateOp') needsAggregate = true;
    if (op.kind === 'DistinctOp') {
      return { ok: false, reason: 'mongo distinct() is not yet pushable; in-process handles it' };
    }
    if (
      op.kind !== 'WhereOp' &&
      op.kind !== 'SortOp' &&
      op.kind !== 'FirstOp' &&
      op.kind !== 'SelectOp' &&
      op.kind !== 'RollupOp' &&
      op.kind !== 'AggregateOp'
    ) {
      return { ok: false, reason: `${(op as Operation).kind}: not yet pushable to mongo` };
    }
  }

  return needsAggregate
    ? compileAggregatePipeline(pipeline, defaultFilter)
    : compileFindPlan(pipeline, defaultFilter);
}

// ─── find() path ────────────────────────────────────────────────────────────

function compileFindPlan(
  pipeline: Pipeline,
  defaultFilter: Record<string, unknown> | undefined,
): CompileResult {
  let filter: Record<string, unknown> | null = null;
  let sort: Record<string, 1 | -1> | undefined;
  let limit: number | undefined;
  let projection: Record<string, 1> | undefined;

  for (const op of pipeline.operations) {
    if (op.kind === 'WhereOp') {
      const compiled = compileFilter(op.condition);
      if (compiled === null) {
        return { ok: false, reason: 'where(): unsupported expression node' };
      }
      filter = filter ? { $and: [filter, compiled] } : compiled;
    } else if (op.kind === 'SortOp') {
      sort = {};
      for (const c of op.criteria) {
        if (c.expression.kind !== 'FieldAccess' || c.expression.path.length !== 1) {
          return { ok: false, reason: 'sort(): only single-field paths supported' };
        }
        sort[c.expression.path[0]] = c.direction === 'desc' ? -1 : 1;
      }
    } else if (op.kind === 'FirstOp') {
      limit = op.count;
    } else if (op.kind === 'SelectOp') {
      projection = {};
      for (const f of op.fields) {
        if (f.kind === 'FieldAccess' && f.path.length === 1) {
          projection[f.path[0]] = 1;
        } else if (f.kind === 'AliasExpr' && f.expression.kind === 'FieldAccess' && f.expression.path.length === 1) {
          // Mongo doesn't rename via projection in find() (it does in aggregate).
          // Decline mid-pipe so aggregate path picks it up; but if it's only
          // a select with bare-field aliases we could project both… simplest:
          // decline and let aggregate handle alias renaming.
          return { ok: false, reason: 'select() with alias requires aggregate path' };
        } else {
          return { ok: false, reason: 'select(): only bare field projections in find() path' };
        }
      }
      // Mongo find() always returns _id unless explicitly excluded; suppress
      // it so the result row shape matches what users expect from select().
      (projection as Record<string, 0 | 1>)._id = 0;
    }
  }

  const finalFilter = mergeFilters(defaultFilter, filter ?? undefined);
  return {
    ok: true,
    compiled: {
      kind: 'find',
      filter: finalFilter,
      ...(sort ? { sort } : {}),
      ...(limit !== undefined ? { limit } : {}),
      ...(projection ? { projection } : {}),
    },
  };
}

// ─── aggregate() path ───────────────────────────────────────────────────────

function compileAggregatePipeline(
  pipeline: Pipeline,
  defaultFilter: Record<string, unknown> | undefined,
): CompileResult {
  const stages: Record<string, unknown>[] = [];

  // Default filter (from yaml) becomes the first $match stage so polled
  // results are consistent across the find() and aggregate() paths.
  if (defaultFilter && Object.keys(defaultFilter).length > 0) {
    stages.push({ $match: { ...defaultFilter } });
  }

  let grouped = false;
  let postGroupProjection: Record<string, unknown> | null = null;

  for (const op of pipeline.operations) {
    switch (op.kind) {
      case 'WhereOp': {
        if (grouped) {
          return { ok: false, reason: 'where after grouping (HAVING) is not yet pushable' };
        }
        const compiled = compileFilter(op.condition);
        if (compiled === null) {
          return { ok: false, reason: 'where(): unsupported expression node' };
        }
        stages.push({ $match: compiled });
        break;
      }
      case 'SortOp': {
        const sortStage: Record<string, 1 | -1> = {};
        for (const c of op.criteria) {
          if (c.expression.kind !== 'FieldAccess' || c.expression.path.length !== 1) {
            return { ok: false, reason: 'sort(): only single-field paths supported' };
          }
          sortStage[c.expression.path[0]] = c.direction === 'desc' ? -1 : 1;
        }
        stages.push({ $sort: sortStage });
        break;
      }
      case 'FirstOp': {
        stages.push({ $limit: op.count });
        break;
      }
      case 'SelectOp': {
        if (grouped) {
          return { ok: false, reason: 'select after rollup is not yet pushable' };
        }
        const proj: Record<string, unknown> = { _id: 0 };
        for (const f of op.fields) {
          if (f.kind === 'FieldAccess' && f.path.length === 1) {
            proj[f.path[0]] = 1;
          } else if (f.kind === 'AliasExpr' && f.expression.kind === 'FieldAccess' && f.expression.path.length === 1) {
            proj[f.alias] = `$${f.expression.path[0]}`;
          } else {
            return { ok: false, reason: 'select(): unsupported field expression in mongo' };
          }
        }
        stages.push({ $project: proj });
        break;
      }
      case 'RollupOp': {
        if (grouped) {
          return { ok: false, reason: 'multiple grouping ops in one pipeline' };
        }
        const groupIdResult = compileGroupId(op.keys);
        if (!groupIdResult.ok) {
          return { ok: false, reason: 'rollup(): keys must be single-field paths' };
        }
        const groupStage: Record<string, unknown> = { _id: groupIdResult.value };
        const distinctCountAliases: string[] = [];

        for (const a of op.aggregates) {
          // Aggregates may be wrapped in AliasExpr (e.g. `sum(amount) as total`)
          // or bare (e.g. `sum(amount)`).
          const alias = a.kind === 'AliasExpr' ? a.alias : null;
          const inner = a.kind === 'AliasExpr' ? a.expression : a;
          if (inner.kind !== 'FunctionCall') {
            return { ok: false, reason: 'rollup(): aggregate must be a function call' };
          }
          const fn = MONGO_AGGREGATE_FN[inner.name as AggregateFnName];
          if (!fn) {
            return { ok: false, reason: `aggregate "${inner.name}" has no mongo push-down` };
          }
          let argRef: string | null = null;
          if (inner.args.length === 1) {
            const arg = inner.args[0];
            if (arg.kind !== 'FieldAccess' || arg.path.length !== 1) {
              return { ok: false, reason: 'rollup(): aggregate argument must be a single-field path' };
            }
            argRef = `$${arg.path[0]}`;
          } else if (inner.args.length > 1) {
            return { ok: false, reason: `aggregate "${inner.name}" with extra args not yet pushable` };
          }
          const fieldName = alias ?? inner.name;
          groupStage[fieldName] = fn(argRef);
          if (inner.name === 'distinct_count') {
            distinctCountAliases.push(fieldName);
          }
        }

        stages.push({ $group: groupStage });

        // distinct_count produces a Set in the $group stage; convert to a
        // count via a follow-up $project. Other accumulators are scalar
        // already and pass through unchanged.
        const projAfterGroup: Record<string, unknown> = {
          _id: 0,
        };
        // Spread group keys into top-level fields so callers see
        // `{ country: ..., total: ... }` instead of `{ _id: { country: ... }, total: ... }`.
        if (op.keys.length === 1) {
          const k = op.keys[0];
          if (k.kind === 'FieldAccess' && k.path.length === 1) {
            projAfterGroup[k.path[0]] = '$_id';
          }
        } else {
          for (const k of op.keys) {
            if (k.kind === 'FieldAccess' && k.path.length === 1) {
              projAfterGroup[k.path[0]] = `$_id.${k.path[0]}`;
            }
          }
        }
        for (const key of Object.keys(groupStage)) {
          if (key === '_id') continue;
          if (distinctCountAliases.includes(key)) {
            projAfterGroup[key] = { $size: `$${key}` };
          } else {
            projAfterGroup[key] = `$${key}`;
          }
        }
        postGroupProjection = projAfterGroup;
        grouped = true;
        break;
      }
      case 'AggregateOp': {
        if (grouped) {
          return { ok: false, reason: 'multiple grouping ops in one pipeline' };
        }
        const fn = MONGO_AGGREGATE_FN[op.function];
        if (!fn) {
          return { ok: false, reason: `aggregate "${op.function}" has no mongo push-down` };
        }
        if (op.args && op.args.length > 0) {
          return { ok: false, reason: `aggregate "${op.function}" with extra args not yet pushable` };
        }
        let argRef: string | null = null;
        if (op.field !== undefined) {
          if (op.field.kind !== 'FieldAccess' || op.field.path.length !== 1) {
            return { ok: false, reason: `aggregate "${op.function}": unsupported argument expression` };
          }
          argRef = `$${op.field.path[0]}`;
        }
        const groupStage: Record<string, unknown> = { _id: null, [op.function]: fn(argRef) };
        stages.push({ $group: groupStage });
        const proj: Record<string, unknown> = { _id: 0, [op.function]: `$${op.function}` };
        if (op.function === 'distinct_count') {
          proj[op.function] = { $size: `$${op.function}` };
        }
        postGroupProjection = proj;
        grouped = true;
        break;
      }
      default:
        return { ok: false, reason: `${op.kind}: not yet pushable to mongo` };
    }
  }

  if (postGroupProjection) stages.push({ $project: postGroupProjection });

  return { ok: true, compiled: { kind: 'aggregate', pipeline: stages } };
}

// ─── Filter / expression compiler ───────────────────────────────────────────

function compileFilter(expr: Expression): Record<string, unknown> | null {
  switch (expr.kind) {
    case 'BinaryExpr': {
      if (expr.operator === '&&') {
        const left = compileFilter(expr.left);
        const right = compileFilter(expr.right);
        if (left === null || right === null) return null;
        return { $and: [left, right] };
      }
      if (expr.operator === '||') {
        const left = compileFilter(expr.left);
        const right = compileFilter(expr.right);
        if (left === null || right === null) return null;
        return { $or: [left, right] };
      }
      // Comparison: must be FieldAccess <op> literal (or NULL).
      const cmp = CMP_TO_MONGO[expr.operator];
      if (!cmp) return null;

      // x == null / x != null have special handling.
      if (expr.right.kind === 'NullLiteral') {
        if (expr.operator === '==') return field(expr.left, { $eq: null });
        if (expr.operator === '!=') return field(expr.left, { $ne: null });
      }
      if (expr.left.kind === 'NullLiteral') {
        if (expr.operator === '==') return field(expr.right, { $eq: null });
        if (expr.operator === '!=') return field(expr.right, { $ne: null });
      }

      // FieldAccess <op> literal.
      const lit = literalValue(expr.right);
      if (expr.left.kind === 'FieldAccess' && lit.ok) {
        return field(expr.left, { [cmp]: lit.value });
      }
      const litLeft = literalValue(expr.left);
      if (expr.right.kind === 'FieldAccess' && litLeft.ok) {
        // Reverse: pipequery `100 < amount` → mongo `amount > 100`.
        const reversed = REVERSE_CMP[expr.operator] ?? expr.operator;
        const reverseCmp = CMP_TO_MONGO[reversed];
        if (!reverseCmp) return null;
        return field(expr.right, { [reverseCmp]: litLeft.value });
      }
      return null;
    }
    case 'UnaryExpr': {
      if (expr.operator === '!') {
        const inner = compileFilter(expr.operand);
        if (inner === null) return null;
        return { $nor: [inner] };
      }
      return null;
    }
    default:
      return null;
  }
}

const REVERSE_CMP: Record<string, string> = {
  '>': '<',
  '>=': '<=',
  '<': '>',
  '<=': '>=',
  '==': '==',
  '!=': '!=',
};

function field(expr: Expression, condition: Record<string, unknown>): Record<string, unknown> | null {
  if (expr.kind !== 'FieldAccess' || expr.path.length !== 1) return null;
  return { [expr.path[0]]: condition };
}

function literalValue(expr: Expression): { ok: true; value: unknown } | { ok: false } {
  switch (expr.kind) {
    case 'NumberLiteral':
    case 'StringLiteral':
    case 'BooleanLiteral':
      return { ok: true, value: expr.value };
    case 'NullLiteral':
      return { ok: true, value: null };
    default:
      return { ok: false };
  }
}

/**
 * Compile rollup keys into the `_id` value for `$group`.
 *
 * Returns:
 *   - `{ ok: true, value: null }`     for `rollup(sum(...))` (no keys)
 *   - `{ ok: true, value: '$field' }` for `rollup(field, ...)` (one key)
 *   - `{ ok: true, value: { ... } }`  for `rollup(k1, k2, ...)` (multiple)
 *   - `{ ok: false }`                 for non-field-access keys (caller declines)
 *
 * `null` is a valid Mongo group _id — it means "group everything into one
 * bucket" — so it can't be used as the failure sentinel.
 */
function compileGroupId(keys: Expression[]):
  | { ok: true; value: null | string | Record<string, string> }
  | { ok: false } {
  if (keys.length === 0) return { ok: true, value: null };
  if (keys.length === 1) {
    const k = keys[0];
    if (k.kind !== 'FieldAccess' || k.path.length !== 1) return { ok: false };
    return { ok: true, value: `$${k.path[0]}` };
  }
  const obj: Record<string, string> = {};
  for (const k of keys) {
    if (k.kind !== 'FieldAccess' || k.path.length !== 1) return { ok: false };
    obj[k.path[0]] = `$${k.path[0]}`;
  }
  return { ok: true, value: obj };
}

function mergeFilters(
  base: Record<string, unknown> | undefined,
  added: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!base || Object.keys(base).length === 0) return added ?? {};
  if (!added || Object.keys(added).length === 0) return { ...base };
  return { $and: [{ ...base }, { ...added }] };
}
