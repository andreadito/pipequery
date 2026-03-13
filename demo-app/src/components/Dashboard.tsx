import { useState, useCallback, useMemo } from 'react';
import { Container, Grid, Box, Typography, CircularProgress, Alert } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useDataSources } from '../hooks/useDataSources';
import { useCustomSources } from '../hooks/useCustomSources';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { DEFAULT_PANELS } from '../config/defaultPanels';
import type { PanelConfig } from '../config/defaultPanels';
import DashboardHeader from './DashboardHeader';
import QueryPanel from './QueryPanel';
import SettingsDrawer from './SettingsDrawer';
import AddPanelDialog from './AddPanelDialog';

export default function Dashboard() {
  const [fredApiKey, setFredApiKey] = useLocalStorage('pq-demo-fred-key', '');
  const [savedQueries, setSavedQueries] = useLocalStorage<Record<string, string>>('pq-demo-queries', {});
  const [customPanels, setCustomPanels] = useLocalStorage<PanelConfig[]>('pq-demo-custom-panels', []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addPanelOpen, setAddPanelOpen] = useState(false);

  const { context, loading, error, lastUpdated, tick, refresh } = useDataSources(fredApiKey);
  const { configs: customSourceConfigs, data: customSourceData, errors: customSourceErrors, addSource, removeSource } = useCustomSources();

  // Merge built-in and custom source data
  const mergedContext = useMemo(
    () => ({ ...context, ...customSourceData }),
    [context, customSourceData],
  );

  // All source names for the add-panel dialog hint
  const allSourceNames = useMemo(() => Object.keys(mergedContext), [mergedContext]);

  const handleQuerySave = useCallback(
    (panelId: string, q: string) => {
      const builtinPanel = DEFAULT_PANELS.find((p) => p.id === panelId);
      const customPanel = customPanels.find((p) => p.id === panelId);
      setSavedQueries((prev) => {
        const next = { ...prev };
        const defaultQ = builtinPanel?.defaultQuery ?? customPanel?.defaultQuery;
        if (defaultQ && q === defaultQ) {
          delete next[panelId];
        } else {
          next[panelId] = q;
        }
        return next;
      });
    },
    [setSavedQueries, customPanels],
  );

  const handleResetAll = useCallback(() => {
    localStorage.removeItem('pq-demo-queries');
    localStorage.removeItem('pq-demo-fred-key');
    localStorage.removeItem('pq-demo-custom-source-configs');
    localStorage.removeItem('pq-demo-custom-panels');
    window.location.reload();
  }, []);

  const handleAddPanel = useCallback(
    (panel: PanelConfig) => {
      setCustomPanels((prev) => [...prev, panel]);
    },
    [setCustomPanels],
  );

  const handleDeletePanel = useCallback(
    (panelId: string) => {
      setCustomPanels((prev) => prev.filter((p) => p.id !== panelId));
      setSavedQueries((prev) => {
        const next = { ...prev };
        delete next[panelId];
        return next;
      });
    },
    [setCustomPanels, setSavedQueries],
  );

  const hasData = context.crypto.length > 0;

  if (loading && !hasData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={32} sx={{ mb: 1.5 }} />
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
            Loading crypto, FX &amp; central bank data...
          </Typography>
        </Box>
      </Box>
    );
  }

  const statPanels = DEFAULT_PANELS.filter((p) => p.size === 'stat');
  const mainPanels = DEFAULT_PANELS.filter((p) => p.size !== 'stat');

  return (
    <Container maxWidth="xl" sx={{ pb: 4 }}>
      <DashboardHeader
        lastUpdated={lastUpdated}
        loading={loading}
        tick={tick}
        onRefresh={refresh}
        onSettingsOpen={() => setSettingsOpen(true)}
      />

      {error && (
        <Alert severity="warning" sx={{ mb: 2, fontSize: '0.78rem' }}>
          {error}
        </Alert>
      )}

      {hasData && (
        <>
          {/* Stats row */}
          <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
            {statPanels.map((panel) => (
              <Grid key={panel.id} size={{ xs: 6, sm: 3 }}>
                <QueryPanel
                  config={panel}
                  context={mergedContext}
                  savedQuery={savedQueries[panel.id]}
                  onQuerySave={handleQuerySave}
                  tick={tick}
                />
              </Grid>
            ))}
          </Grid>

          {/* Main panels (built-in) */}
          <Grid container spacing={1.5}>
            {mainPanels.map((panel) => (
              <Grid
                key={panel.id}
                size={{
                  xs: 12,
                  md: panel.size === 'full' ? 12 : 6,
                }}
              >
                <Box sx={{ height: panel.size === 'full' ? 420 : 360 }}>
                  <QueryPanel
                    config={panel}
                    context={mergedContext}
                    savedQuery={savedQueries[panel.id]}
                    onQuerySave={handleQuerySave}
                    tick={tick}
                  />
                </Box>
              </Grid>
            ))}

            {/* Custom panels */}
            {customPanels.map((panel) => (
              <Grid
                key={panel.id}
                size={{
                  xs: 12,
                  md: panel.size === 'full' ? 12 : 6,
                }}
              >
                <Box sx={{ height: panel.size === 'full' ? 420 : 360 }}>
                  <QueryPanel
                    config={panel}
                    context={mergedContext}
                    savedQuery={savedQueries[panel.id]}
                    onQuerySave={handleQuerySave}
                    tick={tick}
                    onDelete={() => handleDeletePanel(panel.id)}
                  />
                </Box>
              </Grid>
            ))}

            {/* Add Panel card */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Box
                onClick={() => setAddPanelOpen(true)}
                sx={{
                  height: 360,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 1,
                  border: '2px dashed rgba(91,156,246,0.2)',
                  bgcolor: 'rgba(91,156,246,0.02)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: 'rgba(91,156,246,0.4)',
                    bgcolor: 'rgba(91,156,246,0.06)',
                  },
                }}
              >
                <AddIcon sx={{ fontSize: 32, color: 'rgba(91,156,246,0.4)', mb: 1 }} />
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                  Add Panel
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </>
      )}

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        fredApiKey={fredApiKey}
        onFredApiKeyChange={setFredApiKey}
        onResetAll={handleResetAll}
        customSourceConfigs={customSourceConfigs}
        customSourceData={customSourceData}
        customSourceErrors={customSourceErrors}
        onAddSource={addSource}
        onRemoveSource={removeSource}
      />

      <AddPanelDialog
        open={addPanelOpen}
        onClose={() => setAddPanelOpen(false)}
        onAdd={handleAddPanel}
        availableSources={allSourceNames}
        context={mergedContext}
      />
    </Container>
  );
}
