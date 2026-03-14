import React, { useState, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  serverUrl: string;
  refreshMs: number;
}

export function StatusBar({ serverUrl, refreshMs }: StatusBarProps) {
  const [status, setStatus] = useState<{ uptime: number; sources: number } | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${serverUrl}/status`);
        const data = await res.json() as { uptime: number; sources: Record<string, unknown> };
        setStatus({ uptime: data.uptime, sources: Object.keys(data.sources).length });
      } catch {
        setStatus(null);
      }
    };
    fetchStatus();
    const timer = setInterval(fetchStatus, refreshMs);
    return () => clearInterval(timer);
  }, [serverUrl, refreshMs]);

  const uptimeStr = status ? formatUptime(status.uptime) : '—';
  const sourcesStr = status ? `${status.sources} source(s)` : 'disconnected';
  const refreshStr = `${Math.floor(refreshMs / 1000)}s`;

  return (
    <Box justifyContent="space-between" paddingX={1} borderStyle="single" borderColor="gray" borderTop={false} borderLeft={false} borderRight={false}>
      <Box gap={2}>
        <Text dimColor>server: {serverUrl}</Text>
        <Text dimColor>uptime: {uptimeStr}</Text>
        <Text dimColor>{sourcesStr}</Text>
      </Box>
      <Box gap={2}>
        <Text dimColor>refresh: {refreshStr}</Text>
        <Text dimColor>q: quit  tab: focus  ↑↓: scroll  []: resize  r: refresh</Text>
      </Box>
    </Box>
  );
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}
