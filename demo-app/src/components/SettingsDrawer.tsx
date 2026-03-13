import { useState } from 'react';
import {
  Drawer, Box, Typography, TextField, Button, Divider, IconButton,
  ToggleButtonGroup, ToggleButton, Chip, Tooltip, Alert, Collapse,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import CloudIcon from '@mui/icons-material/Cloud';
import CableIcon from '@mui/icons-material/Cable';
import DataObjectIcon from '@mui/icons-material/DataObject';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import type { CustomSourceConfig } from '../hooks/useCustomSources';

// Built-in source names that cannot be overridden
const BUILTIN_SOURCES = new Set(['crypto', 'fxRates', 'fxFlat', 'ecbRates', 'fedRates']);

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  fredApiKey: string;
  onFredApiKeyChange: (key: string) => void;
  onResetAll: () => void;
  // Custom sources
  customSourceConfigs: CustomSourceConfig[];
  customSourceData: Record<string, unknown[]>;
  customSourceErrors: Record<string, string>;
  onAddSource: (config: CustomSourceConfig) => void;
  onRemoveSource: (name: string) => void;
}

const TYPE_LABELS: Record<string, string> = { rest: 'REST', websocket: 'WS', json: 'JSON' };

/** Serialize headers map back to "Key: Value\n" lines for the textarea. */
function headersToString(h?: Record<string, string>): string {
  if (!h) return '';
  return Object.entries(h).map(([k, v]) => `${k}: ${v}`).join('\n');
}

export default function SettingsDrawer({
  open, onClose, fredApiKey, onFredApiKeyChange, onResetAll,
  customSourceConfigs, customSourceData, customSourceErrors,
  onAddSource, onRemoveSource,
}: SettingsDrawerProps) {
  const [draft, setDraft] = useState(fredApiKey);
  const [formOpen, setFormOpen] = useState(false);

  // Form state — used for both add & edit
  const [editingName, setEditingName] = useState<string | null>(null); // null = adding new
  const [srcName, setSrcName] = useState('');
  const [srcType, setSrcType] = useState<'rest' | 'websocket' | 'json'>('rest');
  const [srcUrl, setSrcUrl] = useState('');
  const [srcInterval, setSrcInterval] = useState('30');
  const [srcHeaders, setSrcHeaders] = useState('');
  const [srcDataPath, setSrcDataPath] = useState('');
  const [srcWsUrl, setSrcWsUrl] = useState('');
  const [srcJson, setSrcJson] = useState('');
  const [formError, setFormError] = useState('');

  const handleSave = () => {
    onFredApiKeyChange(draft);
  };

  const resetForm = () => {
    setEditingName(null);
    setSrcName('');
    setSrcType('rest');
    setSrcUrl('');
    setSrcInterval('30');
    setSrcHeaders('');
    setSrcDataPath('');
    setSrcWsUrl('');
    setSrcJson('');
    setFormError('');
  };

  const openAddForm = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEditForm = (cfg: CustomSourceConfig) => {
    setEditingName(cfg.name);
    setSrcName(cfg.name);
    setSrcType(cfg.type);
    setSrcUrl(cfg.url ?? '');
    setSrcInterval(String(cfg.interval ?? 30));
    setSrcHeaders(headersToString(cfg.headers));
    setSrcDataPath(cfg.dataPath ?? '');
    setSrcWsUrl(cfg.wsUrl ?? '');
    setSrcJson(cfg.jsonData ?? '');
    setFormError('');
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    resetForm();
  };

  const handleSubmitSource = () => {
    setFormError('');

    const name = srcName.trim();
    if (!name) { setFormError('Source name is required'); return; }
    if (!/^[a-zA-Z_]\w*$/.test(name)) { setFormError('Name must start with a letter, alphanumeric only'); return; }
    if (BUILTIN_SOURCES.has(name)) { setFormError(`"${name}" is a built-in source`); return; }
    // When adding (not editing), check for name collision with existing sources
    if (!editingName && customSourceConfigs.some(c => c.name === name)) {
      setFormError(`"${name}" already exists — edit it instead`); return;
    }
    // When editing and name changed, check for collision
    if (editingName && editingName !== name && customSourceConfigs.some(c => c.name === name)) {
      setFormError(`"${name}" already exists`); return;
    }

    const config: CustomSourceConfig = { name, type: srcType };

    switch (srcType) {
      case 'rest': {
        if (!srcUrl.trim()) { setFormError('URL is required'); return; }
        config.url = srcUrl.trim();
        config.interval = Math.max(1, parseInt(srcInterval) || 30);
        if (srcDataPath.trim()) config.dataPath = srcDataPath.trim();
        if (srcHeaders.trim()) {
          const headers: Record<string, string> = {};
          for (const line of srcHeaders.split('\n')) {
            const idx = line.indexOf(':');
            if (idx > 0) headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
          }
          if (Object.keys(headers).length > 0) config.headers = headers;
        }
        break;
      }
      case 'websocket': {
        if (!srcWsUrl.trim()) { setFormError('WebSocket URL is required'); return; }
        config.wsUrl = srcWsUrl.trim();
        break;
      }
      case 'json': {
        if (!srcJson.trim()) { setFormError('JSON data is required'); return; }
        try {
          const parsed = JSON.parse(srcJson);
          if (!Array.isArray(parsed)) { setFormError('JSON must be an array of objects'); return; }
        } catch {
          setFormError('Invalid JSON');
          return;
        }
        config.jsonData = srcJson.trim();
        break;
      }
    }

    // If editing and the name changed, remove the old source first
    if (editingName && editingName !== name) {
      onRemoveSource(editingName);
    }

    onAddSource(config);
    closeForm();
  };

  const isEditing = editingName !== null;

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: 380, bgcolor: 'background.default', p: 2.5, overflow: 'auto' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ fontSize: '1rem' }}>Settings</Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon sx={{ fontSize: 18 }} /></IconButton>
      </Box>

      {/* ── Built-in Data Sources ──────────────────────────────────────── */}
      <Typography variant="subtitle2" sx={{ mb: 1, fontSize: '0.8rem' }}>Built-in Data Sources</Typography>
      <Typography variant="body2" sx={{ fontSize: '0.72rem', mb: 1.5 }}>
        Crypto (CoinGecko), FX rates (Frankfurter), and ECB interest rates load automatically.
        Add a FRED API key to include US Federal Reserve data.
      </Typography>

      <TextField
        fullWidth size="small"
        label="FRED API Key (optional)"
        placeholder="Get free key at fred.stlouisfed.org"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        sx={{ mb: 1 }}
      />
      <Button size="small" variant="contained" onClick={handleSave} disabled={draft === fredApiKey} sx={{ mb: 2 }}>
        Save Key
      </Button>

      <Divider sx={{ mb: 2 }} />

      {/* ── Custom Data Sources ────────────────────────────────────────── */}
      <Typography variant="subtitle2" sx={{ mb: 1, fontSize: '0.8rem' }}>Custom Data Sources</Typography>
      <Typography variant="body2" sx={{ fontSize: '0.72rem', mb: 1.5 }}>
        Connect REST endpoints, WebSocket streams, or paste JSON.
        Custom sources are queryable from all panels.
      </Typography>

      {/* Source list */}
      {customSourceConfigs.length > 0 && (
        <Box sx={{ mb: 1.5 }}>
          {customSourceConfigs.map((cfg) => {
            const rows = customSourceData[cfg.name]?.length ?? 0;
            const err = customSourceErrors[cfg.name];
            const isBeingEdited = isEditing && editingName === cfg.name;
            return (
              <Box
                key={cfg.name}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  py: 0.75, px: 1, mb: 0.5, borderRadius: 1,
                  bgcolor: isBeingEdited ? 'rgba(91,156,246,0.08)' : 'rgba(255,255,255,0.03)',
                  border: '1px solid',
                  borderColor: isBeingEdited
                    ? 'rgba(91,156,246,0.3)'
                    : err ? 'rgba(239,83,80,0.3)' : 'rgba(255,255,255,0.06)',
                }}
              >
                <Tooltip title={err || (rows > 0 ? `${rows} rows` : 'Connecting...')}>
                  <FiberManualRecordIcon
                    sx={{ fontSize: 8, color: err ? '#ef5350' : rows > 0 ? '#66bb6a' : '#ffa726' }}
                  />
                </Tooltip>
                <Chip
                  label={TYPE_LABELS[cfg.type]} size="small"
                  sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600 }}
                  variant="outlined"
                />
                <Typography sx={{ flex: 1, fontSize: '0.75rem', fontWeight: 500, fontFamily: 'monospace' }}>
                  {cfg.name}
                </Typography>
                <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                  {rows} rows
                </Typography>
                <IconButton size="small" onClick={() => openEditForm(cfg)} sx={{ p: 0.25 }}>
                  <EditIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                </IconButton>
                <IconButton size="small" onClick={() => onRemoveSource(cfg.name)} sx={{ p: 0.25 }}>
                  <DeleteIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                </IconButton>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Add/Edit source toggle */}
      {!formOpen && (
        <Button
          size="small" variant="outlined"
          startIcon={<AddIcon />}
          onClick={openAddForm}
          sx={{ mb: 1, fontSize: '0.72rem' }}
        >
          Add Source
        </Button>
      )}
      {formOpen && !isEditing && (
        <Button
          size="small" variant="outlined"
          startIcon={<ExpandLessIcon />}
          onClick={closeForm}
          sx={{ mb: 1, fontSize: '0.72rem' }}
        >
          Cancel
        </Button>
      )}

      {/* Add/Edit source form */}
      <Collapse in={formOpen}>
        <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', mb: 2 }}>
          {isEditing && (
            <Typography variant="caption" sx={{ display: 'block', mb: 1, color: '#8bbcff', fontSize: '0.7rem', fontWeight: 600 }}>
              Editing "{editingName}"
            </Typography>
          )}

          <TextField
            fullWidth size="small" label="Source name"
            placeholder="e.g. orders, users, trades"
            value={srcName} onChange={(e) => setSrcName(e.target.value)}
            sx={{ mb: 1.5 }}
            disabled={isEditing} // Can't rename while editing (avoids confusion)
          />

          <ToggleButtonGroup
            value={srcType} exclusive
            onChange={(_, v) => v && setSrcType(v)}
            size="small"
            sx={{ mb: 1.5, '& .MuiToggleButton-root': { fontSize: '0.7rem', py: 0.5, px: 1.5 } }}
          >
            <ToggleButton value="rest"><CloudIcon sx={{ fontSize: 14, mr: 0.5 }} /> REST</ToggleButton>
            <ToggleButton value="websocket"><CableIcon sx={{ fontSize: 14, mr: 0.5 }} /> WS</ToggleButton>
            <ToggleButton value="json"><DataObjectIcon sx={{ fontSize: 14, mr: 0.5 }} /> JSON</ToggleButton>
          </ToggleButtonGroup>

          {/* REST fields */}
          {srcType === 'rest' && (
            <>
              <TextField
                fullWidth size="small" label="URL"
                placeholder="https://api.example.com/data"
                value={srcUrl} onChange={(e) => setSrcUrl(e.target.value)}
                sx={{ mb: 1 }}
              />
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  size="small" label="Poll (s)" type="number"
                  value={srcInterval} onChange={(e) => setSrcInterval(e.target.value)}
                  sx={{ width: 100 }}
                />
                <TextField
                  fullWidth size="small" label="Data path"
                  placeholder="e.g. data.items"
                  value={srcDataPath} onChange={(e) => setSrcDataPath(e.target.value)}
                />
              </Box>
              <TextField
                fullWidth size="small" label="Headers (one per line)"
                placeholder={"Authorization: Bearer token\nX-Api-Key: abc123"}
                multiline rows={2}
                value={srcHeaders} onChange={(e) => setSrcHeaders(e.target.value)}
                sx={{ mb: 1 }}
              />
            </>
          )}

          {/* WebSocket fields */}
          {srcType === 'websocket' && (
            <TextField
              fullWidth size="small" label="WebSocket URL"
              placeholder="wss://stream.example.com/feed"
              value={srcWsUrl} onChange={(e) => setSrcWsUrl(e.target.value)}
              sx={{ mb: 1 }}
            />
          )}

          {/* JSON fields */}
          {srcType === 'json' && (
            <TextField
              fullWidth size="small" label="JSON array"
              placeholder={'[\n  { "name": "Alice", "age": 30 },\n  { "name": "Bob", "age": 25 }\n]'}
              multiline rows={5}
              value={srcJson} onChange={(e) => setSrcJson(e.target.value)}
              sx={{ mb: 1, '& textarea': { fontFamily: 'monospace', fontSize: '0.72rem' } }}
            />
          )}

          {formError && (
            <Alert severity="error" sx={{ mb: 1, py: 0, '& .MuiAlert-message': { fontSize: '0.72rem' } }}>{formError}</Alert>
          )}

          <Box sx={{ display: 'flex', gap: 1 }}>
            {isEditing && (
              <Button size="small" variant="outlined" onClick={closeForm} sx={{ flex: 1 }}>
                Cancel
              </Button>
            )}
            <Button size="small" variant="contained" onClick={handleSubmitSource} sx={{ flex: 1 }}>
              {isEditing ? 'Save Changes' : 'Add Source'}
            </Button>
          </Box>
        </Box>
      </Collapse>

      <Divider sx={{ mb: 2 }} />

      {/* ── Reset ─────────────────────────────────────────────────────── */}
      <Typography variant="subtitle2" sx={{ mb: 1, fontSize: '0.8rem' }}>Reset</Typography>
      <Typography variant="body2" sx={{ fontSize: '0.72rem', mb: 1.5 }}>
        Reset all queries, custom sources, and custom panels to defaults.
      </Typography>
      <Button size="small" variant="outlined" color="error" onClick={onResetAll}>
        Reset All
      </Button>
    </Drawer>
  );
}
