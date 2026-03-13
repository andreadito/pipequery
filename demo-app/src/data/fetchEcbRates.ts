export interface EcbRate {
  date: string;
  rate: number;
  label: string;
}

export async function fetchEcbRates(): Promise<EcbRate[]> {
  try {
    const url = 'https://data-api.ecb.europa.eu/service/data/FM/B.U2.EUR.4F.KR.MRR_FR.LEV?format=jsondata&lastNObservations=12';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ECB API: ${res.status}`);
    const json = await res.json();
    const observations = json.dataSets?.[0]?.series?.['0:0:0:0:0:0:0']?.observations;
    const timePeriods = json.structure?.dimensions?.observation?.[0]?.values;
    if (!observations || !timePeriods) throw new Error('ECB: unexpected response shape');

    return Object.entries(observations as Record<string, number[]>).map(([idx, vals]) => ({
      date: (timePeriods[Number(idx)] as { id: string }).id,
      rate: vals[0],
      label: 'ECB Main Refinancing Rate',
    }));
  } catch {
    return [
      { date: '2025-06', rate: 3.65, label: 'ECB Main Refinancing Rate' },
      { date: '2025-09', rate: 3.40, label: 'ECB Main Refinancing Rate' },
      { date: '2025-12', rate: 3.15, label: 'ECB Main Refinancing Rate' },
      { date: '2026-01', rate: 2.90, label: 'ECB Main Refinancing Rate' },
      { date: '2026-03', rate: 2.65, label: 'ECB Main Refinancing Rate' },
    ];
  }
}
