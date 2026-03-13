<p align="center">
  <img src="https://andreadito.github.io/pipequery/logo.svg" alt="PipeQuery" width="80" />
</p>

<h1 align="center">pipequery-lang</h1>

<p align="center">
  A pipe-based query language for filtering, transforming, and aggregating data in JavaScript/TypeScript.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@andreadito/pipequery-lang"><img src="https://img.shields.io/npm/v/@andreadito/pipequery-lang.svg" alt="npm version" /></a>
  <a href="https://github.com/andreadito/pipequery/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@andreadito/pipequery-lang.svg" alt="license" /></a>
  <a href="https://www.npmjs.com/package/@andreadito/pipequery-lang"><img src="https://img.shields.io/npm/dm/@andreadito/pipequery-lang.svg" alt="downloads" /></a>
  <a href="https://github.com/andreadito/pipequery"><img src="https://img.shields.io/badge/zero-dependencies-brightgreen.svg" alt="zero dependencies" /></a>
  <a href="https://andreadito.github.io/pipequery"><img src="https://img.shields.io/badge/demo-playground-blue.svg" alt="playground" /></a>
</p>

---

## Features

- **Pipe-based syntax** &mdash; chain operations with `|`, inspired by Unix pipes and SQL
- **Zero dependencies** &mdash; core engine has no runtime dependencies
- **TypeScript-first** &mdash; full type definitions included
- **25+ aggregate functions** &mdash; basic, statistical, and financial aggregations
- **LiveQuery** &mdash; streaming queries with delta/patch support
- **Editor support** &mdash; CodeMirror 6, Monaco, and TextMate grammars
- **React components** &mdash; visual pipeline builder out of the box

## Install

```bash
npm install @andreadito/pipequery-lang
```

## Quick Start

```ts
import { query } from 'pipequery-lang';

const data = [
  { name: 'Laptop', price: 999, category: 'Electronics' },
  { name: 'Mouse', price: 29, category: 'Electronics' },
  { name: 'Desk', price: 349, category: 'Furniture' },
];

// Filter and sort
query(data, 'where(price > 100) | sort(price desc)');
// → [{ name: 'Laptop', ... }, { name: 'Desk', ... }]

// Aggregate
query(data, 'rollup(sum(price) as total, count() as n)');
// → [{ total: 1377, n: 3 }]

// Group and aggregate
query(data, 'groupBy(category) | rollup(avg(price) as avgPrice)');
// → [{ category: 'Electronics', avgPrice: 514 }, { category: 'Furniture', avgPrice: 349 }]
```

## Query Syntax

PipeQuery chains operations with the `|` pipe operator:

```
source | operation1(...) | operation2(...) | ...
```

### Operations

| Operation | Description | Example |
|-----------|-------------|---------|
| `where(expr)` | Filter rows | `where(price > 100)` |
| `select(fields...)` | Pick fields | `select(name, price)` |
| `sort(expr dir)` | Sort rows | `sort(price desc)` |
| `groupBy(keys...)` | Group rows | `groupBy(category)` |
| `rollup(aggs...)` | Group + aggregate | `rollup(sum(price) as total)` |
| `join(source, cond)` | Join tables | `join(orders, id == orderId)` |
| `first(n)` | Take first N | `first(10)` |
| `last(n)` | Take last N | `last(5)` |
| `distinct(fields?)` | Remove duplicates | `distinct(category)` |
| `map(exprs...)` | Transform rows | `map(price * 1.1 as newPrice)` |
| `pivot(field, aggs)` | Pivot table | `pivot(region, sum(sales))` |
| `flatten(field?)` | Flatten arrays | `flatten(tags)` |
| `transpose(header?)` | Transpose matrix | `transpose(name)` |
| `reduce(init, acc)` | Reduce to scalar | `reduce(0, $acc + price)` |

### Aggregate Functions

| Category | Functions |
|----------|-----------|
| **Basic** | `sum`, `avg`, `min`, `max`, `count` |
| **Statistical** | `median`, `stddev`, `var`, `percentile`, `skew`, `kurt` |
| **Financial** | `vwap`, `wavg`, `drawdown`, `sharpe`, `calmar`, `sortino`, `info_ratio` |
| **Utility** | `distinct_count`, `sum_abs`, `first_value`, `last_value`, `pct` |

### Window Functions

`running_sum`, `running_avg`, `running_count`, `running_min`, `running_max`, `row_number`, `lag`, `lead`

### Expressions

```
price > 100 && category == 'Electronics'   // boolean logic
price * 0.9 as discounted                  // arithmetic + alias
nested.field.path                          // dot access
```

## API

### `query(data, expression)`

Execute a query on data. Accepts a raw array or a named `DataContext` for multi-table queries.

```ts
import { query } from 'pipequery-lang';

// Array shorthand
query(items, 'where(price > 50) | sort(name asc)');

// Named context (for joins)
query(
  { orders, customers },
  'orders | join(customers, customerId == id) | select(orderId, name, total)'
);
```

### `compile(expression)`

Pre-compile a query for repeated use. Returns a reusable function.

```ts
import { compile } from 'pipequery-lang';

const fn = compile('where(price > 100) | sort(price desc)');
const result = fn({ _data: items });
```

### `parseQuery(expression)`

Parse a query into its AST without executing.

```ts
import { parseQuery } from 'pipequery-lang';

const ast = parseQuery('items | where(price > 100)');
// Inspect tokens, operations, expressions
```

### `liveQuery(data, expression, options)`

Streaming query evaluator that accepts data patches and re-executes efficiently.

```ts
import { liveQuery } from 'pipequery-lang';

const lq = liveQuery(initialData, 'where(active == true) | sort(updatedAt desc)', {
  key: 'id',
  throttle: 100,
});

lq.subscribe((result, stats) => {
  console.log(`${stats.rowCount} rows in ${stats.totalMs}ms`);
});

// Push incremental updates
lq.patch([{ id: 1, active: true, updatedAt: Date.now() }]);

// Clean up
lq.dispose();
```

### `clearCache()`

Clear the internal compiled-query LRU cache (128 entries by default).

```ts
import { clearCache } from 'pipequery-lang';

clearCache();
```

## Error Handling

All errors include position info (`position`, `line`, `column`) for editor integration.

```ts
import { LexerError, ParseError, RuntimeError, DataWeaveError } from 'pipequery-lang';

try {
  query(data, 'where(price >)');
} catch (e) {
  if (e instanceof ParseError) {
    console.log(`Syntax error at line ${e.line}, column ${e.column}`);
  }
}
```

## Sub-packages

### Syntax Highlighting

```ts
// CodeMirror 6
import { pipeQuery } from 'pipequery-lang/highlighting';

// Monaco Editor
import { registerPipeQuery } from 'pipequery-lang/highlighting';
```

A TextMate grammar is included at `dist/highlighting/textmate/pipequery.tmLanguage.json` for VS Code, IntelliJ, and Sublime Text.

**Peer dependencies:** `@codemirror/language`, `@codemirror/state`, `@codemirror/view`, `@lezer/highlight` (CodeMirror only)

### React Components

```tsx
import { PipeQueryBuilder } from 'pipequery-lang/react';

<PipeQueryBuilder
  datasets={datasets}
  onQueryChange={(query) => console.log(query)}
/>
```

A visual pipeline builder component for constructing queries with drag-and-drop.

**Peer dependencies:** `react`, `react-dom`, `@mui/material`, `@emotion/react`, `@emotion/styled`, `@mui/icons-material`

## Browser Support

Works in all modern browsers and Node.js 18+. The core engine uses only standard ES2020 features.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

```bash
git clone https://github.com/andreadito/pipequery.git
cd pipequery
npm install
npm test
```

## License

[MIT](./LICENSE) &copy; andreadito
