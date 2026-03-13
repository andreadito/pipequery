import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { readYaml, writeYaml } from '../utils/yaml.js';
import { DEFAULT_CONFIG } from './defaults.js';
import type { PipeQueryConfig } from './schema.js';

const CONFIG_NAMES = ['pipequery.yaml', 'pipequery.yml'];

export function findConfigPath(cwd = process.cwd()): string | null {
  for (const name of CONFIG_NAMES) {
    const p = resolve(cwd, name);
    if (existsSync(p)) return p;
  }
  return null;
}

export async function loadConfig(cwd = process.cwd()): Promise<{ config: PipeQueryConfig; path: string }> {
  const configPath = findConfigPath(cwd);
  if (!configPath) {
    throw new Error('No pipequery.yaml found. Run `pq init` to create one.');
  }

  const raw = await readYaml<Partial<PipeQueryConfig>>(configPath);
  const config: PipeQueryConfig = {
    server: { ...DEFAULT_CONFIG.server, ...raw.server },
    remote: raw.remote,
    sources: raw.sources ?? {},
    endpoints: raw.endpoints ?? {},
    dashboards: raw.dashboards ?? {},
  };

  return { config, path: configPath };
}

export async function saveConfig(config: PipeQueryConfig, configPath: string): Promise<void> {
  await writeYaml(configPath, config);
}
