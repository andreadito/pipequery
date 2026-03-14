import { createInterface } from 'node:readline';
import { spawnSync } from 'node:child_process';
import chalk from 'chalk';
import { printCompactBanner } from '../utils/banner.js';
import { log } from '../utils/logger.js';
import { getServerUrl } from '../utils/server-discovery.js';

const COMMANDS: Record<string, string> = {
  help: 'Show available commands',
  serve: 'Start the server (serve -d for daemon, serve --stop to stop)',
  query: 'Run a PipeQuery expression (e.g. query products | first(5))',
  sources: 'List data sources',
  endpoints: 'List API endpoints',
  status: 'Show server status',
  dashboard: 'Launch the interactive TUI dashboard',
  monitor: 'Launch the live server monitor',
  clear: 'Clear the screen',
  exit: 'Exit the REPL',
};

export async function startRepl() {
  printCompactBanner();

  let serverUrl: string | null = null;
  try {
    serverUrl = await getServerUrl();
    log.success(`Connected to server at ${chalk.white.bold(serverUrl)}`);
  } catch {
    log.warn('No running server found. Start one with: pq serve');
  }
  console.log(chalk.dim('  Type "help" for available commands, "exit" to quit.\n'));

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.hex('#06b6d4').bold('  pq > '),
    terminal: true,
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    const [cmd, ...rest] = input.split(/\s+/);
    const args = rest.join(' ');

    try {
      switch (cmd) {
        case 'help':
          console.log();
          for (const [name, desc] of Object.entries(COMMANDS)) {
            console.log(`  ${chalk.hex('#06b6d4')(name.padEnd(12))} ${chalk.dim(desc)}`);
          }
          console.log();
          break;

        case 'query':
        case 'q':
          if (!args) {
            log.warn('Usage: query <expression>');
            break;
          }
          if (!serverUrl) {
            log.error('No server running. Start one with: pq serve');
            break;
          }
          await runQuery(serverUrl, args);
          break;

        case 'sources':
          if (!serverUrl) { log.error('No server running.'); break; }
          await fetchAndPrint(serverUrl, '/api/_control/sources', 'sources');
          break;

        case 'endpoints':
          if (!serverUrl) { log.error('No server running.'); break; }
          await fetchAndPrint(serverUrl, '/api/_control/endpoints', 'endpoints');
          break;

        case 'status':
          if (!serverUrl) { log.error('No server running.'); break; }
          await fetchAndPrint(serverUrl, '/status', null);
          break;

        case 'serve': {
          const serveArgs = ['serve'];
          if (args) serveArgs.push(...args.split(/\s+/));
          rl.pause();
          spawnSync(process.execPath, [process.argv[1], ...serveArgs], {
            cwd: process.cwd(),
            stdio: 'inherit',
          });
          // Re-check server connection after serve
          try {
            serverUrl = await getServerUrl();
            log.success(`Connected to server at ${chalk.white.bold(serverUrl)}`);
          } catch { /* server may not be running */ }
          rl.resume();
          break;
        }

        case 'dashboard':
          rl.pause();
          spawnSync(process.execPath, [process.argv[1], 'dashboard', '-n', args || 'main'], {
            cwd: process.cwd(),
            stdio: 'inherit',
          });
          rl.resume();
          break;

        case 'monitor':
          rl.pause();
          spawnSync(process.execPath, [process.argv[1], 'monitor'], {
            cwd: process.cwd(),
            stdio: 'inherit',
          });
          rl.resume();
          break;

        case 'clear':
          process.stdout.write('\x1B[2J\x1B[H');
          printCompactBanner();
          break;

        case 'exit':
        case 'quit':
          console.log(chalk.dim('  Goodbye.\n'));
          rl.close();
          process.exit(0);
          break;

        default:
          log.warn(`Unknown command: ${cmd}. Type "help" for available commands.`);
      }
    } catch (err) {
      log.error(err instanceof Error ? err.message : String(err));
    }

    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });
}

async function runQuery(serverUrl: string, expression: string) {
  const res = await fetch(`${serverUrl}/api/_control/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: expression }),
  });

  const json = (await res.json()) as { ok: boolean; result?: unknown; error?: string };
  if (!json.ok) {
    log.error(json.error ?? 'Query failed');
    return;
  }

  const result = json.result;
  if (Array.isArray(result) && result.length > 0 && typeof result[0] === 'object') {
    printTable(result as Record<string, unknown>[]);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

function printTable(rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    log.dim('(empty result)');
    return;
  }

  const columns = Object.keys(rows[0]);
  const widths = columns.map((col) => {
    const maxData = rows.reduce((max, row) => Math.max(max, formatCell(row[col]).length), 0);
    return Math.max(col.length, maxData);
  });

  const header = columns.map((col, i) => chalk.hex('#06b6d4').bold(col.padEnd(widths[i]))).join('  ');
  const separator = widths.map((w) => chalk.dim('─'.repeat(w))).join(chalk.dim('──'));

  console.log();
  console.log(`  ${header}`);
  console.log(`  ${separator}`);

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
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return String(value);
}

async function fetchAndPrint(serverUrl: string, path: string, key: string | null) {
  const res = await fetch(`${serverUrl}${path}`);
  const json = await res.json();
  const data = key ? (json as Record<string, unknown>)[key] : json;
  console.log();
  console.log(JSON.stringify(data, null, 2));
  console.log();
}
