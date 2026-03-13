import { useEffect, useRef } from 'react';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { pipeQuery } from '../../../src/highlighting/codemirror/index';
import { Box } from '@mui/material';

const cmTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'transparent',
      color: '#e0e6ed',
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: '0.78rem',
      lineHeight: '1.6',
    },
    '.cm-content': { padding: '4px 0', caretColor: '#e0e6ed' },
    '.cm-line': { padding: '0 2px' },
    '&.cm-focused': { outline: 'none' },
    '.cm-cursor': { borderLeftColor: '#5b9cf6' },
    '.cm-selectionBackground': { backgroundColor: 'rgba(91,156,246,0.2) !important' },
    '&.cm-focused .cm-selectionBackground': { backgroundColor: 'rgba(91,156,246,0.3) !important' },
    '.cm-gutters': { display: 'none' },
    '.cm-scroller': { overflow: 'auto' },
  },
  { dark: true },
);

interface QueryEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function QueryEditor({ value, onChange }: QueryEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        cmTheme,
        pipeQuery(),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only re-create on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  return (
    <Box
      ref={containerRef}
      sx={{
        bgcolor: 'rgba(0,0,0,0.3)',
        borderRadius: 1,
        border: '1px solid rgba(91,156,246,0.2)',
        p: 1,
        minHeight: 36,
        '&:focus-within': { borderColor: 'rgba(91,156,246,0.5)' },
      }}
    />
  );
}
