// SQL dialect abstraction for the pipe-AST → SQL compilers.
//
// The compiler in compile.ts is dialect-agnostic — every place that emits
// SQL goes through one of the methods here. Adding a new engine (Snowflake,
// ClickHouse, BigQuery, etc.) reduces to: write a dialect, plug it in.

export interface SqlDialect {
  /**
   * Quote an identifier (column / alias / table-ish thing). Embedded
   * special characters must be escaped per dialect rules so the result
   * can never break out of the quoted span.
   *   - Postgres: `"name"`, internal `"` doubled
   *   - MySQL:    `` `name` ``, internal `` ` `` doubled
   */
  quoteIdent(name: string): string;

  /**
   * Render a parameter placeholder for the given 1-based index.
   *   - Postgres: `$1`, `$2`, …
   *   - MySQL:    `?` (positional; the index is unused but the signature
   *     stays uniform so the compiler can treat both engines identically)
   */
  placeholder(index: number): string;
}

export const POSTGRES_DIALECT: SqlDialect = {
  quoteIdent: (name) => `"${name.replace(/"/g, '""')}"`,
  placeholder: (i) => `$${i}`,
};

export const MYSQL_DIALECT: SqlDialect = {
  quoteIdent: (name) => `\`${name.replace(/`/g, '``')}\``,
  placeholder: () => '?',
};
