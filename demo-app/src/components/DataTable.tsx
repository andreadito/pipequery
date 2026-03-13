import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';

interface DataTableProps {
  rows: Record<string, unknown>[];
  columns: { key: string; label: string; align?: 'left' | 'right'; format?: (v: unknown) => string }[];
  highlightColor?: string;
}

export default function DataTable({ rows, columns, highlightColor }: DataTableProps) {
  return (
    <TableContainer sx={{ maxHeight: '100%' }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            {columns.map((col) => (
              <TableCell
                key={col.key}
                align={col.align ?? 'left'}
                sx={{
                  bgcolor: 'background.paper',
                  color: 'text.secondary',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  py: 1,
                }}
              >
                {col.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow
              key={i}
              sx={{ '&:last-child td': { border: 0 }, '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}
            >
              {columns.map((col) => {
                const val = row[col.key];
                const formatted = col.format ? col.format(val) : String(val ?? '');
                return (
                  <TableCell
                    key={col.key}
                    align={col.align ?? 'left'}
                    sx={{
                      fontSize: '0.82rem',
                      color: highlightColor
                        ? col.key === 'changePercent24Hr'
                          ? highlightColor
                          : 'text.primary'
                        : 'text.primary',
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      py: 0.8,
                      fontFamily: col.align === 'right' ? '"JetBrains Mono", monospace' : undefined,
                    }}
                  >
                    {formatted}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
