import type {
  Pipeline,
  Expression,
  Operation,
  CompiledQuery,
  DataContext,
  RowData,
  AliasExpr,
  FieldAccess,
  FunctionCall,
  SelectOp,
} from './types';
import { RuntimeError, AGGREGATE_NAMES } from './types';
import {
  getFieldAccessor,
  compareValues,
  groupByFn,
  nestedLoopJoin,
  hashJoin,
  distinctFn,
  transposeFn,
  rollupFn,
  pivotFlatFn,
  pivotGroupedFn,
  computeWindowValues,
} from './runtime';
import type { WindowDef } from './runtime';

type ExprFn = (row: RowData) => unknown;
type OpFn = (data: RowData[], context: DataContext) => unknown;

// ─── Aggregate Math Helpers ──────────────────────────────────────────────────

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function computePercentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function computeVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
}

function computeStddev(values: number[]): number {
  return Math.sqrt(computeVariance(values));
}

function computeSkew(values: number[]): number {
  const n = values.length;
  if (n < 3) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = computeStddev(values);
  if (sd === 0) return 0;
  return values.reduce((acc, v) => acc + ((v - mean) / sd) ** 3, 0) / n;
}

function computeKurt(values: number[]): number {
  const n = values.length;
  if (n < 4) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = computeStddev(values);
  if (sd === 0) return 0;
  return values.reduce((acc, v) => acc + ((v - mean) / sd) ** 4, 0) / n - 3;
}

function computeDrawdown(values: number[]): number {
  if (values.length === 0) return 0;
  let peak = values[0];
  let maxDd = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = peak === 0 ? 0 : (v - peak) / peak;
    if (dd < maxDd) maxDd = dd;
  }
  return maxDd;
}

function computeDownsideDeviation(values: number[], target: number = 0): number {
  if (values.length === 0) return 0;
  const downside = values.filter(v => v < target).map(v => (v - target) ** 2);
  if (downside.length === 0) return 0;
  return Math.sqrt(downside.reduce((a, b) => a + b, 0) / values.length);
}

// ─── Expression Compiler ─────────────────────────────────────────────────────

const WINDOW_FUNCTION_NAMES = new Set([
  'running_sum', 'running_avg', 'running_count',
  'running_min', 'running_max',
  'row_number', 'lag', 'lead',
]);

let windowIdCounter = 0;

function compileExpression(expr: Expression, grouped: boolean = false): ExprFn {
  switch (expr.kind) {
    case 'NumberLiteral': {
      const v = expr.value;
      return () => v;
    }
    case 'StringLiteral': {
      const v = expr.value;
      return () => v;
    }
    case 'BooleanLiteral': {
      const v = expr.value;
      return () => v;
    }
    case 'NullLiteral':
      return () => null;

    case 'FieldAccess': {
      const accessor = getFieldAccessor(expr.path);
      return accessor;
    }

    case 'BinaryExpr': {
      const leftFn = compileExpression(expr.left, grouped);
      const rightFn = compileExpression(expr.right, grouped);
      const op = expr.operator;
      switch (op) {
        case '>':  return (row) => (leftFn(row) as number) > (rightFn(row) as number);
        case '>=': return (row) => (leftFn(row) as number) >= (rightFn(row) as number);
        case '<':  return (row) => (leftFn(row) as number) < (rightFn(row) as number);
        case '<=': return (row) => (leftFn(row) as number) <= (rightFn(row) as number);
        case '==': return (row) => leftFn(row) === rightFn(row);
        case '!=': return (row) => leftFn(row) !== rightFn(row);
        case '&&': return (row) => leftFn(row) && rightFn(row);
        case '||': return (row) => leftFn(row) || rightFn(row);
        case '+':  return (row) => (leftFn(row) as number) + (rightFn(row) as number);
        case '-':  return (row) => (leftFn(row) as number) - (rightFn(row) as number);
        case '*':  return (row) => (leftFn(row) as number) * (rightFn(row) as number);
        case '/':  return (row) => (leftFn(row) as number) / (rightFn(row) as number);
        case '%':  return (row) => (leftFn(row) as number) % (rightFn(row) as number);
      }
      break;
    }

    case 'UnaryExpr': {
      const operandFn = compileExpression(expr.operand, grouped);
      if (expr.operator === '!') return (row) => !operandFn(row);
      return (row) => -(operandFn(row) as number);
    }

    case 'FunctionCall':
      return compileFunctionCall(expr, grouped);

    case 'AliasExpr':
      return compileExpression(expr.expression, grouped);
  }

  throw new RuntimeError(`Unknown expression kind: ${(expr as Expression).kind}`);
}

function compileFunctionCall(expr: FunctionCall, grouped: boolean): ExprFn {
  const { name, args } = expr;

  // Aggregate functions in grouped context
  if (grouped && AGGREGATE_NAMES.has(name)) {
    return compileGroupAggregate(name, args);
  }

  // Window functions — return closure that reads pre-computed values from _windowCtx
  if (WINDOW_FUNCTION_NAMES.has(name)) {
    const id = `_w${windowIdCounter++}`;
    const fieldFn = args.length > 0 ? compileExpression(args[0], false) : undefined;
    const offset = args.length > 1 ? (args[1] as { kind: string; value: number }).value || 1 : 1;
    const fn = ((row: RowData) => {
      const ctx = row._windowCtx as Record<string, unknown> | undefined;
      return ctx?.[id];
    }) as ExprFn & { _windowDef: WindowDef };
    fn._windowDef = { id, name, fieldFn, offset };
    return fn;
  }

  // Built-in functions
  switch (name) {
    case 'if': {
      if (args.length < 2 || args.length > 3) {
        throw new RuntimeError(`if() expects 2 or 3 arguments, got ${args.length}`);
      }
      const condFn = compileExpression(args[0], grouped);
      const thenFn = compileExpression(args[1], grouped);
      const elseFn = args.length === 3 ? compileExpression(args[2], grouped) : () => null;
      return (row) => condFn(row) ? thenFn(row) : elseFn(row);
    }

    case 'coalesce': {
      const fns = args.map((a) => compileExpression(a, grouped));
      return (row) => {
        for (const fn of fns) {
          const val = fn(row);
          if (val != null) return val;
        }
        return null;
      };
    }

    case 'lower': {
      const fn = compileExpression(args[0], grouped);
      return (row) => String(fn(row)).toLowerCase();
    }

    case 'upper': {
      const fn = compileExpression(args[0], grouped);
      return (row) => String(fn(row)).toUpperCase();
    }

    case 'len': {
      const fn = compileExpression(args[0], grouped);
      return (row) => {
        const val = fn(row);
        if (Array.isArray(val)) return val.length;
        if (typeof val === 'string') return val.length;
        return 0;
      };
    }

    case 'abs': {
      const fn = compileExpression(args[0], grouped);
      return (row) => Math.abs(fn(row) as number);
    }

    case 'round': {
      const fn = compileExpression(args[0], grouped);
      const precFn = args.length > 1 ? compileExpression(args[1], grouped) : () => 0;
      return (row) => {
        const val = fn(row) as number;
        const prec = precFn(row) as number;
        const factor = Math.pow(10, prec);
        return Math.round(val * factor) / factor;
      };
    }

    case 'concat': {
      const fns = args.map((a) => compileExpression(a, grouped));
      return (row) => fns.map((fn) => String(fn(row))).join('');
    }

    // Non-grouped aggregates used as functions return NaN or undefined — they're
    // only meaningful as pipeline-level AggregateOps or in grouped selects
    default:
      throw new RuntimeError(`Unknown function: ${name}`);
  }
}

function compileGroupAggregate(name: string, args: Expression[]): ExprFn {
  const fieldFn = args.length > 0 ? compileExpression(args[0], false) : undefined;
  const secondFn = args.length > 1 ? compileExpression(args[1], false) : undefined;

  const extractValues = (row: RowData): number[] =>
    ((row as RowData)._group as RowData[]).map(r => Number(fieldFn!(r)));

  switch (name) {
    // ── Core ───────────────────────────────────────────────
    case 'sum':
      return (row) => {
        const group = (row as RowData)._group as RowData[];
        return group.reduce((acc, r) => acc + Number(fieldFn!(r)), 0);
      };
    case 'avg':
      return (row) => {
        const group = (row as RowData)._group as RowData[];
        if (group.length === 0) return 0;
        const total = group.reduce((acc, r) => acc + Number(fieldFn!(r)), 0);
        return total / group.length;
      };
    case 'min':
      return (row) => {
        const group = (row as RowData)._group as RowData[];
        if (group.length === 0) return null;
        return group.reduce((min, r) => {
          const val = fieldFn!(r) as number;
          return val < (min as number) ? val : min;
        }, fieldFn!(group[0]));
      };
    case 'max':
      return (row) => {
        const group = (row as RowData)._group as RowData[];
        if (group.length === 0) return null;
        return group.reduce((max, r) => {
          const val = fieldFn!(r) as number;
          return val > (max as number) ? val : max;
        }, fieldFn!(group[0]));
      };
    case 'count':
      return (row) => {
        const group = (row as RowData)._group as RowData[];
        return group.length;
      };

    // ── Statistical ───────────────────────────────────────
    case 'median':
      return (row) => computeMedian(extractValues(row));
    case 'stddev':
      return (row) => computeStddev(extractValues(row));
    case 'var':
      return (row) => computeVariance(extractValues(row));
    case 'percentile':
      return (row) => computePercentile(extractValues(row), Number(secondFn!(row)));
    case 'skew':
      return (row) => computeSkew(extractValues(row));
    case 'kurt':
      return (row) => computeKurt(extractValues(row));

    // ── Finance ───────────────────────────────────────────
    case 'vwap':
      return (row) => {
        const group = (row as RowData)._group as RowData[];
        let sumPV = 0, sumV = 0;
        for (const r of group) {
          const p = Number(fieldFn!(r));
          const v = Number(secondFn!(r));
          sumPV += p * v; sumV += v;
        }
        return sumV === 0 ? 0 : sumPV / sumV;
      };
    case 'wavg':
      return (row) => {
        const group = (row as RowData)._group as RowData[];
        let sumWV = 0, sumW = 0;
        for (const r of group) {
          const val = Number(fieldFn!(r));
          const w = Number(secondFn!(r));
          sumWV += val * w; sumW += w;
        }
        return sumW === 0 ? 0 : sumWV / sumW;
      };
    case 'drawdown':
      return (row) => computeDrawdown(extractValues(row));

    // ── Ratios ────────────────────────────────────────────
    case 'pct':
      // Returns the group sum — the division by grand total happens in the select pipeline
      // In grouped context, pct produces the group sum that will be normalized later
      return (row) => {
        const group = (row as RowData)._group as RowData[];
        return group.reduce((acc, r) => acc + Number(fieldFn!(r)), 0);
      };
    case 'sharpe':
      return (row) => {
        const vals = extractValues(row);
        if (vals.length === 0) return 0;
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        const sd = computeStddev(vals);
        return sd === 0 ? 0 : mean / sd;
      };
    case 'calmar':
      return (row) => {
        const vals = extractValues(row);
        if (vals.length === 0) return 0;
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        const dd = Math.abs(computeDrawdown(vals));
        return dd === 0 ? 0 : mean / dd;
      };
    case 'sortino':
      return (row) => {
        const vals = extractValues(row);
        if (vals.length === 0) return 0;
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        const dsd = computeDownsideDeviation(vals, 0);
        return dsd === 0 ? 0 : mean / dsd;
      };
    case 'info_ratio':
      return (row) => {
        const group = (row as RowData)._group as RowData[];
        const excess = group.map(r => Number(fieldFn!(r)) - Number(secondFn!(r)));
        if (excess.length === 0) return 0;
        const mean = excess.reduce((a, b) => a + b, 0) / excess.length;
        const sd = computeStddev(excess);
        return sd === 0 ? 0 : mean / sd;
      };

    // ── Counting ──────────────────────────────────────────
    case 'distinct_count':
      return (row) => {
        const group = (row as RowData)._group as RowData[];
        return new Set(group.map(r => fieldFn!(r))).size;
      };
    case 'sum_abs':
      return (row) => {
        const group = (row as RowData)._group as RowData[];
        return group.reduce((acc, r) => acc + Math.abs(Number(fieldFn!(r))), 0);
      };
    case 'abs_sum':
      return (row) => {
        const group = (row as RowData)._group as RowData[];
        return Math.abs(group.reduce((acc, r) => acc + Number(fieldFn!(r)), 0));
      };

    // ── Range ─────────────────────────────────────────────
    case 'first_value':
      return (row) => {
        const group = (row as RowData)._group as RowData[];
        return group.length > 0 ? fieldFn!(group[0]) : null;
      };
    case 'last_value':
      return (row) => {
        const group = (row as RowData)._group as RowData[];
        return group.length > 0 ? fieldFn!(group[group.length - 1]) : null;
      };

    default:
      throw new RuntimeError(`Unknown aggregate function: ${name}`);
  }
}

// ─── Resolving output field name from an expression ──────────────────────────

function resolveFieldName(expr: Expression): string {
  switch (expr.kind) {
    case 'AliasExpr':
      return (expr as AliasExpr).alias;
    case 'FieldAccess':
      return (expr as FieldAccess).path[(expr as FieldAccess).path.length - 1];
    case 'FunctionCall':
      return (expr as FunctionCall).name;
    default:
      return 'value';
  }
}

// ─── Operation Compiler ──────────────────────────────────────────────────────

function compileOperation(op: Operation, isGrouped: boolean): { fn: OpFn; producesGrouped: boolean } {
  switch (op.kind) {
    case 'WhereOp': {
      const condFn = compileExpression(op.condition);
      return {
        fn: (data) => data.filter((row) => condFn(row)),
        producesGrouped: false,
      };
    }

    case 'SelectOp':
      return compileSelectOp(op, isGrouped);

    case 'SortOp': {
      const criteria = op.criteria.map((c) => ({
        fn: compileExpression(c.expression),
        dir: c.direction === 'desc' ? -1 : 1,
      }));
      return {
        fn: (data) => {
          return [...data].sort((a, b) => {
            for (const { fn, dir } of criteria) {
              const cmp = compareValues(fn(a), fn(b));
              if (cmp !== 0) return cmp * dir;
            }
            return 0;
          });
        },
        producesGrouped: false,
      };
    }

    case 'GroupByOp': {
      const keyFns = op.keys.map((k) => {
        const fn = compileExpression(k);
        const name = k.kind === 'FieldAccess' ? k.path[k.path.length - 1] : 'key';
        return { fn, name };
      });
      return {
        fn: (data) => {
          const groups = groupByFn(data, keyFns);
          return groups.map((g) => ({ ...g.keys, _group: g.rows }));
        },
        producesGrouped: true,
      };
    }

    case 'JoinOp': {
      const rightSource = op.right;

      // Detect equi-join: field1 == field2 → use hash join O(n+m)
      if (
        op.condition.kind === 'BinaryExpr' &&
        op.condition.operator === '==' &&
        op.condition.left.kind === 'FieldAccess' &&
        op.condition.right.kind === 'FieldAccess'
      ) {
        const leftKeyFn = compileExpression(op.condition.left);
        const rightKeyFn = compileExpression(op.condition.right);
        return {
          fn: (data, context) => {
            const rightData = context[rightSource];
            if (!rightData) {
              throw new RuntimeError(`Join source "${rightSource}" not found in context`);
            }
            return hashJoin(data, rightData as RowData[], leftKeyFn, rightKeyFn);
          },
          producesGrouped: false,
        };
      }

      // Fallback: complex condition → nested loop join O(n*m)
      const condFn = compileExpression(op.condition);
      return {
        fn: (data, context) => {
          const rightData = context[rightSource];
          if (!rightData) {
            throw new RuntimeError(`Join source "${rightSource}" not found in context`);
          }
          return nestedLoopJoin(data, rightData as RowData[], condFn);
        },
        producesGrouped: false,
      };
    }

    case 'FirstOp': {
      const count = op.count;
      return {
        fn: (data) => data.slice(0, count),
        producesGrouped: false,
      };
    }

    case 'LastOp': {
      const count = op.count;
      return {
        fn: (data) => data.slice(-count),
        producesGrouped: false,
      };
    }

    case 'DistinctOp': {
      const keyFn = op.fields
        ? (() => {
            const fns = op.fields.map((f) => compileExpression(f));
            return (row: RowData) => JSON.stringify(fns.map((fn) => fn(row)));
          })()
        : undefined;
      return {
        fn: (data) => distinctFn(data, keyFn),
        producesGrouped: false,
      };
    }

    case 'FlattenOp': {
      if (op.field) {
        const fieldFn = compileExpression(op.field);
        return {
          fn: (data) => data.flatMap((row) => {
            const val = fieldFn(row);
            return Array.isArray(val) ? val : [val];
          }),
          producesGrouped: false,
        };
      }
      return {
        fn: (data) => data.flat(),
        producesGrouped: false,
      };
    }

    case 'TransposeOp': {
      const headerFn = op.headerField ? compileExpression(op.headerField) : undefined;
      const headerFieldName = op.headerField ? resolveFieldName(op.headerField) : undefined;
      return {
        fn: (data) => transposeFn(data, headerFn, headerFieldName),
        producesGrouped: false,
      };
    }

    case 'RollupOp': {
      const keyFns = op.keys.map((k) => {
        const fn = compileExpression(k);
        const name = resolveFieldName(k);
        return { fn, name };
      });
      const aggFns = op.aggregates.map((a) => {
        const fn = compileExpression(a, true); // grouped = true
        const name = resolveFieldName(a);
        return { fn, name };
      });
      // Detect which aggregate columns use pct() so we can normalize after rollup
      const pctCols = new Set<string>();
      for (const a of op.aggregates) {
        const expr = a.kind === 'AliasExpr' ? (a as AliasExpr).expression : a;
        if (expr.kind === 'FunctionCall' && (expr as FunctionCall).name === 'pct') {
          pctCols.add(resolveFieldName(a));
        }
      }
      return {
        fn: (data) => {
          const results = rollupFn(data, keyFns, aggFns);
          if (pctCols.size > 0) {
            // Grand total row is the one with _rollupLevel === numKeys (all keys null)
            const numKeys = keyFns.length;
            const grandRow = results.find(r => r._rollupLevel === numKeys);
            for (const col of pctCols) {
              const total = Number(grandRow?.[col]) || 1;
              for (const row of results) {
                row[col] = (Number(row[col]) / total) * 100;
              }
            }
            // If every aggregate is pct, the grand total row (100%) is redundant — remove it
            if (pctCols.size === aggFns.length) {
              return results.filter(r => r._rollupLevel !== numKeys);
            }
          }
          return results;
        },
        producesGrouped: false,
      };
    }

    case 'PivotOp': {
      const pivotFn = compileExpression(op.pivotField);
      const aggCompilers = op.aggregates.map((a) => ({
        fn: compileExpression(a, true), // grouped = true
        name: resolveFieldName(a),
      }));
      const singleAggregate = aggCompilers.length === 1;
      return {
        fn: (data) => {
          if (isGrouped) {
            return pivotGroupedFn(data, pivotFn, aggCompilers, singleAggregate);
          }
          return pivotFlatFn(data, pivotFn, aggCompilers, singleAggregate);
        },
        producesGrouped: false,
      };
    }

    case 'MapOp': {
      const fieldCompilers = op.fields.map((field) => {
        const name = resolveFieldName(field);
        const fn = compileExpression(field, isGrouped);
        return { name, fn };
      });
      return {
        fn: (data) => data.map((row) => {
          const result: RowData = { ...row };
          for (const { name, fn } of fieldCompilers) {
            result[name] = fn(row);
          }
          return result;
        }),
        producesGrouped: isGrouped,
      };
    }

    case 'ReduceOp': {
      const initialFn = compileExpression(op.initial);
      const accFn = compileExpression(op.accumulator);
      return {
        fn: (data) => {
          let acc: unknown = initialFn({} as RowData);
          for (const row of data) {
            acc = accFn({ ...row, _acc: acc });
          }
          return acc;
        },
        producesGrouped: false,
      };
    }

    case 'AggregateOp': {
      const argFns = op.args?.map(a => compileExpression(a));
      const primaryFn = argFns ? argFns[0] : (op.field ? compileExpression(op.field) : undefined);
      const secondFn = argFns ? argFns[1] : undefined;
      const aggName = op.function;
      return {
        fn: (data) => {
          const vals = () => data.map(row => Number(primaryFn!(row)));
          switch (aggName) {
            // ── Core ──────────────────────────────────────
            case 'count':
              return data.length;
            case 'sum':
              return data.reduce((acc, row) => acc + Number(primaryFn!(row)), 0);
            case 'avg': {
              if (data.length === 0) return 0;
              const total = data.reduce((acc, row) => acc + Number(primaryFn!(row)), 0);
              return total / data.length;
            }
            case 'min':
              return data.reduce((min, row) => {
                const val = primaryFn!(row) as number;
                return val < (min as number) ? val : min;
              }, primaryFn!(data[0]));
            case 'max':
              return data.reduce((max, row) => {
                const val = primaryFn!(row) as number;
                return val > (max as number) ? val : max;
              }, primaryFn!(data[0]));

            // ── Statistical ───────────────────────────────
            case 'median':
              return computeMedian(vals());
            case 'stddev':
              return computeStddev(vals());
            case 'var':
              return computeVariance(vals());
            case 'percentile':
              return computePercentile(vals(), Number(secondFn!(data[0])));
            case 'skew':
              return computeSkew(vals());
            case 'kurt':
              return computeKurt(vals());

            // ── Finance ───────────────────────────────────
            case 'vwap': {
              let sumPV = 0, sumV = 0;
              for (const row of data) {
                const p = Number(primaryFn!(row));
                const v = Number(secondFn!(row));
                sumPV += p * v; sumV += v;
              }
              return sumV === 0 ? 0 : sumPV / sumV;
            }
            case 'wavg': {
              let sumWV = 0, sumW = 0;
              for (const row of data) {
                const val = Number(primaryFn!(row));
                const w = Number(secondFn!(row));
                sumWV += val * w; sumW += w;
              }
              return sumW === 0 ? 0 : sumWV / sumW;
            }
            case 'drawdown':
              return computeDrawdown(vals());

            // ── Ratios ────────────────────────────────────
            case 'pct': {
              // Standalone pct returns sum (= 100% of itself)
              return data.reduce((acc, row) => acc + Number(primaryFn!(row)), 0);
            }
            case 'sharpe': {
              const v = vals();
              if (v.length === 0) return 0;
              const mean = v.reduce((a, b) => a + b, 0) / v.length;
              const sd = computeStddev(v);
              return sd === 0 ? 0 : mean / sd;
            }
            case 'calmar': {
              const v = vals();
              if (v.length === 0) return 0;
              const mean = v.reduce((a, b) => a + b, 0) / v.length;
              const dd = Math.abs(computeDrawdown(v));
              return dd === 0 ? 0 : mean / dd;
            }
            case 'sortino': {
              const v = vals();
              if (v.length === 0) return 0;
              const mean = v.reduce((a, b) => a + b, 0) / v.length;
              const dsd = computeDownsideDeviation(v, 0);
              return dsd === 0 ? 0 : mean / dsd;
            }
            case 'info_ratio': {
              const excess = data.map(row => Number(primaryFn!(row)) - Number(secondFn!(row)));
              if (excess.length === 0) return 0;
              const mean = excess.reduce((a, b) => a + b, 0) / excess.length;
              const sd = computeStddev(excess);
              return sd === 0 ? 0 : mean / sd;
            }

            // ── Counting ──────────────────────────────────
            case 'distinct_count':
              return new Set(data.map(row => primaryFn!(row))).size;
            case 'sum_abs':
              return data.reduce((acc, row) => acc + Math.abs(Number(primaryFn!(row))), 0);
            case 'abs_sum':
              return Math.abs(data.reduce((acc, row) => acc + Number(primaryFn!(row)), 0));

            // ── Range ─────────────────────────────────────
            case 'first_value':
              return data.length > 0 ? primaryFn!(data[0]) : null;
            case 'last_value':
              return data.length > 0 ? primaryFn!(data[data.length - 1]) : null;
          }
        },
        producesGrouped: false,
      };
    }
  }
}

function compileSelectOp(op: SelectOp, isGrouped: boolean): { fn: OpFn; producesGrouped: boolean } {
  const fieldCompilers = op.fields.map((field) => {
    const name = resolveFieldName(field);
    const fn = compileExpression(field, isGrouped);
    return { name, fn };
  });

  // Collect window function definitions from compiled expressions
  const windowDefs: WindowDef[] = [];
  for (const { fn } of fieldCompilers) {
    const wDef = (fn as ExprFn & { _windowDef?: WindowDef })._windowDef;
    if (wDef) windowDefs.push(wDef);
  }

  if (windowDefs.length > 0) {
    return {
      fn: (data) => {
        const windowValues = computeWindowValues(data, windowDefs);
        return data.map((row, i) => {
          const enrichedRow = { ...row, _windowCtx: windowValues[i] };
          const result: RowData = {};
          for (const { name, fn } of fieldCompilers) {
            result[name] = fn(enrichedRow);
          }
          return result;
        });
      },
      producesGrouped: false,
    };
  }

  return {
    fn: (data) => {
      return data.map((row) => {
        const result: RowData = {};
        for (const { name, fn } of fieldCompilers) {
          result[name] = fn(row);
        }
        return result;
      });
    },
    producesGrouped: false,
  };
}

// ─── Pipeline Compiler ───────────────────────────────────────────────────────

export function compile(ast: Pipeline, source: string): CompiledQuery {
  // Compile operations, tracking grouped state through the pipeline
  const compiledOps: OpFn[] = [];
  let isGrouped = false;

  for (const op of ast.operations) {
    const { fn, producesGrouped } = compileOperation(op, isGrouped);
    compiledOps.push(fn);
    isGrouped = producesGrouped;
  }

  const sourceName = ast.source;

  const queryFn = (context: DataContext): unknown => {
    const sourceData = context[sourceName];
    if (!sourceData) {
      throw new RuntimeError(`Source "${sourceName}" not found in context`);
    }
    if (!Array.isArray(sourceData)) {
      throw new RuntimeError(`Source "${sourceName}" is not an array`);
    }

    let data: unknown = sourceData;
    for (const opFn of compiledOps) {
      if (!Array.isArray(data)) {
        // Scalar result from aggregate — no more operations
        return data;
      }
      data = opFn(data as RowData[], context);
    }
    return data;
  };

  // Attach metadata
  const compiled = queryFn as CompiledQuery;
  Object.defineProperty(compiled, 'source', { value: source, writable: false });
  Object.defineProperty(compiled, 'ast', { value: ast, writable: false });

  return compiled;
}
