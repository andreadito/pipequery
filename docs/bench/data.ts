// ─── Shared benchmark data generators ───────────────────────────────────────

export interface BenchRow {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  rating: number;
  status: string;
  region: string;
}

const CATEGORIES = ['Electronics', 'Furniture', 'Office', 'Kitchen', 'Garden', 'Sports', 'Books', 'Clothing'];
const STATUSES = ['active', 'inactive', 'discontinued'];
const REGIONS = ['East', 'West', 'North', 'South', 'Central'];

// Seeded PRNG for reproducible benchmarks
function mulberry32(seed: number) {
  return () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function generateData(n: number): BenchRow[] {
  const rng = mulberry32(42);
  const rows: BenchRow[] = [];
  for (let i = 0; i < n; i++) {
    rows.push({
      id: i + 1,
      name: `Product_${i + 1}`,
      category: CATEGORIES[Math.floor(rng() * CATEGORIES.length)],
      price: Math.round((10 + rng() * 990) * 100) / 100,
      stock: Math.floor(rng() * 1000),
      rating: Math.round((1 + rng() * 4) * 10) / 10,
      status: STATUSES[Math.floor(rng() * STATUSES.length)],
      region: REGIONS[Math.floor(rng() * REGIONS.length)],
    });
  }
  return rows;
}

export interface JoinRow {
  catId: number;
  catName: string;
  taxRate: number;
}

export function generateJoinTable(): JoinRow[] {
  return CATEGORIES.map((name, i) => ({
    catId: i,
    catName: name,
    taxRate: 0.05 + (i % 4) * 0.025,
  }));
}

// ─── Benchmark harness ──────────────────────────────────────────────────────

export interface BenchResult {
  name: string;
  library: string;
  ops: number;
  medianMs: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
}

export function bench(
  name: string,
  library: string,
  fn: () => unknown,
  { warmup = 5, iterations = 50 }: { warmup?: number; iterations?: number } = {},
): BenchResult {
  // Warmup
  for (let i = 0; i < warmup; i++) fn();

  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }

  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  const p95 = times[Math.floor(times.length * 0.95)];

  return {
    name,
    library,
    ops: Math.round(1000 / median),
    medianMs: Math.round(median * 100) / 100,
    p95Ms: Math.round(p95 * 100) / 100,
    minMs: Math.round(times[0] * 100) / 100,
    maxMs: Math.round(times[times.length - 1] * 100) / 100,
  };
}
