import { useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Chip,
  Container,
  alpha,
} from '@mui/material';
import DataObjectIcon from '@mui/icons-material/DataObject';
import Playground from './demo/Playground.tsx';
import Docs from './demo/Docs.tsx';

type View = 'playground' | 'docs';

export default function App() {
  const [view, setView] = useState<View>('playground');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static" elevation={0} sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar variant="dense">
          <DataObjectIcon sx={{ mr: 1.5, color: 'primary.main' }} />
          <Typography variant="h6" sx={{ flexGrow: 1, fontSize: '1.1rem' }}>
            PipeQuery
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.8 }}>
            {(['playground', 'docs'] as const).map((v) => (
              <Chip
                key={v}
                label={v === 'playground' ? 'Playground' : 'Docs'}
                size="small"
                color="primary"
                variant={view === v ? 'filled' : 'outlined'}
                onClick={() => setView(v)}
                sx={{
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.15s ease',
                  ...(view !== v && {
                    borderColor: alpha('#5b9cf6', 0.3),
                    color: alpha('#5b9cf6', 0.7),
                    '&:hover': {
                      bgcolor: alpha('#5b9cf6', 0.08),
                      borderColor: '#5b9cf6',
                      color: '#5b9cf6',
                    },
                  }),
                }}
              />
            ))}
          </Box>
        </Toolbar>
      </AppBar>
      <Container maxWidth={false} sx={{ mt: 2, mb: 2, flex: 1, px: 2 }}>
        {view === 'playground' ? <Playground /> : <Docs />}
      </Container>
    </Box>
  );
}
