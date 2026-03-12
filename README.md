# pipequery-lang

A pipe-based query language for filtering, transforming, and aggregating data in JavaScript/TypeScript. Zero dependencies for the core engine.

**[Interactive Playground](https://andreadito.github.io/pipequery)**

## Install

```bash
npm install pipequery-lang
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
const result = query(data, 'where(price > 100) | sort(price desc)');
// → [{ name: 'Laptop', ... }, { name: 'Desk', ... }]
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

### Aggregate Functions

**Basic:** `sum`, `avg`, `min`, `max`, `count`
**Statistical:** `median`, `stddev`, `var`, `percentile`, `skew`, `kurt`
**Financial:** `vwap`, `wavg`, `drawdown`, `sharpe`, `calmar`, `sortino`, `info_ratio`
**Utility:** `distinct_count`, `sum_abs`, `first_value`, `last_value`, `pct`

### Expressions

```
price > 100 && category == 'Electronics'   // boolean logic
price * 0.9 as discounted                  // arithmetic + alias
nested.field.path                          // dot access
```

## API

### `query(data, expression)`

Execute a query on data. Accepts a raw array or a `DataContext` (named datasets).

```ts
// Array shorthand
query(items, 'where(price > 50) | sort(name asc)');

// Named context (for joins)
query({ orders, customers }, 'orders | join(customers, customerId == id)');
```

### `compile(expression)`

Pre-compile a query for repeated use. Returns a function.

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
```

### `LiveQuery`

Streaming query evaluator that accepts data patches (deltas) and re-executes efficiently.

```ts
import { liveQuery } from 'pipequery-lang';

const lq = liveQuery(initialData, 'where(active == true) | sort(updatedAt desc)', {
  key: 'id',
  throttle: 100,
});

lq.subscribe((result, stats) => {
  console.log(`${stats.rowCount} rows → ${stats.resultCount} results in ${stats.totalMs}ms`);
});

// Push incremental updates
lq.patch([{ id: 1, active: true, updatedAt: Date.now() }]);

// Clean up
lq.dispose();
```

### `clearCache()`

Clear the internal compiled-query LRU cache (128 entries by default).

## Sub-packages

### Syntax Highlighting

```ts
import { pipeQuery } from 'pipequery-lang/highlighting';           // CodeMirror 6
import { registerPipeQuery } from 'pipequery-lang/highlighting';    // Monaco Editor
```

Peer dependencies: `@codemirror/language`, `@codemirror/state`, `@codemirror/view`, `@lezer/highlight` (for CodeMirror); none required for Monaco.

A TextMate grammar is also included at `pipequery-lang/dist/highlighting/textmate/pipequery.tmLanguage.json` for VS Code / IntelliJ / Sublime.

### React Components

```tsx
import { PipeQueryBuilder } from 'pipequery-lang/react';
```

A visual pipeline builder component. Peer dependencies: `react`, `react-dom`, `@mui/material`, `@emotion/react`, `@emotion/styled`, `@mui/icons-material`.

## Error Types

```ts
import { LexerError, ParseError, RuntimeError, DataWeaveError } from 'pipequery-lang';
```

All errors include position info (`position`, `line`, `column`) for editor integration.

## License

MIT
