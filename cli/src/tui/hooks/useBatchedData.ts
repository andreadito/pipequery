import { useState, useEffect, useCallback } from 'react';

interface PanelResult {
  data: unknown;
  error?: string;
}

/**
 * Fetches all panel queries in a single batch and updates state once.
 * This prevents multiple re-renders (and thus flicker) that occur when
 * each panel fetches independently.
 */
export function useBatchedData(
  serverUrl: string,
  queries: string[],
  refreshMs: number,
) {
  const [results, setResults] = useState<Map<string, PanelResult>>(new Map());
  const [loading, setLoading] = useState(true);
  const [trigger, setTrigger] = useState(0);
  const queriesKey = queries.join('|||');

  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      const entries = await Promise.all(
        queries.map(async (query) => {
          try {
            const res = await fetch(`${serverUrl}/api/_control/query`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query }),
            });
            const json = (await res.json()) as {
              ok: boolean;
              result?: unknown;
              error?: string;
            };
            if (json.ok) {
              return [query, { data: json.result }] as const;
            }
            return [query, { data: null, error: json.error }] as const;
          } catch (err) {
            return [
              query,
              { data: null, error: err instanceof Error ? err.message : String(err) },
            ] as const;
          }
        }),
      );

      if (!cancelled) {
        setResults(new Map(entries));
        setLoading(false);
      }
    };

    fetchAll();
    const timer = setInterval(fetchAll, refreshMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [serverUrl, queriesKey, refreshMs, trigger]);

  // Manual refresh — force sources to re-fetch, then re-run queries
  const refresh = useCallback(async () => {
    try {
      await fetch(`${serverUrl}/api/_control/refresh`, { method: 'POST' });
    } catch { /* ignore */ }
    setTrigger((t) => t + 1);
  }, [serverUrl]);

  return { results, loading, refresh };
}
