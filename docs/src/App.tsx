import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import Playground from './demo/Playground.tsx';
import Docs from './demo/Docs.tsx';
import HomePage from './demo/HomePage.tsx';
import pkgJson from '../../package.json';
import { C, FONT_MONO, FONT_SANS } from './tokens';
import { ThemeToggle } from './colorMode';

type View = 'home' | 'playground' | 'docs';

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
        bgcolor: C.bg,
        borderBottom: '1px solid', borderColor: C.border,
      }}>
        <Box sx={{
          maxWidth: 1120, mx: 'auto', px: { xs: 2, md: 4 },
          display: 'flex', alignItems: 'center', height: 48,
        }}>
          {/* Logo */}
          <Box
            onClick={() => setView('home')}
            sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1, cursor: 'pointer' }}
          >
            <Box component="span" sx={{
              fontFamily: FONT_MONO,
              fontSize: 20, fontWeight: 700, color: C.blue, lineHeight: 1,
            }}>
              |
            </Box>
            <Typography sx={{
              fontSize: '0.95rem', fontWeight: 600, color: C.text,
              fontFamily: FONT_MONO,
              letterSpacing: '-0.02em',
            }}>
              PipeQuery
            </Typography>
            <Box sx={{
              ml: 0.5, px: 0.6, py: 0.1,
              border: '1px solid', borderColor: C.border,
            }}>
              <Typography sx={{
                fontSize: '0.65rem', fontWeight: 500, color: C.textMuted,
                fontFamily: FONT_MONO,
              }}>
                v{pkgJson.version}
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
                  fontSize: '0.8rem', fontWeight: 500,
                  color: view === v ? C.text : C.textMuted,
                  cursor: 'pointer', transition: 'color 0.2s',
                  fontFamily: FONT_SANS,
                  position: 'relative',
                  '&:hover': { color: C.text },
                  ...(view === v && {
                    '&::after': {
                      content: '""', position: 'absolute',
                      bottom: -15, left: 0, right: 0, height: 2,
                      bgcolor: C.blue,
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
              <GitHubIcon sx={{ fontSize: 18 }} />
            </Box>
            <ThemeToggle />
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
