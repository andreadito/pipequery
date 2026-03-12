import {
  Paper,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  alpha,
} from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import type { Orientation } from './types';

export default function SourceNode({
  source,
  onSourceChange,
  availableSources,
  rowCount,
  orientation,
  compact,
}: {
  source: string;
  onSourceChange: (s: string) => void;
  availableSources: string[];
  rowCount?: number;
  orientation: Orientation;
  compact: boolean;
}) {
  const isH = orientation === 'horizontal';
  const iconSz = compact ? 16 : 20;
  const chipFontSz = compact ? '0.6rem' : '0.7rem';

  return (
    <Paper
      variant="outlined"
      sx={{
        p: compact ? 0.75 : 1.5,
        ...(isH ? {
          borderLeft: '3px solid',
          borderLeftColor: 'primary.main',
          width: compact ? 140 : 180,
          flexShrink: 0,
          alignSelf: 'stretch',
          display: 'flex',
          alignItems: 'center',
        } : {
          borderTop: '3px solid',
          borderTopColor: 'primary.main',
        }),
        background: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.06)} 0%, transparent 60%)`,
      }}
    >
      <Stack
        direction={isH && compact ? 'column' : 'row'}
        spacing={compact ? 0.5 : 1}
        alignItems={isH && compact ? 'flex-start' : 'center'}
        sx={{ width: '100%' }}
      >
        <StorageIcon sx={{ color: 'primary.main', fontSize: iconSz }} />
        <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
          {!compact && <InputLabel>Source</InputLabel>}
          <Select
            value={source}
            label={compact ? undefined : 'Source'}
            onChange={e => onSourceChange(e.target.value)}
            sx={{
              fontSize: compact ? '0.72rem' : '0.85rem',
              '& .MuiSelect-select': compact ? { py: 0.5, px: 0.75 } : {},
            }}
          >
            {availableSources.map(s => (
              <MenuItem key={s} value={s} sx={{ fontSize: compact ? '0.72rem' : '0.85rem' }}>{s}</MenuItem>
            ))}
          </Select>
        </FormControl>
        {rowCount != null && (
          <Chip
            label={`${rowCount.toLocaleString()}`}
            size="small"
            variant="outlined"
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: chipFontSz,
              height: compact ? 18 : 24,
              borderColor: (t) => alpha(t.palette.primary.main, 0.3),
            }}
          />
        )}
      </Stack>
    </Paper>
  );
}
