import { useState } from 'react';
import {
  Drawer, Box, Typography, TextField, Button, Divider, IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  fredApiKey: string;
  onFredApiKeyChange: (key: string) => void;
  onResetAll: () => void;
}

export default function SettingsDrawer({ open, onClose, fredApiKey, onFredApiKeyChange, onResetAll }: SettingsDrawerProps) {
  const [draft, setDraft] = useState(fredApiKey);

  const handleSave = () => {
    onFredApiKeyChange(draft);
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: 340, bgcolor: 'background.default', p: 2.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ fontSize: '1rem' }}>Settings</Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon sx={{ fontSize: 18 }} /></IconButton>
      </Box>

      <Typography variant="subtitle2" sx={{ mb: 1, fontSize: '0.8rem' }}>Data Sources</Typography>
      <Typography variant="body2" sx={{ fontSize: '0.72rem', mb: 1.5 }}>
        Crypto (CoinGecko), FX rates (Frankfurter), and ECB interest rates load automatically.
        Add a FRED API key to include US Federal Reserve data.
      </Typography>

      <TextField
        fullWidth
        size="small"
        label="FRED API Key (optional)"
        placeholder="Get free key at fred.stlouisfed.org"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        sx={{ mb: 1 }}
      />
      <Button size="small" variant="contained" onClick={handleSave} disabled={draft === fredApiKey} sx={{ mb: 3 }}>
        Save Key
      </Button>

      <Divider sx={{ mb: 2 }} />

      <Typography variant="subtitle2" sx={{ mb: 1, fontSize: '0.8rem' }}>Reset</Typography>
      <Typography variant="body2" sx={{ fontSize: '0.72rem', mb: 1.5 }}>
        Reset all panel queries to defaults and clear saved settings.
      </Typography>
      <Button size="small" variant="outlined" color="error" onClick={onResetAll}>
        Reset All
      </Button>
    </Drawer>
  );
}
