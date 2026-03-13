import { Box, Typography } from '@mui/material';
import DataTable from './DataTable';
import ChartRenderer from './ChartRenderer';

function fmtCell(v: unknown): string {
  if (typeof v === 'number') {
    if (Math.abs(v) >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
    if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
    if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
    if (Math.abs(v) >= 1) return v.toFixed(2);
    return v.toFixed(6);
  }
  return String(v ?? '');
}

function fmtStat(v: number): string {
  if (Math.abs(v) >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  // Small numbers: could be a percentage, count, or rate
  if (Number.isInteger(v)) return String(v);
  if (Math.abs(v) < 100 && Math.abs(v) > 0.001) return v.toFixed(2);
  return v.toFixed(6);
}

interface SmartRendererProps {
  result: unknown;
  vizHint: 'auto' | 'table' | 'bar' | 'pie' | 'stat';
  title?: string;
}

export default function SmartRenderer({ result, vizHint }: SmartRendererProps) {
  // Scalar value
  if (typeof result === 'number' || typeof result === 'string') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '1.3rem' }}>
          {typeof result === 'number' ? fmtStat(result) : result}
        </Typography>
      </Box>
    );
  }

  // Array of objects
  if (Array.isArray(result) && result.length > 0 && typeof result[0] === 'object') {
    const rows = result as Record<string, unknown>[];

    // Stat hint on single-row result
    if (vizHint === 'stat' && rows.length === 1) {
      const vals = Object.values(rows[0]);
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
            {vals.map((v) => (typeof v === 'number' ? fmtStat(v) : String(v))).join(' · ')}
          </Typography>
        </Box>
      );
    }

    // Chart hints
    if (vizHint === 'bar' || vizHint === 'pie') {
      return <ChartRenderer data={rows} type={vizHint} />;
    }

    // Auto: 2 columns with second numeric → bar chart
    const keys = Object.keys(rows[0]);
    if (vizHint === 'auto' && keys.length === 2) {
      const secondIsNumeric = rows.every((r) => typeof r[keys[1]] === 'number');
      if (secondIsNumeric && rows.length <= 15) {
        return <ChartRenderer data={rows} type="bar" />;
      }
    }

    // Default: table
    const columns = keys.map((key) => {
      const isNumeric = rows.some((r) => typeof r[key] === 'number' && r[key] !== 0);
      return {
        key,
        label: key,
        align: isNumeric ? ('right' as const) : ('left' as const),
        format: isNumeric ? (v: unknown) => fmtCell(v) : undefined,
      };
    });

    return <DataTable rows={rows} columns={columns} />;
  }

  // Empty array
  if (Array.isArray(result) && result.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5 }}>
        <Typography variant="body2">No results</Typography>
      </Box>
    );
  }

  // Fallback
  return (
    <Box sx={{ p: 1, fontFamily: 'monospace', fontSize: '0.75rem', color: 'text.secondary', overflow: 'auto' }}>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </Box>
  );
}
