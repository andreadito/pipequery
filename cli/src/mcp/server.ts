import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Provider } from './provider.js';

export interface McpServerInfo {
  name: string;
  version: string;
}

const DEFAULT_INFO: McpServerInfo = {
  name: 'pipequery',
  version: '0.1.0',
};

/**
 * Build an MCP server wired to the supplied provider.
 *
 * Tools exposed:
 *   - query              run a PipeQuery expression against live sources
 *   - list_sources       list configured sources and their health
 *   - describe_source    return a sample + inferred field names for a source
 *   - list_endpoints     list pre-configured endpoints and their stored queries
 *   - call_endpoint      execute a pre-configured endpoint by path
 */
export function createMcpServer(provider: Provider, info: McpServerInfo = DEFAULT_INFO): McpServer {
  const mcp = new McpServer(info);

  mcp.registerTool(
    'query',
    {
      title: 'Run a PipeQuery expression',
      description:
        'Execute a PipeQuery pipe-based expression (e.g. `crypto | where(price > 100) | sort(price desc) | first(5)`) against all currently configured sources. Returns the computed result as JSON.',
      inputSchema: {
        expression: z
          .string()
          .min(1)
          .describe('The PipeQuery expression. Source names used in the expression must be configured; call `list_sources` to see them.'),
      },
    },
    async ({ expression }) => {
      const result = await provider.runQuery(expression);
      return toolResult(result);
    },
  );

  mcp.registerTool(
    'list_sources',
    {
      title: 'List configured data sources',
      description:
        'List every data source configured in pipequery.yaml along with its current health, row count, and last-fetch timestamp.',
    },
    async () => {
      const sources = await provider.listSources();
      return toolResult({ count: sources.length, sources });
    },
  );

  mcp.registerTool(
    'describe_source',
    {
      title: 'Describe a data source',
      description:
        'Return a sample of rows and the inferred field names for a single source. Useful before constructing a query.',
      inputSchema: {
        name: z.string().min(1).describe('Source name as returned by list_sources.'),
        sample_size: z
          .number()
          .int()
          .positive()
          .max(100)
          .optional()
          .describe('Number of rows to include in the sample. Defaults to 5, max 100.'),
      },
    },
    async ({ name, sample_size }) => {
      const description = await provider.describeSource(name, sample_size);
      if (!description) {
        return toolError(`Source "${name}" not found`);
      }
      return toolResult(description);
    },
  );

  mcp.registerTool(
    'list_endpoints',
    {
      title: 'List pre-configured query endpoints',
      description:
        'Return every endpoint declared in pipequery.yaml along with its stored query expression. These endpoints can be invoked via `call_endpoint`.',
    },
    async () => {
      const endpoints = await provider.listEndpoints();
      return toolResult({ count: endpoints.length, endpoints });
    },
  );

  mcp.registerTool(
    'call_endpoint',
    {
      title: 'Invoke a pre-configured endpoint',
      description:
        'Execute the stored query for an endpoint path (e.g. `/api/top-coins`) and return its JSON result. Equivalent to the HTTP endpoint on `pq serve`, without needing a live HTTP call.',
      inputSchema: {
        path: z.string().min(1).describe('Endpoint path, exactly as declared in pipequery.yaml (typically begins with `/`).'),
      },
    },
    async ({ path }) => {
      try {
        const result = await provider.callEndpoint(path);
        return toolResult(result);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  );

  return mcp;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function toolResult(data: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

function toolError(message: string): {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
} {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}
