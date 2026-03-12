import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Paper,
  TextField,
  Typography,
  Alert,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  alpha,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import TimerIcon from '@mui/icons-material/Timer';
import StorageIcon from '@mui/icons-material/Storage';
import { query } from '../../../src/engine/index.ts';
import { DATASETS, EXAMPLE_QUERIES } from './sample-data.ts';
import { PipeQueryBuilder } from '../../../src/react/index.ts';
import LivePanel from './LivePanel.tsx';
import BenchmarkPanel from './BenchmarkPanel.tsx';

export default function Playground() {
  const [queryText, setQueryText] = useState('items | where(price > 100) | sort(price desc)');
  const [selectedDataset, setSelectedDataset] = useState('products');
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [mode, setMode] = useState<'editor' | 'builder' | 'live' | 'bench'>('editor');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const execute = useCallback(() => {
    if (mode === 'live') return; // LivePanel manages its own execution
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

  const resultText = result != null
    ? JSON.stringify(result, null, 2)
    : '';

  const resultCount = Array.isArray(result)
    ? `${result.length} row${result.length !== 1 ? 's' : ''}`
    : typeof result === 'number'
      ? 'scalar'
      : '';

  // Builder helpers
  const dataContext = useMemo(() => DATASETS[selectedDataset]?.context ?? {}, [selectedDataset]);
  const availableSources = useMemo(() => Object.keys(dataContext), [dataContext]);
  const [builderSource, setBuilderSource] = useState('');

  // Auto-set builder source when dataset changes
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

  return (
    <Box sx={{ display: 'flex', gap: 2, height: 'calc(100vh - 100px)' }}>
      {/* Left panel — Query */}
      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2, overflow: 'hidden' }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Dataset</InputLabel>
            <Select
              value={selectedDataset}
              label="Dataset"
              onChange={(e) => setSelectedDataset(e.target.value)}
            >
              {Object.entries(DATASETS).map(([key, { label }]) => (
                <MenuItem key={key} value={key}>{label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <StorageIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
          <Typography variant="body2" color="text.secondary">
            {Object.entries(DATASETS[selectedDataset].context).map(
              ([k, v]) => `${k}: ${v.length} rows`
            ).join(', ')}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={(_, v) => v && setMode(v)}
            size="small"
          >
            <ToggleButton value="editor" sx={{ px: 1.5, py: 0.5, fontSize: '0.75rem' }}>Editor</ToggleButton>
            <ToggleButton value="builder" sx={{ px: 1.5, py: 0.5, fontSize: '0.75rem' }}>Builder</ToggleButton>
            <ToggleButton value="live" sx={{ px: 1.5, py: 0.5, fontSize: '0.75rem' }}>Live</ToggleButton>
            <ToggleButton value="bench" sx={{ px: 1.5, py: 0.5, fontSize: '0.75rem' }}>Bench</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        {mode === 'editor' ? (
          <>
            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
              Query
            </Typography>
            <TextField
              multiline
              fullWidth
              minRows={4}
              maxRows={8}
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              slotProps={{
                input: {
                  sx: {
                    fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
                    fontSize: '0.875rem',
                    lineHeight: 1.6,
                  },
                }
              }}
            />

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
              Examples
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {filteredExamples.map((ex) => (
                <Chip
                  key={ex.label}
                  label={ex.label}
                  size="small"
                  variant="outlined"
                  onClick={() => setQueryText(ex.query)}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.1) },
                  }}
                />
              ))}
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
              Source Data
            </Typography>
            {selectedDataset === 'stress' ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                Source data preview hidden for stress test dataset (100k rows).
              </Typography>
            ) : (
              <Box
                sx={{
                  flex: 1,
                  overflow: 'auto',
                  bgcolor: 'background.default',
                  borderRadius: 1,
                  p: 1.5,
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  lineHeight: 1.5,
                  color: 'text.secondary',
                }}
              >
                <pre style={{ margin: 0 }}>
                  {JSON.stringify(DATASETS[selectedDataset].context, null, 2)}
                </pre>
              </Box>
            )}
          </>
        ) : mode === 'builder' ? (
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
        ) : mode === 'live' ? (
          <LivePanel
            dataContext={dataContext}
            source={builderSource}
            keyField={availableFields[0] ?? 'id'}
            onResultChange={setResult}
            onExecutionTimeChange={setExecutionTime}
            onErrorChange={setError}
          />
        ) : (
          <BenchmarkPanel />
        )}
      </Paper>

      {/* Right panel — Results */}
      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2, overflow: 'hidden' }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <PlayArrowIcon sx={{ color: 'success.main', fontSize: 20 }} />
          <Typography variant="subtitle2">Result</Typography>
          {resultCount && (
            <Chip label={resultCount} size="small" color="primary" variant="outlined" />
          )}
          <Box sx={{ flex: 1 }} />
          {executionTime != null && (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <TimerIcon sx={{
                color: executionTime > 100 ? 'warning.main' : 'text.secondary',
                fontSize: executionTime > 10 ? 20 : 16,
              }} />
              <Typography
                variant={executionTime > 10 ? 'body2' : 'caption'}
                sx={{
                  color: executionTime > 100 ? 'warning.main' : 'text.secondary',
                  fontWeight: executionTime > 10 ? 600 : 400,
                  fontFamily: '"JetBrains Mono", monospace',
                }}
              >
                {executionTime < 1
                  ? `${(executionTime * 1000).toFixed(0)}µs`
                  : executionTime < 1000
                    ? `${executionTime.toFixed(1)}ms`
                    : `${(executionTime / 1000).toFixed(2)}s`}
              </Typography>
            </Stack>
          )}
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2, fontFamily: 'monospace', fontSize: '0.8rem' }}>
            {error}
          </Alert>
        )}

        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            bgcolor: 'background.default',
            borderRadius: 1,
            p: 2,
            fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
            fontSize: '0.8rem',
            lineHeight: 1.6,
          }}
        >
          <pre style={{ margin: 0 }}>{resultText}</pre>
        </Box>
      </Paper>
    </Box>
  );
}
