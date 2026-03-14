import React, { useState, useMemo, useCallback } from 'react';
import { Box, Text, useStdout } from 'ink';
import type { DashboardConfig, PanelConfig } from '../config/schema.js';
import { parseDuration } from '../utils/parseDuration.js';
import { useLiveData } from './hooks/useLiveData.js';
import { useKeyboard } from './hooks/useKeyboard.js';
import { Panel } from './components/Panel.js';
import { Table } from './components/Table.js';
import { BarChart } from './components/BarChart.js';
import { StatBox } from './components/StatBox.js';
import { Sparkline } from './components/Sparkline.js';
import { OrderBook } from './components/OrderBook.js';
import { Heatmap } from './components/Heatmap.js';
import { CandleChart } from './components/CandleChart.js';
import { Layout } from './components/Layout.js';
import { StatusBar } from './components/StatusBar.js';

interface AppProps {
  serverUrl: string;
  dashboard: DashboardConfig;
}

const MemoizedPanelContent = React.memo(function PanelContent({ data, error, viz, focused, loading, panelKey, maxTableRows }: {
  data: unknown;
  error?: string;
  viz: string;
  focused: boolean;
  loading: boolean;
  panelKey: string;
  maxTableRows: number;
}) {
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
    case 'orderbook':
      return <OrderBook data={data} />;
    case 'heatmap':
      return <Heatmap data={rows} />;
    case 'candle':
      return <CandleChart data={Array.isArray(data) ? data : []} />;
    case 'table':
      return <Table data={rows} focused={focused} maxRows={maxTableRows} />;
    case 'auto':
    default:
      if (!Array.isArray(data) || rows.length === 0) return <StatBox data={data} />;
      return <Table data={rows} focused={focused} maxRows={maxTableRows} />;
  }
});

export function App({ serverUrl, dashboard }: AppProps) {
  const [focusedPanel, setFocusedPanel] = useState(0);
  const { stdout } = useStdout();
  const termHeight = stdout?.rows ?? 40;
  const panels = dashboard.panels;
  const refreshMs = dashboard.refresh ? parseDuration(dashboard.refresh) : 10_000;

  // Column weights: each panel gets a width percentage (default 50% each)
  const [colWeights, setColWeights] = useState<number[]>(() =>
    panels.map(() => 50),
  );

  const fixedOverhead = 3; // header + status bar
  const numPanelRows = Math.ceil(panels.length / 2);
  const rowHeight = Math.max(8, Math.floor((termHeight - fixedOverhead) / numPanelRows));
  const panelOverhead = 5; // border + title + padding
  const maxTableRows = Math.max(3, rowHeight - panelOverhead);

  const queries = useMemo(() => panels.map((p) => p.query), [panels]);
  // Use SSE for real-time push, with polling fallback
  const { results, loading, connected, refresh } = useLiveData(serverUrl, queries, refreshMs);

  // Resize handler: grow/shrink focused panel, adjust its row neighbor
  const handleResize = useCallback((direction: 'grow' | 'shrink') => {
    setColWeights(prev => {
      const next = [...prev];
      const rowStart = Math.floor(focusedPanel / 2) * 2;
      const partner = focusedPanel % 2 === 0 ? focusedPanel + 1 : focusedPanel - 1;
      if (partner < 0 || partner >= panels.length) return prev;
      if (partner < rowStart || partner >= rowStart + 2) return prev;
      const delta = direction === 'grow' ? 5 : -5;
      const newVal = Math.min(75, Math.max(25, next[focusedPanel] + delta));
      next[focusedPanel] = newVal;
      next[partner] = 100 - newVal;
      return next;
    });
  }, [focusedPanel, panels.length]);

  useKeyboard({
    panelCount: panels.length,
    focusedPanel,
    setFocusedPanel,
    onRefresh: refresh,
    onResize: handleResize,
  });

  const renderPanel = useCallback((panel: PanelConfig, index: number, focused: boolean) => {
    const result = results.get(panel.query);
    return (
      <Panel title={panel.title} focused={focused}>
        <MemoizedPanelContent
          panelKey={`panel-${index}`}
          data={result?.data ?? null}
          error={result?.error}
          viz={panel.viz}
          focused={focused}
          loading={loading && !result}
          maxTableRows={maxTableRows}
        />
      </Panel>
    );
  }, [results, loading, maxTableRows]);

  return (
    <Box flexDirection="column" height={termHeight}>
      <Box justifyContent="center" paddingX={1}>
        <Text bold color="cyan">PipeQuery Dashboard</Text>
        {connected && <Text color="green"> ● LIVE</Text>}
        {!connected && !loading && <Text color="yellow"> ○ polling</Text>}
      </Box>
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        <Layout
          panels={panels}
          focusedIndex={focusedPanel}
          colWeights={colWeights}
          rowHeight={rowHeight}
          renderPanel={renderPanel}
        />
      </Box>
      <StatusBar serverUrl={serverUrl} refreshMs={refreshMs} />
    </Box>
  );
}
