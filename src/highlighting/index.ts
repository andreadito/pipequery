// ─── PipeQuery Syntax Highlighting ───────────────────────────────────────────
// Provides language support for CodeMirror 6, Monaco Editor, and IntelliJ/VS Code.

// Shared token lists and color palette
export {
  OPERATION_NAMES,
  KEYWORDS,
  AGGREGATE_FUNCTIONS,
  BUILTIN_FUNCTIONS,
  WINDOW_FUNCTIONS,
  ALL_FUNCTIONS,
  ALL_KEYWORDS,
  COLORS,
} from './shared';

// CodeMirror 6
export { pipeQuery, pipeQueryHighlightStyle, pipeQueryHighlightExtension } from './codemirror/index';
export { pipeQueryCompletion, type PipeQueryCompletionConfig } from './codemirror/completion';
export type { PipeQueryConfig } from './codemirror/index';

// Monaco Editor
export { registerPipeQuery, monarchLanguage, languageConfiguration, tokenThemeRules } from './monaco/index';

// TextMate grammar (IntelliJ / VS Code / Sublime)
// Import the JSON file directly:
//   import grammar from './highlighting/textmate/pipequery.tmLanguage.json';
