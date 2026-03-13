import { useInput, useApp } from 'ink';

interface KeyboardOptions {
  panelCount: number;
  focusedPanel: number;
  setFocusedPanel: (fn: (i: number) => number) => void;
  onRefresh?: () => void;
}

export function useKeyboard({ panelCount, focusedPanel, setFocusedPanel, onRefresh }: KeyboardOptions) {
  const { exit } = useApp();

  useInput((input, key) => {
    if (input === 'q') exit();
    if (input === 'r') onRefresh?.();
    if (key.tab && !key.shift) setFocusedPanel((i) => (i + 1) % panelCount);
    if (key.tab && key.shift) setFocusedPanel((i) => (i - 1 + panelCount) % panelCount);
  });
}
