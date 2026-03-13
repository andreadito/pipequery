import { useState } from 'react';
import { Box, Typography, alpha } from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import Playground from './demo/Playground.tsx';
import Docs from './demo/Docs.tsx';
import HomePage from './demo/HomePage.tsx';

type View = 'home' | 'playground' | 'docs';

const C = {
  bg: '#0a0e14',
  border: 'rgba(255,255,255,0.06)',
  blue: '#5b9cf6',
  text: '#e0e6ed',
  textMuted: '#8899aa',
};

export default function App() {
  const [view, setView] = useState<View>('home');

  if (view === 'home') {
    return <HomePage onNavigate={(v) => setView(v)} />;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: C.bg }}>
      {/* ── Navbar matching homepage ── */}
      <Box sx={{
        position: 'sticky', top: 0, zIndex: 100,
        backdropFilter: 'blur(12px)',
        bgcolor: alpha(C.bg, 0.8),
        borderBottom: '1px solid', borderColor: C.border,
      }}>
        <Box sx={{
          maxWidth: 1120, mx: 'auto', px: { xs: 2, md: 4 },
          display: 'flex', alignItems: 'center', height: 56,
        }}>
          {/* Logo */}
          <Box
            onClick={() => setView('home')}
            sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1, cursor: 'pointer' }}
          >
            <Box component="span" sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 22, fontWeight: 700, color: C.blue, lineHeight: 1,
              textShadow: `0 0 20px ${alpha(C.blue, 0.5)}, 0 0 40px ${alpha(C.blue, 0.2)}`,
            }}>
              |
            </Box>
            <Typography sx={{
              fontSize: '1.1rem', fontWeight: 700, color: C.text,
              fontFamily: '"JetBrains Mono", monospace',
              letterSpacing: '-0.02em',
            }}>
              PipeQuery
            </Typography>
            <Box sx={{
              ml: 0.5, px: 0.8, py: 0.15, borderRadius: 0.8,
              bgcolor: alpha(C.blue, 0.1), border: '1px solid', borderColor: alpha(C.blue, 0.2),
            }}>
              <Typography sx={{
                fontSize: '0.65rem', fontWeight: 600, color: C.blue,
                fontFamily: '"JetBrains Mono", monospace',
              }}>
                v1.0
              </Typography>
            </Box>
          </Box>

          {/* Nav links */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, md: 3 } }}>
            {(['playground', 'docs'] as const).map((v) => (
              <Typography
                key={v}
                onClick={() => setView(v)}
                sx={{
                  fontSize: '0.85rem', fontWeight: 500,
                  color: view === v ? C.text : C.textMuted,
                  cursor: 'pointer', transition: 'color 0.2s',
                  fontFamily: '"DM Sans", sans-serif',
                  position: 'relative',
                  '&:hover': { color: C.text },
                  ...(view === v && {
                    '&::after': {
                      content: '""', position: 'absolute',
                      bottom: -18, left: 0, right: 0, height: 2,
                      bgcolor: C.blue,
                      borderRadius: 1,
                    },
                  }),
                }}
              >
                {v === 'playground' ? 'Playground' : 'Docs'}
              </Typography>
            ))}
            <Box
              component="a"
              href="https://github.com/andreadito/pipequery"
              target="_blank"
              rel="noopener"
              sx={{
                display: 'flex', alignItems: 'center', color: C.textMuted,
                transition: 'color 0.2s', '&:hover': { color: C.text },
              }}
            >
              <GitHubIcon sx={{ fontSize: 20 }} />
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ── Content ── */}
      <Box sx={{ flex: 1, maxWidth: 1120, mx: 'auto', width: '100%', px: { xs: 2, md: 4 }, py: 2 }}>
        {view === 'playground' ? <Playground /> : <Docs />}
      </Box>
    </Box>
  );
}
