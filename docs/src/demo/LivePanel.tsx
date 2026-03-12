import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Slider,
  Stack,
  Chip,
  IconButton,
  Divider,
  alpha,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { liveQuery } from '../../../src/engine/index.ts';
import type { LiveQuery, LiveQueryStats, DataContext } from '../../../src/engine/index.ts';

type RowData = Record<string, unknown>;

interface LivePanelProps {
  dataContext: DataContext;
  source: string;
  keyField: string;
  onResultChange: (result: unknown) => void;
  onExecutionTimeChange: (ms: number) => void;
  onErrorChange: (error: string | null) => void;
}

const SPEED_MARKS = [
  { value: 1, label: '1/s' },
  { value: 5, label: '5' },
  { value: 10, label: '10' },
  { value: 25, label: '25' },
  { value: 50, label: '50' },
];

const BATCH_MARKS = [
  { value: 10, label: '10' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
  { value: 250, label: '250' },
  { value: 500, label: '500' },
];

const monoSx = { fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace' };

export default function LivePanel({
  dataContext,
  source,
  keyField,
  onResultChange,
  onExecutionTimeChange,
  onErrorChange,
}: LivePanelProps) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(10);
  const [batchSize, setBatchSize] = useState(50);
  const [queryText, setQueryText] = useState(`where(price > 500) | sort(price desc) | first(20)`);
  const [stats, setStats] = useState<LiveQueryStats | null>(null);

  const lqRef = useRef<LiveQuery | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const sourceDataRef = useRef<RowData[]>([]);
  const nextIdRef = useRef(0);

  // Initialize LiveQuery when source/context/query changes
  useEffect(() => {
    lqRef.current?.dispose();

    const sourceData = dataContext[source];
    if (!Array.isArray(sourceData) || sourceData.length === 0) return;

    sourceDataRef.current = sourceData as RowData[];
    nextIdRef.current = sourceData.length;

    try {
      const lq = liveQuery(sourceData as RowData[], queryText, {
        key: keyField,
        throttle: 100,
      });

      lq.subscribe((result, s) => {
        onResultChange(result);
        onExecutionTimeChange(s.executionMs);
        onErrorChange(null);
        setStats({ ...s });
      });

      // Show initial result
      onResultChange(lq.result);
      onExecutionTimeChange(lq.stats.executionMs);
      onErrorChange(null);
      setStats(lq.stats);

      lqRef.current = lq;
    } catch (err) {
      onErrorChange(err instanceof Error ? err.message : String(err));
    }

    return () => {
      lqRef.current?.dispose();
      lqRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataContext, source, keyField]);

  // Handle query text changes
  const queryDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    clearTimeout(queryDebounceRef.current);
    queryDebounceRef.current = setTimeout(() => {
      if (!lqRef.current) return;
      try {
        lqRef.current.setQuery(queryText);
        onErrorChange(null);
      } catch (err) {
        onErrorChange(err instanceof Error ? err.message : String(err));
      }
    }, 300);
    return () => clearTimeout(queryDebounceRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryText]);

  // Generate a random patch
  const generatePatch = useCallback(() => {
    const lq = lqRef.current;
    if (!lq) return;

    const sourceRows = sourceDataRef.current;
    const changes: RowData[] = [];
    const removals: string[] = [];

    for (let i = 0; i < batchSize; i++) {
      const idx = Math.floor(Math.random() * lq.size);
      // Generate a mutation based on a random existing row
      const baseRow = sourceRows[idx % sourceRows.length];
      if (!baseRow) continue;

      const mutated: RowData = { ...baseRow };
      // Mutate numeric fields randomly
      for (const [k, v] of Object.entries(mutated)) {
        if (k === keyField) continue;
        if (typeof v === 'number') {
          mutated[k] = Math.round((v + (Math.random() - 0.5) * v * 0.3) * 100) / 100;
        }
      }
      // Pick a random key from existing data
      mutated[keyField] = Math.floor(Math.random() * lq.size);
      changes.push(mutated);
    }

    // 10% chance to insert a new row
    if (Math.random() < 0.1 && sourceRows.length > 0) {
      const template = sourceRows[0];
      const newRow: RowData = { ...template };
      newRow[keyField] = nextIdRef.current++;
      for (const [k, v] of Object.entries(newRow)) {
        if (k === keyField) continue;
        if (typeof v === 'number') {
          newRow[k] = Math.round(Math.random() * 1000 * 100) / 100;
        }
      }
      changes.push(newRow);
    }

    // 5% chance to remove a random row
    if (Math.random() < 0.05 && lq.size > 100) {
      removals.push(String(Math.floor(Math.random() * lq.size)));
    }

    try {
      lq.patch(changes, removals.length > 0 ? removals : undefined);
    } catch {
      // Ignore patch errors (e.g., missing key on generated row)
    }
  }, [batchSize, keyField]);

  // Start/stop stream interval
  useEffect(() => {
    clearInterval(intervalRef.current);
    if (playing) {
      const ms = Math.max(20, Math.round(1000 / speed));
      intervalRef.current = setInterval(generatePatch, ms);
    }
    return () => clearInterval(intervalRef.current);
  }, [playing, speed, generatePatch]);

  const throughput = playing ? speed * batchSize : 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Stats bar */}
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap' }}>
        <Chip
          icon={<FiberManualRecordIcon sx={{ fontSize: 10 }} />}
          label={playing ? 'STREAMING' : 'PAUSED'}
          size="small"
          color={playing ? 'success' : 'default'}
          variant={playing ? 'filled' : 'outlined'}
          sx={{ ...monoSx, fontSize: '0.7rem' }}
        />
        {stats && (
          <>
            <Chip
              label={`tick #${stats.tick}`}
              size="small"
              variant="outlined"
              sx={{ ...monoSx, fontSize: '0.7rem' }}
            />
            <Chip
              label={`${stats.executionMs.toFixed(1)}ms`}
              size="small"
              variant="outlined"
              color={stats.executionMs > 100 ? 'warning' : 'default'}
              sx={{ ...monoSx, fontSize: '0.7rem' }}
            />
            <Chip
              label={`${stats.patchCount.toLocaleString()} patches`}
              size="small"
              variant="outlined"
              sx={{ ...monoSx, fontSize: '0.7rem' }}
            />
            <Chip
              label={`${stats.rowCount.toLocaleString()} rows`}
              size="small"
              variant="outlined"
              sx={{ ...monoSx, fontSize: '0.7rem' }}
            />
            {throughput > 0 && (
              <Chip
                label={`~${throughput.toLocaleString()} rows/s`}
                size="small"
                variant="outlined"
                color="primary"
                sx={{ ...monoSx, fontSize: '0.7rem' }}
              />
            )}
          </>
        )}
      </Stack>

      {/* Controls */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <IconButton
          onClick={() => setPlaying(!playing)}
          color={playing ? 'warning' : 'success'}
          sx={{
            bgcolor: (t) => alpha(playing ? t.palette.warning.main : t.palette.success.main, 0.1),
            '&:hover': {
              bgcolor: (t) => alpha(playing ? t.palette.warning.main : t.palette.success.main, 0.2),
            },
          }}
        >
          {playing ? <PauseIcon /> : <PlayArrowIcon />}
        </IconButton>

        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Speed: {speed} ticks/s
          </Typography>
          <Slider
            value={speed}
            onChange={(_, v) => setSpeed(v as number)}
            min={1}
            max={50}
            step={null}
            marks={SPEED_MARKS}
            size="small"
            sx={{ py: 0 }}
          />
        </Box>

        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Batch: {batchSize} rows/tick
          </Typography>
          <Slider
            value={batchSize}
            onChange={(_, v) => setBatchSize(v as number)}
            min={10}
            max={500}
            step={null}
            marks={BATCH_MARKS}
            size="small"
            sx={{ py: 0 }}
          />
        </Box>
      </Stack>

      <Divider sx={{ mb: 2 }} />

      {/* Query input */}
      <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
        Live Query
      </Typography>
      <TextField
        multiline
        fullWidth
        minRows={3}
        maxRows={6}
        value={queryText}
        onChange={(e) => setQueryText(e.target.value)}
        slotProps={{
          input: {
            sx: {
              ...monoSx,
              fontSize: '0.875rem',
              lineHeight: 1.6,
            },
          },
        }}
      />

      <Divider sx={{ my: 2 }} />

      {/* Info */}
      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.8 }}>
        Simulates a real-time data stream pushing random delta patches into a LiveQuery.
        Patches apply instantly to the index; query execution is throttled at 100ms.
        Adjust speed and batch size to stress-test the pipeline.
      </Typography>
    </Box>
  );
}
