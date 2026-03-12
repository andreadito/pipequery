import type { StringStream } from '@codemirror/language';
import { ALL_KEYWORDS, ALL_FUNCTIONS } from '../shared';

const keywordSet = new Set<string>(ALL_KEYWORDS);
const functionSet = new Set<string>(ALL_FUNCTIONS);

export interface PipeQueryState {
  /** Inside a string literal; holds the quote character, or empty when outside */
  inString: '' | '"' | "'";
  /** The previous non-whitespace token was a pipe `|` */
  afterPipe: boolean;
}

export const pipeQueryStreamParser = {
  name: 'pipequery',

  startState(): PipeQueryState {
    return { inString: '', afterPipe: false };
  },

  token(stream: StringStream, state: PipeQueryState): string | null {
    // ── Continue string literal ───────────────────────────────────────────
    if (state.inString) {
      const quote = state.inString;
      while (!stream.eol()) {
        const ch = stream.next()!;
        if (ch === '\\' && !stream.eol()) {
          stream.next(); // skip escaped char
        } else if (ch === quote) {
          state.inString = '';
          return 'string';
        }
      }
      return 'string'; // unterminated – color the whole line
    }

    // ── Whitespace ────────────────────────────────────────────────────────
    if (stream.eatSpace()) return null;

    // ── Line comment (forward-compat) ─────────────────────────────────────
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'comment';
    }

    // ── Two-character operators ────────────────────────────────────────────
    if (stream.match('>=') || stream.match('<=') || stream.match('==') ||
        stream.match('!=') || stream.match('&&') || stream.match('||')) {
      state.afterPipe = false;
      return 'operator';
    }

    // ── Pipe operator ─────────────────────────────────────────────────────
    const ch = stream.peek();
    if (ch === '|') {
      stream.next();
      state.afterPipe = true;
      return 'operator';
    }

    // ── Single-character operators ─────────────────────────────────────────
    if (ch === '>' || ch === '<' || ch === '!' ||
        ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '%') {
      stream.next();
      state.afterPipe = false;
      return 'operator';
    }

    // ── Punctuation ───────────────────────────────────────────────────────
    if (ch === '(' || ch === ')' || ch === ',' || ch === '.') {
      stream.next();
      // Don't clear afterPipe for parens so `| select(` still works
      if (ch !== '(') state.afterPipe = false;
      return 'punctuation';
    }

    // ── Number literal ────────────────────────────────────────────────────
    if (ch && ch >= '0' && ch <= '9') {
      stream.match(/^\d+(\.\d+)?/);
      state.afterPipe = false;
      return 'number';
    }

    // ── String literal ────────────────────────────────────────────────────
    if (ch === '"' || ch === "'") {
      state.inString = ch as '"' | "'";
      stream.next(); // consume opening quote
      return 'string';
    }

    // ── Identifier / keyword / function ───────────────────────────────────
    if (stream.match(/^[a-zA-Z_]\w*/)) {
      const word = stream.current();
      if (keywordSet.has(word)) {
        state.afterPipe = false;
        return 'keyword';
      }
      if (functionSet.has(word)) {
        state.afterPipe = false;
        return 'function';
      }
      state.afterPipe = false;
      return 'variableName';
    }

    // ── Unknown – advance one character ───────────────────────────────────
    stream.next();
    state.afterPipe = false;
    return null;
  },
};
