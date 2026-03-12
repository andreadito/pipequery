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
