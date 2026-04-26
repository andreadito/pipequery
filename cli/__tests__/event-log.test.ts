/**
 * Telegram event-log tests.
 *
 * Two surfaces under test:
 *   1. The pretty formatter — strings only, run with chalk.level=0 so no
 *      ANSI codes are emitted; assertions look for substrings/values.
 *   2. The JSONL file writer — backed by a real temp file on disk; verifies
 *      one JSON object per line, with the documented field shapes.
 *
 * No Telegram, no network.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import chalk from 'chalk';
import { createEventLogger, formatPretty, type BotEvent } from '../src/telegram/event-log.js';

beforeAll(() => {
  // No ANSI codes in test assertions — easier to write substring checks.
  chalk.level = 0;
});

const FIXED_TS = new Date('2026-04-26T21:15:03.412Z');

describe('formatPretty — command events', () => {
  it('formats a successful command with row count + latency', () => {
    const out = formatPretty(
      {
        kind: 'command',
        user: { id: 1, username: 'andreadito' },
        cmd: '/sources',
        outcome: 'success',
        rowCount: 8,
        latencyMs: 12,
      },
      FIXED_TS,
    );
    expect(out).toContain('@andreadito');
    expect(out).toContain('/sources');
    expect(out).toContain('✓');
    expect(out).toContain('8 rows');
    expect(out).toContain('12ms');
  });

  it('singularizes "1 row"', () => {
    const out = formatPretty(
      {
        kind: 'command',
        user: { id: 1, username: 'a' },
        cmd: '/describe',
        args: 'orders',
        outcome: 'success',
        rowCount: 1,
        latencyMs: 5,
      },
      FIXED_TS,
    );
    expect(out).toContain('1 row');
    expect(out).not.toContain('1 rows');
  });

  it('shows the command args inline', () => {
    const out = formatPretty(
      {
        kind: 'command',
        user: { id: 1, username: 'a' },
        cmd: '/describe',
        args: 'orders',
        outcome: 'success',
        rowCount: 5,
        latencyMs: 7,
      },
      FIXED_TS,
    );
    expect(out).toContain('/describe orders');
  });

  it('truncates long args', () => {
    const longArg = 'a'.repeat(200);
    const out = formatPretty(
      {
        kind: 'command',
        user: { id: 1, username: 'a' },
        cmd: '/query',
        args: longArg,
        outcome: 'success',
        rowCount: 0,
        latencyMs: 1,
      },
      FIXED_TS,
    );
    expect(out).toContain('…');
    expect(out.length).toBeLessThan(200);
  });

  it('formats a failed command with error message', () => {
    const out = formatPretty(
      {
        kind: 'command',
        user: { id: 1, username: 'a' },
        cmd: '/query',
        args: 'foo',
        outcome: 'error',
        latencyMs: 3,
        error: 'parse error: unexpected token',
      },
      FIXED_TS,
    );
    expect(out).toContain('✗');
    expect(out).toContain('parse error');
  });
});

describe('formatPretty — natural-language events', () => {
  it('formats a successful NL query with a continuation showing the translated expression', () => {
    const out = formatPretty(
      {
        kind: 'nl',
        user: { id: 1, username: 'andreadito' },
        text: 'top 5 paid orders',
        expression: 'orders | where(status == "paid") | sort(total desc) | first(5)',
        explanation: 'Top 5 paid orders by total.',
        outcome: 'success',
        rowCount: 5,
        latencyMs: 847,
      },
      FIXED_TS,
    );
    expect(out).toContain('"top 5 paid orders"');
    expect(out).toContain('5 rows');
    expect(out).toContain('847ms');
    // Continuation line under the action column shows the expression.
    expect(out).toContain('→ orders | where');
    // Two lines (primary + continuation).
    expect(out.split('\n')).toHaveLength(2);
  });

  it('formats not-answerable with the model explanation on a continuation line', () => {
    const out = formatPretty(
      {
        kind: 'nl',
        user: { id: 1, username: 'a' },
        text: 'drop the orders table',
        explanation: 'PipeQuery is read-only and cannot drop tables.',
        outcome: 'not_answerable',
        latencyMs: 412,
      },
      FIXED_TS,
    );
    expect(out).toContain('⚠');
    expect(out).toContain('not answerable');
    expect(out).toContain('PipeQuery is read-only');
    // Two lines.
    expect(out.split('\n')).toHaveLength(2);
  });

  it('formats an NL error inline (no continuation)', () => {
    const out = formatPretty(
      {
        kind: 'nl',
        user: { id: 1, username: 'a' },
        text: 'something',
        outcome: 'error',
        latencyMs: 30,
        error: 'translator returned non-JSON',
      },
      FIXED_TS,
    );
    expect(out).toContain('✗');
    expect(out).toContain('translator returned non-JSON');
    expect(out.split('\n')).toHaveLength(1);
  });
});

describe('formatPretty — unauthorized', () => {
  it('formats an unauthorized event with id when no username', () => {
    const out = formatPretty({ kind: 'unauthorized', user: { id: 12345 } }, FIXED_TS);
    expect(out).toContain('🔒');
    expect(out).toContain('id:12345');
    expect(out).toContain('unauthorized');
  });

  it('uses @username when present', () => {
    const out = formatPretty({ kind: 'unauthorized', user: { id: 1, username: 'bob' } }, FIXED_TS);
    expect(out).toContain('@bob');
  });
});

describe('createEventLogger — JSONL file output', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'pq-eventlog-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('appends one JSON object per event', async () => {
    const file = join(dir, 'bot.jsonl');
    const stderrLines: string[] = [];
    const logger = createEventLogger({
      filePath: file,
      writeStderr: (s) => stderrLines.push(s),
      now: () => FIXED_TS,
    });

    const events: BotEvent[] = [
      { kind: 'command', user: { id: 1, username: 'a' }, cmd: '/sources', outcome: 'success', rowCount: 8, latencyMs: 12 },
      { kind: 'nl', user: { id: 1, username: 'a' }, text: 'top 5', expression: 'orders | first(5)', explanation: 'Top 5.', outcome: 'success', rowCount: 5, latencyMs: 800 },
      { kind: 'unauthorized', user: { id: 99, username: 'bob' } },
    ];
    for (const e of events) logger.log(e);

    // Give appendFile a tick to flush.
    await new Promise((r) => setTimeout(r, 50));
    const content = await readFile(file, 'utf8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(3);

    const first = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(first.kind).toBe('command');
    expect(first.cmd).toBe('/sources');
    expect(first.outcome).toBe('success');
    expect(first.rowCount).toBe(8);
    expect(first.latencyMs).toBe(12);
    expect(first.ts).toBe(FIXED_TS.toISOString());
    expect(first.user).toEqual({ id: 1, username: 'a' });

    const second = JSON.parse(lines[1]) as Record<string, unknown>;
    expect(second.kind).toBe('nl');
    expect(second.text).toBe('top 5');
    expect(second.expression).toBe('orders | first(5)');
    expect(second.outcome).toBe('success');

    const third = JSON.parse(lines[2]) as Record<string, unknown>;
    expect(third.kind).toBe('unauthorized');
    expect(third.user).toEqual({ id: 99, username: 'bob' });
  });

  it('always writes to stderr regardless of whether a file is configured', async () => {
    const stderrLines: string[] = [];
    const logger = createEventLogger({
      writeStderr: (s) => stderrLines.push(s),
      now: () => FIXED_TS,
    });
    logger.log({ kind: 'command', user: { id: 1 }, cmd: '/sources', outcome: 'success', rowCount: 0, latencyMs: 1 });
    expect(stderrLines).toHaveLength(1);
    expect(stderrLines[0]).toContain('/sources');
  });

  it('omits optional fields from JSONL when absent', async () => {
    const file = join(dir, 'bot.jsonl');
    const logger = createEventLogger({
      filePath: file,
      writeStderr: () => undefined,
      now: () => FIXED_TS,
    });
    logger.log({ kind: 'command', user: { id: 1 }, cmd: '/help', outcome: 'success', latencyMs: 1 });
    await new Promise((r) => setTimeout(r, 50));
    const obj = JSON.parse((await readFile(file, 'utf8')).trim()) as Record<string, unknown>;
    expect(obj.rowCount).toBeUndefined();
    expect(obj.error).toBeUndefined();
    expect(obj.args).toBeUndefined();
  });
});
