import { useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  Stack,
  Popover,
  Select,
  MenuItem,
  ListSubheader,
  alpha,
} from '@mui/material';
import { OperationIcon } from './icons';
import {
  type OperationType,
  type Orientation,
  OPERATION_META,
  CATEGORIES_ORDERED,
  CATEGORY_COLORS,
} from './types';

// ─── Full Popover Picker (normal mode) ──────────────────────────────────────

function PopoverPicker({ anchorEl, onClose, onSelect, orientation }: {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onSelect: (type: OperationType) => void;
  orientation: Orientation;
}) {
  const isH = orientation === 'horizontal';
  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={isH
        ? { vertical: 'bottom', horizontal: 'center' }
        : { vertical: 'center', horizontal: 'right' }
      }
      transformOrigin={isH
        ? { vertical: 'top', horizontal: 'center' }
        : { vertical: 'center', horizontal: 'left' }
      }
      slotProps={{ paper: { sx: { p: 1.5, minWidth: 240, maxWidth: 320 } } }}
    >
      {CATEGORIES_ORDERED.map(({ key, label, ops }) => (
        <Box key={key} sx={{ mb: 1.25, '&:last-child': { mb: 0 } }}>
          <Typography
            variant="caption"
            sx={{
              color: CATEGORY_COLORS[key],
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontSize: '0.58rem',
              mb: 0.4,
              display: 'block',
            }}
          >
            {label}
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            {ops.map(op => (
              <Chip
                key={op}
                label={OPERATION_META[op].shortLabel}
                size="small"
                icon={<OperationIcon type={op} size={14} />}
                onClick={() => onSelect(op)}
                variant="outlined"
                sx={{
                  cursor: 'pointer',
                  height: 24,
                  fontSize: '0.68rem',
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

// ─── Compact Select Picker ──────────────────────────────────────────────────

function CompactPicker({ onSelect }: {
  onSelect: (type: OperationType) => void;
}) {
  const [value, setValue] = useState<string>('');

  return (
    <Select
      size="small"
      value={value}
      displayEmpty
      onChange={e => {
        const v = e.target.value as OperationType;
        if (v) {
          onSelect(v);
          setValue('');
        }
      }}
      renderValue={() => (
        <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>+ step</Typography>
      )}
      sx={{
        minWidth: 70,
        height: 22,
        '& .MuiSelect-select': { py: 0.25, px: 0.75 },
        fontSize: '0.7rem',
      }}
    >
      {CATEGORIES_ORDERED.map(({ key, label, ops }) => [
        <ListSubheader
          key={`h-${key}`}
          sx={{
            fontSize: '0.58rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: CATEGORY_COLORS[key],
            lineHeight: '24px',
            bgcolor: 'background.paper',
          }}
        >
          {label}
        </ListSubheader>,
        ...ops.map(op => (
          <MenuItem
            key={op}
            value={op}
            sx={{
              fontSize: '0.7rem',
              py: 0.25,
              minHeight: 'auto',
              gap: 0.75,
              color: CATEGORY_COLORS[key],
            }}
          >
            <OperationIcon type={op} size={13} />
            {OPERATION_META[op].shortLabel}
          </MenuItem>
        )),
      ]).flat()}
    </Select>
  );
}

// ─── Exported Wrapper ───────────────────────────────────────────────────────

export default function StepPicker({
  anchorEl,
  onClose,
  onSelect,
  compact,
  orientation,
}: {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onSelect: (type: OperationType) => void;
  compact: boolean;
  orientation: Orientation;
}) {
  if (compact) {
    // In compact mode, the picker is inline — anchorEl/onClose are unused
    // The parent renders <StepPicker> directly; it manages its own state
    return null;
  }
  return (
    <PopoverPicker
      anchorEl={anchorEl}
      onClose={onClose}
      onSelect={onSelect}
      orientation={orientation}
    />
  );
}

// Re-export for inline use in compact mode
export { CompactPicker };
