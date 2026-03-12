import {
  Paper,
  Stack,
  Typography,
  Box,
  IconButton,
  Collapse,
  alpha,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { OperationIcon } from './icons';
import StepConfigForm from './StepConfigForm';
import {
  type PipelineStep,
  type StepConfig,
  type Orientation,
  OPERATION_META,
  getStepSummary,
} from './types';

export default function StepCard({
  step,
  isFirst,
  isLast,
  expanded,
  onToggleExpand,
  availableFields,
  joinSources,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  orientation,
  compact,
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
  orientation: Orientation;
  compact: boolean;
}) {
  const meta = OPERATION_META[step.step.type];
  const summary = getStepSummary(step.step);
  const isH = orientation === 'horizontal';
  const iconSz = compact ? 14 : 16;
  const actionIconSz = compact ? 12 : 14;

  const PrevIcon = isH ? ArrowBackIcon : ArrowUpwardIcon;
  const NextIcon = isH ? ArrowForwardIcon : ArrowDownwardIcon;

  return (
    <Paper
      variant="outlined"
      sx={{
        overflow: 'hidden',
        ...(isH ? {
          borderTop: '3px solid',
          borderTopColor: meta.color,
          borderRadius: '8px 8px 4px 4px',
          width: compact ? (expanded ? 240 : 140) : (expanded ? 280 : 200),
          flexShrink: 0,
          alignSelf: 'stretch',
          transition: 'box-shadow 0.2s, width 0.25s ease',
        } : {
          borderLeft: '4px solid',
          borderLeftColor: meta.color,
          borderRadius: '4px 8px 8px 4px',
          transition: 'box-shadow 0.2s',
        }),
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
      {/* Header */}
      <Stack
        direction="row"
        spacing={0.5}
        alignItems="center"
        onClick={onToggleExpand}
        sx={{
          px: compact ? 0.75 : 1.25,
          py: compact ? 0.375 : 0.75,
          cursor: 'pointer',
          '&:hover': { bgcolor: alpha(meta.color, 0.04) },
        }}
      >
        <Box sx={{ color: meta.color, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <OperationIcon type={step.step.type} size={iconSz} />
        </Box>

        {/* In compact mode: icon + summary only. Normal: icon + label + summary */}
        {!compact && (
          <Typography sx={{
            fontWeight: 600,
            fontSize: '0.75rem',
            whiteSpace: 'nowrap',
          }}>
            {meta.shortLabel}
          </Typography>
        )}

        {!expanded && (
          <Typography
            sx={{
              color: 'text.secondary',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: compact ? '0.62rem' : '0.68rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0,
            }}
          >
            {compact ? `${meta.shortLabel}: ${summary}` : summary}
          </Typography>
        )}

        {expanded && <Box sx={{ flex: 1 }} />}

        {/* Hover actions */}
        <Stack
          direction="row"
          spacing={0}
          className="step-actions"
          onClick={e => e.stopPropagation()}
          sx={{ flexShrink: 0 }}
        >
          <IconButton size="small" onClick={onMoveUp} disabled={isFirst} sx={{ p: compact ? 0.25 : 0.375 }}>
            <PrevIcon sx={{ fontSize: actionIconSz }} />
          </IconButton>
          <IconButton size="small" onClick={onMoveDown} disabled={isLast} sx={{ p: compact ? 0.25 : 0.375 }}>
            <NextIcon sx={{ fontSize: actionIconSz }} />
          </IconButton>
          <IconButton size="small" onClick={onRemove} sx={{ p: compact ? 0.25 : 0.375, color: 'error.main' }}>
            <DeleteOutlineIcon sx={{ fontSize: actionIconSz }} />
          </IconButton>
        </Stack>

        <ExpandMoreIcon sx={{
          fontSize: compact ? 14 : 18,
          color: 'text.secondary',
          transition: 'transform 0.2s',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          flexShrink: 0,
        }} />
      </Stack>

      {/* Config form */}
      <Collapse in={expanded} timeout={200}>
        <Box sx={{ px: compact ? 0.75 : 1.25, pb: compact ? 0.75 : 1.25 }}>
          <StepConfigForm
            step={step.step}
            availableFields={availableFields}
            joinSources={joinSources}
            compact={compact}
            onChange={onUpdate}
          />
        </Box>
      </Collapse>
    </Paper>
  );
}
