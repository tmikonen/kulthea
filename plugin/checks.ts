/** Small checks that help the author find slips: unconfigured languages in short texts and unlisted fields. */

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The number of single-character edits (insert, delete, replace, or swap of two neighbours) between two words. */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** The listed field closest to `field`, if it is within two typing mistakes. */
export function suggestField(field: string, listed: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestDistance = 3;
  for (const candidate of listed) {
    const distance = editDistance(field.toLowerCase(), candidate.toLowerCase());
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

/** Warns about each field of `source` that is not in `listed`. `where` is the text before the message, for example "the front matter". */
export function warnUnlistedFields(
  source: Json,
  listed: readonly string[],
  where: string,
  warn: (problem: string) => void,
): void {
  for (const field of Object.keys(source)) {
    if (listed.includes(field)) continue;
    const suggestion = suggestField(field, listed);
    warn(`${where}the field "${field}" is not used${suggestion ? `, did you mean "${suggestion}"?` : ''}`);
  }
}

/** Reports each language of a language map that is not configured. A plain value and anything that is not a map pass. */
export function checkLanguageMap(
  value: unknown,
  languages: readonly string[],
  field: string,
  err: (problem: string) => void,
): void {
  if (!isRecord(value)) return;
  for (const lang of Object.keys(value)) {
    if (!languages.includes(lang)) err(`${field} has a text in the language "${lang}", which is not configured in campaign.json`);
  }
}
