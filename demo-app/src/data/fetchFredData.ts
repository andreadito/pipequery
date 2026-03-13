export interface FredObservation {
  date: string;
  seriesId: string;
  value: number;
  label: string;
}

async function fetchSeries(seriesId: string, apiKey: string, label: string): Promise<FredObservation[]> {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=12`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FRED API: ${res.status}`);
  const json = await res.json();
  return (json.observations as { date: string; value: string }[])
    .filter((o) => o.value !== '.')
    .map((o) => ({
      date: o.date,
      seriesId,
      value: Number(o.value),
      label,
    }));
}

export async function fetchFredData(apiKey: string): Promise<FredObservation[]> {
  if (!apiKey) return [];
  try {
    const [dff, dgs10] = await Promise.all([
      fetchSeries('DFF', apiKey, 'Fed Funds Rate'),
      fetchSeries('DGS10', apiKey, '10Y Treasury Yield'),
    ]);
    return [...dff, ...dgs10];
  } catch (e) {
    console.warn('FRED fetch failed:', e);
    return [];
  }
}
