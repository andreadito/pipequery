/**
 * Live smoke test for the MySQL push-down adapter.
 *
 * Skipped by default; opt in with MYSQL_PUSHDOWN_SMOKE=1 (and optionally
 * MYSQL_PUSHDOWN_URL to point at a different instance).
 *
 * Expected fixture: a MySQL with a database `pq_pd`, a user `pq_user` /
 * `pq_pw`, and an `orders` table seeded with the same shape the Postgres
 * smoke test assumes (id, customer, amount, status). Identical seed.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MysqlSourceAdapter } from '../src/server/sources/mysql.js';

const URL = process.env.MYSQL_PUSHDOWN_URL ?? 'mysql://pq_user:pq_pw@127.0.0.1:3306/pq_pd';
const ENABLED = process.env.MYSQL_PUSHDOWN_SMOKE === '1';

describe.skipIf(!ENABLED)('mysql pushdown — live', () => {
  let adapter: MysqlSourceAdapter;

  beforeAll(async () => {
    adapter = new MysqlSourceAdapter({
      type: 'mysql',
      url: URL,
      query: 'SELECT * FROM orders',
      ssl: false,
    });
    await adapter.start();
  });

  afterAll(() => {
    adapter.stop();
  });

  it('pushes down where + sort + first into a single MySQL query', async () => {
    const r = await adapter.runPushdown(
      "orders | where(status == 'paid' && amount > 100) | sort(amount desc) | first(2)",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sql).toContain('`status`');
    expect(r.sql).toContain('`amount`');
    expect(r.sql).toContain('ORDER BY `amount` DESC');
    expect(r.sql).toMatch(/LIMIT 2$/);
    expect(r.params).toEqual(['paid', 100]);
    expect(r.rows).toHaveLength(2);
  });

  it('pushes down rollup with GROUP BY + aggregates', async () => {
    const r = await adapter.runPushdown(
      'orders | rollup(status, sum(amount) as total, count() as n) | sort(total desc)',
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sql).toContain('GROUP BY `status`');
    expect(r.sql).toContain('SUM(`amount`) AS `total`');
    expect(r.sql).toContain('COUNT(*) AS `n`');
    expect(r.rows.length).toBeGreaterThan(0);
  });

  it('parameterizes hostile string literals (no SQL injection surface)', async () => {
    const r = await adapter.runPushdown(
      "orders | where(customer == \"Robert'); DROP TABLE orders; --\")",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sql).not.toContain('DROP TABLE');
    expect(r.params).toEqual(["Robert'); DROP TABLE orders; --"]);
    // Sanity: table is still queryable.
    const sanity = await adapter.runPushdown('orders | first(1)');
    expect(sanity.ok).toBe(true);
  });

  it('declines unsupported aggregates (engine fallback path)', async () => {
    const r = await adapter.runPushdown('orders | rollup(percentile(amount, 0.95) as p95)');
    expect(r.ok).toBe(false);
  });
});
