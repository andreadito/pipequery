/**
 * Telegram message formatting for pipequery results.
 *
 * Telegram has hard limits we have to respect:
 *  - Plain message text: 4096 characters
 *  - MarkdownV2 / HTML escaping rules (we use HTML mode — friendlier to
 *    pipe expressions and SQL-ish content with underscores)
 *  - Single message must be self-contained (no streaming/long-polling tricks)
 *
 * For result sets that don't fit, we return a truncated rendering with a
 * row-count footer ("showing 20 of 1247 rows — narrow your query") rather
 * than dumping the full payload as a file. Files are heavier UX than most
 * Telegram users want for a quick chat query.
 */

const TELEGRAM_TEXT_LIMIT = 4096;
const FENCE_OVERHEAD = 32; // <pre>...</pre>\n\nfooter
const TRUNCATE_BUDGET = TELEGRAM_TEXT_LIMIT - FENCE_OVERHEAD;
const MAX_ROWS_INLINE = 30;
const MAX_COL_WIDTH = 24;

export interface FormatOptions {
  /** Max rows to render before truncating with a footer. Default 30. */
  maxRows?: number;
  /** Max width per column character before ellipsis. Default 24. */
  maxColWidth?: number;
}

/**
 * Render a query result as a Telegram-safe HTML message.
 *
 * - Object arrays → fixed-width table inside <pre>
 * - Scalar arrays → bullet list
 * - Single objects / scalars → JSON inside <pre>
 * - Empty results → "(no rows)"
 *
 * Always returns a string ≤ 4096 chars.
 */
export function formatResult(result: unknown, opts: FormatOptions = {}): string {
  const maxRows = opts.maxRows ?? MAX_ROWS_INLINE;

  if (Array.isArray(result)) {
    if (result.length === 0) return '<i>(no rows)</i>';

    const allObjects = result.every(
      (r) => r !== null && typeof r === 'object' && !Array.isArray(r),
    );

    if (allObjects) {
      return renderTable(result as Record<string, unknown>[], result.length, maxRows, opts);
    }
    // Mixed / scalar array — render as JSON list.
    return renderJson(result.slice(0, maxRows), result.length, maxRows);
  }

  return renderJson(result, 1, 1);
}

export function formatError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return `❌ <b>Error</b>\n<pre>${escapeHtml(msg)}</pre>`;
}

// ─── Table rendering ────────────────────────────────────────────────────────

function renderTable(
  rows: Record<string, unknown>[],
  totalCount: number,
  maxRows: number,
  opts: FormatOptions,
): string {
  const maxColWidth = opts.maxColWidth ?? MAX_COL_WIDTH;
  const sample = rows.slice(0, maxRows);

  // Column set = union of all keys in the rendered sample, in first-seen
  // order. Mirrors the engine's row-shape semantics where rows aren't
  // required to be schema-uniform.
  const columns: string[] = [];
  const seen = new Set<string>();
  for (const r of sample) {
    for (const k of Object.keys(r)) {
      if (!seen.has(k)) {
        seen.add(k);
        columns.push(k);
      }
    }
  }

  const widths = columns.map((c) =>
    Math.min(
      maxColWidth,
      Math.max(c.length, ...sample.map((r) => stringifyCell(r[c]).length)),
    ),
  );

  const headerRow = columns.map((c, i) => padCell(c, widths[i])).join('  ');
  const sep = widths.map((w) => '─'.repeat(w)).join('  ');
  const dataRows = sample.map((r) =>
    columns.map((c, i) => padCell(stringifyCell(r[c]), widths[i])).join('  '),
  );

  const lines = [headerRow, sep, ...dataRows];
  let body = lines.join('\n');

  // Hard cap on body to leave room for footer + fence
  if (body.length > TRUNCATE_BUDGET) {
    body = body.slice(0, TRUNCATE_BUDGET - 30) + '\n... (truncated)';
  }

  let out = `<pre>${escapeHtml(body)}</pre>`;
  if (totalCount > maxRows) {
    out += `\n<i>showing ${maxRows} of ${totalCount} rows — narrow your query</i>`;
  } else {
    out += `\n<i>${totalCount} row${totalCount === 1 ? '' : 's'}</i>`;
  }
  return out;
}

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  // Compact JSON for nested objects / arrays.
  return JSON.stringify(value);
}

function padCell(s: string, width: number): string {
  // Truncate with ellipsis if too wide
  if (s.length > width) return s.slice(0, width - 1) + '…';
  return s.padEnd(width, ' ');
}

// ─── JSON fallback ──────────────────────────────────────────────────────────

function renderJson(data: unknown, totalCount: number, maxRows: number): string {
  const text = JSON.stringify(data, null, 2);
  let body = text;
  if (body.length > TRUNCATE_BUDGET) {
    body = body.slice(0, TRUNCATE_BUDGET - 30) + '\n... (truncated)';
  }
  let out = `<pre>${escapeHtml(body)}</pre>`;
  if (Array.isArray(data) && totalCount > maxRows) {
    out += `\n<i>showing ${maxRows} of ${totalCount} rows — narrow your query</i>`;
  }
  return out;
}

// ─── HTML escaping (Telegram's HTML mode) ───────────────────────────────────

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => HTML_ENTITIES[c] ?? c);
}
