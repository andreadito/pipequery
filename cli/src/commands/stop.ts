import { readFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { log } from '../utils/logger.js';

export async function stopCommand(opts: { force?: boolean }) {
  const cwd = process.cwd();
  const serverJsonPath = resolve(cwd, '.pipequery', 'server.json');

  if (!existsSync(serverJsonPath)) {
    log.error('No running server found.');
    log.dim('Start one with: pq serve  or  pq serve -d');
    return;
  }

  let info: { pid: number; url: string; daemon?: boolean };
  try {
    info = JSON.parse(await readFile(serverJsonPath, 'utf-8'));
  } catch {
    log.error('Could not read server info. Cleaning up stale file.');
    try { await unlink(serverJsonPath); } catch {}
    return;
  }

  // Check if process is actually running
  let alive = false;
  try {
    process.kill(info.pid, 0); // signal 0 = just check existence
    alive = true;
  } catch {
    // Process not running
  }

  if (!alive) {
    log.warn(`Server (PID: ${info.pid}) is not running. Cleaning up stale state.`);
    try { await unlink(serverJsonPath); } catch {}
    return;
  }

  // Send signal
  const signal = opts.force ? 'SIGKILL' : 'SIGTERM';
  try {
    process.kill(info.pid, signal);
    log.success(`Server stopped (PID: ${info.pid})${info.daemon ? ' [daemon]' : ''}`);
  } catch (err) {
    log.error(`Failed to stop server: ${err instanceof Error ? err.message : err}`);
  }

  try { await unlink(serverJsonPath); } catch {}
}
