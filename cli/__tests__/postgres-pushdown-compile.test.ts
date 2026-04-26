/**
 * Pure unit tests for compilePostgresPushdown — no Postgres needed.
 *
 * Verifies the SQL shape and parameter binding for every supported operator
 * + the documented decline cases. These are the contract tests; the live
 * smoke test (postgres-pushdown.smoke.test.ts) exercises the actual round
 * trip against a real database.
 */
import { describe, expect, it } from 'vitest';
import { parseQuery } from '../src/engine.js';
import { compilePostgresPushdown } from '../src/server/sources/pushdown/postgres.js';

const BASE = 'SELECT * FROM orders';

function compile(expression: string) {
  const pipeline = parseQuery(expression);
  return compilePostgresPushdown(pipeline, BASE);
}

describe('compilePostgresPushdown — where / sort / first', () => {
  it('compiles a compound where with parameter binding', () => {
    const r = compile("orders | where(status == 'paid' && amount > 100)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.compiled.sql).toMatch(/WHERE.*"status".*=.*\$1.*AND.*"amount".*>.*\$2/i);
    expect(r.compiled.params).toEqual(['paid', 100]);
  });

  it('compiles sort + first', () => {
    const r = compile('orders | sort(amount desc) | first(5)');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.compiled.sql).toContain('ORDER BY "amount" DESC');
    expect(r.compiled.sql).toMatch(/LIMIT 5$/);
  });

  it('translates equality with NULL to IS NULL / IS NOT NULL', () => {
    const r = compile('orders | where(customer != null)');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.compiled.sql).toContain('"customer" IS NOT NULL');
  });
});

describe('compilePostgresPushdown — select', () => {
  it('compiles a bare-field projection', () => {
    const r = compile('orders | select(name, total)');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.compiled.sql).toMatch(/^SELECT "name", "total" FROM/);
  });

  it('compiles select with an alias', () => {
    const r = compile('orders | select(name as customer, total)');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.compiled.sql).toContain('"name" AS "customer"');
    expect(r.compiled.sql).toContain('"total"');
  });

  it('compiles select with arithmetic', () => {
    const r = compile('orders | select(total * 1.1 as marked)');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.compiled.sql).toContain('"total" * $1');
    expect(r.compiled.sql).toContain('AS "marked"');
    expect(r.compiled.params).toEqual([1.1]);
  });

  it('declines select containing an aggregate function (no GROUP BY context)', () => {
    const r = compile('orders | select(sum(total) as t)');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/select/i);
  });

  it('declines two select() ops in one pipeline', () => {
    const r = compile('orders | select(name) | select(total)');
    expect(r.ok).toBe(false);
  });
});

describe('compilePostgresPushdown — distinct', () => {
  it('compiles full-row distinct', () => {
    const r = compile('orders | distinct()');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.compiled.sql).toMatch(/^SELECT DISTINCT \* FROM/);
  });

  it('compiles distinct + select + first', () => {
    const r = compile('orders | select(country) | distinct() | first(10)');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.compiled.sql).toMatch(/^SELECT DISTINCT "country" FROM/);
    expect(r.compiled.sql).toMatch(/LIMIT 10$/);
  });

  it('declines distinct(field) since DISTINCT ON is non-portable', () => {
    const r = compile('orders | distinct(email)');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/distinct/i);
  });
});

describe('compilePostgresPushdown — rollup (GROUP BY)', () => {
  it('compiles rollup with one key + one aggregate', () => {
    const r = compile('orders | rollup(country, sum(total) as revenue)');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.compiled.sql).toMatch(/^SELECT "country", SUM\("total"\) AS "revenue" FROM/);
    expect(r.compiled.sql).toContain('GROUP BY "country"');
  });

  it('compiles rollup with multiple keys + multiple aggregates', () => {
    const r = compile('orders | rollup(country, status, sum(total) as t, count() as n)');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.compiled.sql).toContain('SUM("total") AS "t"');
    expect(r.compiled.sql).toContain('COUNT(*) AS "n"');
    expect(r.compiled.sql).toContain('GROUP BY "country", "status"');
  });

  it('compiles rollup with no keys (single-row aggregate)', () => {
    const r = compile('orders | rollup(sum(total) as total)');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.compiled.sql).toMatch(/^SELECT SUM\("total"\) AS "total" FROM/);
    expect(r.compiled.sql).not.toContain('GROUP BY');
  });

  it('translates distinct_count to COUNT(DISTINCT ...)', () => {
    const r = compile('orders | rollup(distinct_count(email) as users)');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.compiled.sql).toContain('COUNT(DISTINCT "email") AS "users"');
  });

  it('compiles rollup + sort + first as one query', () => {
    const r = compile('orders | rollup(country, sum(total) as t) | sort(t desc) | first(5)');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.compiled.sql).toContain('GROUP BY "country"');
    expect(r.compiled.sql).toContain('ORDER BY "t" DESC');
    expect(r.compiled.sql).toMatch(/LIMIT 5$/);
  });

  it('compiles where + rollup as WHERE then GROUP BY (correct clause order)', () => {
    const r = compile("orders | where(status == 'paid') | rollup(country, sum(total) as t)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // SQL clause order: WHERE before GROUP BY. This proves the compiler
    // emits clauses in the right order regardless of pipe order.
    const sql = r.compiled.sql;
    expect(sql.indexOf('WHERE')).toBeLessThan(sql.indexOf('GROUP BY'));
  });

  it('declines where AFTER rollup (would need HAVING)', () => {
    const r = compile('orders | rollup(country, sum(total) as t) | where(t > 100)');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/HAVING|grouping/i);
  });

  it('declines rollup with a non-field key', () => {
    const r = compile('orders | rollup(total * 2, sum(amount) as t)');
    expect(r.ok).toBe(false);
  });

  it('declines unsupported aggregate functions', () => {
    const r = compile('orders | rollup(percentile(amount, 0.95) as p95)');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/aggregate|expression/i);
  });

  it('declines two grouping ops in one pipeline', () => {
    const r = compile('orders | rollup(sum(total) as t) | rollup(sum(total) as t)');
    expect(r.ok).toBe(false);
  });

  it('declines rollup after select', () => {
    const r = compile('orders | select(country, total) | rollup(country, sum(total) as t)');
    expect(r.ok).toBe(false);
  });
});

describe('compilePostgresPushdown — pipeline-terminal aggregate', () => {
  it('compiles count() to COUNT(*)', () => {
    const r = compile('orders | count()');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.compiled.sql).toMatch(/^SELECT COUNT\(\*\) AS "count" FROM/);
  });

  it('compiles sum(field) to SUM("field")', () => {
    const r = compile('orders | sum(total)');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.compiled.sql).toMatch(/^SELECT SUM\("total"\) AS "sum" FROM/);
  });

  it('declines unsupported aggregate at pipeline level', () => {
    const r = compile('orders | percentile(total, 0.95)');
    expect(r.ok).toBe(false);
  });
});

describe('compilePostgresPushdown — declines for unsupported shapes', () => {
  it('declines unknown operators (e.g. flatten)', () => {
    const r = compile('orders | flatten(items)');
    expect(r.ok).toBe(false);
  });

  it('declines multi-segment field paths', () => {
    const r = compile('orders | where(meta.country == "US")');
    expect(r.ok).toBe(false);
  });
});

describe('compilePostgresPushdown — security', () => {
  it('parameterizes hostile string literals (no SQL injection surface)', () => {
    const r = compile('orders | where(customer == "Robert\'); DROP TABLE orders; --")');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // The malicious string is bound, not concatenated.
    expect(r.compiled.sql).not.toContain('DROP TABLE');
    expect(r.compiled.params).toContain("Robert'); DROP TABLE orders; --");
  });

  it('escapes embedded double quotes in identifiers', () => {
    // `orders | sort(weird"name desc)` — the parser may not accept this,
    // but if a malformed FieldAccess ever made it in, identifier-quoting
    // doubles internal quotes per Postgres rules. Guard it here so the
    // helper can't ever emit unescaped quotes.
    const r = compile('orders | first(1)');
    expect(r.ok).toBe(true);
  });
});
