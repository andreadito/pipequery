# pq — PipeQuery CLI

A command-line tool for building data pipelines, REST APIs, and terminal dashboards using PipeQuery expressions.

Connect to any data source (REST APIs, WebSockets, files, Postgres, MySQL, SQLite, Kafka), run pipe-based queries to transform and aggregate data, then expose results as API endpoints or visualize them as rich terminal charts.

**Create API endpoints on the fly** — run `pq endpoint add /api/prices -q "crypto | sort(price desc)"` and instantly get a live JSON endpoint, no config file needed.

**Give your AI agent live data** — `pq mcp serve` exposes every configured source to any Model Context Protocol client (Claude Desktop, Claude Code, Cursor, Copilot). Your AI can now query your REST APIs, files, Postgres / MySQL / SQLite databases, Kafka streams, and WebSocket feeds directly.

**Use it from Telegram** — `pq telegram serve` runs a Telegram bot that maps the same MCP commands to chat (`/query`, `/sources`, `/describe`, `/call`). Pair with `pq watch add` to push alerts to a Telegram channel when a query result transitions (`when_non_empty`, `when_empty`, or `on_change`).

## Installation

```bash
npm install -g @vaultgradient/pipequery-cli
```

Or install from source:

```bash
git clone https://github.com/andreadito/pipequery.git
cd pipequery/cli
npm install && npm run build
npm link
```

## Quick Start

```bash
# 1. Initialize a project
pq init

# 2. Start the server
pq serve

# 3. Run a query
pq query "crypto | sort(market_cap desc) | first(5)"

# 4. Launch the terminal dashboard
pq dashboard
```

## Commands

### `pq init`

Creates a `pipequery.yaml` config file in the current directory with example sources, endpoints, and a dashboard layout.

### `pq serve`

Starts the PipeQuery server.

```bash
pq serve                        # Foreground mode
pq serve -p 4000                # Custom port
pq serve -d                     # Run as background daemon
pq serve --stop                 # Stop a running daemon
```

### `pq query <expression>`

Runs a PipeQuery expression against the running server and prints results.

```bash
pq query "crypto | sort(price desc) | first(10)"
pq query "orders | groupBy(status) | count()" -f json
```

Options:
- `-f, --format <format>` — Output format: `table` (default) or `json`

### `pq source`

Manage data sources at runtime. Changes are applied live and persisted to config.

```bash
# List all sources
pq source list

# Add a REST source
pq source add coins -t rest -u "https://api.example.com/coins" -i 30s

# Add a file source with live watching
pq source add orders -t file -p ./data/orders.csv -w

# Add a Postgres source (credentials interpolated from env at runtime)
pq source add users -t postgres \
  -u "postgres://\${DB_USER}:\${DB_PASS}@db.internal:5432/app" \
  -q "SELECT id, email, created_at FROM users WHERE created_at > NOW() - INTERVAL '7 days'" \
  -i 60s

# Add a MySQL source
pq source add orders -t mysql \
  -u "mysql://\${DB_USER}:\${DB_PASS}@db.internal:3306/shop" \
  -q "SELECT id, total, status FROM orders WHERE created_at > NOW() - INTERVAL 1 DAY" \
  -i 60s

# Add a SQLite source (path is relative to pipequery.yaml; opens read-only by default)
pq source add events -t sqlite -p ./events.db \
  -q "SELECT * FROM events WHERE ts > strftime('%s', 'now', '-1 hour')" \
  -i 30s

# Add a Kafka / Redpanda source (streaming — last 1000 messages kept in a ring buffer)
pq source add live_orders -t kafka \
  --brokers "broker1:9092,broker2:9092" \
  --topic order-events \
  --value-format json

# Test a source (fetch sample data)
pq source test coins

# Remove a source
pq source remove coins
```

Source types:
- **rest** — Polls a REST API at a configurable interval
- **websocket** — Streams data from a WebSocket connection
- **file** — Reads JSON or CSV files, optionally watches for changes
- **static** — Inline JSON data defined in config
- **postgres** — Polls a Postgres query. Supports `${ENV_VAR}` interpolation in the connection URL so credentials stay out of `pipequery.yaml`. Options: `-u` URL, `-q` query, `-i` interval, `--ssl <require\|no-verify\|false>`, `--max-rows <n>` (default 10000).
- **mysql** — Polls a MySQL (or MariaDB) query. Same env-var interpolation and `--ssl` / `--max-rows` options as `postgres`.
- **sqlite** — Polls a query against a local SQLite file (or `:memory:`). Opens read-only by default (pass `--no-readonly` to open read-write). Options: `-p` path, `-q` query, `-i` interval, `--max-rows <n>`, `--no-readonly`.
- **kafka** — Streams messages from a Kafka (or Kafka-compatible, e.g. Redpanda) topic into a bounded ring buffer. Each message is decoded per `valueFormat` and spread into a row alongside `_kafka_topic`/`_kafka_partition`/`_kafka_offset`/`_kafka_timestamp`/`_kafka_key` metadata. Auto-generates a per-process consumer group so each pipequery instance sees the full firehose; set `groupId` explicitly to load-balance across replicas. Options: `--brokers` (comma list, supports `${ENV_VAR}`), `--topic`, `--group-id`, `--from-beginning`, `--value-format <json\|string\|raw>`, `--max-buffer <n>` (default 1000), `--ssl true`. SASL is config-only (not CLI-exposed yet).

### `pq endpoint`

Create API endpoints on the fly — no config file edits needed. Each endpoint runs a PipeQuery expression against live data and serves the result as JSON over HTTP. Changes take effect immediately and are persisted to `pipequery.yaml`.

```bash
# List endpoints
pq endpoint list

# Create a live API endpoint instantly
pq endpoint add /api/top-coins -q "crypto | sort(market_cap desc) | first(10)"

# Add with response caching
pq endpoint add /api/summary -q "orders | groupBy(status) | count()" -c 30s

# Remove an endpoint
pq endpoint remove /api/top-coins

# Your endpoint is immediately available:
# curl http://localhost:3000/api/top-coins
```

### `pq dashboard`

Launches an interactive terminal dashboard with live-updating panels.

```bash
pq dashboard              # Launch the "main" dashboard
pq dashboard -n monitor   # Launch a named dashboard
```

Keyboard shortcuts:
- `Tab` / `Shift+Tab` — Cycle panel focus
- `↑` / `↓` — Scroll table rows
- `]` / `[` — Grow / shrink focused panel width
- `r` — Force refresh
- `q` — Quit

Panels are arranged in an equal-width 2-column grid that fills the terminal. Use `[` and `]` to resize the focused panel (25%–75% range), with the neighboring panel adjusting automatically.

Dashboard panels support multiple visualization types:
- **table** — Scrollable, sortable data table
- **bar** — Horizontal bar chart
- **sparkline** — Mini line chart with braille characters
- **stat** — Single value display
- **orderbook** — Live bid/ask depth chart with cumulative bars and spread
- **heatmap** — Color-coded numeric grid (red → yellow → green)
- **candle** — ASCII candlestick chart for OHLC data

### `pq stop`

Stops the running PipeQuery server (daemon or foreground).

```bash
pq stop                # Graceful shutdown (SIGTERM)
pq stop --force        # Force kill (SIGKILL)
```

### `pq monitor`

Launches a real-time activity monitor showing server requests, queries, and events.

```bash
pq monitor
```

### `pq repl`

Opens an interactive REPL for running PipeQuery expressions against the server.

```bash
pq repl
```

### `pq remote`

Deploy the server with Docker and control it from anywhere.

```bash
# Generate Dockerfile and docker-compose.yaml
pq remote deploy

# Connect your local CLI to a remote server
pq remote connect https://my-server.example.com

# Check remote server health
pq remote status
```

## Use with AI (MCP)

PipeQuery ships a [Model Context Protocol](https://modelcontextprotocol.io) server so any MCP-aware AI client — Claude Desktop, Claude Code, Cursor, Copilot, custom agents — can query your configured sources directly.

```bash
# stdio mode — what Claude Desktop / Cursor want
pq mcp serve

# HTTP/SSE mode — for remote clients or future hosted deployments
pq mcp serve --http --port 3001

# HTTP with bearer-token auth (recommended for anything non-localhost)
PIPEQUERY_MCP_TOKEN=$(openssl rand -hex 32) pq mcp serve --http --port 3001
# or inline:
pq mcp serve --http --port 3001 --auth-token "my-secret"

# Attach to a running `pq serve` instance instead of loading pipequery.yaml locally
pq mcp serve --attach http://localhost:3000

# Inspect the tool schemas (useful for directory submission / debugging)
pq mcp inspect
```

**HTTP authentication** — when a token is set (`PIPEQUERY_MCP_TOKEN` env var or `--auth-token` flag), clients must send `Authorization: Bearer <token>` on every request; unauthenticated requests are rejected with `401`. If no token is set, the endpoint is open and the server prints a loud startup warning — fine for localhost, never OK for a publicly reachable deployment.

**Tools exposed** to the AI:

| Tool | What it does |
|------|-------------|
| `query` | Run any PipeQuery expression against live sources |
| `list_sources` | List configured sources and their health |
| `describe_source` | Return a sample + inferred field names for one source |
| `list_endpoints` | List pre-configured endpoints and their stored queries |
| `call_endpoint` | Execute a pre-configured endpoint by path |

### Claude Desktop setup

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "pipequery": {
      "command": "pq",
      "args": ["mcp", "serve"],
      "cwd": "/path/to/your/project-with-pipequery.yaml"
    }
  }
}
```

Restart Claude Desktop; ask "what pipequery sources are configured?" to verify.

### Claude Code / Cursor setup

Same idea — consult each tool's MCP config section. The stdio command is `pq mcp serve` with `cwd` pointing at a directory containing `pipequery.yaml`.

## Use from Telegram

`pq telegram serve` runs a Telegram bot that exposes the same five verbs as MCP, mapped to slash commands.

```bash
PIPEQUERY_TG_BOT_TOKEN=<your-bot-token> pq telegram serve --allow-user @yourname

# Or attach to a running pq serve instance
pq telegram serve --bot-token <token> --attach http://localhost:3000 --allow-user @yourname
```

Bot commands:

| Command | What it does |
|---|---|
| `/sources` | List configured sources and their health |
| `/describe <name>` | Sample rows + inferred field names |
| `/endpoints` | List pre-configured endpoints |
| `/call <path>` | Execute a pre-configured endpoint by path |
| `/query <expression>` | Run an arbitrary pipequery expression |
| `/help` | Show usage |

Without `--allow-user`, the bot replies to anyone who finds it (a stderr warning prints on first message). For anything reachable from the public internet, set the allowlist.

## Watch — alerts to Telegram

`pq watch add` registers a query that runs on every interval; when its result transitions (becomes non-empty, becomes empty, or changes content), pipequery posts a notification to a Telegram chat / channel.

```bash
# Set up the bot token once
export PIPEQUERY_TG_BOT_TOKEN=<your-bot-token>

# BTC dropped under $80k? Tell me.
pq watch add btc_dip \
  -q "crypto | where(symbol == 'BTC' && price < 80000) | first(1)" \
  -i 30s \
  --telegram-chat-id -1001234567890 \
  --telegram-message "🚨 BTC dipped: \${{ .price }}"

pq watch list
pq watch remove btc_dip
```

`fireWhen` modes:
- **`when_non_empty`** (default) — fire on the empty → non-empty transition. Standard alerting shape; no spam while still triggered, re-fires after going empty and back.
- **`when_empty`** — inverse, e.g. liveness checks that fire when nothing matches.
- **`on_change`** — fire whenever the result content changes. Use sparingly; can be chatty.

Message templates support `{{ .field }}` (first-row field), `{{ .count }}` (total row count), `{{ .watchName }}`, and `{{ .reason }}`. If you omit the template, the bot posts a default summary plus the rendered result.

## Docker & Remote Deployment

The `pq` server and CLI are fully decoupled. You can run the server in Docker (locally or on a remote machine) and control it from your local terminal.

### Run locally with Docker Desktop

```bash
# Build and run the server
docker build -t pipequery .
docker run -p 3000:3000 pipequery

# From any terminal, connect and start working
pq remote connect http://localhost:3000
pq source add crypto -t rest -u "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=20" -i 30s
pq endpoint add /api/top -q "crypto | sort(market_cap desc) | first(5)"
curl http://localhost:3000/api/top
```

### Deploy to a remote server

```bash
# Generate deployment files from your project
pq remote deploy
# → Creates Dockerfile, docker-compose.yaml, .dockerignore

# Deploy to your server
scp -r . user@server:~/pipequery
ssh user@server "cd pipequery && docker compose up -d"

# Connect your local CLI to the remote server
pq remote connect https://my-server.example.com:3000

# Now all commands work against the remote server
pq source add store -t rest -u "https://fakestoreapi.com/products" -i 5m
pq endpoint add /api/products -q "store | sort(price desc)"
pq query "store | where(price > 50) | select(title, price, category)"
pq dashboard -n main
```

### How it works

Running `pq remote connect <url>` saves the remote URL in your local `pipequery.yaml`. After that, all CLI commands (`query`, `source`, `endpoint`, `dashboard`, `monitor`) talk to the remote server instead of looking for a local one. No local server needed — just the `pq` CLI.

### `pq completion`

Generate shell tab-completion scripts.

```bash
# Auto-detect shell
pq completion

# Specific shell
pq completion -s bash
pq completion -s zsh
pq completion -s fish
```

## Configuration

All configuration lives in `pipequery.yaml`:

```yaml
server:
  port: 3000
  host: 0.0.0.0

sources:
  crypto:
    type: rest
    url: https://api.coingecko.com/api/v3/coins/markets
    params:
      vs_currency: usd
    interval: 30s
  orders:
    type: file
    path: ./data/orders.csv
    watch: true

endpoints:
  /api/top-coins:
    query: "crypto | sort(market_cap desc) | first(10)"
    cache: 30s

dashboards:
  main:
    refresh: 10s
    panels:
      - title: Top Coins
        query: "crypto | sort(market_cap desc) | first(10)"
        viz: table
      - title: Volume Leaders
        query: "crypto | sort(total_volume desc) | first(8)"
        viz: bar
```

### Source Configuration

#### REST Source
```yaml
sources:
  my_api:
    type: rest
    url: https://api.example.com/data
    interval: 30s          # Poll interval
    headers:               # Optional HTTP headers
      Authorization: "Bearer TOKEN"
    params:                # Optional query parameters
      limit: 100
    dataPath: data.items   # Optional: extract nested data
```

#### WebSocket Source
```yaml
sources:
  live_feed:
    type: websocket
    url: wss://stream.example.com/feed
```

#### File Source
```yaml
sources:
  orders:
    type: file
    path: ./data/orders.csv    # JSON or CSV
    watch: true                # Re-read on change
```

#### Static Source
```yaml
sources:
  regions:
    type: static
    data:
      - { code: US, name: United States }
      - { code: EU, name: European Union }
```

## Example Data Sources

These free public APIs work great with `pq` — no API keys needed:

```bash
# Crypto prices (CoinGecko)
pq source add crypto -t rest -u "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=20" -i 30s
pq query "crypto | sort(market_cap desc) | first(5) | select(name, current_price, market_cap)"

# World countries (REST Countries)
pq source add countries -t rest -u "https://restcountries.com/v3.1/all?fields=name,population,region,area" -i 1h
pq query "countries | sort(population desc) | first(10) | select(name, population, region)"

# E-commerce products (Fake Store)
pq source add store -t rest -u "https://fakestoreapi.com/products" -i 5m
pq query "store | where(price > 50) | sort(price desc) | select(title, price, category)"

# Live earthquakes (USGS)
pq source add quakes -t rest -u "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson" -i 5m

# Mock users & posts (JSONPlaceholder)
pq source add users -t rest -u "https://jsonplaceholder.typicode.com/users" -i 1h
pq source add posts -t rest -u "https://jsonplaceholder.typicode.com/posts" -i 1h

# Exchange rates (NBP)
pq source add forex -t rest -u "https://api.nbp.pl/api/exchangerates/tables/A/?format=json" -i 1h
```

## PipeQuery Expressions

PipeQuery uses a pipe-based syntax to transform data:

```
source | operation1(args) | operation2(args) | ...
```

Common operations:
- `sort(field desc)` — Sort by field
- `first(n)` / `last(n)` — Take first/last N items
- `filter(field > value)` — Filter rows
- `groupBy(field)` — Group by field
- `count()` / `sum(field)` / `avg(field)` — Aggregations
- `select(field1, field2)` — Pick specific fields
- `where(condition)` — Filter with condition
- `map(expr)` — Transform each row

## Architecture

```
pq CLI ──── REST Control API ──── Fastify Server
                                    ├── SourceManager (REST/WS/File/Static adapters)
                                    ├── PipeQuery Engine
                                    ├── Dynamic API Endpoints (/api/*)
                                    └── SSE for real-time dashboard updates
```

The CLI communicates with the server via a control API at `/api/_control/*`. When the server isn't running, config-only commands (like `source list`) read directly from `pipequery.yaml`.

The dashboard uses Server-Sent Events (SSE) for real-time push updates when connected, falling back to polling when SSE is unavailable.

## License

MIT
