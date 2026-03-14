import { useState, useEffect, useCallback, useRef } from 'react';
import http from 'node:http';

interface PanelResult {
  data: unknown;
  error?: string;
}

/**
 * Connects to SSE for real-time push updates from the server.
 * Falls back to polling if SSE connection fails.
 */
export function useLiveData(
  serverUrl: string,
  queries: string[],
  fallbackMs: number,
) {
  const [results, setResults] = useState<Map<string, PanelResult>>(new Map());
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queriesKey = queries.join('|||');

  // SSE connection
  useEffect(() => {
    if (queries.length === 0) return;

    const abort = new AbortController();
    abortRef.current = abort;
    let sseConnected = false;

    const connectSSE = () => {
      if (abort.signal.aborted) return;

      const url = new URL('/api/_control/sse', serverUrl);
      url.searchParams.set('queries', JSON.stringify(queries));

      const req = http.get(url.toString(), { signal: abort.signal }, (res) => {
        if (res.statusCode !== 200) {
          startPolling();
          return;
        }

        sseConnected = true;
        setConnected(true);
        stopPolling();

        let buffer = '';
        res.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();
          const blocks = buffer.split('\n\n');
          buffer = blocks.pop() ?? '';

          // Batch all events from this chunk into a single state update
          const updates: Array<{ index: number; result?: unknown; error?: string }> = [];

          for (const block of blocks) {
            const dataLine = block.split('\n').find((l) => l.startsWith('data: '));
            if (!dataLine) continue;

            try {
              const event = JSON.parse(dataLine.slice(6)) as {
                panelIndex: number;
                result?: unknown;
                error?: string;
              };
              updates.push({ index: event.panelIndex, result: event.result, error: event.error });
            } catch {
              // ignore heartbeats
            }
          }

          if (updates.length > 0) {
            setResults((prev) => {
              const next = new Map(prev);
              for (const u of updates) {
                const query = queries[u.index];
                if (query) {
                  next.set(query, u.error ? { data: null, error: u.error } : { data: u.result });
                }
              }
              return next;
            });
            setLoading(false);
          }
        });

        res.on('end', () => {
          sseConnected = false;
          setConnected(false);
          if (!abort.signal.aborted) {
            startPolling();
            setTimeout(connectSSE, 3000);
          }
        });
      });

      req.on('error', () => {
        sseConnected = false;
        setConnected(false);
        if (!abort.signal.aborted) {
          startPolling();
          setTimeout(connectSSE, 3000);
        }
      });
    };

    // Polling fallback
    const pollAll = async () => {
      const entries = await Promise.all(
        queries.map(async (query) => {
          try {
            const res = await fetch(`${serverUrl}/api/_control/query`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query }),
            });
            const json = (await res.json()) as { ok: boolean; result?: unknown; error?: string };
            if (json.ok) return [query, { data: json.result }] as const;
            return [query, { data: null, error: json.error }] as const;
          } catch (err) {
            return [query, { data: null, error: err instanceof Error ? err.message : String(err) }] as const;
          }
        }),
      );
      setResults(new Map(entries));
      setLoading(false);
    };

    const startPolling = () => {
      if (fallbackTimerRef.current || sseConnected) return;
      pollAll();
      fallbackTimerRef.current = setInterval(pollAll, fallbackMs);
    };

    const stopPolling = () => {
      if (fallbackTimerRef.current) {
        clearInterval(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };

    connectSSE();

    return () => {
      abort.abort();
      stopPolling();
    };
  }, [serverUrl, queriesKey, fallbackMs]);

  // Manual refresh — force sources to re-fetch
  const refresh = useCallback(async () => {
    try {
      await fetch(`${serverUrl}/api/_control/refresh`, { method: 'POST' });
    } catch { /* ignore */ }
    // SSE will automatically push new data after source refresh
  }, [serverUrl]);

  return { results, loading, connected, refresh };
}
