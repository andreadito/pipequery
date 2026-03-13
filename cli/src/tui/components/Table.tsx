import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface TableProps {
  data: Record<string, unknown>[];
  maxRows?: number;
  focused?: boolean;
}

function formatValue(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'number') return Number.isInteger(val) ? String(val) : val.toFixed(2);
  return String(val);
}

export function Table({ data, maxRows = 20, focused = false }: TableProps) {
  const [scrollOffset, setScrollOffset] = useState(0);

  useInput((input, key) => {
    if (!focused) return;
    if (key.upArrow) setScrollOffset((o) => Math.max(0, o - 1));
    if (key.downArrow) setScrollOffset((o) => Math.min(Math.max(0, data.length - maxRows), o + 1));
  });

  if (!data.length) return <Text dimColor>(empty)</Text>;

  const columns = Object.keys(data[0]);
  const widths = columns.map((col) => {
    const maxData = data.reduce((max, row) => Math.max(max, formatValue(row[col]).length), 0);
    return Math.min(Math.max(col.length, maxData), 30);
  });

  const visibleRows = data.slice(scrollOffset, scrollOffset + maxRows);

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box>
        {columns.map((col, i) => (
          <Box key={col} width={widths[i] + 2}>
            <Text bold>{col.slice(0, widths[i]).padEnd(widths[i])}</Text>
          </Box>
        ))}
      </Box>
      {/* Separator */}
      <Box>
        <Text dimColor>{widths.map((w) => '─'.repeat(w)).join('──')}</Text>
      </Box>
      {/* Rows */}
      {visibleRows.map((row, ri) => (
        <Box key={ri}>
          {columns.map((col, i) => (
            <Box key={col} width={widths[i] + 2}>
              <Text>{formatValue(row[col]).slice(0, widths[i]).padEnd(widths[i])}</Text>
            </Box>
          ))}
        </Box>
      ))}
      {data.length > maxRows && (
        <Text dimColor>
          {scrollOffset + 1}–{Math.min(scrollOffset + maxRows, data.length)} of {data.length} rows
        </Text>
      )}
    </Box>
  );
}
