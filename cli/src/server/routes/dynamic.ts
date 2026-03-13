import type { FastifyInstance } from 'fastify';
import { query } from '../../engine.js';
import type { EndpointConfig } from '../../config/schema.js';
import type { SourceManager } from '../sources/manager.js';
import { ResponseCache } from '../cache.js';
import { parseDuration } from '../../utils/parseDuration.js';

export function registerDynamicRoutes(
  app: FastifyInstance,
  sourceManager: SourceManager,
  endpoints: Map<string, EndpointConfig>,
) {
  const cache = new ResponseCache();

  // Use onRequest hook to intercept user-defined endpoints
  // This avoids Fastify wildcard route conflicts with control routes
  app.addHook('onRequest', async (req, reply) => {
    const path = req.url.split('?')[0];

    // Only handle /api/ paths that aren't control routes
    if (!path.startsWith('/api/') || path.startsWith('/api/_control')) return;

    const config = endpoints.get(path);
    if (!config) return; // Let it fall through to 404

    // Check cache
    if (config.cache) {
      const cached = cache.get(path);
      if (cached !== undefined) {
        reply.send(cached);
        return;
      }
    }

    // Execute query
    const context = sourceManager.getContext();
    try {
      const result = query(context, config.query);

      if (config.cache) {
        cache.set(path, result, parseDuration(config.cache));
      }

      reply.send(result);
    } catch (err) {
      reply.status(500).send({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
