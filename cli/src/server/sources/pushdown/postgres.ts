// Pipe-AST → Postgres SQL compiler.
//
// Thin shim over the dialect-parametric compileForDialect; everything
// non-dialect lives in compile.ts. Public name preserved so existing
// callers (PostgresSourceAdapter.runPushdown) don't change.

import type { Pipeline } from '../../../../../src/engine/types.js';
import { compileForDialect, type CompileResult } from './compile.js';
import { POSTGRES_DIALECT } from './dialect.js';

export type { CompileResult, CompiledPushdown } from './compile.js';
export { isPushableShape } from './compile.js';

export function compilePostgresPushdown(
  pipeline: Pipeline,
  baseQuery: string,
): CompileResult {
  return compileForDialect(pipeline, baseQuery, POSTGRES_DIALECT);
}
