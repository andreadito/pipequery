/**
 * Web Worker for running benchmarks off the main thread.
 *
 * Messages:
 *   IN:  { type: 'run', size: number }
 *   OUT: { type: 'progress', msg: string }
 *   OUT: { type: 'done', suite: BenchSuite }
 */

import { runBrowserBenchmarks } from './browser-bench.ts';

self.onmessage = (e: MessageEvent) => {
  if (e.data?.type === 'run') {
    const size = e.data.size as number;
    const suite = runBrowserBenchmarks(size, (msg) => {
      self.postMessage({ type: 'progress', msg });
    });
    self.postMessage({ type: 'done', suite });
  }
};
