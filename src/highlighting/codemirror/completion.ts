import { autocompletion, type CompletionContext, type Completion, type CompletionResult } from '@codemirror/autocomplete';
import type { Extension } from '@codemirror/state';
import {
  OPERATION_NAMES,
  KEYWORDS,
  AGGREGATE_FUNCTIONS,
  BUILTIN_FUNCTIONS,
  WINDOW_FUNCTIONS,
  ALL_FUNCTIONS,
} from '../shared';

// ─── Configuration ───────────────────────────────────────────────────────────

export interface PipeQueryCompletionConfig {
  /** Dynamic field names from the current data context. */
  fields?: string[] | (() => string[]);
  /** Available data source names (e.g. "crypto", "orders"). */
  sources?: string[] | (() => string[]);
}

// ─── Descriptions (inlined to avoid react/ dependency) ───────────────────────

const OP_HINTS: Record<string, string> = {
  where: 'Filter rows matching a condition',
  select: 'Pick or compute columns',
  sort: 'Order rows by fields',
  groupBy: 'Group rows by key fields',
  join: 'Join with another data source',
  first: 'Take first N rows',
  last: 'Take last N rows',
  distinct: 'Remove duplicate rows',
  map: 'Add computed columns',
  reduce: 'Fold rows into a single value',
  rollup: 'Group + aggregate in one step',
  pivot: 'Pivot rows into columns',
  flatten: 'Expand nested arrays',
  transpose: 'Swap rows and columns',
};

const FN_HINTS: Record<string, string> = {
  // Aggregate
  sum: 'Total of values', avg: 'Arithmetic mean', min: 'Minimum value', max: 'Maximum value',
  count: 'Row count', median: '50th percentile', stddev: 'Standard deviation', var: 'Variance',
  percentile: 'p-th percentile', skew: 'Skewness', kurt: 'Excess kurtosis',
  vwap: 'Volume-weighted avg price', wavg: 'Weighted average', drawdown: 'Max peak-to-trough decline',
  pct: 'Percentage of total', sharpe: 'Sharpe ratio', calmar: 'Calmar ratio',
  sortino: 'Sortino ratio', info_ratio: 'Information ratio',
  distinct_count: 'Count of unique values', sum_abs: 'Sum of absolute values', abs_sum: 'Abs of sum',
  first_value: 'First value in group', last_value: 'Last value in group',
  // Built-in
  if: 'Conditional expression', coalesce: 'First non-null value',
  lower: 'Lowercase string', upper: 'Uppercase string', len: 'String length',
  abs: 'Absolute value', round: 'Round to N decimals', concat: 'Concatenate strings',
  contains: 'Check if string contains substring', startsWith: 'Check if string starts with prefix',
  endsWith: 'Check if string ends with suffix', trim: 'Remove leading/trailing whitespace',
  substring: 'Extract part of a string', replace: 'Replace all occurrences in string',
  // Window
  running_sum: 'Cumulative sum', running_avg: 'Cumulative average', running_count: 'Cumulative count',
  running_min: 'Running minimum', running_max: 'Running maximum',
  row_number: 'Row number (1-based)', lag: 'Previous row value', lead: 'Next row value',
};

const KW_HINTS: Record<string, string> = {
  as: 'Alias a column', asc: 'Ascending order', desc: 'Descending order',
  true: 'Boolean true', false: 'Boolean false', null: 'Null value',
};

// ─── Pre-built completion items ──────────────────────────────────────────────

const OP_COMPLETIONS: Completion[] = OPERATION_NAMES.map(name => ({
  label: name,
  type: 'keyword',
  detail: 'operation',
  info: OP_HINTS[name],
  boost: 2,
}));

const FN_COMPLETIONS: Completion[] = ALL_FUNCTIONS.map(name => ({
  label: name,
  type: 'function',
  detail: AGGREGATE_FUNCTIONS.includes(name as typeof AGGREGATE_FUNCTIONS[number])
    ? 'aggregate'
    : WINDOW_FUNCTIONS.includes(name as typeof WINDOW_FUNCTIONS[number])
      ? 'window'
      : 'built-in',
  info: FN_HINTS[name],
  apply: `${name}(`,
}));

const AGG_COMPLETIONS = FN_COMPLETIONS.filter(
  c => AGGREGATE_FUNCTIONS.includes(c.label as typeof AGGREGATE_FUNCTIONS[number]),
);

const KW_COMPLETIONS: Completion[] = KEYWORDS.map(name => ({
  label: name,
  type: 'keyword',
  detail: 'keyword',
  info: KW_HINTS[name],
}));

const SORT_KW: Completion[] = [
  { label: 'asc', type: 'keyword', detail: 'ascending order' },
  { label: 'desc', type: 'keyword', detail: 'descending order' },
];

// ─── Context detection ───────────────────────────────────────────────────────

type QueryContext =
  | { kind: 'afterPipe' }
  | { kind: 'insideOp'; op: string }
  | { kind: 'startOfQuery' }
  | { kind: 'general' };

function detectContext(text: string): QueryContext {
  // Walk backwards, tracking paren depth
  let depth = 0;
  let i = text.length - 1;

  // Skip trailing whitespace & partial word
  while (i >= 0 && /[\w.]/.test(text[i])) i--;
  while (i >= 0 && /\s/.test(text[i])) i--;

  if (i < 0) return { kind: 'startOfQuery' };

  const ch = text[i];

  // After pipe
  if (ch === '|') return { kind: 'afterPipe' };

  // Scan backwards for enclosing context
  for (let j = text.length - 1; j >= 0; j--) {
    const c = text[j];
    if (c === ')') depth++;
    else if (c === '(') {
      depth--;
      if (depth < 0) {
        // Found the opening paren — extract operation name before it
        let k = j - 1;
        while (k >= 0 && /\s/.test(text[k])) k--;
        let end = k + 1;
        while (k >= 0 && /\w/.test(text[k])) k--;
        const op = text.slice(k + 1, end);
        if (op && OPERATION_NAMES.includes(op as typeof OPERATION_NAMES[number])) {
          return { kind: 'insideOp', op };
        }
        // Could be inside a function call
        if (op && ALL_FUNCTIONS.includes(op as typeof ALL_FUNCTIONS[number])) {
          return { kind: 'general' };
        }
        return { kind: 'general' };
      }
    }
    // Skip strings
    if (c === '"' || c === "'") {
      const q = c;
      j--;
      while (j >= 0 && text[j] !== q) j--;
    }
  }

  // Check if we're at the very start (source position)
  const trimmed = text.trimStart();
  if (!trimmed.includes('|')) return { kind: 'startOfQuery' };

  return { kind: 'general' };
}

// ─── Completion source ───────────────────────────────────────────────────────

function resolve<T>(v: T | (() => T)): T {
  return typeof v === 'function' ? (v as () => T)() : v;
}

function buildFieldCompletions(fields: string[]): Completion[] {
  return fields.map(f => ({
    label: f,
    type: 'variable',
    detail: 'field',
    boost: 1,
  }));
}

function buildSourceCompletions(sources: string[]): Completion[] {
  return sources.map(s => ({
    label: s,
    type: 'variable',
    detail: 'source',
    boost: 3,
  }));
}

function createCompletionSource(config?: PipeQueryCompletionConfig) {
  return function completionSource(cx: CompletionContext): CompletionResult | null {
    // Get the word being typed
    const word = cx.matchBefore(/[\w.]*/);
    if (!word) return null;

    // Don't trigger on empty unless explicitly requested
    if (word.from === word.to && !cx.explicit) return null;

    const fields = resolve(config?.fields ?? []);
    const sources = resolve(config?.sources ?? []);

    const textBefore = cx.state.doc.sliceString(0, word.from);
    const ctx = detectContext(textBefore);

    let completions: Completion[];

    switch (ctx.kind) {
      case 'afterPipe':
        completions = OP_COMPLETIONS;
        break;

      case 'startOfQuery':
        completions = [
          ...buildSourceCompletions(sources),
          ...OP_COMPLETIONS,
        ];
        break;

      case 'insideOp':
        switch (ctx.op) {
          case 'sort':
            completions = [...buildFieldCompletions(fields), ...SORT_KW];
            break;
          case 'select':
          case 'groupBy':
          case 'distinct':
            completions = [...buildFieldCompletions(fields), ...FN_COMPLETIONS];
            break;
          case 'rollup':
          case 'pivot':
            completions = [...buildFieldCompletions(fields), ...AGG_COMPLETIONS];
            break;
          case 'where':
          case 'map':
            completions = [
              ...buildFieldCompletions(fields),
              ...FN_COMPLETIONS,
              ...KW_COMPLETIONS,
            ];
            break;
          case 'join':
            completions = [
              ...buildSourceCompletions(sources),
              ...buildFieldCompletions(fields),
              ...KW_COMPLETIONS,
            ];
            break;
          default:
            completions = [
              ...buildFieldCompletions(fields),
              ...FN_COMPLETIONS,
              ...KW_COMPLETIONS,
            ];
        }
        break;

      case 'general':
      default:
        completions = [
          ...buildFieldCompletions(fields),
          ...FN_COMPLETIONS,
          ...KW_COMPLETIONS,
          ...OP_COMPLETIONS,
        ];
    }

    return {
      from: word.from,
      options: completions,
      validFor: /^\w*$/,
    };
  };
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function pipeQueryCompletion(config?: PipeQueryCompletionConfig): Extension {
  return autocompletion({
    override: [createCompletionSource(config)],
    activateOnTyping: true,
    icons: true,
  });
}
