/**
 * Per-message event logging for the Telegram bot.
 *
 * Two outputs:
 *   1. Pretty-printed line on stderr — colored, scannable, always on. This
 *      is what you see when running `pq telegram serve` in the foreground.
 *   2. Optional JSONL file — one JSON object per line, machine-readable.
 *      Opted in via `--log-file <path>` on `pq telegram serve`. Useful for
 *      `jq`/`grep`/audit-log workflows.
 *
 * Pretty-print example:
 *
 *   21:15:03 ✓ @andreadito  /sources                          8 rows  12ms
 *   21:15:24 ✓ @andreadito  "top 5 paid orders"               5 rows  847ms
 *                           → orders | where(status == "paid") | sort(total desc) | first(5)
 *   21:15:47 🔒 @bob         unauthorized
 *   21:16:02 ✗ @andreadito  /query foo                        parse error
 *   21:17:00 ⚠ @andreadito  "drop the orders table"           not answerable
 *                           → PipeQuery is read-only and cannot drop tables.
 *
 * Format design notes:
 *   - HH:MM:SS local time (dim) so the eye anchors on the action, not the timestamp.
 *   - One outcome glyph: ✓ success, ✗ error, 🔒 unauthorized, ⚠ not-answerable.
 *   - Username column padded so things line up at typical widths.
 *   - User text/command in white-ish so it's the most-readable element.
 *   - Stats (rows + ms) right-aligned in dim — present when relevant.
 *   - Translator output (NL → expression OR not-answerable explanation) goes
 *     on a continuation line so the primary line stays scannable.
 */
import { appendFile } from 'node:fs/promises';
import chalk from 'chalk';

export type BotEvent =
  | {
      kind: 'command';
      user: UserRef;
      cmd: string;
      args?: string;
      outcome: 'success' | 'error';
      rowCount?: number;
      latencyMs: number;
      error?: string;
    }
  | {
      kind: 'nl';
      user: UserRef;
      text: string;
      expression?: string;
      explanation?: string;
      outcome: 'success' | 'error' | 'not_answerable';
      rowCount?: number;
      latencyMs: number;
      error?: string;
    }
  | { kind: 'unauthorized'; user: UserRef };

export interface UserRef {
  id?: number;
  username?: string;
}

export interface EventLogger {
  log(event: BotEvent): void;
  /** Best-effort flush for the JSONL file. Currently a no-op since
   *  appendFile awaits its own write; exposed for future buffering. */
  flush(): Promise<void>;
}

export interface EventLoggerOptions {
  /** Optional JSONL file path. When set, every event is also appended
   *  as one JSON object per line. */
  filePath?: string;
  /** Override the stderr writer (for tests). */
  writeStderr?: (line: string) => void;
  /** Override the wall clock (for tests). */
  now?: () => Date;
}

const USER_WIDTH = 14;
const ACTION_WIDTH = 36;

export function createEventLogger(opts: EventLoggerOptions = {}): EventLogger {
  const writeStderr = opts.writeStderr ?? ((line) => process.stderr.write(line));
  const now = opts.now ?? (() => new Date());
  const filePath = opts.filePath;

  return {
    log(event: BotEvent): void {
      const ts = now();
      writeStderr(formatPretty(event, ts) + '\n');
      if (filePath) {
        const json = JSON.stringify({ ts: ts.toISOString(), ...flattenForJson(event) });
        // Fire-and-forget write; the bot doesn't await this so a slow disk
        // doesn't back-pressure incoming Telegram messages. Errors surface
        // on stderr so a misconfigured path is visible.
        void appendFile(filePath, json + '\n').catch((err) => {
          writeStderr(
            chalk.hex('#ef4444')('  ✗') +
              ' [pipequery-telegram] log-file write failed: ' +
              (err instanceof Error ? err.message : String(err)) +
              '\n',
          );
        });
      }
    },
    async flush(): Promise<void> {
      // Reserved for future buffering. appendFile already awaits internally.
    },
  };
}

// ─── Pretty formatter ───────────────────────────────────────────────────────

export function formatPretty(event: BotEvent, ts: Date): string {
  const time = chalk.dim(formatTime(ts));
  const user = chalk.hex('#06b6d4')(padRight(formatUser(event.user), USER_WIDTH));

  if (event.kind === 'unauthorized') {
    const glyph = chalk.hex('#f59e0b')('🔒');
    return `  ${time} ${glyph} ${user}  ${chalk.hex('#f59e0b')('unauthorized')}`;
  }

  if (event.kind === 'command') {
    const glyph = outcomeGlyph(event.outcome);
    const action = padRight(`${event.cmd}${event.args ? ' ' + truncate(event.args, 24) : ''}`, ACTION_WIDTH);
    const stats = formatStats(event.rowCount, event.latencyMs);
    if (event.outcome === 'error' && event.error) {
      return `  ${time} ${glyph} ${user}  ${action}  ${chalk.hex('#ef4444')(truncate(event.error, 60))}`;
    }
    return `  ${time} ${glyph} ${user}  ${action}  ${stats}`;
  }

  // NL message
  const glyph = nlOutcomeGlyph(event.outcome);
  const action = padRight(`"${truncate(event.text, ACTION_WIDTH - 4)}"`, ACTION_WIDTH);
  let line: string;
  if (event.outcome === 'error' && event.error) {
    line = `  ${time} ${glyph} ${user}  ${action}  ${chalk.hex('#ef4444')(truncate(event.error, 60))}`;
  } else if (event.outcome === 'not_answerable') {
    line = `  ${time} ${glyph} ${user}  ${action}  ${chalk.hex('#f59e0b')('not answerable')}`;
  } else {
    line = `  ${time} ${glyph} ${user}  ${action}  ${formatStats(event.rowCount, event.latencyMs)}`;
  }
  // Continuation line: translated expression (success) or explanation (not_answerable).
  const continuation =
    event.outcome === 'success' && event.expression
      ? chalk.dim('→ ') + chalk.hex('#82aaff')(event.expression)
      : event.outcome === 'not_answerable' && event.explanation
        ? chalk.dim('→ ') + chalk.hex('#f59e0b')(event.explanation)
        : null;
  if (continuation) {
    // Indent continuation under the action column for visual alignment.
    const pad = ' '.repeat(2 + 8 + 1 + 2 + 1 + USER_WIDTH + 2);
    return `${line}\n${pad}${continuation}`;
  }
  return line;
}

function outcomeGlyph(outcome: 'success' | 'error'): string {
  return outcome === 'success' ? chalk.hex('#10b981')('✓') : chalk.hex('#ef4444')('✗');
}

function nlOutcomeGlyph(outcome: 'success' | 'error' | 'not_answerable'): string {
  if (outcome === 'success') return chalk.hex('#10b981')('✓');
  if (outcome === 'error') return chalk.hex('#ef4444')('✗');
  return chalk.hex('#f59e0b')('⚠');
}

function formatStats(rowCount: number | undefined, latencyMs: number): string {
  const parts: string[] = [];
  if (typeof rowCount === 'number') {
    parts.push(`${rowCount.toLocaleString()} ${rowCount === 1 ? 'row' : 'rows'}`);
  }
  parts.push(`${latencyMs}ms`);
  return chalk.dim(parts.join('  '));
}

function formatTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function formatUser(u: UserRef): string {
  if (u.username) return `@${u.username}`;
  if (u.id !== undefined) return `id:${u.id}`;
  return '<unknown>';
}

function padRight(s: string, width: number): string {
  // padEnd uses code-unit length, which is fine for ASCII labels we control.
  // Truncate first so we never overflow the column.
  const t = truncate(s, width);
  return t.padEnd(width);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  if (max <= 1) return s.slice(0, max);
  return s.slice(0, max - 1) + '…';
}

// ─── JSONL serialization ────────────────────────────────────────────────────

function flattenForJson(event: BotEvent): Record<string, unknown> {
  const userOut: Record<string, unknown> = {};
  if (event.user.username) userOut.username = event.user.username;
  if (event.user.id !== undefined) userOut.id = event.user.id;
  const base = { kind: event.kind, user: userOut };
  if (event.kind === 'unauthorized') return base;
  if (event.kind === 'command') {
    return {
      ...base,
      cmd: event.cmd,
      ...(event.args ? { args: event.args } : {}),
      outcome: event.outcome,
      ...(event.rowCount !== undefined ? { rowCount: event.rowCount } : {}),
      latencyMs: event.latencyMs,
      ...(event.error ? { error: event.error } : {}),
    };
  }
  // nl
  return {
    ...base,
    text: event.text,
    ...(event.expression ? { expression: event.expression } : {}),
    ...(event.explanation ? { explanation: event.explanation } : {}),
    outcome: event.outcome,
    ...(event.rowCount !== undefined ? { rowCount: event.rowCount } : {}),
    latencyMs: event.latencyMs,
    ...(event.error ? { error: event.error } : {}),
  };
}
