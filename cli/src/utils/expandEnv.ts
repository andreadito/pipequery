/**
 * Resolve `${ENV_VAR}` placeholders in a string from process.env.
 *
 * Missing vars expand to empty string and emit a stderr warning so a
 * mistyped env doesn't silently embed literal "${FOO}" into a connection
 * string, header, URL, etc.
 *
 * `context` is included in the warning to help users locate the source
 * of the misconfiguration (e.g. "postgres source URL", "rest source
 * Authorization header"). Pass a short, human-readable string.
 */
export function expandEnv(input: string, context: string): string {
  return input.replace(/\$\{([A-Z0-9_]+)\}/gi, (_, name: string) => {
    const value = process.env[name];
    if (value === undefined) {
      process.stderr.write(
        `[pipequery] env var "${name}" referenced in ${context} is not set\n`,
      );
      return '';
    }
    return value;
  });
}
