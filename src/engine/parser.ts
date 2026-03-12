import type {
  Token,
  TokenType,
  Expression,
  Operation,
  Pipeline,
  FieldAccess,
  AliasExpr,
  AggregateFnName,
} from './types';
import { ParseError, AGGREGATE_NAMES, TWO_ARG_AGGREGATES } from './types';

export function parse(tokens: Token[]): Pipeline {
  let pos = 0;

  function peek(): Token {
    return tokens[pos];
  }

  function advance(): Token {
    const token = tokens[pos];
    pos++;
    return token;
  }

  function expect(type: TokenType, context?: string): Token {
    const token = peek();
    if (token.type !== type) {
      const ctx = context ? ` ${context}` : '';
      throw new ParseError(
        `Expected ${type} but found ${token.type} ('${token.value}')${ctx}`,
        token.position,
        token.line,
        token.column,
      );
    }
    return advance();
  }

  function match(type: TokenType): boolean {
    if (peek().type === type) {
      advance();
      return true;
    }
    return false;
  }

  // ─── Expression Parsing (operator precedence) ──────────────────────────

  function parseExpression(): Expression {
    let expr = parseOrExpr();
    // Check for alias: `expr as name`
    if (peek().type === 'AS') {
      advance();
      const nameToken = expect('IDENTIFIER', 'after "as"');
      expr = { kind: 'AliasExpr', expression: expr, alias: nameToken.value } satisfies AliasExpr;
    }
    return expr;
  }

  function parseOrExpr(): Expression {
    let left = parseAndExpr();
    while (peek().type === 'OR') {
      advance();
      const right = parseAndExpr();
      left = { kind: 'BinaryExpr', operator: '||', left, right };
    }
    return left;
  }

  function parseAndExpr(): Expression {
    let left = parseEqualityExpr();
    while (peek().type === 'AND') {
      advance();
      const right = parseEqualityExpr();
      left = { kind: 'BinaryExpr', operator: '&&', left, right };
    }
    return left;
  }

  function parseEqualityExpr(): Expression {
    let left = parseComparisonExpr();
    while (peek().type === 'EQ' || peek().type === 'NEQ') {
      const op = advance().value as '==' | '!=';
      const right = parseComparisonExpr();
      left = { kind: 'BinaryExpr', operator: op, left, right };
    }
    return left;
  }

  function parseComparisonExpr(): Expression {
    let left = parseAdditiveExpr();
    while (peek().type === 'GT' || peek().type === 'GTE' || peek().type === 'LT' || peek().type === 'LTE') {
      const op = advance().value as '>' | '>=' | '<' | '<=';
      const right = parseAdditiveExpr();
      left = { kind: 'BinaryExpr', operator: op, left, right };
    }
    return left;
  }

  function parseAdditiveExpr(): Expression {
    let left = parseMultiplicativeExpr();
    while (peek().type === 'PLUS' || peek().type === 'MINUS') {
      const op = advance().value as '+' | '-';
      const right = parseMultiplicativeExpr();
      left = { kind: 'BinaryExpr', operator: op, left, right };
    }
    return left;
  }

  function parseMultiplicativeExpr(): Expression {
    let left = parseUnaryExpr();
    while (peek().type === 'STAR' || peek().type === 'SLASH' || peek().type === 'MOD') {
      const op = advance().value as '*' | '/' | '%';
      const right = parseUnaryExpr();
      left = { kind: 'BinaryExpr', operator: op, left, right };
    }
    return left;
  }

  function parseUnaryExpr(): Expression {
    if (peek().type === 'NOT') {
      advance();
      const operand = parseUnaryExpr();
      return { kind: 'UnaryExpr', operator: '!', operand };
    }
    if (peek().type === 'MINUS') {
      advance();
      const operand = parseUnaryExpr();
      return { kind: 'UnaryExpr', operator: '-', operand };
    }
    return parsePrimaryExpr();
  }

  function parsePrimaryExpr(): Expression {
    const token = peek();

    if (token.type === 'NUMBER') {
      advance();
      return { kind: 'NumberLiteral', value: Number(token.value) };
    }

    if (token.type === 'STRING') {
      advance();
      return { kind: 'StringLiteral', value: token.value };
    }

    if (token.type === 'BOOLEAN') {
      advance();
      return { kind: 'BooleanLiteral', value: token.value === 'true' };
    }

    if (token.type === 'NULL') {
      advance();
      return { kind: 'NullLiteral' };
    }

    if (token.type === 'IDENTIFIER') {
      advance();
      const name = token.value;

      // Function call: name(args...)
      if (peek().type === 'LPAREN') {
        advance(); // consume '('
        const args: Expression[] = [];
        if (peek().type !== 'RPAREN') {
          args.push(parseExpression());
          while (match('COMMA')) {
            args.push(parseExpression());
          }
        }
        expect('RPAREN', 'after function arguments');
        return { kind: 'FunctionCall', name, args };
      }

      // Field access: name or name.sub.field
      const path = [name];
      while (peek().type === 'DOT') {
        advance(); // consume '.'
        const next = expect('IDENTIFIER', 'after "."');
        path.push(next.value);
      }
      return { kind: 'FieldAccess', path } satisfies FieldAccess;
    }

    // Grouped expression: (expr)
    if (token.type === 'LPAREN') {
      advance();
      const expr = parseExpression();
      expect('RPAREN', 'after grouped expression');
      return expr;
    }

    throw new ParseError(
      `Unexpected token ${token.type} ('${token.value}')`,
      token.position,
      token.line,
      token.column,
    );
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  function isAggregateExpression(expr: Expression): boolean {
    if (expr.kind === 'AliasExpr') return isAggregateExpression(expr.expression);
    if (expr.kind === 'FunctionCall') return AGGREGATE_NAMES.has(expr.name);
    return false;
  }

  // ─── Operation Parsing ─────────────────────────────────────────────────

  function parseOperation(): Operation {
    const nameToken = expect('IDENTIFIER', 'after "|"');
    const name = nameToken.value;

    expect('LPAREN', `after "${name}"`);

    let op: Operation;

    switch (name) {
      case 'where': {
        const condition = parseExpression();
        op = { kind: 'WhereOp', condition };
        break;
      }

      case 'select': {
        const fields: Expression[] = [];
        if (peek().type !== 'RPAREN') {
          fields.push(parseExpression());
          while (match('COMMA')) {
            fields.push(parseExpression());
          }
        }
        op = { kind: 'SelectOp', fields };
        break;
      }

      case 'sort': {
        const criteria: Array<{ expression: Expression; direction: 'asc' | 'desc' }> = [];
        if (peek().type !== 'RPAREN') {
          const expr = parseOrExpr(); // no alias in sort
          let direction: 'asc' | 'desc' = 'asc';
          if (peek().type === 'ASC') { advance(); direction = 'asc'; }
          else if (peek().type === 'DESC') { advance(); direction = 'desc'; }
          criteria.push({ expression: expr, direction });
          while (match('COMMA')) {
            const e = parseOrExpr();
            let d: 'asc' | 'desc' = 'asc';
            if (peek().type === 'ASC') { advance(); d = 'asc'; }
            else if (peek().type === 'DESC') { advance(); d = 'desc'; }
            criteria.push({ expression: e, direction: d });
          }
        }
        op = { kind: 'SortOp', criteria };
        break;
      }

      case 'groupBy': {
        const keys: Expression[] = [];
        if (peek().type !== 'RPAREN') {
          keys.push(parseOrExpr());
          while (match('COMMA')) {
            keys.push(parseOrExpr());
          }
        }
        op = { kind: 'GroupByOp', keys };
        break;
      }

      case 'join': {
        const rightToken = expect('IDENTIFIER', 'for join source');
        const right = rightToken.value;
        expect('COMMA', 'after join source');
        const condition = parseExpression();
        op = { kind: 'JoinOp', right, condition };
        break;
      }

      case 'first': {
        const numToken = expect('NUMBER', 'for first count');
        op = { kind: 'FirstOp', count: Number(numToken.value) };
        break;
      }

      case 'last': {
        const numToken = expect('NUMBER', 'for last count');
        op = { kind: 'LastOp', count: Number(numToken.value) };
        break;
      }

      case 'distinct': {
        const fields: Expression[] = [];
        if (peek().type !== 'RPAREN') {
          fields.push(parseOrExpr());
          while (match('COMMA')) {
            fields.push(parseOrExpr());
          }
        }
        op = { kind: 'DistinctOp', fields: fields.length > 0 ? fields : undefined };
        break;
      }

      case 'flatten': {
        let field: Expression | undefined;
        if (peek().type !== 'RPAREN') {
          field = parseOrExpr();
        }
        op = { kind: 'FlattenOp', field };
        break;
      }

      case 'transpose': {
        let headerField: Expression | undefined;
        if (peek().type !== 'RPAREN') {
          headerField = parseOrExpr();
        }
        op = { kind: 'TransposeOp', headerField };
        break;
      }

      case 'rollup': {
        const keys: Expression[] = [];
        const aggregates: Expression[] = [];
        let seenAggregate = false;

        if (peek().type !== 'RPAREN') {
          const expr = parseExpression();
          if (isAggregateExpression(expr)) {
            seenAggregate = true;
            aggregates.push(expr);
          } else {
            keys.push(expr);
          }

          while (match('COMMA')) {
            const e = parseExpression();
            if (isAggregateExpression(e)) {
              seenAggregate = true;
              aggregates.push(e);
            } else if (seenAggregate) {
              const t = peek();
              throw new ParseError(
                'rollup: group keys must come before aggregate expressions',
                t.position, t.line, t.column,
              );
            } else {
              keys.push(e);
            }
          }
        }

        if (aggregates.length === 0) {
          const t = peek();
          throw new ParseError(
            'rollup: at least one aggregate expression is required',
            t.position, t.line, t.column,
          );
        }

        op = { kind: 'RollupOp', keys, aggregates };
        break;
      }

      case 'pivot': {
        const pivotField = parseOrExpr();
        expect('COMMA', 'after pivot field');

        const aggregates: Expression[] = [];
        aggregates.push(parseExpression());
        while (match('COMMA')) {
          aggregates.push(parseExpression());
        }

        op = { kind: 'PivotOp', pivotField, aggregates };
        break;
      }

      case 'map': {
        const fields: Expression[] = [];
        if (peek().type !== 'RPAREN') {
          fields.push(parseExpression());
          while (match('COMMA')) {
            fields.push(parseExpression());
          }
        }
        op = { kind: 'MapOp', fields };
        break;
      }

      case 'reduce': {
        const initial = parseExpression();
        expect('COMMA', 'after reduce initial value');
        const accumulator = parseExpression();
        op = { kind: 'ReduceOp', initial, accumulator };
        break;
      }

      default: {
        // Check if it's a standalone aggregate
        if (AGGREGATE_NAMES.has(name)) {
          if (TWO_ARG_AGGREGATES.has(name)) {
            const args: Expression[] = [];
            args.push(parseOrExpr());
            expect('COMMA', `after first argument of ${name}`);
            args.push(parseOrExpr());
            op = { kind: 'AggregateOp', function: name as AggregateFnName, args };
          } else {
            let field: Expression | undefined;
            if (peek().type !== 'RPAREN') {
              field = parseOrExpr();
            }
            op = { kind: 'AggregateOp', function: name as AggregateFnName, field };
          }
          break;
        }
        throw new ParseError(
          `Unknown operation "${name}"`,
          nameToken.position,
          nameToken.line,
          nameToken.column,
        );
      }
    }

    expect('RPAREN', `after ${name} arguments`);
    return op;
  }

  // ─── Pipeline Parsing ──────────────────────────────────────────────────

  function parsePipeline(): Pipeline {
    const sourceToken = expect('IDENTIFIER', 'at start of pipeline');
    const operations: Operation[] = [];

    while (peek().type === 'PIPE') {
      advance(); // consume '|'
      operations.push(parseOperation());
    }

    if (peek().type !== 'EOF') {
      const t = peek();
      throw new ParseError(
        `Unexpected token ${t.type} ('${t.value}') after pipeline`,
        t.position,
        t.line,
        t.column,
      );
    }

    return { kind: 'Pipeline', source: sourceToken.value, operations };
  }

  return parsePipeline();
}
