import { describe, it, expect } from 'vitest';
import {
  parseQueryToSteps,
  generateQuery,
  PipelineStep,
  StepConfig,
  createDefaultConfig,
} from '../src/react/types';

// Helper to strip IDs for easier comparison
const stripIds = (steps: PipelineStep[]) => steps.map(s => s.step);

describe('parseQueryToSteps', () => {
  // ─── Basic ────────────────────────────────────────────────────────────────

  it('returns empty for empty string', () => {
    expect(parseQueryToSteps('')).toEqual({ source: '', steps: [] });
  });

  it('returns empty for whitespace', () => {
    expect(parseQueryToSteps('   ')).toEqual({ source: '', steps: [] });
  });

  it('parses source-only query', () => {
    const result = parseQueryToSteps('crypto');
    expect(result.source).toBe('crypto');
    expect(result.steps).toHaveLength(0);
  });

  it('assigns sequential IDs to steps', () => {
    const { steps } = parseQueryToSteps('data | first(5) | last(3)');
    expect(steps[0].id).toBe('pq_0');
    expect(steps[1].id).toBe('pq_1');
  });

  // ─── first / last ─────────────────────────────────────────────────────────

  it('parses first(N)', () => {
    const { source, steps } = parseQueryToSteps('crypto | first(10)');
    expect(source).toBe('crypto');
    expect(stripIds(steps)).toEqual([
      { type: 'first', config: { count: 10 } },
    ]);
  });

  it('parses last(N)', () => {
    const { steps } = parseQueryToSteps('data | last(5)');
    expect(stripIds(steps)).toEqual([
      { type: 'last', config: { count: 5 } },
    ]);
  });

  it('defaults to 10 for non-numeric first/last', () => {
    const { steps } = parseQueryToSteps('data | first(abc)');
    expect((steps[0].step as any).config.count).toBe(10);
  });

  // ─── sort ──────────────────────────────────────────────────────────────────

  it('parses sort with single field (default asc)', () => {
    const { steps } = parseQueryToSteps('data | sort(name)');
    expect(stripIds(steps)).toEqual([
      { type: 'sort', config: { criteria: [{ field: 'name', direction: 'asc' }] } },
    ]);
  });

  it('parses sort with desc direction', () => {
    const { steps } = parseQueryToSteps('data | sort(price desc)');
    expect(stripIds(steps)).toEqual([
      { type: 'sort', config: { criteria: [{ field: 'price', direction: 'desc' }] } },
    ]);
  });

  it('parses sort with multiple criteria', () => {
    const { steps } = parseQueryToSteps('data | sort(marketCap desc, name)');
    expect(stripIds(steps)).toEqual([
      {
        type: 'sort',
        config: {
          criteria: [
            { field: 'marketCap', direction: 'desc' },
            { field: 'name', direction: 'asc' },
          ],
        },
      },
    ]);
  });

  // ─── where ─────────────────────────────────────────────────────────────────

  it('parses where with simple condition', () => {
    const { steps } = parseQueryToSteps('data | where(price > 100)');
    expect(stripIds(steps)).toEqual([
      { type: 'where', config: { condition: 'price > 100' } },
    ]);
  });

  it('parses where with complex condition', () => {
    const { steps } = parseQueryToSteps('data | where(price > 100 && name != "BTC")');
    expect(stripIds(steps)).toEqual([
      { type: 'where', config: { condition: 'price > 100 && name != "BTC"' } },
    ]);
  });

  // ─── select ────────────────────────────────────────────────────────────────

  it('parses select with plain fields', () => {
    const { steps } = parseQueryToSteps('data | select(name, price, volume)');
    expect(stripIds(steps)).toEqual([
      { type: 'select', config: { fields: ['name', 'price', 'volume'], expressions: [] } },
    ]);
  });

  it('parses select with expressions containing "as" alias', () => {
    const { steps } = parseQueryToSteps('data | select(name, round(price, 2) as roundedPrice)');
    expect(stripIds(steps)).toEqual([
      {
        type: 'select',
        config: {
          fields: ['name'],
          expressions: ['round(price, 2) as roundedPrice'],
        },
      },
    ]);
  });

  it('parses select with complex nested function expressions', () => {
    const query = 'crypto | select(symbol, name, priceUsd, round(priceUsd * EUR, 2) as priceEur, round(priceUsd * GBP, 2) as priceGbp, round(priceUsd * JPY, 0) as priceJpy)';
    const { steps } = parseQueryToSteps(query);
    const selectStep = steps[0].step as { type: 'select'; config: { fields: string[]; expressions: string[] } };
    expect(selectStep.type).toBe('select');
    expect(selectStep.config.fields).toEqual(['symbol', 'name', 'priceUsd']);
    expect(selectStep.config.expressions).toEqual([
      'round(priceUsd * EUR, 2) as priceEur',
      'round(priceUsd * GBP, 2) as priceGbp',
      'round(priceUsd * JPY, 0) as priceJpy',
    ]);
  });

  // ─── join ──────────────────────────────────────────────────────────────────

  it('parses join with source and condition', () => {
    const { steps } = parseQueryToSteps('crypto | join(fxFlat, 1 == 1)');
    expect(stripIds(steps)).toEqual([
      { type: 'join', config: { rightSource: 'fxFlat', condition: '1 == 1' } },
    ]);
  });

  it('parses join with complex condition', () => {
    const { steps } = parseQueryToSteps('orders | join(customers, orders.custId == customers.id)');
    expect(stripIds(steps)).toEqual([
      { type: 'join', config: { rightSource: 'customers', condition: 'orders.custId == customers.id' } },
    ]);
  });

  // ─── groupBy ───────────────────────────────────────────────────────────────

  it('parses groupBy', () => {
    const { steps } = parseQueryToSteps('data | groupBy(category, region)');
    expect(stripIds(steps)).toEqual([
      { type: 'groupBy', config: { fields: ['category', 'region'] } },
    ]);
  });

  // ─── distinct ──────────────────────────────────────────────────────────────

  it('parses distinct with fields', () => {
    const { steps } = parseQueryToSteps('data | distinct(name, category)');
    expect(stripIds(steps)).toEqual([
      { type: 'distinct', config: { fields: ['name', 'category'] } },
    ]);
  });

  it('parses distinct without fields', () => {
    const { steps } = parseQueryToSteps('data | distinct()');
    expect(stripIds(steps)).toEqual([
      { type: 'distinct', config: { fields: [] } },
    ]);
  });

  // ─── map ───────────────────────────────────────────────────────────────────

  it('parses map with expressions', () => {
    const { steps } = parseQueryToSteps('data | map(price * 1.1 as newPrice, qty + 1 as newQty)');
    expect(stripIds(steps)).toEqual([
      { type: 'map', config: { expressions: ['price * 1.1 as newPrice', 'qty + 1 as newQty'] } },
    ]);
  });

  // ─── reduce ────────────────────────────────────────────────────────────────

  it('parses reduce', () => {
    const { steps } = parseQueryToSteps('data | reduce(0, acc + price)');
    expect(stripIds(steps)).toEqual([
      { type: 'reduce', config: { initial: '0', accumulator: 'acc + price' } },
    ]);
  });

  // ─── rollup ────────────────────────────────────────────────────────────────

  it('parses rollup with keys and aggregates', () => {
    const { steps } = parseQueryToSteps('data | rollup(category, sum(price), avg(qty))');
    expect(stripIds(steps)).toEqual([
      { type: 'rollup', config: { keys: ['category'], aggregates: ['sum(price)', 'avg(qty)'] } },
    ]);
  });

  // ─── pivot ─────────────────────────────────────────────────────────────────

  it('parses pivot', () => {
    const { steps } = parseQueryToSteps('data | pivot(region, sum(sales))');
    expect(stripIds(steps)).toEqual([
      { type: 'pivot', config: { pivotField: 'region', aggregates: ['sum(sales)'] } },
    ]);
  });

  // ─── flatten / transpose ───────────────────────────────────────────────────

  it('parses flatten with field', () => {
    const { steps } = parseQueryToSteps('data | flatten(items)');
    expect(stripIds(steps)).toEqual([
      { type: 'flatten', config: { field: 'items' } },
    ]);
  });

  it('parses flatten without field', () => {
    const { steps } = parseQueryToSteps('data | flatten()');
    expect(stripIds(steps)).toEqual([
      { type: 'flatten', config: { field: '' } },
    ]);
  });

  it('parses transpose', () => {
    const { steps } = parseQueryToSteps('data | transpose(name)');
    expect(stripIds(steps)).toEqual([
      { type: 'transpose', config: { headerField: 'name' } },
    ]);
  });

  // ─── Multi-step pipelines ──────────────────────────────────────────────────

  it('parses a complex multi-step pipeline', () => {
    const query = 'crypto | sort(marketCapUsd desc) | first(10) | join(fxFlat, 1 == 1) | select(symbol, name, priceUsd)';
    const { source, steps } = parseQueryToSteps(query);
    expect(source).toBe('crypto');
    expect(steps).toHaveLength(4);
    expect(steps[0].step.type).toBe('sort');
    expect(steps[1].step.type).toBe('first');
    expect(steps[2].step.type).toBe('join');
    expect(steps[3].step.type).toBe('select');
  });

  it('parses the full demo join query', () => {
    const query = 'crypto | sort(marketCapUsd desc) | first(10) | join(fxFlat, 1 == 1) | select(symbol, name, priceUsd, round(priceUsd * EUR, 2) as priceEur, round(priceUsd * GBP, 2) as priceGbp, round(priceUsd * JPY, 0) as priceJpy)';
    const { source, steps } = parseQueryToSteps(query);
    expect(source).toBe('crypto');
    expect(steps).toHaveLength(4);

    const sort = steps[0].step as { type: 'sort'; config: { criteria: Array<{ field: string; direction: string }> } };
    expect(sort.config.criteria).toEqual([{ field: 'marketCapUsd', direction: 'desc' }]);

    const first = steps[1].step as { type: 'first'; config: { count: number } };
    expect(first.config.count).toBe(10);

    const join = steps[2].step as { type: 'join'; config: { rightSource: string; condition: string } };
    expect(join.config.rightSource).toBe('fxFlat');
    expect(join.config.condition).toBe('1 == 1');

    const select = steps[3].step as { type: 'select'; config: { fields: string[]; expressions: string[] } };
    expect(select.config.fields).toEqual(['symbol', 'name', 'priceUsd']);
    expect(select.config.expressions).toHaveLength(3);
  });

  // ─── Edge cases ────────────────────────────────────────────────────────────

  it('skips unrecognised operations gracefully', () => {
    const { source, steps } = parseQueryToSteps('data | unknownOp(x) | first(5)');
    expect(source).toBe('data');
    expect(steps).toHaveLength(1);
    expect(steps[0].step.type).toBe('first');
  });

  it('skips malformed segments (no parens)', () => {
    const { source, steps } = parseQueryToSteps('data | notAnOp | first(3)');
    expect(source).toBe('data');
    expect(steps).toHaveLength(1);
    expect(steps[0].step.type).toBe('first');
  });

  it('handles extra whitespace gracefully', () => {
    const { source, steps } = parseQueryToSteps('  crypto  |  first( 10 )  ');
    expect(source).toBe('crypto');
    expect(steps).toHaveLength(1);
    expect((steps[0].step as any).config.count).toBe(10);
  });

  // ─── Roundtrip tests ──────────────────────────────────────────────────────

  describe('roundtrip: parse(generate(source, steps)) ≈ steps', () => {
    it('roundtrips sort + first', () => {
      const original: PipelineStep[] = [
        { id: 'pq_0', step: { type: 'sort', config: { criteria: [{ field: 'price', direction: 'desc' }] } } },
        { id: 'pq_1', step: { type: 'first', config: { count: 5 } } },
      ];
      const dsl = generateQuery('sales', original);
      const { source, steps } = parseQueryToSteps(dsl);
      expect(source).toBe('sales');
      expect(stripIds(steps)).toEqual(stripIds(original));
    });

    it('roundtrips where + select', () => {
      const original: PipelineStep[] = [
        { id: 'pq_0', step: { type: 'where', config: { condition: 'price > 10' } } },
        { id: 'pq_1', step: { type: 'select', config: { fields: ['name', 'price'], expressions: [] } } },
      ];
      const dsl = generateQuery('products', original);
      const { source, steps } = parseQueryToSteps(dsl);
      expect(source).toBe('products');
      expect(stripIds(steps)).toEqual(stripIds(original));
    });

    it('roundtrips join', () => {
      const original: PipelineStep[] = [
        { id: 'pq_0', step: { type: 'join', config: { rightSource: 'fxFlat', condition: '1 == 1' } } },
      ];
      const dsl = generateQuery('crypto', original);
      const { source, steps } = parseQueryToSteps(dsl);
      expect(source).toBe('crypto');
      expect(stripIds(steps)).toEqual(stripIds(original));
    });

    it('roundtrips groupBy + distinct', () => {
      const original: PipelineStep[] = [
        { id: 'pq_0', step: { type: 'groupBy', config: { fields: ['category'] } } },
        { id: 'pq_1', step: { type: 'distinct', config: { fields: ['name'] } } },
      ];
      const dsl = generateQuery('data', original);
      const { source, steps } = parseQueryToSteps(dsl);
      expect(source).toBe('data');
      expect(stripIds(steps)).toEqual(stripIds(original));
    });

    it('roundtrips flatten + transpose', () => {
      const original: PipelineStep[] = [
        { id: 'pq_0', step: { type: 'flatten', config: { field: 'items' } } },
        { id: 'pq_1', step: { type: 'transpose', config: { headerField: 'name' } } },
      ];
      const dsl = generateQuery('data', original);
      const { source, steps } = parseQueryToSteps(dsl);
      expect(source).toBe('data');
      expect(stripIds(steps)).toEqual(stripIds(original));
    });

    it('roundtrips reduce', () => {
      const original: PipelineStep[] = [
        { id: 'pq_0', step: { type: 'reduce', config: { initial: '0', accumulator: 'acc + price' } } },
      ];
      const dsl = generateQuery('data', original);
      const { source, steps } = parseQueryToSteps(dsl);
      expect(source).toBe('data');
      expect(stripIds(steps)).toEqual(stripIds(original));
    });
  });
});
