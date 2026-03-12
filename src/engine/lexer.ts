import type { Token, TokenType } from './types';
import { LexerError } from './types';

const KEYWORDS: Record<string, TokenType> = {
  as: 'AS',
  asc: 'ASC',
  desc: 'DESC',
  true: 'BOOLEAN',
  false: 'BOOLEAN',
  null: 'NULL',
};

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let line = 1;
  let column = 1;

  function advance(): string {
    const ch = source[pos];
    pos++;
    if (ch === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
    return ch;
  }

  function peek(): string {
    return source[pos];
  }

  function peekNext(): string {
    return source[pos + 1];
  }

  function addToken(type: TokenType, value: string, startPos: number, startLine: number, startCol: number) {
    tokens.push({ type, value, position: startPos, line: startLine, column: startCol });
  }

  function error(msg: string): never {
    throw new LexerError(msg, pos, line, column);
  }

  while (pos < source.length) {
    const startPos = pos;
    const startLine = line;
    const startCol = column;
    const ch = peek();

    // Whitespace
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      advance();
      continue;
    }

    // Single-character tokens
    if (ch === '|') { advance(); addToken('PIPE', '|', startPos, startLine, startCol); continue; }
    if (ch === '(') { advance(); addToken('LPAREN', '(', startPos, startLine, startCol); continue; }
    if (ch === ')') { advance(); addToken('RPAREN', ')', startPos, startLine, startCol); continue; }
    if (ch === ',') { advance(); addToken('COMMA', ',', startPos, startLine, startCol); continue; }
    if (ch === '.') { advance(); addToken('DOT', '.', startPos, startLine, startCol); continue; }
    if (ch === '+') { advance(); addToken('PLUS', '+', startPos, startLine, startCol); continue; }
    if (ch === '-') { advance(); addToken('MINUS', '-', startPos, startLine, startCol); continue; }
    if (ch === '*') { advance(); addToken('STAR', '*', startPos, startLine, startCol); continue; }
    if (ch === '/') { advance(); addToken('SLASH', '/', startPos, startLine, startCol); continue; }
    if (ch === '%') { advance(); addToken('MOD', '%', startPos, startLine, startCol); continue; }

    // Two-character operators
    if (ch === '>' && peekNext() === '=') { advance(); advance(); addToken('GTE', '>=', startPos, startLine, startCol); continue; }
    if (ch === '>') { advance(); addToken('GT', '>', startPos, startLine, startCol); continue; }
    if (ch === '<' && peekNext() === '=') { advance(); advance(); addToken('LTE', '<=', startPos, startLine, startCol); continue; }
    if (ch === '<') { advance(); addToken('LT', '<', startPos, startLine, startCol); continue; }
    if (ch === '=' && peekNext() === '=') { advance(); advance(); addToken('EQ', '==', startPos, startLine, startCol); continue; }
    if (ch === '!' && peekNext() === '=') { advance(); advance(); addToken('NEQ', '!=', startPos, startLine, startCol); continue; }
    if (ch === '!') { advance(); addToken('NOT', '!', startPos, startLine, startCol); continue; }
    if (ch === '&' && peekNext() === '&') { advance(); advance(); addToken('AND', '&&', startPos, startLine, startCol); continue; }
    if (ch === '|' && peekNext() === '|') { advance(); advance(); addToken('OR', '||', startPos, startLine, startCol); continue; }

    // Number literals
    if (ch >= '0' && ch <= '9') {
      const start = pos;
      while (pos < source.length && peek() >= '0' && peek() <= '9') advance();
      if (pos < source.length && peek() === '.' && pos + 1 < source.length && source[pos + 1] >= '0' && source[pos + 1] <= '9') {
        advance(); // consume '.'
        while (pos < source.length && peek() >= '0' && peek() <= '9') advance();
      }
      addToken('NUMBER', source.slice(start, pos), startPos, startLine, startCol);
      continue;
    }

    // String literals
    if (ch === '"' || ch === "'") {
      const quote = ch;
      advance(); // consume opening quote
      const start = pos;
      let value = '';
      while (pos < source.length && peek() !== quote) {
        if (peek() === '\\' && pos + 1 < source.length) {
          advance(); // consume backslash
          const escaped = advance();
          if (escaped === 'n') value += '\n';
          else if (escaped === 't') value += '\t';
          else value += escaped;
        } else {
          value += advance();
        }
      }
      if (pos >= source.length) {
        error(`Unterminated string starting at line ${startLine}, column ${startCol}`);
      }
      advance(); // consume closing quote
      // Use `value` for the processed content, but store the raw slice for position
      void start;
      addToken('STRING', value, startPos, startLine, startCol);
      continue;
    }

    // Identifiers and keywords
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
      const start = pos;
      while (pos < source.length && ((peek() >= 'a' && peek() <= 'z') || (peek() >= 'A' && peek() <= 'Z') || (peek() >= '0' && peek() <= '9') || peek() === '_')) {
        advance();
      }
      const word = source.slice(start, pos);
      const keywordType = KEYWORDS[word];
      if (keywordType) {
        addToken(keywordType, word, startPos, startLine, startCol);
      } else {
        addToken('IDENTIFIER', word, startPos, startLine, startCol);
      }
      continue;
    }

    error(`Unexpected character '${ch}'`);
  }

  addToken('EOF', '', pos, line, column);
  return tokens;
}
