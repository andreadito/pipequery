export interface CryptoAsset {
  id: string;
  rank: number;
  symbol: string;
  name: string;
  supply: number;
  maxSupply: number | null;
  marketCapUsd: number;
  volumeUsd24Hr: number;
  priceUsd: number;
  changePercent24Hr: number;
  vwap24Hr: number;
}

async function fetchFromCoinGecko(): Promise<CryptoAsset[]> {
  const url =
    'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);
  const json = await res.json();
  return (json as Record<string, unknown>[]).map((d, i) => ({
    id: String(d.id ?? ''),
    rank: i + 1,
    symbol: String(d.symbol ?? '').toUpperCase(),
    name: String(d.name ?? ''),
    supply: Number(d.circulating_supply) || 0,
    maxSupply: d.max_supply ? Number(d.max_supply) : null,
    marketCapUsd: Number(d.market_cap) || 0,
    volumeUsd24Hr: Number(d.total_volume) || 0,
    priceUsd: Number(d.current_price) || 0,
    changePercent24Hr: Number(d.price_change_percentage_24h) || 0,
    vwap24Hr: Number(d.current_price) || 0,
  }));
}

async function fetchFromCoinCap(): Promise<CryptoAsset[]> {
  const res = await fetch('https://api.coincap.io/v2/assets?limit=50');
  if (!res.ok) throw new Error(`CoinCap API error: ${res.status}`);
  const json = await res.json();
  return (json.data as Record<string, string | null>[]).map((d) => ({
    id: d.id ?? '',
    rank: Number(d.rank) || 0,
    symbol: (d.symbol ?? '').toUpperCase(),
    name: d.name ?? '',
    supply: Number(d.supply) || 0,
    maxSupply: d.maxSupply ? Number(d.maxSupply) : null,
    marketCapUsd: Number(d.marketCapUsd) || 0,
    volumeUsd24Hr: Number(d.volumeUsd24Hr) || 0,
    priceUsd: Number(d.priceUsd) || 0,
    changePercent24Hr: Number(d.changePercent24Hr) || 0,
    vwap24Hr: Number(d.vwap24Hr) || 0,
  }));
}

function generateFallbackData(): CryptoAsset[] {
  const coins = [
    { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', price: 68432.51, mcap: 1348e9, vol: 28.5e9, supply: 19.7e6, max: 21e6, chg: 2.34 },
    { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', price: 3521.87, mcap: 423e9, vol: 15.2e9, supply: 120.2e6, max: null, chg: -1.12 },
    { id: 'tether', symbol: 'USDT', name: 'Tether', price: 1.0, mcap: 110e9, vol: 52.3e9, supply: 110e9, max: null, chg: 0.01 },
    { id: 'bnb', symbol: 'BNB', name: 'BNB', price: 598.42, mcap: 89e9, vol: 1.8e9, supply: 149e6, max: 200e6, chg: 1.87 },
    { id: 'solana', symbol: 'SOL', name: 'Solana', price: 172.35, mcap: 78e9, vol: 3.1e9, supply: 452e6, max: null, chg: 5.42 },
    { id: 'xrp', symbol: 'XRP', name: 'XRP', price: 0.5234, mcap: 56e9, vol: 1.4e9, supply: 54e9, max: 100e9, chg: -0.87 },
    { id: 'usdc', symbol: 'USDC', name: 'USD Coin', price: 1.0, mcap: 33e9, vol: 6.8e9, supply: 33e9, max: null, chg: -0.02 },
    { id: 'cardano', symbol: 'ADA', name: 'Cardano', price: 0.4521, mcap: 16e9, vol: 0.45e9, supply: 35.5e9, max: 45e9, chg: -2.15 },
    { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', price: 0.1523, mcap: 21.8e9, vol: 1.2e9, supply: 143e9, max: null, chg: 8.32 },
    { id: 'avalanche', symbol: 'AVAX', name: 'Avalanche', price: 35.67, mcap: 13.2e9, vol: 0.52e9, supply: 371e6, max: 720e6, chg: 3.21 },
    { id: 'tron', symbol: 'TRX', name: 'TRON', price: 0.1234, mcap: 10.8e9, vol: 0.38e9, supply: 87.5e9, max: null, chg: -0.45 },
    { id: 'polkadot', symbol: 'DOT', name: 'Polkadot', price: 7.12, mcap: 9.8e9, vol: 0.28e9, supply: 1.38e9, max: null, chg: 1.65 },
    { id: 'chainlink', symbol: 'LINK', name: 'Chainlink', price: 14.52, mcap: 8.5e9, vol: 0.42e9, supply: 587e6, max: 1e9, chg: -3.21 },
    { id: 'polygon', symbol: 'MATIC', name: 'Polygon', price: 0.7234, mcap: 6.7e9, vol: 0.31e9, supply: 9.3e9, max: 10e9, chg: 4.56 },
    { id: 'litecoin', symbol: 'LTC', name: 'Litecoin', price: 72.34, mcap: 5.4e9, vol: 0.35e9, supply: 74.6e6, max: 84e6, chg: -1.23 },
    { id: 'uniswap', symbol: 'UNI', name: 'Uniswap', price: 7.89, mcap: 4.7e9, vol: 0.18e9, supply: 600e6, max: 1e9, chg: 2.87 },
    { id: 'bitcoin-cash', symbol: 'BCH', name: 'Bitcoin Cash', price: 245.67, mcap: 4.8e9, vol: 0.22e9, supply: 19.6e6, max: 21e6, chg: -0.56 },
    { id: 'stellar', symbol: 'XLM', name: 'Stellar', price: 0.1123, mcap: 3.2e9, vol: 0.09e9, supply: 28.8e9, max: 50e9, chg: 1.45 },
    { id: 'cosmos', symbol: 'ATOM', name: 'Cosmos', price: 8.45, mcap: 3.0e9, vol: 0.12e9, supply: 350e6, max: null, chg: -4.32 },
    { id: 'filecoin', symbol: 'FIL', name: 'Filecoin', price: 5.67, mcap: 2.8e9, vol: 0.15e9, supply: 490e6, max: 2e9, chg: 6.78 },
  ];
  return coins.map((c, i) => ({
    id: c.id, rank: i + 1, symbol: c.symbol, name: c.name,
    supply: c.supply, maxSupply: c.max, marketCapUsd: c.mcap,
    volumeUsd24Hr: c.vol, priceUsd: c.price,
    changePercent24Hr: c.chg, vwap24Hr: c.price,
  }));
}

export async function fetchCrypto(): Promise<CryptoAsset[]> {
  try { return await fetchFromCoinGecko(); } catch { /* fallthrough */ }
  try { return await fetchFromCoinCap(); } catch { /* fallthrough */ }
  console.warn('All crypto APIs unavailable, using fallback data');
  return generateFallbackData();
}
