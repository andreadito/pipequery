import type { FastifyInstance } from 'fastify';
import type { SourceManager } from '../sources/manager.js';

export function registerHealthRoutes(app: FastifyInstance, sourceManager: SourceManager, startedAt: Date) {
  app.get('/health', async () => {
    return { status: 'ok', uptime: Date.now() - startedAt.getTime() };
  });

  app.get('/status', async () => {
    return {
      status: 'ok',
      uptime: Date.now() - startedAt.getTime(),
      sources: sourceManager.getAllStatuses(),
    };
  });
}
