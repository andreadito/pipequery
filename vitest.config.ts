import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // The CLI workspace has its own tests, deps, and vitest setup under cli/.
    // The default include glob would otherwise walk into cli/__tests__ and try
    // to load files that import deps only present in cli/node_modules,
    // breaking the engine-level test run during release.
    exclude: ['**/node_modules/**', '**/dist/**', 'cli/**'],
  },
});
