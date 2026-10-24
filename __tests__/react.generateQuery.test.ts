import { describe, it, expect } from 'vitest';
import { generateQuery, parseQueryToSteps, PipelineStep, StepConfig } from '../src/react/types';
import { parseQuery, query } from '../src/engine/index';

const mk = (...steps: StepConfig[]): PipelineStep[] => steps.map((step, i) => ({ id: `s${i}`, step }));

// The pre-refactor implementation: plain string join of the raw fragments.
function legacyGenerate(source: string, steps: PipelineStep[]): string {
  const frag = (s: StepConfig): string | null => {
    switch (s.type) {
      case 'where': return s.config.condition ? `where(${s.config.condition})` : null;
      case 'select': {
        const all = [...s.config.fields, ...s.config.expressions.filter(Boolean)];
        return all.length ? `select(${all.join(', ')})` : null;
      }
      case 'sort': {
        const p = s.config.criteria.filter(c => c.field).map(c => (c.direction === 'desc' ? `${c.field} desc` : c.field));
        return p.length ? `sort(${p.join(', ')})` : null;
      }
      case 'groupBy': return s.config.fields.length ? `groupBy(${s.config.fields.join(', ')})` : null;
      case 'join': return s.config.rightSource && s.config.condition ? `join(${s.config.rightSource}, ${s.config.condition})` : null;
      case 'first': return `first(${s.config.count})`;
      case 'last': return `last(${s.config.count})`;
      case 'distinct': return s.config.fields.length ? `distinct(${s.config.fields.join(', ')})` : 'distinct()';
      case 'map': {
        const e = s.config.expressions.filter(Boolean);
        return e.length ? `map(${e.join(', ')})` : null;
      }
      case 'reduce': return s.config.initial && s.config.accumulator ? `reduce(${s.config.initial}, ${s.config.accumulator})` : null;
      case 'rollup': {
        const p = [...s.config.keys, ...s.config.aggregates.filter(Boolean)];
        return p.length ? `rollup(${p.join(', ')})` : null;
      }
      case 'pivot': {
        const a = s.config.aggregates.filter(Boolean);
        return s.config.pivotField && a.length ? `pivot(${s.config.pivotField}, ${a.join(', ')})` : null;
      }
      case 'flatten': return s.config.field ? `flatten(${s.config.field})` : 'flatten()';
      case 'transpose': return s.config.headerField ? `transpose(${s.config.headerField})` : 'transpose()';
    }
  };
  if (!source) return '';
  return [source, ...steps.map(s => frag(s.step)).filter((x): x is string => !!x)].join(' | ');
}

const fixtures: Array<[string, PipelineStep[]]> = [
  ['where', mk({ type: 'where', config: { condition: 'price > 100 && name != "BTC"' } })],
  ['select', mk({ type: 'select', config: { fields: ['a', 'b'], expressions: ['round(price * 2, 2) as p2'] } })],
  ['sort', mk({ type: 'sort', config: { criteria: [{ field: 'a', direction: 'desc' }, { field: 'b', direction: 'asc' }] } })],
  ['groupBy+rollup', mk(
    { type: 'groupBy', config: { fields: ['cat'] } },
    { type: 'select', config: { fields: ['cat'], expressions: ['sum(price) as total'] } },
  )],
  ['rollup', mk({ type: 'rollup', config: { keys: ['cat'], aggregates: ['sum(price) as total', 'avg(qty)'] } })],
  ['pivot', mk({ type: 'pivot', config: { pivotField: 'region', aggregates: ['sum(sales)'] } })],
  ['join', mk({ type: 'join', config: { rightSource: 'customers', condition: 'orders.custId == customers.id' } })],
  ['first/last', mk({ type: 'first', config: { count: 5 } }, { type: 'last', config: { count: 2 } })],
  ['distinct', mk({ type: 'distinct', config: { fields: [] } }, { type: 'distinct', config: { fields: ['x'] } })],
  ['map', mk({ type: 'map', config: { expressions: ['price * 1.1 as newPrice', 'qty + 1 as q'] } })],
  ['reduce', mk({ type: 'reduce', config: { initial: '0', accumulator: 'acc + price' } })],
  ['flatten/transpose', mk({ type: 'flatten', config: { field: 'items' } }, { type: 'transpose', config: { headerField: 'name' } })],
  ['empty steps skipped', mk({ type: 'where', config: { condition: '' } }, { type: 'select', config: { fields: [], expressions: [] } })],
];

describe('generateQuery (engine-backed)', () => {
  it.each(fixtures)('matches the legacy string join: %s', (_name, steps) => {
    expect(generateQuery('data', steps)).toBe(legacyGenerate('data', steps));
  });

  it('returns empty string without a source', () => {
    expect(generateQuery('', fixtures[0][1])).toBe('');
  });

  it('canonicalises spacing, quotes and redundant parentheses', () => {
    const out = generateQuery('data', mk({ type: 'where', config: { condition: "(price>100)&&name!='BTC'" } }));
    expect(out).toBe('data | where(price > 100 && name != "BTC")');
  });

  it('keeps parentheses that matter', () => {
    const out = generateQuery('data', mk({ type: 'map', config: { expressions: ['(a + b) * c as x'] } }));
    expect(out).toBe('data | map((a + b) * c as x)');
  });

  it('generated query is equivalent when executed', () => {
    const rows = [{ price: 150, name: 'ETH' }, { price: 90, name: 'BTC' }, { price: 200, name: 'BTC' }];
    const steps = mk({ type: 'where', config: { condition: "price>100 && name != 'BTC'" } });
    const q = generateQuery('data', steps);
    expect(query({ data: rows }, q)).toEqual([{ price: 150, name: 'ETH' }]);
  });

  describe('falls back to the raw fragment on parse failure', () => {
    it('incomplete expression', () => {
      const out = generateQuery('data', mk({ type: 'where', config: { condition: 'price >' } }));
      expect(out).toBe('data | where(price >)');
    });

    it('keeps valid steps canonical while leaving the broken one raw', () => {
      const out = generateQuery('data', mk(
        { type: 'where', config: { condition: 'a>1' } },
        { type: 'where', config: { condition: 'b >' } },
      ));
      expect(out).toBe('data | where(a > 1) | where(b >)');
    });

    it('does not let an injected pipe split a fragment', () => {
      const out = generateQuery('data', mk({ type: 'where', config: { condition: 'x > 1) | first(1' } }));
      expect(out).toBe(legacyGenerate('data', mk({ type: 'where', config: { condition: 'x > 1) | first(1' } })));
    });

    it('non-identifier source is kept as-is', () => {
      expect(generateQuery('my-source', mk({ type: 'first', config: { count: 3 } }))).toBe('my-source | first(3)');
    });
  });
});

describe('parseQueryToSteps (AST-backed)', () => {
  it('maps queries through the AST and canonicalises strings', () => {
    const { source, steps } = parseQueryToSteps("data | where(price>100 && name != 'BTC')");
    expect(source).toBe('data');
    expect(steps.map(s => s.step)).toEqual([
      { type: 'where', config: { condition: 'price > 100 && name != "BTC"' } },
    ]);
  });

  it('falls back to the splitter for operators the lexer cannot parse (||)', () => {
    const { steps } = parseQueryToSteps('data | where(a > 1 || b < 2) | first(3)');
    expect(steps.map(s => s.step)).toEqual([
      { type: 'where', config: { condition: 'a > 1 || b < 2' } },
      { type: 'first', config: { count: 3 } },
    ]);
  });

  it('falls back for terminal aggregates, skipping them like before', () => {
    const { steps } = parseQueryToSteps('data | first(3) | sum(price)');
    expect(steps.map(s => s.step.type)).toEqual(['first']);
  });

  it('keeps nested field access as a select field', () => {
    const { steps } = parseQueryToSteps('data | select(a.b, c)');
    expect(steps[0].step).toEqual({ type: 'select', config: { fields: ['a.b', 'c'], expressions: [] } });
  });

  it('rollup splits keys and aggregates from the AST', () => {
    const { steps } = parseQueryToSteps('data | rollup(cat, sum(price) as total)');
    expect(steps[0].step).toEqual({ type: 'rollup', config: { keys: ['cat'], aggregates: ['sum(price) as total'] } });
  });

  it.each(fixtures.filter(([n]) => n !== 'empty steps skipped'))('round-trips fixtures through the AST: %s', (_n, steps) => {
    const q = generateQuery('data', steps);
    const parsed = parseQueryToSteps(q);
    expect(parsed.source).toBe('data');
    // Regenerating the parsed steps yields the same query, and it still parses.
    expect(generateQuery(parsed.source, parsed.steps)).toBe(q);
    expect(() => parseQuery(q)).not.toThrow();
  });
});
