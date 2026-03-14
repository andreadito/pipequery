import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { PipeQueryConfig, EndpointConfig, SourceConfig } from '../config/schema.js';
import { SourceManager } from './sources/manager.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerControlRoutes } from './routes/control.js';
import { registerDynamicRoutes } from './routes/dynamic.js';
import { registerSSERoutes } from './routes/sse.js';
import { saveConfig } from '../config/loader.js';
import * as activity from './activity-log.js';
import { getActivityLog } from './activity-log.js';

export interface ServerContext {
  app: ReturnType<typeof Fastify>;
  sourceManager: SourceManager;
  endpoints: Map<string, EndpointConfig>;
}

export async function createServer(
  config: PipeQueryConfig,
  configPath: string,
  cwd: string,
): Promise<ServerContext> {
  const app = Fastify({ logger: false });
  await app.register(cors);

  const sourceManager = new SourceManager(cwd);
  const startedAt = new Date();

  activity.info('Server starting...');

  // Initialize sources from config
  for (const [name, sourceConfig] of Object.entries(config.sources)) {
    try {
      await sourceManager.addSource(name, sourceConfig);
      activity.info(`Source "${name}" loaded (${sourceConfig.type})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      activity.error(`Source "${name}" failed: ${msg}`);
      console.error(`Failed to start source "${name}":`, msg);
    }
  }

  // Build endpoint registry
  const endpoints = new Map<string, EndpointConfig>();
  for (const [path, endpointConfig] of Object.entries(config.endpoints)) {
    endpoints.set(path, endpointConfig);
    activity.info(`Endpoint registered: ${path}`);
  }

  // Config persistence callbacks (save changes back to YAML)
  const configCallbacks = {
    onSourceChange: async (name: string, sourceConfig: SourceConfig | null) => {
      if (sourceConfig) {
        config.sources[name] = sourceConfig;
        activity.info(`Source "${name}" added (${sourceConfig.type})`);
      } else {
        delete config.sources[name];
        activity.warn(`Source "${name}" removed`);
      }
      await saveConfig(config, configPath);
    },
    onEndpointChange: async (path: string, endpointConfig: EndpointConfig | null) => {
      if (endpointConfig) {
        config.endpoints[path] = endpointConfig;
        activity.info(`Endpoint "${path}" added`);
      } else {
        delete config.endpoints[path];
        activity.warn(`Endpoint "${path}" removed`);
      }
      await saveConfig(config, configPath);
    },
  };

  // Log requests (skip health/status/activity to reduce noise)
  app.addHook('onResponse', async (request, reply) => {
    const url = request.url;
    if (url === '/health' || url === '/status' || url === '/api/_control/activity') return;
    if (url === '/api/_control/sources' && request.method === 'GET') return;
    if (url === '/api/_control/endpoints' && request.method === 'GET') return;

    const status = reply.statusCode;
    const level = status >= 400 ? 'error' as const : 'info' as const;
    activity.logActivity(level, `${request.method} ${url} → ${status}`);
  });

  // Activity log endpoint (for monitor)
  app.get<{ Querystring: { since?: string } }>('/api/_control/activity', async (req) => {
    return getActivityLog(req.query.since);
  });

  // Register routes
  registerHealthRoutes(app, sourceManager, startedAt);
  registerControlRoutes(app, sourceManager, { endpoints }, configCallbacks);
  registerSSERoutes(app, sourceManager);
  registerDynamicRoutes(app, sourceManager, endpoints);

  activity.info('Server ready');

  return { app, sourceManager, endpoints };
}
