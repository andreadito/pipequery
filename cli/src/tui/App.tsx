import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import type { DashboardConfig, PanelConfig } from '../config/schema.js';
import { parseDuration } from '../utils/parseDuration.js';
import { useServerData } from './hooks/useServerData.js';
import { useKeyboard } from './hooks/useKeyboard.js';
import { Panel } from './components/Panel.js';
import { Table } from './components/Table.js';
import { BarChart } from './components/BarChart.js';
import { StatBox } from './components/StatBox.js';
import { Sparkline } from './components/Sparkline.js';
import { Layout } from './components/Layout.js';
import { StatusBar } from './components/StatusBar.js';

interface AppProps {
  serverUrl: string;
  dashboard: DashboardConfig;
}

function PanelContent({ serverUrl, query, viz, refreshMs, focused }: {
  serverUrl: string;
  query: string;
  viz: string;
  refreshMs: number;
  focused: boolean;
}) {
  const { data, loading, error } = useServerData(serverUrl, query, refreshMs);

  if (error) return <Text color="red">{error}</Text>;
  if (loading || data == null) return <Text dimColor>Loading...</Text>;

  const rows = Array.isArray(data) ? data as Record<string, unknown>[] : [];

  switch (viz) {
    case 'bar':
      return <BarChart data={rows} />;
    case 'stat':
      return <StatBox data={data} />;
    case 'sparkline':
      return <Sparkline data={rows} />;
    case 'table':
      return <Table data={rows} focused={focused} />;
    case 'auto':
    default:
      // Auto-detect: scalar → stat, otherwise table
      if (!Array.isArray(data) || rows.length === 0) return <StatBox data={data} />;
      return <Table data={rows} focused={focused} />;
  }
}

export function App({ serverUrl, dashboard }: AppProps) {
  const [focusedPanel, setFocusedPanel] = useState(0);
  const panels = dashboard.panels;
  const refreshMs = dashboard.refresh ? parseDuration(dashboard.refresh) : 10_000;

  const handleRefresh = useCallback(() => {
    // Force re-render triggers new fetches in useServerData
    setFocusedPanel((i) => i);
  }, []);

  useKeyboard({
    panelCount: panels.length,
    focusedPanel,
    setFocusedPanel,
    onRefresh: handleRefresh,
  });

  return (
    <Box flexDirection="column">
      <Box justifyContent="center" paddingX={1} marginBottom={1}>
        <Text bold color="cyan">PipeQuery Dashboard</Text>
      </Box>
      <Layout
        panels={panels}
        focusedIndex={focusedPanel}
        renderPanel={(panel: PanelConfig, index: number, focused: boolean) => (
          <Panel title={panel.title} focused={focused}>
            <PanelContent
              serverUrl={serverUrl}
              query={panel.query}
              viz={panel.viz}
              refreshMs={refreshMs}
              focused={focused}
            />
          </Panel>
        )}
      />
      <StatusBar serverUrl={serverUrl} refreshMs={refreshMs} />
    </Box>
  );
}
