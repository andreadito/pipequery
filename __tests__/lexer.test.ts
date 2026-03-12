import { describe, it, expect } from 'vitest';
import { tokenize } from '../src/engine/lexer';
import { LexerError } from '../src/engine/types';

describe('Lexer', () => {
  it('tokenizes single-character operators', () => {
    const tokens = tokenize('| ( ) , . + - * / %');
    const types = tokens.map(t => t.type);
    expect(types).toEqual([
      'PIPE', 'LPAREN', 'RPAREN', 'COMMA', 'DOT',
      'PLUS', 'MINUS', 'STAR', 'SLASH', 'MOD', 'EOF',
    ]);
  });

  it('tokenizes two-character operators', () => {
    const tokens = tokenize('>= <= == != &&');
    const types = tokens.map(t => t.type);
    expect(types).toEqual(['GTE', 'LTE', 'EQ', 'NEQ', 'AND', 'EOF']);
  });

  it('tokenizes || as two PIPE tokens (lexer limitation)', () => {
    // NOTE: || is consumed as two separate PIPE tokens because | is matched first
    const tokens = tokenize('||');
    expect(tokens.map(t => t.type)).toEqual(['PIPE', 'PIPE', 'EOF']);
  });

  it('distinguishes > from >= and < from <=', () => {
    const tokens = tokenize('> >= < <=');
    expect(tokens.map(t => t.type)).toEqual(['GT', 'GTE', 'LT', 'LTE', 'EOF']);
  });

  it('tokenizes ! and !=', () => {
    const tokens = tokenize('! !=');
    expect(tokens.map(t => t.type)).toEqual(['NOT', 'NEQ', 'EOF']);
  });

  it('tokenizes integer and decimal numbers', () => {
    const tokens = tokenize('42 3.14 0 100.0');
    const nums = tokens.filter(t => t.type === 'NUMBER');
    expect(nums.map(t => t.value)).toEqual(['42', '3.14', '0', '100.0']);
  });

  it('tokenizes string literals with single and double quotes', () => {
    const tokens = tokenize('"hello" \'world\'');
    expect(tokens[0]).toMatchObject({ type: 'STRING', value: 'hello' });
    expect(tokens[1]).toMatchObject({ type: 'STRING', value: 'world' });
  });

  it('handles escape sequences in strings', () => {
    const tokens = tokenize('"line\\nbreak\\ttab"');
    expect(tokens[0].value).toBe('line\nbreak\ttab');
  });

  it('throws on unterminated string', () => {
    expect(() => tokenize('"unterminated')).toThrow(LexerError);
  });

  it('tokenizes keywords: as, asc, desc, true, false, null', () => {
    const tokens = tokenize('as asc desc true false null');
    expect(tokens.map(t => t.type)).toEqual([
      'AS', 'ASC', 'DESC', 'BOOLEAN', 'BOOLEAN', 'NULL', 'EOF',
    ]);
    expect(tokens[3].value).toBe('true');
    expect(tokens[4].value).toBe('false');
  });

  it('tokenizes identifiers', () => {
    const tokens = tokenize('foo bar_baz _private camelCase ABC123');
    const ids = tokens.filter(t => t.type === 'IDENTIFIER');
    expect(ids.map(t => t.value)).toEqual(['foo', 'bar_baz', '_private', 'camelCase', 'ABC123']);
  });

  it('tracks line and column positions', () => {
    const tokens = tokenize('a\nb');
    expect(tokens[0]).toMatchObject({ line: 1, column: 1 });
    expect(tokens[1]).toMatchObject({ line: 2, column: 1 });
  });

  it('throws LexerError on unexpected character', () => {
    expect(() => tokenize('$')).toThrow(LexerError);
    expect(() => tokenize('@')).toThrow(LexerError);
  });

  it('tokenizes a realistic pipeline expression', () => {
    const tokens = tokenize('orders | where(total > 100) | select(id, name)');
    const types = tokens.map(t => t.type);
    expect(types).toEqual([
      'IDENTIFIER', 'PIPE', 'IDENTIFIER', 'LPAREN', 'IDENTIFIER', 'GT', 'NUMBER', 'RPAREN',
      'PIPE', 'IDENTIFIER', 'LPAREN', 'IDENTIFIER', 'COMMA', 'IDENTIFIER', 'RPAREN', 'EOF',
    ]);
  });

  it('skips whitespace correctly', () => {
    const tokens = tokenize('  \t\n  foo  \n  ');
    expect(tokens).toHaveLength(2); // IDENTIFIER + EOF
    expect(tokens[0].type).toBe('IDENTIFIER');
  });
});
