import React from 'react';
import { Box } from 'ink';
import type { PanelConfig } from '../../config/schema.js';

interface LayoutProps {
  panels: PanelConfig[];
  focusedIndex: number;
  colWeights: number[];
  rowHeight: number;
  renderPanel: (panel: PanelConfig, index: number, focused: boolean) => React.ReactNode;
}

export function Layout({ panels, focusedIndex, colWeights, rowHeight, renderPanel }: LayoutProps) {
  // Group panels into rows of 2
  const rows: { panel: PanelConfig; index: number }[][] = [];
  for (let i = 0; i < panels.length; i += 2) {
    const row: { panel: PanelConfig; index: number }[] = [{ panel: panels[i], index: i }];
    if (i + 1 < panels.length) {
      row.push({ panel: panels[i + 1], index: i + 1 });
    }
    rows.push(row);
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      {rows.map((row, rowIdx) => (
        <Box key={rowIdx} flexDirection="row" height={rowHeight}>
          {row.map(({ panel, index }) => {
            const width = row.length === 1
              ? '100%'
              : `${colWeights[index]}%`;
            return (
              <Box key={index} width={width} minWidth={20}>
                {renderPanel(panel, index, index === focusedIndex)}
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}
