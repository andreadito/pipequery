import { useState, useEffect, useRef } from 'react';
import http from 'node:http';

interface SSEState {
  results: Map<number, unknown>;
  errors: Map<number, string>;
  connected: boolean;
}

/**
 * Hook that connects to the SSE endpoint for real-time dashboard updates.
 * Falls back to polling if SSE connection fails.
 */
export function useSSE(serverUrl: string, queries: string[]) {
  const [state, setState] = useState<SSEState>({
    results: new Map(),
    errors: new Map(),
    connected: false,
  });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (queries.length === 0) return;

    const abort = new AbortController();
    abortRef.current = abort;

    const url = new URL('/api/_control/sse', serverUrl);
    url.searchParams.set('queries', JSON.stringify(queries));

    // Use Node.js http for SSE (EventSource not available in Node)
    const connect = () => {
      const req = http.get(url.toString(), { signal: abort.signal }, (res) => {
        if (res.statusCode !== 200) {
          setState((s) => ({ ...s, connected: false }));
          return;
        }

        setState((s) => ({ ...s, connected: true }));

        let buffer = '';
        res.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n\n');
          buffer = lines.pop() ?? '';

          for (const block of lines) {
            const dataLine = block.split('\n').find((l) => l.startsWith('data: '));
            if (!dataLine) continue;

            try {
              const event = JSON.parse(dataLine.slice(6)) as { panelIndex: number; result?: unknown; error?: string };
              setState((s) => {
                const results = new Map(s.results);
                const errors = new Map(s.errors);
                if (event.error) {
                  errors.set(event.panelIndex, event.error);
                } else {
                  results.set(event.panelIndex, event.result);
                  errors.delete(event.panelIndex);
                }
                return { results, errors, connected: true };
              });
            } catch {
              // Ignore parse errors (heartbeats etc.)
            }
          }
        });

        res.on('end', () => {
          setState((s) => ({ ...s, connected: false }));
          // Reconnect after 2s
          if (!abort.signal.aborted) {
            setTimeout(connect, 2000);
          }
        });
      });

      req.on('error', () => {
        setState((s) => ({ ...s, connected: false }));
        if (!abort.signal.aborted) {
          setTimeout(connect, 2000);
        }
      });
    };

    connect();

    return () => {
      abort.abort();
    };
  }, [serverUrl, queries.join(',')]);

  return state;
}
