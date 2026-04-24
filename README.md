<h1 align="center">| PipeQuery</h1>

<p align="center">
  A pipe-based query language for filtering, transforming, and aggregating data in JavaScript/TypeScript — with a built-in <strong>MCP server</strong> that lets Claude, Cursor, and other AI agents query your live data.
</p>

<p align="center">
  <a href="https://github.com/andreadito/pipequery/releases/latest"><img src="https://img.shields.io/github/v/release/andreadito/pipequery?label=release&color=orange" alt="release" /></a>
  <a href="https://www.npmjs.com/package/@vaultgradient/pipequery-lang"><img src="https://img.shields.io/npm/v/@vaultgradient/pipequery-lang?label=npm%20%28engine%29&color=cb3837&logo=npm" alt="engine package" /></a>
  <a href="https://www.npmjs.com/package/@vaultgradient/pipequery-cli"><img src="https://img.shields.io/npm/v/@vaultgradient/pipequery-cli?label=npm%20%28cli%29&color=cb3837&logo=npm" alt="cli package" /></a>
  <a href="https://github.com/andreadito/pipequery/pkgs/container/pipequery"><img src="https://img.shields.io/badge/ghcr.io-pipequery-blue?logo=docker" alt="docker" /></a>
  <a href="https://github.com/andreadito/pipequery/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="license" /></a>
  <a href="https://github.com/andreadito/pipequery"><img src="https://img.shields.io/badge/TypeScript-100%25-blue.svg" alt="TypeScript" /></a>
  <a href="https://andreadito.github.io/pipequery"><img src="https://img.shields.io/badge/demo-playground-blueviolet.svg" alt="playground" /></a>
  <a href="https://github.com/sponsors/andreadito"><img src="https://img.shields.io/badge/sponsor-andreadito-ea4aaa?logo=github" alt="sponsor" /></a>
  <a href="https://github.com/andreadito/pipequery/issues/new?template=hosted-mcp.yml"><img src="https://img.shields.io/badge/enterprise-hosted%20MCP-4f46e5" alt="hosted MCP" /></a>
</p>

---

## Features

- **Pipe-based syntax** &mdash; chain operations with `|`, inspired by Unix pipes and SQL
- **MCP server** &mdash; plug pipequery into Claude Desktop, Claude Code, Cursor, Copilot, or any MCP client with one command
- **Minimal dependencies** &mdash; lightweight core engine
- **TypeScript-first** &mdash; full type definitions included
- **25+ aggregate functions** &mdash; basic, statistical, and financial aggregations
- **LiveQuery** &mdash; streaming queries with delta/patch support
- **Editor support** &mdash; CodeMirror 6, Monaco, and TextMate grammars
- **React components** &mdash; visual pipeline builder out of the box

## Install

```bash
npm install @vaultgradient/pipequery-lang
```

## CLI — `pq`

PipeQuery also ships a CLI tool for building data pipelines, REST APIs, and rich terminal dashboards.

```bash
npm install -g @vaultgradient/pipequery-cli

pq init                  # scaffold a project
pq serve -d              # start the server as a daemon
pq dashboard             # launch the TUI dashboard
pq query "crypto | sort(price desc) | first(5)"
pq stop                  # stop the server

# Create a live API endpoint on the fly — no config needed
pq endpoint add /api/top-coins -q "crypto | sort(market_cap desc) | first(10)"
# → http://localhost:3000/api/top-coins is instantly available
```

Create API endpoints on the fly without editing config files — just `pq endpoint add` with a PipeQuery expression and your endpoint is live immediately.

### Run with Docker

The server and CLI are fully decoupled — deploy the server anywhere with Docker and control it from your local terminal:

```bash
# Run the server in Docker
docker run -p 3000:3000 ghcr.io/andreadito/pipequery

# From any folder on your machine, connect and start working
pq remote connect http://localhost:3000
pq source add crypto -t rest -u "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=20" -i 30s
pq endpoint add /api/top -q "crypto | sort(market_cap desc) | first(5)"
curl http://localhost:3000/api/top
```

Works the same with a remote server — just `pq remote connect https://my-server.example.com:3000`.

The dashboard features a resizable 2-column grid with live SSE updates and 7 visualization types. See [`cli/README.md`](./cli/README.md) for full documentation.

## Use with AI (MCP)

```bash
pq mcp serve                      # stdio — plug into Claude Desktop / Cursor / Claude Code
pq mcp serve --http --port 3001   # HTTP/SSE — for remote clients or hosted deployments
pq mcp serve --attach http://localhost:3000  # attach to a running `pq serve`
```

Your AI agent gets 5 tools: `query`, `list_sources`, `describe_source`, `list_endpoints`, `call_endpoint`. See [`cli/README.md`](./cli/README.md#use-with-ai-mcp) for client setup recipes.

## Quick Start

```ts
import { query } from '@vaultgradient/pipequery-lang';

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

### Built-in Functions

| Category | Functions |
|----------|-----------|
| **String** | `lower`, `upper`, `len`, `concat`, `trim`, `contains`, `startsWith`, `endsWith`, `substring`, `replace` |
| **Logic** | `if`, `coalesce` |
| **Math** | `abs`, `round` |

```
where(contains(name, "Bitcoin"))          // substring search
where(startsWith(symbol, "BT"))           // prefix match
where(endsWith(email, ".com"))            // suffix match
select(trim(name) as name)               // strip whitespace
select(substring(name, 0, 5) as short)   // extract first 5 chars
select(replace(name, "old", "new") as r) // replace all occurrences
```

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
import { query } from '@vaultgradient/pipequery-lang';

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
import { compile } from '@vaultgradient/pipequery-lang';

const fn = compile('where(price > 100) | sort(price desc)');
const result = fn({ _data: items });
```

### `parseQuery(expression)`

Parse a query into its AST without executing.

```ts
import { parseQuery } from '@vaultgradient/pipequery-lang';

const ast = parseQuery('items | where(price > 100)');
// Inspect tokens, operations, expressions
```

### `liveQuery(data, expression, options)`

Streaming query evaluator that accepts data patches and re-executes efficiently.

```ts
import { liveQuery } from '@vaultgradient/pipequery-lang';

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
import { clearCache } from '@vaultgradient/pipequery-lang';

clearCache();
```

## Error Handling

All errors include position info (`position`, `line`, `column`) for editor integration.

```ts
import { LexerError, ParseError, RuntimeError, DataWeaveError } from '@vaultgradient/pipequery-lang';

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
import { pipeQuery } from '@vaultgradient/pipequery-lang/highlighting';

// Monaco Editor
import { registerPipeQuery } from '@vaultgradient/pipequery-lang/highlighting';
```

A TextMate grammar is included at `dist/highlighting/textmate/pipequery.tmLanguage.json` for VS Code, IntelliJ, and Sublime Text.

**Peer dependencies:** `@codemirror/language`, `@codemirror/state`, `@codemirror/view`, `@lezer/highlight` (CodeMirror only)

### React Components

```tsx
import { PipeQueryBuilder } from '@vaultgradient/pipequery-lang/react';

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

Contributions welcome. Open an issue first for anything non-trivial, sign off commits with `git commit -s` (DCO — no CLA), and submit a PR. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the full flow.

```bash
git clone https://github.com/andreadito/pipequery.git
cd pipequery
npm install
npm test
```

## License & commercial use

This repo ships two packages with different licenses:

- **Engine** &mdash; [`@vaultgradient/pipequery-lang`](https://www.npmjs.com/package/@vaultgradient/pipequery-lang) and everything under `src/` is [MIT](./LICENSE).
- **CLI** &mdash; [`@vaultgradient/pipequery-cli`](https://www.npmjs.com/package/@vaultgradient/pipequery-cli) (under `cli/`) is **[Business Source License 1.1](./cli/LICENSE)** from version 0.4.0 onward. You can use and embed it freely in production inside your own company or product. What the BSL blocks is running it as a competing hosted Model Context Protocol service or data-query-as-a-service. Each released version converts to MIT four years after it ships. Plain-English summary: [`cli/LICENSING.md`](./cli/LICENSING.md).

Running (or planning to run) pipequery commercially? Two lightweight channels:

- **Hosted pipequery MCP for your team** &mdash; [open an inquiry](https://github.com/andreadito/pipequery/issues/new?template=hosted-mcp.yml).
- **Commercial license or paid support** &mdash; [open an inquiry](https://github.com/andreadito/pipequery/issues/new?template=commercial-license.yml).

Commercialization is run by **Vault Gradient**. The repo stays on [`andreadito`](https://github.com/andreadito) for now.

&copy; andreadito &middot; [MIT](./LICENSE) (engine) &middot; [BSL 1.1](./cli/LICENSE) (CLI, from v0.4.0)
