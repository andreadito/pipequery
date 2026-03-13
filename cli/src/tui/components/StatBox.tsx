import React from 'react';
import { Box, Text } from 'ink';

interface StatBoxProps {
  data: unknown;
}

export function StatBox({ data }: StatBoxProps) {
  let value: string;

  if (Array.isArray(data) && data.length === 1 && typeof data[0] === 'object' && data[0] !== null) {
    const obj = data[0] as Record<string, unknown>;
    const firstVal = Object.values(obj)[0];
    value = formatStat(firstVal);
  } else if (typeof data === 'number' || typeof data === 'string') {
    value = formatStat(data);
  } else {
    value = String(data);
  }

  return (
    <Box justifyContent="center" alignItems="center">
      <Text bold color="green">{value}</Text>
    </Box>
  );
}

function formatStat(val: unknown): string {
  if (typeof val === 'number') {
    if (val >= 1e12) return (val / 1e12).toFixed(2) + 'T';
    if (val >= 1e9) return (val / 1e9).toFixed(2) + 'B';
    if (val >= 1e6) return (val / 1e6).toFixed(2) + 'M';
    if (val >= 1e3) return (val / 1e3).toFixed(2) + 'K';
    return Number.isInteger(val) ? String(val) : val.toFixed(2);
  }
  return String(val ?? '');
}
