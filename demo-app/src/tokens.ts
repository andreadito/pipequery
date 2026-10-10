// ─── Shared design tokens ───────────────────────────────────────────────────
// Every colour resolves to a CSS custom property defined in index.css, so the
// whole site re-themes when <html data-theme="light|dark"> changes.

export const C = {
  bg: 'var(--pq-bg)',
  surface: 'var(--pq-surface)',
  surfaceAlt: 'var(--pq-bg)',
  surfaceHover: 'var(--pq-surface-hover)',
  border: 'var(--pq-border)',
  borderHover: 'var(--pq-border-hover)',
  blue: 'var(--pq-blue)',
  blueHover: 'var(--pq-blue-hover)',
  blueGlow: 'color-mix(in srgb, var(--pq-blue) 12%, transparent)',
  orange: 'var(--pq-orange)',
  orangeGlow: 'color-mix(in srgb, var(--pq-orange) 10%, transparent)',
  up: 'var(--pq-up)',
  down: 'var(--pq-down)',
  text: 'var(--pq-text)',
  textMuted: 'var(--pq-text-muted)',
  textDim: 'var(--pq-text-dim)',
  keyword: 'var(--pq-keyword)',
  string: 'var(--pq-string)',
  number: 'var(--pq-number)',
  operator: 'var(--pq-operator)',
  field: 'var(--pq-field)',
  fn: 'var(--pq-fn)',
  comment: 'var(--pq-comment)',
  bool: 'var(--pq-keyword)',
};

/**
 * Translucent version of any colour — works with hex values *and* CSS
 * variables (MUI's `alpha()` cannot parse `var(...)`).
 */
export function alpha(color: string, opacity: number): string {
  const pct = Math.round(Math.max(0, Math.min(1, opacity)) * 1000) / 10;
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

export const FONT_SANS = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
export const FONT_MONO = '"JetBrains Mono", "SF Mono", Menlo, monospace';
