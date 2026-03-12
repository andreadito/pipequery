import { ALL_KEYWORDS, ALL_FUNCTIONS } from '../shared';

/**
 * Monaco Monarch tokenizer definition for PipeQuery.
 *
 * See: https://microsoft.github.io/monaco-editor/monarch.html
 */
export const monarchLanguage = {
  defaultToken: 'variable',

  keywords: [...ALL_KEYWORDS],
  functions: [...ALL_FUNCTIONS],

  operators: [
    '>=', '<=', '==', '!=', '&&', '||',
    '>', '<', '!', '+', '-', '*', '/', '%',
  ],

  tokenizer: {
    root: [
      // Line comments (forward-compat)
      [/\/\/.*$/, 'comment'],

      // Strings
      [/"/, 'string', '@string_double'],
      [/'/, 'string', '@string_single'],

      // Numbers
      [/\d+(\.\d+)?/, 'number'],

      // Pipe operator (bold styling via separate token)
      [/\|/, 'operator.pipe'],

      // Multi-char operators first, then single-char
      [/>=|<=|==|!=|&&|\|\|/, 'operator'],
      [/[><!+\-*/%]/, 'operator'],

      // Parentheses, comma, dot
      [/[().,]/, 'delimiter'],

      // Identifiers, keywords, functions
      [/[a-zA-Z_]\w*/, {
        cases: {
          '@keywords': 'keyword',
          '@functions': 'type.function',
          '@default': 'variable',
        },
      }],
    ],

    string_double: [
      [/[^\\"]+/, 'string'],
      [/\\./, 'string.escape'],
      [/"/, 'string', '@pop'],
    ],

    string_single: [
      [/[^\\']+/, 'string'],
      [/\\./, 'string.escape'],
      [/'/, 'string', '@pop'],
    ],
  },
};

/**
 * Language configuration for PipeQuery (brackets, auto-closing, etc.).
 */
export const languageConfiguration = {
  brackets: [['(', ')'] as [string, string]],
  autoClosingPairs: [
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  surroundingPairs: [
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
};
