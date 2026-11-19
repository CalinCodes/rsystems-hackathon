import type { Result, Scenario, Verdict } from '@ss/contracts';
import { parseScenarioJson } from './scenarioFile';

export interface DossierRow {
  /** Folder path of the file, so two files with the same name in different folders stay apart. */
  key: string;
  /** Scenario id, or the file name without ".json" when the file could not be read. */
  id: string;
  state: 'ok' | 'error';
  scenario?: Scenario;
  result?: Result;
}

export type AnalyzeFn = (s: Scenario) => Promise<Result>;

export interface Progress {
  done: number;
  total: number;
}

export const isJsonFile = (f: File): boolean => f.name.toLowerCase().endsWith('.json');

const keyOf = (f: File): string => f.webkitRelativePath || f.name;
const stem = (name: string): string => name.replace(/\.json$/i, '');

/** Natural order (F2 before F10), then path: the same folder always gives the same table. */
export function compareRows(a: DossierRow, b: DossierRow): number {
  const byId = a.id.localeCompare(b.id, 'en', { numeric: true });
  return byId !== 0 ? byId : a.key.localeCompare(b.key, 'en', { numeric: true });
}

async function rowFor(file: File, analyze: AnalyzeFn): Promise<DossierRow> {
  const key = keyOf(file);
  const bad: DossierRow = { key, id: stem(file.name), state: 'error' };
  try {
    const parsed = parseScenarioJson(await file.text());
    if (!parsed.ok) return bad;
    const result = await analyze(parsed.scenario);
    return { key, id: parsed.scenario.id, state: 'ok', scenario: parsed.scenario, result };
  } catch {
    // A file that cannot be read or analysed becomes an error row. No error text is kept: it could
    // contain part of a message.
    return bad;
  }
}

/**
 * Reads and analyses the .json files one by one and reports each row as soon as it is done. Files that
 * are not .json are ignored. Everything goes through the same `analyze` the single check uses.
 */
export async function loadDossier(
  files: File[],
  analyze: AnalyzeFn,
  onRow: (row: DossierRow, progress: Progress) => void,
  cancelled: () => boolean = () => false,
): Promise<void> {
  const json = files.filter(isJsonFile);
  let done = 0;
  for (const file of json) {
    if (cancelled()) return;
    const row = await rowFor(file, analyze);
    if (cancelled()) return;
    done += 1;
    onRow(row, { done, total: json.length });
  }
}

export function countVerdicts(rows: DossierRow[]): Record<Verdict | 'ERROR', number> {
  const counts = { SCAM: 0, SUSPICIOUS: 0, SAFE: 0, ERROR: 0 };
  for (const r of rows) counts[r.result?.verdict ?? 'ERROR'] += 1;
  return counts;
}
