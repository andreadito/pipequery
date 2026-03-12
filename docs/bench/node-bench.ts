#!/usr/bin/env npx tsx
/**
 * PipeQuery Node.js Benchmark Suite
 *
 * Compares PipeQuery against:
 *   - Native Array methods (map/filter/sort/reduce)
 *   - lodash-es (chain/fp)
 *   - alasql (SQL-in-JS)
 *
 * Usage: npx tsx bench/node-bench.ts
 */

import { generateData, generateJoinTable, bench, type BenchResult } from './data.ts';
import { query, compile } from '../../src/engine/index.ts';
import _ from 'lodash-es';
import alasql from 'alasql';

// ─── Data setup ─────────────────────────────────────────────────────────────

const SIZES = [1_000, 10_000, 100_000];

function printTable(results: BenchResult[]) {
  // Group by benchmark name
  const grouped = new Map<string, BenchResult[]>();
  for (const r of results) {
    const arr = grouped.get(r.name) ?? [];
    arr.push(r);
    grouped.set(r.name, arr);
  }

  for (const [name, group] of grouped) {
    console.log(`\n  ${name}`);
    console.log('  ' + '-'.repeat(76));
    console.log(
      '  ' +
      'Library'.padEnd(18) +
      'Median'.padStart(10) +
      'p95'.padStart(10) +
      'Min'.padStart(10) +
      'Max'.padStart(10) +
      'Ops/s'.padStart(10)
    );
    console.log('  ' + '-'.repeat(76));
    for (const r of group) {
      console.log(
        '  ' +
        r.library.padEnd(18) +
        `${r.medianMs}ms`.padStart(10) +
        `${r.p95Ms}ms`.padStart(10) +
        `${r.minMs}ms`.padStart(10) +
        `${r.maxMs}ms`.padStart(10) +
        `${r.ops}`.padStart(10)
      );
    }
  }
}

// ─── Benchmarks per dataset size ────────────────────────────────────────────

for (const size of SIZES) {
  const data = generateData(size);
  const joinTable = generateJoinTable();
  const ctx = { items: data, categories: joinTable };

  console.log(`\n${'═'.repeat(80)}`);
  console.log(`  DATASET: ${size.toLocaleString()} rows`);
  console.log(`${'═'.repeat(80)}`);

  const results: BenchResult[] = [];

  // ── 1. Filter: price > 500 ──────────────────────────────────────────────

  const filterCompiled = compile('items | where(price > 500)');

  results.push(bench('Filter (price > 500)', 'PipeQuery', () => query(ctx, 'items | where(price > 500)')));
  results.push(bench('Filter (price > 500)', 'PQ (compiled)', () => filterCompiled(ctx)));
  results.push(bench('Filter (price > 500)', 'Native JS', () => data.filter(r => r.price > 500)));
  results.push(bench('Filter (price > 500)', 'lodash', () => _.filter(data, r => r.price > 500)));
  results.push(bench('Filter (price > 500)', 'alasql', () => alasql('SELECT * FROM ? WHERE price > 500', [data])));

  // ── 2. Sort: price desc ─────────────────────────────────────────────────

  const sortCompiled = compile('items | sort(price desc)');

  results.push(bench('Sort (price desc)', 'PipeQuery', () => query(ctx, 'items | sort(price desc)')));
  results.push(bench('Sort (price desc)', 'PQ (compiled)', () => sortCompiled(ctx)));
  results.push(bench('Sort (price desc)', 'Native JS', () => [...data].sort((a, b) => b.price - a.price)));
  results.push(bench('Sort (price desc)', 'lodash', () => _.orderBy(data, ['price'], ['desc'])));
  results.push(bench('Sort (price desc)', 'alasql', () => alasql('SELECT * FROM ? ORDER BY price DESC', [data])));

  // ── 3. Group + Aggregate ────────────────────────────────────────────────

  const groupCompiled = compile('items | groupBy(category) | select(category, count() as n, avg(price) as avgPrice)');

  results.push(bench('GroupBy + Aggregate', 'PipeQuery', () =>
    query(ctx, 'items | groupBy(category) | select(category, count() as n, avg(price) as avgPrice)')
  ));
  results.push(bench('GroupBy + Aggregate', 'PQ (compiled)', () => groupCompiled(ctx)));
  results.push(bench('GroupBy + Aggregate', 'Native JS', () => {
    const groups = new Map<string, { sum: number; count: number }>();
    for (const r of data) {
      let g = groups.get(r.category);
      if (!g) { g = { sum: 0, count: 0 }; groups.set(r.category, g); }
      g.sum += r.price;
      g.count++;
    }
    return Array.from(groups, ([category, g]) => ({
      category, n: g.count, avgPrice: g.sum / g.count,
    }));
  }));
  results.push(bench('GroupBy + Aggregate', 'lodash', () => {
    const grouped = _.groupBy(data, 'category');
    return Object.entries(grouped).map(([category, rows]) => ({
      category,
      n: rows.length,
      avgPrice: _.meanBy(rows, 'price'),
    }));
  }));
  results.push(bench('GroupBy + Aggregate', 'alasql', () =>
    alasql('SELECT category, COUNT(*) as n, AVG(price) as avgPrice FROM ? GROUP BY category', [data])
  ));

  // ── 4. Multi-step pipeline ──────────────────────────────────────────────

  const pipelineCompiled = compile('items | where(price > 100) | groupBy(category) | select(category, count() as n, avg(price) as avg) | sort(avg desc)');

  results.push(bench('Pipeline (filter→group→sort)', 'PipeQuery', () =>
    query(ctx, 'items | where(price > 100) | groupBy(category) | select(category, count() as n, avg(price) as avg) | sort(avg desc)')
  ));
  results.push(bench('Pipeline (filter→group→sort)', 'PQ (compiled)', () => pipelineCompiled(ctx)));
  results.push(bench('Pipeline (filter→group→sort)', 'Native JS', () => {
    const filtered = data.filter(r => r.price > 100);
    const groups = new Map<string, { sum: number; count: number }>();
    for (const r of filtered) {
      let g = groups.get(r.category);
      if (!g) { g = { sum: 0, count: 0 }; groups.set(r.category, g); }
      g.sum += r.price;
      g.count++;
    }
    return Array.from(groups, ([category, g]) => ({
      category, n: g.count, avg: g.sum / g.count,
    })).sort((a, b) => b.avg - a.avg);
  }));
  results.push(bench('Pipeline (filter→group→sort)', 'lodash', () => {
    const filtered = _.filter(data, r => r.price > 100);
    const grouped = _.groupBy(filtered, 'category');
    return _.orderBy(
      Object.entries(grouped).map(([category, rows]) => ({
        category, n: rows.length, avg: _.meanBy(rows, 'price'),
      })),
      ['avg'], ['desc']
    );
  }));
  results.push(bench('Pipeline (filter→group→sort)', 'alasql', () =>
    alasql('SELECT category, COUNT(*) as n, AVG(price) as avgP FROM ? WHERE price > 100 GROUP BY category ORDER BY avgP DESC', [data])
  ));

  // ── 5. Select + Transform ──────────────────────────────────────────────

  const selectCompiled = compile('items | select(name, price, price * 1.1 as priceWithTax) | first(100)');

  results.push(bench('Select + first(100)', 'PipeQuery', () =>
    query(ctx, 'items | select(name, price, price * 1.1 as priceWithTax) | first(100)')
  ));
  results.push(bench('Select + first(100)', 'PQ (compiled)', () => selectCompiled(ctx)));
  results.push(bench('Select + first(100)', 'Native JS', () =>
    data.slice(0, 100).map(r => ({ name: r.name, price: r.price, priceWithTax: r.price * 1.1 }))
  ));
  results.push(bench('Select + first(100)', 'lodash', () =>
    _.take(data, 100).map(r => ({ name: r.name, price: r.price, priceWithTax: r.price * 1.1 }))
  ));
  results.push(bench('Select + first(100)', 'alasql', () =>
    alasql('SELECT TOP 100 name, price, price * 1.1 as priceWithTax FROM ?', [data])
  ));

  // ── 6. Join ────────────────────────────────────────────────────────────

  // Build category→index mapping for native join
  const catMap = new Map(joinTable.map(c => [c.catName, c]));
  const catNameToId = new Map(joinTable.map(c => [c.catName, c.catId]));

  // Give PipeQuery rows a catId for equi-join
  const dataWithCatId = data.map((r) => ({
    ...r,
    catId: catNameToId.get(r.category) ?? 0,
  }));
  const ctxJoin = { items: dataWithCatId, categories: joinTable };
  const joinCompiled = compile('items | join(categories, catId == catId) | first(20)');

  results.push(bench('Join + first(20)', 'PipeQuery', () =>
    query(ctxJoin, 'items | join(categories, catId == catId) | first(20)')
  ));
  results.push(bench('Join + first(20)', 'PQ (compiled)', () => joinCompiled(ctxJoin)));
  results.push(bench('Join + first(20)', 'Native JS', () => {
    const result = [];
    for (const r of dataWithCatId) {
      const cat = joinTable.find(c => c.catId === r.catId);
      if (cat) {
        result.push({ ...r, ...cat });
        if (result.length >= 20) break;
      }
    }
    return result;
  }));
  results.push(bench('Join + first(20)', 'lodash', () => {
    const catIndex = _.keyBy(joinTable, 'catId');
    const result = [];
    for (const r of dataWithCatId) {
      const cat = catIndex[r.catId];
      if (cat) {
        result.push({ ...r, ...cat });
        if (result.length >= 20) break;
      }
    }
    return result;
  }));
  results.push(bench('Join + first(20)', 'alasql', () =>
    alasql('SELECT TOP 20 a.*, b.* FROM ? a JOIN ? b ON a.catId = b.catId', [dataWithCatId, joinTable])
  ));

  // ── 7. Compilation overhead (one-shot) ──────────────────────────────────

  results.push(bench('Compile overhead (parse+compile)', 'PipeQuery', () =>
    compile('items | where(price > 100) | groupBy(category) | select(category, count() as n, avg(price) as avg) | sort(avg desc)', false)
  ));

  printTable(results);
}

console.log('\nDone.');
