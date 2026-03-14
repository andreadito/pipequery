import React from 'react';
import { Box, Text } from 'ink';

interface HeatmapProps {
  data: Record<string, unknown>[];
}

export function Heatmap({ data }: HeatmapProps) {
  if (!data.length) return <Text dimColor>(empty)</Text>;

  const keys = Object.keys(data[0]);
  const labelKey = keys[0];
  // Include keys that are numeric OR string-encoded numbers (like Binance data)
  const numericKeys = keys.filter((k) => {
    const v = data[0][k];
    return typeof v === 'number' || (typeof v === 'string' && v !== '' && !isNaN(Number(v)));
  });

  if (numericKeys.length === 0) return <Text dimColor>No numeric columns for heatmap</Text>;

  // Compute min/max per column for normalization
  const ranges = new Map<string, { min: number; max: number }>();
  for (const key of numericKeys) {
    const vals = data.map((r) => Number(r[key]) || 0);
    ranges.set(key, { min: Math.min(...vals), max: Math.max(...vals) });
  }

  const maxLabel = Math.max(...data.map((r) => String(r[labelKey] ?? '').length), 6);
  const colWidth = 10;

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box>
        <Text dimColor>{' '.repeat(maxLabel + 1)}</Text>
        {numericKeys.map((k) => (
          <Text key={k} dimColor>
            {k.slice(0, colWidth).padStart(colWidth)}
          </Text>
        ))}
      </Box>
      {/* Rows */}
      {data.slice(0, 20).map((row, i) => (
        <Box key={i}>
          <Text bold>
            {String(row[labelKey] ?? '').slice(0, maxLabel).padEnd(maxLabel)}
          </Text>
          <Text> </Text>
          {numericKeys.map((k) => {
            const val = Number(row[k]) || 0;
            const range = ranges.get(k)!;
            const norm = range.max === range.min
              ? 0.5
              : (val - range.min) / (range.max - range.min);
            const color = interpolateColor(norm);
            const display = formatCell(val);
            return (
              <Text key={k} backgroundColor={color} color="white">
                {display.padStart(colWidth)}
              </Text>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}

function interpolateColor(t: number): string {
  // Red (0.0) → Yellow (0.5) → Green (1.0)
  let r: number, g: number, b: number;
  if (t < 0.5) {
    const s = t * 2;
    r = 180;
    g = Math.round(s * 180);
    b = 30;
  } else {
    const s = (t - 0.5) * 2;
    r = Math.round(180 * (1 - s));
    g = 180;
    b = 30;
  }
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function formatCell(n: number): string {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}
