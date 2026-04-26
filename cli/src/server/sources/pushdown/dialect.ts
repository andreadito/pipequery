// SQL dialect abstraction for the pipe-AST → SQL compilers.
//
// The compiler in compile.ts is dialect-agnostic — every place that emits
// SQL goes through one of the methods here. Adding a new engine (Snowflake,
// ClickHouse, BigQuery, etc.) reduces to: write a dialect, plug it in.

export interface SqlDialect {
  /**
   * Quote an identifier (column / alias). Embedded special characters
   * must be escaped per dialect rules so the result can never break out
   * of the quoted span.
   *   - Postgres / Snowflake: `"name"`, internal `"` doubled
   *   - MySQL / ClickHouse:   `` `name` ``, internal `` ` `` doubled
   */
  quoteIdent(name: string): string;

  /**
   * Embed a literal value in the emitted SQL. Dialects that use parameter
   * binding push the value into `params` and return a placeholder
   * (`$N`, `?`); dialects that don't bind (ClickHouse over HTTP) inline
   * the value as a properly-escaped literal and leave `params` untouched.
   *
   * The compiler doesn't care which path the dialect takes — it just
   * gets back a string to splice into the SQL.
   */
  bindLiteral(value: unknown, params: unknown[]): string;
}

export const POSTGRES_DIALECT: SqlDialect = {
  quoteIdent: (name) => `"${name.replace(/"/g, '""')}"`,
  bindLiteral: (value, params) => {
    params.push(value);
    return `$${params.length}`;
  },
};

export const MYSQL_DIALECT: SqlDialect = {
  quoteIdent: (name) => `\`${name.replace(/`/g, '``')}\``,
  bindLiteral: (value, params) => {
    params.push(value);
    return '?';
  },
};

/**
 * Snowflake speaks ANSI SQL with double-quoted identifiers (case-sensitive)
 * and accepts `?` positional binds.
 */
export const SNOWFLAKE_DIALECT: SqlDialect = {
  quoteIdent: (name) => `"${name.replace(/"/g, '""')}"`,
  bindLiteral: (value, params) => {
    params.push(value);
    return '?';
  },
};

/**
 * ClickHouse accepts both backticks and double quotes for identifiers; we
 * use backticks for parity with MySQL conventions. The HTTP client uses
 * named `{name:Type}` binds (which require per-param type tagging the
 * dialect interface doesn't carry), so we inline literals with proper
 * escape instead. Safe: literal values come from typed AST nodes
 * (NumberLiteral / StringLiteral / BooleanLiteral / NullLiteral) — never
 * from raw user strings.
 */
export const CLICKHOUSE_DIALECT: SqlDialect = {
  quoteIdent: (name) => `\`${name.replace(/`/g, '``')}\``,
  bindLiteral: (value) => clickhouseLiteral(value),
};

function clickhouseLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'NULL';
    return String(value);
  }
  if (typeof value === 'string') {
    // Order matters: backslash MUST be doubled first so subsequent
    // inserted backslashes (from quote escaping) don't get re-doubled.
    // ClickHouse accepts literal control chars inside string literals;
    // only backslash and single quote require escape to prevent injection.
    const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `'${escaped}'`;
  }
  // Fallback: stringify and escape — covers Date, BigInt, etc. as best-effort.
  return clickhouseLiteral(String(value));
}
