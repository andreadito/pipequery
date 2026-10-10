import { createTheme } from '@mui/material/styles';
import { FONT_MONO, FONT_SANS } from './tokens';

export type ColorMode = 'light' | 'dark';

// Concrete values mirror the CSS variables in index.css. MUI needs real colours
// (not var(...)) in the palette so it can compute contrast/hover shades.
// Also used by the charts: SVG presentation attributes cannot resolve var(...).
export const PALETTES = {
  dark: {
    bg: '#0b0d10',
    paper: '#111418',
    border: '#1f242b',
    borderHover: '#333a44',
    primary: '#3b82f6',
    accent: '#e8a33d',
    up: '#22ab94',
    down: '#f23645',
    text: '#e6e8eb',
    textMuted: '#8b939e',
  },
  light: {
    bg: '#ffffff',
    paper: '#f7f8fa',
    border: '#e3e6ea',
    borderHover: '#c4c9d0',
    primary: '#1f6feb',
    accent: '#b06a00',
    up: '#089981',
    down: '#d9273a',
    text: '#0f1419',
    textMuted: '#59616c',
  },
} as const;

export function createAppTheme(mode: ColorMode) {
  const p = PALETTES[mode];
  return createTheme({
    palette: {
      mode,
      primary: { main: p.primary },
      secondary: { main: p.accent },
      success: { main: p.up },
      error: { main: p.down },
      warning: { main: p.accent },
      background: { default: p.bg, paper: p.paper },
      divider: p.border,
      text: { primary: p.text, secondary: p.textMuted },
    },
    typography: {
      fontFamily: FONT_SANS,
      h5: { fontWeight: 600, letterSpacing: '-0.01em' },
      h6: { fontWeight: 600 },
      subtitle1: { fontWeight: 600 },
      body2: { color: p.textMuted },
    },
    shape: {
      borderRadius: 0,
    },
    shadows: Array(25).fill('none') as ReturnType<typeof createTheme>['shadows'],
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          code: { fontFamily: FONT_MONO },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: '1px solid',
            borderColor: p.border,
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          size: 'small',
          variant: 'outlined',
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-notchedOutline': { borderColor: p.border },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: p.borderHover },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 1 },
          },
        },
      },
      MuiButton: {
        defaultProps: {
          size: 'small',
          disableElevation: true,
          disableRipple: true,
        },
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 500,
          },
        },
      },
      MuiIconButton: {
        defaultProps: { disableRipple: true },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontFamily: FONT_MONO, fontWeight: 500 },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: p.text,
            color: p.bg,
            fontFamily: FONT_MONO,
            fontSize: '0.7rem',
          },
        },
      },
    },
  });
}
