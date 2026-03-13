import { useState, useEffect } from 'react';
import { Box, Typography, IconButton, Tooltip, Chip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsIcon from '@mui/icons-material/Settings';

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
      }}
    >
      <Box>
        <Typography
          variant="h5"
          sx={{
            background: 'linear-gradient(135deg, #5b9cf6 0%, #ff9800 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: 700,
            fontSize: '1.4rem',
          }}
        >
          PipeQuery Demo
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>
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
                  borderRadius: '50%',
                  bgcolor: loading ? '#ffa726' : '#4caf50',
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
            sx={{ color: 'text.secondary', borderColor: 'divider', fontSize: '0.7rem', height: 24 }}
          />
        )}
        <Tooltip title="Refresh now">
          <IconButton size="small" onClick={onRefresh} disabled={loading}>
            <RefreshIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Settings">
          <IconButton size="small" onClick={onSettingsOpen}>
            <SettingsIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
