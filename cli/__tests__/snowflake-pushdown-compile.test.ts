/**
 * Unit tests for compileSnowflakePushdown — no Snowflake account needed.
 *
 * Snowflake reuses the dialect-parametric compiler with `"x"` quoting (like
 * Postgres) and `?` placeholders (like MySQL). These tests focus on the
 * Snowflake-specific surface plus a couple of canary cases proving the
 * operator semantics carry across dialects unchanged.
 */
import { describe, expect, it } from 'vitest';
import { parseQuery } from '../src/engine.js';
import { compileSnowflakePushdown } from '../src/server/sources/pushdown/snowflake.js';

const BASE = 'SELECT * FROM ORDERS';

function compile(expression: string) {
  const pipeline = parseQuery(expression);
  return compileSnowflakePushdown(pipeline, BASE);
}

describe('compileSnowflakePushdown — dialect surface', () => {
  it('quotes identifiers with double quotes', () => {
    const r = compile('orders | sort(amount desc) | first(5)');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.compiled.sql).toContain('"amount"');
    expect(r.compiled.sql).not.toContain('`amount`');
  });

  it('uses ? positional placeholders', () => {
    const r = compile("orders | where(status == 'paid' && amount > 100)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.compiled.sql).toMatch(/"status".*=.*\?.*AND.*"amount".*>.*\?/);
    expect(r.compiled.sql).not.toContain('$1');
    expect(r.compiled.params).toEqual(['paid', 100]);
  });
});

describe('compileSnowflakePushdown — operator parity with other dialects', () => {
  it('rollup with GROUP BY + aggregates', () => {
    const r = compile('orders | rollup(country, sum(total) as revenue) | sort(revenue desc) | first(5)');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.compiled.sql).toContain('SUM("total") AS "revenue"');
    expect(r.compiled.sql).toContain('GROUP BY "country"');
    expect(r.compiled.sql).toContain('ORDER BY "revenue" DESC');
    expect(r.compiled.sql).toMatch(/LIMIT 5$/);
  });

  it('translates count() and distinct_count', () => {
    const r1 = compile('orders | count()');
    expect(r1.ok).toBe(true);
    if (r1.ok) expect(r1.compiled.sql).toContain('COUNT(*) AS "count"');

    const r2 = compile('orders | rollup(distinct_count(email) as users)');
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.compiled.sql).toContain('COUNT(DISTINCT "email") AS "users"');
  });

  it('NULL semantics → IS NULL / IS NOT NULL', () => {
    const r = compile('orders | where(customer != null)');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.compiled.sql).toContain('"customer" IS NOT NULL');
  });

  it('parameterizes hostile string literals', () => {
    const r = compile('orders | where(customer == "Robert\'); DROP TABLE orders; --")');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.compiled.sql).not.toContain('DROP TABLE');
    expect(r.compiled.params).toContain("Robert'); DROP TABLE orders; --");
  });
});
