export type PrometheusSample = {
  name: string;
  labels: Record<string, string>;
  value: number;
};

export function parsePrometheus(text: string): PrometheusSample[] {
  return text.split("\n").flatMap((raw) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return [];
    const match = line.match(
      /^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{([^}]*)\})?\s+(-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)$/,
    );
    if (!match) return [];
    const name = match[1];
    const value = Number(match[3]);
    if (!name || !Number.isFinite(value)) return [];
    return [
      {
        name,
        labels: parseLabels(match[2] ?? ""),
        value,
      },
    ];
  });
}

function parseLabels(raw: string): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const entry of raw.matchAll(
    /([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g,
  )) {
    const key = entry[1];
    const value = entry[2];
    if (!key || value === undefined) continue;
    labels[key] = value.replace(/\\"/g, '"').replace(/\\n/g, "\n");
  }
  return labels;
}

export function sumSamples(
  samples: PrometheusSample[],
  name: string,
): number {
  return samples
    .filter((sample) => sample.name === name)
    .reduce((total, sample) => total + sample.value, 0);
}
