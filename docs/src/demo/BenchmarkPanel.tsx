import { useState, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  LinearProgress,
  Chip,
  alpha,
  Paper,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SpeedIcon from '@mui/icons-material/Speed';
import MemoryIcon from '@mui/icons-material/Memory';
interface BenchResult {
  name: string;
  library: string;
  medianMs: number;
  p95Ms: number;
  ops: number;
}

interface BenchSuite {
  label: string;
  size: number;
  results: BenchResult[];
  totalMs: number;
}

// ─── Result bar chart ───────────────────────────────────────────────────────

const LIB_COLORS: Record<string, string> = {
  'PipeQuery': '#5b9cf6',
  'PQ (compiled)': '#82aaff',
  'Native JS': '#c3e88d',
};

function ResultRow({ r, maxMs }: { r: BenchResult; maxMs: number }) {
  const color = LIB_COLORS[r.library] ?? '#ffa726';
  const pct = maxMs > 0 ? (r.medianMs / maxMs) * 100 : 0;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}>
      <Typography sx={{
        width: 100, flexShrink: 0,
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '0.68rem',
        color: color,
        fontWeight: 600,
        textAlign: 'right',
      }}>
        {r.library}
      </Typography>
      <Box sx={{ flex: 1, position: 'relative', height: 16, bgcolor: alpha('#fff', 0.03), borderRadius: 1, overflow: 'hidden' }}>
        <Box sx={{
          position: 'absolute',
          top: 0, left: 0, bottom: 0,
          width: `${Math.max(pct, 2)}%`,
          bgcolor: alpha(color, 0.35),
          borderRadius: 1,
          transition: 'width 0.4s ease',
        }} />
      </Box>
      <Typography sx={{
        width: 70, flexShrink: 0,
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '0.68rem',
        color: '#99aabb',
        textAlign: 'right',
      }}>
        {r.medianMs < 0.01 ? '<0.01' : r.medianMs.toFixed(2)}ms
      </Typography>
      <Typography sx={{
        width: 60, flexShrink: 0,
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '0.62rem',
        color: '#667788',
        textAlign: 'right',
      }}>
        {r.ops.toLocaleString()}/s
      </Typography>
    </Box>
  );
}

function BenchGroup({ name, results }: { name: string; results: BenchResult[] }) {
  const maxMs = Math.max(...results.map(r => r.medianMs), 0.01);
  return (
    <Box sx={{ mb: 2 }}>
      <Typography sx={{
        fontSize: '0.72rem',
        fontWeight: 700,
        color: '#c8d4e0',
        mb: 0.5,
        letterSpacing: '-0.01em',
      }}>
        {name}
      </Typography>
      {results.map((r, i) => <ResultRow key={i} r={r} maxMs={maxMs} />)}
    </Box>
  );
}

// ─── Main panel ─────────────────────────────────────────────────────────────

type RunMode = 'main' | 'worker';

export default function BenchmarkPanel() {
  const [size, setSize] = useState<number>(10_000);
  const [mode, setMode] = useState<RunMode>('main');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [suite, setSuite] = useState<BenchSuite | null>(null);
  const workerRef = useRef<Worker | null>(null);

  const runMainThread = useCallback(async () => {
    setRunning(true);
    setSuite(null);
    setProgress('Loading benchmark module...');
    // Dynamic import to keep bundle small
    const { runBrowserBenchmarks } = await import('../../bench/browser-bench.ts');
    // Yield to let UI update
    await new Promise(r => setTimeout(r, 50));
    const result = runBrowserBenchmarks(size, (msg) => setProgress(msg));
    setSuite(result);
    setRunning(false);
    setProgress('');
  }, [size]);

  const runWorker = useCallback(async () => {
    setRunning(true);
    setSuite(null);
    setProgress('Starting worker...');

    const worker = new Worker(
      new URL('../../bench/bench-worker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    worker.onmessage = (e) => {
      if (e.data.type === 'progress') {
        setProgress(e.data.msg);
      } else if (e.data.type === 'done') {
        setSuite(e.data.suite);
        setRunning(false);
        setProgress('');
        worker.terminate();
        workerRef.current = null;
      }
    };

    worker.onerror = (e) => {
      setProgress(`Worker error: ${e.message}`);
      setRunning(false);
      worker.terminate();
      workerRef.current = null;
    };

    worker.postMessage({ type: 'run', size });
  }, [size]);

  const handleRun = () => {
    if (mode === 'worker') runWorker();
    else runMainThread();
  };

  // Group results by benchmark name
  const grouped = suite ? groupResults(suite.results) : [];

  return (
    <Box sx={{ flex: 1, overflow: 'auto', py: 1 }}>
      {/* Controls */}
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <SpeedIcon sx={{ color: 'primary.main', fontSize: 20 }} />
        <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>Benchmark</Typography>
        <Box sx={{ flex: 1 }} />

        <ToggleButtonGroup
          value={size}
          exclusive
          onChange={(_, v) => v && setSize(v)}
          size="small"
        >
          <ToggleButton value={1_000} sx={{ px: 1, py: 0.25, fontSize: '0.7rem' }}>1K</ToggleButton>
          <ToggleButton value={10_000} sx={{ px: 1, py: 0.25, fontSize: '0.7rem' }}>10K</ToggleButton>
          <ToggleButton value={100_000} sx={{ px: 1, py: 0.25, fontSize: '0.7rem' }}>100K</ToggleButton>
        </ToggleButtonGroup>

        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={(_, v) => v && setMode(v)}
          size="small"
        >
          <ToggleButton value="main" sx={{ px: 1, py: 0.25, fontSize: '0.7rem' }}>
            <MemoryIcon sx={{ fontSize: 14, mr: 0.5 }} /> Main
          </ToggleButton>
          <ToggleButton value="worker" sx={{ px: 1, py: 0.25, fontSize: '0.7rem' }}>
            <MemoryIcon sx={{ fontSize: 14, mr: 0.5 }} /> Worker
          </ToggleButton>
        </ToggleButtonGroup>

        <Button
          variant="contained"
          size="small"
          disabled={running}
          onClick={handleRun}
          startIcon={<PlayArrowIcon />}
          sx={{ fontSize: '0.75rem' }}
        >
          Run
        </Button>
      </Stack>

      {/* Progress */}
      {running && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress sx={{ mb: 0.5, borderRadius: 1 }} />
          <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', fontFamily: '"JetBrains Mono", monospace' }}>
            {progress}
          </Typography>
        </Box>
      )}

      {/* Results */}
      {suite && (
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <Chip
              label={`${suite.size.toLocaleString()} rows`}
              size="small"
              variant="outlined"
              sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.68rem' }}
            />
            <Chip
              label={`${suite.totalMs.toLocaleString()}ms total`}
              size="small"
              variant="outlined"
              color="success"
              sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.68rem' }}
            />
            <Chip
              label={mode === 'worker' ? 'Web Worker' : 'Main Thread'}
              size="small"
              variant="outlined"
              color="primary"
              sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.68rem' }}
            />
          </Stack>

          {/* Legend */}
          <Stack direction="row" spacing={2} sx={{ mb: 1.5, pl: '108px' }}>
            {Object.entries(LIB_COLORS).map(([lib, color]) => (
              <Stack key={lib} direction="row" spacing={0.5} alignItems="center">
                <Box sx={{ width: 8, height: 8, borderRadius: 1, bgcolor: color }} />
                <Typography sx={{ fontSize: '0.62rem', color: '#8899aa' }}>{lib}</Typography>
              </Stack>
            ))}
          </Stack>

          {grouped.map(([name, results]) => (
            <BenchGroup key={name} name={name} results={results} />
          ))}

          {/* Raw table */}
          <Paper
            variant="outlined"
            sx={{ mt: 3, p: 1.5, overflow: 'auto', bgcolor: 'background.default' }}
          >
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: '#667788', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Raw Results
            </Typography>
            <Box
              component="pre"
              sx={{
                m: 0,
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '0.62rem',
                color: '#8899aa',
                lineHeight: 1.5,
                whiteSpace: 'pre',
                overflow: 'auto',
              }}
            >
              {formatRawTable(suite.results)}
            </Box>
          </Paper>
        </Box>
      )}
    </Box>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function groupResults(results: BenchResult[]): [string, BenchResult[]][] {
  const map = new Map<string, BenchResult[]>();
  for (const r of results) {
    const arr = map.get(r.name) ?? [];
    arr.push(r);
    map.set(r.name, arr);
  }
  return Array.from(map);
}

function formatRawTable(results: BenchResult[]): string {
  const header = 'Benchmark'.padEnd(30) + 'Library'.padEnd(16) + 'Median'.padStart(10) + 'p95'.padStart(10) + 'Ops/s'.padStart(10);
  const sep = '-'.repeat(header.length);
  const rows = results.map(r =>
    r.name.padEnd(30) +
    r.library.padEnd(16) +
    `${r.medianMs}ms`.padStart(10) +
    `${r.p95Ms}ms`.padStart(10) +
    `${r.ops}`.padStart(10)
  );
  return [header, sep, ...rows].join('\n');
}
