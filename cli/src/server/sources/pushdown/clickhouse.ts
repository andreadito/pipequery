// Pipe-AST → ClickHouse SQL compiler.
//
// Thin shim over the dialect-parametric compileForDialect; same operator +
// aggregate set as Postgres / MySQL / Snowflake. ClickHouse uses
// backtick-quoted identifiers and `?` positional placeholders — both
// captured in CLICKHOUSE_DIALECT.

import type { Pipeline } from '../../../../../src/engine/types.js';
import { compileForDialect, type CompileResult } from './compile.js';
import { CLICKHOUSE_DIALECT } from './dialect.js';

export function compileClickhousePushdown(
  pipeline: Pipeline,
  baseQuery: string,
): CompileResult {
  return compileForDialect(pipeline, baseQuery, CLICKHOUSE_DIALECT);
}
