import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { PipeQueryConfig, EndpointConfig, SourceConfig } from '../config/schema.js';
import { SourceManager } from './sources/manager.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerControlRoutes } from './routes/control.js';
import { registerDynamicRoutes } from './routes/dynamic.js';
import { registerSSERoutes } from './routes/sse.js';
import { saveConfig } from '../config/loader.js';

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

  // Initialize sources from config
  for (const [name, sourceConfig] of Object.entries(config.sources)) {
    try {
      await sourceManager.addSource(name, sourceConfig);
    } catch (err) {
      console.error(`Failed to start source "${name}":`, err instanceof Error ? err.message : err);
    }
  }

  // Build endpoint registry
  const endpoints = new Map<string, EndpointConfig>();
  for (const [path, endpointConfig] of Object.entries(config.endpoints)) {
    endpoints.set(path, endpointConfig);
  }

  // Config persistence callbacks (save changes back to YAML)
  const configCallbacks = {
    onSourceChange: async (name: string, sourceConfig: SourceConfig | null) => {
      if (sourceConfig) {
        config.sources[name] = sourceConfig;
      } else {
        delete config.sources[name];
      }
      await saveConfig(config, configPath);
    },
    onEndpointChange: async (path: string, endpointConfig: EndpointConfig | null) => {
      if (endpointConfig) {
        config.endpoints[path] = endpointConfig;
      } else {
        delete config.endpoints[path];
      }
      await saveConfig(config, configPath);
    },
  };

  // Register routes
  registerHealthRoutes(app, sourceManager, startedAt);
  registerControlRoutes(app, sourceManager, { endpoints }, configCallbacks);
  registerSSERoutes(app, sourceManager);
  registerDynamicRoutes(app, sourceManager, endpoints);

  return { app, sourceManager, endpoints };
}
