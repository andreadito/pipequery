import { describe, it, expect } from 'vitest';
import { parseQuery, printQuery } from '../src/engine/index';
import type { Expression, Operation, Pipeline } from '../src/engine/types';

// Seeded PRNG (mulberry32) so failures are reproducible without a fuzzing dependency.
function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  const pick = <T>(xs: readonly T[]): T => xs[int(xs.length)];
  return { next, int, pick, chance: (p: number) => next() < p };
}
type Rng = ReturnType<typeof rng>;

const IDENTS = ['a', 'b', 'price', 'qty', 'user', 'x1', '_id', 'camelCase', 'asset', 'nullable', 'descr', 'snake_case_2'];
// `||` is excluded: the lexer cannot tokenise it, so the parser can never produce it.
const BIN_OPS = ['>', '>=', '<', '<=', '==', '!=', '&&', '+', '-', '*', '/', '%'] as const;
const FN_NAMES = ['f', 'lower', 'upper', 'len', 'abs', 'round', 'concat', 'coalesce', 'contains', 'g_h'];
const AGG_ONE = ['sum', 'avg', 'min', 'max', 'count', 'median', 'stddev', 'distinct_count'];
const NUMBERS = [0, 1, 2, 42, 0.5, 1.5, 99.99, 0.000001, 1e21, 1e-7, 123456789.125, 2 ** 53];
const STRINGS = ['', 'abc', 'a"b', "it's", 'back\\slash', 'line\nbreak', 'tab\t', 'mix " \' \\ \n \t', '\\n', 'é ✓ 🎉', ') | where('];

/** Expression that may be an AliasExpr only when `allowAlias` (a parseExpression position). */
function genExpr(r: Rng, depth: number, allowAlias: boolean): Expression {
  const base = genNonAlias(r, depth);
  if (allowAlias && r.chance(0.2)) {
    return { kind: 'AliasExpr', expression: base, alias: r.pick(IDENTS) };
  }
  return base;
}

function genNonAlias(r: Rng, depth: number): Expression {
  const leaf = depth <= 0 || r.chance(0.25);
  if (leaf) {
    switch (r.int(5)) {
      case 0: return { kind: 'NumberLiteral', value: r.pick(NUMBERS) };
      case 1: return { kind: 'StringLiteral', value: r.pick(STRINGS) };
      case 2: return { kind: 'BooleanLiteral', value: r.chance(0.5) };
      case 3: return { kind: 'NullLiteral' };
      default: {
        const len = 1 + r.int(3);
        return { kind: 'FieldAccess', path: Array.from({ length: len }, () => r.pick(IDENTS)) };
      }
    }
  }
  switch (r.int(4)) {
    case 0:
      return { kind: 'UnaryExpr', operator: r.pick(['!', '-'] as const), operand: genNested(r, depth - 1) };
    case 1: {
      const n = r.int(4);
      return { kind: 'FunctionCall', name: r.pick(FN_NAMES), args: Array.from({ length: n }, () => genExpr(r, depth - 1, true)) };
    }
    default:
      return {
        kind: 'BinaryExpr',
        operator: r.pick(BIN_OPS),
        left: genNested(r, depth - 1),
        right: genNested(r, depth - 1),
      };
  }
}

/** Operand position: an alias is representable only through parentheses (which the printer adds). */
function genNested(r: Rng, depth: number): Expression {
  return genExpr(r, depth, r.chance(0.05));
}

function genOperation(r: Rng): Operation {
  const d = 3;
  const list = (min: number, max: number, alias: boolean) =>
    Array.from({ length: min + r.int(max - min + 1) }, () => genExpr(r, d, alias));
  const agg = (): Expression => {
    const call: Expression = { kind: 'FunctionCall', name: r.pick(AGG_ONE), args: r.chance(0.2) ? [] : [genExpr(r, 2, true)] };
    return r.chance(0.6) ? { kind: 'AliasExpr', expression: call, alias: r.pick(IDENTS) } : call;
  };
  switch (r.int(14)) {
    case 0: return { kind: 'WhereOp', condition: genExpr(r, d + 1, true) };
    case 1: return { kind: 'SelectOp', fields: list(0, 4, true) };
    case 2: return { kind: 'MapOp', fields: list(0, 4, true) };
    case 3:
      return {
        kind: 'SortOp',
        criteria: Array.from({ length: r.int(4) }, () => ({
          expression: genExpr(r, d, false),
          direction: r.pick(['asc', 'desc'] as const),
        })),
      };
    case 4: return { kind: 'GroupByOp', keys: list(0, 3, false) };
    case 5: return { kind: 'JoinOp', right: r.pick(IDENTS), condition: genExpr(r, d, true) };
    case 6: return { kind: 'FirstOp', count: r.pick(NUMBERS) };
    case 7: return { kind: 'LastOp', count: r.pick(NUMBERS) };
    case 8: return r.chance(0.3) ? { kind: 'DistinctOp' } : { kind: 'DistinctOp', fields: list(1, 3, false) };
    case 9: return r.chance(0.4) ? { kind: 'FlattenOp' } : { kind: 'FlattenOp', field: genExpr(r, 2, false) };
    case 10: return r.chance(0.4) ? { kind: 'TransposeOp' } : { kind: 'TransposeOp', headerField: genExpr(r, 2, false) };
    case 11:
      return {
        kind: 'RollupOp',
        keys: Array.from({ length: r.int(3) }, () => genExpr(r, 2, true)),
        aggregates: Array.from({ length: 1 + r.int(3) }, agg),
      };
    case 12:
      return { kind: 'PivotOp', pivotField: genExpr(r, 2, false), aggregates: Array.from({ length: 1 + r.int(3) }, agg) };
    default:
      return { kind: 'ReduceOp', initial: genExpr(r, 2, true), accumulator: genExpr(r, d, true) };
  }
}

function genPipeline(r: Rng): Pipeline {
  return {
    kind: 'Pipeline',
    source: r.pick(IDENTS),
    operations: Array.from({ length: r.int(5) }, () => genOperation(r)),
  };
}

describe('printQuery: seeded fuzz round trip', () => {
  it('printQuery -> parseQuery yields an equal AST for 5000 random pipelines', () => {
    const r = rng(0xc0ffee);
    for (let i = 0; i < 5000; i++) {
      const ast = genPipeline(r);
      const printed = printQuery(ast);
      let reparsed: Pipeline;
      try {
        reparsed = parseQuery(printed);
      } catch (e) {
        throw new Error(`case ${i}: could not re-parse ${printed}: ${(e as Error).message}`);
      }
      expect(reparsed, `case ${i}: ${printed}`).toEqual(ast);
      expect(printQuery(reparsed)).toBe(printed);
    }
  });

  it('negative number literals re-parse as unary minus over the positive literal', () => {
    const r = rng(42);
    for (let i = 0; i < 500; i++) {
      const value = -(r.pick(NUMBERS) || 1);
      const ast: Pipeline = {
        kind: 'Pipeline',
        source: 'd',
        operations: [{ kind: 'WhereOp', condition: { kind: 'BinaryExpr', operator: r.pick(BIN_OPS), left: { kind: 'FieldAccess', path: ['a'] }, right: { kind: 'NumberLiteral', value } } }],
      };
      const cond = (parseQuery(printQuery(ast)).operations[0] as any).condition;
      expect(cond.right).toEqual({ kind: 'UnaryExpr', operator: '-', operand: { kind: 'NumberLiteral', value: -value } });
    }
  });
});
