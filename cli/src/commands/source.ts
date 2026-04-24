import chalk from 'chalk';
import { loadConfig, saveConfig } from '../config/loader.js';
import { getServerUrl } from '../utils/server-discovery.js';
import { log } from '../utils/logger.js';
import type { SourceConfig } from '../config/schema.js';

export async function sourceListCommand() {
  const cwd = process.cwd();

  // Try live server first, fall back to config
  try {
    const serverUrl = await getServerUrl();
    const res = await fetch(`${serverUrl}/api/_control/sources`);
    const statuses = await res.json() as Record<string, { healthy: boolean; rowCount: number; lastFetch: string | null; error?: string }>;

    if (Object.keys(statuses).length === 0) {
      log.dim('No sources configured. Add one with: pq source add <name>');
      return;
    }

    console.log(chalk.bold('Sources:\n'));
    for (const [name, status] of Object.entries(statuses)) {
      const icon = status.healthy ? chalk.green('●') : chalk.red('●');
      const rows = chalk.dim(`${status.rowCount} rows`);
      const err = status.error ? chalk.red(` (${status.error})`) : '';
      console.log(`  ${icon} ${chalk.bold(name)}  ${rows}${err}`);
    }
  } catch {
    // Server not running — read from config
    const { config } = await loadConfig(cwd);
    const sources = Object.entries(config.sources);

    if (sources.length === 0) {
      log.dim('No sources configured. Add one with: pq source add <name>');
      return;
    }

    console.log(chalk.bold('Sources (server not running):\n'));
    for (const [name, src] of sources) {
      const type = chalk.cyan(src.type);
      const detail = 'url' in src ? chalk.dim(src.url) : 'path' in src ? chalk.dim(src.path) : '';
      console.log(`  ○ ${chalk.bold(name)}  ${type}  ${detail}`);
    }
  }
}

export async function sourceAddCommand(name: string, opts: {
  type: string;
  url?: string;
  interval?: string;
  dataPath?: string;
  path?: string;
  watch?: boolean;
  query?: string;
  ssl?: string;
  maxRows?: string;
}) {
  const cwd = process.cwd();
  const { config, path: configPath } = await loadConfig(cwd);

  let sourceConfig: SourceConfig;

  switch (opts.type) {
    case 'rest':
      if (!opts.url) throw new Error('--url is required for REST sources');
      sourceConfig = {
        type: 'rest',
        url: opts.url,
        interval: opts.interval ?? '30s',
        ...(opts.dataPath ? { dataPath: opts.dataPath } : {}),
      };
      break;
    case 'websocket':
      if (!opts.url) throw new Error('--url is required for WebSocket sources');
      sourceConfig = { type: 'websocket', url: opts.url };
      break;
    case 'file':
      if (!opts.path) throw new Error('--path is required for file sources');
      sourceConfig = {
        type: 'file',
        path: opts.path,
        ...(opts.watch ? { watch: true } : {}),
      };
      break;
    case 'postgres':
      if (!opts.url) throw new Error('--url is required for Postgres sources');
      if (!opts.query) throw new Error('--query is required for Postgres sources');
      sourceConfig = {
        type: 'postgres',
        url: opts.url,
        query: opts.query,
        interval: opts.interval ?? '30s',
        ...(opts.ssl === 'no-verify' ? { ssl: 'no-verify' as const } : {}),
        ...(opts.ssl === 'false' ? { ssl: false as const } : {}),
        ...(opts.maxRows ? { maxRows: Number.parseInt(opts.maxRows, 10) } : {}),
      };
      break;
    default:
      throw new Error(`Unknown source type: ${opts.type}. Use: rest, websocket, file, postgres`);
  }

  // Save to config
  config.sources[name] = sourceConfig;
  await saveConfig(config, configPath);

  // If server is running, hot-add the source
  try {
    const serverUrl = await getServerUrl();
    const res = await fetch(`${serverUrl}/api/_control/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, config: sourceConfig }),
    });
    const json = await res.json() as { ok: boolean; status?: { rowCount: number } };
    if (json.ok) {
      log.success(`Source "${name}" added and live (${json.status?.rowCount ?? 0} rows)`);
      return;
    }
  } catch {
    // Server not running
  }

  log.success(`Source "${name}" added to config. Start server with: pq serve`);
}

export async function sourceRemoveCommand(name: string) {
  const cwd = process.cwd();
  const { config, path: configPath } = await loadConfig(cwd);

  if (!config.sources[name]) {
    log.error(`Source "${name}" not found`);
    return;
  }

  delete config.sources[name];
  await saveConfig(config, configPath);

  // If server is running, hot-remove
  try {
    const serverUrl = await getServerUrl();
    await fetch(`${serverUrl}/api/_control/sources/${encodeURIComponent(name)}`, { method: 'DELETE' });
    log.success(`Source "${name}" removed (live)`);
    return;
  } catch {
    // Server not running
  }

  log.success(`Source "${name}" removed from config`);
}

export async function sourceTestCommand(name: string) {
  const serverUrl = await getServerUrl();
  const res = await fetch(`${serverUrl}/api/_control/sources/${encodeURIComponent(name)}/test`, { method: 'POST' });
  const json = await res.json() as { ok: boolean; rowCount?: number; sample?: unknown[]; error?: string };

  if (!json.ok) {
    log.error(json.error ?? 'Test failed');
    return;
  }

  log.success(`Source "${name}": ${json.rowCount} rows`);
  if (json.sample && json.sample.length > 0) {
    console.log(chalk.dim('\nSample:'));
    console.log(JSON.stringify(json.sample, null, 2));
  }
}
