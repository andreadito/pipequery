export interface FxRate {
  currency: string;
  rate: number;
}

export async function fetchFxRates(): Promise<FxRate[]> {
  try {
    const res = await fetch('https://api.frankfurter.dev/v1/latest?base=USD');
    if (!res.ok) throw new Error(`Frankfurter API: ${res.status}`);
    const json = await res.json();
    const rates = json.rates as Record<string, number>;
    return Object.entries(rates).map(([currency, rate]) => ({ currency, rate }));
  } catch {
    // Fallback rates
    return [
      { currency: 'EUR', rate: 0.92 },
      { currency: 'GBP', rate: 0.79 },
      { currency: 'JPY', rate: 149.5 },
      { currency: 'CHF', rate: 0.88 },
      { currency: 'CAD', rate: 1.36 },
      { currency: 'AUD', rate: 1.53 },
      { currency: 'CNY', rate: 7.24 },
      { currency: 'INR', rate: 83.1 },
    ];
  }
}
