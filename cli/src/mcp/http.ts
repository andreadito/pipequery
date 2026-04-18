import { createServer as createHttpServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Provider } from './provider.js';
import { createMcpServer, type McpServerInfo } from './server.js';

export interface HttpServerOptions {
  host?: string;
  port: number;
  path?: string;
  info?: McpServerInfo;
}

export interface HttpServerHandle {
  close(): Promise<void>;
  url: string;
}

/**
 * Stand up a standalone HTTP server hosting the MCP Streamable HTTP transport.
 *
 * Stateful mode: each client gets a session ID on its first (initialize)
 * request and reuses it for subsequent tool calls. Sessions are in-memory;
 * this is single-instance by design. Multi-tenant / horizontally-scaled
 * hosting is out of scope for Phase 0.
 */
export async function runHttp(provider: Provider, opts: HttpServerOptions): Promise<HttpServerHandle> {
  const host = opts.host ?? '127.0.0.1';
  const port = opts.port;
  const mountPath = opts.path ?? '/mcp';

  const transports = new Map<string, StreamableHTTPServerTransport>();

  const attachTransport = async (): Promise<StreamableHTTPServerTransport> => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        transports.set(sessionId, transport);
      },
      onsessionclosed: (sessionId) => {
        transports.delete(sessionId);
      },
    });
    const mcp = createMcpServer(provider, opts.info);
    await mcp.connect(transport);
    return transport;
  };

  const server = createHttpServer(async (req, res) => {
    if (!req.url) {
      res.statusCode = 400;
      res.end('Bad Request');
      return;
    }

    const requestPath = req.url.split('?')[0];
    if (requestPath !== mountPath) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }

    try {
      const body = await readJsonBody(req);
      const sessionId = getSessionId(req);
      let transport = sessionId ? transports.get(sessionId) : undefined;
      if (!transport) {
        // No session yet — this should be an initialize request. Mint a new transport.
        transport = await attachTransport();
      }
      await transport.handleRequest(req, res, body);
    } catch (err) {
      process.stderr.write(
        `[pipequery-mcp] transport error: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
      );
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: err instanceof Error ? err.message : String(err),
          },
          id: null,
        }));
      } else {
        res.end();
      }
    }
  });

  await new Promise<void>((resolve) => server.listen(port, host, resolve));

  return {
    url: `http://${host}:${port}${mountPath}`,
    async close() {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      for (const t of transports.values()) {
        await t.close();
      }
      transports.clear();
      await provider.dispose();
    },
  };
}

function getSessionId(req: IncomingMessage): string | undefined {
  const header = req.headers['mcp-session-id'];
  if (typeof header === 'string') return header;
  if (Array.isArray(header)) return header[0];
  return undefined;
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const method = req.method?.toUpperCase();
  if (method === 'GET' || method === 'DELETE') return undefined;

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return undefined;

  const text = Buffer.concat(chunks).toString('utf8');
  if (!text.trim()) return undefined;

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON body');
  }
}

// Suppress unused-import warning in some configurations; ServerResponse is part of the signature readers care about.
export type { ServerResponse };
