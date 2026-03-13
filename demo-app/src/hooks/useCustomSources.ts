import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CustomSourceConfig {
  name: string;
  type: 'rest' | 'websocket' | 'json';
  // REST
  url?: string;
  interval?: number; // seconds (default 30)
  headers?: Record<string, string>;
  dataPath?: string; // dot-path to extract array (e.g. "data.items")
  // WebSocket
  wsUrl?: string;
  // JSON paste
  jsonData?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Resolve a dot-separated path to extract nested data from a response. */
function resolvePath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  let current = obj;
  for (const key of path.split('.')) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** Ensure a value is a usable array of objects. */
function toArray(val: unknown): unknown[] {
  if (Array.isArray(val)) return val;
  if (val != null && typeof val === 'object') return [val];
  return [];
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useCustomSources() {
  const [configs, setConfigs] = useLocalStorage<CustomSourceConfig[]>('pq-demo-custom-source-configs', []);
  const [data, setData] = useState<Record<string, unknown[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Track active connections for cleanup
  const intervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const socketsRef = useRef<Map<string, WebSocket>>(new Map());
  const mountedRef = useRef(true);

  // ── REST fetching ──────────────────────────────────────────────────────

  const fetchRest = useCallback(async (cfg: CustomSourceConfig) => {
    if (!cfg.url) return;
    try {
      const res = await fetch(cfg.url, {
        headers: cfg.headers ?? {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const extracted = resolvePath(json, cfg.dataPath ?? '');
      const arr = toArray(extracted);

      if (mountedRef.current) {
        setData(prev => ({ ...prev, [cfg.name]: arr }));
        setErrors(prev => {
          if (!prev[cfg.name]) return prev;
          const next = { ...prev };
          delete next[cfg.name];
          return next;
        });
      }
    } catch (e) {
      if (mountedRef.current) {
        setErrors(prev => ({
          ...prev,
          [cfg.name]: e instanceof Error ? e.message : 'Fetch failed',
        }));
      }
    }
  }, []);

  // ── Start / stop sources ───────────────────────────────────────────────

  const startSource = useCallback((cfg: CustomSourceConfig) => {
    // Clean up existing connection for this name
    const existingInterval = intervalsRef.current.get(cfg.name);
    if (existingInterval) clearInterval(existingInterval);
    const existingSocket = socketsRef.current.get(cfg.name);
    if (existingSocket) existingSocket.close();

    switch (cfg.type) {
      case 'rest': {
        // Fetch immediately, then poll
        fetchRest(cfg);
        const ms = (cfg.interval ?? 30) * 1000;
        const id = setInterval(() => fetchRest(cfg), ms);
        intervalsRef.current.set(cfg.name, id);
        break;
      }

      case 'websocket': {
        if (!cfg.wsUrl) return;
        try {
          const ws = new WebSocket(cfg.wsUrl);
          socketsRef.current.set(cfg.name, ws);

          ws.onmessage = (event) => {
            try {
              const parsed = JSON.parse(event.data);
              if (Array.isArray(parsed)) {
                // Full replacement if message is an array
                setData(prev => ({ ...prev, [cfg.name]: parsed }));
              } else {
                // Append individual messages (keep last 1000)
                setData(prev => {
                  const existing = prev[cfg.name] ?? [];
                  const next = [...existing, parsed];
                  return { ...prev, [cfg.name]: next.slice(-1000) };
                });
              }
              setErrors(prev => {
                if (!prev[cfg.name]) return prev;
                const next = { ...prev };
                delete next[cfg.name];
                return next;
              });
            } catch {
              // Non-JSON messages ignored
            }
          };

          ws.onerror = () => {
            setErrors(prev => ({ ...prev, [cfg.name]: 'WebSocket error' }));
          };

          ws.onclose = () => {
            // Don't set error on intentional close
          };
        } catch (e) {
          setErrors(prev => ({
            ...prev,
            [cfg.name]: e instanceof Error ? e.message : 'WebSocket failed',
          }));
        }
        break;
      }

      case 'json': {
        if (!cfg.jsonData) return;
        try {
          const parsed = JSON.parse(cfg.jsonData);
          const arr = toArray(parsed);
          setData(prev => ({ ...prev, [cfg.name]: arr }));
        } catch (e) {
          setErrors(prev => ({
            ...prev,
            [cfg.name]: e instanceof Error ? e.message : 'Invalid JSON',
          }));
        }
        break;
      }
    }
  }, [fetchRest]);

  const stopSource = useCallback((name: string) => {
    const interval = intervalsRef.current.get(name);
    if (interval) {
      clearInterval(interval);
      intervalsRef.current.delete(name);
    }
    const socket = socketsRef.current.get(name);
    if (socket) {
      socket.close();
      socketsRef.current.delete(name);
    }
  }, []);

  // ── Sync configs → active connections ──────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;

    // Start all configured sources
    for (const cfg of configs) {
      startSource(cfg);
    }

    return () => {
      mountedRef.current = false;
      // Stop all on unmount
      for (const name of intervalsRef.current.keys()) {
        clearInterval(intervalsRef.current.get(name)!);
      }
      intervalsRef.current.clear();
      for (const ws of socketsRef.current.values()) {
        ws.close();
      }
      socketsRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configs]);

  // ── Public API ─────────────────────────────────────────────────────────

  const addSource = useCallback((cfg: CustomSourceConfig) => {
    setConfigs(prev => {
      // Replace if name already exists
      const filtered = prev.filter(c => c.name !== cfg.name);
      return [...filtered, cfg];
    });
  }, [setConfigs]);

  const removeSource = useCallback((name: string) => {
    stopSource(name);
    setConfigs(prev => prev.filter(c => c.name !== name));
    setData(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setErrors(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, [setConfigs, stopSource]);

  return { configs, data, errors, addSource, removeSource };
}
