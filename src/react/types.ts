// ─── Operation Types ────────────────────────────────────────────────────────

export type OperationType =
  | 'where' | 'select' | 'sort' | 'groupBy' | 'join'
  | 'first' | 'last' | 'distinct' | 'map' | 'reduce'
  | 'rollup' | 'pivot' | 'flatten' | 'transpose';

export interface WhereConfig { condition: string }
export interface SelectConfig { fields: string[]; expressions: string[] }
export interface SortConfig { criteria: Array<{ field: string; direction: 'asc' | 'desc' }> }
export interface GroupByConfig { fields: string[] }
export interface JoinConfig { rightSource: string; condition: string }
export interface FirstLastConfig { count: number }
export interface DistinctConfig { fields: string[] }
export interface MapConfig { expressions: string[] }
export interface ReduceConfig { initial: string; accumulator: string }
export interface RollupConfig { keys: string[]; aggregates: string[] }
export interface PivotConfig { pivotField: string; aggregates: string[] }
export interface FlattenConfig { field: string }
export interface TransposeConfig { headerField: string }

export type StepConfig =
  | { type: 'where'; config: WhereConfig }
  | { type: 'select'; config: SelectConfig }
  | { type: 'sort'; config: SortConfig }
  | { type: 'groupBy'; config: GroupByConfig }
  | { type: 'join'; config: JoinConfig }
  | { type: 'first'; config: FirstLastConfig }
  | { type: 'last'; config: FirstLastConfig }
  | { type: 'distinct'; config: DistinctConfig }
  | { type: 'map'; config: MapConfig }
  | { type: 'reduce'; config: ReduceConfig }
  | { type: 'rollup'; config: RollupConfig }
  | { type: 'pivot'; config: PivotConfig }
  | { type: 'flatten'; config: FlattenConfig }
  | { type: 'transpose'; config: TransposeConfig };

export interface PipelineStep {
  id: string;
  step: StepConfig;
}

// ─── Orientation & Props ────────────────────────────────────────────────────

export type Orientation = 'vertical' | 'horizontal';

export interface PipeQueryBuilderProps {
  orientation: Orientation;
  source: string;
  onSourceChange: (source: string) => void;
  availableSources: string[];
  availableFields: string[];
  onQueryChange: (query: string) => void;
  compact?: boolean;
  maxSteps?: number;
  initialSteps?: PipelineStep[];
  showResult?: boolean;
  joinSources?: string[];
  rowCount?: number;
}

// ─── Operation Metadata ─────────────────────────────────────────────────────

export type OperationCategory = 'filter' | 'transform' | 'sort' | 'aggregate' | 'limit' | 'join';

export const CATEGORY_COLORS: Record<OperationCategory, string> = {
  filter:    '#42a5f5',
  transform: '#66bb6a',
  sort:      '#ffa726',
  aggregate: '#ab47bc',
  limit:     '#26a69a',
  join:      '#ff7043',
};

export interface OperationMeta {
  label: string;
  shortLabel: string;
  category: OperationCategory;
  color: string;
}

export const OPERATION_META: Record<OperationType, OperationMeta> = {
  where:     { label: 'Filter (where)',   shortLabel: 'where',     category: 'filter',    color: CATEGORY_COLORS.filter },
  distinct:  { label: 'Distinct',         shortLabel: 'distinct',  category: 'filter',    color: CATEGORY_COLORS.filter },
  select:    { label: 'Select fields',    shortLabel: 'select',    category: 'transform', color: CATEGORY_COLORS.transform },
  map:       { label: 'Map (add fields)', shortLabel: 'map',       category: 'transform', color: CATEGORY_COLORS.transform },
  flatten:   { label: 'Flatten',          shortLabel: 'flatten',   category: 'transform', color: CATEGORY_COLORS.transform },
  transpose: { label: 'Transpose',        shortLabel: 'transpose', category: 'transform', color: CATEGORY_COLORS.transform },
  sort:      { label: 'Sort',             shortLabel: 'sort',      category: 'sort',      color: CATEGORY_COLORS.sort },
  groupBy:   { label: 'Group By',         shortLabel: 'groupBy',   category: 'aggregate', color: CATEGORY_COLORS.aggregate },
  reduce:    { label: 'Reduce',           shortLabel: 'reduce',    category: 'aggregate', color: CATEGORY_COLORS.aggregate },
  rollup:    { label: 'Rollup',           shortLabel: 'rollup',    category: 'aggregate', color: CATEGORY_COLORS.aggregate },
  pivot:     { label: 'Pivot',            shortLabel: 'pivot',     category: 'aggregate', color: CATEGORY_COLORS.aggregate },
  first:     { label: 'First N',          shortLabel: 'first',     category: 'limit',     color: CATEGORY_COLORS.limit },
  last:      { label: 'Last N',           shortLabel: 'last',      category: 'limit',     color: CATEGORY_COLORS.limit },
  join:      { label: 'Join',             shortLabel: 'join',      category: 'join',      color: CATEGORY_COLORS.join },
};

export const CATEGORIES_ORDERED: { key: OperationCategory; label: string; ops: OperationType[] }[] = [
  { key: 'filter',    label: 'Filter',    ops: ['where', 'distinct'] },
  { key: 'transform', label: 'Transform', ops: ['select', 'map', 'flatten', 'transpose'] },
  { key: 'sort',      label: 'Sort',      ops: ['sort'] },
  { key: 'aggregate', label: 'Aggregate', ops: ['groupBy', 'reduce', 'rollup', 'pivot'] },
  { key: 'limit',     label: 'Limit',     ops: ['first', 'last'] },
  { key: 'join',      label: 'Join',      ops: ['join'] },
];

// ─── Defaults ───────────────────────────────────────────────────────────────

export function createDefaultConfig(type: OperationType): StepConfig {
  switch (type) {
    case 'where': return { type, config: { condition: '' } };
    case 'select': return { type, config: { fields: [], expressions: [] } };
    case 'sort': return { type, config: { criteria: [{ field: '', direction: 'asc' as const }] } };
    case 'groupBy': return { type, config: { fields: [] } };
    case 'join': return { type, config: { rightSource: '', condition: '' } };
    case 'first': return { type, config: { count: 10 } };
    case 'last': return { type, config: { count: 10 } };
    case 'distinct': return { type, config: { fields: [] } };
    case 'map': return { type, config: { expressions: [''] } };
    case 'reduce': return { type, config: { initial: '0', accumulator: '' } };
    case 'rollup': return { type, config: { keys: [], aggregates: [''] } };
    case 'pivot': return { type, config: { pivotField: '', aggregates: [''] } };
    case 'flatten': return { type, config: { field: '' } };
    case 'transpose': return { type, config: { headerField: '' } };
  }
}

// ─── Summaries ──────────────────────────────────────────────────────────────

export function getStepSummary(step: StepConfig): string {
  switch (step.type) {
    case 'where':
      return step.config.condition || '(no condition)';
    case 'select': {
      const all = [...step.config.fields, ...step.config.expressions.filter(Boolean)];
      return all.length > 0 ? all.join(', ') : '(no fields)';
    }
    case 'sort': {
      const parts = step.config.criteria.filter(c => c.field).map(c =>
        c.direction === 'desc' ? `${c.field} \u2193` : `${c.field} \u2191`
      );
      return parts.length > 0 ? parts.join(', ') : '(no criteria)';
    }
    case 'groupBy':
      return step.config.fields.length > 0 ? step.config.fields.join(', ') : '(no fields)';
    case 'join':
      return step.config.rightSource
        ? `${step.config.rightSource} on ${step.config.condition || '...'}`
        : '(not configured)';
    case 'first':
    case 'last':
      return `${step.config.count} rows`;
    case 'distinct':
      return step.config.fields.length > 0 ? step.config.fields.join(', ') : 'all fields';
    case 'map': {
      const exprs = step.config.expressions.filter(Boolean);
      return exprs.length > 0 ? exprs.join(', ') : '(no expressions)';
    }
    case 'reduce':
      return step.config.accumulator || '(no accumulator)';
    case 'rollup': {
      const parts = [...step.config.keys, ...step.config.aggregates.filter(Boolean)];
      return parts.length > 0 ? parts.join(', ') : '(not configured)';
    }
    case 'pivot':
      return step.config.pivotField || '(no pivot field)';
    case 'flatten':
      return step.config.field || 'all';
    case 'transpose':
      return step.config.headerField || 'auto';
  }
}

// ─── DSL Generation ─────────────────────────────────────────────────────────

export function generateQuery(source: string, steps: PipelineStep[]): string {
  if (!source) return '';
  const parts = [source];
  for (const { step } of steps) {
    const dsl = stepToDsl(step);
    if (dsl) parts.push(dsl);
  }
  return parts.join(' | ');
}

function stepToDsl(step: StepConfig): string | null {
  switch (step.type) {
    case 'where':
      return step.config.condition ? `where(${step.config.condition})` : null;
    case 'select': {
      const all = [...step.config.fields, ...step.config.expressions.filter(Boolean)];
      return all.length > 0 ? `select(${all.join(', ')})` : null;
    }
    case 'sort': {
      const parts = step.config.criteria
        .filter(c => c.field)
        .map(c => c.direction === 'desc' ? `${c.field} desc` : c.field);
      return parts.length > 0 ? `sort(${parts.join(', ')})` : null;
    }
    case 'groupBy':
      return step.config.fields.length > 0 ? `groupBy(${step.config.fields.join(', ')})` : null;
    case 'join':
      return step.config.rightSource && step.config.condition
        ? `join(${step.config.rightSource}, ${step.config.condition})` : null;
    case 'first':
      return `first(${step.config.count})`;
    case 'last':
      return `last(${step.config.count})`;
    case 'distinct':
      return step.config.fields.length > 0 ? `distinct(${step.config.fields.join(', ')})` : 'distinct()';
    case 'map': {
      const exprs = step.config.expressions.filter(Boolean);
      return exprs.length > 0 ? `map(${exprs.join(', ')})` : null;
    }
    case 'reduce':
      return step.config.initial && step.config.accumulator
        ? `reduce(${step.config.initial}, ${step.config.accumulator})` : null;
    case 'rollup': {
      const parts = [...step.config.keys, ...step.config.aggregates.filter(Boolean)];
      return parts.length > 0 ? `rollup(${parts.join(', ')})` : null;
    }
    case 'pivot': {
      const aggs = step.config.aggregates.filter(Boolean);
      return step.config.pivotField && aggs.length > 0
        ? `pivot(${step.config.pivotField}, ${aggs.join(', ')})` : null;
    }
    case 'flatten':
      return step.config.field ? `flatten(${step.config.field})` : 'flatten()';
    case 'transpose':
      return step.config.headerField ? `transpose(${step.config.headerField})` : 'transpose()';
  }
}

// ─── DSL Parsing (inverse of generateQuery) ──────────────────────────────────

/**
 * Split a string by a delimiter, but only at the top level
 * (not inside parentheses or quotes).
 */
function splitTopLevel(input: string, delimiter: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let current = '';

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const prev = i > 0 ? input[i - 1] : '';

    if (ch === "'" && !inDoubleQuote && prev !== '\\') {
      inSingleQuote = !inSingleQuote;
    } else if (ch === '"' && !inSingleQuote && prev !== '\\') {
      inDoubleQuote = !inDoubleQuote;
    } else if (!inSingleQuote && !inDoubleQuote) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
    }

    if (
      depth === 0 &&
      !inSingleQuote &&
      !inDoubleQuote &&
      input.slice(i, i + delimiter.length) === delimiter
    ) {
      parts.push(current.trim());
      current = '';
      i += delimiter.length - 1;
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/**
 * Extract the operation name and the raw args string from a segment like `sort(field desc)`.
 * Returns null if it doesn't match the `name(...)` pattern.
 */
function parseOpCall(segment: string): { name: string; args: string } | null {
  const match = segment.match(/^(\w+)\((.*)?\)$/s);
  if (!match) return null;
  return { name: match[1], args: (match[2] ?? '').trim() };
}

/**
 * Parse a single DSL segment into a StepConfig.
 * Returns null if the segment is not a recognised operation.
 */
function parseDslToStep(segment: string): StepConfig | null {
  const call = parseOpCall(segment);
  if (!call) return null;

  const { name, args } = call;

  switch (name) {
    case 'where':
      return { type: 'where', config: { condition: args } };

    case 'select': {
      const items = splitTopLevel(args, ',').map(s => s.trim()).filter(Boolean);
      const fields: string[] = [];
      const expressions: string[] = [];
      for (const item of items) {
        // An expression is anything containing operators, function calls, or 'as' alias
        if (/\s+as\s+/i.test(item) || /[()*/+\-]/.test(item)) {
          expressions.push(item);
        } else {
          fields.push(item);
        }
      }
      return { type: 'select', config: { fields, expressions } };
    }

    case 'sort': {
      const items = splitTopLevel(args, ',').map(s => s.trim()).filter(Boolean);
      const criteria = items.map(item => {
        const parts = item.split(/\s+/);
        const field = parts[0];
        const direction: 'asc' | 'desc' =
          parts.length > 1 && parts[parts.length - 1].toLowerCase() === 'desc'
            ? 'desc'
            : 'asc';
        return { field, direction };
      });
      return { type: 'sort', config: { criteria } };
    }

    case 'groupBy': {
      const fields = splitTopLevel(args, ',').map(s => s.trim()).filter(Boolean);
      return { type: 'groupBy', config: { fields } };
    }

    case 'join': {
      // join(rightSource, condition) — first arg is source, rest is condition
      const firstComma = findTopLevelComma(args);
      if (firstComma === -1) {
        return { type: 'join', config: { rightSource: args.trim(), condition: '' } };
      }
      const rightSource = args.slice(0, firstComma).trim();
      const condition = args.slice(firstComma + 1).trim();
      return { type: 'join', config: { rightSource, condition } };
    }

    case 'first': {
      const count = parseInt(args, 10);
      return { type: 'first', config: { count: isNaN(count) ? 10 : count } };
    }

    case 'last': {
      const count = parseInt(args, 10);
      return { type: 'last', config: { count: isNaN(count) ? 10 : count } };
    }

    case 'distinct': {
      const fields = args ? splitTopLevel(args, ',').map(s => s.trim()).filter(Boolean) : [];
      return { type: 'distinct', config: { fields } };
    }

    case 'map': {
      const expressions = splitTopLevel(args, ',').map(s => s.trim()).filter(Boolean);
      return { type: 'map', config: { expressions } };
    }

    case 'reduce': {
      const firstComma = findTopLevelComma(args);
      if (firstComma === -1) {
        return { type: 'reduce', config: { initial: args.trim(), accumulator: '' } };
      }
      return {
        type: 'reduce',
        config: {
          initial: args.slice(0, firstComma).trim(),
          accumulator: args.slice(firstComma + 1).trim(),
        },
      };
    }

    case 'rollup': {
      const items = splitTopLevel(args, ',').map(s => s.trim()).filter(Boolean);
      // Heuristic: items without parens/operators are keys, rest are aggregates
      const keys: string[] = [];
      const aggregates: string[] = [];
      for (const item of items) {
        if (/[()]/.test(item)) {
          aggregates.push(item);
        } else {
          keys.push(item);
        }
      }
      return { type: 'rollup', config: { keys, aggregates } };
    }

    case 'pivot': {
      const firstComma = findTopLevelComma(args);
      if (firstComma === -1) {
        return { type: 'pivot', config: { pivotField: args.trim(), aggregates: [] } };
      }
      const pivotField = args.slice(0, firstComma).trim();
      const rest = args.slice(firstComma + 1).trim();
      const aggregates = splitTopLevel(rest, ',').map(s => s.trim()).filter(Boolean);
      return { type: 'pivot', config: { pivotField, aggregates } };
    }

    case 'flatten':
      return { type: 'flatten', config: { field: args || '' } };

    case 'transpose':
      return { type: 'transpose', config: { headerField: args || '' } };

    default:
      return null;
  }
}

/** Find the index of the first top-level comma in a string. */
function findTopLevelComma(input: string): number {
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const prev = i > 0 ? input[i - 1] : '';
    if (ch === "'" && !inDoubleQuote && prev !== '\\') inSingleQuote = !inSingleQuote;
    else if (ch === '"' && !inSingleQuote && prev !== '\\') inDoubleQuote = !inDoubleQuote;
    else if (!inSingleQuote && !inDoubleQuote) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === ',' && depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Parse a pipequery DSL string into a source and array of PipelineSteps.
 * This is the inverse of `generateQuery()`.
 *
 * Best-effort: unrecognised operations are silently skipped.
 *
 * @example
 * ```ts
 * const { source, steps } = parseQueryToSteps('crypto | sort(price desc) | first(10)');
 * // source === 'crypto'
 * // steps has 2 entries: sort and first
 * ```
 */
export function parseQueryToSteps(query: string): { source: string; steps: PipelineStep[] } {
  if (!query || !query.trim()) return { source: '', steps: [] };

  const segments = splitTopLevel(query.trim(), '|');
  if (segments.length === 0) return { source: '', steps: [] };

  const source = segments[0].trim();
  const steps: PipelineStep[] = [];
  let idCounter = 0;

  for (let i = 1; i < segments.length; i++) {
    const stepConfig = parseDslToStep(segments[i]);
    if (stepConfig) {
      steps.push({ id: `pq_${idCounter++}`, step: stepConfig });
    }
  }

  return { source, steps };
}
