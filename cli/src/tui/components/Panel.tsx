import React from 'react';
import { Box, Text } from 'ink';

interface PanelProps {
  title: string;
  focused?: boolean;
  loading?: boolean;
  error?: string;
  children: React.ReactNode;
}

export function Panel({ title, focused = false, loading = false, error, children }: PanelProps) {
  const borderColor = focused ? 'cyan' : 'gray';

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
      overflow="hidden"
    >
      <Box>
        <Text bold color={focused ? 'cyan' : undefined}>{title}</Text>
        {loading && <Text dimColor> ↻</Text>}
      </Box>
      {error ? (
        <Text color="red">{error}</Text>
      ) : (
        children
      )}
    </Box>
  );
}
