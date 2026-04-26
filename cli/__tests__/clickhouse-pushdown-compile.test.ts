/**
 * Unit tests for compileClickhousePushdown — no ClickHouse needed.
 *
 * ClickHouse INLINES literal values (vs. the bind-then-placeholder path
 * Postgres / MySQL / Snowflake take), so these tests focus on:
 *   1. The string-escape contract (no SQL injection possible)
 *   2. Identifier backticks
 *   3. Operator-set parity with the other dialects
 *   4. Empty params array (because everything is inlined)
 */
import { describe, expect, it } from 'vitest';
import { parseQuery } from '../src/engine.js';
import { compileClickhousePushdown } from '../src/server/sources/pushdown/clickhouse.js';

const BASE = 'SELECT * FROM events';

function compile(expression: string) {
  const pipeline = parseQuery(expression);
  return compileClickhousePushdown(pipeline, BASE);
}

describe('compileClickhousePushdown — dialect surface', () => {
  it('quotes identifiers with backticks', () => {
    const r = compile('events | sort(amount desc) | first(5)');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.compiled.sql).toContain('`amount`');
    expect(r.compiled.sql).not.toContain('"amount"');
  });

  it('inlines literals — params array stays empty', () => {
    const r = compile("events | where(status == 'paid' && amount > 100)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.compiled.params).toEqual([]);
    expect(r.compiled.sql).toContain("'paid'");
    expect(r.compiled.sql).toContain('100');
    // No ?, no $N placeholders anywhere.
    expect(r.compiled.sql).not.toContain('?');
    expect(r.compiled.sql).not.toContain('$1');
  });

  it('escapes single quotes inside string literals', () => {
    const r = compile('events | where(customer == "O\'Brien")');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // The inlined literal must have the apostrophe escaped so it can't
    // close the string early.
    expect(r.compiled.sql).toContain("'O\\'Brien'");
  });

  it('escapes backslashes inside string literals (no double-escape)', () => {
    const r = compile('events | where(path == "C:\\\\users")');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Each backslash in the original string becomes a doubled backslash
    // in the SQL — that's 2 bytes per source byte. "C:\\users" is 8
    // characters in the source string (C : \ \ u s e r s actually no
    // wait it's the JS-escaped form so the actual string is "C:\users"
    // = 8 chars including 1 backslash). After escape: "C:\\\\users" =
    // 10 chars including 2 backslashes. Quoted: 12.
    expect(r.compiled.sql).toContain("'C:\\\\users'");
  });

  it('cannot be SQL-injected — apostrophe in string is escaped, not closing the literal', () => {
    const r = compile('events | where(customer == "Robert\'); DROP TABLE events; --")');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // The bytes "DROP TABLE" do appear in the SQL — they're inside a quoted
    // string literal, which is harmless. What matters is that the closing
    // apostrophe is escaped (`\'`) so the literal can't terminate early
    // and let the trailing `; DROP TABLE …; --` reach the parser as code.
    expect(r.compiled.sql).toContain("\\'");
    // Substring check: the original apostrophe lives between two backslash
    // escapes — i.e. `Robert\');` should appear as `Robert\\\'); …` in the
    // emitted SQL. That confirms the apostrophe was rewritten before the
    // ); could close the string and start a new statement.
    expect(r.compiled.sql).toContain("Robert\\');");
  });

  it('numbers, booleans, and null inline directly', () => {
    const r1 = compile('events | where(amount > 99.5)');
    if (r1.ok) expect(r1.compiled.sql).toContain('99.5');

    // Boolean → 1 / 0 (ClickHouse uses UInt8 for booleans).
    const r2 = compile('events | where(active == true)');
    if (r2.ok) expect(r2.compiled.sql).toContain('= 1');

    const r3 = compile('events | where(deleted_at == null)');
    if (r3.ok) expect(r3.compiled.sql).toContain('IS NULL');
  });
});

describe('compileClickhousePushdown — operator parity', () => {
  it('rollup with GROUP BY + aggregates compiles', () => {
    const r = compile('events | rollup(severity, sum(amount) as total, count() as n) | sort(total desc) | first(10)');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.compiled.sql).toContain('SUM(`amount`) AS `total`');
    expect(r.compiled.sql).toContain('COUNT(*) AS `n`');
    expect(r.compiled.sql).toContain('GROUP BY `severity`');
    expect(r.compiled.sql).toContain('ORDER BY `total` DESC');
  });

  it('full-row distinct compiles', () => {
    const r = compile('events | distinct()');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.compiled.sql).toMatch(/^SELECT DISTINCT \* FROM/);
  });

  it('declines unsupported aggregates (e.g. percentile)', () => {
    const r = compile('events | rollup(percentile(amount, 0.95) as p95)');
    expect(r.ok).toBe(false);
  });

  it('declines where AFTER rollup', () => {
    const r = compile('events | rollup(severity, sum(amount) as t) | where(t > 100)');
    expect(r.ok).toBe(false);
  });
});
