import React from 'react';
import { render } from 'ink';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getServerUrl } from '../utils/server-discovery.js';
import { log } from '../utils/logger.js';
import { MonitorApp } from '../tui/MonitorApp.js';
import { enableSyncOutput, disableSyncOutput } from '../utils/sync-output.js';

export async function monitorCommand() {
  const serverUrl = await getServerUrl();

  // Try to find log path from server discovery
  const discoveryPath = resolve(process.cwd(), '.pipequery', 'server.json');
  let logPath: string | undefined;

  if (existsSync(discoveryPath)) {
    try {
      const disc = JSON.parse(readFileSync(discoveryPath, 'utf-8')) as { log?: string };
      if (disc.log && existsSync(disc.log)) {
        logPath = disc.log;
      }
    } catch {
      // ignore
    }
  }

  // Fallback log path
  if (!logPath) {
    const fallback = resolve(process.cwd(), '.pipequery', 'server.log');
    if (existsSync(fallback)) {
      logPath = fallback;
    }
  }

  // Enter alternate screen buffer + synchronized output
  process.stdout.write('\x1B[?1049h');
  process.stdout.write('\x1B[?25l');
  enableSyncOutput();

  const { waitUntilExit } = render(
    React.createElement(MonitorApp, { serverUrl, logPath }),
    { patchConsole: false },
  );

  await waitUntilExit();

  // Restore
  disableSyncOutput();
  process.stdout.write('\x1B[?25h');
  process.stdout.write('\x1B[?1049l');
}
