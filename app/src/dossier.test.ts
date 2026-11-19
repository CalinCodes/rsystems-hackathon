import { describe, expect, it } from 'vitest';
import { analyzeScenario } from './analyzeScenario';
import { compareRows, countVerdicts, loadDossier, type DossierRow } from './dossier';

const scenario = (id: string, text: string) =>
  JSON.stringify({
    id,
    channel: 'sms',
    sender: { name: null, address: null, known_contact: false },
    messages: [{ n: 1, from: 'sender', text }],
  });
const file = (name: string, body: string) => new File([body], name, { type: 'application/json' });

async function load(files: File[]): Promise<{ rows: DossierRow[]; ticks: number[] }> {
  const rows: DossierRow[] = [];
  const ticks: number[] = [];
  await loadDossier(files, analyzeScenario, (row, p) => {
    rows.push(row);
    ticks.push(p.done * 100 + p.total);
  });
  return { rows: rows.sort(compareRows), ticks };
}

const files = () => [
  file('b.json', scenario('T10', 'Cardul dvs. a fost blocat. Accesați în 2 ore: bancadunarea-securizat.example')),
  file('a.json', scenario('T2', 'Ne vedem mâine la cafea.')),
  file('notes.txt', 'not a scenario'),
  file('broken.json', '{ nope'),
];

describe('loadDossier', () => {
  it('ignores files that are not .json', async () => {
    const { rows } = await load(files());
    expect(rows.map((r) => r.key)).not.toContain('notes.txt');
    expect(rows).toHaveLength(3);
  });

  it('turns a malformed file into an error row named after the file, without a result', async () => {
    const { rows } = await load(files());
    const bad = rows.find((r) => r.state === 'error');
    expect(bad).toMatchObject({ id: 'broken', state: 'error' });
    expect(bad?.result).toBeUndefined();
  });

  it('reports progress after every file, out of the .json total only', async () => {
    const { ticks } = await load(files());
    expect(ticks).toEqual([103, 203, 303]);
  });

  it('sorts naturally by id: T2 before T10', async () => {
    const { rows } = await load(files());
    expect(rows.map((r) => r.id)).toEqual(['broken', 'T2', 'T10']);
  });

  it('gives an identical table when the same folder is loaded twice', async () => {
    const strip = (rows: DossierRow[]) =>
      rows.map((r) => ({ ...r, result: r.result && { ...r.result, timingsMs: {} } }));
    expect(strip((await load(files())).rows)).toEqual(strip((await load(files())).rows));
  });

  it('stops quietly when cancelled', async () => {
    const seen: DossierRow[] = [];
    await loadDossier(files(), analyzeScenario, (r) => seen.push(r), () => true);
    expect(seen).toEqual([]);
  });

  it('keeps two files with the same id apart by their path', async () => {
    const { rows } = await load([file('x.json', scenario('D1', 'a')), file('y.json', scenario('D1', 'b'))]);
    expect(new Set(rows.map((r) => r.key)).size).toBe(2);
  });
});

describe('countVerdicts', () => {
  it('counts each verdict and the unreadable files', async () => {
    const { rows } = await load(files());
    const c = countVerdicts(rows);
    expect(c.ERROR).toBe(1);
    expect(c.SCAM + c.SUSPICIOUS + c.SAFE).toBe(2);
    expect(c.SAFE).toBeGreaterThanOrEqual(1);
  });
});
