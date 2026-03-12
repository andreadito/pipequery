import type { DataContext } from '../../../src/engine/index.ts';

export const DATASETS: Record<string, { label: string; context: DataContext }> = {
  products: {
    label: 'Products',
    context: {
      items: [
        { id: 1, name: 'Laptop', category: 'Electronics', price: 999.99, stock: 45, active: true },
        { id: 2, name: 'Mouse', category: 'Electronics', price: 29.99, stock: 300, active: true },
        { id: 3, name: 'Keyboard', category: 'Electronics', price: 79.99, stock: 180, active: true },
        { id: 4, name: 'Monitor', category: 'Electronics', price: 549.00, stock: 60, active: true },
        { id: 5, name: 'Desk Chair', category: 'Furniture', price: 349.00, stock: 25, active: true },
        { id: 6, name: 'Standing Desk', category: 'Furniture', price: 699.00, stock: 15, active: true },
        { id: 7, name: 'Notebook', category: 'Office', price: 12.99, stock: 500, active: true },
        { id: 8, name: 'Pen Set', category: 'Office', price: 8.99, stock: 200, active: true },
        { id: 9, name: 'Webcam', category: 'Electronics', price: 89.99, stock: 0, active: false },
        { id: 10, name: 'USB Hub', category: 'Electronics', price: 39.99, stock: 120, active: true },
        { id: 11, name: 'Bookshelf', category: 'Furniture', price: 199.00, stock: 30, active: true },
        { id: 12, name: 'Lamp', category: 'Furniture', price: 59.99, stock: 80, active: true },
        { id: 13, name: 'Stapler', category: 'Office', price: 6.99, stock: 400, active: false },
        { id: 14, name: 'Headphones', category: 'Electronics', price: 199.99, stock: 75, active: true },
        { id: 15, name: 'Whiteboard', category: 'Office', price: 89.00, stock: 20, active: true },
      ],
    },
  },
  orders: {
    label: 'Orders + Customers',
    context: {
      orders: [
        { orderId: 'ORD-001', customerId: 'C1', total: 150.00, status: 'shipped', date: '2025-01-15' },
        { orderId: 'ORD-002', customerId: 'C2', total: 89.99, status: 'delivered', date: '2025-01-20' },
        { orderId: 'ORD-003', customerId: 'C1', total: 320.00, status: 'shipped', date: '2025-02-01' },
        { orderId: 'ORD-004', customerId: 'C3', total: 45.00, status: 'pending', date: '2025-02-10' },
        { orderId: 'ORD-005', customerId: 'C2', total: 210.50, status: 'delivered', date: '2025-02-15' },
        { orderId: 'ORD-006', customerId: 'C4', total: 75.00, status: 'cancelled', date: '2025-03-01' },
        { orderId: 'ORD-007', customerId: 'C1', total: 550.00, status: 'delivered', date: '2025-03-05' },
        { orderId: 'ORD-008', customerId: 'C3', total: 130.00, status: 'shipped', date: '2025-03-12' },
      ],
      customers: [
        { id: 'C1', name: 'Alice', city: 'NYC', tier: 'gold' },
        { id: 'C2', name: 'Bob', city: 'LA', tier: 'silver' },
        { id: 'C3', name: 'Charlie', city: 'NYC', tier: 'bronze' },
        { id: 'C4', name: 'Diana', city: 'Chicago', tier: 'silver' },
      ],
    },
  },
  employees: {
    label: 'Employees (nested)',
    context: {
      users: [
        { id: 1, name: 'John', department: 'Engineering', salary: 120000, address: { city: 'NYC', state: 'NY' } },
        { id: 2, name: 'Sarah', department: 'Engineering', salary: 135000, address: { city: 'SF', state: 'CA' } },
        { id: 3, name: 'Mike', department: 'Marketing', salary: 95000, address: { city: 'NYC', state: 'NY' } },
        { id: 4, name: 'Emily', department: 'Engineering', salary: 145000, address: { city: 'Seattle', state: 'WA' } },
        { id: 5, name: 'David', department: 'Sales', salary: 88000, address: { city: 'LA', state: 'CA' } },
        { id: 6, name: 'Lisa', department: 'Marketing', salary: 102000, address: { city: 'Chicago', state: 'IL' } },
        { id: 7, name: 'James', department: 'Sales', salary: 92000, address: { city: 'NYC', state: 'NY' } },
        { id: 8, name: 'Anna', department: 'Engineering', salary: 155000, address: { city: 'SF', state: 'CA' } },
      ],
    },
  },
  trades: {
    label: 'Trades (finance)',
    context: {
      trades: [
        { symbol: 'AAPL', price: 185.20, volume: 12000, return: 0.012, sector: 'Tech', date: '2025-01-02' },
        { symbol: 'AAPL', price: 187.50, volume: 15000, return: 0.008, sector: 'Tech', date: '2025-01-03' },
        { symbol: 'AAPL', price: 183.10, volume: 18000, return: -0.023, sector: 'Tech', date: '2025-01-06' },
        { symbol: 'AAPL', price: 186.40, volume: 11000, return: 0.018, sector: 'Tech', date: '2025-01-07' },
        { symbol: 'AAPL', price: 190.00, volume: 20000, return: 0.019, sector: 'Tech', date: '2025-01-08' },
        { symbol: 'GOOG', price: 142.30, volume: 8000, return: -0.005, sector: 'Tech', date: '2025-01-02' },
        { symbol: 'GOOG', price: 145.00, volume: 9500, return: 0.019, sector: 'Tech', date: '2025-01-03' },
        { symbol: 'GOOG', price: 141.80, volume: 11000, return: -0.022, sector: 'Tech', date: '2025-01-06' },
        { symbol: 'GOOG', price: 143.60, volume: 7500, return: 0.013, sector: 'Tech', date: '2025-01-07' },
        { symbol: 'GOOG', price: 146.20, volume: 10000, return: 0.018, sector: 'Tech', date: '2025-01-08' },
        { symbol: 'JPM', price: 198.50, volume: 6000, return: 0.007, sector: 'Finance', date: '2025-01-02' },
        { symbol: 'JPM', price: 195.20, volume: 7200, return: -0.017, sector: 'Finance', date: '2025-01-03' },
        { symbol: 'JPM', price: 197.80, volume: 5500, return: 0.013, sector: 'Finance', date: '2025-01-06' },
        { symbol: 'JPM', price: 200.10, volume: 8000, return: 0.012, sector: 'Finance', date: '2025-01-07' },
        { symbol: 'JPM', price: 196.90, volume: 6800, return: -0.016, sector: 'Finance', date: '2025-01-08' },
        { symbol: 'XOM', price: 104.30, volume: 9000, return: -0.008, sector: 'Energy', date: '2025-01-02' },
        { symbol: 'XOM', price: 106.50, volume: 10500, return: 0.021, sector: 'Energy', date: '2025-01-03' },
        { symbol: 'XOM', price: 103.80, volume: 12000, return: -0.025, sector: 'Energy', date: '2025-01-06' },
        { symbol: 'XOM', price: 105.90, volume: 8500, return: 0.020, sector: 'Energy', date: '2025-01-07' },
        { symbol: 'XOM', price: 107.20, volume: 11000, return: 0.012, sector: 'Energy', date: '2025-01-08' },
      ],
      benchmark: [
        { date: '2025-01-02', return: 0.003 },
        { date: '2025-01-03', return: 0.005 },
        { date: '2025-01-06', return: -0.012 },
        { date: '2025-01-07', return: 0.010 },
        { date: '2025-01-08', return: 0.008 },
      ],
    },
  },
  sales: {
    label: 'Sales (rollup/pivot)',
    context: {
      sales: [
        { region: 'East', category: 'Electronics', product: 'Laptop', quarter: 'Q1', revenue: 15000, units: 10 },
        { region: 'East', category: 'Electronics', product: 'Phone', quarter: 'Q1', revenue: 8000, units: 20 },
        { region: 'East', category: 'Furniture', product: 'Desk', quarter: 'Q1', revenue: 5000, units: 8 },
        { region: 'East', category: 'Electronics', product: 'Laptop', quarter: 'Q2', revenue: 18000, units: 12 },
        { region: 'East', category: 'Furniture', product: 'Chair', quarter: 'Q2', revenue: 3500, units: 7 },
        { region: 'West', category: 'Electronics', product: 'Laptop', quarter: 'Q1', revenue: 22000, units: 15 },
        { region: 'West', category: 'Electronics', product: 'Phone', quarter: 'Q1', revenue: 12000, units: 30 },
        { region: 'West', category: 'Furniture', product: 'Desk', quarter: 'Q1', revenue: 7000, units: 10 },
        { region: 'West', category: 'Electronics', product: 'Phone', quarter: 'Q2', revenue: 14000, units: 35 },
        { region: 'West', category: 'Furniture', product: 'Chair', quarter: 'Q2', revenue: 4200, units: 6 },
        { region: 'North', category: 'Electronics', product: 'Laptop', quarter: 'Q1', revenue: 9000, units: 6 },
        { region: 'North', category: 'Furniture', product: 'Desk', quarter: 'Q2', revenue: 3000, units: 5 },
      ],
    },
  },
};

// ─── Stress Test Generator (lazy, 100k rows) ──────────────────────────────

const STRESS_CATEGORIES = ['Electronics', 'Furniture', 'Office', 'Kitchen', 'Garden', 'Sports', 'Books', 'Clothing'];
const STRESS_STATUSES = ['active', 'inactive', 'discontinued'];

function generateStressData(rowCount: number): DataContext {
  const items: Record<string, unknown>[] = [];
  const categories: Record<string, unknown>[] = STRESS_CATEGORIES.map((name, i) => ({
    catId: i + 1,
    catName: name,
    taxRate: 0.05 + (i % 4) * 0.025,
  }));

  for (let i = 0; i < rowCount; i++) {
    items.push({
      id: i + 1,
      name: `Product_${i + 1}`,
      category: STRESS_CATEGORIES[i % STRESS_CATEGORIES.length],
      catId: (i % STRESS_CATEGORIES.length) + 1,
      price: Math.round((10 + Math.random() * 990) * 100) / 100,
      stock: Math.floor(Math.random() * 1000),
      status: STRESS_STATUSES[i % STRESS_STATUSES.length],
      rating: Math.round((1 + Math.random() * 4) * 10) / 10,
    });
  }

  return { items, categories };
}

let stressDataCache: DataContext | null = null;

Object.defineProperty(DATASETS, 'stress', {
  enumerable: true,
  configurable: false,
  get() {
    return {
      label: 'Stress Test (100k)',
      get context() {
        if (!stressDataCache) stressDataCache = generateStressData(100_000);
        return stressDataCache;
      },
    };
  },
});

export const EXAMPLE_QUERIES: Array<{ label: string; dataset: string; query: string }> = [
  { label: 'Filter expensive', dataset: 'products', query: 'items | where(price > 100)' },
  { label: 'Sort + limit', dataset: 'products', query: 'items | sort(price desc) | first(5)' },
  { label: 'Select fields', dataset: 'products', query: 'items | where(active == true) | select(name, price, category)' },
  { label: 'Group + aggregate', dataset: 'products', query: 'items | groupBy(category) | select(category, sum(price) as total, count() as n, avg(price) as avgPrice)' },
  { label: 'Join', dataset: 'orders', query: 'orders | join(customers, customerId == id) | select(orderId, name, total, city)' },
  { label: 'Nested access', dataset: 'employees', query: 'users | where(address.city == "NYC") | select(name, department, salary)' },
  { label: 'Conditional', dataset: 'products', query: 'items | select(name, price, if(price > 100, "premium", "standard") as tier)' },
  { label: 'Aggregate', dataset: 'employees', query: 'users | groupBy(department) | select(department, count() as headcount, avg(salary) as avgSalary, max(salary) as topSalary)' },
  { label: 'Rollup', dataset: 'sales', query: 'sales | rollup(region, category, sum(revenue) as total, count() as n)' },
  { label: 'Pivot', dataset: 'sales', query: 'sales | pivot(quarter, sum(revenue))' },
  { label: 'Pivot (grouped)', dataset: 'sales', query: 'sales | groupBy(region) | pivot(category, sum(revenue))' },
  { label: 'Transpose', dataset: 'products', query: 'items | sort(price desc) | first(4) | select(name, price, stock) | transpose(name)' },
  { label: 'Running total', dataset: 'products', query: 'items | sort(price) | select(name, price, running_sum(price) as cum, row_number() as rowNum)' },
  { label: 'Lag', dataset: 'products', query: 'items | sort(price) | select(name, price, lag(price) as prevPrice)' },
  { label: 'Map', dataset: 'products', query: 'items | map(price * 1.1 as priceWithTax, price > 100 as premium)' },
  { label: 'Reduce', dataset: 'products', query: 'items | where(active == true) | reduce(0, _acc + price)' },
  // ─── Finance aggregates ────────────────────────────────────────────────────
  { label: 'VWAP', dataset: 'trades', query: 'trades | groupBy(symbol) | select(symbol, vwap(price, volume) as vwap)' },
  { label: 'Price stats', dataset: 'trades', query: 'trades | groupBy(symbol) | select(symbol, avg(price) as mean, median(price) as med, stddev(price) as vol, percentile(price, 75) as p75)' },
  { label: 'Sharpe & Sortino', dataset: 'trades', query: 'trades | groupBy(symbol) | select(symbol, sharpe(return) as sharpe, sortino(return) as sortino, calmar(return) as calmar)' },
  { label: 'Drawdown', dataset: 'trades', query: 'trades | groupBy(symbol) | select(symbol, drawdown(price) as maxDD, min(price) as low, max(price) as high)' },
  { label: 'Revenue share %', dataset: 'sales', query: 'sales | groupBy(region) | select(region, sum(revenue) as total, pct(revenue) as share)' },
  { label: 'Distribution', dataset: 'trades', query: 'trades | groupBy(symbol) | select(symbol, skew(return) as skew, kurt(return) as kurt, var(return) as variance)' },
  { label: 'Weighted avg', dataset: 'trades', query: 'trades | groupBy(sector) | select(sector, wavg(price, volume) as wAvgPrice, sum(volume) as totalVol)' },
  { label: 'Counting', dataset: 'trades', query: 'trades | groupBy(sector) | select(sector, count() as n, distinct_count(symbol) as symbols, first_value(date) as firstDate, last_value(date) as lastDate)' },
  { label: 'Standalone median', dataset: 'products', query: 'items | median(price)' },
  { label: 'Standalone percentile', dataset: 'products', query: 'items | percentile(price, 90)' },
  { label: 'Rollup + finance', dataset: 'trades', query: 'trades | rollup(sector, symbol, avg(return) as avgRet, stddev(return) as vol, count() as n)' },
  // ─── Stress tests ─────────────────────────────────────────────────────────
  { label: 'Stress: filter', dataset: 'stress', query: 'items | where(price > 500)' },
  { label: 'Stress: sort', dataset: 'stress', query: 'items | sort(price desc) | first(20)' },
  { label: 'Stress: group', dataset: 'stress', query: 'items | groupBy(category) | select(category, count() as n, avg(price) as avgPrice, sum(stock) as totalStock)' },
  { label: 'Stress: join', dataset: 'stress', query: 'items | join(categories, catId == catId) | first(20)' },
  { label: 'Stress: pipeline', dataset: 'stress', query: 'items | where(price > 100) | groupBy(category) | select(category, count() as n, avg(price) as avg) | sort(avg desc)' },
];
