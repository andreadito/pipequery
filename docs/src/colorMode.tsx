import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Box, CssBaseline, ThemeProvider } from '@mui/material';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import { createAppTheme, type ColorMode } from './theme';
import { C } from './tokens';

const STORAGE_KEY = 'pq-color-mode';

const META_THEME_COLOR: Record<ColorMode, string> = {
  dark: '#0b0d10',
  light: '#ffffff',
};

function initialMode(): ColorMode {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.dataset.theme;
    if (attr === 'light' || attr === 'dark') return attr;
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch { /* storage unavailable */ }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

interface ColorModeContextValue {
  mode: ColorMode;
  toggle: () => void;
}

const ColorModeContext = createContext<ColorModeContextValue>({ mode: 'dark', toggle: () => {} });

export function useColorMode() {
  return useContext(ColorModeContext);
}

export function ColorModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ColorMode>(initialMode);

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_THEME_COLOR[mode]);
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((m) => {
      const next = m === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* storage unavailable */ }
      return next;
    });
  }, []);

  const theme = useMemo(() => createAppTheme(mode), [mode]);
  const value = useMemo(() => ({ mode, toggle }), [mode, toggle]);

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export function ThemeToggle() {
  const { mode, toggle } = useColorMode();
  const label = mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <Box
      component="button"
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        p: 0,
        bgcolor: 'transparent',
        border: '1px solid',
        borderColor: C.border,
        color: C.textMuted,
        cursor: 'pointer',
        transition: 'color 0.15s, border-color 0.15s',
        '&:hover': { color: C.text, borderColor: C.borderHover },
      }}
    >
      {mode === 'dark'
        ? <LightModeOutlinedIcon sx={{ fontSize: 16 }} />
        : <DarkModeOutlinedIcon sx={{ fontSize: 16 }} />}
    </Box>
  );
}
