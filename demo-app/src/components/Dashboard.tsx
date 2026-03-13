import { useState, useCallback } from 'react';
import { Container, Grid, Box, Typography, CircularProgress, Alert } from '@mui/material';
import { useDataSources } from '../hooks/useDataSources';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { DEFAULT_PANELS } from '../config/defaultPanels';
import DashboardHeader from './DashboardHeader';
import QueryPanel from './QueryPanel';
import SettingsDrawer from './SettingsDrawer';

export default function Dashboard() {
  const [fredApiKey, setFredApiKey] = useLocalStorage('pq-demo-fred-key', '');
  const [savedQueries, setSavedQueries] = useLocalStorage<Record<string, string>>('pq-demo-queries', {});
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { context, loading, error, lastUpdated, tick, refresh } = useDataSources(fredApiKey);

  const handleQuerySave = useCallback(
    (panelId: string, q: string) => {
      const panel = DEFAULT_PANELS.find((p) => p.id === panelId);
      setSavedQueries((prev) => {
        const next = { ...prev };
        if (panel && q === panel.defaultQuery) {
          delete next[panelId];
        } else {
          next[panelId] = q;
        }
        return next;
      });
    },
    [setSavedQueries],
  );

  const handleResetAll = useCallback(() => {
    localStorage.removeItem('pq-demo-queries');
    localStorage.removeItem('pq-demo-fred-key');
    window.location.reload();
  }, []);

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
                  context={context}
                  savedQuery={savedQueries[panel.id]}
                  onQuerySave={handleQuerySave}
                  tick={tick}
                />
              </Grid>
            ))}
          </Grid>

          {/* Main panels */}
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
                    context={context}
                    savedQuery={savedQueries[panel.id]}
                    onQuerySave={handleQuerySave}
                    tick={tick}
                  />
                </Box>
              </Grid>
            ))}
          </Grid>
        </>
      )}

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        fredApiKey={fredApiKey}
        onFredApiKeyChange={setFredApiKey}
        onResetAll={handleResetAll}
      />
    </Container>
  );
}
