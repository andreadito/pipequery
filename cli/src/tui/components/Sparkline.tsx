import React from 'react';
import { Box, Text } from 'ink';

interface SparklineProps {
  data: Record<string, unknown>[];
  maxPoints?: number;
}

// Braille-based sparkline characters (8 levels)
const TICKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

export function Sparkline({ data, maxPoints = 60 }: SparklineProps) {
  if (!data.length) return <Text dimColor>(empty)</Text>;

  const keys = Object.keys(data[0]);
  const labelKey = keys[0];
  const valueKey = keys.find((k) => typeof data[0][k] === 'number') ?? keys[1];

  if (!valueKey) return <Text dimColor>(no numeric column)</Text>;

  const points = data.slice(-maxPoints);
  const values = points.map((row) => Number(row[valueKey]) || 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const spark = values.map((v) => {
    const level = Math.round(((v - min) / range) * (TICKS.length - 1));
    return TICKS[Math.max(0, Math.min(TICKS.length - 1, level))];
  }).join('');

  const lastLabel = points.length > 0 ? String(points[points.length - 1][labelKey] ?? '') : '';
  const lastValue = values[values.length - 1];

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="cyan">{spark}</Text>
      </Box>
      <Box gap={2}>
        <Text dimColor>min: {formatNum(min)}</Text>
        <Text dimColor>max: {formatNum(max)}</Text>
        <Text dimColor>last: {formatNum(lastValue)}</Text>
        {lastLabel && <Text dimColor>({lastLabel})</Text>}
      </Box>
    </Box>
  );
}

function formatNum(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
