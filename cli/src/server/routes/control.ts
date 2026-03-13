import type { FastifyInstance } from 'fastify';
import { query } from '../../engine.js';
import type { SourceConfig, EndpointConfig } from '../../config/schema.js';
import type { SourceManager } from '../sources/manager.js';

interface EndpointRegistry {
  endpoints: Map<string, EndpointConfig>;
  onAdd?: (path: string, config: EndpointConfig) => void;
  onRemove?: (path: string) => void;
}

export function registerControlRoutes(
  app: FastifyInstance,
  sourceManager: SourceManager,
  endpointRegistry: EndpointRegistry,
  configCallbacks: {
    onSourceChange: (name: string, config: SourceConfig | null) => Promise<void>;
    onEndpointChange: (path: string, config: EndpointConfig | null) => Promise<void>;
  },
) {
  // ─── Sources ─────────────────────────────────────────────────────────────

  app.get('/api/_control/sources', async () => {
    return sourceManager.getAllStatuses();
  });

  app.post<{ Body: { name: string; config: SourceConfig } }>('/api/_control/sources', async (req) => {
    const { name, config } = req.body;
    await sourceManager.addSource(name, config);
    await configCallbacks.onSourceChange(name, config);
    return { ok: true, name, status: sourceManager.getSourceStatus(name) };
  });

  app.delete<{ Params: { name: string } }>('/api/_control/sources/:name', async (req) => {
    const { name } = req.params;
    const removed = sourceManager.removeSource(name);
    if (!removed) return { ok: false, error: `Source "${name}" not found` };
    await configCallbacks.onSourceChange(name, null);
    return { ok: true, name };
  });

  app.post<{ Params: { name: string } }>('/api/_control/sources/:name/test', async (req) => {
    const { name } = req.params;
    const data = sourceManager.getSourceData(name);
    if (!data) return { ok: false, error: `Source "${name}" not found` };
    return {
      ok: true,
      rowCount: data.length,
      sample: data.slice(0, 3),
      status: sourceManager.getSourceStatus(name),
    };
  });

  // ─── Endpoints ───────────────────────────────────────────────────────────

  app.get('/api/_control/endpoints', async () => {
    const result: Record<string, EndpointConfig> = {};
    for (const [path, config] of endpointRegistry.endpoints) {
      result[path] = config;
    }
    return result;
  });

  app.post<{ Body: { path: string; config: EndpointConfig } }>('/api/_control/endpoints', async (req) => {
    const { path, config } = req.body;
    endpointRegistry.endpoints.set(path, config);
    endpointRegistry.onAdd?.(path, config);
    await configCallbacks.onEndpointChange(path, config);
    return { ok: true, path };
  });

  app.delete<{ Body: { path: string } }>('/api/_control/endpoints', async (req) => {
    const path = req.body.path;
    const removed = endpointRegistry.endpoints.delete(path);
    if (!removed) return { ok: false, error: `Endpoint "${path}" not found` };
    endpointRegistry.onRemove?.(path);
    await configCallbacks.onEndpointChange(path, null);
    return { ok: true, path };
  });

  // ─── Ad-hoc query ────────────────────────────────────────────────────────

  app.post<{ Body: { query: string } }>('/api/_control/query', async (req) => {
    const { query: expr } = req.body;
    const context = sourceManager.getContext();
    try {
      const result = query(context, expr);
      return { ok: true, result };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
