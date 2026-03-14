import { useInput, useApp } from 'ink';

interface KeyboardOptions {
  panelCount: number;
  focusedPanel: number;
  setFocusedPanel: (fn: (i: number) => number) => void;
  onRefresh?: () => void;
  onResize?: (direction: 'grow' | 'shrink') => void;
}

export function useKeyboard({ panelCount, focusedPanel, setFocusedPanel, onRefresh, onResize }: KeyboardOptions) {
  const { exit } = useApp();

  useInput((input, key) => {
    if (input === 'q') exit();
    if (input === 'r') onRefresh?.();
    if (key.tab && !key.shift) setFocusedPanel((i) => (i + 1) % panelCount);
    if (key.tab && key.shift) setFocusedPanel((i) => (i - 1 + panelCount) % panelCount);
    // Resize: [ to shrink, ] to grow focused panel
    if (input === ']') onResize?.('grow');
    if (input === '[') onResize?.('shrink');
  });
}
