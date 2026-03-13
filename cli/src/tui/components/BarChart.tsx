import React from 'react';
import { Box, Text } from 'ink';

interface BarChartProps {
  data: Record<string, unknown>[];
  maxBars?: number;
}

const BLOCK = '█';
const MAX_BAR_WIDTH = 40;

export function BarChart({ data, maxBars = 10 }: BarChartProps) {
  if (!data.length) return <Text dimColor>(empty)</Text>;

  const keys = Object.keys(data[0]);
  const labelKey = keys[0];
  const valueKey = keys.find((k) => typeof data[0][k] === 'number') ?? keys[1];

  const items = data.slice(0, maxBars).map((row) => ({
    label: String(row[labelKey] ?? ''),
    value: Number(row[valueKey]) || 0,
  }));

  const maxValue = Math.max(...items.map((i) => i.value), 1);
  const maxLabelLen = Math.max(...items.map((i) => i.label.length), 1);

  return (
    <Box flexDirection="column">
      {items.map((item, i) => {
        const barLen = Math.round((item.value / maxValue) * MAX_BAR_WIDTH);
        return (
          <Box key={i}>
            <Text>{item.label.padEnd(maxLabelLen)} </Text>
            <Text color="cyan">{BLOCK.repeat(Math.max(1, barLen))}</Text>
            <Text dimColor> {formatNum(item.value)}</Text>
          </Box>
        );
      })}
    </Box>
  );
}

function formatNum(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
