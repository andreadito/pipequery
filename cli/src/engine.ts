// Re-export the PipeQuery engine from the parent package.
// This module centralizes the import so we can switch between
// workspace reference and published package easily.
export { query, compile, parseQuery, clearCache, LiveQuery, liveQuery } from '../../src/engine/index.js';
export type { DataContext, CompiledQuery, LiveQueryOptions, LiveQueryStats } from '../../src/engine/index.js';
