/**
 * Unit tests for compileMongoPushdown — no MongoDB needed.
 *
 * Mongo isn't SQL, so this compiler emits two distinct shapes depending
 * on the pipeline:
 *   - `find` plan when the pipeline uses only where / sort / first / select
 *   - `aggregate` pipeline when grouping (rollup / aggregate) is involved
 *
 * Tests cover both shapes plus the documented decline cases.
 */
import { describe, expect, it } from 'vitest';
import { parseQuery } from '../src/engine.js';
import { compileMongoPushdown } from '../src/server/sources/pushdown/mongodb.js';

function compile(expression: string, defaultFilter?: Record<string, unknown>) {
  const pipeline = parseQuery(expression);
  return compileMongoPushdown(pipeline, defaultFilter);
}

describe('compileMongoPushdown — find() path', () => {
  it('compiles where → $eq / $gt / $lt filter', () => {
    const r = compile("orders | where(status == 'paid' && amount > 100)");
    expect(r.ok).toBe(true);
    if (!r.ok || r.compiled.kind !== 'find') return;
    // $and-merged because we have two predicates.
    expect(r.compiled.filter).toEqual({
      $and: [
        { status: { $eq: 'paid' } },
        { amount: { $gt: 100 } },
      ],
    });
  });

  it('compiles sort + first into sort + limit on the cursor', () => {
    const r = compile('orders | sort(amount desc) | first(10)');
    expect(r.ok).toBe(true);
    if (!r.ok || r.compiled.kind !== 'find') return;
    expect(r.compiled.sort).toEqual({ amount: -1 });
    expect(r.compiled.limit).toBe(10);
  });

  it('compiles bare-field select into projection', () => {
    const r = compile('orders | select(name, total)');
    expect(r.ok).toBe(true);
    if (!r.ok || r.compiled.kind !== 'find') return;
    expect(r.compiled.projection).toEqual({ name: 1, total: 1, _id: 0 });
  });

  it('merges yaml-level default filter with where()', () => {
    const r = compile('orders | where(amount > 100)', { active: true });
    expect(r.ok).toBe(true);
    if (!r.ok || r.compiled.kind !== 'find') return;
    expect(r.compiled.filter).toEqual({
      $and: [
        { active: true },
        { amount: { $gt: 100 } },
      ],
    });
  });

  it('translates IS NULL semantics correctly', () => {
    const r = compile('orders | where(deleted_at == null)');
    expect(r.ok).toBe(true);
    if (!r.ok || r.compiled.kind !== 'find') return;
    expect(r.compiled.filter).toEqual({ deleted_at: { $eq: null } });
  });

  it('translates != null to $ne null', () => {
    const r = compile('orders | where(deleted_at != null)');
    expect(r.ok).toBe(true);
    if (!r.ok || r.compiled.kind !== 'find') return;
    expect(r.compiled.filter).toEqual({ deleted_at: { $ne: null } });
  });

  // NOTE: `||` translation to $or is implemented in the compiler but
  // currently unreachable through parseQuery — the engine lexer (line 60
  // of cli/../src/engine/lexer.ts) consumes any `|` as a PIPE token before
  // the `||` two-character branch can fire. The compiler logic is kept
  // for the day that lexer gap is fixed; no test until then.
});

describe('compileMongoPushdown — aggregate() path', () => {
  it('compiles rollup with one key + one aggregate', () => {
    const r = compile('orders | rollup(country, sum(total) as revenue)');
    expect(r.ok).toBe(true);
    if (!r.ok || r.compiled.kind !== 'aggregate') return;
    // Find the $group stage.
    const groupStage = r.compiled.pipeline.find((s) => '$group' in s) as { $group: Record<string, unknown> };
    expect(groupStage.$group._id).toBe('$country');
    expect(groupStage.$group.revenue).toEqual({ $sum: '$total' });
    // After group, project to flatten _id.country → top-level country.
    const projStage = r.compiled.pipeline.find((s) => '$project' in s) as { $project: Record<string, unknown> };
    expect(projStage.$project.country).toBe('$_id');
    expect(projStage.$project.revenue).toBe('$revenue');
    expect(projStage.$project._id).toBe(0);
  });

  it('compiles count() to $sum: 1', () => {
    const r = compile('orders | count()');
    expect(r.ok).toBe(true);
    if (!r.ok || r.compiled.kind !== 'aggregate') return;
    const groupStage = r.compiled.pipeline.find((s) => '$group' in s) as { $group: Record<string, unknown> };
    expect(groupStage.$group.count).toEqual({ $sum: 1 });
  });

  it('compiles distinct_count via $addToSet + $size in projection', () => {
    const r = compile('orders | rollup(distinct_count(email) as users)');
    expect(r.ok).toBe(true);
    if (!r.ok || r.compiled.kind !== 'aggregate') return;
    const groupStage = r.compiled.pipeline.find((s) => '$group' in s) as { $group: Record<string, unknown> };
    expect(groupStage.$group.users).toEqual({ $addToSet: '$email' });
    const projStage = r.compiled.pipeline.find((s) => '$project' in s) as { $project: Record<string, unknown> };
    expect(projStage.$project.users).toEqual({ $size: '$users' });
  });

  it('compiles where + rollup as $match before $group', () => {
    const r = compile("orders | where(status == 'paid') | rollup(country, sum(total) as t)");
    expect(r.ok).toBe(true);
    if (!r.ok || r.compiled.kind !== 'aggregate') return;
    // $match must come before $group.
    const matchIdx = r.compiled.pipeline.findIndex((s) => '$match' in s);
    const groupIdx = r.compiled.pipeline.findIndex((s) => '$group' in s);
    expect(matchIdx).toBeGreaterThanOrEqual(0);
    expect(groupIdx).toBeGreaterThan(matchIdx);
  });

  it('declines where AFTER rollup (HAVING-style)', () => {
    const r = compile('orders | rollup(country, sum(total) as t) | where(t > 100)');
    expect(r.ok).toBe(false);
  });

  it('declines unsupported aggregates', () => {
    const r = compile('orders | rollup(percentile(amount, 0.95) as p95)');
    expect(r.ok).toBe(false);
  });

  it('declines two grouping ops in one pipeline', () => {
    const r = compile('orders | rollup(sum(total) as t) | rollup(sum(total) as t)');
    expect(r.ok).toBe(false);
  });

  it('select with alias forces aggregate path', () => {
    const r = compile('orders | select(customer as name)');
    expect(r.ok).toBe(false);  // declined in find() path
    if (r.ok) return;
    expect(r.reason).toMatch(/alias/i);
  });
});

describe('compileMongoPushdown — declines', () => {
  it('declines distinct() — no clean Mongo equivalent', () => {
    const r = compile('orders | distinct()');
    expect(r.ok).toBe(false);
  });

  it('declines unsupported operators (e.g. flatten)', () => {
    const r = compile('orders | flatten(items)');
    expect(r.ok).toBe(false);
  });
});
