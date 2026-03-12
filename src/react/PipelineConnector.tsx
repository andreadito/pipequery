import { useState } from 'react';
import { Box, IconButton, alpha } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import StepPicker, { CompactPicker } from './StepPicker';
import type { OperationType, Orientation } from './types';

export default function PipelineConnector({
  orientation,
  compact,
  onInsert,
}: {
  orientation: Orientation;
  compact: boolean;
  onInsert: (type: OperationType) => void;
}) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const isH = orientation === 'horizontal';

  const lineLen = compact ? 6 : 10;
  const btnSize = compact ? 20 : 26;
  const iconSize = compact ? 12 : 14;

  // Compact mode: inline dropdown instead of popover
  if (compact) {
    return (
      <Box sx={{
        display: 'flex',
        flexDirection: isH ? 'row' : 'column',
        alignItems: 'center',
        ...(isH ? { py: 0 } : { px: 0 }),
      }}>
        <Box sx={{
          ...(isH
            ? { height: 2, width: lineLen, bgcolor: (t: any) => alpha(t.palette.text.secondary, 0.15) }
            : { width: 2, height: lineLen, bgcolor: (t: any) => alpha(t.palette.text.secondary, 0.15) }
          ),
        }} />
        <CompactPicker onSelect={onInsert} />
        <Box sx={{
          ...(isH
            ? { height: 2, width: lineLen, bgcolor: (t: any) => alpha(t.palette.text.secondary, 0.15) }
            : { width: 2, height: lineLen, bgcolor: (t: any) => alpha(t.palette.text.secondary, 0.15) }
          ),
        }} />
      </Box>
    );
  }

  // Normal mode: "+" button with popover
  return (
    <Box sx={{
      display: 'flex',
      flexDirection: isH ? 'row' : 'column',
      alignItems: 'center',
      ...(isH ? { py: 0 } : { py: 0.25 }),
    }}>
      <Box sx={{
        ...(isH
          ? { height: 2, width: lineLen, bgcolor: (t: any) => alpha(t.palette.text.secondary, 0.2) }
          : { width: 2, height: lineLen, bgcolor: (t: any) => alpha(t.palette.text.secondary, 0.2) }
        ),
      }} />
      <IconButton
        size="small"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{
          width: btnSize,
          height: btnSize,
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
        <AddIcon sx={{ fontSize: iconSize }} />
      </IconButton>
      <Box sx={{
        ...(isH
          ? { height: 2, width: lineLen, bgcolor: (t: any) => alpha(t.palette.text.secondary, 0.2) }
          : { width: 2, height: lineLen, bgcolor: (t: any) => alpha(t.palette.text.secondary, 0.2) }
        ),
      }} />

      <StepPicker
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        onSelect={(type) => { onInsert(type); setAnchorEl(null); }}
        compact={false}
        orientation={orientation}
      />
    </Box>
  );
}
