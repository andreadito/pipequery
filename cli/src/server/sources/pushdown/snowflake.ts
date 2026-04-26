// Pipe-AST → Snowflake SQL compiler.
//
// Thin shim over the dialect-parametric compileForDialect; same operator +
// aggregate set as Postgres / MySQL. Snowflake uses double-quoted
// identifiers (case-sensitive) and `?` positional placeholders — both
// captured in SNOWFLAKE_DIALECT.

import type { Pipeline } from '../../../../../src/engine/types.js';
import { compileForDialect, type CompileResult } from './compile.js';
import { SNOWFLAKE_DIALECT } from './dialect.js';

export function compileSnowflakePushdown(
  pipeline: Pipeline,
  baseQuery: string,
): CompileResult {
  return compileForDialect(pipeline, baseQuery, SNOWFLAKE_DIALECT);
}
