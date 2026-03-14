import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SourceStatus {
  healthy: boolean;
  rowCount: number;
  lastFetch: string | null;
  error?: string;
}

interface ServerInfo {
  status: string;
  uptime: number;
  sources: Record<string, SourceStatus>;
}

interface EndpointInfo {
  query: string;
  cache?: string;
  method?: string;
}

interface ActivityEntry {
  time: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

function useServerStatus(serverUrl: string, refreshMs: number) {
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${serverUrl}/status`);
        const data = await res.json() as ServerInfo;
        setInfo(data);
        setConnected(true);
      } catch {
        setInfo(null);
        setConnected(false);
      }
    };
    fetchStatus();
    const timer = setInterval(fetchStatus, refreshMs);
    return () => clearInterval(timer);
  }, [serverUrl, refreshMs]);

  return { info, connected };
}

function useEndpoints(serverUrl: string, refreshMs: number) {
  const [endpoints, setEndpoints] = useState<Record<string, EndpointInfo>>({});

  useEffect(() => {
    const fetchEndpoints = async () => {
      try {
        const res = await fetch(`${serverUrl}/api/_control/endpoints`);
        const data = await res.json() as Record<string, EndpointInfo>;
        setEndpoints(data);
      } catch {
        // ignore
      }
    };
    fetchEndpoints();
    const timer = setInterval(fetchEndpoints, refreshMs);
    return () => clearInterval(timer);
  }, [serverUrl, refreshMs]);

  return endpoints;
}

function useActivityLog(serverUrl: string, refreshMs: number, maxLines: number) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const res = await fetch(`${serverUrl}/api/_control/activity`);
        const data = await res.json() as ActivityEntry[];
        setEntries(data.slice(-maxLines));
      } catch {
        // ignore
      }
    };
    fetchActivity();
    const timer = setInterval(fetchActivity, refreshMs);
    return () => clearInterval(timer);
  }, [serverUrl, refreshMs, maxLines]);

  return entries;
}

// ─── Components ─────────────────────────────────────────────────────────────

function Header({ connected, uptime }: { connected: boolean; uptime: number }) {
  return (
    <Box paddingX={1} justifyContent="space-between">
      <Box gap={1}>
        <Text bold color="#06b6d4">⬡</Text>
        <Text bold color="#06b6d4">PipeQuery Monitor</Text>
      </Box>
      <Box gap={2}>
        <Text color={connected ? '#22c55e' : '#ef4444'}>
          {connected ? '● connected' : '● disconnected'}
        </Text>
        <Text dimColor>uptime: {formatUptime(uptime)}</Text>
      </Box>
    </Box>
  );
}

function SourcesPanel({ sources }: { sources: Record<string, SourceStatus> }) {
  const entries = Object.entries(sources);
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="#4f46e5" paddingX={1}>
      <Box marginBottom={0}>
        <Text bold color="#4f46e5"> Sources ({entries.length}) </Text>
      </Box>
      {entries.length === 0 ? (
        <Text dimColor>  No sources configured</Text>
      ) : (
        <>
          <Box>
            <Box width={20}><Text dimColor bold>NAME</Text></Box>
            <Box width={10}><Text dimColor bold>STATUS</Text></Box>
            <Box width={10}><Text dimColor bold>ROWS</Text></Box>
            <Box width={22}><Text dimColor bold>LAST FETCH</Text></Box>
            <Box><Text dimColor bold>ERROR</Text></Box>
          </Box>
          {entries.map(([name, status]) => (
            <Box key={name}>
              <Box width={20}><Text color="#06b6d4">{name}</Text></Box>
              <Box width={10}>
                <Text color={status.healthy ? '#22c55e' : '#ef4444'}>
                  {status.healthy ? '✓ ok' : '✗ err'}
                </Text>
              </Box>
              <Box width={10}><Text>{String(status.rowCount)}</Text></Box>
              <Box width={22}>
                <Text dimColor>
                  {status.lastFetch ? new Date(status.lastFetch).toLocaleTimeString() : '—'}
                </Text>
              </Box>
              <Box><Text color="#ef4444">{status.error ?? ''}</Text></Box>
            </Box>
          ))}
        </>
      )}
    </Box>
  );
}

function EndpointsPanel({ endpoints, serverUrl }: { endpoints: Record<string, EndpointInfo>; serverUrl: string }) {
  const entries = Object.entries(endpoints);
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="#7c3aed" paddingX={1}>
      <Box marginBottom={0}>
        <Text bold color="#7c3aed"> Endpoints ({entries.length}) </Text>
      </Box>
      {entries.length === 0 ? (
        <Text dimColor>  No endpoints registered</Text>
      ) : (
        <>
          <Box>
            <Box width={30}><Text dimColor bold>PATH</Text></Box>
            <Box width={10}><Text dimColor bold>CACHE</Text></Box>
            <Box><Text dimColor bold>QUERY</Text></Box>
          </Box>
          {entries.map(([path, config]) => (
            <Box key={path}>
              <Box width={30}><Text color="#06b6d4">{serverUrl}{path}</Text></Box>
              <Box width={10}><Text dimColor>{config.cache ?? '—'}</Text></Box>
              <Box><Text>{config.query}</Text></Box>
            </Box>
          ))}
        </>
      )}
    </Box>
  );
}

function ActivityPanel({ entries }: { entries: ActivityEntry[] }) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
      <Box marginBottom={0}>
        <Text bold color="gray"> Activity Log </Text>
      </Box>
      {entries.length === 0 ? (
        <Text dimColor>  No activity yet — run queries, add sources, or hit endpoints</Text>
      ) : (
        entries.map((entry, i) => {
          const time = new Date(entry.time).toLocaleTimeString();
          const levelColor = entry.level === 'error' ? '#ef4444' : entry.level === 'warn' ? '#f59e0b' : '#22c55e';
          const levelIcon = entry.level === 'error' ? '✗' : entry.level === 'warn' ? '⚠' : '→';
          return (
            <Box key={i} gap={1}>
              <Text dimColor>{time}</Text>
              <Text color={levelColor}>{levelIcon}</Text>
              <Text color={entry.level === 'error' ? '#ef4444' : undefined}>
                {entry.message}
              </Text>
            </Box>
          );
        })
      )}
    </Box>
  );
}

function HelpBar() {
  return (
    <Box paddingX={1} justifyContent="center" gap={3}>
      <Text dimColor>q: quit</Text>
      <Text dimColor>r: refresh</Text>
      <Text dimColor>auto-refresh: 2s</Text>
    </Box>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

// ─── Main App ───────────────────────────────────────────────────────────────

interface MonitorAppProps {
  serverUrl: string;
  logPath?: string;
}

export function MonitorApp({ serverUrl }: MonitorAppProps) {
  const { exit } = useApp();
  const { info, connected } = useServerStatus(serverUrl, 2000);
  const endpoints = useEndpoints(serverUrl, 5000);
  const activityEntries = useActivityLog(serverUrl, 2000, 15);
  const [, setTick] = useState(0);

  useInput((input) => {
    if (input === 'q') exit();
    if (input === 'r') setTick((t) => t + 1);
  });

  const sources = info?.sources ?? {};
  const uptime = info?.uptime ?? 0;

  return (
    <Box flexDirection="column" padding={0}>
      <Header connected={connected} uptime={uptime} />
      <Box height={1} />
      <SourcesPanel sources={sources} />
      <Box height={1} />
      <EndpointsPanel endpoints={endpoints} serverUrl={serverUrl} />
      <Box height={1} />
      <ActivityPanel entries={activityEntries} />
      <HelpBar />
    </Box>
  );
}
