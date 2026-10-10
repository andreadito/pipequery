import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Paper, Box, Typography, IconButton, Collapse, Tooltip, Chip, Dialog, DialogTitle, DialogContent } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
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
import QueryDisplay from './QueryDisplay';
import SmartRenderer from './SmartRenderer';
import PipeQueryBuilder from '../../../src/react/PipeQueryBuilder';
import { C, alpha, FONT_MONO } from '../tokens';

interface QueryPanelProps {
  config: PanelConfig;
  context: Record<string, unknown[]>;
  savedQuery?: string;
  onQuerySave: (panelId: string, query: string) => void;
  tick: number;
  onDelete?: () => void;
}

export default function QueryPanel({ config, context, savedQuery, onQuerySave, tick, onDelete }: QueryPanelProps) {
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
  const [builderOpen, setBuilderOpen] = useState(false);

  const switchToBuilder = useCallback((_event: React.MouseEvent<HTMLElement>) => {
    const parsed = parseQueryToSteps(draftQuery);
    setBuilderSource(parsed.source || 'crypto');
    setBuilderSteps(parsed.steps);
    setBuilderKey(k => k + 1);
    setBuilderOpen(true);
    setEditorMode('builder');
  }, [draftQuery]);

  const closeBuilder = useCallback(() => {
    setBuilderOpen(false);
    setEditorMode('code');
  }, []);

  // --- STAT card ---
  if (isStat) {
    return (
      <Paper sx={{ p: 1.5, height: '100%', position: 'relative', overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" sx={{ color: C.textMuted, fontSize: '0.66rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
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
            <QueryEditor value={draftQuery} onChange={handleEditorChange} fields={availableFields} sources={availableSources} />
          </Box>
        </Collapse>

        {!editing && (
          <Box
            onClick={() => setEditing(true)}
            sx={{
              mt: 0.5,
              px: 0.75,
              py: 0.25,
              bgcolor: C.bg,
              border: '1px solid',
              borderColor: C.border,
              fontFamily: FONT_MONO,
              fontSize: '0.6rem',
              color: C.textMuted,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              '&:hover': { borderColor: C.borderHover, color: C.text },
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
          {isModified && <Chip label="modified" size="small" sx={{ height: 18, fontSize: '0.6rem', borderColor: alpha(C.blue, 0.5) }} color="primary" variant="outlined" />}
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
          {onDelete && (
            <Tooltip title="Delete panel">
              <IconButton size="small" onClick={onDelete} sx={{ ml: 0.25 }}>
                <DeleteOutlineIcon sx={{ fontSize: 16, color: 'text.secondary', '&:hover': { color: C.down } }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Query display (read-only, syntax highlighted, when not editing) */}
      {!editing && (
        <Box sx={{ mb: 1.5 }}>
          <QueryDisplay value={currentQuery} onClick={() => setEditing(true)} />
        </Box>
      )}

      {/* Code editor (expanded, hidden when builder dialog is open) */}
      <Collapse in={editing && !builderOpen}>
        <Box sx={{ mb: 1.5 }}>
          <QueryEditor value={draftQuery} onChange={handleEditorChange} fields={availableFields} sources={availableSources} />
        </Box>
      </Collapse>

      {/* Visual builder dialog */}
      <Dialog
        open={builderOpen}
        onClose={closeBuilder}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: C.surface,
              border: '1px solid',
              borderColor: C.borderHover,
              maxHeight: '80vh',
            },
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5, px: 2, borderBottom: '1px solid', borderColor: C.border }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: C.text }}>
            Visual Query Builder — {config.title}
          </Typography>
          <IconButton size="small" onClick={closeBuilder} sx={{ color: 'text.secondary' }}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 2 }}>
          <PipeQueryBuilder
            key={builderKey}
            orientation="vertical"
            source={builderSource}
            onSourceChange={setBuilderSource}
            availableSources={availableSources}
            availableFields={availableFields}
            onQueryChange={(q: string) => handleEditorChange(q)}
            initialSteps={builderSteps}
            showResult={false}
          />
        </DialogContent>
      </Dialog>

      {/* Result area */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {error ? (
          <Box sx={{ p: 1, bgcolor: alpha(C.down, 0.06), borderLeft: '2px solid', borderColor: C.down }}>
            <Typography variant="caption" sx={{ color: C.down, fontFamily: FONT_MONO, fontSize: '0.72rem' }}>
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
