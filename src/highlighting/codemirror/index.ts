import { StreamLanguage, LanguageSupport } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { pipeQueryStreamParser } from './language';
import { pipeQueryHighlightExtension, pipeQueryHighlightStyle } from './highlight';
import { pipeQueryCompletion, type PipeQueryCompletionConfig } from './completion';

// ─── Configuration ───────────────────────────────────────────────────────────

export interface PipeQueryConfig {
  /**
   * Autocomplete configuration. Pass `false` to disable.
   * Defaults to enabled with no field/source suggestions.
   */
  completion?: PipeQueryCompletionConfig | false;
}

/**
 * CodeMirror 6 language support for PipeQuery.
 *
 * Usage:
 * ```ts
 * import { pipeQuery } from './highlighting/codemirror';
 *
 * // Basic (keywords + functions autocomplete)
 * const editor = new EditorView({ extensions: [pipeQuery()] });
 *
 * // With field & source suggestions
 * const editor = new EditorView({
 *   extensions: [pipeQuery({ completion: { fields: ['id', 'name'], sources: ['orders'] } })],
 * });
 *
 * // Disable autocomplete
 * const editor = new EditorView({ extensions: [pipeQuery({ completion: false })] });
 * ```
 */
export function pipeQuery(config?: PipeQueryConfig): LanguageSupport {
  const lang = StreamLanguage.define(pipeQueryStreamParser);
  const extensions: Extension[] = [pipeQueryHighlightExtension];

  if (config?.completion !== false) {
    extensions.push(
      pipeQueryCompletion(
        typeof config?.completion === 'object' ? config.completion : undefined,
      ),
    );
  }

  return new LanguageSupport(lang, extensions);
}

export { pipeQueryHighlightStyle, pipeQueryHighlightExtension };
export { pipeQueryCompletion, type PipeQueryCompletionConfig } from './completion';
