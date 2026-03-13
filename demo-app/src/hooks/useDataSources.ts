import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchCrypto } from '../data/fetchCrypto';
import type { CryptoAsset } from '../data/fetchCrypto';
import { fetchFxRates } from '../data/fetchFxRates';
import type { FxRate } from '../data/fetchFxRates';
import { fetchEcbRates } from '../data/fetchEcbRates';
import type { EcbRate } from '../data/fetchEcbRates';
import { fetchFredData } from '../data/fetchFredData';
import type { FredObservation } from '../data/fetchFredData';

export interface DataSources {
  crypto: CryptoAsset[];
  fxRates: FxRate[];
  fxFlat: Record<string, number>[];
  ecbRates: EcbRate[];
  fedRates: FredObservation[];
}

export interface DataSourcesState {
  data: DataSources;
  context: Record<string, unknown[]>;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  tick: number;
  refresh: () => void;
}

const EMPTY: DataSources = { crypto: [], fxRates: [], fxFlat: [], ecbRates: [], fedRates: [] };

export function useDataSources(fredApiKey: string): DataSourcesState {
  const [data, setData] = useState<DataSources>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [crypto, fxRates, ecbRates, fedRates] = await Promise.all([
        fetchCrypto(),
        fetchFxRates(),
        fetchEcbRates(),
        fetchFredData(fredApiKey),
      ]);

      // fxFlat: single row with all currencies as columns for easy joins
      const fxFlat: Record<string, number>[] = [
        Object.fromEntries(fxRates.map((r) => [r.currency, r.rate])) as Record<string, number>,
      ];

      setData({ crypto, fxRates, fxFlat, ecbRates, fedRates });
      setLastUpdated(new Date());
      setTick((t) => t + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [fredApiKey]);

  useEffect(() => {
    loadAll();

    // Poll crypto every 30s
    intervalRef.current = setInterval(() => {
      loadAll();
    }, 30_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadAll]);

  const context = {
    crypto: data.crypto,
    fxRates: data.fxRates,
    fxFlat: data.fxFlat,
    ecbRates: data.ecbRates,
    fedRates: data.fedRates,
  };

  return { data, context, loading, error, lastUpdated, tick, refresh: loadAll };
}
