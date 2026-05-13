import { defineConfig } from 'tsup';

// Two-stage build: the CLI binary (with a shebang) and library entry points
// (with .d.ts declarations). The CLI build cleans `dist/`; the lib build runs
// after and preserves it.
//
// Library entries are additive; consumers can use the CLI as before, and
// programmatic consumers can import `@andreadito/pq/engine` /
// `@andreadito/pq/sources` for embedding scenarios (e.g. a custom MCP gateway).
export default defineConfig([
  {
    name: 'cli',
    entry: ['src/index.ts'],
    format: ['esm'],
    target: 'node24',
    platform: 'node',
    clean: true,
    splitting: false,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
  {
    name: 'lib',
    entry: {
      engine: 'src/engine.ts',
      'sources/manager': 'src/server/sources/manager.ts',
    },
    format: ['esm'],
    target: 'node24',
    platform: 'node',
    clean: false,
    splitting: false,
    dts: true,
  },
]);
