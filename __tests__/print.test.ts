/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import { parseQuery, printQuery, compileAst, query } from '../src/engine/index';
import type { Expression, Operation, Pipeline } from '../src/engine/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

const OP_KEYWORDS = new Set([
  'where', 'select', 'sort', 'groupBy', 'join', 'first', 'last', 'distinct',
  'map', 'reduce', 'rollup', 'pivot', 'flatten', 'transpose',
]);

/** Mirrors the engine's `query(rows, 'op(...)')` shortcut. */
function normalize(s: string): string {
  const m = s.trimStart().match(/^(\w+)\s*\(/);
  return m && OP_KEYWORDS.has(m[1]) ? `_data | ${s.trimStart()}` : s;
}

function roundTrip(src: string): { ast: Pipeline; printed: string } {
  const ast = parseQuery(src);
  const printed = printQuery(ast);
  expect(parseQuery(printed), `re-parse of ${printed}`).toEqual(ast);
  // Printing is a fixpoint
  expect(printQuery(parseQuery(printed))).toBe(printed);
  return { ast, printed };
}

const num = (value: number): Expression => ({ kind: 'NumberLiteral', value });
const str = (value: string): Expression => ({ kind: 'StringLiteral', value });
const field = (...path: string[]): Expression => ({ kind: 'FieldAccess', path });
const bin = (operator: any, left: Expression, right: Expression): Expression => ({ kind: 'BinaryExpr', operator, left, right });
const un = (operator: '!' | '-', operand: Expression): Expression => ({ kind: 'UnaryExpr', operator, operand });
const call = (name: string, ...args: Expression[]): Expression => ({ kind: 'FunctionCall', name, args });
const alias = (expression: Expression, name: string): Expression => ({ kind: 'AliasExpr', expression, alias: name });
const pipe = (...operations: Operation[]): Pipeline => ({ kind: 'Pipeline', source: 'd', operations });
const where = (condition: Expression): Operation => ({ kind: 'WhereOp', condition });

/** Prints `d | where(<expr>)` and returns just the expression text. */
function printExpr(e: Expression): string {
  const out = printQuery(pipe(where(e)));
  return out.slice('d | where('.length, -1);
}

// ─── Corpus ─────────────────────────────────────────────────────────────────

const HAND_CORPUS = [
  'orders',
  'orders | where(price > 100)',
  'orders | where(price >= 10 && qty <= 5)',
  'orders | where(a == 1 && b != 2 && !c)',
  'orders | where(status == "active" && region != \'EU\')',
  'orders | where(user.address.city == "Rome")',
  'orders | where(a + b * c > 0)',
  'orders | where((a + b) * c > 0)',
  'orders | where(a - (b - c) == 0)',
  'orders | where(a - b - c == 0)',
  'orders | where(a / (b * c) > 1 && a % 2 == 0)',
  'orders | where(!(a && b))',
  'orders | where(-(a + b) < 0)',
  'orders | where(x == null || y == null)'.replace('||', '&&'),
  'orders | where(flag == true && other == false)',
  'orders | where(price > 1.5 && price < 99.99)',
  'orders | where(contains(name, "foo") && startsWith(name, "f") && endsWith(name, "o"))',
  'orders | where(len(name) > 3)',
  'orders | select(id, name)',
  'orders | select(id, price * qty as total)',
  'orders | select(upper(name) as n, round(price, 2) as p)',
  'orders | select(if(a > 1, "big", "small") as size)',
  'orders | select(if(a > 1, "big") as size)',
  'orders | select(coalesce(a, b, 0) as v)',
  'orders | select(concat(first_name, " ", last_name) as full)',
  'orders | select(user.name as userName)',
  'orders | select()',
  'orders | sort(price)',
  'orders | sort(price desc)',
  'orders | sort(price asc, name desc)',
  'orders | sort(a + b desc, c)',
  'orders | sort()',
  'orders | groupBy(region)',
  'orders | groupBy(region, category)',
  'orders | groupBy(region) | select(region, sum(price) as total, count() as n)',
  'orders | groupBy(region) | select(region, avg(price) as mean, percentile(price, 0.9) as p90)',
  'orders | join(customers, customerId == id)',
  'orders | join(customers, customerId == id && region == customers_region)',
  'orders | join(customers, customerId == id as c)',
  'orders | first(10)',
  'orders | first(0)',
  'orders | last(3)',
  'orders | distinct()',
  'orders | distinct(region)',
  'orders | distinct(region, category)',
  'orders | flatten()',
  'orders | flatten(items)',
  'orders | transpose()',
  'orders | transpose(name)',
  'orders | rollup(sum(price) as total)',
  'orders | rollup(region, sum(price) as total, avg(price) as mean)',
  'orders | rollup(region, category, count())',
  'orders | rollup(region as r, sum(price))',
  'orders | pivot(region, sum(price) as total)',
  'orders | pivot(region, sum(price) as total, count() as n)',
  'orders | map(price * 2 as double)',
  'orders | map(id, name)',
  'orders | reduce(0, acc + price)',
  'orders | reduce(0, acc + price as total)',
  'orders | reduce("", concat(acc, name))',
  'orders | sum(price)',
  'orders | sum()',
  'orders | percentile(price, 0.5)',
  'orders | vwap(price, qty)',
  'orders | wavg(price, qty)',
  'orders | info_ratio(ret, bench)',
  'orders | select(running_sum(price) as rs, running_avg(price) as ra, running_count(price) as rc)',
  'orders | select(running_min(price) as mn, running_max(price) as mx, row_number() as rn)',
  'orders | select(lag(price) as prev, lag(price, 2) as prev2, lead(price, 3) as next)',
  'orders | where(price > 10) | sort(price desc) | first(5) | select(id, price)',
  'orders | where(a > 1) | groupBy(region) | rollup(region, sum(price) as t) | sort(t desc)',
  'orders | select(-price as neg, - -price as pos, !flag as nflag)',
  'orders | where(a - -1 > 0)',
  'orders | where(1 - 2 - 3 == 0)',
  'orders | where(2 * (3 + 4) == 14)',
  'orders | where(a == (b == c))',
  'orders | where(a < b == c > d)',
  'orders | where((a == b) == c)',
  'orders | where(!x == y)',
  'orders | where(!(x == y))',
  'orders | where(-a * b > 0)',
  'orders | where(-(a * b) > 0)',
  'orders | select((a as x) + 1)',
  'orders | select(f(a as x, b as y) as z)',
  'orders | select(f() as z)',
  'orders | where(name == "he said \\"hi\\"")',
  'orders | where(name == \'it\\\'s\')',
  'orders | where(name == "line1\\nline2\\ttabbed")',
  'orders | where(name == "back\\\\slash")',
  'orders | where(name == "")',
  '_data | where(x > 1)',
  'a_b1 | select(c_d2, _e3)',
];

const AGG_ONE = [
  'sum', 'avg', 'min', 'max', 'count', 'median', 'stddev', 'var', 'skew', 'kurt',
  'drawdown', 'pct', 'sharpe', 'calmar', 'sortino', 'distinct_count', 'sum_abs',
  'abs_sum', 'first_value', 'last_value',
];
const AGG_TWO = ['percentile', 'vwap', 'wavg', 'info_ratio'];

/** Pull pipeline-looking string literals out of the existing test suites. */
function harvestExistingCorpus(): string[] {
  const sources = import.meta.glob('./{parser,query,runtime,live,cache,lexer}.test.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>;
  const literal = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\$]|\\.)*)`/g;
  const found = new Set<string>();
  for (const text of Object.values(sources)) {
    for (const m of text.matchAll(literal)) {
      const s = m[1] ?? m[2] ?? m[3];
      if (!s || s.includes('\\')) continue;
      if (!/^\s*(\w+\s*\||(where|select|sort|groupBy|join|first|last|distinct|map|reduce|rollup|pivot|flatten|transpose)\s*\()/.test(s)) continue;
      found.add(s);
    }
  }
  return [...found];
}

// ─── Round trips ────────────────────────────────────────────────────────────

describe('printQuery: round trip', () => {
  it.each(HAND_CORPUS)('hand corpus: %s', (src) => {
    roundTrip(src);
  });

  it.each(AGG_ONE)('standalone and grouped one-arg aggregate %s', (name) => {
    roundTrip(`d | ${name}(x)`);
    roundTrip(`d | ${name}()`);
    roundTrip(`d | groupBy(k) | select(k, ${name}(x) as v)`);
    roundTrip(`d | rollup(k, ${name}(x) as v)`);
    roundTrip(`d | pivot(k, ${name}(x) as v)`);
  });

  it.each(AGG_TWO)('standalone and grouped two-arg aggregate %s', (name) => {
    roundTrip(`d | ${name}(x, y)`);
    roundTrip(`d | rollup(k, ${name}(x, 0.5) as v)`);
  });

  it('round-trips the queries harvested from the existing test suites', () => {
    const corpus = harvestExistingCorpus();
    let checked = 0;
    for (const raw of corpus) {
      let ast: Pipeline;
      const src = normalize(raw);
      try {
        ast = parseQuery(src);
      } catch {
        continue; // intentionally invalid queries from error-path tests
      }
      let printed: string;
      try {
        printed = printQuery(ast);
      } catch (e) {
        throw new Error(`printQuery failed for parser-produced AST of "${raw}": ${(e as Error).message}`);
      }
      expect(parseQuery(printed), `re-parse of ${printed} (from ${raw})`).toEqual(ast);
      checked++;
    }
    expect(corpus.length).toBeGreaterThan(40);
    expect(checked).toBeGreaterThan(40);
  });

  it('prints a canonical, whitespace-normalised form', () => {
    expect(printQuery(parseQuery('orders|where(  price>100 )|sort( price   desc )|first( 5 )')))
      .toBe('orders | where(price > 100) | sort(price desc) | first(5)');
  });

  it('prints sort asc as the default (no keyword) and desc explicitly', () => {
    expect(printQuery(parseQuery('d | sort(a asc, b desc)'))).toBe('d | sort(a, b desc)');
  });

  it('produces results identical to the hand-written query', () => {
    const rows = [
      { id: 1, region: 'EU', price: 10, qty: 2 },
      { id: 2, region: 'US', price: 20, qty: 1 },
      { id: 3, region: 'EU', price: 30, qty: 4 },
    ];
    const src = 'd | where(price > 5 && qty >= 1) | groupBy(region) | select(region, sum(price * qty) as total) | sort(total desc)';
    const printed = printQuery(parseQuery(src));
    expect(query({ d: rows }, printed)).toEqual(query({ d: rows }, src));
  });

  it('compileAst compiles an AST without re-parsing and exposes the printed source', () => {
    const rows = [{ x: 1 }, { x: 5 }, { x: 9 }];
    const ast = parseQuery('d | where(x > 2) | select(x * 2 as y)');
    const compiled = compileAst(ast);
    expect(compiled({ d: rows })).toEqual([{ y: 10 }, { y: 18 }]);
    expect(compiled.source).toBe('d | where(x > 2) | select(x * 2 as y)');
    expect(compiled.ast).toBe(ast);
  });
});

// ─── Precedence & parenthesisation ──────────────────────────────────────────

describe('printQuery: precedence', () => {
  it('keeps parentheses that change structure', () => {
    expect(printExpr(bin('-', field('a'), bin('-', field('b'), field('c'))))).toBe('a - (b - c)');
    expect(printExpr(bin('*', bin('+', field('a'), field('b')), field('c')))).toBe('(a + b) * c');
    expect(printExpr(un('!', bin('&&', field('a'), field('b'))))).toBe('!(a && b)');
    expect(printExpr(un('-', bin('+', field('a'), field('b'))))).toBe('-(a + b)');
    expect(printExpr(bin('/', field('a'), bin('*', field('b'), field('c'))))).toBe('a / (b * c)');
    expect(printExpr(bin('%', field('a'), bin('%', field('b'), field('c'))))).toBe('a % (b % c)');
    expect(printExpr(bin('==', field('a'), bin('==', field('b'), field('c'))))).toBe('a == (b == c)');
    expect(printExpr(bin('&&', field('a'), bin('&&', field('b'), field('c'))))).toBe('a && (b && c)');
  });

  it('omits redundant parentheses', () => {
    expect(printExpr(bin('-', bin('-', field('a'), field('b')), field('c')))).toBe('a - b - c');
    expect(printExpr(bin('+', field('a'), bin('*', field('b'), field('c'))))).toBe('a + b * c');
    expect(printExpr(bin('&&', bin('==', field('a'), num(1)), bin('<', field('b'), num(2))))).toBe('a == 1 && b < 2');
    expect(printExpr(bin('>', bin('+', field('a'), field('b')), num(0)))).toBe('a + b > 0');
    expect(printExpr(un('!', un('!', field('a'))))).toBe('!!a');
    expect(printExpr(bin('*', un('-', field('a')), field('b')))).toBe('-a * b');
  });

  it('handles || and && precedence (a || b && c)', () => {
    // The lexer cannot tokenise `||` (known limitation), so check printing only.
    const orOfAnd = bin('||', field('a'), bin('&&', field('b'), field('c')));
    expect(printExpr(orOfAnd)).toBe('a || b && c');
    const andOfOr = bin('&&', bin('||', field('a'), field('b')), field('c'));
    expect(printExpr(andOfOr)).toBe('(a || b) && c');
    const orRight = bin('||', field('a'), bin('||', field('b'), field('c')));
    expect(printExpr(orRight)).toBe('a || (b || c)');
  });

  it.each([
    'a - (b - c)', '(a + b) * c', '!(a && b)', '-(a + b)', 'a + b * c', 'a * b + c',
    '(a == b) == c', 'a < b == c > d', '!(a == b)', '!a == b', '(a + b) - (c + d)',
    '-(-a)', '!(!a)', 'a - -b', '(a as x) + 1', '-(a as x)',
  ])('round-trips structure of %s', (expr) => {
    roundTrip(`d | where(${expr})`);
  });

  it('prints a double unary minus unambiguously', () => {
    expect(printExpr(un('-', un('-', field('a'))))).toBe('-(-a)');
    expect(printExpr(un('-', num(-3)))).toBe('-(-3)');
    expect(printExpr(un('!', num(-3)))).toBe('!-3');
  });
});

// ─── Literals ───────────────────────────────────────────────────────────────

describe('printQuery: numbers', () => {
  const printNum = (n: number) => printExpr(num(n));

  it('prints plain decimals', () => {
    expect(printNum(0)).toBe('0');
    expect(printNum(42)).toBe('42');
    expect(printNum(1.5)).toBe('1.5');
    expect(printNum(0.000001)).toBe('0.000001');
  });

  it('expands exponent forms into plain decimals', () => {
    expect(printNum(1e21)).toBe('1000000000000000000000');
    expect(printNum(1.5e21)).toBe('1500000000000000000000');
    expect(printNum(1e-7)).toBe('0.0000001');
    expect(printNum(1.5e-10)).toBe('0.00000000015');
    expect(printNum(1.2345e25)).toBe('12345000000000000000000000');
    expect(printNum(Number.MIN_VALUE)).toMatch(/^0\.0+5$/);
    expect(printNum(Number.MAX_VALUE)).toMatch(/^17976931348623157\d+$/);
  });

  it.each([1e21, 1e-7, 1.5e-10, 123456789.123456789, 1.7976931348623157e308, Number.MIN_VALUE, 0.1 + 0.2, 2 ** 53, 5e-324])(
    'value survives the round trip exactly: %s',
    (n) => {
      const ast = parseQuery(printQuery(pipe(where(num(n)))));
      expect((ast.operations[0] as any).condition).toEqual(num(n));
    },
  );

  it('never emits exponent notation', () => {
    for (const n of [1e21, 1e100, 1e-7, 1e-100, 1.234e-15, 9.99e22]) {
      expect(printNum(n)).not.toMatch(/e/i);
    }
  });

  it('prints negative literals as -n, which re-parses as unary minus', () => {
    expect(printNum(-5)).toBe('-5');
    expect(printNum(-1.5)).toBe('-1.5');
    expect(printNum(-1e-7)).toBe('-0.0000001');
    const ast = parseQuery(printQuery(pipe(where(num(-5)))));
    expect((ast.operations[0] as any).condition).toEqual(un('-', num(5)));
  });

  it('does not wrap negative literals as binary operands', () => {
    expect(printExpr(bin('-', field('a'), num(-1)))).toBe('a - -1');
    expect(printExpr(bin('*', num(-2), field('a')))).toBe('-2 * a');
  });

  it('prints -0 as a negative literal', () => {
    expect(printNum(-0)).toBe('-0');
  });

  it.each([NaN, Infinity, -Infinity])('throws on %s', (n) => {
    expect(() => printQuery(pipe(where(num(n))))).toThrow(/finite/);
  });
});

describe('printQuery: strings', () => {
  const lit = (s: string) => printExpr(str(s));
  const back = (s: string) => (parseQuery(printQuery(pipe(where(str(s))))).operations[0] as any).condition.value;

  it('uses double quotes', () => {
    expect(lit('abc')).toBe('"abc"');
    expect(lit('')).toBe('""');
  });

  it('escapes backslash, quote, newline and tab', () => {
    expect(lit('a"b')).toBe('"a\\"b"');
    expect(lit('a\\b')).toBe('"a\\\\b"');
    expect(lit('a\nb')).toBe('"a\\nb"');
    expect(lit('a\tb')).toBe('"a\\tb"');
  });

  it('does not escape single quotes', () => {
    expect(lit("it's")).toBe('"it\'s"');
  });

  it.each([
    'plain',
    '',
    'say "hi"',
    "it's",
    'back\\slash',
    'back\\\\double',
    'trailing backslash\\',
    '\\n literal backslash-n',
    'line1\nline2',
    'tab\there',
    'mix "q" \'s\' \\ \n \t end',
    '"',
    "'",
    '\\',
    '\r\n',
    'unicode ✓ é 日本語 🎉',
    'pipe | paren ( ) comma , as asc desc',
    '\u0000\u0001',
  ])('survives the round trip: %j', (s) => {
    expect(back(s)).toBe(s);
  });

  it('keeps values with an injection payload as a single literal', () => {
    const evil = '" ) | select(secret) | where("1" == "1';
    const ast = parseQuery(printQuery(pipe(where(bin('==', field('name'), str(evil))))));
    expect(ast.operations).toHaveLength(1);
    expect((ast.operations[0] as any).condition.right.value).toBe(evil);
  });

  it('throws on non-string literal values', () => {
    expect(() => printQuery(pipe(where({ kind: 'StringLiteral', value: 5 as any })))).toThrow(/string/);
  });
});

describe('printQuery: boolean and null', () => {
  it('prints true, false and null', () => {
    expect(printExpr({ kind: 'BooleanLiteral', value: true })).toBe('true');
    expect(printExpr({ kind: 'BooleanLiteral', value: false })).toBe('false');
    expect(printExpr({ kind: 'NullLiteral' })).toBe('null');
    roundTrip('d | where(a == null && b == true && c != false)');
  });
});

// ─── Identifiers ────────────────────────────────────────────────────────────

describe('printQuery: identifier validation', () => {
  const RESERVED = ['as', 'asc', 'desc', 'true', 'false', 'null'];
  const BAD = ['', 'a b', 'a-b', '1abc', 'a.b', 'é', 'a$', ' a', 'a\n', '"x"', 'a(b)'];
  const PROTO = ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__'];

  it.each(RESERVED)('rejects reserved word "%s" in every name position', (w) => {
    expect(() => printQuery({ kind: 'Pipeline', source: w, operations: [] })).toThrow(/reserved word/);
    expect(() => printQuery(pipe(where(field(w))))).toThrow(/reserved word/);
    expect(() => printQuery(pipe(where(field('a', w))))).toThrow(/reserved word/);
    expect(() => printQuery(pipe(where(call(w))))).toThrow(/reserved word/);
    expect(() => printQuery(pipe(where(alias(field('a'), w))))).toThrow(/reserved word/);
    expect(() => printQuery(pipe({ kind: 'JoinOp', right: w, condition: field('a') }))).toThrow(/reserved word/);
  });

  it.each(BAD)('rejects invalid identifier %j', (name) => {
    expect(() => printQuery({ kind: 'Pipeline', source: name, operations: [] })).toThrow(/invalid source name/);
    expect(() => printQuery(pipe(where(field(name))))).toThrow(/invalid field name/);
    expect(() => printQuery(pipe(where(field('a', name))))).toThrow(/invalid field name/);
    expect(() => printQuery(pipe(where(call(name))))).toThrow(/invalid function name/);
    expect(() => printQuery(pipe(where(alias(field('a'), name))))).toThrow(/invalid alias/);
    expect(() => printQuery(pipe({ kind: 'JoinOp', right: name, condition: field('a') }))).toThrow(/invalid join source/);
  });

  it.each(PROTO)('rejects Object.prototype name "%s" (the lexer cannot tokenise it)', (name) => {
    expect(() => printQuery({ kind: 'Pipeline', source: name, operations: [] })).toThrow(/built-in/);
    expect(() => printQuery(pipe(where(field(name))))).toThrow(/built-in/);
  });

  it('explains how to proceed for names with spaces or hyphens', () => {
    expect(() => printQuery(pipe(where(field('order-id'))))).toThrow(/cannot be expressed/);
  });

  it('rejects empty and non-array field paths', () => {
    expect(() => printQuery(pipe(where(field())))).toThrow(/non-empty path/);
    expect(() => printQuery(pipe(where({ kind: 'FieldAccess', path: 'a' as any })))).toThrow(/non-empty path/);
  });

  it('accepts underscores, digits after the first char and mixed case', () => {
    expect(printQuery({ kind: 'Pipeline', source: '_data', operations: [] })).toBe('_data');
    expect(printExpr(field('camelCase', 'snake_case_2', '_x'))).toBe('camelCase.snake_case_2._x');
    // keyword prefixes are fine
    expect(printExpr(field('asset', 'nullable', 'trueish', 'descr'))).toBe('asset.nullable.trueish.descr');
    roundTrip('d | select(asset.nullable as trueish, descr)');
  });
});

// ─── Alias placement ────────────────────────────────────────────────────────

describe('printQuery: alias placement', () => {
  const A = alias(field('a'), 'x');

  it('throws for aliases where the grammar forbids them', () => {
    expect(() => printQuery(pipe({ kind: 'SortOp', criteria: [{ expression: A, direction: 'asc' }] }))).toThrow(/not allowed in sort/);
    expect(() => printQuery(pipe({ kind: 'GroupByOp', keys: [A] }))).toThrow(/not allowed in groupBy/);
    expect(() => printQuery(pipe({ kind: 'GroupByOp', keys: [field('k'), A] }))).toThrow(/not allowed in groupBy/);
    expect(() => printQuery(pipe({ kind: 'DistinctOp', fields: [A] }))).toThrow(/not allowed in distinct/);
    expect(() => printQuery(pipe({ kind: 'FlattenOp', field: A }))).toThrow(/not allowed in flatten/);
    expect(() => printQuery(pipe({ kind: 'TransposeOp', headerField: A }))).toThrow(/not allowed in transpose/);
    expect(() => printQuery(pipe({ kind: 'AggregateOp', function: 'sum', field: A }))).toThrow(/not allowed/);
    expect(() => printQuery(pipe({ kind: 'AggregateOp', function: 'percentile', args: [A, num(1)] }))).toThrow(/not allowed/);
    expect(() => printQuery(pipe({ kind: 'AggregateOp', function: 'percentile', args: [field('a'), A] }))).toThrow(/not allowed/);
    expect(() => printQuery(pipe({ kind: 'PivotOp', pivotField: A, aggregates: [call('sum', field('v'))] }))).toThrow(/not allowed/);
  });

  it('allows aliases where the grammar allows them', () => {
    const agg = alias(call('sum', field('v')), 'total');
    expect(printQuery(pipe(where(A)))).toBe('d | where(a as x)');
    expect(printQuery(pipe({ kind: 'SelectOp', fields: [A] }))).toBe('d | select(a as x)');
    expect(printQuery(pipe({ kind: 'MapOp', fields: [A] }))).toBe('d | map(a as x)');
    expect(printQuery(pipe({ kind: 'JoinOp', right: 'r', condition: A }))).toBe('d | join(r, a as x)');
    expect(printQuery(pipe({ kind: 'RollupOp', keys: [A], aggregates: [agg] }))).toBe('d | rollup(a as x, sum(v) as total)');
    expect(printQuery(pipe({ kind: 'PivotOp', pivotField: field('p'), aggregates: [agg] }))).toBe('d | pivot(p, sum(v) as total)');
    expect(printQuery(pipe({ kind: 'ReduceOp', initial: alias(num(0), 'i'), accumulator: alias(field('a'), 'acc') }))).toBe('d | reduce(0 as i, a as acc)');
    expect(printQuery(pipe(where(call('f', A, alias(field('b'), 'y')))))).toBe('d | where(f(a as x, b as y))');
  });

  it('parenthesises aliases nested inside other expressions and round-trips them', () => {
    expect(printExpr(bin('+', A, num(1)))).toBe('(a as x) + 1');
    expect(printExpr(un('-', A))).toBe('-(a as x)');
    expect(printExpr(alias(A, 'y'))).toBe('(a as x) as y');
    roundTrip('d | select((a as x) as y)');
  });

  it('wraps no extra parentheses for an aliased binary expression', () => {
    expect(printQuery(pipe({ kind: 'SelectOp', fields: [alias(bin('*', field('p'), field('q')), 't')] })))
      .toBe('d | select(p * q as t)');
  });

  it('allows non-alias parenthesised sub-expressions in alias-free positions', () => {
    expect(printQuery(pipe({ kind: 'SortOp', criteria: [{ expression: bin('+', field('a'), field('b')), direction: 'desc' }] })))
      .toBe('d | sort(a + b desc)');
  });
});

// ─── Operation shapes and arities ───────────────────────────────────────────

describe('printQuery: operation rules', () => {
  const agg = call('sum', field('v'));

  it.each([-1, -0.5, NaN, Infinity])('first/last reject count %s', (n) => {
    expect(() => printQuery(pipe({ kind: 'FirstOp', count: n }))).toThrow(/first\(\) count/);
    expect(() => printQuery(pipe({ kind: 'LastOp', count: n }))).toThrow(/last\(\) count/);
  });

  it('first/last print non-negative literals, including large ones', () => {
    expect(printQuery(pipe({ kind: 'FirstOp', count: 0 }))).toBe('d | first(0)');
    expect(printQuery(pipe({ kind: 'LastOp', count: 1e21 }))).toBe('d | last(1000000000000000000000)');
    expect(printQuery(pipe({ kind: 'FirstOp', count: 1.5 }))).toBe('d | first(1.5)');
  });

  it('rollup requires at least one aggregate', () => {
    expect(() => printQuery(pipe({ kind: 'RollupOp', keys: [field('k')], aggregates: [] }))).toThrow(/at least one aggregate/);
    expect(() => printQuery(pipe({ kind: 'RollupOp', keys: [], aggregates: [] }))).toThrow(/at least one aggregate/);
  });

  it('rollup keys must not be aggregates and aggregates must be aggregates', () => {
    expect(() => printQuery(pipe({ kind: 'RollupOp', keys: [agg], aggregates: [agg] }))).toThrow(/keys must not be aggregate/);
    expect(() => printQuery(pipe({ kind: 'RollupOp', keys: [], aggregates: [field('k')] }))).toThrow(/must be aggregate function calls/);
  });

  it('rollup prints keys before aggregates and allows no keys', () => {
    expect(printQuery(pipe({ kind: 'RollupOp', keys: [], aggregates: [agg] }))).toBe('d | rollup(sum(v))');
    expect(printQuery(pipe({ kind: 'RollupOp', keys: [field('a'), field('b')], aggregates: [agg, call('count')] })))
      .toBe('d | rollup(a, b, sum(v), count())');
  });

  it('pivot requires at least one aggregate', () => {
    expect(() => printQuery(pipe({ kind: 'PivotOp', pivotField: field('p'), aggregates: [] }))).toThrow(/at least one aggregate/);
  });

  it('if() takes 2 or 3 arguments', () => {
    expect(() => printQuery(pipe(where(call('if', field('a')))))).toThrow(/2 or 3 arguments, got 1/);
    expect(() => printQuery(pipe(where(call('if'))))).toThrow(/2 or 3 arguments, got 0/);
    expect(() => printQuery(pipe(where(call('if', field('a'), num(1), num(2), num(3)))))).toThrow(/2 or 3 arguments, got 4/);
    expect(printExpr(call('if', field('a'), num(1)))).toBe('if(a, 1)');
    expect(printExpr(call('if', field('a'), num(1), num(2)))).toBe('if(a, 1, 2)');
  });

  it('lag/lead offsets must be non-negative numeric literals', () => {
    expect(() => printExpr(call('lag', field('a'), field('n')))).toThrow(/offset must be/);
    expect(() => printExpr(call('lead', field('a'), num(-1)))).toThrow(/offset must be/);
    expect(() => printExpr(call('lead', field('a'), str('1')))).toThrow(/offset must be/);
    expect(() => printExpr(call('lag'))).toThrow(/1 or 2 arguments/);
    expect(() => printExpr(call('lag', field('a'), num(1), num(2)))).toThrow(/1 or 2 arguments/);
    expect(printExpr(call('lag', field('a'), num(2)))).toBe('lag(a, 2)');
    expect(printExpr(call('lead', field('a')))).toBe('lead(a)');
  });

  it('two-argument aggregates require exactly two args, others reject args lists', () => {
    expect(() => printQuery(pipe({ kind: 'AggregateOp', function: 'percentile', field: field('a') }))).toThrow(/exactly 2 arguments/);
    expect(() => printQuery(pipe({ kind: 'AggregateOp', function: 'vwap', args: [field('a')] }))).toThrow(/exactly 2 arguments/);
    expect(() => printQuery(pipe({ kind: 'AggregateOp', function: 'sum', args: [field('a'), field('b')] }))).toThrow(/single optional field/);
    expect(() => printQuery(pipe({ kind: 'AggregateOp', function: 'nope' as any }))).toThrow(/unknown aggregate/);
  });

  it('prints the optional-argument ops without arguments', () => {
    expect(printQuery(pipe({ kind: 'DistinctOp' }))).toBe('d | distinct()');
    expect(printQuery(pipe({ kind: 'DistinctOp', fields: [] }))).toBe('d | distinct()');
    expect(printQuery(pipe({ kind: 'FlattenOp' }))).toBe('d | flatten()');
    expect(printQuery(pipe({ kind: 'TransposeOp' }))).toBe('d | transpose()');
    expect(printQuery(pipe({ kind: 'AggregateOp', function: 'count' }))).toBe('d | count()');
  });

  it('rejects an invalid sort direction', () => {
    expect(() => printQuery(pipe({ kind: 'SortOp', criteria: [{ expression: field('a'), direction: 'up' as any }] }))).toThrow(/direction/);
  });

  it('rejects unknown node kinds and operators', () => {
    expect(() => printQuery(pipe({ kind: 'NopeOp' } as any))).toThrow(/unknown operation kind/);
    expect(() => printQuery(pipe(where({ kind: 'Nope' } as any)))).toThrow(/unknown expression kind/);
    expect(() => printQuery(pipe(where(bin('**', field('a'), field('b')))))).toThrow(/unknown binary operator/);
    expect(() => printQuery(pipe(where(bin('constructor', field('a'), field('b')))))).toThrow(/unknown binary operator/);
    expect(() => printQuery(pipe(where(un('~' as any, field('a')))))).toThrow(/unknown unary operator/);
    expect(() => printQuery({ kind: 'Query' } as any)).toThrow(/Pipeline/);
    expect(() => printQuery(null as any)).toThrow(/Pipeline/);
    expect(() => printQuery({ kind: 'Pipeline', source: 'd' } as any)).toThrow(/operations/);
    expect(() => printQuery(pipe(where(null as any)))).toThrow(/expression node/);
  });

  it('rejects a non-boolean boolean literal', () => {
    expect(() => printQuery(pipe(where({ kind: 'BooleanLiteral', value: 'true' as any })))).toThrow(/boolean/);
  });

  it('every operation kind the parser produces is printable', () => {
    const kinds = new Set<string>();
    for (const src of HAND_CORPUS) for (const op of parseQuery(src).operations) kinds.add(op.kind);
    expect([...kinds].sort()).toEqual([
      'AggregateOp', 'DistinctOp', 'FirstOp', 'FlattenOp', 'GroupByOp', 'JoinOp', 'LastOp', 'MapOp',
      'PivotOp', 'ReduceOp', 'RollupOp', 'SelectOp', 'SortOp', 'TransposeOp', 'WhereOp',
    ]);
  });
});
