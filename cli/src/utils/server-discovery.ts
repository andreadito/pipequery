import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { findConfigPath } from '../config/loader.js';
import { readYaml } from './yaml.js';

interface ServerInfo {
  url: string;
  pid: number;
}

export async function getServerUrl(): Promise<string> {
  const cwd = process.cwd();

  // 1. Check .pipequery/server.json for running local server
  const serverJsonPath = resolve(cwd, '.pipequery', 'server.json');
  if (existsSync(serverJsonPath)) {
    try {
      const info = JSON.parse(await readFile(serverJsonPath, 'utf-8')) as ServerInfo;
      // Verify the server is actually running
      const res = await fetch(`${info.url}/health`).catch(() => null);
      if (res?.ok) return info.url;
    } catch {
      // Fall through
    }
  }

  // 2. Check config for remote URL
  const configPath = findConfigPath(cwd);
  if (configPath) {
    try {
      const config = await readYaml<{ remote?: { url: string } }>(configPath);
      if (config.remote?.url) {
        const res = await fetch(`${config.remote.url}/health`).catch(() => null);
        if (res?.ok) return config.remote.url;
      }
    } catch {
      // Fall through
    }
  }

  throw new Error('No running PipeQuery server found. Start one with: pq serve');
}
