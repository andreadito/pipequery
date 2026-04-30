# PipeQuery — Working Notes for Claude

A pipe-based query DSL for JavaScript/TypeScript, plus a CLI server (`pq`) that exposes it over HTTP, MCP, and Telegram. This file is for Claude — orienting context that isn't obvious from `README.md`.

## Repo layout

This is a **two-package monorepo with two extra apps**, not a workspace (no `pnpm-workspace.yaml`, no npm workspaces). Each package has its own `package.json`, `package-lock.json`, and `node_modules`.

| Path | Package | Purpose |
|------|---------|---------|
| `src/engine/` | `@andreadito/pipequery-lang` (root) | Lexer, parser, compiler, runtime, cache, LiveQuery |
| `src/highlighting/` | same, sub-export `/highlighting` | CodeMirror 6 + Monaco + TextMate grammars |
| `src/react/` | same, sub-export `/react` | `<PipeQueryBuilder/>` visual builder (MUI + emotion) |
| `cli/` | `@andreadito/pq` | The `pq` CLI binary — server, MCP, TUI, telegram, watches |
| `demo-app/` | (not published) | Vite playground deployed under `/demo` on Pages |
| `docs/` | (not published) | Vite docs site, deploys to GitHub Pages |
| `__tests__/` | engine tests | Vitest, runs from repo root |
| `cli/__tests__/` | CLI tests | Vitest, runs from `cli/` |
| `scripts/` | smoke tests | Bash scripts mirroring CI smoke jobs |

## Build & test commands

Always run commands from the right directory. Tests in particular: `vitest.config.ts` at the root **excludes `cli/**`** because CLI tests import deps that only exist in `cli/node_modules`. If you `cd` to `cli/` you need a separate `npm ci` there.

```bash
# Engine (run from repo root)
npm install
npm run build              # tsup → dist/{engine,highlighting,react}/index.{js,cjs,d.ts}
npm test                   # vitest run, excludes cli/**
npx tsc --noEmit           # typecheck only (tsconfig has noEmit:true)

# CLI (run from cli/)
cd cli
npm install
npm run build              # tsup → cli/dist/index.js
npm test
npm run dev                # tsup --watch

# Demo app + docs (vite)
cd demo-app && npm install && npm run dev
cd docs && npm install && npm run dev

# Smoke tests (require built artifacts)
bash scripts/smoke-test-all.sh        # docker + cli + engine
bash scripts/smoke-test-engine.sh
bash scripts/smoke-test-cli.sh
bash scripts/smoke-test-docker.sh     # needs Docker running locally
```

Node 22+ required (CI pins `node-version: 22`, `cli/package.json` has `engines.node >=22`).

## Releases

Releases are **manual, GitHub-Actions-driven**. Do not run `npm publish` locally.

1. Trigger `.github/workflows/release.yml` via `gh workflow run Release -f bump=patch -f packages=all` (or `engine` / `cli`, `minor` / `major`).
2. The workflow bumps versions, commits as `release: engine vX.Y.Z cli vA.B.C`, tags (`vX.Y.Z` for engine, `cli-vA.B.C` for CLI), pushes to `main`, then runs tests + publishes to **both** GitHub Packages and the public npm mirror.
3. Each package is published twice under different scopes:
   - GitHub Packages: `@andreadito/pipequery-lang`, `@andreadito/pq` (the names in `package.json`)
   - Public npm: `@vaultgradient/pipequery-lang`, `@vaultgradient/pipequery-cli` (renamed in-workflow before publish)
4. Docker image publishes to `ghcr.io/andreadito/pipequery` after the CLI publish succeeds.
5. `deploy-docs.yml` triggers off `main` push and publishes the docs + demo to GitHub Pages.

Commit style for release commits is **literally** `release: engine vX.Y.Z` / `release: cli vA.B.C` / `release: engine vX.Y.Z cli vA.B.C` — the workflow constructs this; don't hand-write it.

After bumping versions, the `package-lock.json` files **must be regenerated** in the same commit. The fix in `efbdd84` was a release that broke because `npm ci` rejected a stale lock file.

## Conventions

- TypeScript strict mode everywhere; root and CLI both use `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`, `noEmit: true` (tsup handles emit).
- ESM-first (`"type": "module"`); tsup builds dual ESM + CJS for the engine (CLI is ESM-only since it's a binary).
- Engine peer dependencies are **all optional** — keep it that way. Adding a hard dep to `@mui/*` or `@codemirror/*` would force every consumer to install them.
- `tsup.config.ts` `external` array lists every peer dep — anything new in `peerDependencies` must also be added there or it'll get bundled.
- The engine is intentionally tiny (one runtime dep: `@codemirror/autocomplete`). Be reluctant to add dependencies to the root `package.json`. CLI deps are fine to grow.
- Operators live in `src/engine/runtime.ts` (execution) + `src/engine/parser.ts` (syntax) + `src/engine/lexer.ts` (tokens). Adding an operator usually means touching all three plus a test in `__tests__/`. The operator keyword set is also hard-coded in `OPERATION_KEYWORDS` at the top of `src/engine/index.ts` — easy to forget.
- CLI commands are one file per command in `cli/src/commands/`, wired up in `cli/src/index.ts` via Commander.
- Push-down adapters (Postgres / MySQL / Snowflake / ClickHouse / Mongo) live under `cli/src/server/sources/` — when adding push-down support for a new operator, every adapter that supports that operator needs to handle it.

## Common gotchas

- **`vitest.config.ts` exclude** — running `npx vitest` from the root will silently skip CLI tests. To run CLI tests do it from `cli/`.
- **Two lock files** — never run `npm install` from the root expecting to install CLI deps. Each package is independent.
- **Daemon mode** — `pq serve -d` writes a PID file to `.pipequery/`. If a previous test run left one behind, `pq serve` will refuse to start. `pq stop` cleans it up; otherwise `rm -rf .pipequery`.
- **Port 3000** is the server default. Smoke tests use 3098/3099 to avoid clobbering a running daemon.
- **Local link for testing CLI changes** — from `cli/`: `npm run build && npm link`. To test against an unreleased engine, also `npm link` the engine first and then `npm link @andreadito/pipequery-lang` from `cli/`.

## When working on this repo

- For an engine bug: reproduce it in `__tests__/` first (the existing `query.test.ts` / `runtime.test.ts` / `parser.test.ts` are good templates), then fix.
- For a CLI command: there's almost always an existing command file in `cli/src/commands/` to model after. Commander option parsing and the daemon-aware `getServerUrl()` helper are consistent across them.
- For a new data source: copy an existing adapter under `cli/src/server/sources/`, register it in the source factory, and add a row to the README's "Data sources" table. If it supports push-down, also wire it through `cli/src/server/sources/<x>/pushdown.ts` style.
- Before claiming a change works, run the relevant smoke test (`scripts/smoke-test-*.sh`) — the CI matrix runs these post-publish, and they catch packaging issues unit tests miss.
- Don't bump versions in `package.json` by hand. The release workflow owns that.
