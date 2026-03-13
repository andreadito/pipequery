const UNITS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
};

export function parseDuration(input: string): number {
  const match = input.trim().match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h)$/);
  if (!match) throw new Error(`Invalid duration: "${input}". Use format like "30s", "5m", "1h".`);
  return parseFloat(match[1]) * UNITS[match[2]];
}
