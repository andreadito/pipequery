import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  Alert,
  Select,
  MenuItem,
  FormControl,
  ToggleButton,
  ToggleButtonGroup,
  alpha,
} from '@mui/material';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { pipeQuery } from '../../../src/highlighting/codemirror/index.ts';
import { query } from '../../../src/engine/index.ts';
import { DATASETS, EXAMPLE_QUERIES } from './sample-data.ts';
import { PipeQueryBuilder } from '../../../src/react/index.ts';
import LivePanel from './LivePanel.tsx';
import BenchmarkPanel from './BenchmarkPanel.tsx';

// ─── Palette (matches homepage) ─────────────────────────────────────────────

const C = {
  bg: '#0a0e14',
  surface: '#131920',
  surfaceAlt: '#0f141b',
  border: 'rgba(255,255,255,0.06)',
  blue: '#5b9cf6',
  orange: '#ff9800',
  text: '#e0e6ed',
  textMuted: '#8899aa',
  textDim: '#556677',
  number: '#f78c6c',
  string: '#c3e88d',
  bool: '#c792ea',
};

const mono = '"JetBrains Mono", "Fira Code", monospace';
const sans = '"DM Sans", sans-serif';

// ─── CodeMirror theme ───────────────────────────────────────────────────────

const cmTheme = EditorView.theme({
  '&': {
    backgroundColor: 'transparent',
    color: C.text,
    fontFamily: mono,
    fontSize: '0.82rem',
    lineHeight: '1.5',
  },
  '.cm-content': {
    padding: 0,
    caretColor: C.text,
  },
  '.cm-line': {
    padding: 0,
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-cursor': {
    borderLeftColor: C.text,
  },
  '.cm-selectionBackground': {
    backgroundColor: 'rgba(91, 156, 246, 0.2) !important',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(91, 156, 246, 0.3) !important',
  },
  '.cm-gutters': {
    display: 'none',
  },
  '.cm-scroller': {
    overflow: 'auto',
    maxHeight: `${1.5 * 0.82 * 16 * 6}px`,
  },
}, { dark: true });

// ─── CodeMirror editor component ────────────────────────────────────────────

function CodeMirrorEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
    return () => { view.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes into the editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  return <div ref={containerRef} style={{ flex: 1, minHeight: 24 }} />;
}

// ─── Dense data table ───────────────────────────────────────────────────────

function DataTable({ data }: { data: Record<string, unknown>[] }) {
  if (data.length === 0) {
    return (
      <Typography sx={{ color: C.textDim, fontSize: '0.8rem', fontFamily: mono, p: 2 }}>
        Empty result set
      </Typography>
    );
  }

  const columns = Object.keys(data[0]);

  const formatCell = (val: unknown) => {
    if (val === null || val === undefined) return { text: 'null', color: C.textDim, align: 'left' as const };
    if (typeof val === 'number') return { text: Number.isInteger(val) ? String(val) : val.toFixed(val < 1 && val > -1 ? 4 : 2), color: C.number, align: 'right' as const };
    if (typeof val === 'boolean') return { text: String(val), color: C.bool, align: 'center' as const };
    if (typeof val === 'string') return { text: val, color: C.text, align: 'left' as const };
    if (typeof val === 'object') return { text: JSON.stringify(val), color: C.textMuted, align: 'left' as const };
    return { text: String(val), color: C.text, align: 'left' as const };
  };

  return (
    <Box sx={{ overflow: 'auto', flex: 1 }}>
      <Box
        component="table"
        sx={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: mono,
          fontSize: '0.78rem',
          lineHeight: 1.4,
          '& th': {
            position: 'sticky',
            top: 0,
            zIndex: 2,
            bgcolor: C.surface,
            textAlign: 'left',
            px: 1,
            py: 0.6,
            color: C.textDim,
            fontWeight: 600,
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            borderBottom: '1px solid',
            borderColor: C.border,
            whiteSpace: 'nowrap',
            userSelect: 'none',
          },
          '& td': {
            px: 1,
            py: 0.4,
            whiteSpace: 'nowrap',
            borderBottom: '1px solid',
            borderColor: 'rgba(255,255,255,0.02)',
            maxWidth: 280,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          },
          '& tr:hover td': {
            bgcolor: 'rgba(255,255,255,0.02)',
          },
        }}
      >
        <thead>
          <tr>
            <Box component="th" sx={{ width: 36, textAlign: 'right !important', color: `${C.textDim} !important`, fontSize: '0.65rem !important', letterSpacing: '0 !important' }}>#</Box>
            {columns.map((col) => {
              const sample = data[0][col];
              const isNum = typeof sample === 'number';
              return (
                <Box component="th" key={col} sx={{ textAlign: isNum ? 'right !important' : 'left' }}>
                  {col}
                </Box>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              <Box component="td" sx={{ textAlign: 'right', color: C.textDim, fontSize: '0.65rem', opacity: 0.5 }}>{i + 1}</Box>
              {columns.map((col) => {
                const { text, color, align } = formatCell(row[col]);
                return (
                  <Box component="td" key={col} sx={{ color, textAlign: align }}>
                    {text}
                  </Box>
                );
              })}
            </tr>
          ))}
        </tbody>
      </Box>
    </Box>
  );
}

// ─── Scalar result display ──────────────────────────────────────────────────

function ScalarResult({ value }: { value: unknown }) {
  const isNum = typeof value === 'number';
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, p: 2 }}>
      <Typography sx={{ fontSize: '0.7rem', color: C.textDim, fontFamily: mono, textTransform: 'uppercase' }}>
        scalar
      </Typography>
      <Typography sx={{
        fontSize: '1.8rem', fontWeight: 600, fontFamily: mono,
        color: isNum ? C.number : C.text,
        letterSpacing: '-0.02em',
      }}>
        {isNum ? (Number.isInteger(value) ? String(value) : (value as number).toFixed(4)) : JSON.stringify(value)}
      </Typography>
    </Box>
  );
}

// ─── Main Playground ────────────────────────────────────────────────────────

export default function Playground() {
  const [queryText, setQueryText] = useState('items | where(price > 100) | sort(price desc)');
  const [selectedDataset, setSelectedDataset] = useState('products');
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [mode, setMode] = useState<'editor' | 'builder' | 'live' | 'bench'>('editor');
  const [resultView, setResultView] = useState<'table' | 'json'>('table');
  const [showSource, setShowSource] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // When dataset changes, pick the first example query for it
  const handleDatasetChange = useCallback((newDataset: string) => {
    setSelectedDataset(newDataset);
    const firstExample = EXAMPLE_QUERIES.find((e) => e.dataset === newDataset);
    if (firstExample) setQueryText(firstExample.query);
  }, []);

  const execute = useCallback(() => {
    if (mode === 'live') return;
    setError(null);
    const dataset = DATASETS[selectedDataset];
    if (!dataset) return;

    const start = performance.now();
    try {
      const res = query(dataset.context, queryText);
      setExecutionTime(performance.now() - start);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
      setResult(null);
      setExecutionTime(null);
    }
  }, [queryText, selectedDataset, mode]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(execute, 300);
    return () => clearTimeout(debounceRef.current);
  }, [execute]);

  const filteredExamples = EXAMPLE_QUERIES.filter((e) => e.dataset === selectedDataset);

  const resultCount = Array.isArray(result)
    ? `${result.length} row${result.length !== 1 ? 's' : ''}`
    : typeof result === 'number' ? 'scalar' : '';

  const dataContext = useMemo(() => DATASETS[selectedDataset]?.context ?? {}, [selectedDataset]);
  const availableSources = useMemo(() => Object.keys(dataContext), [dataContext]);
  const [builderSource, setBuilderSource] = useState('');

  useEffect(() => {
    const sources = Object.keys(DATASETS[selectedDataset]?.context ?? {});
    if (sources.length > 0) setBuilderSource(sources[0]);
  }, [selectedDataset]);

  const availableFields = useMemo(() => {
    const sourceData = dataContext[builderSource];
    if (Array.isArray(sourceData) && sourceData.length > 0) {
      return Object.keys(sourceData[0] as Record<string, unknown>);
    }
    return [];
  }, [dataContext, builderSource]);

  const rowInfo = Object.entries(DATASETS[selectedDataset]?.context ?? {})
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.length : '?'}`)
    .join(' | ');

  const fmtTime = executionTime != null
    ? executionTime < 1
      ? `${(executionTime * 1000).toFixed(0)}µs`
      : executionTime < 1000
        ? `${executionTime.toFixed(1)}ms`
        : `${(executionTime / 1000).toFixed(2)}s`
    : null;

  const isArray = Array.isArray(result);
  const isScalar = result !== null && !isArray && typeof result !== 'undefined';

  // Derive the source table name from the query (first identifier)
  const sourceKey = useMemo(() => {
    const m = queryText.match(/^\s*(\w+)/);
    return m ? m[1] : '';
  }, [queryText]);
  const sourceData = useMemo(() => {
    const d = dataContext[sourceKey];
    return Array.isArray(d) ? d as Record<string, unknown>[] : null;
  }, [dataContext, sourceKey]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 72px)', gap: 0, fontFamily: sans }}>

      {/* ── Toolbar Row 1: Dataset + Mode ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        px: 1.5, py: 0.8,
        bgcolor: C.surface,
        borderBottom: '1px solid', borderColor: C.border,
        borderRadius: '8px 8px 0 0',
      }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <Select
            value={selectedDataset}
            onChange={(e) => handleDatasetChange(e.target.value)}
            sx={{
              fontFamily: mono, fontSize: '0.78rem', height: 32,
              '& .MuiSelect-select': { py: 0.5 },
              '& fieldset': { borderColor: C.border },
            }}
          >
            {Object.entries(DATASETS).map(([key, { label }]) => (
              <MenuItem key={key} value={key} sx={{ fontFamily: mono, fontSize: '0.78rem' }}>{label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Typography sx={{ fontSize: '0.68rem', color: C.textDim, fontFamily: mono, whiteSpace: 'nowrap' }}>
          {rowInfo}
        </Typography>

        <Box sx={{ flex: 1 }} />

        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={(_, v) => v && setMode(v)}
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              px: 1.2, py: 0.25, fontSize: '0.7rem', fontFamily: sans,
              fontWeight: 600, textTransform: 'none', letterSpacing: 0,
              color: C.textMuted, borderColor: C.border,
              '&.Mui-selected': { color: C.blue, bgcolor: alpha(C.blue, 0.1), borderColor: alpha(C.blue, 0.3) },
            },
          }}
        >
          <ToggleButton value="editor">Editor</ToggleButton>
          <ToggleButton value="builder">Builder</ToggleButton>
          <ToggleButton value="live">Live</ToggleButton>
          <ToggleButton value="bench">Bench</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {mode === 'editor' ? (
        <>
          {/* ── Toolbar Row 2: Query input + Examples ── */}
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            px: 1.5, py: 0.6,
            bgcolor: C.surfaceAlt,
            borderBottom: '1px solid', borderColor: C.border,
          }}>
            <Typography sx={{ fontSize: '0.72rem', color: C.textDim, fontFamily: mono, flexShrink: 0 }}>
              &gt;
            </Typography>
            <CodeMirrorEditor value={queryText} onChange={setQueryText} />
            {filteredExamples.length > 0 && (
              <FormControl size="small" sx={{ minWidth: 130, flexShrink: 0 }}>
                <Select
                  value={filteredExamples.find((e) => e.query === queryText)?.query ?? ''}
                  displayEmpty
                  onChange={(e) => { if (e.target.value) setQueryText(e.target.value); }}
                  renderValue={(val) => {
                    const match = filteredExamples.find((e) => e.query === val);
                    return (
                      <Typography sx={{ fontSize: '0.72rem', color: match ? C.text : C.textMuted, fontFamily: sans }}>
                        {match ? match.label : 'Examples'}
                      </Typography>
                    );
                  }}
                  sx={{
                    fontFamily: mono, fontSize: '0.75rem', height: 28,
                    '& .MuiSelect-select': { py: 0.3 },
                    '& fieldset': { borderColor: C.border },
                  }}
                >
                  {filteredExamples.map((ex) => (
                    <MenuItem key={ex.label} value={ex.query} sx={{ fontFamily: mono, fontSize: '0.72rem' }}>
                      {ex.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>

          {/* ── Results header ── */}
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            px: 1.5, py: 0.5,
            borderBottom: '1px solid', borderColor: C.border,
          }}>
            {resultCount && (
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: C.text, fontFamily: mono }}>
                {resultCount}
              </Typography>
            )}
            {sourceData && (
              <Typography
                onClick={() => setShowSource((s) => !s)}
                sx={{
                  fontSize: '0.65rem', fontFamily: mono, cursor: 'pointer',
                  color: showSource ? C.blue : C.textDim,
                  transition: 'color 0.15s',
                  '&:hover': { color: C.text },
                  userSelect: 'none',
                }}
              >
                {showSource ? `▾ Source (${sourceKey}: ${sourceData.length})` : `▸ Source (${sourceKey}: ${sourceData.length})`}
              </Typography>
            )}
            <Box sx={{ flex: 1 }} />
            {fmtTime && (
              <Typography sx={{
                fontSize: '0.68rem', fontFamily: mono,
                color: executionTime! > 100 ? C.orange : C.textDim,
                fontWeight: executionTime! > 100 ? 600 : 400,
              }}>
                {fmtTime}
              </Typography>
            )}
            {isArray && (
              <ToggleButtonGroup
                value={resultView}
                exclusive
                onChange={(_, v) => v && setResultView(v)}
                size="small"
                sx={{
                  '& .MuiToggleButton-root': {
                    px: 1, py: 0.1, fontSize: '0.65rem', fontFamily: mono,
                    textTransform: 'none', color: C.textDim, borderColor: C.border,
                    '&.Mui-selected': { color: C.blue, bgcolor: alpha(C.blue, 0.08) },
                  },
                }}
              >
                <ToggleButton value="table">Table</ToggleButton>
                <ToggleButton value="json">JSON</ToggleButton>
              </ToggleButtonGroup>
            )}
          </Box>

          {/* ── Error ── */}
          {error && (
            <Alert
              severity="error"
              sx={{
                borderRadius: 0, py: 0.5,
                fontFamily: mono, fontSize: '0.78rem',
                '& .MuiAlert-message': { py: 0 },
              }}
            >
              {error}
            </Alert>
          )}

          {/* ── Results area ── */}
          <Box sx={{
            flex: 1, overflow: 'hidden',
            bgcolor: C.bg,
            borderRadius: '0 0 8px 8px',
            display: 'flex',
            flexDirection: showSource ? 'row' : 'column',
          }}>
            {/* Source panel (left when visible) */}
            {showSource && sourceData && (
              <Box sx={{
                width: '40%', minWidth: 200,
                overflow: 'auto',
                borderRight: '1px solid', borderColor: C.border,
                display: 'flex', flexDirection: 'column',
              }}>
                <Box sx={{
                  px: 1, py: 0.4,
                  bgcolor: C.surface,
                  borderBottom: '1px solid', borderColor: C.border,
                }}>
                  <Typography sx={{ fontSize: '0.65rem', color: C.textDim, fontFamily: mono, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
                    {sourceKey} · {sourceData.length} rows
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, overflow: 'auto' }}>
                  <DataTable data={sourceData} />
                </Box>
              </Box>
            )}

            {/* Result panel */}
            <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
              {showSource && (
                <Box sx={{
                  px: 1, py: 0.4,
                  bgcolor: C.surface,
                  borderBottom: '1px solid', borderColor: C.border,
                }}>
                  <Typography sx={{ fontSize: '0.65rem', color: C.textDim, fontFamily: mono, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
                    Result · {resultCount}
                  </Typography>
                </Box>
              )}
              {isScalar ? (
                <ScalarResult value={result} />
              ) : isArray ? (
                resultView === 'table' ? (
                  <DataTable data={result as Record<string, unknown>[]} />
                ) : (
                  <Box sx={{
                    p: 1.5,
                    fontFamily: mono,
                    fontSize: '0.75rem',
                    lineHeight: 1.5,
                    color: C.textMuted,
                  }}>
                    <pre style={{ margin: 0 }}>{JSON.stringify(result, null, 2)}</pre>
                  </Box>
                )
              ) : !error && (
                <Typography sx={{ color: C.textDim, fontSize: '0.78rem', fontFamily: mono, p: 2 }}>
                  Enter a query above
                </Typography>
              )}
            </Box>
          </Box>
        </>
      ) : mode === 'builder' ? (
        <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>
          <PipeQueryBuilder
            orientation="vertical"
            source={builderSource}
            onSourceChange={setBuilderSource}
            availableSources={availableSources}
            availableFields={availableFields}
            onQueryChange={setQueryText}
            joinSources={Object.keys(dataContext).filter(k => k !== builderSource)}
            rowCount={Array.isArray(dataContext[builderSource]) ? dataContext[builderSource].length : 0}
          />
        </Box>
      ) : mode === 'live' ? (
        <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>
          <LivePanel
            dataContext={dataContext}
            source={builderSource}
            keyField={availableFields[0] ?? 'id'}
            onResultChange={setResult}
            onExecutionTimeChange={setExecutionTime}
            onErrorChange={setError}
          />
        </Box>
      ) : (
        <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>
          <BenchmarkPanel />
        </Box>
      )}
    </Box>
  );
}
