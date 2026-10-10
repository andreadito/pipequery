import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { C, FONT_MONO } from '../tokens';

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
                  color: C.textMuted,
                  fontWeight: 500,
                  fontSize: '0.68rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  borderBottom: '1px solid',
                  borderColor: C.borderHover,
                  py: 0.75,
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
              sx={{ '&:last-child td': { border: 0 }, '&:hover': { bgcolor: C.surfaceHover } }}
            >
              {columns.map((col) => {
                const val = row[col.key];
                const formatted = col.format ? col.format(val) : String(val ?? '');
                return (
                  <TableCell
                    key={col.key}
                    align={col.align ?? 'left'}
                    sx={{
                      fontSize: '0.78rem',
                      color: highlightColor
                        ? col.key === 'changePercent24Hr'
                          ? highlightColor
                          : 'text.primary'
                        : 'text.primary',
                      borderBottom: '1px solid',
                      borderColor: C.border,
                      py: 0.6,
                      fontFamily: col.align === 'right' ? FONT_MONO : undefined,
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
