import { monarchLanguage, languageConfiguration } from './language';
import { tokenThemeRules } from './theme';

/**
 * Register the PipeQuery language with a Monaco Editor instance.
 *
 * Usage:
 * ```ts
 * import * as monaco from 'monaco-editor';
 * import { registerPipeQuery } from './highlighting/monaco';
 *
 * registerPipeQuery(monaco);
 * const editor = monaco.editor.create(container, {
 *   language: 'pipequery',
 *   theme: 'pipequery-dark',
 * });
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerPipeQuery(monaco: any): void {
  monaco.languages.register({ id: 'pipequery' });
  monaco.languages.setMonarchTokensProvider('pipequery', monarchLanguage);
  monaco.languages.setLanguageConfiguration('pipequery', languageConfiguration);

  monaco.editor.defineTheme('pipequery-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: tokenThemeRules,
    colors: {},
  });
}

export { monarchLanguage, languageConfiguration, tokenThemeRules };
