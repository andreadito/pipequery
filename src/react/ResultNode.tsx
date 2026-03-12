import { Paper, Stack, Typography, Box, alpha } from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';
import type { Orientation } from './types';

export default function ResultNode({
  query,
  orientation,
  compact,
}: {
  query: string;
  orientation: Orientation;
  compact: boolean;
}) {
  const isH = orientation === 'horizontal';

  return (
    <Paper
      variant="outlined"
      sx={{
        p: compact ? 0.75 : 1.5,
        ...(isH ? {
          borderRight: '3px solid',
          borderRightColor: 'success.main',
          width: compact ? 160 : 220,
          flexShrink: 0,
          alignSelf: 'stretch',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        } : {
          borderBottom: '3px solid',
          borderBottomColor: 'success.main',
        }),
        background: (t) => `linear-gradient(135deg, ${alpha(t.palette.success.main, 0.04)} 0%, transparent 60%)`,
      }}
    >
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: compact ? 0.25 : 0.75 }}>
        <CodeIcon sx={{ fontSize: compact ? 14 : 18, color: 'success.main' }} />
        <Typography sx={{ fontWeight: 600, fontSize: compact ? '0.65rem' : '0.8rem' }}>
          Query
        </Typography>
      </Stack>
      <Box sx={{
        p: compact ? 0.5 : 1,
        bgcolor: 'background.default',
        borderRadius: 0.5,
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: compact ? '0.62rem' : '0.72rem',
        color: 'text.primary',
        minHeight: compact ? 20 : 32,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        lineHeight: 1.5,
        overflow: 'hidden',
        maxHeight: isH ? 80 : 'none',
      }}>
        {query || '\u2014'}
      </Box>
    </Paper>
  );
}
