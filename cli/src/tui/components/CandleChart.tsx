import React from 'react';
import { Box, Text } from 'ink';

interface CandleChartProps {
  data: unknown[];
}

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  time: number;
}

const CHART_HEIGHT = 14;

export function CandleChart({ data }: CandleChartProps) {
  if (!data.length) return <Text dimColor>Waiting for candle data...</Text>;

  // Parse kline events: { k: { o, h, l, c, t, ... } }
  const candles: Candle[] = data
    .map((item) => {
      const k = (item as Record<string, unknown>).k as Record<string, unknown> | undefined;
      if (!k) return null;
      return {
        open: parseFloat(k.o as string),
        high: parseFloat(k.h as string),
        low: parseFloat(k.l as string),
        close: parseFloat(k.c as string),
        time: k.t as number,
      };
    })
    .filter((c): c is Candle => c !== null);

  // Deduplicate by time (keep latest for each candle)
  const byTime = new Map<number, Candle>();
  for (const c of candles) byTime.set(c.time, c);
  const unique = [...byTime.values()].slice(-20); // last 20 candles

  if (unique.length === 0) return <Text dimColor>Waiting for candle data...</Text>;

  const allHigh = Math.max(...unique.map((c) => c.high));
  const allLow = Math.min(...unique.map((c) => c.low));
  const priceRange = allHigh - allLow || 1;

  // Map price to row (0 = top = highest price)
  const toRow = (price: number) =>
    Math.min(CHART_HEIGHT - 1, Math.max(0, Math.round(((allHigh - price) / priceRange) * (CHART_HEIGHT - 1))));

  // Build output rows
  const priceLabels = Array.from({ length: CHART_HEIGHT }, (_, row) => {
    const price = allHigh - (row / (CHART_HEIGHT - 1)) * priceRange;
    return formatPrice(price);
  });
  const labelWidth = Math.max(...priceLabels.map((l) => l.length));

  // Render each row
  const rows: React.ReactNode[] = [];
  for (let row = 0; row < CHART_HEIGHT; row++) {
    const cells: React.ReactNode[] = [];

    for (let col = 0; col < unique.length; col++) {
      const c = unique[col];
      const bullish = c.close >= c.open;
      const color = bullish ? 'green' : 'red';
      const bodyTop = toRow(Math.max(c.open, c.close));
      const bodyBot = toRow(Math.min(c.open, c.close));
      const wickTop = toRow(c.high);
      const wickBot = toRow(c.low);

      let char: string;
      let cellColor: string;

      if (row >= bodyTop && row <= bodyBot) {
        // Body — use wide block
        char = '███';
        cellColor = color;
      } else if (row >= wickTop && row <= wickBot) {
        // Wick
        char = ' │ ';
        cellColor = color;
      } else {
        char = '   ';
        cellColor = 'white';
      }

      cells.push(
        <Text key={col} color={cellColor as 'green' | 'red' | 'white'}>
          {char}
        </Text>,
      );
    }

    rows.push(
      <Box key={row}>
        <Text dimColor>{priceLabels[row].padStart(labelWidth)} </Text>
        <Text dimColor>│</Text>
        {cells}
      </Box>,
    );
  }

  // Time axis
  const latest = unique[unique.length - 1];
  const oldest = unique[0];
  const fmtTime = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const axisWidth = unique.length * 3;

  return (
    <Box flexDirection="column">
      {rows}
      <Box>
        <Text dimColor>
          {' '.repeat(labelWidth + 1)}└{'─'.repeat(axisWidth)}
        </Text>
      </Box>
      <Box>
        <Text dimColor>
          {' '.repeat(labelWidth + 2)}
          {fmtTime(oldest.time).padEnd(axisWidth - fmtTime(latest.time).length)}
          {fmtTime(latest.time)}
        </Text>
      </Box>
    </Box>
  );
}

function formatPrice(n: number): string {
  if (n >= 1000) return n.toFixed(0);
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}
