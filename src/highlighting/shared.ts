// ─── PipeQuery Language Token Lists & Colors ─────────────────────────────────
// Shared across CodeMirror, Monaco, and TextMate highlighting definitions.

export const OPERATION_NAMES = [
  'where', 'select', 'sort', 'groupBy', 'join', 'first', 'last',
  'distinct', 'map', 'reduce', 'rollup', 'pivot', 'flatten', 'transpose',
] as const;

export const KEYWORDS = [
  'as', 'asc', 'desc', 'true', 'false', 'null',
] as const;

export const AGGREGATE_FUNCTIONS = [
  'sum', 'avg', 'min', 'max', 'count',
  'median', 'stddev', 'var', 'percentile', 'skew', 'kurt',
  'vwap', 'wavg', 'drawdown',
  'pct', 'sharpe', 'calmar', 'sortino', 'info_ratio',
  'distinct_count', 'sum_abs', 'abs_sum',
  'first_value', 'last_value',
] as const;

export const BUILTIN_FUNCTIONS = [
  'if', 'coalesce', 'lower', 'upper', 'len', 'abs', 'round', 'concat',
] as const;

export const WINDOW_FUNCTIONS = [
  'running_sum', 'running_avg', 'running_count',
  'running_min', 'running_max',
  'row_number', 'lag', 'lead',
] as const;

export const ALL_FUNCTIONS = [
  ...AGGREGATE_FUNCTIONS,
  ...BUILTIN_FUNCTIONS,
  ...WINDOW_FUNCTIONS,
] as const;

export const ALL_KEYWORDS = [
  ...OPERATION_NAMES,
  ...KEYWORDS,
] as const;

export const COLORS = {
  keyword: '#c792ea',
  string: '#c3e88d',
  number: '#f78c6c',
  operator: '#89ddff',
  field: '#82aaff',
  function: '#ffcb6b',
  comment: '#546e7a',
} as const;
