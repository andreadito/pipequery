/**
 * Live smoke test for the Postgres push-down prototype.
 *
 * Requires a local Postgres on 127.0.0.1:5432 with a `pq_pd` database, a
 * `pq_user` role (password `pq_pw`), and an `orders` table seeded with the
 * fixtures the test below expects. The seeding lives outside the test on
 * purpose — push-down is a "does the round trip work end-to-end" thing,
 * not a unit-test concern.
 *
 * Skipped by default so CI (and contributors without a local Postgres)
 * stay green. To run:
 *
 *     POSTGRES_PUSHDOWN_SMOKE=1 npm test
 *
 * Or point at a different instance / credentials via POSTGRES_PUSHDOWN_URL.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresSourceAdapter } from '../src/server/sources/postgres.js';

const URL = process.env.POSTGRES_PUSHDOWN_URL ?? 'postgres://pq_user:pq_pw@127.0.0.1:5432/pq_pd';
const ENABLED = process.env.POSTGRES_PUSHDOWN_SMOKE === '1';

describe.skipIf(!ENABLED)('postgres pushdown — live', () => {
  let adapter: PostgresSourceAdapter;

  beforeAll(async () => {
    adapter = new PostgresSourceAdapter({
      type: 'postgres',
      url: URL,
      query: 'SELECT * FROM orders',
      ssl: false,
    });
    await adapter.start();
  });

  afterAll(() => {
    adapter.stop();
  });

  it('pushes down where + sort + first into one Postgres query', async () => {
    const r = await adapter.runPushdown(
      "orders | where(status == 'paid' && amount > 100) | sort(amount desc) | first(2)",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    // Verify the SQL shape — these are the assertions that prove "push-down,
    // not in-memory filter": the WHERE / ORDER BY / LIMIT clauses must be
    // present in the SQL we sent to Postgres.
    expect(r.sql).toMatch(/SELECT \* FROM \(SELECT \* FROM orders\) AS pq_src/);
    expect(r.sql).toMatch(/WHERE.*"status".*=.*\$1.*AND.*"amount".*>.*\$2/i);
    expect(r.sql).toMatch(/ORDER BY "amount" DESC/);
    expect(r.sql).toMatch(/LIMIT 2$/);
    expect(r.params).toEqual(['paid', 100]);

    // Result: two highest-amount paid orders. Frank ($1500) and Carol ($899.99).
    expect(r.rows).toHaveLength(2);
    expect((r.rows[0] as { customer: string }).customer).toBe('Frank');
    expect((r.rows[1] as { customer: string }).customer).toBe('Carol');
  });

  it('declines push-down when the pipeline contains an unsupported op', async () => {
    const r = await adapter.runPushdown('orders | groupBy(status) | rollup(sum(amount) as total)');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/GroupByOp|not yet pushable/);
  });

  it('handles NULL semantics correctly', async () => {
    const r = await adapter.runPushdown("orders | where(customer != null)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sql).toMatch(/"customer" IS NOT NULL/);
  });

  it('parameterizes string literals (no SQL injection surface)', async () => {
    const r = await adapter.runPushdown(
      "orders | where(customer == \"Robert'); DROP TABLE orders; --\")",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // The malicious string is bound as $1, not concatenated. SQL stays clean.
    expect(r.sql).not.toContain('DROP TABLE');
    expect(r.params).toEqual(["Robert'); DROP TABLE orders; --"]);
    expect(r.rows).toHaveLength(0);

    // Confirm the table is still intact afterwards.
    const sanity = await adapter.runPushdown('orders | first(1)');
    expect(sanity.ok).toBe(true);
    if (sanity.ok) expect(sanity.rows.length).toBe(1);
  });

  it('pushes down rollup with GROUP BY + aggregates', async () => {
    const r = await adapter.runPushdown(
      "orders | rollup(status, sum(amount) as total, count() as n) | sort(total desc)",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sql).toContain('GROUP BY "status"');
    expect(r.sql).toContain('SUM("amount") AS "total"');
    expect(r.sql).toContain('COUNT(*) AS "n"');
    expect(r.sql).toContain('ORDER BY "total" DESC');
    // Each row carries the aggregate columns we asked for.
    expect(r.rows.length).toBeGreaterThan(0);
    expect(r.rows[0]).toHaveProperty('status');
    expect(r.rows[0]).toHaveProperty('total');
    expect(r.rows[0]).toHaveProperty('n');
  });

  it('pushes down a single-row aggregate (no GROUP BY)', async () => {
    const r = await adapter.runPushdown('orders | rollup(sum(amount) as total)');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sql).not.toContain('GROUP BY');
    expect(r.rows).toHaveLength(1);
    expect((r.rows[0] as { total: unknown }).total).not.toBeNull();
  });

  it('pushes down pipeline-terminal count() to COUNT(*)', async () => {
    const r = await adapter.runPushdown('orders | count()');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sql).toMatch(/^SELECT COUNT\(\*\) AS "count" FROM/);
    expect(r.rows).toHaveLength(1);
  });

  it('pushes down select with alias', async () => {
    const r = await adapter.runPushdown('orders | select(customer as name, amount) | first(3)');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sql).toContain('"customer" AS "name"');
    expect(r.rows.length).toBeLessThanOrEqual(3);
    // Result rows have the alias, not the original column name.
    if (r.rows.length > 0) {
      expect(r.rows[0]).toHaveProperty('name');
      expect(r.rows[0]).not.toHaveProperty('customer');
    }
  });

  it('pushes down full-row distinct', async () => {
    const r = await adapter.runPushdown('orders | select(status) | distinct()');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sql).toMatch(/^SELECT DISTINCT "status" FROM/);
  });

  it('declines distinct(field) — DISTINCT ON not portable', async () => {
    const r = await adapter.runPushdown('orders | distinct(status)');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/distinct/i);
  });

  it('still declines unsupported aggregates (e.g. percentile)', async () => {
    const r = await adapter.runPushdown('orders | rollup(percentile(amount, 0.95) as p95)');
    expect(r.ok).toBe(false);
  });
});
