import { HighlightStyle, LanguageSupport, StreamLanguage, syntaxHighlighting, type StreamParser } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { tags } from '@lezer/highlight';
import { pipeQueryStreamParser } from '../../../src/highlighting/codemirror/language';
import { pipeQueryCompletion, type PipeQueryConfig } from '../../../src/highlighting/codemirror/index';
import { C } from '../tokens';

// Same parser + autocomplete as `pipeQuery()`, but with a highlight style that
// reads the CSS variables so it follows the light/dark theme.
const themedHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: C.keyword, fontWeight: '600' },
  { tag: tags.function(tags.variableName), color: C.fn },
  { tag: tags.variableName, color: C.field },
  { tag: tags.string, color: C.string },
  { tag: tags.number, color: C.number },
  { tag: tags.operator, color: C.operator },
  { tag: tags.punctuation, color: C.operator },
  { tag: tags.lineComment, color: C.comment, fontStyle: 'italic' },
]);

export function themedPipeQuery(config?: PipeQueryConfig): LanguageSupport {
  // The engine is typed against the root @codemirror/* copies; Vite dedupes
  // them at runtime (see vite.config.ts), so only the declarations differ.
  const parser = pipeQueryStreamParser as unknown as StreamParser<unknown>;
  const extensions: Extension[] = [syntaxHighlighting(themedHighlight)];
  if (config?.completion !== false) {
    extensions.push(
      pipeQueryCompletion(
        typeof config?.completion === 'object' ? config.completion : undefined,
      ) as unknown as Extension,
    );
  }
  return new LanguageSupport(StreamLanguage.define(parser), extensions);
}
