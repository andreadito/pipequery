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
</p>

---

## Features

### Engine (npm library)
- **Pipe-based syntax** &mdash; chain operations with `|`, inspired by Unix pipes and SQL
- **Minimal dependencies** &mdash; lightweight core engine
- **TypeScript-first** &mdash; full type definitions included
- **25+ aggregate functions** &mdash; basic, statistical, and financial aggregations
- **LiveQuery** &mdash; streaming queries with delta/patch support
- **Editor support** &mdash; CodeMirror 6, Monaco, and TextMate grammars
- **React components** &mdash; visual pipeline builder out of the box

### CLI (`pq`)
- **MCP server** &mdash; plug pipequery into Claude Desktop, Claude Code, Cursor, Copilot, or any MCP client with one command
- **11 data sources** &mdash; REST, WebSocket, file, static, Postgres, MySQL, SQLite, Kafka, Snowflake, ClickHouse, MongoDB
- **Push-down to SQL + Mongo** &mdash; pipe expressions targeting Postgres / MySQL / Snowflake / ClickHouse compile to native SQL; targeting MongoDB compile to `find()` / `aggregate()`. No in-memory materialization for those engines.
- **Telegram bot + natural language** &mdash; `pq telegram serve` exposes the same MCP verbs in chat; pass `--anthropic-key` and Claude translates plain English into pipequery
- **Alert watches** &mdash; `pq watch add` polls a query and posts a Telegram notification on a state transition
- **Live API endpoints** &mdash; `pq endpoint add /api/foo -q "..."` exposes a JSON endpoint immediately, no config edit
- **Terminal dashboard** &mdash; resizable TUI with 7 visualization types and live SSE updates

## Install

```bash
npm install @vaultgradient/pipequery-lang
```

## CLI — `pq`

PipeQuery also ships a CLI tool for building data pipelines, live API endpoints, terminal dashboards, MCP servers, and Telegram bots.

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

### Data sources

11 source types out of the box, all addable at runtime via `pq source add`:

| Type | What it polls / streams | Push-down |
|------|--------------------------|-----------|
| `rest` | HTTP GET, with `${ENV_VAR}` interpolation in url/headers/params and optional `auth: bearer` | — |
| `websocket` | WSS stream with optional `subscribe` payload + `heartbeat` keepalive (Binance / Coinbase / Kraken / etc.) | — |
| `file` | Local JSON / CSV with optional `watch:` mode | — |
| `static` | Inline JSON in yaml | — |
| `postgres` (incl. TimescaleDB) | SELECT query | ✅ where/sort/first/select/distinct/rollup/aggregates → SQL |
| `mysql` / MariaDB | SELECT query | ✅ same operator set, MySQL dialect |
| `sqlite` | Local SQLite file | — |
| `kafka` (incl. Redpanda) | Topic subscriber, ring-buffered | — |
| `snowflake` | SELECT query against Snowflake | ✅ same operator set, Snowflake dialect |
| `clickhouse` | SELECT query over HTTP/HTTPS | ✅ same operator set, ClickHouse dialect |
| `mongodb` | `find()` against a collection (with optional default filter) | ✅ where/sort/first/select → `find()`; rollup/aggregates → `aggregate()` |

Push-down is auto-routed: when a pipe expression targets a source whose adapter supports it, the engine compiles to native SQL (or Mongo plan) and runs it on the database — no in-memory materialization. Unsupported pipeline shapes transparently fall back to in-process execution.

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
pq mcp serve --http --auth-token "$PIPEQUERY_MCP_TOKEN"   # bearer-token auth on the HTTP transport
pq mcp serve --attach http://localhost:3000  # attach to a running `pq serve`
```

Your AI agent gets 5 tools: `query`, `list_sources`, `describe_source`, `list_endpoints`, `call_endpoint`. Push-down auto-routing applies here too — agents asking *"top 5 paid orders"* against a Postgres / MySQL / Snowflake / ClickHouse / Mongo source compile to native SQL or Mongo plans automatically. See [`cli/README.md`](./cli/README.md#use-with-ai-mcp) for client setup recipes.

## Telegram bot + alerts

```bash
# Bot exposes the same MCP verbs as Telegram slash commands
PIPEQUERY_TG_BOT_TOKEN=<token> pq telegram serve --allow-user @yourname

# Add --anthropic-key to enable plain-English questions (Haiku 4.5 + prompt caching)
ANTHROPIC_API_KEY=sk-ant-... pq telegram serve --allow-user @yourname

# Add --log-file ./bot.jsonl to record every event as JSONL for jq / SIEM analysis
pq telegram serve --allow-user @yourname --log-file ./bot.jsonl

# Alert watches — query → notification on state transition
pq watch add btc-dip \
  --query "crypto | where(symbol == 'BTC' && price < 50000)" \
  --interval 60s --fire-when when_non_empty \
  --telegram-chat-id -1001234567890 \
  --telegram-message "🚨 BTC dipped: \${{ .price }}"
```

Bot commands mirror MCP tools (`/sources`, `/describe`, `/endpoints`, `/call`, `/query`); plain text gets translated to pipequery via Anthropic's API when configured. Watches support `when_non_empty` (default), `when_empty`, and `on_change` fire conditions — idempotent across the chosen mode, no flapping. See [`cli/README.md`](./cli/README.md#use-from-telegram) for the full surface.

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

// Group and aggregate (one row per category)
query(data, 'groupBy(category) | select(category, avg(price) as avgPrice)');
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

### `printQuery(ast)`

Print a pipeline AST back to canonical pipequery text. Parentheses are added only where precedence requires them, numbers and strings are escaped, and invalid nodes throw. Use it to inspect or rewrite a parsed query, for example to cap every result.

```ts
import { parseQuery, printQuery } from '@andreadito/pipequery-lang';

const ast = parseQuery('orders | where(total > 100)');
ast.operations.push({ kind: 'FirstOp', count: 1000 });
printQuery(ast); // orders | where(total > 100) | first(1000)
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

### Typed query builder

`@andreadito/pipequery-lang/builder` builds queries in code instead of strings. It is a headless utility, not an ORM: it builds the same AST the parser produces, and `toString()` prints it back with `printQuery`. The builder entry imports nothing from React or MUI.

```ts
import { from, agg, col } from '@andreadito/pipequery-lang/builder';
import { query } from '@andreadito/pipequery-lang';

type Order = { id: number; customerId: number; total: number; status: string; region: string };

const paid = from<Order>('orders')
  .where((o) => o.status.eq('paid'))
  .join('customers', (o, c) => o.customerId.eq(c.id))
  .select((o) => ({ id: o.id, name: o.name, total: o.total }));

paid.toString();
// orders | where(status == "paid") | join(customers, customerId == id) | select(id, name, total)

paid.run({ orders, customers });                 // rows
query({ orders, customers }, paid.toString());   // same rows
```

Terminal aggregates end the pipeline and return a `Scalar`, whose `run()` returns one value:

```ts
from<Order>('orders').where((o) => o.status.eq('paid')).sum((o) => o.total).run({ orders }); // 160
```

Grouping works with `rollup` (group keys go inside it) or with `groupBy` followed by `select`:

```ts
from<Order>('orders').rollup('region', agg.sum(col('total')).as('revenue'));
// orders | rollup(region, sum(total) as revenue)

from<Order>('orders')
  .groupBy('region')
  .select((o) => ({ region: o.region, revenue: agg.sum(o.total) }));
// orders | groupBy(region) | select(region, sum(total) as revenue)
```

**Escape hatch.** `.pipe()` accepts raw pipequery operations. They are parsed with the real parser, so a malformed string throws a `ParseError`:

```ts
from<Order>('orders').pipe('where(total > 100) | first(10)');
```

**Values are escaped.** `o.status.eq(input)` prints `input` as a string literal, so quotes, backslashes and newlines in user input cannot change the query structure.

**Invalid input throws at build time.** Bad identifiers, reserved words, `NaN`/`Infinity`, `first(-1)` and misplaced aliases throw a `BuilderError`.

#### Grammar limits

- **Identifiers** must match `[A-Za-z_][A-Za-z0-9_]*`. Field and source names with spaces, hyphens or other characters cannot be written, and there is no quoted-identifier syntax yet. `from('my-orders')` throws.
- **Reserved words** `as asc desc true false null` cannot be names.
- **Aliases** (`.as(name)`) work in `select`, `map`, `rollup`, `pivot` and `reduce`. They throw in `sort`, `groupBy`, `distinct`, `flatten`, `transpose` and standalone aggregates.
- **`||` is not supported.** The lexer reads it as two pipes. Use `.or()`, which prints as `if(a, true, b)`.
- **Window functions** (`win.*`) are allowed only as top-level fields of `select`.
- **Group keys** go in `rollup(keys, aggs)` or `groupBy(...) | select(...)`. `groupBy(k) | rollup(agg)` returns `null` aggregates in the current engine.
- **Offsets** for `lag` and `lead` must be integers >= 1.
- **Numbers** such as `1e21` print as plain decimals. Negative literals print as unary minus (`-5`), which re-parses as `-(5)`.

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

Contributions are welcome! Please open an issue or submit a pull request.

```bash
git clone https://github.com/andreadito/pipequery.git
cd pipequery
npm install
npm test
```

## License

[MIT](./LICENSE) &copy; andreadito
