import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { COLORS } from '../shared';
import type { Extension } from '@codemirror/state';

/**
 * Highlight style for PipeQuery matching the project's dark theme palette.
 */
export const pipeQueryHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: COLORS.keyword, fontWeight: '600' },
  { tag: tags.function(tags.variableName), color: COLORS.function },
  { tag: tags.variableName, color: COLORS.field },
  { tag: tags.string, color: COLORS.string },
  { tag: tags.number, color: COLORS.number },
  { tag: tags.operator, color: COLORS.operator },
  { tag: tags.punctuation, color: COLORS.operator },
  { tag: tags.lineComment, color: COLORS.comment, fontStyle: 'italic' },
]);

/**
 * CodeMirror extension that applies the PipeQuery highlight style.
 */
export const pipeQueryHighlightExtension: Extension = syntaxHighlighting(pipeQueryHighlightStyle);
