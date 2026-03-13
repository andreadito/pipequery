import chalk from 'chalk';
import { loadConfig, saveConfig } from '../config/loader.js';
import { getServerUrl } from '../utils/server-discovery.js';
import { log } from '../utils/logger.js';

export async function endpointListCommand() {
  const cwd = process.cwd();

  try {
    const serverUrl = await getServerUrl();
    const res = await fetch(`${serverUrl}/api/_control/endpoints`);
    const endpoints = await res.json() as Record<string, { query: string; cache?: string }>;

    if (Object.keys(endpoints).length === 0) {
      log.dim('No endpoints configured. Add one with: pq endpoint add <path> --query "<expr>"');
      return;
    }

    console.log(chalk.bold('Endpoints:\n'));
    for (const [path, config] of Object.entries(endpoints)) {
      const cache = config.cache ? chalk.dim(`(cache: ${config.cache})`) : '';
      console.log(`  ${chalk.green('GET')} ${chalk.bold(path)}  ${cache}`);
      console.log(`      ${chalk.dim(config.query)}`);
    }
  } catch {
    const { config } = await loadConfig(cwd);
    const entries = Object.entries(config.endpoints);

    if (entries.length === 0) {
      log.dim('No endpoints configured. Add one with: pq endpoint add <path> --query "<expr>"');
      return;
    }

    console.log(chalk.bold('Endpoints (server not running):\n'));
    for (const [path, cfg] of entries) {
      console.log(`  ${chalk.green('GET')} ${chalk.bold(path)}`);
      console.log(`      ${chalk.dim(cfg.query)}`);
    }
  }
}

export async function endpointAddCommand(path: string, opts: { query: string; cache?: string }) {
  const cwd = process.cwd();
  const { config, path: configPath } = await loadConfig(cwd);

  // Ensure path starts with /
  const apiPath = path.startsWith('/') ? path : `/${path}`;

  const endpointConfig = {
    query: opts.query,
    ...(opts.cache ? { cache: opts.cache } : {}),
  };

  // Save to config
  config.endpoints[apiPath] = endpointConfig;
  await saveConfig(config, configPath);

  // Hot-add if server running
  try {
    const serverUrl = await getServerUrl();
    await fetch(`${serverUrl}/api/_control/endpoints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: apiPath, config: endpointConfig }),
    });
    log.success(`Endpoint ${apiPath} registered (live)`);
    return;
  } catch {
    // Server not running
  }

  log.success(`Endpoint ${apiPath} added to config. Start server with: pq serve`);
}

export async function endpointRemoveCommand(path: string) {
  const cwd = process.cwd();
  const { config, path: configPath } = await loadConfig(cwd);

  const apiPath = path.startsWith('/') ? path : `/${path}`;

  if (!config.endpoints[apiPath]) {
    log.error(`Endpoint "${apiPath}" not found`);
    return;
  }

  delete config.endpoints[apiPath];
  await saveConfig(config, configPath);

  try {
    const serverUrl = await getServerUrl();
    await fetch(`${serverUrl}/api/_control/endpoints/${apiPath.slice(1)}`, { method: 'DELETE' });
    log.success(`Endpoint ${apiPath} removed (live)`);
    return;
  } catch {
    // Server not running
  }

  log.success(`Endpoint ${apiPath} removed from config`);
}
