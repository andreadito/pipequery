import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Paper, Box, Typography, IconButton, Collapse, Tooltip, Chip, Popover } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import RestoreIcon from '@mui/icons-material/Restore';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import CodeIcon from '@mui/icons-material/Code';
import { query } from '../../../src/engine/index';
import { parseQueryToSteps } from '../../../src/react/types';
import type { PipelineStep } from '../../../src/react/types';
import type { PanelConfig } from '../config/defaultPanels';
import QueryEditor from './QueryEditor';
import SmartRenderer from './SmartRenderer';
import PipeQueryBuilder from '../../../src/react/PipeQueryBuilder';

interface QueryPanelProps {
  config: PanelConfig;
  context: Record<string, unknown[]>;
  savedQuery?: string;
  onQuerySave: (panelId: string, query: string) => void;
  tick: number;
}

export default function QueryPanel({ config, context, savedQuery, onQuerySave, tick }: QueryPanelProps) {
  const currentQuery = savedQuery ?? config.defaultQuery;
  const [editing, setEditing] = useState(false);
  const [editorMode, setEditorMode] = useState<'code' | 'builder'>('code');
  const [draftQuery, setDraftQuery] = useState(currentQuery);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isModified = currentQuery !== config.defaultQuery;
  const isStat = config.size === 'stat';

  // Execute query
  const result = useMemo(() => {
    setError(null);
    try {
      return query(context, currentQuery);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Query error');
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, currentQuery, tick]);

  // Debounced save from editor changes
  const handleEditorChange = useCallback(
    (val: string) => {
      setDraftQuery(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onQuerySave(config.id, val);
      }, 400);
    },
    [config.id, onQuerySave],
  );

  // Sync draft when savedQuery changes externally
  useEffect(() => {
    setDraftQuery(currentQuery);
  }, [currentQuery]);

  const handleReset = useCallback(() => {
    onQuerySave(config.id, config.defaultQuery);
    setDraftQuery(config.defaultQuery);
  }, [config.id, config.defaultQuery, onQuerySave]);

  // Available sources/fields for builder
  const availableSources = useMemo(() => Object.keys(context), [context]);
  const availableFields = useMemo(() => {
    // Guess source from query
    const match = currentQuery.match(/^(\w+)\s*\|/);
    const src = match?.[1] ?? 'crypto';
    const arr = context[src];
    if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'object') {
      return Object.keys(arr[0] as Record<string, unknown>);
    }
    return [];
  }, [currentQuery, context]);

  const [builderSource, setBuilderSource] = useState(() => {
    const match = currentQuery.match(/^(\w+)\s*\|/);
    return match?.[1] ?? 'crypto';
  });

  // Parse current query into steps when switching to builder mode
  const [builderSteps, setBuilderSteps] = useState<PipelineStep[]>([]);
  const [builderKey, setBuilderKey] = useState(0);
  const [builderAnchor, setBuilderAnchor] = useState<HTMLElement | null>(null);

  const switchToBuilder = useCallback((event: React.MouseEvent<HTMLElement>) => {
    const parsed = parseQueryToSteps(draftQuery);
    setBuilderSource(parsed.source || 'crypto');
    setBuilderSteps(parsed.steps);
    setBuilderKey(k => k + 1);
    setBuilderAnchor(event.currentTarget);
    setEditorMode('builder');
  }, [draftQuery]);

  const closeBuilder = useCallback(() => {
    setBuilderAnchor(null);
    setEditorMode('code');
  }, []);

  // --- STAT card ---
  if (isStat) {
    return (
      <Paper sx={{ p: 1.5, height: '100%', position: 'relative', overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', fontWeight: 500 }}>
            {config.title}
          </Typography>
          <Box>
            {isModified && (
              <Tooltip title="Reset">
                <IconButton size="small" onClick={handleReset} sx={{ p: 0.25 }}>
                  <RestoreIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Edit query">
              <IconButton size="small" onClick={() => setEditing(!editing)} sx={{ p: 0.25 }}>
                <EditIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {!editing && (
          <Box sx={{ minHeight: 32, display: 'flex', alignItems: 'center' }}>
            {error ? (
              <Typography variant="caption" color="error">{error}</Typography>
            ) : (
              <SmartRenderer result={result} vizHint="stat" />
            )}
          </Box>
        )}

        <Collapse in={editing}>
          <Box sx={{ mt: 0.5 }}>
            <QueryEditor value={draftQuery} onChange={handleEditorChange} />
          </Box>
        </Collapse>

        {!editing && (
          <Box
            sx={{
              mt: 0.5,
              px: 0.75,
              py: 0.25,
              borderRadius: 0.5,
              bgcolor: 'rgba(91,156,246,0.06)',
              border: '1px solid rgba(91,156,246,0.1)',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.6rem',
              color: '#8bbcff',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {currentQuery}
          </Box>
        )}
      </Paper>
    );
  }

  // --- FULL / HALF panel ---
  return (
    <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
            {config.title}
          </Typography>
          {isModified && <Chip label="modified" size="small" sx={{ height: 18, fontSize: '0.6rem' }} color="primary" variant="outlined" />}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
          {isModified && (
            <Tooltip title="Reset to default">
              <IconButton size="small" onClick={handleReset}><RestoreIcon sx={{ fontSize: 16 }} /></IconButton>
            </Tooltip>
          )}
          {editing && (
            <>
              <Tooltip title="Code editor">
                <IconButton size="small" onClick={() => setEditorMode('code')} color={editorMode === 'code' ? 'primary' : 'default'}>
                  <CodeIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Visual builder">
                <IconButton size="small" onClick={switchToBuilder} color={editorMode === 'builder' ? 'primary' : 'default'}>
                  <ViewModuleIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </>
          )}
          <Tooltip title={editing ? 'Collapse editor' : 'Edit query'}>
            <IconButton size="small" onClick={() => setEditing(!editing)}>
              {editing ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Query display (compact, when not editing) */}
      {!editing && (
        <Box
          onClick={() => setEditing(true)}
          sx={{
            mb: 1.5,
            px: 1,
            py: 0.5,
            borderRadius: 0.75,
            bgcolor: 'rgba(91,156,246,0.06)',
            border: '1px solid rgba(91,156,246,0.12)',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.7rem',
            color: '#8bbcff',
            cursor: 'pointer',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            '&:hover': { borderColor: 'rgba(91,156,246,0.3)', bgcolor: 'rgba(91,156,246,0.1)' },
          }}
        >
          {currentQuery}
        </Box>
      )}

      {/* Code editor (expanded, hidden when builder popover is open) */}
      <Collapse in={editing && !builderAnchor}>
        <Box sx={{ mb: 1.5 }}>
          <QueryEditor value={draftQuery} onChange={handleEditorChange} />
        </Box>
      </Collapse>

      {/* Visual builder popover (horizontal) */}
      <Popover
        open={Boolean(builderAnchor)}
        anchorEl={builderAnchor}
        onClose={closeBuilder}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              p: 2,
              bgcolor: '#1a1f2e',
              border: '1px solid rgba(91,156,246,0.2)',
              borderRadius: 2,
              maxWidth: '90vw',
              overflow: 'auto',
            },
          },
        }}
      >
        <PipeQueryBuilder
          key={builderKey}
          orientation="horizontal"
          source={builderSource}
          onSourceChange={setBuilderSource}
          availableSources={availableSources}
          availableFields={availableFields}
          onQueryChange={(q: string) => handleEditorChange(q)}
          initialSteps={builderSteps}
          compact
          showResult={false}
        />
      </Popover>

      {/* Result area */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {error ? (
          <Box sx={{ p: 1, bgcolor: 'rgba(239,83,80,0.08)', borderRadius: 1, border: '1px solid rgba(239,83,80,0.2)' }}>
            <Typography variant="caption" color="error" sx={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>
              {error}
            </Typography>
          </Box>
        ) : (
          <SmartRenderer result={result} vizHint={config.vizHint} title={config.title} />
        )}
      </Box>
    </Paper>
  );
}
