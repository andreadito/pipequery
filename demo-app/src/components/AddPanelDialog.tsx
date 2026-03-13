import { useState, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Typography, IconButton, Box,
  ToggleButtonGroup, ToggleButton, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { PanelConfig } from '../config/defaultPanels';
import QueryEditor from './QueryEditor';

interface AddPanelDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (panel: PanelConfig) => void;
  availableSources: string[];
  context?: Record<string, unknown[]>;
}

export default function AddPanelDialog({ open, onClose, onAdd, availableSources, context }: AddPanelDialogProps) {
  const [title, setTitle] = useState('');
  const [defaultQuery, setDefaultQuery] = useState('');
  const [size, setSize] = useState<'half' | 'full'>('half');
  const [vizHint, setVizHint] = useState<'auto' | 'table' | 'bar' | 'pie'>('auto');
  const [error, setError] = useState('');

  // Derive fields from the first source mentioned in the query for autocompletion
  const availableFields = useMemo(() => {
    if (!context) return [];
    const match = defaultQuery.match(/^(\w+)/);
    const src = match?.[1];
    if (src && context[src]) {
      const arr = context[src];
      if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'object') {
        return Object.keys(arr[0] as Record<string, unknown>);
      }
    }
    return [];
  }, [defaultQuery, context]);

  const resetForm = () => {
    setTitle('');
    setDefaultQuery('');
    setSize('half');
    setVizHint('auto');
    setError('');
  };

  const handleAdd = () => {
    if (!title.trim()) { setError('Title is required'); return; }
    if (!defaultQuery.trim()) { setError('Query is required'); return; }

    const panel: PanelConfig = {
      id: `custom-${Date.now()}`,
      title: title.trim(),
      defaultQuery: defaultQuery.trim(),
      size,
      vizHint,
    };

    onAdd(panel);
    resetForm();
    onClose();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: '#1a1f2e',
            border: '1px solid rgba(91,156,246,0.2)',
            borderRadius: 2,
          },
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5, px: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>Add Panel</Typography>
        <IconButton size="small" onClick={handleClose}><CloseIcon sx={{ fontSize: 18 }} /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 2, py: 1.5 }}>
        <TextField
          fullWidth size="small" label="Title"
          placeholder="e.g. User Analytics"
          value={title} onChange={(e) => setTitle(e.target.value)}
          sx={{ mb: 1.5 }}
          error={!!error && !title.trim()}
        />

        <Box sx={{ mb: 1.5 }}>
          <Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'text.secondary', fontSize: '0.7rem' }}>
            Default query
          </Typography>
          {open && (
            <QueryEditor
              value={defaultQuery}
              onChange={setDefaultQuery}
              fields={availableFields}
              sources={availableSources}
            />
          )}
          {!!error && !defaultQuery.trim() && (
            <Typography variant="caption" color="error" sx={{ fontSize: '0.68rem', mt: 0.25, display: 'block' }}>
              Query is required
            </Typography>
          )}
        </Box>

        <Typography variant="caption" sx={{ mb: 0.5, display: 'block', color: 'text.secondary', fontSize: '0.7rem' }}>
          Size
        </Typography>
        <ToggleButtonGroup
          value={size} exclusive
          onChange={(_, v) => v && setSize(v)}
          size="small"
          sx={{ mb: 1.5, '& .MuiToggleButton-root': { fontSize: '0.7rem', py: 0.5, px: 2 } }}
        >
          <ToggleButton value="half">Half</ToggleButton>
          <ToggleButton value="full">Full</ToggleButton>
        </ToggleButtonGroup>

        <FormControl fullWidth size="small" sx={{ mb: 1 }}>
          <InputLabel sx={{ fontSize: '0.8rem' }}>Visualization</InputLabel>
          <Select
            value={vizHint}
            label="Visualization"
            onChange={(e) => setVizHint(e.target.value as typeof vizHint)}
            sx={{ fontSize: '0.8rem' }}
          >
            <MenuItem value="auto">Auto</MenuItem>
            <MenuItem value="table">Table</MenuItem>
            <MenuItem value="bar">Bar Chart</MenuItem>
            <MenuItem value="pie">Pie Chart</MenuItem>
          </Select>
        </FormControl>

        {error && (
          <Typography variant="caption" color="error" sx={{ fontSize: '0.72rem' }}>
            {error}
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 1.5 }}>
        <Button size="small" onClick={handleClose}>Cancel</Button>
        <Button size="small" variant="contained" onClick={handleAdd}>Add Panel</Button>
      </DialogActions>
    </Dialog>
  );
}
