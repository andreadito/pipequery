import { useState, useEffect, useCallback } from 'react';

interface PanelData {
  data: unknown;
  loading: boolean;
  error?: string;
}

export function useServerData(serverUrl: string, query: string, refreshMs: number) {
  const [state, setState] = useState<PanelData>({ data: null, loading: true });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${serverUrl}/api/_control/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const json = await res.json() as { ok: boolean; result?: unknown; error?: string };
      if (json.ok) {
        setState({ data: json.result, loading: false });
      } else {
        setState({ data: null, loading: false, error: json.error });
      }
    } catch (err) {
      setState({ data: null, loading: false, error: err instanceof Error ? err.message : String(err) });
    }
  }, [serverUrl, query]);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, refreshMs);
    return () => clearInterval(timer);
  }, [fetchData, refreshMs]);

  return { ...state, refresh: fetchData };
}
