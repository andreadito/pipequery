import type { FastifyInstance } from 'fastify';
import { query } from '../../engine.js';
import type { SourceManager } from '../sources/manager.js';

/**
 * SSE endpoint for real-time dashboard updates.
 *
 * Clients connect to GET /api/_control/sse?queries=<json-encoded-array>
 * and receive server-sent events whenever source data changes.
 * Updates are throttled to max once per second to avoid overwhelming clients.
 *
 * Each event is a JSON object: { panelIndex: number, result: unknown }
 */
export function registerSSERoutes(app: FastifyInstance, sourceManager: SourceManager) {
  app.get('/api/_control/sse', async (req, reply) => {
    const queriesParam = (req.query as Record<string, string>).queries;
    if (!queriesParam) {
      return reply.status(400).send({ error: 'queries parameter required (JSON array of strings)' });
    }

    let queries: string[];
    try {
      queries = JSON.parse(queriesParam);
      if (!Array.isArray(queries)) throw new Error();
    } catch {
      return reply.status(400).send({ error: 'queries must be a JSON array of strings' });
    }

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Send initial data for all panels
    sendAllPanels(reply.raw, queries, sourceManager);

    // Throttled update: max once per second
    let pending = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const throttledSend = () => {
      if (timer) {
        pending = true;
        return;
      }
      sendAllPanels(reply.raw, queries, sourceManager);
      timer = setTimeout(() => {
        timer = null;
        if (pending) {
          pending = false;
          throttledSend();
        }
      }, 1000);
    };

    // Subscribe to source updates
    const unsubscribe = sourceManager.onSourceUpdate(throttledSend);

    // Periodic heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      reply.raw.write(':heartbeat\n\n');
    }, 15_000);

    // Cleanup on close
    req.raw.on('close', () => {
      unsubscribe();
      clearInterval(heartbeat);
      if (timer) clearTimeout(timer);
    });

    // Don't let Fastify auto-close the response
    await reply.hijack();
  });
}

function sendAllPanels(
  res: import('node:http').ServerResponse,
  queries: string[],
  sourceManager: SourceManager,
) {
  const context = sourceManager.getContext();

  for (let i = 0; i < queries.length; i++) {
    try {
      const result = query(context, queries[i]);
      const event = JSON.stringify({ panelIndex: i, result });
      res.write(`data: ${event}\n\n`);
    } catch (err) {
      const event = JSON.stringify({ panelIndex: i, error: err instanceof Error ? err.message : String(err) });
      res.write(`data: ${event}\n\n`);
    }
  }
}
