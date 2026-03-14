import React, { useState, useEffect, useRef } from 'react';
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

// Scrollbar characters
const SCROLLBAR_TRACK = '│';
const SCROLLBAR_THUMB = '█';

function Scrollbar({ totalRows, visibleRows, scrollOffset, height }: {
  totalRows: number;
  visibleRows: number;
  scrollOffset: number;
  height: number;
}) {
  if (totalRows <= visibleRows) return null;

  const thumbSize = Math.max(1, Math.round((visibleRows / totalRows) * height));
  const maxScroll = totalRows - visibleRows;
  const thumbPosition = maxScroll > 0
    ? Math.round((scrollOffset / maxScroll) * (height - thumbSize))
    : 0;

  const lines: Array<{ char: string; isThumb: boolean }> = [];
  for (let i = 0; i < height; i++) {
    const isThumb = i >= thumbPosition && i < thumbPosition + thumbSize;
    lines.push({ char: isThumb ? SCROLLBAR_THUMB : SCROLLBAR_TRACK, isThumb });
  }

  return (
    <Box flexDirection="column" marginLeft={1}>
      {lines.map((line, i) => (
        <Text key={i} color={line.isThumb ? '#06b6d4' : '#333333'}>{line.char}</Text>
      ))}
    </Box>
  );
}

export function Table({ data, maxRows = 20, focused = false }: TableProps) {
  const [scrollOffset, setScrollOffset] = useState(0);
  const prevDataLenRef = useRef(data.length);

  // Clamp scroll offset when data length changes, but preserve position
  useEffect(() => {
    const maxOffset = Math.max(0, data.length - maxRows);
    setScrollOffset((prev) => Math.min(prev, maxOffset));
    prevDataLenRef.current = data.length;
  }, [data.length, maxRows]);

  useInput((input, key) => {
    if (!focused) return;
    const maxOffset = Math.max(0, data.length - maxRows);
    if (key.upArrow) setScrollOffset((o) => Math.max(0, o - 1));
    if (key.downArrow) setScrollOffset((o) => Math.min(maxOffset, o + 1));
    // Page up/down
    if (key.pageUp || (input === 'u' && key.ctrl)) {
      setScrollOffset((o) => Math.max(0, o - maxRows));
    }
    if (key.pageDown || (input === 'd' && key.ctrl)) {
      setScrollOffset((o) => Math.min(maxOffset, o + maxRows));
    }
  });

  if (!data.length) return <Text dimColor>(empty)</Text>;

  const columns = Object.keys(data[0]);
  const widths = columns.map((col) => {
    const maxData = data.reduce((max, row) => Math.max(max, formatValue(row[col]).length), 0);
    return Math.min(Math.max(col.length, maxData), 30);
  });

  const visibleRows = data.slice(scrollOffset, scrollOffset + maxRows);
  const needsScroll = data.length > maxRows;

  return (
    <Box flexDirection="column">
      <Box>
        <Box flexDirection="column" flexGrow={1}>
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
                  <Text color={typeof row[col] === 'number' ? '#f59e0b' : undefined}>
                    {formatValue(row[col]).slice(0, widths[i]).padEnd(widths[i])}
                  </Text>
                </Box>
              ))}
            </Box>
          ))}
        </Box>
        {/* Scrollbar */}
        {needsScroll && (
          <Scrollbar
            totalRows={data.length}
            visibleRows={maxRows}
            scrollOffset={scrollOffset}
            height={visibleRows.length + 2}
          />
        )}
      </Box>
      {/* Scroll info */}
      {needsScroll && (
        <Text dimColor>
          {scrollOffset + 1}–{Math.min(scrollOffset + maxRows, data.length)} of {data.length} rows
          {focused ? ' │ ↑↓ scroll' : ''}
        </Text>
      )}
    </Box>
  );
}
