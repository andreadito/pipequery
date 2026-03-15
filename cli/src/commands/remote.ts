import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { findConfigPath, loadConfig, saveConfig } from '../config/loader.js';
import { DEFAULT_CONFIG } from '../config/defaults.js';
import type { PipeQueryConfig } from '../config/schema.js';
import { log } from '../utils/logger.js';
import { generateDockerfile, generateDockerCompose, generateDockerignore } from '../docker/templates.js';

export async function remoteDeployCommand() {
  const cwd = process.cwd();
  const { config } = await loadConfig(cwd);
  const port = config.server.port;

  // Generate files
  await writeFile(resolve(cwd, 'Dockerfile'), generateDockerfile(port));
  await writeFile(resolve(cwd, 'docker-compose.yaml'), generateDockerCompose(port));
  await writeFile(resolve(cwd, '.dockerignore'), generateDockerignore());

  log.success('Generated Dockerfile, docker-compose.yaml, and .dockerignore');
  log.info(`Run: docker compose up -d --build`);
  log.info(`Then: pq remote connect http://localhost:${port}`);
}

/**
 * Load config if it exists, or create a minimal one for remote-only usage.
 */
async function loadOrCreateConfig(cwd: string): Promise<{ config: PipeQueryConfig; path: string }> {
  const existing = findConfigPath(cwd);
  if (existing) {
    return loadConfig(cwd);
  }

  // No local config — create a minimal one for remote connection
  const configPath = resolve(cwd, 'pipequery.yaml');
  const config: PipeQueryConfig = {
    server: { ...DEFAULT_CONFIG.server },
    sources: {},
    endpoints: {},
    dashboards: {},
  };
  await saveConfig(config, configPath);
  return { config, path: configPath };
}

export async function remoteConnectCommand(url: string) {
  // Verify the remote server is reachable first
  try {
    const res = await fetch(`${url}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    log.error(`Cannot reach ${url}: ${err instanceof Error ? err.message : err}`);
    return;
  }

  const cwd = process.cwd();
  const { config, path: configPath } = await loadOrCreateConfig(cwd);

  config.remote = { url };
  await saveConfig(config, configPath);
  log.success(`Connected to remote server at ${url}`);
}

export async function remoteStatusCommand() {
  const cwd = process.cwd();

  const existing = findConfigPath(cwd);
  if (!existing) {
    log.error('No remote server configured. Use: pq remote connect <url>');
    return;
  }

  const { config } = await loadConfig(cwd);
  const url = config.remote?.url;
  if (!url) {
    log.error('No remote server configured. Use: pq remote connect <url>');
    return;
  }

  try {
    const res = await fetch(`${url}/status`);
    const status = await res.json() as { status: string; uptime: number; sources: Record<string, unknown> };

    log.success(`Remote server at ${url}`);
    log.info(`Uptime: ${Math.floor(status.uptime / 1000)}s`);
    log.info(`Sources: ${Object.keys(status.sources).length}`);
  } catch (err) {
    log.error(`Cannot reach ${url}: ${err instanceof Error ? err.message : err}`);
  }
}
