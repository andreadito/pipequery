import { loadConfig } from '../config/loader.js';
import { log } from '../utils/logger.js';
import { AttachedProvider, LocalProvider, type Provider } from '../mcp/provider.js';
import { runStdio } from '../mcp/stdio.js';
import { runHttp } from '../mcp/http.js';
import { createMcpServer } from '../mcp/server.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

interface McpServeOptions {
  http?: boolean;
  port?: number;
  host?: string;
  attach?: string;
  authToken?: string;
}

export async function mcpServeCommand(opts: McpServeOptions): Promise<void> {
  const provider = await buildProvider(opts.attach);
  const isStdio = !opts.http;

  if (isStdio) {
    // In stdio mode, stdout is reserved for JSON-RPC. All logs go to stderr.
    await runStdio(provider);
    return;
  }

  const port = opts.port ?? 3001;
  const host = opts.host ?? '127.0.0.1';
  // CLI flag takes precedence over env var. No token => unauthenticated
  // (runHttp warns loudly at startup).
  const authToken = opts.authToken ?? process.env.PIPEQUERY_MCP_TOKEN;
  const handle = await runHttp(provider, { port, host, authToken });

  log.success(`PipeQuery MCP server listening on ${handle.url}`);
  log.info('Connect any MCP client to the URL above (Claude, Cursor, custom agents).');
  log.info('Press Ctrl+C to stop.');

  const shutdown = async () => {
    log.info('Shutting down MCP server...');
    await handle.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

export async function mcpInspectCommand(opts: { attach?: string }): Promise<void> {
  const provider = await buildProvider(opts.attach);
  const mcp = createMcpServer(provider);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await mcp.connect(serverTransport);

  const client = new Client({ name: 'pq-mcp-inspect', version: '0.1.0' });
  await client.connect(clientTransport);

  try {
    const { tools } = await client.listTools();
    const summary = {
      server: 'pipequery',
      toolCount: tools.length,
      tools: tools.map((t) => ({
        name: t.name,
        title: t.title,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    };
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  } finally {
    await client.close();
    await mcp.close();
    await provider.dispose();
  }
}

async function buildProvider(attachUrl?: string): Promise<Provider> {
  if (attachUrl) {
    return new AttachedProvider(attachUrl);
  }

  const cwd = process.cwd();
  const { config } = await loadConfig(cwd);
  return new LocalProvider(config, cwd);
}
