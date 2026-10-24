import { useEffect, useMemo, useRef, useState } from 'react';
import { transform } from 'sucrase';
import { Alert, Box, Button, FormControl, MenuItem, Select, Typography } from '@mui/material';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import type { DataContext } from '@andreadito/pipequery-lang';
import * as engine from '@andreadito/pipequery-lang';
import * as builder from '@andreadito/pipequery-lang/builder';
import { C, alpha, FONT_MONO, FONT_SANS } from '../tokens';
import filterSort from './builder-examples/filter-sort.ts?raw';
import selectIf from './builder-examples/select-if.ts?raw';
import groupAggregate from './builder-examples/group-aggregate.ts?raw';
import join from './builder-examples/join.ts?raw';
import rollup from './builder-examples/rollup.ts?raw';
import windowFunctions from './builder-examples/window.ts?raw';
import terminalAggregate from './builder-examples/terminal-aggregate.ts?raw';
import pipe from './builder-examples/pipe.ts?raw';
import stressFilter from './builder-examples/stress-filter.ts?raw';

const mono = FONT_MONO;
const sans = FONT_SANS;

const BUILDER_EXAMPLES = [
  { id: 'filter-sort', label: 'Filter + sort', dataset: 'products', code: filterSort },
  { id: 'select-if', label: 'Select + conditional', dataset: 'products', code: selectIf },
  { id: 'group-aggregate', label: 'Group + aggregate', dataset: 'products', code: groupAggregate },
  { id: 'join', label: 'Join', dataset: 'orders', code: join },
  { id: 'rollup', label: 'Rollup', dataset: 'sales', code: rollup },
  { id: 'window', label: 'Window functions', dataset: 'trades', code: windowFunctions },
  { id: 'terminal-aggregate', label: 'Terminal aggregate', dataset: 'employees', code: terminalAggregate },
  { id: 'pipe', label: 'Raw pipe escape hatch', dataset: 'products', code: pipe },
  { id: 'stress-filter', label: 'Stress filter', dataset: 'stress', code: stressFilter },
];

interface TypeScriptPanelProps {
  dataContext: DataContext;
  selectedDataset: string;
  onDatasetChange: (dataset: string) => void;
  setQueryText: (query: string) => void;
  onOpenInEditor: () => void;
}

interface BuiltQuery {
  toString: () => string;
  run: (context: DataContext) => unknown;
}

function TypeScriptEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;
    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          EditorView.theme({
            '&': { height: '100%', color: C.text, backgroundColor: 'transparent', fontFamily: mono, fontSize: '0.8rem', lineHeight: '1.55' },
            '.cm-content': { padding: '14px 16px', minHeight: 280, caretColor: C.text },
            '.cm-line': { padding: 0 },
            '.cm-cursor': { borderLeftColor: C.text },
            '.cm-selectionBackground': { backgroundColor: `${alpha(C.blue, 0.2)} !important` },
            '&.cm-focused': { outline: 'none' },
            '.cm-scroller': { overflow: 'auto' },
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          }),
          EditorView.lineWrapping,
        ],
      }),
      parent: containerRef.current,
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  }, [value]);

  return <Box ref={containerRef} sx={{ height: '100%', minHeight: 280, overflow: 'hidden' }} />;
}

function evaluateBuilderCode(code: string, dataContext: DataContext): { queryText: string; result: unknown } {
  const compiled = transform(code, { transforms: ['typescript', 'imports'], filePath: 'query.ts' }).code;
  const exports: { default?: unknown } = {};
  const require = (specifier: string): unknown => {
    if (specifier === '@andreadito/pipequery-lang/builder') return builder;
    if (specifier === '@andreadito/pipequery-lang') return engine;
    throw new Error(`Cannot resolve import "${specifier}" in the playground`);
  };

  new Function('require', 'exports', compiled)(require, exports);
  const value = exports.default as Partial<BuiltQuery> | undefined;
  if (!value || typeof value.toString !== 'function' || typeof value.run !== 'function') {
    throw new Error('Export a query or scalar as the module default, for example: export default from<Row>("items")');
  }
  return { queryText: value.toString(), result: value.run(dataContext) };
}

export default function TypeScriptPanel({
  dataContext,
  selectedDataset,
  onDatasetChange,
  setQueryText,
  onOpenInEditor,
}: TypeScriptPanelProps) {
  const examples = BUILDER_EXAMPLES.filter((example) => example.dataset === selectedDataset);
  const [selectedExampleId, setSelectedExampleId] = useState('filter-sort');
  const selectedExample = examples.find((example) => example.id === selectedExampleId) ?? examples[0];
  const [code, setCode] = useState(selectedExample?.code ?? '');

  useEffect(() => {
    if (!selectedExample) return;
    setSelectedExampleId(selectedExample.id);
    setCode(selectedExample.code);
  }, [selectedExample?.id]);

  const evaluated = useMemo(() => {
    try {
      return { value: evaluateBuilderCode(code, dataContext), error: null as string | null };
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      return { value: null, error: message };
    }
  }, [code, dataContext]);

  const handleExampleChange = (id: string) => {
    const example = BUILDER_EXAMPLES.find((item) => item.id === id);
    if (!example) return;
    setSelectedExampleId(id);
    setCode(example.code);
    if (example.dataset !== selectedDataset) onDatasetChange(example.dataset);
  };

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: C.bg }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 0.8, bgcolor: C.surfaceAlt, borderBottom: '1px solid', borderColor: C.border }}>
        <Typography sx={{ fontFamily: mono, fontSize: '0.72rem', color: C.textDim, whiteSpace: 'nowrap' }}>TypeScript builder</Typography>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <Select
            value={selectedExample?.id ?? ''}
            onChange={(event) => handleExampleChange(event.target.value)}
            sx={{ fontFamily: sans, fontSize: '0.75rem', height: 30, '& .MuiSelect-select': { py: 0.4 }, '& fieldset': { borderColor: C.border } }}
          >
            {BUILDER_EXAMPLES.map((example) => (
              <MenuItem key={example.id} value={example.id} sx={{ fontSize: '0.75rem' }}>{example.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography sx={{ fontFamily: mono, fontSize: '0.68rem', color: C.textDim }}>Edit the code to build and run a query</Typography>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', gap: 1.5, p: 1.5, overflow: 'auto', flexDirection: { xs: 'column', md: 'row' } }}>
        <Box sx={{ flex: 1, minWidth: 0, minHeight: 280, display: 'flex', flexDirection: 'column', border: '1px solid', borderColor: C.border, borderRadius: 1, overflow: 'hidden' }}>
          <Box sx={{ px: 1.5, py: 0.7, bgcolor: C.surface, borderBottom: '1px solid', borderColor: C.border }}>
            <Typography sx={{ fontFamily: mono, fontSize: '0.68rem', color: C.textDim }}>query.ts</Typography>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <TypeScriptEditor value={code} onChange={setCode} />
          </Box>
        </Box>

        <Box sx={{ flex: 1, minWidth: 0, minHeight: 280, display: 'flex', flexDirection: 'column', gap: 1, overflow: 'auto' }}>
          {evaluated.error ? (
            <Alert severity="error" sx={{ fontFamily: mono, fontSize: '0.76rem', whiteSpace: 'pre-wrap', '& .MuiAlert-message': { overflowWrap: 'anywhere' } }}>
              {evaluated.error}
            </Alert>
          ) : evaluated.value && (
            <>
              <Box sx={{ border: '1px solid', borderColor: C.border, borderRadius: 1, overflow: 'hidden', bgcolor: C.surface }}>
                <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, py: 0.6, borderBottom: '1px solid', borderColor: C.border }}>
                  <Typography sx={{ flex: 1, fontFamily: mono, fontSize: '0.68rem', color: C.textDim }}>Generated pipequery</Typography>
                  <Button
                    size="small"
                    onClick={() => { setQueryText(evaluated.value!.queryText); onOpenInEditor(); }}
                    sx={{ minWidth: 0, fontFamily: sans, fontSize: '0.7rem', textTransform: 'none', color: C.blue }}
                  >
                    Open in editor
                  </Button>
                </Box>
                <Box component="pre" sx={{ m: 0, p: 1.5, color: C.text, fontFamily: mono, fontSize: '0.75rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {evaluated.value.queryText}
                </Box>
              </Box>

              <Box sx={{ flex: 1, minHeight: 160, border: '1px solid', borderColor: C.border, borderRadius: 1, overflow: 'hidden', bgcolor: C.surface }}>
                <Box sx={{ px: 1.5, py: 0.6, borderBottom: '1px solid', borderColor: C.border }}>
                  <Typography sx={{ fontFamily: mono, fontSize: '0.68rem', color: C.textDim }}>Result on {selectedDataset}</Typography>
                </Box>
                <Box component="pre" sx={{ m: 0, p: 1.5, color: C.textMuted, fontFamily: mono, fontSize: '0.72rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {JSON.stringify(evaluated.value.result, null, 2) ?? String(evaluated.value.result)}
                </Box>
              </Box>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}