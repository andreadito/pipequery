import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Provider } from './provider.js';
import { createMcpServer, type McpServerInfo } from './server.js';

export async function runStdio(provider: Provider, info?: McpServerInfo): Promise<void> {
  const mcp = createMcpServer(provider, info);
  const transport = new StdioServerTransport();
  await mcp.connect(transport);

  // Clean up on stdio close — Claude Desktop etc. close the child process
  // by closing its stdin.
  const cleanup = async () => {
    try {
      await mcp.close();
    } finally {
      await provider.dispose();
    }
  };

  process.stdin.on('close', () => {
    void cleanup().then(() => process.exit(0));
  });

  process.on('SIGINT', () => void cleanup().then(() => process.exit(0)));
  process.on('SIGTERM', () => void cleanup().then(() => process.exit(0)));
}
