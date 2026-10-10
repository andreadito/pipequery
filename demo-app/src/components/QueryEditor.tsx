import { useEffect, useRef } from 'react';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { Box } from '@mui/material';
import { formatQuery } from './QueryDisplay';
import { themedPipeQuery } from './themedPipeQuery';
import { C, alpha, FONT_MONO } from '../tokens';

/** Flatten a multi-line query back to a single-line pipe string. */
function flattenQuery(q: string): string {
  return q
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s*\|\s*/g, ' | ');
}

const cmTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'transparent',
      color: C.text,
      fontFamily: FONT_MONO,
      fontSize: '0.78rem',
      lineHeight: '1.6',
    },
    '.cm-content': { padding: '4px 0', caretColor: C.text },
    '.cm-line': { padding: '0 2px' },
    '&.cm-focused': { outline: 'none' },
    '.cm-cursor': { borderLeftColor: C.blue },
    '.cm-selectionBackground': { backgroundColor: `${alpha(C.blue, 0.2)} !important` },
    '&.cm-focused .cm-selectionBackground': { backgroundColor: `${alpha(C.blue, 0.3)} !important` },
    '.cm-gutters': { display: 'none' },
    '.cm-scroller': { overflow: 'auto' },
    // Autocomplete dropdown
    '.cm-tooltip': {
      backgroundColor: `${C.surface} !important`,
      color: C.text,
      border: `1px solid ${C.borderHover} !important`,
    },
    '.cm-tooltip-autocomplete': {
      '& > ul': {
        fontFamily: FONT_MONO,
        fontSize: '0.75rem',
      },
      '& > ul > li': {
        padding: '3px 8px',
      },
      '& > ul > li[aria-selected]': {
        backgroundColor: `${alpha(C.blue, 0.16)} !important`,
        color: C.text,
      },
    },
    '.cm-completionLabel': { color: C.text },
    '.cm-completionDetail': { color: C.textDim, fontStyle: 'italic', marginLeft: '8px' },
    '.cm-completionMatchedText': { color: C.blue, textDecoration: 'none', fontWeight: '600' },
    '.cm-completionIcon': { opacity: '0.7' },
  },
);

interface QueryEditorProps {
  value: string;
  onChange: (value: string) => void;
  fields?: string[];
  sources?: string[];
}

export default function QueryEditor({ value, onChange, fields, sources }: QueryEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Ref-based getters so completion always sees current values
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;

  // Format for display in editor
  const formatted = formatQuery(value);

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: formatted,
      extensions: [
        cmTheme,
        themedPipeQuery({
          completion: {
            fields: () => fieldsRef.current ?? [],
            sources: () => sourcesRef.current ?? [],
          },
        }),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            // Flatten multi-line back to single-line for storage
            onChangeRef.current(flattenQuery(update.state.doc.toString()));
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
    const current = flattenQuery(view.state.doc.toString());
    const incoming = flattenQuery(value);
    if (current !== incoming) {
      const newFormatted = formatQuery(value);
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: newFormatted } });
    }
  }, [value]);

  return (
    <Box
      ref={containerRef}
      sx={{
        bgcolor: C.bg,
        border: '1px solid',
        borderColor: C.border,
        p: 1,
        minHeight: 36,
        transition: 'border-color 0.15s',
        '&:focus-within': { borderColor: C.blue },
      }}
    />
  );
}
