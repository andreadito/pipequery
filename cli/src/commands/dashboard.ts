import React from 'react';
import { render } from 'ink';
import { loadConfig } from '../config/loader.js';
import { getServerUrl } from '../utils/server-discovery.js';
import { log } from '../utils/logger.js';
import { App } from '../tui/App.js';

export async function dashboardCommand(opts: { name?: string }) {
  const dashboardName = opts.name ?? 'main';
  const cwd = process.cwd();
  const { config } = await loadConfig(cwd);

  const dashboard = config.dashboards[dashboardName];
  if (!dashboard) {
    log.error(`Dashboard "${dashboardName}" not found in config.`);
    const available = Object.keys(config.dashboards);
    if (available.length > 0) {
      log.info(`Available dashboards: ${available.join(', ')}`);
    } else {
      log.dim('Add a dashboard section to pipequery.yaml');
    }
    return;
  }

  const serverUrl = await getServerUrl();

  const { waitUntilExit } = render(
    React.createElement(App, { serverUrl, dashboard }),
  );

  await waitUntilExit();
}
