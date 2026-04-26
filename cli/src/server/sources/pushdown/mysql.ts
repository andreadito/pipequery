// Pipe-AST → MySQL SQL compiler.
//
// Same operator + aggregate set as the Postgres compiler — both engines
// accept the operations we push down identically. The only differences
// are quoting (`backticks`) and parameter placeholders (`?`), both
// abstracted behind dialect.ts.

import type { Pipeline } from '../../../../../src/engine/types.js';
import { compileForDialect, type CompileResult } from './compile.js';
import { MYSQL_DIALECT } from './dialect.js';

export function compileMysqlPushdown(
  pipeline: Pipeline,
  baseQuery: string,
): CompileResult {
  return compileForDialect(pipeline, baseQuery, MYSQL_DIALECT);
}
