import { describe, it, expect } from 'vitest';
import { tokenize } from '../src/engine/lexer';
import { parse } from '../src/engine/parser';
import { ParseError } from '../src/engine/types';

function parseExpr(expr: string) {
  return parse(tokenize(expr));
}

describe('Parser', () => {
  describe('pipeline structure', () => {
    it('parses source with no operations', () => {
      const ast = parseExpr('orders');
      expect(ast.kind).toBe('Pipeline');
      expect(ast.source).toBe('orders');
      expect(ast.operations).toHaveLength(0);
    });

    it('parses source with multiple piped operations', () => {
      const ast = parseExpr('data | where(x > 1) | select(x, y)');
      expect(ast.source).toBe('data');
      expect(ast.operations).toHaveLength(2);
      expect(ast.operations[0].kind).toBe('WhereOp');
      expect(ast.operations[1].kind).toBe('SelectOp');
    });

    it('throws on trailing tokens', () => {
      expect(() => parseExpr('data | where(x > 1) foo')).toThrow(ParseError);
    });
  });

  describe('expression parsing', () => {
    it('parses field access with dot notation', () => {
      const ast = parseExpr('d | select(user.address.city)');
      const field = (ast.operations[0] as any).fields[0];
      expect(field.kind).toBe('FieldAccess');
      expect(field.path).toEqual(['user', 'address', 'city']);
    });

    it('parses alias expressions', () => {
      const ast = parseExpr('d | select(price as cost)');
      const field = (ast.operations[0] as any).fields[0];
      expect(field.kind).toBe('AliasExpr');
      expect(field.alias).toBe('cost');
      expect(field.expression.kind).toBe('FieldAccess');
    });

    it('parses binary operator precedence: * before +', () => {
      const ast = parseExpr('d | where(a + b * c > 0)');
      const cond = (ast.operations[0] as any).condition;
      // (a + (b * c)) > 0
      expect(cond.operator).toBe('>');
      expect(cond.left.operator).toBe('+');
      expect(cond.left.right.operator).toBe('*');
    });

    it('parses && (logical AND)', () => {
      const ast = parseExpr('d | where(a && b)');
      const cond = (ast.operations[0] as any).condition;
      expect(cond.operator).toBe('&&');
    });

    it('parses unary not and negation', () => {
      const ast = parseExpr('d | where(!active)');
      const cond = (ast.operations[0] as any).condition;
      expect(cond.kind).toBe('UnaryExpr');
      expect(cond.operator).toBe('!');

      const ast2 = parseExpr('d | select(-price)');
      const field = (ast2.operations[0] as any).fields[0];
      expect(field.kind).toBe('UnaryExpr');
      expect(field.operator).toBe('-');
    });

    it('parses grouped expressions with parentheses', () => {
      const ast = parseExpr('d | where((a + b) * c > 0)');
      const cond = (ast.operations[0] as any).condition;
      expect(cond.left.operator).toBe('*');
      expect(cond.left.left.operator).toBe('+');
    });

    it('parses function calls', () => {
      const ast = parseExpr('d | select(sum(price), count())');
      const fields = (ast.operations[0] as any).fields;
      expect(fields[0].kind).toBe('FunctionCall');
      expect(fields[0].name).toBe('sum');
      expect(fields[0].args).toHaveLength(1);
      expect(fields[1].name).toBe('count');
      expect(fields[1].args).toHaveLength(0);
    });

    it('parses all literal types', () => {
      const ast = parseExpr('d | select(42 as num, "hello" as str, true as flag, null as n)');
      const fields = (ast.operations[0] as any).fields;
      expect(fields[0].expression.kind).toBe('NumberLiteral');
      expect(fields[1].expression.kind).toBe('StringLiteral');
      expect(fields[2].expression.kind).toBe('BooleanLiteral');
      expect(fields[3].expression.kind).toBe('NullLiteral');
    });
  });

  describe('operations', () => {
    it('parses sort with direction', () => {
      const ast = parseExpr('d | sort(price desc, name asc)');
      const op = ast.operations[0] as any;
      expect(op.kind).toBe('SortOp');
      expect(op.criteria).toHaveLength(2);
      expect(op.criteria[0].direction).toBe('desc');
      expect(op.criteria[1].direction).toBe('asc');
    });

    it('sort defaults to asc', () => {
      const ast = parseExpr('d | sort(price)');
      expect((ast.operations[0] as any).criteria[0].direction).toBe('asc');
    });

    it('parses groupBy', () => {
      const ast = parseExpr('d | groupBy(category, region)');
      const op = ast.operations[0] as any;
      expect(op.kind).toBe('GroupByOp');
      expect(op.keys).toHaveLength(2);
    });

    it('parses join', () => {
      const ast = parseExpr('orders | join(customers, customerId == id)');
      const op = ast.operations[0] as any;
      expect(op.kind).toBe('JoinOp');
      expect(op.right).toBe('customers');
      expect(op.condition.operator).toBe('==');
    });

    it('parses first and last', () => {
      const ast = parseExpr('d | first(5)');
      expect((ast.operations[0] as any).count).toBe(5);
      const ast2 = parseExpr('d | last(3)');
      expect((ast2.operations[0] as any).count).toBe(3);
    });

    it('parses distinct with and without fields', () => {
      const ast1 = parseExpr('d | distinct()');
      expect((ast1.operations[0] as any).fields).toBeUndefined();

      const ast2 = parseExpr('d | distinct(name, email)');
      expect((ast2.operations[0] as any).fields).toHaveLength(2);
    });

    it('parses flatten with and without field', () => {
      const ast1 = parseExpr('d | flatten()');
      expect((ast1.operations[0] as any).field).toBeUndefined();

      const ast2 = parseExpr('d | flatten(items)');
      expect((ast2.operations[0] as any).field.path).toEqual(['items']);
    });

    it('parses rollup with keys and aggregates', () => {
      const ast = parseExpr('d | rollup(region, sum(sales))');
      const op = ast.operations[0] as any;
      expect(op.kind).toBe('RollupOp');
      expect(op.keys).toHaveLength(1);
      expect(op.aggregates).toHaveLength(1);
    });

    it('rollup requires at least one aggregate', () => {
      expect(() => parseExpr('d | rollup(region)')).toThrow(ParseError);
    });

    it('rollup rejects keys after aggregates', () => {
      expect(() => parseExpr('d | rollup(sum(x), region)')).toThrow(ParseError);
    });

    it('parses pivot', () => {
      const ast = parseExpr('d | pivot(category, sum(amount))');
      const op = ast.operations[0] as any;
      expect(op.kind).toBe('PivotOp');
      expect(op.pivotField.path).toEqual(['category']);
      expect(op.aggregates).toHaveLength(1);
    });

    it('parses map', () => {
      const ast = parseExpr('d | map(x + 1 as y)');
      const op = ast.operations[0] as any;
      expect(op.kind).toBe('MapOp');
      expect(op.fields).toHaveLength(1);
    });

    it('parses reduce', () => {
      const ast = parseExpr('d | reduce(0, _acc + price)');
      const op = ast.operations[0] as any;
      expect(op.kind).toBe('ReduceOp');
    });

    it('parses standalone aggregate operations', () => {
      const ast = parseExpr('d | sum(price)');
      const op = ast.operations[0] as any;
      expect(op.kind).toBe('AggregateOp');
      expect(op.function).toBe('sum');
    });

    it('parses two-arg aggregates (percentile, vwap, wavg)', () => {
      const ast = parseExpr('d | percentile(price, 95)');
      const op = ast.operations[0] as any;
      expect(op.kind).toBe('AggregateOp');
      expect(op.function).toBe('percentile');
      expect(op.args).toHaveLength(2);
    });

    it('throws on unknown operation', () => {
      expect(() => parseExpr('d | foobar(x)')).toThrow(ParseError);
    });
  });
});
