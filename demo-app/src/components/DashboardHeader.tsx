import { useState, useEffect } from 'react';
import { Box, Typography, IconButton, Tooltip, Chip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsIcon from '@mui/icons-material/Settings';
import { ThemeToggle } from '../colorMode';
import { C, FONT_MONO } from '../tokens';

const squareBtnSx = {
  width: 28,
  height: 28,
  border: '1px solid',
  borderColor: C.border,
  color: C.textMuted,
  transition: 'color 0.15s, border-color 0.15s',
  '&:hover': { color: C.text, borderColor: C.borderHover, bgcolor: 'transparent' },
};

interface DashboardHeaderProps {
  lastUpdated: Date | null;
  loading: boolean;
  tick: number;
  onRefresh: () => void;
  onSettingsOpen: () => void;
}

export default function DashboardHeader({ lastUpdated, loading, tick, onRefresh, onSettingsOpen }: DashboardHeaderProps) {
  const [ago, setAgo] = useState('');

  useEffect(() => {
    if (!lastUpdated) return;
    const update = () => {
      const secs = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
      if (secs < 5) setAgo('just now');
      else if (secs < 60) setAgo(`${secs}s ago`);
      else setAgo(`${Math.floor(secs / 60)}m ago`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 1,
        mb: 2,
        pt: 1.5,
        pb: 1.5,
        borderBottom: '1px solid',
        borderColor: C.border,
      }}
    >
      <Box>
        <Typography
          variant="h5"
          sx={{
            color: C.text,
            fontWeight: 600,
            fontSize: '1.15rem',
            letterSpacing: '-0.01em',
          }}
        >
          PipeQuery <Box component="span" sx={{ color: C.textMuted, fontWeight: 400 }}>Demo</Box>
        </Typography>
        <Typography variant="body2" sx={{ color: C.textMuted, fontSize: '0.75rem' }}>
          Fetch once. Query everywhere.
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {lastUpdated && (
          <Chip
            icon={
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  bgcolor: loading ? C.orange : C.up,
                  animation: loading ? 'none' : 'pulse 2s infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.4 },
                  },
                }}
              />
            }
            label={`${ago} · tick #${tick}`}
            size="small"
            variant="outlined"
            sx={{ color: C.textMuted, borderColor: C.border, fontFamily: FONT_MONO, fontSize: '0.68rem', height: 28, '& .MuiChip-icon': { ml: 1 } }}
          />
        )}
        <Tooltip title="Refresh now">
          <span>
            <IconButton size="small" onClick={onRefresh} disabled={loading} sx={squareBtnSx}>
              <RefreshIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Settings">
          <IconButton size="small" onClick={onSettingsOpen} sx={squareBtnSx}>
            <SettingsIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <ThemeToggle />
      </Box>
    </Box>
  );
}
