import { writeFile, mkdir, readFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { loadConfig } from '../config/loader.js';
import { createServer } from '../server/app.js';
import { log } from '../utils/logger.js';
import { printCompactBanner, printServerStartup } from '../utils/banner.js';

export async function serveCommand(opts: { port?: number; host?: string; daemon?: boolean; stop?: boolean }) {
  const cwd = process.cwd();
  const pqDir = resolve(cwd, '.pipequery');
  const serverJsonPath = resolve(pqDir, 'server.json');

  // Handle --stop flag
  if (opts.stop) {
    return stopDaemon(serverJsonPath);
  }

  const { config, path: configPath } = await loadConfig(cwd);
  const port = opts.port ?? config.server.port;
  const host = opts.host ?? config.server.host;

  // Daemon mode: fork a detached child process
  if (opts.daemon) {
    return startDaemon(cwd, port, host);
  }

  // Foreground mode
  const { app, sourceManager } = await createServer(config, configPath, cwd);

  await mkdir(pqDir, { recursive: true });
  const logPath = resolve(pqDir, 'server.log');
  await writeFile(serverJsonPath, JSON.stringify({ url: `http://localhost:${port}`, pid: process.pid, daemon: false, log: logPath }));

  await app.listen({ port, host });

  const sourceCount = sourceManager.getSourceNames().length;
  const endpointCount = Object.keys(config.endpoints).length;
  const url = `http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`;

  printCompactBanner();
  printServerStartup({ url, sourceCount, endpointCount });

  // Graceful shutdown
  const shutdown = async () => {
    log.dim('\nShutting down...');
    await sourceManager.dispose();
    await app.close();
    try { await unlink(serverJsonPath); } catch {}
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

async function startDaemon(cwd: string, port: number, host: string) {
  const pqDir = resolve(cwd, '.pipequery');
  const serverJsonPath = resolve(pqDir, 'server.json');
  const logPath = resolve(pqDir, 'server.log');

  // Check if already running
  if (existsSync(serverJsonPath)) {
    try {
      const info = JSON.parse(await readFile(serverJsonPath, 'utf-8')) as { url: string; pid: number };
      const res = await fetch(`${info.url}/health`).catch(() => null);
      if (res?.ok) {
        log.warn(`Server already running at ${info.url} (PID: ${info.pid})`);
        return;
      }
    } catch {
      // Stale server.json, proceed
    }
  }

  await mkdir(pqDir, { recursive: true });

  // Find the current script to re-run it in foreground mode
  const scriptPath = process.argv[1];
  const args = ['serve', '--port', String(port), '--host', host];

  const out = await import('node:fs').then(fs => fs.openSync(logPath, 'a'));
  const child = spawn(process.execPath, [scriptPath, ...args], {
    cwd,
    detached: true,
    stdio: ['ignore', out, out],
    env: { ...process.env, PQ_DAEMON: '1' },
  });

  child.unref();

  // Write server info with daemon PID
  await writeFile(serverJsonPath, JSON.stringify({
    url: `http://localhost:${port}`,
    pid: child.pid,
    daemon: true,
    log: logPath,
  }));

  log.success(`PipeQuery server started in background (PID: ${child.pid})`);
  log.dim(`Logs: ${logPath}`);
  log.dim(`Stop with: pq serve --stop`);
}

async function stopDaemon(serverJsonPath: string) {
  if (!existsSync(serverJsonPath)) {
    log.error('No running server found.');
    return;
  }

  try {
    const info = JSON.parse(await readFile(serverJsonPath, 'utf-8')) as { pid: number; url: string };
    process.kill(info.pid, 'SIGTERM');
    await unlink(serverJsonPath);
    log.success(`Server stopped (PID: ${info.pid})`);
  } catch (err) {
    log.error(`Failed to stop server: ${err instanceof Error ? err.message : err}`);
    // Clean up stale file
    try { await unlink(serverJsonPath); } catch {}
  }
}
