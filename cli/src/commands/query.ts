import chalk from 'chalk';
import { getServerUrl } from '../utils/server-discovery.js';
import { log } from '../utils/logger.js';

export async function queryCommand(expression: string, opts: { format?: string }) {
  const serverUrl = await getServerUrl();

  const res = await fetch(`${serverUrl}/api/_control/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: expression }),
  });

  const json = await res.json() as { ok: boolean; result?: unknown; error?: string };
  if (!json.ok) {
    log.error(json.error ?? 'Query failed');
    process.exit(1);
  }

  const result = json.result;

  if (opts.format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Render as table
  if (Array.isArray(result) && result.length > 0 && typeof result[0] === 'object') {
    renderTable(result as Record<string, unknown>[]);
  } else if (typeof result === 'object' && result !== null && !Array.isArray(result)) {
    renderTable([result as Record<string, unknown>]);
  } else {
    console.log(result);
  }
}

function renderTable(rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    log.dim('(empty result)');
    return;
  }

  const columns = Object.keys(rows[0]);
  const widths = columns.map((col) => {
    const maxData = rows.reduce((max, row) => Math.max(max, formatCell(row[col]).length), 0);
    return Math.max(col.length, maxData);
  });

  // Header
  const header = columns.map((col, i) => chalk.hex('#06b6d4').bold(col.padEnd(widths[i]))).join('  ');
  const separator = widths.map((w) => chalk.dim('─'.repeat(w))).join(chalk.dim('──'));

  console.log();
  console.log(`  ${header}`);
  console.log(`  ${separator}`);

  // Rows
  for (const row of rows) {
    const line = columns
      .map((col, i) => {
        const val = formatCell(row[col]);
        return typeof row[col] === 'number'
          ? chalk.hex('#f59e0b')(val.padStart(widths[i]))
          : val.padEnd(widths[i]);
      })
      .join('  ');
    console.log(`  ${line}`);
  }

  console.log();
  console.log(chalk.dim(`  ${rows.length} row(s)`));
  console.log();
}

function formatCell(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return String(value);
}
