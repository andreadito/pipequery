/**
 * Browser benchmark suite — runs in main thread or web worker.
 * Importable from the Playground UI or runnable standalone.
 */

import { generateData, bench, type BenchResult } from './data.ts';
import { query, compile } from '../../src/engine/index.ts';

export interface BenchSuite {
  label: string;
  size: number;
  results: BenchResult[];
  totalMs: number;
}

export function runBrowserBenchmarks(
  size: number,
  onProgress?: (msg: string) => void,
): BenchSuite {
  const start = performance.now();
  onProgress?.(`Generating ${size.toLocaleString()} rows...`);
  const data = generateData(size);
  const ctx = { items: data };
  const results: BenchResult[] = [];

  const iters = size >= 100_000 ? 20 : 50;

  // ── Filter ──────────────────────────────────────────────────────────────
  onProgress?.('Benchmarking filter...');
  const filterCompiled = compile('items | where(price > 500)');
  results.push(bench('Filter (price > 500)', 'PipeQuery', () => query(ctx, 'items | where(price > 500)'), { iterations: iters }));
  results.push(bench('Filter (price > 500)', 'PQ (compiled)', () => filterCompiled(ctx), { iterations: iters }));
  results.push(bench('Filter (price > 500)', 'Native JS', () => data.filter(r => r.price > 500), { iterations: iters }));

  // ── Sort ─────────────────────────────────────────────────────────────────
  onProgress?.('Benchmarking sort...');
  const sortCompiled = compile('items | sort(price desc)');
  results.push(bench('Sort (price desc)', 'PipeQuery', () => query(ctx, 'items | sort(price desc)'), { iterations: iters }));
  results.push(bench('Sort (price desc)', 'PQ (compiled)', () => sortCompiled(ctx), { iterations: iters }));
  results.push(bench('Sort (price desc)', 'Native JS', () => [...data].sort((a, b) => b.price - a.price), { iterations: iters }));

  // ── GroupBy + Aggregate ──────────────────────────────────────────────────
  onProgress?.('Benchmarking group+aggregate...');
  const groupCompiled = compile('items | groupBy(category) | select(category, count() as n, avg(price) as avgPrice)');
  results.push(bench('GroupBy + Aggregate', 'PipeQuery', () =>
    query(ctx, 'items | groupBy(category) | select(category, count() as n, avg(price) as avgPrice)'), { iterations: iters }));
  results.push(bench('GroupBy + Aggregate', 'PQ (compiled)', () => groupCompiled(ctx), { iterations: iters }));
  results.push(bench('GroupBy + Aggregate', 'Native JS', () => {
    const groups = new Map<string, { sum: number; count: number }>();
    for (const r of data) {
      let g = groups.get(r.category);
      if (!g) { g = { sum: 0, count: 0 }; groups.set(r.category, g); }
      g.sum += r.price; g.count++;
    }
    return Array.from(groups, ([category, g]) => ({ category, n: g.count, avgPrice: g.sum / g.count }));
  }, { iterations: iters }));

  // ── Pipeline ─────────────────────────────────────────────────────────────
  onProgress?.('Benchmarking full pipeline...');
  const pipeCompiled = compile('items | where(price > 100) | groupBy(category) | select(category, count() as n, avg(price) as avg) | sort(avg desc)');
  results.push(bench('Pipeline (filter→group→sort)', 'PipeQuery', () =>
    query(ctx, 'items | where(price > 100) | groupBy(category) | select(category, count() as n, avg(price) as avg) | sort(avg desc)'), { iterations: iters }));
  results.push(bench('Pipeline (filter→group→sort)', 'PQ (compiled)', () => pipeCompiled(ctx), { iterations: iters }));
  results.push(bench('Pipeline (filter→group→sort)', 'Native JS', () => {
    const filtered = data.filter(r => r.price > 100);
    const groups = new Map<string, { sum: number; count: number }>();
    for (const r of filtered) {
      let g = groups.get(r.category);
      if (!g) { g = { sum: 0, count: 0 }; groups.set(r.category, g); }
      g.sum += r.price; g.count++;
    }
    return Array.from(groups, ([category, g]) => ({ category, n: g.count, avg: g.sum / g.count })).sort((a, b) => b.avg - a.avg);
  }, { iterations: iters }));

  // ── Compile overhead ────────────────────────────────────────────────────
  onProgress?.('Benchmarking compile overhead...');
  results.push(bench('Compile overhead', 'PipeQuery', () =>
    compile('items | where(price > 100) | groupBy(category) | select(category, count() as n, avg(price) as avg) | sort(avg desc)', false),
    { iterations: iters }
  ));

  return {
    label: `${size.toLocaleString()} rows`,
    size,
    results,
    totalMs: Math.round(performance.now() - start),
  };
}
