import { useEffect, useRef } from 'react';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { Box } from '@mui/material';
import { themedPipeQuery } from './themedPipeQuery';
import { C, alpha, FONT_MONO } from '../tokens';

const cmTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'transparent',
      color: C.text,
      fontFamily: FONT_MONO,
      fontSize: '0.72rem',
      lineHeight: '1.5',
    },
    '.cm-content': { padding: '2px 0', caretColor: 'transparent' },
    '.cm-line': { padding: '0 2px' },
    '&.cm-focused': { outline: 'none' },
    '.cm-cursor': { display: 'none' },
    '.cm-selectionBackground': { backgroundColor: `${alpha(C.blue, 0.15)} !important` },
    '.cm-gutters': { display: 'none' },
    '.cm-scroller': { overflow: 'hidden' },
    '.cm-activeLine': { backgroundColor: 'transparent' },
  },
);

/** Format a single-line pipe query into multi-line (one step per line). */
export function formatQuery(q: string): string {
  return q
    .replace(/\s*\|\s*/g, '\n| ')
    .trim();
}

interface QueryDisplayProps {
  value: string;
  onClick?: () => void;
}

export default function QueryDisplay({ value, onClick }: QueryDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const formatted = formatQuery(value);

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: formatted,
      extensions: [
        cmTheme,
        themedPipeQuery({ completion: false }),
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync value changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== formatted) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: formatted } });
    }
  }, [formatted]);

  return (
    <Box
      ref={containerRef}
      onClick={onClick}
      sx={{
        bgcolor: C.bg,
        border: '1px solid',
        borderColor: C.border,
        px: 1,
        py: 0.5,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.15s',
        '&:hover': onClick
          ? { borderColor: C.borderHover }
          : {},
      }}
    />
  );
}
