import {
  TextField,
  Stack,
  Autocomplete,
  ToggleButton,
  ToggleButtonGroup,
  Button,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  alpha,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import type { StepConfig } from './types';

const MONO = '"JetBrains Mono", "Fira Code", monospace';

// Ensure Autocomplete poppers render above Dialogs (z-index 1300)
const POPPER_PROPS = { style: { zIndex: 1400 } } as const;

// ─── Aggregate Function Catalog ────────────────────────────────────────────

interface AggEntry { group: string; name: string; hint: string }

const AGG_CATALOG: AggEntry[] = [
  { group: 'Basic',        name: 'count',          hint: 'Row count' },
  { group: 'Basic',        name: 'sum',            hint: 'Total' },
  { group: 'Basic',        name: 'avg',            hint: 'Arithmetic mean' },
  { group: 'Basic',        name: 'min',            hint: 'Minimum' },
  { group: 'Basic',        name: 'max',            hint: 'Maximum' },
  { group: 'Statistical',  name: 'median',         hint: '50th percentile' },
  { group: 'Statistical',  name: 'stddev',         hint: 'Std deviation' },
  { group: 'Statistical',  name: 'var',            hint: 'Variance' },
  { group: 'Statistical',  name: 'percentile',     hint: 'p-th percentile (2-arg)' },
  { group: 'Distribution', name: 'skew',           hint: 'Skewness' },
  { group: 'Distribution', name: 'kurt',           hint: 'Excess kurtosis' },
  { group: 'Finance',      name: 'vwap',           hint: 'Vol-weighted avg price (2-arg)' },
  { group: 'Finance',      name: 'wavg',           hint: 'Weighted average (2-arg)' },
  { group: 'Finance',      name: 'drawdown',       hint: 'Max peak-to-trough decline' },
  { group: 'Ratios',       name: 'pct',            hint: 'Group % of total' },
  { group: 'Ratios',       name: 'sharpe',         hint: 'mean / stddev' },
  { group: 'Ratios',       name: 'calmar',         hint: 'mean / |max drawdown|' },
  { group: 'Ratios',       name: 'sortino',        hint: 'mean / downside dev' },
  { group: 'Ratios',       name: 'info_ratio',     hint: 'Information ratio (2-arg)' },
  { group: 'Counting',     name: 'distinct_count',  hint: 'Unique values' },
  { group: 'Counting',     name: 'sum_abs',         hint: 'Sum of |values|' },
  { group: 'Counting',     name: 'abs_sum',         hint: '|Sum of values|' },
  { group: 'Counting',     name: 'first_value',     hint: 'First in group' },
  { group: 'Counting',     name: 'last_value',      hint: 'Last in group' },
];

const AGG_NAMES_SET = new Set(AGG_CATALOG.map(a => a.name));
const TWO_ARG_FNS = new Set(['percentile', 'vwap', 'wavg', 'info_ratio']);

// ─── Parse / Serialize aggregate expressions ────────────────────────────────

interface ParsedAgg { fn: string; field: string; field2: string; alias: string }

const AGG_RE = /^(\w+)\(\s*([^,)]*?)\s*(?:,\s*([^)]*?)\s*)?\)(?:\s+as\s+(\w+))?$/;

function parseAggExpr(expr: string): ParsedAgg | null {
  if (!expr.trim()) return { fn: '', field: '', field2: '', alias: '' };
  const m = expr.trim().match(AGG_RE);
  if (!m) return null; // complex expression — fallback to raw
  const [, fn, field = '', field2 = '', alias = ''] = m;
  if (!AGG_NAMES_SET.has(fn)) return null;
  return { fn, field: field.trim(), field2: field2.trim(), alias: alias.trim() };
}

function serializeAgg(p: ParsedAgg): string {
  if (!p.fn) return '';
  const args = p.field2 ? `${p.field}, ${p.field2}` : p.field;
  const base = `${p.fn}(${args})`;
  return p.alias ? `${base} as ${p.alias}` : base;
}

// ─── AggregateExprRow ───────────────────────────────────────────────────────

function AggregateExprRow({
  value,
  availableFields,
  compact,
  onChangeValue,
  onDelete,
  canDelete,
}: {
  value: string;
  availableFields: string[];
  compact: boolean;
  onChangeValue: (v: string) => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const mono = { fontFamily: MONO, fontSize: compact ? '0.72rem' : '0.8rem' };
  const parsed = parseAggExpr(value);

  // Fallback to raw TextField if expression can't be parsed as an aggregate
  if (parsed === null) {
    return (
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
        <TextField
          size="small" fullWidth placeholder="e.g. sum(revenue) as total"
          value={value}
          onChange={e => onChangeValue(e.target.value)}
          slotProps={{ input: { sx: mono } }}
        />
        {canDelete && (
          <IconButton size="small" sx={{ p: 0.25 }} onClick={onDelete}>
            <DeleteOutlineIcon sx={{ fontSize: compact ? 12 : 14 }} />
          </IconButton>
        )}
      </Stack>
    );
  }

  const isTwoArg = TWO_ARG_FNS.has(parsed.fn);

  const update = (patch: Partial<ParsedAgg>) => {
    const next = { ...parsed, ...patch };
    // Clear field2 if switching away from a 2-arg fn
    if (patch.fn !== undefined && !TWO_ARG_FNS.has(patch.fn)) {
      next.field2 = '';
    }
    onChangeValue(serializeAgg(next));
  };

  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
      {/* Function picker */}
      <Autocomplete
        size="small"
        options={AGG_CATALOG}
        groupBy={opt => opt.group}
        getOptionLabel={opt => (typeof opt === 'string' ? opt : opt.name)}
        isOptionEqualToValue={(opt, val) => opt.name === (typeof val === 'string' ? val : val.name)}
        value={AGG_CATALOG.find(a => a.name === parsed.fn) ?? null}
        onChange={(_, v) => update({ fn: (v as AggEntry | null)?.name ?? '' })}
        slotProps={{ popper: POPPER_PROPS }}
        renderOption={(props, opt) => (
          <Box component="li" {...props} key={opt.name} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography sx={{ fontFamily: MONO, fontSize: '0.78rem', fontWeight: 600, color: '#82aaff', minWidth: 90 }}>
              {opt.name}
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', color: alpha('#fff', 0.45) }}>
              {opt.hint}
            </Typography>
          </Box>
        )}
        sx={{ minWidth: compact ? 100 : 130, flex: '0 1 auto' }}
        renderInput={p => (
          <TextField {...p} placeholder="fn" sx={{ '& input': { ...mono, minWidth: '60px !important' } }} />
        )}
      />

      {/* Field 1 */}
      {parsed.fn !== '' && parsed.fn !== 'count' && (
        <Autocomplete
          size="small" freeSolo options={availableFields}
          value={parsed.field}
          onInputChange={(_, v) => update({ field: v })}
          sx={{ minWidth: compact ? 80 : 100, flex: 1 }}
          slotProps={{ popper: POPPER_PROPS }}
          renderInput={p => (
            <TextField {...p} placeholder="field" sx={{ '& input': mono }} />
          )}
        />
      )}

      {/* Field 2 (for two-arg aggregates) */}
      {isTwoArg && (
        <Autocomplete
          size="small" freeSolo options={availableFields}
          value={parsed.field2}
          onInputChange={(_, v) => update({ field2: v })}
          sx={{ minWidth: compact ? 80 : 100, flex: 1 }}
          slotProps={{ popper: POPPER_PROPS }}
          renderInput={p => (
            <TextField {...p} placeholder="arg2" sx={{ '& input': mono }} />
          )}
        />
      )}

      {/* Alias */}
      <TextField
        size="small" placeholder="as"
        value={parsed.alias}
        onChange={e => update({ alias: e.target.value })}
        sx={{ width: compact ? 60 : 80 }}
        slotProps={{ input: { sx: { ...mono, px: 0.5 } } }}
      />

      {/* Delete */}
      {canDelete && (
        <IconButton size="small" sx={{ p: 0.25 }} onClick={onDelete}>
          <DeleteOutlineIcon sx={{ fontSize: compact ? 12 : 14 }} />
        </IconButton>
      )}
    </Stack>
  );
}

// ─── Aggregate list helper (shared by rollup, pivot, select) ────────────────

function AggregateList({
  aggregates,
  availableFields,
  compact,
  btnSz,
  onChange,
}: {
  aggregates: string[];
  availableFields: string[];
  compact: boolean;
  btnSz: string;
  onChange: (aggregates: string[]) => void;
}) {
  return (
    <>
      {aggregates.map((agg, i) => (
        <AggregateExprRow
          key={i}
          value={agg}
          availableFields={availableFields}
          compact={compact}
          canDelete={aggregates.length > 1}
          onChangeValue={v => {
            const next = [...aggregates];
            next[i] = v;
            onChange(next);
          }}
          onDelete={() => onChange(aggregates.filter((_, j) => j !== i))}
        />
      ))}
      <Button size="small" sx={{ fontSize: btnSz, py: 0.25, alignSelf: 'flex-start' }}
        onClick={() => onChange([...aggregates, ''])}>
        + agg
      </Button>
    </>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function StepConfigForm({
  step,
  availableFields,
  joinSources,
  compact,
  onChange,
}: {
  step: StepConfig;
  availableFields: string[];
  joinSources: string[];
  compact: boolean;
  onChange: (step: StepConfig) => void;
}) {
  const sp = compact ? 0.5 : 1;
  const mono = { fontFamily: MONO, fontSize: compact ? '0.72rem' : '0.8rem' };
  const btnSz = compact ? '0.65rem' : '0.75rem';

  switch (step.type) {
    case 'where':
      return (
        <TextField
          size="small" fullWidth placeholder="e.g. price > 100"
          value={step.config.condition}
          onChange={e => onChange({ ...step, config: { condition: e.target.value } })}
          slotProps={{ input: { sx: mono } }}
        />
      );

    case 'select':
      return (
        <Stack spacing={sp}>
          <Autocomplete
            multiple size="small" freeSolo options={availableFields}
            value={step.config.fields}
            onChange={(_, v) => onChange({ ...step, config: { ...step.config, fields: v } })}
            slotProps={{ popper: POPPER_PROPS }}
            renderInput={p => <TextField {...p} placeholder="Fields..." sx={{ '& input': mono }} />}
          />
          <AggregateList
            aggregates={step.config.expressions}
            availableFields={availableFields}
            compact={compact}
            btnSz={btnSz}
            onChange={expressions => onChange({ ...step, config: { ...step.config, expressions } })}
          />
        </Stack>
      );

    case 'sort':
      return (
        <Stack spacing={sp}>
          {step.config.criteria.map((c, i) => (
            <Stack key={i} direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <Autocomplete
                size="small" freeSolo options={availableFields} sx={{ flex: 1 }}
                value={c.field}
                slotProps={{ popper: POPPER_PROPS }}
                onInputChange={(_, v) => {
                  const criteria = [...step.config.criteria];
                  criteria[i] = { ...criteria[i], field: v };
                  onChange({ ...step, config: { criteria } });
                }}
                renderInput={p => <TextField {...p} placeholder="Field" sx={{ '& input': mono }} />}
              />
              <ToggleButtonGroup
                size="small" exclusive
                value={c.direction}
                onChange={(_, v) => {
                  if (!v) return;
                  const criteria = [...step.config.criteria];
                  criteria[i] = { ...criteria[i], direction: v };
                  onChange({ ...step, config: { criteria } });
                }}
              >
                <ToggleButton value="asc" sx={{ px: 0.75, fontSize: compact ? '0.6rem' : '0.7rem' }}>ASC</ToggleButton>
                <ToggleButton value="desc" sx={{ px: 0.75, fontSize: compact ? '0.6rem' : '0.7rem' }}>DESC</ToggleButton>
              </ToggleButtonGroup>
              {step.config.criteria.length > 1 && (
                <IconButton size="small" sx={{ p: 0.25 }} onClick={() => {
                  const criteria = step.config.criteria.filter((_, j) => j !== i);
                  onChange({ ...step, config: { criteria } });
                }}>
                  <DeleteOutlineIcon sx={{ fontSize: compact ? 12 : 14 }} />
                </IconButton>
              )}
            </Stack>
          ))}
          <Button size="small" sx={{ fontSize: btnSz, py: 0.25, alignSelf: 'flex-start' }}
            onClick={() => onChange({ ...step, config: { criteria: [...step.config.criteria, { field: '', direction: 'asc' as const }] } })}>
            + criterion
          </Button>
        </Stack>
      );

    case 'groupBy':
      return (
        <Autocomplete
          multiple size="small" freeSolo options={availableFields}
          value={step.config.fields}
          onChange={(_, v) => onChange({ ...step, config: { fields: v } })}
          slotProps={{ popper: POPPER_PROPS }}
          renderInput={p => <TextField {...p} placeholder="Fields to group by..." sx={{ '& input': mono }} />}
        />
      );

    case 'join':
      return (
        <Stack spacing={sp}>
          <FormControl size="small" fullWidth>
            <InputLabel>Right source</InputLabel>
            <Select
              value={step.config.rightSource}
              label="Right source"
              onChange={e => onChange({ ...step, config: { ...step.config, rightSource: e.target.value } })}
              MenuProps={{ style: { zIndex: 1400 } }}
            >
              {joinSources.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField
            size="small" fullWidth placeholder="e.g. customerId == id"
            value={step.config.condition}
            onChange={e => onChange({ ...step, config: { ...step.config, condition: e.target.value } })}
            slotProps={{ input: { sx: mono } }}
          />
        </Stack>
      );

    case 'first':
    case 'last':
      return (
        <TextField
          size="small" type="number" fullWidth
          value={step.config.count}
          onChange={e => onChange({ ...step, config: { count: Number(e.target.value) || 1 } })}
          slotProps={{ input: { sx: mono } }}
        />
      );

    case 'distinct':
      return (
        <Autocomplete
          multiple size="small" freeSolo options={availableFields}
          value={step.config.fields}
          onChange={(_, v) => onChange({ ...step, config: { fields: v } })}
          slotProps={{ popper: POPPER_PROPS }}
          renderInput={p => <TextField {...p} placeholder="Fields (empty = all)..." sx={{ '& input': mono }} />}
        />
      );

    case 'map':
      return (
        <Stack spacing={sp}>
          {step.config.expressions.map((expr, i) => (
            <TextField
              key={i} size="small" fullWidth placeholder="e.g. price * 1.1 as priceWithTax"
              value={expr}
              onChange={e => {
                const expressions = [...step.config.expressions];
                expressions[i] = e.target.value;
                onChange({ ...step, config: { expressions } });
              }}
              slotProps={{ input: { sx: mono } }}
            />
          ))}
          <Button size="small" sx={{ fontSize: btnSz, py: 0.25, alignSelf: 'flex-start' }}
            onClick={() => onChange({ ...step, config: { expressions: [...step.config.expressions, ''] } })}>
            + expr
          </Button>
        </Stack>
      );

    case 'reduce':
      return (
        <Stack spacing={sp}>
          <TextField
            size="small" fullWidth label="Initial" placeholder="e.g. 0"
            value={step.config.initial}
            onChange={e => onChange({ ...step, config: { ...step.config, initial: e.target.value } })}
            slotProps={{ input: { sx: mono } }}
          />
          <TextField
            size="small" fullWidth label="Accumulator" placeholder="e.g. _acc + price"
            value={step.config.accumulator}
            onChange={e => onChange({ ...step, config: { ...step.config, accumulator: e.target.value } })}
            slotProps={{ input: { sx: mono } }}
          />
        </Stack>
      );

    case 'rollup':
      return (
        <Stack spacing={sp}>
          <Autocomplete
            multiple size="small" freeSolo options={availableFields}
            value={step.config.keys}
            onChange={(_, v) => onChange({ ...step, config: { ...step.config, keys: v } })}
            slotProps={{ popper: POPPER_PROPS }}
            renderInput={p => <TextField {...p} placeholder="Group keys..." sx={{ '& input': mono }} />}
          />
          <AggregateList
            aggregates={step.config.aggregates}
            availableFields={availableFields}
            compact={compact}
            btnSz={btnSz}
            onChange={aggregates => onChange({ ...step, config: { ...step.config, aggregates } })}
          />
        </Stack>
      );

    case 'pivot':
      return (
        <Stack spacing={sp}>
          <Autocomplete
            size="small" freeSolo options={availableFields}
            value={step.config.pivotField}
            onInputChange={(_, v) => onChange({ ...step, config: { ...step.config, pivotField: v } })}
            slotProps={{ popper: POPPER_PROPS }}
            renderInput={p => <TextField {...p} placeholder="Pivot field..." sx={{ '& input': mono }} />}
          />
          <AggregateList
            aggregates={step.config.aggregates}
            availableFields={availableFields}
            compact={compact}
            btnSz={btnSz}
            onChange={aggregates => onChange({ ...step, config: { ...step.config, aggregates } })}
          />
        </Stack>
      );

    case 'flatten':
      return (
        <Autocomplete
          size="small" freeSolo options={availableFields}
          value={step.config.field}
          onInputChange={(_, v) => onChange({ ...step, config: { field: v } })}
          slotProps={{ popper: POPPER_PROPS }}
          renderInput={p => <TextField {...p} placeholder="Field (optional)..." sx={{ '& input': mono }} />}
        />
      );

    case 'transpose':
      return (
        <Autocomplete
          size="small" freeSolo options={availableFields}
          value={step.config.headerField}
          onInputChange={(_, v) => onChange({ ...step, config: { headerField: v } })}
          slotProps={{ popper: POPPER_PROPS }}
          renderInput={p => <TextField {...p} placeholder="Header field..." sx={{ '& input': mono }} />}
        />
      );
  }
}
