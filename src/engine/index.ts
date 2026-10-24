import { tokenize } from './lexer';
import { parse } from './parser';
import { compile as compilePipeline } from './compiler';
import { printQuery } from './print';
import { QueryCache } from './cache';
import type { CompiledQuery, Pipeline, DataContext, RowData } from './types';

export { DataWeaveError, LexerError, ParseError, RuntimeError } from './types';
export type { CompiledQuery, Pipeline, Expression, Operation, DataContext } from './types';
export { printQuery, printExpression } from './print';
export { LiveQuery, liveQuery } from './live';
export type { LiveQueryOptions, LiveQueryStats, LiveQuerySubscriber } from './live';

const defaultCache = new QueryCache(128);

const OPERATION_KEYWORDS = new Set([
  'where', 'select', 'sort', 'groupBy', 'join',
  'first', 'last', 'distinct', 'map', 'reduce',
  'rollup', 'pivot', 'flatten', 'transpose',
]);

function normalizeExpression(expression: string): string {
  const trimmed = expression.trimStart();
  const match = trimmed.match(/^(\w+)\s*\(/);
  if (match && OPERATION_KEYWORDS.has(match[1])) {
    return `_data | ${trimmed}`;
  }
  return expression;
}

export function compile(expression: string, useCache = true): CompiledQuery {
  if (useCache) {
    const cached = defaultCache.get(expression);
    if (cached) return cached;
  }

  const tokens = tokenize(expression);
  const ast = parse(tokens);
  const fn = compilePipeline(ast, expression);

  if (useCache) {
    defaultCache.set(expression, fn);
  }

  return fn;
}

export function query(context: DataContext | RowData[], expression: string): unknown {
  if (Array.isArray(context)) {
    const normalized = normalizeExpression(expression);
    const fn = compile(normalized);
    return fn({ _data: context });
  }
  const fn = compile(expression);
  return fn(context);
}

/**
 * Compile an AST directly, skipping the print and re-parse round trip.
 * `.source` of the result is the canonical printed form of the AST.
 */
export function compileAst(ast: Pipeline): CompiledQuery {
  return compilePipeline(ast, printQuery(ast));
}

export function parseQuery(expression: string): Pipeline {
  const tokens = tokenize(expression);
  return parse(tokens);
}

export function clearCache(): void {
  defaultCache.clear();
}
