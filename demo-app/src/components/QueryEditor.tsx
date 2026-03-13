import { useEffect, useRef } from 'react';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { pipeQuery } from '../../../src/highlighting/codemirror/index';
import { Box } from '@mui/material';
import { formatQuery } from './QueryDisplay';

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
    // Autocomplete dropdown dark theme
    '.cm-tooltip': {
      backgroundColor: '#1a1f2e !important',
      border: '1px solid rgba(91,156,246,0.25) !important',
      borderRadius: '6px',
    },
    '.cm-tooltip-autocomplete': {
      '& > ul': {
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: '0.75rem',
      },
      '& > ul > li': {
        padding: '3px 8px',
      },
      '& > ul > li[aria-selected]': {
        backgroundColor: 'rgba(91,156,246,0.2) !important',
        color: '#e0e6ed',
      },
    },
    '.cm-completionLabel': { color: '#e0e6ed' },
    '.cm-completionDetail': { color: '#546e7a', fontStyle: 'italic', marginLeft: '8px' },
    '.cm-completionMatchedText': { color: '#ffcb6b', textDecoration: 'none', fontWeight: '600' },
    '.cm-completionIcon': { opacity: '0.7' },
  },
  { dark: true },
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
        pipeQuery({
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
