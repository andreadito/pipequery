import React from 'react';
import { Box, Text } from 'ink';

interface OrderBookProps {
  data: unknown;
}

const BLOCK = '█';
const BAR_WIDTH = 20;
const QTY_WIDTH = 10;
const PRICE_WIDTH = 12;
const ROWS = 10;

export function OrderBook({ data }: OrderBookProps) {
  const entries = Array.isArray(data) ? data : [];
  const latest = entries[entries.length - 1] as
    | { bids?: [string, string][]; asks?: [string, string][] }
    | undefined;

  if (!latest || !latest.bids || !latest.asks) {
    return <Text dimColor>Waiting for order book data...</Text>;
  }

  const bids = latest.bids.slice(0, ROWS).map(([p, q]) => ({
    price: parseFloat(p),
    qty: parseFloat(q),
  }));
  const asks = latest.asks.slice(0, ROWS).map(([p, q]) => ({
    price: parseFloat(p),
    qty: parseFloat(q),
  }));

  // Use cumulative depth for bar sizing
  const bidCum: number[] = [];
  let sum = 0;
  for (const b of bids) { sum += b.qty; bidCum.push(sum); }

  const askCum: number[] = [];
  sum = 0;
  for (const a of asks) { sum += a.qty; askCum.push(sum); }

  // Last cumulative value = full bar width (always fills to BAR_WIDTH at bottom)
  const bidMax = bidCum[bidCum.length - 1] || 1;
  const askMax = askCum[askCum.length - 1] || 1;

  return (
    <Box flexDirection="column">
      <Box>
        <Text dimColor>{pad('BIDS', BAR_WIDTH, 'right')}</Text>
        <Text dimColor>{pad('QTY', QTY_WIDTH, 'left')}</Text>
        <Text dimColor>{pad('PRICE', PRICE_WIDTH, 'left')}</Text>
        <Text dimColor>{pad('QTY', QTY_WIDTH, 'left')}</Text>
        <Text dimColor>{'ASKS'}</Text>
      </Box>
      {Array.from({ length: ROWS }, (_, i) => {
        const bid = bids[i];
        const ask = asks[i];
        // Scale each side independently so bottom row is always full width
        const bidWidth = bid ? Math.max(1, Math.round((bidCum[i] / bidMax) * BAR_WIDTH)) : 0;
        const askWidth = ask ? Math.max(1, Math.round((askCum[i] / askMax) * BAR_WIDTH)) : 0;

        return (
          <Box key={i}>
            <Text color="green">{BLOCK.repeat(bidWidth).padStart(BAR_WIDTH)}</Text>
            <Text dimColor>{pad(bid ? bid.qty.toFixed(4) : '', QTY_WIDTH, 'left')}</Text>
            <Text bold color={i < (bids.length) ? 'green' : 'red'}>
              {pad(formatPrice(bid?.price ?? ask?.price ?? 0), PRICE_WIDTH, 'left')}
            </Text>
            <Text dimColor>{pad(ask ? ask.qty.toFixed(4) : '', QTY_WIDTH, 'left')}</Text>
            <Text color="red">{BLOCK.repeat(askWidth).padEnd(BAR_WIDTH)}</Text>
          </Box>
        );
      })}
      <Box marginTop={1}>
        <Text dimColor>Spread: </Text>
        <Text color="yellow">
          {asks.length > 0 && bids.length > 0
            ? `${(asks[0].price - bids[0].price).toFixed(2)} (${((asks[0].price - bids[0].price) / bids[0].price * 100).toFixed(4)}%)`
            : '—'}
        </Text>
      </Box>
    </Box>
  );
}

function pad(s: string, width: number, align: 'left' | 'right'): string {
  return align === 'left' ? s.padStart(width) : s.padEnd(width);
}

function formatPrice(n: number): string {
  if (n >= 1000) return n.toFixed(2);
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}
