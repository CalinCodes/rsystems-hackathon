import type { Result } from '@ss/contracts';

export const CSV_HEADER = 'id,verdict,scam_type,risk_score,first_alert,red_flags';

// An id with a comma, quote or line break would shift every column after it.
const cell = (v: string): string => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Each flag once, in the order the engine found it. */
export const uniqueFlags = (r: Result): string[] => [...new Set(r.hits.map((h) => h.flag))];

/**
 * Same columns and layout as the expected-results CSV: flags joined with ";", first_alert empty when
 * there is none. Rows that could not be read have no verdict, so they are not exported.
 */
export function toCsv(results: Result[]): string {
  const lines = results.map((r) =>
    [
      cell(r.id),
      r.verdict,
      r.scamType,
      String(r.score),
      r.firstAlert === null ? '' : String(r.firstAlert),
      uniqueFlags(r).join(';'),
    ].join(','),
  );
  return [CSV_HEADER, ...lines].join('\n') + '\n';
}

/** Saves in the browser only: a Blob link, no request leaves the machine. */
export function downloadCsv(text: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
