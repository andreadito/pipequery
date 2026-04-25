/**
 * Live smoke test for the Postgres push-down prototype.
 *
 * Requires a local Postgres on 127.0.0.1:5432 with a `pq_pd` database, a
 * `pq_user` role (password `pq_pw`), and an `orders` table seeded with the
 * fixtures the test below expects. The seeding lives outside the test on
 * purpose — push-down is a "does the round trip work end-to-end" thing,
 * not a unit-test concern.
 *
 * Skip the suite when the environment can't reach Postgres so this file
 * doesn't break CI on machines without a database.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresSourceAdapter } from '../src/server/sources/postgres.js';

const URL = 'postgres://pq_user:pq_pw@127.0.0.1:5432/pq_pd';

describe('postgres pushdown — live', () => {
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
});
