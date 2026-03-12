import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Chip,
  IconButton,
  Autocomplete,
  ToggleButton,
  ToggleButtonGroup,
  Button,
  Collapse,
  Popover,
  alpha,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import StorageIcon from '@mui/icons-material/Storage';
import CodeIcon from '@mui/icons-material/Code';
import FilterListIcon from '@mui/icons-material/FilterList';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import WorkspacesIcon from '@mui/icons-material/Workspaces';
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import MergeTypeIcon from '@mui/icons-material/MergeType';
import TransformIcon from '@mui/icons-material/Transform';
import BarChartIcon from '@mui/icons-material/BarChart';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import CompressIcon from '@mui/icons-material/Compress';
import DeblurIcon from '@mui/icons-material/Deblur';
import PivotTableChartIcon from '@mui/icons-material/PivotTableChart';
import type { DataContext } from '../../../src/engine/index.ts';
import {
  type PipelineStep,
  type OperationType,
  type StepConfig,
  createDefaultConfig,
  generateQuery,
  OPERATION_META,
  CATEGORIES_ORDERED,
  CATEGORY_COLORS,
  getStepSummary,
} from './query-builder-types.ts';

// ─── Icon Map ────────────────────────────────────────────────────────────────

const OPERATION_ICONS: Record<OperationType, React.ReactElement> = {
  where:     <FilterListIcon sx={{ fontSize: 16 }} />,
  distinct:  <DeblurIcon sx={{ fontSize: 16 }} />,
  select:    <ViewColumnIcon sx={{ fontSize: 16 }} />,
  map:       <TransformIcon sx={{ fontSize: 16 }} />,
  flatten:   <UnfoldLessIcon sx={{ fontSize: 16 }} />,
  transpose: <SwapHorizIcon sx={{ fontSize: 16 }} />,
  sort:      <SwapVertIcon sx={{ fontSize: 16 }} />,
  groupBy:   <WorkspacesIcon sx={{ fontSize: 16 }} />,
  reduce:    <CompressIcon sx={{ fontSize: 16 }} />,
  rollup:    <BarChartIcon sx={{ fontSize: 16 }} />,
  pivot:     <PivotTableChartIcon sx={{ fontSize: 16 }} />,
  first:     <VerticalAlignTopIcon sx={{ fontSize: 16 }} />,
  last:      <VerticalAlignBottomIcon sx={{ fontSize: 16 }} />,
  join:      <MergeTypeIcon sx={{ fontSize: 16 }} />,
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface QueryBuilderProps {
  source: string;
  onSourceChange: (source: string) => void;
  availableSources: string[];
  availableFields: string[];
  dataContext: DataContext;
  onQueryChange: (query: string) => void;
}

let nextStepId = 1;

// ─── Main Component ──────────────────────────────────────────────────────────

export default function QueryBuilder({
  source,
  onSourceChange,
  availableSources,
  availableFields,
  dataContext,
  onQueryChange,
}: QueryBuilderProps) {
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const generatedQuery = useMemo(
    () => generateQuery(source, steps),
    [source, steps],
  );

  useEffect(() => {
    onQueryChange(generatedQuery);
  }, [generatedQuery, onQueryChange]);

  const insertStepAt = useCallback((index: number, type: OperationType) => {
    const newId = `step_${nextStepId++}`;
    setSteps(prev => {
      const next = [...prev];
      next.splice(index, 0, { id: newId, step: createDefaultConfig(type) });
      return next;
    });
    setExpandedId(newId);
  }, []);

  const removeStep = useCallback((id: string) => {
    setSteps(prev => prev.filter(s => s.id !== id));
    setExpandedId(prev => prev === id ? null : prev);
  }, []);

  const moveStep = useCallback((id: string, direction: 'up' | 'down') => {
    setSteps(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (idx < 0) return prev;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  }, []);

  const updateStep = useCallback((id: string, newStep: StepConfig) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, step: newStep } : s));
  }, []);

  const joinSources = useMemo(
    () => Object.keys(dataContext).filter(k => k !== source),
    [dataContext, source],
  );

  const rowCount = useMemo(() => {
    const d = dataContext[source];
    return Array.isArray(d) ? d.length : 0;
  }, [dataContext, source]);

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      overflow: 'auto',
      flex: 1,
      py: 1,
    }}>
      <Box sx={{ width: '100%', maxWidth: 520 }}>
        {/* Source Node */}
        <SourceNode
          source={source}
          onSourceChange={onSourceChange}
          availableSources={availableSources}
          rowCount={rowCount}
        />

        {/* Connector before first step */}
        <PipelineConnector onInsert={(type) => insertStepAt(0, type)} />

        {/* Step Cards */}
        {steps.map((step, idx) => (
          <Box key={step.id}>
            <StepCard
              step={step}
              isFirst={idx === 0}
              isLast={idx === steps.length - 1}
              expanded={expandedId === step.id}
              onToggleExpand={() => setExpandedId(expandedId === step.id ? null : step.id)}
              availableFields={availableFields}
              joinSources={joinSources}
              onUpdate={(newStep) => updateStep(step.id, newStep)}
              onRemove={() => removeStep(step.id)}
              onMoveUp={() => moveStep(step.id, 'up')}
              onMoveDown={() => moveStep(step.id, 'down')}
            />
            <PipelineConnector onInsert={(type) => insertStepAt(idx + 1, type)} />
          </Box>
        ))}

        {/* Result Node */}
        <ResultNode query={generatedQuery} />
      </Box>
    </Box>
  );
}

// ─── Source Node ──────────────────────────────────────────────────────────────

function SourceNode({ source, onSourceChange, availableSources, rowCount }: {
  source: string;
  onSourceChange: (s: string) => void;
  availableSources: string[];
  rowCount: number;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderTop: '3px solid',
        borderTopColor: 'primary.main',
        background: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.06)} 0%, transparent 60%)`,
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <StorageIcon sx={{ color: 'primary.main', fontSize: 20 }} />
        <FormControl size="small" sx={{ flex: 1 }}>
          <InputLabel>Source</InputLabel>
          <Select value={source} label="Source" onChange={e => onSourceChange(e.target.value)}>
            {availableSources.map(s => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Chip
          label={`${rowCount.toLocaleString()} rows`}
          size="small"
          variant="outlined"
          sx={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.7rem',
            borderColor: (t) => alpha(t.palette.primary.main, 0.3),
          }}
        />
      </Stack>
    </Paper>
  );
}

// ─── Pipeline Connector ──────────────────────────────────────────────────────

function PipelineConnector({ onInsert }: { onInsert: (type: OperationType) => void }) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      py: 0.25,
    }}>
      <Box sx={{
        width: 2,
        height: 10,
        bgcolor: (t) => alpha(t.palette.text.secondary, 0.2),
      }} />
      <IconButton
        size="small"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{
          width: 26,
          height: 26,
          border: '2px dashed',
          borderColor: (t) => alpha(t.palette.text.secondary, 0.25),
          color: 'text.secondary',
          transition: 'all 0.2s',
          '&:hover': {
            borderColor: 'primary.main',
            borderStyle: 'solid',
            color: 'primary.main',
            bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
            transform: 'scale(1.15)',
          },
        }}
      >
        <AddIcon sx={{ fontSize: 14 }} />
      </IconButton>
      <Box sx={{
        width: 2,
        height: 10,
        bgcolor: (t) => alpha(t.palette.text.secondary, 0.2),
      }} />

      <StepPicker
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        onSelect={(type) => { onInsert(type); setAnchorEl(null); }}
      />
    </Box>
  );
}

// ─── Step Picker (Categorized Popover) ───────────────────────────────────────

function StepPicker({ anchorEl, onClose, onSelect }: {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onSelect: (type: OperationType) => void;
}) {
  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'center', horizontal: 'right' }}
      transformOrigin={{ vertical: 'center', horizontal: 'left' }}
      slotProps={{
        paper: {
          sx: { p: 2, minWidth: 260, maxWidth: 340 },
        },
      }}
    >
      {CATEGORIES_ORDERED.map(({ key, label, ops }) => (
        <Box key={key} sx={{ mb: 1.5, '&:last-child': { mb: 0 } }}>
          <Typography
            variant="caption"
            sx={{
              color: CATEGORY_COLORS[key],
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontSize: '0.6rem',
              mb: 0.5,
              display: 'block',
            }}
          >
            {label}
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.75}>
            {ops.map(op => (
              <Chip
                key={op}
                label={OPERATION_META[op].label}
                size="small"
                icon={OPERATION_ICONS[op]}
                onClick={() => onSelect(op)}
                variant="outlined"
                sx={{
                  cursor: 'pointer',
                  borderColor: alpha(CATEGORY_COLORS[key], 0.35),
                  color: CATEGORY_COLORS[key],
                  '& .MuiChip-icon': { color: CATEGORY_COLORS[key] },
                  '&:hover': {
                    bgcolor: alpha(CATEGORY_COLORS[key], 0.12),
                    borderColor: CATEGORY_COLORS[key],
                  },
                }}
              />
            ))}
          </Stack>
        </Box>
      ))}
    </Popover>
  );
}

// ─── Step Card ───────────────────────────────────────────────────────────────

function StepCard({
  step, isFirst, isLast, expanded, onToggleExpand,
  availableFields, joinSources,
  onUpdate, onRemove, onMoveUp, onMoveDown,
}: {
  step: PipelineStep;
  isFirst: boolean;
  isLast: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  availableFields: string[];
  joinSources: string[];
  onUpdate: (step: StepConfig) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const meta = OPERATION_META[step.step.type];
  const summary = getStepSummary(step.step);

  return (
    <Paper
      variant="outlined"
      sx={{
        borderLeft: '4px solid',
        borderLeftColor: meta.color,
        borderRadius: '4px 8px 8px 4px',
        overflow: 'hidden',
        transition: 'box-shadow 0.2s',
        '&:hover': {
          boxShadow: `0 0 0 1px ${alpha(meta.color, 0.25)}`,
        },
        '& .step-actions': {
          opacity: 0,
          transition: 'opacity 0.15s',
        },
        '&:hover .step-actions': {
          opacity: 1,
        },
      }}
    >
      {/* Header — always visible, clickable */}
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        onClick={onToggleExpand}
        sx={{
          px: 1.5,
          py: 1,
          cursor: 'pointer',
          '&:hover': {
            bgcolor: alpha(meta.color, 0.04),
          },
        }}
      >
        <Box sx={{ color: meta.color, display: 'flex', alignItems: 'center' }}>
          {OPERATION_ICONS[step.step.type]}
        </Box>
        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
          {meta.label}
        </Typography>
        {!expanded && (
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.7rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 180,
            }}
          >
            {summary}
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />

        {/* Hover actions */}
        <Stack direction="row" spacing={0.25} className="step-actions" onClick={e => e.stopPropagation()}>
          <IconButton size="small" onClick={onMoveUp} disabled={isFirst} sx={{ p: 0.5 }}>
            <ArrowUpwardIcon sx={{ fontSize: 14 }} />
          </IconButton>
          <IconButton size="small" onClick={onMoveDown} disabled={isLast} sx={{ p: 0.5 }}>
            <ArrowDownwardIcon sx={{ fontSize: 14 }} />
          </IconButton>
          <IconButton size="small" onClick={onRemove} sx={{ p: 0.5, color: 'error.main' }}>
            <DeleteOutlineIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Stack>

        <ExpandMoreIcon sx={{
          fontSize: 18,
          color: 'text.secondary',
          transition: 'transform 0.2s',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
        }} />
      </Stack>

      {/* Expandable config form */}
      <Collapse in={expanded} timeout={200}>
        <Box sx={{ px: 1.5, pb: 1.5 }}>
          <StepConfigForm
            step={step.step}
            availableFields={availableFields}
            joinSources={joinSources}
            onChange={onUpdate}
          />
        </Box>
      </Collapse>
    </Paper>
  );
}

// ─── Result Node ─────────────────────────────────────────────────────────────

function ResultNode({ query }: { query: string }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderBottom: '3px solid',
        borderBottomColor: 'success.main',
        background: (t) => `linear-gradient(135deg, ${alpha(t.palette.success.main, 0.04)} 0%, transparent 60%)`,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <CodeIcon sx={{ fontSize: 18, color: 'success.main' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
          Generated Query
        </Typography>
      </Stack>
      <Box sx={{
        p: 1.5,
        bgcolor: 'background.default',
        borderRadius: 1,
        fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
        fontSize: '0.75rem',
        color: 'text.primary',
        minHeight: 32,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        lineHeight: 1.6,
      }}>
        {query || '(select a source to begin)'}
      </Box>
    </Paper>
  );
}

// ─── Config Forms ────────────────────────────────────────────────────────────

const monoSx = { fontFamily: '"JetBrains Mono", monospace', fontSize: '0.8rem' };

function StepConfigForm({
  step, availableFields, joinSources, onChange,
}: {
  step: StepConfig;
  availableFields: string[];
  joinSources: string[];
  onChange: (step: StepConfig) => void;
}) {
  switch (step.type) {
    case 'where':
      return (
        <TextField
          size="small" fullWidth placeholder="e.g. price > 100"
          value={step.config.condition}
          onChange={e => onChange({ ...step, config: { condition: e.target.value } })}
          slotProps={{ input: { sx: monoSx } }}
        />
      );

    case 'select':
      return (
        <Stack spacing={1}>
          <Autocomplete
            multiple size="small" freeSolo options={availableFields}
            value={step.config.fields}
            onChange={(_, v) => onChange({ ...step, config: { ...step.config, fields: v } })}
            renderInput={p => <TextField {...p} placeholder="Fields..." InputProps={p.InputProps} sx={{ '& input': monoSx }} />}
          />
          {step.config.expressions.map((expr, i) => (
            <TextField
              key={i} size="small" fullWidth placeholder="e.g. price * 1.1 as priceWithTax"
              value={expr}
              onChange={e => {
                const exprs = [...step.config.expressions];
                exprs[i] = e.target.value;
                onChange({ ...step, config: { ...step.config, expressions: exprs } });
              }}
              slotProps={{ input: { sx: monoSx } }}
            />
          ))}
          <Button size="small" onClick={() => onChange({ ...step, config: { ...step.config, expressions: [...step.config.expressions, ''] } })}>
            + expression
          </Button>
        </Stack>
      );

    case 'sort':
      return (
        <Stack spacing={1}>
          {step.config.criteria.map((c, i) => (
            <Stack key={i} direction="row" spacing={1} alignItems="center">
              <Autocomplete
                size="small" freeSolo options={availableFields} sx={{ flex: 1 }}
                value={c.field}
                onInputChange={(_, v) => {
                  const criteria = [...step.config.criteria];
                  criteria[i] = { ...criteria[i], field: v };
                  onChange({ ...step, config: { criteria } });
                }}
                renderInput={p => <TextField {...p} placeholder="Field" InputProps={p.InputProps} sx={{ '& input': monoSx }} />}
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
                <ToggleButton value="asc" sx={{ px: 1, fontSize: '0.7rem' }}>ASC</ToggleButton>
                <ToggleButton value="desc" sx={{ px: 1, fontSize: '0.7rem' }}>DESC</ToggleButton>
              </ToggleButtonGroup>
              {step.config.criteria.length > 1 && (
                <IconButton size="small" onClick={() => {
                  const criteria = step.config.criteria.filter((_, j) => j !== i);
                  onChange({ ...step, config: { criteria } });
                }}>
                  <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                </IconButton>
              )}
            </Stack>
          ))}
          <Button size="small" onClick={() => onChange({ ...step, config: { criteria: [...step.config.criteria, { field: '', direction: 'asc' as const }] } })}>
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
          renderInput={p => <TextField {...p} placeholder="Fields to group by..." InputProps={p.InputProps} sx={{ '& input': monoSx }} />}
        />
      );

    case 'join':
      return (
        <Stack spacing={1}>
          <FormControl size="small" fullWidth>
            <InputLabel>Right source</InputLabel>
            <Select
              value={step.config.rightSource}
              label="Right source"
              onChange={e => onChange({ ...step, config: { ...step.config, rightSource: e.target.value } })}
            >
              {joinSources.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField
            size="small" fullWidth placeholder="e.g. customerId == id"
            value={step.config.condition}
            onChange={e => onChange({ ...step, config: { ...step.config, condition: e.target.value } })}
            slotProps={{ input: { sx: monoSx } }}
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
          slotProps={{ input: { sx: monoSx } }}
        />
      );

    case 'distinct':
      return (
        <Autocomplete
          multiple size="small" freeSolo options={availableFields}
          value={step.config.fields}
          onChange={(_, v) => onChange({ ...step, config: { fields: v } })}
          renderInput={p => <TextField {...p} placeholder="Fields (empty = all)..." InputProps={p.InputProps} sx={{ '& input': monoSx }} />}
        />
      );

    case 'map':
      return (
        <Stack spacing={1}>
          {step.config.expressions.map((expr, i) => (
            <TextField
              key={i} size="small" fullWidth placeholder="e.g. price * 1.1 as priceWithTax"
              value={expr}
              onChange={e => {
                const expressions = [...step.config.expressions];
                expressions[i] = e.target.value;
                onChange({ ...step, config: { expressions } });
              }}
              slotProps={{ input: { sx: monoSx } }}
            />
          ))}
          <Button size="small" onClick={() => onChange({ ...step, config: { expressions: [...step.config.expressions, ''] } })}>
            + expression
          </Button>
        </Stack>
      );

    case 'reduce':
      return (
        <Stack spacing={1}>
          <TextField
            size="small" fullWidth label="Initial value" placeholder="e.g. 0"
            value={step.config.initial}
            onChange={e => onChange({ ...step, config: { ...step.config, initial: e.target.value } })}
            slotProps={{ input: { sx: monoSx } }}
          />
          <TextField
            size="small" fullWidth label="Accumulator" placeholder="e.g. _acc + price"
            value={step.config.accumulator}
            onChange={e => onChange({ ...step, config: { ...step.config, accumulator: e.target.value } })}
            slotProps={{ input: { sx: monoSx } }}
          />
        </Stack>
      );

    case 'rollup':
      return (
        <Stack spacing={1}>
          <Autocomplete
            multiple size="small" freeSolo options={availableFields}
            value={step.config.keys}
            onChange={(_, v) => onChange({ ...step, config: { ...step.config, keys: v } })}
            renderInput={p => <TextField {...p} placeholder="Group keys..." InputProps={p.InputProps} sx={{ '& input': monoSx }} />}
          />
          {step.config.aggregates.map((agg, i) => (
            <TextField
              key={i} size="small" fullWidth placeholder="e.g. sum(revenue) as total"
              value={agg}
              onChange={e => {
                const aggregates = [...step.config.aggregates];
                aggregates[i] = e.target.value;
                onChange({ ...step, config: { ...step.config, aggregates } });
              }}
              slotProps={{ input: { sx: monoSx } }}
            />
          ))}
          <Button size="small" onClick={() => onChange({ ...step, config: { ...step.config, aggregates: [...step.config.aggregates, ''] } })}>
            + aggregate
          </Button>
        </Stack>
      );

    case 'pivot':
      return (
        <Stack spacing={1}>
          <Autocomplete
            size="small" freeSolo options={availableFields}
            value={step.config.pivotField}
            onInputChange={(_, v) => onChange({ ...step, config: { ...step.config, pivotField: v } })}
            renderInput={p => <TextField {...p} placeholder="Pivot field..." InputProps={p.InputProps} sx={{ '& input': monoSx }} />}
          />
          {step.config.aggregates.map((agg, i) => (
            <TextField
              key={i} size="small" fullWidth placeholder="e.g. sum(revenue)"
              value={agg}
              onChange={e => {
                const aggregates = [...step.config.aggregates];
                aggregates[i] = e.target.value;
                onChange({ ...step, config: { ...step.config, aggregates } });
              }}
              slotProps={{ input: { sx: monoSx } }}
            />
          ))}
          <Button size="small" onClick={() => onChange({ ...step, config: { ...step.config, aggregates: [...step.config.aggregates, ''] } })}>
            + aggregate
          </Button>
        </Stack>
      );

    case 'flatten':
      return (
        <Autocomplete
          size="small" freeSolo options={availableFields}
          value={step.config.field}
          onInputChange={(_, v) => onChange({ ...step, config: { field: v } })}
          renderInput={p => <TextField {...p} placeholder="Field (optional)..." InputProps={p.InputProps} sx={{ '& input': monoSx }} />}
        />
      );

    case 'transpose':
      return (
        <Autocomplete
          size="small" freeSolo options={availableFields}
          value={step.config.headerField}
          onInputChange={(_, v) => onChange({ ...step, config: { headerField: v } })}
          renderInput={p => <TextField {...p} placeholder="Header field (optional)..." InputProps={p.InputProps} sx={{ '& input': monoSx }} />}
        />
      );
  }
}
