/**
 * Monaco token theme rules for PipeQuery.
 * Use with `monaco.editor.defineTheme()`.
 *
 * Colors match the project's dark theme palette from Docs.tsx.
 */
export const tokenThemeRules = [
  { token: 'keyword', foreground: 'c792ea', fontStyle: 'bold' },
  { token: 'type.function', foreground: 'ffcb6b' },
  { token: 'variable', foreground: '82aaff' },
  { token: 'string', foreground: 'c3e88d' },
  { token: 'string.escape', foreground: 'c3e88d', fontStyle: 'bold' },
  { token: 'number', foreground: 'f78c6c' },
  { token: 'operator', foreground: '89ddff' },
  { token: 'operator.pipe', foreground: '89ddff', fontStyle: 'bold' },
  { token: 'delimiter', foreground: '89ddff' },
  { token: 'comment', foreground: '546e7a', fontStyle: 'italic' },
];
