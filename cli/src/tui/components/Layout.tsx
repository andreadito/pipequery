import React from 'react';
import { Box } from 'ink';
import type { PanelConfig } from '../../config/schema.js';

interface LayoutProps {
  panels: PanelConfig[];
  focusedIndex: number;
  renderPanel: (panel: PanelConfig, index: number, focused: boolean) => React.ReactNode;
}

export function Layout({ panels, focusedIndex, renderPanel }: LayoutProps) {
  return (
    <Box flexDirection="row" flexWrap="wrap">
      {panels.map((panel, i) => {
        const width = getWidth(panel.size);
        return (
          <Box key={i} width={width} minWidth={30}>
            {renderPanel(panel, i, i === focusedIndex)}
          </Box>
        );
      })}
    </Box>
  );
}

function getWidth(size?: string): string {
  switch (size) {
    case 'full': return '100%';
    case 'stat': return '25%';
    case 'half':
    default: return '50%';
  }
}
