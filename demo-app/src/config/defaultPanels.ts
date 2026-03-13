export interface PanelConfig {
  id: string;
  title: string;
  defaultQuery: string;
  size: 'stat' | 'half' | 'full';
  vizHint: 'auto' | 'table' | 'bar' | 'pie' | 'stat';
}

export const DEFAULT_PANELS: PanelConfig[] = [
  // Stats row
  {
    id: 'total-mcap',
    title: 'Total Market Cap',
    defaultQuery: 'crypto | sum(marketCapUsd)',
    size: 'stat',
    vizHint: 'stat',
  },
  {
    id: 'avg-change',
    title: 'Avg 24h Change',
    defaultQuery: 'crypto | avg(changePercent24Hr)',
    size: 'stat',
    vizHint: 'stat',
  },
  {
    id: 'top-coin',
    title: 'Top Coin',
    defaultQuery: 'crypto | sort(marketCapUsd desc) | first(1) | select(name, priceUsd)',
    size: 'stat',
    vizHint: 'stat',
  },
  {
    id: 'assets-count',
    title: 'Assets Tracked',
    defaultQuery: 'crypto | count()',
    size: 'stat',
    vizHint: 'stat',
  },

  // Main panels
  {
    id: 'multi-currency',
    title: 'Multi-Currency Prices (Join Demo)',
    defaultQuery:
      'crypto | sort(marketCapUsd desc) | first(10) | join(fxFlat, 1 == 1) | select(symbol, name, priceUsd, round(priceUsd * EUR, 2) as priceEur, round(priceUsd * GBP, 2) as priceGbp, round(priceUsd * JPY, 0) as priceJpy)',
    size: 'full',
    vizHint: 'table',
  },
  {
    id: 'volume-leaders',
    title: 'Volume Leaders (24h)',
    defaultQuery: 'crypto | sort(volumeUsd24Hr desc) | first(8) | select(symbol, volumeUsd24Hr)',
    size: 'half',
    vizHint: 'bar',
  },
  {
    id: 'mcap-pie',
    title: 'Market Cap Distribution',
    defaultQuery: 'crypto | sort(marketCapUsd desc) | first(8) | select(name, marketCapUsd)',
    size: 'half',
    vizHint: 'pie',
  },
  {
    id: 'top-movers',
    title: 'Top Movers (24h)',
    defaultQuery:
      'crypto | sort(changePercent24Hr desc) | first(5) | select(symbol, name, priceUsd, changePercent24Hr)',
    size: 'half',
    vizHint: 'table',
  },
  {
    id: 'ecb-rates',
    title: 'ECB Interest Rate History',
    defaultQuery: 'ecbRates | sort(date desc) | select(date, rate, label)',
    size: 'half',
    vizHint: 'table',
  },
  {
    id: 'supply-analysis',
    title: 'Supply Analysis',
    defaultQuery:
      'crypto | where(maxSupply != null) | map(symbol, supply, maxSupply, round(supply / maxSupply * 100, 1) as percentMined) | sort(percentMined desc) | first(10)',
    size: 'full',
    vizHint: 'bar',
  },
  {
    id: 'full-market',
    title: 'Full Market',
    defaultQuery:
      'crypto | sort(marketCapUsd desc) | select(rank, symbol, name, priceUsd, changePercent24Hr, marketCapUsd, volumeUsd24Hr, supply)',
    size: 'full',
    vizHint: 'table',
  },
];
